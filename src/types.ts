export type PortfolioId = 'p1' | 'p2' | 'p3';

export type Sleeve = 'equity' | 'fixedIncome' | 'other';
export type AssetType = 'equity' | 'etf' | 'bond' | 'other';

export interface Position {
  ticker: string;
  name: string | null;
  shares: number;
  costBasis: number;
  price: number;
  sector: string;
  assetType: AssetType;
  sleeve: Sleeve;
  durationYears: number | null;
  reportedWeightPct: number | null;
  positionMarketValue: number | null;
  reportedUnrealizedPL: number | null;
  sourceSheet: string;
}

export interface EnrichedPosition extends Position {
  value: number;
  costValue: number;
  unrealizedPL: number;
  dayChangeDollar: number | null;
  dayChangePct: number | null;
  isNew: boolean;
}

export interface ReportedSummary {
  totalValue: number | null;
  totalValueAsOf: string | null;
  totalValueSheet: string | null;
  equityWeightPct: number | null;
  fixedIncomeWeightPct: number | null;
  weightsSheet: string | null;
}

export interface Snapshot {
  date: string;
  positions: Position[];
  themes: string | null;
  reported: ReportedSummary | null;
}

export type History = Snapshot[];
export type Histories = Record<PortfolioId, History>;

export interface PortfolioConfig {
  id: PortfolioId;
  name: string;
  strategy: string;
}

export interface DeskConfig {
  password: string;
  portfolios: PortfolioConfig[];
}

export type ConfigsById = Record<PortfolioId, PortfolioConfig>;

export interface RawSheet {
  sheetName: string;
  grid: (string | number | null)[][];
}

export interface RawSheetsBundle {
  date: string;
  sheets: RawSheet[];
}

export interface PositionSheetCandidate {
  sheetName: string;
  positions: Position[];
  tickers: string[];
  defaultChecked: boolean;
}

export interface SummarySheet {
  sheetName: string;
  asOfDate: string | null;
  totalValue: number | null;
  equityValue: number | null;
  fixedIncomeValue: number | null;
  equityWeightPct: number | null;
  fixedIncomeWeightPct: number | null;
}

export interface ReadWorkbookResult {
  positionSheets: PositionSheetCandidate[];
  reportedSummary: ReportedSummary | null;
  rawSheets: RawSheet[];
}

export interface SleeveSegment {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;
}

export interface SectorWeight {
  label: string;
  pct: number;
}

export interface SectorWeightWithColor extends SectorWeight {
  color: string;
}

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface BreakdownRisk {
  top1Pct: number;
  top3Pct: number;
  maxSectorPct: number;
  equityPct: number;
  top1Level: RiskLevel;
  top3Level: RiskLevel;
  sectorLevel: RiskLevel;
  weightedDuration: number | null;
  fiDurationCoveragePct: number;
  durationLevel: RiskLevel | null;
}

export type WeightMode = 'value' | 'shareCount' | 'given';

export interface PositionWithSleeveWeight extends Position {
  sleeveWeightPct: number | null;
}

export interface PositionWithPct extends PositionWithSleeveWeight {
  value: number;
  pct: number;
}

export interface Breakdown {
  totalValue: number;
  numPositions: number;
  sleeveSegments: SleeveSegment[];
  sectorWeights: SectorWeight[];
  topPositions: PositionWithPct[];
  allPositions: PositionWithSleeveWeight[];
  weightMode: WeightMode;
  risk: BreakdownRisk;
}

export interface PortfolioSourcing {
  positionsSheets: string[] | null;
  weightMode: WeightMode;
  readSheets: string[];
  strategySheets: string[];
  benchmarkSheets: string[];
}

export interface PortfolioMetrics {
  positions: EnrichedPosition[];
  totalValue: number;
  totalCost: number;
  totalPL: number;
  dayChangeDollar: number | null;
  dayChangePct: number | null;
  lastDate: string;
  hasHistory: boolean;
  reported: ReportedSummary | null;
  displayValue: number;
  positionsSumDiffers: boolean | null;
}

export interface MonteCarloAsset {
  ticker: string;
  sleeve: Sleeve;
  sector: string;
  assetType: AssetType;
  weight: number;
  mean: number;
  vol: number;
}

export interface MonteCarloSummaryPoint {
  month: number;
  label: string;
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
  band90: number;
  band50: number;
}

export interface MonteCarloResult {
  totalValue: number;
  assets: MonteCarloAsset[];
  summary: MonteCarloSummaryPoint[];
  var95Loss: number;
  var95Value: number;
  cvar95Loss: number;
  cvar95Value: number;
  numSims: number;
  numMonths: number;
}

export interface BenchmarkSeriesPoint {
  date: string;
  value: number;
}

export interface BenchmarkSideData {
  benchmarkName: string | null;
  benchmarkReturnPct: number | null;
  portfolioReturnPct: number | null;
  benchmarkVolPct: number | null;
  portfolioVolPct: number | null;
  benchmarkSharpe: number | null;
  portfolioSharpe: number | null;
  benchmarkSeries: BenchmarkSeriesPoint[];
}

export interface BenchmarkComparison {
  found: boolean;
  sheetUsed: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  equity: BenchmarkSideData;
  fixedIncome: BenchmarkSideData;
}
