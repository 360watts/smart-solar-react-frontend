# Viewer device tabs (phase 1): frontend

Spec: docs/superpowers/specs/2026-10-29-viewer-portal-redesign-design.md (§5.0, §5.3).
Tests: src/features/staff/viewer/__tests__/deviceChart.test.ts, DeviceDashboard.test.tsx, ReadingsTab.test.tsx, OperationsTab.test.tsx.

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| T1 | Tabs | /devices/47/dashboard | open | Overview selected; tabs Overview, All values, Every reading, Operations | unit | P0 | passing |
| T2 | Tabs | ?tab=readings | open | Every reading selected; clicking Operations sets ?tab=ops | unit | P0 | passing |
| T3 | Tabs | ?tab=values | open | legacy sections render (Solar, Grid, Status and codes) | unit | P0 | passing |
| T4 | Tiles | battery -1500 W, grid -300 W | open | Charging at 1.50 kW; Selling; grid shown as 0.30 kW | unit | P1 | passing |
| T5 | Tiles | energy meter | open | Total power tile | unit | P1 | passing |
| T6 | Chart | series call fails, no data yet | open | Couldn't load the chart. Trying again… | unit | P1 | passing |
| C1 | Detail | range 6 h | render detail buttons | only Per minute and 5 min | unit | P0 | passing |
| C2 | Detail | detail Every reading, switch range to 24 h | — | detail becomes 5 min | unit | P0 | passing |
| C3 | Ticks | lo 1.2 hi 1.6, zero | niceTicks | 0, 0.5, 1, 1.5, 2 | unit | P1 | passing |
| C4 | Segments | points 2 s apart with a 60 s hole, max gap 6 s | segments | two segments | unit | P0 | passing |
| C5 | Colours | names R, Y, B | colorsFor | red, ochre, blue tokens | unit | P2 | passing |
| C6 | Chart | bucketed series with __min/__max | render | spread band path present; readout shows "(lo to hi)" | unit | P1 | passing |
| C7 | Chart | coverage full/partial/empty | render | three cell shapes (full height, half height, amber) | unit | P1 | passing |
| C8 | Chart | code_changes has 0x0004 | render | codes lane label "Fault 0x0004 at …" | unit | P2 | passing |
| C9 | Format | durations 119.6 s, 3599.6 s, 9.96 s; hex of 4; series value lookup | duration, hexCode, val | "2 min 0 s", "1 h 0 min", "10 s", 0x0004; non-numbers are undefined | unit | P2 | passing |
| C10 | Chart | empty series, null gap stats | render | no crash, no gap band, "No readings in this range" | unit | P1 | passing |
| C11 | Chart | longest gap 7 s vs 5 s, median 2 s | render | band only when over 3x median | unit | P1 | passing |
| C12 | Chart | meter current 5.43 A | render | readout shows 5.4 | unit | P2 | passing |
| R1 | Readings | page of rows with one 60 s hole, median 2 s | render | a row "No readings for 1 min 0 s" | unit | P0 | passing |
| R2 | Readings | next_before set | click Older | fetch with before | unit | P1 | passing |
| R3 | Readings | click a row | — | packet panel opens beside the table with reading JSON | unit | P0 | passing |
| R4 | Readings | packet message null, note pruned | open | "The whole message is older than 14 days and has been removed." | unit | P1 | passing |
| R5 | Readings | meter packet | open | raw caret string shown | unit | P1 | passing |
| R6 | Readings | fault word non-zero | render | row tinted, code shown as 0x0004 (no ligature) | unit | P2 | passing |
| R9 | Readings | two rows opened, first packet answers last | resolve | panel shows the second reading | unit | P1 | passing |
| R10 | Readings | page fetch rejects | render | "Couldn't load readings" not the empty text | unit | P1 | passing |
| R11 | Readings | Older then Newer | click | first page fetched again | unit | P1 | passing |
| R12 | Readings | warning code non-zero in a hidden column | render | row tinted | unit | P2 | passing |
| O1 | Operations | state no_record | render | "No record yet" | unit | P0 | passing |
| O2 | Operations | state not_confirmed | render | warning text "Not confirmed after 5 min" | unit | P0 | passing |
| O3 | Operations | state confirmed by you | render | "Confirmed … by you" | unit | P1 | passing |
| O4 | Operations | no device_control | render | statuses show, no action buttons | unit | P0 | passing |
| O5 | Operations | meter + device_control | render | meter calibration and interval controls visible | unit | P1 | passing |
| O6 | Operations | gateway + device_control | render | APN form visible | unit | P1 | passing |
| O7 | Operations | device offline | render | one plain offline line above the cards; admin-only note at the bottom | unit | P1 | passing |
| O8 | Operations | meter interval draft | out of range / empty / API failure | Save disabled with hint / saves default / draft kept | unit | P1 | passing |
| O9 | Operations | DevicePage variant ops | render | no Status, Readings, name or fleet builds; controls and Logs stay | unit | P1 | passing |
| O10b | Operations | hard reset confirm | serial not typed / wrong / exact | confirm disabled until the serial matches (case and spaces ignored), then reset is sent | unit | P0 | passing |

## Live verification
- [ ] Viewer opens bench gateway: Overview chart at 1 h / every reading shows the live line and the reporting lane lines up with gaps.
- [ ] Every reading: click a row; packet panel stays in view while scrolling; Copy works.
- [ ] Operations: reboot as a viewer; Waiting, then Confirmed after reconnect.
- [ ] Narrow window (390 px): tabs scroll, chart fits, packet panel stacks under the table.
- [ ] Dark mode: chart tokens readable.
