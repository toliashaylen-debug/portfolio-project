import type {
  Position,
  EnrichedPosition,
  History,
  PortfolioMetrics,
  Breakdown,
  SleeveSegment,
  SectorWeight,
  SectorWeightWithColor,
  WeightMode,
  ReportedSummary,
  RiskLevel,
  PositionWithSleeveWeight,
  PositionWithPct,
} from '../types';
import { SLEEVE_COLORS, SLEEVE_LABELS, SECTOR_PALETTE } from './constants';

export function valueOf(p: Position): number {
  return typeof p.positionMarketValue === 'number' && !isNaN(p.positionMarketValue) ? p.positionMarketValue : p.shares * p.price;
}

export function plOf(p: Position): number {
  if (typeof p.reportedUnrealizedPL === 'number' && !isNaN(p.reportedUnrealizedPL)) return p.reportedUnrealizedPL;
  return valueOf(p) - p.shares * p.costBasis;
}

export function flagPosition(p: Position): string | null {
  if (typeof p.reportedUnrealizedPL === 'number' && !isNaN(p.reportedUnrealizedPL)) return null;
  const value = valueOf(p);
  const pl = plOf(p);
  if (!value) return null;
  if (Math.abs(pl) > 0.6 * Math.abs(value)) {
    return "Computed P&L looks unusually large relative to this position's size — check whether its cost-basis column is in the same currency/unit as its price or market value column in the source file.";
  }
  return null;
}

export function computeSnapshotValue(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + valueOf(p), 0);
}

export function computeSnapshotCostValue(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + p.shares * p.costBasis, 0);
}

export function enrichPositions(history: History): EnrichedPosition[] {
  if (!history.length) return [];
  const latest = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const prevByTicker: Record<string, Position> = {};
  if (prev) prev.positions.forEach((p) => { prevByTicker[p.ticker] = p; });

  return latest.positions.map((p) => {
    const prevP = prevByTicker[p.ticker];
    const value = valueOf(p);
    const costValue = p.shares * p.costBasis;
    const unrealizedPL = plOf(p);
    let dayChangeDollar: number | null = null;
    let dayChangePct: number | null = null;
    if (prevP) {
      const prevValue = valueOf(prevP);
      dayChangeDollar = value - prevValue;
      dayChangePct = prevValue !== 0 ? (value - prevValue) / prevValue : null;
    }
    return { ...p, value, costValue, unrealizedPL, dayChangeDollar, dayChangePct, isNew: !prevP };
  });
}

export function portfolioMetrics(history: History): PortfolioMetrics | null {
  if (!history.length) return null;
  const positions = enrichPositions(history);
  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalCost = positions.reduce((s, p) => s + p.costValue, 0);
  const totalPL = positions.reduce((s, p) => s + p.unrealizedPL, 0);
  const dayChangeDollar = positions.reduce((s, p) => s + (p.dayChangeDollar || 0), 0);
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const prevTotalValue = prev ? computeSnapshotValue(prev.positions) : null;
  const dayChangePct = prevTotalValue ? dayChangeDollar / prevTotalValue : null;
  const lastSnapshot = history[history.length - 1];
  const lastDate = lastSnapshot.date;
  const reported = lastSnapshot.reported || null;
  const displayValue = reported && reported.totalValue !== null && reported.totalValue !== undefined ? reported.totalValue : totalValue;
  const positionsSumDiffers = reported && reported.totalValue !== null ? Math.abs(reported.totalValue - totalValue) / totalValue > 0.02 : null;
  return { positions, totalValue, totalCost, totalPL, dayChangeDollar, dayChangePct, lastDate, hasHistory: history.length > 1, reported, displayValue, positionsSumDiffers };
}

export function riskLevel(val: number, low: number, high: number): RiskLevel {
  return val < low ? 'low' : val < high ? 'moderate' : 'high';
}

