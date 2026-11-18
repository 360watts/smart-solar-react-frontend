import { buildSlots, cumulative, gapSlots, kwh, stackTops, totalForecast, windowRange, SLOT_MS } from './loadCardModel';

// scenarios: docs/test-scenarios/combined-load-card.md
const S0 = Date.UTC(2026, 10, 17, 0, 30); // 06:00 IST
const DAY = 86_400_000;
const iso = (i: number) => new Date(S0 + i * SLOT_MS).toISOString();
const empty = { actual: [], invFc: [], invFwd: [], gridFc: [] };

describe('windowRange', () => {
  it('W1 today is the solar day', () => expect(windowRange('today', S0)).toEqual([S0, S0 + DAY]));
  it('W2 last 7 days ends with today', () => expect(windowRange('last7', S0)).toEqual([S0 - 6 * DAY, S0 + DAY]));
  it('W3 next 7 days starts tomorrow', () => expect(windowRange('next7', S0)).toEqual([S0 + DAY, S0 + 8 * DAY]));
});

describe('buildSlots', () => {
  const slots = buildSlots([S0, S0 + 4 * SLOT_MS], {
    actual: [{ rawTs: S0 + 60_000, inverter: 0.5, inverterL1: 0.2, inverterL2: 0.2, inverterL3: 0.1, grid: 1.2, ev: null }],
    invFwd: [
      { forecast_for: iso(0), predicted_kw: 9, p10_kw: 8, p90_kw: 10 },
      { forecast_for: iso(3), predicted_kw: 0.7, p10_kw: 0.5, p90_kw: 0.9 },
    ],
    invFc: [{ ts: iso(0), predicted_kw: 0.4, p10_kw: 0.3, p90_kw: 0.6, method: 'r3.2-replay', miss_reason: { text: 'Extra load on L2' } }],
    gridFc: [{ ts: iso(1), predicted_kw: 1.1, p10_kw: 0.9, p90_kw: 1.4, mean_kw: 1.3 }, { ts: iso(2), predicted_kw: 0.2 }],
  });
  it('B1 one slot per 15 min', () => expect(slots.map(s => s.ms)).toEqual([0, 1, 2, 3].map(i => S0 + i * SLOT_MS)));
  it('B2 actual lands in its slot', () => expect(slots[0]).toMatchObject({ inv: 0.5, l2: 0.2, grid: 1.2, ev: null }));
  it('B3 the lead-chosen run overrides the forward forecast', () =>
    expect(slots[0]).toMatchObject({ invP50: 0.4, invP10: 0.3, missReason: 'Extra load on L2', replay: true }));
  it('B4 the forward forecast fills slots the run series lacks', () => expect(slots[3].invP50).toBe(0.7));
  it('B5 grid forecast', () => expect(slots[1]).toMatchObject({ gridP50: 1.1, gridP90: 1.4 }));
  it('B7 grid mean read when sent, else null', () => {
    expect(slots[1].gridMean).toBe(1.3);
    expect(slots[2].gridMean).toBeNull();
  });
  it('B6 rows outside the window are ignored', () =>
    expect(buildSlots([S0, S0 + SLOT_MS], { ...empty, actual: [{ rawTs: S0 - DAY, inverter: 3 }] })[0].inv).toBeNull());
});

describe('gapSlots', () => {
  const withGrid = (grid: (number | null)[]) =>
    buildSlots([S0, S0 + grid.length * SLOT_MS], empty).map((s, i) => ({ ...s, inv: 0.3, grid: grid[i] }));
  const now = S0 + 6 * SLOT_MS + 60_000;
  it('G1 a missing reading in the past is a gap', () =>
    expect([...gapSlots(withGrid([1, null, 1, 1, 1, 1]), ['inv', 'grid'], now)]).toEqual([S0 + SLOT_MS]));
  it('G2 a line with no reading in the window is not flagged', () =>
    expect(gapSlots(withGrid([null, null, null, null, null, null]), ['inv', 'grid'], now).size).toBe(0));
  it('G3 the newest 30 min are not flagged yet', () =>
    expect(gapSlots(withGrid([1, 1, 1, 1, 1, null]), ['inv', 'grid'], now).size).toBe(0));
});

describe('totals', () => {
  it('T1 kWh of 15-min kW', () => expect(kwh([1, null, 2])).toBe(0.75));
  it('T2 cumulative stops after the last value', () => expect(cumulative([1, null, 2, null])).toEqual([0.25, 0.25, 0.75, null]));
});

describe('All view stack and forecast line', () => {
  const slots = buildSlots([S0, S0 + 3 * SLOT_MS], empty);
  Object.assign(slots[0], { inv: 0.5, grid: 1, ev: 2 });
  Object.assign(slots[1], { inv: 0.3, invP50: 0.2, gridP50: 0.3 }); // in progress
  Object.assign(slots[2], { invP50: 0.4, gridP50: 0.6, gridMean: 0.9, ev: 3 });
  const now = S0 + SLOT_MS + 60_000;
  it('S1 finished slots stack; the slot in progress and the future are empty', () =>
    expect(stackTops(slots, now)).toEqual([{ inv: 0.5, invGrid: 1.5, all: 3.5 }, null, null]));
  it('S2 the forecast line is inverter + grid P50 on every slot with a forecast, never EV', () =>
    expect(totalForecast(slots)).toEqual([null, 0.5, 1.0]));
  it('S3 energy mode is a running kWh, grid from its mean', () => {
    const f = totalForecast(slots, true);
    expect(f[0]).toBe(0); expect(f[1]).toBeCloseTo(0.125); expect(f[2]).toBeCloseTo(0.45);
  });
});
