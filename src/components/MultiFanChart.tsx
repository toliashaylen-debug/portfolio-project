import { Line } from 'react-chartjs-2';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { MonteCarloResult } from '../types';
import { fmtMoney, fmtPct } from '../lib/format';
import { CHART } from '../lib/chartTheme';

export interface MultiFanSeries {
  label: string;
  sim: MonteCarloResult;
}

/** Overlays each book's median 12-month projection on one chart — full fan bands per book would overlap into noise, so this shows the median paths only; each book's own page still has its full range. */
export default function MultiFanChart({ series }: { series: MultiFanSeries[] }) {
  if (!series.length) return null;
  const labels = series[0].sim.summary.map((p) => p.label);
  const quarterTicks = new Set([0, 3, 6, 9, 12]);

  const data = {
    labels,
    datasets: series.map((s, i) => ({
      label: s.label,
      data: s.sim.summary.map((p) => p.median),
      borderColor: CHART.series[i % CHART.series.length],
      backgroundColor: CHART.series[i % CHART.series.length],
      borderWidth: 2.2,
      pointRadius: 0,
      fill: false,
    })),
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top', labels: { color: CHART.legend, boxWidth: 12, padding: 14, font: { size: 11.5 } } },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => {
            const s = series[ctx.datasetIndex];
            const val = ctx.parsed.y ?? 0;
            const pct = (val - s.sim.totalValue) / s.sim.totalValue;
            return ctx.dataset.label + ': ' + fmtMoney(val) + ' (' + fmtPct(pct) + ')';
          },
        },
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
    <div style={{ width: '100%', height: '320px' }}>
      <Line data={data} options={options} />
    </div>
  );
}
