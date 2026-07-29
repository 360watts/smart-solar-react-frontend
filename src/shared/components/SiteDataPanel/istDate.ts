import { IST_TIMEZONE } from '../../../app/constants';

const IST = IST_TIMEZONE;

export function istDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: IST });
}

// Solar day starts at 6am IST — if we're before 6am, use yesterday's 6am so the
// chart always shows the most recent full solar day window.
export function startOfSolarDayIST(): string {
  const now = new Date();
  const todayStr = istDate(now);
  const todaySolar = new Date(`${todayStr}T06:00:00+05:30`);
  if (now < todaySolar) {
    return new Date(todaySolar.getTime() - 24 * 3600 * 1000).toISOString();
  }
  return todaySolar.toISOString();
}

/** The solar day that starts at startOfSolarDayIST() runs until 6am IST the
 * following calendar day — used as the upper bound so "today"'s vs-actual
 * chart keeps showing the forecast curve overnight, not just up to the last
 * actual reading. */
export function endOfSolarDayIST(): string {
  return new Date(new Date(startOfSolarDayIST()).getTime() + 24 * 3600 * 1000).toISOString();
}

export function istDateOffset(n: number): string {
  const IST_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = Date.now() + IST_MS;
  const istMidnightMS = Math.floor(nowIST / 86400000) * 86400000;
  return istDate(new Date(istMidnightMS + n * 86400000 - IST_MS));
}
