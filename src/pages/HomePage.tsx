import { BrandLockup } from '../components/BrandMark';

const CAPABILITIES = [
  {
    num: '01',
    title: 'Position & composition analysis',
    body: 'Each book is read straight from its own source workbook, then broken down by sleeve, sector and concentration — with duration on the fixed income side and reconciliation against the figures the sheet reports itself.',
  },
  {
    num: '02',
    title: 'Forward projection',
    body: 'A Monte Carlo simulation runs two thousand correlated twelve-month paths per book, reporting the median outcome alongside Value-at-Risk and expected shortfall. Volatility and correlation are measured from historical closes wherever price history is available.',
  },
  {
    num: '03',
    title: 'Benchmark comparison',
    body: 'Equity performance is set against the S&P 500 and fixed income against LQD, read strictly from each portfolio\'s own benchmark sheet — with volatility and Sharpe shown wherever the source provides them.',
  },
];

export default function HomePage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="home">
      <header className="home-topbar">
        <BrandLockup size={32} variant="light" subtitle="Private Investment Desk" />
        <nav className="home-topnav">
          <a href="#capabilities">Capabilities</a>
          <button className="desk-btn on-dark" onClick={onEnter}>Sign in</button>
        </nav>
      </header>

      <section className="home-hero">
        <div className="home-inner">
          <div className="home-eyebrow">Private Investment Desk</div>
          <h1 className="home-title">
            Three books. <em>One desk.</em> Measured, not guessed.
          </h1>
          <p className="home-lede">
            A working desk for tracking three investment portfolios end to end — composition and concentration,
            risk exposure, a forward projection grounded in measured volatility, and performance set against
            the benchmarks that matter. Everything is read from the source workbooks themselves.
          </p>
          <div className="home-cta-row">
            <button className="desk-btn gold lg" onClick={onEnter}>Enter the desk</button>
            <a className="desk-btn on-dark ghost lg" href="#capabilities" style={{ textDecoration: 'none' }}>
              See what it does
            </a>
          </div>
        </div>
      </section>

      <section className="home-section" id="capabilities">
        <div className="home-inner">
          <div className="home-section-head">
            <div className="home-rule" />
            <h2 className="home-section-title">What the desk covers</h2>
            <p className="home-section-lede">
              Every figure traces back to an uploaded workbook or a measured price series. Nothing is estimated
              where the underlying data can be read directly.
            </p>
          </div>
          <div className="home-cards">
            {CAPABILITIES.map((c) => (
              <article className="home-card" key={c.num}>
                <div className="home-card-num">{c.num}</div>
                <h3 className="home-card-title">{c.title}</h3>
                <p className="home-card-body">{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-inner">
          <div className="home-footer-top">
            <BrandLockup size={30} variant="light" subtitle="Private Investment Desk" />
            <button className="desk-btn on-dark ghost" onClick={onEnter}>Sign in</button>
          </div>
          <p className="home-footer-note">
            A private tool for tracking practice investment portfolios. It is not a bank, is not affiliated with
            any financial institution, and does not offer financial services, investment advice or
            recommendations. Projections shown are modelled ranges based on stated assumptions, not forecasts.
            Access is restricted to the desk's own members.
          </p>
          <p className="home-footer-note" style={{ marginTop: 'var(--sp-3)' }}>
            © {new Date().getFullYear()} — internal use only.
          </p>
        </div>
      </footer>
    </div>
  );
}
