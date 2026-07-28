import { Line } from 'react-chartjs-2';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { BenchmarkSeriesPoint } from '../types';

export default function BenchmarkLineChart({ series, color, label }: { series: BenchmarkSeriesPoint[]; color: string; label: string }) {
  const data = {
    labels: series.map((p) => p.date),
    datasets: [{ label, data: series.map((p) => p.value), borderColor: color, borderWidth: 2, pointRadius: 0, fill: false }],
  };
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: TooltipItem<'line'>) => label + ': ' + Number(ctx.parsed.y).toLocaleString() } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#55647D', font: { size: 10 }, maxTicksLimit: 6 } },
      y: { grid: { color: '#D9E1EA' }, ticks: { color: '#55647D', font: { size: 11 } } },
    },
  };
  return (
    <div style={{ width: '100%', height: '180px', marginTop: 'var(--sp-4)' }}>
      <Line data={data} options={options} />
    </div>
  );
}
