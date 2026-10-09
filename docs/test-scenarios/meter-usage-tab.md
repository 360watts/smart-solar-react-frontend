# Usage tab for meter-only sites: test scenarios

Dashboard half of `smart-solar-django-backend/docs/superpowers/specs/2026-10-08-meter-usage-tab-design.md`. The tab reads `GET /sites/<id>/meter-usage/` and the latest meter reading the site panel already holds. Status: planned | written | passing | live-verified.

## Tab visibility (`tabsFor`)

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| TV-1 | `meter_only` true, no `visibleTabs` | Tabs are chosen | `['usage', 'phase-load']` in that order | unit | P0 | passing |
| TV-2 | `meter_only` true, `visibleTabs` includes both | Tabs are chosen | Both shown | unit | P0 | passing |
| TV-3 | `meter_only` true, `visibleTabs` lacks `usage` | Tabs are chosen | Only `phase-load` | unit | P1 | passing |
| TV-4 | `meter_only` true, `visibleTabs` has neither | Tabs are chosen | No tabs (nothing invented) | unit | P2 | passing |
| TV-5 | `meter_only` false (inverter site) | Tabs are chosen | Today's behaviour, never `usage` | unit | P0 | passing |
| TV-6 | `meter_only` false, `visibleTabs` includes `usage` | Tabs are chosen | `usage` is still dropped | unit | P0 | passing |
| TV-7 | `meter_only` unknown (`undefined`/`null`, overview not loaded or old backend) | Tabs are chosen | Today's behaviour, no `usage` | unit | P0 | passing |
| TV-8 | Meter-only site | Tab bar renders | The Phase load tab reads "Load by phase"; on inverter sites it still reads "Load" | unit | P1 | passing |
| TV-9 | Meter-only site, person has not clicked a tab | Overview reports `meter_only` | Panel switches to Usage once | manual | P1 | planned |
| TV-10 | Person already clicked a tab, then `meter_only` arrives | Overview reports `meter_only` | Their tab is kept | manual | P1 | planned |
| TV-11 | Viewer on a meter-only site | Opens the site | Viewer tab list includes `usage` (`ViewerSite`) | unit | P0 | passing |
| TV-13 | Active tab is not in the tab bar (meter_only flips, or `usage` hidden by `visibleTabs`) | Panel renders | Falls back to the bar's first tab (`resolveTab`); the auto-switch to Usage respects `visibleTabs` | unit | P1 | passing |
| TV-14 | Meter-only viewer site, overview not answered yet | First load | Skeleton, not the "No data found" card; inverter sites with no data still get that card once the overview answers | manual | P1 | planned |
| TV-15 | Viewer switches from one site to another | Route changes | Panel remounts (`key={siteId}`), nothing from the old site lingers | manual | P2 | planned |
| TV-12 | Meter-only site with no inverter telemetry, forecast or weather | Panel renders | Tab bar and Usage still show (the "No data found" card is skipped for meter-only sites); inverter sites keep that card | manual | P0 | planned |

