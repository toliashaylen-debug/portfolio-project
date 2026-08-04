import { useEffect, useState } from 'react';
import type { ConfigsById, Histories, History, PortfolioId, RawSheetsBundle } from '../types';
import { PORTFOLIO_SOURCING } from '../lib/constants';
import { portfolioMetrics } from '../lib/compute';
import { fmtMoney, fmtPct, sheetAllowed } from '../lib/format';
import { callClaude } from '../lib/ai';
import { safeGet } from '../lib/storage';
import { gridToTSV } from '../lib/workbook';
import CompositionPanel from '../components/CompositionPanel';
import PositionsTable from '../components/PositionsTable';
import RawSheetViewer from '../components/RawSheetViewer';
import UploadPanel from '../components/UploadPanel';

export default function PortfolioPage({ id, configs, histories, onHistoryChange, onStrategyChange, onNameChange }: {
  id: PortfolioId;
  configs: ConfigsById;
  histories: Histories;
  onHistoryChange: (id: PortfolioId, newHist: History) => void;
  onStrategyChange: (id: PortfolioId, strategy: string) => void;
  onNameChange: (id: PortfolioId, name: string) => void;
}) {
  const cfg = configs[id];
  const [currentHistory, setCurrentHistory] = useState<History>(histories[id] || []);

  // Live sync: pick up another device's upload to this same portfolio
  // without disturbing this page's own in-progress name/strategy edits or
  // the mounted UploadPanel/RawSheetViewer instances.
  useEffect(() => {
    setCurrentHistory(histories[id] || []);
  }, [histories, id]);

  const [nameDraft, setNameDraft] = useState(cfg.name);
  const [nameSaved, setNameSaved] = useState(cfg.name);

  const [strategyDraft, setStrategyDraft] = useState(cfg.strategy);
  const [strategySaved, setStrategySaved] = useState(cfg.strategy);
  const [suggesting, setSuggesting] = useState(false);
  const [aiError, setAiError] = useState('');

  async function suggestStrategy() {
    if (!currentHistory.length) return;
    setSuggesting(true); setAiError('');
    try {
      const latest = currentHistory[currentHistory.length - 1];
      const holdingsList = latest.positions.map((p) => p.ticker + (p.sector ? ' (' + p.sector + ')' : '') + ': ' + p.shares + ' sh').join(', ');

      // Some portfolios also permit the trade-by-trade log (thesis/rationale
      // text) as extra context for this suggestion — everyone else keeps the
      // holdings-only prompt used before this existed.
      let extraContext = '';
      const contextSheets = PORTFOLIO_SOURCING[id]?.strategyContextSheets;
      if (contextSheets) {
        try {
          const raw = await safeGet('raw-' + id);
          if (raw) {
            const bundle: RawSheetsBundle = JSON.parse(raw);
            const allowed = (bundle.sheets || []).filter((s) => sheetAllowed(s.sheetName, contextSheets));
            if (allowed.length) {
              extraContext = '\n\nAdditional source material (use only what is factually relevant, do not invent beyond it):\n' +
                allowed.map((s) => `<sheet name="${s.sheetName}">\n${gridToTSV(s.grid.slice(0, 60))}\n</sheet>`).join('\n\n');
            }
          }
        } catch { /* extra context is optional — fall back to holdings only */ }
      }

      const prompt = `Here are the holdings of an investment portfolio: ${holdingsList}.${extraContext}\n\nIn one short sentence (under 20 words), describe the investment strategy or style this portfolio reflects (e.g. barbell, growth, value, income, sector-concentrated). Respond with only the sentence, no preamble.`;
      const text = await callClaude(prompt, 100);
      setStrategyDraft(text.replace(/^"|"$/g, ''));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not reach the AI.');
    } finally {
      setSuggesting(false);
    }
  }

  const m = portfolioMetrics(currentHistory);
  const weightMode = PORTFOLIO_SOURCING[id] ? PORTFOLIO_SOURCING[id]!.weightMode : 'value';
  const latest = currentHistory.length > 0 ? currentHistory[currentHistory.length - 1] : null;

  return (
    <div>
      <div className="desk-row" style={{ alignItems: 'baseline', gap: '10px' }}>
        <input
          className="desk-input display"
          style={{ fontSize: '22px', fontWeight: 600, padding: '4px 8px', minWidth: '220px' }}
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
        />
        <button
          className="desk-btn ghost"
          style={{ padding: '4px 10px', fontSize: '12px' }}
          onClick={() => { if (nameDraft.trim()) { onNameChange(id, nameDraft.trim()); setNameSaved(nameDraft.trim()); } }}
          disabled={!nameDraft.trim() || nameDraft.trim() === nameSaved}
        >
          Rename
        </button>
      </div>

      <RawSheetViewer portfolioId={id} />

      <div>
        <div className="desk-sub">{m ? 'Last snapshot: ' + m.lastDate : 'No snapshots yet'}</div>
        {latest ? (
          <CompositionPanel
            positions={latest.positions}
            themes={latest.themes}
            reported={latest.reported}
            weightMode={weightMode}
            preferReportedSectorWeights={!!PORTFOLIO_SOURCING[id]?.preferReportedSectorWeights}
          />
        ) : null}
        {m ? (
          <div className="desk-grid3">
            <div className="desk-card">
              <div className="desk-card-name">Value</div>
              <div className="desk-card-value mono">{fmtMoney(m.displayValue)}</div>
              {m.reported && m.reported.totalValue !== null ? (
                <div className="desk-note" style={{ marginTop: '4px' }}>reported as of {m.reported.totalValueAsOf || m.lastDate}</div>
              ) : null}
            </div>
            <div className="desk-card">
              <div className="desk-card-name">Day change</div>
              <div className="desk-card-value mono" style={{ color: (m.dayChangeDollar ?? 0) > 0 ? 'var(--pos)' : (m.dayChangeDollar ?? 0) < 0 ? 'var(--neg)' : 'var(--text-dim)' }}>
                {m.dayChangeDollar === null ? '—' : fmtMoney(m.dayChangeDollar)}
              </div>
              <div className="desk-mini-row"><span>{m.dayChangePct === null ? 'first snapshot' : fmtPct(m.dayChangePct)}</span></div>
            </div>
            <div className="desk-card">
              <div className="desk-card-name">Unrealized P&amp;L</div>
              <div className="desk-card-value mono" style={{ color: m.totalPL >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtMoney(m.totalPL)}</div>
            </div>
          </div>
        ) : null}
        {m ? (
          <div className="desk-panel">
            <h3>Positions</h3>
            <PositionsTable positions={m.positions} />
          </div>
        ) : null}
      </div>

      <div className="desk-panel">
        <h3>Strategy</h3>
        <div className="desk-row">
          <input className="desk-input" style={{ flex: 1, minWidth: '260px' }} value={strategyDraft} onChange={(e) => setStrategyDraft(e.target.value)} />
          <button
            className="desk-btn ghost"
            onClick={() => { onStrategyChange(id, strategyDraft); setStrategySaved(strategyDraft); }}
            disabled={strategyDraft === strategySaved}
          >
            Save
          </button>
          <button className="desk-btn ghost" onClick={suggestStrategy} disabled={suggesting || !currentHistory.length}>
            {suggesting ? (<><span className="desk-spin" />Thinking…</>) : 'AI: suggest label'}
          </button>
        </div>
        {aiError ? <div className="desk-error" style={{ marginTop: '10px' }}>{aiError}</div> : null}
      </div>

      <UploadPanel
        portfolioId={id}
        onSaved={(newHist) => {
          setCurrentHistory(newHist);
          onHistoryChange(id, newHist);
        }}
      />
    </div>
  );
}
