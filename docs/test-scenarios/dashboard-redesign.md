# Dashboard redesign + energy flow: test scenarios

| # | Area | Given | When | Then | Type | Pri | Status |
|---|------|-------|------|------|------|-----|--------|
| 1 | Mix ring | pv 1.73, batt -1.33 (charging), grid 0.02 | shares computed | solar 0.99, battery 0, grid 0.01 (sums to 1) | unit | P0 | passing |
| 2 | Mix ring | batt +1.0 (discharging), pv 1.0, grid 0 | shares computed | solar 0.5, battery 0.5 | unit | P0 | passing |
| 3 | Mix ring | pv 0, batt 0, grid 0 | shares computed | null (ring shows empty track) | unit | P0 | passing |
| 4 | Mix ring | pv/batt/grid null | shares computed | null, no NaN | unit | P0 | passing |
| 5 | Lines | any anchors | paths built | each source path starts at its card point and ends on the ring edge; each load path starts on the ring edge and ends at its card point | unit | P0 | passing |
| 6 | Lines | battery charging | rendered | ring-to-battery line animates; battery-to-ring does not | unit | P1 | passing |
| 7 | Lines | EV idle, grid direct 0.6 kW | rendered | EV line static grey; grid direct line animated, neutral grey like every load line (colour: row 39) | unit | P1 | passing |
| 8 | Lines | export (grid < 0) | rendered | ring-to-grid line animates, grid-to-ring does not | unit | P1 | planned (no test yet) |
| 9 | Rails | no daily totals available | rendered | rail values show "—", never a number | unit | P0 | passing |
| 10 | Health band | devices 3/3 online, no alerts | rendered | "Online", "No active alerts", "3 / 3 online" | unit | P0 | passing |
| 11 | Health band | 1 of 3 online | rendered | amber "Partly online" | unit | P1 | passing |
| 12 | Health band | 0 online | rendered | "Offline" | unit | P1 | passing |
| 13 | Health band | 2 alerts, one critical | rendered | "2 open alerts" button, amber styling (not red; colour is a visual check, jsdom drops CSS vars) | unit | P1 | passing |
| 14 | Dashboard | no active alerts | rendered | no alerts banner element | unit | P1 | planned (no Dashboard render test; check at npm run dev) |
| 15 | Existing | `isDeviceOffline` | suite runs | still passes | unit | P0 | passing |
| 16 | Live | coim_002 | open Overview, dark and light | no overlap, lines meet card and ring edges, all numbers match the old diagram | live | P0 | planned |
| 17 | Live | meter-only site | open | Usage tab only, no energy flow errors | live | P1 | planned |
| 18 | Live | phone width 390 px | open | blocks stack, nothing clipped, no horizontal page scroll | live | P1 | planned |
| 19 | Live | resize window | drag width | lines stay attached to cards (re-measured) | live | P0 | planned |
| 20 | Rails | Older backend (no `home_today` key), `latest.load_today_kwh` 3.49 (today), solar-day `energy_summary_today.load_kwh` 1.0 | rail built | "Home used" 3.49, the same field as the Load tile and the Consumption chip, not 1.0 | unit | P0 | written |
| 21 | Rails | load today 4.0, `grid_buy_today_kwh` 1.0 | rail built | "From your own power" 75% | unit | P0 | written |
| 22 | Rails | latest reading is from an earlier IST day | rail built | "Home used" and "From your own power" are null ("—"), never yesterday's number | unit | P0 | written |
| 23 | Rails | load today 0 or missing, or grid-in missing | rail built | own-power null ("—"), no NaN or Infinity | unit | P1 | written |
| 24 | Layout | source cards | rendered | Solar, Battery and Grid cards fill their grid column (width 100%), same columns as the load row, so line anchors sit at the column centre | unit | P1 | written |
| 25 | Header | tabs shown | rendered | Today select, last-update time and Refresh sit at the right end of the tab row (no separate bar between health band and tabs); Refresh still refetches | unit | P1 | written |
| 26 | Header | no data (tab row not rendered) or `hideTabs` | rendered | controls fall back to the old standalone bar | unit | P2 | planned (visual check at npm run dev) |
| 27 | Text | Overview diagram | open, dark and light | rail titles 14 px, ledger and mix rows 15 px, card labels 12-13 px, numbers tabular, nothing wraps or overflows at 1280 px and 390 px | live | P2 | planned |
| 28 | Rails | battery SoC 72, batt -1.33 (charging) | rendered | ~~right rail Battery card~~ superseded by row 40 (card removed as a duplicate) | unit | P1 | superseded |
| 29 | Plugs | host passes no `onOpenPlugs` (mobile staff dashboard, Analytics snapshot), 2 grid-direct plugs | rendered | load card has a collapsed "Smart plugs (2)" `<details>` with one row per plug (name, state chip, power); no "›" link button | unit | P1 | written |
| 30 | Layout | window 1280 px | open | block capped at 1100 px and centred; ring 150 px; both rails as tall as the centre panel, values right under their titles, no empty void when a sparkline is missing | live | P1 | planned |
| 31 | Layout | window under 1100 px | open | rails stack above/below the centre panel as rows of 2-3 cards (auto-fit, min 200 px), not full-width tall cards | live | P1 | planned |
| 32 | Rails | `staff_overview.home_today.total_kwh` 5.0 (backup 3.0 + grid direct 2.0), `grid_buy_today_kwh` 1.0, Load tile 3.0 | rail built | "Home used" 5.0 (whole home, not the Load tile); "From your own power" 80% | unit | P0 | written |
| 33 | Rails | `home_today` is null (backend has no figure) | rail built | "Home used" and own power "—"; no fallback to `load_today_kwh` | unit | P0 | written |
| 34 | Rails | `home_today.total_kwh` null (no part has data) | rail built | "Home used" and own power "—", no caption | unit | P1 | written |
| 35 | Rails | `home_today.partial` true, covers `backup, grid_direct` | rendered | muted caption "Partly counted · Backup + Grid direct" under Home used, tooltip says only those are counted | unit | P1 | written |
| 36 | Rails | grid in larger than the counted total | rail built | own power clamps to 0, never negative | unit | P2 | written |
| 37 | Live | coim_002 | open Overview | "Home used" = backup + grid-direct meter (+ EV) for today; equals `home_today.total_kwh` in the staff-overview response | live | P0 | planned |
| 38 | Cleanup | any reading | rendered | Solar, Battery and Grid are flat cards like the rail cards (1px border, 16 px padding, 18 px radius, coloured dot + 12 px uppercase label, 28 px value, one 13 px muted sub-line); no glow, gradient, arc gauge or big icon; click still opens the detail | unit | P0 | written |
| 39 | Cleanup | exporting (grid < 0), loads drawing | rendered | grid card and grid line stay blue, card says "Selling"; every load line is neutral grey; ring and mix bar use the same amber/green/blue | unit | P1 | written |
| 40 | Cleanup | battery SoC 72, charging | rendered | battery card sub-line "Charging · 72%" with a thin SoC bar; no right-rail Battery card ("Battery" appears once) | unit | P1 | written |
| 41 | Cleanup | Backup load 0.5 kW and a backup plug | rendered | no "Site Total" line, no "Same as Backup" card, no "Detail ›"/"Charging ›" chevrons, no nested boxes inside load cards | unit | P0 | written |
| 42 | Cleanup | grid-direct plug 237 W, no meter | rendered | Grid Direct card value "237 W" on one line with sub-line "Plugs total"; with a meter or inverter figure no "Plugs total" line | unit | P1 | written |
| 43 | Cleanup | ring | rendered | interior shows only HOME USES + value; caption ("Running mostly on sun") sits below the ring | unit | P1 | written |
| 44 | Cleanup | solar 1.73, grid 0.022, charging | rendered | left rail is one "Today" card (Solar made / Home used / From your own power, divided rows); right rail is one "Right now" card (In / To battery / To home / Losses, divider, one stacked mix bar, legend "Solar 99%", "Battery 0%", "Grid 1%"); zero shares draw no segment | unit | P1 | written |
| 45 | Cleanup | load card with a payload and a plugs link | click | whole card is the button ("Backup Load details"); the "N smart plugs ›" link opens the Smart plugs tab without opening the detail modal | unit | P1 | written |
| 46 | Health band | equipment health score 90 | rendered | "Equipment health" item shows "90%" | unit | P1 | written |
| 47 | Health band | health score unknown (request failed / loading) | rendered | "Equipment health" shows "—" | unit | P2 | written |
| 48 | Cleanup | Overview tab | open | no observatory strip (site name, LIVE chip, Health/Solar/Battery/Load chips) above the energy flow; only the flow's own Live dot; Health tab (SystemHealthPanel) still loads its ring and tiles | live | P1 | planned |
| 49 | Layout | window under 1100 px / under 700 px | open | centre panel on top, the two rail cards side by side in 2 columns; under 700 px one column; rail rows spread over the card height (no blank void) | live | P1 | planned |

