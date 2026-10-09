import { mixShares, flowPaths, lineWidth, fmtPower, railToday, coversWords, wholeHomeKw, homePartsText, Anchors, type HomeToday } from './flowModel';

// docs/test-scenarios/dashboard-redesign.md rows 20-23
describe('railToday', () => {
  const solarDay = { pv_gen_kwh: 5.2, load_kwh: 1.0, grid_import_kwh: 0.4 };
  it('Home used is load_today_kwh (Load tile), not the solar-day load_kwh', () => {
    const r = railToday(solarDay, { load_today_kwh: 3.49, grid_buy_today_kwh: 0.5 }, true);
    expect(r.usedKwh).toBe(3.49);
    expect(r.solarKwh).toBe(5.2);
  });
  it('own power = 1 - grid in / used', () => {
    expect(railToday(null, { load_today_kwh: 4, grid_buy_today_kwh: 1 }, true).ownPct).toBeCloseTo(75, 6);
  });
  it('a reading from an earlier day gives nulls', () => {
    const r = railToday(solarDay, { load_today_kwh: 3.49, grid_buy_today_kwh: 0.5 }, false);
    expect(r.usedKwh).toBeNull();
    expect(r.ownPct).toBeNull();
  });
  it('zero or missing load, or missing grid in: own power null, no NaN', () => {
    expect(railToday(null, { load_today_kwh: 0, grid_buy_today_kwh: 0 }, true).ownPct).toBeNull();
    expect(railToday(null, {}, true)).toEqual({ solarKwh: null, usedKwh: null, ownPct: null, usedPartial: null });
    expect(railToday(null, { load_today_kwh: 2 }, true).ownPct).toBeNull();
    expect(railToday(null, null, true).usedKwh).toBeNull();
  });

  // rows 32-36: whole-home figure from staff_overview.home_today
  const home = (o: Partial<HomeToday>): HomeToday => ({
    date: '2026-10-09', backup_kwh: 3.0, grid_direct_kwh: 2.0, ev_kwh: null, total_kwh: 5.0,
    covers: ['backup', 'grid_direct'], partial: false, ...o,
  });
  it('Home used is home_today.total_kwh, own power uses it as the base', () => {
    const r = railToday(null, { load_today_kwh: 3.0, grid_buy_today_kwh: 1.0 }, true, home({}));
    expect(r.usedKwh).toBe(5.0);
    expect(r.ownPct).toBeCloseTo(80, 6);
    expect(r.usedPartial).toBeNull();
  });
  it('home_today null shows "—", no fallback to the Load tile', () => {
    const r = railToday(null, { load_today_kwh: 3.0, grid_buy_today_kwh: 1.0 }, true, null);
    expect(r.usedKwh).toBeNull();
    expect(r.ownPct).toBeNull();
  });
  it('total_kwh null: used and own power null', () => {
    const r = railToday(null, { load_today_kwh: 3.0, grid_buy_today_kwh: 1.0 }, true, home({ total_kwh: null, covers: [], partial: true }));
    expect(r).toMatchObject({ usedKwh: null, ownPct: null, usedPartial: null });
  });
  it('partial: caption lists what is counted in plain words', () => {
    expect(railToday(null, {}, true, home({ partial: true })).usedPartial).toBe('Backup + Grid direct');
    expect(coversWords(['grid_direct', 'ev'])).toBe('Grid direct + EV');
  });
  it('own power clamps to 0-100 when grid in exceeds the counted total', () => {
    expect(railToday(null, { grid_buy_today_kwh: 9 }, true, home({})).ownPct).toBe(0);
  });
});

const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const first = (d: string) => { const n = nums(d); return { x: n[0], y: n[1] }; };
const last = (d: string) => { const n = nums(d); return { x: n[n.length - 2], y: n[n.length - 1] }; };

