import type { Position, Sleeve, RawSheet, PositionSheetCandidate, SummarySheet, BenchmarkComparison, BenchmarkSideData, BenchmarkSeriesPoint, DailyPnlSeries } from '../types';
import { gridToTSV } from './workbook';

function stripJsonFence(text: string): string {
  return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}

export function parseJsonLoosely<T = unknown>(rawText: string): T | null {
  const cleaned = stripJsonFence(rawText);
  const attempts = [cleaned];
  const start = cleaned.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === '{') depth++;
      else if (cleaned[i] === '}') {
        depth--;
        if (depth === 0) { attempts.push(cleaned.slice(start, i + 1)); break; }
      }
    }
  }
  const last = attempts[attempts.length - 1];
  attempts.push(last.replace(/,\s*([}\]])/g, '$1'));
  for (const candidate of attempts) {
    try { return JSON.parse(candidate) as T; } catch { /* try the next attempt */ }
  }
  return null;
}

export function sleeveFromSection(sectionText: string | null | undefined): Sleeve | null {
  if (!sectionText) return null;
  const trimmed = String(sectionText).trim().toLowerCase();
  if (trimmed === 'fi') return 'fixedIncome';
  if (trimmed === 'eq') return 'equity';
  const fiKeywords = ['fixed income', 'bond', 'treasury', 'sovereign', 'money market', 't-bill', 'tbill', 'notes', 'gilt'];
  const eqKeywords = ['equity', 'equities', 'stock', 'common share'];
  const hasFi = fiKeywords.some((k) => trimmed.includes(k));
  const hasEq = eqKeywords.some((k) => trimmed.includes(k));
  if (hasFi && !hasEq) return 'fixedIncome';
  if (hasEq && !hasFi) return 'equity';
  return null;
}

// Vite substitutes import.meta.env.* statically at build time. Under plain Node
// (verification scripts) it does not exist, so fall back to process.env there.
function apiKeyFromEnv(): string | undefined {
  try {
    const fromVite = import.meta.env?.VITE_ANTHROPIC_API_KEY;
    if (fromVite) return fromVite;
  } catch { /* not running under Vite */ }
  // Reached via globalThis so the browser build needs no Node type definitions.
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.VITE_ANTHROPIC_API_KEY;
}

