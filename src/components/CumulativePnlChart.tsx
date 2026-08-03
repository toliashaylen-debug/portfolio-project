import { Line } from 'react-chartjs-2';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { DailyPnlSeries } from '../types';
import { fmtMoney } from '../lib/format';
import { cumulative, unionDates } from '../lib/dailyPnl';

const SERIES_COLORS = ['#0E2C4F', '#B4924C', '#17784C'];

/**
 * Cumulative P&L per book on a shared axis — shows who is ahead and how the
 * gap has moved, which a paragraph of prose conveys far less directly.
 */
export default function CumulativePnlChart({ series }: { series: { name: string; data: DailyPnlSeries | null }[] }) {
  const dates = unionDates(series.map((s) => s.data));
  if (dates.length < 2) return null;

  const datasets = series
    .filter((s) => s.data && s.data.points.length)
    .map((s, i) => {
      const cum = cumulative(s.data!.points);
      const byDate = new Map(cum.map((p) => [p.date, p.value]));
      // Carry the running total forward across dates a book didn't trade, so
      // lines stay comparable rather than dropping to zero on gaps.
      let last: number | null = null;
      const data = dates.map((d) => {
        if (byDate.has(d)) last = byDate.get(d)!;
        return last;
      });
      return {
        label: s.name,
        data,
        borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
        backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        spanGaps: true,
        tension: 0.15,
      };
    });

  if (!datasets.length) return null;

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
    <div style={{ width: '100%', height: '260px' }}>
      <Line data={{ labels: dates, datasets }} options={options} />
    </div>
  );
}