describe('mixShares', () => {
  it('charging battery is not a supply', () => {
    const s = mixShares(1.73, -1.33, 0.02)!;
    expect(s.battery).toBe(0);
    expect(s.solar + s.grid).toBeCloseTo(1, 6);
    expect(s.solar).toBeGreaterThan(0.98);
  });
  it('discharging battery counts', () => {
    const s = mixShares(1, 1, 0)!;
    expect(s.solar).toBeCloseTo(0.5);
    expect(s.battery).toBeCloseTo(0.5);
  });
  it('exporting grid is not a supply', () => {
    expect(mixShares(2, 0, -1)!.grid).toBe(0);
  });
  it('null when nothing supplies', () => {
    expect(mixShares(0, 0, 0)).toBeNull();
    expect(mixShares(null, null, null)).toBeNull();
  });
});

describe('lineWidth', () => {
  it('clamps between 2 and 8', () => {
    expect(lineWidth(0)).toBe(2);
    expect(lineWidth(100)).toBe(8);
    expect(lineWidth(-1.5)).toBeCloseTo(2.4, 5);
  });
});

describe('fmtPower', () => {
  it('uses W under 1 kW', () => {
    expect(fmtPower(0.289)).toEqual({ valueStr: '289', unit: 'W' });
    expect(fmtPower(1.734)).toEqual({ valueStr: '1.73', unit: 'kW' });
  });
});

describe('flowPaths', () => {
  const a: Anchors = {
    solar: { x: 120, y: 140 }, batt: { x: 330, y: 140 }, grid: { x: 540, y: 140 },
    ring: { cx: 330, cy: 280, r: 100 },
    loads: [{ x: 120, y: 440 }, { x: 330, y: 440 }, { x: 540, y: 440 }],
  };
  const p = flowPaths(a);
  const onRing = (pt: { x: number; y: number }) =>
    Math.hypot(pt.x - a.ring.cx, pt.y - a.ring.cy);

  it('sources start at their card and end on the ring edge', () => {
    expect(first(p.solar)).toEqual(a.solar);
    expect(onRing(last(p.solar))).toBeCloseTo(a.ring.r, 4);
    expect(first(p.gridIn)).toEqual(a.grid);
    expect(onRing(last(p.gridIn))).toBeCloseTo(a.ring.r, 4);
    expect(first(p.battIn)).toEqual(a.batt);
    expect(onRing(last(p.battIn))).toBeCloseTo(a.ring.r, 4);
  });
  it('reverse paths are the same line the other way', () => {
    expect(first(p.battOut)).toEqual(last(p.battIn));
    expect(last(p.battOut)).toEqual(first(p.battIn));
    expect(last(p.gridOut)).toEqual(first(p.gridIn));
  });
  it('loads start on the ring edge and end at their card', () => {
    p.loads.forEach((d, i) => {
      expect(onRing(first(d))).toBeCloseTo(a.ring.r, 4);
      expect(last(d)).toEqual(a.loads[i]);
    });
  });
});

// docs/test-scenarios/dashboard-redesign.md rows 50-53
describe('wholeHomeKw / homePartsText', () => {
  it('EV only', () => {
    expect(wholeHomeKw(0, 0, 2.68)).toBeCloseTo(2.68, 6);
    expect(homePartsText(0, 0, 2.68)).toBe('EV 2.68 kW');
  });
  it('all three', () => {
    expect(wholeHomeKw(0.237, 1.2, 2.68)).toBeCloseTo(4.117, 6);
    expect(homePartsText(0.237, 1.2, 2.68)).toBe('Backup 237 W · Grid direct 1.20 kW · EV 2.68 kW');
  });
  it('CT reversed counts grid direct as 0', () => {
    expect(wholeHomeKw(0.5, 1.2, 0, true)).toBeCloseTo(0.5, 6);
    expect(homePartsText(0.5, 1.2, 0, true)).toBe('Backup 500 W');
  });
  it('zero gives 0 and empty text', () => {
    expect(wholeHomeKw(0, 0, 0)).toBe(0);
    expect(homePartsText(0, 0, 0)).toBe('');
  });
});
