import { useEffect, useMemo, useState } from 'react';
import type { ConfigsById, Histories, PortfolioId, RealizedPLResult, PriceStats, MonteCarloResult, BenchmarkComparison } from '../types';
import { PORTFOLIO_IDS, PORTFOLIO_INCEPTION, PORTFOLIO_STARTING_BALANCE } from '../lib/constants';
import { portfolioMetrics } from '../lib/compute';
import { fmtMoney, fmtPct } from '../lib/format';
import { loadRealizedPL, realizedPLKey } from '../lib/realizedPL';
import { loadBenchmarkComparison, benchmarkComparisonKey } from '../lib/benchmarkComparison';
import { loadPriceStats, PRICE_STATS_KEY } from '../lib/priceStats';
import { estimateSleeveSharpe, runMonteCarlo, type SleeveSharpeResult } from '../lib/montecarlo';
import { onKeyChange } from '../lib/storage';
import AllocationBar from '../components/AllocationBar';
import DeskTotals from '../components/DeskTotals';
import MultiFanChart from '../components/MultiFanChart';

function SleeveSharpeCell({ result, loading }: { result: SleeveSharpeResult | null; loading: boolean }) {
  if (loading) return <span className="mono" style={{ color: 'var(--text-faint)' }}>loading…</span>;
  if (!result || result.sharpe === null) return <span className="mono" style={{ color: 'var(--text-faint)' }}>—</span>;
  const tooltip = `${(result.annualizedReturn! * 100).toFixed(1)}% annualized return since inception (${result.days}d) less a 4.5% assumed risk-free rate, over ${(result.volatility! * 100).toFixed(1)}% annualized volatility.`
    + (result.lowConfidence ? ' Early estimate — under 6 months of live history, can swing a lot as more comes in.' : '');
  return (
    <span className="mono" title={tooltip}>
      {result.sharpe.toFixed(2)}
      {result.lowConfidence ? <span style={{ color: 'var(--text-faint)', fontSize: '10px', marginLeft: '5px' }}>early est.</span> : null}
    </span>
  );
}

