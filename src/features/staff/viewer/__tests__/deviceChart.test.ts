import { ALLOWED, colorsFor, duration, hexCode, val, fitDetail, nearestIndex, niceTicks, segments, GATEWAY_READINGS, METER_READINGS } from '../deviceChart';

describe('deviceChart helpers', () => {
  it('C1/C2 offers only sensible detail levels and refits on range change', () => {
    expect(ALLOWED[6]).toEqual(['1m', '5m']);
    expect(fitDetail(24, 'every')).toBe('5m');
    expect(fitDetail(1, '5m')).toBe('5m');
  });

  it('C3 rounds ticks and includes zero when asked', () => {
    expect(niceTicks(1.2, 1.6, true).ticks).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(niceTicks(229.1, 232.4, false).ticks).toEqual([229, 230, 231, 232, 233]);
    expect(niceTicks(5, 5, false).ticks.length).toBeGreaterThan(1);
  });

  it('C4 splits a line where readings stopped', () => {
    const t = (s: number) => new Date(Date.UTC(2026, 9, 29, 8, 0, s)).toISOString();
    const pts = [0, 2, 4, 64, 66].map(s => ({ t: t(s), v: 1 }));
    expect(segments(pts, 'v', 6000).map(s => s.length)).toEqual([3, 2]);
    expect(segments([{ t: t(0) }, { t: t(2), v: 1 }], 'v', 6000).map(s => s.length)).toEqual([1]);
  });

  it('C5 uses phase colours by name, else blue/ochre, else teal', () => {
    expect(colorsFor(['R', 'Y', 'B'])).toEqual(['var(--dc-r)', 'var(--dc-y)', 'var(--dc-b)']);
    expect(colorsFor(['String 1', 'String 2'])).toEqual(['var(--dc-b)', 'var(--dc-y)']);
    expect(colorsFor(['Grid'])).toEqual(['var(--dc-one)']);
  });

  it('lists eight readings per device type, each with at most three keys', () => {
    for (const list of [GATEWAY_READINGS, METER_READINGS]) {
      expect(list).toHaveLength(8);
      list.forEach(r => expect(r.keys.length).toBeLessThanOrEqual(3));
    }
  });

  it('C9 formats durations, hex codes and series values', () => {
    expect(duration(119.6)).toBe('2 min 0 s');
    expect(duration(3599.6)).toBe('1 h 0 min');
    expect(duration(9.96)).toBe('10 s');
    expect(duration(2)).toBe('2.0 s');
    expect(duration(252)).toBe('4 min 12 s');
    expect(niceTicks(0.12, 0.47, false).ticks).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(hexCode(4)).toBe('0x0004');
    expect(hexCode(-1)).toBe('0xFFFFFFFF');
    expect(val({ t: 'x', a: 1, b: 'z' }, 'a')).toBe(1);
    expect(val({ t: 'x', a: 1, b: 'z' }, 'b')).toBeUndefined();
  });
});

describe('nearestIndex', () => {
  it('picks the closer neighbour, clamps at the ends, -1 when empty', () => {
    const ts = [0, 10, 20];
    expect(nearestIndex(ts, 4)).toBe(0);
    expect(nearestIndex(ts, 6)).toBe(1);
    expect(nearestIndex(ts, 99)).toBe(2);
    expect(nearestIndex(ts, -5)).toBe(0);
    expect(nearestIndex([], 1)).toBe(-1);
  });
});
