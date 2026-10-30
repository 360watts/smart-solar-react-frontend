# Viewer device page: All values tab (card layout)

Mockup: scratchpad tabs/project/Main.dc.html. Code: `src/features/staff/viewer/AllValuesTab.tsx`, `allValues.css`; grouping helpers stay in `DeviceDashboard.tsx`.
Tests: `src/features/staff/viewer/__tests__/AllValuesTab.test.tsx`, `DeviceDashboard.test.tsx`.
Data: the legacy dashboard response (`latest`, last-hour `history`). No code-change times exist in it, so the amber card shows no "changed" text.

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| V1 | Cards | gateway latest with pv, grid, load, battery, kWh keys | open All values | one card per group with name and row count; row shows label, key, value, unit | unit | P0 | passing |
| V2 | Phases | grid_l1/l2/l3_voltage_v | open | three rows labelled R, Y, B, each with its own key and value | unit | P0 | passing |
| V3 | Sparkline | history in the last hour for pv1_power_w | open | the row has a polyline; counters (kWh) and codes have none | unit | P0 | passing |
| V4 | Faults | fault_word_1 = 4, warning_word_1 = 0 | open | amber card "Faults and warnings", "1 active", codes as 0x0004 / 0x0000, no "changed" text | unit | P0 | passing |
| V5 | Show more | a group of 7 rows | open; click "Show 2 more" | 5 rows first, then all 7; the link becomes "Show fewer" | unit | P1 | passing |
| V6 | Search | rows with several keys | type "pv2" (key) or "frequency" (label) | only matching rows and their cards remain; groups with no match disappear; nothing matches shows a plain message | unit | P0 | passing |
| V7 | Filters | one row changing in the last hour, one fault active | click Changing now / Faults and warnings / All | only those rows show; pill counts match; All N is the total | unit | P0 | passing |
| V8 | Copy | a row key | click the key | the key is written to the clipboard and the key text reads "Copied" | unit | P1 | passing |
| V9 | Meter | device_type energy_meter | open | meter groups (Voltage, Current, ...) in the same card layout | unit | P1 | passing |
| V10 | Group cap | more than 6 groups | open | first 6 shown with "Showing 6 of N groups" and "Show all groups"; searching shows all | unit | P2 | passing |
| V11 | Loading | no data yet | open | the page's shared DeviceSkeleton (Skeleton.tsx) until the first response; no cards (existing component, no new test) | unit | P2 | written |
| V12 | Wiring | ?tab=values | open | tab count equals the number of rows; header and tabs unchanged | unit | P0 | passing |
| V13 | Empty | last_reading_at null | open | "No readings yet" and no cards | unit | P1 | passing |

## Live verification

- [ ] Open a gateway with data: cards fill each row, no horizontal scroll at 375 px and 1440 px.
- [ ] Dark mode: icon tiles, amber faults card, phase colours readable.
- [ ] Numbers in Fira Code, units in Rubik, 0x0004 shows without ligature.
- [ ] Tap a key on a phone: copied.
- [ ] Meter device (F82CE8D1CCB6): same layout with Voltage, Current, power groups.
