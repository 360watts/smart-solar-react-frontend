/**
 * History tab (2026-11-19): chart first, then "Anything wrong?", then "Where energy went". Whole home where the site
 * has the parts (inverter + grid board + EV), else "Inverter circuits only". Spec
 * docs/superpowers/specs/2026-11-19-history-tab-redesign-design.md (mockups A3 + C); scenarios
 * docs/test-scenarios/history-tab-redesign.md.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar as CJBar, Line as CJLine } from 'react-chartjs-2';
import { BarController, Chart as ChartJS, LineController, type ChartOptions } from 'chart.js';
import { apiService, type HouseDay, type HouseholdDay, type SiteEvent } from '../../../../services/api';
import { useChartZoomState, ZoomResetButton } from '../chartUtils';
import { ChartLegend, KpiRow, KpiTile, Seg, ink, inkMuted, legendFrom, segBtn, segWrap } from './cardParts';
import { HistoryCalendar } from './HistoryCalendar';
import {
  addDays, balanceGap, buildFlags, change, customRange, dayStartMs, daysBetween, daysOf, fmtDay, istDay, periodRange, prevRange,
  sentence, slotsToFlows, totals, unbalanced, weeks, type Metric, type Period, type Totals,
} from './historyModel';

// the 7-day bars mix a line ("Solar made") into a bar chart: both controllers must be registered
ChartJS.register(BarController, LineController);

const SOLAR = '#F07522', BATT = '#0F9F8F', GRID = '#3B82F6', MADE = '#9A3412';
const MAX_DAYS = 400; // the daily route's cap
const FLAG_ROWS = 3;  // "Anything wrong?" shows this many lines, then "Show all N"
const k1 = (v: number) => v.toFixed(1);
const signed = (v: number | null) => (v == null ? null : `${v > 0 ? '+' : ''}${v}%`);

interface Props { siteId: string; isDark: boolean; nowMs?: number }

const HistoryTab: React.FC<Props> = ({ siteId, isDark, nowMs }) => {
  const now = nowMs ?? Date.now();
  const today = istDay(now);
  const [period, setPeriod] = useState<Period>('today');
  const [offset, setOffset] = useState(0);
  const [pick, setPick] = useState(() => { const r = periodRange('30d', 0, now); return { start: r.start, end: r.end }; });
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [detail, setDetail] = useState(false);
  const [metric, setMetric] = useState<Metric>('own');
  const [picked, setPicked] = useState<string | null>(null);
  const [showAllFlags, setShowAllFlags] = useState(false);
  const [day, setDay] = useState<HouseholdDay | null>(null);
  const [prevDay, setPrevDay] = useState<HouseholdDay | null>(null);
  const [days, setDays] = useState<HouseDay[]>([]);
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const zoom = useChartZoomState();

  const range = useMemo(() => (period === 'custom' ? customRange(pick.start, pick.end, offset) : periodRange(period, offset, dayStartMs(today))),
    [period, offset, today, pick.start, pick.end]);
  const prev = useMemo(() => prevRange(range), [range]);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    const back = Math.min(90, daysBetween(prev.start, today) + 1);
    const jobs: Promise<unknown>[] = [
      apiService.getSiteEvents(siteId, back).then(r => { if (live) setEvents(r.events); }).catch(() => { if (live) setEvents([]); }),
    ];
    if (period === 'today') {
      jobs.push(apiService.getHouseholdDay(siteId, range.end).then(r => { if (live) setDay(r); }));
      jobs.push(apiService.getHouseholdDay(siteId, prev.end).then(r => { if (live) setPrevDay(r); }));
    } else {
      // the route caps at 400 days: a long custom span skips the comparison
      const from = range.len * 2 <= MAX_DAYS ? prev.start : range.start;
      jobs.push(apiService.getHouseholdDaily(siteId, from, range.end).then(r => { if (live) setDays(r.days); }));
    }
    Promise.all(jobs)
      .catch(e => {
        if (!live) return;
        const msg = e instanceof Error ? e.message : '';
        // a 404 page means the server predates the household routes (backend not deployed yet); never show raw HTML
        setError(/not found|<html/i.test(msg) ? "the server doesn't have the History data routes yet (backend update not deployed)"
          : msg.startsWith('<') || !msg ? 'History is unavailable right now' : msg);
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [siteId, period, range.start, range.end, range.len, prev.start, prev.end, today]);

  // ── numbers ──
  const inRange = days.filter(d => d.date >= range.start && d.date <= range.end);
  const inPrev = days.filter(d => d.date >= prev.start && d.date <= prev.end);
  let cur: Totals;
  let before: Totals | null;
  if (period === 'today') {
    const slots = day?.slots ?? [];
    const lastMs = slots.length ? Date.parse(slots[slots.length - 1].ts) + 15 * 60_000 : 0;
    cur = totals([slotsToFlows(slots)]);
    // a running day compares with the same hours of the day before (spec decision)
    before = prevDay ? totals([slotsToFlows(prevDay.slots, range.end === today ? lastMs - 864e5 : Infinity)]) : null;
  } else {
    cur = totals(inRange);
    before = inPrev.length ? totals(inPrev) : null;
  }
  const hasBattery = period === 'today' ? (day?.slots ?? []).some(s => s.soc != null) : inRange.some(d => d.soc_max != null);
  const { list: flags, checks } = buildFlags(period === 'today' ? [] : inRange, events, range, hasBattery, today);
  const flagged = new Set(flags.flatMap(f => f.dates));
  const openCount = flags.reduce((t, f) => t + f.open, 0);
  const label = period === 'today' ? (range.end === today ? 'Today' : `On ${fmtDay(range.end)}`) : `Over these ${range.len} days`;
  const empty = cur.counted === 0;
  const weekly = period !== 'today' && range.len > 60;

  // ── chart ──
  const chart = useMemo(() => {
    if (period === 'today') {
      const slots = day?.slots ?? [];
      const labels = slots.map(s => new Date(s.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }));
      const area = (lab: string, key: 'from_solar_kw' | 'from_battery_kw' | 'from_grid_kw', c: string) =>
        ({ label: lab, data: slots.map(s => s[key]), borderColor: c, backgroundColor: `${c}CC`, fill: true, stack: 'home', pointRadius: 0, borderWidth: 0, tension: 0, yAxisID: 'y' });
      const ds: any[] = [
        area('From solar', 'from_solar_kw', SOLAR), area('From battery', 'from_battery_kw', BATT), area('From grid', 'from_grid_kw', GRID),
        { label: 'Solar made', data: slots.map(s => s.pv_kw), borderColor: MADE, borderWidth: 2.5, fill: false, stack: 'pv', pointRadius: 0, tension: 0, yAxisID: 'y' },
        { label: 'Battery %', data: slots.map(s => s.soc), borderColor: BATT, borderDash: [6, 4], borderWidth: 2, fill: false, stack: 'soc', pointRadius: 0, tension: 0, yAxisID: 'soc' },
      ];
      if (detail) {
        ds.push({ label: 'Inverter output', data: slots.map(s => s.inv_out_kw), borderColor: '#f43f5e', borderDash: [4, 2], borderWidth: 1.5, fill: false, stack: 'inv', pointRadius: 0, yAxisID: 'y' });
        ds.push({ label: 'Inverter-side load', data: slots.map(s => s.inverter_kw), borderColor: '#8b5cf6', borderWidth: 1.5, fill: false, stack: 'invload', pointRadius: 0, yAxisID: 'y' });
      }
      return { labels, datasets: ds };
    }
    const rows = weekly ? weeks(inRange, range) : daysOf(range).map(d => inRange.find(x => x.date === d));
    const bar = (lab: string, key: 'from_solar_kwh' | 'from_battery_kwh' | 'from_grid_kwh', c: string) =>
      ({ type: 'bar' as const, label: lab, data: rows.map(r => r?.[key] ?? null), backgroundColor: rows.map(r => (r?.whole_home ? c : `${c}80`)), borderColor: c, stack: 'home' });
    return {
      labels: weekly ? rows.map(r => `Week of ${fmtDay(r!.date)}`) : daysOf(range).map(fmtDay),
      datasets: [
        bar('From solar', 'from_solar_kwh', SOLAR), bar('From battery', 'from_battery_kwh', BATT), bar('From grid', 'from_grid_kwh', GRID),
        { type: 'line' as const, label: 'Solar made', data: rows.map(r => r?.pv_kwh ?? null), borderColor: MADE, backgroundColor: MADE, pointRadius: 4, borderWidth: 2.5, tension: 0.25, spanGaps: true, stack: 'pv' },
      ],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, day, days, detail, range.start, range.end, weekly]);

  const options = useMemo<ChartOptions<any>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (it: any) => ` ${it.dataset.label}: ${it.parsed.y == null ? '–' : Number(it.parsed.y).toFixed(2)} ${it.dataset.yAxisID === 'soc' ? '%' : period === 'today' ? 'kW' : 'kWh'}` } },
    },
    scales: {
      x: { stacked: true, ticks: { color: inkMuted(isDark), maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } },
      y: { stacked: true, beginAtZero: true, ticks: { color: inkMuted(isDark) }, title: { display: true, text: period === 'today' ? 'kW' : 'kWh', color: inkMuted(isDark) } },
      ...(period === 'today' ? { soc: { position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { color: inkMuted(isDark), callback: (v: any) => `${v}%` } } } : {}),
    },
  }), [isDark, period]);

  // ── render ──
  const card: React.CSSProperties = {
    background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.85)', borderRadius: 20, padding: '16px 20px',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,159,143,0.18)'}`, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0,
  };
  const h2: React.CSSProperties = { margin: 0, fontFamily: 'Rubik, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: ink(isDark) };
  const muted: React.CSSProperties = { margin: 0, fontFamily: 'Rubik, sans-serif', fontSize: '0.8125rem', color: 'var(--muted-foreground)' };
  const scope = cur.basis === 'inverter' ? 'Inverter circuits only'
    : cur.counted < cur.of ? `Whole home on ${cur.counted} of ${cur.of} days` : 'Whole home: inverter circuits + grid-direct circuits';
  const share = (v: number, of: number) => (of > 0 ? `${Math.round((v / of) * 100)}%` : '–');
  const prevWord = period === 'today' ? 'the day before' : 'the period before';
  const cmp = (c: number | null) => (c == null ? '' : ` · ${signed(c)} vs ${prevWord}`);
  const gridChange = signed(change(cur.bought, before?.bought ?? null));
  const note = day?.note && period === 'today' ? day.note : null;

  return (
    <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <Seg<Period> label="Period" value={period} isDark={isDark} onChange={p => { setPeriod(p); setOffset(0); setPicked(null); zoom.resetZoom(); }}
          options={[['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['custom', 'Pick dates']]} />
        <div role="group" aria-label="Step" style={segWrap(isDark)}>
          <button type="button" aria-label="Previous period" onClick={() => setOffset(o => o - 1)} style={segBtn(false, true, isDark)}>‹</button>
          <span style={{ ...segBtn(false, false, isDark), cursor: 'default', display: 'inline-flex', alignItems: 'center' }}>
            {range.len === 1 ? fmtDay(range.end) : `${fmtDay(range.start)} – ${fmtDay(range.end)}`}
          </span>
          <button type="button" aria-label="Next period" disabled={offset >= 0} onClick={() => setOffset(o => Math.min(0, o + 1))}
            style={{ ...segBtn(false, false, isDark), opacity: offset >= 0 ? 0.4 : 1 }}>›</button>
        </div>
      </div>
      {period === 'custom' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {([['From', 'start'], ['To', 'end']] as const).map(([lab, key]) => (
            <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: ink(isDark) }}>{lab}
              <input type="date" value={pick[key]}
                min={key === 'start' ? addDays(pick.end, -(MAX_DAYS - 1)) : pick.start} max={key === 'start' ? pick.end : today}
                onChange={e => { const v = e.target.value; if (v) { setPick(p => ({ ...p, [key]: v })); setOffset(0); } }}
                style={{ minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', padding: '0 10px', background: 'transparent', color: 'inherit', font: 'inherit' }} />
            </label>
          ))}
        </div>
      )}
      {error && <div role="alert" style={{ ...card, color: '#b91c1c' }}>History unavailable: {error}</div>}

      {/* 1. chart */}
      <section data-testid="history-chart" style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={h2}>{period === 'today' ? 'Through the day' : period === '30d' ? '30 days at a glance' : weekly ? 'Week by week' : 'Day by day'}</h2>
            <p style={muted}>{empty ? 'No readings yet' : `${cur.ownPct ?? '–'}% own power · bought ${k1(cur.bought)} kWh · exported ${k1(cur.exported)} kWh`}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {period === 'today' && view === 'chart' && (
              <div style={segWrap(isDark)}>
                <button type="button" aria-pressed={detail} onClick={() => setDetail(!detail)} style={segBtn(detail, true, isDark)}>Inverter detail</button>
              </div>
            )}
            {period !== '30d' && <Seg<'chart' | 'table'> label="View" value={view} isDark={isDark} onChange={setView} options={[['chart', 'Chart'], ['table', 'Table']]} />}
            <ZoomResetButton visible={zoom.isZoomed} onClick={zoom.resetZoom} />
          </div>
        </div>
        {loading && empty ? <p style={muted}>Loading history…</p>
          : period === 'today' && day?.reason === 'older_than_90_days' ? <p style={muted}>Detailed readings are kept for 90 days. Use 7 days, 30 days or Pick dates to see this day's totals.</p>
          : period === '30d' ? (
            <HistoryCalendar days={inRange} range={range} flagged={flagged} isDark={isDark} metric={metric} onMetric={setMetric}
              picked={picked} onPick={setPicked}
              onOpen={d => { setPeriod('today'); setPicked(null); setOffset(-daysBetween(d, today)); }} />
          ) : view === 'table' ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 520 }}>
                <thead><tr>{[period === 'today' ? 'Time' : weekly ? 'Week' : 'Day', 'Solar made', 'Home', 'From solar', 'From battery', 'From grid'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid var(--border)' }}>{h}</th>))}</tr></thead>
                <tbody>{chart.labels.map((l: string, i: number) => (
                  <tr key={l + i}><td style={{ padding: 8 }}>{l}</td>
                    {[3, -1, 0, 1, 2].map(j => {
                      const v = j < 0 ? chart.datasets.slice(0, 3).reduce((t: number, d: any) => t + (d.data[i] ?? 0), 0) : chart.datasets[j].data[i];
                      return <td key={j} style={{ padding: 8, fontFamily: 'Fira Code, monospace' }}>{v == null ? '–' : Number(v).toFixed(2)}</td>;
                    })}</tr>))}</tbody>
              </table>
            </div>
          ) : (
            <div>
              <ChartLegend items={legendFrom(chart.datasets.map((d: any) => ({ ...d, fill: false, backgroundColor: d.borderColor })))} />
              <div style={{ height: 320 }}>
                {period === 'today'
                  ? <CJLine ref={zoom.chartRef} data={chart as any} options={options} />
                  : <CJBar ref={zoom.chartRef} data={chart as any} options={options} />}
              </div>
            </div>
          )}
      </section>

      {/* 2. anything wrong */}
      <section data-testid="history-flags" style={{ ...card, gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={h2}>Anything wrong?</h2>
          <span style={{ ...muted, fontWeight: 600, color: flags.length ? (isDark ? '#FBBF24' : '#B45309') : 'var(--muted-foreground)' }}>
            {flags.length === 0 ? `All clear · ${checks} checks`
              : `${flags.length} ${flags.length === 1 ? 'issue' : 'issues'}${openCount ? ` · ${openCount} open` : ''} · ${checks - new Set(flags.map(f => f.kind)).size} of ${checks} checks passed`}
          </span>
        </div>
        {flags.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {(showAllFlags ? flags : flags.slice(0, FLAG_ROWS)).map((f, i) => (
              <li key={f.kind + f.title} style={{ borderTop: i ? '1px solid var(--border)' : undefined }}>
                <details>
                  <summary style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer', listStyle: 'none', color: ink(isDark) }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: f.tone === 'amber' ? '#F59E0B' : '#94A3B8' }} />
                    <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.9375rem' }} title={f.title}>{f.title}</span>
                    {f.count > 1 && <span style={{ flex: 'none', fontFamily: 'Fira Code, monospace', fontSize: '0.8125rem', fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: isDark ? 'rgba(148,163,184,0.15)' : '#F1F5F9' }}>×{f.count}</span>}
                    {f.open > 0 && <span style={{ flex: 'none', fontSize: '0.75rem', fontWeight: 700, color: isDark ? '#FBBF24' : '#B45309' }}>open</span>}
                    <span style={{ ...muted, flex: 'none', whiteSpace: 'nowrap' }}>{f.when}</span>
                  </summary>
                  <p style={{ ...muted, padding: '0 0 10px 18px' }}>{f.detail}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
        {flags.length > FLAG_ROWS && (
          <button type="button" onClick={() => setShowAllFlags(v => !v)}
            style={{ alignSelf: 'flex-start', minHeight: 36, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: 'var(--brand-green)' }}>
            {showAllFlags ? 'Show fewer' : `Show all ${flags.length}`}
          </button>
        )}
      </section>

      {/* 3. where energy went */}
      <section data-testid="history-where" style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={h2}>Where energy went</h2>
          <span style={muted}>{scope}{note ? ` · ${note}` : ''}</span>
        </div>
        {empty ? <p style={muted}>No readings for this period yet.</p> : (
          <>
            <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.45, color: ink(isDark) }}>{sentence(cur, before, label)}</p>
            {unbalanced(cur) && (
              <p style={muted} title="Solar made minus (to the home + into the battery + exported)">
                Figures don't fully balance: solar made and where it went differ by {k1(Math.abs(balanceGap(cur)))} kWh.
              </p>
            )}
            {[
              { title: `Solar made ${k1(cur.pv)} kWh`, sub: cmp(change(cur.pv, before?.pv ?? null)), parts: [
                [cur.fromSolar, SOLAR, `${k1(cur.fromSolar)} kWh to the home (${share(cur.fromSolar, cur.pv)})`],
                [cur.toBattery, BATT, `${k1(cur.toBattery)} kWh into the battery (${share(cur.toBattery, cur.pv)})`],
                [cur.exported, '#FCD9BF', `${k1(cur.exported)} kWh exported (${share(cur.exported, cur.pv)})`]] as const },
              { title: `Home used ${k1(cur.home)} kWh`, sub: cmp(change(cur.home, before?.home ?? null)), parts: [
                [cur.fromSolar, SOLAR, `${k1(cur.fromSolar)} kWh from solar (${share(cur.fromSolar, cur.home)})`],
                [cur.fromBattery, BATT, `${k1(cur.fromBattery)} kWh from the battery (${share(cur.fromBattery, cur.home)})`],
                [cur.fromGrid, GRID, `${k1(cur.fromGrid)} kWh from the grid (${share(cur.fromGrid, cur.home)})`]] as const },
            ].map(b => (
              <div key={b.title} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: ink(isDark) }}>{b.title}<span style={{ ...muted, display: 'inline' }}>{b.sub}</span></div>
                <div style={{ display: 'flex', height: 24, borderRadius: 8, overflow: 'hidden', gap: 2 }} aria-hidden="true">
                  {b.parts.map(([v, c]) => <div key={c} style={{ flex: Math.max(0, v), background: c }} />)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: '0.8125rem', color: ink(isDark) }}>
                  {b.parts.map(([, c, t]) => (
                    <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <KpiRow>
              <KpiTile isDark={isDark} tone="orange" label="Own power" value={cur.ownPct ?? '–'} unit={cur.ownPct != null ? '%' : undefined}
                sub={before?.ownPct != null ? `${before.ownPct}% ${prevWord}` : undefined} />
              <KpiTile isDark={isDark} tone="blue" label="Bought from grid" value={k1(cur.bought)} unit="kWh"
                sub={gridChange ? `${gridChange} vs ${prevWord}` : undefined} />
              <KpiTile isDark={isDark} label="Exported" value={k1(cur.exported)} unit="kWh" />
              <KpiTile isDark={isDark} tone="teal" label="Battery" value={k1(cur.fromBattery)} unit="kWh used" sub={`${k1(cur.toBattery)} kWh stored`} />
            </KpiRow>
          </>
        )}
      </section>
    </motion.div>
  );
};

export default HistoryTab;
