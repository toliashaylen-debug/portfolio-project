import type { BenchmarkComparison, PortfolioId } from '../types';
import { safeGet, safeSet } from './storage';

export const benchmarkComparisonKey = (id: PortfolioId) => `benchmarkcomparison-${id}`;

export async function loadBenchmarkComparison(id: PortfolioId): Promise<BenchmarkComparison | null> {
  const raw = await safeGet(benchmarkComparisonKey(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BenchmarkComparison;
    return parsed && typeof parsed.found === 'boolean' ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveBenchmarkComparison(id: PortfolioId, comparison: BenchmarkComparison): Promise<void> {
  await safeSet(benchmarkComparisonKey(id), JSON.stringify(comparison));
}
