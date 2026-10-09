# Viewer site page: Devices tab — test scenarios

A viewer's site page (`/my-sites/:siteId`, `ViewerSite.tsx`) has a **Devices** tab in the site panel (replaced the Devices card under the panel, 2026-10-09). The tab lists the site's devices (`viewer/ViewerDevices.tsx`, from `GET /sites/<id>/gateway-status/`, scoped to assigned sites); a row opens a side drawer (`viewer/DeviceDrawer.tsx`) with the device detail and operations. Design: `smart-solar-django-backend/docs/superpowers/specs/2026-10-09-viewer-devices-tab-design.md`. Status: planned | written | passing | live-verified.

Ids: the gateway-status `device_id` is the device **pk**. Device operations and logs take the pk (`/devices/<pk>/...`); OTA calls take the **serial** (`/ota/updates/single/`, `/ota/updates/rollback/`, `/ota/devices/<serial>/logs`). The auto reboot and send-logs switch states come from `GET /devices/<pk>/`. Firmware: "Update to latest" is the primary action; a "Choose a version" list shows every active build for the device type (from `GET /ota/firmware/`, viewer-readable) and installs one through the single-device route `triggerSingleUpdate(serial, firmwareId)`, never the fleet-wide update-by-version route (employee-only). Reads always show; every write (update, rollback, switches, restart, mute, hard reset) is shown only with `can('device_control')` (hidden, not disabled).

Fields actually returned to a viewer (checked 2026-10-09): gateway-status rows give `device_id, device_type, serial, is_online, last_heartbeat, age_seconds, connectivity_type, signal_strength_dbm, firmware_version` (no `wifi_ssid` / `network_ip`). `GET /devices/<pk>/` (`DeviceSerializer` minus `wifi_password`, `wifi_ssid`, `network_ip` for viewers) adds `config_version` (preset id), `config_ack_ver` (applied preset version, an int, so not comparable to `config_version`), `pending_config_update`, `alerts_muted_until` (indefinite = year 9999), `logs_enabled`, `auto_reboot_enabled`, and (since 2026-10-09) `rs485_reboot_at` (last automatic restart) and `telemetry_debug_until` (detailed logging; indefinite = 9999-12-31T23:59:59Z), shown as read-only Status lines. The telemetry debug toggle is still left out (no frontend wrapper). Left out on purpose: fleet-wide OTA, firmware upload, delete, claims, Wi-Fi details, attach / detach / move, register maps.

## Tab visibility

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| TB-1 | `can('device_control')` false (switch off) | Viewer site page renders | Panel tabs have no `devices`; no device card under the panel | unit | P0 | passing |
| TB-2 | `can('device_control')` true | Page renders | Panel tabs end with `devices` | unit | P0 | passing |
| TB-3 | `tabsFor` with `visibleTabs` listing `devices` | Inverter site / meter-only site | `devices` last in both (meter-only gives `usage, devices`) | unit | P0 | passing |
| TB-4 | `tabsFor` with no `visibleTabs` (staff Dashboard, Devices page) | Any site | No `devices` tab (opt-in only) | unit | P1 | passing |
| TB-5 | `visibleTabs` lists `devices`; the panel's data fetch fails (or the site has no data: devices stopped reporting) | Panel renders | Tab bar still shows with Devices selectable and its content; the other tabs show the existing error / "No data found" message | unit | P0 | written |
| TB-6 | `visibleTabs` without `devices` (or none); fetch fails | Panel renders | Unchanged: the error message only, no tab bar | unit | P1 | written |

## Listing

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| LS-1 | Site with a monitor and a meter | Tab renders | One row each: "Monitor GW-1", "Meter EM-1"; only that site's gateway-status is requested | unit | P0 | passing |
| LS-2 | Rows | Tab renders | "Live · last update N minutes ago" (green) or "Not reporting" (amber), firmware version, never red | unit | P1 | passing |
| LS-3 | Site has no devices | Tab renders | Empty state "No devices at this site yet" | unit | P2 | passing |
| LS-4 | Request fails | Tab renders | "Couldn't load the devices. Try again." with a button; no raw error | unit | P1 | passing |
| LS-5 | Not-assigned site | Page renders | The not-available message only; no panel, no request | unit | P0 | passing |
| LS-6 | Newer active firmware for that device type exists (versions compared without `v` / `-suffix`) | Tab renders | Row shows "Update available" | unit | P2 | passing |
| LS-7 | Firmware list refused (viewer, employee-only route) | Tab renders | Rows still show, no hint, no error | unit | P1 | passing |
| LS-8 | Row | Clicked | Drawer opens for that device | unit | P0 | passing |

