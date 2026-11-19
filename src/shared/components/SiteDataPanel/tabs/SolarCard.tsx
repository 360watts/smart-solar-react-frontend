/**
 * Solar card: actual generation, the P50 forecast and its likely range in one chart, KPI tiles on top.
 * Window: Day (15-min slots; today by default, or any day clicked on the daily chart) / Daily (the last
 * 7 days and the next forecast days, in kWh). Replaced the "Solar Generation Forecast" and
 * "Forecast vs Actual" cards (Nov 18, 2026). Scenarios: docs/test-scenarios/solar-forecast-card.md.
 */
import React, { useMemo, useRef, useState } from 'react';
import { usePersistedState } from '../../../hooks/usePersistedState';
import { Line as CJLine } from 'react-chartjs-2';
import type { ChartOptions, Plugin, TooltipItem } from 'chart.js';
import { useChartZoomState, ZoomResetButton, createDragZoomPlugins } from '../chartUtils';
import { resolveCssVar } from '../../../lib/resolveCssVar';
import { IST_TIMEZONE } from '../../../../app/constants';
import { ChartLegend, KpiRow, KpiTile, Seg, groupLabel, groupRow, ink, inkMuted, legendFrom, segBtn, segWrap } from './cardParts';
import {
  buildSlots, dailyTotals, forecastDays, istMidnight, todayKpis, trimNight, DAY_MS, SLOT_MS, type SolarWindow,
} from './solarCardModel';

const IST = IST_TIMEZONE;
const ACT = '#F07522';
const FC_LIGHT = '#0F9F8F';
const FC_DARK = '#2dd4bf'; // the light teal at 40% vanished on navy
const GHI = '#eab308';

export interface SolarCardProps {
  isDark: boolean;
  forecast: any[];   // solar forecast rows (p10_kw / p50_kw / p90_kw / ghi_input_wm2), today and the next days
  accuracy: any;     // forecast-accuracy response: timeseries of the last 7 days + next 24 h
  nowMs?: number;    // tests
}

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: IST });
const day = (ms: number) => new Date(ms).toLocaleDateString([], { weekday: 'short', day: 'numeric', timeZone: IST });
const k1 = (v: number) => v.toFixed(1);
const signed = (v: number) => `${v > 0 ? '+' : ''}${v}%`;