export async function callClaude(prompt: string, maxTokens = 900): Promise<string> {
  const apiKey = apiKeyFromEnv();
  if (!apiKey) throw new Error('No Anthropic API key configured — set VITE_ANTHROPIC_API_KEY in your .env file.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error('AI request failed (' + res.status + ')');
  const data = await res.json();
  return (data.content || []).map((c: { text?: string }) => c.text || '').filter(Boolean).join('\n').trim();
}

interface RawHolding {
  ticker: string;
  name: string | null;
  shares: number;
  costBasis: number | null;
  price: number;
  sector: string | null;
  assetType: Position['assetType'];
  sleeve: Sleeve;
  durationYears: number | null;
  section: string | null;
  reportedWeightPct: number | null;
  positionMarketValue: number | null;
  reportedUnrealizedPL: number | null;
}
interface RawSheetResult {
  sheetName: string;
  isPositionsSheet: boolean;
  holdings: RawHolding[];
}
interface RawSummarySheet {
  sheetName: string;
  asOfDate: string | null;
  totalValue: number | null;
  equityValue: number | null;
  fixedIncomeValue: number | null;
  equityWeightPct: number | null;
  fixedIncomeWeightPct: number | null;
  sectorWeights: { label: string; pct: number }[] | null;
}
interface ExtractionResponse {
  sheets: RawSheetResult[];
  summarySheets?: RawSummarySheet[];
}

export async function extractHoldingsViaAI(sheets: RawSheet[]): Promise<{ positionSheets: PositionSheetCandidate[]; summarySheets: SummarySheet[] }> {
  const sheetBlocks = sheets.map((s) => `<sheet name="${s.sheetName}">\n${gridToTSV(s.grid)}\n</sheet>`).join('\n\n');
  const prompt = `You are reading a raw investment portfolio spreadsheet, sheet by sheet, given below as tab-separated grids. Sheets may use different, inconsistent headers from one another, may contain more than one stacked table in the same sheet (e.g. an ETF table followed by a separate bond table further down), may have blank spacer rows or title rows.

PART 1 — holdings. For each sheet, find every distinct holding (equity, ETF, bond, option, or any other tradeable instrument) regardless of exact column names. A holding needs an identifier (ticker symbol, ISIN, or name if nothing else exists), a share/unit quantity, and a current price. If a sheet has multiple stacked tables, extract holdings from all of them. Ignore rows that are clearly totals, running balances, or formula leftovers rather than actual holdings.

For "shares", use the unit/quantity column even if its value is negative (e.g. "Net Units" of -600) — a negative quantity is a legitimate short or written position (e.g. a written/short call option), not an error to skip or a sign to drop.

For "costBasis", this field must be a PER-SHARE / PER-UNIT figure, since it gets multiplied by shares elsewhere. Some sheets have BOTH a total cost column (the full dollar amount originally invested, e.g. "Cost Basis ($)") AND a separate per-unit column (e.g. "Avg Cost/Unit ($)", "Average Cost", "Bought Price", "Stock Bought Price", "Purchase Price") — when both exist, always use the PER-UNIT one for "costBasis", never the total-dollars one. If only a total-dollars column exists with no per-unit equivalent, divide it by shares yourself to get a per-unit cost basis.

For "price" (current price), match "Current Price", "Last Price", "Mkt Price", "Current Px" etc.

Sheets are very often organized under section header rows — a row containing just a label like "FIXED INCOME", "EQUITIES", "Sovereign Bonds", "Corporate Bonds", "Money Market", "US Equity", "Foreign Equity", "Options" — that apply to every row below them until the next section header changes it. For EVERY holding, report the single nearest section-header row text that sits directly above it in "section" — copy it verbatim (e.g. "Corporate Bonds", "US Equity"). If a sheet has nested headers (a broad one like "FIXED INCOME" and then a narrower one like "Corporate Bonds" underneath it), report the narrower/nearest one. This must reflect the actual row position in the sheet — re-check which section a row falls under every time the section changes, rather than reusing the sheet's very first header for everything below it. Also still set "sleeve" as your own best classification, but "section" is mandatory whenever a sheet has any such header rows — leave it null only if the sheet genuinely has no section headers at all.

This matters because bond identifiers are frequently written as "<issuer or reference> <coupon> <maturity date>" — e.g. "AAPL 4/3 05/12/35" is Apple's corporate BOND (a 4.75%-coupon bond maturing 2035), and "T 4 3/8 05/15/36" is a Treasury bond — NOT the issuer's equity ticker, even though a recognizable company name or ticker-like string appears inside it. Report its section as whatever bond sub-section it's actually under (e.g. "Corporate Bonds"), not as equity.

If a fixed-income holding's row has a duration figure (e.g. a "Duration" or "Mod. Duration" column, given in years), report it as "durationYears" — leave null if not present, do not estimate it yourself.

If a row already has its own weight explicitly given (e.g. a "Portfolio Weight" column, as a percentage or decimal like 0.0548), report that exact value as "reportedWeightPct" as a number out of 100 (e.g. 5.48, not 0.0548) — do not recompute or estimate this yourself, only report it if the column is actually present.

If a row already has its own total market value explicitly given in dollars (e.g. a column called "Position Market Value", "Position Value", "Mkt Value ($)", "Market Value" — this is especially important for foreign-currency holdings where it already reflects FX conversion, or bonds where it may include accrued interest that a plain shares×price calculation would miss), report that exact number as "positionMarketValue". Do not recompute, convert, or estimate this yourself — only report it if such a column is actually present.

If a row already has its own unrealized profit/loss figure explicitly given in dollars (e.g. "Unrealized PnL ($)", "Unrealized P&L", "Unreal PnL ($)"), report that exact number as "reportedUnrealizedPL". This matters a lot for foreign-currency holdings: their cost-basis column is sometimes labeled as if it were in dollars (e.g. "Average Cost ($)") but is actually recorded in the local currency (matching a local-currency price column next to it) — recomputing P&L from cost×shares in that case would silently mix currencies and produce a badly wrong number. Using the sheet's own already-computed PnL sidesteps that entirely, so prefer it whenever the column exists.

PART 2 — portfolio-level summaries. Separately, some sheets track the overall portfolio rather than individual holdings — e.g. a dated daily/live log of ending balance and equity/fixed-income market values, or a sheet stating the current equity vs. fixed-income allocation weight directly. These are usually more authoritative for the current total value and allocation than summing individual position rows, since position rows can go stale after trades. Find any such sheet and report:
- If it's a dated log (a date column paired with figures per row, e.g. a "CURRENT (LIVE)" row or a daily log): find the row with the LATEST real date where the actual balance/value figure itself is genuinely populated — skip any row where that figure is blank, even if an adjacent column (like a percentage change) has some other value in it (a formula error like #DIV/0!, or a bare placeholder like -1, 0, or N/A) — a populated adjacent column doesn't mean the row itself has real data. From that row, report "asOfDate" and whichever of these it states: "totalValue" (an overall ending balance/NAV figure), and/or "equityValue"/"fixedIncomeValue" (the market value held in each sleeve, in dollars — e.g. a column literally called "Equity Market Value" or "Fixed Income Market Value").
- If it states current equity/fixed-income weights directly as percentages or decimals (e.g. 0.48), report them as "equityWeightPct" and "fixedIncomeWeightPct" (as numbers out of 100, e.g. 48.05 not 0.4805) instead of equityValue/fixedIncomeValue. These sheets are often not dated — if there's no date, leave "asOfDate" null.
- If the same sheet also has a separate table breaking the EQUITY sleeve down by sector with its own weight/percentage column (e.g. titled "Sector Breakdown — Equity" or similar), report each sector's name and weight as "sectorWeights": [{"label": sector name exactly as written, "pct": weight as a number out of 100, e.g. 18.4 not 0.184}]. Only include rows that have an actual populated weight value — skip rows showing "-", blank, 0 with no other data, or a formula error. Leave "sectorWeights" null if no such table exists in the sheet.
Only report fields you actually find written in the sheet; leave others null. Do not calculate, sum, or infer any of these numbers yourself from the holdings — only report values that are explicitly already present in a summary/log sheet.

Respond with ONLY strict JSON, no markdown fences, no text outside the JSON, in exactly this shape:
{"sheets":[{"sheetName":string,"isPositionsSheet":boolean,"holdings":[{"ticker":string,"name":string|null,"shares":number,"costBasis":number|null,"price":number,"sector":string|null,"assetType":"equity"|"etf"|"bond"|"other","sleeve":"equity"|"fixedIncome"|"other","durationYears":number|null,"section":string|null,"reportedWeightPct":number|null,"positionMarketValue":number|null,"reportedUnrealizedPL":number|null}]}],"summarySheets":[{"sheetName":string,"asOfDate":string|null,"totalValue":number|null,"equityValue":number|null,"fixedIncomeValue":number|null,"equityWeightPct":number|null,"fixedIncomeWeightPct":number|null,"sectorWeights":[{"label":string,"pct":number}]|null}]}

Only include a sheet in "sheets" if isPositionsSheet is true or it has at least one holding. Only include a sheet in "summarySheets" if you found at least one of totalValue/equityValue/fixedIncomeValue/equityWeightPct/fixedIncomeWeightPct/sectorWeights in it.

Sheets:
${sheetBlocks}`;

  let parsed: ExtractionResponse | null = null;
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let raw: string;
    try {
      raw = await callClaude(prompt, 4500);
    } catch (e) {
      if (attempt === maxAttempts - 1) throw e;
      continue;
    }
    const candidate = parseJsonLoosely<ExtractionResponse>(raw);
    if (candidate && Array.isArray(candidate.sheets)) { parsed = candidate; break; }
  }
  if (!parsed) {
    throw new Error(`The AI reader couldn't produce usable output after ${maxAttempts} attempts. Try uploading again — if it keeps happening, the file may have unusual formatting worth a closer look.`);
  }

  const positionSheets: PositionSheetCandidate[] = parsed.sheets.map((s) => {
    const holdings: Position[] = (s.holdings || [])
      .filter((h) => h && h.ticker && h.shares && h.price)
      .map((h) => ({
        ticker: String(h.ticker).trim().toUpperCase(),
        name: h.name || null,
        shares: Number(h.shares),
        costBasis: h.costBasis === null || h.costBasis === undefined ? Number(h.price) : Number(h.costBasis),
        price: Number(h.price),
        sector: h.sector || '',
        assetType: h.assetType || 'other',
        durationYears: h.durationYears === null || h.durationYears === undefined ? null : Number(h.durationYears),
        reportedWeightPct: h.reportedWeightPct === null || h.reportedWeightPct === undefined ? null : Number(h.reportedWeightPct),
        positionMarketValue: h.positionMarketValue === null || h.positionMarketValue === undefined ? null : Number(h.positionMarketValue),
        reportedUnrealizedPL: h.reportedUnrealizedPL === null || h.reportedUnrealizedPL === undefined ? null : Number(h.reportedUnrealizedPL),
        sourceSheet: s.sheetName,
        sleeve: sleeveFromSection(h.section) || (h.sleeve === 'fixedIncome' || h.sleeve === 'equity' ? h.sleeve : (h.assetType === 'bond' ? 'fixedIncome' : 'other')),
      }))
      .filter((h) => !isNaN(h.shares) && !isNaN(h.price) && !isNaN(h.costBasis));
    return {
      sheetName: s.sheetName,
      positions: holdings,
      tickers: holdings.map((h) => h.ticker),
      defaultChecked: true,
    };
  }).filter((s) => s.positions.length);

  const summarySheets: SummarySheet[] = (Array.isArray(parsed.summarySheets) ? parsed.summarySheets : []).map((s) => ({
    sheetName: s.sheetName,
    asOfDate: s.asOfDate || null,
    totalValue: s.totalValue === null || s.totalValue === undefined ? null : Number(s.totalValue),
    equityValue: s.equityValue === null || s.equityValue === undefined ? null : Number(s.equityValue),
    fixedIncomeValue: s.fixedIncomeValue === null || s.fixedIncomeValue === undefined ? null : Number(s.fixedIncomeValue),
    equityWeightPct: s.equityWeightPct === null || s.equityWeightPct === undefined ? null : Number(s.equityWeightPct),
    fixedIncomeWeightPct: s.fixedIncomeWeightPct === null || s.fixedIncomeWeightPct === undefined ? null : Number(s.fixedIncomeWeightPct),
    sectorWeights: Array.isArray(s.sectorWeights) && s.sectorWeights.length
      ? s.sectorWeights
          .filter((sw) => sw && sw.label && typeof sw.pct === 'number' && !isNaN(sw.pct))
          .map((sw) => ({ label: String(sw.label), pct: Number(sw.pct) }))
      : null,
  }));

  return { positionSheets, summarySheets };
}

