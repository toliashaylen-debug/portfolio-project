# Run on a machine logged into a Bloomberg Terminal:
#     pip install blpapi pandas
#     python fetch.py
# Writes prices.csv (date column + one column per security).
import blpapi, pandas as pd, datetime as dt

SECURITIES = [
    "SHV US Equity",
    "BIL US Equity",
    "SGOV US Equity",
    "FLOT US Equity",
    "/isin/US91282CHK09",
    "NVDA US Equity",
    "ENVA US Equity",
    "IGV US Equity",
    "MU US Equity",
    "XLV US Equity",
    "DRAM US Equity",
    "AMZN US Equity",
    "XLF US Equity",
    "CAN LN Equity",
    "GOOGL US Equity",
    "TLN US Equity",
    "CVX US Equity",
    "UNH US Equity",
    "T 4.375 05/15/36 Govt",
    "T 4.125 06/30/28 Govt",
    "AAPL 4.75 05/12/2035 Corp",
    "AMZN F 07/09/2029 Corp",
    "NTT 0 06/20/2029 144A Corp",
    "B 0 08/11/26 Govt",
    "LGSTLI1",
    "MSTR 12 PERP Corp",
    "META US Equity",
    "BN US Equity",
    "LHX US Equity",
    "XLE US Equity",
    "XLB US Equity",
    "LOHA US Equity",
    "AIR FP Equity",
    "EMBJ US Equity",
    "EQTL3",
    "SNDK US Equity",
]

END = dt.date.today()
START = END - dt.timedelta(days=5 * 365 + 1)

session = blpapi.Session()
if not session.start() or not session.openService("//blp/refdata"):
    raise SystemExit("Could not connect to the Terminal — is it running and logged in?")
svc = session.getService("//blp/refdata")

frames = {}
for sec in SECURITIES:
    req = svc.createRequest("HistoricalDataRequest")
    req.append("securities", sec)
    req.append("fields", "PX_LAST")
    req.set("periodicitySelection", "DAILY")
    req.set("nonTradingDayFillOption", "PREVIOUS_VALUE")
    req.set("startDate", START.strftime("%Y%m%d"))
    req.set("endDate", END.strftime("%Y%m%d"))
    session.sendRequest(req)

    dates, px = [], []
    while True:
        ev = session.nextEvent(30000)
        for msg in ev:
            sd = msg.getElement("securityData") if msg.hasElement("securityData") else None
            if sd is None:
                continue
            if sd.hasElement("securityError"):
                print("!! no data:", sec, sd.getElement("securityError"))
                continue
            fd = sd.getElement("fieldData")
            for i in range(fd.numValues()):
                row = fd.getValueAsElement(i)
                if row.hasElement("PX_LAST"):
                    dates.append(row.getElementAsDatetime("date"))
                    px.append(row.getElementAsFloat("PX_LAST"))
        if ev.eventType() == blpapi.Event.RESPONSE:
            break

    if dates:
        frames[sec] = pd.Series(px, index=pd.to_datetime(dates))
        print(f"{sec}: {len(dates)} closes")
    else:
        print(f"{sec}: NO DATA")

pd.DataFrame(frames).sort_index().to_csv("prices.csv", index_label="date")
print("wrote prices.csv")
