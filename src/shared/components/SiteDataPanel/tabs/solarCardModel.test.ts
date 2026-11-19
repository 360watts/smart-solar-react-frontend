import { buildSlots, dailyTotals, forecastDays, istMidnight, todayKpis, trimNight, DAY_MS, SLOT_MS, type SolarSlot } from './solarCardModel';

// scenarios: docs/test-scenarios/solar-forecast-card.md (M1-M5)
const DAY = Date.UTC(2026, 10, 17, 18, 30); // Nov 18 00:00 IST
const iso = (ms: number) => new Date(ms).toISOString();
const slot = (o: Partial<SolarSlot>): SolarSlot => ({ ms: 0, actual: null, p10: null, p50: null, p90: null, physics: null, ghi: null, ...o });

describe('solarCardModel', () => {
  it('istMidnight finds the IST day start', () => {
    expect(istMidnight(DAY + 13 * 3_600_000)).toBe(DAY);
    expect(istMidnight(DAY - 1)).toBe(DAY - DAY_MS);
  });

  it('M1 builds the day; the in-progress slot has no actual', () => {
    const t0 = DAY + 12 * 3_600_000;
    const ts = [0, 1, 2].map(i => ({ slot_ts: iso(t0 + i * SLOT_MS), actual_kw: 2, predicted_kw: 2.5, p10_kw: 1.5, p90_kw: 3 }));
    const now = t0 + 2 * SLOT_MS + 60_000;
    const s = buildSlots(DAY, DAY + DAY_MS, ts, [{ forecast_for: iso(t0), p50_kw: 9, ghi_input_wm2: 700 }], now);
    expect(s).toHaveLength(96);
    const i = 48;
    expect(s[i].actual).toBe(2);
    expect(s[i].p50).toBe(2.5);      // accuracy series wins
    expect(s[i].ghi).toBe(700);      // GHI from the forecast rows
    expect(s[i + 2].actual).toBeNull();
    expect(s[i + 2].p50).toBe(2.5);
  });

  it('M2 trims the night, one slot of padding', () => {
    const s = [0, 0, 1, 2, 0, 0].map((v, i) => slot({ ms: i, p50: v }));
    expect(trimNight(s).map(x => x.ms)).toEqual([1, 2, 3, 4]);
  });

  it('M3 today KPIs', () => {
    const s = [
      slot({ actual: 2, p50: 2, p10: 1, p90: 3 }),
      slot({ actual: 4, p50: 2, p10: 1, p90: 3 }),
      slot({ p50: 4, p10: 2, p90: 6 }),
    ];
    const k = todayKpis(s);
    expect(k.soFar).toBeCloseTo(1.5);
    expect(k.expected).toBeCloseTo(2);
    expect(k.diffPct).toBe(50);
    expect(k.inBand).toBe(1);
    expect(k.scored).toBe(2);
    expect(k.lo).toBeCloseTo(1);
    expect(k.hi).toBeCloseTo(3);
  });

  it('M5 no band: range left out', () => {
    const k = todayKpis([slot({ actual: 1, p50: 1 })]);
    expect(k.lo).toBeNull();
    expect(k.scored).toBe(0);
  });

  it('M4 daily totals: full days compare like for like, today partial', () => {
    const now = DAY + 12 * 3_600_000;
    const yday = DAY - DAY_MS + 12 * 3_600_000;
    const ts = [
      { slot_ts: iso(yday), actual_kw: 4, predicted_kw: 8, p10_kw: 4, p90_kw: 12 },
      { slot_ts: iso(yday + SLOT_MS), actual_kw: null, predicted_kw: 8 },          // gap: not counted
      { slot_ts: iso(now - SLOT_MS), actual_kw: 2, predicted_kw: 2 },
      { slot_ts: iso(now + 3_600_000), actual_kw: null, predicted_kw: 4 },          // future: today's forecast
    ];
    const d = dailyTotals(ts, now);
    expect(d).toHaveLength(7);
    expect(d[5]).toMatchObject({ ms: DAY - DAY_MS, actual: 1, p50: 2, p10: 1, p90: 3, partial: false });
    expect(d[6].partial).toBe(true);
    expect(d[6].actual).toBeCloseTo(0.5);
    expect(d[6].p50).toBeCloseTo(1.5);
    expect(d[0].actual).toBe(0);
  });

  it('M6 forecast days: next days only, forecast only, empty days skipped', () => {
    const now = DAY + 12 * 3_600_000;
    const f = [
      { forecast_for: iso(DAY + 13 * 3_600_000), p50_kw: 9 },                                   // today: not a next day
      { forecast_for: iso(DAY + DAY_MS + 12 * 3_600_000), p50_kw: 4, p10_kw: 2, p90_kw: 6 },
      { forecast_for: iso(DAY + DAY_MS + 20 * 3_600_000), p50_kw: 0 },                          // night: day is complete
      { forecast_for: iso(DAY + 3 * DAY_MS + 12 * 3_600_000), p50_kw: 8 },
      { forecast_for: iso(DAY + 3 * DAY_MS + 20 * 3_600_000), p50_kw: 0 },
    ];
    const d = forecastDays(f, now);
    expect(d.map(x => x.ms)).toEqual([DAY + DAY_MS, DAY + 3 * DAY_MS]);
    expect(d[0]).toMatchObject({ actual: null, future: true, p50: 1, p10: 0.5, p90: 1.5 });
    expect(d[1].p10).toBeNull();
  });

  it('M7 forecast days: a day cut off before sunset (48 h horizon) is left out', () => {
    const now = DAY + 12 * 3_600_000;
    const f = [
      { forecast_for: iso(DAY + DAY_MS + 12 * 3_600_000), p50_kw: 4 },
      { forecast_for: iso(DAY + DAY_MS + 20 * 3_600_000), p50_kw: 0 },
      { forecast_for: iso(DAY + 2 * DAY_MS + 9 * 3_600_000), p50_kw: 3 },                       // last slot still sunny: partial
    ];
    expect(forecastDays(f, now).map(x => x.ms)).toEqual([DAY + DAY_MS]);
  });

  it('M8 daily range: with a backend band the range is P50 x lo/hi; without one the slot sums stay', () => {
    const t0 = DAY + 12 * 3_600_000;
    const ts = [0, 1].map(k => ({ slot_ts: iso(t0 + k * SLOT_MS), actual_kw: 2, predicted_kw: 4, p10_kw: 1, p90_kw: 9 }));
    const now = DAY + DAY_MS + 3_600_000;          // the next IST day, so the rows above are a full past day
    const day = (b?: any) => dailyTotals(ts, now, 2, b)[0];
    expect(day().p10).toBeCloseTo(0.5);            // 2 slots x 1 kW x 0.25 h: summed slots
    const d = day({ lo: 0.75, hi: 1.25 });
    expect(d.p10).toBeCloseTo(d.p50 * 0.75);
    expect(d.p90).toBeCloseTo(d.p50 * 1.25);
    expect(day({ lo: 0, hi: 1 }).p10).toBeCloseTo(0.5);   // an unusable band is ignored
    const fc = [0, 1].map(k => ({ forecast_for: iso(DAY + DAY_MS + 12 * 3_600_000 + k * SLOT_MS), p50_kw: 4, p10_kw: 1, p90_kw: 9 }))
      .concat([{ forecast_for: iso(DAY + DAY_MS + 20 * 3_600_000), p50_kw: 0, p10_kw: 0, p90_kw: 0 }]);
    const f = forecastDays(fc, DAY + 3_600_000, 3, { lo: 0.8, hi: 1.2 })[0];
    expect(f.p90).toBeCloseTo(f.p50 * 1.2);
  });
});
