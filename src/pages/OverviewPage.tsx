import { useEffect, useState } from 'react';
import type { ConfigsById, Histories, PortfolioId, RealizedPLResult, BenchmarkComparison } from '../types';
import { PORTFOLIO_IDS } from '../lib/constants';
import { portfolioMetrics } from '../lib/compute';
import { fmtMoney, fmtPct, chipClass } from '../lib/format';
import { loadRealizedPL, realizedPLKey } from '../lib/realizedPL';
import { loadBenchmarkComparison, benchmarkComparisonKey } from '../lib/benchmarkComparison';
import { onKeyChange } from '../lib/storage';
import AllocationBar from '../components/AllocationBar';
import DeskTotals from '../components/DeskTotals';

function fmtSharpe(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : v.toFixed(2);
}

export default function OverviewPage({ configs, histories, goTo }: { configs: ConfigsById; histories: Histories; goTo: (page: PortfolioId) => void }) {
  const [realizedPLs, setRealizedPLs] = useState<Partial<Record<PortfolioId, RealizedPLResult | null>>>({});
  const [benchmarkComparisons, setBenchmarkComparisons] = useState<Partial<Record<PortfolioId, BenchmarkComparison | null>>>({});

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
                    <span>Sharpe (Eq / FI)</span>
                    {(() => {
                      const bc = benchmarkComparisons[id];
                      if (!bc) return <span className="mono" style={{ color: 'var(--text-faint)' }}>not generated yet</span>;
                      if (!bc.found) return <span className="mono" style={{ color: 'var(--text-faint)' }}>no data found</span>;
                      const eq = bc.equity.portfolioSharpe;
                      const fi = bc.fixedIncome.portfolioSharpe;
                      if (eq === null && fi === null) return <span className="mono" style={{ color: 'var(--text-faint)' }}>not stated in sheet</span>;
                      return <span className="mono">{fmtSharpe(eq)} / {fmtSharpe(fi)}</span>;
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
