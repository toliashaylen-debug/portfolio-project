import type { SectorWeight } from '../types';

export default function WeightBars({ items, limit = 8 }: { items: SectorWeight[]; limit?: number }) {
  const shown = items.slice(0, limit);
  return (
    <div>
      {shown.map((it, i) => (
        <div key={i} style={{ marginBottom: '9px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '3px' }}>
            <span>{it.label}</span>
            <span className="mono" style={{ color: 'var(--text-dim)' }}>{it.pct.toFixed(1)}%</span>
          </div>
          <div style={{ background: 'var(--panel-2)', borderRadius: '3px', height: '7px', overflow: 'hidden' }}>
            <div style={{ width: Math.min(it.pct, 100) + '%', height: '100%', background: 'var(--accent)', borderRadius: '3px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