## Drawer

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| DR-1 | Drawer open | Renders | Sections Status, Firmware, Logs, Diagnostics (monitors), Auto reboot, Actions (Actions only with device control) | unit | P0 | written |
| DR-2 | Status | Renders | Live / Not reporting chip, last update, firmware, connection type and signal in words | unit | P2 | passing |
| DR-3 | Close button or Esc | Pressed | Drawer closes | unit | P2 | planned |
| DR-4 | Status, `GET /devices/<pk>/` returned | Renders | "Last update at <date, time>" next to the relative time; device kind in words ("Inverter monitor" / "Whole-home meter") | unit | P2 | written |
| DR-5 | `pending_config_update` false, `config_version` set | Renders | "Settings applied"; true → "Waiting for the device to apply settings"; no `config_version` → "No settings assigned yet" | unit | P1 | written |
| DR-6 | Status | "Advanced details" opened | Serial, device type code, settings preset and applied version (only fields present) | unit | P2 | written |
| DR-7 | `alerts_muted_until` in the future | Renders | "Alerts muted until <time>"; only "Turn alerts back on" offered. Past / null → "Alerts are on", only "Mute alerts for 4 hours". Year 9999 → muted until turned back on | unit | P1 | written |
| DR-8 | `GET /devices/<pk>/` fails | Renders | No settings / mute lines; both mute buttons offered (state unknown) | unit | P2 | written |
| DR-9 | Payload | Renders | No Wi-Fi name or IP (not returned to viewers) | unit | P1 | written |
| DR-10 | `can('device_control')` false | Renders | No update / install / rollback / restart / mute / hard reset buttons, no switches; send-logs and auto reboot shown as plain lines; versions, history, logs, diagnostics still shown | unit | P0 | written |
| DR-11 | `rs485_reboot_at` set / null | Renders | Status line "Last automatic restart: <date, time>" / "Last automatic restart: None recorded"; not behind Advanced details, no control | unit | P1 | written |
| DR-12 | `telemetry_debug_until` future / null or past / year 9999 | Renders (with or without device control) | "Detailed logging: On until <date, time>" / "Detailed logging: Off" / "Detailed logging: On until turned off"; read-only, no switch | unit | P1 | written |

## Firmware

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| FW-1 | Newer firmware exists | "Update to <v>" pressed | Danger confirm; `triggerSingleUpdate(serial, firmwareId)` only after confirm | unit | P0 | passing |
| FW-3 | Any | "Roll back" pressed | Danger confirm; `triggerRollback(serial)` only after confirm | unit | P0 | passing |
| FW-4 | Confirm open | "Keep it" pressed | Nothing sent | unit | P1 | passing |
| FW-5 | Latest OTA log is downloading | Drawer renders | "Downloading · N%" from `bytes_downloaded / size` | unit | P2 | passing |
| FW-6 | Firmware list refused | Drawer renders | Plain line "ask an admin" instead of update controls; rollback still offered | unit | P1 | passing |
| FW-7 | Firmware list | "Choose a version" opened | Active builds for this device type only, newest first, with date, size in MB and release notes; the running one marked "Running now" with no install button; no `<select>` | unit | P1 | written |
| FW-8 | An older build in the list | "Install" pressed | Danger confirm naming the version; `triggerSingleUpdate(serial, thatId)` only after confirm; fleet route never called | unit | P0 | written |
| FW-9 | OTA logs | "Update history" opened | Newest 5: version, status in words, time; failed rows show the error message | unit | P2 | written |
| FW-10 | No OTA logs | "Update history" opened | "No updates yet." | unit | P3 | written |

