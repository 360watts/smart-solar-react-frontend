import { daysSince } from './pipelineStats';

describe('daysSince', () => {
  it('returns 0 for a timestamp from right now', () => {
    const now = new Date('2026-07-14T12:00:00Z');
    expect(daysSince('2026-07-14T12:00:00Z', now)).toBe(0);
  });

  it('returns whole days elapsed, rounding down', () => {
    const now = new Date('2026-07-14T12:00:00Z');
    expect(daysSince('2026-07-09T00:00:00Z', now)).toBe(5);
  });
});
