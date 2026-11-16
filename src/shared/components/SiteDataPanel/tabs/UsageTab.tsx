import { Gauge } from 'lucide-react';
import { EmptyState } from '../../Feedback';
/**
 * UsageTab: how a meter-only site (energy meter, no inverter) uses power.
 * Fed by GET /sites/<id>/meter-usage/ plus the latest meter reading the site panel already holds.
 * Design: smart-solar-django-backend/docs/superpowers/specs/2026-10-08-meter-usage-tab-design.md
 * House style: UI_GUIDE.md (plain copy, amber never red, tokens from useTokens).
 */
import React, { useEffect, useId, useState } from 'react';
import { apiService } from '../../../../services/api';
import type { CtMeterReading } from '../../../../services/api';
import { useTokens } from '../../../../features/staff/siteHardware/ui';
import { PHASE_COLORS } from './PhaseLoadTab';
import type { MeterUsage } from '../types';

const REFRESH_MS = 60_000;
const LIVE_WITHIN_S = 15 * 60;
const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' };

// ── Pure helpers ───────────────────────────────────────────────────────────────

const fmt = (v: number | null | undefined, dp: number): string =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** "7:45 pm" in the site's timezone. Built from parts so the output does not depend on the ICU version. */
function clock(iso: string | null | undefined, tz: string, seconds = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true, ...(seconds ? { second: '2-digit' } : {}) };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz }).formatToParts(d);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'Asia/Kolkata' }).formatToParts(d);
  }
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')}${seconds ? ':' + get('second') : ''} ${get('dayPeriod').toLowerCase()}`;
}

function ago(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 60) return 'less than a minute ago';
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'} ago`;
  if (s < 3600) return plural(Math.floor(s / 60), 'minute');
  if (s < 48 * 3600) return plural(Math.floor(s / 3600), 'hour');
  return plural(Math.floor(s / 86400), 'day');
}

