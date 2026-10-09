import { plugRanking, lastSeenText, hourLabels } from './plugHelpers';
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
