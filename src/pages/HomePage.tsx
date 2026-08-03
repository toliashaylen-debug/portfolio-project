import { BrandLockup } from '../components/BrandMark';

const CAPABILITIES = [
  {
    num: '01',
    title: 'Reading the source workbooks',
    body: 'Spreadsheets are read as they actually are, rather than forced into a fixed template.',
    points: [
      'Upload an .xlsx and have holdings extracted whatever the column headings',
      'Handles several stacked tables in one sheet, and bond descriptors that only look like equity tickers',
      'Prefers per-unit cost basis, reported market value and reported P&L when the sheet provides them',
      'Each book is locked to its own designated sheet, so figures never bleed between portfolios',
      'The original file stays viewable, exactly as uploaded, sheet by sheet',
    ],
  },
  {
    num: '02',
    title: 'Data integrity checks',
    body: 'The desk flags what looks wrong instead of quietly averaging over it.',
    points: [
      'Flags positions whose computed P&L implies a currency or unit mismatch',
      'Reconciles the sum of positions against the total the workbook itself reports',
      'Skips duplicate tickers across selected sheets and tells you which',
      'Lets you check every extracted row against the source before importing',
    ],
  },
  {
    num: '03',
    title: 'Composition & allocation',
    body: 'Where the money actually sits, per book.',
    points: [
      'Equity against fixed income, taken from the reported split where one exists',
      'Sector weights across the equity sleeve, charted and ranked',
      'Weighting by value or by share count, according to each book’s own convention',
      'Full position table with price, cost basis, value, day move and unrealised P&L',
    ],
  },
  {
    num: '04',
    title: 'Risk exposure',
    body: 'Concentration and rate sensitivity, stated plainly.',
    points: [
      'Largest single position and top-three concentration, graded low to high',
      'Largest sector exposure across the equity sleeve',
      'Weighted average duration on fixed income, with coverage noted',
      'A written risk description per book, grounded only in that book’s holdings',
    ],
  },
  {
    num: '05',
    title: 'Forward projection',
    body: 'A modelled range of outcomes over the coming year — not a forecast.',
    points: [
      'Two thousand correlated twelve-month paths per book, via Cholesky decomposition',
      'Fan chart showing the median path with 50% and 90% outcome bands',
      '95% Value-at-Risk and conditional VaR (expected shortfall)',
      'Volatility and correlation measured from five years of daily closes where available',
      'States which holdings are measured and which fall back to stated assumptions',
    ],
  },
  {
    num: '06',
    title: 'Benchmark comparison',
    body: 'Performance set against the relevant market, per sleeve.',
    points: [
      'Equity against the S&P 500, fixed income against LQD',
      'Out- or under-performance against each benchmark over the tracked period',
      'Volatility and Sharpe ratio wherever the source sheet supplies them',
      'Benchmark price trend charted over the tracked window',
    ],
  },
  {
    num: '07',
    title: 'Across all three books',
    body: 'The desk as a whole, not just one portfolio at a time.',
    points: [
      'Combined desk value, day change and unrealised P&L',
      'Every position across every book in one filterable table',
      'Tickers held in more than one portfolio, with combined exposure',
      'Side-by-side overview of all three books on one screen',
    ],
  },
  {
    num: '08',
    title: 'Written analysis',
    body: 'Narrative drawn strictly from the uploaded data.',
    points: [
      'Daily desk commentary across all three books',
      'A reading of what each book’s composition implies strategically',
      'Suggested strategy labels derived from actual holdings',
      'Plain-language explanation of what the projection does and does not mean',
    ],
  },
  {
    num: '09',
    title: 'The desk itself',
    body: 'Shared, current, and closed to everyone else.',
    points: [
      'One shared desk — each member uploads their own book from their own machine',
      'Uploads and edits appear on every open device within moments',
      'Snapshots are dated and kept, so day-on-day movement is measurable',
      'Access sits behind a password',
    ],
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
                <ul className="home-card-list">
                  {c.points.map((p) => <li key={p}>{p}</li>)}
                </ul>
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
