/**
 * DetailsTab — premium SCADA-style energy monitoring panel.
 * Uses inline styles + useTheme() to match SiteDataPanel aesthetics.
 * Framer Motion for all transitions. JetBrains Mono for values.
 */
import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Zap, Home, Activity, BatteryCharging } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// ── Types ────────────────────────────────────────────────────────────────────

type ComponentType = 'solar' | 'battery' | 'grid' | 'load' | 'inverter';

export interface DetailsTabTelemetry {
  pv1_power_w?: number | null;
  pv1_voltage_v?: number | null;
  pv1_current_a?: number | null;
  pv2_power_w?: number | null;
  pv2_voltage_v?: number | null;
  pv2_current_a?: number | null;
  pv3_power_w?: number | null;
  pv3_voltage_v?: number | null;
  pv3_current_a?: number | null;
  pv4_power_w?: number | null;
  pv4_voltage_v?: number | null;
  pv4_current_a?: number | null;
  pv_today_kwh?: number | null;
  pv_total_kwh?: number | null;
  battery_power_w?: number | null;
  battery_voltage_v?: number | null;
  battery_current_a?: number | null;
  battery_soc_percent?: number | null;
  battery_temp_c?: number | null;
  batt_charge_today_kwh?: number | null;
  batt_discharge_today_kwh?: number | null;
  batt_charge_total_kwh?: number | null;
  batt_discharge_total_kwh?: number | null;
  grid_power_w?: number | null;
  grid_frequency_hz?: number | null;
  grid_l1_power_w?: number | null;
  grid_l1_voltage_v?: number | null;
  grid_l1_current_a?: number | null;
  grid_l2_power_w?: number | null;
  grid_l2_voltage_v?: number | null;
  grid_l2_current_a?: number | null;
  grid_l3_power_w?: number | null;
  grid_l3_voltage_v?: number | null;
  grid_l3_current_a?: number | null;
  grid_buy_today_kwh?: number | null;
  grid_sell_today_kwh?: number | null;
  grid_buy_total_kwh?: number | null;
  grid_sell_total_kwh?: number | null;
  load_power_w?: number | null;
  load_today_kwh?: number | null;
  load_l1_power_w?: number | null;
  load_l2_power_w?: number | null;
  load_l3_power_w?: number | null;
  ac_output_power_w?: number | null;
  inverter_temp_c?: number | null;
  dc_temp_c?: number | null;
  inv_total_power_w?: number | null;
  run_state?: number | string | null;
  rated_power_w?: number | null;
  work_mode?: number | null;
  fault_code_1?: number | null;
  fault_code_2?: number | null;
  fault_code_3?: number | null;
  fault_code_4?: number | null;
  fault_code_5?: number | null;
  battery_status?: number | null;
  uptime_seconds?: number | null;
  data_source?: string | null;
  data_stale?: boolean | null;
}

export interface DetailsTabProps {
  telemetry?: DetailsTabTelemetry | null;
  pvKw?: number | null;
  loadKw?: number | null;
  gridKw?: number | null;
  batPowerKw?: number | null;
  batSoc?: number | null;
  todayKwh?: number | null;
  totalPvKwh?: number | null;
  invTemp?: number | null;
  runStateLabel?: string;
  isLatestToday?: boolean;
  achievedPct?: number | null;
}

// ── Theme tokens ─────────────────────────────────────────────────────────────

const useTokens = (isDark: boolean) => ({
  bg: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.92)',
  bgPanel: isDark ? 'rgba(8, 15, 35, 0.8)' : 'rgba(255, 255, 255, 0.98)',
  bgCell: isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(248, 250, 252, 0.85)',
  bgCellAlt: isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(241, 245, 249, 0.7)',
  border: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(0, 0, 0, 0.07)',
  borderAccent: isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(0, 0, 0, 0.14)',
  textPrimary: isDark ? '#f1f5f9' : '#0f172a',
  textSecondary: isDark ? '#94a3b8' : '#64748b',
  textMuted: isDark ? '#475569' : '#94a3b8',
  shadow: isDark ? '0 4px 24px rgba(0,0,0,0.45)' : '0 4px 20px rgba(0,0,0,0.08)',
  shadowActive: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 28px rgba(0,0,0,0.14)',
});

// ── Palette per component type ────────────────────────────────────────────────

