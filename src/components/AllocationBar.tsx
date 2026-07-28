import type { Position, ReportedSummary } from '../types';
import { computeBreakdown, reportedSleeveSegments } from '../lib/compute';

export default function AllocationBar({ positions, reported }: { positions: Position[]; reported: ReportedSummary | null }) {
  const b = computeBreakdown(positions);
  const segments = reportedSleeveSegments(reported) || (b ? b.sleeveSegments : null);
  if (!segments) return <div />;
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'flex', height: '7px', borderRadius: '3px', overflow: 'hidden' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: s.pct + '%', background: s.color }} title={s.label + ' ' + s.pct.toFixed(1) + '%'} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
        {segments.map((s, i) => (
          <span key={i} style={{ fontSize: '10.5px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: s.color, display: 'inline-block' }} />
            {s.label + ' ' + s.pct.toFixed(0) + '%'}
          </span>
        ))}
      </div>
    </div>
  );
}
