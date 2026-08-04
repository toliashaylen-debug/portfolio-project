import { Line } from 'react-chartjs-2';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { DailyPnlSeries } from '../types';
import { fmtMoney } from '../lib/format';
import { cumulative, unionDates } from '../lib/dailyPnl';

const SERIES_COLORS = ['#0E2C4F', '#B4924C', '#17784C'];

/**
 * Cumulative P&L per book on a shared axis, each with a dashed "average pace"
 * line — a straight path accumulating that book's mean daily P&L. Where the
 * solid line sits above its dashed counterpart, the book is running ahead of
 * its own average; below, behind it.
 */
export default function CumulativePnlChart({ series }: { series: { name: string; data: DailyPnlSeries | null }[] }) {
  const dates = unionDates(series.map((s) => s.data));
  if (dates.length < 2) return null;

  const active = series.filter((s) => s.data && s.data.points.length);
  if (!active.length) return null;

  // Carry the running total forward across dates a book didn't trade, so lines
  // stay comparable rather than dropping to zero on gaps.
  const carryForward = (byDate: Map<string, number>) => {
    let last: number | null = null;
    return dates.map((d) => {
      if (byDate.has(d)) last = byDate.get(d)!;
      return last;
    });
  };

  const actual = active.map((s, i) => ({
    label: s.name,
    data: carryForward(new Map(cumulative(s.data!.points).map((p) => [p.date, p.value]))),
    borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
    backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    fill: false,
    spanGaps: true,
    tension: 0.15,
    order: 1,
  }));

  const avgPace = active.map((s, i) => {
    const pts = s.data!.points;
    const mean = pts.reduce((acc, p) => acc + p.pnl, 0) / pts.length;
    // The k-th session of this book sits at mean * k on a steady-average path.
    const byDate = new Map(pts.map((p, k) => [p.date, mean * (k + 1)]));
    return {
      label: `${s.name} · avg pace`,
      data: carryForward(byDate),
      borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
      backgroundColor: 'transparent',
      borderWidth: 1.4,
      borderDash: [6, 4],
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      spanGaps: true,
      order: 2,
    };
  });

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'line', font: { size: 11 }, color: '#56637A' },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'line'>) =>
            ctx.dataset.label + ': ' + (Number(ctx.parsed.y) >= 0 ? '+' : '') + fmtMoney(ctx.parsed.y),
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#8A94A6', font: { size: 10 }, maxTicksLimit: 8 } },
      y: {
        grid: { color: '#EDF0F4' },
        ticks: {
          color: '#8A94A6',
          font: { size: 10 },
          callback: (v) => (Number(v) >= 0 ? '+' : '') + '$' + Math.round(Number(v) / 1000) + 'k',
        },
      },
    },
  };

  return (
    <div style={{ width: '100%', height: '280px' }}>
      <Line data={{ labels: dates, datasets: [...actual, ...avgPace] }} options={options} />
    </div>
  );
}