| 50 | Whole home | backup 0.237 kW, grid direct 0, EV 2.68 kW | ring built | ring centre HOME USES 2.92 kW with muted line "Backup 237 W · EV 2.68 kW" (parts > 0 only); ledger "Whole home" row above In shows the same | unit | P0 | written |
| 51 | Whole home | EV only / all three / CT reversed / all zero | helper | `wholeHomeKw` sums them; reversed CT counts as 0; zero gives 0 and empty parts text; never negative | unit | P0 | written |
| 52 | Whole home | any reading | rendered | ring segments and the mix bar stay the inverter supply mix (bar titled "Inverter supply mix"); ledger "To backup loads" = inverter load only | unit | P1 | written |
| 53 | Whole home | caveat | review | if a grid-direct CT ever sits on the grid main it also sees the backup bus and Whole home double counts backup; coim_002's CT is a separate submeter, so we add | live | P2 | planned |
| 54 | Layout | block width >= 900 / 600-899 / < 600 px (container, not window) | resized | wide: rails beside centre; medium: centre on top, rails side by side; narrow: one column, three-card rows wrap (auto-fit min 160 px) | live | P1 | planned |
| 55 | Layout | rail clamp(180,20cqw,240); ring clamp(120,18cqw,150); big values clamp(22,2.6cqw,28); card padding clamp(12,1.6cqw,16); labels >= 12 px | resized | sizes follow the block width; ring SVG fills its box; lines end on the ring's outer border | live | P1 | planned |
| 56 | Layout | ResizeObserver fires after layout flips | callback | FlowLines observes panel, ring and all cards | unit | P1 | written |
| 57 | Layout | ring shrinks to 120 px, a card narrows | callback | anchors and paths recompute from the new boxes | unit | P1 | written |
| 58 | Layout | live widths 1920, 1440, 1280 (sidebar open), 1024, 768, 390, dark and light | open | no overflow or clipped text; lines meet cards and ring border; no blank void in rails; ring parts line readable | live | P1 | planned |

