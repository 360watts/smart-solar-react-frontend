# Every reading tab redesign (device page)

Mockup: Readings.dc.html (toolbar, table card, packet panel). Code: src/features/staff/viewer/ReadingsTab.tsx, readingsTab.css.
Tests: src/features/staff/viewer/__tests__/ReadingsTab.test.tsx. Earlier scenarios R1-R12 in viewer-device-tabs.md still hold.
Live additions ("New ones are added at the top") are not claimed: the tab does not poll.

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| RR1 | Toolbar | first page, next_before set | render | Newest (pressed), Older, Newer buttons; Newer disabled; Older enabled | unit | P0 | passing |
| RR2 | Toolbar | page of 5 rows | render | line "5 readings, hh:mm:ss back to hh:mm:ss." with no live claim | unit | P1 | passing |
| RR3 | Paging | Older then Newer | click | tie-safe cursor used, back to first page (same calls as before) | unit | P0 | passing |
| RR4 | Jump | date-time chosen | click Go | fetch with before = that time as ISO | unit | P1 | passing |
| RR5 | Columns | 7 default columns | render | Columns button shows count 7; ticking another key makes 8 | unit | P1 | passing |
| RR6 | Table | rows with a 60 s hole | render | amber row "No readings for 1 min 0 s (hh:mm:ss to hh:mm:ss). The device was not sending." | unit | P0 | passing |
| RR7 | Table | click a row | open | row has class selected and aria-selected; footer says "Reading 1 of 2 selected" with keyboard hint | unit | P0 | passing |
| RR8 | Keyboard | row selected | ArrowDown, then Escape | next row opens; Escape closes the packet | unit | P1 | passing |
| RR9 | Footer | next_before set | click "Older 100" | fetch with before | unit | P0 | passing |
| RR10 | Loading | request pending | render | TableSkeleton (status "Loading…") | unit | P2 | passing |
| RR11 | Packet | gateway packet with message 0.3 s after | open | title "Reading hh:mm:ss"; sub line "Stored hh:mm:ss, nearest message 0.3 s later"; keys and size; fault chip "1 fault code" | unit | P0 | passing |
| RR12 | Packet | gateway packet | open | JSON view with keys; fault key highlighted; "… N more keys" and Show all keys reveals them | unit | P1 | passing |
| RR13 | Packet | message present / message null note pruned | click Message on the wire | message text shown / pruned note shown | unit | P0 | passing |
| RR14 | Packet | meter packet | open | As stored shows parsed values; wire view shows raw string | unit | P1 | passing |
| RR15 | Packet | open | Copy as JSON, Copy one row as CSV | clipboard gets JSON; gets header line plus value line | unit | P1 | passing |
| RR16 | Packet | open then Close | click | panel gone | unit | P1 | passing |
| RR17 | Packet | out-of-order responses, packet fetch fails | open | latest wins; failure message shown | unit | P0 | passing |
| RR18 | Errors | readings fetch fails / empty page | render | "Couldn't load readings..." / "No readings in the last 10 days." | unit | P0 | passing |

## Live verification
- Open Every reading on a gateway and a meter: layout matches mockup, light and dark, numbers in Fira Code.
- Phone width: toolbar wraps, table scrolls sideways with sticky Time column, packet panel stacks under the table.
- Arrow keys move the selected row; Esc closes.
