export function normSheetName(s: string | null | undefined): string {
  return String(s || '').trim().toLowerCase();
}

export function sheetAllowed(sheetName: string, allowedList: string[] | null | undefined): boolean {
  if (!allowedList) return true;
  const n = normSheetName(sheetName);
  return allowedList.some((a) => { const na = normSheetName(a); return n === na || n.includes(na); });
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtMoney(n: number | null | undefined, opts: { decimals?: number } = {}): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const dec = opts.decimals === undefined ? 0 : opts.decimals;
  return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return sign + (n * 100).toFixed(2) + '%';
}

export function chipClass(n: number | null | undefined): 'flat' | 'up' | 'down' {
  if (n === null || n === undefined || isNaN(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

export function cleanProse(text: string | null | undefined): string {
  if (!text) return text || '';
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
