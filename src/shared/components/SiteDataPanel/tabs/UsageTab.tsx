/**
 * UsageTab: how a meter-only site (energy meter, no inverter) uses power.
 * Fed by GET /sites/<id>/meter-usage/ plus the latest meter reading the site panel already holds.
 * Design: smart-solar-django-backend/docs/superpowers/specs/2026-10-08-meter-usage-tab-design.md
 * House style: UI_GUIDE.md (plain copy, amber never red, tokens from useTokens).
 */
import React, { useEffect, useState } from 'react';
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
}

/** Four range bars from the latest meter reading. Anything missing reads "—", never NaN. */
export function computeHealth(ct: Partial<CtMeterReading> | null | undefined) {
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
  const pf: HealthItem = {
    label: 'Power factor', unit: '', lo: 0.6, hi: 1, a: 0.9, b: 1, v: pfv,
    value: pfv == null ? '—' : pfv.toFixed(2),
    ok: pfv != null && pfv >= 0.9,
    status: pfv == null ? '' : pfv >= 0.9 ? 'Good' : 'Worth a look',
    note: '0.90 or higher is good',
  };

  const fv = mean(nums(ct, 'frequency'));
  const frequency: HealthItem = {
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

// ── Curve geometry ─────────────────────────────────────────────────────────────

const X0 = 36, X1 = 712, Y0 = 196, YTOP = 14;

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

  const health = computeHealth(ctLatest);
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
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{h.label}</span>
                      {h.status && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: h.ok ? t.goodBg : t.waitBg, color: h.ok ? t.goodInk : t.waitInk, fontSize: 12, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }} />{h.status}
                        </span>
                      )}
                    </div>
                    <div style={{ ...NUM, fontFamily: t.head, fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em' }}>
                      {h.value}
                      {h.value !== '—' && h.unit && <span style={{ fontSize: 14, fontWeight: 500, color: t.ink2, marginLeft: 4 }}>{h.unit}</span>}
                    </div>
                    <div style={{ position: 'relative', height: 10, borderRadius: 5, background: t.idleBg, margin: '10px 0 6px' }}>
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
          <h2 style={{ ...h2, margin: 0 }}>Raw readings</h2>
          {ctLatest && (
            <span style={{ fontSize: 14, color: t.ink2 }}>
              {`Exactly what the meter reported${ctAge != null ? `, ${ago(ctAge)}` : ''} (${clock(ctLatest.timestamp, tz, true)}). Refreshes every 30 seconds.`}
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
                  const totalText = fmt(total, r.dp) + (total != null ? tag : '');
                  return (
                    <tr key={r.key} style={{ borderTop: `1px solid ${t.line2}`, textAlign: 'right' }}>
                      <th scope="row" style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 600 }}>{r.label}</th>
                      {vals.map((v, i) => <td key={i} style={{ padding: '11px 10px' }}>{fmt(v, r.dp)}</td>)}
                      <td style={{ padding: '11px 10px', fontWeight: 700 }}>{totalText}</td>
                      <td style={{ textAlign: 'left', padding: '11px 10px', color: t.ink2 }}>{r.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <details style={{ marginTop: 18 }} onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary style={{ cursor: 'pointer', padding: '12px 0', fontSize: 14, fontWeight: 600 }}>Recent readings (last 10)</summary>
          {serial && <p style={{ margin: '0 0 10px', fontSize: 13, color: t.ink2 }}>{`Meter ${serial}. Refreshes every minute while open.`}</p>}
          {recentRows.length === 0 ? (
            <p style={{ ...sub, fontSize: 13 }}>No readings in the last hour.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 6 }}>
              <table aria-label="Recent readings" style={{ ...NUM, width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: t.ink2 }}>
                    <th scope="col" style={{ ...th, textAlign: 'left' }}>Time</th>
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
        <div style={{ ...card, width: '100%', boxSizing: 'border-box' }} role="alert">
          <h2 style={{ ...h2, marginBottom: 14 }}>Couldn't load the usage figures. Try again.</h2>
          <button
            type="button"
            onClick={() => setAttempt(a => a + 1)}
            style={{ minHeight: 44, padding: '0 20px', borderRadius: 12, border: `1px solid ${t.line}`, background: t.idleBg, color: t.ink, fontFamily: t.body, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
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
        <div style={{ ...card, textAlign: 'center', borderStyle: 'dashed', padding: '48px 28px' }}>
          <div style={{ fontFamily: t.head, fontWeight: 600, fontSize: 18 }}>{meterLive ? 'No usage figures yet today.' : "No readings yet. The meter hasn't reported today."}</div>
          <div style={{ ...sub, marginTop: 6 }}>Usage will appear here as soon as it does.</div>
        </div>
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
  const ymax = niceMax(all.length ? Math.max(...all) : 0);
  const px = (i: number) => X0 + ((i + 0.5) / slots) * (X1 - X0);
  const py = (v: number) => Y0 - (Math.min(v, ymax) / ymax) * (Y0 - YTOP);
  const todayRuns = runs(data.curve.today, px, py);
  const yestRuns = runs(data.curve.yesterday, px, py);
  let lastIdx = -1;
  data.curve.today.forEach((v, i) => { if (v != null) lastIdx = i; });
  const nowX = px(lastIdx);
  const nowV = data.curve.today[lastIdx] as number;
  const nowKw = liveKw(ctLatest, Date.now());
  const nowLabel = nowKw == null ? 'Now · —' : `Now · ${fmt(nowKw, 2)} kW`;
  const hourX = (h: number) => X0 + (h / 24) * (X1 - X0);
  const yTicks = [0, ymax / 2, ymax];
  const yesterdayNow = data.curve.yesterday[lastIdx] ?? null;

  const kpis: { label: string; value: string; unit: string; note: string }[] = [
    { label: 'Using right now', value: fmt(nowKw, 2), unit: 'kW', note: nowKw == null ? 'No reading in the last 15 minutes' : yesterdayNow != null ? `Yesterday at this time: ${fmt(yesterdayNow, 2)} kW` : 'Live from the meter' },
    {
      label: 'Highest demand today', value: fmt(today.peak_kw, 2), unit: 'kW',
      note: today.peak_kw == null ? 'No readings yet today' : `At ${clock(today.peak_at, tz)}${today.yesterday_peak_kw != null ? `. Yesterday: ${fmt(today.yesterday_peak_kw, 2)} kW` : ''}`,
    },
    { label: 'Average load today', value: fmt(today.avg_kw, 2), unit: 'kW', note: today.avg_kw == null ? 'No readings yet today' : 'Since midnight' },
    { label: 'Overnight base load', value: fmt(today.base_load_kw, 2), unit: 'kW', note: today.base_load_kw == null ? 'Needs a few nights of readings' : 'Between 1 and 5 am, over the last week' },
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


  return (
    <div style={wrap}>
      {/* Header strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ ...h2, margin: 0, fontSize: 24, letterSpacing: '-0.02em' }}>How this site uses power</h2>
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

      {/* Hero + curve, side cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
        <section style={{ ...card, flex: '999 1 560px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.ink2 }}>Energy used today, so far</div>
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

          <div style={{ marginTop: 14 }}>
            <svg viewBox="0 0 720 220" width="100%" role="img" aria-label="Power through the day: today against yesterday" style={{ display: 'block' }}>
              <defs>
                <linearGradient id="usageAmberFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.wait} stopOpacity="0.42" />
                  <stop offset="100%" stopColor={t.wait} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {yTicks.map(v => (
                <g key={v}>
                  <line x1={X0} x2={X1} y1={py(v)} y2={py(v)} stroke={t.line2} />
                  <text x={X0 - 6} y={py(v) + 4} textAnchor="end" fontSize="11" fill={t.ink2} fontFamily={t.body}>{`${+v.toFixed(1)} kW`}</text>
                </g>
              ))}
              {[0, 6, 12, 18, 24].map(h => (
                <text key={h} x={hourX(h)} y={212} textAnchor="middle" fontSize="11" fill={t.ink2} fontFamily={t.body}>
                  {h === 0 || h === 24 ? '12 am' : hourWord(h)}
                </text>
              ))}
              <path data-testid="yesterday-line" d={linePath(yestRuns)} fill="none" stroke={t.ink2} strokeWidth="1.6" strokeDasharray="4 4" />
              <path d={areaPath(todayRuns)} fill="url(#usageAmberFill)" />
              <path data-testid="today-line" d={linePath(todayRuns)} fill="none" stroke={t.wait} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
              <line x1={nowX} x2={nowX} y1={YTOP} y2={Y0} stroke={t.ink} strokeWidth="1" strokeDasharray="2 3" />
              <circle cx={nowX} cy={py(nowV)} r="5" fill={t.wait} stroke={t.card} strokeWidth="2.5" />
              <text
                x={nowX > 400 ? nowX - 8 : nowX + 8} y={22} textAnchor={nowX > 400 ? 'end' : 'start'}
                fontSize="12" fontWeight="600" fill={t.ink} fontFamily={t.body}
              >
                {nowLabel}
              </text>
            </svg>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13, color: t.ink2, marginTop: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 3, borderRadius: 2, background: t.wait }} />Today
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 0, borderTop: `2px dashed ${t.ink2}` }} />Yesterday
              </span>
            </div>
          </div>
        </section>

        <aside style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {kpis.map(k => (
            <div key={k.label} data-testid="kpi-card" style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 18, padding: '16px 20px', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.ink2 }}>{k.label}</div>
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
          <h2 style={h2}>When this site uses power</h2>
          <p style={{ ...sub, marginBottom: 16 }}>The last 14 days, hour by hour. A stronger colour means more power.</p>
          <div style={{ overflowX: 'auto' }}>
            <div
              style={{ minWidth: 560 }} role="img"
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
                        title={`${dayLabel(date)}, ${hourWord(h)} · ${v == null ? 'no reading' : `${v.toFixed(2)} kW`}`}
                        style={{ height: 17, borderRadius: 4, background: v == null ? t.idleBg : ramp(stops, v / heatMax) }}
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
            {busiest != null && <span style={{ marginLeft: 'auto' }}>{`Busiest around ${hourWord(busiest)}.`}</span>}
          </div>
        </section>

        <section style={{ ...card, flex: '1 1 340px' }}>
          <h2 style={h2}>Energy by day</h2>
          <p style={{ ...sub, marginBottom: 14 }}>Last 14 days, in kWh.</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 170, borderBottom: `1px solid ${t.line}` }}>
            {data.days.map((d, i) => {
              const isToday = i === data.days.length - 1;
              return (
                <div key={d.date} data-testid="day-bar" role="img" aria-label={`${dayLabel(d.date)}: ${d.kwh == null ? 'no reading' : `${fmt(d.kwh, 1)} kWh`}`} data-today={isToday ? 'true' : 'false'} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%', gap: 4 }}>
                  <span style={{ ...NUM, fontSize: 10, color: t.ink2 }}>{d.kwh == null ? '' : d.kwh.toFixed(0)}</span>
                  <div style={{ width: '100%', height: d.kwh == null ? 0 : Math.round((d.kwh / maxDay) * 130), borderRadius: '6px 6px 2px 2px', background: t.wait, opacity: isToday ? 1 : 0.38 }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {data.days.map(d => (
              <span key={d.date} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 10, color: t.ink2 }}>{Number(d.date.slice(8))}</span>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${t.line2}`, fontSize: 14 }}>
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