export async function extractBenchmarkComparison(sheets: RawSheet[]): Promise<BenchmarkComparison> {
  const sheetBlocks = sheets.map((s) => `<sheet name="${s.sheetName}">\n${gridToTSV(s.grid)}\n</sheet>`).join('\n\n');
  const prompt = `You are reading a "Benchmark" sheet from an investment portfolio workbook, given below as tab-separated grids. This kind of sheet compares the portfolio's own equity and fixed-income performance against market benchmarks — typically the S&P 500 (or "SPX") for equities, and LQD (an investment-grade corporate bond ETF) for fixed income — usually over some tracked date range. Different portfolios lay this out very differently — some have just a simple summary figure, others have a full daily time series with volatility and Sharpe ratio calculations. Read whatever is actually there.

THE SINGLE MOST IMPORTANT THING: do not mix up which number belongs to the PORTFOLIO and which belongs to the BENCHMARK. Getting these the wrong way round inverts the result and reports a gain as a loss. Decide by reading the LABEL attached to each cell, never by column order or position — the portfolio's figure is sometimes to the left of the benchmark's and sometimes to the right.

- A cell labelled with a possessive phrase like "My portfolio FI", "My portfilio FI", "My porfilio equities", "My Equity — since inception", "Equity Cum. %", "FI Cum. %", "Equity Cum % (CF-adj)", "My FI — since inception" is the PORTFOLIO's own return.
- A cell labelled with a market instrument name like "LQD", "LQD US Equity", "SPX", "S&P 500", "SPX Index — same window" is the BENCHMARK's return.
- Labels are frequently MISSPELLED ("portfilio", "porfilio"). Match on meaning, not exact spelling.

Labels sit in different places relative to their value depending on the block. A label may be:
  (a) in the SAME row, in an earlier column — e.g. a row starting with "LQD" whose cumulative return sits several columns later in that same row; or
  (b) in the row DIRECTLY ABOVE its value, in the same column — e.g. "My portfilio FI" in one row with the number immediately beneath it; or
  (c) at the top of a column of values, as a column header.
Work out which applies for each figure before reading it. State the label you used in "portfolioLabel" / "benchmarkLabel" so the reading can be checked.

For the EQUITY comparison, find:
- The benchmark's name (usually "S&P 500" or "SPX")
- The benchmark's cumulative return over the tracked period (look for a running "Cum %" column or a labelled summary figure; if there is a daily running series, use the LAST populated value, representing the full period)
- The portfolio's own cumulative equity return over the SAME period
- If explicitly present: the benchmark's and portfolio's annualized volatility and Sharpe ratio — leave null if not present, do not estimate these yourself
- The benchmark's own price/date time series if given (e.g. daily closes) — report up to 30 evenly-sampled points as {date, value}; if the series is short, report all of it

Find the same set of fields for the FIXED INCOME comparison, where the benchmark is typically "LQD".

Also report the tracked period's start and end date if stated anywhere (e.g. a "Start Date"/"End Date" cell, or the first/last date in a series).

DO NOT convert, rescale or round any percentage. Copy the number through EXACTLY as it appears in the cell — if the cell holds -0.0301, return -0.0301, not -3.01. Scaling is handled downstream, and doing it here risks rescaling one side but not the other, which silently inverts the comparison. The same applies to volatility figures. Report Sharpe ratios as they appear.

If you cannot find any equity or fixed-income benchmark comparison data at all in what's given, set "found" to false and leave everything else null or empty — do not invent or estimate any figure that isn't actually present.

Respond with ONLY strict JSON, no markdown fences, no text outside the JSON, in exactly this shape:
{"found":boolean,"sheetUsed":string|null,"periodStart":string|null,"periodEnd":string|null,"equity":{"benchmarkName":string|null,"portfolioLabel":string|null,"benchmarkLabel":string|null,"benchmarkReturnRaw":number|null,"portfolioReturnRaw":number|null,"benchmarkVolRaw":number|null,"portfolioVolRaw":number|null,"benchmarkSharpe":number|null,"portfolioSharpe":number|null,"benchmarkSeries":[{"date":string,"value":number}]},"fixedIncome":{"benchmarkName":string|null,"portfolioLabel":string|null,"benchmarkLabel":string|null,"benchmarkReturnRaw":number|null,"portfolioReturnRaw":number|null,"benchmarkVolRaw":number|null,"portfolioVolRaw":number|null,"benchmarkSharpe":number|null,"portfolioSharpe":number|null,"benchmarkSeries":[{"date":string,"value":number}]}}

Sheets:
${sheetBlocks}`;

  interface RawSide {
    benchmarkName: string | null;
    portfolioLabel: string | null;
    benchmarkLabel: string | null;
    benchmarkReturnRaw: number | null;
    portfolioReturnRaw: number | null;
    benchmarkVolRaw: number | null;
    portfolioVolRaw: number | null;
    benchmarkSharpe: number | null;
    portfolioSharpe: number | null;
    benchmarkSeries: BenchmarkSeriesPoint[];
  }
  interface RawComparison {
    found: boolean;
    sheetUsed: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    equity: RawSide;
    fixedIncome: RawSide;
  }

  let parsed: RawComparison | null = null;
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let raw: string;
    try {
      raw = await callClaude(prompt, 3000);
    } catch (e) {
      if (attempt === maxAttempts - 1) throw e;
      continue;
    }
    const candidate = parseJsonLoosely<RawComparison>(raw);
    if (candidate && typeof candidate.found === 'boolean') { parsed = candidate; break; }
  }
  if (!parsed) {
    throw new Error(`The AI reader couldn't produce usable output after ${maxAttempts} attempts. Try again — if it keeps happening, the sheet may have unusual formatting worth a closer look.`);
  }

  // These sheets store returns as decimal fractions (-0.0301 meaning -3.01%),
  // but some hand-entered cells already hold whole percents. Scaling here — on
  // both sides with the identical rule — guarantees the two are on the same
  // footing, which is what stops a gain being rendered as a loss. A |value| of
  // 1 or more can only sensibly be a whole percent: a 1.0 decimal fraction
  // would be a 100% move over a few weeks.
  const toPct = (v: number | null | undefined): number | null => {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return null;
    const n = Number(v);
    return Math.abs(n) < 1 ? n * 100 : n;
  };
  const rawOrNull = (v: number | null | undefined): number | null =>
    v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);

  const side = (s: RawSide | undefined): BenchmarkSideData => ({
    benchmarkName: s?.benchmarkName ?? null,
    benchmarkReturnPct: toPct(s?.benchmarkReturnRaw),
    portfolioReturnPct: toPct(s?.portfolioReturnRaw),
    benchmarkVolPct: toPct(s?.benchmarkVolRaw),
    portfolioVolPct: toPct(s?.portfolioVolRaw),
    benchmarkSharpe: rawOrNull(s?.benchmarkSharpe),
    portfolioSharpe: rawOrNull(s?.portfolioSharpe),
    benchmarkSeries: Array.isArray(s?.benchmarkSeries) ? s!.benchmarkSeries : [],
    portfolioLabel: s?.portfolioLabel ?? null,
    benchmarkLabel: s?.benchmarkLabel ?? null,
    portfolioReturnRaw: rawOrNull(s?.portfolioReturnRaw),
    benchmarkReturnRaw: rawOrNull(s?.benchmarkReturnRaw),
  });

  return {
    found: !!parsed.found,
    sheetUsed: parsed.sheetUsed ?? null,
    periodStart: parsed.periodStart ?? null,
    periodEnd: parsed.periodEnd ?? null,
    equity: side(parsed.equity),
    fixedIncome: side(parsed.fixedIncome),
  };
}

