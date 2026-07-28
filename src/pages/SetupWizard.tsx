import { useState } from 'react';
import type { DeskConfig } from '../types';
import { PORTFOLIO_IDS, DEFAULT_NAMES } from '../lib/constants';
import { verifiedSet } from '../lib/storage';
import BrandMark from '../components/BrandMark';

export default function SetupWizard({ onComplete }: { onComplete: (cfg: DeskConfig) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES.slice());
  const [strategies, setStrategies] = useState<string[]>(['', '', '']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError('');
    if (!password || password.length < 4) { setError('Choose a password of at least 4 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    const config: DeskConfig = {
      password,
      portfolios: PORTFOLIO_IDS.map((id, i) => ({ id, name: names[i] || DEFAULT_NAMES[i], strategy: strategies[i] || 'Not yet labeled' })),
    };
    const okSaved = await verifiedSet('desk-config', JSON.stringify(config));
    setSaving(false);
    if (!okSaved) { setError("Could not verify the save went through — check your connection and try again before continuing, or your setup won't survive a reload."); return; }
    onComplete(config);
  }

  return (
    <div className="desk-gate">
      <div className="desk-gate-box" style={{ width: '420px' }}>
        <div className="brand-row">
          <BrandMark size={26} />
          <span className="eyebrow">Safra · First-time setup</span>
        </div>
        <h1 className="display">Set up the desk</h1>
        <div className="desk-row" style={{ gap: '8px' }}>
          <input className="desk-input" style={{ flex: 1 }} type="password" placeholder="Set a password" onChange={(e) => setPassword(e.target.value)} />
          <input className="desk-input" style={{ flex: 1 }} type="password" placeholder="Confirm password" onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <div className="desk-note" style={{ marginBottom: '14px' }}>
          This keeps casual visitors out. It's stored in your own account's private data — anyone on a different account gets no access to this data at all, even without the password.
        </div>
        {PORTFOLIO_IDS.map((_, i) => (
          <div className="desk-setup-portfolio" key={i}>
            <input
              className="desk-input"
              placeholder={'Portfolio ' + (i + 1) + ' name'}
              value={names[i]}
              onChange={(e) => setNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))}
            />
            <input
              className="desk-input"
              placeholder="Strategy label (e.g. Barbell: high-vol equity + short-duration FI)"
              value={strategies[i]}
              onChange={(e) => setStrategies((prev) => prev.map((s, idx) => (idx === i ? e.target.value : s)))}
            />
          </div>
        ))}
        {error ? <div className="desk-error">{error}</div> : null}
        <button className="desk-btn" style={{ width: '100%' }} disabled={saving} onClick={submit}>
          {saving ? 'Setting up…' : 'Create the desk'}
        </button>
      </div>
    </div>
  );
}
