import type { EnrichedPosition } from '../types';
import { flagPosition } from '../lib/compute';
import { fmtMoney, fmtPct } from '../lib/format';
import SleeveChip from './SleeveChip';

export default function PositionsTable({ positions }: { positions: EnrichedPosition[] }) {
  const sorted = [...positions].sort((a, b) => b.value - a.value);
  return (
    <div className="desk-table-wrap">
    <table className="desk-table">
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Ticker</th>
          <th style={{ textAlign: 'left' }}>Name</th>
          <th style={{ textAlign: 'left' }}>Sleeve</th>
          <th style={{ textAlign: 'left' }}>Sector</th>
          <th>Shares</th>
          <th>Price</th>
          <th>Cost Basis</th>
          <th>Value</th>
          <th>Day $</th>
          <th>Day %</th>
          <th>Unrealized P&amp;L</th>
          <th style={{ textAlign: 'left' }}>Source</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((p, i) => {
          const flag = flagPosition(p);
          return (
            <tr key={p.ticker + i}>
              <td className="ticker" style={{ textAlign: 'left' }}>
                {p.ticker}
                {flag ? <span title={flag} style={{ marginLeft: '5px', color: 'var(--neg)' }}>⚠</span> : null}
                {p.isNew ? <span className="desk-tag" style={{ marginLeft: '6px' }}>new</span> : null}
              </td>
              <td className="muted" style={{ textAlign: 'left' }}>{p.name || '—'}</td>
              <td style={{ textAlign: 'left' }}><SleeveChip sleeve={p.sleeve} /></td>
              <td className="muted" style={{ textAlign: 'left' }}>{p.sector || '—'}</td>
              <td>{p.shares.toLocaleString()}</td>
              <td>{fmtMoney(p.price, { decimals: 2 })}</td>
              <td>{fmtMoney(p.costBasis, { decimals: 2 })}</td>
              <td>{fmtMoney(p.value)}</td>
              <td style={{ color: (p.dayChangeDollar ?? 0) > 0 ? 'var(--pos)' : (p.dayChangeDollar ?? 0) < 0 ? 'var(--neg)' : 'var(--text-dim)' }}>
                {p.dayChangeDollar === null ? '—' : fmtMoney(p.dayChangeDollar)}
              </td>
              <td style={{ color: (p.dayChangePct ?? 0) > 0 ? 'var(--pos)' : (p.dayChangePct ?? 0) < 0 ? 'var(--neg)' : 'var(--text-dim)' }}>
                {p.dayChangePct === null ? '—' : fmtPct(p.dayChangePct)}
              </td>
              <td style={{ color: p.unrealizedPL >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtMoney(p.unrealizedPL)}</td>
              <td style={{ textAlign: 'left', color: 'var(--text-faint)', fontFamily: 'Inter, sans-serif', fontSize: '11px' }}>{p.sourceSheet || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
