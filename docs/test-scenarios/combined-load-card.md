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
| S1 | slot 0 past (inv .5, grid 1, EV 2), slot 1 future (P50 .4/.6, EV 3) | stackTops with forecast | past = actual stack; future = forecast stack without EV | unit | P0 | passing |
| S2 | same | stackTops forecast off | future slot is empty | unit | P1 | passing |
| S3 | a future slot, grid P50 0.1 and mean 0.4 | stackTops with energy = true / false | the grid layer is 0.4 / 0.1 (kWh uses the mean, kW the P50) | unit | P0 | passing |

## Card (`LoadCard.tsx`)

| ID | Given | When | Then | Type | P | Status |
|---|---|---|---|---|---|---|
| C1 | inverter, grid and EV data with forecasts | Line = All | the summed forecast = inverter P50 + grid P50, never EV | unit | P0 | passing |
| C2 | same | Line = EV | no forecast datasets | unit | P0 | passing |
| C3 | a site with only grid data and no EV | render | no Line picker | unit | P1 | passing |
| C4 | hours 24 | Window = Last 7 days, then Today | onHoursChange(168), then (24) | unit | P1 | passing |
| C5 | lead Latest | Forecast = Off, then Day-ahead | Off: no forecast datasets, no fetch; Day-ahead: onLeadChange('day') | unit | P0 | passing |
| C6 | a past slot with no grid reading | Line = All | "incomplete" shows | unit | P0 | passing |
| C7 | the grid response carries a note | Line = Grid | the note shows; the forecast reads "Forecast (14-day pattern)" and the band "Likely range", not P10–P90 (calibrated bands reached about 71%, Nov 17 study) | unit | P1 | passing |
| C8 | the grid forecast has P50 0.6 kW and mean 1.0 kW | Line = Grid, Today | the "+X forecast" kWh chip sums the mean, not P50 | unit | P0 | passing |

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
| L3 | Grid shows the "Meter reads ~25% low" note and a median forecast across Next 7 days | planned |
| L4 | Switching leads changes the inverter forecast only; grid stays the same | planned |
| L5 | A known meter gap (if any in the week) is tinted red and the total says incomplete | planned |
| L6 | Tooltip "Why off" still shows on an inverter miss | planned |
