export interface DonutSegment {
  pct: number;
  color: string;
  label: string;
}

export default function DonutChart({ segments, size = 130 }: { segments: DonutSegment[]; size?: number }) {
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;
  const arcs = segments.map((s, i) => {
    const dash = (s.pct / 100) * circumference;
    const el = (
      <circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={s.color}
        strokeWidth={strokeWidth}
        strokeDasharray={dash + ' ' + (circumference - dash)}
        strokeDashoffset={-acc}
        strokeLinecap="butt"
      />
    );
    acc += dash;
    return el;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--panel-2)" strokeWidth={strokeWidth} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>{arcs}</g>
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="20" fontWeight="600" fill="var(--text)">
          {segments[0] ? segments[0].pct.toFixed(0) + '%' : ''}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9.5" fill="var(--text-dim)">
          {segments[0] ? segments[0].label : ''}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '140px' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: s.color, display: 'inline-block' }} />
              {s.label}
            </span>
            <span className="mono" style={{ color: 'var(--text-dim)' }}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
