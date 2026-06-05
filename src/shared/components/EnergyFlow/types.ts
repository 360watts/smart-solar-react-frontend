export type DeviceStatus = 'online' | 'offline' | 'unknown';

export type ApplianceLabel =
  | 'ev_charger'
  | 'geyser'
  | 'ac_unit'
  | 'water_pump'
  | 'washing_machine'
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
  circuit?: 'solar' | 'grid';
}

export interface EnergyFlowBlockProps {
  pvKw: number | null;
  loadKw: number | null;
  gridKw: number | null;
  battKw: number | null;
  battSoc: number | null;
  smartDevices?: SmartDeviceNode[];
}
