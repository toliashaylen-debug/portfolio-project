import { useRef, useState } from 'react';
import type { PortfolioId, PositionSheetCandidate, ReportedSummary, RawSheet, History, Snapshot } from '../types';
import { PORTFOLIO_SOURCING } from '../lib/constants';
import { readWorkbook } from '../lib/workbook';
import { sheetAllowed, fmtMoney, todayStr } from '../lib/format';
import { computeBreakdown, flagPosition, valueOf } from '../lib/compute';
import { callClaude } from '../lib/ai';
import { safeGet, verifiedSet, safeSet } from '../lib/storage';
import { SLEEVE_LABELS } from '../lib/constants';
import { gridToTSV } from '../lib/workbook';

export default function UploadPanel({ portfolioId, onSaved }: { portfolioId: PortfolioId; onSaved: (h: History) => void }) {
  const sourcing = PORTFOLIO_SOURCING[portfolioId] || null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [candidates, setCandidates] = useState<PositionSheetCandidate[] | null>(null);
  const [reportedSummary, setReportedSummary] = useState<ReportedSummary | null>(null);
  const [useReported, setUseReported] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rawSheets, setRawSheets] = useState<RawSheet[] | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setOk(''); setBusy(true); setBusyLabel('Reading the workbook…');
    setCandidates(null); setReportedSummary(null); setRawSheets(null);
    try {
      const result = await readWorkbook(file);
      const { positionSheets, reportedSummary: reported, rawSheets: raw } = result;
      const restricted = sourcing && sourcing.positionsSheets
        ? positionSheets.filter((c) => sheetAllowed(c.sheetName, sourcing.positionsSheets))
        : positionSheets;
      if (sourcing && sourcing.positionsSheets && !restricted.length) {
        throw new Error('This portfolio only reads positions from ' + sourcing.positionsSheets.join(' / ') + ', and no matching sheet with holdings was found in this file.');
      }
      const initialChecked: Record<string, boolean> = {};
      restricted.forEach((c) => { initialChecked[c.sheetName] = true; });
      setChecked(initialChecked);
      setCandidates(restricted);
      setReportedSummary(reported);
      setUseReported(true);
      setRawSheets(raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong reading that file.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!candidates) return;
    setBusy(true); setBusyLabel('Saving…'); setError(''); setOk('');
    try {
      const selectedSheets = candidates.filter((c) => checked[c.sheetName]);
      if (!selectedSheets.length) throw new Error('Select at least one sheet to import.');

      const seenTickers = new Set<string>();
      const dupTickers = new Set<string>();
      const positions: PositionSheetCandidate['positions'] = [];
      selectedSheets.forEach((c) => {
        c.positions.forEach((p) => {
          if (seenTickers.has(p.ticker)) { dupTickers.add(p.ticker); return; }
          seenTickers.add(p.ticker);
          positions.push(p);
        });
      });

      const histRaw = await safeGet('history-' + portfolioId);
      const history: History = histRaw ? JSON.parse(histRaw) : [];
      const existingIdx = history.findIndex((hh) => hh.date === date);
      const reported = (useReported && reportedSummary) ? reportedSummary : null;
      const weightMode = sourcing ? sourcing.weightMode : 'value';

      let themes: string | null = null;
      try {
        setBusyLabel('Reading the composition…');
        const b = computeBreakdown(positions, weightMode);
        if (b) {
          const sleeveText = (reported && (reported.equityWeightPct !== null || reported.fixedIncomeWeightPct !== null))
            ? ('Equity ' + (reported.equityWeightPct !== null ? reported.equityWeightPct.toFixed(1) : '—') + '%, Fixed income ' + (reported.fixedIncomeWeightPct !== null ? reported.fixedIncomeWeightPct.toFixed(1) : '—') + '% (reported directly in the file)')
            : b.sleeveSegments.map((s) => s.label + ' ' + s.pct.toFixed(1) + '%').join(', ');
          const sectorText = b.sectorWeights.slice(0, 6).map((s) => s.label + ' ' + s.pct.toFixed(1) + '%').join(', ');
          const topText = b.topPositions.slice(0, 5).map((p) => p.ticker + ' ' + p.pct.toFixed(1) + '%').join(', ');
          const totalValueText = reported && reported.totalValue ? (fmtMoney(reported.totalValue) + ' (reported as of ' + (reported.totalValueAsOf || 'latest') + ')') : fmtMoney(b.totalValue);

          let extraContext = '';
          if (sourcing && sourcing.readSheets && rawSheets) {
            const allowedRaw = rawSheets.filter((s) => sheetAllowed(s.sheetName, sourcing.readSheets));
            if (allowedRaw.length) {
              extraContext = '\n\nAdditional source material (use only what is factually relevant, do not invent beyond it):\n' +
                allowedRaw.map((s) => `<sheet name="${s.sheetName}">\n${gridToTSV(s.grid.slice(0, 60))}\n</sheet>`).join('\n\n');
            }
          }

          const themesPrompt = `A portfolio has this exact computed breakdown — do not restate these numbers, they are already shown separately:\nAllocation: ${sleeveText}.\nSector/theme weights: ${sectorText}.\nLargest positions: ${topText}.\nTotal value: ${totalValueText} across ${b.numPositions} positions.${extraContext}\n\nIn 2-3 sentences, say what this composition suggests strategically — the kind of risk being taken, what the sector/theme tilt implies, and whether the concentration level is notable. If the additional source material above shows anything notable (recent trades, performance trend, benchmark comparison), you may reference it briefly. Be specific, no generic filler, no repeating the percentages themselves. Write it as flowing prose in complete sentences — no bullet points, no dashes, no line breaks, no lists. Respond with only those sentences, nothing else.`;
          themes = await callClaude(themesPrompt, 400);
        }
      } catch {
        themes = null;
      }

      const snapshot: Snapshot = { date, positions, themes, reported };
      let newHistory: History;
      if (existingIdx !== -1) {
        newHistory = history.slice();
        newHistory[existingIdx] = snapshot;
      } else {
        newHistory = [...history, snapshot].sort((a, b) => a.date.localeCompare(b.date));
      }
      const saved = await verifiedSet('history-' + portfolioId, JSON.stringify(newHistory));
      if (!saved) throw new Error("Saved locally but couldn't verify the write to storage — try again, and if this keeps happening, reload the app before uploading.");
      if (rawSheets) {
        try { await safeSet('raw-' + portfolioId, JSON.stringify({ date, sheets: rawSheets })); } catch { /* non-fatal */ }
      }
      setOk(
        'Saved ' + positions.length + ' positions for ' + date + ' from ' + selectedSheets.map((c) => c.sheetName).join(', ') +
        (existingIdx !== -1 ? ' (overwrote existing snapshot for that date)' : '') +
        (dupTickers.size ? ('. Skipped duplicate ticker(s) found in more than one selected sheet: ' + [...dupTickers].join(', ') + ' (kept the first occurrence).') : '.')
      );
      onSaved(newHistory);
      setCandidates(null); setReportedSummary(null); setRawSheets(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import the selected sheets.');
    } finally {
      setBusy(false);
    }
  }

  const sourcingNote = sourcing && sourcing.positionsSheets
    ? ('This portfolio only reads positions from: ' + sourcing.positionsSheets.join(' / ') + '. Other sheets in the file are ignored for positions.')
    : "Every sheet is read directly — headers don't need to match anything specific, and a sheet can hold more than one stacked table (equities, ETFs, bonds identified by ISIN, whatever it actually contains). All sheets with holdings are checked by default below — uncheck any you don't want in today's snapshot.";

  return (
    <div className="desk-panel">
      <h3>Upload today's positions</h3>
      <div className="desk-row">
        <input className="desk-input mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={busy} style={{ color: 'var(--text-dim)', fontSize: '13px' }} />
        {busy ? <span className="desk-spin" /> : null}
        {busy ? <span className="desk-note">{busyLabel}</span> : null}
      </div>
      <div className="desk-note">{sourcingNote}</div>
      {error ? <div className="desk-error" style={{ marginTop: '10px' }}>{error}</div> : null}
      {ok ? <div className="desk-ok" style={{ marginTop: '10px' }}>{ok}</div> : null}

      {reportedSummary ? (
        <div className="desk-panel" style={{ marginTop: '14px', background: 'var(--panel-2)' }}>
          <h3 style={{ marginBottom: '8px' }}>Found a reported summary in this file</h3>
          <div style={{ fontSize: '13px', lineHeight: 1.7 }}>
            {reportedSummary.totalValue !== null ? (
              <div>Total value: <span className="mono" style={{ fontWeight: 600 }}>{fmtMoney(reportedSummary.totalValue)}</span> — as of <strong>{reportedSummary.totalValueAsOf || 'unknown date'}</strong>, from "{reportedSummary.totalValueSheet}"</div>
            ) : null}
            {reportedSummary.equityWeightPct !== null || reportedSummary.fixedIncomeWeightPct !== null ? (
              <div>
                Allocation: <span className="mono" style={{ fontWeight: 600 }}>
                  Equity {reportedSummary.equityWeightPct !== null ? reportedSummary.equityWeightPct.toFixed(1) : '—'}% / Fixed income {reportedSummary.fixedIncomeWeightPct !== null ? reportedSummary.fixedIncomeWeightPct.toFixed(1) : '—'}%
                </span> — from "{reportedSummary.weightsSheet}"
              </div>
            ) : null}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', cursor: 'pointer', fontSize: '13px' }}>
            <input type="checkbox" checked={useReported} onChange={(e) => setUseReported(e.target.checked)} />
            Use this as the reported total value / allocation for this snapshot, instead of recalculating from the position sheets below
          </label>
        </div>
      ) : null}

      {candidates ? (
        <div style={{ marginTop: '14px' }}>
          {candidates.map((c) => (
            <div key={c.sheetName} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!checked[c.sheetName]}
                  style={{ marginTop: '3px' }}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [c.sheetName]: e.target.checked }))}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: '13.5px' }}>{c.sheetName}</span>
                  <span className="desk-tag" style={{ marginLeft: '8px' }}>{c.positions.length} position{c.positions.length === 1 ? '' : 's'}</span>
                  <div className="desk-note" style={{ marginTop: '2px' }}>{c.tickers.slice(0, 8).join(', ')}{c.tickers.length > 8 ? '…' : ''}</div>
                </span>
                <button
                  type="button"
                  className="desk-btn ghost"
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                  onClick={(ev) => { ev.preventDefault(); setExpanded((prev) => ({ ...prev, [c.sheetName]: !prev[c.sheetName] })); }}
                >
                  {expanded[c.sheetName] ? 'Hide data' : 'Check the numbers'}
                </button>
              </label>
              {expanded[c.sheetName] ? (
                <div style={{ marginTop: '8px', marginLeft: '22px', overflowX: 'auto' }}>
                  <table className="desk-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Ticker</th><th>Sleeve</th><th>Shares</th><th>Cost basis</th><th>Price</th><th>Value</th><th>Sector</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.positions.map((p, i) => {
                        const flag = flagPosition(p);
                        return (
                          <tr key={p.ticker + i}>
                            <td className="ticker">
                              {p.ticker}
                              {flag ? <span title={flag} style={{ marginLeft: '5px', color: 'var(--neg)' }}>⚠</span> : null}
                              {p.name ? <div className="desk-note" style={{ fontWeight: 400 }}>{p.name}</div> : null}
                            </td>
                            <td style={{ textAlign: 'left' }}>{SLEEVE_LABELS[p.sleeve] || p.sleeve}</td>
                            <td>{p.shares.toLocaleString()}</td>
                            <td>{fmtMoney(p.costBasis, { decimals: 2 })}</td>
                            <td>{fmtMoney(p.price, { decimals: 2 })}</td>
                            <td>{fmtMoney(valueOf(p))}</td>
                            <td style={{ textAlign: 'left' }}>{p.sector || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="desk-note" style={{ marginTop: '4px' }}>This is exactly what was read from "{c.sheetName}" — compare it against that sheet in your workbook before importing.</div>
                  {c.positions.some((p) => flagPosition(p)) ? (
                    <div className="desk-note" style={{ marginTop: '4px', color: 'var(--neg)' }}>⚠ One or more rows above look like they may have a cost-basis/currency mismatch — hover the warning icon for details.</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          <button className="desk-btn" style={{ marginTop: '12px' }} disabled={busy} onClick={confirmImport}>
            {busy ? (<><span className="desk-spin" />{busyLabel}</>) : ('Import selected sheets as ' + date + ' snapshot')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
