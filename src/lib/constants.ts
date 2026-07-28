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
  },
  p2: {
    positionsSheets: ['active portfolio'],
    weightMode: 'value',
    readSheets: ['active portfolio', 'eq backlog', 'fx_backlog', 'fx backlog', 'fi backlog', 'benchmark'],
    strategySheets: ['active portfolio'],
    benchmarkSheets: ['benchmark'],
  },
  p3: null,
};

export const SLEEVE_COLORS: Record<Sleeve, string> = { equity: '#144B87', fixedIncome: '#1E8E5A', other: '#8996AC' };
export const SLEEVE_LABELS: Record<Sleeve, string> = { equity: 'Equity', fixedIncome: 'Fixed income', other: 'Other' };
export const SECTOR_PALETTE = ['#144B87', '#1E8E5A', '#6089B3', '#C7333F', '#6B5CA0', '#2C8F8F', '#B5651D', '#6B7B2A', '#A34C82', '#55647D'];
