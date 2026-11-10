import { plugRanking, lastSeenText, hourLabels, plugState, circuitLoad, loadOfText, createDeviceNodeData } from './plugHelpers';
import type { SmartDeviceNode } from './types';

const NOW = Date.parse('2026-10-08T11:08:00Z');
const fresh = new Date(NOW - 60_000).toISOString();
const stale = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const plug = (id: number, name: string, w: number | null, kwh: number | null | undefined, ts: string | null = fresh,
  extra: Partial<SmartDeviceNode> = {}): SmartDeviceNode => ({
  id, device_type: 'tuya_plug', appliance_label: 'fridge', display_name: name, is_active: true, is_online: true,
  latest: ts ? { power_w: w, current_a: null, voltage_v: null, energy_kwh: null, switch_on: true, timestamp: ts } : null,
  today: kwh === undefined ? undefined : { kwh_today: kwh, curve_24h: [] },
  ...extra,
});

beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => jest.restoreAllMocks());

describe('plugRanking', () => {
  const ev = plug(1, 'EV Charger', 2680, 3.2, fresh, { appliance_label: 'ev_charger' });
  const fridge = plug(2, 'Fridge 1', 82, 1.9);
  const pump = plug(3, 'Water Pump', 0, 0.3);
  const geyser = plug(4, 'Geyser 1', 900, null, stale(3));

  it('orders running by draw, then idle, then offline last (R1)', () => {
    const r = plugRanking([pump, geyser, fridge, ev]);
    expect(r.live.map(d => d.display_name)).toEqual(['EV Charger', 'Fridge 1', 'Water Pump']);
    expect(r.offline.map(d => d.display_name)).toEqual(['Geyser 1']);
  });

  it('sums fresh draw only, never an offline plug (R2)', () => {
    const r = plugRanking([ev, fridge, pump, geyser]);
    expect(r.nowKw).toBeCloseTo(2.762, 3);
    expect(r.running).toBe(2);
    expect(r.maxKw).toBeCloseTo(2.68, 3);
  });

  it('sums known today figures and flags partial (R4)', () => {
    const r = plugRanking([ev, fridge, geyser]);
    expect(r.todayKwh).toBeCloseTo(5.1, 3);
    expect(r.todayPartial).toBe(true);
    expect(plugRanking([ev, fridge]).todayPartial).toBe(false);
    expect(plugRanking([plug(9, 'X', 5, undefined)]).todayKwh).toBeNull();
  });
});

describe('plugState', () => {
  const ac = (w: number) => plug(1, 'AC', w, 0, fresh, { appliance_label: 'ac_unit' });
  it('reads low draw as Standby per appliance, and does not call it active in the popup (R20)', () => {
    expect(plugState(ac(9))).toBe('standby');
    expect(plugState(plug(2, 'W', 4, 0, fresh, { appliance_label: 'washing_machine' }))).toBe('standby');
    expect(createDeviceNodeData(ac(9), '#000000').status).toBe('inactive');
  });
  it('keeps Running above the threshold, Idle at 1 W or less, and fridges out of Standby (R21)', () => {
    expect(plugState(ac(40))).toBe('running');
    expect(plugState(ac(1))).toBe('idle');
    expect(plugState(plug(3, 'F', 3, 0))).toBe('running');
    expect(createDeviceNodeData(ac(40), '#000000').status).toBe('active');
  });
});

describe('circuitLoad', () => {
  const live = [plug(1, 'a', 96, 0), plug(2, 'b', 9, 0), plug(3, 'old', 500, 0, stale(3))];
  it('compares fresh plugs to the reading', () => {
    const l = circuitLoad(live, 0.64)!;
    expect(l.plugsKw).toBeCloseTo(0.105, 3);
    expect(l.gapKw).toBeCloseTo(0.535, 3);
  });
  it('has no bar without a reading, and never a negative gap', () => {
    expect(circuitLoad(live, null)).toBeNull();
    expect(circuitLoad(live, 0)).toBeNull();
    expect(circuitLoad(live, 0.05)!.gapKw).toBe(0);
  });
  it('uses one unit for both numbers (R19)', () => {
    expect(loadOfText(0.105, 0.64)).toBe('105 of 640 W');
    expect(loadOfText(0.95, 1.2)).toBe('0.95 of 1.20 kW');
  });
});

describe('lastSeenText', () => {
  it('words the age', () => {
    expect(lastSeenText(plug(1, 'a', 0, null, stale(3)))).toBe('Last seen 3 h ago');
    expect(lastSeenText(plug(1, 'a', 0, null, new Date(NOW - 20 * 60_000).toISOString()))).toBe('Last seen 20 min ago');
    expect(lastSeenText(plug(1, 'a', 0, null, null))).toBe('No reading yet');
  });
});

describe('hourLabels', () => {
  it('24 IST hour labels ending at the current hour', () => {
    const l = hourLabels(NOW);
    expect(l).toHaveLength(24);
    expect(l[23]).toBe('4 PM'); // 11:08 UTC = 16:38 IST
    expect(l[22]).toBe('3 PM');
  });
});
