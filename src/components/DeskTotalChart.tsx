import { Bar } from 'react-chartjs-2';
import type { ChartOptions, TooltipItem } from 'chart.js';
import { fmtMoney } from '../lib/format';
import { CHART } from '../lib/chartTheme';

/** Desk-wide P&L per session, coloured by direction — the whole book at a glance. */
export default function DeskTotalChart({ points }: { points: { date: string; pnl: number }[] }) {
  if (points.length < 2) return null;

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => 'Desk: ' + (Number(ctx.parsed.y) >= 0 ? '+' : '') + fmtMoney(ctx.parsed.y),
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
    <div style={{ width: '100%', height: '200px' }}>
      <Bar
        data={{
          labels: points.map((p) => p.date),
          datasets: [{
            label: 'Desk',
            data: points.map((p) => p.pnl),
            backgroundColor: points.map((p) => (p.pnl >= 0 ? CHART.pos : CHART.neg)),
            borderWidth: 0,
            borderRadius: 2,
          }],
        }}
        options={options}
      />
    </div>
  );
}
