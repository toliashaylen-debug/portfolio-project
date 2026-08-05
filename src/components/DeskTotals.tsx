import type { ConfigsById, Histories } from '../types';
import { PORTFOLIO_IDS } from '../lib/constants';
import { portfolioMetrics } from '../lib/compute';
import { fmtMoney } from '../lib/format';

export default function DeskTotals({ histories, realizedPL }: { configs: ConfigsById; histories: Histories; realizedPL?: number | null }) {
  const withData = PORTFOLIO_IDS.map((id) => portfolioMetrics(histories[id] || [])).filter((m) => m !== null);
  if (!withData.length) return <div />;
  const totalValue = withData.reduce((s, m) => s + m.displayValue, 0);
  const totalDay = withData.reduce((s, m) => s + (m.dayChangeDollar || 0), 0);
  const totalPL = withData.reduce((s, m) => s + m.totalPL, 0);
  return (
    <div className="desk-panel">
      <h3>Desk total</h3>
      <div className="desk-row" style={{ gap: '28px' }}>
        <div>
          <div className="desk-note">Value</div>
          <div className="mono" style={{ fontSize: '18px', fontWeight: 600 }}>{fmtMoney(totalValue)}</div>
        </div>
        <div>
          <div className="desk-note">Day change</div>
          <div className="mono" style={{ fontSize: '18px', fontWeight: 600, color: totalDay > 0 ? 'var(--pos)' : totalDay < 0 ? 'var(--neg)' : 'var(--text-dim)' }}>{fmtMoney(totalDay)}</div>
        </div>
        <div>
          <div className="desk-note">Unrealized P&amp;L</div>
          <div className="mono" style={{ fontSize: '18px', fontWeight: 600, color: totalPL >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtMoney(totalPL)}</div>
        </div>
        <div>
          <div className="desk-note">Realized P&amp;L</div>
          {realizedPL === null || realizedPL === undefined ? (
            <div className="mono" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-faint)' }}>—</div>
          ) : (
            <div className="mono" style={{ fontSize: '18px', fontWeight: 600, color: realizedPL >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtMoney(realizedPL)}</div>
          )}
        </div>
      </div>
      {realizedPL === null || realizedPL === undefined ? (
        <div className="desk-note" style={{ marginTop: 'var(--sp-3)' }}>Realized P&amp;L needs trade history read for all three books — visit each portfolio's page and press "Read trade history."</div>
      ) : null}
    </div>
  );
}