export function computeBreakdown(rawPositions: Position[] | null | undefined, weightMode?: WeightMode): Breakdown | null {
  const mode: WeightMode = weightMode || 'value';
  const positions = (rawPositions || []).filter((p) => p && typeof p.shares === 'number' && typeof p.price === 'number' && !isNaN(p.shares) && !isNaN(p.price));
  const totalValue = positions.reduce((s, p) => s + valueOf(p), 0);
  if (!totalValue || !positions.length) return null;

  const basisOf = (p: Position): number => {
    if (mode === 'shareCount') return p.shares;
    if (mode === 'given') return typeof p.reportedWeightPct === 'number' && !isNaN(p.reportedWeightPct) ? p.reportedWeightPct : 0;
    return valueOf(p);
  };

  const bySleeve: Record<string, number> = { equity: 0, fixedIncome: 0, other: 0 };
  const sleeveBasisTotal: Record<string, number> = { equity: 0, fixedIncome: 0, other: 0 };
  positions.forEach((p) => {
    const value = valueOf(p);
    const sleeve = Object.prototype.hasOwnProperty.call(bySleeve, p.sleeve) ? p.sleeve : 'other';
    bySleeve[sleeve] += value;
    sleeveBasisTotal[sleeve] += basisOf(p);
  });

  const sleeveSegments: SleeveSegment[] = Object.keys(bySleeve)
    .filter((k) => bySleeve[k] > 0)
    .map((k) => ({ key: k, label: SLEEVE_LABELS[k as keyof typeof SLEEVE_LABELS], value: bySleeve[k], pct: (bySleeve[k] / totalValue) * 100, color: SLEEVE_COLORS[k as keyof typeof SLEEVE_COLORS] }))
    .sort((a, b) => b.value - a.value);

  const withSleeveWeight: PositionWithSleeveWeight[] = positions.map((p) => {
    const sleeve = Object.prototype.hasOwnProperty.call(bySleeve, p.sleeve) ? p.sleeve : 'other';
    const basis = basisOf(p);
    const denom = sleeveBasisTotal[sleeve];
    const sleeveWeightPct = denom ? (basis / denom) * 100 : null;
    return { ...p, sleeve: sleeve as Position['sleeve'], sleeveWeightPct };
  });

  const bySector: Record<string, number> = {};
  withSleeveWeight.forEach((p) => {
    if (p.sleeve !== 'equity') return;
    const sector = p.sector && p.sector.trim() ? p.sector.trim() : 'Unclassified equity';
    bySector[sector] = (bySector[sector] || 0) + (p.sleeveWeightPct || 0);
  });
  const sectorWeights: SectorWeight[] = Object.keys(bySector)
    .map((k) => ({ label: k, pct: bySector[k] }))
    .sort((a, b) => b.pct - a.pct);

  const byValue: PositionWithPct[] = withSleeveWeight
    .map((p) => ({ ...p, value: valueOf(p), pct: (valueOf(p) / totalValue) * 100 }))
    .sort((a, b) => b.value - a.value);
  const top1Pct = byValue[0] ? byValue[0].pct : 0;
  const top3Pct = byValue.slice(0, 3).reduce((s, p) => s + p.pct, 0);
  const maxSectorPct = sectorWeights[0] ? sectorWeights[0].pct : 0;
  const equityPct = ((bySleeve.equity || 0) / totalValue) * 100;

  const fiPositions = positions.filter((p) => p.sleeve === 'fixedIncome');
  const fiWithDuration = fiPositions.filter((p) => typeof p.durationYears === 'number' && !isNaN(p.durationYears as number));
  const fiDurationValue = fiWithDuration.reduce((s, p) => s + valueOf(p), 0);
  const weightedDuration = fiDurationValue > 0
    ? fiWithDuration.reduce((s, p) => s + (p.durationYears as number) * valueOf(p), 0) / fiDurationValue
    : null;
  const fiDurationCoveragePct = bySleeve.fixedIncome > 0 ? (fiDurationValue / bySleeve.fixedIncome) * 100 : 0;

  return {
    totalValue,
    numPositions: positions.length,
    sleeveSegments,
    sectorWeights,
    topPositions: byValue.slice(0, 6),
    allPositions: withSleeveWeight,
    weightMode: mode,
    risk: {
      top1Pct,
      top3Pct,
      maxSectorPct,
      equityPct,
      top1Level: riskLevel(top1Pct, 10, 20),
      top3Level: riskLevel(top3Pct, 30, 50),
      sectorLevel: riskLevel(maxSectorPct, 25, 45),
      weightedDuration,
      fiDurationCoveragePct,
      durationLevel: weightedDuration === null ? null : riskLevel(weightedDuration, 1, 3),
    },
  };
}

export function reportedSleeveSegments(reported: ReportedSummary | null | undefined): SleeveSegment[] | null {
  if (!reported) return null;
  const segs: SleeveSegment[] = [];
  if (reported.equityWeightPct !== null && reported.equityWeightPct !== undefined) {
    segs.push({ key: 'equity', label: SLEEVE_LABELS.equity, value: 0, pct: reported.equityWeightPct, color: SLEEVE_COLORS.equity });
  }
  if (reported.fixedIncomeWeightPct !== null && reported.fixedIncomeWeightPct !== undefined) {
    segs.push({ key: 'fixedIncome', label: SLEEVE_LABELS.fixedIncome, value: 0, pct: reported.fixedIncomeWeightPct, color: SLEEVE_COLORS.fixedIncome });
  }
  if (!segs.length) return null;
  return segs.sort((a, b) => b.pct - a.pct);
}

export function withSectorColors(sectorWeights: SectorWeight[]): SectorWeightWithColor[] {
  return sectorWeights.map((s, i) => ({ ...s, color: SECTOR_PALETTE[i % SECTOR_PALETTE.length] }));
}
