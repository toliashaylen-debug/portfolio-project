import type { Position, MonteCarloResult, MonteCarloAsset, PriceStats, MonteCarloCoverage, Sleeve } from '../types';
import { valueOf } from './compute';
import { corrKey } from './priceStats';

function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(matrix[i][i] - sum, 0));
      } else {
        L[i][j] = L[j][j] !== 0 ? (matrix[i][j] - sum) / L[j][j] : 0;
      }
    }
  }
  return L;
}

function randNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function assumptionsFor(p: Position): { mean: number; vol: number } {
  if (p.sleeve === 'fixedIncome') return { mean: 0.045, vol: 0.02 };
  if (p.sleeve === 'equity') return p.assetType === 'etf' ? { mean: 0.09, vol: 0.16 } : { mean: 0.10, vol: 0.22 };
  return { mean: 0.06, vol: 0.15 };
}

// Volatility prefers realised history when we have it; expected return always
// stays forward-looking, since trailing realised return is a poor estimator of
// future return (a name that compounded 40%/yr does not have a 40% drift).
function buildAssets(positions: Position[], totalValue: number, stats?: PriceStats | null): MonteCarloAsset[] {
  return positions.map((p) => {
    const weight = valueOf(p) / totalValue;
    const { mean, vol } = assumptionsFor(p);
    const hist = stats?.byTicker?.[p.ticker];
    const useHist = !!hist && Number.isFinite(hist.vol) && hist.vol > 0;
    return {
      ticker: p.ticker,
      sleeve: p.sleeve,
      sector: p.sector,
      assetType: p.assetType,
      weight,
      mean,
      vol: useHist ? hist!.vol : vol,
      volFromHistory: useHist,
    };
  });
}

function buildCorrMatrix(assets: MonteCarloAsset[], stats?: PriceStats | null): { corr: number[][]; corrPairsHistorical: number; corrPairsTotal: number } {
  const n = assets.length;
  let corrPairsHistorical = 0;
  let corrPairsTotal = 0;
  const corr: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
    if (i === j) return 1;
    const a = assets[i], b = assets[j];
    if (i < j) corrPairsTotal++;
    const empirical = stats?.corr?.[corrKey(a.ticker, b.ticker)];
    if (typeof empirical === 'number' && Number.isFinite(empirical)) {
      if (i < j) corrPairsHistorical++;
      // Clamp strictly inside [-1,1]; exact ±1 makes the covariance matrix
      // singular and Cholesky degenerate.
      return Math.max(-0.999, Math.min(0.999, empirical));
    }
    if (a.sleeve !== b.sleeve) return 0.1;
    if (a.sleeve === 'fixedIncome') return 0.7;
    if (a.sector && b.sector && a.sector.trim().toLowerCase() === b.sector.trim().toLowerCase()) return 0.6;
    return 0.35;
  }));
  return { corr, corrPairsHistorical, corrPairsTotal };
}

/** Portfolio-level annualized volatility from the same measured/assumed inputs as the Monte Carlo sim, without running the simulation itself. */
export function computePortfolioVolatility(positions: Position[], stats?: PriceStats | null): { vol: number; historicalWeight: number } | null {
  if (!positions || !positions.length) return null;
  const totalValue = positions.reduce((s, p) => s + valueOf(p), 0);
  if (!totalValue) return null;
  const assets = buildAssets(positions, totalValue, stats);
  const { corr } = buildCorrMatrix(assets, stats);
  let variance = 0;
  for (let i = 0; i < assets.length; i++) {
    for (let j = 0; j < assets.length; j++) {
      variance += assets[i].weight * assets[j].weight * assets[i].vol * assets[j].vol * corr[i][j];
    }
  }
  const historicalWeight = assets.reduce((s, a) => s + (a.volFromHistory ? a.weight : 0), 0);
  return { vol: Math.sqrt(Math.max(variance, 0)), historicalWeight };
}

const RISK_FREE_RATE = 0.045; // Same fixed-income return assumption used elsewhere in this file — reused for consistency, not a distinct estimate.
const MIN_DAYS_FOR_SHARPE_ESTIMATE = 14; // Below this, annualizing a return produces a wild, meaningless swing.
const SHARPE_LOW_CONFIDENCE_DAYS = 180; // Below ~6 months of live history, a compounded annualized return is a rough extrapolation from a small sample — flag it rather than present it as settled.

export interface EstimatedSharpe {
  sharpe: number;
  annualizedReturn: number;
  annualizedVol: number;
  days: number;
  historicalWeight: number;
  /** True while there's under ~6 months of live account history — the annualized return driving this figure is extrapolated from a short sample and can swing a lot as more history comes in. */
  lowConfidence: boolean;
}

/**
 * Fallback Sharpe ratio for books whose own sheet doesn't state one: the
 * account's own return since inception (annualized), less the stated
 * risk-free assumption, over volatility measured the same way as the Monte
 * Carlo sim. Only used when nothing is directly reported — never overrides
 * a sheet-stated figure.
 */
export function estimateSharpe(
  positions: Position[],
  displayValue: number,
  startingBalance: number,
  inceptionDateStr: string,
  stats?: PriceStats | null,
): EstimatedSharpe | null {
  const inception = new Date(inceptionDateStr + 'T00:00:00Z');
  if (isNaN(inception.getTime()) || !startingBalance) return null;
  const days = (Date.now() - inception.getTime()) / 86400000;
  if (days < MIN_DAYS_FOR_SHARPE_ESTIMATE) return null;
  const totalReturn = (displayValue - startingBalance) / startingBalance;
  if (totalReturn <= -1) return null;
  const years = days / 365.25;
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;
  const volResult = computePortfolioVolatility(positions, stats);
  if (!volResult || volResult.vol <= 0) return null;
  return {
    sharpe: (annualizedReturn - RISK_FREE_RATE) / volResult.vol,
    annualizedReturn,
    annualizedVol: volResult.vol,
    days: Math.round(days),
    historicalWeight: volResult.historicalWeight,
    lowConfidence: days < SHARPE_LOW_CONFIDENCE_DAYS,
  };
}

