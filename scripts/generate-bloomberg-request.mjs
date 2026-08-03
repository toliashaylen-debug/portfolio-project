// Reads the live holdings out of Supabase, applies each portfolio's sourcing
// restriction (p1 = Cover Page only, p2 = Active Portfolio only, p3 = its one
// sheet), and writes out everything needed to pull 5y of daily closes on a
// Bloomberg Terminal.
//
//   node scripts/generate-bloomberg-request.mjs
//
// Output lands in bloomberg-request/.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PORTFOLIO_IDS, SOURCE_SHEETS, fetchHistory } from './shared.mjs';

// Securities you already hold but which aren't in an uploaded snapshot yet.
// One per line as "<app ticker> = <bloomberg ticker>", e.g.
//     SNDK = SNDK US Equity
// Lets you pull history for a new position on the same Terminal trip, before
// the spreadsheet reflecting it has been uploaded.
const EXTRA_PATH = 'bloomberg-request/extra-tickers.txt';
function readExtras() {
  if (!existsSync(EXTRA_PATH)) return [];
  return readFileSync(EXTRA_PATH, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const [left, right] = line.split('=').map((s) => s.trim());
      return { ticker: left, bbg: right || left, confident: true, manual: true };
    });
}

// Best-effort mapping from the identifier as it appears in the spreadsheet to
// Bloomberg ticker syntax. Anything uncertain is flagged for manual review
// rather than silently guessed — the Terminal's autocomplete is authoritative.
function toBloombergTicker(ticker, sleeve) {
  const t = String(ticker).trim();

  // Already carries a 2-letter country/exchange code (e.g. "CAN LN", "AIR FP").
  if (/^[A-Z0-9.]+ [A-Z]{2}$/.test(t)) return { bbg: `${t} Equity`, confident: true };

  // ISIN — resolve via the /isin/ prefix.
  if (/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(t)) {
    return { bbg: `/isin/${t}`, confident: false, note: 'ISIN — confirm it resolves to the right <Govt>/<Corp> instrument' };
  }

  // Bond descriptors: "<issuer> <coupon> <maturity>", e.g. "T 4.375 05/15/36",
  // "AAPL 4.75 05/12/2035", "NTT 0 06/20/2029 144A", "B 0 08/11/26".
  if (/\s\d/.test(t) && /\d{2}\/\d{2}\/\d{2,4}/.test(t)) {
    const isTreasury = /^(T|B)\s/.test(t);
    return {
      bbg: `${t} ${isTreasury ? 'Govt' : 'Corp'}`,
      confident: false,
      note: `${isTreasury ? 'Treasury' : 'Corporate'} bond — verify the exact security on the Terminal`,
    };
  }

  // Perpetual preferred, e.g. "MSTR 12 PERP".
  if (/\sPERP$/i.test(t)) {
    return { bbg: `${t} Corp`, confident: false, note: 'Perpetual preferred — verify instrument type (Corp vs Pfd)' };
  }

  // Plain alphabetic symbol with no exchange code — assume US listing.
  if (/^[A-Z.]{1,6}$/.test(t)) return { bbg: `${t} US Equity`, confident: true };

  return { bbg: t, confident: false, note: 'Unrecognized identifier format — set manually' };
}

const rows = [];
for (const id of PORTFOLIO_IDS) {
  const hist = await fetchHistory(id);
  if (!hist || !hist.length) {
    rows.push({ id, empty: true });
    continue;
  }
  const latest = hist[hist.length - 1];
  for (const p of latest.positions) {
    const m = toBloombergTicker(p.ticker, p.sleeve);
    rows.push({ id, ticker: p.ticker, sleeve: p.sleeve, sourceSheet: p.sourceSheet, ...m });
  }
}

const holdings = rows.filter((r) => !r.empty);
const extras = readExtras();
// De-duplicate: a ticker held in more than one book only needs pulling once
// (XLV, for example, sits in both Shaylen's and Antonio's books). Manual extras
// are appended after, and skipped if the snapshot already covers them.
const unique = [...new Map([...holdings, ...extras].map((h) => [h.bbg, h])).values()];
const needsReview = unique.filter((h) => !h.confident);

mkdirSync('bloomberg-request', { recursive: true });

writeFileSync('bloomberg-request/tickers.txt', unique.map((h) => h.bbg).join('\n') + '\n');

// Reverse map so the importer can tie a Bloomberg column header back to the
// ticker as it appears in the app's position data. If you correct a ticker on
// the Terminal, correct the key here too.
writeFileSync(
  'bloomberg-request/ticker-map.json',
  JSON.stringify(Object.fromEntries(unique.map((h) => [h.bbg, h.ticker])), null, 2) + '\n'
);

