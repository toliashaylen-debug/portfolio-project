import type { Position, Sleeve, RawSheet, PositionSheetCandidate, SummarySheet, BenchmarkComparison } from '../types';
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

export async function callClaude(prompt: string, maxTokens = 900): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
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
Only report fields you actually find written in the sheet; leave others null. Do not calculate, sum, or infer any of these numbers yourself from the holdings — only report values that are explicitly already present in a summary/log sheet.

Respond with ONLY strict JSON, no markdown fences, no text outside the JSON, in exactly this shape:
{"sheets":[{"sheetName":string,"isPositionsSheet":boolean,"holdings":[{"ticker":string,"name":string|null,"shares":number,"costBasis":number|null,"price":number,"sector":string|null,"assetType":"equity"|"etf"|"bond"|"other","sleeve":"equity"|"fixedIncome"|"other","durationYears":number|null,"section":string|null,"reportedWeightPct":number|null,"positionMarketValue":number|null,"reportedUnrealizedPL":number|null}]}],"summarySheets":[{"sheetName":string,"asOfDate":string|null,"totalValue":number|null,"equityValue":number|null,"fixedIncomeValue":number|null,"equityWeightPct":number|null,"fixedIncomeWeightPct":number|null}]}

Only include a sheet in "sheets" if isPositionsSheet is true or it has at least one holding. Only include a sheet in "summarySheets" if you found at least one of totalValue/equityValue/fixedIncomeValue/equityWeightPct/fixedIncomeWeightPct in it.

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
  }));

  return { positionSheets, summarySheets };
}

export async function extractBenchmarkComparison(sheets: RawSheet[]): Promise<BenchmarkComparison> {
  const sheetBlocks = sheets.map((s) => `<sheet name="${s.sheetName}">\n${gridToTSV(s.grid)}\n</sheet>`).join('\n\n');
  const prompt = `You are reading a "Benchmark" sheet from an investment portfolio workbook, given below as tab-separated grids. This kind of sheet compares the portfolio's own equity and fixed-income performance against market benchmarks — typically the S&P 500 (or "SPX") for equities, and LQD (an investment-grade corporate bond ETF) for fixed income — usually over some tracked date range. Different portfolios lay this out very differently — some have just a simple summary figure, others have a full daily time series with volatility and Sharpe ratio calculations. Read whatever is actually there.

For the EQUITY comparison, find:
- The benchmark's name (usually "S&P 500" or "SPX")
- The benchmark's cumulative return over the tracked period, as a percentage (look for a running "Cum %" column or a labeled summary figure like "SPX Index — same window"; if there's a daily running series, use the LAST/most complete value, representing the full period's return)
- The portfolio's own cumulative equity return over the SAME period (often labeled something like "Equity Cum. %", "My portfolio equities", "My Equity — since inception", "Equity Cum % (CF-adj)")
- If explicitly present: the benchmark's and portfolio's annualized volatility and Sharpe ratio — leave null if not present, do not estimate these yourself
- The benchmark's own price/date time series if given (e.g. daily closes) — report up to 30 evenly-sampled points as {date, value}; if the series is short, report all of it

Find the same set of fields for the FIXED INCOME comparison, where the benchmark is typically "LQD".

Also report the tracked period's start and end date if stated anywhere (e.g. a "Start Date"/"End Date" cell, or the first/last date in a series).

Report all percentages as numbers out of 100 (e.g. 2.6 for 2.6%), even if the sheet stores them as decimals like 0.026.

If you cannot find any equity or fixed-income benchmark comparison data at all in what's given, set "found" to false and leave everything else null or empty — do not invent or estimate any figure that isn't actually present.

Respond with ONLY strict JSON, no markdown fences, no text outside the JSON, in exactly this shape:
{"found":boolean,"sheetUsed":string|null,"periodStart":string|null,"periodEnd":string|null,"equity":{"benchmarkName":string|null,"benchmarkReturnPct":number|null,"portfolioReturnPct":number|null,"benchmarkVolPct":number|null,"portfolioVolPct":number|null,"benchmarkSharpe":number|null,"portfolioSharpe":number|null,"benchmarkSeries":[{"date":string,"value":number}]},"fixedIncome":{"benchmarkName":string|null,"benchmarkReturnPct":number|null,"portfolioReturnPct":number|null,"benchmarkVolPct":number|null,"portfolioVolPct":number|null,"benchmarkSharpe":number|null,"portfolioSharpe":number|null,"benchmarkSeries":[{"date":string,"value":number}]}}

Sheets:
${sheetBlocks}`;

  let parsed: BenchmarkComparison | null = null;
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let raw: string;
    try {
      raw = await callClaude(prompt, 3000);
    } catch (e) {
      if (attempt === maxAttempts - 1) throw e;
      continue;
    }
    const candidate = parseJsonLoosely<BenchmarkComparison>(raw);
    if (candidate && typeof candidate.found === 'boolean') { parsed = candidate; break; }
  }
  if (!parsed) {
    throw new Error(`The AI reader couldn't produce usable output after ${maxAttempts} attempts. Try again — if it keeps happening, the sheet may have unusual formatting worth a closer look.`);
  }
  return parsed;
}
