import * as XLSX from 'xlsx';
import type { RawSheet, SummarySheet, ReportedSummary, ReadWorkbookResult, PositionSheetCandidate, PortfolioSourcing } from '../types';
import { extractHoldingsViaAI } from './ai';
import { sheetAllowed } from './format';

export function trimGrid(aoa: (string | number | null)[][]): (string | number | null)[][] {
  let rows = aoa.filter((r) => r && r.some((c) => c !== null && c !== undefined && c !== ''));
  rows = rows.slice(0, 400);
  let maxCol = 0;
  rows.forEach((r) => {
    for (let i = r.length - 1; i >= 0; i--) {
      if (r[i] !== null && r[i] !== undefined && r[i] !== '') { maxCol = Math.max(maxCol, i + 1); break; }
    }
  });
  return rows.map((r) => r.slice(0, maxCol));
}

export function gridToTSV(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c))).join('\t')).join('\n');
}

export function readWorkbookSheets(file: File): Promise<RawSheet[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const sheets = wb.SheetNames.map((sheetName) => {
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, raw: true }) as (string | number | null)[][];
          return { sheetName, grid: trimGrid(aoa) };
        }).filter((s) => s.grid.length);
        if (!sheets.length) { reject(new Error('This workbook has no data in it.')); return; }
        resolve(sheets);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsArrayBuffer(file);
  });
}

function pickBestSummary(summarySheets: SummarySheet[], field: keyof SummarySheet): SummarySheet | null {
  const withField = summarySheets.filter((s) => s[field] !== null && s[field] !== undefined && !isNaN(s[field] as number));
  if (!withField.length) return null;
  const dated = withField.filter((s) => s.asOfDate && !isNaN(new Date(s.asOfDate).getTime()));
  if (dated.length) {
    dated.sort((a, b) => new Date(b.asOfDate as string).getTime() - new Date(a.asOfDate as string).getTime());
    return dated[0];
  }
  return withField[0];
}

function buildReportedSummary(summarySheets: SummarySheet[]): ReportedSummary | null {
  if (!summarySheets || !summarySheets.length) return null;
  const totalValueBest = pickBestSummary(summarySheets, 'totalValue');
  const equityPctBest = pickBestSummary(summarySheets, 'equityWeightPct');
  const fiPctBest = pickBestSummary(summarySheets, 'fixedIncomeWeightPct');
  const equityValBest = pickBestSummary(summarySheets, 'equityValue');
  const fiValBest = pickBestSummary(summarySheets, 'fixedIncomeValue');

  let equityWeightPct = equityPctBest ? equityPctBest.equityWeightPct : null;
  let fixedIncomeWeightPct = fiPctBest ? fiPctBest.fixedIncomeWeightPct : null;
  let weightsSheet = equityPctBest ? equityPctBest.sheetName : (fiPctBest ? fiPctBest.sheetName : null);

  if (equityWeightPct === null && fixedIncomeWeightPct === null && (equityValBest || fiValBest)) {
    const denom = (totalValueBest && totalValueBest.totalValue) || null;
    const eqVal = equityValBest ? equityValBest.equityValue : null;
    const fiVal = fiValBest ? fiValBest.fixedIncomeValue : null;
    const base = denom || ((eqVal || 0) + (fiVal || 0)) || null;
    if (base) {
      if (eqVal !== null) equityWeightPct = (eqVal / base) * 100;
      if (fiVal !== null) fixedIncomeWeightPct = (fiVal / base) * 100;
      weightsSheet = (equityValBest || fiValBest)!.sheetName;
    }
  }

  const sectorBest = summarySheets.find((s) => s.sectorWeights && s.sectorWeights.length) || null;

  if (!totalValueBest && equityWeightPct === null && fixedIncomeWeightPct === null && !sectorBest) return null;
  return {
    totalValue: totalValueBest ? totalValueBest.totalValue : null,
    totalValueAsOf: totalValueBest ? totalValueBest.asOfDate : null,
    totalValueSheet: totalValueBest ? totalValueBest.sheetName : null,
    equityWeightPct, fixedIncomeWeightPct, weightsSheet,
    sectorWeights: sectorBest ? sectorBest.sectorWeights : null,
    sectorWeightsSheet: sectorBest ? sectorBest.sheetName : null,
  };
}

function backfillSectors(positionSheets: PositionSheetCandidate[]): PositionSheetCandidate[] {
  const sectorByTicker: Record<string, string> = {};
  positionSheets.forEach((sheet) => {
    sheet.positions.forEach((p) => {
      if (p.sector && p.sector.trim() && !sectorByTicker[p.ticker]) {
        sectorByTicker[p.ticker] = p.sector.trim();
      }
    });
  });
  return positionSheets.map((sheet) => ({
    ...sheet,
    positions: sheet.positions.map((p) => (p.sector && p.sector.trim() ? p : { ...p, sector: sectorByTicker[p.ticker] || p.sector })),
  }));
}

export async function readWorkbook(file: File, sourcing?: PortfolioSourcing | null): Promise<ReadWorkbookResult> {
  const rawSheets = await readWorkbookSheets(file);
  const { positionSheets, summarySheets } = await extractHoldingsViaAI(rawSheets);
  if (!positionSheets.length) throw new Error('The AI reader could not find any holdings in this file.');
  const allowedSummary = sourcing?.summarySheets;
  const restrictedSummary = allowedSummary ? summarySheets.filter((s) => sheetAllowed(s.sheetName, allowedSummary)) : summarySheets;
  return {
    positionSheets: backfillSectors(positionSheets),
    reportedSummary: buildReportedSummary(restrictedSummary),
    rawSheets,
  };
}
