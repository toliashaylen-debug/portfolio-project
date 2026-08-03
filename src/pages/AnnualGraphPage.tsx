import { useEffect, useMemo, useState } from 'react';
import type { PortfolioConfig, History, PortfolioId, PriceStats } from '../types';
import { runMonteCarlo } from '../lib/montecarlo';
import { loadPriceStats, PRICE_STATS_KEY } from '../lib/priceStats';
import { onKeyChange } from '../lib/storage';
import { fmtMoney, fmtPct } from '../lib/format';
import RiskBadge from '../components/RiskBadge';
import FanChart from '../components/FanChart';
import DescriptionWidget from '../components/DescriptionWidget';

export default function AnnualGraphPage({ cfg, history }: { id: PortfolioId; cfg: PortfolioConfig; history: History }) {
  const positions = history.length ? history[history.length - 1].positions : [];
  const asOfDate = history.length ? history[history.length - 1].date : null;

  const [stats, setStats] = useState<PriceStats | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPriceStats().then((s) => {
      if (cancelled) return;
      setStats(s);
      setStatsLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Live sync: a fresh price pull should refresh the projection everywhere.
  useEffect(() => {
    return onKeyChange(PRICE_STATS_KEY, (value) => {
      if (!value) { setStats(null); return; }
      try { setStats(JSON.parse(value) as PriceStats); } catch { /* keep previous */ }
    });
  }, []);

  // Re-running 2,000 paths on every unrelated re-render would be wasteful, and
  // would also make the chart jitter as the RNG redraws.
  const sim = useMemo(
    () => (statsLoaded ? runMonteCarlo(positions, 2000, 12, asOfDate, stats) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, asOfDate, stats, statsLoaded]
  );

  if (statsLoaded && !sim && positions.length) {
    return (
      <div>
        <h2 className="display">{cfg.name} — Annual Graph Prediction</h2>
        <div className="desk-note">Could not run a simulation from these positions — check that every row has a valid share count and price.</div>
      </div>
    );
  }

  if (!statsLoaded) {
    return (
      <div>
        <h2 className="display">{cfg.name} — Annual Graph Prediction</h2>
        <div className="desk-note"><span className="desk-spin" />Running simulation…</div>
      </div>
    );
  }

  if (!sim) {
    return (
      <div>
        <h2 className="display">{cfg.name} — Annual Graph Prediction</h2>
        <div className="desk-note">Not enough position data yet to run a simulation — upload a snapshot with valid share counts and prices for this portfolio first.</div>
      </div>
    );
  }

  const final = sim.summary[sim.numMonths];
  const finalMedianPct = (final.median - sim.totalValue) / sim.totalValue;
  const cov = sim.coverage;
  const anyHistorical = cov.historical.length > 0;

  return (
    <div>
      <h2 className="display">{cfg.name} — Annual Graph Prediction</h2>
      <div className="desk-sub">
        Monte Carlo simulation — {sim.numSims.toLocaleString()} simulated 12-month paths.{' '}
        {anyHistorical
          ? `Volatility and correlation measured from historical closing prices${cov.statsWindow ? ` (${cov.statsWindow})` : ''}; expected returns remain stated forward-looking assumptions. Not a forecast.`
          : 'Using stated asset-class return/volatility/correlation assumptions, not a forecast.'}
      </div>

      <div className="desk-panel">
        <h3>Simulation inputs</h3>
        {anyHistorical ? (
          <>
            <div className="desk-row" style={{ gap: 'var(--sp-6)' }}>
              <div>
                <div className="desk-note">Holdings with measured volatility</div>
                <div className="mono" style={{ fontSize: '18px', fontWeight: 600 }}>
                  {cov.historical.length} / {cov.historical.length + cov.assumed.length}
                </div>
              </div>
              <div>
                <div className="desk-note">Portfolio value covered</div>
                <div className="mono" style={{ fontSize: '18px', fontWeight: 600, color: cov.historicalWeight >= 0.8 ? 'var(--pos)' : cov.historicalWeight >= 0.5 ? 'var(--accent)' : 'var(--neg)' }}>
                  {(cov.historicalWeight * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="desk-note">Correlation pairs measured</div>
                <div className="mono" style={{ fontSize: '18px', fontWeight: 600 }}>
                  {cov.corrPairsHistorical} / {cov.corrPairsTotal}
                </div>
              </div>
            </div>
            {cov.assumed.length > 0 ? (
              <div className="desk-note" style={{ marginTop: 'var(--sp-3)' }}>
                Still on stated assumptions (no price history available): {cov.assumed.join(', ')}.
              </div>
            ) : null}
            <div className="desk-note" style={{ marginTop: 'var(--sp-2)' }}>
              Price data as of {cov.statsAsOf || 'unknown'}. Expected returns are deliberately <em>not</em> taken from trailing
              performance — realised past return is a poor estimator of future return, so only volatility and correlation are measured.
            </div>
          </>
        ) : (
          <div className="desk-note" style={{ marginTop: 0 }}>
            No historical price data loaded yet, so this simulation uses stated asset-class assumptions for every holding.
            Run <span className="mono">scripts/generate-bloomberg-request.mjs</span>, pull the closes on a Bloomberg Terminal, then
            run <span className="mono">scripts/import-price-history.mjs</span> to replace them with measured volatility and correlation.
          </div>
        )}
      </div>

      <div className="desk-panel">
        <div style={{ display: 'inline-block', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '4px', marginBottom: 'var(--sp-3)', letterSpacing: '0.02em' }}>
          MONTE CARLO SIMULATION
        </div>
        <h3>Projected value range over the next year</h3>
        <FanChart sim={sim} />
        <div className="desk-row" style={{ marginTop: 'var(--sp-3)', gap: 'var(--sp-5)', fontSize: '11.5px', color: 'var(--text-dim)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(20,75,135,0.20)', display: 'inline-block' }} />
            50% of outcomes
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(20,75,135,0.10)', display: 'inline-block' }} />
            90% of outcomes
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '2px', background: '#144B87', display: 'inline-block' }} />
            Median path
          </span>
        </div>
      </div>

      <div className="desk-grid3" style={{ marginBottom: 'var(--sp-5)' }}>
        <RiskBadge label="Median outcome (12mo)" valueLabel={fmtMoney(final.median)} level="low" sub={fmtPct(finalMedianPct) + ' vs. today'} />
        <RiskBadge label="95% Value at Risk" valueLabel={fmtMoney(sim.var95Loss)} level="moderate" sub="potential loss — 5% chance of doing worse" />
        <RiskBadge label="95% CVaR (expected shortfall)" valueLabel={fmtMoney(sim.cvar95Loss)} level="high" sub="average loss in that worst 5% of outcomes" />
      </div>

      <DescriptionWidget
        assumptionsNote={
          anyHistorical
            ? `Volatility and correlation measured from daily closing prices${cov.statsWindow ? ` over ${cov.statsWindow}` : ''} for ${cov.historical.length} of ${cov.historical.length + cov.assumed.length} holdings (${(cov.historicalWeight * 100).toFixed(0)}% of value); the remainder use stated assumptions. Expected returns are stated forward-looking figures in all cases: equity ETFs ~9%, individual equities ~10%, fixed income ~4.5% annualized.`
            : undefined
        }
        placeholderNote={
          anyHistorical
            ? "This simulation uses measured historical volatility and correlation with stated forward-looking expected returns — it's a modeled range of outcomes, not a prediction. Click to generate a plain-language description."
            : undefined
        }
        generatePrompt={() => {
          const finalMedianReturn = (sim.summary[sim.numMonths].median - sim.totalValue) / sim.totalValue;
          const inputsSentence = anyHistorical
            ? `Volatility and the correlation matrix were measured from actual daily closing prices${cov.statsWindow ? ` over the window ${cov.statsWindow}` : ''}, covering ${cov.historical.length} of ${cov.historical.length + cov.assumed.length} holdings (${(cov.historicalWeight * 100).toFixed(0)}% of portfolio value) and ${cov.corrPairsHistorical} of ${cov.corrPairsTotal} correlation pairs; holdings without available price history fall back to stated asset-class assumptions. Expected returns are deliberately NOT taken from trailing realised performance — they remain stated forward-looking assumptions, because past realised return is a poor estimator of future return.`
            : `The simulation uses stated long-run capital-market assumptions by asset class (not this portfolio's own fitted history, since that data isn't available), and a correlation structure based on sector/sleeve groupings.`;
          return `A Monte Carlo simulation (${sim.numSims} simulated paths, ${sim.numMonths} months, correlated monthly returns per holding via Cholesky decomposition) was run on a portfolio currently worth ${fmtMoney(sim.totalValue)}. Results at the 12-month horizon: median outcome ${fmtMoney(sim.summary[sim.numMonths].median)} (${(finalMedianReturn * 100).toFixed(1)}%), 90% confidence range ${fmtMoney(sim.summary[sim.numMonths].p5)} to ${fmtMoney(sim.summary[sim.numMonths].p95)}, 95% Value-at-Risk (potential loss) of ${fmtMoney(sim.var95Loss)}, 95% Conditional VaR / expected shortfall in the worst 5% of outcomes of ${fmtMoney(sim.cvar95Loss)}. ${inputsSentence} In 3-4 sentences, describe what the fan chart shows, what the VaR/CVaR figures mean in plain terms, and note clearly that this reflects modeling assumptions, not a forecast of what will actually happen. Do not invent any figures beyond what's given here. Write as flowing prose — no bullet points, no lists, no headers. Respond with only those sentences.`;
        }}
      />
    </div>
  );
}
