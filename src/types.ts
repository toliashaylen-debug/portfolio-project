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
  /** Equity-sleeve sector weights, when a sheet reports them directly rather than them being summed from positions. */
  sectorWeights: SectorWeight[] | null;
  sectorWeightsSheet: string | null;
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
  sectorWeights: SectorWeight[] | null;
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
  /** Sheet(s) daily P&L may be read from — nothing else counts as a source. */
  dailyPnlSheets: string[];
  /** When true, daily P&L is derived from the day-over-day change in this book's own uploaded snapshots instead of any sheet — for books with no dated performance log at all. Overrides dailyPnlSheets. */
  dailyPnlFromHistory?: boolean;
  /** Restricts which sheets may contribute the reported total value / equity-FI weight summary. Unrestricted (any sheet) when omitted. */
  summarySheets?: string[] | null;
  /** When true, prefer a sheet-reported equity-sector breakdown over one summed from position rows, if one was found. */
  preferReportedSectorWeights?: boolean;
  /** Extra raw sheet content fed to the AI when suggesting a strategy label — omitted portfolios keep the ticker/sector-only prompt. */
  strategyContextSheets?: string[] | null;
  /** Sheet(s) trade history (open + closed positions with buy/sell dates) is read from, when buy and sell sides both live in the same sheet(s). Mutually exclusive with tradeHistoryBuySheets/tradeHistorySellSheets. */
  tradeHistorySheets?: string[] | null;
  /** Use instead of tradeHistorySheets when buy-side and sell-side data live in separate, non-overlapping sheets (e.g. a transaction log for buys, a working order book for sells) — read and extracted independently so the same sale is never counted from both. */
  tradeHistoryBuySheets?: string[] | null;
  tradeHistorySellSheets?: string[] | null;
  /** Shown next to the Sold table when the sell-side source only gives an order-placed date rather than a confirmed fill date, which can differ by days. */
  tradeHistorySellDateCaveat?: string;
}

export interface TradeTransaction {
  ticker: string;
  name: string | null;
  sleeve: Sleeve;
  side: 'buy' | 'sell';
  /** ISO date. */
  date: string;
  shares: number;
  price: number | null;
  /** The transaction's own stated realized P&L, only when the sheet gives one directly. */
  realizedPL: number | null;
  sourceSheet: string;
}

export interface ClosedPosition {
  ticker: string;
  name: string | null;
  sleeve: Sleeve;
  buyDate: string | null;
  sellDate: string;
  shares: number;
  buyPrice: number | null;
  sellPrice: number | null;
  realizedPL: number | null;
}

export interface OpenPosition {
  ticker: string;
  name: string | null;
  sleeve: Sleeve;
  buyDate: string | null;
  shares: number;
  buyPrice: number | null;
}

export interface TradeHistory {
  found: boolean;
  open: OpenPosition[];
  closed: ClosedPosition[];
  extractedAt: string;
}

export interface DailyPnlPoint {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Profit or loss for that day, in dollars. */
  pnl: number;
  /** That day's return, as a fraction (0.012 = +1.2%). Null when not stated. */
  returnPct: number | null;
  /** Portfolio value at the close of that day, when the sheet gives one. */
  endingValue: number | null;
}

export interface DailyPnlSeries {
  found: boolean;
  sheetUsed: string | null;
  /** How the figures were derived, for display — the desk shows its working. */
  method: string | null;
  points: DailyPnlPoint[];
  extractedAt: string;
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
  /** True when `vol` came from real historical prices rather than a stated assumption. */
  volFromHistory: boolean;
}

/** Derived statistics from a historical price pull. Raw prices are never stored. */
export interface PriceStats {
  asOf: string;
  source: string;
  windowStart: string | null;
  windowEnd: string | null;
  tradingDaysPerYear: number;
  /** Annualised volatility per ticker, keyed by the ticker as it appears in positions. */
  byTicker: Record<string, { bbg: string; vol: number; observations: number }>;
  /** Pairwise correlation, keyed by the two tickers sorted and joined with "|". */
  corr: Record<string, number>;
}

export interface MonteCarloCoverage {
  /** Tickers whose volatility came from historical data. */
  historical: string[];
  /** Tickers that fell back to stated asset-class assumptions. */
  assumed: string[];
  /** Share of portfolio value covered by historical volatility, 0-1. */
  historicalWeight: number;
  /** Correlation pairs sourced from history, and the total number of pairs. */
  corrPairsHistorical: number;
  corrPairsTotal: number;
  statsAsOf: string | null;
  statsWindow: string | null;
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
  coverage: MonteCarloCoverage;
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
  /** Sheet label each return was read from, so a misread cell is visible. */
  portfolioLabel?: string | null;
  benchmarkLabel?: string | null;
  /** The cell values exactly as they appear, before any scaling. */
  portfolioReturnRaw?: number | null;
  benchmarkReturnRaw?: number | null;
}

export interface BenchmarkComparison {
  found: boolean;
  sheetUsed: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  equity: BenchmarkSideData;
  fixedIncome: BenchmarkSideData;
}