## Usage figures

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| UF-1 | Fixture with `energy_kwh` 18.4 | Tab renders | Hero reads 18.4 kWh | unit | P0 | passing |
| UF-2 | `yesterday_at_now_kwh` 16.4 | Tab renders | Chip "12% more than yesterday at this time" in amber | unit | P0 | passing |
| UF-3 | Today lower than yesterday at this time | Tab renders | Chip says "less than yesterday at this time" in calm green | unit | P1 | passing |
| UF-4 | `yesterday_at_now_kwh` is null or 0 | Tab renders | No chip, no divide-by-zero | unit | P0 | passing |
| UF-5 | Four side cards | Tab renders | Using right now, Highest demand today (with local time and yesterday's peak), Average load today, Overnight base load | unit | P0 | passing |
| UF-6 | `base_load_kw` null | Tab renders | Card shows an em dash and "Needs a few nights of readings" | unit | P1 | passing |
| UF-7 | Curve arrays with null gaps | Tab renders | The line breaks at the gap, no interpolation | unit | P1 | passing |
| UF-8 | Curve peak 5.82 kW | Tab renders | Y axis tops out at the next round number above the data (`niceMax`) | unit | P2 | passing |
| UF-9 | 14 heatmap rows of 24 values, some null | Tab renders | 14 rows x 24 cells, each with a title "Day, hour, kW"; null cells are neutral | unit | P0 | passing |
| UF-10 | 14 days of bars | Tab renders | Today's bar highlighted, daily average and month-to-date shown | unit | P1 | passing |
| UF-12 | Meter reading under 15 minutes old | Tab renders | "Using right now" and the chart's Now label show the meter's own `active_power_total` in kW | unit | P0 | passing |
| UF-13 | Meter reading older than 15 minutes, or no total | Tab renders | Card shows an em dash and "No reading in the last 15 minutes"; Now label reads "Now · —"; no stale figure shown as live | unit | P0 | passing |
| UF-14 | Last populated curve slot is not the last slot | Tab renders | Yesterday-at-this-time uses that slot, not the array length | unit | P1 | passing |
| UF-15 | 14-day footer | Tab renders | Reads "Daily average this month" and "Total this month so far" | unit | P2 | passing |
| UF-11 | Timezone `Asia/Kolkata`, browser in another zone | Times shown | Peak time and meter time use the site timezone | unit | P1 | passing |

## Health bars

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| HB-1 | Voltages 229, 231, 233 | Health renders | 231 V, "Steady", band 207 to 253 V | unit | P0 | passing |
| HB-2 | Voltage 260 V | Health renders | Amber "Worth a look", never red | unit | P1 | passing |
| HB-3 | Currents 10.1, 12.4, 14.8 | Health renders | 19 "% off average", "A little uneven", "Phase 3 is the heaviest"; when balanced the note reads "No phase more than 10% off the average" | unit | P0 | passing |
| HB-4 | Currents within 10% | Health renders | "Balanced" in green | unit | P1 | passing |
| HB-5 | Mean current 0 or fewer than two phases | Health renders | Shows an em dash, no NaN or Infinity | unit | P0 | passing |
| HB-6 | Power factor 0.93 | Health renders | "Good"; below 0.90 shows amber "Worth a look" | unit | P1 | passing |
| HB-7 | Frequency 49.98 Hz | Health renders | "Steady"; outside 49.5 to 50.5 shows amber | unit | P1 | passing |
| HB-8 | No latest meter reading held by the panel | Health and raw table render | Both show "Waiting for the first meter reading", rest of the tab works | unit | P1 | passing |
| HB-9 | Latest reading | Health renders | "Current by phase" line with the three phase colours | unit | P2 | passing |

## Raw readings

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| RR-1 | Latest reading with all fields | Table renders | Seven rows: Voltage, Current, Frequency, Active power, Reactive power, Apparent power, Power factor | unit | P0 | passing |
| RR-2 | Phase values | Table renders | Phase 1 to 3 columns show each value | unit | P0 | passing |
| RR-3 | Totals | Table renders | The three powers show the meter's own totals (phase sum labelled "sum" only when the meter sent none); Current total is an em dash; voltage and frequency are averages labelled "avg"; power factor is the meter's own total | unit | P0 | passing |
| RR-4 | A phase value is null | Table renders | That cell is an em dash and the total is built from the phases present | unit | P1 | passing |
| RR-5 | Meter timestamp and serial | Table renders | Shows the meter's own time; the serial sits inside the collapsed Recent readings area | unit | P1 | passing |
| RR-6 | History call returns 12 rows | Recent readings opened | Last 10, newest first; the history call is not made until the details are opened | unit | P1 | passing |
| RR-7 | History call returns nothing | Recent readings opened | "No readings in the last hour" | unit | P2 | planned |
| RR-9 | Raw table and heat strip | Screen reader | Row labels are `th scope=row`, column heads `scope=col`; heat strip has an `aria-label` naming the busiest hour; each day bar has a label like "Fri 25: 19.8 kWh"; the summary keeps its disclosure triangle | unit | P1 | passing |
| RR-8 | History rows carry no frequency or power factor (the 5-minute endpoint does not return them) | Recent readings opened | Those columns are left out, not shown as zero | unit | P2 | planned |

## Empty, loading, error

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| ST-1 | Request in flight | Tab renders | Skeleton blocks, no figures | unit | P1 | passing |
| ST-2 | Endpoint returns no readings today, meter silent for 15 minutes or more | Tab renders | "No readings yet. The meter hasn't reported today."; health bars and Raw readings still show from the latest reading | unit | P0 | passing |
| ST-9 | Aggregate empty after midnight but meter live (under 15 minutes) | Tab renders | "No usage figures yet today."; health bars and Raw readings still show | unit | P0 | passing |
| ST-3 | Endpoint fails | Tab renders | "Couldn't load the usage figures. Try again." and a button; no raw error text, no claim about the meter; health bars and Raw readings still show | unit | P0 | passing |
| ST-4 | Error shown | Person presses Try again | Request repeats and the page renders on success | unit | P0 | passing |
| ST-5 | Tab visible | 60 seconds pass | Data reloads silently (no skeleton flash); not at 30 seconds | unit | P1 | passing |
| ST-6 | Browser tab hidden | 60 seconds pass | No request; unmount stops the timer; Try again refetches (one fake-timer test) | unit | P2 | passing |
| ST-7 | Site changes while a request is in flight | Old response arrives | Ignored | unit | P2 | planned |
| ST-8 | `age_seconds` 120 | Header renders | "Live" and "last reading 2 minutes ago"; older than 15 minutes switches to amber "Not reporting" wording | unit | P1 | passing |

## Request budget (telemetry reads are 300 per hour per user)

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| RB-1 | Meter-only site | Panel is open | No `getSiteTelemetry`, no periodic `fetchAll`, no `fetchLatestTelemetry` after the overview says `meter_only` (the very first fetch may already be in flight) | manual | P0 | planned |
| RB-2 | Inverter site | Panel is open | Fetch behaviour unchanged (`meterOnly` null to false does not refetch) | manual | P0 | planned |
| RB-3 | Recent readings closed | Tab open for minutes | No energy-meter history calls; open = one call then one per minute, hidden tab skipped | unit | P1 | passing |

## Phone and theme

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| PH-1 | 375 px wide | Tab renders | Sections stack, no page-level sideways scroll | manual | P1 | planned |
| PH-2 | 375 px wide | Heat strip and tables | They scroll sideways inside their own box | manual | P1 | planned |
| PH-3 | Touch targets | Tab renders | Buttons and the summary row are at least 44 px high | manual | P2 | planned |
| PH-4 | Dark mode | Tab renders | Colours come from `useTokens`; heat strip and bars stay legible | manual | P1 | planned |

## Live verification (after the backend ships)

1. Pick a meter-only site (energy meter, no gateway, no inverter). Open it: the panel opens on Usage and shows only Usage and Load by phase. (planned)
2. Compare the hero kWh with the sum of the 5-minute rows from the history endpoint for the same day. (planned)
3. Confirm an inverter site (for example coim_002) has no Usage tab and is otherwise unchanged. (planned)
4. Sign in as a viewer assigned to the meter-only site: Usage is there; an unassigned site is refused. (planned)
5. Open on a phone: stacking, sideways scrolling and the 44 px targets. (planned)
6. Check dark mode and a meter that has stopped reporting (amber wording). (planned)