const PALETTE: Record<ComponentType, {
  accent: string; glow: string;
  bg: (isDark: boolean) => string;
  border: (isDark: boolean) => string;
}> = {
  solar: {
    accent: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.3)',
    bg: (d) => d ? 'rgba(245, 158, 11, 0.08)' : 'rgba(254, 243, 199, 0.7)',
    border: (d) => d ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.4)',
  },
  battery: {
    accent: '#10b981',
    glow: 'rgba(16, 185, 129, 0.3)',
    bg: (d) => d ? 'rgba(16, 185, 129, 0.08)' : 'rgba(209, 250, 229, 0.7)',
    border: (d) => d ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.4)',
  },
  grid: {
    accent: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.3)',
    bg: (d) => d ? 'rgba(59, 130, 246, 0.08)' : 'rgba(219, 234, 254, 0.7)',
    border: (d) => d ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.4)',
  },
  load: {
    accent: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.3)',
    bg: (d) => d ? 'rgba(139, 92, 246, 0.08)' : 'rgba(237, 233, 254, 0.7)',
    border: (d) => d ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.4)',
  },
  inverter: {
    accent: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.3)',
    bg: (d) => d ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 228, 230, 0.7)',
    border: (d) => d ? 'rgba(244, 63, 94, 0.3)' : 'rgba(244, 63, 94, 0.4)',
  },
};

// ── SVG Arc Gauge ─────────────────────────────────────────────────────────────

const ArcGauge: React.FC<{
  pct: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  children?: React.ReactNode;
}> = ({ pct, color, size = 80, strokeWidth = 7, label, children }) => {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // 270-degree arc from 135° to 405° (bottom-left to bottom-right through top)
  const startAngle = 135;
  const totalArc = 270;
  const arcAngle = (Math.min(100, Math.max(0, pct)) / 100) * totalArc;
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const describeArc = (start: number, end: number) => {
    const s = { x: cx + r * Math.cos(toRad(start)), y: cy + r * Math.sin(toRad(start)) };
    const e = { x: cx + r * Math.cos(toRad(end)), y: cy + r * Math.sin(toRad(end)) };
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };
  const trackPath = describeArc(startAngle, startAngle + totalArc);
  const valuePath = arcAngle > 0 ? describeArc(startAngle, startAngle + arcAngle) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
          <path d={trackPath} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth={strokeWidth} strokeLinecap="round" />
          {valuePath && (
            <motion.path
              d={valuePath}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          )}
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          paddingBottom: 4,
        }}>
          {children}
        </div>
      </div>
      {label && (
        <div style={{
          fontSize: 9, fontFamily: 'Inter, sans-serif', fontWeight: 600,
          color: 'rgba(148,163,184,0.7)', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          {label}
        </div>
      )}
    </div>
  );
};

// ── Power Bar ─────────────────────────────────────────────────────────────────

const PowerBar: React.FC<{ pct: number; color: string; isDark: boolean }> = ({ pct, color, isDark }) => (
  <div style={{
    height: 4, borderRadius: 2,
    background: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
    marginTop: 8,
  }}>
    <motion.div
      style={{ height: '100%', borderRadius: 2, background: color, transformOrigin: 'left' }}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: Math.min(1, Math.max(0, pct / 100)) }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    />
  </div>
);

// ── Metric Cell ───────────────────────────────────────────────────────────────

const MetricCell: React.FC<{
  label: string;
  value: string;
  subValue?: string;
  accent?: string;
  isDark: boolean;
  wide?: boolean;
  tooltip?: string;
}> = ({ label, value, subValue, accent, isDark, wide, tooltip }) => {
  const tok = useTokens(isDark);
  return (
    <div
      title={tooltip}
      style={{
        background: tok.bgCell,
        border: `1px solid ${tok.border}`,
        borderRadius: 10,
        padding: '10px 14px',
        gridColumn: wide ? 'span 2' : undefined,
        cursor: tooltip ? 'help' : undefined,
      }}
    >
      <div style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: tok.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: accent ?? tok.textPrimary, lineHeight: 1.1 }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 500, color: tok.textSecondary, marginTop: 2 }}>
          {subValue}
        </div>
      )}
    </div>
  );
};

// ── Section header ─────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string; isDark: boolean; accent: string; badge?: React.ReactNode }> = ({ title, isDark, accent, badge }) => {
  const tok = useTokens(isDark);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 18, borderRadius: 2, background: accent }} />
        <span style={{ fontSize: 13, fontFamily: 'Urbanist, sans-serif', fontWeight: 700, color: tok.textPrimary, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {title}
        </span>
      </div>
      {badge}
    </div>
  );
};

// ── StatusPill ────────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ label: string; color: string; bgColor: string }> = ({ label, color, bgColor }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 20,
    background: bgColor, fontSize: 11,
    fontFamily: 'Inter, sans-serif', fontWeight: 700,
    color, letterSpacing: '0.04em',
  }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
    {label}
  </div>
);

