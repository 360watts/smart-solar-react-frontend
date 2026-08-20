import React, { useEffect, useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, Filler,
  Tooltip as CJTooltip, Legend as CJLegend,
} from 'chart.js';
import { Line as CJLine } from 'react-chartjs-2';
import { resolveCssVar } from '../../lib/resolveCssVar';
import ZoomPlugin from 'chartjs-plugin-zoom';
import { SmartDeviceNode, InverterPhases } from './types';
import { apiService, CtMeterReading } from '../../../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, CJTooltip, CJLegend, ZoomPlugin);

// ─── Types ────────────────────────────────────────────────────────────────────

function ctActivePowerW(reading: CtMeterReading | null): number | null {
  if (!reading) return null;
  const reported = reading.active_power_total;
  if (reported != null && Math.abs(reported) > 0.05) return reported;
  const phases = [reading.active_power_l1, reading.active_power_l2, reading.active_power_l3]
    .filter((v): v is number => v != null);
  if (!phases.length || phases.every(v => Math.abs(v) <= 0.05)) return reported ?? null;
  return phases.reduce((sum, v) => sum + v, 0);
}

export type NodeType = 'solar' | 'battery' | 'grid' | 'load' | 'device' | 'ctmeter';

export interface NodeData {
  type: NodeType;
  id: string;
  title: string;
  subtitle?: string;
  power_kw: number;
  status?: 'active' | 'inactive' | 'online' | 'offline';
  color: string;
  icon: React.ReactNode;
  details?: Record<string, string | number>;
  device?: SmartDeviceNode;
  current_a?: number;
  voltage_v?: number;
  energy_kwh?: number;
  timestamp?: string;
  deviceType?: string;
  circuit?: string;
  ctReading?: CtMeterReading;
  inverterPhases?: InverterPhases;
  loadSplit?: { solarKw: number; gridKw: number; evKw?: number };
  evDevice?: SmartDeviceNode;
}

interface NodeDetailModalProps {
  node: NodeData | null;
  onClose: () => void;
  isDark: boolean;
  siteId?: string;
}

// ─── Design tokens (360watts Design System) ───────────────────────────────────

const DS = {
  colors: {
    solarGreen: '#2FBF71',
    amber: '#E9B949',
    error: '#DC2626',
    success: '#34D399',
    warning: '#F59E0B',
    info: '#3B82F6',
    bgDark: 'var(--background)',
    surfaceDark: 'var(--card)',
    borderDark: 'var(--border)',
    textPrimary: 'var(--foreground)',
    textMuted: 'var(--muted-foreground)',
    textDim: 'var(--text-dim)',
  },
  radius: { sm: 10, md: 14, lg: 18, pill: 999 },
  spacing: { xs: 8, sm: 12, md: 16, lg: 24 },
  shadow: {
    modal: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
    glow: (color: string) => `0 0 32px ${color}28, 0 0 64px ${color}12`,
  },
};

// ─── Animation variants ───────────────────────────────────────────────────────

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 24 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring', stiffness: 340, damping: 30 },
  },
  exit: {
    opacity: 0, scale: 0.94, y: 16,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.32, delay: i * 0.055, ease: 'easeOut' },
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtPower = (kw: number): { value: string; unit: string } => {
  const abs = Math.abs(kw);
  if (abs >= 1) return { value: abs.toFixed(2), unit: 'kW' };
  return { value: (abs * 1000).toFixed(0), unit: 'W' };
};

const fmtRelTime = (ts: string): string => {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
};

const isActive = (status?: string) => status === 'active' || status === 'online';

// Field in site history response per node type
// Maps node type to a function that extracts kW from a history row.
// Backend returns watts from telemetry_5min CAGG: pv1_power_w, pv2_power_w,
// ac_output_power_w (phase L1 only), inv_total_power_w (real AC total),
// load_power_w, grid_power_w, battery_power_w — plus
// em_active_power_w (the real physical CT/energy-meter reading, joined from
// the separate energymeter_5min CAGG — see api/views/telemetry.py::site_history_s3).
// grid_power_w is the INVERTER's own grid-connection reading, a different
// circuit from the CT meter (per this platform's architecture: the energy
// meter measures grid-direct loads the inverter never sees). ctmeter's live
// value already comes from the real CT meter (getLatestEnergyMeter) — its
// history must match, not silently substitute the inverter's grid reading.
const HISTORY_EXTRACT: Partial<Record<NodeType, (r: Record<string, unknown>) => number | null>> = {
  solar: (r) => {
    const pv1 = Number(r.pv1_power_w ?? 0);
    const pv2 = Number(r.pv2_power_w ?? 0);
    // Fallback when PV strings are missing: inv_total_power_w is the real total AC
    // output; ac_output_power_w is phase-L1-only (see FAULT_LOG.md F-048) and would
    // understate generation by ~2/3 on a 3-phase site if used here.
    const inv = Number(r.inv_total_power_w ?? 0);
    const ac = Number(r.ac_output_power_w ?? 0);
    const fallback = inv > 0 ? inv : ac;
    const raw = (pv1 === 0 && pv2 === 0 && fallback > 0) ? fallback : (pv1 + pv2);
    return raw / 1000;
  },
  battery: (r) => r.battery_power_w != null ? Number(r.battery_power_w) / 1000 : null,
  grid:    (r) => r.grid_power_w    != null ? Number(r.grid_power_w)    / 1000 : null,
  // No fallback to grid_power_w: this modal always fetches TODAY's window, so
  // the "predates the join" case never applies in practice — the only real
  // trigger is a genuine CT-meter outage, and silently substituting the
  // inverter's own reading during an outage is exactly the bug this replaced
  // (see git history). A null here means "no real CT reading for this bucket"
  // and should render as a gap, not a smoothed-over substitute value.
  ctmeter: (r) => r.em_active_power_w != null ? Number(r.em_active_power_w) / 1000 : null,
  load:    (r) => r.load_power_w    != null ? Number(r.load_power_w)    / 1000 : null,
};

