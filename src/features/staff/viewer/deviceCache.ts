import { apiService } from '../../../services/api';
import type { Dev, Firmware } from './DevicePage';

// Shared reads for the viewer Devices tab and device page: one gateway-status call per site per minute, one firmware list per session.
// Same-minute callers share the in-flight promise; a failed call is not cached.
const TTL = 60_000;
const sites = new Map<string, { at: number; p: Promise<Dev[]> }>();
let fw: Promise<Firmware[] | null> | null = null;

export function getSiteDevices(siteId: string, force = false): Promise<Dev[]> {
  const hit = sites.get(siteId);
  if (hit && !force && Date.now() - hit.at < TTL) return hit.p;
  const p = apiService.getSiteGatewayStatus(siteId).then(r => (Array.isArray(r?.devices) ? (r.devices as Dev[]) : []));
  sites.set(siteId, { at: Date.now(), p });
  p.catch(() => sites.delete(siteId));
  return p;
}

/** Cached devices if still fresh, for an instant first paint; null when none. */
export function peekSiteDevices(siteId: string): Promise<Dev[]> | null {
  const hit = sites.get(siteId);
  return hit && Date.now() - hit.at < TTL ? hit.p : null;
}

/** null = the list is not available to this role (employee-only route). */
export function getFirmware(): Promise<Firmware[] | null> {
  fw ??= apiService.getFirmwareVersions(true).then(r => (Array.isArray(r) ? (r as Firmware[]) : null)).catch(() => { fw = null; return null; });
  return fw;
}

export function clearDeviceCache() { sites.clear(); fw = null; }
if (typeof window !== 'undefined') window.addEventListener('360w:logout', clearDeviceCache);
