# Viewer device dashboard, phase 1: tabs, detail levels, every reading, operations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give testers a four-tab device page (Overview, All values, Every reading, Operations) with exact detail levels, reporting-gap stats, the raw packet, and every single-device operation with its confirmation state, for bench and site devices alike.

**Architecture:** The backend extends `GET /devices/{id}/dashboard/` with a `detail` mode (exact per-bucket average/min/max for at most 8 requested keys, gap stats, 60 coverage cells, code changes) and adds three read routes in a new module (`readings`, `packet`, `operations`). Calibration, APN and the meter interval open to viewers; `audit_device_command` stops skipping site-less devices and more ops are audited. The frontend turns `DeviceDashboard.tsx` into a tab shell with the tab in the URL; the Overview chart is a small SVG component driven by pure helpers that are unit-tested.

**Tech Stack:** Django 5 + DRF (tests on SQLite via `localapi/test_settings.py`), React 18 + TypeScript + Jest/RTL, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-viewer-portal-redesign-design.md` (approved 2026-10-29). Mockups: https://claude.ai/artifact/5uuVAcejGACiDeNyY1pn4t (board 3).

**Repos and commands**
- Backend: `C:\360watts\smart-solar-django-backend`. Tests: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.<module> --settings=localapi.test_settings -v 2`
- Frontend: `C:\360watts\smart-solar-react-frontend`. Tests: `npx jest <path>`; build: `npm run build`.

**House rules that apply to every task**
- No `git commit`, `git push` or deploy without the owner's OK. Each "Checkpoint" step means: stop, show the diff summary, ask. No `Co-Authored-By` lines.
- Test scenario docs are written before the tests (Tasks A1, B1) and their Status column is updated in the same change that adds a test.
- Frontend follows `UI_GUIDE.md`: plain words, hide controls the role can't use, confirm destructive actions in `ConfirmDialog`.

---

## File map

Backend (`smart-solar-django-backend`)
| File | Change |
|---|---|
| `docs/test-scenarios/viewer-device-tabs.md` | Create: backend scenarios |
| `api/staff_roles.py` | Modify: `calibrate_meter`, `device_apn` to V_RW + DEVICE_SCOPED; classify 3 new routes |
| `api/views/device_mgmt.py` | Modify: viewer-writable interval; audits on more ops; dashboard `detail` mode |
| `api/services/device_audit.py` | Modify: record site-less devices under `site_id=''` |
| `api/services/device_series.py` | Create: exact bucketing, gap stats, coverage, code changes, packet decode |
| `api/views/device_detail.py` | Create: `device_readings`, `device_reading_packet`, `device_operations` |
| `api/views/__init__.py`, `api/urls.py` | Modify: export + route the three views |
| `ota/views.py` | Modify: audit single OTA update and roll back |
| `api/models/telemetry.py` | Modify: stale "No retention yet" docstring |
| `tests/test_viewer_device_tabs.py` | Create |
| `tests/test_em26_meter_control.py` | Modify: C11 and I7 now expect viewers allowed |

Frontend (`smart-solar-react-frontend`)
| File | Change |
|---|---|
| `docs/test-scenarios/viewer-device-tabs.md` | Create: frontend scenarios |
| `src/services/api.ts` | Modify: `getDeviceSeries`, `getDeviceReadings`, `getReadingPacket`, `getDeviceOperations` |
| `src/features/staff/viewer/deviceChart.ts` | Create: types, reading lists, detail rules, ticks, segments, colours (pure) |
| `src/features/staff/viewer/OverviewChart.tsx` (not DeviceChart: it would clash with deviceChart.ts on case-insensitive file systems) | Create: Overview chart card (controls, readout, plot, reporting + codes lanes) |
| `src/features/staff/viewer/ReadingsTab.tsx` | Create: paged table, gap rows, columns picker, split-view packet panel |
| `src/features/staff/viewer/OperationsTab.tsx` | Create: per-op status cards + recent runs, then the existing controls |
| `src/features/staff/viewer/deviceTabs.css` | Create: tabs, chart, table, ligature rule, colour tokens |
| `src/features/staff/viewer/DeviceDashboard.tsx` | Modify: tab shell, `?tab=`, Overview tiles |
| `src/features/staff/viewer/DevicePage.tsx` | Modify: APN form and meter settings for viewers with device control |
| `src/features/staff/viewer/__tests__/*.test.ts(x)` | Create/modify |

---

# Part A: backend

### Task A1: Backend test scenario doc

**Files:**
- Create: `docs/test-scenarios/viewer-device-tabs.md` (backend repo)

- [ ] **Step 1: Write the doc**

```markdown
# Viewer device tabs (phase 1): backend

Spec: smart-solar-react-frontend/docs/superpowers/specs/2026-10-29-viewer-portal-redesign-design.md (§5.3, §6).
Tests: tests/test_viewer_device_tabs.py, tests/test_em26_meter_control.py (C11, I7).

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| P1 | Permissions | viewer with an in-scope online meter | POST meter/calibrate/ | not role-denied, calibration queued | integration | P0 | planned |
| P2 | Permissions | viewer, meter on another site | POST meter/calibrate/ | 403 ROLE_FORBIDDEN | integration | P0 | planned |
| P3 | Permissions | viewer, in-scope gateway | POST apn/ | 200 queued | integration | P0 | planned |
| P4 | Permissions | viewer, in-scope meter | PATCH {meter_publish_interval_ms: 10000} | 200, interval saved | integration | P0 | planned |
| P5 | Permissions | viewer with device ops switched off | POST apn/ | 403 | integration | P1 | planned |
| P6 | Permissions | viewer | PATCH {wifi_ssid} | still 403 (only auto reboot + interval writable) | integration | P1 | planned |
| U1 | Audit | site-less gateway | viewer reboots it | SiteAuditLog row, site_id '', payload.device_id set | integration | P0 | planned |
| U2 | Audit | site device | mute, unmute, telemetry debug on/off, logs toggle, auto reboot, interval change | one audit row each with the documented action | integration | P1 | planned |
| U3 | Audit | audit write raises | reboot | reboot still returns 200 | unit | P1 | planned |
| D1 | Dashboard | detail absent | GET ?hours=24 | legacy response unchanged (history, bucket_minutes) | integration | P0 | planned |
| D2 | Dashboard | hours=6 | detail=every | 400 INVALID_DETAIL | integration | P0 | planned |
| D3 | Dashboard | rows at 0/1/2 min in one 5 min bucket | detail=5m&keys=pv1_power_w | one point: avg, __min, __max exact (no sampling) | integration | P0 | planned |
| D4 | Dashboard | fault word 4 then 8 in a bucket | detail=5m&keys=fault_word_1 | last value 8, no __min/__max | integration | P1 | planned |
| D5 | Dashboard | readings 2 s apart with one 60 s hole | detail=every&hours=1 | median_gap_s 2, longest_gap_s 60 at the hole start | integration | P0 | planned |
| D6 | Dashboard | readings in the first half only | detail=1m&hours=1 | coverage has 60 cells, later cells 'empty', earlier 'full' | integration | P1 | planned |
| D7 | Dashboard | half the expected rate in one cell | coverage | that cell 'partial' | unit | P1 | planned |
| D8 | Dashboard | fault word 0 → 4 → 0 | detail=every | code_changes has the 4 and the 0 | integration | P1 | planned |
| D9 | Dashboard | more than 8 keys | GET | 400 TOO_MANY_KEYS | integration | P2 | planned |
| D10 | Dashboard | 1d detail | buckets | start at IST midnight | unit | P2 | planned |
| R1 | Readings | 150 gateway rows | GET readings/ | 100 newest first, next_before = 100th timestamp | integration | P0 | planned |
| R2 | Readings | before=<t> | GET | rows strictly older than t | integration | P0 | planned |
| R3 | Readings | keys=a,b | GET | values carry only a and b | integration | P2 | planned |
| R4 | Readings | meter | GET | rows from EnergyMeterReading fields | integration | P1 | planned |
| R5 | Readings | viewer, other device | GET | 403 | integration | P0 | planned |
| K1 | Packet | gateway reading + raw message 1 s later | GET packet/ | reading = payload; message text decoded, received_at | integration | P0 | planned |
| K2 | Packet | message stored base64+zlib | GET | decoded text | unit | P1 | planned |
| K3 | Packet | no message within 2 s, reading older than 14 days | GET | message null, note 'pruned' | integration | P1 | planned |
| K4 | Packet | meter reading with raw_payload.raw | GET | kind meter, raw string | integration | P1 | planned |
| K5 | Packet | reading id of another device | GET | 404 | integration | P0 | planned |
| O1 | Operations | gateway, no audit rows | GET operations/ | every gateway op listed, state no_record | integration | P0 | planned |
| O2 | Operations | reboot audited, pending_reboot still set, 6 min ago | GET | state not_confirmed | integration | P0 | planned |
| O3 | Operations | reboot audited, flag cleared, heartbeat after | GET | confirmed, confirmed_at = heartbeat | integration | P0 | planned |
| O4 | Operations | meter calibration, confirmed_at after command | GET | confirmed | integration | P1 | planned |
| O5 | Operations | diagnostics, diag event after | GET | confirmed | integration | P1 | planned |
| O6 | Operations | mute audited | GET | state sent | integration | P2 | planned |
| O7 | Operations | APN, heartbeat 30 s after | GET | confirmed | integration | P1 | planned |
| O8 | Operations | meter | GET | only meter ops (no APN, no diagnostics) | integration | P1 | planned |
| O9 | Operations | 25 audit rows | GET | recent has 20, newest first | integration | P2 | planned |

## Live verification
- [ ] Bench gateway 00A11EF28F0E: as a viewer, reboot; Operations shows Waiting, then Confirmed after reconnect.
- [ ] Bench gateway: Every reading → Packet shows the reading and a "Closest message received".
- [ ] Bench meter F82CE8D1CCB6 (when powered): set interval 10 s as a viewer; confirmed_at arrives.
- [ ] 7 d / hourly on a busy gateway answers in under 3 s (else revisit §10 "per-device CAGG").
```

- [ ] **Step 2: Checkpoint** (ask the owner before committing the doc).

---

### Task A2: Open calibration, APN and meter interval to viewers

**Files:**
- Modify: `api/staff_roles.py` (V_RW list ~line 116, EMP list ~lines 151 and 157, `DEVICE_SCOPED` ~line 52)
- Modify: `api/views/device_mgmt.py:79`
- Modify: `tests/test_em26_meter_control.py` (C11 `test_roles`, I7 `test_viewer_cannot_set_interval`)
- Create: `tests/test_viewer_device_tabs.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_viewer_device_tabs.py`:

```python
"""Viewer device tabs, phase 1. docs/test-scenarios/viewer-device-tabs.md (IDs in comments).

Real JWTs on purpose: force_authenticate() would bypass the staff role gate.
"""
from unittest import mock

from django.utils import timezone

from api.models import Device, EmployeeProfile
from tests.test_staff_roles import StaffRolesBase, _role_denied

QUEUE = 'api.views.device_mgmt_mqtt._queue_mqtt_publish'


class TabsBase(StaffRolesBase):
    def setUp(self):
        super().setUp()
        self.meter = Device.objects.create(device_serial='SRMTR1', device_type='energy_meter',
                                           site=self.site_a, last_heartbeat=timezone.now())
        self.v = self._as(self.viewer)
        q = mock.patch(QUEUE, return_value=True)
        self.q = q.start()
        self.addCleanup(q.stop)


class PermissionTests(TabsBase):
    def test_p1_viewer_calibrates_in_scope_meter(self):
        r = self.v.post(f'/api/devices/{self.meter.id}/meter/calibrate/', {'mode': 'single', 'v': [230], 'i': [5]}, format='json')
        self.assertFalse(_role_denied(r))
        self.assertEqual(r.status_code, 200, r.data)

    def test_p2_viewer_cannot_calibrate_meter_elsewhere(self):
        other = Device.objects.create(device_serial='SRMTR2', device_type='energy_meter', site=self.site_b,
                                      last_heartbeat=timezone.now())
        r = self.v.post(f'/api/devices/{other.id}/meter/calibrate/', {'mode': 'single', 'v': [230], 'i': [5]}, format='json')
        self.assertTrue(_role_denied(r))

    def test_p3_viewer_sets_apn_on_in_scope_gateway(self):
        r = self.v.post(f'/api/devices/{self.dev_a.id}/apn/', {'apn': 'airtelgprs.com'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    def test_p4_viewer_sets_meter_interval(self):
        r = self.v.patch(f'/api/devices/{self.meter.id}/', {'meter_publish_interval_ms': 10000}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.meter.refresh_from_db()
        self.assertEqual(self.meter.meter_publish_interval_ms, 10000)

    def test_p5_device_ops_switch_off_blocks_apn(self):
        EmployeeProfile.objects.filter(user=self.viewer).update(device_ops_enabled=False)
        r = self.v.post(f'/api/devices/{self.dev_a.id}/apn/', {'apn': 'airtelgprs.com'}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_p6_viewer_still_cannot_change_wifi(self):
        r = self.v.patch(f'/api/devices/{self.dev_a.id}/', {'wifi_ssid': 'x'}, format='json')
        self.assertEqual(r.status_code, 403)
```

In `tests/test_em26_meter_control.py`, change C11's first assertion and I7:

```python
    def test_roles(self):  # C11
        body = {'mode': 'single', 'v': [230], 'i': [5]}
        self.assertFalse(_role_denied(self._calibrate(self._as(self.viewer), self.meter, body)))  # viewers calibrate since 2026-10-29
```

```python
    def test_viewer_can_set_interval(self):  # I7 (viewers may since 2026-10-29)
        resp = self._patch(self._as(self.viewer), self.meter, {'meter_publish_interval_ms': 10000})
        self.assertEqual(resp.status_code, 200)
```

Keep the rest of C11 (the device-ops-switch part) unchanged. Update the I7 and C11 rows in `docs/test-scenarios/em26-meter-control.md` to say viewers are allowed.

- [ ] **Step 2: Run, expect failures**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_viewer_device_tabs tests.test_em26_meter_control --settings=localapi.test_settings -v 2`
Expected: P1, P3, P4, C11, I7 FAIL (403 ROLE_FORBIDDEN).

- [ ] **Step 3: Implement**

`api/staff_roles.py`: add both names to `DEVICE_SCOPED`:

```python
    'set_device_auto_reboot', 'device_events', 'device_diagnostics', 'device_dashboard',
    'calibrate_meter', 'device_apn',
})
```

In the V_RW group, after `'set_device_auto_reboot', 'device_diagnostics',` add:

```python
        # Testers calibrate meters and set the APN on any device they are given (owner, 2026-10-29).
        # Accepted risk: a wrong calibration on a site meter corrupts readings; confirm dialog + audit + ops switch.
        'calibrate_meter', 'device_apn',
```

In the EMP group delete the two lines `'device_apn',  # restarts the gateway; no viewer scope needed yet` and `'calibrate_meter',  # EM26: wrong references corrupt billing-grade readings, so not viewer`.

`api/views/device_mgmt.py:79`:

```python
VIEWER_WRITABLE_DEVICE_FIELDS = frozenset({'auto_reboot_enabled', 'meter_publish_interval_ms'})
```

- [ ] **Step 4: Run, expect pass**

Run the Step 2 command, plus `tests.test_staff_roles tests.test_firmware_v2_compat`.
Expected: all PASS (the route-table test still passes: nothing new yet). Mark P1–P6 `passing` in the scenario doc.

- [ ] **Step 5: Checkpoint**

---

### Task A3: Audit site-less devices and the unaudited ops

**Files:**
- Modify: `api/services/device_audit.py`
- Modify: `api/views/device_mgmt.py` (mute, unmute, telemetry debug set/clear, toggle logs, auto reboot, update_device interval)
- Modify: `ota/views.py` (`trigger_single_device_update`, `trigger_rollback`)
- Test: `tests/test_viewer_device_tabs.py`