// Real CT-meter reading for the Total Load chart's "Energy Meter" series —
// same no-fallback rule as HISTORY_EXTRACT.ctmeter above (a null CT-meter
// bucket must render as a gap, not the inverter's grid_power_w standing in
// for it) — kept separate since the "load" node's own extractor means
// something different (inverter-side load, not grid).
const extractCtMeter = (r: Record<string, unknown>): number | null =>
  r.em_active_power_w != null ? Number(r.em_active_power_w) / 1000 : null;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status?: string }) {
  const active = isActive(status);
  const color = active ? DS.colors.solarGreen : status === 'inactive' ? DS.colors.textDim : DS.colors.error;
  const label = status ?? 'unknown';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: DS.radius.pill,
      background: `${color}18`, border: `1px solid ${color}40`,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
      textTransform: 'uppercase', color,
    }}>
      <motion.span
        animate={active ? { opacity: [1, 0.3, 1] } : {}}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
      />
      {label}
    </span>
  );
}

function MetricTile({ label, value, sub, accent, isDark }: { label: string; value: string; sub?: string; accent?: string; isDark: boolean }) {
  return (
    <div style={{
      background: DS.colors.surfaceDark,
      border: `1px solid ${DS.colors.borderDark}`,
      borderRadius: DS.radius.sm,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DS.colors.textDim, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: accent && isDark ? accent : DS.colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: "var(--font-mono)", fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: DS.colors.textMuted, marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: DS.colors.textDim, marginBottom: 10, ...style,
    }}>
      {children}
    </div>
  );
}

function TrendIcon({ kw }: { kw: number }) {
  if (kw > 0.5) return <TrendingUp size={14} color={DS.colors.solarGreen} />;
  if (kw < -0.5) return <TrendingDown size={14} color={DS.colors.error} />;
  return <Minus size={14} color={DS.colors.textDim} />;
}

// ─── Load split panel ─────────────────────────────────────────────────────────

