import type { PnlSummary } from '../lib/dailyPnl';

/** Proportion of winning to losing sessions per book, as a single stacked bar. */
export default function WinLossSplit({ rows }: { rows: { name: string; summary: PnlSummary | null }[] }) {
  const usable = rows.filter((r) => r.summary && r.summary.sessions > 0);
  if (!usable.length) return null;
  return (
    <div className="pnl-bars">
      {usable.map((r) => {
        const s = r.summary!;
        const flat = s.sessions - s.upDays - s.downDays;
        const pct = (n: number) => (n / s.sessions) * 100;
        return (
          <div className="pnl-bar-row" key={r.name}>
            <div className="pnl-bar-name">{r.name}</div>
            <div className="pnl-bar-track" style={{ display: 'flex', overflow: 'hidden' }}>
              {s.upDays > 0 ? (
                <div style={{ width: pct(s.upDays) + '%', background: 'var(--pos)' }} title={`${s.upDays} up`} />
              ) : null}
              {flat > 0 ? (
                <div style={{ width: pct(flat) + '%', background: 'var(--border-strong)' }} title={`${flat} flat`} />
              ) : null}
              {s.downDays > 0 ? (
                <div style={{ width: pct(s.downDays) + '%', background: 'var(--neg)' }} title={`${s.downDays} down`} />
              ) : null}
            </div>
            <div className="pnl-bar-value mono" style={{ color: 'var(--text-dim)', fontSize: '12.5px' }}>
              <span style={{ color: 'var(--pos)' }}>{s.upDays}</span>
              {' / '}
              <span style={{ color: 'var(--neg)' }}>{s.downDays}</span>
              <span className="pnl-bar-pct">{s.sessions} sessions</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
