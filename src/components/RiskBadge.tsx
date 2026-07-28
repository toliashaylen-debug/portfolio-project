import type { ReactNode } from 'react';
import type { RiskLevel } from '../types';

export default function RiskBadge({ label, valueLabel, level, sub }: { label: string; valueLabel: string; level: RiskLevel; sub?: ReactNode }) {
  const color = level === 'high' ? 'var(--neg)' : level === 'moderate' ? 'var(--accent)' : 'var(--pos)';
  return (
    <div className="desk-card" style={{ borderLeft: '2px solid ' + color }}>
      <div className="desk-card-name">{label}</div>
      <div className="mono" style={{ fontSize: '21px', fontWeight: 600, color, marginTop: '9px' }}>{valueLabel}</div>
      {sub ? <div className="desk-note" style={{ marginTop: '5px' }}>{sub}</div> : null}
    </div>
  );
}