function LoadSplitPanel({ solarKw, gridKw, evKw = 0, evDevice, isDark, ctReversed }: {
  solarKw: number; gridKw: number; evKw?: number; evDevice?: SmartDeviceNode; isDark: boolean; ctReversed?: boolean;
}) {
  const hasEv = evDevice != null;
  const total = solarKw + gridKw + evKw;
  const solarPct = total > 0 ? (solarKw / total) * 100 : 0;
  const gridPct  = total > 0 ? (gridKw  / total) * 100 : 0;
  const evPct    = total > 0 ? (evKw    / total) * 100 : 0;
  const fmtKw = (kw: number) => {
    const abs = Math.abs(kw);
    return abs >= 1 ? `${abs.toFixed(2)} kW` : `${(abs * 1000).toFixed(0)} W`;
  };
  const evLatest = evDevice?.latest as { power_w?: number; voltage_v?: number; switch_on?: boolean } | null | undefined;
  const evCharging = evKw > 0;
  const evPlugged  = evLatest?.switch_on ?? false;
  const evColor    = '#34d399';

  const cols = hasEv ? '1fr 1fr 1fr' : '1fr 1fr';

  return (
    <div style={{
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
      borderRadius: DS.radius.sm,
      padding: '12px 14px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, marginBottom: 12 }}>
        {/* Solar load */}
        <div style={{
          background: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.07)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: DS.radius.sm, padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f59e0b' }}>Solar</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: DS.colors.textPrimary, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {fmtKw(solarKw)}
          </div>
          <div style={{ fontSize: 9, color: DS.colors.textDim, marginTop: 4 }}>{solarPct.toFixed(0)}% · Inverter</div>
        </div>

        {/* EV tile — shown whenever an EV device is registered */}
        {hasEv && (
          <div style={{
            background: isDark ? `${evColor}0e` : `${evColor}0a`,
            border: `1px solid ${evCharging ? `${evColor}40` : `${evColor}22`}`,
            borderRadius: DS.radius.sm, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: evCharging ? evColor : DS.colors.textDim, flexShrink: 0 }} />
                <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: evCharging ? evColor : DS.colors.textDim }}>EV</span>
              </div>
              <span style={{
                fontSize: 7.5, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                background: evCharging ? `${evColor}20` : 'rgba(148,163,184,0.12)',
                color: evCharging ? evColor : DS.colors.textDim,
              }}>
                {evCharging ? 'Charging' : evPlugged ? 'Plugged in' : 'Idle'}
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: DS.colors.textPrimary, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmtKw(evKw)}
            </div>
            <div style={{ fontSize: 9, color: DS.colors.textDim, marginTop: 4 }}>
              {evCharging ? `${evPct.toFixed(0)}% of total` : evLatest?.voltage_v != null ? `${evLatest.voltage_v.toFixed(0)} V` : '—'}
            </div>
          </div>
        )}

        {/* Grid load */}
        <div style={{
          background: isDark ? 'rgba(96,165,250,0.08)' : 'rgba(96,165,250,0.07)',
          border: '1px solid rgba(96,165,250,0.25)',
          borderRadius: DS.radius.sm, padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60a5fa' }}>Grid</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: ctReversed ? DS.colors.warning : DS.colors.textPrimary, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {ctReversed ? '-' : ''}{fmtKw(gridKw)}
          </div>
          <div style={{ fontSize: 9, color: DS.colors.textDim, marginTop: 4 }}>{gridPct.toFixed(0)}% · Energy Meter</div>
        </div>
      </div>

      {ctReversed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${DS.colors.warning}40`,
          borderRadius: DS.radius.sm, padding: '7px 10px', marginBottom: 10,
          fontSize: 9.5, fontWeight: 600, color: DS.colors.warning,
        }}>
          <span>⚠</span>
          <span>Energy meter reads negative — grid circuit shouldn't export. Likely CT clamp installed backwards; figure shown as magnitude only.</span>
        </div>
      )}

      {/* Proportional bar */}
      <div>
        <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', display: 'flex' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${solarPct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ height: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
          {hasEv && evKw > 0 && (
            <motion.div initial={{ width: 0 }} animate={{ width: `${evPct}%` }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
              style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
          )}
          <motion.div initial={{ width: 0 }} animate={{ width: `${gridPct}%` }} transition={{ duration: 0.7, ease: 'easeOut', delay: evKw > 0 ? 0.1 : 0.05 }}
            style={{ height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '0 3px 3px 0' }} />
        </div>
        {total > 0 && (
          <div style={{ fontSize: 8.5, color: DS.colors.textMuted, marginTop: 5, textAlign: 'center' }}>
            Total {fmtKw(total)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase colours (consistent with SiteDataPanel) ───────────────────────────

const PC = { L1: '#3b82f6', L2: '#f59e0b', L3: '#8b5cf6' };

// ─── Side-by-side comparison: Inverter vs Energy Meter per metric ────────────────

interface ComparisonMetricRowProps {
  label: string;
  unit: string;
  invVals: [number | null, number | null, number | null];
  ctVals:  [number | null, number | null, number | null];
  invTotal?: number | null;
  ctTotal?:  number | null;
  isDark: boolean;
  delay?: number;
}

function ComparisonMetricRow({ label, unit, invVals, ctVals, invTotal, ctTotal, isDark, delay = 0 }: ComparisonMetricRowProps) {
  const allVals = [...invVals, ...ctVals].filter((v): v is number => v != null).map(Math.abs);
  const max = Math.max(...allVals, 0.001);
  const decimals = unit === '' ? 3 : unit === 'Hz' ? 2 : 1;
  const fmt = (v: number | null) => v != null ? `${Math.abs(v).toFixed(decimals)}${unit}` : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28, ease: 'easeOut' }}
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
        border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
        borderRadius: DS.radius.sm,
        padding: '10px 12px',
      }}
    >
      {/* Row label + totals */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DS.colors.textDim }}>
          {label}
        </span>
        <div style={{ display: 'flex', gap: 14 }}>
          {invTotal != null && (
            <span style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(invTotal)} <span style={{ fontSize: 7, opacity: 0.6 }}>INV</span>
            </span>
          )}
          {ctTotal != null && (
            <span style={{ fontSize: 9, fontWeight: 800, color: '#60a5fa', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(ctTotal)} <span style={{ fontSize: 7, opacity: 0.6 }}>CT</span>
            </span>
          )}
        </div>
      </div>

      {/* Per-phase comparison rows */}
      {(['L1', 'L2', 'L3'] as const).map((phase, i) => {
        const inv = invVals[i] != null ? Math.abs(invVals[i]!) : null;
        const ct  = ctVals[i]  != null ? Math.abs(ctVals[i]!)  : null;
        const color = PC[phase];

        return (
          <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: i < 2 ? 5 : 0 }}>
            {/* Phase label */}
            <span style={{ fontSize: 9, fontWeight: 800, color, width: 16, flexShrink: 0 }}>{phase}</span>

            {/* Inverter bar (grows right-to-left from centre) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 38, textAlign: 'right', fontSize: 9, fontWeight: 700, color: '#f59e0b', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {inv != null ? fmt(inv) : '—'}
              </div>
              <div style={{ flex: 1, height: 5, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: inv != null ? `${(inv / max) * 100}%` : 0 }}
                  transition={{ duration: 0.55, delay: delay + i * 0.06, ease: 'easeOut' }}
                  style={{ height: '100%', background: '#f59e0b', borderRadius: 2, opacity: 0.85 }}
                />
              </div>
            </div>

            {/* Centre divider */}
            <div style={{ width: 1, height: 14, background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)', flexShrink: 0 }} />

            {/* CT bar (grows left-to-right) */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: ct != null ? `${(ct / max) * 100}%` : 0 }}
                  transition={{ duration: 0.55, delay: delay + i * 0.06 + 0.03, ease: 'easeOut' }}
                  style={{ height: '100%', background: '#60a5fa', borderRadius: 2, opacity: 0.85 }}
                />
              </div>
              <div style={{ width: 38, fontSize: 9, fontWeight: 700, color: '#60a5fa', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {ct != null ? fmt(ct) : '—'}
              </div>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

function ComparisonPhasePanel({ inv, ct, isDark }: { inv: InverterPhases | null; ct: CtMeterReading | null; isDark: boolean }) {
  const invPowerTotal = inv ? (inv.l1.power_w ?? 0) + (inv.l2.power_w ?? 0) + (inv.l3.power_w ?? 0) : null;
  const f = inv?.grid_frequency_hz ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Column headers */}
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 22 }}>
        <div style={{ flex: 1, textAlign: 'right', paddingRight: 8, fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f59e0b' }}>
          Inverter
        </div>
        <div style={{ width: 1, height: 10, flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: 'left', paddingLeft: 8, fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60a5fa' }}>
          Energy Meter
        </div>
      </div>

      <ComparisonMetricRow
        label="Active Power" unit="W"
        invVals={[inv?.l1.power_w ?? null, inv?.l2.power_w ?? null, inv?.l3.power_w ?? null]}
        ctVals={[ct?.active_power_l1 ?? null, ct?.active_power_l2 ?? null, ct?.active_power_l3 ?? null]}
        invTotal={invPowerTotal} ctTotal={ctActivePowerW(ct)}
        isDark={isDark} delay={0}
      />
      <ComparisonMetricRow
        label="Voltage" unit="V"
        invVals={[inv?.grid_l1.voltage_v ?? null, inv?.grid_l2.voltage_v ?? null, inv?.grid_l3.voltage_v ?? null]}
        ctVals={[ct?.voltage_l1 ?? null, ct?.voltage_l2 ?? null, ct?.voltage_l3 ?? null]}
        isDark={isDark} delay={0.06}
      />
      <ComparisonMetricRow
        label="Current" unit="A"
        invVals={[inv?.grid_l1.current_a ?? null, inv?.grid_l2.current_a ?? null, inv?.grid_l3.current_a ?? null]}
        ctVals={[ct?.current_l1 ?? null, ct?.current_l2 ?? null, ct?.current_l3 ?? null]}
        isDark={isDark} delay={0.12}
      />
      <ComparisonMetricRow
        label="Power Factor" unit=""
        invVals={[inv?.grid_power_factor ?? null, inv?.grid_power_factor ?? null, inv?.grid_power_factor ?? null]}
        ctVals={[ct?.power_factor_l1 ?? null, ct?.power_factor_l2 ?? null, ct?.power_factor_l3 ?? null]}
        ctTotal={ct?.power_factor_total ?? null}
        isDark={isDark} delay={0.18}
      />
      <ComparisonMetricRow
        label="Frequency" unit="Hz"
        invVals={[f, f, f]}
        ctVals={[ct?.frequency_l1 ?? null, ct?.frequency_l2 ?? null, ct?.frequency_l3 ?? null]}
        isDark={isDark} delay={0.24}
      />
      <div style={{ fontSize: 8.5, color: DS.colors.textDim, paddingLeft: 2 }}>
        Inverter power factor and frequency are aggregate registers — same value shown per phase
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

type SparkPoint = { t: string; v: number; grid?: number; ev?: number };

export default function NodeDetailModal({ node, onClose, isDark, siteId }: NodeDetailModalProps) {
  const [sparkData, setSparkData] = useState<SparkPoint[]>([]);
  const [sparkLoading, setSparkLoading] = useState(false);
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({ v: true, grid: true, ev: true });
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Chart.js zoom state (inline — matches SiteDataPanel pattern)
  const chartRef = useRef<any>(null);
  const fsChartRef = useRef<any>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isFsZoomed, setIsFsZoomed] = useState(false);
  const resetZoom = useCallback(() => { chartRef.current?.resetZoom(); setIsZoomed(false); }, []);
  const resetFsZoom = useCallback(() => { fsChartRef.current?.resetZoom(); setIsFsZoomed(false); }, []);

  const toggleSeries = useCallback((key: string) => {
    setVisibleSeries(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (Object.values(next).every(v => !v)) return prev;
      return next;
    });
  }, []);

  // ESC to close
  useEffect(() => {
    if (!node) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [node, onClose]);

  // Fetch today's history for the trend chart
  useEffect(() => {
    if (!node) { setSparkData([]); return; }
    let cancelled = false;
    setSparkLoading(true);

    // Solar day: 06:00 IST -> next 06:00 IST (matches energy_summary.py's window;
    // 6am IST = 00:30 UTC). Before that UTC instant today, the window still
    // started yesterday.
    const nowUtc = new Date();
    const todayIstStart = new Date(Date.UTC(
      nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 0, 30, 0,
    ));
    const windowStart = nowUtc >= todayIstStart
      ? todayIstStart
      : new Date(todayIstStart.getTime() - 86400000);
    const windowEnd = new Date(windowStart.getTime() + 86400000);
    const today = windowStart.toISOString();
    const tomorrow = windowEnd.toISOString();
    // getSmartDeviceReadings only accepts a trailing `hours` lookback (no
    // start_date/end_date), so the device/EV paths below approximate the
    // same solar-day window by requesting exactly the hours elapsed since
    // windowStart — data can't exist past "now" anyway, so this covers the
    // same span getSiteHistory's today/tomorrow window resolves to.
    const deviceHours = Math.max(1, Math.ceil((nowUtc.getTime() - windowStart.getTime()) / 3600000));

    const load = async () => {
      try {
        let points: SparkPoint[] = [];
        const fmtTime = (ts: string) =>
          new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

        if (node.type === 'device' && node.device) {
          const rows = await apiService.getSmartDeviceReadings(node.device.id, deviceHours);
          points = rows
            .filter(r => r.power_w != null)
            .map(r => ({ t: fmtTime(r.timestamp), v: (r.power_w ?? 0) / 1000 }));

        } else if (node.type === 'load' && siteId) {
          // Fetch inverter load history and EV device readings in parallel.
          // getSiteHistory's response also includes em_active_power_w (the real
          // CT/energy-meter reading, joined server-side from energymeter_5min) —
          // used below via extractCtMeter for the "Energy Meter" series, matching
          // the live loadSplit breakdown which is also CT-meter-sourced.
          const extractLoad = HISTORY_EXTRACT.load!;
          const [histRows, evRows] = await Promise.all([
            apiService.getSiteHistory(siteId, { start_date: today, end_date: tomorrow, aggregate: '15min' }),
            node.evDevice ? apiService.getSmartDeviceReadings(node.evDevice.id, deviceHours) : Promise.resolve([]),
          ]);

          const evMap = new Map<string, number>();
          for (const r of evRows) {
            if (r.power_w == null) continue;
            evMap.set(fmtTime(r.timestamp), (r.power_w ?? 0) / 1000);
          }

          points = histRows
            .map(r => {
              const t = fmtTime(r.timestamp ?? '');
              const v = extractLoad(r as Record<string, unknown>);
              if (v == null || isNaN(v)) return null;
              const pt: SparkPoint = { t, v: Math.abs(v) };
              const gv = extractCtMeter(r as Record<string, unknown>);
              // Not abs()'d, unlike every other series here: a negative CT
              // reading is a real anomaly signal (likely a reversed clamp,
              // see FAULT_LOG.md) and should visibly dip below zero rather
              // than being folded into a normal-looking positive value.
              if (gv != null && !isNaN(gv)) pt.grid = gv;
              const evVal = evMap.get(t);
              if (evVal != null) pt.ev = evVal;
              return pt;
            })
            .filter((p): p is SparkPoint => p !== null);

        } else if (siteId && HISTORY_EXTRACT[node.type]) {
          const extract = HISTORY_EXTRACT[node.type]!;
          const rows = await apiService.getSiteHistory(siteId, { start_date: today, end_date: tomorrow, aggregate: '15min' });
          points = rows
            .map(r => ({ t: fmtTime(r.timestamp ?? ''), v: extract(r as Record<string, unknown>) }))
            .filter((p): p is { t: string; v: number } => p.v != null && !isNaN(p.v))
            // ctmeter is not abs()'d — a negative reading is a real anomaly
            // signal (see the load-node grid series above) and should dip
            // below zero rather than look like normal positive load.
            .map(p => ({ ...p, v: node.type === 'ctmeter' ? p.v : Math.abs(p.v) }));
        }

        if (!cancelled) setSparkData(points);
      } catch {
        if (!cancelled) setSparkData([]);
      } finally {
        if (!cancelled) setSparkLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [node?.id, siteId]);

  const pwr = node ? fmtPower(node.power_kw) : { value: '0.00', unit: 'kW' };
  const active = isActive(node?.status);
  const accentColor = node?.color ?? DS.colors.solarGreen;
  const hasTrend = !!node && (HISTORY_EXTRACT[node.type] != null || node.type === 'device');

  // Build details entries for the grid
  const detailEntries = node?.details ? Object.entries(node.details) : [];
  const extraEntries: [string, string][] = [];
  if (node?.current_a != null) extraEntries.push(['Current', `${node.current_a.toFixed(2)} A`]);
  if (node?.voltage_v != null) extraEntries.push(['Voltage', `${node.voltage_v.toFixed(1)} V`]);
  if (node?.energy_kwh != null) extraEntries.push(['Total Energy', `${node.energy_kwh.toFixed(3)} kWh`]);
  if (node?.deviceType) extraEntries.push(['Device Type', node.deviceType.replace(/_/g, ' ')]);
  if (node?.circuit) extraEntries.push(['Circuit', node.circuit.replace(/_/g, ' ')]);

  // Merge: extra readings take precedence over generic details
  const allDetails: [string, string][] = [
    ...detailEntries.map(([k, v]) => [k, String(v)] as [string, string]),
    ...extraEntries,
  ];

  const buildChartData = (isLoad: boolean) => {
    const labels = sparkData.map(p => p.t);
    const datasets = isLoad
      ? [
          ...(visibleSeries.v ? [{
            label: 'Inverter Load',
            data: sparkData.map(p => p.v),
            borderColor: '#f87171',
            borderWidth: 2,
            backgroundColor: isDark ? 'rgba(248,113,113,0.12)' : 'rgba(248,113,113,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            spanGaps: true,
          }] : []),
          ...(visibleSeries.grid ? [{
            label: 'Energy Meter',
            data: sparkData.map(p => p.grid ?? null),
            borderColor: '#60a5fa',
            borderWidth: 1.5,
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            // false (unlike every other series here): a null bucket means a
            // genuine CT-meter outage, not a missing sample to interpolate
            // over — bridging it would draw a straight line across real
            // downtime as if the meter had been reporting the whole time.
            spanGaps: false,
          }] : []),
          ...(visibleSeries.ev && node?.evDevice ? [{
            label: 'EV Charging',
            data: sparkData.map(p => p.ev ?? null),
            borderColor: '#34d399',
            borderWidth: 1.5,
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            spanGaps: true,
          }] : []),
        ]
      : [{
          label: 'Power',
          data: sparkData.map(p => p.v),
          borderColor: accentColor,
          borderWidth: 2,
          backgroundColor: isDark ? `${accentColor}26` : `${accentColor}18`,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          spanGaps: true,
        }];
    return { labels, datasets };
  };

  const buildChartOptions = (fullscreen: boolean, _ref: React.MutableRefObject<any>, onZoom: () => void) => {
    const chartText = isDark ? '#AAB4C2' : 'rgba(18,21,26,0.62)';
    const chartTitle = resolveCssVar('--foreground');

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      interaction: { mode: 'index' as const, intersect: false },
      scales: {
        x: {
          ticks: {
            color: chartText, font: { size: 9, weight: 600 as const },
            maxTicksLimit: 7, maxRotation: 0,
          },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          display: fullscreen,
          ticks: { color: chartText, font: { size: 9 }, callback: (v: unknown) => `${Number(v).toFixed(1)}` },
          grid: { display: false },
          border: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: resolveCssVar('--popover'),
          borderColor: `${accentColor}40`,
          borderWidth: 1,
          titleColor: chartTitle,
          bodyColor: chartTitle,
          padding: 8,
          callbacks: {
            label: (item: any) => `${item.dataset.label}: ${item.parsed.y != null ? item.parsed.y.toFixed(2) : '—'} kW`,
          },
        },
        zoom: {
          wheel: { enabled: true, speed: 0.08 },
          drag: {
            enabled: true,
            backgroundColor: 'rgba(0,166,62,0.14)',
            borderColor: 'rgba(0,166,62,0.7)',
            borderWidth: 1,
          },
          pinch: { enabled: true },
          mode: 'x' as const,
          onZoomComplete: onZoom,
        },
        pan: { enabled: false, mode: 'x' as const },
      },
    };
  };

  const renderChart = (isLoad: boolean, fullscreen: boolean) => {
    const ref = fullscreen ? fsChartRef : chartRef;
    const onZoom = fullscreen ? () => setIsFsZoomed(true) : () => setIsZoomed(true);
    return (
      <CJLine
        ref={ref}
        data={buildChartData(isLoad)}
        options={buildChartOptions(fullscreen, ref, onZoom) as any}
      />
    );
  };

  // Chart fullscreen portal — rendered outside the modal so framer-motion
  // transforms on the modal panel don't break position:fixed
  const fullscreenPortal = chartFullscreen && node && ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        key="chart-fs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: isDark ? 'rgba(8,12,20,0.97)' : 'rgba(244,246,248,0.98)',
          backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column',
          padding: '24px 24px 16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: DS.colors.textPrimary }}>
              {node.title} · Solar Day Trend
            </div>
            <div style={{ fontSize: 9, color: DS.colors.textDim, marginTop: 2 }}>
              Drag to zoom · scroll to zoom · reset to restore
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isFsZoomed && (
              <button onClick={resetFsZoom} style={{
                border: '1px solid rgba(0,166,62,0.35)', background: 'transparent',
                color: '#00a63e', borderRadius: 6, cursor: 'pointer',
                padding: '5px 12px', fontSize: 10, fontWeight: 600,
              }}>Reset Zoom</button>
            )}
            <button
              onClick={() => setChartFullscreen(false)}
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 8, cursor: 'pointer',
                padding: '6px 14px', fontSize: 11, fontWeight: 600,
                color: DS.colors.textDim, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <X size={12} /> Close
            </button>
          </div>
        </div>

        {/* Series toggles (load node only) */}
        {node.type === 'load' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {([
              { key: 'v',    label: 'Inverter Load', color: '#f87171', dash: false },
              { key: 'grid', label: 'Energy Meter',      color: '#60a5fa', dash: true  },
              ...(node.evDevice ? [{ key: 'ev', label: 'EV Charging', color: '#34d399', dash: false }] : []),
            ] as { key: string; label: string; color: string; dash: boolean }[]).map(({ key, label, color, dash }) => {
              const on = visibleSeries[key] !== false;
              return (
                <button key={key} onClick={() => toggleSeries(key)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px 5px 10px', borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${on ? `${color}50` : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  background: on ? `${color}15` : 'transparent', transition: 'all 0.15s',
                }}>
                  <span style={{
                    width: 22, height: 2, display: 'inline-block', borderRadius: 2,
                    ...(dash
                      ? { backgroundImage: `repeating-linear-gradient(90deg,${on ? color : '#888'} 0,${on ? color : '#888'} 4px,transparent 4px,transparent 7px)` }
                      : { background: on ? color : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }),
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: on ? color : DS.colors.textDim }}>{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Chart fills remaining space */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {sparkData.length > 0 ? renderChart(node.type === 'load', true) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: DS.colors.textDim }}>No data for today</span>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );

  const modalContent = (
    <AnimatePresence>
      {node && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(4,6,14,0.72)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 998,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 12,
            }}
          >
            {/* ── Modal card ── */}
            <motion.div
              key="modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={e => e.stopPropagation()}
              style={{
                position: 'relative',
                width: 'min(94vw, 460px)',
                maxWidth: '460px',
                height: 'auto',
                maxHeight: '88dvh',
                overflowY: 'auto',
                overflowX: 'hidden',
                borderRadius: DS.radius.lg,
                background: isDark ? 'rgba(7,10,20,0.96)' : 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
                boxShadow: isDark
                  ? '0 -4px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.07)'
                  : '0 -4px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.07)',
                border: isDark ? `1px solid rgba(255,255,255,0.08)` : `1px solid rgba(0,0,0,0.07)`,
                borderTop: `3px solid ${accentColor}`,
                zIndex: 999,
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
              }}
            >
              <div style={{ position: 'static', top: 0, zIndex: 20, background: 'transparent', borderBottom: 'none' }}>
              {active && (
                <div style={{
                  position: 'absolute', inset: -2, borderRadius: DS.radius.lg,
                  background: `radial-gradient(ellipse at 50% -10%, ${accentColor}1a 0%, transparent 60%)`,
                  pointerEvents: 'none', zIndex: -1,
                }} />
              )}

              <motion.div
                custom={0} variants={rowVariants} initial="hidden" animate="visible"
                style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  padding: '18px 18px 14px',
                  borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                {/* Icon + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: DS.radius.sm,
                    background: `${accentColor}18`,
                    border: `1.5px solid ${accentColor}38`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    boxShadow: active ? `0 0 16px ${accentColor}28` : 'none',
                  }}>
                    {node.icon}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15,
                      color: isDark ? DS.colors.textPrimary : '#0F172A',
                    }}>
                      {node.title}
                    </div>
                    {node.subtitle && (
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: DS.colors.textDim, marginTop: 3 }}>
                        {node.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                {/* Close */}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 30, height: 30, borderRadius: DS.radius.sm,
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                    color: DS.colors.textMuted,
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; }}
                >
                  <X size={14} />
                </button>
              </motion.div>
              </div>

              <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* ── Power hero ── */}
                <motion.div
                  custom={1} variants={rowVariants} initial="hidden" animate="visible"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                    borderRadius: DS.radius.md,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  {/* Subtle left accent bar */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 3, background: accentColor, borderRadius: '4px 0 0 4px',
                    opacity: active ? 1 : 0.35,
                  }} />

                  <div style={{ paddingLeft: 8 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: isDark ? DS.colors.textDim : 'rgba(15,23,42,0.38)',
                      marginBottom: 6,
                    }}>
                      Live Power
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{
                        fontSize: 30, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
                        color: node.type === 'ctmeter' && node.power_kw < 0 ? DS.colors.warning : isDark ? DS.colors.textPrimary : '#0F172A',
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      }}>
                        {node.type === 'ctmeter' && node.power_kw < 0 ? '-' : ''}{pwr.value}
                      </span>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: isDark ? DS.colors.textMuted : 'rgba(15,23,42,0.52)',
                      }}>
                        {pwr.unit}
                      </span>
                    </div>
                    {node.timestamp && (
                      <div style={{ fontSize: 10, color: DS.colors.textDim, marginTop: 5 }}>
                        Updated {fmtRelTime(node.timestamp)}
                      </div>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-start',
                    width: 'auto',
                    gap: 8,
                    marginTop: 0,
                  }}>
                    <StatusPill status={node.status} />
                    <TrendIcon kw={node.power_kw} />
                  </div>
                </motion.div>

                {/* ── Solar / Grid load split ── */}
                {node.loadSplit && (
                  <motion.div custom={2} variants={rowVariants} initial="hidden" animate="visible">
                    <SectionLabel>Load Breakdown</SectionLabel>
                    <LoadSplitPanel solarKw={node.loadSplit.solarKw} gridKw={node.loadSplit.gridKw} evKw={node.loadSplit.evKw} evDevice={node.evDevice} isDark={isDark} ctReversed={(node.ctReading?.active_power_total ?? 0) < 0} />
                  </motion.div>
                )}

                {/* ── Metrics grid ── */}
                {allDetails.length > 0 && (
                  <motion.div custom={2} variants={rowVariants} initial="hidden" animate="visible">
                    <SectionLabel>Details</SectionLabel>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                      gap: 8,
                    }}>
                      {allDetails.slice(0, 6).map(([k, v], i) => (
                        <MetricTile
                          key={k + i}
                          label={k}
                          value={v}
                          accent={k.toLowerCase().includes('power') ? accentColor : undefined}
                          isDark={isDark}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* CT card: phase measurements removed — shown only in Total Load comparison */}

                {/* Inverter standalone card: phase measurements removed — shown only in Total Load comparison */}

                {/* ── Total Load: phase comparison — shows both sources; dashes where one is absent ── */}
                {node.type === 'load' && (node.inverterPhases || node.ctReading) && (
                  <motion.div custom={3} variants={rowVariants} initial="hidden" animate="visible">
                    <SectionLabel>Phase Comparison · Inverter vs Energy Meter</SectionLabel>
                    <ComparisonPhasePanel inv={node.inverterPhases ?? null} ct={node.ctReading ?? null} isDark={isDark} />
                  </motion.div>
                )}

                {/* ── Sparkline chart ── */}
                {hasTrend && (
                <motion.div custom={4} variants={rowVariants} initial="hidden" animate="visible">
                  {/* Header row: label + fullscreen toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <SectionLabel style={{ marginBottom: 0 }}>Solar Day Trend</SectionLabel>
                    <button
                      onClick={() => setChartFullscreen(f => !f)}
                      title={chartFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                      style={{
                        background: 'none', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        borderRadius: 6, cursor: 'pointer', padding: '3px 7px',
                        color: DS.colors.textDim, fontSize: 10, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {chartFullscreen ? '⊠ Exit' : '⛶ Expand'}
                    </button>
                  </div>

                  {/* Series toggles (load node only) */}
                  {node.type === 'load' && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      {([
                        { key: 'v',    label: 'Inverter Load', color: '#f87171' },
                        { key: 'grid', label: 'Energy Meter',      color: '#60a5fa' },
                        ...(node.evDevice ? [{ key: 'ev', label: 'EV Charging', color: '#34d399' }] : []),
                      ] as { key: string; label: string; color: string }[]).map(({ key, label, color }) => {
                        const on = visibleSeries[key] !== false;
                        return (
                          <button key={key} onClick={() => toggleSeries(key)} style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '3px 9px 3px 7px', borderRadius: 20, cursor: 'pointer',
                            border: `1px solid ${on ? `${color}50` : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                            background: on ? `${color}12` : 'transparent',
                            transition: 'all 0.15s',
                          }}>
                            <span style={{
                              width: 18, height: 2,
                              background: on ? color : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                              display: 'inline-block', borderRadius: 2,
                            }} />
                            <span style={{ fontSize: 9, fontWeight: 600, color: on ? color : DS.colors.textDim }}>{label}</span>
                          </button>
                        );
                      })}
                      {isZoomed && (
                        <button onClick={resetZoom} style={{
                          border: '1px solid rgba(0,166,62,0.35)', background: 'transparent',
                          color: '#00a63e', borderRadius: 6, cursor: 'pointer',
                          padding: '3px 9px', fontSize: 9, fontWeight: 600, marginLeft: 'auto',
                        }}>Reset Zoom</button>
                      )}
                    </div>
                  )}

                  <div ref={chartContainerRef} style={{
                    background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)',
                    border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                    borderRadius: DS.radius.sm,
                    padding: '8px 4px 4px',
                    height: 140,
                  }}>
                    {sparkLoading ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, color: DS.colors.textDim }}>Loading…</span>
                      </div>
                    ) : sparkData.length === 0 ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, color: DS.colors.textDim }}>No data for today</span>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', height: '100%' }}>
                        {renderChart(node.type === 'load', false)}
                      </div>
                    )}
                  </div>
                </motion.div>
                )}

                {/* ── Footer meta row ── */}
                <motion.div
                  custom={4} variants={rowVariants} initial="hidden" animate="visible"
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 10,
                    borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', color: DS.colors.textDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    NODE · {node.type.toUpperCase()} · {node.id.toUpperCase()}
                  </span>
                  <button
                    onClick={onClose}
                    style={{
                      fontSize: 10, fontWeight: 700, color: accentColor,
                      background: `${accentColor}14`, border: `1px solid ${accentColor}28`,
                      borderRadius: DS.radius.sm, padding: '4px 12px',
                      cursor: 'pointer', letterSpacing: '0.04em',
                      transition: 'all 0.18s ease',
                      flexShrink: 0,
                      width: 'auto',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}28`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}14`; }}
                  >
                    Dismiss
                  </button>
                </motion.div>

              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {fullscreenPortal}
      {ReactDOM.createPortal(modalContent, document.body)}
    </>
  );
}