Action names written (all ≤ 32 chars with the `device_` prefix): `reboot`, `hard_reset`, `rollback`, `diagnostics`, `apn`, `meter_calibrate` (existing) and new `mute`, `unmute`, `telemetry_debug_on`, `telemetry_debug_off`, `logs_toggle`, `auto_reboot`, `meter_interval`. (Single OTA update and roll back are already audited in `ota/views.py` as `firmware_update` and `rollback`; found during A3, so no OTA change.)

- [ ] **Step 1: Write the failing tests** (append to `tests/test_viewer_device_tabs.py`)

```python
from api.models import SiteAuditLog


class AuditTests(TabsBase):
    def test_u1_siteless_device_is_audited(self):  # U1
        self.viewer.employeeprofile.assigned_devices.add(self.dev_free)
        with mock.patch('api.views.device_mgmt._publish_cmd_mqtt'):
            r = self.v.post(f'/api/devices/{self.dev_free.id}/reboot/')
        self.assertEqual(r.status_code, 200, r.data)
        row = SiteAuditLog.objects.get(action='device_reboot')
        self.assertEqual((row.site_id, row.payload['device_id'], row.actor), ('', self.dev_free.id, self.viewer))

    def test_u2_newly_audited_ops(self):  # U2
        e = self._as(self.employee)
        d = self.dev_a.id
        e.post(f'/api/devices/{d}/mute-alerts/', {'hours': 4}, format='json')
        e.post(f'/api/devices/{d}/unmute-alerts/')
        e.post(f'/api/devices/{d}/telemetry-debug/', {'hours': 1}, format='json')
        e.delete(f'/api/devices/{d}/telemetry-debug/')
        e.post(f'/api/devices/{d}/logs/toggle/', {'enabled': True}, format='json')
        e.patch(f'/api/devices/{d}/auto-reboot/', {'enabled': True}, format='json')
        e.patch(f'/api/devices/{self.meter.id}/', {'meter_publish_interval_ms': 10000}, format='json')
        actions = set(SiteAuditLog.objects.values_list('action', flat=True))
        self.assertTrue({'device_mute', 'device_unmute', 'device_telemetry_debug_on', 'device_telemetry_debug_off',
                         'device_logs_toggle', 'device_auto_reboot', 'device_meter_interval'} <= actions, actions)

    def test_u3_audit_failure_never_blocks_the_command(self):  # U3
        with mock.patch('api.services.device_audit.log_site_action', side_effect=RuntimeError('db down')), \
             mock.patch('api.views.device_mgmt._publish_cmd_mqtt'):
            r = self._as(self.employee).post(f'/api/devices/{self.dev_a.id}/reboot/')
        self.assertEqual(r.status_code, 200)
```

Before running, open `api/urls.py` and confirm the exact paths for mute, unmute, telemetry debug (set and clear: method and path), logs toggle, auto reboot and reboot (`grep -n "mute\|telemetry\|logs/toggle\|auto-reboot\|reboot" api/urls.py`). Fix the URLs in the test to match before Step 2.

- [ ] **Step 2: Run, expect failures**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_viewer_device_tabs.AuditTests --settings=localapi.test_settings -v 2`
Expected: U1 FAIL (no row), U2 FAIL (missing actions), U3 PASS already.

- [ ] **Step 3: Implement the helper**

`api/services/device_audit.py`, replace `audit_device_command`:

```python
def audit_device_command(user, device, action: str, **extra) -> None:
    """Best effort: a failed audit write must never block the command itself.
    Site-less (bench) devices are recorded under site_id '' (the same convention as their telemetry);
    readers find device history by payload.device_id, never by site."""
    site_id = getattr(getattr(device, 'site', None), 'site_id', None) or ''
    try:
        log_site_action(site_id, f'device_{action}', user, {'device_id': device.id, 'device_serial': device.device_serial, **extra})
    except Exception:  # noqa: BLE001
        logger.warning('audit write failed for %s on device %s', action, device.device_serial, exc_info=True)
