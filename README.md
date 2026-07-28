# The Desk — Project Summary (for Claude Code)

## What this is

A private, password-gated web app called "The Desk" (branded "Safra Banking" in
the UI) for tracking three practice investment portfolios — Shaylen's,
Antonio's, and Israel's. Each portfolio owner uploads their own Excel workbook;
the app reads it with AI-assisted extraction (not hardcoded column parsing) and
produces positions, composition/risk analysis, a Monte Carlo 12-month
projection, and a benchmark comparison, per portfolio.

**File:** a single self-contained `portfolio-desk.html` — plain HTML, CSS, and
vanilla JavaScript. No build step, no bundler, no framework.

**Important architectural fact:** this was originally built in React/JSX, then
deliberately rewritten to vanilla JS (no React, no JSX at all) at the user's
request. Any new feature should follow the *existing vanilla JS patterns*
below, not reintroduce React.

## Tech stack

- Vanilla JS (ES6+), single HTML file, no build tooling
- **SheetJS (`xlsx`)** loaded via CDN — parses uploaded `.xlsx`/`.xls` files
- **Chart.js** loaded via CDN — all charts (Monte Carlo fan chart, benchmark
  line charts)
- **Anthropic API** called directly via `fetch()` from the browser
  (`callClaude(prompt, maxTokens)`, model `claude-sonnet-4-6`) — used for data
  extraction from spreadsheets and for on-demand AI-written analysis text