/** "Fri 25" from a plain YYYY-MM-DD (no timezone shift). */
function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`;
}

const hourWord = (h: number) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;

/** Top of the y axis: the data maximum rounded up to a whole number, and to an even one above 4. */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const c = Math.ceil(max);
  return c > 4 && c % 2 ? c + 1 : c;
}

const nums = (ct: any, key: string): number[] =>
  [1, 2, 3].map(i => ct?.[`${key}_l${i}`]).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
const mean = (a: number[]): number | null => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sum = (a: number[]): number | null => (a.length ? a.reduce((s, x) => s + x, 0) : null);

/** kW from the meter's own latest reading, or null when it is missing or older than 15 minutes. */
export function liveKw(ct: Partial<CtMeterReading> | null | undefined, nowMs: number): number | null {
  const ts = ct?.timestamp ? new Date(ct.timestamp).getTime() : NaN;
  const w = ct?.active_power_total;
  if (!Number.isFinite(ts) || nowMs - ts > LIVE_WITHIN_S * 1000 || typeof w !== 'number' || !Number.isFinite(w)) return null;
  return w / 1000;
}

export interface HealthItem {
  label: string; value: string; unit: string; status: string; ok: boolean; note: string;
  lo: number; hi: number; a: number; b: number; v: number | null;
  /** The meter sends a fixed value here, not a measurement. */
  fixed?: boolean;
}

type Measured = MeterUsage['measured'];

const notMeasured = (label: string, unit: string, lo: number, hi: number, a: number, b: number, fixedText: string): HealthItem => ({
  label, unit, lo, hi, a, b, v: null, value: 'Not measured', ok: false, fixed: true, status: 'Not measured',
  note: `This meter sends a fixed ${fixedText} instead of measuring it. A firmware update will fix this.`,
});

/** Four range bars from the latest meter reading. Anything missing reads "—", never NaN. */
export function computeHealth(ct: Partial<CtMeterReading> | null | undefined, measured?: Measured) {
  const volts = nums(ct, 'voltage');
  const v = mean(volts);
  const voltage: HealthItem = {
    label: 'Voltage', unit: 'V', lo: 190, hi: 270, a: 207, b: 253, v,
    value: v == null ? '—' : v.toFixed(0),
    ok: v != null && v >= 207 && v <= 253,
    status: v == null ? '' : v >= 207 && v <= 253 ? 'Steady' : 'Worth a look',
    note: volts.length
      ? `Normal range 207 to 253 V · lowest ${Math.min(...volts).toFixed(0)}, highest ${Math.max(...volts).toFixed(0)}`
      : 'Normal range 207 to 253 V',
  };

  const amps = nums(ct, 'current');
  const avgA = mean(amps);
  // Current unbalance the standard way: the largest deviation from the average, as a share of the average.
  const pct = amps.length >= 2 && avgA != null && avgA > 0 ? (Math.max(...amps.map(a => Math.abs(a - avgA))) / avgA) * 100 : null;
  const heaviest = [1, 2, 3].reduce((best, i) => ((ct as any)?.[`current_l${i}`] ?? -Infinity) > ((ct as any)?.[`current_l${best}`] ?? -Infinity) ? i : best, 1);
  const balance: HealthItem = {
    label: 'Phase balance', unit: '% off average', lo: 0, hi: 50, a: 0, b: 10, v: pct,
    value: pct == null ? '—' : pct.toFixed(0),
    ok: pct != null && pct < 10,
    status: pct == null ? '' : pct < 10 ? 'Balanced' : 'A little uneven',
    note: pct != null && pct >= 10 ? `Phase ${heaviest} is the heaviest` : 'No phase more than 10% off the average',
  };

  const pfRaw = ct?.power_factor_total ?? mean(nums(ct, 'power_factor'));
  const pfv = pfRaw == null || !Number.isFinite(pfRaw) ? null : Math.abs(pfRaw);
  const pf: HealthItem = measured?.power_factor === false ? notMeasured('Power factor', '', 0.6, 1, 0.9, 1, '1.00') : {
    label: 'Power factor', unit: '', lo: 0.6, hi: 1, a: 0.9, b: 1, v: pfv,
    value: pfv == null ? '—' : pfv.toFixed(2),
    ok: pfv != null && pfv >= 0.9,
    status: pfv == null ? '' : pfv >= 0.9 ? 'Good' : 'Worth a look',
    note: '0.90 or higher is good',
  };

  const fv = mean(nums(ct, 'frequency'));
  const frequency: HealthItem = measured?.frequency === false ? notMeasured('Frequency', 'Hz', 48.5, 51.5, 49.5, 50.5, '50.00 Hz') : {
    label: 'Frequency', unit: 'Hz', lo: 48.5, hi: 51.5, a: 49.5, b: 50.5, v: fv,
    value: fv == null ? '—' : fv.toFixed(2),
    ok: fv != null && fv >= 49.5 && fv <= 50.5,
    status: fv == null ? '' : fv >= 49.5 && fv <= 50.5 ? 'Steady' : 'Worth a look',
    note: 'Normal range 49.5 to 50.5 Hz',
  };

  return { voltage, balance, pf, frequency };
}

// Heat ramp: pale to strong. The dark ramp starts near the card colour so empty hours recede.
const RAMP_LIGHT = [[239, 233, 218], [233, 184, 120], [217, 130, 43], [138, 59, 11]];
const RAMP_DARK = [[44, 42, 38], [112, 82, 40], [217, 130, 43], [255, 196, 120]];
function ramp(stops: number[][], t: number): string {
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  return `rgb(${stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f)).join(',')})`;
}

// Raw readings table: how each row is totalled.
const RAW_ROWS: { label: string; key: string; unit: string; dp: number; total: 'ownOrSum' | 'avg' | 'own' | 'none' }[] = [
  { label: 'Voltage', key: 'voltage', unit: 'V', dp: 1, total: 'avg' },
  { label: 'Current', key: 'current', unit: 'A', dp: 2, total: 'none' },
  { label: 'Frequency', key: 'frequency', unit: 'Hz', dp: 2, total: 'avg' },
  { label: 'Active power', key: 'active_power', unit: 'W', dp: 0, total: 'ownOrSum' },
  { label: 'Reactive power', key: 'reactive_power', unit: 'VAR', dp: 0, total: 'ownOrSum' },
  { label: 'Apparent power', key: 'apparent_power', unit: 'VA', dp: 0, total: 'ownOrSum' },
  { label: 'Power factor', key: 'power_factor', unit: '', dp: 2, total: 'own' },
];

// ── Info tooltip ───────────────────────────────────────────────────────────────

type Tokens = ReturnType<typeof useTokens>;

/** A small "i" button: hover, focus or tap shows the explanation; Escape, blur or leaving closes it. */
export function InfoTip({ label, text, t }: { label: string; text: string; t: Tokens }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button" aria-label={`About ${label}`} aria-describedby={open ? id : undefined}
        onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
        style={{ width: 18, height: 18, borderRadius: 999, border: `1px solid ${t.line}`, background: 'transparent', color: t.ink2, fontSize: 11, fontWeight: 700, lineHeight: '16px', padding: 0, cursor: 'help', fontFamily: 'inherit' }}
      >i</button>
      {open && (
        <span
          role="tooltip" id={id}
          style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 30, width: 'max-content', maxWidth: 'min(260px, 72vw)', padding: '10px 12px', borderRadius: 12, background: t.ink, color: t.card, fontSize: 13, fontWeight: 400, lineHeight: 1.45, textAlign: 'left', whiteSpace: 'normal', boxShadow: '0 6px 24px rgba(0,0,0,.18)' }}
        >{text}</span>
      )}
    </span>
  );
}

const TIPS = {
  hero: 'All the energy the meter has measured since midnight, site time, added up from 5-minute averages. The chip compares it with yesterday up to the same time.',
  now: "The meter's latest total power, if it is less than 15 minutes old.",
  peak: 'The highest 5-minute average today. Short spikes inside those 5 minutes are smoothed out.',
  avg: 'The average power since midnight. Multiply by the hours so far to get the energy used.',
  base: 'The typical power between 1 and 5 am over the last 7 nights: what stays on when nobody is using anything (fridge, standby, routers).',
  voltage: 'The average of the three phase voltages. In India the normal supply is 230 V, allowed from 207 to 253 V.',
  balance: 'How far the busiest or quietest phase is from the average current. Under 10% is balanced.',
  pf: 'How much of the current does useful work. 1.00 is perfect; motors and pumps pull it down. Below 0.90 the wiring carries extra current for nothing.',
  frequency: 'The grid frequency. 50 Hz is normal; it drifts a little with demand on the grid.',
  heat: 'Each square is the average power in that hour. A stronger colour means more power; grey means no reading.',
  days: 'Energy measured on each of the last 14 days. Today is still counting.',
  raw: "The meter's own figures from its latest reading, before any rounding into averages.",
} as const;

// ── Curve geometry ─────────────────────────────────────────────────────────────

// Drawn at the card's real pixel width, so text keeps its size on a phone and on a wide screen.
const X0 = 46, PAD_R = 14, H = 220, Y0 = 192, YTOP = 26, MIN_W = 300, DEFAULT_W = 720;

/** Break the series into runs at nulls so gaps stay gaps (never interpolated). */
function runs(series: (number | null)[], px: (i: number) => number, py: (v: number) => number): [number, number][][] {
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  series.forEach((v, i) => {
    if (v == null) { if (cur.length) out.push(cur); cur = []; } else cur.push([px(i), py(v)]);
  });
  if (cur.length) out.push(cur);
  return out;
}
const linePath = (rs: [number, number][][]) =>
  rs.map(r => r.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')).join(' ');
const areaPath = (rs: [number, number][][]) =>
  rs.filter(r => r.length > 1)
    .map(r => `${linePath([r])} L${r[r.length - 1][0].toFixed(1)} ${Y0} L${r[0][0].toFixed(1)} ${Y0} Z`).join(' ');

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  siteId: string;
  isDark: boolean;
  /** Latest meter reading the site panel already holds (staff-overview energy_meter_latest). */
  ctLatest: CtMeterReading | null;
}

const UsageTab: React.FC<Props> = ({ siteId, isDark, ctLatest }) => {
  const t = useTokens(isDark);
  const [data, setData] = useState<MeterUsage | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [open, setOpen] = useState(false); // the Recent readings <details>
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [hover, setHover] = useState<number | null>(null);        // curve slot under the pointer or keyboard
  const [dayHover, setDayHover] = useState<number | null>(null);  // Energy by day bar
  const [heat, setHeat] = useState<[number, number] | null>(null); // heat map [row, hour]
  const [curveEl, setCurveEl] = useState<HTMLDivElement | null>(null);
  const [curveW, setCurveW] = useState(DEFAULT_W);
  useEffect(() => {
    if (!curveEl) return;
    const measure = () => { const w = curveEl.clientWidth; if (w > 0) setCurveW(Math.max(MIN_W, Math.round(w))); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(curveEl);
    return () => ro.disconnect();
  }, [curveEl]);

  useEffect(() => {
    let alive = true;
    setData(null); // a different site must not briefly show the last one's figures
    const run = async (fresh: boolean, silent: boolean) => {
      if (!silent) setStatus('loading');
      try {
        const usage = await apiService.getMeterUsage(siteId, { fresh });
        if (!alive) return;
        setData(usage);
        setStatus('ready');
      } catch {
        // A failed background refresh keeps what is on screen; only a first load or a retry shows the error.
        if (alive && !silent) setStatus('error');
      }
    };
    run(attempt > 0, false);
    const iv = setInterval(() => { if (!document.hidden) run(true, true); }, REFRESH_MS);
    return () => { alive = false; clearInterval(iv); };
  }, [siteId, attempt]);

  // Recent readings: only fetched (and refreshed) while the details are open, to spare the read quota.
  useEffect(() => {
    setRecent([]);
    setOpen(false);
  }, [siteId]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = async () => {
      if (document.hidden) return;
      const end = new Date();
      try {
        const hist = await apiService.getEnergyMeterHistory(siteId, { start_date: new Date(end.getTime() - 3600 * 1000).toISOString(), end_date: end.toISOString(), aggregate: '5min' });
        if (alive) setRecent(Array.isArray(hist) ? hist : []);
      } catch { /* keep what is shown */ }
    };
    load();
    const iv = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(iv); };
  }, [siteId, open]);

  const card: React.CSSProperties = { background: t.card, border: `1px solid ${t.line}`, borderRadius: 22, padding: '24px 28px', minWidth: 0 };
  const h2: React.CSSProperties = { margin: '0 0 4px', fontFamily: t.head, fontWeight: 600, fontSize: 20, color: t.ink };
  const sub: React.CSSProperties = { margin: 0, fontSize: 14, color: t.ink2 };
  const wrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 22, fontFamily: t.body, color: t.ink };

  const health = computeHealth(ctLatest, data?.measured);
  const waiting = <div style={{ fontSize: 14, color: t.ink2 }}>Waiting for the first meter reading</div>;
  const currents = [1, 2, 3].map(i => ({ name: `Phase ${i}`, amps: (ctLatest as any)?.[`current_l${i}`] as number | null | undefined, color: PHASE_COLORS[`L${i}` as 'L1' | 'L2' | 'L3'] }));
  const havePhases = currents.filter(c => c.amps != null).length >= 2;
  const heavy = currents.reduce((b, c) => ((c.amps ?? -Infinity) > (b.amps ?? -Infinity) ? c : b), currents[0]);

  const tz = data?.timezone || 'Asia/Kolkata';
  const ctAge = ctLatest?.timestamp ? (Date.now() - new Date(ctLatest.timestamp).getTime()) / 1000 : null;
  const serial = data?.meter.device_serial || ctLatest?.node_id;
  const recentRows = [...recent]
    .filter(r => r?.timestamp)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 10);

  const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' };

  const supplyAndRaw = (
    <>
      {/* Supply health */}
      <section style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 18 }}>
          <h2 style={{ ...h2, margin: 0 }}>Is the supply healthy?</h2>
          <span style={{ fontSize: 14, color: t.ink2 }}>Latest readings against normal ranges.</span>
        </div>
        {!ctLatest ? waiting : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 22 }}>
              {([['voltage', health.voltage], ['balance', health.balance], ['pf', health.pf], ['frequency', health.frequency]] as const).map(([id, h]) => {
                const pct = (n: number) => ((n - h.lo) / (h.hi - h.lo)) * 100;
                return (
                  <div key={id} data-testid={`health-${id}`}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>{h.label}<InfoTip label={h.label} text={TIPS[id]} t={t} /></span>
                      {h.status && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: h.fixed ? t.idleBg : h.ok ? t.goodBg : t.waitBg, color: h.fixed ? t.ink2 : h.ok ? t.goodInk : t.waitInk, fontSize: 12, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }} />{h.status}
                        </span>
                      )}
                    </div>
                    <div style={{ ...NUM, fontFamily: t.head, fontWeight: 700, fontSize: h.fixed ? 20 : 26, letterSpacing: '-0.02em', color: h.fixed ? t.ink2 : t.ink }}>
                      {h.value}
                      {h.value !== '—' && !h.fixed && h.unit && <span style={{ fontSize: 14, fontWeight: 500, color: t.ink2, marginLeft: 4 }}>{h.unit}</span>}
                    </div>
                    <div style={{ position: 'relative', height: 10, borderRadius: 5, background: t.idleBg, margin: '10px 0 6px', opacity: h.fixed ? 0.4 : 1 }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(h.a)}%`, width: `${pct(h.b) - pct(h.a)}%`, borderRadius: 5, background: t.good, opacity: 0.3 }} />
                      {h.v != null && (
                        <div style={{ position: 'absolute', top: -3, width: 4, height: 16, borderRadius: 2, background: t.ink, left: `${Math.max(0, Math.min(98, pct(h.v) - 0.5))}%` }} />
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: t.ink2 }}>{h.note}</div>
                  </div>
                );
              })}
            </div>
            <div data-testid="current-by-phase" style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${t.line2}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 22px' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Current by phase</span>
              {currents.map(c => (
                <span key={c.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
                  <span style={{ color: t.ink2 }}>{c.name}</span>
                  <span style={{ ...NUM, fontWeight: 600 }}>{`${fmt(c.amps, 1)} A`}</span>
                </span>
              ))}
              {havePhases && (
                <span style={{ fontSize: 13, color: t.ink2, marginLeft: 'auto' }}>{`${heavy.name} is carrying the most. See Load by phase for the detail.`}</span>
              )}
            </div>
          </>
        )}
      </section>

      {/* Raw readings */}
      <section style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <h2 style={{ ...h2, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>Latest reading, per phase<InfoTip label="the latest reading" text={TIPS.raw} t={t} /></h2>
          {ctLatest && (
            <span style={{ fontSize: 14, color: t.ink2 }}>
              {`Sent by the meter${ctAge != null ? ` ${ago(ctAge)}` : ''} (${clock(ctLatest.timestamp, tz, true)}). The page checks for a new one every 30 seconds.`}
            </span>
          )}
        </div>
        {!ctLatest ? waiting : (
          <div style={{ overflowX: 'auto' }}>
            <table aria-label="Raw readings" style={{ ...NUM, width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ color: t.ink2, fontSize: 13 }}>
                  <th scope="col" style={{ ...th, textAlign: 'left' }}>Measurement</th>
                  {(['L1', 'L2', 'L3'] as const).map((p, i) => (
                    <th key={p} scope="col" style={th}>
                      <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: PHASE_COLORS[p], marginRight: 6 }} />{`Phase ${i + 1}`}
                    </th>
                  ))}
                  <th scope="col" style={th}>Total</th>
                  <th scope="col" style={{ ...th, textAlign: 'left' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {RAW_ROWS.map(r => {
                  const vals = [1, 2, 3].map(i => (ctLatest as any)[`${r.key}_l${i}`] as number | null | undefined);
                  const present = nums(ctLatest, r.key);
                  const own = (ctLatest as any)[`${r.key}_total`];
                  const hasOwn = typeof own === 'number' && Number.isFinite(own);
                  // The meter's own total where it reports one; the phase sum (labelled) only when it is missing.
                  const [total, tag] = r.total === 'avg' ? [mean(present), ' avg']
                    : r.total === 'none' ? [null, '']
                    : hasOwn ? [own as number, '']
                    : r.total === 'ownOrSum' ? [sum(present), ' sum'] : [null, ''];
                  const flag = r.key === 'frequency' ? data?.measured?.frequency
                    : r.key === 'power_factor' || r.key === 'reactive_power' ? data?.measured?.power_factor : null;
                  const fixed = flag === false;
                  const totalText = fixed ? 'Not measured' : fmt(total, r.dp) + (total != null ? tag : '');
                  const fixedTip = fixed ? 'A fixed value the meter sends, not a measurement. A firmware update will fix this.' : undefined;
                  return (
                    <tr key={r.key} data-fixed={fixed ? 'true' : undefined} style={{ borderTop: `1px solid ${t.line2}`, textAlign: 'right', color: fixed ? t.ink2 : undefined }}>
                      <th scope="row" style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 600 }}>{r.label}</th>
                      {vals.map((v, i) => <td key={i} title={fixedTip} style={{ padding: '11px 10px' }}>{fmt(v, r.dp)}</td>)}
                      <td title={fixedTip} style={{ padding: '11px 10px', fontWeight: fixed ? 500 : 700 }}>{totalText}</td>
                      <td style={{ textAlign: 'left', padding: '11px 10px', color: t.ink2 }}>{r.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <details style={{ marginTop: 18 }} onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary style={{ cursor: 'pointer', padding: '12px 0', fontSize: 14, fontWeight: 600 }}>Last 10 five-minute averages</summary>
          {serial && <p style={{ margin: '0 0 10px', fontSize: 13, color: t.ink2 }}>{`Meter ${serial}, last hour. Updates every minute while open.`}</p>}
          {recentRows.length === 0 ? (
            <p style={{ ...sub, fontSize: 13 }}>No readings in the last hour.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 6 }}>
              <table aria-label="Recent readings" style={{ ...NUM, width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: t.ink2 }}>
                    <th scope="col" style={{ ...th, textAlign: 'left' }}>5 min from</th>
                    <th scope="col" style={th}>Power (kW)</th>
                    <th scope="col" style={th}>V1 / V2 / V3</th>
                    <th scope="col" style={th}>A1 / A2 / A3</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map(r => (
                    <tr key={r.timestamp} data-testid="recent-row" style={{ borderTop: `1px solid ${t.line2}`, textAlign: 'right' }}>
                      <td style={{ textAlign: 'left', padding: '7px 10px', color: t.ink2 }}>{clock(r.timestamp, tz)}</td>
                      <td style={{ padding: '7px 10px' }}>{fmt(r.active_power_total == null ? null : r.active_power_total / 1000, 2)}</td>
                      <td style={{ padding: '7px 10px' }}>{[r.voltage_l1, r.voltage_l2, r.voltage_l3].map(v => fmt(v, 1)).join(' / ')}</td>
                      <td style={{ padding: '7px 10px' }}>{[r.current_l1, r.current_l2, r.current_l3].map(v => fmt(v, 1)).join(' / ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      </section>
    </>
  );

  if (status === 'loading' && !data) {
    const block = (h: number, w: string = '100%'): React.CSSProperties => ({
      height: h, width: w, borderRadius: 14, background: t.idleBg, animation: 'usage-pulse 1.4s ease-in-out infinite',
    });
    return (
      <div style={wrap} data-testid="usage-skeleton" aria-busy="true" aria-label="Loading usage">
        <style>{'@keyframes usage-pulse{0%,100%{opacity:.55}50%{opacity:1}}@media (prefers-reduced-motion:reduce){[data-testid="usage-skeleton"] *{animation:none!important}}'}</style>
        <div style={block(36, '60%')} />
        <div style={{ ...card }}><div style={block(70, '40%')} /><div style={{ ...block(200), marginTop: 16 }} /></div>
        <div style={{ ...card }}><div style={block(160)} /></div>
        <div style={{ ...card }}><div style={block(120)} /></div>
      </div>
    );
  }

  if (status === 'error' && !data) {
    return (
      <div style={{ ...wrap, alignItems: 'flex-start' }}>
        <EmptyState title="Couldn't load the usage figures" description="The server didn't answer. Your meter is not affected." onRetry={() => setAttempt(a => a + 1)} />
        {supplyAndRaw}
      </div>
    );
  }

  if (!data) return null;

  const today = data.today;
  const hasToday = data.curve.today.some(v => v != null);

  if (!hasToday) {
    // After midnight the aggregate can be empty while the meter is live.
    const meterLive = data.meter.age_seconds != null && data.meter.age_seconds < LIVE_WITHIN_S;
    return (
      <div style={wrap}>
        <EmptyState icon={Gauge} title={meterLive ? 'No usage figures yet today' : "The meter hasn't reported today"} description="Usage shows up here as soon as it does." />
        {supplyAndRaw}
      </div>
    );
  }

  // Header status
  const age = data.meter.age_seconds;
  const live = age != null && age <= LIVE_WITHIN_S;
  const statusText = age == null ? 'Waiting for the meter' : `${live ? 'Live' : 'Not reporting'} · last reading ${ago(age)}`;

  // Hero chip against yesterday at this time
  const e = today.energy_kwh;
  const y = today.yesterday_at_now_kwh;
  let chip: { text: string; bg: string; ink: string } | null = null;
  if (e != null && y != null && y > 0) {
    const pct = Math.round((Math.abs(e - y) / y) * 100);
    if (pct === 0) chip = { text: 'About the same as yesterday at this time', bg: t.idleBg, ink: t.ink2 };
    else if (e > y) chip = { text: `${pct}% more than yesterday at this time`, bg: t.waitBg, ink: t.waitInk };
    else chip = { text: `${pct}% less than yesterday at this time`, bg: t.goodBg, ink: t.goodInk };
  }
  const yesterdayLine = [
    today.yesterday_at_now_kwh != null ? `Yesterday had used ${fmt(today.yesterday_at_now_kwh, 1)} kWh by now` : null,
    today.yesterday_total_kwh != null ? `finished at ${fmt(today.yesterday_total_kwh, 1)} kWh` : null,
  ].filter(Boolean);

  // Curve
  const slots = data.curve.yesterday.length || 96;
  const all = [...data.curve.today, ...data.curve.yesterday].filter((v): v is number => v != null);
  const W = curveW, X1 = W - PAD_R;
  const ymax = niceMax(all.length ? Math.max(...all) * 1.1 : 0); // ~10% headroom above the highest point
  const px = (i: number) => X0 + ((i + 0.5) / slots) * (X1 - X0);
  const py = (v: number) => Y0 - (Math.min(v, ymax) / ymax) * (Y0 - YTOP);
  const todayRuns = runs(data.curve.today, px, py);
  const yestRuns = runs(data.curve.yesterday, px, py);
  let lastIdx = -1;
  data.curve.today.forEach((v, i) => { if (v != null) lastIdx = i; });
  const nowX = px(lastIdx);
  const nowKw = liveKw(ctLatest, Date.now());
  const nowV = nowKw ?? (data.curve.today[lastIdx] as number); // the live reading when there is one, so dot and label agree
  const nowY = py(nowV);
  const nowLabelY = Math.max(14, nowY - 12);
  // Missing slots before the latest reading: shaded so a gap reads as "no reading", not a drawing fault.
  const gaps: [number, number][] = [];
  for (let i = 0; i <= lastIdx; i++) {
    if (data.curve.today[i] != null) continue;
    const g = gaps[gaps.length - 1];
    if (g && g[1] === i - 1) g[1] = i; else gaps.push([i, i]);
  }
  const slotW = (X1 - X0) / slots;
  const nowLabel = nowKw == null ? 'Now · —' : `Now · ${fmt(nowKw, 2)} kW`;
  const hourX = (h: number) => X0 + (h / 24) * (X1 - X0);
  const yTicks = [0, ymax / 2, ymax];
  const hourAnchor = (h: number) => (h === 0 ? 'start' : h === 24 ? 'end' : 'middle');
  const yesterdayNow = data.curve.yesterday[lastIdx] ?? null;
  const step = data.step_minutes || 15;
  const slotTime = (i: number) => {
    const m = i * step, h = Math.floor(m / 60) % 24;
    return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  };
  const clampSlot = (i: number) => Math.max(0, Math.min(slots - 1, i));
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    setHover(clampSlot(Math.round(((x - X0) / (X1 - X0)) * slots - 0.5)));
  };
  const onCurveKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'Escape') { setHover(null); return; }
    const moves: Record<string, (h: number) => number> = {
      ArrowLeft: h => h - 1, ArrowRight: h => h + 1, Home: () => 0, End: () => Math.max(0, lastIdx),
    };
    const mv = moves[e.key];
    if (!mv) return;
    e.preventDefault();
    setHover(h => clampSlot(mv(h ?? Math.max(0, lastIdx))));
  };
  const hv = hover == null ? null : { x: px(hover), today: data.curve.today[hover] ?? null, yest: data.curve.yesterday[hover] ?? null };
  const curveReadout = hover == null || !hv ? null
    : `${slotTime(hover)} · Today ${hv.today == null ? (hover <= lastIdx ? 'no reading' : '—') : `${fmt(hv.today, 2)} kW`} · Yesterday ${hv.yest == null ? '—' : `${fmt(hv.yest, 2)} kW`}`;

  const kpis: { label: string; value: string; unit: string; note: string; tip: string }[] = [
    { tip: TIPS.now, label: 'Using right now', value: fmt(nowKw, 2), unit: 'kW', note: nowKw == null ? 'No reading in the last 15 minutes' : yesterdayNow != null ? `Yesterday at this time: ${fmt(yesterdayNow, 2)} kW` : 'Live from the meter' },
    {
      tip: TIPS.peak, label: 'Highest demand today', value: fmt(today.peak_kw, 2), unit: 'kW',
      note: today.peak_kw == null ? 'No readings yet today' : `At ${clock(today.peak_at, tz)}${today.yesterday_peak_kw != null ? `. Yesterday: ${fmt(today.yesterday_peak_kw, 2)} kW` : ''}`,
    },
    { tip: TIPS.avg, label: 'Average load today', value: fmt(today.avg_kw, 2), unit: 'kW', note: today.avg_kw == null ? 'No readings yet today' : 'Since midnight' },
    { tip: TIPS.base, label: 'Overnight base load', value: fmt(today.base_load_kw, 2), unit: 'kW', note: today.base_load_kw == null ? 'Needs a few nights of readings' : 'Between 1 and 5 am, over the last week' },
  ];

  // Heat strip
  const heatVals = data.heatmap.kw.flat().filter((v): v is number => v != null);
  const heatMax = Math.max(0.1, ...heatVals);
  const stops = isDark ? RAMP_DARK : RAMP_LIGHT;
  const hourMeans = Array.from({ length: 24 }, (_, h) => mean(data.heatmap.kw.map(r => r[h]).filter((v): v is number => v != null)));
  const busiest = hourMeans.some(v => v != null)
    ? hourMeans.reduce<number>((best, v, h) => ((v ?? -1) > (hourMeans[best] ?? -1) ? h : best), 0)
    : null;

  // 14-day bars
  const maxDay = Math.max(1, ...data.days.map(d => d.kwh ?? 0));
  const dayIdx = dayHover ?? data.days.length - 1;
  const dayPick = data.days[dayIdx];
  const avgDay = data.month.avg_day_kwh;
  const dayReadout = !dayPick ? '' : dayPick.kwh == null ? `${dayLabel(dayPick.date)} · no reading`
    : dayIdx === data.days.length - 1 ? `Today · ${fmt(dayPick.kwh, 1)} kWh so far`
    : `${dayLabel(dayPick.date)} · ${fmt(dayPick.kwh, 1)} kWh${avgDay != null ? `, ${fmt(Math.abs(dayPick.kwh - avgDay), 1)} kWh ${dayPick.kwh >= avgDay ? 'above' : 'below'} this month's daily average` : ''}`;
  const heatV = heat == null ? null : data.heatmap.kw[heat[0]]?.[heat[1]] ?? null;
  const heatReadout = heat == null ? null
    : `${dayLabel(data.heatmap.dates[heat[0]])}, ${hourWord(heat[1])} · ${heatV == null ? 'no reading' : `${heatV.toFixed(2)} kW`}`;


  return (
    <div style={wrap}>
      {/* Header strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ ...h2, margin: 0, fontSize: 24, letterSpacing: '-0.02em' }}>{data.meter_only === false ? 'Power on the metered circuits' : 'How this site uses power'}</h2>
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 999, fontSize: 14, fontWeight: 600,
            background: live ? t.goodBg : t.waitBg, color: live ? t.goodInk : t.waitInk,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: live ? t.good : t.wait }} />
          {statusText}
        </div>
      </div>
      {data.meter_only === false && (
        <p data-testid="meter-caveat" style={{ ...sub, margin: '-6px 0 0' }}>
          {`${serial ? `Meter ${serial}` : 'The meter'} measures only the circuits wired through it, not the whole home. Solar, battery and grid come from the inverter (Overview tab).`}
        </p>
      )}

      {/* Hero + curve, side cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
        <section style={{ ...card, flex: '999 1 560px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: t.ink2 }}>{data.meter_only === false ? 'Metered today, so far' : 'Energy used today, so far'}<InfoTip label="today's energy" text={TIPS.hero} t={t} /></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 14 }}>
            <div data-testid="hero-kwh" style={{ ...NUM, fontFamily: t.head, fontWeight: 700, fontSize: 'clamp(52px, 11vw, 84px)', lineHeight: 1, letterSpacing: '-0.03em' }}>
              {fmt(e, 1)}<span style={{ fontSize: 28, fontWeight: 500, color: t.ink2, marginLeft: 8 }}>kWh</span>
            </div>
            {chip && (
              <div style={{ display: 'inline-flex', padding: '5px 12px', borderRadius: 999, background: chip.bg, color: chip.ink, fontSize: 14, fontWeight: 600 }}>
                {chip.text}
              </div>
            )}
          </div>
          {yesterdayLine.length > 0 && <div style={{ fontSize: 14, color: t.ink2 }}>{yesterdayLine.join(', and ')}.</div>}

          <div ref={setCurveEl} data-testid="curve-wrap" style={{ marginTop: 'auto', paddingTop: 14 }}>
            <svg
              viewBox={`0 0 ${W} ${H}`} width="100%" height={H} data-width={W} role="img" tabIndex={0} data-testid="usage-curve"
              aria-label="Power through the day: today against yesterday. Use the arrow keys to read each time."
              onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)} onKeyDown={onCurveKey} onBlur={() => setHover(null)}
              style={{ display: 'block', touchAction: 'pan-y', cursor: 'crosshair' }}
            >
              <defs>
                <linearGradient id="usageAmberFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.wait} stopOpacity={isDark ? 0.55 : 0.42} />
                  <stop offset="100%" stopColor={t.wait} stopOpacity={isDark ? 0.08 : 0.02} />
                </linearGradient>
              </defs>
              {gaps.map(([a, b]) => (
                <rect key={a} data-testid="curve-gap" x={X0 + a * slotW} y={YTOP} width={(b - a + 1) * slotW} height={Y0 - YTOP} fill={t.idleBg} opacity={0.7}>
                  <title>{`No reading ${slotTime(a)} to ${slotTime(b + 1)}`}</title>
                </rect>
              ))}
              {yTicks.map(v => (
                <g key={v}>
                  <line x1={X0} x2={X1} y1={py(v)} y2={py(v)} stroke={t.line2} />
                  <text x={X0 - 8} y={py(v) + 4} textAnchor="end" fontSize="12" fill={t.ink2} fontFamily={t.body}>{`${+v.toFixed(1)} kW`}</text>
                </g>
              ))}
              {[0, 6, 12, 18, 24].map(h => (
                <text key={h} data-testid="hour-label" x={hourX(h)} y={Y0 + 20} textAnchor={hourAnchor(h)} fontSize="12" fill={t.ink2} fontFamily={t.body}>
                  {h === 0 || h === 24 ? '12 am' : hourWord(h)}
                </text>
              ))}
              <path data-testid="yesterday-line" d={linePath(yestRuns)} fill="none" stroke={t.ink2} strokeWidth="1.6" strokeDasharray="4 4" />
              <path d={areaPath(todayRuns)} fill="url(#usageAmberFill)" />
              <path data-testid="today-line" d={linePath(todayRuns)} fill="none" stroke={t.wait} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
              <line x1={nowX} x2={nowX} y1={YTOP} y2={Y0} stroke={t.ink} strokeWidth="1" strokeDasharray="2 3" opacity={hv ? 0.3 : 1} />
              <circle data-testid="now-dot" cx={nowX} cy={nowY} r="5" fill={t.wait} stroke={t.card} strokeWidth="2.5" />
              {hv && (
                <g data-testid="curve-guide" pointerEvents="none">
                  <line x1={hv.x} x2={hv.x} y1={YTOP} y2={Y0} stroke={t.ink} strokeWidth="1.2" />
                  {hv.yest != null && <circle cx={hv.x} cy={py(hv.yest)} r="4" fill={t.card} stroke={t.ink2} strokeWidth="2" />}
                  {hv.today != null && <circle cx={hv.x} cy={py(hv.today)} r="5" fill={t.wait} stroke={t.card} strokeWidth="2" />}
                </g>
              )}
              {!hv && <text
                x={nowX > W * 0.6 ? nowX - 8 : nowX + 8} y={nowLabelY} textAnchor={nowX > W * 0.6 ? 'end' : 'start'}
                fontSize="12" fontWeight="600" fill={t.ink} fontFamily={t.body}
              >
                {nowLabel}
              </text>}
            </svg>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13, color: t.ink2, marginTop: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 3, borderRadius: 2, background: t.wait }} />Today
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 0, borderTop: `2px dashed ${t.ink2}` }} />Yesterday
              </span>
              <span data-testid="curve-readout" aria-live="polite" style={{ ...NUM, color: curveReadout ? t.ink : t.ink2, fontWeight: curveReadout ? 600 : 400 }}>
                {curveReadout ?? 'Point at or tap the chart to read a time'}
              </span>
            </div>
          </div>
        </section>

        <aside style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {kpis.map(k => (
            <div key={k.label} data-testid="kpi-card" style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 18, padding: '16px 20px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: t.ink2 }}>{k.label}<InfoTip label={k.label} text={k.tip} t={t} /></div>
              <div style={{ ...NUM, fontFamily: t.head, fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', margin: '2px 0' }}>
                {k.value}
                {k.value !== '—' && <span style={{ fontSize: 16, fontWeight: 500, color: t.ink2, marginLeft: 5 }}>{k.unit}</span>}
              </div>
              <div style={{ fontSize: 13, color: t.ink2 }}>{k.note}</div>
            </div>
          ))}
        </aside>
      </div>

      {/* Heat strip + 14-day bars */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
        <section style={{ ...card, flex: '999 1 560px' }}>
          <h2 style={{ ...h2, display: 'flex', alignItems: 'center', gap: 8 }}>{data.meter_only === false ? 'When these circuits use power' : 'When this site uses power'}<InfoTip label="the heat map" text={TIPS.heat} t={t} /></h2>
          <p style={{ ...sub, marginBottom: 16 }}>The last 14 days, hour by hour. A stronger colour means more power.</p>
          <div style={{ overflowX: 'auto' }}>
            <div
              style={{ minWidth: 560 }} role="img" onMouseLeave={() => setHeat(null)}
              aria-label={`Heat map of power use over the last 14 days, hour by hour.${busiest != null ? ` Busiest around ${hourWord(busiest)}.` : ''}`}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(24, minmax(0, 1fr))', gap: 3, alignItems: 'center' }}>
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ ...NUM, fontSize: 10, color: t.ink2, textAlign: 'center', height: 14 }}>{h % 6 === 0 ? h : ''}</div>
                ))}
              </div>
              {data.heatmap.dates.map((date, r) => (
                <div key={date} data-testid="heat-row" style={{ display: 'grid', gridTemplateColumns: '56px repeat(24, minmax(0, 1fr))', gap: 3, marginTop: 3, alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: t.ink2, whiteSpace: 'nowrap' }}>{dayLabel(date)}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const v = data.heatmap.kw[r]?.[h] ?? null;
                    return (
                      <div
                        key={h}
                        data-testid="heat-cell"
                        onMouseEnter={() => setHeat([r, h])}
                        title={`${dayLabel(date)}, ${hourWord(h)} · ${v == null ? 'no reading' : `${v.toFixed(2)} kW`}`}
                        style={{ height: 17, borderRadius: 4, background: v == null ? t.idleBg : ramp(stops, v / heatMax), outline: heat && heat[0] === r && heat[1] === h ? `2px solid ${t.ink}` : 'none', outlineOffset: -1 }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 14, fontSize: 12, color: t.ink2 }}>
            <span>Less</span>
            <span style={{ width: 120, height: 10, borderRadius: 5, background: `linear-gradient(90deg, ${stops.map(c => `rgb(${c.join(',')})`).join(', ')})` }} />
            <span>More</span>
            <span data-testid="heat-readout" style={{ ...NUM, marginLeft: 'auto', color: heatReadout ? t.ink : t.ink2, fontWeight: heatReadout ? 600 : 400 }}>
              {heatReadout ?? (busiest != null ? `Busiest around ${hourWord(busiest)}.` : '')}
            </span>
          </div>
        </section>

        <section style={{ ...card, flex: '1 1 340px' }}>
          <h2 style={{ ...h2, display: 'flex', alignItems: 'center', gap: 8 }}>Energy by day<InfoTip label="energy by day" text={TIPS.days} t={t} /></h2>
          <p style={{ ...sub, marginBottom: 14 }}>Last 14 days, in kWh.</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 170, borderBottom: `1px solid ${t.line}` }} onMouseLeave={() => setDayHover(null)}>
            {data.days.map((d, i) => {
              const isToday = i === data.days.length - 1;
              return (
                <div key={d.date} data-testid="day-bar" role="img" aria-label={`${dayLabel(d.date)}: ${d.kwh == null ? 'no reading' : `${fmt(d.kwh, 1)} kWh`}`} data-today={isToday ? 'true' : 'false'} tabIndex={0} onMouseEnter={() => setDayHover(i)} onFocus={() => setDayHover(i)} onBlur={() => setDayHover(null)} style={{ flex: 1, minWidth: 0, outlineOffset: 2, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%', gap: 4 }}>
                  <span style={{ ...NUM, fontSize: 10, color: t.ink2 }}>{d.kwh == null ? '' : d.kwh.toFixed(0)}</span>
                  <div style={{ width: '100%', height: d.kwh == null ? 0 : Math.round((d.kwh / maxDay) * 130), borderRadius: '6px 6px 2px 2px', background: t.wait, opacity: (dayHover == null ? isToday : dayHover === i) ? 1 : 0.38, transition: 'opacity .15s' }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {data.days.map(d => (
              <span key={d.date} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 10, color: t.ink2 }}>{Number(d.date.slice(8))}</span>
            ))}
          </div>
          <div data-testid="day-readout" aria-live="polite" style={{ ...NUM, marginTop: 10, fontSize: 13, fontWeight: 600, color: t.ink }}>{dayReadout}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 14, borderTop: `1px solid ${t.line2}`, fontSize: 14 }}>
            <span style={{ color: t.ink2 }}>Daily average this month</span>
            <span style={{ ...NUM, fontWeight: 600 }}>{`${fmt(data.month.avg_day_kwh, 1)} kWh`}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 14 }}>
            <span style={{ color: t.ink2 }}>Total this month so far</span>
            <span style={{ ...NUM, fontWeight: 600 }}>{`${fmt(data.month.to_date_kwh, 1)} kWh`}</span>
          </div>
        </section>
      </div>

      {supplyAndRaw}
    </div>
  );
};

export default UsageTab;
