/**
 * Pure helpers for the Solar card (Forecast tab). Scenarios: docs/test-scenarios/solar-forecast-card.md.
 * Slots are 15 min; days are IST calendar days.
 */
export const SLOT_MS = 15 * 60 * 1000;
export const DAY_MS = 24 * 3_600_000;
const IST_MS = 5.5 * 3_600_000;

export type SolarWindow = 'day' | 'daily';

export interface SolarSlot {
  ms: number;
  actual: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  physics: number | null;
  ghi: number | null;
}

export interface SolarDay {
  ms: number;          // IST midnight
  actual: number | null; // kWh; null on a forecast-only (future) day
  p50: number;         // kWh over the same slots as actual (full days) or the whole day (today)
  p10: number | null;
  p90: number | null;
  partial: boolean;    // today
  future?: boolean;    // forecast only
}

const num = (v: any): number | null => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const slotOf = (r: any): number => new Date(r.slot_ts ?? r.ts ?? r.forecast_for ?? String(r.timestamp ?? '').replace('FORECAST#', '')).getTime();

/** IST midnight at or before ms. */
export const istMidnight = (ms: number) => Math.floor((ms + IST_MS) / DAY_MS) * DAY_MS - IST_MS;

/**
 * 15-min slots for [start, end): actual and forecast from the accuracy timeseries, GHI (and any forecast the
 * timeseries lacks) from the forecast rows. The slot still in progress gets no actual: a part-filled average
 * would read as a false drop at now.
 */
export function buildSlots(start: number, end: number, ts: any[], forecast: any[], nowMs: number): SolarSlot[] {
  const byMs = new Map<number, SolarSlot>();
  for (let ms = start; ms < end; ms += SLOT_MS) byMs.set(ms, { ms, actual: null, p10: null, p50: null, p90: null, physics: null, ghi: null });
  const at = (ms: number) => byMs.get(Math.floor(ms / SLOT_MS) * SLOT_MS);
  for (const r of forecast ?? []) {
    const s = at(slotOf(r));
    if (!s) continue;
    s.p50 = num(r.p50_kw); s.p10 = num(r.p10_kw); s.p90 = num(r.p90_kw);
    s.physics = num(r.physics_baseline_kw); s.ghi = num(r.ghi_input_wm2);
  }
  // the accuracy series carries the latest calibrated run per slot: it wins over the forecast rows
  for (const r of ts ?? []) {
    const s = at(slotOf(r));
    if (!s) continue;
    if (num(r.predicted_kw) != null) s.p50 = num(r.predicted_kw);
    if (num(r.p10_kw) != null) s.p10 = num(r.p10_kw);
    if (num(r.p90_kw) != null) s.p90 = num(r.p90_kw);
    if (num(r.physics_baseline_kw) != null) s.physics = num(r.physics_baseline_kw);
    if (actualOf(r) != null && s.ms + SLOT_MS <= nowMs) s.actual = actualOf(r);
  }
  return Array.from(byMs.values());
}

/** Drop the night: slots before the first and after the last with forecast or actual above zero (one slot kept each side). */
export function trimNight(slots: SolarSlot[]): SolarSlot[] {
  const lit = (s: SolarSlot) => (s.p50 ?? 0) > 0 || (s.actual ?? 0) > 0 || (s.p90 ?? 0) > 0;
  const first = slots.findIndex(lit);
  if (first < 0) return slots;
  let last = slots.length - 1;
  while (last > first && !lit(slots[last])) last--;
  return slots.slice(Math.max(0, first - 1), Math.min(slots.length, last + 2));
}

/** Measured power of a slot: PV-AC (what the forecast predicts); the DC reading only for a backend that doesn't send it. */
const actualOf = (r: any) => num(r.actual_ac_kw) ?? num(r.actual_kw);

const kwh = (vals: (number | null)[]) => vals.reduce<number>((t, v) => t + (v ?? 0), 0) * (SLOT_MS / 3_600_000);

export interface TodayKpis {
  soFar: number;
  expected: number;               // whole-day P50
  lo: number | null; hi: number | null;
  diffPct: number | null;         // actual vs P50 over finished slots that have both
  inBand: number; scored: number; // finished slots inside P10–P90 / with a band
}

export function todayKpis(slots: SolarSlot[]): TodayKpis {
  const done = slots.filter(s => s.actual != null);
  const both = done.filter(s => s.p50 != null);
  const fcSoFar = kwh(both.map(s => s.p50));
  const banded = done.filter(s => s.p10 != null && s.p90 != null);
  const hasBand = slots.some(s => s.p10 != null && s.p90 != null);
  return {
    soFar: kwh(done.map(s => s.actual)),
    expected: kwh(slots.map(s => s.p50)),
    // summed slot quantiles are wider than a true daily P10–P90; shown as "likely", not as P10–P90
    lo: hasBand ? kwh(slots.map(s => s.p10)) : null,
    hi: hasBand ? kwh(slots.map(s => s.p90)) : null,
    diffPct: fcSoFar > 0.05 ? Math.round(((kwh(both.map(s => s.actual)) - fcSoFar) / fcSoFar) * 100) : null,
    inBand: banded.filter(s => s.actual! >= s.p10! && s.actual! <= s.p90!).length,
    scored: banded.length,
  };
}

