import type { Sleeve } from '../types';
import { SLEEVE_COLORS, SLEEVE_LABELS } from '../lib/constants';

export default function SleeveChip({ sleeve }: { sleeve: Sleeve }) {
  const color = SLEEVE_COLORS[sleeve] || 'var(--text-faint)';
  return (
    <span className="desk-sleeve-chip" style={{ background: color + '1f', color }}>
      {SLEEVE_LABELS[sleeve] || sleeve || 'other'}
    </span>
  );
}
