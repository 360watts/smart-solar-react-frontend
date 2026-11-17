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
  buildSlots, cumulative, gapSlots, gridEnergy, kwh, num, stackTops, windowRange, PHASE_COLORS, SLOT_MS,
  type ActualLine, type LoadLead, type LoadLine, type LoadWindow,
} from './loadCardModel';

const IST = IST_TIMEZONE;
const FC = '#ef4444';
const LINE_META: Record<ActualLine, { label: string; color: string }> = {
  inv: { label: 'Inverter', color: '#f59e0b' },
  grid: { label: 'Grid', color: '#60a5fa' },
  ev: { label: 'EV', color: '#0F9F8F' },
};
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
const segBtn = (active: boolean, color: string, first: boolean, isDark: boolean): React.CSSProperties => ({
  border: 'none', borderLeft: first ? 'none' : `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)'}`,
  background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
  color: active ? color : 'var(--muted-foreground)',
  padding: '5px 10px', fontSize: '0.75rem', fontWeight: active ? 700 : 600, cursor: 'pointer',
  fontFamily: 'Rubik, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 5,
});
const groupLabel: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', fontFamily: 'Rubik, sans-serif',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
const chip = (color = 'var(--muted-foreground)', warn = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
  border: `1px solid ${warn ? 'transparent' : 'var(--border)'}`, background: warn ? 'rgba(239,68,68,0.12)' : 'transparent',
  color: warn ? '#dc2626' : color, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Rubik, sans-serif',
  fontVariantNumeric: 'tabular-nums',
});

