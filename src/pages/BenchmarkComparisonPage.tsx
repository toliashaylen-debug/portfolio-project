import { useEffect, useState } from 'react';
import type { PortfolioConfig, RawSheet, BenchmarkComparison, PortfolioId } from '../types';
import { PORTFOLIO_SOURCING } from '../lib/constants';
import { safeGet, onKeyChange } from '../lib/storage';
import { sheetAllowed } from '../lib/format';
import { extractBenchmarkComparison } from '../lib/ai';
import { loadBenchmarkComparison, saveBenchmarkComparison, benchmarkComparisonKey } from '../lib/benchmarkComparison';
import ComparisonBlock from '../components/ComparisonBlock';

export default function BenchmarkComparisonPage({ id, cfg }: { id: PortfolioId; cfg: PortfolioConfig }) {
  const sourcing = PORTFOLIO_SOURCING[id] || null;
  const [rawSheets, setRawSheets] = useState<RawSheet[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<BenchmarkComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Persisted so a previously-generated comparison survives navigating away
  // and back, and so the Overview page can read the same figures (e.g.
  // Sharpe ratio) without re-running the extraction itself.
  useEffect(() => {
    let cancelled = false;
    loadBenchmarkComparison(id).then((c) => { if (!cancelled) setComparison(c); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    return onKeyChange(benchmarkComparisonKey(id), (v) => setComparison(v ? JSON.parse(v) : null));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRawSheets(null); setLoadError(''); setError('');
    (async () => {
      try {
        const raw = await safeGet('raw-' + id);
        if (!raw) { if (!cancelled) setLoadError('No original file saved for this portfolio yet — it saves the next time you upload.'); return; }
        const parsed = JSON.parse(raw);
        const allSheets: RawSheet[] = parsed.sheets || [];
        const restricted = sourcing && sourcing.benchmarkSheets ? allSheets.filter((s) => sheetAllowed(s.sheetName, sourcing.benchmarkSheets)) : allSheets;
        if (!restricted.length) {
          if (!cancelled) {
            setLoadError(sourcing && sourcing.benchmarkSheets
              ? ('No sheet named "' + sourcing.benchmarkSheets.join(' / ') + '" was found in the saved file.')
              : 'No sheet data available for this portfolio yet.');
          }
          return;
        }
        if (!cancelled) setRawSheets(restricted);
      } catch {
        if (!cancelled) setLoadError('Could not load the saved file.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, sourcing]);

  // Live sync: another device's upload can newly supply (or replace) the raw
  // benchmark sheet — refresh availability, but leave any already-generated
  // comparison as-is until "Regenerate comparison" is clicked.
  useEffect(() => {
    return onKeyChange('raw-' + id, (value) => {
      if (!value) {
        setRawSheets(null);
        setLoadError('No original file saved for this portfolio yet — it saves the next time you upload.');
        return;
      }
      try {
        const parsed = JSON.parse(value);
        const allSheets: RawSheet[] = parsed.sheets || [];
        const restricted = sourcing && sourcing.benchmarkSheets ? allSheets.filter((s) => sheetAllowed(s.sheetName, sourcing.benchmarkSheets)) : allSheets;
        if (!restricted.length) {
          setRawSheets(null);
          setLoadError(sourcing && sourcing.benchmarkSheets
            ? ('No sheet named "' + sourcing.benchmarkSheets.join(' / ') + '" was found in the saved file.')
            : 'No sheet data available for this portfolio yet.');
          return;
        }
        setRawSheets(restricted);
        setLoadError('');
      } catch {
        setLoadError('Could not load the saved file.');
      }
    });
  }, [id, sourcing]);

  async function generate() {
    if (!rawSheets) return;
    setBusy(true); setError('');
    try {
      const result = await extractBenchmarkComparison(rawSheets);
      setComparison(result);
      await saveBenchmarkComparison(id, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the comparison.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="display">{cfg.name} compared to the Benchmark</h2>
      <div className="desk-sub">
        {sourcing && sourcing.benchmarkSheets
          ? ('Equity vs. S&P 500, fixed income vs. LQD — read strictly from the "' + sourcing.benchmarkSheets.join(' / ') + '" sheet.')
          : "Equity vs. S&P 500, fixed income vs. LQD — read from this portfolio's available sheet."}
      </div>

      {loading ? (
        <div className="desk-note">Loading saved file…</div>
      ) : loadError ? (
        <div className="desk-error">{loadError}</div>
      ) : (
        <>
          <div className="desk-panel">
            <button className="desk-btn" onClick={generate} disabled={busy}>
              {busy ? (<><span className="desk-spin" />Reading the benchmark sheet…</>) : (comparison ? 'Regenerate comparison' : 'Generate benchmark comparison')}
            </button>
            {error ? <div className="desk-error" style={{ marginTop: 'var(--sp-3)' }}>{error}</div> : null}
          </div>
          {comparison ? (
            !comparison.found ? (
              <div className="desk-panel">
                <div className="desk-note">
                  No benchmark comparison data was found in {comparison.sheetUsed ? ('"' + comparison.sheetUsed + '"') : 'the available sheet'} — waiting on further instruction for how to source this comparison for this portfolio.
                </div>
              </div>
            ) : (
              <>
                {comparison.periodStart || comparison.periodEnd ? (
                  <div className="desk-note">Period: {comparison.periodStart || '—'} to {comparison.periodEnd || '—'}</div>
                ) : null}
                <ComparisonBlock title="Equity vs. S&P 500" data={comparison.equity} sleeveLabel="Equity" />
                <ComparisonBlock title="Fixed income vs. LQD" data={comparison.fixedIncome} sleeveLabel="Fixed income" />
              </>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
