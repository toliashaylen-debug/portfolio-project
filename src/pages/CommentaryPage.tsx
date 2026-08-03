import { useCallback, useEffect, useState } from 'react';
import type { ConfigsById, Histories, DailyPnlSeries, PortfolioId } from '../types';
import { PORTFOLIO_IDS, PORTFOLIO_SOURCING } from '../lib/constants';
import { fmtMoney, fmtPct, todayStr, cleanProse } from '../lib/format';
import { callClaude } from '../lib/ai';
import { safeGet, safeSet, onKeyChange } from '../lib/storage';
import { loadDailyPnl, refreshDailyPnl, dailyPnlKey, latestPoint, sourceSheetsFor } from '../lib/dailyPnl';
import DailyPnlBars from '../components/DailyPnlBars';
import type { PnlBarRow } from '../components/DailyPnlBars';
import CumulativePnlChart from '../components/CumulativePnlChart';

interface CommentaryEntry {
  date: string;
  text: string;
}

type PnlMap = Partial<Record<PortfolioId, DailyPnlSeries | null>>;
type ErrMap = Partial<Record<PortfolioId, string | null>>;

function sourceLabel(id: PortfolioId): string {
  const s = PORTFOLIO_SOURCING[id];
  if (!s) return 'its single sheet';
  return `"${s.dailyPnlSheets.join(' / ')}"`;
}