- **`window.storage`** (Claude.ai artifact persistent storage) — the only
  persistence layer. Simple async key-value get/set/delete. All calls use
  `shared: false` (data is private to the user's own account).

## Core architecture patterns (follow these for new features)

### The `h()` helper replaces JSX/React.createElement

```js
h(tag, props, ...children)
```

- If `tag` is a string: creates a real DOM element via `document.createElement`
  (or `createElementNS` for SVG tags — there's a hardcoded `SVG_TAGS` set).
  Props map to attributes/properties; `className`, `style` (object), `value`,
  `checked`, `onClick`/`onChange`/etc. (event listeners — `onChange` maps to
  the native `input` event, not `change`), and `ref` (callback given the
  created element) are all handled specially.
- If `tag` is a function: it's called directly as a "component" with
  `{...props, children}` and must return a DOM `Node`.

### Stateful widgets: closures + manual re-render, not hooks

Every interactive piece follows this shape:

```js
function SomeWidget(props) {
  const container = h('div', {...});
  const state = { ...initial local state... };
  function render() {
    mountInto(container, h('div', null, /* rebuilt content based on state */));
  }
  // event handlers mutate `state` then call render()
  render();
  return container;
}
```

`mountInto(container, node)` clears and replaces a container's children. There
is no virtual DOM and no diffing — `render()` fully rebuilds that widget's own
subtree each time. This is deliberate and is fine for this app's scale, but it
means: **don't rebuild a widget that contains another widget with its own
important local state**, or you'll wipe that nested state out. See below.

### Nav vs. main content are rendered independently

`App()` splits `renderNav()` and `renderMain()` so that saving a strategy label
or renaming a portfolio can refresh just the sidebar (which shows the name/
strategy) without rebuilding whatever's currently open in the main panel. This
was a deliberately-fixed bug — don't collapse these back into one render call.

### `PortfolioPage` isolates its nested widgets

`UploadPanel` and `RawSheetViewer` are constructed **once** inside
`PortfolioPage` and kept as stable DOM references; only the
history-dependent display area (`CompositionPanel`, value/P&L cards, positions
table) gets rebuilt when new data arrives. This was also a deliberately-fixed
bug: naively rebuilding the whole page on every history change used to risk
wiping out an in-progress upload or unsaved strategy edit elsewhere on the same
page. If you add new nested interactive widgets to a page, follow this same
isolation pattern.

### AI extraction resilience

- `parseJsonLoosely(rawText)` — tries a direct `JSON.parse`, then extracts just
  the outer `{...}` block from surrounding prose, then strips trailing commas,
  before giving up. The AI is asked for strict JSON but doesn't always comply
  perfectly; this absorbs that.
- Extraction calls (`extractHoldingsViaAI`, `extractBenchmarkComparison`)
  auto-retry up to 3 times on unusable output before surfacing an error.

## The three portfolios and their sourcing rules

`PORTFOLIO_SOURCING` (an object keyed `p1`/`p2`/`p3`) hard-restricts which
sheet(s) each portfolio's data may come from — this was explicitly requested
by the user and should be respected/extended, not removed:

- **p1 — Shaylen's Portfolio**: positions ONLY from the sheet named "Cover
  Page" (or "Portfolio - Cover Page"). Weight mode `'shareCount'` — each
  holding's weight is its own share count ÷ its sleeve's (equity or fixed
  income) total share count, **not** dollar value. Equity/FI split is read
  from a "Dynamic Weights" sheet when present. AI commentary/strategy text may
  only draw on Cover Page + Backlog (Ledger) + Daily Performance + Benchmark.
- **p2 — Antonio's Portfolio**: positions ONLY from the sheet named "Active
  Portfolio". Weight mode `'value'` — uses each holding's own reported
  "Position Market Value" when the sheet gives one (correctly handles FX
  conversion and bond accrued interest), else falls back to shares × price.
  AI commentary/strategy restricted to Active Portfolio + EQ/FX/FI Backlog +
  Benchmark.
- **p3 — Israel's Portfolio**: no restriction (`PORTFOLIO_SOURCING.p3 = null`)
  — single-sheet file, everything applies generically. His file currently has
  no dedicated Benchmark sheet, so the Benchmark Comparison tab correctly shows
  "no data found" for him rather than fabricating a comparison — this is
  intentional and awaiting further instruction from the user on how to source
  benchmark data for his portfolio specifically.

## Core data model

Each portfolio's `history` is an array of dated snapshots:
`{ date, positions, themes, reported }`

Each position:
```
{ ticker, name, shares, costBasis (PER-UNIT, not total), price, sector,
  assetType, sleeve ('equity'|'fixedIncome'|'other'), durationYears,
  reportedWeightPct, positionMarketValue, reportedUnrealizedPL, sourceSheet }
```

Key helper functions (in the "Computation engine" section):
- `valueOf(p)` — prefers `p.positionMarketValue` over `shares × price`
- `plOf(p)` — prefers `p.reportedUnrealizedPL` over recomputing `value − shares × costBasis`
- `flagPosition(p)` — flags a position when a *computed* (not sheet-given) P&L
  looks implausibly large relative to size (>60% of value) — this is a
  self-service diagnostic for currency/unit mismatches (see Gotchas below)
- `computeBreakdown(positions, weightMode)` — sector weights, concentration
  risk, duration risk; `weightMode` is `'value'`, `'shareCount'`, or `'given'`
  (uses `reportedWeightPct`)

## Current features (nav tabs, top to bottom)

1. **Overview** — all 3 portfolios' cards (value, day change, P&L, allocation bar)
2. **Desk view** — every position across all 3 books, one filterable table
3. **Common Positions** — tickers held in more than one portfolio
4. **Risks** — on-demand AI risk description per portfolio, grounded in
   computed stats (concentration, sector tilt, duration)
5. **[Name]'s Portfolio** (×3) — upload panel, Composition & Risk panel
   (equity/FI donut + sector weights + concentration badges), positions table,
   strategy editor, "View original spreadsheet" raw viewer
6. **[Name]'s Annual Graph Prediction** (×3) — Monte Carlo simulation (2,000
   paths, correlated per-holding monthly returns via Cholesky decomposition,
   stated capital-market assumptions by asset class since no historical
   return series exists per-asset), fan chart with 50%/90% confidence bands,
   95% VaR/CVaR
7. **[Name]'s Portfolio compared to the Benchmark** (×3) — equity vs. S&P 500,
   fixed income vs. LQD, read strictly from each portfolio's "Benchmark" sheet
   only; shows return difference, volatility/Sharpe when the sheet provides
   them, and a benchmark price trend chart
8. **Commentary** — AI-written daily desk-wide commentary across all 3 books

## Design system

- **Light theme** (not dark) — white cards (`--panel: #FFFFFF`) on a soft
  blue-gray page background (`--bg: #EEF2F7`), navy accent (`--accent:
  #144B87`)
- Fonts: **Space Grotesk** (headings/display), **Inter** (body),
  **JetBrains Mono** (numbers/data) — loaded from Google Fonts
- Green `#1E8E5A` / red `#C7333F` for gains/losses (standard finance
  convention — keep this)
- Brand mark top-left: an original geometric SVG mark (rounded square +
  ascending line glyph) + "Safra" / "Banking" wordmark — this is an
  originally-designed mark, explicitly NOT a reproduction of any real
  company's actual logo
- No gratuitous animation — a decorative scrolling ticker-tape was
  deliberately removed as unnecessary

## Storage keys (all `window.storage`, `shared: false`)

- `desk-config` — `{ password, portfolios: [{ id, name, strategy }] }`
- `history-p1` / `history-p2` / `history-p3` — snapshot arrays (see data model above)
- `raw-p1` / `raw-p2` / `raw-p3` — `{ date, sheets: [{ sheetName, grid }] }`
  from the most recent upload; powers "View original spreadsheet" and the
  Benchmark Comparison tab
- `commentary-log` — array of `{ date, text }`

## Gotchas already discovered and fixed (don't reintroduce these)

- **Cost basis must be per-unit, not total.** Some sheets have both a total
  cost column and a per-unit column with a misleading label; extraction is
  explicitly instructed to prefer per-unit.
- **Bond descriptors aren't equity tickers.** E.g. "AAPL 4/3 05/12/35" is a
  corporate bond, not Apple stock. Sleeve classification uses the sheet's own
  section headers (deterministic keyword matching in `sleeveFromSection()`),
  not guesswork from the ticker text.
- **Foreign-currency cost basis can be mislabeled.** A column literally headed
  "Average Cost ($)" was actually in EUR/BRL for some rows, causing a >
  $240,000 P&L error when compared against an already-USD-converted market
  value. Fix: prefer the sheet's own already-computed P&L (`reportedUnrealizedPL`)
  over recomputing, and `flagPosition()` catches this pattern generally.
- **Single-day returns should never be compounded into an annual projection**
  — that's a real statistical fallacy, not just imprecision. The Annual Graph
  uses the portfolio's return since cost basis, compounded smoothly over 12
  months, with the assumption stated explicitly rather than hidden.
- **SVG elements can't have `className` set directly** (`el.className = x`
  throws — it's a read-only `SVGAnimatedString`). The `h()` helper branches on
  this.
- **Widget state can be silently destroyed by an unrelated re-render** if you
  rebuild a parent that contains a stateful child widget. Always isolate
  nested stateful widgets (construct once, hold a stable reference) rather
  than reconstructing them on every parent re-render.

## Known limitations

- The password gate is client-side only; real access control comes from
  `window.storage` being scoped to the user's own Claude account.
- Chart.js rendering was verified structurally (correct config, correct canvas
  creation) but not visually — the development/testing environment (jsdom)
  doesn't implement real canvas rendering.
- No automated test suite ships in the file itself; testing during
  development was done ad hoc with jsdom + mocked `window.storage`/`fetch`.