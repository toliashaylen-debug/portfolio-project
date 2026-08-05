# Bloomberg 5-year price pull

Generated 2026-08-05 from the live holdings in Supabase.
51 unique securities across 3 funded portfolio(s).

Sourcing honoured: p1 = Cover Page only, p2 = Active Portfolio only, p3 = its single sheet (unrestricted).

## Option A — Excel (simplest)
Paste the formulas in `bdh-formulas.txt` into a Bloomberg-enabled Excel sheet,
let them populate, then save as CSV with a `date` column and one column per
security, headed with the ticker exactly as listed in `tickers.txt`.

## Option B — BLPAPI (cleanest)
Copy `fetch.py` to the Terminal machine and run it. It writes `prices.csv`
in exactly the expected shape.

## Then
Put the CSV at the repo root as `prices.csv` and run:

    node scripts/import-price-history.mjs prices.csv

That computes annualised volatility and the correlation matrix and uploads the
result to Supabase. Nothing but derived statistics leaves your machine — no raw
Bloomberg price series is stored or published.

## 17 identifier(s) to verify on the Terminal
These were mapped heuristically from the spreadsheet text. Bloomberg's
autocomplete is authoritative — correct any that resolve to the wrong security,
in both `tickers.txt` and `fetch.py`.

- `US91282CHK09` → `/isin/US91282CHK09`  (ISIN — confirm it resolves to the right <Govt>/<Corp> instrument)
- `T 4.375 05/15/36` → `T 4.375 05/15/36 Govt`  (Treasury bond — verify the exact security on the Terminal)
- `T 4.125 06/30/28` → `T 4.125 06/30/28 Govt`  (Treasury bond — verify the exact security on the Terminal)
- `AAPL 4.75 05/12/2035` → `AAPL 4.75 05/12/2035 Corp`  (Corporate bond — verify the exact security on the Terminal)
- `AMZN F 07/09/2029` → `AMZN F 07/09/2029 Corp`  (Corporate bond — verify the exact security on the Terminal)
- `NTT 0 06/20/2029 144A` → `NTT 0 06/20/2029 144A Corp`  (Corporate bond — verify the exact security on the Terminal)
- `B 0 08/11/26` → `B 0 08/11/26 Govt`  (Treasury bond — verify the exact security on the Terminal)
- `LGSTLI1` → `LGSTLI1`  (Unrecognized identifier format — set manually)
- `MSTR 12 PERP` → `MSTR 12 PERP Corp`  (Perpetual preferred — verify instrument type (Corp vs Pfd))
- `EQTL3` → `EQTL3`  (Unrecognized identifier format — set manually)
- `JPM US 08/21/26 C350` → `JPM US 08/21/26 C350 Corp`  (Corporate bond — verify the exact security on the Terminal)
- `US91282CQZ76` → `/isin/US91282CQZ76`  (ISIN — confirm it resolves to the right <Govt>/<Corp> instrument)
- `US91282CQY02` → `/isin/US91282CQY02`  (ISIN — confirm it resolves to the right <Govt>/<Corp> instrument)
- `USU3826RAK96` → `/isin/USU3826RAK96`  (ISIN — confirm it resolves to the right <Govt>/<Corp> instrument)
- `USU30249AC72` → `/isin/USU30249AC72`  (ISIN — confirm it resolves to the right <Govt>/<Corp> instrument)
- `XS1843433639` → `/isin/XS1843433639`  (ISIN — confirm it resolves to the right <Govt>/<Corp> instrument)
- `US68389XCP87` → `/isin/US68389XCP87`  (ISIN — confirm it resolves to the right <Govt>/<Corp> instrument)
