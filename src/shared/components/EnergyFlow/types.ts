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
