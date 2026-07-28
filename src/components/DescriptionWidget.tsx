import { useState } from 'react';
import { callClaude } from '../lib/ai';
import { cleanProse } from '../lib/format';

export default function DescriptionWidget({ generatePrompt }: { generatePrompt: () => string }) {
  const [desc, setDesc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setBusy(true); setError('');
    try {
      const text = await callClaude(generatePrompt(), 450);
      setDesc(cleanProse(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the description.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="desk-panel">
      <div className="desk-panel-head">
        <h3>Description</h3>
        <button className="desk-btn ghost" onClick={generate} disabled={busy}>
          {busy ? (<><span className="desk-spin" />Writing…</>) : (desc ? 'Regenerate' : 'Generate description')}
        </button>
      </div>
      {error ? <div className="desk-error">{error}</div> : null}
      {desc ? (
        <div className="desk-commentary-text">{desc}</div>
      ) : (
        <div className="desk-note">This simulation uses stated long-run capital-market assumptions by asset class (not this portfolio's own fitted history, which isn't available from a single snapshot) — it's a modeled range of outcomes, not a prediction. Click to generate a plain-language description.</div>
      )}
      <div className="desk-note" style={{ marginTop: 'var(--sp-3)' }}>
        Assumptions: equity ETFs ~9%/16% (mean/volatility annualized), individual equities ~10%/22%, fixed income ~4.5%/2%. Correlation: 0.6 within the same sector, 0.35 across equity sectors, 0.7 among fixed income holdings, 0.1 between equity and fixed income.
      </div>
    </div>
  );
}
