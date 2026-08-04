import { BrandLockup } from '../components/BrandMark';
import HeroPreview from '../components/HeroPreview';

const PROCESS = [
  {
    num: '1',
    title: 'Upload the workbook',
    body: 'Drop in the spreadsheet as it already exists. Holdings are read out of it whatever the column headings, including stacked tables and bond descriptors that merely look like equity tickers.',
  },
  {
    num: '2',
    title: 'Check what was read',
    body: 'Every extracted row is shown against its source before anything is imported, with currency and unit mismatches flagged and the position total reconciled against the figure the sheet reports itself.',
  },
  {
    num: '3',
    title: 'Measure the risk',
    body: 'Concentration, sector tilt and fixed income duration are computed from the holdings, and volatility and correlation are measured from five years of daily closes wherever that history exists.',
  },
  {
    num: '4',
    title: 'Compare and project',
    body: 'Performance is set against the S&P 500 and LQD from each book’s own benchmark sheet, and a Monte Carlo simulation puts a modelled range around the year ahead.',
  },
];

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
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="home-topbar">
        <BrandLockup size={32} variant="light" subtitle="Private Investment Desk" />
        <nav className="home-topnav" aria-label="Primary">
          <a href="#process">How it works</a>
          <a href="#capabilities">Coverage</a>
          <a href="#disclosure">Disclosure</a>
          <button className="desk-btn on-dark" onClick={onEnter}>Sign in</button>
        </nav>
      </header>
      <main id="main">

      <section className="home-hero">
        <div className="home-inner home-hero-grid">
          <div className="home-hero-copy">
            <div className="home-eyebrow">Private Investment Desk</div>
            <figure className="home-quote">
              <blockquote>
                <span className="home-quote-mark" aria-hidden="true">“</span>If you choose to sail upon the seas of
                banking, build your bank as you would your boat, with the strength to <em>sail safely through any
                storm</em>.”
              </blockquote>
              <figcaption>Jacob Safra</figcaption>
            </figure>
            <p className="home-lede">
              A working desk for tracking three investment portfolios end to end — composition and concentration,
              risk exposure, a forward projection grounded in measured volatility, and performance set against
              the benchmarks that matter. Everything is read from the source workbooks themselves.
            </p>
            <div className="home-cta-row">
              <button className="desk-btn gold lg" onClick={onEnter}>Enter the desk</button>
              <a className="desk-btn on-dark ghost lg" href="#process" style={{ textDecoration: 'none' }}>
                How it works
              </a>
            </div>
          </div>
          <HeroPreview />
        </div>
      </section>

      <section className="home-section" id="process">
        <div className="home-inner">
          <div className="home-section-head">
            <div className="home-rule" />
            <h2 className="home-section-title">How it works</h2>
            <p className="home-section-lede">
              Four steps, run as often as the books change. Nothing is retyped by hand, and nothing is inferred
              where the workbook already states it.
            </p>
          </div>
          <ol className="home-steps">
            {PROCESS.map((s) => (
              <li className="home-step" key={s.num}>
                <div className="home-step-num">{s.num}</div>
                <div className="home-step-body">
                  <h3 className="home-step-title">{s.title}</h3>
                  <p className="home-step-text">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
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

      <section className="home-section alt" id="disclosure">
        <div className="home-inner home-disclosure">
          <div>
            <div className="home-rule" />
            <h2 className="home-section-title">Important disclosure</h2>
          </div>
          <div className="home-disclosure-body">
            <p>
              This is a private tool used to track practice investment portfolios. <strong>It is not a bank</strong>,
              is not affiliated with, endorsed by or connected to any financial institution, and does not offer
              financial services, investment advice, or recommendations of any kind.
            </p>
            <p>
              Figures shown are read from workbooks uploaded by the desk’s own members and are only as accurate as
              those sources. Forward projections are modelled ranges derived from stated assumptions — they are not
              forecasts, and past performance does not indicate future results.
            </p>
            <p>
              Access is restricted to members of this desk. Nothing here constitutes an offer to buy or sell any
              financial instrument.
            </p>
          </div>
        </div>
      </section>

      </main>

      <footer className="home-footer">
        <div className="home-inner">
          <div className="home-footer-grid">
            <div className="home-footer-brand">
              <BrandLockup size={30} variant="light" subtitle="Private Investment Desk" />
              <p className="home-footer-blurb">
                Composition, risk, projection and benchmark comparison across three portfolios — read from the
                source workbooks themselves.
              </p>
            </div>

            <nav className="home-footer-col" aria-label="Site">
              <h4>The desk</h4>
              <a href="#process">How it works</a>
              <a href="#capabilities">What it covers</a>
              <a href="#disclosure">Disclosure</a>
            </nav>

            <div className="home-footer-col">
              <h4>Coverage</h4>
              <span>Position &amp; composition analysis</span>
              <span>Risk &amp; concentration</span>
              <span>Monte Carlo projection</span>
              <span>Benchmark comparison</span>
            </div>

            <div className="home-footer-col">
              <h4>Access</h4>
              <button className="home-footer-signin" onClick={onEnter}>Sign in to the desk</button>
              <span>Password protected</span>
              <span>Members only</span>
            </div>
          </div>

          <div className="home-footer-base">
            <span>© {new Date().getFullYear()} — private desk, internal use only.</span>
            <span>Not a bank. Not investment advice.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
