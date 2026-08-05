import { useEffect, useState } from 'react';
import type { ConfigsById, Histories, History, PortfolioId, RawSheetsBundle, TradeHistory, RealizedPLResult } from '../types';
import { PORTFOLIO_SOURCING } from '../lib/constants';
import { portfolioMetrics } from '../lib/compute';
import { fmtMoney, fmtPct, sheetAllowed } from '../lib/format';
import { callClaude } from '../lib/ai';
import { safeGet, onKeyChange } from '../lib/storage';
import { gridToTSV } from '../lib/workbook';
import { loadTradeHistory, refreshTradeHistory, tradeHistoryKey } from '../lib/tradeHistory';
import { loadRealizedPL, refreshRealizedPL, realizedPLKey } from '../lib/realizedPL';
import CompositionPanel from '../components/CompositionPanel';
import PositionsTable from '../components/PositionsTable';
import TradeHistoryPanel from '../components/TradeHistoryPanel';
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

  const [tradeHistory, setTradeHistory] = useState<TradeHistory | null>(null);
  const [thBusy, setThBusy] = useState(false);
  const [thError, setThError] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadTradeHistory(id).then((t) => { if (!cancelled) setTradeHistory(t); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    return onKeyChange(tradeHistoryKey(id), (v) => setTradeHistory(v ? JSON.parse(v) : null));
  }, [id]);

  async function readTradeHistory() {
    setThBusy(true); setThError('');
    try {
      const t = await refreshTradeHistory(id);
      setTradeHistory(t);
    } catch (e) {
      setThError(e instanceof Error ? e.message : 'Could not read the trade history.');
    } finally {
      setThBusy(false);
    }
  }

  // Realized P&L is deliberately decoupled from trade history: it's summed
  // only from columns/sections a sheet explicitly labels as realized P&L,
  // never derived from the FIFO buy/sell matching above — and for some
  // books the two features even draw from different sheets.
  const [realizedPL, setRealizedPL] = useState<RealizedPLResult | null>(null);
  const [rpBusy, setRpBusy] = useState(false);
  const [rpError, setRpError] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadRealizedPL(id).then((r) => { if (!cancelled) setRealizedPL(r); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    return onKeyChange(realizedPLKey(id), (v) => setRealizedPL(v ? JSON.parse(v) : null));
  }, [id]);

  async function readRealizedPL() {
    setRpBusy(true); setRpError('');
    try {
      const r = await refreshRealizedPL(id);
      setRealizedPL(r);
    } catch (e) {
      setRpError(e instanceof Error ? e.message : 'Could not read realized P&L.');
    } finally {
      setRpBusy(false);
    }
  }

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
          <div className="desk-grid4">
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
            <div className="desk-card">
              <div className="desk-card-name">Realized P&amp;L</div>
              {realizedPL ? (
                <div className="desk-card-value mono" style={{ color: realizedPL.total >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {fmtMoney(realizedPL.total)}
                </div>
              ) : (
                <div className="desk-note" style={{ marginTop: '4px' }}>Not read yet</div>
              )}
              <button
                className="desk-btn ghost"
                style={{ marginTop: 'var(--sp-2)', padding: '4px 10px', fontSize: '11.5px' }}
                onClick={readRealizedPL}
                disabled={rpBusy}
              >
                {rpBusy ? (<><span className="desk-spin" />Reading…</>) : (realizedPL ? 'Refresh' : 'Read realized P&L')}
              </button>
              {rpError ? <div className="desk-error" style={{ marginTop: 'var(--sp-2)', fontSize: '11.5px', padding: '6px 8px' }}>{rpError}</div> : null}
            </div>
          </div>
        ) : null}
        {m ? (
          <div className="desk-panel">
            <h3>Positions</h3>
            <PositionsTable positions={m.positions} />
          </div>
        ) : null}
        {PORTFOLIO_SOURCING[id]?.tradeHistorySheets || PORTFOLIO_SOURCING[id]?.tradeHistoryBuySheets || PORTFOLIO_SOURCING[id]?.tradeHistorySellSheets ? (
          <>
            <div className="desk-panel">
              <div className="desk-panel-head">
                <h3>Trade history</h3>
                <button className="desk-btn ghost" onClick={readTradeHistory} disabled={thBusy}>
                  {thBusy ? (<><span className="desk-spin" />Reading the trade log…</>) : (tradeHistory ? 'Refresh' : 'Read trade history')}
                </button>
              </div>
              {!tradeHistory ? (
                <div className="desk-note" style={{ marginTop: 0 }}>Not read yet — press the button above to pull buy and sell dates from the trade log.</div>
              ) : null}
              {thError ? <div className="desk-error" style={{ marginTop: tradeHistory ? '0' : 'var(--sp-3)' }}>{thError}</div> : null}
            </div>
            {tradeHistory ? (
              <TradeHistoryPanel
                open={tradeHistory.open}
                closed={tradeHistory.closed}
                sellDateCaveat={PORTFOLIO_SOURCING[id]?.tradeHistorySellDateCaveat}
              />
            ) : null}
          </>
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
