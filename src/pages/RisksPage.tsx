import { useState } from 'react';
import type { ConfigsById, Histories, Position, PortfolioConfig, PortfolioId } from '../types';
import { PORTFOLIO_IDS, PORTFOLIO_SOURCING } from '../lib/constants';
import { computeBreakdown } from '../lib/compute';
import { cleanProse } from '../lib/format';
import { callClaude } from '../lib/ai';

function PortfolioRiskCard({ id, cfg, positions }: { id: PortfolioId; cfg: PortfolioConfig; positions: Position[] }) {
  const [risk, setRisk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setBusy(true); setError('');
    try {
      const sourcing = PORTFOLIO_SOURCING[id];
      const weightMode = sourcing ? sourcing.weightMode : 'value';
      const b = computeBreakdown(positions, weightMode);
      if (!b) throw new Error('Not enough position data to analyze.');
      const sleeveText = b.sleeveSegments.map((s) => s.label + ' ' + s.pct.toFixed(1) + '%').join(', ');
      const sectorText = b.sectorWeights.slice(0, 8).map((s) => s.label + ' ' + s.pct.toFixed(1) + '%').join(', ');
      const topText = b.topPositions.slice(0, 6).map((p) => p.ticker + (p.name ? ' (' + p.name + ')' : '') + ' ' + p.pct.toFixed(1) + '%').join(', ');
      const durationText = b.risk.weightedDuration !== null ? (b.risk.weightedDuration.toFixed(2) + ' years weighted average duration on the fixed income sleeve') : 'no duration data available for the fixed income sleeve';
      const prompt = `Describe the possible risks this investment portfolio faces, based only on the following data — do not invent anything beyond it:\nStrategy: ${cfg.strategy}.\nAllocation: ${sleeveText}.\nSector weights (equity sleeve): ${sectorText}.\nLargest positions: ${topText}.\nLargest single position: ${b.risk.top1Pct.toFixed(1)}% of the portfolio. Top 3 positions: ${b.risk.top3Pct.toFixed(1)}%. Largest sector: ${b.sectorWeights[0] ? b.sectorWeights[0].label + ' at ' + b.risk.maxSectorPct.toFixed(1) + '%' : 'n/a'}.\n${durationText}.\n\nIn 4-6 sentences, describe the specific risks this composition entails — concentration risk, sector/thematic tilt, interest-rate sensitivity, correlation between holdings, or anything else relevant given the actual holdings above. This is a factual description of risk exposure, not advice on what to do about it. Reference actual tickers or sectors where relevant. Write as flowing prose — no bullet points, no lists, no headers, no line breaks. Respond with only those sentences.`;
      const text = await callClaude(prompt, 550);
      setRisk(cleanProse(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the risk analysis.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="desk-panel">
      <div className="desk-panel-head" style={{ marginBottom: (!positions.length && !error && !risk) ? '0' : 'var(--sp-4)' }}>
        <h3>{cfg.name}</h3>
        <button className="desk-btn ghost" onClick={generate} disabled={busy || !positions.length}>
          {busy ? (<><span className="desk-spin" />Analyzing…</>) : (risk ? 'Regenerate' : 'Generate risk analysis')}
        </button>
      </div>
      {!positions.length ? <div className="desk-note" style={{ marginTop: '0' }}>No positions uploaded yet.</div> : null}
      {error ? <div className="desk-error" style={{ marginTop: '0' }}>{error}</div> : null}
      {risk ? <div className="desk-commentary-text">{risk}</div> : null}
    </div>
  );
}

export default function RisksPage({ configs, histories }: { configs: ConfigsById; histories: Histories }) {
  return (
    <div>
      <h2 className="display">Risks</h2>
      <div className="desk-sub">AI-described risk exposure per portfolio, grounded only in each portfolio's own holdings from its designated source page.</div>
      {PORTFOLIO_IDS.map((id) => {
        const hist = histories[id] || [];
        const positions = hist.length ? hist[hist.length - 1].positions : [];
        return <PortfolioRiskCard key={id} id={id} cfg={configs[id]} positions={positions} />;
      })}
    </div>
  );
}
