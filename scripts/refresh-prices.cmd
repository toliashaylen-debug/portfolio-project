@echo off
REM One-shot refresh: pull 5y closes from the Terminal, recompute volatility and
REM correlation, upload the derived stats to Supabase.
REM
REM Run this on the machine logged into your Bloomberg Terminal. Schedule it via
REM Task Scheduler (see scripts/AUTOMATION.md) to keep the projection current
REM without doing anything by hand.

cd /d "%~dp0.."

echo [1/3] Refreshing ticker list from current holdings...
node scripts\generate-bloomberg-request.mjs || goto :failed

echo.
echo [2/3] Pulling closing prices from the Terminal...
python bloomberg-request\fetch.py || goto :failed

echo.
echo [3/3] Computing volatility + correlation and uploading...
node scripts\import-price-history.mjs prices.csv || goto :failed

echo.
echo Done. The Annual Graph Prediction now reflects the refreshed data.
exit /b 0

:failed
echo.
echo FAILED - nothing was uploaded. The app keeps using the previous statistics.
exit /b 1
