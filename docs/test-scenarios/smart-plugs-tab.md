# Site panel: Smart plugs tab — test scenarios

Smart plugs get their own **Smart plugs** tab (`plugs`) in the site panel (`SiteDataPanel`) instead of being listed inside the energy flow diagram (owner request, 2026-10-09). The tab (`SiteDataPanel/tabs/PlugsTab.tsx`) reads the `smart_devices` list the panel already gets from `staff_overview`; it makes no request of its own. A "plug" is any smart device whose `appliance_label` is not `grid` (the same set the energy flow used). Shared helpers live in `EnergyFlow/plugHelpers.tsx` (`isDeviceOffline`, `freshLatest`, `circuitOf`, `plugGroup`, `plugState`, `deviceLabel`, `applIcon`, `createDeviceNodeData`); `EnergyFlow/index.tsx` re-exports `isDeviceOffline` and `anomalousDevices`. Status: planned | written | passing | live-verified.

Left out on purpose: an on/off or schedule control. The app has no plug switch or schedule API wired (`services/api.ts` only reads and edits plug settings), so the tab is read-only for everyone; the `device_control` gate is for when one exists. "Today's energy" is not shown: a reading's `energy_kwh` is the plug's cumulative counter (shown as "Total Energy" in the detail), not today's.

## Tab visibility

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| PV-1 | Inverter site, `hasPlugs` true | `tabsFor` | `plugs` after `phase-load`, before `usage` (if meter) and `devices` | unit | P0 | written |
| PV-2 | Inverter site, `hasPlugs` false / null / undefined | `tabsFor` | No `plugs` | unit | P0 | written |
| PV-3 | Meter-only site, `hasPlugs` true | `tabsFor` | `usage, plugs` (plus `devices` last when listed) | unit | P1 | written |
| PV-4 | Meter-only site, `hasPlugs` false | `tabsFor` | `usage` only (unchanged) | unit | P1 | written |
| PV-5 | `visibleTabs` without `plugs` (any caller) | `tabsFor` with `hasPlugs` true | No `plugs` | unit | P1 | written |
| PV-6 | Viewer site page | Renders | `visibleTabs` includes `plugs`; the tab still only shows when the site has a plug | unit | P1 | written |
| PV-7 | Panel, overview returns smart devices with only `appliance_label: 'grid'` | Panel renders | No Smart plugs tab | unit | P2 | planned |

## Plugs tab

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| PT-1 | Plugs on inverter backup, grid direct and an EV charger | Tab renders | Three groups in order "Backup (via inverter)", "Grid direct", "EV charging", each plug under its group | unit | P0 | written |
| PT-2 | Plug with a reading older than 5 minutes, or never | Tab renders | "Offline" chip (amber), no wattage | unit | P0 | written |
| PT-3 | Fresh reading, power > 1 W, active | Tab renders | "Running" chip (green) and live power | unit | P0 | written |
| PT-4 | Fresh reading, ~0 W | Tab renders | "Idle" chip (neutral) | unit | P1 | written |
| PT-5 | No plugs (only `grid` devices or none) | Tab renders | Empty state "No smart plugs at this site yet" | unit | P1 | written |
| PT-6 | A plug row | Clicked | `NodeDetailModal` opens with that plug's node data (same payload the flow used) | unit | P0 | written |
| PT-7 | Any role, with or without `device_control` | Tab renders | No on/off switch (no control API exists) | unit | P1 | written |
| PT-8 | Plug without `circuit` | Tab renders | Grouped by the old heuristic (geyser / AC / washer / fridge → Grid direct, else Backup) | unit | P2 | planned |

## Energy flow

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| EF-1 | Site with plugs | Flow renders | No per-plug cards; Backup load / EV charging / Grid direct show totals only | unit | P0 | written |
| EF-2 | Card with plugs and `onOpenPlugs` passed | "N smart plugs ›" clicked | Panel switches to the Smart plugs tab | unit | P0 | written |
| EF-3 | Flow without `onOpenPlugs` (mobile dashboard, analytics snapshot) | Renders | "N smart plugs" as plain text, not a button | unit | P2 | planned |
| EF-4 | Grid direct with plugs but no energy meter | Renders | "Plugs total" card with the sum of fresh plug readings | unit | P2 | planned |
| EF-5 | Any | Renders | Site Total line, anomaly banner (click opens the plug detail) and node-detail payloads unchanged | unit | P1 | planned |
| EF-6 | Existing `isDeviceOffline.test.ts` | Runs | Still imports from `./index` and passes | unit | P0 | written |

