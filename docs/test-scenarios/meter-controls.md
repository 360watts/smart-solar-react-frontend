# Test scenarios: EM26 meter controls (staff dashboard)

**Feature:** the Edit Device modal gets a "Meter settings" section for energy meters:
- **Telemetry interval:** a normal field, saved with Save Changes.
- **Calibration:** a one-shot action with its own button and confirm dialog. It is never part of Save.

Gateway-only fields (preset / config version, auto reboot, log streaming) are hidden for meters. Other screens drop the meter actions the EM26 doesn't have (rollback) and warn that a meter hard reset wipes its Wi-Fi.

Backend: `smart-solar-django-backend/docs/test-scenarios/em26-meter-control.md` (calibrate route, `meter_*` device fields, status derived on read).

Tests: `src/features/staff/MeterSettingsSection.test.tsx`, `src/features/staff/EditDeviceModal.test.tsx`.

## 1. Edit Device modal

| ID | Given / when / then | Type | Pri | Status |
|---|---|---|---|---|
| M1 | meter → "Meter settings" shown; preset, config version, auto reboot and log streaming hidden | unit | P0 | passing |
| M2 | gateway → no meter section; existing fields unchanged | unit | P0 | passing |
| M3 | meter, interval set to 10 s → Save payload has `meter_publish_interval_ms: 10000` | unit | P0 | passing |
| M4 | meter, interval untouched → key not in the payload | unit | P1 | passing |
| M5 | interval 0 or 3601 s → Save blocked with an error, `onSave` not called | unit | P1 | passing |

## 2. Calibration

| ID | Given / when / then | Type | Pri | Status |
|---|---|---|---|---|
| C1 | single-phase → only V1 and I1 inputs; three-phase → V1–V3, I1–I3 | unit | P0 | passing |
| C2 | out-of-range V/I → Calibrate disabled with a message, no request | unit | P0 | passing |
| C3 | Calibrate → confirm dialog → confirm → `calibrateMeter(id, {mode, v, i})` called once | unit | P0 | passing |
| C4 | status `pending` → polls the device every 10 s and stops at `confirmed` | unit | P0 | passing |
| C5 | offline meter → no Calibrate button, "Meter offline" note | unit | P1 | passing |
| C6 | viewer → calibration block hidden | unit | P1 | passing |
| C7 | Save Changes never sends calibration | unit | P0 | passing |

## 3. Other screens

| ID | Given / when / then | Type | Pri | Status |
|---|---|---|---|---|
| S1 | viewer device page, meter → no Roll back, Auto reboot or Send logs; hard reset text mentions Wi-Fi and a site visit | unit | P1 | planned |
| S2 | OTA rollback picker leaves out meters (uses `device_type` now in `/ota/devices/status/`) | manual | P2 | planned |
| S3 | staff device detail, meter → no logs / auto-reboot checkboxes; hard reset warning adds the Wi-Fi line; mobile reset text likewise | manual | P2 | planned |

## 4. Live verification (bench meter F82CE8D1CCB6, after backend deploy)

| ID | Check | Status |
|---|---|---|
| L1 | Set the interval to 10 s → "Waiting for meter" → "Meter confirmed 10 s" | planned |
| L2 | Single-phase calibrate → "Waiting for meter" → "Calibrated at …" | planned |
| L3 | Gateway edit modal looks and saves exactly as before | planned |
