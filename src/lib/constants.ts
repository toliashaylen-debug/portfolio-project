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
    // The ledger records every buy and sell with dates — the source for
    // showing which positions were sold off, alongside the cover page's
    // current holdings.
    tradeHistorySheets: ['backlog (ledger)', 'backlog'],
    // The ledger's own "Realized P&L" column, per transaction row — summed
    // directly, nothing computed from buy/sell matching.
    realizedPLSheets: ['backlog (ledger)', 'backlog'],
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
    // Each backlog already tracks its own buys and sells with FIFO lots and a
    // realized P&L column — no other sheet is needed for trade history.
    tradeHistorySheets: ['eq backlog', 'fi backlog', 'fx_backlog', 'fx backlog', 'opt backlog'],
    // Each backlog's own "Realized PnL" column, per transaction row.
    realizedPLSheets: ['eq backlog', 'fi backlog', 'fx_backlog', 'fx backlog', 'opt backlog'],
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
    // No dated daily log exists anywhere in this book's own workbook — daily
    // P&L is derived from the change between his own uploaded snapshots
    // instead (see dailyPnlFromHistory below). This list stays as documentation
    // of which pages were checked and found to have no such log.
    dailyPnlSheets: ['Cover & Returns', 'Equity - Active', 'FI - Active'],
    dailyPnlFromHistory: true,
    // Total value and the equity/fixed-income split come only from the summary
    // page's own reported figures, never summed from position rows.
    summarySheets: ['cover & returns'],
    // Equity sector weights come from the "Sector Breakdown — Equity (live)"
    // table on the summary page, not summed from position rows.
    preferReportedSectorWeights: true,
    // Equity - Orderbook is a working order book, not a transaction log — it
    // has no buy-side data at all, only sell orders (mostly covered-call
    // buybacks), and only its "Filled" rows are real sales. Buy dates come
    // from Equity - Log instead, read strictly for the buy side so the same
    // sale is never counted from both sheets.
    tradeHistoryBuySheets: ['equity - log'],
    tradeHistorySellSheets: ['equity - orderbook'],
    // Equity - Orderbook only has "Date Placed," not a confirmed fill date —
    // for a limit order those can be days apart, so the sell date shown here
    // is the earlier of the two, not necessarily the exact execution date.
    tradeHistorySellDateCaveat: 'Sell dates are when the order was placed in Equity - Orderbook, which can be a few days before it actually filled.',
    // Equity - Active and FI - Active each carry their own "Realized PnL ($)"
    // column, a running total per currently-held ticker. Equity - Log and
    // FI - Log carry no comparable labeled column (only "FX Realized PnL",
    // a currency-conversion figure, not this) — included per instruction, but
    // contribute nothing. Note the resulting gap: a position fully sold out
    // (e.g. INTC, CRWV) drops off Active entirely and isn't captured by any
    // of these four sheets, so it's honestly excluded rather than estimated.
    realizedPLSheets: ['equity - log', 'equity - active', 'fi - log', 'fi - active'],
  },
};

export const SLEEVE_COLORS: Record<Sleeve, string> = { equity: '#144B87', fixedIncome: '#1E8E5A', other: '#8996AC' };
export const SLEEVE_LABELS: Record<Sleeve, string> = { equity: 'Equity', fixedIncome: 'Fixed income', other: 'Other' };
export const SECTOR_PALETTE = ['#144B87', '#1E8E5A', '#6089B3', '#C7333F', '#6B5CA0', '#2C8F8F', '#B5651D', '#6B7B2A', '#A34C82', '#55647D'];
