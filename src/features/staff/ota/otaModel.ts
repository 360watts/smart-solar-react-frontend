// Pure helpers for the OTA page: version order, device update state, which builds fit which devices.
// Rows come from GET /ota/devices/status/ and GET /ota/firmware/?active=false (smart-solar-django-backend ota/views.py).
import { firmwareKind } from '../firmwareImage';

export type DevState = 'ok' | 'wait' | 'download' | 'fail' | 'rollback' | 'none';

export interface OtaDevice {
  serial: string;
  type: string;            // 'gateway' | 'energy_meter'
  chip: string | null;
  site: string | null;
  run: string | null;      // version the device reports
  target: string | null;   // version it is being moved to
  state: DevState;
  pct: number | null;      // download progress, when known
  error: string | null;
  checkedAt: string | null;
}

export interface Build {
  id: number;
  version: string;
  type: string | null;     // 'gateway' | 'energymeter'
  chip: string | null;
  size: number;
  notes: string;
  on: boolean;
  uploadedAt: string;
}

export const STATE_LABEL: Record<DevState, string> = {
  ok: 'Up to date', wait: 'Waiting for device', download: 'Downloading', fail: 'Failed',
  rollback: 'Roll back queued', none: 'Nothing planned',
};

/** Strip a leading "v" and a "-tag" the way the backend's _versions_match does: "v1.0.7-3P" → "1.0.7". */
export const baseVersion = (v: string | null) => (v ?? '').trim().replace(/^v/i, '').split('-')[0];
/** Same version as far as devices are concerned (the backend ignores the tag). */
export const sameVersion = (a: string | null, b: string | null) => !!a && !!b && baseVersion(a) === baseVersion(b);

/** Numeric order; "1.0.8-rc1" sorts just before "1.0.8"; a missing version sorts first. */
export function compareVersions(a: string | null, b: string | null): number {
  if (!a || !b) return (a ? 1 : 0) - (b ? 1 : 0);
  const key = (v: string) => {
    const [base, tag = ''] = v.trim().replace(/^v/i, '').split(/-(.*)/s);
    return { nums: base.split('.').map(n => parseInt(n, 10) || 0), tag };
  };
  const x = key(a), y = key(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d) return Math.sign(d);
  }
  if (x.tag === y.tag) return 0;
  if (!x.tag) return 1;
  if (!y.tag) return -1;
  return x.tag.localeCompare(y.tag, undefined, { numeric: true });
}

/** Moving a device from `from` to `to`: up, down (a downgrade), or same (skipped). Unknown current = up. */
export function direction(from: string | null, to: string): 'up' | 'down' | 'same' {
  if (!from) return 'up';
  if (sameVersion(from, to)) return 'same';
  return compareVersions(to, from) > 0 ? 'up' : 'down';
}

/** A build fits a device when the usage type matches and the chip does not clash (unknown on either side is allowed,
 *  the same rule as the backend's check_chip_compatibility). */
export const fits = (b: Build, d: Pick<OtaDevice, 'type' | 'chip'>) =>
  (!b.type || b.type === firmwareKind(d.type)) && (!b.chip || !d.chip || b.chip === d.chip);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function deviceState(row: any): DevState {
  if (row.pending_rollback) return 'rollback';
  const log = row.log_status as string | null;
  if (row.has_active_target) return log === 'downloading' ? 'download' : log === 'failed' ? 'fail' : 'wait';
  if (log === 'failed') return 'fail';
  if (log === 'completed') return 'ok';
  return 'none';
}

export function toDevice(row: any, builds: Build[]): OtaDevice {
  const state = deviceState(row);
  const size = builds.find(b => b.id === row.log_firmware_id)?.size ?? 0;
  return {
    serial: row.device_serial,
    type: row.device_type ?? 'gateway',
    chip: row.chip ?? null,
    site: row.site_id ?? null,
    run: row.current_firmware ?? null,
    target: row.target_firmware_version ?? null,
    state,
    pct: state === 'download' && size > 0 ? Math.min(100, Math.round(((row.log_bytes_downloaded ?? 0) / size) * 100)) : null,
    error: state === 'fail' ? (row.log_error || 'The update failed') : null,
    checkedAt: row.log_last_checked_at ?? null,
  };
}

export const toBuild = (fw: any): Build => ({
  id: fw.id,
  version: fw.version,
  type: fw.device_type ?? null,
  chip: fw.chip ?? null,
  size: fw.size ?? 0,
  notes: fw.release_notes || fw.description || '',
  on: !!fw.is_active,
  uploadedAt: fw.created_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Devices running this build, judged the way devices are (tag ignored). */
export const runningCount = (b: Build, devices: OtaDevice[]) =>
  devices.filter(d => fits(b, d) && sameVersion(d.run, b.version)).length;
