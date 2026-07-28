import { useEffect, useState } from 'react';
import type { ConfigsById, Histories } from '../types';
import { PORTFOLIO_IDS } from '../lib/constants';
import { portfolioMetrics } from '../lib/compute';
import { fmtMoney, fmtPct, todayStr } from '../lib/format';
import { callClaude } from '../lib/ai';
import { safeGet, safeSet } from '../lib/storage';

interface CommentaryEntry {
  date: string;
  text: string;
}

export default function CommentaryPage({ configs, histories }: { configs: ConfigsById; histories: Histories }) {
  const [log, setLog] = useState<CommentaryEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const anyData = PORTFOLIO_IDS.some((id) => (histories[id] || []).length);

  useEffect(() => {
    (async () => {
      const raw = await safeGet('commentary-log');
      setLog(raw ? JSON.parse(raw) : []);
    })();
  }, []);

  async function generate() {
    setBusy(true); setError('');
    try {
      const parts = PORTFOLIO_IDS.map((id) => {
        const cfg = configs[id];
        const m = portfolioMetrics(histories[id] || []);
        if (!m) return cfg.name + ' (' + cfg.strategy + '): no positions uploaded yet.';
        const movers = [...m.positions]
          .sort((a, b) => Math.abs(b.dayChangeDollar || 0) - Math.abs(a.dayChangeDollar || 0))
          .slice(0, 3)
          .map((p) => p.ticker + ' ' + (p.dayChangeDollar === null ? '(new)' : (p.dayChangeDollar >= 0 ? '+' : '') + fmtMoney(p.dayChangeDollar)))
          .join(', ');
        return cfg.name + ' — strategy: ' + cfg.strategy + '. Value: ' + fmtMoney(m.displayValue) +
          (m.reported && m.reported.totalValue !== null ? ' (reported as of ' + (m.reported.totalValueAsOf || m.lastDate) + ')' : '') +
          '. Day change: ' + (m.dayChangeDollar === null ? 'first snapshot, no prior day' : fmtMoney(m.dayChangeDollar) + ' (' + fmtPct(m.dayChangePct) + ')') +
          '. Unrealized P&L: ' + fmtMoney(m.totalPL) + '. Top movers: ' + (movers || 'none') + '.';
      }).join('\n');
      const prompt = `You are writing a short daily desk commentary for a private investment practice tracking three portfolios. Use only the data below — do not invent figures or news. Write 150-220 words, plain professional language, no headers or bullet points, covering: how the desk did today overall, which book(s) moved the most and why that's notable given their stated strategy, and any position worth flagging. Today's date: ${todayStr()}.\n\nData:\n${parts}`;
      const text = await callClaude(prompt, 700);
      const entry: CommentaryEntry = { date: todayStr(), text };
      const raw = await safeGet('commentary-log');
      const existing: CommentaryEntry[] = raw ? JSON.parse(raw) : [];
      const filtered = existing.filter((e) => e.date !== entry.date);
      const newLog = [entry, ...filtered];
      await safeSet('commentary-log', JSON.stringify(newLog));
      setLog(newLog);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate commentary.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="display">Daily commentary</h2>
      <div className="desk-sub">AI-written, grounded only in your uploaded snapshots.</div>
      <div className="desk-panel">
        <button className="desk-btn" onClick={generate} disabled={busy || !anyData}>
          {busy ? (<><span className="desk-spin" />Writing…</>) : "Generate today's commentary"}
        </button>
        {!anyData ? <div className="desk-note">Upload at least one portfolio's positions first.</div> : null}
        {error ? <div className="desk-error" style={{ marginTop: '10px' }}>{error}</div> : null}
      </div>
      {log === null ? (
        <div className="desk-note">Loading…</div>
      ) : log.length === 0 ? (
        <div className="desk-note">No commentary generated yet.</div>
      ) : (
        <div className="desk-panel">
          {log.map((entry, i) => (
            <div className="desk-commentary-entry" key={i}>
              <div className="desk-commentary-date">{entry.date}</div>
              <div className="desk-commentary-text">{entry.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
