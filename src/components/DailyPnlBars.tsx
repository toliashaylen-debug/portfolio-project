import { fmtMoney, fmtPct } from '../lib/format';

export interface PnlBarRow {
  name: string;
  pnl: number | null;
  returnPct: number | null;
  date: string | null;
  missing?: string | null;
}

/**
 * Today's P&L across the three books, as diverging bars from a shared zero
 * line — the comparison reads at a glance without needing the numbers narrated.
 */
export default function DailyPnlBars({ rows }: { rows: PnlBarRow[] }) {
  const withData = rows.filter((r) => r.pnl !== null);
  const max = Math.max(1, ...withData.map((r) => Math.abs(r.pnl as number)));

  return (
    <div className="pnl-bars">
      {rows.map((r) => {
        if (r.pnl === null) {
          return (
            <div className="pnl-bar-row" key={r.name}>
              <div className="pnl-bar-name">{r.name}</div>
              <div className="pnl-bar-track">
                <div className="pnl-bar-zero" />
              </div>
              <div className="pnl-bar-value muted">{r.missing || 'No data'}</div>
            </div>
          );
        }
        const v = r.pnl;
        const pct = (Math.abs(v) / max) * 50; // half-width each side of centre
        const up = v >= 0;
        return (
          <div className="pnl-bar-row" key={r.name}>
            <div className="pnl-bar-name">{r.name}</div>
            <div className="pnl-bar-track">
              <div className="pnl-bar-zero" />
              <div
                className={'pnl-bar-fill ' + (up ? 'up' : 'down')}
                style={up ? { left: '50%', width: pct + '%' } : { right: '50%', width: pct + '%' }}
              />
            </div>
            <div className={'pnl-bar-value mono ' + (up ? 'up' : 'down')}>
              {(up ? '+' : '') + fmtMoney(v)}
              {r.returnPct !== null ? <span className="pnl-bar-pct">{fmtPct(r.returnPct)}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