function Seg<T extends string>({ label, value, options, onChange, color, isDark }: {
  label: string; value: T; options: readonly (readonly [T, string, string?])[];
  onChange: (v: T) => void; color: (v: T) => string; isDark: boolean;
}) {
  return (
    <div role="group" aria-label={label} style={segWrap(isDark)}>
      {options.map(([k, text, hint], i) => (
        <button key={k} type="button" title={hint} aria-pressed={value === k} onClick={() => onChange(k)}
          style={segBtn(value === k, color(k), i === 0, isDark)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** Diagonal hatch for forecast areas; plain tint where the canvas has no 2D context (tests). */
function hatch(color: string) {
  return (ctx: any) => {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const g = c.getContext?.('2d');
    if (!g || !ctx?.chart?.ctx) return `${color}33`;
    g.fillStyle = `${color}26`; g.fillRect(0, 0, 8, 8);
    g.strokeStyle = color; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(0, 8); g.lineTo(8, 0); g.stroke();
    return ctx.chart.ctx.createPattern(c, 'repeat') ?? `${color}33`;
  };
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
    const base = { tension: 0.35, pointRadius: 0, borderWidth: 0 };
    if (line === 'all') {
      const tops = stackTops(slots, now, fcOn, kwhMode);
      const invV = tops.map(t => t.inv), gridV = tops.map(t => t.invGrid - t.inv), evV = tops.map(t => t.all - t.invGrid);
      const top = (f: (t: (typeof tops)[number]) => number) => series(tops.map(f));
      const invTop = top(t => t.inv), gridTop = top(t => t.invGrid), allTop = top(t => t.all);
      const own = (vals: number[]) => (kwhMode ? cumulative(vals) : vals);
      const ownInv = own(invV), ownGrid = own(gridV), ownEv = own(evV);
      const pastOnly = (a: (number | null)[]) => a.map((v, i) => (isPast(i) ? v : null));
      const futOnly = (a: (number | null)[]) => a.map((v, i) => (nowIdx < 0 || i >= nowIdx ? v : null));
      const layer = (label: string, data: (number | null)[], color: string, fill: any, val: (number | null)[], future = false) => ({
        ...base, label, data, borderColor: color, borderWidth: future ? 1 : 1.5, fill,
        backgroundColor: future ? hatch(color) : `${color}aa`, __val: val,
      });
      if (lines.includes('inv')) ds.push(layer('Inverter', pastOnly(invTop), LINE_META.inv.color, 'origin', ownInv));
      if (lines.includes('grid')) ds.push(layer('Grid', pastOnly(gridTop), LINE_META.grid.color, ds.length ? '-1' : 'origin', ownGrid));
      if (lines.includes('ev')) ds.push(layer('EV', pastOnly(allTop), LINE_META.ev.color, ds.length ? '-1' : 'origin', ownEv));
      if (fcOn) {
        const first = ds.length;
        if (lines.includes('inv')) ds.push(layer('Inverter forecast', futOnly(invTop), LINE_META.inv.color, 'origin', ownInv, true));
        if (lines.includes('grid')) ds.push(layer('Grid forecast', futOnly(gridTop), LINE_META.grid.color, ds.length > first ? '-1' : 'origin', ownGrid, true));
        const summed = slots.map(s => (s.invP50 == null && s.gridP50 == null ? null : (s.invP50 ?? 0) + ((kwhMode ? gridEnergy(s) : s.gridP50) ?? 0)));
        ds.push({ ...base, label: 'Forecast, inverter + grid', data: series(summed), borderColor: FC, borderWidth: 2, borderDash: [5, 4], fill: false });
      }
      return ds;
    }
    if (line === 'ev') {
      ds.push({ ...base, label: 'EV (measured only)', data: series(slots.map(s => s.ev)), borderColor: LINE_META.ev.color, borderWidth: 2.4, fill: 'origin', backgroundColor: `${LINE_META.ev.color}33` });
      return ds;
    }
    const k = line;
    const [p10, p50, p90] = k === 'inv' ? (['invP10', 'invP50', 'invP90'] as const) : (['gridP10', 'gridP50', 'gridP90'] as const);
    if (fcOn) {
      if (!kwhMode) {
        ds.push({ ...base, label: '_p10', data: slots.map(s => s[p10]), borderColor: 'transparent', fill: false });
        // grid bands are calibrated but reached ~71% of 80% on the Nov 17 study holdout, so they are not called P10–P90
        ds.push({ ...base, label: k === 'grid' ? 'Likely range' : 'P10–P90', __band: true, data: slots.map(s => s[p90]), borderColor: 'transparent', fill: '-1', backgroundColor: p.isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)' });
      }
      ds.push({ ...base, label: k === 'grid' ? 'Forecast (14-day pattern)' : 'Forecast (P50)', data: series(slots.map(s => (kwhMode && k === 'grid' ? gridEnergy(s) : s[p50]))), borderColor: FC, borderWidth: 2, borderDash: [5, 4], fill: false });
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
  const overlayRef = useRef({ gaps: [] as number[], nowIdx: -1 });
  overlayRef.current = { gaps: slots.map((s, i) => (gaps.has(s.ms) ? i : -1)).filter(i => i >= 0), nowIdx };
  const lineRef = useRef(line); lineRef.current = line;

  const label = (ms: number, multiDay: boolean) => {
    const d = new Date(ms);
    const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
    return multiDay ? [d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST }), t] : t;
  };
  const multiDay = win !== 'today';

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
      }
      ctx.restore();
    },
  }), []);

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'top',
        labels: {
          color: resolveCssVar('--muted-foreground'), font: { family: 'Rubik, sans-serif', size: 11, weight: 700 as any },
          boxWidth: 10, usePointStyle: true, pointStyle: 'circle', padding: 14,
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
        grid: { display: false },
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [p.isDark, kwhMode, multiDay]);

  // ── chips ──
  const past = slots.filter((_, i) => isPast(i));
  const future = slots.filter((_, i) => !isPast(i));
  const soFar = (k: ActualLine) => kwh(past.map(s => s[k]));
  const ahead = (k: 'inv' | 'grid') => kwh(future.map(s => (k === 'inv' ? s.invP50 : gridEnergy(s))));
  const chips: React.ReactNode[] = [];
  for (const k of shownLines) {
    const dot = <span style={{ width: 7, height: 7, borderRadius: '50%', background: LINE_META[k].color }} />;
    if (win === 'next7') {
      chips.push(<span key={k} style={chip()}>{dot}{LINE_META[k].label} {k === 'ev' ? '· not forecast' : <b style={{ color: 'var(--foreground)' }}>{ahead(k).toFixed(1)} kWh forecast</b>}</span>);
    } else {
      chips.push(
        <span key={k} style={chip()}>{dot}{LINE_META[k].label} <b style={{ color: 'var(--foreground)' }}>{soFar(k).toFixed(1)} kWh</b>
          {k === 'ev' ? ' · measured only' : fcOn && future.length > 0 ? <span style={{ color: FC }}>+{ahead(k).toFixed(1)} forecast</span> : null}
        </span>,
      );
    }
  }
  if (line === 'all' && win !== 'next7') {
    const total = shownLines.reduce((t, k) => t + soFar(k), 0);
    const projected = total + (lines.includes('inv') ? ahead('inv') : 0) + (lines.includes('grid') ? ahead('grid') : 0);
    chips.push(
      <span key="total" style={chip('var(--foreground)')}>
        <b>Total {total.toFixed(1)} kWh</b>{fcOn && future.length > 0 ? ` · ~${projected.toFixed(1)} by the end` : ''}{gaps.size ? ' · incomplete' : ''}
      </span>,
    );
  }
  if (gaps.size) chips.push(<span key="gap" style={chip(undefined, true)}>⚠ {gaps.size * 15} min with a line missing{line === 'all' ? ' · total incomplete' : ''}</span>);
  const overall = p.invAccuracy?.overall;
  if ((line === 'inv' || line === 'all') && fcOn && win !== 'next7' && overall?.mae_kw != null) {
    chips.push(<span key="score" style={chip('var(--brand-green)')}>Day-ahead, 7 days: MAE {Number(overall.mae_kw).toFixed(2)} kW{overall.coverage_pct != null ? ` · ${Math.round(overall.coverage_pct)}% in band` : ''}</span>);
  }
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
  const pct = Math.min(100, Math.max(0, ((now - p.solarStartMs) / (24 * 3_600_000)) * 100));
  const nothing = win === 'next7' && line === 'ev';

  return (
    <div style={{
      background: p.isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: 20,
      border: `1px solid ${p.isDark ? 'rgba(148,163,184,0.15)' : 'rgba(59,130,246,0.13)'}`, overflow: 'hidden', marginBottom: 20,
      boxShadow: p.isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.06)',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${p.isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: 'Rubik, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)' }}>{title}</h3>
          <p style={{ margin: '3px 0 0', fontFamily: 'Rubik, sans-serif', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
            {sub} · {leadSub} · 15-min · IST · drag to zoom
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
            {lines.length > 1 && (<>
              <span style={groupLabel}>Line</span>
              <Seg<LoadLine> label="Line" value={line} isDark={p.isDark} onChange={v => { setPicked(v); zoom.resetZoom(); }}
                options={[...lines.map(k => [k, LINE_META[k].label] as const), ['all', 'All'] as const]}
                color={v => (v === 'all' ? 'var(--foreground)' : LINE_META[v as ActualLine].color)} />
            </>)}
            <Seg<'kw' | 'kwh'> label="Unit" value={unit} isDark={p.isDark} onChange={setUnit}
              options={[['kw', '⚡ kW'], ['kwh', '∑ kWh']]} color={() => 'var(--brand-green)'} />
            {line === 'inv' && unit === 'kw' && win !== 'next7' && (
              <Seg<'total' | 'phases'> label="Phases" value={phases ? 'phases' : 'total'} isDark={p.isDark}
                onChange={v => setPhases(v === 'phases')} options={[['total', 'Total'], ['phases', 'L1·L2·L3']]}
                color={() => 'var(--foreground)'} />
            )}
            <ZoomResetButton visible={zoom.isZoomed} onClick={zoom.resetZoom} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={groupLabel}>Window</span>
            <Seg<LoadWindow> label="Window" value={win} isDark={p.isDark} onChange={pickWin} options={WINDOWS} color={() => 'var(--foreground)'} />
            <span style={groupLabel}>Forecast</span>
            <Seg<LoadLead> label="Forecast" value={lead} isDark={p.isDark} onChange={pickLead} options={LEADS} color={() => FC} />
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {win === 'today' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Rubik, sans-serif' }}>
              <span style={{ color: '#f59e0b' }}>☀ 06:00 IST</span>
              <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>{pct.toFixed(0)}% of solar day elapsed</span>
              <span style={{ color: '#6366f1' }}>☾ 06:00 IST</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: p.isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: 4, background: 'linear-gradient(90deg, #f59e0b 0%, #3b82f6 60%, #6366f1 100%)' }} />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{chips}</div>
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
      </div>
    </div>
  );
};

export default LoadCard;
