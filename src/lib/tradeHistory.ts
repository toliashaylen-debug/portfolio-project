import type { PortfolioId, RawSheet, RawSheetsBundle, TradeTransaction, TradeHistory, OpenPosition, ClosedPosition, Sleeve } from '../types';
import { PORTFOLIO_SOURCING } from './constants';
import { safeGet, safeSet } from './storage';
import { sheetAllowed } from './format';
import { extractTradeTransactions } from './ai';

export const tradeHistoryKey = (id: PortfolioId) => `tradehistory-${id}`;

export async function loadTradeHistory(id: PortfolioId): Promise<TradeHistory | null> {
  const raw = await safeGet(tradeHistoryKey(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TradeHistory;
    return parsed && Array.isArray(parsed.open) && Array.isArray(parsed.closed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface RealizedPLSummary {
  /** Sum of realized P&L across closed lots that stated one — never invented for lots that didn't. */
  total: number;
  /** How many closed lots contributed a real number, out of how many closed lots exist in total. */
  knownCount: number;
  totalCount: number;
}

/** No positions sold yet is a real, known zero — not the same thing as "sold, but P&L unstated." */
export function realizedPLSummary(closed: ClosedPosition[]): RealizedPLSummary {
  const known = closed.filter((c) => c.realizedPL !== null);
  return {
    total: known.reduce((s, c) => s + (c.realizedPL as number), 0),
    knownCount: known.length,
    totalCount: closed.length,
  };
}

/**
 * FIFO lot-matching: each sale is paired against the oldest still-open buy
 * lot(s) for that ticker, splitting across lots when a sale doesn't line up
 * exactly with one. A sale with no earlier tracked buy to consume (more sold
 * than this data ever recorded as bought — usually because the buy predates
 * the sheet's own history) is left unmatched rather than inventing a buy lot
 * for it.
 */
export function reconcileFifo(transactions: TradeTransaction[]): { open: OpenPosition[]; closed: ClosedPosition[] } {
  const byTicker = new Map<string, TradeTransaction[]>();
  transactions.forEach((t) => {
    if (!byTicker.has(t.ticker)) byTicker.set(t.ticker, []);
    byTicker.get(t.ticker)!.push(t);
  });

  const open: OpenPosition[] = [];
  const closed: ClosedPosition[] = [];

  byTicker.forEach((txs, ticker) => {
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const sleeve: Sleeve = sorted[0].sleeve;
    const name = sorted.find((t) => t.name)?.name ?? null;
    const lots: { date: string; shares: number; price: number | null }[] = [];

    sorted.forEach((t) => {
      if (t.side === 'buy') {
        lots.push({ date: t.date, shares: t.shares, price: t.price });
        return;
      }
      let remaining = t.shares;
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const consumed = Math.min(lot.shares, remaining);
        closed.push({
          ticker,
          name,
          sleeve,
          buyDate: lot.date,
          sellDate: t.date,
          shares: consumed,
          buyPrice: lot.price,
          sellPrice: t.price,
          realizedPL: t.realizedPL !== null && t.shares > 0 ? (t.realizedPL * consumed) / t.shares : null,
        });
        lot.shares -= consumed;
        remaining -= consumed;
        if (lot.shares <= 0) lots.shift();
      }
      // Any remaining un-matched sale quantity means this data never recorded
      // the buy that opened it — left out rather than fabricating a buy date.
    });

    lots.forEach((lot) => {
      if (lot.shares > 0) open.push({ ticker, name, sleeve, buyDate: lot.date, shares: lot.shares, buyPrice: lot.price });
    });
  });

  open.sort((a, b) => (b.buyDate || '').localeCompare(a.buyDate || ''));
  closed.sort((a, b) => b.sellDate.localeCompare(a.sellDate));
  return { open, closed };
}

interface TradeHistorySheets {
  mode: 'combined' | 'split';
  combined?: RawSheet[];
  buy?: RawSheet[];
  sell?: RawSheet[];
}

/**
 * Pulls whichever sheets a portfolio is permitted to source trade history
 * from. Some books keep buy and sell records in the same ledger; others (a
 * transaction log plus a separate working order book) need the two sides
 * read independently so the same sale is never double-counted.
 */
export async function sourceSheetsForTradeHistory(id: PortfolioId): Promise<{ sheets: TradeHistorySheets | null; error: string | null }> {
  const raw = await safeGet(`raw-${id}`);
  if (!raw) return { sheets: null, error: 'No uploaded workbook saved for this portfolio yet.' };
  let bundle: RawSheetsBundle;
  try {
    bundle = JSON.parse(raw);
  } catch {
    return { sheets: null, error: 'Could not read the saved workbook.' };
  }
  const all = bundle.sheets || [];
  const sourcing = PORTFOLIO_SOURCING[id];
  if (!sourcing) return { sheets: null, error: 'No trade history source configured for this portfolio.' };

  if (sourcing.tradeHistoryBuySheets || sourcing.tradeHistorySellSheets) {
    const buy = sourcing.tradeHistoryBuySheets ? all.filter((s) => sheetAllowed(s.sheetName, sourcing.tradeHistoryBuySheets)) : [];
    const sell = sourcing.tradeHistorySellSheets ? all.filter((s) => sheetAllowed(s.sheetName, sourcing.tradeHistorySellSheets)) : [];
    if (!buy.length && !sell.length) {
      return { sheets: null, error: 'Neither the designated buy-side nor sell-side sheet was found in the saved workbook.' };
    }
    return { sheets: { mode: 'split', buy, sell }, error: null };
  }

  const allowed = sourcing.tradeHistorySheets;
  if (!allowed) return { sheets: null, error: 'No trade history source configured for this portfolio.' };
  const combined = all.filter((s) => sheetAllowed(s.sheetName, allowed));
  if (!combined.length) {
    return { sheets: null, error: `This portfolio reads trade history only from "${allowed.join(' / ')}", and no such sheet is in the saved workbook.` };
  }
  return { sheets: { mode: 'combined', combined }, error: null };
}

export async function refreshTradeHistory(id: PortfolioId): Promise<TradeHistory> {
  const { sheets, error } = await sourceSheetsForTradeHistory(id);
  if (!sheets) throw new Error(error || 'No source sheet available.');

  let transactions: TradeTransaction[];
  if (sheets.mode === 'split') {
    const [buyTx, sellTx] = await Promise.all([
      sheets.buy && sheets.buy.length ? extractTradeTransactions(sheets.buy, 'buy') : Promise.resolve([]),
      sheets.sell && sheets.sell.length ? extractTradeTransactions(sheets.sell, 'sell') : Promise.resolve([]),
    ]);
    transactions = [...buyTx, ...sellTx];
  } else {
    transactions = await extractTradeTransactions(sheets.combined!);
  }

  const { open, closed } = reconcileFifo(transactions);
  const result: TradeHistory = {
    found: open.length > 0 || closed.length > 0,
    open,
    closed,
    extractedAt: new Date().toISOString().slice(0, 10),
  };
  await safeSet(tradeHistoryKey(id), JSON.stringify(result));
  return result;
}