## Logs

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| LG-1 | Device has log files | Drawer renders | Newest 10 files listed by name and time | unit | P1 | passing |
| LG-2 | A file | "View" pressed | Content shown in the drawer (`getDeviceLogFileContent(pk, id)`) | unit | P2 | passing |
| LG-3 | A file | "Download" pressed | Opens the signed URL (`getDeviceLogFileDownloadUrl(pk, id)`) | unit | P2 | passing |
| LG-4 | "Send logs" switch | Toggled | `toggleDeviceLogs(pk, enabled)` | unit | P1 | passing |
| LG-5 | Log files listed | "Scan today's logs" pressed | `scanDeviceLogFiles(pk, today in IST as YYYY-MM-DD)`; "Checked N log files from today: E errors, W warnings." (0 files → "No log files from today to check.") | unit | P1 | written |
| LG-6 | Log files listed | "Download all" pressed | `bulkDownloadLogFiles(pk)`; failure (e.g. 413 too large) → plain line, no raw error | unit | P2 | written |

## Diagnostics (inverter monitors only)

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| DG-1 | `getRegisterCoverage(pk)` returns 42 of 45 | Drawer renders | "Reading 42 of 45 inverter values" with the latest reading time | unit | P1 | written |
| DG-2 | Some values missing | "Show missing values" opened | Each missing value's label (and unit) listed; collapsed by default | unit | P2 | written |
| DG-3 | Coverage call fails (no telemetry yet / no settings / refused) | Drawer renders | "Couldn't check which inverter values arrive yet." | unit | P2 | written |
| DG-4 | Whole-home meter | Drawer renders | No Diagnostics section, no coverage call | unit | P3 | written |

## Auto reboot

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| AR-1 | Switch | Toggled off | `setDeviceAutoReboot(pk, false)` → `PATCH /devices/<pk>/auto-reboot/ {"enabled": false}`; switch reflects the saved value | unit | P0 | passing |
| AR-2 | Backend refuses | Toggled | Switch goes back, plain error line | unit | P1 | passing |
| AR-3 | `GET /devices/<pk>/` fails (switch states come from there, not gateway-status) | Renders | Both switches unchecked with "Current setting not reported" | unit | P2 | passing |

## Actions and results

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| CF-1 | Drawer | Restart pressed | Normal confirm; `rebootDevice(pk)` only after "Restart" | unit | P0 | passing |
| CF-2 | Restart confirm open | "Keep it running" pressed | Closes, nothing sent | unit | P1 | passing |
| CF-3 | Drawer | Hard reset pressed | Danger confirm explaining settings are erased; `hardResetDevice(pk)` only after confirm | unit | P0 | passing |
| CF-4 | Drawer, alerts on | Mute alerts pressed | `muteDeviceAlerts(pk, 4)` directly, success line; button switches to "Turn alerts back on" using the returned `alerts_muted_until` | unit | P2 | written |
| CF-5 | Backend refuses (e.g. 403 `DEVICE_OPS_OFF`) | Operation sent | "Couldn't send that to Monitor GW-1. Try again, or ask an admin." | unit | P1 | passing |

## Security (backend enforces; UI is convenience)

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| SC-1 | Viewer assigned to s1 | Any drawer call for a device at s2 | 403 | live | P0 | planned |
| SC-2 | Viewer with switch off | Any write in the drawer | 403 `DEVICE_OPS_OFF` | live | P0 | planned |
| SC-3 | Viewer | gateway-status | No `wifi_ssid` / `network_ip` in the payload | live | P1 | planned |

## Live verification

1. Viewer on coim_002 with device operations on: Devices tab lists the monitor/meter; a row opens the drawer; Restart asks first and the device reboots at its next check-in. (planned)
2. Switch off (Employees page), reload: no Devices tab. (planned)
3. Firmware: update to latest asks first, progress shows downloading → completed; rollback asks first. (planned)
4. Auto reboot off, check the staff Devices page shows it off; turn back on. (planned)
5. Logs: toggle on, view and download a file; scan today's logs; Download all saves one .txt. (planned)
7. Diagnostics on coim_002: coverage numbers match the staff Devices page's register coverage. (planned)
8. Choose a version: install an older build on a test device, confirm names the version, Update history shows it. (planned)
9. Switch off: drawer opened by URL/state shows reads only, no write buttons. (planned)
6. Phone width 375 px: drawer full width, dialogs fit, dark mode legible. (planned)