/**
 * Converts a spreadsheet date cell to an ISO date. Excel stores dates as serial
 * days from 1899-12-30. This is done in code rather than asked of the model,
 * which gets serial arithmetic wrong often enough to matter.
 */
export function toIsoDate(raw: number | string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw.trim()))) {
    const serial = Number(raw);
    // Excel serials below ~20000 (1954) in this context are almost certainly not
    // dates; above 60000 (2064) is past anything plausible for a daily log.
    if (!Number.isFinite(serial) || serial < 20000 || serial > 60000) return null;
    const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

/**
 * Reads a dated daily profit-and-loss series out of whichever sheet a portfolio
 * is permitted to source it from. Two very different layouts are in play: a log
 * of ending balances (where P&L is the day-over-day change) and an explicit
 * per-period gain column that may be split across separate equity and fixed
 * income blocks needing summation per date.
 */
export async function extractDailyPnl(sheets: RawSheet[]): Promise<DailyPnlSeries> {
  const sheetBlocks = sheets.map((s) => `<sheet name="${s.sheetName}">\n${gridToTSV(s.grid)}\n</sheet>`).join('\n\n');
  const prompt = `You are reading a daily performance log from an investment portfolio workbook, given below as tab-separated grids. Your task is to produce a dated series of DAILY PROFIT AND LOSS in dollars.

These sheets are laid out in very different ways. Work out which of these applies, and say which in "method":

LAYOUT A — a dated log of the portfolio's ending balance / NAV.
Here the daily P&L is NOT written down; you must derive it as the change in ending balance from the previous dated row to the current one. Example: if 2026-07-29 closes at 1,951,978.47 and 2026-07-30 closes at 1,980,029.41, then the P&L for 2026-07-30 is +28,050.94. The first dated row has no prior day, so it has no P&L — omit it from the series entirely rather than reporting zero. If the sheet also has a daily percentage-change column, report it as "returnPct" as a decimal fraction (0.0143 for +1.43%), and report the ending balance as "endingValue".

LAYOUT B — an explicit per-period gain column, e.g. "Period Gain ($)", "Daily P&L", "Total Gain" alongside a "Daily Return %".
Here take the stated dollar figure directly; do NOT recompute it from market values, because those columns often include cash inflows as the book was funded and differ from true P&L. Report the stated daily return as "returnPct" (as a decimal fraction) and the market value column as "endingValue".

CRITICAL — a sheet may contain MORE THAN ONE such block, typically one for the equity sleeve and a separate one further down for fixed income, each with its own date column and its own "Period Gain ($)" column. When that happens the portfolio's daily P&L for a given date is the SUM of the blocks for that same date. Add them together per date. If a date appears in only one block, use just that block's figure for that date, and note the partial coverage in "method". Do not report the equity block alone as if it were the whole portfolio.

Rules that apply to every layout:
- Ignore rows that are clearly not real data: blank rows, rows where the balance/gain cell is empty, formula errors (#DIV/0!, #NAME?, #REF!), and bare placeholders such as a lone -1 or 0 sitting in an otherwise empty row. A value in an adjacent column does not make the row real.
- Ignore summary/statistics blocks (ROI, annual volatility, Sharpe ratio, risk-free rate inputs) and any explanatory footnote prose. Those are not daily observations.
- DO NOT convert or reformat dates. Copy the date cell through EXACTLY as it appears in the grid into "dateRaw" — if it is a number such as 46233, return the number 46233; if it is text such as "2026-07-30" or "30/07/2026", return that same string. Calendar conversion is handled downstream; attempting it yourself introduces errors.
- Return the series in ascending date order. Do not invent, interpolate or smooth any day that is not actually present.
- If the sheet genuinely contains no dated daily performance data, set "found" to false and return an empty series.

Respond with ONLY strict JSON, no markdown fences, no text outside the JSON, in exactly this shape:
{"found":boolean,"sheetUsed":string|null,"method":string,"points":[{"dateRaw":number|string,"pnl":number,"returnPct":number|null,"endingValue":number|null}]}

"method" should be one short sentence stating which layout you used and, if you summed blocks, that you did so — e.g. "Derived from day-over-day change in the Ending Balance column." or "Summed the stated Period Gain ($) from the equity and fixed income blocks per date."

Sheets:
${sheetBlocks}`;

  interface RawPnlPoint {
    dateRaw: number | string;
    pnl: number;
    returnPct: number | null;
    endingValue: number | null;
  }
  interface RawPnlResponse {
    found: boolean;
    sheetUsed: string | null;
    method: string;
    points: RawPnlPoint[];
  }

  let parsed: RawPnlResponse | null = null;
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let raw: string;
    try {
      raw = await callClaude(prompt, 4000);
    } catch (e) {
      if (attempt === maxAttempts - 1) throw e;
      continue;
    }
    const candidate = parseJsonLoosely<RawPnlResponse>(raw);
    if (candidate && typeof candidate.found === 'boolean' && Array.isArray(candidate.points)) { parsed = candidate; break; }
  }
  if (!parsed) {
    throw new Error(`The AI reader couldn't produce a usable daily P&L series after ${maxAttempts} attempts. Try again — if it keeps happening, the sheet may have unusual formatting worth a closer look.`);
  }

  const points = (parsed.points || [])
    .map((p) => {
      if (!p || !Number.isFinite(Number(p.pnl))) return null;
      const date = toIsoDate(p.dateRaw);
      if (!date) return null;
      return {
        date,
        pnl: Number(p.pnl),
        returnPct: p.returnPct === null || p.returnPct === undefined || !Number.isFinite(Number(p.returnPct)) ? null : Number(p.returnPct),
        endingValue: p.endingValue === null || p.endingValue === undefined || !Number.isFinite(Number(p.endingValue)) ? null : Number(p.endingValue),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    found: !!parsed.found && points.length > 0,
    sheetUsed: parsed.sheetUsed || null,
    method: parsed.method || null,
    points,
    extractedAt: new Date().toISOString().slice(0, 10),
  };
}