/** Daily error-ratio band from the backend (`forecast-accuracy` `daily_range`): a day's range is its P50 × lo / hi. */
export type DailyBand = { lo: number; hi: number } | null | undefined;
export const bandOf = (b: DailyBand) => (b && Number.isFinite(b.lo) && Number.isFinite(b.hi) && b.lo > 0 && b.hi >= b.lo ? b : null);

/** One row per IST day, oldest first, for `days` days ending today. With `band`, the range is P50 × band, not summed slots. */
export function dailyTotals(ts: any[], nowMs: number, days = 7, band?: DailyBand): SolarDay[] {
  const bd = bandOf(band);
  const today = istMidnight(nowMs);
  const out: SolarDay[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const ms = today - d * DAY_MS;
    const rows = (ts ?? []).map(r => ({ r, t: slotOf(r) })).filter(({ t }) => t >= ms && t < ms + DAY_MS).map(({ r }) => r);
    const partial = d === 0;
    // full days: forecast over the slots that were measured, so a data gap does not read as underperformance
    const fcRows = partial ? rows : rows.filter(r => actualOf(r) != null);
    const slotBand = fcRows.some(r => num(r.p10_kw) != null && num(r.p90_kw) != null);
    const p50 = kwh(fcRows.map(r => num(r.predicted_kw)));
    out.push({
      ms, partial,
      actual: kwh(rows.map(r => (slotOf(r) + SLOT_MS <= nowMs ? actualOf(r) : null))),
      p50,
      p10: bd ? (p50 > 0 ? p50 * bd.lo : null) : slotBand ? kwh(fcRows.map(r => num(r.p10_kw))) : null,
      p90: bd ? (p50 > 0 ? p50 * bd.hi : null) : slotBand ? kwh(fcRows.map(r => num(r.p90_kw))) : null,
    });
  }
  return out;
}

/** The next `n` IST days from the forecast rows (forecast only); days without a forecast are left out. */
export function forecastDays(forecast: any[], nowMs: number, n = 3, band?: DailyBand): SolarDay[] {
  const bd = bandOf(band);
  const today = istMidnight(nowMs);
  const out: SolarDay[] = [];
  for (let d = 1; d <= n; d++) {
    const ms = today + d * DAY_MS;
    const rows = (forecast ?? []).filter(r => { const t = slotOf(r); return t >= ms && t < ms + DAY_MS; });
    if (!rows.some(r => (num(r.p50_kw) ?? 0) > 0)) continue;
    // The forecast runs 48 h, so the last day is cut off mid-way: a day only counts once its last slot is past
    // sunset (zero forecast again). Otherwise a few morning hours would read as a whole-day forecast.
    const last = rows.reduce((a, b) => (slotOf(b) > slotOf(a) ? b : a));
    if ((num(last.p50_kw) ?? 0) > 0) continue;
    const slotBand = rows.some(r => num(r.p10_kw) != null && num(r.p90_kw) != null);
    const p50 = kwh(rows.map(r => num(r.p50_kw)));
    out.push({
      ms, actual: null, partial: false, future: true, p50,
      p10: bd ? p50 * bd.lo : slotBand ? kwh(rows.map(r => num(r.p10_kw))) : null,
      p90: bd ? p50 * bd.hi : slotBand ? kwh(rows.map(r => num(r.p90_kw))) : null,
    });
  }
  return out;
}

/**
 * Where today's hollow dot sits, at its true position on both axes. x is the time of day: with a full yesterday it
 * runs from yesterday's tick at midnight to today's tick at the end of the day (`frac` 0..1 of the IST day), so the
 * dotted link from yesterday's actual to today's forecast is the guide it is heading along. y is the kWh generated
 * so far, so it climbs from the bottom and meets the forecast dot at the end of the day if the forecast was right.
 * Without a usable yesterday it stays on Today. x is a category position (may be fractional), y is kWh.
 */
export function todayDot(days: SolarDay[], todayIdx: number, frac: number): { x: number; y: number; link: boolean } | null {
  const t = days[todayIdx];
  if (!t) return null;
  const f = Math.min(Math.max(frac, 0), 1);
  const prev = todayIdx > 0 ? days[todayIdx - 1] : null;
  const link = !!(prev && !prev.partial && prev.actual != null && t.p50 > 0);
  return { x: link ? todayIdx - 1 + f : todayIdx, y: t.actual ?? 0, link };
}
