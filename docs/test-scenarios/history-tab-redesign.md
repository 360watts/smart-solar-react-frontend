# History tab redesign (test scenarios)

- Spec: docs/superpowers/specs/2026-11-19-history-tab-redesign-design.md
- Mockups A3 + C: https://claude.ai/artifact/SuAi4BH4Egw26t4jdaHEVz
- Data:
  - `GET /sites/<id>/household/day/` and `/household/daily/` (backend docs/test-scenarios/household-history.md)
  - `GET /sites/<id>/events/`
- Code: `tabs/HistoryTab.tsx`, `tabs/historyModel.ts`, `tabs/HistoryCalendar.tsx`
- This doc replaces the Nov 19 `history-power-flow-card.md`. Its rows H1–H6 belonged to the old Power Flow card, which is gone.

| # | Area | Given | When | Then | Type | P | Status |
|---|---|---|---|---|---|---|---|
| M1 | Model | now 11:30 IST Nov 19 | periodRange today/7d/30d, offset 0 and -1 | IST day strings; 7d = Nov 13–19; -1 = Nov 6–12 | unit | P0 | passing |
| M2 | Model | 3 whole days + 1 inverter-only day | totals | basis whole, counted 3 of 4, sums only whole days | unit | P0 | passing |
| M3 | Model | no whole days | totals | basis inverter, counted = days with a home figure | unit | P0 | passing |
| M4 | Model | slots for yesterday | slotsToFlows until the same clock time | kWh = kW × 0.25 for slots before the time | unit | P0 | passing |
| M5 | Model | incident Nov 15–17, range Nov 13–19 | buildFlags | one amber flag, dates 15, 16, 17 | unit | P0 | passing |
| M6 | Model | day coverage 0.6, battery 40–45% | buildFlags | gap flag (grey), battery flag (amber); checks 3 | unit | P1 | passing |
| M7 | Model | totals + previous | sentence | own % and "up from" / "down from" / "the same"; inverter basis says "inverter circuits" | unit | P1 | passing |
| M8 | Model | 30-day range starting Wednesday | calendarCells | 2 blank cells first (Monday start); levels 0–4; grid metric inverted | unit | P1 | passing |
| M9 | Model | custom Aug 22–Nov 19 (90 days), offset -1 | customRange, weeks | len 90, steps back 90 days; 13 weekly rows summing their days; balance check flags a >5% gap | unit | P1 | passing |
| M10 | Model | 3 "Device Offline" incidents (2 devices, 1 open) + 1 info incident | buildFlags | one row per title: "Device Offline · 3 times", time span, devices, "1 still open"; info row grey; open groups first | unit | P0 | passing |
| U1 | Tab | Today data | render | chart first with a header line (own %, bought, exported), then Anything wrong?, then Where energy went with 4 tiles | unit | P0 | passing |
| U2 | Tab | 7 days | click "7 days" | daily stacked bars; solar made as dots | unit | P0 | passing |
| U3 | Tab | 30 days | click "30 days" | calendar, 30 day buttons; clicking one shows its panel | unit | P0 | passing |
| U4 | Tab | inverter-only days in the period | render | note "Whole home on N of M days" | unit | P0 | passing |
| U5 | Tab | site without a meter | render | "Inverter circuits only" label; tiles still show | unit | P1 | passing |
| U6 | Tab | ‹ pressed | click | requests move one period back; › disabled at offset 0 | unit | P1 | passing |
| U7 | Tab | Inverter detail on | toggle | inverter output and inverter-side load lines added to the Today chart | unit | P2 | passing |
| U8 | Tab | Table view | click Table | table with the same rows | unit | P2 | passing |
| U9 | Tab | Pick dates, From set 90 days back | change | weekly bars ("Week of …"), 13 of them; ≤ 60 days stays daily | unit | P1 | passing |
| U10 | Tab | solar made ≠ home + battery + exported by > 5% | render | "Figures don't fully balance" note with the gap | unit | P2 | passing |

## Live verification

| # | Given | Check | Then | P | Status |
|---|---|---|---|---|---|
| L1 | coim_002 Today | compare with the Load card's All view | home within 2% | P0 | planned |
| L2 | coim_002, 30 days | look | days before Oct 23 greyed; note shows N of 30 | P0 | planned |
| L3 | switching periods, ‹ › | use | instant after the first load (5-min cache) | P1 | planned |
| L4 | a site without a meter | look | inverter-only label everywhere | P1 | planned |
| L5 | light and dark mode, 390 px wide | look | readable, the calendar fits, no sideways page scroll | P1 | planned |
