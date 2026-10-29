/** Pure helpers for the device page's Overview chart. Spec §5.3 (detail rules, colours, gaps). */
export type Detail = 'every' | '1m' | '5m' | '1h' | '1d';
export type Cell = 'full' | 'partial' | 'empty';
export type SeriesPoint = { t: string; [key: string]: number | string | undefined };
/** Numeric value of a series key, or undefined if absent or not a number. */
export const val = (p: SeriesPoint, k: string): number | undefined => { const v = p[k]; return typeof v === 'number' ? v : undefined; };
export type CodeChange = { t: string; key: string; value: number };
export type Series = {
  device_id: number; serial: string; device_type: string; site_id: string | null; is_online: boolean;
  last_heartbeat: string | null; firmware_version: string | null; last_reading_at: string | null;
  range_start: string; range_end: string; detail: Detail; keys: string[];
  latest: Record<string, number | string | boolean> | null; series: SeriesPoint[];
  median_gap_s: number | null; longest_gap_s: number | null; longest_gap_at: string | null;
  coverage: Cell[]; code_changes: CodeChange[];
};
export type ChartReading = { id: string; label: string; title: string; unit: string; keys: string[]; names: string[]; zero: boolean };

export const RANGES: [string, number][] = [['1 h', 1], ['6 h', 6], ['24 h', 24], ['48 h', 48], ['7 d', 168]];
export const ALLOWED: Record<number, Detail[]> = { 1: ['every', '1m', '5m'], 6: ['1m', '5m'], 24: ['5m', '1h'], 48: ['5m', '1h'], 168: ['1h', '1d'] };
export const DETAIL_LABEL: Record<Detail, string> = { every: 'Every reading', '1m': 'Per minute', '5m': '5 min', '1h': 'Hourly', '1d': 'Daily' };
export const DETAIL_MS: Record<Detail, number> = { every: 0, '1m': 60_000, '5m': 300_000, '1h': 3_600_000, '1d': 86_400_000 };

/** Keep the chosen detail if the new range allows it, else the finest the range allows. */
export const fitDetail = (hours: number, d: Detail): Detail => (ALLOWED[hours].includes(d) ? d : ALLOWED[hours][0]);

const r = (id: string, label: string, title: string, unit: string, keys: string[], names: string[], zero = true): ChartReading =>
  ({ id, label, title, unit, keys, names, zero });
export const GATEWAY_READINGS: ChartReading[] = [
  r('solar', 'Solar', 'Solar power by string, W', 'W', ['pv1_power_w', 'pv2_power_w'], ['String 1', 'String 2']),
  r('home', 'Home use', 'Home use by phase, W', 'W', ['load_l1_power_w', 'load_l2_power_w', 'load_l3_power_w'], ['R', 'Y', 'B']),
  r('grid', 'Grid', 'Grid power, W. Above 0 is buying, below is selling', 'W', ['grid_power_w'], ['Grid']),
  r('battery', 'Battery power', 'Battery power, W. Below 0 is charging', 'W', ['battery_power_w'], ['Battery']),
  r('soc', 'Battery charge', 'Battery charge, %', '%', ['battery_soc_percent'], ['Charge']),
  r('volt', 'Grid voltage', 'Grid voltage by phase, V', 'V', ['grid_l1_voltage_v', 'grid_l2_voltage_v', 'grid_l3_voltage_v'], ['R', 'Y', 'B'], false),
  r('freq', 'Frequency', 'Grid frequency, Hz', 'Hz', ['grid_frequency_hz'], ['Frequency'], false),
  r('temp', 'Temperatures', 'Temperatures, °C', '°C', ['inverter_temp_c', 'battery_temp_c'], ['Inverter', 'Battery'], false),
];
export const METER_READINGS: ChartReading[] = [
  r('power', 'Active power', 'Active power by phase, W', 'W', ['active_power_l1', 'active_power_l2', 'active_power_l3'], ['R', 'Y', 'B']),
  r('total', 'Total power', 'Total active power, W', 'W', ['active_power_total'], ['Total']),
  r('volt', 'Voltage', 'Voltage by phase, V', 'V', ['voltage_l1', 'voltage_l2', 'voltage_l3'], ['R', 'Y', 'B'], false),
  r('current', 'Current', 'Current by phase, A', 'A', ['current_l1', 'current_l2', 'current_l3'], ['R', 'Y', 'B']),
  r('freq', 'Frequency', 'Frequency by phase, Hz', 'Hz', ['frequency_l1', 'frequency_l2', 'frequency_l3'], ['R', 'Y', 'B'], false),
  r('pf', 'Power factor', 'Power factor by phase', '', ['power_factor_l1', 'power_factor_l2', 'power_factor_l3'], ['R', 'Y', 'B'], false),
  r('reactive', 'Reactive power', 'Total reactive power, var', 'var', ['reactive_power_total'], ['Reactive']),
  r('apparent', 'Apparent power', 'Total apparent power, VA', 'VA', ['apparent_power_total'], ['Apparent']),
];

/** Round axis ticks (about four steps of 1/2/2.5/5 × 10^n); zero included when asked. */
export function niceTicks(lo: number, hi: number, zero: boolean): { a: number; b: number; step: number; ticks: number[] } {
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (!(hi - lo > 1e-9)) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)!;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e3 ? 0 : +v.toFixed(6));
  return { a, b, step, ticks };
}

/** Points that have `key`, split wherever two neighbours are more than `maxGapMs` apart (never interpolate across a gap). */
export function segments(points: SeriesPoint[], key: string, maxGapMs: number): SeriesPoint[][] {
  const out: SeriesPoint[][] = [];
  let cur: SeriesPoint[] = [], prev = -Infinity;
  for (const p of points) {
    if (val(p, key) === undefined) continue;
    const t = Date.parse(p.t);
    if (t - prev > maxGapMs && cur.length) { out.push(cur); cur = []; }
    cur.push(p); prev = t;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Phase convention R/Y/B; two lines blue/ochre; one line teal. Tokens live in deviceTabs.css. */
export function colorsFor(names: string[]): string[] {
  if (names.length === 3 && names.join() === 'R,Y,B') return ['var(--dc-r)', 'var(--dc-y)', 'var(--dc-b)'];
  if (names.length === 2) return ['var(--dc-b)', 'var(--dc-y)'];
  return names.map(() => 'var(--dc-one)');
}

/** "4 min 12 s", "2.0 s", "1 h 3 min". */
export function duration(s: number): string {
  if (s < 9.95) return `${s.toFixed(1)} s`;
  const t = Math.round(s);
  if (t < 60) return `${t} s`;
  if (t < 3600) return `${Math.floor(t / 60)} min ${t % 60} s`;
  const m = Math.round(t / 60);
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Fault/warning words read best as hex. */
export const hexCode = (v: number) => `0x${(Math.round(v) >>> 0).toString(16).toUpperCase().padStart(4, '0')}`;

/** Index of the time nearest `t` in ascending `ts` (binary search); -1 if empty. */
export function nearestIndex(ts: number[], t: number): number {
  if (!ts.length) return -1;
  let lo = 0, hi = ts.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < t) lo = m + 1; else hi = m; }
  return lo > 0 && t - ts[lo - 1] <= ts[lo] - t ? lo - 1 : lo;
}