export interface SleeveSharpeResult {
  sharpe: number | null;
  volatility: number | null;
  annualizedReturn: number | null;
  days: number;
  lowConfidence: boolean;
}

/**
 * Per-sleeve Sharpe ratio and volatility, so equity and fixed income can be
 * judged separately rather than blended into one figure. Volatility is
 * always computed the same way as the Monte Carlo sim, restricted to that
 * sleeve's own holdings. Sharpe additionally needs a return for that sleeve
 * — pass the book's own sheet-reported cumulative return for the sleeve
 * (as a whole percent, e.g. 6.76 for 6.76%) when available; Sharpe is null
 * without one, but volatility is still returned.
 */
export function estimateSleeveSharpe(
  positions: Position[],
  sleeve: Sleeve,
  sleeveReturnPctWhole: number | null,
  inceptionDateStr: string,
  stats?: PriceStats | null,
): SleeveSharpeResult {
  const sleevePositions = positions.filter((p) => p.sleeve === sleeve);
  const volResult = computePortfolioVolatility(sleevePositions, stats);
  const volatility = volResult && volResult.vol > 0 ? volResult.vol : null;

  const inception = new Date(inceptionDateStr + 'T00:00:00Z');
  const days = isNaN(inception.getTime()) ? 0 : Math.round((Date.now() - inception.getTime()) / 86400000);

  let annualizedReturn: number | null = null;
  if (sleeveReturnPctWhole !== null && days >= MIN_DAYS_FOR_SHARPE_ESTIMATE) {
    const totalReturn = sleeveReturnPctWhole / 100;
    if (totalReturn > -1) {
      const years = days / 365.25;
      annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;
    }
  }

  return {
    sharpe: annualizedReturn !== null && volatility ? (annualizedReturn - RISK_FREE_RATE) / volatility : null,
    volatility,
    annualizedReturn,
    days,
    lowConfidence: days < SHARPE_LOW_CONFIDENCE_DAYS,
  };
}

export function runMonteCarlo(
  positions: Position[],
  numSims = 2000,
  numMonths = 12,
  asOfDateStr?: string | null,
  stats?: PriceStats | null,
): MonteCarloResult | null {
  if (!positions || !positions.length) return null;
  const totalValue = positions.reduce((s, p) => s + valueOf(p), 0);
  if (!totalValue) return null;

  const assets = buildAssets(positions, totalValue, stats);
  const n = assets.length;
  const { corr, corrPairsHistorical, corrPairsTotal } = buildCorrMatrix(assets, stats);

  const monthlyMean = assets.map((a) => a.mean / 12);
  const monthlyVol = assets.map((a) => a.vol / Math.sqrt(12));
  const monthlyCov: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => corr[i][j] * monthlyVol[i] * monthlyVol[j]));
  const L = cholesky(monthlyCov);

  const paths: number[][] = [];
  for (let s = 0; s < numSims; s++) {
    let value = totalValue;
    const path = [value];
    for (let m = 0; m < numMonths; m++) {
      const z = Array.from({ length: n }, () => randNormal());
      const x = new Array(n).fill(0);
      for (let i = 0; i < n; i++) { let sum = 0; for (let k = 0; k <= i; k++) sum += L[i][k] * z[k]; x[i] = sum; }
      let portReturn = 0;
      for (let i = 0; i < n; i++) portReturn += assets[i].weight * (monthlyMean[i] + x[i]);
      value *= (1 + portReturn);
      path.push(value);
    }
    paths.push(path);
  }

  const startDate = asOfDateStr && !isNaN(new Date(asOfDateStr).getTime()) ? new Date(asOfDateStr) : new Date();
  const summary = [];
  for (let m = 0; m <= numMonths; m++) {
    const vals = paths.map((p) => p[m]).sort((a, b) => a - b);
    const pct = (q: number) => vals[Math.floor(q * (vals.length - 1))];
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + m);
    const p5 = pct(0.05), p25 = pct(0.25), p75 = pct(0.75), p95 = pct(0.95);
    summary.push({
      month: m,
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      p5, p25, median: pct(0.5), p75, p95,
      band90: p95 - p5, band50: p75 - p25,
    });
  }

  const finalVals = paths.map((p) => p[numMonths]).sort((a, b) => a - b);
  const varIdx = Math.max(0, Math.floor(0.05 * finalVals.length));
  const var95Value = finalVals[varIdx];
  const var95Loss = totalValue - var95Value;
  const tailVals = finalVals.slice(0, varIdx + 1);
  const cvar95Value = tailVals.reduce((s, v) => s + v, 0) / tailVals.length;
  const cvar95Loss = totalValue - cvar95Value;

  const coverage: MonteCarloCoverage = {
    historical: assets.filter((a) => a.volFromHistory).map((a) => a.ticker),
    assumed: assets.filter((a) => !a.volFromHistory).map((a) => a.ticker),
    historicalWeight: assets.reduce((s, a) => s + (a.volFromHistory ? a.weight : 0), 0),
    corrPairsHistorical,
    corrPairsTotal,
    statsAsOf: stats?.asOf ?? null,
    statsWindow: stats?.windowStart && stats?.windowEnd ? `${stats.windowStart} → ${stats.windowEnd}` : null,
  };

  return { totalValue, assets, summary, var95Loss, var95Value, cvar95Loss, cvar95Value, numSims, numMonths, coverage };
}
