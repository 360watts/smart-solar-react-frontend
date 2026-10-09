export type DeviceStatus = 'online' | 'offline' | 'unknown';

export type ApplianceLabel =
  | 'ev_charger'
  | 'geyser'
  | 'ac_unit'
  | 'water_pump'
  | 'washing_machine'
  | 'fridge'
  | 'grid'
  | 'other';

export type DeviceType = 'tuya_plug' | 'tuya_switch' | 'ct_clamp' | 'modbus_meter';

export interface SmartDeviceReading {
  power_w: number | null;
  current_a: number | null;
  voltage_v: number | null;
  energy_kwh: number | null;
  switch_on: boolean | null;
  timestamp: string | null;
}

export interface SmartDeviceNode {
  id: number;
  device_type: DeviceType;
  appliance_label: ApplianceLabel;
  display_name: string;
  is_active: boolean;
  /**
   * Tuya's own cloud-side deviceOnline/deviceOffline signal (pushed for
   * pulsar AND local devices, project-wide) — whether the plug's WiFi chip
   * has a live connection to Tuya's servers over the internet. Informational
   * only here: it can stay true while a `local`-mode device is genuinely
   * unreachable on the site LAN, and its own offline detection has real
   * lag — see EnergyFlow/index.tsx's isDeviceOffline for the actual
   * "is this device delivering data" check, which uses reading recency
   * instead (the same ground truth the backend's own health check trusts).
   */
  is_online: boolean;
  /**
   * Consecutive failed local-poll attempts by the on-site Pi (`local`-mode
   * devices only; always 0 otherwise). Informational only — it resets on
   * any single successful poll, so a plug with intermittent partial
   * connectivity can sit at 0-1 indefinitely while genuinely not reporting
   * for hours (confirmed on coim_002's AC(NEW), Sep 5 2026). Don't use this
   * to decide "is this device offline" — see isDeviceOffline in index.tsx.
   */
  poller_consecutive_failures?: number;
  latest: SmartDeviceReading | null;
  /** Which physical circuit the device is on. Defaults to heuristic if absent. */
  circuit?: 'grid_direct' | 'inverter_backup' | 'ev_line';
}

export interface InverterPhases {
  /** Load-side power from inverter load registers */
  l1: { power_w: number | null; voltage_v: number | null; current_a: number | null };
  l2: { power_w: number | null; voltage_v: number | null; current_a: number | null };
  l3: { power_w: number | null; voltage_v: number | null; current_a: number | null };
  /** Grid-side voltage & current — same AC bus as CT meter */
  grid_l1: { voltage_v: number | null; current_a: number | null };
  grid_l2: { voltage_v: number | null; current_a: number | null };
  grid_l3: { voltage_v: number | null; current_a: number | null };
  /** Single aggregate frequency from inverter grid register — no per-phase breakdown */
  grid_frequency_hz: number | null;
  /** Single aggregate power factor from inverter grid register — no per-phase breakdown */
  grid_power_factor: number | null;
}

export interface EnergyFlowBlockProps {
  pvKw: number | null;
  loadKw: number | null;
  gridKw: number | null;
  battKw: number | null;
  battSoc: number | null;
  smartDevices?: SmartDeviceNode[];
  siteId?: string;
  inverterPhases?: InverterPhases;
  ctReading?: any | null;
}
