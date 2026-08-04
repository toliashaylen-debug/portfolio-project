import type { BenchmarkSideData } from '../types';
import RiskBadge from './RiskBadge';
import BenchmarkLineChart from './BenchmarkLineChart';
import { CHART } from '../lib/chartTheme';

export default function ComparisonBlock({ title, data, sleeveLabel }: { title: string; data: BenchmarkSideData | null | undefined; sleeveLabel: string }) {
  if (!data || (data.benchmarkReturnPct === null && data.portfolioReturnPct === null)) {
    return (
      <div className="desk-panel">
        <h3>{title}</h3>
        <div className="desk-note">No {sleeveLabel.toLowerCase()} benchmark comparison data found for this portfolio.</div>
      </div>
    );
  }
  const diff = (data.portfolioReturnPct !== null && data.benchmarkReturnPct !== null) ? (data.portfolioReturnPct - data.benchmarkReturnPct) : null;
  const hasVolSharpe = data.benchmarkVolPct !== null || data.portfolioVolPct !== null || data.benchmarkSharpe !== null || data.portfolioSharpe !== null;

  return (
    <div className="desk-panel">
      <h3>{title}</h3>
      <div className="desk-grid3" style={{ marginBottom: hasVolSharpe ? 'var(--sp-4)' : '0' }}>
        <RiskBadge
          label={sleeveLabel + ' return'}
          valueLabel={data.portfolioReturnPct !== null ? (data.portfolioReturnPct >= 0 ? '+' : '') + data.portfolioReturnPct.toFixed(2) + '%' : '—'}
          level="low"
        />
        <RiskBadge
          label={(data.benchmarkName || 'Benchmark') + ' return'}
          valueLabel={data.benchmarkReturnPct !== null ? (data.benchmarkReturnPct >= 0 ? '+' : '') + data.benchmarkReturnPct.toFixed(2) + '%' : '—'}
          level="low"
        />
        <RiskBadge
          label={diff !== null ? (diff >= 0 ? 'Outperformance' : 'Underperformance') : 'Difference'}
          valueLabel={diff !== null ? (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%' : '—'}
          level={diff === null ? 'low' : (diff >= 0 ? 'low' : 'high')}
        />
      </div>
      {hasVolSharpe ? (
        <div className="desk-row" style={{ gap: 'var(--sp-6)', fontSize: '12px', color: 'var(--text-dim)' }}>
          <div>{sleeveLabel} vol: <span className="mono">{data.portfolioVolPct !== null ? data.portfolioVolPct.toFixed(1) + '%' : '—'}</span> · Sharpe: <span className="mono">{data.portfolioSharpe !== null ? data.portfolioSharpe.toFixed(2) : '—'}</span></div>
          <div>{(data.benchmarkName || 'Benchmark')} vol: <span className="mono">{data.benchmarkVolPct !== null ? data.benchmarkVolPct.toFixed(1) + '%' : '—'}</span> · Sharpe: <span className="mono">{data.benchmarkSharpe !== null ? data.benchmarkSharpe.toFixed(2) : '—'}</span></div>
        </div>
      ) : null}
      {data.benchmarkSeries && data.benchmarkSeries.length > 1 ? (
        <BenchmarkLineChart series={data.benchmarkSeries} color={CHART.benchmark} label={data.benchmarkName || 'Benchmark'} />
      ) : null}
      {(data.portfolioLabel || data.benchmarkLabel) ? (
        <div className="desk-note" style={{ marginTop: 'var(--sp-4)', borderTop: '1px solid var(--border-soft)', paddingTop: 'var(--sp-3)' }}>
          Read from the sheet as — <strong>yours:</strong> “{data.portfolioLabel || 'unlabelled'}”
          {data.portfolioReturnRaw !== null && data.portfolioReturnRaw !== undefined ? ` (cell value ${data.portfolioReturnRaw})` : ''}
          {' · '}
          <strong>benchmark:</strong> “{data.benchmarkLabel || 'unlabelled'}”
          {data.benchmarkReturnRaw !== null && data.benchmarkReturnRaw !== undefined ? ` (cell value ${data.benchmarkReturnRaw})` : ''}.
          If either is reading the wrong cell, regenerate the comparison.
        </div>
      ) : null}
    </div>
  );
}
