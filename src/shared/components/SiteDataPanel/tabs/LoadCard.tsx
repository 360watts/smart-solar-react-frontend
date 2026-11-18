/**
 * Combined Load card: every supply line's actual and forecast in one chart.
 * Line (Inverter / Grid / EV / All) × Window (Today / Last 7 days / Next 7 days) × Forecast lead.
 * EV is measured only. Spec docs/superpowers/specs/2026-11-17-combined-load-card-design.md,
 * scenarios docs/test-scenarios/combined-load-card.md.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Line as CJLine } from 'react-chartjs-2';
import type { ChartOptions, Plugin, TooltipItem } from 'chart.js';
import { useChartZoomState, ZoomResetButton, createDragZoomPlugins } from '../chartUtils';
import { resolveCssVar } from '../../../lib/resolveCssVar';
import { IST_TIMEZONE } from '../../../../app/constants';
import {
  buildSlots, cumulative, gapSlots, gridEnergy, kwh, num, stackTops, totalForecast, windowRange, PHASE_COLORS, SLOT_MS,
  type ActualLine, type LoadLead, type LoadLine, type LoadWindow,
} from './loadCardModel';

const IST = IST_TIMEZONE;
const LINE_META: Record<ActualLine, { label: string; color: string }> = {
  inv: { label: 'Inverter', color: '#f59e0b' },
  grid: { label: 'Grid', color: '#60a5fa' },
  ev: { label: 'EV', color: '#0F9F8F' },
};
// a forecast is drawn in its own line's hue (dashed, lighter on dark, deeper on light); red is kept for gaps
const FC_META = { inv: { dark: '#fcd34d', light: '#b45309' }, grid: { dark: '#93c5fd', light: '#1d4ed8' } };
const fcColor = (k: 'inv' | 'grid', isDark: boolean) => FC_META[k][isDark ? 'dark' : 'light'];
const SUM_FC = '#94a3b8';
const LEADS: readonly (readonly [LoadLead, string, string])[] = [
  ['off', 'Off', 'Actual load only'],
  ['latest', 'Latest', 'Forecast from the run just before each slot'],
  ['1h', '1 h', 'Forecast made at least 1 hour ahead'],
  ['6h', '6 h', 'Forecast made at least 6 hours ahead'],
  ['day', 'Day-ahead', 'The first run of each day'],
];
const WINDOWS: readonly (readonly [LoadWindow, string])[] = [['today', 'Today'], ['last7', 'Last 7 days'], ['next7', 'Next 7 days']];
const WINDOW_TITLE: Record<LoadWindow, string> = { today: 'Today', last7: 'Last 7 Days', next7: 'Next 7 Days' };

export interface LoadCardProps {
  isDark: boolean;
  actual: any[];        // PhaseLoadTab's 15-min rows
  invAccuracy: any;     // load-forecast-accuracy (inverter) response
  invForward: any[];    // load-forecast rows, next 7 days
  gridAccuracy: any;    // load-forecast-accuracy?line=grid response
  hasEv: boolean;
  hours: number;
  onHoursChange: (h: number) => void;
  onLeadChange: (lead: Exclude<LoadLead, 'off'>) => void;
  solarStartMs: number;
  nowMs?: number;       // tests
}

const segWrap = (isDark: boolean): React.CSSProperties => ({
  display: 'inline-flex', borderRadius: 10, overflow: 'hidden',
  border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.1)'}`,
  background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(241,245,249,0.8)',
});
// one neutral selected state for every group: colour in the controls carried no meaning
const segBtn = (active: boolean, first: boolean, isDark: boolean): React.CSSProperties => ({
  border: 'none', borderLeft: first ? 'none' : `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)'}`,
  background: active ? 'var(--foreground)' : 'transparent',
  color: active ? 'var(--background)' : 'var(--muted-foreground)',
  padding: '0 12px', minHeight: 32, fontSize: '0.8125rem', fontWeight: active ? 600 : 500, cursor: 'pointer',
  fontFamily: 'Rubik, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 5,
});
const groupLabel: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 500, color: 'var(--muted-foreground)', fontFamily: 'Rubik, sans-serif',
};
const groupRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };
const chip = (color = 'var(--muted-foreground)', warn = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
  border: `1px solid ${warn ? 'transparent' : 'var(--border)'}`, background: warn ? 'rgba(239,68,68,0.12)' : 'transparent',
  color: warn ? '#dc2626' : color, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Rubik, sans-serif',
  fontVariantNumeric: 'tabular-nums',
});

function Seg<T extends string>({ label, value, options, onChange, isDark }: {
  label: string; value: T; options: readonly (readonly [T, string, string?])[];
  onChange: (v: T) => void; isDark: boolean;
}) {
  return (
    <div role="group" aria-label={label} style={segWrap(isDark)}>
      {options.map(([k, text, hint], i) => (
        <button key={k} type="button" title={hint} aria-pressed={value === k} onClick={() => onChange(k)}
          style={segBtn(value === k, i === 0, isDark)}>
          {text}
        </button>
      ))}
    </div>
  );
}

const fmt = (v: number | null | undefined, unit: string) => (v == null ? '–' : `${v.toFixed(2)} ${unit}`);

const LoadCard: React.FC<LoadCardProps> = (p) => {
  const now = p.nowMs ?? Date.now();
  const [win, setWin] = useState<LoadWindow>(p.hours >= 168 ? 'last7' : 'today');
  const [lead, setLead] = useState<LoadLead>('latest');
  const [unit, setUnit] = useState<'kw' | 'kwh'>('kw');
  const [phases, setPhases] = useState(false);
  const [picked, setPicked] = useState<LoadLine>('inv');
  const zoom = useChartZoomState();

  // the old header offered 6 h / 12 h / 48 h; the card only knows the solar day and 7 days
  useEffect(() => {
    if (p.hours !== 24 && p.hours !== 168) p.onHoursChange(24);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [start, end] = windowRange(win, p.solarStartMs);
  const slots = useMemo(() => buildSlots([start, end], {
    actual: p.actual, invFc: p.invAccuracy?.timeseries ?? [], invFwd: p.invForward ?? [], gridFc: p.gridAccuracy?.timeseries ?? [],
  }), [start, end, p.actual, p.invAccuracy, p.invForward, p.gridAccuracy]);

  const lines = useMemo<ActualLine[]>(() => {
    const out: ActualLine[] = [];
    if (p.actual.some(r => num(r.inverter) != null) || (p.invForward ?? []).length > 0) out.push('inv');
    if (p.actual.some(r => num(r.grid) != null) || (p.gridAccuracy?.timeseries ?? []).length > 0) out.push('grid');
    if (p.hasEv) out.push('ev');
    return out;
  }, [p.actual, p.invForward, p.gridAccuracy, p.hasEv]);
  const line: LoadLine = lines.length <= 1 ? (lines[0] ?? 'inv')
    : picked === 'all' || lines.includes(picked as ActualLine) ? picked : lines[0];

  const fcOn = lead !== 'off' || win === 'next7';
  const kwhMode = unit === 'kwh';
  const u = kwhMode ? 'kWh' : 'kW';
  const nowIdx = slots.findIndex(s => s.ms <= now && now < s.ms + SLOT_MS);
  const isPast = (i: number) => nowIdx >= 0 && i <= nowIdx;
  const nowRef = useRef(nowIdx); nowRef.current = nowIdx;
  // forecast before now is context only: fade it so actual-so-far and forecast-ahead stand out
  const fadePast = (color: string) => ({ borderColor: (c: any) => (c.p1DataIndex <= nowRef.current ? `${color}73` : undefined) });
  const shownLines: ActualLine[] = line === 'all' ? lines : [line];
  const gaps = useMemo(() => gapSlots(slots, shownLines, now),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [slots, shownLines.join(), now]);

  const pickWin = (w: LoadWindow) => {
    setWin(w);
    zoom.resetZoom();
    if (w === 'today' && p.hours !== 24) p.onHoursChange(24);
    if (w === 'last7' && p.hours !== 168) p.onHoursChange(168);
  };
  const pickLead = (l: LoadLead) => {
    setLead(l);
    if (l !== 'off') p.onLeadChange(l);
  };

  // ── datasets ──
  const datasets = useMemo(() => {
    const ds: any[] = [];
    const series = (vals: (number | null)[]) => (kwhMode ? cumulative(vals) : vals);
    // straight segments: 15-min averages must not overshoot into peaks that never happened
    const base = { tension: 0, pointRadius: 0, borderWidth: 0, pointStyle: 'line' };
    if (line === 'all') {
      // measured load as a solid stack; the forecast is one dashed total line (per-line forecasts live in the
      // Inverter and Grid views). Nov 18 review: stacked hatched forecasts outweighed the measured part.
      const tops = stackTops(slots, now);
      const pick = (f: (t: NonNullable<(typeof tops)[number]>) => number) => series(tops.map(t => (t ? f(t) : null)));
      const has = (k: ActualLine) => lines.includes(k) && slots.some(s => s[k] != null);
      const layer = (label: string, data: (number | null)[], color: string, val: (number | null)[]) => ({
        ...base, label, data, borderColor: color, borderWidth: 1.5, fill: ds.length ? '-1' : 'origin',
        backgroundColor: `${color}aa`, __val: val, pointStyle: 'rect',
      });
      if (has('inv')) ds.push(layer('Inverter', pick(t => t.inv), LINE_META.inv.color, pick(t => t.inv)));
      if (has('grid')) ds.push(layer('Grid', pick(t => t.invGrid), LINE_META.grid.color, pick(t => t.invGrid - t.inv)));
      if (has('ev')) ds.push(layer('EV', pick(t => t.all), LINE_META.ev.color, pick(t => t.all - t.invGrid)));
      if (fcOn) {
        // order -1: Chart.js paints the last dataset first, which hid this line under the filled stack
        ds.push({
          ...base, label: lines.includes('ev') ? 'Forecast (inverter + grid)' : 'Forecast (total)', order: -1,
          data: totalForecast(slots, kwhMode), borderColor: SUM_FC, borderWidth: 2.2, borderDash: [6, 4], fill: false,
          segment: fadePast(SUM_FC),
        });
      }
      return ds;
    }
    if (line === 'ev') {
      ds.push({ ...base, label: 'EV (measured only)', data: series(slots.map(s => s.ev)), borderColor: LINE_META.ev.color, borderWidth: 2.4, fill: 'origin', backgroundColor: `${LINE_META.ev.color}33`, pointStyle: 'rect' });
      return ds;
    }
    const k = line;
    const [p10, p50, p90] = k === 'inv' ? (['invP10', 'invP50', 'invP90'] as const) : (['gridP10', 'gridP50', 'gridP90'] as const);
    if (fcOn) {
      const fc = fcColor(k, p.isDark);
      if (!kwhMode) {
        ds.push({ ...base, label: '_p10', data: slots.map(s => s[p10]), borderColor: 'transparent', fill: false });
        // grid bands are calibrated but reached ~71% of 80% on the Nov 17 study holdout, so they are not called P10–P90
        ds.push({ ...base, label: k === 'grid' ? 'Likely range' : 'P10–P90', __band: true, pointStyle: 'rect', data: slots.map(s => s[p90]), borderColor: 'transparent', fill: '-1', backgroundColor: `${LINE_META[k].color}${p.isDark ? '33' : '26'}` });
      }
      ds.push({ ...base, label: k === 'grid' ? 'Forecast (14-day pattern)' : 'Forecast (P50)', data: series(slots.map(s => (kwhMode && k === 'grid' ? gridEnergy(s) : s[p50]))), borderColor: fc, borderWidth: 2, borderDash: [6, 4], fill: false, segment: fadePast(fc) });
    }
    if (win !== 'next7') {
      if (k === 'inv' && phases && !kwhMode) {
        (['l1', 'l2', 'l3'] as const).forEach((ph, i) => ds.push({ ...base, label: `L${i + 1}`, data: slots.map(s => s[ph]), borderColor: PHASE_COLORS[`L${i + 1}` as 'L1'], borderWidth: 1.3, fill: false }));
      }
      ds.push({ ...base, label: 'Actual', data: series(slots.map(s => s[k])), borderColor: LINE_META[k].color, borderWidth: 2.4, fill: false });
    }
    return ds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, line, lines, fcOn, kwhMode, phases, win, nowIdx, p.isDark]);

  // ── chart options (callbacks read refs so polling does not rebuild them mid-zoom) ──
  const slotsRef = useRef(slots); slotsRef.current = slots;
  const label = (ms: number, multiDay: boolean) => {
    const d = new Date(ms);
    const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: IST });
    return multiDay ? [d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST }), t] : t;
  };
  const multiDay = win !== 'today';
  const pct = Math.min(100, Math.max(0, ((now - p.solarStartMs) / (24 * 3_600_000)) * 100));
  const nowText = `Now ${label(now, false)}${win === 'today' ? ` · ${pct.toFixed(0)}% of solar day` : ''}`;
  const overlayRef = useRef({ gaps: [] as number[], nowIdx: -1, nowText: '' });
  overlayRef.current = { gaps: slots.map((s, i) => (gaps.has(s.ms) ? i : -1)).filter(i => i >= 0), nowIdx, nowText };
  const lineRef = useRef(line); lineRef.current = line;

  const overlay = useMemo<Plugin<'line'>>(() => ({
    id: 'loadCardOverlay',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales } = chart as any;
      const x = scales?.x;
      if (!x || !a) return;
      const o = overlayRef.current;
      const w = (a.right - a.left) / Math.max(1, slotsRef.current.length - 1);
      ctx.save();
      ctx.fillStyle = 'rgba(239,68,68,0.13)';
      for (const i of o.gaps) ctx.fillRect(x.getPixelForValue(i) - w / 2, a.top, w, a.bottom - a.top);
      if (o.nowIdx >= 0) {
        const px = x.getPixelForValue(o.nowIdx);
        ctx.strokeStyle = resolveCssVar('--foreground'); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
        // the now line carries its own label (replaced the separate solar-day bar, which did not line up with the plot)
        ctx.setLineDash([]); ctx.fillStyle = resolveCssVar('--foreground'); ctx.font = '600 11px Rubik, sans-serif';
        const tw = ctx.measureText?.(o.nowText)?.width ?? 0;
        ctx.textAlign = px + 6 + tw > a.right ? 'right' : 'left';
        ctx.fillText(o.nowText, ctx.textAlign === 'right' ? px - 6 : px + 6, a.top + 12);
      }
      ctx.restore();
    },
  }), []);

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'top', align: 'start',
        // swatches match the marks: line, dashed line (dataset borderDash), filled area ('rect')
        labels: {
          color: resolveCssVar('--muted-foreground'), font: { family: 'Rubik, sans-serif', size: 12, weight: 500 as any },
          boxWidth: 22, usePointStyle: true, padding: 16,
          filter: (item: any) => !String(item.text).startsWith('_') && !String(item.text).endsWith(' forecast'),
        },
      },
      tooltip: {
        backgroundColor: resolveCssVar('--popover'), titleColor: resolveCssVar('--foreground'), bodyColor: resolveCssVar('--muted-foreground'),
        borderColor: p.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Rubik, sans-serif', weight: 'bold' as const, size: 12 }, bodyFont: { family: 'Fira Code, monospace', size: 11 },
        filter: (item: TooltipItem<'line'>) => !String(item.dataset.label).startsWith('_') && item.parsed.y != null,
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            const s = slotsRef.current[items[0]?.dataIndex ?? -1];
            if (!s) return '';
            const l = label(s.ms, multiDay);
            return Array.isArray(l) ? l.join(' · ') : l;
          },
          label: (item: TooltipItem<'line'>) => {
            const ds: any = item.dataset;
            const s = slotsRef.current[item.dataIndex];
            if (ds.__band && s) {
              const [lo, hi] = lineRef.current === 'grid' ? [s.gridP10, s.gridP90] : [s.invP10, s.invP90];
              return ` ${ds.label}: ${fmt(lo, '').trim()}–${fmt(hi, u)}`;
            }
            const v = ds.__val ? ds.__val[item.dataIndex] : item.parsed.y;
            return ` ${ds.label}: ${fmt(v, u)}`;
          },
          footer: (items: TooltipItem<'line'>[]) => {
            const s = slotsRef.current[items[0]?.dataIndex ?? -1];
            if (!s) return [];
            const out: string[] = [];
            const l = lineRef.current;
            if ((l === 'inv' || l === 'all') && s.missReason && s.ms <= Date.now()) out.push(`Why off: ${s.missReason}`);
            if ((l === 'inv' || l === 'all') && s.replay) out.push('Forecast replayed (run not stored at the time)');
            if (l === 'grid' && s.gridMean != null && s.ms > Date.now()) out.push(`Expected on average: ${s.gridMean.toFixed(2)} kW (heater runs make the typical value lower)`);
            if (l === 'all') out.push('Forecast excludes EV (measured only)');
            if (overlayRef.current.gaps.includes(items[0].dataIndex)) out.push('A line sent no reading in this slot');
            return out;
          },
        },
      },
      zoom: createDragZoomPlugins(() => zoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: {
        ticks: { color: resolveCssVar('--muted-foreground'), font: { family: 'Rubik, sans-serif', size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: kwhMode ? 'Energy (kWh)' : 'Load (kW)', color: resolveCssVar('--muted-foreground'), font: { family: 'Rubik, sans-serif', size: 11, weight: 700 as any } },
        ticks: { color: resolveCssVar('--muted-foreground'), font: { family: 'Fira Code, monospace', size: 11 }, callback: (v: any) => Number(v).toFixed(1) },
        grid: { display: true, color: p.isDark ? 'rgba(148,163,184,0.09)' : 'rgba(15,23,42,0.06)' },
        border: { display: false },
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [p.isDark, kwhMode, multiDay]);

  // ── chips ──
  const past = slots.filter((_, i) => isPast(i));
  const future = slots.filter((_, i) => !isPast(i));
  const soFar = (k: ActualLine) => kwh(past.map(s => s[k]));
  const ahead = (k: 'inv' | 'grid') => kwh(future.map(s => (k === 'inv' ? s.invP50 : gridEnergy(s))));
  const byWhen = win === 'today' ? `by ${label(end, false)}` : 'by the end';
  const chips: React.ReactNode[] = [];
  for (const k of shownLines) {
    const dot = <span style={{ width: 7, height: 7, borderRadius: '50%', background: LINE_META[k].color }} />;
    if (win === 'next7') {
      chips.push(<span key={k} style={chip()}>{dot}{LINE_META[k].label} {k === 'ev' ? '· not forecast' : <><b style={{ color: 'var(--foreground)' }}>~{ahead(k).toFixed(1)} kWh</b> expected</>}</span>);
    } else {
      chips.push(
        <span key={k} style={chip()}>{dot}{LINE_META[k].label} <b style={{ color: 'var(--foreground)' }}>{soFar(k).toFixed(1)} kWh</b> so far
          {k === 'ev' ? ' · measured only' : fcOn && future.length > 0 ? ` · ~${(soFar(k) + ahead(k)).toFixed(1)} kWh ${byWhen}` : null}
        </span>,
      );
    }
  }
  if (line === 'all' && win !== 'next7') {
    const total = shownLines.reduce((t, k) => t + soFar(k), 0);
    const projected = total + (lines.includes('inv') ? ahead('inv') : 0) + (lines.includes('grid') ? ahead('grid') : 0);
    chips.push(
      <span key="total" style={chip('var(--foreground)')}>
        <b>Total {total.toFixed(1)} kWh</b> so far{fcOn && future.length > 0 ? ` · ~${projected.toFixed(1)} kWh ${byWhen}` : ''}{gaps.size ? ' · incomplete' : ''}
      </span>,
    );
  }
  if (gaps.size) chips.push(<span key="gap" style={chip(undefined, true)}>⚠ {gaps.size * 15} min with a line missing{line === 'all' ? ' · total incomplete' : ''}</span>);
  // accuracy is a quiet caption, not a chip: it describes the day-ahead run whatever lead is selected
  const overall = p.invAccuracy?.overall;
  const accuracy = (line === 'inv' || line === 'all') && fcOn && win !== 'next7' && overall?.mae_kw != null
    ? `Day-ahead accuracy, last 7 days: typical error ${Number(overall.mae_kw).toFixed(2)} kW${overall.coverage_pct != null ? ` · ${Math.round(overall.coverage_pct)}% inside the range` : ''}`
    : null;
  if (shownLines.includes('grid') && fcOn && line === 'grid') chips.push(<span key="median" style={chip()}>Forecast = last 14 days' pattern · kWh from its expected value</span>);
  if (shownLines.includes('grid') && p.gridAccuracy?.note) chips.push(<span key="note" style={chip('#d97706')}>{p.gridAccuracy.note}</span>);

  const title = `${line === 'all' ? 'Whole-Home' : LINE_META[line].label} Load: ${WINDOW_TITLE[win]}`;
  const sub = {
    inv: 'Inverter (backup) side',
    grid: 'Grid-direct board (energy meter)',
    ev: 'EV line, measured only',
    all: 'Stacked lines · forecast = inverter + grid, EV measured only',
  }[line];
  const leadSub = win === 'next7' ? 'forecast only' : lead === 'off' ? 'actual only' : LEADS.find(l => l[0] === lead)?.[2].toLowerCase();
  const nothing = win === 'next7' && line === 'ev';

  return (
    <div style={{
      background: p.isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: 20,
      border: `1px solid ${p.isDark ? 'rgba(148,163,184,0.15)' : 'rgba(59,130,246,0.13)'}`, overflow: 'hidden', marginBottom: 20,
      boxShadow: p.isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.06)',
    }}>
      <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${p.isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: 'Rubik, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)' }}>{title}</h3>
          <p style={{ margin: '3px 0 0', fontFamily: 'Rubik, sans-serif', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
            {sub} · {leadSub}
          </p>
        </div>
        {/* one toolbar row, read left to right by importance; whole groups wrap on narrow screens */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 20px' }}>
            {lines.length > 1 && (
              <div style={groupRow}>
                <span style={groupLabel}>Line</span>
                <Seg<LoadLine> label="Line" value={line} isDark={p.isDark} onChange={v => { setPicked(v); zoom.resetZoom(); }}
                  options={[...lines.map(k => [k, LINE_META[k].label] as const), ['all', 'All'] as const]} />
              </div>
            )}
            <div style={groupRow}>
              <span style={groupLabel}>Window</span>
              <Seg<LoadWindow> label="Window" value={win} isDark={p.isDark} onChange={pickWin} options={WINDOWS} />
            </div>
            <div style={groupRow}>
              <span style={groupLabel}>Forecast</span>
              <Seg<LoadLead> label="Forecast" value={lead} isDark={p.isDark} onChange={pickLead} options={LEADS} />
            </div>
          </div>
          <div style={groupRow}>
            <Seg<'kw' | 'kwh'> label="Unit" value={unit} isDark={p.isDark} onChange={setUnit} options={[['kw', 'kW'], ['kwh', 'kWh']]} />
            {line === 'inv' && unit === 'kw' && win !== 'next7' && (
              <Seg<'total' | 'phases'> label="Phases" value={phases ? 'phases' : 'total'} isDark={p.isDark}
                onChange={v => setPhases(v === 'phases')} options={[['total', 'Total'], ['phases', 'By phase']]} />
            )}
            <ZoomResetButton visible={zoom.isZoomed} onClick={zoom.resetZoom} />
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {chips}
          {accuracy && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--muted-foreground)', fontFamily: 'Rubik, sans-serif' }}>{accuracy}</span>}
        </div>
        {lines.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontFamily: 'Rubik, sans-serif', fontSize: '0.875rem' }}>
            No load data for this site yet. Inverter load, the energy meter and the EV plug appear here once they report.
          </div>
        ) : nothing ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontFamily: 'Rubik, sans-serif', fontSize: '0.875rem' }}>
            EV is measured only, so there is nothing to forecast here.
          </div>
        ) : (
          <div style={{ height: 340, position: 'relative' }}>
            <CJLine
              key={`${line}-${win}-${unit}`}
              ref={zoom.chartRef}
              data={{ labels: slots.map(s => label(s.ms, multiDay)), datasets }}
              options={options}
              plugins={[overlay]}
            />
          </div>
        )}
        <p style={{ margin: 0, textAlign: 'right', fontSize: '0.75rem', color: 'var(--muted-foreground)', fontFamily: 'Rubik, sans-serif' }}>
          15-min slots · IST · drag across the chart to zoom
        </p>
      </div>
    </div>
  );
};

export default LoadCard;
