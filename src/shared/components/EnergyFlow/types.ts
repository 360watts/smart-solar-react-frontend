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
   * has a live connection to Tuya's servers over the internet. This can
   * stay true while a `local`-mode device is genuinely unreachable on the
   * site LAN (a different network, checked separately below) — Tuya's
   * offline detection has its own lag and only reflects internet
   * connectivity, not whether our on-site Pi can actually reach the plug.
   * Always true for poll-mode devices, which have no equivalent signal.
   */
  is_online: boolean;
  /**
   * Consecutive failed local-poll attempts by the on-site Pi (`local`-mode
   * devices only; always 0 otherwise). Mirrors the backend's own
   * `smart_device_offline` incident logic (LOCAL_POLLER_OFFLINE_FAILURE_THRESHOLD,
   * default 3) — the more trustworthy "is this appliance actually off"
   * signal for a locally-polled device than `is_online` alone, since it
   * reflects real LAN reachability rather than Tuya's cloud-side view.
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
