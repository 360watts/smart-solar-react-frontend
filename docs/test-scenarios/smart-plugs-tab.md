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
