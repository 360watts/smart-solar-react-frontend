import {
  addDays, buildFlags, calendarCells, change, customRange, daysOf, periodRange, prevRange, sentence, slotsToFlows,
  totals, unbalanced, weeks,
} from './historyModel';
import type { HouseDay, HouseSlot } from '../../../../services/api';

// scenarios: docs/test-scenarios/history-tab-redesign.md (M1-M9)
const NOW = Date.parse('2026-11-19T06:00:00Z'); // 11:30 IST
const day = (date: string, o: Partial<HouseDay> = {}): HouseDay => ({
  date, source: '5min', whole_home: true, coverage: 1, pv_kwh: 30, home_kwh: 30, from_solar_kwh: 12,
  from_battery_kwh: 6, from_grid_kwh: 12, bought_kwh: 12, solar_to_battery_kwh: 8, exported_kwh: 10, soc_min: 25, soc_max: 95, ...o,
});

describe('historyModel', () => {
  it('M1 period ranges in IST', () => {
    expect(periodRange('today', 0, NOW)).toEqual({ start: '2026-11-19', end: '2026-11-19', len: 1 });
    expect(periodRange('7d', 0, NOW)).toEqual({ start: '2026-11-13', end: '2026-11-19', len: 7 });
    expect(periodRange('7d', -1, NOW)).toEqual({ start: '2026-11-06', end: '2026-11-12', len: 7 });
    expect(prevRange(periodRange('30d', 0, NOW))).toEqual({ start: '2026-09-21', end: '2026-10-20', len: 30 });
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('M2 whole-home days only when there are any', () => {
    const t = totals([day('a'), day('b'), day('c'), day('d', { whole_home: false, home_kwh: 14 })]);
    expect([t.basis, t.counted, t.of, t.home, t.ownPct]).toEqual(['whole', 3, 4, 90, 60]);
  });

  it('M3 inverter basis when no whole day', () => {
    const t = totals([day('a', { whole_home: false }), day('b', { whole_home: false, home_kwh: null })]);
    expect([t.basis, t.counted, t.of]).toEqual(['inverter', 1, 2]);
  });

  it('M4 slots summed up to a clock time', () => {
    const s = (ts: string, home: number): HouseSlot => ({
      ts, whole_home: true, pv_kw: 0, home_kw: home, from_solar_kw: 0, from_battery_kw: 0, from_grid_kw: home, bought_kw: home,
      solar_to_battery_kw: 0, exported_kw: 0, inverter_kw: home, grid_board_kw: 0, inv_out_kw: 0, soc: 50,
    });
    const f = slotsToFlows([s('2026-11-18T00:00:00Z', 2), s('2026-11-18T00:15:00Z', 4), s('2026-11-18T06:00:00Z', 8)],
      Date.parse('2026-11-18T06:00:00Z'));
    expect([f.home_kwh, f.from_grid_kwh, f.whole_home]).toEqual([1.5, 1.5, true]);
  });

  it('M5 incident flag covers its days', () => {
    const r = periodRange('7d', 0, NOW);
    const { list } = buildFlags([], [{ at: '2026-11-15T04:00:00Z', ended: '2026-11-17T10:00:00Z', kind: 'incident', title: 'Inverter offline', severity: 'critical' } as any], r, true, '2026-11-19');
    expect(list).toHaveLength(1);
    expect([list[0].tone, list[0].dates]).toEqual(['amber', ['2026-11-15', '2026-11-16', '2026-11-17']]);
  });

  it('M10 repeated incidents collapse into one row per title', () => {
    const r = periodRange('7d', 0, NOW);
    const off = (at: string, serial: string, ended: string | null) => ({ at, ended, kind: 'incident', title: 'Device Offline', severity: 'warning', serial } as any);
    const { list } = buildFlags([], [
      off('2026-11-19T03:00:00Z', 'GW-1', '2026-11-19T03:20:00Z'),
      off('2026-11-19T04:30:00Z', 'GW-1', '2026-11-19T04:40:00Z'),
      off('2026-11-19T05:10:00Z', 'EM-115', null),
      { at: '2026-11-19T02:00:00Z', ended: null, kind: 'incident', title: 'Smart Device — No Data', severity: 'info', serial: null } as any,
    ], r, true, '2026-11-19');
    expect(list.map(f => [f.title, f.count, f.open])).toEqual([['Device Offline', 3, 1], ['Smart Device — No Data', 1, 1]]);
    expect([list[0].when, list[0].detail]).toEqual(['Thu, 19 Nov 08:30–10:40', 'Devices GW-1, EM-115 · 1 still open']);
    expect([list[1].tone, list[1].when, list[1].detail]).toEqual(['grey', 'Thu, 19 Nov 07:30', 'Still open']);
  });

  it('M6 gap and battery flags', () => {
    const r = periodRange('7d', 0, NOW);
    const { list, checks } = buildFlags([day('2026-11-14', { coverage: 0.6, soc_min: 40, soc_max: 45 })], [], r, true, '2026-11-19');
    expect(list.map(f => [f.kind, f.tone])).toEqual([['gap', 'grey'], ['battery', 'amber']]);
    expect(checks).toBe(3);
  });

  it('M7 sentence', () => {
    const cur = totals([day('a')]);
    expect(sentence(cur, totals([day('b', { from_solar_kwh: 9 })]), 'Today')).toBe(
      'Today the home ran 60% on its own power (solar + battery), up from 50%. It bought 12.0 kWh from the grid and sent 10.0 kWh back.');
    expect(sentence(totals([day('a', { whole_home: false })]), null, 'Today')).toMatch(/^Today the inverter circuits ran 60%/);
    expect(change(12, 10)).toBe(20);
    expect(change(5, 0)).toBeNull();
  });

  it('M8 calendar cells, Monday first, grid inverted', () => {
    const r = { start: '2026-10-21', end: '2026-11-19', len: 30 }; // Oct 21 2026 is a Wednesday
    const days = [day('2026-10-21', { bought_kwh: 5 }), day('2026-10-22', { bought_kwh: 15 })];
    const cells = calendarCells(days, r, 'grid', new Set(['2026-10-22']));
    expect(cells.slice(0, 2).every(c => c.date === null)).toBe(true);
    expect([cells[2].date, cells[2].level, cells[3].level, cells[3].flagged]).toEqual(['2026-10-21', 4, 0, true]);
    expect(cells).toHaveLength(32);
  });

  it('M9 custom range, weekly rows, balance check', () => {
    const r = customRange('2026-08-22', '2026-11-19', 0);
    expect(r.len).toBe(90);
    expect(customRange('2026-08-22', '2026-11-19', -1)).toEqual({ start: '2026-05-24', end: '2026-08-21', len: 90 });
    const w = weeks(daysOf(r).map(d => day(d)), r);
    expect(w).toHaveLength(13);
    expect([w[0].date, w[0].home_kwh, w[12].home_kwh]).toEqual(['2026-08-22', 210, 180]); // 7 days, then the last 6
    expect(unbalanced(totals([day('a')]))).toBe(false);
    expect(unbalanced(totals([day('a', { pv_kwh: 40 })]))).toBe(true);
  });
});