const formatEnergyKwhOrWh = (kwh: number | null | undefined, kwhDecimals = 2): string => {
  if (kwh == null || Number.isNaN(kwh)) return '—';
  const absKwh = Math.abs(kwh);
  if (absKwh < 1) return `${(kwh * 1000).toFixed(0)} Wh`;
  return `${kwh.toFixed(kwhDecimals)} kWh`;
};

// ── Phase strip ───────────────────────────────────────────────────────────────

const PhaseStrip: React.FC<{
  phases: Array<{ label: string; p?: number | null; v?: number | null; a?: number | null }>;
  isDark: boolean;
  accent: string;
}> = ({ phases, isDark, accent }) => {
  const tok = useTokens(isDark);
  const active = phases.filter(ph => ph.p != null || ph.v != null || ph.a != null);
  if (!active.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${active.length}, 1fr)`, gap: 8 }}>
      {active.map(ph => (
        <div key={ph.label} style={{
          background: tok.bgCell,
          border: `1px solid ${tok.border}`,
          borderRadius: 10,
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Phase {ph.label}
          </div>
          {[
            { l: 'Power', v: ph.p != null ? `${Math.abs(Number(ph.p)).toFixed(0)} W` : '—' },
            { l: 'Voltage', v: ph.v != null ? `${Number(ph.v).toFixed(1)} V` : '—' },
            { l: 'Current', v: ph.a != null ? `${Math.abs(Number(ph.a)).toFixed(2)} A` : '—' },
          ].map(row => (
            <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', color: tok.textSecondary }}>{row.l}</span>
              <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: tok.textPrimary }}>{row.v}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// ── Energy stat row ───────────────────────────────────────────────────────────

const EnergyRow: React.FC<{
  items: Array<{ label: string; value: string; color?: string }>;
  isDark: boolean;
}> = ({ items, isDark }) => {
  const tok = useTokens(isDark);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      gap: 8,
      background: tok.bgCellAlt,
      border: `1px solid ${tok.border}`,
      borderRadius: 10,
      padding: '10px 14px',
    }}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <div style={{ position: 'absolute' }} />}
          <div style={{ textAlign: 'center', padding: '0 4px' }}>
            <div style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', color: tok.textSecondary, marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 15, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: item.color ?? tok.textPrimary }}>{item.value}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

// ── Solar Details ─────────────────────────────────────────────────────────────

const SolarDetails: React.FC<{
  t: DetailsTabTelemetry;
  pvKw?: number | null;
  todayKwh?: number | null;
  totalPvKwh?: number | null;
  achievedPct?: number | null;
  isDark: boolean;
}> = ({ t, pvKw, todayKwh, totalPvKwh, achievedPct, isDark }) => {
  const tok = useTokens(isDark);
  const accent = PALETTE.solar.accent;
  const totalW = [t.pv1_power_w, t.pv2_power_w, t.pv3_power_w, t.pv4_power_w]
    .reduce<number>((s, v) => s + (v != null ? Number(v) : 0), 0);
  const maxW = t.rated_power_w ? Number(t.rated_power_w) : 5600;
  const pct = (totalW / maxW) * 100;

  const strings = [
    { label: 'String 1', p: t.pv1_power_w, v: t.pv1_voltage_v, a: t.pv1_current_a },
    { label: 'String 2', p: t.pv2_power_w, v: t.pv2_voltage_v, a: t.pv2_current_a },
    { label: 'String 3', p: t.pv3_power_w, v: t.pv3_voltage_v, a: t.pv3_current_a },
    { label: 'String 4', p: t.pv4_power_w, v: t.pv4_voltage_v, a: t.pv4_current_a },
  ].filter(s => s.p != null || s.v != null || s.a != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ArcGauge pct={pct} color={accent} size={72} label="Output">
            <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: accent }}>
              {pvKw != null ? `${pvKw.toFixed(1)}` : '—'}
            </span>
            <span style={{ fontSize: 9, fontFamily: 'Inter, sans-serif', color: tok.textSecondary, marginTop: -1 }}>kW</span>
          </ArcGauge>
          <div>
            <div style={{ fontSize: 22, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: accent, lineHeight: 1 }}>
              {pvKw != null ? `${pvKw.toFixed(2)} kW` : '—'}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', color: tok.textSecondary, marginTop: 4 }}>
              Live Generation · {pct.toFixed(0)}% of capacity
            </div>
            <PowerBar pct={pct} color={accent} isDark={isDark} />
          </div>
        </div>
        {achievedPct != null && (
          <StatusPill
            label={`${achievedPct}% forecast`}
            color={achievedPct >= 90 ? '#10b981' : achievedPct >= 70 ? '#f59e0b' : '#ef4444'}
            bgColor={isDark ? 'rgba(30,41,59,0.6)' : 'rgba(241,245,249,0.8)'}
          />
        )}
      </div>

      {/* PV strings */}
      {strings.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            PV Strings
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(strings.length, 4)}, 1fr)`, gap: 8 }}>
            {strings.map(s => {
              const sPct = s.p != null ? (Number(s.p) / (maxW / 2)) * 100 : 0;
              return (
                <div key={s.label} style={{
                  background: tok.bgCell, border: `1px solid ${tok.border}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    {s.label}
                  </div>
                  {[
                    { l: 'Power', v: s.p != null ? `${Number(s.p).toFixed(0)} W` : '—' },
                    { l: 'Voltage', v: s.v != null ? `${Number(s.v).toFixed(1)} V` : '—' },
                    { l: 'Current', v: s.a != null ? `${Number(s.a).toFixed(2)} A` : '—' },
                  ].map(row => (
                    <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', color: tok.textSecondary }}>{row.l}</span>
                      <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: tok.textPrimary }}>{row.v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <motion.div style={{ height: '100%', borderRadius: 2, background: accent, transformOrigin: 'left' }}
                      initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, sPct / 100) }} transition={{ duration: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Energy stats */}
      <EnergyRow isDark={isDark} items={[
        { label: 'Today', value: formatEnergyKwhOrWh(todayKwh, 2), color: accent },
        { label: 'Total Lifetime', value: formatEnergyKwhOrWh(totalPvKwh, 1), color: accent },
        { label: 'Today kWp', value: todayKwh != null && maxW ? `${((todayKwh / (maxW / 1000))).toFixed(2)} h` : '—' },
      ]} />
    </div>
  );
};

// ── Battery Details ───────────────────────────────────────────────────────────

const BatteryDetails: React.FC<{
  t: DetailsTabTelemetry;
  batPowerKw?: number | null;
  batSoc?: number | null;
  isDark: boolean;
}> = ({ t, batPowerKw, batSoc, isDark }) => {
  const tok = useTokens(isDark);
  const soc = batSoc ?? (t.battery_soc_percent != null ? Number(t.battery_soc_percent) : null);
  const powerKw = batPowerKw ?? (t.battery_power_w != null ? Number(t.battery_power_w) / 1000 : null);
  const isCharging = (powerKw ?? 0) < -0.05;
  const isDischarging = (powerKw ?? 0) > 0.05;
  const socColor = soc != null ? (soc > 60 ? '#10b981' : soc > 25 ? '#f59e0b' : '#ef4444') : tok.textPrimary;
  const temp = t.battery_temp_c != null ? Number(t.battery_temp_c) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header row with SOC gauge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ArcGauge pct={soc ?? 0} color={socColor} size={80} label="SOC">
          <span style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: socColor }}>
            {soc != null ? `${soc.toFixed(0)}` : '—'}
          </span>
          <span style={{ fontSize: 9, fontFamily: 'Inter, sans-serif', color: tok.textSecondary, marginTop: -1 }}>%</span>
        </ArcGauge>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: isCharging ? '#10b981' : isDischarging ? '#ef4444' : tok.textPrimary }}>
              {powerKw != null ? `${Math.abs(powerKw).toFixed(2)} kW` : '—'}
            </span>
            {(isCharging || isDischarging) && (
              <StatusPill
                label={isCharging ? '↓ Charging' : '↑ Discharging'}
                color={isCharging ? '#10b981' : '#ef4444'}
                bgColor={isDark ? (isCharging ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)') : (isCharging ? 'rgba(209,250,229,0.8)' : 'rgba(254,226,226,0.8)')}
              />
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <MetricCell label="Voltage" value={t.battery_voltage_v != null ? `${Number(t.battery_voltage_v).toFixed(1)} V` : '—'} isDark={isDark} />
            <MetricCell label="Current" value={t.battery_current_a != null ? `${Number(t.battery_current_a).toFixed(2)} A` : '—'} isDark={isDark} />
            <MetricCell label="Temp" value={temp != null ? `${temp.toFixed(0)}°C` : '—'} accent={temp != null ? (temp > 45 ? '#ef4444' : temp > 35 ? '#f59e0b' : '#10b981') : undefined} isDark={isDark} />
          </div>
        </div>
      </div>

      {/* Battery status pill */}
      {t.battery_status != null && (() => {
        const BAT_STATUS: Record<number, { label: string; color: string }> = {
          0: { label: 'Standby',      color: '#94a3b8' },
          1: { label: 'Charging',     color: '#10b981' },
          2: { label: 'Discharging',  color: '#f59e0b' },
          3: { label: 'Fault',        color: '#ef4444' },
        };
        const s = BAT_STATUS[Number(t.battery_status)] ?? { label: `Status ${t.battery_status}`, color: '#94a3b8' };
        return (
          <StatusPill
            label={s.label}
            color={s.color}
            bgColor={isDark ? `${s.color}18` : `${s.color}22`}
          />
        );
      })()}

      {/* Energy stats */}
      <div>
        <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Energy Throughput
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Charged Today', value: formatEnergyKwhOrWh(t.batt_charge_today_kwh != null ? Number(t.batt_charge_today_kwh) : null, 2), color: '#10b981' },
            { label: 'Discharged Today', value: formatEnergyKwhOrWh(t.batt_discharge_today_kwh != null ? Number(t.batt_discharge_today_kwh) : null, 2), color: '#ef4444' },
            { label: 'Charged Total', value: formatEnergyKwhOrWh(t.batt_charge_total_kwh != null ? Number(t.batt_charge_total_kwh) : null, 1), color: '#34d399' },
            { label: 'Discharged Total', value: formatEnergyKwhOrWh(t.batt_discharge_total_kwh != null ? Number(t.batt_discharge_total_kwh) : null, 1), color: '#f87171' },
          ].map(item => (
            <div key={item.label} style={{ background: tok.bgCell, border: `1px solid ${tok.border}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', color: tok.textSecondary, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 15, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Grid Details ──────────────────────────────────────────────────────────────

const GridDetails: React.FC<{
  t: DetailsTabTelemetry;
  gridKw?: number | null;
  isDark: boolean;
}> = ({ t, gridKw, isDark }) => {
  const tok = useTokens(isDark);
  const accent = PALETTE.grid.accent;
  const gKw = gridKw ?? (t.grid_power_w != null ? Number(t.grid_power_w) / 1000 : null);
  const exporting = (gKw ?? 0) < -0.05;
  const importing = (gKw ?? 0) > 0.05;
  const nearZero  = !exporting && !importing && gKw != null;
  const flowColor = exporting ? '#10b981' : importing ? '#3b82f6' : tok.textSecondary;

  const phases = [
    { label: 'L1', p: t.grid_l1_power_w, v: t.grid_l1_voltage_v, a: t.grid_l1_current_a },
    { label: 'L2', p: t.grid_l2_power_w, v: t.grid_l2_voltage_v, a: t.grid_l2_current_a },
    { label: 'L3', p: t.grid_l3_power_w, v: t.grid_l3_voltage_v, a: t.grid_l3_current_a },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: flowColor }}>
              {gKw != null ? `${Math.abs(gKw).toFixed(2)} kW` : '—'}
            </span>
            <StatusPill
              label={exporting ? '↑ Exporting' : importing ? '↓ Importing' : nearZero ? '≈ Balanced' : 'No Data'}
              color={flowColor}
              bgColor={isDark ? 'rgba(30,41,59,0.6)' : 'rgba(241,245,249,0.8)'}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MetricCell label="Total Power" value={t.grid_power_w != null ? `${Number(t.grid_power_w).toFixed(0)} W` : '—'} isDark={isDark} />
            <MetricCell label="Frequency"
              value={t.grid_frequency_hz != null ? `${Number(t.grid_frequency_hz).toFixed(2)} Hz` : '—'}
              accent={t.grid_frequency_hz != null ? (Math.abs(Number(t.grid_frequency_hz) - 50) > 2 ? '#ef4444' : Math.abs(Number(t.grid_frequency_hz) - 50) > 0.5 ? '#f59e0b' : '#10b981') : undefined}
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* Phase breakdown */}
      <div>
        <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Phase Readings
        </div>
        <PhaseStrip phases={phases} isDark={isDark} accent={accent} />
      </div>

      {/* Energy stats */}
      <EnergyRow isDark={isDark} items={[
        { label: 'Bought Today', value: formatEnergyKwhOrWh(t.grid_buy_today_kwh != null ? Number(t.grid_buy_today_kwh) : null, 2), color: '#3b82f6' },
        { label: 'Sold Today', value: formatEnergyKwhOrWh(t.grid_sell_today_kwh != null ? Number(t.grid_sell_today_kwh) : null, 2), color: '#10b981' },
        { label: 'Bought Total', value: formatEnergyKwhOrWh(t.grid_buy_total_kwh != null ? Number(t.grid_buy_total_kwh) : null, 1) },
        { label: 'Sold Total', value: formatEnergyKwhOrWh(t.grid_sell_total_kwh != null ? Number(t.grid_sell_total_kwh) : null, 1) },
      ]} />
    </div>
  );
};

// ── Load Details ──────────────────────────────────────────────────────────────

const LoadDetails: React.FC<{
  t: DetailsTabTelemetry;
  loadKw?: number | null;
  isDark: boolean;
}> = ({ t, loadKw, isDark }) => {
  const tok = useTokens(isDark);
  const accent = PALETTE.load.accent;
  const phases = [
    { label: 'L1', p: t.load_l1_power_w },
    { label: 'L2', p: t.load_l2_power_w },
    { label: 'L3', p: t.load_l3_power_w },
  ].filter(ph => ph.p != null);
  const totalW = t.load_power_w != null ? Number(t.load_power_w) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: accent, marginBottom: 8 }}>
            {loadKw != null ? `${loadKw.toFixed(2)} kW` : '—'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MetricCell label="Total Power" value={totalW != null ? `${totalW.toFixed(0)} W` : '—'} isDark={isDark} />
            <MetricCell label="Consumed Today" value={formatEnergyKwhOrWh(t.load_today_kwh != null ? Number(t.load_today_kwh) : null, 2)} accent={accent} isDark={isDark} />
          </div>
        </div>
      </div>

      {phases.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Load per Phase
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${phases.length}, 1fr)`, gap: 8 }}>
            {phases.map(ph => (
              <div key={ph.label} style={{ background: tok.bgCell, border: `1px solid ${tok.border}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Phase {ph.label}
                </div>
                <div style={{ fontSize: 16, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: tok.textPrimary }}>
                  {ph.p != null ? `${Math.abs(Number(ph.p)).toFixed(0)} W` : '—'}
                </div>
                <PowerBar pct={totalW ? (Math.abs(Number(ph.p ?? 0)) / totalW) * 100 : 0} color={accent} isDark={isDark} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Inverter Details ──────────────────────────────────────────────────────────

const InverterDetails: React.FC<{
  t: DetailsTabTelemetry;
  invTemp?: number | null;
  runStateLabel?: string;
  isDark: boolean;
}> = ({ t, invTemp, runStateLabel, isDark }) => {
  const tok = useTokens(isDark);
  const accent = PALETTE.inverter.accent;
  const temp = invTemp ?? (t.inverter_temp_c != null ? Number(t.inverter_temp_c) : null);
  const tempColor = temp != null ? (temp > 70 ? '#ef4444' : temp > 55 ? '#f59e0b' : '#10b981') : tok.textPrimary;
  const dcTemp = t.dc_temp_c != null ? Number(t.dc_temp_c) : null;
  const dcTempColor = dcTemp != null ? (dcTemp > 70 ? '#ef4444' : dcTemp > 55 ? '#f59e0b' : '#10b981') : tok.textPrimary;
  const acPctOfRated = t.ac_output_power_w != null && t.rated_power_w
    ? (Number(t.ac_output_power_w) / Number(t.rated_power_w)) * 100 : null;
  const runIsActive = runStateLabel?.toLowerCase().includes('run') || runStateLabel?.toLowerCase().includes('normal');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            {runStateLabel && (
              <StatusPill
                label={runStateLabel}
                color={runIsActive ? '#10b981' : '#f59e0b'}
                bgColor={isDark ? (runIsActive ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)') : (runIsActive ? 'rgba(209,250,229,0.8)' : 'rgba(254,243,199,0.8)')}
              />
            )}
            {t.data_source === 'deye_cloud' && (
              <span style={{
                fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.35)',
                color: '#3b82f6',
              }}>
                ☁️ Deye Cloud
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MetricCell label="AC Output" value={t.ac_output_power_w != null ? `${(Number(t.ac_output_power_w) / 1000).toFixed(2)} kW` : '—'} accent={accent} isDark={isDark} />
            <MetricCell label="Total Power" value={t.inv_total_power_w != null ? `${(Number(t.inv_total_power_w) / 1000).toFixed(2)} kW` : '—'} isDark={isDark} />
          </div>
        </div>
      </div>

      {/* Rated capacity + run state */}
      <div style={{ display: 'grid', gridTemplateColumns: t.rated_power_w != null && t.run_state != null ? '1fr 1fr' : '1fr', gap: 8 }}>
        {t.rated_power_w != null && (
          <div style={{ background: tok.bgCell, border: `1px solid ${tok.border}`, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', color: tok.textSecondary, marginBottom: 4 }}>Rated Capacity</div>
            <div style={{ fontSize: 20, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: tok.textPrimary }}>
              {(Number(t.rated_power_w) / 1000).toFixed(1)} kW
            </div>
            {acPctOfRated != null && (
              <div>
                <div style={{ fontSize: 11, color: tok.textMuted, marginTop: 2 }}>{acPctOfRated.toFixed(0)}% load</div>
                <PowerBar pct={acPctOfRated} color={accent} isDark={isDark} />
              </div>
            )}
          </div>
        )}
        {t.run_state != null && (
          <MetricCell label="Run State Raw" value={String(t.run_state)} isDark={isDark} />
        )}
      </div>

      {/* Temperature gauges — separate row to avoid overlap */}
      {(temp != null || dcTemp != null) && (
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Temperatures
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            {temp != null && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <ArcGauge pct={(temp / 100) * 100} color={tempColor} size={72} label="Heatsink">
                  <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: tempColor }}>{temp.toFixed(0)}°</span>
                </ArcGauge>
              </div>
            )}
            {dcTemp != null && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <ArcGauge pct={(dcTemp / 100) * 100} color={dcTempColor} size={72} label="DC Module">
                  <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: dcTempColor }}>{dcTemp.toFixed(0)}°</span>
                </ArcGauge>
              </div>
            )}
          </div>
        </div>
      )}
      {(temp == null && dcTemp == null) && (
        <MetricCell label="Heatsink Temp" value="—" isDark={isDark} />
      )}

      {/* Work mode + fault codes */}
      {(t.work_mode != null || t.fault_code_1 != null) && (() => {
        const WORK_MODE_LABELS: Record<number, string> = {
          0: 'Selling First', 1: 'Zero Export', 2: 'Limited Export', 3: 'Self-Use',
        };
        const workModeLabel = t.work_mode != null
          ? (WORK_MODE_LABELS[Number(t.work_mode)] ?? `Mode ${t.work_mode}`)
          : null;

        const faultCodes = [t.fault_code_1, t.fault_code_2, t.fault_code_3, t.fault_code_4, t.fault_code_5];
        const anyFault = faultCodes.some(f => f != null && Number(f) !== 0);
        const faultSummary = anyFault
          ? faultCodes.map((f, i) => f != null && Number(f) !== 0 ? `F${i + 1}:0x${Number(f).toString(16).toUpperCase()}` : null).filter(Boolean).join('  ')
          : 'No active faults';

        return (
          <div>
            <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Mode &amp; Diagnostics
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {workModeLabel && (
                <MetricCell
                  label="Work Mode"
                  value={workModeLabel}
                  isDark={isDark}
                  tooltip="Deye inverter operating mode (reg 168). Selling First: surplus goes to grid. Zero Export: no grid export. Limited Export: capped export. Self-Use: loads + battery priority, minimal grid."
                />
              )}
              <MetricCell
                label="Fault Codes"
                value={faultSummary}
                accent={anyFault ? '#ef4444' : '#10b981'}
                isDark={isDark}
                wide={!workModeLabel}
                tooltip="Fault registers 103–107. Non-zero values indicate an active fault code — cross-reference with the Deye fault code table in the manual. All zeros means the inverter reports no faults."
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ── Component Selector Card ───────────────────────────────────────────────────

const SelectorCard: React.FC<{
  type: ComponentType;
  label: string;
  icon: React.ElementType;
  value: string;
  subValue?: string;
  isActive: boolean;
  isDark: boolean;
  onClick: () => void;
}> = ({ type, label, icon: Icon, value, subValue, isActive, isDark, onClick }) => {
  const tok = useTokens(isDark);
  const pal = PALETTE[type];

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        position: 'relative', overflow: 'hidden',
        background: isActive ? pal.bg(isDark) : tok.bgCell,
        border: `1.5px solid ${isActive ? pal.border(isDark) : tok.border}`,
        borderRadius: 12, padding: '12px 14px',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        boxShadow: isActive ? `0 0 0 1px ${pal.accent}22, 0 6px 20px ${pal.glow}` : tok.shadow,
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Accent glow blob */}
      {isActive && (
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 60, height: 60, borderRadius: '50%',
          background: pal.accent, opacity: 0.08, pointerEvents: 'none',
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: isActive ? `${pal.accent}22` : isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
      }}>
        <Icon size={16} style={{ color: isActive ? pal.accent : tok.textSecondary }} />
      </div>

      {/* Label */}
      <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: isActive ? pal.accent : tok.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
        {label}
      </div>

      {/* Value */}
      <div style={{ fontSize: 17, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: isActive ? pal.accent : tok.textPrimary, lineHeight: 1.1 }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', color: tok.textSecondary, marginTop: 2 }}>{subValue}</div>
      )}

      {/* Active indicator bottom bar */}
      {isActive && (
        <motion.div
          layoutId="selectorIndicator"
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, background: pal.accent, borderRadius: '0 0 2px 2px' }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  );
};

// ── Main DetailsTab ───────────────────────────────────────────────────────────

const DetailsTab: React.FC<DetailsTabProps> = ({
  telemetry,
  pvKw,
  loadKw,
  gridKw,
  batPowerKw,
  batSoc,
  todayKwh,
  totalPvKwh,
  invTemp,
  runStateLabel,
  isLatestToday,
  achievedPct,
}) => {
  const { isDark } = useTheme();
  const tok = useTokens(isDark);
  const [active, setActive] = useState<ComponentType>('solar');
  const t: DetailsTabTelemetry = telemetry ?? {};

  const soc = batSoc ?? (t.battery_soc_percent != null ? Number(t.battery_soc_percent) : null);
  const gKw = gridKw ?? (t.grid_power_w != null ? Number(t.grid_power_w) / 1000 : null);
  const gAbs = gKw != null ? Math.abs(gKw) : null;
  const gFlow = (gKw ?? 0) < -0.05 ? '↑ Exp' : (gKw ?? 0) > 0.05 ? '↓ Imp' : 'Idle';
  const batPower = batPowerKw ?? (t.battery_power_w != null ? Number(t.battery_power_w) / 1000 : null);
  const batLabel = (batPower ?? 0) > 0.05 ? '↑ Chg' : (batPower ?? 0) < -0.05 ? '↓ Dis' : null;

  const cards: Array<{
    type: ComponentType;
    label: string;
    icon: React.ElementType;
    value: string;
    subValue?: string;
  }> = [
    {
      type: 'solar',
      label: 'Solar PV',
      icon: Sun,
      value: pvKw != null ? `${pvKw.toFixed(2)} kW` : '—',
      subValue: todayKwh != null ? `${formatEnergyKwhOrWh(todayKwh, 1)} today` : undefined,
    },
    {
      type: 'battery',
      label: 'Battery',
      icon: BatteryCharging,
      value: soc != null ? `${soc.toFixed(0)}%` : '—',
      subValue: batLabel ?? (batPower != null ? `${Math.abs(batPower).toFixed(2)} kW` : undefined),
    },
    {
      type: 'grid',
      label: 'Grid',
      icon: Zap,
      value: gAbs != null ? `${gAbs.toFixed(2)} kW` : '—',
      subValue: gFlow,
    },
    {
      type: 'load',
      label: 'Load',
      icon: Home,
      value: loadKw != null ? `${loadKw.toFixed(2)} kW` : '—',
      subValue: t.load_today_kwh != null ? `${formatEnergyKwhOrWh(Number(t.load_today_kwh), 1)} today` : undefined,
    },
    {
      type: 'inverter',
      label: 'Inverter',
      icon: Activity,
      value: runStateLabel ? runStateLabel : (t.run_state != null ? String(t.run_state) : '—'),
      subValue: invTemp != null ? `${invTemp.toFixed(0)}°C` : (t.inverter_temp_c != null ? `${Number(t.inverter_temp_c).toFixed(0)}°C` : undefined),
    },
  ];

  const panelTitle: Record<ComponentType, string> = {
    solar: 'Solar PV Details',
    battery: 'Battery Details',
    grid: 'Grid Details',
    load: 'Load Details',
    inverter: 'Inverter Details',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Selector row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {cards.map(c => (
          <SelectorCard
            key={c.type}
            type={c.type}
            label={c.label}
            icon={c.icon}
            value={c.value}
            subValue={c.subValue}
            isActive={active === c.type}
            isDark={isDark}
            onClick={() => setActive(c.type)}
          />
        ))}
      </div>

      {/* Detail panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            background: tok.bgPanel,
            border: `1px solid ${PALETTE[active].border(isDark)}`,
            borderRadius: 14,
            padding: '18px 20px',
            boxShadow: `${tok.shadowActive}, 0 0 0 1px ${PALETTE[active].accent}11`,
          }}
        >
          <SectionHeader
            title={panelTitle[active]}
            isDark={isDark}
            accent={PALETTE[active].accent}
          />

          {active === 'solar' && (
            <SolarDetails t={t} pvKw={pvKw} todayKwh={todayKwh} totalPvKwh={totalPvKwh} achievedPct={achievedPct} isDark={isDark} />
          )}
          {active === 'battery' && (
            <BatteryDetails t={t} batPowerKw={batPowerKw} batSoc={batSoc} isDark={isDark} />
          )}
          {active === 'grid' && (
            <GridDetails t={t} gridKw={gridKw} isDark={isDark} />
          )}
          {active === 'load' && (
            <LoadDetails t={t} loadKw={loadKw} isDark={isDark} />
          )}
          {active === 'inverter' && (
            <InverterDetails t={t} invTemp={invTemp} runStateLabel={runStateLabel} isDark={isDark} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Stale data notice */}
      {isLatestToday === false && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            background: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(254, 243, 199, 0.8)',
            border: `1px solid ${isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.4)'}`,
          }}
        >
          <span style={{ fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#92400e' }}>
            ⚠ Showing last known data — live telemetry not available for today
          </span>
        </motion.div>
      )}
    </div>
  );
};

export default DetailsTab;
