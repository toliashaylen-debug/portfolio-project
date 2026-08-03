// Reads a Bloomberg CSV of daily closes, computes annualised volatility and the
// empirical correlation matrix, and uploads ONLY those derived statistics to
// Supabase. The raw price series never leaves your machine.
//
//   node scripts/import-price-history.mjs prices.csv
//
// Expected CSV shape: a date column first, then one column per security headed
// with the Bloomberg ticker exactly as listed in bloomberg-request/tickers.txt.
import { readFileSync, existsSync } from 'node:fs';
import { kvSet } from './shared.mjs';

const TRADING_DAYS = 252;
const MIN_RETURNS_FOR_VOL = 60;   // ~3 months; below this a vol estimate is noise
const MIN_OVERLAP_FOR_CORR = 60;

const dryRun = process.argv.includes('--dry-run');
const csvPath = process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) || 'prices.csv';
if (!existsSync(csvPath)) {
  console.error(`No such file: ${csvPath}`);
  console.error('Run scripts/generate-bloomberg-request.mjs first, pull the data on your Terminal, then pass the CSV path.');
  process.exit(1);
}

const mapPath = 'bloomberg-request/ticker-map.json';
const bbgToApp = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : {};
if (!Object.keys(bbgToApp).length) {
  console.warn(`Warning: ${mapPath} missing or empty — column headers will be used as-is.`);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const split = (line) => {
    const out = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = split(lines[0]);
  return { header, rows: lines.slice(1).map(split) };
}

const { header, rows } = parseCsv(readFileSync(csvPath, 'utf8'));
const securityCols = header.slice(1);
console.log(`Parsed ${rows.length} rows x ${securityCols.length} securities from ${csvPath}`);

// date -> { ticker: price }
const series = new Map();
for (const col of securityCols) series.set(col, []);
const dates = [];
for (const row of rows) {
  const d = row[0];
  if (!d) continue;
  dates.push(d);
  securityCols.forEach((col, i) => {
    const v = Number(row[i + 1]);
    series.get(col).push(Number.isFinite(v) && v > 0 ? v : null);
  });
}

// Log returns, aligned to the date index (null where either endpoint is missing).
const returns = new Map();
for (const col of securityCols) {
  const px = series.get(col);
  const r = new Array(px.length).fill(null);
  for (let i = 1; i < px.length; i++) {
    if (px[i] !== null && px[i - 1] !== null) r[i] = Math.log(px[i] / px[i - 1]);
  }
  returns.set(col, r);
}

function stdev(xs) {
  const n = xs.length;
  if (n < 2) return null;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

function correlation(a, b) {
  const pa = [], pb = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== null && b[i] !== null) { pa.push(a[i]); pb.push(b[i]); }
  }
  if (pa.length < MIN_OVERLAP_FOR_CORR) return null;
  const ma = pa.reduce((s, x) => s + x, 0) / pa.length;
  const mb = pb.reduce((s, x) => s + x, 0) / pb.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < pa.length; i++) {
    const x = pa[i] - ma, y = pb[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  if (da === 0 || db === 0) return null;
  const c = num / Math.sqrt(da * db);
  return Number.isFinite(c) ? c : null;
}

const byTicker = {};
const skipped = [];
for (const col of securityCols) {
  const appTicker = bbgToApp[col] || col;
  const clean = returns.get(col).filter((r) => r !== null);
  if (clean.length < MIN_RETURNS_FOR_VOL) {
    skipped.push(`${col} (${clean.length} returns)`);
    continue;
  }
  const sd = stdev(clean);
  if (sd === null || !Number.isFinite(sd)) { skipped.push(`${col} (bad stdev)`); continue; }
  byTicker[appTicker] = {
    bbg: col,
    vol: sd * Math.sqrt(TRADING_DAYS),
    observations: clean.length,
  };
}

const usableCols = securityCols.filter((c) => byTicker[bbgToApp[c] || c]);
const corr = {};
let pairCount = 0;
for (let i = 0; i < usableCols.length; i++) {
  for (let j = i + 1; j < usableCols.length; j++) {
    const c = correlation(returns.get(usableCols[i]), returns.get(usableCols[j]));
    if (c === null) continue;
    const ta = bbgToApp[usableCols[i]] || usableCols[i];
    const tb = bbgToApp[usableCols[j]] || usableCols[j];
    corr[[ta, tb].sort().join('|')] = c;
    pairCount++;
  }
}

const stats = {
  asOf: new Date().toISOString().slice(0, 10),
  source: 'Bloomberg Terminal — PX_LAST, daily',
  windowStart: dates[0] || null,
  windowEnd: dates[dates.length - 1] || null,
  tradingDaysPerYear: TRADING_DAYS,
  byTicker,
  corr,
};

console.log(`\nVolatility computed for ${Object.keys(byTicker).length} securities:`);
for (const [t, v] of Object.entries(byTicker).sort((a, b) => b[1].vol - a[1].vol)) {
  console.log(`  ${t.padEnd(26)} ${(v.vol * 100).toFixed(1).padStart(6)}%  (${v.observations} obs)`);
}
if (skipped.length) console.log(`\nSkipped (insufficient data): ${skipped.join(', ')}`);
console.log(`\n${pairCount} correlation pairs computed.`);
console.log(`Window: ${stats.windowStart} → ${stats.windowEnd}`);

if (dryRun) {
  console.log('\n--dry-run: nothing uploaded.');
} else {
  await kvSet('price-stats', JSON.stringify(stats));
  console.log('\nUploaded to Supabase as "price-stats". Reload the app to pick it up.');
}