```

Update the module docstring's first line to: `Record who sent a command to a device, with or without a site.`

- [ ] **Step 4: Add the audit calls**

In `api/views/device_mgmt.py`, add one line in each view, directly after the line that saves the change and before the view's success `return Response(`:

| View | Line to add |
|---|---|
| `mute_device_alerts` | `audit_device_command(request.user, device, 'mute', until=device.alerts_muted_until.isoformat() if device.alerts_muted_until else None)` |
| `unmute_device_alerts` | `audit_device_command(request.user, device, 'unmute')` |
| `set_device_telemetry_debug` (after `device.save(update_fields=['telemetry_debug_until'])`) | `audit_device_command(request.user, device, 'telemetry_debug_on', until=debug_until.isoformat())` |
| `clear_device_telemetry_debug` | `audit_device_command(request.user, device, 'telemetry_debug_off')` |
| `toggle_device_logs` | `audit_device_command(request.user, device, 'logs_toggle', enabled=bool(device.logs_enabled))` |
| `set_device_auto_reboot` (after `if device is None:` block) | `audit_device_command(request.user, device, 'auto_reboot', enabled=enabled)` |

In `update_device`, inside the existing interval block:

```python
        if device.meter_publish_interval_ms is not None and device.meter_publish_interval_ms != old_interval:
            device.meter_interval_confirmed_at = None
            if not em26.publish_interval(device):
                logger.warning(f"MQTT interval push failed for device {device.device_serial}")
            audit_device_command(request.user, device, 'meter_interval', interval_ms=device.meter_publish_interval_ms)
```

In `ota/views.py`, add at the top `from api.services.device_audit import audit_device_command`, and in `trigger_single_device_update` and `trigger_rollback`, after the device is resolved and the update/rollback is queued (just before the success `return Response(`):

```python
    audit_device_command(request.user, device, 'ota_update', firmware_version=getattr(firmware, 'version', None))
```

```python
    audit_device_command(request.user, device, 'ota_rollback')
```

(Use the local variable names those views already use for the device and the firmware object; read each view first.)

- [ ] **Step 5: Run, expect pass**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_viewer_device_tabs tests.test_em26_meter_control tests.test_viewer_devices_ops --settings=localapi.test_settings -v 2`
Expected: all PASS. Mark U1–U3 `passing`.

- [ ] **Step 6: Checkpoint**

---

### Task A4: Series helpers (exact buckets, gap stats, coverage, code changes)

**Files:**
- Create: `api/services/device_series.py`
- Test: `tests/test_viewer_device_tabs.py`

- [ ] **Step 1: Write the failing unit tests** (append)

```python
from datetime import datetime, timedelta, timezone as dt_tz

from django.test import SimpleTestCase

from api.services import device_series as ds

T0 = datetime(2026, 10, 29, 8, 0, tzinfo=dt_tz.utc)  # 13:30 IST


class SeriesUnitTests(SimpleTestCase):
    def test_d3_bucket_avg_min_max(self):
        rows = [(T0 + timedelta(minutes=m), {'pv1_power_w': v}) for m, v in ((0, 100), (1, 300), (2, '200'))]
        out = ds.bucket_exact(rows, 300, ds.is_measurement)
        self.assertEqual(out, [{'t': T0.isoformat(), 'pv1_power_w': 200.0, 'pv1_power_w__min': 100.0, 'pv1_power_w__max': 300.0}])

    def test_d4_codes_keep_last_value(self):
        rows = [(T0, {'fault_word_1': 4}), (T0 + timedelta(seconds=5), {'fault_word_1': 8})]
        self.assertEqual(ds.bucket_exact(rows, 300, ds.is_measurement), [{'t': T0.isoformat(), 'fault_word_1': 8.0}])

    def test_d10_day_buckets_start_at_ist_midnight(self):
        out = ds.bucket_exact([(T0, {'pv1_power_w': 1})], 86400, ds.is_measurement)
        self.assertEqual(out[0]['t'], '2026-10-28T18:30:00+00:00')

    def test_d5_gap_stats(self):
        stamps = [T0 + timedelta(seconds=2 * i) for i in range(10)]
        stamps += [stamps[-1] + timedelta(seconds=60 + 2 * i) for i in range(10)]
        g = ds.gap_stats(stamps, T0, T0 + timedelta(hours=1))
        self.assertEqual((g['median_gap_s'], g['longest_gap_s'], g['longest_gap_at']), (2.0, 60.0, stamps[9].isoformat()))

    def test_d6_d7_coverage_states(self):
        start = T0
        stamps = [start + timedelta(seconds=s) for s in range(0, 60, 2)]       # cell 0: 30 of 30 expected
        stamps += [start + timedelta(seconds=60 + s) for s in range(0, 60, 4)]  # cell 1: 15 of 30
        cov = ds.gap_stats(stamps, start, start + timedelta(hours=1))['coverage']
        self.assertEqual((len(cov), cov[0], cov[1], cov[2]), (60, 'full', 'partial', 'empty'))

    def test_gap_stats_no_rows(self):
        g = ds.gap_stats([], T0, T0 + timedelta(hours=1))
        self.assertEqual((g['median_gap_s'], g['longest_gap_s'], g['coverage'][0]), (None, None, 'empty'))

    def test_d8_code_changes(self):
        rows = [(T0 + timedelta(seconds=i), {'fault_word_1': v}) for i, v in enumerate((0, 0, 4, 4, 0))]
        self.assertEqual(ds.code_changes(rows), [
            {'t': (T0 + timedelta(seconds=2)).isoformat(), 'key': 'fault_word_1', 'value': 4.0},
            {'t': (T0 + timedelta(seconds=4)).isoformat(), 'key': 'fault_word_1', 'value': 0.0}])

    def test_k2_decode_message(self):
        import base64, zlib
        text = '{"a": 1}'
        self.assertEqual(ds.decode_message(text.encode()), {'text': text, 'hex': None})
        packed = base64.b64encode(zlib.compress(text.encode()))
        self.assertEqual(ds.decode_message(packed), {'text': text, 'hex': None})
        self.assertEqual(ds.decode_message(b'\xff\x00'), {'text': None, 'hex': 'ff00'})
```

- [ ] **Step 2: Run, expect ImportError**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_viewer_device_tabs.SeriesUnitTests --settings=localapi.test_settings -v 2`
Expected: FAIL, `cannot import name 'device_series'`.

- [ ] **Step 3: Implement** `api/services/device_series.py`

```python
"""Per-device series for the device dashboard: exact buckets, reporting-gap stats, code changes,
and decoding of stored MQTT messages. Pure functions over (timestamp, {key: value}) rows."""
import base64
import binascii
import re
import statistics
import zlib
from datetime import datetime, timedelta, timezone as dt_tz

# Gateway keys averaged per bucket (measurements, by unit suffix); the rest (energy counters,
# fault/warning words, modes) keep the bucket's last value: an average of a code means nothing.
AVG_SUFFIXES = ('_w', '_v', '_a', '_hz', '_c', '_va', '_percent', '_factor')
# Meter columns are all measurements.
METER_PREFIXES = ('voltage_', 'current_', 'frequency_', 'active_power_', 'reactive_power_', 'apparent_power_', 'power_factor_')
CODE_KEY = re.compile(r'(fault|warning)_(word|code)')
IST_ORIGIN = datetime(2000, 1, 1, tzinfo=dt_tz(timedelta(hours=5, minutes=30)))  # hour/day buckets start on IST boundaries


def is_measurement(key: str) -> bool:
    return key.endswith(AVG_SUFFIXES) or key.startswith(METER_PREFIXES)


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def bucket_exact(rows, seconds: int, averaged):
    """[(ts, {key: value})] -> one point per `seconds` bucket, oldest first. Measurements get the
    mean plus `<key>__min` / `<key>__max`; other keys the bucket's last value. Non-numbers are skipped."""
    out = {}
    for ts, vals in rows:
        b = IST_ORIGIN + timedelta(seconds=(ts - IST_ORIGIN).total_seconds() // seconds * seconds)
        acc = out.setdefault(b, {})
        for k, raw in vals.items():
            v = _num(raw)
            if v is None:
                continue
            if averaged(k):
                a = acc.get(k)
                if a is None:
                    acc[k] = [v, 1, v, v]
                else:
                    a[0] += v
                    a[1] += 1
                    a[2] = min(a[2], v)
                    a[3] = max(a[3], v)
            else:
                acc[k] = v
    points = []
    for b, acc in sorted(out.items()):
        p = {'t': b.astimezone(dt_tz.utc).isoformat()}
        for k, a in acc.items():
            if isinstance(a, list):
                p[k], p[f'{k}__min'], p[f'{k}__max'] = round(a[0] / a[1], 3), a[2], a[3]
            else:
                p[k] = a
        points.append(p)
    return points


def every(rows):
    """[(ts, {key: value})] -> [{'t', key: number}] with non-numbers dropped."""
    return [{'t': ts.isoformat(), **{k: n for k, v in vals.items() if (n := _num(v)) is not None}} for ts, vals in rows]


def gap_stats(stamps, start, end, cells: int = 60) -> dict:
    """Sorted reading timestamps -> median gap (robust to one outage), longest gap and when it began,
    and `cells` coverage states: full (>= 80% of the readings expected at the median interval), partial, empty."""
    gaps = [(b - a).total_seconds() for a, b in zip(stamps, stamps[1:])]
    median = statistics.median(gaps) if gaps else None
    longest, longest_at = max(zip(gaps, stamps), key=lambda g: g[0]) if gaps else (None, None)
    span = (end - start).total_seconds() / cells
    counts = [0] * cells
    for s in stamps:
        counts[min(cells - 1, max(0, int((s - start).total_seconds() // span)))] += 1
    expected = span / median if median else None
    coverage = ['empty' if c == 0 else 'full' if not expected or c >= 0.8 * expected else 'partial' for c in counts]
    return {'median_gap_s': median, 'longest_gap_s': longest,
            'longest_gap_at': longest_at.isoformat() if longest_at else None, 'coverage': coverage}


def code_changes(rows, limit: int = 50):
    """[(ts, {code_key: value})] oldest first -> where each code changed (not its first value)."""
    prev, out = {}, []
    for ts, vals in rows:
        for k, raw in vals.items():
            v = _num(raw)
            if v is None:
                continue
            if k in prev and prev[k] != v:
                out.append({'t': ts.isoformat(), 'key': k, 'value': v})
            prev[k] = v
    return out[-limit:]


def decode_message(raw: bytes) -> dict:
    """Stored MQTT bytes -> {'text'} when readable (plain or base64+zlib), else {'hex'}."""
    raw = bytes(raw)
    # base64+zlib first: a packed message is also valid ASCII, so plain text must be the fallback.
    for attempt in (lambda b: zlib.decompress(base64.b64decode(b, validate=True)), lambda b: b):
        try:
            return {'text': attempt(raw).decode('utf-8'), 'hex': None}
        except (UnicodeDecodeError, binascii.Error, zlib.error, ValueError):
            continue
    return {'text': None, 'hex': raw.hex()}
```

- [ ] **Step 4: Run, expect pass**

Run the Step 2 command. Expected: 8 PASS. Mark D3–D8, D10, K2 `written`/`passing` as they pass.

- [ ] **Step 5: Checkpoint**

---

### Task A5: Dashboard `detail` mode

**Files:**
- Modify: `api/views/device_mgmt.py` (`device_dashboard`, ~line 1219)
- Test: `tests/test_viewer_device_tabs.py`

Without `detail` the endpoint answers exactly as today (the current All values tab and its tests keep working). With `detail`, it returns `series` for the requested keys plus gap stats.

- [ ] **Step 1: Write the failing tests** (append)

```python
from datetime import timedelta as td

from api.models.telemetry import TelemetryRaw


class DashboardDetailTests(TabsBase):
    def setUp(self):
        super().setUp()
        self.e = self._as(self.employee)
        self.end = timezone.now().replace(microsecond=0)

    def _rows(self, offsets_s, **vals):
        for s in offsets_s:
            TelemetryRaw.objects.create(device=self.dev_a, site_id='sr_a', timestamp=self.end - td(seconds=s),
                                        payload={}, normalised={k: (v(s) if callable(v) else v) for k, v in vals.items()})

    def _get(self, q):
        return self.e.get(f'/api/devices/{self.dev_a.id}/dashboard/?{q}')

    def test_d1_legacy_unchanged(self):
        self._rows([0, 10], pv1_power_w=100)
        data = self._get('hours=24').data
        self.assertIn('history', data)
        self.assertNotIn('series', data)

    def test_d2_detail_not_allowed_for_range(self):
        r = self._get('hours=6&detail=every')
        self.assertEqual((r.status_code, r.data.get('code')), (400, 'INVALID_DETAIL'))

    def test_d9_too_many_keys(self):
        r = self._get('hours=1&detail=1m&keys=' + ','.join(f'k{i}' for i in range(9)))
        self.assertEqual((r.status_code, r.data.get('code')), (400, 'TOO_MANY_KEYS'))

    def test_d5_every_reading_and_gap_stats(self):
        self._rows([0, 2, 4, 64, 66, 68], pv1_power_w=lambda s: s)
        data = self._get('hours=1&detail=every&keys=pv1_power_w').data
        self.assertEqual(len(data['series']), 6)
        self.assertEqual((data['median_gap_s'], data['longest_gap_s']), (2.0, 60.0))
        self.assertEqual(len(data['coverage']), 60)
        self.assertEqual(data['detail'], 'every')

    def test_d3_bucketed_series_is_exact(self):
        with mock.patch('api.views.device_mgmt._SAMPLE_ROWS', 1):  # the detail path must not sample
            self._rows([5, 65, 125], pv1_power_w=lambda s: s)
            data = self._get('hours=1&detail=5m&keys=pv1_power_w').data
        vals = [p for p in data['series'] if 'pv1_power_w' in p]
        self.assertEqual((min(p['pv1_power_w__min'] for p in vals), max(p['pv1_power_w__max'] for p in vals)), (5.0, 125.0))
        self.assertEqual(data['sampled_every'], 1)

    def test_d8_code_changes_in_response(self):
        self._rows([4, 3, 2, 1, 0], fault_word_1=lambda s: 4 if s in (2, 1) else 0)
        data = self._get('hours=1&detail=every&keys=fault_word_1').data
        self.assertEqual([c['value'] for c in data['code_changes']], [4.0, 0.0])
```

- [ ] **Step 2: Run, expect failures**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_viewer_device_tabs.DashboardDetailTests --settings=localapi.test_settings -v 2`
Expected: D2, D9, D5, D3, D8 FAIL (no `series` / no 400).

- [ ] **Step 3: Implement**

At the top of `device_mgmt.py` (with the other service imports): `from api.services import device_series`.

Next to `_SAMPLE_ROWS`, add:

```python
# Detail levels each range offers (spec §5.3): a chart never asks for 288k points or for one point.
_DETAIL_SECONDS = {'every': 0, '1m': 60, '5m': 300, '1h': 3600, '1d': 86400}
_DETAIL_ALLOWED = {1: ('every', '1m', '5m'), 6: ('1m', '5m'), 24: ('5m', '1h'), 48: ('5m', '1h'), 168: ('1h', '1d')}
_MAX_SERIES_KEYS = 8
```

In `device_dashboard`, right after `latest`/`last_at`/`end`/`start` are computed and before `minutes = ...`, insert:

```python
    detail = request.query_params.get('detail')
    if detail is not None:
        return _dashboard_detail(request, device, base, meter, latest, last_at, start, end, hours, detail)
```

Add the helper above `device_dashboard`:

```python
def _dashboard_detail(request, device, base, meter, latest, last_at, start, end, hours, detail):
    """The device page's Overview: exact series for <= 8 keys at one detail level, plus reporting stats.
    Exact, not sampled: only the requested keys are read (KeyTextTransform on gateways)."""
    from django.db.models.fields.json import KeyTextTransform

    if detail not in _DETAIL_ALLOWED.get(hours, ()):
        return error_response(f'detail must be one of {list(_DETAIL_ALLOWED.get(hours, ()))} for hours={hours}',
                              status.HTTP_400_BAD_REQUEST, code='INVALID_DETAIL')
    keys = [k for k in (request.query_params.get('keys') or '').split(',') if k]
    if len(keys) > _MAX_SERIES_KEYS:
        return error_response(f'at most {_MAX_SERIES_KEYS} keys', status.HTTP_400_BAD_REQUEST, code='TOO_MANY_KEYS')

    window = base.filter(timestamp__gt=start, timestamp__lte=end).order_by('timestamp')
    code_keys = [] if meter else sorted(k for k in (latest or {}) if device_series.CODE_KEY.search(k))

    def rows(wanted):
        if not wanted:
            return iter(())
        if meter:
            cols = [k for k in wanted if k in _METER_FIELDS]
            return ((r[0], dict(zip(cols, r[1:]))) for r in window.values_list('timestamp', *cols).iterator(chunk_size=5000))
        ann = {f'_k{i}': KeyTextTransform(k, 'normalised') for i, k in enumerate(wanted)}
        return ((r[0], dict(zip(wanted, r[1:])))
                for r in window.annotate(**ann).values_list('timestamp', *ann).iterator(chunk_size=5000))

    # ponytail: Python over raw rows (7 d of a 2 s gateway is ~300k small rows); a per-device
    # continuous aggregate is the upgrade if this gets slow (spec §10).
    seconds = _DETAIL_SECONDS[detail]
    series = device_series.every(rows(keys)) if not seconds else device_series.bucket_exact(rows(keys), seconds, device_series.is_measurement)
    stamps = list(window.values_list('timestamp', flat=True))
    return Response({
        'device_id': device.id, 'serial': device.device_serial, 'device_type': device.device_type,
        'site_id': device.site.site_id if device.site else None,
        'is_online': device.is_online(),
        'last_heartbeat': device.last_heartbeat.isoformat() if device.last_heartbeat else None,
        'firmware_version': device.firmware_version or None,
        'last_reading_at': last_at.isoformat() if last_at else None,
        'range_start': start.isoformat(), 'range_end': end.isoformat(),
        'detail': detail, 'keys': keys, 'sampled_every': 1,
        'latest': latest, 'series': series,
        **device_series.gap_stats(stamps, start, end),
        'code_changes': device_series.code_changes(rows(code_keys)),
    })
```

Update the `device_dashboard` docstring: add `?detail=every|1m|5m|1h|1d&keys=a,b (<= 8): the Overview mode, see _dashboard_detail. Without detail: the legacy all-keys history (All values tab).`

- [ ] **Step 4: Run, expect pass**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_viewer_device_tabs tests.test_viewer_assigned_devices --settings=localapi.test_settings -v 2`
Expected: all PASS (legacy D1–D6 in `test_viewer_assigned_devices` unchanged). Mark D1–D9 `passing`.

- [ ] **Step 5: Checkpoint**

---

### Task A6: Readings and packet endpoints

**Files:**
- Create: `api/views/device_detail.py`
- Modify: `api/views/__init__.py`, `api/urls.py`, `api/staff_roles.py`
- Test: `tests/test_viewer_device_tabs.py`

- [ ] **Step 1: Write the failing tests** (append)

```python
from api.models import EnergyMeterReading
from api.models.telemetry import TelemetryRawPayload


class ReadingsTests(TabsBase):
    def setUp(self):
        super().setUp()
        self.e = self._as(self.employee)
        self.now = timezone.now()
        TelemetryRaw.objects.bulk_create([
            TelemetryRaw(device=self.dev_a, site_id='sr_a', timestamp=self.now - td(seconds=2 * i),
                         payload={'pv1_power_w': i}, normalised={'pv1_power_w': i, 'grid_power_w': -i})
            for i in range(150)])

    def test_r1_first_page(self):
        data = self.e.get(f'/api/devices/{self.dev_a.id}/readings/').data
        self.assertEqual(len(data['rows']), 100)
        self.assertEqual(data['rows'][0]['values']['pv1_power_w'], 0)
        self.assertEqual(data['next_before'], data['rows'][-1]['t'])

    def test_r2_before_cursor(self):
        first = self.e.get(f'/api/devices/{self.dev_a.id}/readings/').data
        from urllib.parse import quote
        page2 = self.e.get(f'/api/devices/{self.dev_a.id}/readings/?before={quote(first["next_before"])}').data
        self.assertEqual(len(page2['rows']), 50)
        self.assertEqual(page2['rows'][0]['values']['pv1_power_w'], 100)

    def test_r3_keys(self):
        row = self.e.get(f'/api/devices/{self.dev_a.id}/readings/?keys=grid_power_w&limit=1').data['rows'][0]
        self.assertEqual(row['values'], {'grid_power_w': 0})

    def test_r4_meter(self):
        EnergyMeterReading.objects.create(device=self.meter, site_id='sr_a', node_id='0', timestamp=self.now,
                                          source='mqtt', raw_payload={'raw': 'SRMTR1^1^0^V:231'}, voltage_l1=231.0)
        row = self.e.get(f'/api/devices/{self.meter.id}/readings/').data['rows'][0]
        self.assertEqual(row['values']['voltage_l1'], 231.0)

    def test_r5_viewer_scope(self):
        self.assertFalse(_role_denied(self.v.get(f'/api/devices/{self.dev_a.id}/readings/')))
        self.assertTrue(_role_denied(self.v.get(f'/api/devices/{self.dev_b.id}/readings/')))

    def test_k1_gateway_packet(self):
        row = TelemetryRaw.objects.filter(device=self.dev_a).order_by('-timestamp').first()
        msg = TelemetryRawPayload.objects.create(device_serial='SRDEVA', size_bytes=8, payload=b'{"a": 1}')
        TelemetryRawPayload.objects.filter(pk=msg.pk).update(received_at=row.received_at + td(seconds=1))
        data = self.e.get(f'/api/devices/{self.dev_a.id}/readings/{row.id}/packet/').data
        self.assertEqual((data['kind'], data['reading'], data['message']['text']), ('gateway', {'pv1_power_w': 0}, '{"a": 1}'))

    def test_k3_pruned_message(self):
        row = TelemetryRaw.objects.filter(device=self.dev_a).first()
        TelemetryRaw.objects.filter(pk=row.pk).update(received_at=self.now - td(days=15))
        data = self.e.get(f'/api/devices/{self.dev_a.id}/readings/{row.id}/packet/').data
        self.assertEqual((data['message'], data['message_note']), (None, 'pruned'))

    def test_k4_meter_packet(self):
        r = EnergyMeterReading.objects.create(device=self.meter, site_id='sr_a', node_id='0', timestamp=self.now,
                                              source='mqtt', raw_payload={'raw': 'SRMTR1^1^0^V:231'}, voltage_l1=231.0)
        data = self.e.get(f'/api/devices/{self.meter.id}/readings/{r.id}/packet/').data
        self.assertEqual((data['kind'], data['raw']), ('meter', 'SRMTR1^1^0^V:231'))

    def test_k5_other_devices_reading_is_404(self):
        row = TelemetryRaw.objects.filter(device=self.dev_a).first()
        self.assertEqual(self.e.get(f'/api/devices/{self.dev_b.id}/readings/{row.id}/packet/').status_code, 404)
```

- [ ] **Step 2: Run, expect 404s**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_viewer_device_tabs.ReadingsTests --settings=localapi.test_settings -v 2`
Expected: FAIL (routes don't exist).

- [ ] **Step 3: Implement** `api/views/device_detail.py`

```python
"""Device page reads for testers: every reading (paged), the packet behind a reading, operation history.
Spec: smart-solar-react-frontend/docs/superpowers/specs/2026-10-29-viewer-portal-redesign-design.md §5.3, §6.4."""
from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response

from api.permissions import IsStaffUser
from api.services import device_series
from api.throttles import AuthenticatedApiThrottle
from api.views._shared import error_response
from api.views.device_mgmt import _METER_FIELDS, _get_device_or_404

_PAGE = 100
_MAX_PAGE = 500
_MESSAGE_MATCH = timedelta(seconds=2)
_RAW_PAYLOAD_DAYS = 14  # RAW_PAYLOAD_RETENTION_DAYS: older messages may have been pruned


def _scalar(v):
    return isinstance(v, (int, float, str, bool))


def _base(device):
    from api.models import EnergyMeterReading, TelemetryRaw
    if device.device_type == 'energy_meter':
        return EnergyMeterReading.objects.filter(device=device), True
    return TelemetryRaw.objects.filter(device=device, normalised__isnull=False), False


@api_view(['GET'])
@permission_classes([IsStaffUser])
@throttle_classes([AuthenticatedApiThrottle])
def device_readings(request, device_id):
    """GET ?before=<iso>&limit=100&keys=a,b: raw readings newest first (every reading, no averaging)."""
    device, err = _get_device_or_404(device_id)
    if err:
        return err
    try:
        limit = max(1, min(_MAX_PAGE, int(request.query_params.get('limit', _PAGE))))
    except ValueError:
        return error_response('limit must be an integer', status.HTTP_400_BAD_REQUEST, code='INVALID_LIMIT')
    qs, meter = _base(device)
    before = request.query_params.get('before')
    if before:
        try:
            qs = qs.filter(timestamp__lt=datetime.fromisoformat(before.replace('Z', '+00:00')))
        except ValueError:
            return error_response('before must be an ISO datetime', status.HTTP_400_BAD_REQUEST, code='INVALID_BEFORE')
    keys = [k for k in (request.query_params.get('keys') or '').split(',') if k]
    qs = qs.order_by('-timestamp')[:limit]
    if meter:
        cols = [k for k in (keys or _METER_FIELDS) if k in _METER_FIELDS]
        rows = [{'id': r[0], 't': r[1].isoformat(), 'values': {k: v for k, v in zip(cols, r[2:]) if v is not None}}
                for r in qs.values_list('id', 'timestamp', *cols)]
    else:
        rows = [{'id': i, 't': ts.isoformat(), 'received_at': rec.isoformat(),
                 'values': {k: v for k, v in (n or {}).items() if _scalar(v) and (not keys or k in keys)}}
                for i, ts, rec, n in qs.values_list('id', 'timestamp', 'received_at', 'normalised')]
    return Response({'device_id': device.id, 'rows': rows,
                     'next_before': rows[-1]['t'] if len(rows) == limit else None})


@api_view(['GET'])
@permission_classes([IsStaffUser])
@throttle_classes([AuthenticatedApiThrottle])
def device_reading_packet(request, device_id, reading_id):
    """GET: what the device sent for one reading. Gateway: the reading as sent (exact) plus the closest
    stored MQTT message (best effort, within 2 s of receipt). Meter: the original caret-delimited message."""
    from api.models.telemetry import TelemetryRawPayload

    device, err = _get_device_or_404(device_id)
    if err:
        return err
    qs, meter = _base(device)
    row = qs.filter(pk=reading_id).first()
    if row is None:
        return error_response('Reading not found on this device', status.HTTP_404_NOT_FOUND)
    if meter:
        return Response({'kind': 'meter', 'reading_time': row.timestamp.isoformat(),
                         'raw': (row.raw_payload or {}).get('raw'),
                         'parsed': {k: getattr(row, k) for k in _METER_FIELDS if getattr(row, k) is not None}})
    near = TelemetryRawPayload.objects.filter(device_serial=device.device_serial,
                                              received_at__gte=row.received_at - _MESSAGE_MATCH,
                                              received_at__lte=row.received_at + _MESSAGE_MATCH)
    msg = min(near, key=lambda m: abs((m.received_at - row.received_at).total_seconds()), default=None)
    message, note = None, None
    if msg:
        message = {'received_at': msg.received_at.isoformat(), 'size_bytes': msg.size_bytes,
                   **device_series.decode_message(msg.payload)}
    else:
        note = 'pruned' if timezone.now() - row.received_at > timedelta(days=_RAW_PAYLOAD_DAYS) else 'not_found'
    return Response({'kind': 'gateway', 'reading_time': row.timestamp.isoformat(),
                     'received_at': row.received_at.isoformat(), 'reading': row.payload,
                     'message': message, 'message_note': note})
```

If `error_response` is not importable from `api.views._shared`, import it from where `device_mgmt.py` gets it (`grep -n "error_response" api/views/device_mgmt.py | head -2`).

`api/views/__init__.py`: add

```python
from .device_detail import device_operations, device_reading_packet, device_readings
```

(`device_operations` arrives in Task A7; add it to this import then, or add the import line in A7.)

`api/urls.py`, after the `device_dashboard` path:

```python
	path("devices/<int:device_id>/readings/", views.device_readings, name="device_readings"),
	path("devices/<int:device_id>/readings/<int:reading_id>/packet/", views.device_reading_packet, name="device_reading_packet"),
```

`api/staff_roles.py`: add `'device_readings', 'device_reading_packet'` to `DEVICE_SCOPED` and to the V_RO list (after `'device_dashboard',`).

- [ ] **Step 4: Run, expect pass**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_viewer_device_tabs tests.test_staff_roles --settings=localapi.test_settings -v 2`
Expected: all PASS (route table includes the new names). Mark R1–R5, K1, K3–K5 `passing`.

- [ ] **Step 5: Checkpoint**

---

### Task A7: Operations endpoint with confirmation states

**Files:**
- Modify: `api/views/device_detail.py`, `api/views/__init__.py`, `api/urls.py`, `api/staff_roles.py`
- Test: `tests/test_viewer_device_tabs.py`

- [ ] **Step 1: Write the failing tests** (append)

```python
from api.models import DeviceEvent, DeviceHeartbeat
from api.site_lifecycle import log_site_action


class OperationsTests(TabsBase):
    def _audit(self, device, action, minutes_ago, **extra):
        log_site_action(device.site.site_id if device.site else '', f'device_{action}', self.viewer,
                        {'device_id': device.id, 'device_serial': device.device_serial, **extra})
        SiteAuditLog.objects.filter(action=f'device_{action}').update(created_at=timezone.now() - td(minutes=minutes_ago))

    def _ops(self, device):
        data = self._as(self.employee).get(f'/api/devices/{device.id}/operations/').data
        return {o['op']: o for o in data['ops']}, data

    def test_o1_no_records(self):
        ops, _ = self._ops(self.dev_a)
        self.assertEqual(list(ops), ['reboot', 'mute', 'auto_reboot', 'fetch_logs', 'telemetry_debug', 'diagnostics',
                                     'ota_update', 'rollback', 'apn', 'hard_reset'])
        self.assertTrue(all(o['state'] == 'no_record' for o in ops.values()))

    def test_o2_reboot_not_confirmed(self):
        Device.objects.filter(pk=self.dev_a.pk).update(pending_reboot=True)
        self._audit(self.dev_a, 'reboot', 6)
        self.assertEqual(self._ops(self.dev_a)[0]['reboot']['state'], 'not_confirmed')

    def test_o3_reboot_confirmed_by_heartbeat(self):
        self._audit(self.dev_a, 'reboot', 3)
        hb = DeviceHeartbeat.objects.create(device=self.dev_a, received_at=timezone.now() - td(minutes=2))
        op = self._ops(self.dev_a)[0]['reboot']
        self.assertEqual((op['state'], op['confirmed_at']), ('confirmed', hb.received_at.isoformat()))

    def test_o4_meter_calibration_confirmed(self):
        self._audit(self.meter, 'meter_calibrate', 3)
        Device.objects.filter(pk=self.meter.pk).update(meter_calibration_confirmed_at=timezone.now() - td(minutes=1))
        self.assertEqual(self._ops(self.meter)[0]['meter_calibrate']['state'], 'confirmed')

    def test_o5_diagnostics_confirmed(self):
        self._audit(self.dev_a, 'diagnostics', 3)
        DeviceEvent.objects.create(device=self.dev_a, event='diag', payload={})
        self.assertEqual(self._ops(self.dev_a)[0]['diagnostics']['state'], 'confirmed')

    def test_o6_mute_is_sent(self):
        self._audit(self.dev_a, 'mute', 1)
        self.assertEqual(self._ops(self.dev_a)[0]['mute']['state'], 'sent')

    def test_o7_apn_confirmed_by_later_heartbeat(self):
        self._audit(self.dev_a, 'apn', 2, apn='airtelgprs.com')
        DeviceHeartbeat.objects.create(device=self.dev_a, received_at=timezone.now() - td(seconds=60))
        self.assertEqual(self._ops(self.dev_a)[0]['apn']['state'], 'confirmed')

    def test_o8_meter_ops_only(self):
        self.assertEqual(list(self._ops(self.meter)[0]),
                         ['reboot', 'meter_interval', 'meter_calibrate', 'ota_update', 'hard_reset'])

    def test_o9_recent_capped_newest_first(self):
        for i in range(25):
            log_site_action('sr_a', 'device_mute', self.viewer, {'device_id': self.dev_a.id})
        recent = self._ops(self.dev_a)[1]['recent']
        self.assertEqual(len(recent), 20)
        self.assertGreaterEqual(recent[0]['at'], recent[-1]['at'])

    def test_viewer_scope(self):
        self.assertTrue(_role_denied(self.v.get(f'/api/devices/{self.dev_b.id}/operations/')))
```

- [ ] **Step 2: Run, expect 404s**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_viewer_device_tabs.OperationsTests --settings=localapi.test_settings -v 2`
Expected: FAIL.

- [ ] **Step 3: Implement** (append to `api/views/device_detail.py`)

```python
# Ops each device type supports, in display order, and the audit actions that count as running them.
GATEWAY_OPS = ('reboot', 'mute', 'auto_reboot', 'fetch_logs', 'telemetry_debug', 'diagnostics',
               'ota_update', 'rollback', 'apn', 'hard_reset')
METER_OPS = ('reboot', 'meter_interval', 'meter_calibrate', 'ota_update', 'hard_reset')
OP_ACTIONS = {
    'reboot': ('device_reboot',), 'hard_reset': ('device_hard_reset',), 'mute': ('device_mute', 'device_unmute'),
    'auto_reboot': ('device_auto_reboot',), 'fetch_logs': ('device_logs_toggle',),
    'telemetry_debug': ('device_telemetry_debug_on', 'device_telemetry_debug_off'),
    'diagnostics': ('device_diagnostics',), 'ota_update': ('device_firmware_update',),
    'rollback': ('device_rollback',), 'apn': ('device_apn',),
    'meter_calibrate': ('device_meter_calibrate',), 'meter_interval': ('device_meter_interval',),
}
ACTION_OP = {a: op for op, actions in OP_ACTIONS.items() for a in actions}
_LATE = timedelta(minutes=5)
_APN_RESTART = timedelta(seconds=20)


def _actor(user):
    return {'id': user.id, 'name': user.get_full_name() or user.username} if user else None


def _confirmation(device, op, at):
    """(state, confirmed_at) from the signals that exist (spec §6.5). States: confirmed, waiting,
    not_confirmed, failed, sent (no signal exists for this op)."""
    from api.models import DeviceEvent, DeviceHeartbeat, DeviceLogFile
    from ota.models import DeviceUpdateLog

    late = timezone.now() - at > _LATE
    waiting = ('not_confirmed' if late else 'waiting', None)

    def first_heartbeat(after):
        hb = DeviceHeartbeat.objects.filter(device=device, received_at__gt=after).order_by('received_at').first()
        return hb.received_at if hb else None

    if op in ('reboot', 'hard_reset'):
        if device.pending_reboot if op == 'reboot' else device.pending_hard_reset:
            return waiting
        seen = first_heartbeat(at)
        return ('confirmed', seen) if seen else waiting
    if op == 'apn':
        # ponytail: no ACK reaches the backend; the gateway restarts, so a heartbeat >= 20 s later is the signal.
        seen = first_heartbeat(at + _APN_RESTART)
        return ('confirmed', seen) if seen else waiting
    if op in ('meter_calibrate', 'meter_interval'):
        done = device.meter_calibration_confirmed_at if op == 'meter_calibrate' else device.meter_interval_confirmed_at
        return ('confirmed', done) if done and done > at else ('waiting', None)
    if op == 'diagnostics':
        ev = DeviceEvent.objects.filter(device=device, event='diag', received_at__gt=at).order_by('received_at').first()
        return ('confirmed', ev.received_at) if ev else waiting
    if op == 'fetch_logs':
        lf = DeviceLogFile.objects.filter(device=device, uploaded_at__gt=at).order_by('uploaded_at').first()
        return ('confirmed', lf.uploaded_at) if lf else ('waiting', None)
    if op in ('ota_update', 'rollback'):
        log = DeviceUpdateLog.objects.filter(device=device).order_by('-id').first()
        if log and log.status == 'completed' and log.completed_at and log.completed_at > at:
            return ('confirmed', log.completed_at)
        if log and log.status == 'failed' and (log.completed_at or log.started_at or at) >= at:
            return ('failed', log.completed_at)
        return ('waiting', None)
    return ('sent', None)


@api_view(['GET'])
@permission_classes([IsStaffUser])
@throttle_classes([AuthenticatedApiThrottle])
def device_operations(request, device_id):
    """GET: each operation this device type supports with its last run and confirmation state, plus the
    last 20 runs. Ops run before audit coverage (2026-10-29) show 'no_record', not 'never run'."""
    from api.models import SiteAuditLog

    device, err = _get_device_or_404(device_id)
    if err:
        return err
    names = METER_OPS if device.device_type == 'energy_meter' else GATEWAY_OPS
    rows = list(SiteAuditLog.objects.filter(payload__device_id=device.id, action__in=list(ACTION_OP))
                .select_related('actor').order_by('-created_at')[:200])
    last = {}
    for r in rows:
        last.setdefault(ACTION_OP[r.action], r)
    ops = []
    for op in names:
        r = last.get(op)
        if r is None:
            ops.append({'op': op, 'state': 'no_record', 'last': None, 'confirmed_at': None})
            continue
        state, confirmed_at = _confirmation(device, op, r.created_at)
        values = {k: v for k, v in r.payload.items() if k not in ('device_id', 'device_serial')}
        ops.append({'op': op, 'state': state, 'confirmed_at': confirmed_at.isoformat() if confirmed_at else None,
                    'last': {'at': r.created_at.isoformat(), 'action': r.action[len('device_'):],
                             'actor': _actor(r.actor), 'values': values}})
    recent = [{'at': r.created_at.isoformat(), 'op': ACTION_OP[r.action], 'action': r.action[len('device_'):],
               'actor': _actor(r.actor)} for r in rows[:20]]
    return Response({'device_id': device.id, 'device_type': device.device_type, 'ops': ops, 'recent': recent})
```

`payload__device_id` is a JSON lookup; it works on SQLite (JSON1) and Postgres. If it errors on SQLite in tests, filter by `action__in` and `site_id` candidates then filter `r.payload.get('device_id') == device.id` in Python (cap 1,000 rows), and add a `ponytail:` comment.

Wire it: `api/views/__init__.py` imports `device_operations`; `api/urls.py`:

```python
	path("devices/<int:device_id>/operations/", views.device_operations, name="device_operations"),
```

`api/staff_roles.py`: `'device_operations'` into `DEVICE_SCOPED` and the V_RO list.

- [ ] **Step 4: Run, expect pass**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_viewer_device_tabs tests.test_staff_roles --settings=localapi.test_settings -v 2`
Expected: all PASS. Mark O1–O9 `passing`.

- [ ] **Step 5: Checkpoint**

---

### Task A8: Docstring fix and full backend suite

**Files:**
- Modify: `api/models/telemetry.py` (`TelemetryRawPayload` docstring)

- [ ] **Step 1: Replace** `in the request path; reparse from here. No retention yet (decision pending).` with:

```python
    in the request path except the device page's packet view (closest message to a reading);
    reparse from here. Pruned by prune_raw_payloads(): 14 days once the site's day is in S3,
    28 days regardless (site-less devices are never exported, so theirs go at 28).
```

- [ ] **Step 2: Run the whole suite**

Run: `PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests --settings=localapi.test_settings`
Expected: all PASS. Run `ruff check api tests` (if configured) and fix findings in the new files only.

- [ ] **Step 3: Checkpoint** (owner commits and deploys the backend; the old frontend keeps working because the legacy dashboard path is unchanged).

---

# Part B: frontend

### Task B1: Frontend test scenario doc

**Files:**
- Create: `docs/test-scenarios/viewer-device-tabs.md` (frontend repo)

- [ ] **Step 1: Write the doc**

```markdown
# Viewer device tabs (phase 1): frontend

Spec: docs/superpowers/specs/2026-10-29-viewer-portal-redesign-design.md (§5.0, §5.3).
Tests: src/features/staff/viewer/__tests__/deviceChart.test.ts, DeviceDashboard.test.tsx, ReadingsTab.test.tsx, OperationsTab.test.tsx.

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| T1 | Tabs | /devices/47/dashboard | open | Overview selected; tabs Overview, All values, Every reading, Operations | unit | P0 | planned |
| T2 | Tabs | ?tab=readings | open | Every reading selected; clicking Operations sets ?tab=ops | unit | P0 | planned |
| T3 | Tabs | ?tab=values | open | legacy sections render (Solar, Grid, Status and codes) | unit | P0 | planned |
| C1 | Detail | range 6 h | render detail buttons | only Per minute and 5 min | unit | P0 | planned |
| C2 | Detail | detail Every reading, switch range to 24 h | — | detail becomes 5 min | unit | P0 | planned |
| C3 | Ticks | lo 1.2 hi 1.6, zero | niceTicks | 0, 0.5, 1, 1.5, 2 | unit | P1 | planned |
| C4 | Segments | points 2 s apart with a 60 s hole, max gap 6 s | segments | two segments | unit | P0 | planned |
| C5 | Colours | names R, Y, B | colorsFor | red, ochre, blue tokens | unit | P2 | planned |
| C6 | Chart | bucketed series with __min/__max | render | spread band path present; readout shows "(lo to hi)" | unit | P1 | planned |
| C7 | Chart | coverage full/partial/empty | render | three cell shapes (full height, half height, amber) | unit | P1 | planned |
| C8 | Chart | code_changes has 0x0004 | render | codes lane label "Fault 0x0004 at …" | unit | P2 | planned |
| R1 | Readings | page of rows with one 60 s hole, median 2 s | render | a row "No readings for 1 min 0 s" | unit | P0 | planned |
| R2 | Readings | next_before set | click Older | fetch with before | unit | P1 | planned |
| R3 | Readings | click a row | — | packet panel opens beside the table with reading JSON | unit | P0 | planned |
| R4 | Readings | packet message null, note pruned | open | "The whole message is older than 14 days and has been removed." | unit | P1 | planned |
| R5 | Readings | meter packet | open | raw caret string shown | unit | P1 | planned |
| R6 | Readings | fault word non-zero | render | row tinted, code shown as 0x0004 (no ligature) | unit | P2 | planned |
| O1 | Operations | state no_record | render | "No record yet" | unit | P0 | planned |
| O2 | Operations | state not_confirmed | render | warning text "Not confirmed after 5 min" | unit | P0 | planned |
| O3 | Operations | state confirmed by you | render | "Confirmed … by you" | unit | P1 | planned |
| O4 | Operations | no device_control | render | statuses show, no action buttons | unit | P0 | planned |
| O5 | Operations | meter + device_control | render | meter calibration and interval controls visible | unit | P1 | planned |
| O6 | Operations | gateway + device_control | render | APN form visible | unit | P1 | planned |

## Live verification
- [ ] Viewer opens bench gateway: Overview chart at 1 h / every reading shows the live line and the reporting lane lines up with gaps.
- [ ] Every reading: click a row; packet panel stays in view while scrolling; Copy works.
- [ ] Operations: reboot as a viewer; Waiting, then Confirmed after reconnect.
- [ ] Narrow window (390 px): tabs scroll, chart fits, packet panel stacks under the table.
- [ ] Dark mode: chart tokens readable.
```

- [ ] **Step 2: Checkpoint**

---

### Task B2: API methods

**Files:**
- Modify: `src/services/api.ts` (after `getDeviceDashboard`, ~line 1796)

- [ ] **Step 1: Add the methods**

```ts
  /** Overview mode of the device dashboard: exact series for <= 8 keys at one detail level, plus reporting stats. */
  async getDeviceSeries(deviceId: number, hours: number, detail: string, keys: string[]): Promise<any> {
    const q = new URLSearchParams({ hours: String(hours), detail, keys: keys.join(',') });
    return this.request(`/devices/${deviceId}/dashboard/?${q}`);
  }

  /** Raw readings newest first; `before` pages older. */
  async getDeviceReadings(deviceId: number, opts: { before?: string; limit?: number } = {}): Promise<any> {
    const q = new URLSearchParams({ limit: String(opts.limit ?? 100) });
    if (opts.before) q.set('before', opts.before);
    return this.request(`/devices/${deviceId}/readings/?${q}`);
  }

  async getReadingPacket(deviceId: number, readingId: number): Promise<any> {
    return this.request(`/devices/${deviceId}/readings/${readingId}/packet/`);
  }

  async getDeviceOperations(deviceId: number): Promise<any> {
    return this.request(`/devices/${deviceId}/operations/`);
  }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

---

### Task B3: Pure chart helpers

**Files:**
- Create: `src/features/staff/viewer/deviceChart.ts`
- Test: `src/features/staff/viewer/__tests__/deviceChart.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { ALLOWED, colorsFor, fitDetail, niceTicks, segments, GATEWAY_READINGS, METER_READINGS } from '../deviceChart';

describe('deviceChart helpers', () => {
  it('C1/C2 offers only sensible detail levels and refits on range change', () => {
    expect(ALLOWED[6]).toEqual(['1m', '5m']);
    expect(fitDetail(24, 'every')).toBe('5m');
    expect(fitDetail(1, '5m')).toBe('5m');
  });

  it('C3 rounds ticks and includes zero when asked', () => {
    expect(niceTicks(1.2, 1.6, true).ticks).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(niceTicks(229.1, 232.4, false).ticks).toEqual([229, 230, 231, 232, 233]);
    expect(niceTicks(5, 5, false).ticks.length).toBeGreaterThan(1);
  });

  it('C4 splits a line where readings stopped', () => {
    const t = (s: number) => new Date(Date.UTC(2026, 9, 29, 8, 0, s)).toISOString();
    const pts = [0, 2, 4, 64, 66].map(s => ({ t: t(s), v: 1 }));
    expect(segments(pts, 'v', 6000).map(s => s.length)).toEqual([3, 2]);
    expect(segments([{ t: t(0) }, { t: t(2), v: 1 }] as any, 'v', 6000).map(s => s.length)).toEqual([1]);
  });

  it('C5 uses phase colours by name, else blue/ochre, else teal', () => {
    expect(colorsFor(['R', 'Y', 'B'])).toEqual(['var(--dc-r)', 'var(--dc-y)', 'var(--dc-b)']);
    expect(colorsFor(['String 1', 'String 2'])).toEqual(['var(--dc-b)', 'var(--dc-y)']);
    expect(colorsFor(['Grid'])).toEqual(['var(--dc-one)']);
  });

  it('lists eight readings per device type, each with at most three keys', () => {
    for (const list of [GATEWAY_READINGS, METER_READINGS]) {
      expect(list).toHaveLength(8);
      list.forEach(r => expect(r.keys.length).toBeLessThanOrEqual(3));
    }
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npx jest src/features/staff/viewer/__tests__/deviceChart.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement** `src/features/staff/viewer/deviceChart.ts`

```ts
/** Pure helpers for the device page's Overview chart. Spec §5.3 (detail rules, colours, gaps). */
export type Detail = 'every' | '1m' | '5m' | '1h' | '1d';
export type Cell = 'full' | 'partial' | 'empty';
export type SeriesPoint = { t: string } & Record<string, number>;
export type CodeChange = { t: string; key: string; value: number };
export type Series = {
  device_id: number; serial: string; device_type: string; site_id: string | null; is_online: boolean;
  last_heartbeat: string | null; firmware_version: string | null; last_reading_at: string | null;
  range_start: string; range_end: string; detail: Detail; keys: string[];
  latest: Record<string, number | string | boolean> | null; series: SeriesPoint[];
  median_gap_s: number | null; longest_gap_s: number | null; longest_gap_at: string | null;
  coverage: Cell[]; code_changes: CodeChange[];
};
export type ChartReading = { id: string; label: string; title: string; unit: string; keys: string[]; names: string[]; zero: boolean };

export const RANGES: [string, number][] = [['1 h', 1], ['6 h', 6], ['24 h', 24], ['48 h', 48], ['7 d', 168]];
export const ALLOWED: Record<number, Detail[]> = { 1: ['every', '1m', '5m'], 6: ['1m', '5m'], 24: ['5m', '1h'], 48: ['5m', '1h'], 168: ['1h', '1d'] };
export const DETAIL_LABEL: Record<Detail, string> = { every: 'Every reading', '1m': 'Per minute', '5m': '5 min', '1h': 'Hourly', '1d': 'Daily' };
export const DETAIL_MS: Record<Detail, number> = { every: 0, '1m': 60_000, '5m': 300_000, '1h': 3_600_000, '1d': 86_400_000 };

/** Keep the chosen detail if the new range allows it, else the finest the range allows. */
export const fitDetail = (hours: number, d: Detail): Detail => (ALLOWED[hours].includes(d) ? d : ALLOWED[hours][0]);

const r = (id: string, label: string, title: string, unit: string, keys: string[], names: string[], zero = true): ChartReading =>
  ({ id, label, title, unit, keys, names, zero });
export const GATEWAY_READINGS: ChartReading[] = [
  r('solar', 'Solar', 'Solar power by string, W', 'W', ['pv1_power_w', 'pv2_power_w'], ['String 1', 'String 2']),
  r('home', 'Home use', 'Home use by phase, W', 'W', ['load_l1_power_w', 'load_l2_power_w', 'load_l3_power_w'], ['R', 'Y', 'B']),
  r('grid', 'Grid', 'Grid power, W. Above 0 is buying, below is selling', 'W', ['grid_power_w'], ['Grid']),
  r('battery', 'Battery power', 'Battery power, W. Below 0 is charging', 'W', ['battery_power_w'], ['Battery']),
  r('soc', 'Battery charge', 'Battery charge, %', '%', ['battery_soc_percent'], ['Charge']),
  r('volt', 'Grid voltage', 'Grid voltage by phase, V', 'V', ['grid_l1_voltage_v', 'grid_l2_voltage_v', 'grid_l3_voltage_v'], ['R', 'Y', 'B'], false),
  r('freq', 'Frequency', 'Grid frequency, Hz', 'Hz', ['grid_frequency_hz'], ['Frequency'], false),
  r('temp', 'Temperatures', 'Temperatures, °C', '°C', ['inverter_temp_c', 'battery_temp_c'], ['Inverter', 'Battery'], false),
];
export const METER_READINGS: ChartReading[] = [
  r('power', 'Active power', 'Active power by phase, W', 'W', ['active_power_l1', 'active_power_l2', 'active_power_l3'], ['R', 'Y', 'B']),
  r('total', 'Total power', 'Total active power, W', 'W', ['active_power_total'], ['Total']),
  r('volt', 'Voltage', 'Voltage by phase, V', 'V', ['voltage_l1', 'voltage_l2', 'voltage_l3'], ['R', 'Y', 'B'], false),
  r('current', 'Current', 'Current by phase, A', 'A', ['current_l1', 'current_l2', 'current_l3'], ['R', 'Y', 'B']),
  r('freq', 'Frequency', 'Frequency by phase, Hz', 'Hz', ['frequency_l1', 'frequency_l2', 'frequency_l3'], ['R', 'Y', 'B'], false),
  r('pf', 'Power factor', 'Power factor by phase', '', ['power_factor_l1', 'power_factor_l2', 'power_factor_l3'], ['R', 'Y', 'B'], false),
  r('reactive', 'Reactive power', 'Total reactive power, var', 'var', ['reactive_power_total'], ['Reactive']),
  r('apparent', 'Apparent power', 'Total apparent power, VA', 'VA', ['apparent_power_total'], ['Apparent']),
];

/** Round axis ticks (about four steps of 1/2/2.5/5 × 10^n); zero included when asked. */
export function niceTicks(lo: number, hi: number, zero: boolean): { a: number; b: number; step: number; ticks: number[] } {
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (!(hi - lo > 1e-9)) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)!;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e3 ? 0 : +v.toFixed(6));
  return { a, b, step, ticks };
}

/** Points that have `key`, split wherever two neighbours are more than `maxGapMs` apart (never interpolate across a gap). */
export function segments(points: SeriesPoint[], key: string, maxGapMs: number): SeriesPoint[][] {
  const out: SeriesPoint[][] = [];
  let cur: SeriesPoint[] = [], prev = -Infinity;
  for (const p of points) {
    if (typeof p[key] !== 'number') continue;
    const t = Date.parse(p.t);
    if (t - prev > maxGapMs && cur.length) { out.push(cur); cur = []; }
    cur.push(p); prev = t;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Phase convention R/Y/B; two lines blue/ochre; one line teal. Tokens live in deviceTabs.css. */
export function colorsFor(names: string[]): string[] {
  if (names.length === 3 && names.join() === 'R,Y,B') return ['var(--dc-r)', 'var(--dc-y)', 'var(--dc-b)'];
  if (names.length === 2) return ['var(--dc-b)', 'var(--dc-y)'];
  return names.map(() => 'var(--dc-one)');
}

/** "4 min 12 s", "2.0 s", "1 h 3 min". */
export function duration(s: number): string {
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
  return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
}

/** Fault/warning words read best as hex. */
export const hexCode = (v: number) => `0x${Math.round(v).toString(16).toUpperCase().padStart(4, '0')}`;
```

- [ ] **Step 4: Run, expect pass**

Run: `npx jest src/features/staff/viewer/__tests__/deviceChart.test.ts`
Expected: PASS. Mark C1–C5 `passing`.

- [ ] **Step 5: Checkpoint**

---

### Task B4: Styles (tabs, chart, table, ligatures, colour tokens)

**Files:**
- Create: `src/features/staff/viewer/deviceTabs.css`

- [ ] **Step 1: Write the file**

```css
/* Device page tabs (spec §5.0, §5.3). Colours validated with the dataviz palette check (light surface). */
.dt { --dc-r: #C2412D; --dc-y: #B9870F; --dc-b: #3570C8; --dc-one: #0B7F73; --dc-miss: rgba(201,122,0,0.32); --dc-fault: #C97A00; }
.dark-mode .dt { --dc-r: #F07A63; --dc-y: #E2B54A; --dc-b: #7FA8EE; --dc-one: #2EF0CC; --dc-miss: rgba(240,170,60,0.38); --dc-fault: #F0AA3C; }
/* Fira Code would draw 0x0004 as 0×0004; !important beats any `font:` shorthand. */
.dt, .dt * { font-variant-ligatures: none !important; }
.dt-num { font-family: 'Fira Code', monospace; font-variant-numeric: tabular-nums; }
.dt-unit { font-family: Rubik, sans-serif; font-size: 0.55em; font-weight: 400; color: var(--muted-foreground); margin-left: 4px; }

.dt-tabs { display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid var(--border); scrollbar-width: none; }
.dt-tabs button { min-height: 48px; padding: 0 18px; margin-bottom: -1px; border: 0; border-bottom: 3px solid transparent; background: none;
  font: 500 15px Rubik, sans-serif; color: var(--muted-foreground); cursor: pointer; white-space: nowrap; }
.dt-tabs button[aria-selected='true'] { border-bottom-color: var(--brand-green); color: var(--foreground); }
.dt-count { margin-left: 6px; padding: 1px 8px; border-radius: 999px; background: var(--muted); font: 500 12px 'Fira Code', monospace; }

.dt-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
.dt-tile { display: flex; flex-direction: column; gap: 4px; padding: 18px 20px; border-radius: var(--radius); background: var(--card); border: 1px solid var(--border); }
.dt-tile .dt-num { font-size: 28px; font-weight: 500; }
.dt-sub { font-size: 13px; color: var(--muted-foreground); }

.dt-card { display: flex; flex-direction: column; gap: 14px; padding: 20px 22px 18px; border-radius: var(--radius); background: var(--card); border: 1px solid var(--border); min-width: 0; }
.dt-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.dt-pills { display: inline-flex; flex-wrap: wrap; padding: 3px; gap: 2px; border-radius: 999px; background: var(--muted); }
.dt-pills button { min-height: 40px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; cursor: pointer;
  font: 500 13px 'Fira Code', monospace; color: var(--foreground); }
.dt-pills button[aria-pressed='true'] { background: var(--brand-green); color: #fff; }
.dt-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dt-chips button { min-height: 40px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--card);
  font: 500 14px Rubik, sans-serif; color: var(--foreground); cursor: pointer; }
.dt-chips button[aria-pressed='true'] { border-color: var(--brand-green); background: color-mix(in srgb, var(--brand-green) 12%, transparent); }
.dt-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 24px; padding-top: 14px; border-top: 1px solid var(--border); }
.dt-head h3 { margin: 0; font-size: 17px; font-weight: 600; }
.dt-readout { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 20px; min-height: 44px; }
.dt-readout b { font-size: 18px; font-weight: 500; }
.dt-key { display: inline-block; width: 14px; height: 3px; border-radius: 2px; transform: translateY(-4px); margin-right: 7px; }
.dt-svg { display: block; width: 100%; overflow: visible; touch-action: pan-y; }
.dt-svg text { font: 12px 'Fira Code', monospace; fill: var(--muted-foreground); }
.dt-svg .dt-label { font-family: Rubik, sans-serif; }
.dt-legend { display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 13px; color: var(--muted-foreground); }

.dt-split { display: grid; gap: 16px; align-items: start; grid-template-columns: minmax(0, 1fr); }
.dt-split.open { grid-template-columns: minmax(0, 1.45fr) minmax(340px, 1fr); }
@media (max-width: 1100px) { .dt-split.open { grid-template-columns: minmax(0, 1fr); } }
.dt-table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 14px; }
.dt-table th { padding: 12px 10px; font-weight: 500; font-size: 13px; color: var(--muted-foreground); text-align: right; white-space: nowrap; }
.dt-table th:first-child, .dt-table td:first-child { text-align: left; padding-left: 18px; }
.dt-table td { padding: 10px; text-align: right; border-top: 1px solid var(--border); font-family: 'Fira Code', monospace; white-space: nowrap; }
.dt-table tr[data-row] { cursor: pointer; }
.dt-table tr[aria-selected='true'] { background: color-mix(in srgb, var(--brand-green) 10%, transparent); }
.dt-table tr.fault { background: color-mix(in srgb, var(--dc-fault) 9%, transparent); }
.dt-table tr.gap td { font-family: Rubik, sans-serif; color: #8A5300; text-align: left; background: color-mix(in srgb, var(--dc-fault) 7%, transparent); }
.dt-icon { min-width: 36px; min-height: 36px; border: 0; border-radius: 10px; background: transparent; color: var(--brand-green); font: 500 13px 'Fira Code', monospace; white-space: nowrap; cursor: pointer; }
.dt-packet { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 10px; padding: 18px 20px; border-radius: var(--radius); background: #12151A; color: #E6EEF0; min-width: 0; }
.dt-packet pre { margin: 0; padding: 14px 16px; border-radius: 14px; background: #080C14; font: 13px/1.55 'Fira Code', monospace; overflow-x: auto; white-space: pre; }
.dt-packet button { min-height: 36px; padding: 0 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: inherit; cursor: pointer; }

.dt-ops { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; align-items: stretch; }
.dt-op { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; padding: 12px 0; border-top: 1px solid var(--border); }
.dt-state-ok { color: var(--brand-green); font-size: 13px; } .dt-state-wait { color: #8A5300; font-size: 13px; } .dt-state-none { color: var(--muted-foreground); font-size: 13px; }
.dt-danger { border-color: rgba(180,35,24,0.35); }
```

`#8A5300` (warning text) and the dark packet panel colours are fixed on purpose (the packet panel is always dark, like a terminal). Everything else uses theme tokens.

- [ ] **Step 2: Checkpoint**

---

### Task B5: DeviceChart component

**Files:**
- Create: `src/features/staff/viewer/OverviewChart.tsx`
- Test: `src/features/staff/viewer/__tests__/OverviewChart.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import OverviewChart from '../OverviewChart';
import { GATEWAY_READINGS, type Series } from '../deviceChart';

const T = (m: number) => new Date(Date.UTC(2026, 9, 29, 8, m)).toISOString();
const base = (over: Partial<Series> = {}): Series => ({
  device_id: 47, serial: '00A1', device_type: 'gateway', site_id: null, is_online: true, last_heartbeat: null,
  firmware_version: '2.0.9', last_reading_at: T(60), range_start: T(0), range_end: T(60), detail: '1m', keys: ['pv1_power_w', 'pv2_power_w'],
  latest: {}, median_gap_s: 2, longest_gap_s: 252, longest_gap_at: T(16),
  coverage: [...Array(16).fill('full'), 'partial', 'empty', ...Array(42).fill('full')],
  code_changes: [{ t: T(59), key: 'fault_word_1', value: 4 }],
  series: [0, 1, 2].map(m => ({ t: T(m), pv1_power_w: 1400, pv1_power_w__min: 1300, pv1_power_w__max: 1500, pv2_power_w: 1300, pv2_power_w__min: 1250, pv2_power_w__max: 1350 })),
  ...over,
});

describe('DeviceChart', () => {
  it('C6/C7/C8 draws the spread band, three cell shapes, the codes lane, and a latest readout', () => {
    const { container } = render(<OverviewChart data={base()} reading={GATEWAY_READINGS[0]} />);
    expect(container.querySelectorAll('path[data-band]')).toHaveLength(2);
    expect(container.querySelectorAll('rect[data-cell="full"]').length).toBe(58);
    expect(container.querySelector('rect[data-cell="partial"]')).toBeInTheDocument();
    expect(container.querySelector('rect[data-cell="empty"]')).toBeInTheDocument();
    expect(screen.getByText(/Fault 0x0004 at/)).toBeInTheDocument();
    expect(screen.getByText(/^Latest/)).toBeInTheDocument();
    expect(screen.getAllByText(/\(1,300 to 1,500\)/).length).toBeGreaterThan(0);
  });

  it('draws no band for every reading', () => {
    const { container } = render(<OverviewChart data={base({ detail: 'every', series: [{ t: T(0), pv1_power_w: 1 } as any] })} reading={GATEWAY_READINGS[0]} />);
    expect(container.querySelector('path[data-band]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npx jest src/features/staff/viewer/__tests__/OverviewChart.test.tsx`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement** `src/features/staff/viewer/OverviewChart.tsx`

```tsx
import React, { useMemo, useRef, useState } from 'react';
import { colorsFor, DETAIL_MS, duration, hexCode, niceTicks, segments, type ChartReading, type Series } from './deviceChart';

// One time axis for the plot, the reporting lane and the codes lane (spec §5.3).
const X0 = 60, X1 = 988, Y0 = 14, Y1 = 206, W = X1 - X0;
const LANE_Y = 222, CODE_Y = 255;
const clockFmt = (ms: number, withDay: boolean) =>
  new Date(ms).toLocaleString('en-IN', withDay ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false } : { hour: '2-digit', minute: '2-digit', hour12: false });
const secFmt = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour12: false });
const num = (v: number, unit: string) => v.toLocaleString('en-IN', { maximumFractionDigits: unit === 'Hz' || unit === '' ? 2 : unit === 'V' || unit === '°C' ? 1 : 0 });

export default function DeviceChart({ data, reading }: { data: Series; reading: ChartReading }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const start = Date.parse(data.range_start), end = Date.parse(data.range_end), span = end - start || 1;
  const agg = data.detail !== 'every';
  const colors = colorsFor(reading.names);
  const X = (t: number) => X0 + ((t - start) / span) * W;

  const pts = useMemo(() => data.series.filter(p => reading.keys.some(k => typeof p[k] === 'number')), [data.series, reading.keys]);
  const scale = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const p of pts) for (const k of reading.keys) {
      const v = p[k]; if (typeof v !== 'number') continue;
      lo = Math.min(lo, p[`${k}__min`] ?? v); hi = Math.max(hi, p[`${k}__max`] ?? v);
    }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    if (reading.id === 'soc') { lo = 0; hi = 100; }
    return niceTicks(lo, hi, reading.zero);
  }, [pts, reading]);
  const Y = (v: number) => Y1 - ((v - scale.a) / (scale.b - scale.a)) * (Y1 - Y0);
  const maxGap = agg ? DETAIL_MS[data.detail] * 1.5 : Math.max(6000, (data.median_gap_s ?? 2) * 3000);
  const dec = scale.step >= 1 ? 0 : (String(scale.step).split('.')[1] ?? '').length;

  const idx = hover ?? pts.length - 1;
  const hp = pts[idx];
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || !pts.length) return;
    const t = start + (((e.clientX - box.left) / box.width) * 1000 - X0) / W * span;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(Date.parse(pts[i].t) - t) < Math.abs(Date.parse(pts[best].t) - t)) best = i;
    setHover(best);
  };

  const multiDay = span > 6 * 3_600_000;
  const xTicks = [0, 1, 2, 3, 4, 5].map(k => start + (k * span) / 5);
  const gapStart = data.longest_gap_at ? Date.parse(data.longest_gap_at) : null;
  const gapX = gapStart != null ? X(gapStart) : null;
  const gapW = gapStart != null && data.longest_gap_s ? Math.max(3, X(gapStart + data.longest_gap_s * 1000) - X(gapStart)) : 0;
  const cellW = W / Math.max(1, data.coverage.length);
  const lastCode = data.code_changes[data.code_changes.length - 1];
  const hpTime = hp ? (agg ? `${clockFmt(Date.parse(hp.t), multiDay)} to ${clockFmt(Date.parse(hp.t) + DETAIL_MS[data.detail], false)}` : secFmt(Date.parse(hp.t))) : '';

  return (
    <div className="dt-chart">
      <div className="dt-head">
        <h3>{reading.title}</h3>
        <div className="dt-readout" aria-live="polite">
          {hp && <span className="dt-num dt-sub">{hover == null ? 'Latest, ' : ''}{hpTime}</span>}
          {hp && reading.keys.map((k, i) => typeof hp[k] === 'number' && (
            <span key={k}>
              <i className="dt-key" style={{ background: colors[i] }} aria-hidden="true" />
              <b className="dt-num">{num(hp[k], reading.unit)}<span className="dt-unit">{reading.unit}</span></b>
              <span className="dt-sub"> {reading.names[i]}{agg && hp[`${k}__min`] != null && ` (${num(hp[`${k}__min`], reading.unit)} to ${num(hp[`${k}__max`], reading.unit)})`}</span>
            </span>
          ))}
        </div>
      </div>
      <svg ref={svgRef} className="dt-svg" viewBox="0 0 1000 292" role="img"
        aria-label={`${reading.title}. ${hp ? `Latest ${reading.keys.map((k, i) => `${reading.names[i]} ${typeof hp[k] === 'number' ? num(hp[k], reading.unit) : 'none'}`).join(', ')}` : 'No readings'}. Exact values are in the Every reading tab.`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {scale.ticks.map(v => (
          <g key={v}>
            <line x1={X0} x2={X1} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeOpacity={v === 0 && reading.zero ? 1 : 0.6} strokeWidth={v === 0 && reading.zero ? 1.5 : 1} />
            <text x={50} y={Y(v) + 4} textAnchor="end">{v.toFixed(dec)}</text>
          </g>
        ))}
        {gapX != null && gapW > 0 && <>
          <rect x={gapX} y={Y0} width={gapW} height={Y1 - Y0} fill="var(--dc-miss)" opacity={0.45} />
          <text className="dt-label" x={Math.min(gapX + gapW + 6, X1 - 150)} y={Y0 + 14}>No readings, {duration(data.longest_gap_s!)}</text>
        </>}
        {reading.keys.map((k, i) => segments(pts, k, maxGap).map((seg, j) => (
          <g key={`${k}-${j}`}>
            {agg && seg[0][`${k}__min`] != null && (
              <path data-band="" fill={colors[i]} opacity={0.12}
                d={`M${seg.map(p => `${X(Date.parse(p.t)).toFixed(1)},${Y(p[`${k}__max`]).toFixed(1)}`).join(' L')} L${[...seg].reverse().map(p => `${X(Date.parse(p.t)).toFixed(1)},${Y(p[`${k}__min`]).toFixed(1)}`).join(' L')} Z`} />
            )}
            <polyline fill="none" stroke={colors[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
              points={seg.map(p => `${X(Date.parse(p.t)).toFixed(1)},${Y(p[k]).toFixed(1)}`).join(' ')} />
          </g>
        )))}
        {hp && <line x1={X(Date.parse(hp.t))} x2={X(Date.parse(hp.t))} y1={Y0} y2={244} stroke="var(--foreground)" strokeOpacity={0.35} />}
        {hp && reading.keys.map((k, i) => typeof hp[k] === 'number' && (
          <circle key={k} cx={X(Date.parse(hp.t))} cy={Y(hp[k])} r={4.5} fill={colors[i]} stroke="var(--card)" strokeWidth={2} />
        ))}

        <text className="dt-label" x={0} y={LANE_Y + 14}>Reported</text>
        {data.coverage.map((c, i) => (
          <rect key={i} data-cell={c} x={X0 + i * cellW + 1} width={Math.max(1, cellW - 2)} rx={2}
            y={c === 'partial' ? LANE_Y + 9 : LANE_Y} height={c === 'partial' ? 9 : 18}
            fill={c === 'empty' ? 'var(--dc-miss)' : 'var(--brand-green)'} />
        ))}
        <text className="dt-label" x={0} y={CODE_Y + 6}>Codes</text>
        {data.code_changes.map(c => {
          const x = X(Date.parse(c.t));
          return <path key={c.t + c.key} d={`M${x} ${CODE_Y - 6} L${x + 6} ${CODE_Y} L${x} ${CODE_Y + 6} L${x - 6} ${CODE_Y} Z`} fill="var(--dc-fault)" stroke="var(--card)" strokeWidth={2} />;
        })}
        {lastCode && <text x={X(Date.parse(lastCode.t)) - 12} y={CODE_Y + 6} textAnchor="end">
          {`${lastCode.key.startsWith('warning') ? 'Warning' : 'Fault'} ${hexCode(lastCode.value)} at ${secFmt(Date.parse(lastCode.t))}`}
        </text>}
        {xTicks.map((t, k) => (
          <text key={k} x={X(t)} y={286} textAnchor={k === 0 ? 'start' : k === 5 ? 'end' : 'middle'}>
            {span >= 7 * 86_400_000 - 1 ? new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : clockFmt(t, multiDay)}
          </text>
        ))}
      </svg>
      <div className="dt-legend">
        <span><svg width="14" height="12" aria-hidden="true"><rect width="10" height="12" rx="2" fill="var(--brand-green)" /></svg> All expected readings arrived</span>
        <span><svg width="14" height="12" aria-hidden="true"><rect y="6" width="10" height="6" rx="2" fill="var(--brand-green)" /></svg> Some missing</span>
        <span><svg width="14" height="12" aria-hidden="true"><rect width="10" height="12" rx="2" fill="var(--dc-miss)" /></svg> None</span>
        <span><svg width="14" height="12" aria-hidden="true"><path d="M5 1 L10 6 L5 11 L0 6 Z" fill="var(--dc-fault)" /></svg> Fault or warning code changed</span>
      </div>
      <p style={{ margin: 0, fontSize: 14 }}>
        {data.median_gap_s != null ? <>A reading every {duration(data.median_gap_s)} on average.</> : <>No readings in this range.</>}
        {data.longest_gap_s != null && data.longest_gap_at && <> Longest gap {duration(data.longest_gap_s)}, from {secFmt(Date.parse(data.longest_gap_at))}.</>}
        {agg && <> Averages hide spikes, so check the band: a wide band means the reading jumped inside that period.</>}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx jest src/features/staff/viewer/__tests__/OverviewChart.test.tsx`
Expected: PASS. Mark C6–C8 `passing`.

- [ ] **Step 5: Checkpoint**

---

### Task B6: Tab shell and Overview

**Files:**
- Modify: `src/features/staff/viewer/DeviceDashboard.tsx`
- Modify: `src/features/staff/viewer/__tests__/DeviceDashboard.test.tsx`

The existing body (find box + sections) becomes the All values tab unchanged. `DevicePage` moves to the Operations tab (Task B8).

- [ ] **Step 1: Update and extend the tests**

In `DeviceDashboard.test.tsx`:
- Add `getDeviceSeries: jest.fn()` to the `apiService` mock, and mock the two new tabs so this file tests only the shell:

```tsx
jest.mock('../ReadingsTab', () => ({ __esModule: true, default: () => <div data-testid="readings" /> }));
jest.mock('../OperationsTab', () => ({ __esModule: true, default: () => <div data-testid="ops" /> }));
jest.mock('../OverviewChart', () => ({ __esModule: true, default: () => <div data-testid="chart" /> }));
```

- Change `ui()` to take a URL: `const ui = (url = '/devices/47/dashboard') => render(<MemoryRouter initialEntries={[url]}>…`.
- In the existing tests that check sections, call `ui('/devices/47/dashboard?tab=values')` (T3).
- Remove assertions about the controls section on the dashboard (they move to Operations).
- Add:

```tsx
  it('T1 opens on Overview with four tabs and asks for the finest detail of 1 h', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash());
    apiService.getDeviceSeries.mockResolvedValue({ ...dash(), detail: 'every', keys: [], series: [], coverage: [], code_changes: [], median_gap_s: null, longest_gap_s: null, longest_gap_at: null });
    ui();
    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Overview', 'All values', 'Every reading', 'Operations']);
    expect(apiService.getDeviceSeries).toHaveBeenCalledWith(47, 1, 'every', ['pv1_power_w', 'pv2_power_w']);
  });

  it('T2 keeps the tab in the URL', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash());
    ui('/devices/47/dashboard?tab=readings');
    expect(await screen.findByTestId('readings')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Operations/ }));
    expect(await screen.findByTestId('ops')).toBeInTheDocument();
  });

  it('C2 switching range refits the detail', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash());
    apiService.getDeviceSeries.mockResolvedValue({ ...dash(), detail: 'every', keys: [], series: [], coverage: [], code_changes: [], median_gap_s: null, longest_gap_s: null, longest_gap_at: null });
    ui();
    await screen.findByTestId('chart');
    fireEvent.click(screen.getByRole('button', { name: '24 h' }));
    expect(apiService.getDeviceSeries).toHaveBeenLastCalledWith(47, 24, '5m', ['pv1_power_w', 'pv2_power_w']);
    expect(screen.queryByRole('button', { name: 'Every reading' })).toBeNull();
  });
```

- [ ] **Step 2: Run, expect failures**

Run: `npx jest src/features/staff/viewer/__tests__/DeviceDashboard.test.tsx`
Expected: FAIL (no tabs, modules missing). Create empty placeholder files `ReadingsTab.tsx` and `OperationsTab.tsx` exporting `export default function X() { return null; }` so the mocks resolve; they are filled in B7/B8.

- [ ] **Step 3: Implement**

At the top of `DeviceDashboard.tsx`:

```tsx
import { Link, useParams, useSearchParams } from 'react-router-dom';
import OverviewChart from './OverviewChart';
import ReadingsTab from './ReadingsTab';
import OperationsTab from './OperationsTab';
import { ALLOWED, DETAIL_LABEL, GATEWAY_READINGS, METER_READINGS, RANGES, fitDetail, type Detail, type Series } from './deviceChart';
import './deviceTabs.css';
```

Remove the `DevicePage` default import usage from the body (keep `at`, `devName`, the `Dev`/`Firmware` types). Remove the old `RANGES` constant (the new one comes from `deviceChart`); the All values tab keeps its own hours state with the legacy values `[['6h', 6], ['24h', 24], ['48h', 48], ['7d', 168]]` renamed `VALUE_RANGES`.

Add these components above `DeviceDashboard`:

```tsx
const TABS = [['overview', 'Overview'], ['values', 'All values'], ['readings', 'Every reading'], ['ops', 'Operations']] as const;
type Tab = typeof TABS[number][0];

function Tiles({ latest, meter }: { latest: Record<string, unknown> | null; meter: boolean }) {
  const n = (k: string) => (typeof latest?.[k] === 'number' ? (latest[k] as number) : null);
  const sum = (...ks: string[]) => { const v = ks.map(n).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const avg = (...ks: string[]) => { const v = ks.map(n).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const kw = (w: number | null) => (w == null ? '–' : (w / 1000).toFixed(2));
  const tiles: [string, string, string, string][] = meter ? [
    ['Total power', kw(n('active_power_total')), 'kW', 'All three phases'],
    ['Voltage', avg('voltage_l1', 'voltage_l2', 'voltage_l3')?.toFixed(1) ?? '–', 'V', 'Average of the phases'],
    ['Current', sum('current_l1', 'current_l2', 'current_l3')?.toFixed(2) ?? '–', 'A', 'Sum of the phases'],
    ['Power factor', avg('power_factor_l1', 'power_factor_l2', 'power_factor_l3')?.toFixed(2) ?? '–', '', 'Average of the phases'],
  ] : [
    ['Solar', kw(sum('pv1_power_w', 'pv2_power_w')), 'kW', `Strings ${kw(n('pv1_power_w'))} + ${kw(n('pv2_power_w'))} kW`],
    ['Home use', kw(sum('load_l1_power_w', 'load_l2_power_w', 'load_l3_power_w')), 'kW', `R ${n('load_l1_power_w') ?? '–'}, Y ${n('load_l2_power_w') ?? '–'}, B ${n('load_l3_power_w') ?? '–'} W`],
    ['Battery', n('battery_soc_percent')?.toFixed(0) ?? '–', '%', n('battery_power_w') == null ? '' : n('battery_power_w')! < 0 ? `Charging at ${kw(-n('battery_power_w')!)} kW` : `Giving ${kw(n('battery_power_w'))} kW`],
    ['Grid', kw(n('grid_power_w')), 'kW', n('grid_power_w') == null ? '' : n('grid_power_w')! >= 0 ? 'Buying' : 'Selling'],
  ];
  return (
    <section className="dt-tiles" aria-label="Right now">
      {tiles.map(([label, value, unit, sub]) => (
        <div key={label} className="dt-tile">
          <span className="dt-sub" style={{ fontSize: 14 }}>{label}</span>
          <span className="dt-num">{value}{unit && <span className="dt-unit">{unit}</span>}</span>
          <span className="dt-sub">{sub}</span>
        </div>
      ))}
    </section>
  );
}

function Overview({ deviceId, meter, latest }: { deviceId: number; meter: boolean; latest: Record<string, unknown> | null }) {
  const readings = meter ? METER_READINGS : GATEWAY_READINGS;
  const [hours, setHours] = useState(1);
  const [detail, setDetail] = useState<Detail>('every');
  const [readingId, setReadingId] = useState(readings[0].id);
  const [data, setData] = useState<Series | null>(null);
  const reading = readings.find(r => r.id === readingId) ?? readings[0];

  useEffect(() => {
    let live = true;
    const load = () => apiService.getDeviceSeries(deviceId, hours, detail, reading.keys).then((d: Series) => { if (live) setData(d); }).catch(() => {});
    load();
    const id = setInterval(load, hours === 1 ? 15_000 : 60_000);
    return () => { live = false; clearInterval(id); };
  }, [deviceId, hours, detail, reading.keys]);

  const PER: Record<Detail, string> = { every: '', '1m': 'minute', '5m': '5 minutes', '1h': 'hour', '1d': 'day' };
  const note = detail === 'every' ? 'Every reading as sent' : `Line is the average per ${PER[detail]}; the band is the lowest to highest reading in it`;
  return (
    <>
      <Tiles latest={latest} meter={meter} />
      <section className="dt-card" aria-label="Chart">
        <div className="dt-row">
          <div className="dt-pills" role="group" aria-label="Range">
            {RANGES.map(([label, h]) => (
              <button key={h} type="button" aria-pressed={hours === h} onClick={() => { setHours(h); setDetail(fitDetail(h, detail)); }}>{label}</button>
            ))}
          </div>
          <div className="dt-pills" role="group" aria-label="Detail">
            {ALLOWED[hours].map(d => <button key={d} type="button" aria-pressed={detail === d} onClick={() => setDetail(d)}>{DETAIL_LABEL[d]}</button>)}
          </div>
          <span className="dt-sub" style={{ marginLeft: 'auto' }}>{note}</span>
        </div>
        <div className="dt-chips" role="group" aria-label="Reading to chart">
          {readings.map(r => <button key={r.id} type="button" aria-pressed={r.id === reading.id} onClick={() => setReadingId(r.id)}>{r.label}</button>)}
        </div>
        {data ? <div style={{ opacity: data.detail === detail ? 1 : 0.6 }}><OverviewChart data={data} reading={reading} /></div> : <p className="dt-sub">Loading…</p>}
      </section>
    </>
  );
}
```

In `DeviceDashboard`:

```tsx
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS.find(([k]) => k === params.get('tab'))?.[0]) ?? 'overview';
  const pick = (k: Tab) => setParams(k === 'overview' ? {} : { tab: k }, { replace: true });
```

Keep the existing legacy dashboard fetch (it feeds the header, the All values tab and `latest` for tiles). Rename its `hours` state to `valueHours` with default 24 and its range buttons to `VALUE_RANGES`, shown only inside the All values tab.

Render, replacing the current return body after `<header>` (keep the back link, header facts and stale banner as they are, but remove the range group from the header):

```tsx
      <div className="dt" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div className="dt-tabs" role="tablist" aria-label="Device sections">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => pick(k)}>
              {label}{k === 'values' && <span className="dt-count">{sections.reduce((n, [, rows]) => n + rows.length, 0)}</span>}
            </button>
          ))}
        </div>
        {tab === 'overview' && <Overview deviceId={Number(deviceId)} meter={d.device_type === 'energy_meter'} latest={d.latest} />}
        {tab === 'values' && (/* the existing range buttons (VALUE_RANGES), find box, sections and rows, unchanged */)}
        {tab === 'readings' && <ReadingsTab deviceId={Number(deviceId)} meter={d.device_type === 'energy_meter'} />}
        {tab === 'ops' && <OperationsTab dev={d} firmware={firmware} isDark={isDark} />}
      </div>
```

Move the current ribbon section into the All values tab as is (it describes the legacy history there); the Overview has its own reporting lane.

- [ ] **Step 4: Run, expect pass**

Run: `npx jest src/features/staff/viewer/__tests__/DeviceDashboard.test.tsx`
Expected: PASS. Mark T1–T3, C2 `passing`.

- [ ] **Step 5: Checkpoint**

---

### Task B7: Every reading tab with the packet panel

**Files:**
- Modify (fill): `src/features/staff/viewer/ReadingsTab.tsx`
- Test: `src/features/staff/viewer/__tests__/ReadingsTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ReadingsTab from '../ReadingsTab';

jest.mock('../../../../services/api', () => ({ apiService: { getDeviceReadings: jest.fn(), getReadingPacket: jest.fn() } }));
const { apiService } = jest.requireMock('../../../../services/api');
const T = (s: number) => new Date(Date.UTC(2026, 9, 29, 9, 0, 0) - s * 1000).toISOString();
const row = (id: number, s: number, extra = {}) => ({ id, t: T(s), values: { pv1_power_w: 1462, grid_power_w: 141, fault_word_1: 0, ...extra } });

beforeEach(() => jest.resetAllMocks());

describe('ReadingsTab', () => {
  it('R1/R6 adds gap rows and tints fault rows', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0), row(2, 2), row(3, 4, { fault_word_1: 4 }), row(4, 64), row(5, 66)], next_before: null });
    render(<ReadingsTab deviceId={47} meter={false} />);
    expect(await screen.findByText('No readings for 1 min 0 s')).toBeInTheDocument();
    expect(screen.getByText('0x0004').closest('tr')).toHaveClass('fault');
  });

  it('R2 pages older', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0)], next_before: T(0) });
    render(<ReadingsTab deviceId={47} meter={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Older' }));
    expect(apiService.getDeviceReadings).toHaveBeenLastCalledWith(47, { before: T(0) });
  });

  it('R3/R4 opens the packet beside the table, and says when the message was pruned', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(9, 0)], next_before: null });
    apiService.getReadingPacket.mockResolvedValue({ kind: 'gateway', reading_time: T(0), received_at: T(0), reading: { pv1_power_w: 1462 }, message: null, message_note: 'pruned' });
    const { container } = render(<ReadingsTab deviceId={47} meter={false} />);
    fireEvent.click((await screen.findByText('1,462')).closest('tr')!);
    const panel = await screen.findByRole('region', { name: /Packet as the device sent it/ });
    expect(within(panel).getByText(/"pv1_power_w": 1462/)).toBeInTheDocument();
    expect(within(panel).getByText(/older than 14 days and has been removed/)).toBeInTheDocument();
    expect(container.querySelector('.dt-split')).toHaveClass('open');
  });

  it('R5 shows the meter message as sent', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [{ id: 3, t: T(0), values: { voltage_l1: 231 } }], next_before: null });
    apiService.getReadingPacket.mockResolvedValue({ kind: 'meter', reading_time: T(0), raw: 'SRMTR1^1^0^V:231', parsed: { voltage_l1: 231 } });
    render(<ReadingsTab deviceId={5} meter />);
    fireEvent.click(await screen.findByRole('button', { name: /Open packet/ }));
    expect(await screen.findByText('SRMTR1^1^0^V:231')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npx jest src/features/staff/viewer/__tests__/ReadingsTab.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** `src/features/staff/viewer/ReadingsTab.tsx`

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '../../../services/api';
import { duration, hexCode } from './deviceChart';

type Row = { id: number; t: string; received_at?: string; values: Record<string, number | string | boolean> };
type Packet =
  | { kind: 'gateway'; reading_time: string; received_at: string; reading: unknown; message: { received_at: string; size_bytes: number; text: string | null; hex: string | null } | null; message_note: 'pruned' | 'not_found' | null }
  | { kind: 'meter'; reading_time: string; raw: string | null; parsed: Record<string, number> };

// Default columns (spec §5.3: 7 per device type). The picker adds any other key; the choice is kept per device type.
const DEFAULT_COLS: Record<'gateway' | 'meter', string[]> = {
  gateway: ['pv1_power_w', 'pv2_power_w', 'load_l1_power_w', 'grid_power_w', 'battery_power_w', 'battery_soc_percent', 'fault_word_1'],
  meter: ['active_power_total', 'voltage_l1', 'voltage_l2', 'voltage_l3', 'current_l1', 'frequency_l1', 'power_factor_l1'],
};
const isCode = (k: string) => /(fault|warning)_(word|code)/.test(k);
const label = (k: string) => k.replace(/_/g, ' ').replace(/\b(w|v|a|hz|c|percent)$/, m => ({ w: 'W', v: 'V', a: 'A', hz: 'Hz', c: '°C', percent: '%' } as Record<string, string>)[m]);
const cell = (k: string, v: unknown) => (typeof v !== 'number' ? (v == null ? '–' : String(v)) : isCode(k) ? hexCode(v) : v.toLocaleString('en-IN', { maximumFractionDigits: 2 }));
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour12: false });
const storeKey = (kind: string) => `dt-cols-${kind}`;

export default function ReadingsTab({ deviceId, meter }: { deviceId: number; meter: boolean }) {
  const kind = meter ? 'meter' : 'gateway';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [before, setBefore] = useState<string | undefined>(undefined);
  const [jump, setJump] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [packet, setPacket] = useState<Packet | 'failed' | null>(null);
  const [cols, setCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storeKey(kind)) ?? '') as string[]; } catch { return DEFAULT_COLS[kind]; }
  });

  useEffect(() => {
    apiService.getDeviceReadings(deviceId, before ? { before } : {}).then((d: { rows: Row[]; next_before: string | null }) => { setRows(d.rows); setNext(d.next_before); }).catch(() => setRows([]));
  }, [deviceId, before]);
  useEffect(() => { try { localStorage.setItem(storeKey(kind), JSON.stringify(cols)); } catch { /* private mode */ } }, [cols, kind]);

  const openRow = (id: number) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setPacket(null);
    apiService.getReadingPacket(deviceId, id).then(setPacket).catch(() => setPacket('failed'));
  };

  // Gap rows: more than 3× the median gap on this page (spec §5.3).
  const lines = useMemo(() => {
    if (!rows) return [];
    const gaps = rows.slice(1).map((r, i) => (Date.parse(rows[i].t) - Date.parse(r.t)) / 1000).sort((a, b) => a - b);
    const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
    const out: ({ gap: number } | Row)[] = [];
    rows.forEach((r, i) => {
      if (i > 0 && median) {
        const g = (Date.parse(rows[i - 1].t) - Date.parse(r.t)) / 1000;
        if (g > 3 * median) out.push({ gap: g });
      }
      out.push(r);
    });
    return out;
  }, [rows]);
  const allKeys = useMemo(() => [...new Set((rows ?? []).flatMap(r => Object.keys(r.values)))].sort(), [rows]);

  return (
    <section className="dt-card" aria-labelledby="dt-readings-h" style={{ background: 'transparent', border: 0, padding: 0 }}>
      <div className="dt-row">
        <h3 id="dt-readings-h" style={{ margin: 0, fontSize: 18 }}>Every reading</h3>
        <details>
          <summary style={{ cursor: 'pointer', minHeight: 40, display: 'inline-flex', alignItems: 'center' }}>Columns</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 4, maxHeight: 240, overflow: 'auto', padding: 8 }}>
            {allKeys.map(k => (
              <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={cols.includes(k)} onChange={e => setCols(c => (e.target.checked ? [...c, k] : c.filter(x => x !== k)))} />{label(k)}
              </label>
            ))}
          </div>
        </details>
        <label className="dt-sub" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>Jump to
          <input type="datetime-local" value={jump} onChange={e => setJump(e.target.value)} style={{ minHeight: 40, borderRadius: 12, border: '1px solid var(--border)', padding: '0 10px', background: 'var(--card)', color: 'var(--foreground)' }} />
        </label>
        <button type="button" className="dt-icon" style={{ border: '1px solid var(--border)', padding: '0 12px' }} disabled={!jump}
          onClick={() => { setOpen(null); setBefore(new Date(jump).toISOString()); }}>Go</button>
        <span className="dt-sub">Newest first, every reading kept for 10 days</span>
      </div>
      <div className={`dt-split${open != null ? ' open' : ''}`}>
        <div style={{ overflowX: 'auto', minWidth: 0, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--card)' }}>
          {rows === null ? <p className="dt-sub" style={{ padding: 18 }}>Loading…</p> : rows.length === 0 ? <p className="dt-sub" style={{ padding: 18 }}>No readings in the last 10 days.</p> : (
            <table className="dt-table">
              <thead><tr><th scope="col">Time</th>{cols.map(k => <th key={k} scope="col">{label(k)}</th>)}<th scope="col"><span className="sr-only">Packet</span></th></tr></thead>
              <tbody>
                {lines.map((l, i) => ('gap' in l ? (
                  <tr key={`g${i}`} className="gap"><td colSpan={cols.length + 2}>No readings for {duration(l.gap)}</td></tr>
                ) : (
                  <tr key={l.id} data-row="" aria-selected={open === l.id} onClick={() => openRow(l.id)}
                    className={cols.some(k => isCode(k) && typeof l.values[k] === 'number' && l.values[k] !== 0) ? 'fault' : undefined}>
                    <td>{time(l.t)}</td>
                    {cols.map(k => <td key={k}>{cell(k, l.values[k])}</td>)}
                    <td><button type="button" className="dt-icon" aria-label="Open packet" aria-expanded={open === l.id} onClick={e => { e.stopPropagation(); openRow(l.id); }}>{'{ }'}</button></td>
                  </tr>
                )))}
              </tbody>
            </table>
          )}
          <div className="dt-row" style={{ padding: 12 }}>
            {before && <button type="button" className="dt-icon" style={{ padding: '0 12px' }} onClick={() => { setOpen(null); setBefore(undefined); }}>Newest</button>}
            {next && <button type="button" className="dt-icon" style={{ padding: '0 12px' }} onClick={() => { setOpen(null); setBefore(next); }}>Older</button>}
          </div>
        </div>
        {open != null && <PacketPanel packet={packet} onClose={() => setOpen(null)} />}
      </div>
    </section>
  );
}

function PacketPanel({ packet, onClose }: { packet: Packet | 'failed' | null; onClose: () => void }) {
  const text = packet && packet !== 'failed'
    ? (packet.kind === 'meter' ? packet.raw ?? '' : JSON.stringify(packet.reading, null, 2)) : '';
  return (
    <section className="dt-packet" aria-labelledby="dt-pk-h">
      <div className="dt-row" style={{ justifyContent: 'space-between' }}>
        <h4 id="dt-pk-h" style={{ margin: 0, fontSize: 15 }}>Packet as the device sent it{packet && packet !== 'failed' ? `, ${time(packet.reading_time)}` : ''}</h4>
        <div className="dt-row">
          <button type="button" disabled={!text} onClick={() => navigator.clipboard?.writeText(text)}>Copy</button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
      {packet === null && <span>Loading…</span>}
      {packet === 'failed' && <span>Couldn't load this packet. Try again in a moment.</span>}
      {packet && packet !== 'failed' && (packet.kind === 'meter' ? (
        <>{packet.raw ? <pre>{packet.raw}</pre> : <span>This reading has no stored message.</span>}
          <pre>{JSON.stringify(packet.parsed, null, 2)}</pre></>
      ) : (
        <>
          <pre>{text}</pre>
          {packet.message ? (
            <details>
              <summary style={{ cursor: 'pointer' }}>Closest message received, {time(packet.message.received_at)}, {packet.message.size_bytes.toLocaleString('en-IN')} bytes</summary>
              <pre>{packet.message.text ?? packet.message.hex}</pre>
            </details>
          ) : (
            <span style={{ fontSize: 13, color: '#A9C4C2' }}>{packet.message_note === 'pruned'
              ? 'The whole message is older than 14 days and has been removed.'
              : 'No stored message within 2 seconds of this reading.'}</span>
          )}
        </>
      ))}
    </section>
  );
}
```

`section` with `aria-labelledby` has the implicit `region` role the test queries. If the repo has no `.sr-only` utility, Tailwind provides `sr-only`; keep the class name.

- [ ] **Step 4: Run, expect pass**

Run: `npx jest src/features/staff/viewer/__tests__/ReadingsTab.test.tsx`
Expected: PASS. Mark R1–R6 `passing`.

- [ ] **Step 5: Checkpoint**

---

### Task B8: Operations tab

**Files:**
- Modify (fill): `src/features/staff/viewer/OperationsTab.tsx`
- Modify: `src/features/staff/viewer/DevicePage.tsx` (APN for viewers, meter settings)
- Test: `src/features/staff/viewer/__tests__/OperationsTab.test.tsx`

Phase 1 call (state it to the owner at the checkpoint): the status cards (what each op does, last run, confirmation) are new; the action buttons stay in the existing `DevicePage` control panel under them, so its tested handlers and confirm dialogs are reused rather than rebuilt per card. Moving each button into its card is a follow-up if the owner wants the mockup's exact layout.

- [ ] **Step 1: Write the failing tests**

```tsx
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import OperationsTab from '../OperationsTab';

jest.mock('../../../../services/api', () => ({ apiService: { getDeviceOperations: jest.fn() } }));
let canControl = true;
jest.mock('../../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: (f: string) => f === 'device_control' && canControl }) }));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
jest.mock('../DevicePage', () => ({ __esModule: true, default: () => <div data-testid="controls" />, at: (s: string) => s }));
const { apiService } = jest.requireMock('../../../../services/api');
const dev = { device_id: 47, device_type: 'gateway', serial: '00A1', is_online: true, last_heartbeat: null };
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

describe('OperationsTab', () => {
  beforeEach(() => { canControl = true; });

  it('O1/O2/O3 shows each state in plain words', async () => {
    apiService.getDeviceOperations.mockResolvedValue({ device_type: 'gateway', recent: [], ops: [
      { op: 'reboot', state: 'confirmed', confirmed_at: ago(1), last: { at: ago(2), action: 'reboot', actor: { id: 7, name: 'T' }, values: {} } },
      { op: 'diagnostics', state: 'not_confirmed', confirmed_at: null, last: { at: ago(9), action: 'diagnostics', actor: { id: 8, name: 'Asha' }, values: {} } },
      { op: 'mute', state: 'no_record', confirmed_at: null, last: null },
    ] });
    render(<OperationsTab dev={dev} firmware={null} isDark={false} />);
    expect(await screen.findByText(/Confirmed .* by you/)).toBeInTheDocument();
    expect(screen.getByText(/Not confirmed after 5 min/)).toBeInTheDocument();
    expect(screen.getByText('No record yet')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });

  it('O4 hides the controls without device control', async () => {
    canControl = false;
    apiService.getDeviceOperations.mockResolvedValue({ device_type: 'gateway', recent: [], ops: [] });
    render(<OperationsTab dev={dev} firmware={null} isDark={false} />);
    await screen.findByText('Operations');
    expect(screen.queryByTestId('controls')).toBeNull();
  });
});
```

If `AuthContext` exports the hook under another name, adjust the mock and the import (`grep -n "export" src/contexts/AuthContext.tsx`).

- [ ] **Step 2: Run, expect failure**

Run: `npx jest src/features/staff/viewer/__tests__/OperationsTab.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** `src/features/staff/viewer/OperationsTab.tsx`

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../../services/api';
import { useAccess } from '../../../shared/access/useAccess';
import { useAuth } from '../../../contexts/AuthContext';
import DevicePage, { at, type Dev, type Firmware } from './DevicePage';

type Op = { op: string; state: 'confirmed' | 'waiting' | 'not_confirmed' | 'failed' | 'sent' | 'no_record'; confirmed_at: string | null;
  last: { at: string; action: string; actor: { id: number; name: string } | null; values: Record<string, unknown> } | null };
type Ops = { device_type: string; ops: Op[]; recent: { at: string; op: string; action: string; actor: { id: number; name: string } | null }[] };

const OP: Record<string, [string, string, string]> = {  // name, what it does, group
  reboot: ['Restart', 'Restarts the device. Data pauses for about a minute.', 'Everyday'],
  mute: ['Mute alerts', 'Stops new fault alerts for a while.', 'Everyday'],
  auto_reboot: ['Auto restart', 'Restarts by itself when the inverter link freezes.', 'Everyday'],
  fetch_logs: ['Device logs', 'Asks the device to upload its log files.', 'Checks'],
  telemetry_debug: ['Detailed telemetry', 'Keeps extra debug readings for a set time.', 'Checks'],
  diagnostics: ['Diagnostics', 'Checks Wi-Fi, SIM, inverter link and memory.', 'Checks'],
  ota_update: ['Update firmware', 'Installs a chosen version on this device only.', 'Firmware and network'],
  rollback: ['Roll back firmware', 'Returns to the version it ran before. Asks to confirm.', 'Firmware and network'],
  apn: ['Mobile data (APN)', 'Sets the SIM access point. The gateway restarts. Asks to confirm.', 'Firmware and network'],
  meter_interval: ['Publish interval', 'How often the meter sends a reading.', 'Meter'],
  meter_calibrate: ['Calibration', 'Needs a known load switched on. Asks to confirm.', 'Meter'],
  hard_reset: ['Hard reset', 'Wipes settings back to factory. Asks you to confirm.', 'Last resort'],
};
const GROUPS = ['Everyday', 'Checks', 'Firmware and network', 'Meter'];

export default function OperationsTab({ dev, firmware, isDark }: { dev: Dev; firmware: Firmware[] | null; isDark: boolean }) {
  const access = useAccess();
  const { user } = useAuth() as { user?: { id?: number } };
  const [data, setData] = useState<Ops | null | 'failed'>(null);
  const load = useCallback(() => apiService.getDeviceOperations(dev.device_id).then(setData).catch(() => setData('failed')), [dev.device_id]);
  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const who = (o: Op) => (o.last?.actor ? (o.last.actor.id === user?.id ? 'by you' : `by ${o.last.actor.name}`) : '');
  const status = (o: Op): [string, string] => {
    if (!o.last) return ['No record yet', 'dt-state-none'];
    const ran = `${at(o.last.at)} ${who(o)}`;
    switch (o.state) {
      case 'confirmed': return [`Confirmed ${o.confirmed_at ? at(o.confirmed_at) : ''}, sent ${ran}`, 'dt-state-ok'];
      case 'waiting': return [`Sent ${ran}, waiting for the device`, 'dt-state-wait'];
      case 'not_confirmed': return [`Sent ${ran}. Not confirmed after 5 min`, 'dt-state-wait'];
      case 'failed': return [`Sent ${ran}. The device reported a failure`, 'dt-state-wait'];
      default: return [`Sent ${ran}`, 'dt-state-none'];
    }
  };
  const ops = data && data !== 'failed' ? data.ops : [];
  const reset = ops.find(o => o.op === 'hard_reset');

  return (
    <section aria-labelledby="dt-ops-h" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 id="dt-ops-h" style={{ margin: 0, fontSize: 18 }}>Operations</h3>
        <p className="dt-sub" style={{ margin: '4px 0 0', fontSize: 14 }}>When each last ran and whether the device confirmed it. Operations from before 29 Oct have no record.</p>
      </div>
      {data === 'failed' && <p className="dt-sub">Couldn't load the operation history.</p>}
      <div className="dt-ops">
        {GROUPS.map(g => {
          const list = ops.filter(o => OP[o.op]?.[2] === g);
          return list.length ? (
            <div key={g} className="dt-card" style={{ gap: 0, padding: '14px 20px 6px' }}>
              <h4 style={{ margin: '4px 0 6px', fontSize: 15 }}>{g}</h4>
              {list.map(o => { const [text, cls] = status(o); return (
                <div key={o.op} className="dt-op">
                  <span style={{ fontWeight: 500 }}>{OP[o.op][0]}</span>
                  <span className="dt-sub">{OP[o.op][1]}</span>
                  <span className={cls}>{text}</span>
                </div>
              ); })}
            </div>
          ) : null;
        })}
      </div>
      {reset && (
        <div className="dt-card dt-danger" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><span style={{ fontWeight: 600, color: '#B42318' }}>Hard reset</span><span className="dt-sub" style={{ display: 'block' }}>{OP.hard_reset[1]}</span></div>
          <span className={status(reset)[1]}>{status(reset)[0]}</span>
        </div>
      )}
      {access.can('device_control') && (
        <section className="dt-card" aria-label="Run an operation">
          <h4 style={{ margin: 0, fontSize: 15 }}>Run an operation</h4>
          <DevicePage isDark={isDark} dev={dev} firmware={firmware} onDone={load} />
        </section>
      )}
      {data && data !== 'failed' && data.recent.length > 0 && (
        <section className="dt-card" aria-label="Recent operations" style={{ gap: 0 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>Recent operations on this device</h4>
          {data.recent.map((r, i) => (
            <div key={i} className="dt-op" style={{ gridTemplateColumns: '150px minmax(0, 1fr)' }}>
              <span className="dt-num dt-sub">{at(r.at)}</span>
              <span>{OP[r.op]?.[0] ?? r.action} {r.actor ? (r.actor.id === user?.id ? 'by you' : `by ${r.actor.name}`) : ''}</span>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
```

`DevicePage.tsx` changes:
1. Accept an optional `onDone?: () => void` prop and call it after each successful `run(...)` (inside `run`'s success path), so statuses refresh right after a command.
2. Line ~452: `<GatewayActivity deviceId={dev.device_id} isDark={isDark} device={detail} allowCheck={ctl} allowApn={ctl} />` (APN is viewer-allowed since Task A2).
3. For meters (`isMeter`), render the existing meter section inside the controls aside:

```tsx
{isMeter && ctl && detail && (
  <MeterSettingsSection device={{ ...detail, id: dev.device_id }} isDark={isDark}
    intervalMs={detail.meter_publish_interval_ms}
    onIntervalChange={ms => run(() => apiService.updateDevice(dev.device_id, { meter_publish_interval_ms: ms }), ms == null ? 'Interval back to the meter default.' : `Interval set to ${ms / 1000} s. The meter confirms shortly.`)}
    canCalibrate />
)}
```

with `import MeterSettingsSection, { type MeterFields } from '../MeterSettingsSection';` and `MeterFields` merged into the `Detail` type (`type Detail = GatewayFields & Partial<MeterFields> & { … }`). Read `MeterSettingsSection.tsx` first: if it saves the interval itself or expects a form submit, follow its contract instead (it currently reports the chosen value through `onIntervalChange`).

Add to `DevicePage.test.tsx`: O5 (meter + device_control shows "Calibration" controls) and O6 (gateway + device_control passes `allowApn`; assert the APN field label "APN" renders).

- [ ] **Step 4: Run, expect pass**

Run: `npx jest src/features/staff/viewer/__tests__`
Expected: all PASS. Mark O1–O6 `passing`.

- [ ] **Step 5: Checkpoint**

---

### Task B9: Docs, full run, build

**Files:**
- Modify: `CLAUDE.md` (frontend; the `/devices/:deviceId/dashboard` route line and the `viewer/` bullet)

- [ ] **Step 1: Update `CLAUDE.md`**

Route line: `/devices/:deviceId/dashboard   → One device: tabs Overview (chart with detail levels), All values, Every reading (raw rows + packet), Operations (status + controls); ?tab= in the URL; works without a site`.
In the `viewer/` bullet, add: `OverviewChart.tsx` + `deviceChart.ts` (Overview chart, pure helpers), `ReadingsTab.tsx`, `OperationsTab.tsx`; scenarios `docs/test-scenarios/viewer-device-tabs.md`.

- [ ] **Step 2: Run everything**

Run: `npx jest` then `npm run build`
Expected: all tests PASS; build succeeds with no new type errors.

- [ ] **Step 3: Look at it**

Run `npm run dev`, sign in as a viewer with a bench device, and walk the live-verification list in `docs/test-scenarios/viewer-device-tabs.md` (light and dark, 390 px wide). Note anything that differs from mockup board 3.

- [ ] **Step 4: Checkpoint** (owner commits frontend and backend; backend deploys first).

---

## Self-review (done while writing)

- Spec coverage: §5.3 Overview (tiles, range/detail rules, reporting lane with 3 shape states, codes lane, chart, spread band, readout, colours) → A4, A5, B3–B6. All values → B6 (unchanged body). Every reading (paging, jump, columns picker remembered, gap rows, fault tint, split-view packet, closest message, pruned note, meter raw) → A6, B7. Operations (per type, states, no record yet, recent 20, hard reset strip, red only for hard reset, controls hidden without device_control) → A7, B8. §5.0 ligatures, units, tokens → B4, B5, B6. §6.1 → A2. §6.2 → A3. §6.3 → A5. §6.5 → A7. Sampling notice: the detail path never samples (`sampled_every: 1`), so no notice is needed.
- Not in phase 1 (by the spec's phasing): Home, Site, Profile, `/me/operations/`, `/me/access-summary/`.
- Deliberate phase-1 simplifications, each flagged in code with `ponytail:` or above: Python bucketing over raw rows; APN confirmation from heartbeat timing; action buttons stay in `DevicePage` under the status cards; offline-disabled ops rely on the existing `DevicePage`/`GatewayActivity` behaviour (calibration already returns 409 offline and the meter section shows it).
