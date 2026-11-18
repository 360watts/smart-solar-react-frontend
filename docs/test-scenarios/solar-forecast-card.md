# Solar forecast card — test scenarios

One Solar card on the Forecast tab (Forecast sub-tab) replaces the "Solar Generation Forecast" and
"Forecast vs Actual" cards. Window: Today / Last 7 days / Next days. Mockup:
https://claude.ai/artifact/TAC9Vwj1bVjGNWSVhL2ffz (Nov 18, 2026). KPI tiles are shared with the Load card
(`tabs/cardParts.tsx`).

Data: `forecast-accuracy` `timeseries` (15-min `slot_ts`, `actual_kw`, `predicted_kw`, `p10_kw`, `p90_kw`,
`physics_baseline_kw`; last 7 days plus the next 24 h) and the site's solar `forecast` rows (Next days, GHI).

| # | Area | Given | When | Then | Type | P | Status |
|---|---|---|---|---|---|---|---|
| M1 | Model | timeseries rows for today, one slot still in progress | `todaySlots` | 15-min slots for the IST day; the in-progress slot has no actual; forecast kept for every slot | unit | P0 | passing |
| M2 | Model | slots with zero forecast and no actual before sunrise and after sunset | `trimNight` | leading/trailing night slots dropped, one slot of padding kept | unit | P1 | passing |
| M3 | Model | finished slots with actual and P50 | `todayKpis` | so far = Σ actual × 0.25; expected = Σ P50 of the whole day; diff % over finished slots only; slots inside P10–P90 counted | unit | P0 | passing |
| M4 | Model | 7 days of rows, today partial | `dailyTotals` | one row per IST day, oldest first; full days compare actual to P50 over the same slots; today flagged `partial` | unit | P0 | passing |
| M5 | Model | no P10/P90 on a slot | `todayKpis` / band | range left out, nothing invented | unit | P2 | passing |
| U1 | Card | today data | render | three KPI tiles (Generated so far, Expected today, Accuracy so far); one chart: Actual solid, Forecast (P50) dashed, Likely range band | unit | P0 | passing |
| U2 | Card | Last 7 days | click | chart shows daily kWh: Actual line through full days, dashed Today so-far link, P50 dashed, range band; tiles total 6 full days | unit | P0 | passing |
| U3 | Card | Next days | click | forecast-only chart from the forecast rows after today; one tile per day | unit | P1 | passing |
| U4 | Card | any window | toggling | no refetch: windows reuse the loaded data; chart animation off; `tension` 0 | unit | P1 | passing |
| U5 | Card | GHI off by default | click "+ Sunlight (GHI)" | GHI drawn on a right axis (Today / Next days only) | unit | P2 | passing |
| U6 | Card | no timeseries | render | empty state, no crash | unit | P1 | passing |
| U7 | Card | Table view | click Table | Today: slot table with actual / P50 / Δ; Last 7 days: daily table; Next days: forecast table | unit | P2 | passing |
| L1 | Live | coim_002, mid-day | open Forecast tab | tiles readable, actual stops at now, P50 runs to sunset, band shaded | live | P0 | planned |
| L2 | Live | | switch windows | instant, no spinner, no network call | live | P1 | planned |
| L3 | Live | dark mode | view | tiles and legend readable | live | P2 | planned |
