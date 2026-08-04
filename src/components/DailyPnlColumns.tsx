import { Chart } from 'react-chartjs-2';
import type { ChartOptions, ChartData, TooltipItem } from 'chart.js';
import type { DailyPnlSeries } from '../types';
import { fmtMoney } from '../lib/format';
import { CHART } from '../lib/chartTheme';
import { unionDates } from '../lib/dailyPnl';

const SERIES_COLORS = CHART.series;

/**
 * Session-by-session P&L per book, with each book's mean daily P&L drawn as a
 * dashed reference line so individual days can be read against the average.
 */
export default function DailyPnlColumns({ series }: { series: { name: string; data: DailyPnlSeries | null }[] }) {
  const dates = unionDates(series.map((s) => s.data));
  if (!dates.length) return null;

  const active = series.filter((s) => s.data && s.data.points.length);
  if (!active.length) return null;

  const bars = active.map((s, i) => {
    const byDate = new Map(s.data!.points.map((p) => [p.date, p.pnl]));
    return {
      type: 'bar' as const,
      label: s.name,
      data: dates.map((d) => byDate.get(d) ?? null),
      backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
      borderWidth: 0,
      borderRadius: 2,
      order: 2,
    };
  });

  const avgLines = active.map((s, i) => {
    const pts = s.data!.points;
    const mean = pts.reduce((acc, p) => acc + p.pnl, 0) / pts.length;
    return {
      type: 'line' as const,
      label: `${s.name} · avg ${(mean >= 0 ? '+' : '') + fmtMoney(mean)}`,
      data: dates.map(() => mean),
      borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
      borderWidth: 1.6,
      borderDash: [6, 4],
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      order: 1,
    };
  });

  const data = { labels: dates, datasets: [...bars, ...avgLines] } as ChartData<'bar' | 'line'>;

  const options: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rect', font: { size: 11 }, color: CHART.legend },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar' | 'line'>) =>
            ctx.dataset.label + ': ' + (Number(ctx.parsed.y) >= 0 ? '+' : '') + fmtMoney(ctx.parsed.y),
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: CHART.tick, font: { size: 10 }, maxTicksLimit: 8 } },
      y: {
        grid: { color: CHART.grid },
        ticks: {
          color: CHART.tick,
          font: { size: 10 },
          callback: (v) => (Number(v) >= 0 ? '+' : '') + '$' + Math.round(Number(v) / 1000) + 'k',
        },
      },
    },
  };

  return (
    <div style={{ width: '100%', height: '260px' }}>
      <Chart type="bar" data={data} options={options} />
    </div>
  );
}
