import type { ConfigsById, Histories, EnrichedPosition, PortfolioId } from '../types';
import { PORTFOLIO_IDS } from '../lib/constants';
import { enrichPositions } from '../lib/compute';
import { fmtMoney } from '../lib/format';
import SleeveChip from '../components/SleeveChip';

interface Entry extends EnrichedPosition {
  portfolioId: PortfolioId;
  portfolioName: string;
}

export default function CommonPositionsPage({ configs, histories }: { configs: ConfigsById; histories: Histories }) {
  const byTicker: Record<string, Entry[]> = {};
  PORTFOLIO_IDS.forEach((id) => {
    const hist = histories[id] || [];
    if (!hist.length) return;
    enrichPositions(hist).forEach((p) => {
      if (!byTicker[p.ticker]) byTicker[p.ticker] = [];
      byTicker[p.ticker].push({ portfolioId: id, portfolioName: configs[id].name, ...p });
    });
  });
  const common = Object.keys(byTicker)
    .filter((t) => new Set(byTicker[t].map((e) => e.portfolioId)).size > 1)
    .map((t) => ({ ticker: t, entries: byTicker[t] }))
    .sort((a, b) => b.entries.reduce((s, e) => s + e.value, 0) - a.entries.reduce((s, e) => s + e.value, 0));

  return (
    <div>
      <h2 className="display">Common positions</h2>
      <div className="desk-sub">Tickers held in more than one portfolio, each read from that portfolio's own source page.</div>
      {common.length === 0 ? (
        <div className="desk-note">No overlapping positions across portfolios yet.</div>
      ) : (
        common.map((c) => (
          <div className="desk-panel" key={c.ticker}>
            <h3>
              {c.ticker}
              {c.entries[0].name ? <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> · {c.entries[0].name}</span> : null}
            </h3>
            <table className="desk-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Portfolio</th>
                  <th style={{ textAlign: 'left' }}>Sleeve</th>
                  <th>Shares</th>
                  <th>Price</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {c.entries.map((e, i) => (
                  <tr key={e.portfolioId + i}>
                    <td style={{ textAlign: 'left' }}>{e.portfolioName}</td>
                    <td style={{ textAlign: 'left' }}><SleeveChip sleeve={e.sleeve} /></td>
                    <td>{e.shares.toLocaleString()}</td>
                    <td>{fmtMoney(e.price, { decimals: 2 })}</td>
                    <td>{fmtMoney(e.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="desk-mini-row" style={{ marginTop: '8px' }}>
              <span>Combined value across portfolios</span>
              <span className="mono">{fmtMoney(c.entries.reduce((s, e) => s + e.value, 0))}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
