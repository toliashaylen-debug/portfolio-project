import { useEffect, useRef, useState } from 'react';
import type { RawSheetsBundle } from '../types';
import { safeGet, onKeyChange } from '../lib/storage';

export default function RawSheetViewer({ portfolioId }: { portfolioId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<RawSheetsBundle | null>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  async function load() {
    setOpen(true);
    if (data) return;
    setLoading(true);
    setError('');
    try {
      const raw = await safeGet('raw-' + portfolioId);
      if (!raw) { setError('No original file saved for this portfolio yet — it saves the next time you upload.'); return; }
      const parsed: RawSheetsBundle = JSON.parse(raw);
      setData(parsed);
      setActiveSheet(parsed.sheets[0] ? parsed.sheets[0].sheetName : null);
    } catch {
      setError('Could not load the saved file.');
    } finally {
      setLoading(false);
    }
  }

  // Live sync: another device's upload invalidates our cached copy. If this
  // panel is currently open, refresh it in place; otherwise just drop the
  // cache so the next "View original spreadsheet" click fetches fresh.
  useEffect(() => {
    const unsub = onKeyChange('raw-' + portfolioId, (value) => {
      if (!value) { setData(null); return; }
      if (!openRef.current) { setData(null); return; }
      try {
        const parsed: RawSheetsBundle = JSON.parse(value);
        setData(parsed);
        setActiveSheet(parsed.sheets[0] ? parsed.sheets[0].sheetName : null);
        setError('');
      } catch {
        setError('Could not load the saved file.');
      }
    });
    return unsub;
  }, [portfolioId]);

  const active = data ? data.sheets.filter((s) => s.sheetName === activeSheet)[0] : null;

  return (
    <div className="desk-panel">
      <div className="desk-panel-head" style={{ marginBottom: open ? 'var(--sp-4)' : '0' }}>
        <h3>Original file</h3>
        <button className="desk-btn ghost" onClick={() => (open ? setOpen(false) : load())}>
          {open ? 'Hide' : 'View original spreadsheet'}
        </button>
      </div>
      {open && loading ? <div className="desk-note" style={{ marginTop: '10px' }}>Loading…</div> : null}
      {open && !loading && error ? <div className="desk-error" style={{ marginTop: '10px' }}>{error}</div> : null}
      {open && !loading && !error && data ? (
        <div style={{ marginTop: '12px' }}>
          <div className="desk-note" style={{ marginBottom: '10px' }}>
            Exactly as uploaded for {data.date} — every sheet in the workbook, including ones not used for positions.
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {data.sheets.map((s) => (
              <button
                key={s.sheetName}
                className="desk-btn ghost"
                style={{ padding: '4px 10px', fontSize: '12px', background: activeSheet === s.sheetName ? 'var(--panel-2)' : 'transparent' }}
                onClick={() => setActiveSheet(s.sheetName)}
              >
                {s.sheetName}
              </button>
            ))}
          </div>
          {active ? (
            <div style={{ overflow: 'auto', maxHeight: '420px', border: '1px solid var(--border)', borderRadius: '4px' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '11.5px', fontFamily: 'JetBrains Mono, monospace', width: '100%' }}>
                <tbody>
                  {active.grid.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap', color: ri === 0 ? 'var(--accent)' : 'var(--text)' }}
                        >
                          {cell === null || cell === undefined ? '' : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