## Live verification

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| LV-1 | coim_002 (plugs on all three circuits) on the staff site page | Open Overview, click "N smart plugs ›" on Grid direct | Smart plugs tab opens; AC(NEW) shows Offline, live plugs show power | live | P1 | planned |
| LV-2 | Site with no plugs | Open site panel | No Smart plugs tab; flow cards show no plug link | live | P1 | planned |
| LV-3 | Viewer assigned to coim_002 | Open `/my-sites/coim_002` | Smart plugs tab present, read-only | live | P2 | planned |

## Circuit rows with slim tiles (redesign, 2026-11-10)

The tab answers "what is drawing now". Amps and volts stay in the detail popup.

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| R1 | EV 2.68 kW, Fridge 82 W, Pump 0 W idle, one offline | Tab renders | Backup row first, then Grid direct, then EV; offline plug listed last, as a chip | unit | P0 | passing |
| R2 | Same | Summary strip | "On plugs now" = sum of fresh plug kW; Running counts running of N; Not reporting counts offline | unit | P0 | written |
| R3 | Offline plug | Renders | Dashed chip, no wattage; "Last seen N h ago" or "No reading yet" | unit | P0 | written |
| R4 | A plug with `today` null | Renders | No Today line and no sparkline (left out, not a dash); summary Today says "partly counted" | unit | P0 | written |
| R5 | Curve with null hours | Sparkline renders | Gaps drawn, never zero-filled | unit | P0 | written |
| R6 | Any row | Clicked | Existing node detail modal opens | unit | P1 | written |
| R7 | Plugs on three circuits | Renders | Circuit is a label (Backup / Grid direct / EV) with its reporting plug count, the same colour on every circuit; tiles in a row ranked by draw | unit | P1 | passing |
| R8 | Site with no plugs | Renders | Existing empty state | unit | P1 | written |
| R9 | coim_002 | View at 1440, 1024, 390 px, dark and light | Circuit rows of tiles, one column at 390 px; bars readable; no overflow | live | P1 | planned |
| R10 | Plug not reporting | Chip clicked | Detail popup opens (same as a running tile) | unit | P1 | written |
| R11 | Overview tab | Header renders | No time-range dropdown; it shows on History only, and Overview resets the range to Today | manual | P2 | planned |
| R12 | Grid direct has more installed plugs than EV, one of them offline | Renders | Backup first, then most installed plugs (offline counted); ties keep EV before Grid direct | unit | P1 | passing |
| R13 | Live inverter reading 640 W, Backup plugs 105 W | Renders | "105 of 640 W backup load · 535 W not on a plug", bar with a segment per drawing plug and a gap segment; tiles carry matching swatches | unit | P0 | passing |
| R14 | Reading missing, zero, or not live (panel passes null) | Renders | No bar; Backup shows "N W on plugs" when it has two or more plugs | unit | P0 | passing |
| R15 | Plugs add up to more than the reading | Renders | Bar has plug segments only, no gap; header shows only the plug total | unit | P0 | passing |
| R16 | A Backup plug is offline and a reading exists | Renders | Header adds "includes 1 plug not reporting" | unit | P1 | passing |
| R17 | Live meter reading on Grid direct | Renders | Same bar and "of" text, with "grid-direct load" | unit | P0 | passing |
| R18 | One EV plug | Renders | No bar and no row total (the tile is the total) | unit | P1 | passing |
| R19 | Figures on either side of 1 kW | Renders | One unit per line: "0.95 of 1.20 kW", never "950 W of 1.20 kW" | unit | P1 | passing |
| R20 | AC at 9 W, washer at 4 W | State read | Standby, not counted in "running"; popup status is not "active" | unit | P0 | passing |
| R21 | Fridge at 3 W, AC at 40 W, plug at 1 W or less | State read | Fridge Running, AC Running, Idle | unit | P0 | passing |
| R22 | Offline plug with a today figure | Renders | Chip shows "Today N kWh" so the summary can be reconciled | unit | P1 | passing |
| R23 | Any tile | Renders | No amps or volts on the tile | unit | P1 | passing |
| R24 | coim_002, inverter and meter live | Compare with Overview | Backup and Grid direct "of" figures match the energy flow cards | live | P0 | planned |
| R25 | coim_002 plug history | Review a week | Standby thresholds (AC 15 W, washer 5 W) match real standby draw | live | P2 | planned |
