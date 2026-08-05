import type { PortfolioId, RawSheet, RawSheetsBundle, RealizedPLResult } from '../types';
import { PORTFOLIO_SOURCING } from './constants';
import { safeGet, safeSet } from './storage';
import { sheetAllowed } from './format';
import { extractRealizedPL } from './ai';

export const realizedPLKey = (id: PortfolioId) => `realizedpl-${id}`;

export async function loadRealizedPL(id: PortfolioId): Promise<RealizedPLResult | null> {
  const raw = await safeGet(realizedPLKey(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RealizedPLResult;
    return parsed && Array.isArray(parsed.entries) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Pulls the sheets a portfolio is permitted to source realized P&L from —
 * deliberately separate from trade-history sourcing, since the two can
 * legitimately differ (a position sheet may state realized P&L directly
 * while not being where buy/sell dates for the same trade live).
 */
export async function sourceSheetsForRealizedPL(id: PortfolioId): Promise<{ sheets: RawSheet[] | null; error: string | null }> {
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
  const allowed = sourcing?.realizedPLSheets;
  if (!allowed) return { sheets: null, error: 'No realized P&L source configured for this portfolio.' };
  const restricted = all.filter((s) => sheetAllowed(s.sheetName, allowed));
  if (!restricted.length) {
    return { sheets: null, error: `This portfolio reads realized P&L only from "${allowed.join(' / ')}", and none of those sheets are in the saved workbook.` };
  }
  return { sheets: restricted, error: null };
}

export async function refreshRealizedPL(id: PortfolioId): Promise<RealizedPLResult> {
  const { sheets, error } = await sourceSheetsForRealizedPL(id);
  if (!sheets) throw new Error(error || 'No source sheet available.');
  const entries = await extractRealizedPL(sheets);
  const total = entries.reduce((s, e) => s + e.value, 0);
  const result: RealizedPLResult = {
    found: entries.length > 0,
    total,
    entries,
    extractedAt: new Date().toISOString().slice(0, 10),
  };
  await safeSet(realizedPLKey(id), JSON.stringify(result));
  return result;
}
