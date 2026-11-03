// Pure helpers for the slave edit dialog. Limits mirror api/views/device_mgmt.py `_validate_slave_payload`.
import type { RegisterMapping, SlaveFormData } from './SlaveConfigModal';

export type FieldErrors = Record<string, string>;

export const FUNCTION_CODES = [1, 2, 3, 4, 5, 6, 15, 16];
export const DATA_TYPES = ['U16', 'S16', 'U32', 'S32', 'F32', 'U64', 'S64', 'F64', 'BOOL', 'STR'];
export const REGISTER_TYPES = ['Coil', 'Discrete input', 'Input register', 'Holding register'];
export const BYTE_ORDERS = ['Big endian', 'Little endian'];
export const WORD_ORDERS = ['Big', 'Little', 'Mid-big', 'Mid-little'];
export const ACCESS_MODES = ['Read only', 'Read and write', 'Write only'];
export const CATEGORIES = ['Electrical', 'Temperature', 'Status', 'Control', 'Energy', 'Power', 'Other'];

export const blankRegister = (): RegisterMapping => ({
  id: Date.now() + Math.floor(Math.random() * 1000),
  label: '', address: 0, numRegisters: 1, functionCode: 3, registerType: 3, dataType: 0,
  byteOrder: 0, wordOrder: 0, accessMode: 0, scaleFactor: 1, offset: 0, unit: '',
  decimalPlaces: 2, category: 'Electrical', highAlarmThreshold: null, lowAlarmThreshold: null,
  description: '', enabled: true,
});

export const hex = (n: number) => '0x' + Number(n).toString(16).toUpperCase().padStart(4, '0');

const whole = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return v !== '' && v !== null && Number.isInteger(n) && n >= lo && n <= hi;
};

/** Errors keyed by field: slave_id, device_name, polling_interval_ms, timeout_ms, priority, `reg:<id>`. */
export function validateSlave(f: SlaveFormData, existingIds: number[], editing: boolean): FieldErrors {
  const e: FieldErrors = {};
  if (!whole(f.slave_id, 1, 247)) e.slave_id = 'Whole number from 1 to 247';
  else if (!editing && existingIds.includes(Number(f.slave_id))) e.slave_id = `Slave ID ${f.slave_id} is already used`;
  if (!f.device_name.trim()) e.device_name = 'Name is required';
  else if (f.device_name.length > 64) e.device_name = 'At most 64 characters';
  if (!whole(f.polling_interval_ms, 100, 600000)) e.polling_interval_ms = '100 to 600000 ms';
  if (!whole(f.timeout_ms, 50, 60000)) e.timeout_ms = '50 to 60000 ms';
  else if (!e.polling_interval_ms && f.timeout_ms >= f.polling_interval_ms) e.timeout_ms = 'Must be shorter than the poll interval';
  if (f.priority !== undefined && !whole(f.priority, 1, 10)) e.priority = '1 to 10';
  const seen = new Set<number>();
  for (const r of f.registers) {
    if (!r.label.trim()) e[`reg:${r.id}`] = 'Label is required';
    else if (!whole(r.address, 0, 65535)) e[`reg:${r.id}`] = `${r.label}: address must be 0 to 65535`;
    else if (!whole(r.numRegisters, 1, 125)) e[`reg:${r.id}`] = `${r.label}: count must be 1 to 125`;
    else if (!FUNCTION_CODES.includes(Number(r.functionCode))) e[`reg:${r.id}`] = `${r.label}: unsupported function code`;
    else if (seen.has(r.address)) e[`reg:${r.id}`] = `${r.label}: address ${hex(r.address)} is used twice`;
    seen.add(r.address);
  }
  return e;
}

export const toRegisterPayload = (r: RegisterMapping) => ({
  label: r.label, address: r.address, numRegisters: r.numRegisters, functionCode: r.functionCode,
  registerType: r.registerType, dataType: r.dataType, byteOrder: r.byteOrder, wordOrder: r.wordOrder,
  accessMode: r.accessMode, scaleFactor: r.scaleFactor, offset: r.offset, unit: r.unit,
  decimalPlaces: r.decimalPlaces, category: r.category, highAlarmThreshold: r.highAlarmThreshold,
  lowAlarmThreshold: r.lowAlarmThreshold, description: r.description, enabled: r.enabled,
});

/** Request body for POST/PUT /slaves/. Includes `priority`, which the page used to drop. */
export const toSlavePayload = (f: SlaveFormData) => ({
  slave_id: parseInt(f.slave_id),
  device_name: f.device_name.trim(),
  polling_interval_ms: f.polling_interval_ms,
  timeout_ms: f.timeout_ms,
  priority: f.priority ?? 1,
  enabled: f.enabled,
  registers: f.registers.map(toRegisterPayload),
});

const CSV_HEADER = 'label,address,num_registers,function_code,register_type,data_type,byte_order,word_order,access_mode,scale_factor,offset,unit,decimal_places,category,high_alarm_threshold,low_alarm_threshold,description,enabled';

export const registersToCsv = (regs: RegisterMapping[]) =>
  [CSV_HEADER, ...regs.map((r) => [
    r.label, r.address, r.numRegisters, r.functionCode, r.registerType ?? 3, r.dataType, r.byteOrder ?? 0,
    r.wordOrder ?? 0, r.accessMode ?? 0, r.scaleFactor, r.offset, r.unit ?? '', r.decimalPlaces ?? 2,
    r.category ?? '', r.highAlarmThreshold ?? '', r.lowAlarmThreshold ?? '', r.description ?? '', r.enabled,
  ].join(','))].join('\n');

/** CSV in the template layout; returns the good rows and a message per bad row. */
export function parseRegisterCsv(text: string): { valid: RegisterMapping[]; errors: string[] } {
  const valid: RegisterMapping[] = [];
  const errors: string[] = [];
  text.split('\n').filter((l) => l.trim()).slice(1).forEach((line, i) => {
    const c = line.split(',').map((x) => x.trim());
    const num = (k: number, d: number) => (c[k] ? Number(c[k]) : d);
    const r: RegisterMapping = {
      ...blankRegister(), id: Date.now() + i, label: c[0] ?? '', address: num(1, NaN), numRegisters: num(2, 1),
      functionCode: num(3, 3), registerType: num(4, 3), dataType: num(5, 0), byteOrder: num(6, 0), wordOrder: num(7, 0),
      accessMode: num(8, 0), scaleFactor: num(9, 1), offset: num(10, 0), unit: c[11] ?? '', decimalPlaces: num(12, 2),
      category: c[13] || 'Electrical', highAlarmThreshold: c[14] ? Number(c[14]) : null,
      lowAlarmThreshold: c[15] ? Number(c[15]) : null, description: c[16] ?? '',
      enabled: !['false', '0'].includes((c[17] ?? '').toLowerCase()),
    };
    const bad = !r.label ? 'label is required'
      : !whole(r.address, 0, 65535) ? 'address must be 0 to 65535'
      : !whole(r.numRegisters, 1, 125) ? 'count must be 1 to 125'
      : !FUNCTION_CODES.includes(r.functionCode) ? 'unsupported function code' : '';
    if (bad) errors.push(`Row ${i + 2}: ${bad}`); else valid.push(r);
  });
  return { valid, errors };
}
