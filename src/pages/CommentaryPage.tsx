import { useCallback, useEffect, useState } from 'react';
import type { ConfigsById, Histories, DailyPnlSeries, PortfolioId } from '../types';
import { PORTFOLIO_IDS, PORTFOLIO_SOURCING } from '../lib/constants';
import { fmtMoney, fmtPct, todayStr, cleanProse } from '../lib/format';
import { callClaude } from '../lib/ai';
import { safeGet, safeSet, onKeyChange } from '../lib/storage';
import { loadDailyPnl, refreshDailyPnl, dailyPnlKey, dailyPnlFromHistory, latestPoint, sourceSheetsFor, summarize, deskTotals } from '../lib/dailyPnl';
import DailyPnlBars from '../components/DailyPnlBars';
import type { PnlBarRow } from '../components/DailyPnlBars';
import CumulativePnlChart from '../components/CumulativePnlChart';
import DailyPnlColumns from '../components/DailyPnlColumns';
import PnlStatTiles from '../components/PnlStatTiles';
import WinLossSplit from '../components/WinLossSplit';
import DeskTotalChart from '../components/DeskTotalChart';

const BOOK_COLORS = ['#0E2C4F', '#B4924C', '#17784C'];

interface CommentaryEntry {
  date: string;
  text: string;
}

type PnlMap = Partial<Record<PortfolioId, DailyPnlSeries | null>>;
type ErrMap = Partial<Record<PortfolioId, string | null>>;

