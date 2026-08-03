import { useState } from 'react';
import type { ConfigsById, Histories } from '../types';
import { PORTFOLIO_IDS } from '../lib/constants';
import { enrichPositions } from '../lib/compute';
import { fmtMoney, fmtPct } from '../lib/format';

export default function DeskViewPage({ configs, histories }: { configs: ConfigsById; histories: Histories }) {
  const [filterSector, setFilterSector] = useState('all');

  let all: (ReturnType<typeof enrichPositions>[number] & { portfolio: string })[] = [];
  PORTFOLIO_IDS.forEach((id) => {
    const hist = histories[id] || [];
    if (!hist.length) return;
    enrichPositions(hist).forEach((p) => all.push({ ...p, portfolio: configs[id].name }));
  });
  const sectors = Array.from(new Set(all.map((p) => p.sector).filter(Boolean)));
  if (filterSector !== 'all') all = all.filter((p) => p.sector === filterSector);
  all.sort((a, b) => b.value - a.value);

  return (
    <div>
      <h2 className="display">Desk view</h2>
      <div className="desk-sub">Every position, across all three books.</div>
      {sectors.length > 0 ? (
        <div className="desk-row" style={{ marginBottom: '14px' }}>
          <select className="desk-input" value={filterSector} onChange={(e) => setFilterSector(e.target.value)}>
            <option value="all">All sectors / asset classes</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      ) : null}
      {all.length === 0 ? (
        <div className="desk-note">No positions uploaded yet across any portfolio.</div>
      ) : (
        <div className="desk-panel">
        <div className="desk-table-wrap">
        <table className="desk-table">
          <thead>
            <tr>
              <th>Ticker</th><th>Book</th><th>Sector</th><th>Shares</th><th>Value</th><th>Day $</th><th>Day %</th><th>P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {all.map((p, i) => (
              <tr key={p.ticker + i}>
                <td className="ticker">{p.ticker}</td>
                <td style={{ textAlign: 'left', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--text-dim)' }}>{p.portfolio}</td>
                <td style={{ textAlign: 'left', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--text-dim)' }}>{p.sector || '—'}</td>
                <td>{p.shares.toLocaleString()}</td>
                <td>{fmtMoney(p.value)}</td>
                <td style={{ color: (p.dayChangeDollar ?? 0) > 0 ? 'var(--pos)' : (p.dayChangeDollar ?? 0) < 0 ? 'var(--neg)' : 'var(--text-dim)' }}>
                  {p.dayChangeDollar === null ? '—' : fmtMoney(p.dayChangeDollar)}
                </td>
                <td style={{ color: (p.dayChangePct ?? 0) > 0 ? 'var(--pos)' : (p.dayChangePct ?? 0) < 0 ? 'var(--neg)' : 'var(--text-dim)' }}>
                  {p.dayChangePct === null ? '—' : fmtPct(p.dayChangePct)}
                </td>
                <td style={{ color: p.unrealizedPL >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtMoney(p.unrealizedPL)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </div>
      )}
    </div>
  );
}
