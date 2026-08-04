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

export interface PnlSummary {
  today: number | null;
  todayPct: number | null;
  total: number;
  best: { date: string; pnl: number } | null;
  worst: { date: string; pnl: number } | null;
  upDays: number;
  downDays: number;
  sessions: number;
  winRate: number | null;
  avgDay: number | null;
  /** Recent daily values, for a sparkline. */
  spark: number[];
}

export function summarize(series: DailyPnlSeries | null): PnlSummary | null {
  if (!series || !series.points.length) return null;
  const pts = series.points;
  const last = pts[pts.length - 1];
  const total = pts.reduce((s, p) => s + p.pnl, 0);
  const up = pts.filter((p) => p.pnl > 0).length;
  const down = pts.filter((p) => p.pnl < 0).length;
  const sorted = [...pts].sort((a, b) => a.pnl - b.pnl);
  return {
    today: last.pnl,
    todayPct: last.returnPct,
    total,
    best: sorted.length ? { date: sorted[sorted.length - 1].date, pnl: sorted[sorted.length - 1].pnl } : null,
    worst: sorted.length ? { date: sorted[0].date, pnl: sorted[0].pnl } : null,
    upDays: up,
    downDays: down,
    sessions: pts.length,
    winRate: pts.length ? up / pts.length : null,
    avgDay: pts.length ? total / pts.length : null,
    spark: pts.slice(-20).map((p) => p.pnl),
  };
}

/** Combined desk-wide P&L per date, across every book that traded that day. */
export function deskTotals(seriesList: (DailyPnlSeries | null)[]): { date: string; pnl: number }[] {
  const byDate = new Map<string, number>();
  seriesList.forEach((s) =>
    s?.points.forEach((p) => byDate.set(p.date, (byDate.get(p.date) || 0) + p.pnl))
  );
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, pnl]) => ({ date, pnl }));
}
