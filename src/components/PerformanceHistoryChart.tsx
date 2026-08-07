import { Line } from 'react-chartjs-2';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { DailyPnlPoint } from '../types';
import { fmtMoney, fmtPct } from '../lib/format';
import { CHART } from '../lib/chartTheme';

/** Value at each date, inception point first — a non-positive endingValue means the sheet had no usable market-value figure for that date, so it's dropped rather than plotted as a real $0 portfolio. */
export default function PerformanceHistoryChart({
  points,
  inceptionDate,
  startingBalance,
}: {
  points: DailyPnlPoint[];
  inceptionDate: string;
  startingBalance: number;
}) {
  const usable = points.filter((p) => p.endingValue !== null && p.endingValue > 0);
  const series = [{ date: inceptionDate, value: startingBalance }, ...usable.map((p) => ({ date: p.date, value: p.endingValue as number }))];
  if (series.length < 2) return null;

  const data = {
    labels: series.map((p) => p.date),
    datasets: [{
      label: 'Portfolio value',
      data: series.map((p) => p.value),
      borderColor: CHART.median,
      backgroundColor: CHART.median,
      borderWidth: 2.2,
      pointRadius: 2,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.1,
    }],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => {
            const val = ctx.parsed.y ?? 0;
            const pct = (val - startingBalance) / startingBalance;
            return fmtMoney(val) + ' (' + fmtPct(pct) + ')';
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: CHART.tick, font: { size: 10 }, maxTicksLimit: 10 } },
      y: { grid: { color: CHART.grid }, ticks: { color: CHART.tick, font: { size: 11 }, callback: (v) => '$' + Math.round(Number(v) / 1000) + 'k' } },
    },
  };

  return (
    <div style={{ width: '100%', height: '280px' }}>
      <Line data={data} options={options} />
    </div>
  );
}
