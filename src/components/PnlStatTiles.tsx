import type { PnlSummary } from '../lib/dailyPnl';
import { fmtMoney, fmtPct } from '../lib/format';

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 100, h = 26;
  const max = Math.max(...values.map(Math.abs), 1);
  const step = w / (values.length - 1);
  const y = (v: number) => h / 2 - (v / max) * (h / 2 - 2);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="var(--border)" strokeWidth="1" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Per-book summary: today, running total, best and worst sessions, hit rate. */
export default function PnlStatTiles({ tiles }: { tiles: { name: string; summary: PnlSummary | null; color: string }[] }) {
  return (
    <div className="desk-grid3" style={{ marginBottom: 0 }}>
      {tiles.map((t) => {
        const s = t.summary;
        if (!s) {
          return (
            <div className="desk-card" key={t.name}>
              <div className="desk-card-name">{t.name}</div>
              <div className="desk-note" style={{ marginTop: 'var(--sp-3)' }}>No daily P&amp;L available.</div>
            </div>
          );
        }
        const up = (s.today ?? 0) >= 0;
        return (
          <div className="desk-card" key={t.name} style={{ borderTop: '2px solid ' + t.color }}>
            <div className="desk-card-top">
              <div className="desk-card-name">{t.name}</div>
              <span className={'desk-chip ' + (up ? 'up' : 'down')}>{s.todayPct !== null ? fmtPct(s.todayPct) : (up ? 'up' : 'down')}</span>
            </div>
            <div className="desk-card-value mono" style={{ color: up ? 'var(--pos)' : 'var(--neg)' }}>
              {(up ? '+' : '') + fmtMoney(s.today)}
            </div>
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <Sparkline values={s.spark} color={t.color} />
            </div>
            <div className="desk-mini-row">
              <span>Running total</span>
              <span className="mono" style={{ color: s.total >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {(s.total >= 0 ? '+' : '') + fmtMoney(s.total)}
              </span>
            </div>
            <div className="desk-mini-row">
              <span>Best session</span>
              <span className="mono" style={{ color: 'var(--pos)' }}>{s.best ? '+' + fmtMoney(s.best.pnl) : '—'}</span>
            </div>
            <div className="desk-mini-row">
              <span>Worst session</span>
              <span className="mono" style={{ color: 'var(--neg)' }}>{s.worst ? fmtMoney(s.worst.pnl) : '—'}</span>
            </div>
            <div className="desk-mini-row">
              <span>Up days</span>
              <span className="mono">{s.upDays}/{s.sessions}{s.winRate !== null ? ` · ${(s.winRate * 100).toFixed(0)}%` : ''}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
