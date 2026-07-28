import type { Position, MonteCarloResult, MonteCarloAsset } from '../types';
import { valueOf } from './compute';

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

export function runMonteCarlo(positions: Position[], numSims = 2000, numMonths = 12, asOfDateStr?: string | null): MonteCarloResult | null {
  if (!positions || !positions.length) return null;
  const totalValue = positions.reduce((s, p) => s + valueOf(p), 0);
  if (!totalValue) return null;

  const assets: MonteCarloAsset[] = positions.map((p) => {
    const weight = valueOf(p) / totalValue;
    const { mean, vol } = assumptionsFor(p);
    return { ticker: p.ticker, sleeve: p.sleeve, sector: p.sector, assetType: p.assetType, weight, mean, vol };
  });
  const n = assets.length;

  const corr: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
    if (i === j) return 1;
    const a = assets[i], b = assets[j];
    if (a.sleeve !== b.sleeve) return 0.1;
    if (a.sleeve === 'fixedIncome') return 0.7;
    if (a.sector && b.sector && a.sector.trim().toLowerCase() === b.sector.trim().toLowerCase()) return 0.6;
    return 0.35;
  }));

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

  return { totalValue, assets, summary, var95Loss, var95Value, cvar95Loss, cvar95Value, numSims, numMonths };
}
