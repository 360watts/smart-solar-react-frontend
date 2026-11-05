# Site circuits card (staff site hardware page)

`src/features/staff/InverterMeasurementConfig.tsx`, card "Circuits". A site's power has three parts: the inverter side (measured by the gateway), the grid board (measured by the energy meter) and any circuit wired on its own, such as an EV charger (measured by a plug or clamp, or noted as not measured). The first two are fixed rows from the hardware; only the third kind is a circuit line (`/sites/<id>/circuit-lines/`), which the backend stores as `ev_line` and rejects for `inverter_backup` / `grid_direct`.

Why (coim_002, Nov 5 2026): a line labelled "Grid" was added through "Something else", stored as an EV circuit with nothing measuring it, and made the site read as not fully metered although meter 115 measures the grid board.

| # | Area | Given | When | Then | Type | Priority | Status |
|---|---|---|---|---|---|---|---|
| C1 | Fixed rows | Site with gateway GW-1 and meter EM-1 | open the page | "Inverter side — measured by monitor GW-1" and "Grid board — measured by meter EM-1" | unit | P0 | passing |
| C2 | Fixed rows | No gateway, no meter | open the page | both rows say "Not measured yet" | unit | P1 | passing |
| C3 | Guard | Composer open | type "Grid" (or "inverter", "mains", "backup") as the name | warning that the monitor and meter already cover it; Add is disabled | unit | P0 | passing |
| C4 | Guard | Composer open | type "Garage EV charger" | no warning; Add enabled | unit | P1 | passing |
| C5 | Existing line | A saved line named "Grid" | open the page | the row is marked "Already covered by the meter — remove this" | unit | P1 | passing |
| L1 | Live | coim_002 after removing line 2 | circuit map | `is_fully_metered` true, `unmonitored` empty | live | P0 | planned |
