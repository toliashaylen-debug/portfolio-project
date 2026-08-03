import type { PriceStats } from '../types';
import { safeGet } from './storage';

export const PRICE_STATS_KEY = 'price-stats';

/**
 * Loads the derived volatility/correlation statistics produced by the offline
 * Bloomberg pipeline (scripts/import-price-history.mjs). Returns null when no
 * pull has been done yet — callers fall back to stated assumptions.
 */
export async function loadPriceStats(): Promise<PriceStats | null> {
  const raw = await safeGet(PRICE_STATS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PriceStats;
    if (!parsed || typeof parsed !== 'object' || !parsed.byTicker) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function corrKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}
