# Viewer Operations: Settings sub-tab

Mockup: OpsSettings.dc.html (design scratchpad). Tests: src/features/staff/viewer/__tests__/OpsSettings.test.tsx.
Files: OpsSettings.tsx, opsSettings.css (shares the `.ops` tokens of operationsTab.css). Data: `GET /devices/<pk>/` (current values) and the
operations payload already loaded by OperationsTab (`ops` states, `recent`).
Only settings that exist in the backend for a viewer. The backend has no batch endpoint, so changes are staged in the page and sent one by one.
"Detailed readings" (telemetry debug) acts at once, not staged: the backend then stores raw messages only and the dashboard stops updating until it ends.

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| G1 | Groups | gateway, device_control | render | tablist "Setting groups": Device behaviour (3) selected, Connection (3); real tab buttons with aria-selected | unit | P0 | passing |
| G2 | Groups | gateway | click Connection | Connection selected; APN fields shown; Wi-Fi name and Password inputs (empty, placeholder "Leave empty to keep the current one") and a Send Wi-Fi settings button; the old "set by an admin" note is gone | unit | P0 | passing |
| G3 | Groups | energy meter | render | tabs Meter (2) and Connection (1); Connection shows only the Wi-Fi row, no restart, logs or APN rows (backend refuses them for meters) | unit | P0 | passing |
| R1 | Role | no device_control | render | one-line note only; no controls, no API call | unit | P0 | passing |
| L1 | Loading | device record not loaded | render | skeleton "Loading..." | unit | P1 | passing |
| L2 | Loading | getDevice rejects | render | "Couldn't load" message, no crash | unit | P1 | passing |
| S1 | Staging | switch off | click switch | switch on, row shows "Changed, not applied", bottom bar "1 change not applied" | unit | P0 | passing |
| S2 | Staging | one staged change | click Discard | switch back, bar gone | unit | P0 | passing |
| S3 | Staging | staged then set back to the original | click twice | no change, no bar | unit | P1 | passing |
| A1 | Apply | staged auto reboot on | Review and apply | dialog lists "off to on"; confirm calls setDeviceAutoReboot(id, true), operations reload (onDone), device re-read | unit | P0 | passing |
| A2 | Apply | staged Send logs on | confirm | toggleDeviceLogs(id, true) | unit | P0 | passing |
| A3 | Apply | two staged, second call rejects | confirm | per-setting result lines (one sent, one "couldn't send"); failed one stays staged, bar says 1 change | unit | P0 | passing |
| A4 | Apply | device offline | Review and apply | the offline notice shows, no API call, staged changes kept | unit | P0 | passing |
| A5 | Apply | dialog open | Cancel | nothing sent | unit | P1 | passing |
| C1 | Chips | ops auto_reboot confirmed/ sent with last run | render | "Applied <when>" (time today, "yesterday", else date) | unit | P0 | passing |
| C2 | Chips | ops state waiting / not_confirmed / failed | render | Waiting / Not confirmed / Device rejected (+ reason when values carry one) | unit | P0 | passing |
| C3 | Chips | op never recorded | render | no chip (no invented state) | unit | P1 | passing |
| M1 | Meter | meter | enter 0 or 4000 seconds | "Enter 1 to 3600 seconds", Review and apply disabled | unit | P0 | passing |
| M2 | Meter | meter, 10 s staged | confirm | updateDevice(id, {meter_publish_interval_ms: 10000}) | unit | P0 | passing |
| M3 | Meter | meter online, valid values | Calibrate meter, confirm dialog | calibrateMeter(id, {mode, v, i}) called only after confirming | unit | P0 | passing |
| M4 | Meter | out-of-range voltage | type 50 V | message, Calibrate disabled | unit | P1 | passing |
| M5 | Meter | meter offline | render | calibration button replaced by "needs the meter online" | unit | P1 | passing |
| P1 | APN | gateway | type APN, Send | own confirm dialog (gateway restarts); setDeviceApn(id, {apn,...}) only after confirm | unit | P0 | passing |
| P2 | APN | APN contains ^ | type | error shown, Send disabled | unit | P1 | passing |
| H1 | History | recent has reboot and auto_reboot, apn rows | render | "Setting changes" lists only setting ops with name and time; staged changes listed first as "not applied yet" | unit | P0 | passing |
| D1 | Detailed readings | switch off | click switch | confirm dialog with 1 h / 6 h / 24 h choice; nothing sent until Turn on; then setDeviceTelemetryDebug(id, {hours}) | unit | P0 | passing |
| D2 | Detailed readings | render | click switch, Not now | help says it pauses this page's data and keeps raw messages only; nothing sent | unit | P0 | passing |
| D3 | Detailed readings | telemetry_debug_until in the future | render, click switch | switch on, chip "On until <time>"; turning off calls clearDeviceTelemetryDebug without a dialog | unit | P0 | passing |
| D4 | Detailed readings | until year 9999 | render | chip "On until turned off" | unit | P1 | passing |
| SL1 | Send logs | gateway | render | switch "Send logs" with help "The gateway uploads its log files after each restart."; no "Upload logs" anywhere | unit | P0 | passing |
| SL2 | Send logs | logs_enabled true, fetch_logs last run (enable) at T | render | chip "On" with when it changed (T) | unit | P0 | passing |
| SL3 | Send logs | logs_enabled false, no fetch_logs row | render | chip "Off" with no time | unit | P1 | passing |
| SL4 | Send logs | last run was an enable and operations confirmed_at set | render | second line "Last log file received <when>" | unit | P0 | passing |
| SL5 | Send logs | last run was a disable, or no confirmed_at | render | no "Last log file received" line | unit | P0 | passing |
| SL6 | Send logs | device offline, Send logs staged | Review and apply | no offline block; review dialog says the change is delivered when the gateway reconnects; confirm calls toggleDeviceLogs | unit | P0 | passing |
| SL7 | Send logs | device offline, another setting staged | Review and apply | existing offline notice, nothing sent (A4) | unit | P0 | passing |
| W1 | Wi-Fi | gateway or meter, Connection tab | type a name only, click Send Wi-Fi settings | button disabled while both inputs are empty; confirm dialog says the device reconnects and may go offline for a minute; nothing sent until confirmed; then updateDevice(id, {wifi_ssid}) with only the typed field | unit | P0 | passing |
| W2 | Wi-Fi | name and password typed | confirm | updateDevice(id, {wifi_ssid, wifi_password}); inputs cleared; "Wi-Fi: sent." result; onDone called | unit | P0 | passing |
| W3 | Wi-Fi | updateDevice rejects | confirm | plain "Wi-Fi: couldn't send." error, inputs kept | unit | P1 | passing |
| W4 | Wi-Fi | password typed | click Show / Hide | input type toggles password/text; label Show password / Hide password | unit | P1 | passing |
| W5 | Wi-Fi | ops wifi waiting / confirmed with last run | render | usual chip Waiting / Applied <when> on the Wi-Fi row | unit | P0 | passing |
| W6 | Wi-Fi | Wi-Fi typed, other setting staged | render | Wi-Fi is not in the staged batch: bar counts only staged switches | unit | P1 | passing |
| X1 | Actions | Actions sub-tab | render | no card for auto restart, APN, interval, calibration (covered by OperationsTab A1/A2); fetch_logs is not an action card either, it lives here as Send logs | unit | P0 | passing |

## Live verification

| ID | Check | Status |
|---|---|---|
| V1 | Bench gateway: toggle restart-if-stalled, apply, chip goes from Changed to Applied after reload | planned |
| V2 | Bench meter: set interval 10 s, chip Waiting then Applied once the meter confirms | planned |
| V3 | Viewer without device control sees only the note | planned |
| V4 | Dark mode: bar, chips and outlines readable | planned |