## Live verification
Run 16-19, 27, 30, 31, 37, 48 and 49 on the deployed dashboard after the owner approves a deploy. Row 20 (rail equals the Load tile) applies only to an older backend; with `home_today` (rows 32-37) the rail shows the whole-home figure, which is higher than the Load tile whenever grid-direct or EV circuits ran today.

## Mockup match: rail, header, band, tiles (rows 50+)
| # | Area | Given | When | Then | Level | Pri | Status |
|---|------|-------|------|------|-------|-----|--------|
| 50 | Rail | desktop, employee with dashboard/sites/alerts/devices | rendered | 76 px icon rail; each item is a link with aria-label and title = label; active one has class `active` | unit | P1 | written |
| 51 | Rail | employee without users/teams/ota/quotation access | rendered | those links are absent from the rail (same can() gating) | unit | P0 | written |
| 52 | Rail | admin with every feature | rendered | every destination is present in the rail; none removed | unit | P0 | written |
| 53 | Tiles | Overview tiles | rendered | each tile is a flat card (`data-kpi-tile`): label, value, optional sub-line; no icon badge, glow or gradient | unit | P1 | written |
| 54 | Tiles | Solar / Battery / Grid | rendered | colour dot only on those (and a status dot for Temp); Load and AC Output have none | unit | P1 | written |
| 55 | Tiles | RS-485 stale, not Deye Cloud | rendered | Solar/Load/AC tiles show a "Stale" pill and the "RS-485 frozen" sub-line; values still shown | unit | P1 | written |
| 56 | Tiles | tile with sub text, badge | rendered | sub-line and badge both render; no sub = no empty line | unit | P2 | written |
| 57 | Header | title/subtitle, long site name | open at 1280, 768, 390 | title 26 px Outfit, subtitle 13 px muted left; site pill (44 px) and avatar right; long site name ellipsizes, no horizontal scroll | live | P1 | planned |
| 58 | Band | health band | open at 1280, 1024, 768, 390 | 18 px radius, 16/24 px padding, 24 px gap to header, tab row and panel; items wrap cleanly onto rows | live | P1 | planned |
| 59 | Tiles | below the flow | open at 1920, 1440, 1280, 1024, 768, 390, dark and light | SUPERSEDED by 75: tiles auto-fit (min 150 px) with 16 px gaps; nothing overflows | live | P1 | superseded |
| 60 | Rail | all widths | open at 1920 to 1024 | rail stays 76 px with tooltips on hover; under the mobile breakpoint the existing mobile navigation shows; dark and light both readable | live | P1 | planned |
| 61 | Energy chips | today's Grid In/Out, Batt Chg/Dchg, Consumption present | rendered | five flat cards (`data-energy-chip`), 22 px values with Wh/kWh unit; missing values omitted | unit | P1 | superseded (removed from Overview, row 75) |
| 62 | Energy chips | same | rendered | dot only on Grid (blue) and Battery (green) chips; Consumption neutral; no gradient or shadow | unit | P1 | superseded (removed from Overview, row 75) |
| 63 | Insights | pv 8, load 10, buy 2.5, sell 0.4 | rendered | CO2 avoided 6.56 kg, Self-sufficiency 79%, Grid dependency 21% in neutral flat tiles; no threshold colours | unit | P1 | superseded (removed from Overview, row 75) |
| 64 | Both rows | not today / no data | rendered | nothing renders | unit | P2 | superseded (removed from Overview, row 75) |
| 65 | Both rows | open at 1920, 1280, 768, 390, dark and light | viewed | auto-fit grids, 16 px gaps, no horizontal overflow, text readable in both themes | live | P1 | superseded (removed from Overview, row 75) |