// "Per=D" is load-bearing: without it the Excel wizard may default to annual or
// monthly periodicity. Annual data yields only 4 returns over 5 years, which is
// far too few to estimate volatility (95% CI spans roughly 0.6x to 3.7x the
// estimate) and cannot produce a usable correlation matrix at all.
const bdhHeader = `IMPORTANT: these formulas request DAILY closes ("Per=D") — about 1,260
observations per security over five years. Do not change the periodicity to
weekly/monthly/annual: the volatility and correlation estimates need daily data
to be meaningful, and the importer will reject anything sparser.

`;
const bdh = unique
  .map((h, i) => `${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}\t=BDH("${h.bbg}","PX_LAST",TODAY()-1826,TODAY(),"Per=D","Dir=V","Days=T","Fill=P","cols=1;rows=1400")`)
  .join('\n');
writeFileSync('bloomberg-request/bdh-formulas.txt', bdhHeader + bdh + '\n');

const py = `# Run on a machine logged into a Bloomberg Terminal:
#     pip install blpapi pandas
#     python fetch.py
# Writes prices.csv (date column + one column per security).
import blpapi, pandas as pd, datetime as dt

SECURITIES = [
${unique.map((h) => `    ${JSON.stringify(h.bbg)},`).join('\n')}
]

END = dt.date.today()
START = END - dt.timedelta(days=5 * 365 + 1)

session = blpapi.Session()
if not session.start() or not session.openService("//blp/refdata"):
    raise SystemExit("Could not connect to the Terminal — is it running and logged in?")
svc = session.getService("//blp/refdata")

frames = {}
for sec in SECURITIES:
    req = svc.createRequest("HistoricalDataRequest")
    req.append("securities", sec)
    req.append("fields", "PX_LAST")
    req.set("periodicitySelection", "DAILY")
    req.set("nonTradingDayFillOption", "PREVIOUS_VALUE")
    req.set("startDate", START.strftime("%Y%m%d"))
    req.set("endDate", END.strftime("%Y%m%d"))
    session.sendRequest(req)

    dates, px = [], []
    while True:
        ev = session.nextEvent(30000)
        for msg in ev:
            sd = msg.getElement("securityData") if msg.hasElement("securityData") else None
            if sd is None:
                continue
            if sd.hasElement("securityError"):
                print("!! no data:", sec, sd.getElement("securityError"))
                continue
            fd = sd.getElement("fieldData")
            for i in range(fd.numValues()):
                row = fd.getValueAsElement(i)
                if row.hasElement("PX_LAST"):
                    dates.append(row.getElementAsDatetime("date"))
                    px.append(row.getElementAsFloat("PX_LAST"))
        if ev.eventType() == blpapi.Event.RESPONSE:
            break

    if dates:
        frames[sec] = pd.Series(px, index=pd.to_datetime(dates))
        print(f"{sec}: {len(dates)} closes")
    else:
        print(f"{sec}: NO DATA")

pd.DataFrame(frames).sort_index().to_csv("prices.csv", index_label="date")
print("wrote prices.csv")
`;
writeFileSync('bloomberg-request/fetch.py', py);

const readme = `# Bloomberg 5-year price pull

Generated ${new Date().toISOString().slice(0, 10)} from the live holdings in Supabase.
${unique.length} unique securities across ${PORTFOLIO_IDS.filter((id) => holdings.some((h) => h.id === id)).length} funded portfolio(s).

Sourcing honoured: ${Object.entries(SOURCE_SHEETS).map(([k, v]) => `${k} = ${v}`).join(', ')}.

## Option A — Excel (simplest)
Paste the formulas in \`bdh-formulas.txt\` into a Bloomberg-enabled Excel sheet,
let them populate, then save as CSV with a \`date\` column and one column per
security, headed with the ticker exactly as listed in \`tickers.txt\`.

## Option B — BLPAPI (cleanest)
Copy \`fetch.py\` to the Terminal machine and run it. It writes \`prices.csv\`
in exactly the expected shape.

## Then
Put the CSV at the repo root as \`prices.csv\` and run:

    node scripts/import-price-history.mjs prices.csv

That computes annualised volatility and the correlation matrix and uploads the
result to Supabase. Nothing but derived statistics leaves your machine — no raw
Bloomberg price series is stored or published.

## ${needsReview.length} identifier(s) to verify on the Terminal
These were mapped heuristically from the spreadsheet text. Bloomberg's
autocomplete is authoritative — correct any that resolve to the wrong security,
in both \`tickers.txt\` and \`fetch.py\`.

${needsReview.map((h) => `- \`${h.ticker}\` → \`${h.bbg}\`  (${h.note})`).join('\n')}
`;
writeFileSync('bloomberg-request/README.md', readme);

console.log(`${unique.length} unique securities (${holdings.length} holdings incl. duplicates)`);
for (const id of PORTFOLIO_IDS) {
  const n = holdings.filter((h) => h.id === id).length;
  console.log(`  ${id}: ${n ? `${n} holdings from "${holdings.find((h) => h.id === id).sourceSheet}"` : 'no data uploaded'}`);
}
const manualIncluded = unique.filter((h) => h.manual);
if (manualIncluded.length) {
  console.log(`  manual additions (not yet in an uploaded snapshot): ${manualIncluded.map((h) => h.ticker).join(', ')}`);
}
console.log(`${needsReview.length} identifiers flagged for manual verification`);
console.log('wrote bloomberg-request/{README.md,tickers.txt,bdh-formulas.txt,fetch.py}');
