import type { OpenPosition, ClosedPosition } from '../types';
import { fmtMoney } from '../lib/format';
import SleeveChip from './SleeveChip';

export default function TradeHistoryPanel({ open, closed, sellDateCaveat }: { open: OpenPosition[]; closed: ClosedPosition[]; sellDateCaveat?: string }) {
  return (
    <div>
      <div className="desk-panel">
        <h3>Currently held <span className="unit">({open.length})</span></h3>
        {open.length === 0 ? (
          <div className="desk-note" style={{ marginTop: 0 }}>No open lots read from the trade log.</div>
        ) : (
          <div className="desk-table-wrap">
            <table className="desk-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Ticker</th>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'left' }}>Sleeve</th>
                  <th style={{ textAlign: 'left' }}>Bought</th>
                  <th>Shares</th>
                  <th>Buy price</th>
                </tr>
              </thead>
              <tbody>
                {open.map((p, i) => (
                  <tr key={p.ticker + p.buyDate + i}>
                    <td className="ticker" style={{ textAlign: 'left' }}>{p.ticker}</td>
                    <td className="muted" style={{ textAlign: 'left' }}>{p.name || '—'}</td>
                    <td style={{ textAlign: 'left' }}><SleeveChip sleeve={p.sleeve} /></td>
                    <td className="mono" style={{ textAlign: 'left' }}>{p.buyDate || '—'}</td>
                    <td>{p.shares.toLocaleString()}</td>
                    <td>{fmtMoney(p.buyPrice, { decimals: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="desk-panel">
        <h3>Sold <span className="unit">({closed.length})</span></h3>
        {sellDateCaveat && closed.length > 0 ? <div className="desk-note" style={{ marginTop: 0, marginBottom: 'var(--sp-3)' }}>{sellDateCaveat}</div> : null}
        {closed.length === 0 ? (
          <div className="desk-note" style={{ marginTop: 0 }}>No closed lots read from the trade log.</div>
        ) : (
          <div className="desk-table-wrap">
            <table className="desk-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Ticker</th>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'left' }}>Sleeve</th>
                  <th style={{ textAlign: 'left' }}>Bought</th>
                  <th style={{ textAlign: 'left' }}>Sold</th>
                  <th>Shares</th>
                  <th>Buy price</th>
                  <th>Sell price</th>
                  <th>Realized P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((p, i) => (
                  <tr key={p.ticker + p.sellDate + i}>
                    <td className="ticker" style={{ textAlign: 'left' }}>{p.ticker}</td>
                    <td className="muted" style={{ textAlign: 'left' }}>{p.name || '—'}</td>
                    <td style={{ textAlign: 'left' }}><SleeveChip sleeve={p.sleeve} /></td>
                    <td className="mono" style={{ textAlign: 'left' }}>{p.buyDate || 'unknown'}</td>
                    <td className="mono" style={{ textAlign: 'left' }}>{p.sellDate}</td>
                    <td>{p.shares.toLocaleString()}</td>
                    <td>{fmtMoney(p.buyPrice, { decimals: 2 })}</td>
                    <td>{fmtMoney(p.sellPrice, { decimals: 2 })}</td>
                    <td style={{ color: p.realizedPL === null ? 'var(--text-dim)' : p.realizedPL >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                      {p.realizedPL === null ? '—' : fmtMoney(p.realizedPL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
