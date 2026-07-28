import { useState } from 'react';
import type { DeskConfig } from '../types';
import { PORTFOLIO_IDS } from '../lib/constants';
import { safeDelete } from '../lib/storage';
import BrandMark from '../components/BrandMark';

export default function LoginGate({ config, onUnlock }: { config: DeskConfig; onUnlock: () => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [confirmingReset, setConfirmingReset] = useState(false);

  function submit() {
    if (input === config.password) onUnlock();
    else setError('Incorrect password.');
  }

  async function reset() {
    await safeDelete('desk-config');
    for (const id of PORTFOLIO_IDS) await safeDelete('history-' + id);
    await safeDelete('commentary-log');
    window.location.reload();
  }

  return (
    <div className="desk-gate">
      <div className="desk-gate-box">
        <div className="brand-row">
          <BrandMark size={26} />
          <span className="eyebrow">Safra · Private desk</span>
        </div>
        <h1 className="display">Enter password</h1>
        <input
          className="desk-input"
          type="password"
          placeholder="Password"
          autoFocus
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        {error ? <div className="desk-error">{error}</div> : null}
        <button className="desk-btn" onClick={submit}>Unlock</button>
        <div style={{ marginTop: '14px', textAlign: 'center' }}>
          {!confirmingReset ? (
            <button onClick={() => setConfirmingReset(true)} style={{ all: 'unset', cursor: 'pointer', fontSize: '11px', color: '#5B6675' }}>
              Forgot password / reset desk data
            </button>
          ) : (
            <span style={{ fontSize: '11.5px' }}>
              This deletes all saved portfolios and commentary.{' '}
              <button onClick={reset} style={{ all: 'unset', cursor: 'pointer', color: '#E2596B', fontWeight: 600 }}>Confirm reset</button>
              {' · '}
              <button onClick={() => setConfirmingReset(false)} style={{ all: 'unset', cursor: 'pointer', color: '#8894A3' }}>Cancel</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