export default function CommentaryPage({ configs, histories }: { configs: ConfigsById; histories: Histories }) {
  const [log, setLog] = useState<CommentaryEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pnl, setPnl] = useState<PnlMap>({});
  const [pnlErrors, setPnlErrors] = useState<ErrMap>({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState('');

  useEffect(() => {
    (async () => {
      const raw = await safeGet('commentary-log');
      setLog(raw ? JSON.parse(raw) : []);
      const loaded: PnlMap = {};
      for (const id of PORTFOLIO_IDS) loaded[id] = await loadDailyPnl(id);
      setPnl(loaded);
    })();
  }, []);

  useEffect(() => {
    const unsubs = [
      onKeyChange('commentary-log', (v) => setLog(v ? JSON.parse(v) : [])),
      ...PORTFOLIO_IDS.map((id) =>
        onKeyChange(dailyPnlKey(id), (v) => {
          setPnl((prev) => ({ ...prev, [id]: v ? JSON.parse(v) : null }));
        })
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setRefreshNote('');
    const nextErrors: ErrMap = {};
    const next: PnlMap = {};
    for (const id of PORTFOLIO_IDS) {
      try {
        const { sheets, error: srcErr } = await sourceSheetsFor(id);
        if (!sheets) { nextErrors[id] = srcErr; next[id] = null; continue; }
        next[id] = await refreshDailyPnl(id);
        nextErrors[id] = null;
      } catch (e) {
        nextErrors[id] = e instanceof Error ? e.message : 'Could not read the daily P&L.';
        next[id] = null;
      }
    }
    setPnl((prev) => ({ ...prev, ...next }));
    setPnlErrors(nextErrors);
    setRefreshing(false);
    const ok = PORTFOLIO_IDS.filter((id) => next[id]?.found).length;
    setRefreshNote(`Read daily P&L for ${ok} of ${PORTFOLIO_IDS.length} books.`);
  }, []);

  const rows: PnlBarRow[] = PORTFOLIO_IDS.map((id) => {
    const series = pnl[id] || null;
    const point = latestPoint(series);
    return {
      name: configs[id].name.replace(/'s Portfolio$/i, ''),
      pnl: point ? point.pnl : null,
      returnPct: point ? point.returnPct : null,
      date: point ? point.date : null,
      missing: pnlErrors[id] ? 'Source unavailable' : series ? 'Not found in source' : 'Not read yet',
    };
  });

  const anyPnl = rows.some((r) => r.pnl !== null);
  const anyHistory = PORTFOLIO_IDS.some((id) => (histories[id] || []).length);
  const latestDate = rows.map((r) => r.date).filter(Boolean).sort().pop() || null;

  async function generate() {
    setBusy(true); setError('');
    try {
      const lines = PORTFOLIO_IDS.map((id) => {
        const cfg = configs[id];
        const series = pnl[id] || null;
        const p = latestPoint(series);
        if (!p) return `${cfg.name}: no daily P&L available from ${sourceLabel(id)}.`;
        const prior = series!.points.slice(-6, -1);
        const trend = prior.length
          ? ` Prior ${prior.length} sessions: ${prior.map((x) => (x.pnl >= 0 ? '+' : '') + Math.round(x.pnl)).join(', ')}.`
          : '';
        return `${cfg.name}: ${p.date} P&L ${p.pnl >= 0 ? '+' : ''}${fmtMoney(p.pnl)}${p.returnPct !== null ? ` (${fmtPct(p.returnPct)})` : ''}, sourced from ${sourceLabel(id)}.${trend}`;
      }).join('\n');

      const prompt = `You are writing an extremely brief daily note for a private investment desk tracking three portfolios. The figures below are already displayed to the reader as charts, so DO NOT list or restate them.

Write EXACTLY 2 to 3 sentences. Total under 55 words. Say only what the numbers do not already show on their own: which book led and which lagged today, and whether that is consistent with or a break from the preceding sessions. No preamble, no sign-off, no bullet points, no headings, no restating dollar amounts or percentages. Plain professional prose.

Today's date: ${todayStr()}.

Data:
${lines}`;

      const text = await callClaude(prompt, 220);
      const entry: CommentaryEntry = { date: todayStr(), text: cleanProse(text) };
      const raw = await safeGet('commentary-log');
      const existing: CommentaryEntry[] = raw ? JSON.parse(raw) : [];
      const newLog = [entry, ...existing.filter((e) => e.date !== entry.date)];
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
      <div className="desk-sub">
        Daily P&amp;L compared across the three books, read strictly from each portfolio's designated source sheet —
        Shaylen from "Daily Performance", Antonio from "Benchmark", Israel from his single sheet.
      </div>

      <div className="desk-panel">
        <div className="desk-panel-head">
          <h3>Daily P&amp;L{latestDate ? <span className="unit"> · {latestDate}</span> : null}</h3>
          <button className="desk-btn ghost" onClick={refreshAll} disabled={refreshing}>
            {refreshing ? (<><span className="desk-spin" />Reading source sheets…</>) : (anyPnl ? 'Refresh from sheets' : 'Read daily P&L')}
          </button>
        </div>
        {anyPnl ? (
          <DailyPnlBars rows={rows} />
        ) : (
          <div className="desk-note" style={{ marginTop: 0 }}>
            No daily P&amp;L read yet. Each book is restricted to one source sheet — press the button above to read them.
          </div>
        )}
        {refreshNote ? <div className="desk-note">{refreshNote}</div> : null}
        {PORTFOLIO_IDS.filter((id) => pnlErrors[id]).map((id) => (
          <div className="desk-note" style={{ color: 'var(--neg)' }} key={id}>
            {configs[id].name}: {pnlErrors[id]}
          </div>
        ))}
      </div>

      {anyPnl ? (
        <div className="desk-panel">
          <h3>Cumulative P&amp;L <span className="unit">(running total by book)</span></h3>
          <CumulativePnlChart series={PORTFOLIO_IDS.map((id) => ({ name: configs[id].name.replace(/'s Portfolio$/i, ''), data: pnl[id] || null }))} />
          {PORTFOLIO_IDS.map((id) => {
            const s = pnl[id];
            return s?.method ? (
              <div className="desk-note" key={id} style={{ marginTop: '4px' }}>
                <strong>{configs[id].name}</strong> — {s.sheetUsed ? `"${s.sheetUsed}": ` : ''}{s.method}
              </div>
            ) : null;
          })}
        </div>
      ) : null}

      <div className="desk-panel">
        <div className="desk-panel-head">
          <h3>The note</h3>
          <button className="desk-btn ghost" onClick={generate} disabled={busy || (!anyPnl && !anyHistory)}>
            {busy ? (<><span className="desk-spin" />Writing…</>) : 'Write today’s note'}
          </button>
        </div>
        {!anyPnl && !anyHistory ? <div className="desk-note" style={{ marginTop: 0 }}>Upload at least one portfolio first.</div> : null}
        {error ? <div className="desk-error" style={{ marginTop: 0 }}>{error}</div> : null}
        {log === null ? (
          <div className="desk-note" style={{ marginTop: 0 }}>Loading…</div>
        ) : log.length === 0 ? (
          <div className="desk-note" style={{ marginTop: 0 }}>No note written yet. Two or three sentences, no more — the charts carry the rest.</div>
        ) : (
          log.map((entry, i) => (
            <div className="desk-commentary-entry" key={i}>
              <div className="desk-commentary-date">{entry.date}</div>
              <div className="desk-commentary-text">{entry.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
