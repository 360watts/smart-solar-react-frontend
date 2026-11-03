import { blankRegister, parseRegisterCsv, toSlavePayload, validateSlave } from '../slaveForm';
import type { SlaveFormData } from '../SlaveConfigModal';

const reg = (id: number, over: any = {}) => ({ ...blankRegister(), id, label: `R${id}`, address: id, ...over });
const form = (over: Partial<SlaveFormData> = {}): SlaveFormData => ({
  slave_id: '1', device_name: 'Inverter', polling_interval_ms: 5000, timeout_ms: 1000, priority: 1, enabled: true,
  registers: [reg(1)], ...over,
});

describe('validateSlave', () => {
  it('E1 accepts a valid form', () => expect(validateSlave(form(), [], false)).toEqual({}));
  it('E2 rejects slave ids outside 1 to 247', () => {
    for (const bad of ['0', '248', 'abc', '']) expect(validateSlave(form({ slave_id: bad }), [], false).slave_id).toBeTruthy();
  });
  it('E3 duplicate id only matters for a new slave', () => {
    expect(validateSlave(form(), [1], false).slave_id).toMatch(/already used/);
    expect(validateSlave(form(), [1], true).slave_id).toBeUndefined();
  });
  it('E4 timeout must be shorter than the poll interval', () =>
    expect(validateSlave(form({ timeout_ms: 6000 }), [], false).timeout_ms).toMatch(/shorter/));
  it('E5 checks every register', () => {
    const bad = [reg(1, { label: '' }), reg(2, { address: 70000 }), reg(3, { numRegisters: 0 }), reg(4, { functionCode: 7 }), reg(5, { address: 9 }), reg(6, { address: 9 })];
    const e = validateSlave(form({ registers: bad }), [], false);
    expect(Object.keys(e).filter((k) => k.startsWith('reg:')).length).toBe(5);
  });
});

describe('payloads', () => {
  it('E6 sends priority', () => expect(toSlavePayload(form({ priority: 4 })).priority).toBe(4));
  it('E7 csv keeps good rows and names bad ones', () => {
    const csv = 'label,address\nBattery SOC,184,1,3\n,5\nToo far,70000';
    const { valid, errors } = parseRegisterCsv(csv);
    expect(valid.map((r) => r.label)).toEqual(['Battery SOC']);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/^Row 3/);
  });
});
