import type { ConfigsById, Histories, PortfolioId } from '../types';
import { PORTFOLIO_IDS } from '../lib/constants';
import { portfolioMetrics } from '../lib/compute';
import { fmtMoney, fmtPct, chipClass } from '../lib/format';
import AllocationBar from '../components/AllocationBar';
import DeskTotals from '../components/DeskTotals';

export default function OverviewPage({ configs, histories, goTo }: { configs: ConfigsById; histories: Histories; goTo: (page: PortfolioId) => void }) {
  return (
    <div>
      <h2 className="display">Overview</h2>
      <div className="desk-sub">All three books, one screen.</div>
      <div className="desk-grid3">
        {PORTFOLIO_IDS.map((id) => {
          const cfg = configs[id];
          const m = portfolioMetrics(histories[id] || []);
          return (
            <div className="desk-card clickable" key={id} onClick={() => goTo(id)}>
              <div className="desk-card-top">
                <div>
                  <div className="desk-card-name">{cfg.name}</div>
                  <div className="desk-card-strategy">{cfg.strategy}</div>
                </div>
                {m ? <span className={'desk-chip ' + chipClass(m.dayChangeDollar)}>{m.dayChangePct === null ? 'day 1' : fmtPct(m.dayChangePct)}</span> : null}
              </div>
              {m ? (
                <>
                  <div className="desk-card-value mono">{fmtMoney(m.displayValue)}</div>
                  {m.reported && m.reported.totalValue !== null ? (
                    <div className="desk-note" style={{ marginTop: '-2px' }}>reported as of {m.reported.totalValueAsOf || m.lastDate}</div>
                  ) : null}
                  <div className="desk-mini-row">
                    <span>Day change</span>
                    <span className="mono" style={{ color: (m.dayChangeDollar ?? 0) > 0 ? 'var(--pos)' : (m.dayChangeDollar ?? 0) < 0 ? 'var(--neg)' : 'var(--text-dim)' }}>
                      {m.dayChangeDollar === null ? '—' : fmtMoney(m.dayChangeDollar)}
                    </span>
                  </div>
                  <div className="desk-mini-row">
                    <span>Unrealized P&amp;L</span>
                    <span className="mono" style={{ color: m.totalPL >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtMoney(m.totalPL)}</span>
                  </div>
                  <AllocationBar positions={m.positions} reported={m.reported} />
                </>
              ) : (
                <div className="desk-note" style={{ marginTop: '12px' }}>No positions uploaded yet.</div>
              )}
            </div>
          );
        })}
      </div>
      <DeskTotals configs={configs} histories={histories} />
    </div>
  );
}
