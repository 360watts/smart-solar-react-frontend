# History tab redesign: design

Date: 2026-11-19. Status: approved by owner 2026-11-19.
Mockups: https://claude.ai/artifact/SuAi4BH4Egw26t4jdaHEVz. The chosen layouts are **A3** (chart first) and **C** (calendar). A1 and A2 show the same sections in the other order, plus the 7-day bars. B and D were not chosen.

## Why

Staff open a site's History tab for four jobs:
- explaining a homeowner's complaint ("my bill is high", "solar isn't working")
- checking the system's health
- showing savings and how much of the home runs on its own power
- comparing one period with another

Today the tab is a raw power chart of inverter readings. Its "Load" is only the inverter's circuits, about 45% of coim_002's home. So it answers none of those jobs without staff doing sums in their head, and it quietly understates the home's use.

## Goals

- **Whole home everywhere.** The tab counts inverter circuits, plus grid-direct circuits from the meter, plus EV where measured. A site without those parts is labelled "inverter circuits only" and never shows a partial sum as the whole home.
- **Chart first** (owner's choice), with a one-line summary in the chart header: own power %, kWh bought, kWh exported.
- **"Anything wrong?"** sits under the chart and lists only the flags that fired. Checks that passed fold into one line.
- **"Where energy went"** sits under that:
  - a plain-English sentence
  - two split bars: where solar went, and where the home's power came from
  - four tiles: own power, bought from grid, exported, battery
  - each number shows its change against the previous period of the same length
- **Periods:** Today / 7 days / 30 days / Pick dates, with ‹ › to step one period back or forward.
  - Today: a 15-min stacked chart of home use by source (solar, battery, grid), with a "Solar made" line and battery % on top.
  - 7 days: daily stacked bars, with solar made as dots.
  - 30 days: the calendar (layout C). One tile per day, coloured by own power / solar made / grid bought, amber ring on flagged days. Clicking a tile opens that day's numbers in a side panel and an "Open this day" link.
  - Custom range: daily bars up to 60 days, weekly bars beyond.
- An **"Inverter detail"** toggle puts the raw inverter lines (Inv Out, inverter-side Load) back on the Today chart for engineers.
- A Table view stays available for each chart.

## Non-goals

- Rupee savings. That was layout D, not chosen; the tariff is not reliably set per site.
- The flow diagram (layout B).
- Forecast vs actual. The Solar card on the Forecast tab owns that.
- Customer-portal or mobile versions. This is the staff dashboard only.

## Anti-goals

These would make it a failure even if it technically works:
- A number labelled "home" that is really inverter-only, or a total built from a missing part.
- Grid-direct energy counted differently from the Load card's grid line. Both must use the same rule (F-051: absolute value per phase).
- A flag list so noisy that staff stop reading it.
- Waiting while switching periods. Toggling Today / 7 / 30 should feel instant, like the Load card after the Nov 18 fixes.

## Constraints and the data found (recon, Nov 19)

- **Daily data, any range.** The permanent table `site_daily_energy` has these columns:
  - `pv_gen_kwh`, `load_kwh` (inverter side)
  - `grid_import_kwh`, `grid_export_kwh` (inverter's own grid connection)
  - `batt_charge_kwh`, `batt_discharge_kwh`
  - `em_grid_kwh` (meter), `ev_kwh`
  - `house_kwh`: the whole house, NULL while a needed part is unknown (`api/services/circuit_map.house_kwh`)
  - `quality_flags`, `avg_soc` / `min_soc` / `max_soc`

  `GET /sites/<id>/energy-summary/?granularity=daily` returns the inverter columns and SOC, but **not** `em_grid_kwh`, `ev_kwh`, `house_kwh` or `quality_flags`. These must be added (backend change).
- **15-min data.** `circuit_map.household_series(site, hours)` already builds whole-house 15-min rows (`inverter_kw`, `grid_board_kw`, `ev_kw`, `load_kw`). Its only route, though, is the internal `recent-load`, which counts back from now. A staff route is needed: `GET /sites/<id>/household/?start=&end=` (or a `date=`), at the `viewer_ro` tier, in `staff_roles.ROUTES`. It must take a past window. The 5-min sources (`telemetry_5min`, `energymeter_5min`) are kept for 90 days, so days older than that show daily totals only, with a note in place of the chart.
- **Meter accuracy.** Meter 115's grid-direct readings are valid only from Oct 22, 2026, 06:00 UTC. Earlier coim_002 days must fall back to "inverter circuits only". The known ~0.75× under-read on meter 115 L3 is shown as a note, not corrected. This follows the Load card's `LOAD_LINE_NOTES` setting.
- **Must check before building:** whether the daily `em_grid_kwh` is net (the 0117 docstring says it comes from `active_power_total` net) or absolute per phase like the Load card's grid line. If it is net, it under-reads on stretches with negative readings. Fix it to the F-051 rule and backfill, or compute the daily figure from the same 15-min series. The two must agree to within rounding.
- **Frontend:**
  - Reuse `tabs/cardParts.tsx` (Seg, KpiTile, ChartLegend), the Load card's caching approach and the Solar card's day/daily handling.
  - House look: Rubik and Fira Code; nothing smaller than 12 px.
  - Colours: solar #F07522, battery teal, grid blue. Everything in light and dark mode.
- **Process:**
  - Write the test scenario doc `docs/test-scenarios/history-tab-redesign.md` before the tests (shared rule). It extends the Nov 19 `history-power-flow-card.md`.
  - No commit or deploy without the owner's OK.

## Energy split (how the bars are computed)

My call; the builder verifies it on real days. Per day, or per 15-min slot:
- **Home from battery** = battery discharge.
- **Home from grid** = inverter-side grid import + grid-board (meter) kWh.
- **Home from solar** = home total − from battery − from grid, floored at 0.
- **Solar into the battery** = battery charge. Grid charging of the battery is not separated; Deye reports no split.
- **Solar exported** = inverter grid export.
- **Own power %** = (from solar + from battery) / home total.

If solar made and its three destinations differ by more than 5% of solar made, the bars still show. A small "figures don't fully balance" note appears, with the gap in the tooltip. Never force the numbers to balance silently.

## Flags (where "Anything wrong?" comes from)

My calls on sources and thresholds:
1. **Open or recent incidents for the site** in the period, from the existing `GET /sites/<id>/events/`. Each shows its title and time and links to the incident.
2. **Data gaps:** missing 15-min slots, or `quality_flags` on the day. The known nightly 03:29–03:36 coim_002 gap is named as known.
3. **Battery:** a day without a cycle, meaning SOC range under 20 points, on a site that has a battery.

**Owner decision:** no "solar under forecast" flag in the first version. The forecast's daily range covered only about 45% of days in the Nov 19 evaluation, so the flag would be noisy. Add it once the bias fix lands and the range is re-checked.

Flags that didn't fire become one green line: "No problems found in N checks".

## Decisions from the builder review (Nov 19)

**Owner decisions:**
- **Mixed periods.**
  - Period totals, own-power % and the change vs the previous period count only the days that have whole-home data.
  - A note says "whole home on N of M days".
  - Inverter-only days stay in the chart and calendar, greyed, with their inverter-side figures in the tooltip.
  - When no day in the period has whole-home data, the whole period is labelled "inverter circuits only".
- **Solar flag:** deferred (see Flags).

**My calls (the owner can overturn any):**
- **The 15-min route.** `GET /sites/<id>/household/?date=YYYY-MM-DD` (an IST day) returns per-slot fields in one aggregation, so the frontend joins nothing:
  - `inverter_kw`, `grid_board_kw`, `ev_kw`, `load_kw`
  - `pv_kw`, `batt_charge_kw`, `batt_discharge_kw`
  - `inv_grid_import_kw`, `inv_grid_export_kw`
  - `soc`

  It extends `household_series` with the extra telemetry columns and takes a past window, with no 1,800-hour cap. Days over 90 days old return an empty list plus `reason: "older_than_90_days"`.
- **Split per slot.** On the Today chart the split is computed per 15-min slot. Day totals come from summing the slots when the day has full 15-min data. Otherwise they come from the `site_daily_energy` columns.
- **EV** is a separate part (`ev` in the site's parts), so it counts as "from grid". On a site where EV sits on the inverter circuits it is already inside the inverter load, and the split handles it.
- **Days are IST days,** like `site_daily_energy.day`. coim_002's whole-home data starts Oct 23. Oct 22 is a partial meter day and counts as inverter-only.
- **Today compares** with the same elapsed hours of yesterday. Finished days compare with the whole previous day.
- **7 and 30 days** are rolling windows ending today. ‹ › steps by the period's length.
- **What happens to today's tab:**
  - The new period control replaces the History date picker.
  - The PV / Load / Grid / Inv Out / SOC toggles become "Inverter detail".
  - The Table view stays.
  - The Nov 19 Power Flow card is replaced; its scenarios move into the new doc.
  - Viewers see the tab as they do now. `events/` is already `viewer_ro`-scoped to their sites.
- **`em_grid_kwh`.** If the check finds it is net, build on the 15-min-derived daily value and show nothing extra to users. The backfill of `site_daily_energy` is a prod data change and waits for the owner's OK.
- **Calendar rings** mark any day that a fired flag touches. A multi-day incident rings each day it was open. The calendar and 7-day bars share one daily fetch and one `events/?days=` fetch per period.

## Left to the builder

- Component split and file layout (expect `HistoryTab.tsx` plus a pure `historyModel.ts` with the split, flags and comparison maths, tested).
- Exact endpoint shapes, caching durations and loading states.
- Calendar tile sizing on phones (C must still work at 390 px wide).
- Whether the 7-day bars and the calendar share one daily fetch (they should).
- Copy polish, within the plain-language rules of `UI_GUIDE.md`.

## Live checks after deploy

- **L1:** coim_002 Today. Home total matches the Load card's All view for the same day, within 2%.
- **L2:** 7 days and 30 days. Daily totals match `site_daily_energy.house_kwh`. Days before Oct 22 say "inverter circuits only".
- **L3:** stepping ‹ › and switching periods feels instant after the first load.
- **L4:** a meter-less site shows the "inverter circuits only" label everywhere and no grid-board numbers.
- **L5:** light and dark mode, and phone width.
