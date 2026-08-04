import { Bar } from 'react-chartjs-2';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { DailyPnlSeries } from '../types';
import { fmtMoney } from '../lib/format';
import { unionDates } from '../lib/dailyPnl';

const SERIES_COLORS = ['#0E2C4F', '#B4924C', '#17784C'];

/** Session-by-session P&L per book — shows the rhythm of winning and losing days. */
export default function DailyPnlColumns({ series }: { series: { name: string; data: DailyPnlSeries | null }[] }) {
  const dates = unionDates(series.map((s) => s.data));
  if (!dates.length) return null;

  const datasets = series
    .filter((s) => s.data && s.data.points.length)
    .map((s, i) => {
      const byDate = new Map(s.data!.points.map((p) => [p.date, p.pnl]));
      return {
        label: s.name,
        data: dates.map((d) => byDate.get(d) ?? null),
        backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
        borderWidth: 0,
        borderRadius: 2,
      };
    });
  if (!datasets.length) return null;

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rect', font: { size: 11 }, color: '#56637A' },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) =>
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
    <div style={{ width: '100%', height: '240px' }}>
      <Bar data={{ labels: dates, datasets }} options={options} />
    </div>
  );
}
