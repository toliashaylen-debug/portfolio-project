/**
 * A stylised, non-interactive impression of the desk for the homepage hero.
 * Deliberately schematic rather than a screenshot of live figures: no real
 * portfolio values are shown to anyone who has not signed in.
 */
export default function HeroPreview() {
  const bars = [38, 52, 30, 61, 44, 72, 55, 80];
  const line = [58, 52, 60, 46, 50, 38, 42, 30, 34, 24, 28, 18];

  return (
    <div className="hero-preview" aria-hidden="true">
      <div className="hero-preview-chrome">
        <span className="hero-preview-dot" />
        <span className="hero-preview-dot" />
        <span className="hero-preview-dot" />
        <span className="hero-preview-title">Overview</span>
      </div>

      <div className="hero-preview-body">
        <div className="hero-preview-rail">
          <div className="hero-preview-rail-item active" />
          <div className="hero-preview-rail-item" />
          <div className="hero-preview-rail-item" />
          <div className="hero-preview-rail-item" />
          <div className="hero-preview-rail-gap" />
          <div className="hero-preview-rail-item" />
          <div className="hero-preview-rail-item" />
        </div>

        <div className="hero-preview-main">
          <div className="hero-preview-tiles">
            {[
              { w: '62%', accent: 'var(--gold)' },
              { w: '48%', accent: '#3E7D5F' },
              { w: '55%', accent: 'rgba(255,255,255,0.4)' },
            ].map((t, i) => (
              <div className="hero-preview-tile" key={i}>
                <div className="hero-preview-tile-label" />
                <div className="hero-preview-tile-value" style={{ width: t.w, background: t.accent }} />
                <div className="hero-preview-tile-sub" />
              </div>
            ))}
          </div>

          <div className="hero-preview-charts">
            <div className="hero-preview-chart">
              <svg viewBox="0 0 120 54" preserveAspectRatio="none">
                <polyline
                  points={line.map((v, i) => `${(i / (line.length - 1)) * 120},${v}`).join(' ')}
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="1.6"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={line.map((v, i) => `${(i / (line.length - 1)) * 120},${v * 0.72 + 12}`).join(' ')}
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div className="hero-preview-chart bars">
              {bars.map((h, i) => (
                <span key={i} style={{ height: h + '%', background: i % 3 === 1 ? 'var(--gold)' : 'rgba(255,255,255,0.3)' }} />
              ))}
            </div>
          </div>

          <div className="hero-preview-rows">
            {[92, 78, 85, 64].map((w, i) => (
              <div className="hero-preview-row" key={i}>
                <span style={{ width: w * 0.34 + '%' }} />
                <span style={{ width: w * 0.22 + '%' }} />
                <span style={{ width: w * 0.16 + '%' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
