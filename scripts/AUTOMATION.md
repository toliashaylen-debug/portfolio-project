# Keeping the Monte Carlo inputs current automatically

You asked whether the projection can stay permanently linked to Bloomberg
instead of re-supplying prices by hand. It can — but *how* depends on which
Bloomberg product you have, because the Terminal and the enterprise data
products expose completely different interfaces.

## First, the good news about frequency

Five-year volatility and correlation move very slowly. Adding one more week to a
1,260-day window barely shifts the estimate. **Monthly or quarterly is plenty**;
daily refreshes would burn Terminal data limits for no analytical benefit. So
"never think about it again" really means "set it once, let it run monthly."

## Option A — Terminal + scheduled task (what you have)

The Terminal's BLPAPI is a *desktop* API: it only answers on `localhost:8194`
while the Terminal is running and you are logged in. A public web page can never
call it directly. So the automation lives on the Terminal machine:

1. Copy this repo to the Terminal machine (or just `scripts/` plus
   `bloomberg-request/`), and run `npm install` once.
2. Test it manually first:

   ```
   scripts\refresh-prices.cmd
   ```

3. Once that works, schedule it. In an **admin** PowerShell on that machine:

   ```powershell
   $action  = New-ScheduledTaskAction -Execute "C:\path\to\repo\scripts\refresh-prices.cmd"
   $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At 7am
   Register-ScheduledTask -TaskName "Desk price refresh" -Action $action -Trigger $trigger -RunLevel Highest
   ```

That's it — the desk updates itself. Everyone's Annual Graph Prediction picks up
the new statistics automatically via the realtime sync already wired in; nobody
needs to refresh anything.

**Caveat:** the task only succeeds when that machine is on and the Terminal is
logged in. If it fails, `refresh-prices.cmd` exits non-zero and uploads nothing,
so the app quietly keeps using the last good statistics rather than breaking.

## Option B — Data License / B-PIPE / HAPI (fully cloud, no machine involved)

These are Bloomberg's *server-side* products and they do have HTTPS APIs
reachable from a data centre. If you have one, the refresh can run as a GitHub
Action on a cron schedule with no machine of yours involved at all — credentials
live in repo secrets, never in the browser bundle. Tell me which product and I
will wire it up.

Note this is a separate paid subscription from the Terminal; a Terminal licence
alone does not grant it.

## A licensing point worth raising

Terminal data is licensed to you as an individual user, and this desk is a shared
app that Antonio, Israel — and anyone with the public URL — can open. Two things
reduce the exposure, but I am not your compliance desk and you should sanity-check
it if this becomes more than a practice book:

- Only **derived statistics** (annualised volatility, pairwise correlation) are
  uploaded. Raw Bloomberg price series never leave your machine, are never stored
  in Supabase, and are never shipped to the browser.
- `prices.csv` is gitignored, so it cannot be committed or published by accident.

## What actually gets stored

A single Supabase row under the key `price-stats`:

```json
{
  "asOf": "2026-08-03",
  "source": "Bloomberg Terminal — PX_LAST, daily",
  "windowStart": "2021-08-03",
  "windowEnd": "2026-08-03",
  "byTicker": { "NVDA": { "vol": 0.42, "observations": 1258 } },
  "corr": { "MU|NVDA": 0.61 }
}
```

Holdings absent from `byTicker` fall back to stated asset-class assumptions
individually, and the Simulation inputs panel on each portfolio page reports
exactly which holdings are measured versus assumed — so the chart never implies
more rigour than the underlying data supports.
