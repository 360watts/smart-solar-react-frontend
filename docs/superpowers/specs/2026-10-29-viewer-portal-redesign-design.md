# Viewer portal redesign (testers and firmware QA)

Date: 2026-10-29. Status: approved by the owner 2026-10-29 ("Ok Implement"), including the chart redesign and the layout review folded in below (§5.0, §5.3). Mockups: https://claude.ai/artifact/5uuVAcejGACiDeNyY1pn4t (canvas "Viewer portal redesign", four artboards).

Repos: `smart-solar-react-frontend` (pages) and `smart-solar-django-backend` (endpoints, permissions). This document lives in the frontend repo because most of the work is UI.

## 1. Intent

Viewers are **testers and firmware QA** (owner, 2026-10-29). They are given single devices (often bench units with no site) and/or whole sites. When they log in, the first thing they want is **what they have access to**: which devices and sites, whether each is sending data, and what they may do. Then they drill into one device and need **detail down to every reading**, the **exact packet the device sent**, and **every device operation**, so they can check firmware behaviour (publish rate, values, fault words, command handling).

Success: a tester can answer "is my bench gateway on fw 2.0.9 publishing every 2 s, are the values right, and did my reboot get confirmed?" from the portal, without asking an engineer to query the database.

## 2. Goals, non-goals, anti-goals

Goals
- Home answers "what do I have and is it alive" in one screen.
- The device page shows data at five levels of detail (every reading, per minute, 5 min, hourly, daily), the reporting rhythm (average interval, longest gap), every value, a reading-by-reading table and the raw packet.
- Testers run every single-device operation on every device they are given, including meter calibration, meter publish interval and gateway APN, and see whether the device confirmed it.
- Works the same for site-less (bench) devices and site devices.

Non-goals
- No CSV or file export ("on screen is enough", owner).
- No fleet-wide actions for viewers: multi-device OTA, site editing, user management stay with employees/admins.
- No new data retention: everything here fits inside what is already kept (see §4.1).
- No customer-facing changes; the employee/admin dashboard is unchanged apart from shared components.

Anti-goals (would be a failure even if it works)
- A page so dense testers can't find the value they need (the reason the device page became tabs).
- Showing numbers that look exact but are sampled or averaged without saying so.
- An operation that silently does nothing (offline device, unsupported device type) with no explanation.
- A tester's action that leaves no trace (who ran what, when, on which device).

## 3. Decisions already made by the owner

