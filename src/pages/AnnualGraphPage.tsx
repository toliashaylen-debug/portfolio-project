import type { PortfolioConfig, History, PortfolioId } from '../types';
import { runMonteCarlo } from '../lib/montecarlo';
import { fmtMoney, fmtPct } from '../lib/format';
import RiskBadge from '../components/RiskBadge';
import FanChart from '../components/FanChart';
import DescriptionWidget from '../components/DescriptionWidget';

export default function AnnualGraphPage({ cfg, history }: { id: PortfolioId; cfg: PortfolioConfig; history: History }) {
  const positions = history.length ? history[history.length - 1].positions : [];
  const asOfDate = history.length ? history[history.length - 1].date : null;
  const sim = runMonteCarlo(positions, 2000, 12, asOfDate);

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

  return (
    <div>
      <h2 className="display">{cfg.name} — Annual Graph Prediction</h2>
      <div className="desk-sub">Monte Carlo simulation — {sim.numSims.toLocaleString()} simulated 12-month paths, using stated asset-class return/volatility/correlation assumptions, not a forecast.</div>

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
        generatePrompt={() => {
          const finalMedianReturn = (sim.summary[sim.numMonths].median - sim.totalValue) / sim.totalValue;
          return `A Monte Carlo simulation (${sim.numSims} simulated paths, ${sim.numMonths} months, correlated monthly returns per holding via Cholesky decomposition) was run on a portfolio currently worth ${fmtMoney(sim.totalValue)}. Results at the 12-month horizon: median outcome ${fmtMoney(sim.summary[sim.numMonths].median)} (${(finalMedianReturn * 100).toFixed(1)}%), 90% confidence range ${fmtMoney(sim.summary[sim.numMonths].p5)} to ${fmtMoney(sim.summary[sim.numMonths].p95)}, 95% Value-at-Risk (potential loss) of ${fmtMoney(sim.var95Loss)}, 95% Conditional VaR / expected shortfall in the worst 5% of outcomes of ${fmtMoney(sim.cvar95Loss)}. The simulation uses stated long-run capital-market assumptions by asset class (not this portfolio's own fitted history, since that data isn't available), and a correlation structure based on sector/sleeve groupings. In 3-4 sentences, describe what the fan chart shows, what the VaR/CVaR figures mean in plain terms, and note clearly that this reflects modeling assumptions, not a forecast of what will actually happen. Do not invent any figures beyond what's given here. Write as flowing prose — no bullet points, no lists, no headers. Respond with only those sentences.`;
        }}
      />
    </div>
  );
}
