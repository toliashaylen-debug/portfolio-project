/**
 * Chart.js cannot read CSS custom properties, so the dark-theme palette lives
 * here as one source of truth rather than being hardcoded per chart. Every
 * value is chosen to stay legible on the navy surface the desk sits on.
 */
export const CHART = {
  /** Horizontal rules — present but not competing with the data. */
  grid: 'rgba(255,255,255,0.10)',
  /** Axis labels. */
  tick: 'rgba(255,255,255,0.48)',
  /** Legend labels. */
  legend: 'rgba(255,255,255,0.66)',

  /** Per-book series colours: gold, sky, mint. Distinguishable on navy and
   *  from each other, including for the common forms of colour blindness. */
  series: ['#D4B978', '#79ADE2', '#5FC79B'],

  /** Monte Carlo fan chart. */
  median: '#D4B978',
  band50: 'rgba(212,185,120,0.26)',
  band90: 'rgba(212,185,120,0.12)',

  /** Directional. Lightened from the light-theme pair so they carry on navy. */
  pos: '#4FBF8B',
  neg: '#E8798A',

  /** Benchmark reference line. */
  benchmark: '#79ADE2',
} as const;