| Decision | Choice |
|---|---|
| Who | Testers / firmware QA |
| Pages | Home (access overview), Site view, Device dashboard, Profile / my access |
| Look | House style: Lagoon Mint (#0F9F8F), Rubik + Fira Code, Playful; existing tokens in `src/index.css` |
| Detail levels | Seconds/minutes/hours/days → every reading, per minute, 5 min, hourly, daily |
| Operations | All single-device ops, including EM26 calibration, meter publish interval, gateway APN |
| Where ops apply | Every device the tester is given (bench and site devices) |
| Data out | Raw packet view, on screen only |
| Device page layout | Tabs: Overview, All values, Every reading, Operations |
| Device-only viewers | Device dashboard only, no site reads through a device (phase 1 rule, unchanged) |

## 4. Constraints from the current system (checked in code, 2026-10-29)

### 4.1 Data that exists
- `TelemetryRaw` (gateway): one row per reading, ~2 s apart (~1,760 rows/hour), `normalised` (~95 keys), `payload` (the decoded reading as the device sent it), `timestamp` (device time), `received_at`. **10-day retention** (migration 0116).
- `EnergyMeterReading` (meter): 24 numeric fields per reading, 10-day retention, plus `raw_payload` = `{'raw': '<caret-delimited MQTT string>', ...}` for `source=mqtt`, so **meters do keep the original message per reading**.
- `TelemetryRawPayload`: exact MQTT message bytes per gateway message (may be base64+zlib, may batch several readings), keyed by serial + `received_at`. Pruned by `prune_raw_payloads()` (`maintenance_tasks.py`): after 14 days (`RAW_PAYLOAD_RETENTION_DAYS`) once the site's day is exported to S3, and anything older than 2 × 14 = 28 days regardless. Site-less devices are never exported, so theirs go at 28 days. (The model docstring "No retention yet" is stale; fix it while there.)
- `telemetry_5min` CAGG groups by `site_id` only. All site-less devices share site_id `''`, so **this CAGG cannot be used for a single device**. The device page must aggregate from raw rows (it already does).
- `DeviceEvent`: data/event + data/diag messages, 30 days.
- `SiteAuditLog` via `audit_device_command()` (`api/services/device_audit.py`): called today for reboot, hard reset, rollback, diagnostics, APN, meter calibration. **It returns early when the device has no site**, so bench devices have no operation history today.
- Confirmation signals that exist: reboot/hard reset (`pending_reboot` / `pending_hard_reset` cleared on reconnect by both the HTTP heartbeat and the MQTT `handle_status` offline→online path), EM26 `meter_calibration_confirmed_at` / `meter_interval_confirmed_at`, diagnostics results in `DeviceEvent`, log files in `DeviceLogFile`, OTA status in device update logs.

Because every range offered is at most 7 days and raw data is kept 10 days, **all detail levels can be computed from raw rows**. No longer retention, no per-device CAGG.

### 4.2 Permissions today (`api/staff_roles.py`)
- Viewer single-device ops (V_RW, DEVICE_SCOPED): update, reboot, hard reset, rollback, mute/unmute, telemetry debug, log toggles/files, auto reboot, diagnostics, single OTA/rollback.
- Employee-only: `calibrate_meter` (comment: "wrong references corrupt billing-grade readings"), `device_apn`. Meter publish interval is a field on `update_device`, blocked for viewers by `VIEWER_WRITABLE_DEVICE_FIELDS = {'auto_reboot_enabled'}`.
- All viewer ops sit behind the per-viewer "device operations" switch (`DEVICE_OPS`).

### 4.3 Existing UI to reuse
- `DeviceDashboard.tsx` (redesigned 2026-10-28): reporting ribbon, sections, L1/L2/L3 rows, search, inline charts. Becomes the Overview + All values tabs.
- `DevicePage.tsx` (473 lines): the existing device controls. The Operations tab reuses its handlers.
- `ViewerSite.tsx` wraps the shared `SiteDataPanel` (tabs overview, history, forecast, weather, phase-load, plugs, usage, devices).
- `MySites.tsx` is the current viewer home (47 lines). It gets replaced.
- `Profile.tsx` is the shared profile page (password and so on). It gets a section added rather than a new page.

## 5. The pages, component by component

Each component carries a verdict: **Keep** (as mocked), **Change** (keep the intent, alter the form), **Cut** (in the mockup, not built), or **Add** (not in the mockup). The reason is the tester use case.

### 5.0 Shared layout rules (from the layout review, 2026-10-29)
- **No Fira Code ligatures anywhere in viewer pages** (`font-variant-ligatures: none`, which must beat any `font:` shorthand). Fira Code otherwise draws `0x0004` as `0×0004`, which misreports fault codes.
- Numbers in Fira Code, **units in Rubik**, smaller and muted ("2.84 kW", not a monospace space plus unit).
- One content max width (1180 px) on every viewer page.
- Sidebar shows both groups on every page: "Your devices" (silent first, status dot) and "Your sites".
- Grids of cards fill the row (`auto-fit`), so two cards never leave an empty third column.
- Red is reserved for hard reset. Roll back, APN and calibration use the normal button and a confirm dialog.

### 5.1 Home: "Your access" (replaces `/my-sites`)

| Component | Use case | Verdict |
|---|---|---|
| Headline "You can test N devices and M sites" | Answers the first question in one line | Keep. Counts come from the user's assignment. Wording adapts: devices only, sites only, both, none. |
| Sending / silent chips | "Is anything I'm testing dead?" | **Cut** (layout review): they repeat the table's status column and floated away from the headline. |
| Devices table: type, serial, firmware, 24 h reporting strip (48 × 30 min), status, last data | The core of home. Firmware matters to QA. The strip shows drops at a glance | Keep. **Sort silent devices first**, then by serial, because problems are what testers act on. The "Where" column is cut; "bench, no site" or the site id sits beside the type, and the strip takes the width. |
| Sidebar quick list of devices and sites | Jump between bench units without going home | Keep for ≤ 8 devices (§5.0). Beyond that, show "All devices" linking home (no search; testers have few devices). |
| Site cards: solar now, home use | Customer-style numbers; testers don't test the site's energy, they test devices | **Change**: card shows site id, place, "X of Y devices sending", and the latest open fault. Power numbers are cut. |
| "What you can do" panel | Duplicates the Profile page | **Change**: one line, "You can run every operation on these devices. See your access", linking to Profile. |
| Empty state (nothing assigned) | New tester before an admin assigns | Add: "Nothing has been given to you yet. An admin assigns devices and sites." |

Data: new `GET /api/me/access-summary/` (one call for the whole page; §6.4).

### 5.2 Site view (`/my-sites/:siteId`)

Today's page is `SiteDataPanel` with seven tabs. Rebuilding it to match the mockup would duplicate a working panel. Instead:

| Component | Use case | Verdict |
|---|---|---|
| Header: site id, place, short sentence of what the tester may do | Orientation | Keep. |
| Right now (solar, home use, battery, grid) | Cross-check the gateway's values against the site | Keep, by using the panel's existing Overview tab (its KPI cards already show these). No separate tiles above the tabs. |
| Today hour by hour | Checks that energy counters turn into daily energy correctly (pipeline QA) | Keep via the existing History tab. No new chart. |
| Devices on this site, with reporting strips | The main way into device pages from a site | **Add above the tabs**, a strip per device (same component as Home), linking to `/devices/:id/dashboard`. |
| Faults and events, 7 days | "What happened while I was away?" | **Add as a tab**: incidents (`site_incidents`) merged with device operations from the audit log, newest first. |
| Forecast and Weather tabs | Forecast-model features, not device testing | **Cut for viewers** (drop from `VIEWER_TABS`). |
| Phase load, Plugs, Usage tabs | Per-phase and plug data are device outputs QA checks | Keep. |

### 5.3 Device dashboard (`/devices/:deviceId/dashboard`): four tabs

Header (all tabs): device type + serial, sending/silent, "No site, bench device" or the site id (as a link only when the tester has that site), firmware, last reading time to the second. The active tab is kept in the URL (`?tab=readings`) so a tester can share a link with an engineer.

**Tab: Overview**
| Component | Use case | Verdict |
|---|---|---|
| Four headline tiles | Instant "values look sane?" | Keep. Gateway: solar, home use, battery (charge + power), grid. Meter: total active power, average voltage, total current, average power factor. |
| Range: 1 h, 6 h, 24 h, 48 h, 7 d | Look at the right window | Keep (adds 1 h; the current page has 6 h–7 d). Window ends at the last reading (offline devices still show data), as today. |
| Detail: every reading / per minute / 5 min / hourly / daily | The owner's "seconds / minutes / hours / days" | **Change**: offer only the levels that make sense for the range, so a chart never tries to draw 288k points or one point: 1 h → every reading, per minute, 5 min; 6 h → per minute, 5 min; 24 h and 48 h → 5 min, hourly; 7 d → hourly, daily. Default = the finest allowed. A line under the buttons says what a point means ("Averages per minute, about 30 readings each; codes show the last value"). |
| Range, detail and reading controls | Set what the chart shows | **Change** (layout review): all live in the chart card's header, range and detail on one row, the reading buttons under them. No separate controls card: the tiles show "right now" and aren't affected by the range. |
| Reporting strip + "a reading every X s on average, longest gap Y at Z" | Firmware publish-rate check. This is the most QA-specific element | Keep. **Average interval = median gap** between consecutive readings in the range (robust to one outage). Longest gap and when it started. Cells: 60 per range. **A cell has three states** (my call, same on Home's 48 cells): full (≥ 80% of the readings expected at the median interval), partial (some), empty (none), so a halved publish rate shows. **The states differ by shape, not only colour**: full = full-height teal, partial = half-height teal, empty = amber. **Change**: the strip is a lane directly under the chart on the same time axis, so a gap in the strip lines up with the break in the line. |
| Codes lane | "When did the fault word change?" | **Add**: a lane under the reporting lane with a diamond where a fault or warning word changed, labelled with the code and time. |
| Chart | Shape over time | Keep, with a picker of the 8 most useful readings for the device type (gateway: solar by string, home use by phase, grid, battery power, battery charge, grid voltage by phase, frequency, temperatures). One value axis only, rounded ticks, zero included for power, energy and charge; a stronger line at 0 where values go negative (grid, battery). Any other value is charted from All values (inline, existing behaviour), not here. Gaps longer than 3× the median show as breaks in the line and shaded bands labelled with their length, never as interpolated lines. |
| Spread band | Averages hide spikes (anti-goal: hidden averaging) | **Add**: at per-minute detail or coarser, each line is the bucket average with a shaded band from the bucket's lowest to highest reading. The server returns min and max per bucket for the charted keys. |
| Readout | Read exact values without hunting for a line | **Add**: a fixed readout beside the chart title showing time plus every line's value (and min–max when averaged). Pointing at the chart moves a crosshair and updates it; with no pointer it shows the latest reading. |
| Colours | Identity of lines | Phases use the electrical convention R red `#C2412D`, Y ochre `#B9870F`, B blue `#3570C8`; two-line charts use blue and ochre; single lines use teal. Validated for colour-blind separation (dataviz validator, light surface). Text never takes the line colour. |
| Sampling notice | Anti-goal: hidden sampling | Add: if the server ever falls back to sampling, say "Based on 1 in N readings". Normally no sampling (§6.3). |

**Tab: All values (count)**
| Component | Use case | Verdict |
|---|---|---|
| Every value of the latest reading in sections, L1/L2/L3 rows, search | "What is register X reading now?" | Keep. This is the existing redesigned dashboard body, unchanged. |
| Row expands to a chart over the current range/detail | Chart anything | Keep (existing). |

**Tab: Every reading**
| Component | Use case | Verdict |
|---|---|---|
| Table, newest first, time to the second | Check exact values and order, find the moment of a fault | Keep. It **pages from the server** (100 rows, "Older" / "Newer") with "Jump to time". It is not tied to the range buttons, because a 7-day range at every reading is 288k rows. Every reading is available for the last 10 days. |
| Columns | 95 values don't fit | **Change**: 7 default columns per device type plus a "Columns" picker from every key. The choice is remembered per device type in localStorage. |
| Fault rows tinted | Spot faults | Keep: any non-zero fault or warning word. |
| Layout with the packet open | Compare a row with what was sent | **Change** (layout review): split view, table left (about 60%), packet panel right and sticky, so the selected row and its packet stay side by side. The whole row is clickable; the per-row control is a small `{ }` icon button with an accessible name, not a bordered "Packet" button. Narrow screens stack the panel under the table. |
| Gap rows | Firmware QA needs to see missing readings in sequence | **Add**: a row "No readings for 4 min 12 s" where the gap is over 3× the median. |
| Detail other than every reading | Mockup let the table show averages | **Cut**: averages already live on the Overview chart. This tab is only raw readings. |
| Packet button → panel | See what the device actually sent | Keep. Gateway: (1) **the reading as sent** (`TelemetryRaw.payload`, pretty-printed JSON), (2) **"Show the whole message"**: the matching `TelemetryRawPayload` (same serial, `received_at` within 2 s of the row's `received_at`), decoded from base64+zlib when needed, with size, topic time and a hex view when it isn't text. Meter: the reading's `raw_payload['raw']` string (the exact caret-delimited message) above the parsed values. Copy button. The gateway whole-message match is best effort, so it is labelled **"Closest message received"** with its receive time; the per-reading `payload` is the exact one (my call: no message-id migration). If the message has been pruned (older than 14 days), say so. |

**Tab: Operations (count)**
| Component | Use case | Verdict |
|---|---|---|
| Ops grouped (Everyday, Checks, Firmware and network; hard reset on its own) | Find the action | Keep. Group cards are equal height in a row. Hard reset is a full-width red strip under the groups, the only red action (§5.0). **The list depends on the device type**: gateway = reboot, mute, auto reboot, fetch logs, detailed telemetry, diagnostics, update firmware, roll back, APN, hard reset. Meter = reboot, reset, calibration, publish interval, update firmware. Ops a device doesn't support aren't shown. |
| Per op: what it does, last run (who, when), confirmation state | "Did my command land?" | Keep. Confirmation per op from the existing signals (§4.1): **Confirmed** (with time), **Waiting for the device**, **Sent** (the op has no confirmation signal), **Not confirmed after N min** (warning). The mapping table is in §6.5. |
| Offline device | Anti-goal: silent no-op | Add: ops that need the device online (calibration, APN, diagnostics, logs) are disabled with "Device is offline. This needs it online." Retained-message ops (publish interval, auto reboot) stay enabled with "Will apply when it reconnects". |
| Confirmations for risky ops | Avoid bricking or corrupting data | Keep: hard reset asks the tester to type the serial. Roll back, APN and calibration use a confirm dialog. Calibration states "A known load must be on". |
| Recent operations on this device (last 20) | Audit trail on the device itself | Add: a list under the groups (from the audit log). |
| Note "Updating many devices at once stays with admins" | Explains the gap | Keep. |

### 5.4 Profile and my access (`/profile`, viewer section)

| Component | Use case | Verdict |
|---|---|---|
| Name, email, role | Identity | Keep, as in the existing Profile. |
| What you've been given | Check access without asking | Keep, as two compact cards side by side, Devices and Sites (id plus type or place). "Since" is dropped (§6.6). |
| What you can do | Know limits before trying | **Change** (layout review): two lists instead of a matrix, "On everything given to you" and "Ask an admin for" (the matrix's "anywhere else" column was all "No" and the device and site columns differed on one row). Static copy in one file beside `roles.ts`, marked KEEP IN SYNC with `staff_roles.py`, like `FEATURES`. When the per-viewer ops switch is off, the operation items move to "Ask an admin for". |
| "Email an admin" button | Request more access | **Cut**: there is no admin contact in the data. Plain line: "Need more? Ask your admin." |
| Operations you ran, last 30 days | Personal trail | Keep: audit log filtered by actor. |
| Sign out | Already in the layout | Cut from the page (it lives in the layout). |

## 6. Backend changes

### 6.1 Permissions
- Move `calibrate_meter` and `device_apn` to V_RW and add them to `DEVICE_SCOPED`. Add `meter_publish_interval_ms` to `VIEWER_WRITABLE_DEVICE_FIELDS` (energy meters only, which the serializer already enforces; null = back to the meter default, allowed). They stay behind the per-viewer device-operations switch (`DEVICE_OPS` already lists `calibrate_meter`; `device_apn` joins via V_RW).
- Update the two route comments to say why (testers calibrate on any device they are given; owner decision 2026-10-29).
- Accepted risk (owner chose "every device they're given"): a wrong calibration on a customer's site meter corrupts billing-grade readings. Mitigations: the confirm dialog, the audit trail, and the per-viewer switch.

### 6.2 Operation history for site-less devices
`audit_device_command()` must record when the device has no site: write `SiteAuditLog` with `site_id=''` (same convention as site-less telemetry) and the device id/serial in the payload. Also audit the ops that aren't audited today: mute/unmute, telemetry debug, log toggles, auto reboot, single OTA, meter publish interval. Fix it once in the helper; every caller goes through it. Readers (`/devices/{id}/operations/`, `/me/operations/`) filter by `payload.device_id` and by actor, never by `site_id`. The site Events tab filters by its own site id, so `''` rows never leak into a site. Ops that ran before this change have no record: the tab says **"No record yet"**, not "Never run" (my call).

### 6.3 Device dashboard endpoint (extend `GET /devices/{id}/dashboard/`)
- `?hours=1|6|24|48|168&detail=every|1m|5m|1h|1d`. Reject combinations outside the §5.3 table with 400.
- Response adds `detail`, `median_gap_s`, `longest_gap_s`, `longest_gap_at`, `coverage` (60 cells, each `full` / `partial` / `empty`), `code_changes` (time + fault/warning word where it changed in the range) and `sampled_every` (exists). Bucketed series carry `min` and `max` per key per bucket for the spread band.
- `every`: no bucketing (1 h ≈ 1,800 rows, under `_SAMPLE_ROWS`).
- Bucketed levels are **exact, not sampled** (my call): the chart asks only for the keys it draws (`&keys=`, ≤ 8), and the server averages them in SQL with `time_bucket` over `normalised->>key` (meter: the columns). Codes and counters (non-unit keys, as `_AVG_SUFFIXES` decides today) take the bucket's last value. The full latest row still comes from one query. Sampling stays only as a fallback if a query exceeds a row budget, and the response says so.
- Gap stats are computed from **all** timestamps in the window (a timestamp-only query, cheap even at 7 d), never from the sample.
- `1d` buckets use IST day boundaries.

### 6.4 New endpoints
| Endpoint | Purpose | Scope |
|---|---|---|
| `GET /me/access-summary/` | Home: each reachable device (type, serial, fw, site, online, last reading, 48-cell 24 h coverage) and each site (id, place, devices sending/total, latest open incident) | Viewer's own assignment; OPEN-tier style self route |
| `GET /devices/{id}/readings/?before=&after=&limit=100&keys=` | Every reading table (cursor on timestamp, returns row id) | DEVICE_SCOPED, V_RO |
| `GET /devices/{id}/readings/{reading_id}/packet/` | Decoded reading + matching raw message | DEVICE_SCOPED, V_RO |
| `GET /devices/{id}/operations/` | Per op: last run (actor, time, values) + confirmation state, plus last 20 runs | DEVICE_SCOPED, V_RO |
| `GET /me/operations/?days=30` | Profile trail | Self |

Every new route must be classified in `ROUTES` (the classification test fails otherwise) and tested with a real viewer JWT (`StaffRolesBase._as`), covering in-scope, out-of-scope device, and site-only vs device-only viewer.

### 6.5 Confirmation mapping (for `/operations/`)
| Op | Confirmed when | Otherwise |
|---|---|---|
| Reboot, hard reset | Pending flag cleared after the command time | Waiting; after 5 min "Not confirmed" |
| APN | No flag exists (non-retained topic; the gateway restarts): confirmed when a heartbeat or status arrives at least 20 s after the command following a disconnect, from heartbeat history (my call) | Waiting; after 5 min "Not confirmed" |
| Meter calibration / interval | `meter_calibration_confirmed_at` / `meter_interval_confirmed_at` after the command | Waiting |
| Diagnostics | A `diag` DeviceEvent after the command | Waiting |
| Fetch logs | A DeviceLogFile after the command | Waiting |
| Firmware update / roll back | OTA log reaches success / failure | Shows OTA state |
| Mute, telemetry debug, auto reboot | No signal exists | "Sent" |

### 6.6 Assignment dates
"Since" on Profile needs when a device/site was assigned. The M2M tables have no date. **Builder's call**: add a `through` model with `created_at`, or drop "since" and show nothing. Recommendation: drop it (ponytail). The audit log of the admin change can answer it later if anyone asks.

## 7. Phasing (each phase ships on its own)
1. **Device dashboard tabs**: tabs, detail levels, gap stats, Every reading table, packet panel, Operations tab with confirmation states, the permission changes, site-less audit fix. Highest tester value.
2. **Home**: access summary endpoint + new home page + sidebar list. Retire `MySites.tsx`.
3. **Site view and Profile**: device strip + events tab + trimmed tabs; Profile viewer section + operations trail.

## 8. Testing
- A test scenario doc per phase **before tests** (`docs/test-scenarios/<feature>.md`, given/when/then, P0–P3), in both repos as each owns code. Planned: `viewer-device-tabs.md`, `viewer-access-home.md`, `viewer-site-profile.md`.
- Backend: real-JWT permission tests for every new or re-tiered route. Detail/range validation, gap stats (gap at the start, end, middle, no rows), packet match (found, pruned, compressed, batched), site-less audit.
- Frontend: tab URL state, allowed-detail rules, gap rows, packet panel states (gateway, meter, pruned), offline-disabled ops, empty home.

## 9. Left to the builder
- Component structure and file split (reuse DevicePage handlers, DeviceDashboard sections).
- Exact 8 chart readings and 7 default columns per device type (pick the most-used keys from `normalised` / meter fields).
- Query shape for gap stats (SQL `lag()` or Python over a timestamp list).
- Caching or refresh interval for the home summary (start with refresh on focus plus every 60 s, as other viewer pages do).
- Mobile layout details, within the house rules (16 px gutter, tables scroll in a box).

## 10. Not doing (and when to reconsider)
- Per-device CAGG: only if raw-row aggregation for 7 d gets slow (measure first).
- Longer raw retention: only if testers need more than 10 days of every reading.
- An exact reading-to-message link for gateways (message id on `TelemetryRaw`): only if "closest message" proves misleading in practice.
- Export: only if testers ask again.
