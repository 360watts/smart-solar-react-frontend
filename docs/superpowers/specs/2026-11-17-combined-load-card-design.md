# Combined Load card (whole-home load, forecast per line) — design

> **Update 2026-11-17 (owner approved):** the grid forecast is no longer the 7-day median. A study (`load_forecasting/docs/GRID_DIRECT_LOAD_MODEL_STUDY.md`) found a kernel analog with calibrated bands better (+6.3–7% pinball, daily energy unbiased). Rows now also carry `mean_kw` (`method: 'kernel14'`, `lead: 'kernel'`), the card's kWh figures use it, and the band reads "Likely range". The median text below is kept as the original design.

Date: 2026-11-17 · Repos: smart-solar-react-frontend, smart-solar-django-backend
Mockup: https://claude.ai/artifact/7Hr5gptj14ZraZF2jDF1oN (sample data)

## Intent

Staff need to judge each supply line's load forecast against what happened, and see the
whole home, in one place. Today the Phase Load tab has two cards that plot the same lines
on the same 15-min / 06:00→06:00 axis: "Load Profile" (Inverter / Grid / EV / All actuals)
and "Load Forecast vs Actual" (inverter only). They merge into one card.

Hybrid homes (coim_002) have up to three lines: inverter backup side (Deye load), grid-direct
board (EM26 meter) and the EV line (plug). On-grid homes have one line. First user: staff
dashboard. Later users (homeowner app, battery control, bill projection) are out of scope.

## Goals

- One "Load" card with three control groups:
  - **Line**: Inverter · Grid · EV · All. Lines with no data at the site are hidden
    (an on-grid site shows one line and no picker).
  - **Window**: Today (solar day 06:00→06:00) · Last 7 days · Next 7 days.
    Replaces the header hours selector (24 h / 48 h / 7 d) and the "Historical vs Actual"
    and "Last 7 Days" buttons.
  - **Forecast**: Off · Latest · 1 h · 6 h · Day-ahead (the existing #31 leads).
  - kW / kWh stays; L1·L2·L3 stays for the inverter line (kW only).
- Single line: actual line(s) to now; forecast P50 dashed + P10–P90 band across the whole
  window, so past slots compare and future slots read ahead.
- All: stacked actual (inverter, grid, EV) to now; after now each forecast line continues
  hatched; a dashed summed forecast (inverter + grid) runs across the window.
- Chips: kWh so far per line, "+x forecast" to 06:00, total and projected total by 06:00,
  inverter score vs median (from the existing accuracy KPIs), gap warning.
- Tooltip keeps "Why off" (staff only, existing rules, inverter line).

## Grid-direct forecast (backend)

`GET /api/sites/<id>/load-forecast-accuracy/?line=grid&days=N` (default `line=inverter`,
existing behaviour unchanged).

- Actual: 15-min mean of the site's energy meter total power (energymeter_5min, same
  normalised total as `/energy-meter/history/`).
- Forecast for a slot: median of the same slot on the previous 7 days, needing ≥4 of 7 days
  with data, else null. P10/P90: 10th/90th percentile of those days.
- Covers the past `days` plus the next 7 days. `lead` is ignored (the median is known a
  day ahead, so every lead is the same); the response says `"lead": "median"`.
- Response: `{timeseries:[{ts, actual_kw, predicted_kw, p10_kw, p90_kw, method:'median7'}],
  lead:'median', note}`. `note` carries a known meter caveat from a backend setting
  (coim_002: "Meter reads ~25% low (CT gain, unresolved)"), else null.
- No new table, no model, no Lambda or R3.2 change. Same auth as today.

## Anti-goals (owner, 2026-11-17)

- A misleading total: the card always says which lines are forecast and which are measured
  only, and shows the meter caveat.
- Breaking R3.2: no change to the inverter forecast, its storage, KPIs or Lambda.
- A line forecast worse than the plain 7-day median: grid uses the median itself until a
  model beats it in a backtest.
- Silent gaps: a slot where a line has no data while others do is tinted red and the total
  is marked "incomplete"; it is never counted as 0 W.

## Decided by the owner

- First user: staff dashboard. Sites: coim_002 + on-grid (none installed yet).
- EV: shown measured only, never forecast and never in the summed forecast.
- Meter 115 under-reading (~0.75×): ignore for now, but note it on the card.
- Grid method: left to the builder → 7-day median.
- Layout: one combined stacked card (mockup above).

## Calls made by the builder (check these)

1. Grid forecast is computed on request from meter history, not stored.
2. The 48 h hours option is dropped (Today / Last 7 days / Next 7 days only).
3. Forecast defaults to Latest; Off shows the plain profile.
4. The Accuracy sub-tab stays inverter-only (a median scored against itself says nothing).
5. The meter caveat text lives in a backend setting, not in frontend code.
6. The card is a new component file `LoadCard.tsx` next to PhaseLoadTab, which loses the
   two old cards.
7. Customer portal untouched: the Phase Load tab exists only in the staff portal.

## Out of scope

Homeowner / battery / bill views; an EV forecast; a grid-direct model; fixing the meter gain;
per-line accuracy KPIs; on-grid incomer metering (needs a CT/meter at the incomer first).

## Tests

Test scenarios: frontend `docs/test-scenarios/combined-load-card.md`, backend
`docs/test-scenarios/load-line-grid-forecast.md` (written before the tests).
