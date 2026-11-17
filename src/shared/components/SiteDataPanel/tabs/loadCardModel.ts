/**
 * Pure helpers for the combined Load card: one 15-min slot grid holding every line's actual and
 * forecast. Spec docs/superpowers/specs/2026-11-17-combined-load-card-design.md,
 * scenarios docs/test-scenarios/combined-load-card.md.
 */
export type LoadLine = 'inv' | 'grid' | 'ev' | 'all';
export type ActualLine = Exclude<LoadLine, 'all'>;
export type LoadWindow = 'today' | 'last7' | 'next7';
export type LoadLead = 'off' | 'latest' | '1h' | '6h' | 'day';

export const SLOT_MS = 15 * 60_000;
const DAY_MS = 24 * 3_600_000;

export const PHASE_COLORS = { L1: '#3b82f6', L2: '#f59e0b', L3: '#8b5cf6' };

export interface LoadSlot {
  ms: number;
  inv: number | null; l1: number | null; l2: number | null; l3: number | null;
  grid: number | null; ev: number | null;
  invP50: number | null; invP10: number | null; invP90: number | null;
  gridP50: number | null; gridP10: number | null; gridP90: number | null;
  gridMean: number | null; // expected kW: use for energy (P50 under-counts a spiky load)
  missReason: string | null; replay: boolean;
}

export interface SlotSources {
  actual: any[];   // PhaseLoadTab rows: rawTs, inverter, inverterL1-3, grid, ev
  invFc: any[];    // load-forecast-accuracy timeseries: lead-chosen past runs + next 24 h
  invFwd: any[];   // load-forecast rows: next 7 days
  gridFc: any[];   // load-forecast-accuracy?line=grid timeseries
}

export const num = (v: unknown): number | null =>
  v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const snap = (ms: number) => Math.floor(ms / SLOT_MS) * SLOT_MS;

/** [start, end) of a window; solarStartMs = today's 06:00 IST. */
export function windowRange(win: LoadWindow, solarStartMs: number): [number, number] {
  if (win === 'today') return [solarStartMs, solarStartMs + DAY_MS];
  if (win === 'last7') return [solarStartMs - 6 * DAY_MS, solarStartMs + DAY_MS];
  return [solarStartMs + DAY_MS, solarStartMs + 8 * DAY_MS];
}

export function buildSlots([start, end]: [number, number], src: SlotSources): LoadSlot[] {
  const by = new Map<number, LoadSlot>();
  for (let ms = start; ms < end; ms += SLOT_MS) {
    by.set(ms, {
      ms, inv: null, l1: null, l2: null, l3: null, grid: null, ev: null,
      invP50: null, invP10: null, invP90: null, gridP50: null, gridP10: null, gridP90: null, gridMean: null,
      missReason: null, replay: false,
    });
  }
  for (const r of src.actual) {
    const s = by.get(snap(r.rawTs));
    if (!s) continue;
    s.inv = num(r.inverter); s.l1 = num(r.inverterL1); s.l2 = num(r.inverterL2); s.l3 = num(r.inverterL3);
    s.grid = num(r.grid); s.ev = num(r.ev);
  }
  // the 7-day forward rows first; the accuracy series then overrides with the lead-chosen runs
  for (const r of src.invFwd) {
    const s = by.get(snap(Date.parse(r.forecast_for)));
    if (s) { s.invP50 = num(r.predicted_kw); s.invP10 = num(r.p10_kw); s.invP90 = num(r.p90_kw); }
  }
  for (const r of src.invFc) {
    const s = by.get(snap(Date.parse(r.ts)));
    if (!s) continue;
    if (num(r.predicted_kw) != null) { s.invP50 = num(r.predicted_kw); s.invP10 = num(r.p10_kw); s.invP90 = num(r.p90_kw); }
    s.missReason = r.miss_reason?.text ?? null;
    s.replay = String(r.method ?? '').endsWith('-replay');
  }
  for (const r of src.gridFc) {
    const s = by.get(snap(Date.parse(r.ts)));
    if (s) { s.gridP50 = num(r.predicted_kw); s.gridP10 = num(r.p10_kw); s.gridP90 = num(r.p90_kw); s.gridMean = num(r.mean_kw); }
  }
  return Array.from(by.values());
}

/** Past slots where a line that reads somewhere in the window has no reading. The newest 30 min are
 *  skipped: telemetry and meter rows arrive a few minutes late. */
export function gapSlots(slots: LoadSlot[], lines: ActualLine[], nowMs: number): Set<number> {
  const out = new Set<number>();
  for (const k of lines) {
    if (!slots.some(s => s[k] != null)) continue;
    for (const s of slots) {
      if (s.ms + 2 * SLOT_MS > nowMs) break;
      if (s[k] == null) out.add(s.ms);
    }
  }
  return out;
}

/** kWh from 15-min kW values; missing values add nothing. */
export const kwh = (vals: (number | null)[]) => vals.reduce<number>((t, v) => t + (v ?? 0) * 0.25, 0);

/** Running kWh; null after the series' last value (an actual line stops at now). */
export function cumulative(vals: (number | null)[]): (number | null)[] {
  const last = vals.reduce<number>((li, v, i) => (v != null ? i : li), -1);
  let t = 0;
  return vals.map((v, i) => (i > last ? null : (t += (v ?? 0) * 0.25)));
}

/** Grid forecast for energy sums: the mean when the backend sends one, else P50. */
export const gridEnergy = (s: LoadSlot) => s.gridMean ?? s.gridP50;

/** Stack tops for the All view: actual up to now, forecast after (when shown); EV stops at now.
 *  energy: grid forecast from its mean (kWh mode), else P50. */
export function stackTops(slots: LoadSlot[], nowMs: number, withForecast: boolean, energy = false) {
  return slots.map(s => {
    const past = s.ms <= nowMs;
    const inv = past ? s.inv ?? 0 : withForecast ? s.invP50 ?? 0 : 0;
    const grid = past ? s.grid ?? 0 : withForecast ? (energy ? gridEnergy(s) : s.gridP50) ?? 0 : 0;
    const ev = past ? s.ev ?? 0 : 0;
    return { inv, invGrid: inv + grid, all: inv + grid + ev };
  });
}
