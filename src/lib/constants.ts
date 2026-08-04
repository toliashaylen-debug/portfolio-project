import type { PortfolioId, PortfolioSourcing, Sleeve } from '../types';

export const PORTFOLIO_IDS: PortfolioId[] = ['p1', 'p2', 'p3'];
export const DEFAULT_NAMES = ["Shaylen's Portfolio", "Antonio's Portfolio", "Israel's Portfolio"];

export const PORTFOLIO_SOURCING: Record<PortfolioId, PortfolioSourcing | null> = {
  p1: {
    positionsSheets: ['portfolio - cover page', 'cover page'],
    weightMode: 'shareCount',
    readSheets: ['portfolio - cover page', 'cover page', 'backlog (ledger)', 'backlog', 'daily performance', 'benchmark'],
    strategySheets: ['portfolio - cover page', 'cover page'],
    benchmarkSheets: ['benchmark'],
    // Daily P&L comes from the Daily Performance sheet and nowhere else.
    dailyPnlSheets: ['daily performance'],
  },
  p2: {
    positionsSheets: ['active portfolio'],
    weightMode: 'value',
    readSheets: ['active portfolio', 'eq backlog', 'fx_backlog', 'fx backlog', 'fi backlog', 'benchmark'],
    strategySheets: ['active portfolio'],
    benchmarkSheets: ['benchmark'],
    // Daily P&L comes from the Benchmark sheet and nowhere else — note it is
    // split there into separate equity and fixed income blocks.
    dailyPnlSheets: ['benchmark'],
  },
  p3: {
    // Positions table, snapshot, overview, desk view and common positions all
    // draw their holdings from these two sheets and nowhere else.
    positionsSheets: ['equity - active', 'fi - active'],
    weightMode: 'value',
    readSheets: ['cover & returns', 'equity - active', 'fi - active', 'equity - log', 'fi - log', 'income & calendar'],
    strategySheets: ['equity - log', 'equity - active', 'fi - log', 'fi - active'],
    // The strategy label is suggested from the trade log's own thesis/rationale
    // text plus current holdings — nothing outside these four sheets.
    strategyContextSheets: ['equity - log', 'equity - active', 'fi - log', 'fi - active'],
    // Equity vs. S&P 500 and fixed income vs. LQD, read only from the summary
    // page's own benchmark table.
    benchmarkSheets: ['Cover & Returns'],
    // No dated daily log exists for this book — restricting the search to
    // these three pages means the desk honestly reports "not found" rather
    // than inventing a trend from elsewhere.
    dailyPnlSheets: ['Cover & Returns', 'Equity - Active', 'FI - Active'],
    // Total value and the equity/fixed-income split come only from the summary
    // page's own reported figures, never summed from position rows.
    summarySheets: ['cover & returns'],
    // Equity sector weights come from the "Sector Breakdown — Equity (live)"
    // table on the summary page, not summed from position rows.
    preferReportedSectorWeights: true,
  },
};

export const SLEEVE_COLORS: Record<Sleeve, string> = { equity: '#144B87', fixedIncome: '#1E8E5A', other: '#8996AC' };
export const SLEEVE_LABELS: Record<Sleeve, string> = { equity: 'Equity', fixedIncome: 'Fixed income', other: 'Other' };
export const SECTOR_PALETTE = ['#144B87', '#1E8E5A', '#6089B3', '#C7333F', '#6B5CA0', '#2C8F8F', '#B5651D', '#6B7B2A', '#A34C82', '#55647D'];
