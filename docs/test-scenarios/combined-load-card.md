# Combined Load card (Phase Load tab)

Feature: one Load card replaces "Load Profile" and "Load Forecast vs Actual": pick a line (Inverter / Grid /
EV / All), a window (Today / Last 7 days / Next 7 days) and a forecast lead (Off / Latest / 1 h / 6 h /
Day-ahead). EV is measured only. Grid forecast = 7-day same-slot median from
`load-forecast-accuracy?line=grid` (backend `docs/test-scenarios/load-line-grid-forecast.md`).
Spec: `docs/superpowers/specs/2026-11-17-combined-load-card-design.md`. Mockup: https://claude.ai/artifact/7Hr5gptj14ZraZF2jDF1oN
Code: `src/shared/components/SiteDataPanel/tabs/LoadCard.tsx`, `loadCardModel.ts`, `PhaseLoadTab.tsx`.
Tests: `tabs/loadCardModel.test.ts`, `tabs/LoadCard.test.tsx`.

## Slot model (`loadCardModel.ts`)

| ID | Given | When | Then | Type | P | Status |
|---|---|---|---|---|---|---|
| W1 | today's solar start (06:00 IST) | windowRange today | [06:00, next 06:00) | unit | P0 | passing |
| W2 | same | windowRange last7 | the 6 days before plus today | unit | P1 | passing |
| W3 | same | windowRange next7 | the 7 solar days after today | unit | P1 | passing |
| B1 | a 1-hour window | buildSlots | one slot per 15 min | unit | P1 | passing |
| B2 | an actual row inside slot 0 | buildSlots | inverter, phases, grid land in slot 0; EV null stays null | unit | P0 | passing |
| B3 | a forward row and a lead-chosen run for the same slot | buildSlots | the run wins; its miss reason and replay flag are kept | unit | P0 | passing |
| B4 | a forward row for a slot the run series lacks | buildSlots | the forward forecast fills it | unit | P1 | passing |
| B5 | a grid median row | buildSlots | grid P50/P90 set | unit | P0 | passing |
| B6 | a row outside the window | buildSlots | ignored | unit | P2 | passing |
| B7 | a grid forecast row with `mean_kw` | buildSlots | `gridMean` set; a row without it leaves `gridMean` null, so energy falls back to P50 | unit | P1 | passing |
| G1 | grid reads 1, -, 1, 1, 1, 1 and inverter always reads | gapSlots | slot 1 is a gap | unit | P0 | passing |
| G2 | grid has no reading anywhere in the window | gapSlots | no gaps (line not at this site) | unit | P1 | passing |
| G3 | the newest 30 min have no grid reading yet | gapSlots | not flagged (data lag) | unit | P1 | passing |
| T1 | 1 kW, missing, 2 kW | kwh | 0.75 kWh | unit | P1 | passing |
| T2 | 1, -, 2, - | cumulative | 0.25, 0.25, 0.75, null | unit | P1 | passing |
| S1 | slot 0 finished (inv .5, grid 1, EV 2), slot 1 in progress, slot 2 future | stackTops | slot 0 = actual stack; the slot in progress and the future are empty (no false drop to 0 kW at now; Nov 18 review) | unit | P0 | passing |
| S2 | same, with forecasts on slots 1–2 | totalForecast (kW) | inverter P50 + grid P50 on every slot that has a forecast, past ones included (compare with the stack); EV never forecast | unit | P0 | passing |
| S3 | same, grid mean 0.9 on slot 2 | totalForecast (energy) | running kWh of the forecast, grid from its mean | unit | P0 | passing |

## Card (`LoadCard.tsx`)

| ID | Given | When | Then | Type | P | Status |
|---|---|---|---|---|---|---|
| C1 | inverter, grid and EV data with forecasts | Line = All | the summed forecast "Forecast (inverter + grid)" = inverter P50 + grid P50, never EV | unit | P0 | passing |
| C11 | Line = All, 4 h into the day (Nov 18 review: the view was hard to read; then "forecast line not visible") | render | solid stacked actual only, no hatched forecast layers; the in-progress slot is empty in the stack; one dashed forecast line across the whole day with `order: -1` so it is drawn above the filled stack (Chart.js paints the last dataset first) | unit | P0 | passing |
| C12 | EV plug exists but sent nothing in the window | Line = All | no EV layer or legend entry | unit | P2 | passing |
| C13 | the Load card Window is switched | Today ↔ Last 7 days | only the Phase Load rows refetch; the site panel does not reload (no spinner, no forecast/telemetry refetch: `phaseLoadHours` left out of `fetchAll`); a lead switch reuses a response under 5 min old; no chart animation on toggle | manual | P1 | planned |
| C2 | same | Line = EV | no forecast datasets | unit | P0 | passing |
| C3 | a site with only grid data and no EV | render | no Line picker | unit | P1 | passing |
| C4 | hours 24 | Window = Last 7 days, then Today | onHoursChange(168), then (24) | unit | P1 | passing |
| C5 | lead Latest | Forecast = Off, then Day-ahead | Off: no forecast datasets, no fetch; Day-ahead: onLeadChange('day') | unit | P0 | passing |
| C6 | a past slot with no grid reading | Line = All | "incomplete" shows | unit | P0 | passing |
| C7 | the grid response carries a note | Line = Grid | the note shows; the forecast reads "Forecast (14-day pattern)" and the band "Likely range", not P10–P90 (calibrated bands reached about 71%, Nov 17 study) | unit | P1 | passing |
| C8 | the grid forecast has P50 0.6 kW and mean 1.0 kW | Line = Grid, Today | the chip reads "~X kWh by 06:00" = so far + the summed mean, not P50 | unit | P0 | passing |
| C9 | inverter forecast on (Nov 17 design review) | render | the forecast is dashed in the line's own hue, never red; every dataset has tension 0 (no overshoot between 15-min averages) | unit | P1 | passing |
| C10 | inverter accuracy in the response | render, Today | accuracy is a plain caption "Day-ahead accuracy, last 7 days: typical error … · …% inside the range"; chips read "… so far" | unit | P2 | passing |

## Edge cases from design review

- EV buckets with no plug reading are null (was 0) so EV outages show as gaps, not as no charging.
- The inverter score chip shows the existing day-ahead KPIs (MAE, band coverage); the API has no median baseline.
- Phase lines are context only: the forecast is per line.
- The header date picker and the 6 h / 12 h / 48 h options are gone; Window replaces them.

## Live verification (coim_002, staff login)

| ID | Check | Status |
|---|---|---|
| L1 | Today · Inverter · Latest: actual and forecast match the old vs-actual card for the same slots | planned |
| L2 | Today · All: stack = inverter + grid + EV; after now hatched forecast; summed forecast line present | planned |
| L3 | Grid shows the "Meter reads ~25% low" note, "Forecast (14-day pattern)" with a "Likely range" band across Next 7 days, and its kWh chip matches the sum of `mean_kw` | planned |
| L4 | Switching leads changes the inverter forecast only; grid stays the same | planned |
| L5 | A known meter gap (if any in the week) is tinted red and the total says incomplete | planned |
| L6 | Tooltip "Why off" still shows on an inverter miss | planned |
