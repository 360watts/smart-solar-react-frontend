/**
 * Pure maths for the History tab: periods, the mixed-days totals rule, comparisons, flags, the sentence and the
 * calendar. Spec docs/superpowers/specs/2026-11-19-history-tab-redesign-design.md; scenarios
 * docs/test-scenarios/history-tab-redesign.md (M1-M9).
 */
import type { HouseDay, HouseSlot, SiteEvent } from '../../../../services/api';

export type Period = 'today' | '7d' | '30d' | 'custom';
export type Metric = 'own' | 'pv' | 'grid';
export const DAY_MS = 86_400_000;
const IST_MS = 19_800_000;
export const LEN: Record<Exclude<Period, 'custom'>, number> = { today: 1, '7d': 7, '30d': 30 };

export const istDay = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);
export const dayStartMs = (d: string) => Date.parse(`${d}T00:00:00+05:30`);
export const addDays = (d: string, n: number) => istDay(dayStartMs(d) + n * DAY_MS);
export const daysBetween = (a: string, b: string) => Math.round((dayStartMs(b) - dayStartMs(a)) / DAY_MS);
export const fmtDay = (d: string) =>
  new Date(dayStartMs(d)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export interface Range { start: string; end: string; len: number }
export function periodRange(p: Exclude<Period, 'custom'>, offset: number, nowMs: number): Range {
  const len = LEN[p];
  const end = addDays(istDay(nowMs), offset * len);
  return { start: addDays(end, -(len - 1)), end, len };
}
/** "Pick dates": the chosen span, stepped by its own length. */
export function customRange(start: string, end: string, offset: number): Range {
  const len = daysBetween(start, end) + 1;
  return { start: addDays(start, offset * len), end: addDays(end, offset * len), len };
}
export const prevRange = (r: Range): Range => ({ start: addDays(r.start, -r.len), end: addDays(r.start, -1), len: r.len });
export const daysOf = (r: Range) => Array.from({ length: r.len }, (_, i) => addDays(r.start, i));

export type HouseFlows = Pick<HouseDay, 'whole_home' | 'pv_kwh' | 'home_kwh' | 'from_solar_kwh' | 'from_battery_kwh'
  | 'from_grid_kwh' | 'bought_kwh' | 'solar_to_battery_kwh' | 'exported_kwh'>;

export interface Totals {
  basis: 'whole' | 'inverter'; counted: number; of: number;
  pv: number; home: number; fromSolar: number; fromBattery: number; fromGrid: number; bought: number;
  toBattery: number; exported: number; ownPct: number | null;
}
const n0 = (v: number | null | undefined) => v ?? 0;

/** Whole-home days only when the period has any (owner, Nov 19); otherwise the inverter side of every day. */
export function totals(rows: HouseFlows[]): Totals {
  const known = rows.filter(r => r.home_kwh != null);
  const whole = known.filter(r => r.whole_home);
  const use = whole.length ? whole : known;
  const s = (k: keyof HouseFlows) => use.reduce((t, r) => t + n0(r[k] as number | null), 0);
  const home = s('home_kwh'), fromSolar = s('from_solar_kwh'), fromBattery = s('from_battery_kwh');
  return {
    basis: whole.length ? 'whole' : 'inverter', counted: use.length, of: rows.length,
    pv: s('pv_kwh'), home, fromSolar, fromBattery, fromGrid: s('from_grid_kwh'), bought: s('bought_kwh'),
    toBattery: s('solar_to_battery_kwh'), exported: s('exported_kwh'),
    ownPct: home > 0 ? Math.round(((fromSolar + fromBattery) / home) * 100) : null,
  };
}

/** A day's flows from its 15-min slots, counting slots that start before `untilMs` (today vs the same hours yesterday). */
export function slotsToFlows(slots: HouseSlot[], untilMs = Infinity): HouseFlows {
  const use = slots.filter(s => Date.parse(s.ts) < untilMs && s.home_kw != null);
  const s = (k: keyof HouseSlot) => +(use.reduce((t, x) => t + n0(x[k] as number | null), 0) * 0.25).toFixed(3);
  return {
    whole_home: use.length > 0 && use.every(x => x.whole_home), pv_kwh: s('pv_kw'), home_kwh: use.length ? s('home_kw') : null,
    from_solar_kwh: s('from_solar_kw'), from_battery_kwh: s('from_battery_kw'), from_grid_kwh: s('from_grid_kw'), bought_kwh: s('bought_kw'),
    solar_to_battery_kwh: s('solar_to_battery_kw'), exported_kwh: s('exported_kw'),
  };
}

export const change = (cur: number | null, prev: number | null) =>
  cur == null || prev == null || prev <= 0 ? null : Math.round(((cur - prev) / prev) * 100);

/** Spec: if solar made and its three destinations differ by more than 5%, say so; never force a balance. */
export const balanceGap = (t: Totals) => t.pv - t.fromSolar - t.toBattery - t.exported;
export const unbalanced = (t: Totals) => t.pv > 0 && Math.abs(balanceGap(t)) > 0.05 * t.pv;

/** One "Anything wrong?" line: title + ×count + short `when`; `detail` sits behind a click. */
export interface Flag {
  kind: 'incident' | 'gap' | 'battery'; tone: 'amber' | 'grey'; title: string; count: number; open: number;
  when: string; detail: string; dates: string[];
}

/** "Anything wrong?": incidents, missing readings, a battery that barely moved. No solar-vs-forecast flag (owner, Nov 19). */
export function buildFlags(days: HouseDay[], events: SiteEvent[], r: Range, hasBattery: boolean, today: string): { list: Flag[]; checks: number } {
  const list: Flag[] = [];
  // one row per incident title (four "Device Offline" rows say nothing): count, devices, times, still-open count
  const groups = new Map<string, { n: number; open: number; amber: boolean; dates: Set<string>; serials: Set<string>; first: number; last: number }>();
  for (const e of events) {
    if (e.kind !== 'incident') continue;
    const startMs = Date.parse(e.at);
    const a = istDay(startMs);
    const b = e.ended ? istDay(Date.parse(e.ended)) : today;
    const dates: string[] = [];
    for (let d = a < r.start ? r.start : a; d <= b && d <= r.end; d = addDays(d, 1)) dates.push(d);
    if (!dates.length) continue;
    const g = groups.get(e.title) ?? { n: 0, open: 0, amber: false, dates: new Set(), serials: new Set(), first: startMs, last: startMs };
    g.n += 1;
    if (!e.ended) g.open += 1;
    if (e.severity !== 'info') g.amber = true;
    dates.forEach(d => g.dates.add(d));
    if (e.serial) g.serials.add(e.serial);
    g.first = Math.min(g.first, startMs);
    g.last = Math.max(g.last, startMs);
    groups.set(e.title, g);
  }
  const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' });
  const when = (g: { first: number; last: number }) => {
    const a = istDay(g.first), b = istDay(g.last);
    if (a !== b) return `${fmtDay(a)} – ${fmtDay(b)}`;
    return g.first === g.last ? `${fmtDay(a)} ${hhmm(g.first)}` : `${fmtDay(a)} ${hhmm(g.first)}–${hhmm(g.last)}`;
  };
  [...groups.entries()]
    .sort(([, x], [, y]) => y.open - x.open || y.n - x.n)
    .forEach(([title, g]) => {
      const devices = [...g.serials];
      list.push({
        kind: 'incident', tone: g.amber ? 'amber' : 'grey', dates: [...g.dates].sort(), title, count: g.n, open: g.open,
        when: when(g),
        detail: [
          devices.length ? `${devices.length === 1 ? 'Device' : 'Devices'} ${devices.slice(0, 3).join(', ')}${devices.length > 3 ? ` +${devices.length - 3} more` : ''}` : '',
          g.open ? `${g.open === g.n && g.n === 1 ? 'Still open' : `${g.open} still open`}` : 'All cleared',
        ].filter(Boolean).join(' · '),
      });
    });
  const gaps = days.filter(d => d.coverage != null && d.coverage < 0.9);
  if (gaps.length) {
    list.push({
      kind: 'gap', tone: 'grey', dates: gaps.map(d => d.date), title: 'Readings missing', count: gaps.length, open: 0,
      when: gaps.length === 1 ? fmtDay(gaps[0].date) : `${gaps.length} days`,
      detail: `${gaps.map(d => `${fmtDay(d.date)} ${Math.round((d.coverage ?? 0) * 100)}%`).slice(0, 4).join(' · ')}${gaps.length > 4 ? ' …' : ''}. Totals count only the readings that arrived.`,
    });
  }
  if (hasBattery) {
    const flat = days.filter(d => d.date !== today && d.soc_min != null && d.soc_max != null && d.soc_max - d.soc_min < 20);
    if (flat.length) {
      list.push({
        kind: 'battery', tone: 'amber', dates: flat.map(d => d.date), title: 'Battery barely used', count: flat.length, open: 0,
        when: flat.length === 1 ? fmtDay(flat[0].date) : `${flat.length} days`,
        detail: `Its charge moved less than 20 points in a day (${flat.slice(0, 3).map(d => `${Math.round(d.soc_min ?? 0)}–${Math.round(d.soc_max ?? 0)}%`).join(', ')}${flat.length > 3 ? ' …' : ''}).`,
      });
    }
  }
  return { list, checks: 3 };
}

export function sentence(t: Totals, prev: Totals | null, label: string): string {
  if (t.ownPct == null) return 'No readings for this period yet.';
  const who = t.basis === 'whole' ? 'the home' : 'the inverter circuits';
  const was = prev?.ownPct == null ? '' : prev.ownPct === t.ownPct ? ', the same as before'
    : `, ${t.ownPct > prev.ownPct ? 'up' : 'down'} from ${prev.ownPct}%`;
  return `${label} ${who} ran ${t.ownPct}% on its own power (solar + battery)${was}. `
    + `It bought ${t.bought.toFixed(1)} kWh from the grid and sent ${t.exported.toFixed(1)} kWh back.`;
}

const SUM_KEYS = ['pv_kwh', 'home_kwh', 'from_solar_kwh', 'from_battery_kwh', 'from_grid_kwh', 'bought_kwh', 'solar_to_battery_kwh', 'exported_kwh'] as const;

/** Week rows (7-day chunks from the range start) for ranges over 60 days. A week is whole only if every day is. */
export function weeks(days: HouseDay[], r: Range): HouseDay[] {
  const out: HouseDay[] = [];
  for (let i = 0; i < r.len; i += 7) {
    const a = addDays(r.start, i), b = addDays(r.start, Math.min(i + 6, r.len - 1));
    const chunk = days.filter(d => d.date >= a && d.date <= b);
    const row = {
      date: a, source: '5min', whole_home: chunk.length > 0 && chunk.every(d => d.whole_home),
      coverage: chunk.length ? Math.min(...chunk.map(d => d.coverage ?? 1)) : null, soc_min: null, soc_max: null,
    } as HouseDay;
    for (const k of SUM_KEYS) {
      (row as any)[k] = chunk.some(d => d[k] != null) ? +chunk.reduce((t, d) => t + n0(d[k]), 0).toFixed(3) : null;
    }
    out.push(row);
  }
  return out;
}

export interface Cell { date: string | null; value: number | null; level: number; flagged: boolean; whole: boolean }
const metricOf = (d: HouseDay | undefined, m: Metric): number | null => {
  if (!d || d.home_kwh == null) return null;
  if (m === 'pv') return d.pv_kwh;
  if (m === 'grid') return d.bought_kwh ?? d.from_grid_kwh;
  return d.home_kwh > 0 ? Math.round(((n0(d.from_solar_kwh) + n0(d.from_battery_kwh)) / d.home_kwh) * 100) : null;
};

/** Monday-first grid; level 0..4 = worse..better within the period (-1 = no data); grid bought is inverted. */
export function calendarCells(days: HouseDay[], r: Range, m: Metric, flagged: Set<string>): Cell[] {
  const by = new Map(days.map(d => [d.date, d]));
  const vals = daysOf(r).map(d => metricOf(by.get(d), m)).filter((v): v is number => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const level = (v: number | null) => {
    if (v == null) return -1;
    let t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
    if (m === 'grid') t = 1 - t;
    return Math.min(4, Math.floor(t * 5));
  };
  const lead = (new Date(dayStartMs(r.start) + IST_MS).getUTCDay() + 6) % 7;
  const pad: Cell[] = Array.from({ length: lead }, () => ({ date: null, value: null, level: -1, flagged: false, whole: false }));
  return pad.concat(daysOf(r).map(d => {
    const row = by.get(d);
    const v = metricOf(row, m);
    return { date: d, value: v, level: level(v), flagged: flagged.has(d), whole: !!row?.whole_home };
  }));
}
