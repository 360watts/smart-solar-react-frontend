import React from 'react';
import { Droplets, Wind, Waves, Plug, Car, Refrigerator } from 'lucide-react';
import type { NodeData } from './NodeDetailModal';
import type { SmartDeviceNode, ApplianceLabel } from './types';

// Smart-plug helpers shared by the energy flow (EnergyFlow/index.tsx) and the site panel's Smart plugs tab.

export const applIcon = (label: ApplianceLabel, color: string, size = 15) => {
  const p = { size, color };
  switch (label) {
    case 'ev_charger':      return <Car {...p} />;
    case 'geyser':          return <Droplets {...p} />;
    case 'ac_unit':         return <Wind {...p} />;
    case 'water_pump':      return <Droplets {...p} />;
    case 'washing_machine': return <Waves {...p} />;
    case 'fridge':          return <Refrigerator {...p} />;
    default:                return <Plug {...p} />;
  }
};

const GRID_APPLIANCES: ApplianceLabel[] = ['geyser', 'ac_unit', 'washing_machine', 'fridge'];

export const circuitOf = (d: SmartDeviceNode): 'solar' | 'grid' => {
  if (d.circuit === 'inverter_backup') return 'solar';
  if (d.circuit === 'grid_direct' || d.circuit === 'ev_line') return 'grid';
  return GRID_APPLIANCES.includes(d.appliance_label) ? 'grid' : 'solar';
};

/** A smart device that is a plug-level load (not the whole-home `grid` meter entry). */
export const isPlug = (d: SmartDeviceNode) => d.appliance_label !== 'grid';

/** Which load card / plugs-tab group a plug belongs to. */
export const plugGroup = (d: SmartDeviceNode): 'backup' | 'grid' | 'ev' =>
  d.appliance_label === 'ev_charger' ? 'ev' : circuitOf(d) === 'solar' ? 'backup' : 'grid';

export const deviceLabel = (device: SmartDeviceNode) =>
  (device.display_name || `Device ${device.id}`).split(' — ')[0] || 'Smart device';
const isFreshReading = (timestamp?: string | null) =>
  !!timestamp && Date.now() - new Date(timestamp).getTime() <= 5 * 60 * 1000;
export const freshLatest = (device: SmartDeviceNode) =>
  device.latest && isFreshReading(device.latest.timestamp) ? device.latest : null;

// Ground truth for "is this device actually delivering data" — mirrors
// check_local_poller_health()'s own gate (maintenance_tasks.py): a stale/
// missing SmartDeviceReading is what the backend itself trusts, and only
// consults is_online/poller_consecutive_failures afterward to classify
// *why*, never as an independent trigger. An earlier version of this
// check used is_online/poller_consecutive_failures directly and missed
// coim_002's AC(NEW) plug for hours — Tuya's cloud flag never flipped,
// and the Pi's failure counter kept resetting to 0-1 on intermittent
// partial connectivity, while its last real reading sat over 21 hours
// stale (Sep 5 2026). Reading recency doesn't have that failure mode.
export const isDeviceOffline = (d: SmartDeviceNode): boolean => !isFreshReading(d.latest?.timestamp);

/** Offline (no reading in 5 min), Running (active and drawing > 1 W) or Idle. */
export const plugState = (d: SmartDeviceNode): 'offline' | 'running' | 'idle' =>
  isDeviceOffline(d) ? 'offline' : d.is_active && (freshLatest(d)?.power_w ?? 0) > 1 ? 'running' : 'idle';

// Devices to flag in the anomaly banner. A device that has NEVER reported
// isn't a data anomaly (no reading was ever *wrong* — there just isn't one) —
// it's frequently a rarely-used appliance whose supply is normally switched
// off (coim_002's AC(NEW): is_active, zero readings ever, expected). Mirrors
// check_local_poller_health()'s dormancy exception (maintenance_tasks.py):
// only surface it if no sibling smart device at the site has reported
// recently either, i.e. this looks like the whole feed being down, not one
// plug's own normal silence. Without this gate, AC(NEW) banner'd on every
// load forever regardless of backend incident state — confirmed live, Sep 2026.
export const anomalousDevices = (devices: SmartDeviceNode[]): string[] => {
  const siteIsLive = devices.some(d => isFreshReading(d.latest?.timestamp));
  if (siteIsLive) return [];
  return devices.filter(d => d.is_active && d.latest === null).map(deviceLabel);
};

// Helper to convert device to comprehensive NodeData
export function createDeviceNodeData(device: SmartDeviceNode, accentColor: string): NodeData {
  const latest = freshLatest(device);
  const sdKw = (latest?.power_w ?? 0) / 1000;
  const deviceName = deviceLabel(device);
  const sdActive = device.is_active && sdKw > 0.001;
  // Takes priority over the power-based active/inactive read: an offline
  // device shouldn't show as "inactive" (implies it's just idle) when it's
  // actually disconnected. See isDeviceOffline's doc comment for why this
  // isn't just is_online — Tuya's cloud flag can lag a real LAN outage.
  const offline = isDeviceOffline(device);

  return {
    type: 'device',
    id: `device-${device.id}`,
    title: deviceName,
    subtitle: offline ? 'Offline' : 'Smart Device',
    power_kw: sdKw,
    status: offline ? 'offline' : (sdActive ? 'active' : 'inactive'),
    color: accentColor,
    icon: applIcon(device.appliance_label, accentColor),
    device,
    // Comprehensive data
    current_a: latest?.current_a ?? undefined,
    voltage_v: latest?.voltage_v ?? undefined,
    energy_kwh: latest?.energy_kwh ?? undefined,
    timestamp: latest?.timestamp ?? undefined,
    deviceType: device.device_type,
    circuit: device.circuit,
  };
}
