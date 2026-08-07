import { useEffect, useState } from 'react';
import type { ConfigsById, Histories, PortfolioId, RealizedPLResult, PriceStats } from '../types';
import { PORTFOLIO_IDS, PORTFOLIO_INCEPTION, PORTFOLIO_STARTING_BALANCE } from '../lib/constants';
import { portfolioMetrics } from '../lib/compute';
import { fmtMoney, fmtPct, chipClass } from '../lib/format';
import { loadRealizedPL, realizedPLKey } from '../lib/realizedPL';
import { loadPriceStats, PRICE_STATS_KEY } from '../lib/priceStats';
import { estimateSharpe } from '../lib/montecarlo';
import { onKeyChange } from '../lib/storage';
import AllocationBar from '../components/AllocationBar';
import DeskTotals from '../components/DeskTotals';

export default function OverviewPage({ configs, histories, goTo }: { configs: ConfigsById; histories: Histories; goTo: (page: PortfolioId) => void }) {
  const [realizedPLs, setRealizedPLs] = useState<Partial<Record<PortfolioId, RealizedPLResult | null>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded: Partial<Record<PortfolioId, RealizedPLResult | null>> = {};
      for (const id of PORTFOLIO_IDS) loaded[id] = await loadRealizedPL(id);
      if (!cancelled) setRealizedPLs(loaded);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsubs = PORTFOLIO_IDS.map((id) =>
      onKeyChange(realizedPLKey(id), (v) => setRealizedPLs((prev) => ({ ...prev, [id]: v ? JSON.parse(v) : null })))
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  // Every book's Sharpe ratio is computed the same way — the account's own
  // since-inception return over volatility measured the same way as the
  // Monte Carlo sim — so all three are on equal, comparable footing rather
  // than mixing a sheet-stated figure for one book with a computed one for
  // the others.
  const [priceStats, setPriceStats] = useState<PriceStats | null>(null);
  const [priceStatsLoaded, setPriceStatsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPriceStats().then((s) => { if (!cancelled) { setPriceStats(s); setPriceStatsLoaded(true); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return onKeyChange(PRICE_STATS_KEY, (v) => { try { setPriceStats(v ? JSON.parse(v) : null); } catch { /* keep previous */ } });
  }, []);

  // Only add up what's actually been read for every book — a partial desk
  // total that silently omits an un-read book would understate realized P&L
  // without saying so.
  const allRealizedPLsRead = PORTFOLIO_IDS.every((id) => realizedPLs[id]);
  const deskRealizedPL = allRealizedPLsRead
    ? PORTFOLIO_IDS.reduce((s, id) => s + realizedPLs[id]!.total, 0)
    : null;

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
                  <div className="desk-mini-row">
                    <span>Realized P&amp;L</span>
                    {realizedPLs[id] ? (
                      <span className="mono" style={{ color: realizedPLs[id]!.total >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                        {fmtMoney(realizedPLs[id]!.total)}
                      </span>
                    ) : (
                      <span className="mono" style={{ color: 'var(--text-faint)' }}>not read yet</span>
                    )}
                  </div>
                  <div className="desk-mini-row">
                    <span>Sharpe ratio</span>
                    {(() => {
                      // Computed the same way for every book: since-inception return
                      // over volatility measured the same way as the Monte Carlo sim.
                      if (!priceStatsLoaded) return <span className="mono" style={{ color: 'var(--text-faint)' }}>loading…</span>;
                      const est = m ? estimateSharpe(m.positions, m.displayValue, PORTFOLIO_STARTING_BALANCE, PORTFOLIO_INCEPTION[id], priceStats) : null;
                      if (!est) return <span className="mono" style={{ color: 'var(--text-faint)' }}>too early to estimate</span>;
                      return (
                        <span
                          className="mono"
                          title={`${(est.annualizedReturn * 100).toFixed(1)}% annualized return since inception (${est.days}d) less a 4.5% assumed risk-free rate, over ${(est.annualizedVol * 100).toFixed(1)}% annualized volatility (${(est.historicalWeight * 100).toFixed(0)}% measured from real price history, rest assumed).`}
                        >
                          {est.sharpe.toFixed(2)}
                        </span>
                      );
                    })()}
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
      <DeskTotals configs={configs} histories={histories} realizedPL={deskRealizedPL} />
    </div>
  );
}
