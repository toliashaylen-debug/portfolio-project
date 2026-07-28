import type { Position, ReportedSummary, WeightMode } from '../types';
import { computeBreakdown, reportedSleeveSegments, withSectorColors, flagPosition } from '../lib/compute';
import { fmtMoney, cleanProse } from '../lib/format';
import RiskBadge from './RiskBadge';
import DonutChart from './DonutChart';
import WeightBars from './WeightBars';

export default function CompositionPanel({ positions, themes, reported, weightMode }: {
  positions: Position[];
  themes: string | null | undefined;
  reported: ReportedSummary | null | undefined;
  weightMode: WeightMode;
}) {
  let b;
  let computeError: string | null = null;
  try {
    b = computeBreakdown(positions, weightMode);
  } catch (e) {
    computeError = e instanceof Error ? e.message : 'Unexpected error computing the breakdown.';
  }
  if (!b) {
    return (
      <div className="desk-panel">
        <h3>Composition & risk</h3>
        <div className="desk-error">
          {computeError ? 'Could not compute the breakdown: ' + computeError : 'Could not compute a breakdown from these positions — check that every row has a valid share count and price (no blanks, text, or zero values).'}
        </div>
      </div>
    );
  }

  const reportedSegs = reportedSleeveSegments(reported);
  const sleeveSegments = reportedSegs || b.sleeveSegments;
  const displayValue = reported && reported.totalValue !== null && reported.totalValue !== undefined ? reported.totalValue : b.totalValue;
  const sectorDonutSegments = withSectorColors(b.sectorWeights).slice(0, 8);
  const hasDuration = b.risk.weightedDuration !== null;
  const sectorLevelColor = b.risk.sectorLevel === 'high' ? 'var(--neg)' : b.risk.sectorLevel === 'moderate' ? 'var(--accent)' : 'var(--pos)';
  const reconciles = !!(reported && reported.totalValue !== null && reported.totalValue !== undefined && Math.abs(reported.totalValue - b.totalValue) / b.totalValue > 0.02);
  const flaggedPositions = positions.filter((p) => flagPosition(p));

  return (
    <div>
      <div className="desk-panel">
        <h3>Snapshot</h3>
        <div className="desk-grid3" style={{ marginBottom: 0 }}>
          <RiskBadge
            label="Total value"
            valueLabel={fmtMoney(displayValue)}
            level="low"
            sub={reported && reported.totalValue !== null ? 'reported as of ' + (reported.totalValueAsOf || 'latest') : 'sum of ' + b.numPositions + ' positions'}
          />
          <RiskBadge
            label="Largest single position"
            valueLabel={b.risk.top1Pct.toFixed(1) + '%'}
            level={b.risk.top1Level}
            sub={b.topPositions[0] ? b.topPositions[0].ticker + ' of total value' : ''}
          />
          <RiskBadge label="Top 3 concentration" valueLabel={b.risk.top3Pct.toFixed(1) + '%'} level={b.risk.top3Level} sub="of total value in 3 names" />
          {hasDuration ? (
            <RiskBadge
              label="Fixed income duration"
              valueLabel={b.risk.weightedDuration!.toFixed(2) + ' yrs'}
              level={b.risk.durationLevel!}
              sub={'weighted avg · rate sensitivity · ' + b.risk.fiDurationCoveragePct.toFixed(0) + '% of FI sleeve has duration data'}
            />
          ) : null}
        </div>
        {reconciles ? (
          <div className="desk-note" style={{ marginTop: 'var(--sp-4)' }}>
            Note: the position sheets you imported sum to {fmtMoney(b.totalValue)} — they may not reflect every trade since they were last updated. Total value above uses the reported figure instead.
          </div>
        ) : null}
        {flaggedPositions.length > 0 ? (
          <div className="desk-note" style={{ marginTop: 'var(--sp-3)', color: 'var(--neg)' }}>
            ⚠ {flaggedPositions.length} position{flaggedPositions.length === 1 ? '' : 's'} ({flaggedPositions.map((p) => p.ticker).join(', ')}) {flaggedPositions.length === 1 ? 'has' : 'have'} a computed P&L that looks unusually large relative to their size — worth checking whether the cost-basis and price/value columns are in the same currency in your source file.
          </div>
        ) : null}
      </div>

      <div className="desk-panel">
        <h3>Allocation</h3>
        <div className="desk-grid3" style={{ marginBottom: 0 }}>
          <div className="desk-card" style={{ gridColumn: 'span 1' }}>
            <div className="desk-card-name" style={{ marginBottom: 'var(--sp-3)' }}>Equity / fixed income split</div>
            <DonutChart segments={sleeveSegments} />
            {reportedSegs ? <div className="desk-note" style={{ marginTop: 'var(--sp-2)' }}>As reported in "{reported!.weightsSheet}"</div> : null}
          </div>
          <div className="desk-card" style={{ gridColumn: 'span 2' }}>
            <div className="desk-card-name" style={{ marginBottom: 'var(--sp-3)' }}>
              Equity sector weight <span className="unit">(% of equity sleeve)</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-5)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <DonutChart segments={sectorDonutSegments} size={110} />
              <div style={{ flex: 1, minWidth: '180px' }}>
                <WeightBars items={b.sectorWeights} />
              </div>
            </div>
            <div className="desk-mini-row">
              <span>Largest sector</span>
              <span className="mono" style={{ color: sectorLevelColor }}>
                {b.sectorWeights[0] ? b.sectorWeights[0].label + ' ' + b.risk.maxSectorPct.toFixed(1) + '%' : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {themes ? (
        <div className="desk-panel">
          <h3>Read</h3>
          <div className="desk-commentary-text">{cleanProse(themes)}</div>
        </div>
      ) : null}
    </div>
  );
}