function SleeveVolCell({ result, loading }: { result: SleeveSharpeResult | null; loading: boolean }) {
  if (loading) return <span className="mono" style={{ color: 'var(--text-faint)' }}>loading…</span>;
  if (!result || result.volatility === null) return <span className="mono" style={{ color: 'var(--text-faint)' }}>—</span>;
  return <span className="mono">{(result.volatility * 100).toFixed(1)}%</span>;
}

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

  // Backs the equity/fixed-income Sharpe and volatility split below — each
  // sleeve's return comes from that book's own sheet-reported benchmark
  // comparison (when generated), volatility from the same measured inputs
  // as the Monte Carlo sim.
  const [benchmarkComparisons, setBenchmarkComparisons] = useState<Partial<Record<PortfolioId, BenchmarkComparison | null>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded: Partial<Record<PortfolioId, BenchmarkComparison | null>> = {};
      for (const id of PORTFOLIO_IDS) loaded[id] = await loadBenchmarkComparison(id);
      if (!cancelled) setBenchmarkComparisons(loaded);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsubs = PORTFOLIO_IDS.map((id) =>
      onKeyChange(benchmarkComparisonKey(id), (v) => setBenchmarkComparisons((prev) => ({ ...prev, [id]: v ? JSON.parse(v) : null })))
    );
    return () => unsubs.forEach((u) => u());
  }, []);

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

  // One combined 12-month projection per book, overlaid on a single chart
  // instead of three separate ones — same sim engine and inputs as each
  // book's own Annual Graph page.
  const sims = useMemo(() => {
    if (!priceStatsLoaded) return null;
    return PORTFOLIO_IDS.map((id) => {
      const hist = histories[id] || [];
      const positions = hist.length ? hist[hist.length - 1].positions : [];
      const asOfDate = hist.length ? hist[hist.length - 1].date : null;
      const sim = runMonteCarlo(positions, 2000, 12, asOfDate, priceStats);
      return sim ? { id, label: configs[id].name, sim } : null;
    }).filter((s): s is { id: PortfolioId; label: string; sim: MonteCarloResult } => s !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histories, priceStats, priceStatsLoaded, configs]);

  return (
    <div>
      <h2 className="display">Overview</h2>
      <div className="desk-sub">All three books, one screen.</div>
      <div className="desk-grid3">
        {PORTFOLIO_IDS.map((id) => {
          const cfg = configs[id];
          const m = portfolioMetrics(histories[id] || []);
          const cumPct = m ? (m.displayValue - PORTFOLIO_STARTING_BALANCE) / PORTFOLIO_STARTING_BALANCE : null;
          const bc = benchmarkComparisons[id];
          const eqReturnPct = bc?.found ? bc.equity.portfolioReturnPct : null;
          const fiReturnPct = bc?.found ? bc.fixedIncome.portfolioReturnPct : null;
          const eqResult = m && priceStatsLoaded ? estimateSleeveSharpe(m.positions, 'equity', eqReturnPct, PORTFOLIO_INCEPTION[id], priceStats) : null;
          const fiResult = m && priceStatsLoaded ? estimateSleeveSharpe(m.positions, 'fixedIncome', fiReturnPct, PORTFOLIO_INCEPTION[id], priceStats) : null;
          return (
            <div className="desk-card clickable" key={id} onClick={() => goTo(id)}>
              <div className="desk-card-top">
                <div>
                  <div className="desk-card-name">{cfg.name}</div>
                  <div className="desk-card-strategy">{cfg.strategy}</div>
                </div>
              </div>
              {m ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--sp-3)', gap: 'var(--sp-3)' }}>
                    <div className="mono" style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.015em', color: '#FFFFFF' }}>{fmtMoney(m.displayValue)}</div>
                    <div className="mono" style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: (cumPct ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                      {fmtPct(cumPct)}
                    </div>
                  </div>
                  {m.reported && m.reported.totalValue !== null ? (
                    <div className="desk-note" style={{ marginTop: '-2px' }}>reported as of {m.reported.totalValueAsOf || m.lastDate}</div>
                  ) : null}
                  <div className="desk-mini-row">
                    <span>Equity Sharpe</span>
                    <SleeveSharpeCell result={eqResult} loading={!priceStatsLoaded} />
                  </div>
                  <div className="desk-mini-row">
                    <span>Equity volatility</span>
                    <SleeveVolCell result={eqResult} loading={!priceStatsLoaded} />
                  </div>
                  <div className="desk-mini-row">
                    <span>Fixed income Sharpe</span>
                    <SleeveSharpeCell result={fiResult} loading={!priceStatsLoaded} />
                  </div>
                  <div className="desk-mini-row">
                    <span>Fixed income volatility</span>
                    <SleeveVolCell result={fiResult} loading={!priceStatsLoaded} />
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

      <div className="desk-panel">
        <div style={{ display: 'inline-block', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '4px', marginBottom: 'var(--sp-3)', letterSpacing: '0.02em' }}>
          MONTE CARLO SIMULATION
        </div>
        <h3>Annual Graph — all three books</h3>
        {!priceStatsLoaded ? (
          <div className="desk-note"><span className="desk-spin" />Running simulations…</div>
        ) : !sims || !sims.length ? (
          <div className="desk-note">Not enough position data yet to run a simulation for any book.</div>
        ) : (
          <>
            <div className="desk-sub" style={{ marginTop: 0 }}>
              Median 12-month projected path for each book, same {sims[0].sim.numSims.toLocaleString()}-simulation Monte Carlo engine as each book's own Annual Graph page. Not a forecast.
            </div>
            <MultiFanChart series={sims.map((s) => ({ label: s.label, sim: s.sim }))} />
            <div className="desk-grid3" style={{ marginTop: 'var(--sp-4)' }}>
              {sims.map((s) => {
                const final = s.sim.summary[s.sim.numMonths];
                const pct = (final.median - s.sim.totalValue) / s.sim.totalValue;
                return (
                  <div className="desk-card" key={s.id}>
                    <div className="desk-card-name">{s.label}</div>
                    <div className="mono" style={{ fontSize: '18px', fontWeight: 600, marginTop: '7px', color: pct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                      {fmtMoney(final.median)} <span style={{ fontSize: '13px' }}>({fmtPct(pct)})</span>
                    </div>
                    <div className="desk-note" style={{ marginTop: '3px' }}>projected median (12mo) vs. today</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