const cell: React.CSSProperties = { padding: '8px 12px', textAlign: 'right', fontFamily: 'Fira Code, monospace', fontSize: '0.8125rem', borderBottom: '1px solid var(--border)' };
function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div style={{ maxHeight: 340, overflow: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--card)' }}>
          <tr>{head.map((h, i) => <th key={h} style={{ ...cell, textAlign: i ? 'right' : 'left', fontFamily: 'Rubik, sans-serif', fontWeight: 600 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ ...cell, textAlign: j ? 'right' : 'left', color: 'var(--foreground)' }}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

const SolarCard: React.FC<SolarCardProps> = (p) => {
  const now = p.nowMs ?? Date.now();
  const today0 = istMidnight(now);
  const [win, setWin] = usePersistedState<SolarWindow>('360w.solar.window', 'day', ['day', 'daily']);
  const [dayMs, setDayMs] = useState(today0);
  const [view, setView] = usePersistedState<'chart' | 'table'>('360w.solar.view', 'chart', ['chart', 'table']);
  const [ghi, setGhi] = usePersistedState<boolean>('360w.solar.ghi', false);
  const zoom = useChartZoomState();
  const ts: any[] = p.accuracy?.timeseries ?? [];
  const isToday = dayMs === today0;
  const isFuture = dayMs > today0;

  // every window reads data already loaded: switching never refetches
  const slots = useMemo(() => trimNight(buildSlots(dayMs, dayMs + DAY_MS, ts, p.forecast, now)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [ts, p.forecast, dayMs, Math.floor(now / SLOT_MS)]);
  const dailyBand = p.accuracy?.daily_range ?? null;   // null until calibrate_site has fitted one: slot sums are used then
  const days = useMemo(() => [...dailyTotals(ts, now, 7, dailyBand), ...forecastDays(p.forecast, now, 3, dailyBand)],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [ts, p.forecast, dailyBand, Math.floor(now / SLOT_MS)]);
  const todayIdx = days.findIndex(d => d.partial);

  const daily = win === 'daily';
  const nowIdx = daily ? todayIdx : isToday ? slots.findIndex(s => s.ms <= now && now < s.ms + SLOT_MS) : -1;
  const nowRef = useRef(nowIdx); nowRef.current = nowIdx;
  const slotsRef = useRef(slots); slotsRef.current = slots;
  const daysRef = useRef(days); daysRef.current = days;
  const ghiOn = ghi && !daily && slots.some(s => s.ghi != null);

  const openDay = (ms: number) => { setDayMs(ms); setWin('day'); zoom.resetZoom(); };
  const openDayRef = useRef(openDay); openDayRef.current = openDay;

  // ── chart data ──
  const FC = p.isDark ? FC_DARK : FC_LIGHT;
  const chartData = useMemo(() => {
    const base = { tension: 0, pointRadius: 0, pointStyle: 'line', fill: false };
    // the range is the only shaded area: actual is a plain line, so the two never blend into a third colour
    const edge = { borderColor: `${FC}80`, borderWidth: 1, borderDash: [2, 3] };
    const fade = { borderColor: (c: any) => (c.p1DataIndex <= nowRef.current ? `${FC}66` : undefined) };
    if (daily) {
      const band = days.some(d => d.p10 != null);
      return {
        labels: days.map(d => (d.partial ? 'Today' : day(d.ms))),
        datasets: [
          ...(band ? [
            { ...base, ...edge, label: '_p10', data: days.map(d => d.p10) },
            { ...base, ...edge, label: 'Likely range', data: days.map(d => d.p90), fill: '-1', backgroundColor: `${FC}24`, pointStyle: 'rect' },
          ] : []),
          { ...base, label: 'Forecast (P50)', data: days.map(d => d.p50), borderColor: FC, borderWidth: 2.2, borderDash: [6, 4], pointRadius: 4, pointStyle: 'circle', pointBackgroundColor: FC, segment: fade },
          { ...base, label: 'Actual', order: -1, data: days.map(d => (d.partial || d.future ? null : d.actual)), borderColor: ACT, backgroundColor: ACT, borderWidth: 2.6, pointRadius: 5, pointStyle: 'circle' },
          { ...base, label: 'Today, so far', order: -1, data: days.map((d, i) => (i === todayIdx ? d.actual : null)), borderColor: ACT, borderWidth: 2, pointRadius: 5, pointBackgroundColor: '#fff', pointStyle: 'circle' },
        ],
      };
    }
    const band = slots.some(s => s.p10 != null && s.p90 != null);
    return {
      labels: slots.map(s => time(s.ms)),
      datasets: [
        ...(band ? [
          { ...base, ...edge, label: '_p10', data: slots.map(s => s.p10) },
          { ...base, ...edge, label: 'Likely range (P10–P90)', data: slots.map(s => s.p90), fill: '-1', backgroundColor: `${FC}24`, pointStyle: 'rect' },
        ] : []),
        { ...base, label: 'Forecast (P50)', data: slots.map(s => s.p50), borderColor: FC, borderWidth: 2.2, borderDash: [6, 4], segment: fade },
        ...(!isFuture ? [{ ...base, label: 'Actual', order: -1, data: slots.map(s => s.actual), borderColor: ACT, borderWidth: 2.6 }] : []),
        ...(ghiOn ? [{ ...base, label: 'Sunlight (GHI)', yAxisID: 'ghi', data: slots.map(s => s.ghi), borderColor: GHI, borderWidth: 1.3 }] : []),
      ],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, days, todayIdx, slots, isFuture, ghiOn, p.isDark]);

  const nowText = daily ? 'Today' : `Now ${time(now)}`;
  const overlay = useMemo<Plugin<'line'>>(() => ({
    id: 'solarCardNow',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales } = chart as any;
      const i = nowRef.current;
      if (!scales?.x || !a || i < 0) return;
      const px = scales.x.getPixelForValue(i);
      ctx.save();
      ctx.strokeStyle = ink(p.isDark); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = ink(p.isDark); ctx.font = '600 12px Rubik, sans-serif';
      const tw = ctx.measureText?.(nowText)?.width ?? 0;
      ctx.textAlign = px + 6 + tw > a.right ? 'right' : 'left';
      ctx.fillText(nowText, ctx.textAlign === 'right' ? px - 6 : px + 6, a.top + 12);
      ctx.restore();
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nowText, p.isDark]);

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    // daily: a click opens that day in 15-min detail
    onClick: (_e: any, els: any[]) => {
      if (!daily || !els?.length) return;
      const d = daysRef.current[els[0].index];
      if (d) openDayRef.current(d.ms);
    },
    onHover: (e: any, els: any[]) => { if (e?.native?.target) e.native.target.style.cursor = daily && els?.length ? 'pointer' : 'default'; },
    plugins: {
      legend: { display: false }, // HTML legend above the canvas
      tooltip: {
        backgroundColor: resolveCssVar('--popover'), titleColor: ink(p.isDark), bodyColor: inkMuted(p.isDark),
        borderColor: p.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Rubik, sans-serif', weight: 'bold' as const, size: 12 }, bodyFont: { family: 'Fira Code, monospace', size: 11 },
        filter: (it: TooltipItem<'line'>) => !String(it.dataset.label).startsWith('_') && it.parsed.y != null,
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            if (daily) { const d = daysRef.current[items[0]?.dataIndex ?? -1]; return d ? `${day(d.ms)}${d.partial ? ' (so far)' : d.future ? ' (forecast)' : ''}` : ''; }
            return String(items[0]?.label ?? '');
          },
          label: (it: TooltipItem<'line'>) => {
            const lab = String(it.dataset.label);
            const y = it.parsed.y ?? 0;
            const u = daily ? 'kWh' : 'kW';
            if (lab === 'Sunlight (GHI)') return ` GHI: ${Math.round(y)} W/m²`;
            if (lab.startsWith('Likely')) {
              const lo = (it.chart.data.datasets.find(d => d.label === '_p10')?.data[it.dataIndex] as number | null) ?? null;
              return ` Likely: ${lo == null ? '–' : lo.toFixed(daily ? 1 : 2)}–${y.toFixed(daily ? 1 : 2)} ${u}`;
            }
            return ` ${lab}: ${y.toFixed(daily ? 1 : 2)} ${u}`;
          },
          footer: (items: TooltipItem<'line'>[]) => {
            if (daily) return ['Click to see this day in 15-min detail'];
            const s = slotsRef.current[items[0]?.dataIndex ?? -1];
            return s?.physics != null ? [`Physics estimate: ${s.physics.toFixed(2)} kW`] : [];
          },
        },
      },
      zoom: createDragZoomPlugins(() => zoom.onZoomComplete.current()),
    } as any,
    scales: {
      // offset: the first and last points sit half a step in from the axes instead of on them
      x: { offset: true, ticks: { color: inkMuted(p.isDark), font: { family: 'Rubik, sans-serif', size: 12 }, maxRotation: 0, autoSkip: true, maxTicksLimit: daily ? 12 : 8 }, grid: { display: false } },
      y: {
        beginAtZero: true, grace: '8%', // headroom: the range and the peak never touch the top edge
        title: { display: true, text: daily ? 'kWh per day' : 'kW', color: inkMuted(p.isDark), font: { family: 'Rubik, sans-serif', size: 12, weight: 700 as any } },
        ticks: { color: inkMuted(p.isDark), font: { family: 'Fira Code, monospace', size: 11 } },
        grid: { display: true, color: p.isDark ? 'rgba(148,163,184,0.09)' : 'rgba(15,23,42,0.06)' }, border: { display: false },
      },
      ...(ghiOn ? { ghi: { type: 'linear', position: 'right', beginAtZero: true, title: { display: true, text: 'W/m²', color: GHI }, ticks: { color: GHI, font: { size: 11 } }, grid: { drawOnChartArea: false } } } : {}),
    } as any,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [p.isDark, daily, ghiOn]);

  // ── KPI tiles ──
  const rangeSub = (lo: number | null, hi: number | null, fallback: string) => (lo != null && hi != null ? `Likely ${k1(lo)}–${k1(hi)} kWh` : fallback);
  let tiles: React.ReactNode;
  if (!daily) {
    const k = todayKpis(slots);
    const pct = k.expected > 0 ? Math.round((k.soFar / k.expected) * 100) : null;
    tiles = (
      <KpiRow>
        {!isFuture && (
          <KpiTile isDark={p.isDark} tone="orange" label={isToday ? 'Generated so far' : 'Generated'} value={k1(k.soFar)} unit="kWh" bar={pct}
            sub={pct != null ? `${pct}% of ${isToday ? "today's " : 'the '}forecast` : 'No forecast for this day'} />
        )}
        <KpiTile isDark={p.isDark} tone="teal" label={isToday ? 'Expected today' : isFuture ? `Expected · ${day(dayMs)}` : 'Forecast'} value={`~${k1(k.expected)}`} unit="kWh"
          sub={rangeSub(k.lo, k.hi, 'Forecast P50')} />
        {!isFuture && (
          <KpiTile isDark={p.isDark} label={isToday ? 'Accuracy so far' : 'Accuracy'} value={k.diffPct != null ? signed(k.diffPct) : '–'}
            sub={k.diffPct == null ? 'Fills in once readings overlap the forecast' : `vs forecast${k.scored ? ` · ${k.inBand} of ${k.scored} slots in range` : ''}`} />
        )}
      </KpiRow>
    );
  } else {
    const full = days.filter(d => !d.partial && !d.future && d.p50 > 0);
    const a = full.reduce((t, d) => t + (d.actual ?? 0), 0);
    const f = full.reduce((t, d) => t + d.p50, 0);
    const inR = full.filter(d => d.p10 != null && d.p90 != null && d.actual! >= d.p10 && d.actual! <= d.p90).length;
    const diff = f > 0 ? Math.round(((a - f) / f) * 100) : null;
    const next = days.filter(d => d.future);
    tiles = (
      <KpiRow>
        <KpiTile isDark={p.isDark} tone="orange" label={`Generated · ${full.length} full days`} value={k1(a)} unit="kWh"
          sub={full.length ? `Avg ${k1(a / full.length)} kWh a day · forecast ${k1(f)}` : 'No full days scored yet'} />
        <KpiTile isDark={p.isDark} label="Accuracy" value={diff != null ? signed(diff) : '–'}
          sub={diff != null ? `vs forecast · ${inR} of ${full.length} days in range` : 'Nothing to compare yet'} />
        <KpiTile isDark={p.isDark} tone="teal" label={next.length === 1 ? 'Next day' : next.length ? `Next ${next.length} days` : 'Coming days'} value={next.length ? `~${k1(next.reduce((t, d) => t + d.p50, 0))}` : '–'} unit={next.length ? 'kWh' : undefined}
          sub={next.length ? next.map(d => `${day(d.ms)} ~${k1(d.p50)}`).join(' · ') : 'No forecast for the coming days yet'} />
      </KpiRow>
    );
  }

  const empty = daily ? days.every(d => !d.actual && !d.p50) : slots.length === 0 || slots.every(s => s.p50 == null && s.actual == null);
  const emptyText = daily
    ? 'No scored days yet. Days fill in once readings and the forecast overlap.'
    : isToday ? 'No forecast or readings for today yet.' : `No forecast or readings for ${day(dayMs)}.`;

  const genAt = useMemo(() => {
    const m = (p.forecast ?? []).reduce((x: string, r: any) => (r.generated_at && r.generated_at > x ? r.generated_at : x), '');
    return m ? new Date(m) : null;
  }, [p.forecast]);
  const sub = [
    genAt ? `Forecast made ${genAt.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: IST })}` : null,
    daily ? 'daily totals · last 7 days and the next days' : `${isToday ? 'today' : day(dayMs)} · 15-min slots`,
  ].filter(Boolean).join(' · ');

  let table: React.ReactNode = null;
  if (view === 'table') {
    const f2 = (v: number | null) => (v == null ? '—' : v.toFixed(2));
    const range = (lo: number | null, hi: number | null, d = 2) => (lo != null && hi != null ? `${lo.toFixed(d)}–${hi.toFixed(d)}` : '—');
    table = daily
      ? <Table head={['Day', 'Actual kWh', 'P50 kWh', 'Range kWh', 'Δ']} rows={days.map(d => [
        `${day(d.ms)}${d.partial ? ' (so far)' : d.future ? ' (forecast)' : ''}`, d.actual == null ? '—' : d.actual.toFixed(1), d.p50.toFixed(1),
        range(d.p10, d.p90, 1), !d.partial && !d.future && d.p50 > 0 ? signed(Math.round((((d.actual ?? 0) - d.p50) / d.p50) * 100)) : '—'])} />
      : <Table head={isFuture ? ['Time', 'P50 kW', 'Range kW', 'Physics kW', 'GHI W/m²'] : ['Time', 'Actual kW', 'P50 kW', 'Range kW', 'Δ']}
        rows={slots.map(s => (isFuture
          ? [time(s.ms), f2(s.p50), range(s.p10, s.p90), f2(s.physics), s.ghi == null ? '—' : String(Math.round(s.ghi))]
          : [time(s.ms), f2(s.actual), f2(s.p50), range(s.p10, s.p90), s.actual != null && s.p50 ? signed(Math.round(((s.actual - s.p50) / s.p50) * 100)) : '—']))} />;
  }

  const hint = daily
    ? 'Full days compare only the slots that were measured, so a data gap does not read as underperformance. Click a day to see it in 15-min detail.'
    : isFuture ? 'Forecast only. Hover a slot for the physics estimate.'
      : `${isToday ? 'The forecast before now is faded: it shows what was predicted. ' : ''}Hover a slot for the physics estimate. Drag across the chart to zoom.`;

  return (
    <div style={{
      background: p.isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.85)', borderRadius: 20,
      border: `1px solid ${p.isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,159,143,0.18)'}`, overflow: 'hidden', marginBottom: 20,
      boxShadow: p.isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.06)',
    }}>
      <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${p.isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: 'Rubik, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)' }}>Solar Generation</h3>
          <p style={{ margin: '3px 0 0', fontFamily: 'Rubik, sans-serif', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{sub}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 16px' }}>
          <div style={groupRow}>
            <span style={groupLabel}>Window</span>
            <Seg<SolarWindow> label="Window" value={win} isDark={p.isDark} onChange={w => { setWin(w); zoom.resetZoom(); }}
              options={[['day', isToday ? 'Today' : day(dayMs)], ['daily', 'Daily']]} />
          </div>
          {!daily && !isToday && (
            <div style={segWrap(p.isDark)}>
              <button type="button" onClick={() => openDay(today0)} style={segBtn(false, true, p.isDark)}>Back to today</button>
            </div>
          )}
          <Seg<'chart' | 'table'> label="View" value={view} isDark={p.isDark} onChange={setView} options={[['chart', 'Chart'], ['table', 'Table']]} />
          {!daily && view === 'chart' && (
            <div style={segWrap(p.isDark)}>
              <button type="button" aria-pressed={ghi} onClick={() => setGhi(!ghi)} style={segBtn(ghi, true, p.isDark)}>+ Sunlight (GHI)</button>
            </div>
          )}
          <ZoomResetButton visible={zoom.isZoomed} onClick={zoom.resetZoom} />
        </div>
      </div>

      <div style={{ padding: '14px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!empty && tiles}
        {empty ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontFamily: 'Rubik, sans-serif', fontSize: '0.875rem' }}>{emptyText}</div>
        ) : view === 'table' ? table : (
          <div>
            <ChartLegend items={legendFrom(chartData.datasets)} />
            <div style={{ height: 320, position: 'relative' }}>
            <CJLine key={`${win}-${dayMs}`} ref={zoom.chartRef} data={chartData as any} options={options} plugins={[overlay]} />
            </div>
          </div>
        )}
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted-foreground)', fontFamily: 'Rubik, sans-serif' }}>{hint}</p>
      </div>
    </div>
  );
};

export default SolarCard;