function sourceLabel(id: PortfolioId): string {
  const s = PORTFOLIO_SOURCING[id];
  if (!s) return 'its single sheet';
  if (s.dailyPnlFromHistory) return 'the day-over-day change in his own uploaded snapshots';
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
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await safeGet('commentary-log');
      setLog(raw ? JSON.parse(raw) : []);
      const loaded: PnlMap = {};
      for (const id of PORTFOLIO_IDS) {
        // History-derived books need no stored key — their series is computed
        // fresh from `histories` below, always in step with the latest upload.
        if (PORTFOLIO_SOURCING[id]?.dailyPnlFromHistory) continue;
        loaded[id] = await loadDailyPnl(id);
      }
      setPnl(loaded);
    })();
  }, []);

  useEffect(() => {
    const unsubs = [
      onKeyChange('commentary-log', (v) => setLog(v ? JSON.parse(v) : [])),
      ...PORTFOLIO_IDS.filter((id) => !PORTFOLIO_SOURCING[id]?.dailyPnlFromHistory).map((id) =>
        onKeyChange(dailyPnlKey(id), (v) => {
          setPnl((prev) => ({ ...prev, [id]: v ? JSON.parse(v) : null }));
        })
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Books using history-derived daily P&L recompute on every render from the
  // `histories` prop, which is itself already kept live-synced by the parent —
  // no extra fetch or subscription needed here.
  const effectivePnl: PnlMap = { ...pnl };
  PORTFOLIO_IDS.forEach((id) => {
    if (PORTFOLIO_SOURCING[id]?.dailyPnlFromHistory) {
      effectivePnl[id] = dailyPnlFromHistory(histories[id] || []);
    }
  });

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setRefreshNote('');
    const nextErrors: ErrMap = {};
    const next: PnlMap = {};
    for (const id of PORTFOLIO_IDS) {
      // History-derived books have nothing to re-read — they're already
      // computed fresh from `histories` on every render.
      if (PORTFOLIO_SOURCING[id]?.dailyPnlFromHistory) continue;
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
    const ok = PORTFOLIO_IDS.filter((id) =>
      PORTFOLIO_SOURCING[id]?.dailyPnlFromHistory ? dailyPnlFromHistory(histories[id] || []).found : next[id]?.found
    ).length;
    setRefreshNote(`Read daily P&L for ${ok} of ${PORTFOLIO_IDS.length} books.`);
  }, [histories]);

  const rows: PnlBarRow[] = PORTFOLIO_IDS.map((id) => {
    const series = effectivePnl[id] || null;
    const point = latestPoint(series);
    const historyDerived = !!PORTFOLIO_SOURCING[id]?.dailyPnlFromHistory;
    const missing = pnlErrors[id]
      ? 'Source unavailable'
      : historyDerived
      ? 'Needs a second uploaded snapshot'
      : series
      ? 'Not found in source'
      : 'Not read yet';
    return {
      name: configs[id].name.replace(/'s Portfolio$/i, ''),
      pnl: point ? point.pnl : null,
      returnPct: point ? point.returnPct : null,
      date: point ? point.date : null,
      missing,
    };
  });

  const bookSeries = PORTFOLIO_IDS.map((id) => ({ name: configs[id].name.replace(/'s Portfolio$/i, ''), data: effectivePnl[id] || null }));
  const anyPnl = rows.some((r) => r.pnl !== null);
  const anyHistory = PORTFOLIO_IDS.some((id) => (histories[id] || []).length);
  const latestDate = rows.map((r) => r.date).filter(Boolean).sort().pop() || null;

  async function generate() {
    setBusy(true); setError('');
    try {
      const lines = PORTFOLIO_IDS.map((id) => {
        const cfg = configs[id];
        const series = effectivePnl[id] || null;
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
        Daily P&amp;L compared across the three books, read strictly from each portfolio's designated source —
        Shaylen from "Daily Performance", Antonio from "Benchmark", Israel from {sourceLabel('p3')}.
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
        <>
          <div className="desk-panel">
            <h3>By book</h3>
            <PnlStatTiles
              tiles={PORTFOLIO_IDS.map((id, i) => ({
                name: configs[id].name.replace(/'s Portfolio$/i, ''),
                summary: summarize(effectivePnl[id] || null),
                color: BOOK_COLORS[i % BOOK_COLORS.length],
              }))}
            />
          </div>

          <div className="desk-panel">
            <h3>Cumulative P&amp;L <span className="unit">(running total by book)</span></h3>
            <CumulativePnlChart series={bookSeries} />
          </div>

          <div className="desk-panel">
            <h3>Session P&amp;L <span className="unit">(each trading day, by book)</span></h3>
            <DailyPnlColumns series={bookSeries} />
          </div>

          <div className="desk-panel">
            <h3>Desk total <span className="unit">(all books combined, per session)</span></h3>
            <DeskTotalChart points={deskTotals(PORTFOLIO_IDS.map((id) => effectivePnl[id] || null))} />
          </div>

          <div className="desk-panel">
            <h3>Winning vs losing sessions</h3>
            <WinLossSplit rows={PORTFOLIO_IDS.map((id) => ({ name: configs[id].name.replace(/'s Portfolio$/i, ''), summary: summarize(effectivePnl[id] || null) }))} />
          </div>

          <div className="desk-panel">
            <h3>Where the figures come from</h3>
            {PORTFOLIO_IDS.map((id) => {
              const s = effectivePnl[id];
              return s?.method ? (
                <div className="desk-note" key={id} style={{ marginTop: '4px' }}>
                  <strong>{configs[id].name}</strong> — {s.sheetUsed ? `"${s.sheetUsed}": ` : ''}{s.method}
                </div>
              ) : null;
            })}
          </div>
        </>
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
          <>
            {/* Only the latest note is shown. Older entries — including the long
                ones written before this page became chart-led — sit behind the
                toggle rather than filling the page with prose. */}
            <div className="desk-commentary-entry">
              <div className="desk-commentary-date">{log[0].date}</div>
              <div className="desk-commentary-text">{log[0].text}</div>
            </div>
            {log.length > 1 ? (
              <>
                <button
                  className="desk-btn ghost"
                  style={{ marginTop: 'var(--sp-4)', padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => setShowHistory((v) => !v)}
                >
                  {showHistory ? 'Hide earlier notes' : `Earlier notes (${log.length - 1})`}
                </button>
                {showHistory
                  ? log.slice(1).map((entry, i) => (
                      <div className="desk-commentary-entry" key={i}>
                        <div className="desk-commentary-date">{entry.date}</div>
                        <div className="desk-commentary-text">{entry.text}</div>
                      </div>
                    ))
                  : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