## Rails, centre height, EV slot (rows 70+)
| # | Area | Given | When | Then | Level | Pri | Status |
|---|------|-------|------|------|-------|-----|--------|
| 70 | Rails | left and right cards | rendered | natural height, align-self start; rows min 52 px, 12 px padding, 1px dividers, label left 14 px, value right 16 px; no space-between; mix bar directly under the ledger | unit | P1 | written |
| 71 | EV slot | no EV plug | rendered | load row has two columns (Backup, Grid direct); no EV card; FlowLines gets two anchors and draws two load lines (SW and SE of the ring) | unit | P0 | written |
| 72 | EV slot | EV plug present | rendered | three-column row and three lines as before | unit | P1 | written |
| 73 | Ring | any state | rendered | no caption under the ring (status line at the bottom gives it); HOME USES, value and parts line stay inside the ring | unit | P1 | written |
| 74 | Layout | centre panel | open at 1920, 1440, 1280 | row gap 28 px; panel height close to the taller rail; no large void in either rail card | live | P1 | planned |

## Overview tiles: first row only (rows 75+)
| # | Area | Given | When | Then | Level | Pri | Status |
|---|------|-------|------|------|-------|-----|--------|
| 75 | Overview | any site | open Overview | below the flow: only Solar PV, Battery, Load, Grid, Temp and AC Output tiles (AC Output only when output > 0) in one auto-fit grid (min 150 px): six in one row on desktop, wrapping on narrow screens | live | P1 | planned |
| 76 | Overview | site with grid/load phase, energy and insight data | open Overview | no Inv. Capacity or Forecast tile, no Grid phases or Load phases sections, no Today energy chips, no Insights row. Phases still show in Details and Load tabs; capacity in the health band; forecast in the Solar tab | live | P1 | planned |

## Rails match the approved mockup (rows 90+)
Supersedes the one-card-per-rail layout (rows 38-49 and 70-73 where they describe the "Today" / "Right now" cards).
| # | Area | Given | When | Then | Level | Pri | Status |
|---|------|-------|------|------|-------|-----|--------|
| 90 | Rails | any site | render the flow | left rail = Solar made today, Home used, From your own power; right rail = Live ledger, Inverter supply mix, Battery; every card is an equal-share tile (flex 1 1 0) | unit | P0 | written |
| 91 | Rails | wide container (>= 900 px) | render live | left rail, centre panel and right rail are the same height; no card has a large empty gap | live | P0 | planned |
| 92 | Rails | container < 900 px | resize | each rail becomes a row of cards at natural height under the centre panel | live | P1 | planned |
| 93 | Rails | no today figures | render | left cards show "—" and no invented number; Home used keeps the "Partly counted" note when partial | unit | P0 | written |
| 94 | Ring | any site | render | ring interior = HOME USES + whole-home value only; no "Backup X W / EV Y kW" lines (owner: not needed; supersedes row 50-51 parts line) | unit | P1 | written |
| 95 | Rail chart | 24h mode, telemetry from 06:00 IST | render | "Solar made today" chart starts at 6 AM IST and ends at the latest slot with a reading; hours still to come are not drawn; the axis reads "6 AM" on the left and the last slot's hour on the right; gaps inside the day are breaks, not zeros; hover tooltip names the slot ("2 PM · 3.4 kW") | live | P1 | planned |
