import { useEffect, useState } from 'react';
import type { PortfolioConfig, History, PortfolioId, DailyPnlSeries } from '../types';
import { PORTFOLIO_SOURCING, PORTFOLIO_INCEPTION, PORTFOLIO_STARTING_BALANCE } from '../lib/constants';
import { loadDailyPnl, refreshDailyPnl, dailyPnlKey, dailyPnlFromHistory, sourceSheetsFor } from '../lib/dailyPnl';
import { onKeyChange } from '../lib/storage';
import { fmtMoney, fmtPct } from '../lib/format';
import PerformanceHistoryChart from '../components/PerformanceHistoryChart';

function sourceLabel(id: PortfolioId): string {
  const s = PORTFOLIO_SOURCING[id];
  if (!s) return 'the available sheet';
  if (s.dailyPnlFromHistory) return "the day-over-day change in this book's own uploaded snapshots";
  return `"${s.dailyPnlSheets.join(' / ')}"`;
}

export default function PerformanceHistoryPage({ id, cfg, history }: { id: PortfolioId; cfg: PortfolioConfig; history: History }) {
  const isHistoryDerived = !!PORTFOLIO_SOURCING[id]?.dailyPnlFromHistory;
  const [series, setSeries] = useState<DailyPnlSeries | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isHistoryDerived) return;
    let cancelled = false;
    loadDailyPnl(id).then((s) => { if (!cancelled) setSeries(s); });
    return () => { cancelled = true; };
  }, [id, isHistoryDerived]);

  useEffect(() => {
    if (isHistoryDerived) return;
    return onKeyChange(dailyPnlKey(id), (v) => setSeries(v ? JSON.parse(v) : null));
  }, [id, isHistoryDerived]);

  // For books with no dated log at all, the series is always recomputed live
  // from this book's own uploaded snapshots — nothing to read or cache.
  const effective: DailyPnlSeries | null = isHistoryDerived ? dailyPnlFromHistory(history) : series;

  async function read() {
    setBusy(true); setError('');
    try {
      const { sheets, error: srcErr } = await sourceSheetsFor(id);
      if (!sheets) { setError(srcErr || 'No source sheet available.'); return; }
      const s = await refreshDailyPnl(id);
      setSeries(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read performance history.');
    } finally {
      setBusy(false);
    }
  }

  const inceptionDate = PORTFOLIO_INCEPTION[id];
  const usablePoints = (effective?.points ?? []).filter((p) => p.endingValue !== null && p.endingValue > 0);
  const latest = usablePoints.length ? usablePoints[usablePoints.length - 1] : null;
  const cumPct = latest && latest.endingValue !== null ? (latest.endingValue - PORTFOLIO_STARTING_BALANCE) / PORTFOLIO_STARTING_BALANCE : null;

  return (
    <div>
      <h2 className="display">{cfg.name} — Performance</h2>
      <div className="desk-sub">
        Value from inception (${PORTFOLIO_STARTING_BALANCE.toLocaleString()} on {inceptionDate}) to today
        {isHistoryDerived ? `, derived from ${sourceLabel(id)} — no dated performance log exists in this book's own workbook.` : `, read strictly from ${sourceLabel(id)}.`}
      </div>

      {!isHistoryDerived ? (
        <div className="desk-panel">
          <button className="desk-btn" onClick={read} disabled={busy}>
            {busy ? (<><span className="desk-spin" />Reading performance history…</>) : (effective?.found ? 'Refresh performance history' : 'Read performance history')}
          </button>
          {error ? <div className="desk-error" style={{ marginTop: 'var(--sp-3)' }}>{error}</div> : null}
        </div>
      ) : null}

      {!effective || !effective.found || usablePoints.length === 0 ? (
        <div className="desk-panel">
          <div className="desk-note" style={{ marginTop: 0 }}>
            {isHistoryDerived
              ? 'Needs at least one more uploaded snapshot to show a trend beyond the starting value.'
              : effective && !effective.found
              ? `No dated performance data found in ${sourceLabel(id)}.`
              : 'Not read yet — press the button above.'}
          </div>
        </div>
      ) : (
        <div className="desk-panel">
          {latest && cumPct !== null ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--sp-4)' }}>
              <div>
                <div className="desk-note" style={{ marginTop: 0 }}>Latest — {latest.date}</div>
                <div className="mono" style={{ fontSize: '20px', fontWeight: 600 }}>{fmtMoney(latest.endingValue)}</div>
              </div>
              <div className="mono" style={{ fontSize: '28px', fontWeight: 700, color: cumPct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {fmtPct(cumPct)}
              </div>
            </div>
          ) : null}
          <PerformanceHistoryChart points={effective.points} inceptionDate={inceptionDate} startingBalance={PORTFOLIO_STARTING_BALANCE} />
          {effective.method ? (
            <div className="desk-note" style={{ marginTop: 'var(--sp-3)' }}>
              {effective.sheetUsed ? `"${effective.sheetUsed}": ` : ''}{effective.method}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
