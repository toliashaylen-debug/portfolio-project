import type { DailyPnlSeries, PortfolioId, RawSheet, RawSheetsBundle } from '../types';
import { PORTFOLIO_SOURCING } from './constants';
import { safeGet, safeSet } from './storage';
import { sheetAllowed } from './format';
import { extractDailyPnl } from './ai';

export const dailyPnlKey = (id: PortfolioId) => `dailypnl-${id}`;

export async function loadDailyPnl(id: PortfolioId): Promise<DailyPnlSeries | null> {
  const raw = await safeGet(dailyPnlKey(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DailyPnlSeries;
    return parsed && Array.isArray(parsed.points) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Pulls the sheets a portfolio is permitted to source daily P&L from. Each book
 * is restricted to one designated sheet — p1 to Daily Performance, p2 to
 * Benchmark — so figures can never be drawn from anywhere else.
 */
export async function sourceSheetsFor(id: PortfolioId): Promise<{ sheets: RawSheet[] | null; error: string | null }> {
  const raw = await safeGet(`raw-${id}`);
  if (!raw) return { sheets: null, error: 'No uploaded workbook saved for this portfolio yet.' };
  let bundle: RawSheetsBundle;
  try {
    bundle = JSON.parse(raw);
  } catch {
    return { sheets: null, error: 'Could not read the saved workbook.' };
  }
  const all = bundle.sheets || [];
  const sourcing = PORTFOLIO_SOURCING[id];
  const allowed = sourcing ? sourcing.dailyPnlSheets : null;
  const restricted = allowed ? all.filter((s) => sheetAllowed(s.sheetName, allowed)) : all;
  if (!restricted.length) {
    return {
      sheets: null,
      error: allowed
        ? `This portfolio reads daily P&L only from "${allowed.join(' / ')}", and no such sheet is in the saved workbook.`
        : 'No sheet data available for this portfolio yet.',
    };
  }
  return { sheets: restricted, error: null };
}

export async function refreshDailyPnl(id: PortfolioId): Promise<DailyPnlSeries> {
  const { sheets, error } = await sourceSheetsFor(id);
  if (!sheets) throw new Error(error || 'No source sheet available.');
  const series = await extractDailyPnl(sheets);
  await safeSet(dailyPnlKey(id), JSON.stringify(series));
  return series;
}

/** Running total of P&L, for comparing books on the same axis. */
export function cumulative(points: { date: string; pnl: number }[]): { date: string; value: number }[] {
  let run = 0;
  return points.map((p) => {
    run += p.pnl;
    return { date: p.date, value: run };
  });
}

/** Every date appearing in any series, ascending — the shared x-axis. */
export function unionDates(seriesList: (DailyPnlSeries | null)[]): string[] {
  const set = new Set<string>();
  seriesList.forEach((s) => s?.points.forEach((p) => set.add(p.date)));
  return [...set].sort();
}

export function latestPoint(series: DailyPnlSeries | null) {
  if (!series || !series.points.length) return null;
  return series.points[series.points.length - 1];
}
