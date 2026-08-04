import { Line } from 'react-chartjs-2';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { MonteCarloResult } from '../types';
import { fmtMoney } from '../lib/format';
import { CHART } from '../lib/chartTheme';

export default function FanChart({ sim }: { sim: MonteCarloResult }) {
  const labels = sim.summary.map((p) => p.label);
  const quarterTicks = new Set([0, 3, 6, 9, 12]);

  const data = {
    labels,
    datasets: [
      { label: '5th pct', data: sim.summary.map((p) => p.p5), borderColor: 'transparent', pointRadius: 0, fill: false, order: 5 },
      { label: '95th pct', data: sim.summary.map((p) => p.p95), borderColor: 'transparent', backgroundColor: CHART.band90, pointRadius: 0, fill: '-1' as const, order: 4 },
      { label: '25th pct', data: sim.summary.map((p) => p.p25), borderColor: 'transparent', pointRadius: 0, fill: false, order: 3 },
      { label: '75th pct', data: sim.summary.map((p) => p.p75), borderColor: 'transparent', backgroundColor: CHART.band50, pointRadius: 0, fill: '-1' as const, order: 2 },
      { label: 'Median', data: sim.summary.map((p) => p.median), borderColor: CHART.median, borderWidth: 2.2, pointRadius: 0, fill: false, order: 1 },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: (item: TooltipItem<'line'>) => ['Median', '5th pct', '95th pct', '25th pct', '75th pct'].includes(item.dataset.label || ''),
        callbacks: { label: (ctx: TooltipItem<'line'>) => ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y) },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: CHART.tick, font: { size: 11 }, callback: (_val, idx) => (quarterTicks.has(idx) ? labels[idx] : '') },
      },
      y: {
        grid: { color: CHART.grid },
        ticks: { color: CHART.tick, font: { size: 11 }, callback: (v) => '$' + Math.round(Number(v) / 1000) + 'k' },
      },
    },
  };

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <Line data={data} options={options} />
    </div>
  );
}
