# Gateway activity card (firmware V2)

**Feature:** a "Gateway activity" card on the staff device detail (`Devices.tsx`) and on the viewer device page (`viewer/DevicePage.tsx`). It shows what firmware V2 gateways now report: Wi-Fi join failures, refused settings, backup battery, the event history (firmware updates, Wi-Fi / mobile data switches, postponed commands, health checks, unreadable backlog uploads), and lets staff set the mobile-data APN.

Backend: `GET /api/devices/<id>/events/?limit=` (viewer read, scoped), `POST /api/devices/<id>/apn/` (employee tier), device fields `wifi_failure`, `config_rejected`, `battery_pct`, `power_source` (`smart-solar-django-backend/docs/test-scenarios/firmware-v2-compat.md`).

Decisions (my call, the user skipped the design questions):
- One card added to the existing device pages, no new route.
- V1 gateways send none of this: the card says "No activity yet" and shows no battery line.
- The Wi-Fi name in a failure appears only when the backend sends it (admins).
- The APN form is under a closed "Mobile data settings" expander, only on the staff page and only with `device_control`; saving asks for confirmation because the gateway restarts.
- The event history list was removed (2026-10-27): the card shows notes, health-check tiles, the Run button and the APN form only. The events are still fetched for the newest health check.

**Status values:** `planned` → `written` → `passing` → `live-verified`.

## 1. Notes at the top

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| N1 | `wifi_failure` {ssid: 'Home', reason: 'auth_failed'} | render | Amber note "Couldn't join Wi-Fi Home: wrong password" | unit | P0 | passing |
| N2 | `wifi_failure` without ssid (non-admin) | render | "Couldn't join Wi-Fi: wrong password", no name | unit | P0 | passing |
| N3 | `config_rejected` 'CFG:4' | render | Amber note naming CFG v4 and telling staff to fix and save the preset | unit | P0 | passing |
| N4 | `battery_pct` 87 | render | "Backup battery 87%" | unit | P1 | passing |
| N5 | V1 device (all fields null/empty), no events | render | "No activity yet", no notes, no battery line | unit | P0 | passing |

## 2. Activity list

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|

## 3. APN

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| A1 | `allowApn` false | render | No "Mobile data settings" | unit | P0 | passing |
| A2 | `allowApn`, APN typed, Save, confirm | click | `setDeviceApn(id, {apn})` called; "Sent" message | unit | P0 | passing |
| A3 | APN with `^` or empty | Save | Save disabled / inline error, nothing sent | unit | P1 | passing |
| A4 | Backend refuses | confirm | Error text from the backend shown | unit | P2 | passing |

## 3b. Health check

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| H1 | `allowCheck` false | render | No "Run health check" button | unit | P0 | passing |
| H2 | `allowCheck` | click | `runDeviceDiagnostics(id)` called; "Sent" message; card reloads after 15 s and 30 s | unit | P1 | passing |
| H3 | Backend refuses or fails | click | Error text shown, button usable again | unit | P1 | passing |

| H4 | Healthy Wi-Fi unit, no SIM | `healthChecks` | "All good"; Mobile data is "Not used", not a problem | unit | P0 | passing |
| H5 | No uplink, SIM not registered | `healthChecks` | Internet and Mobile data both LOOK; summary "4 of 6 fine, 2 need a look" | unit | P1 | passing |
| H6 | Modbus 51, SD 31, MQTT 41 | `healthChecks` | Each gives its own advice | unit | P1 | passing |
| H7 | Wi-Fi below -75 dBm; no device clock | `healthChecks` | Internet and Clock LOOK | unit | P1 | passing |
| H8 | On cellular, CSQ 15 | `healthChecks` | -83 dBm | unit | P2 | passing |
| H9 | Missing fields | `rawRows` | 14 rows, `n/a` for missing, "not set" time | unit | P1 | passing |
| H10 | A diag event | render | Checklist and the 14-value table shown | unit | P1 | passing |
| H11 | Several checks and other events | render | Newest health check shown; no History list, no other event rows | unit | P2 | passing |

## 4. Live verification

| ID | Check | Status |
|---|---|---|
| L1 | V1 gateway device page: card shows "No activity yet" (or only cloud-connect rows), no layout break, light and dark | planned |
| L2 | V2 bench gateway: firmware update shows progress rows then success | planned |
| L3 | Employee (non-admin) sees the Wi-Fi failure note without the network name | planned |
| L4 | APN save on a cellular V2 gateway: gateway restarts, comes back on mobile data | planned |
| L5 | Phone width (≤ 420 px): card fits, no sideways scroll | planned |
| L6 | V2 bench gateway: Run health check adds a Health check row within ~30 s; V1 gateway adds nothing | planned |
