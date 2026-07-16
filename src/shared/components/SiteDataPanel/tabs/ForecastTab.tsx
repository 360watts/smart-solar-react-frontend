/**
 * ForecastTab — extracted from SiteDataPanel.tsx
 * Contains: ForecastTable, SatelliteKt*, EnhancedKPICard, PerformanceGauge,
 *           SatelliteKtCalendarPicker, SatelliteKtDayDetailChart, SatelliteKtTab,
 *           ForecastAccuracySubTab, ForecastTab (default export)
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Target, Satellite, BarChart2, TrendingUp, Activity, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Line as CJLine, Bar as CJBar } from 'react-chartjs-2';
import { type ChartOptions, type TooltipItem } from 'chart.js';
import { makeGradient, useChartZoomState, ZoomResetButton, createDragZoomPlugins } from '../chartUtils';
import { apiService } from '../../../../services/api';
import { cacheService } from '../../../../services/cacheService';
import { IST_TIMEZONE } from '../../../../app/constants';

const IST = IST_TIMEZONE;

function istDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: IST });
}

function startOfSolarDayIST(): string {
  const now = new Date();
  const todayStr = istDate(now);
  const todaySolar = new Date(`${todayStr}T06:00:00+05:30`);
  if (now < todaySolar) {
    return new Date(todaySolar.getTime() - 24 * 3600 * 1000).toISOString();
  }
  return todaySolar.toISOString();
}

/** The solar day that starts at startOfSolarDayIST() runs until 6am IST the
 * following calendar day — used as the upper bound so "today"'s vs-actual
 * chart keeps showing the forecast curve overnight, not just up to the last
 * actual reading. */
function endOfSolarDayIST(): string {
  return new Date(new Date(startOfSolarDayIST()).getTime() + 24 * 3600 * 1000).toISOString();
}

function istDateOffset(n: number): string {
  const IST_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = Date.now() + IST_MS;
  const istMidnightMS = Math.floor(nowIST / 86400000) * 86400000;
  return istDate(new Date(istMidnightMS + n * 86400000 - IST_MS));
}

// ── VS_ACTUAL_SERIES ───────────────────────────────────────────────────────────

const VS_ACTUAL_SERIES = [
  { key: 'Actual', label: 'Actual' },
  { key: 'P50', label: 'P50' },
  { key: 'Delta', label: 'Δ %' },
] as const;
type VsActualSeriesKey = typeof VS_ACTUAL_SERIES[number]['key'];

// ── ChartCard (local copy) ─────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  subtitle?: string;
  isDark: boolean;
  isLive?: boolean;
  isLoading?: boolean;
  height: number;
  accentColor?: string;
  delay?: number;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title, subtitle, isDark, isLive, isLoading, height, accentColor = '#00a63e',
  delay = 0, children, headerRight,
}) => {
  const cardBg = isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.85)';
  const borderBase = isDark ? 'rgba(148,163,184,0.15)' : `${accentColor}22`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as any, delay }}
      style={{
        background: cardBg, backdropFilter: 'blur(20px)',
        borderRadius: 20, border: `1px solid ${borderBase}`, overflow: 'hidden', marginBottom: 20,
        boxShadow: isDark ? `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${accentColor}15` : `0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px ${accentColor}15`,
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--foreground)' }}>{title}</h3>
            {isLive && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00a63e', border: '1px solid rgba(0,166,62,0.3)', borderRadius: 999, padding: '2px 7px' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00a63e', display: 'inline-block' }} />Live
              </span>
            )}
          </div>
          {subtitle && <p style={{ margin: '3px 0 0', fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>{subtitle}</p>}
        </div>
        {headerRight && <div style={{ flexShrink: 0 }}>{headerRight}</div>}
      </div>
      <div style={{ padding: '16px 20px', minHeight: height }}>
        {isLoading ? (
          <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontSize: '0.875rem' }}>Loading…</div>
        ) : children}
      </div>
    </motion.div>
  );
};

// ── REGIME_STYLE ───────────────────────────────────────────────────────────────

const REGIME_STYLE: Record<string, { bg: string; color: string }> = {
  night: { bg: '#1e293b1a', color: '#b8d0ec' },
  ramp: { bg: '#f59e0b18', color: '#d97706' },
  midday: { bg: '#F0752218', color: '#c2410c' },
};

// ── ForecastTable ──────────────────────────────────────────────────────────────

export const ForecastTable = ({ data }: { data: any[] }) => {
  const theadBg = 'var(--card)';
  const rowBorder = '1px solid var(--border)';

  return (
    <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto', borderRadius: 12, border: `1px solid var(--border)` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', minWidth: 520 }}>
        <thead style={{ position: 'sticky', top: 0, background: theadBg, zIndex: 1 }}>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: `2px solid var(--border)` }}>Time</th>
            <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', borderBottom: `2px solid var(--border)` }}>Regime</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#f59e0b', borderBottom: `2px solid var(--border)` }}>P10 ↓</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#00a63e', borderBottom: `2px solid var(--border)` }}>P50</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#3b82f6', borderBottom: `2px solid var(--border)` }}>P90 ↑</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', borderBottom: `2px solid var(--border)` }}>Physics</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#eab308', borderBottom: `2px solid var(--border)` }}>GHI W/m²</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const rc = row.regime ? (REGIME_STYLE[row.regime] ?? { bg: 'transparent', color: 'var(--text-muted)' }) : null;
            return (
              <tr key={i} style={{ borderBottom: rowBorder, transition: 'background 0.2s' }}>
                <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {row.dateLabel ? <span style={{ marginRight: 8, color: '#00a63e', fontWeight: 700 }}>{row.dateLabel}</span> : null}
                  {row.timeLabel ?? row.time}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  {row.regime && rc && (
                    <span style={{ fontSize: '0.688rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: rc.bg, color: rc.color, padding: '3px 8px', borderRadius: 6, fontFamily: 'Poppins, sans-serif' }}>
                      {row.regime}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.p10?.toFixed(2) ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{row.p50?.toFixed(2) ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.p90?.toFixed(2) ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontStyle: 'italic' }}>{row.physics?.toFixed(2) ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.ghi?.toFixed(0) ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── VsActualTable ──────────────────────────────────────────────────────────────

const VsActualTable = ({ data }: { data: { label: string; p50: number | null; actual: number | null; diffPct?: number | null }[] }) => {
  const rowBorder = '1px solid var(--border)';
  return (
    <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto', borderRadius: 12, border: `1px solid var(--border)` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', minWidth: 520 }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: `2px solid var(--border)` }}>Time</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#F07522', borderBottom: `2px solid var(--border)` }}>Actual PV (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#00a63e', borderBottom: `2px solid var(--border)` }}>P50 Forecast (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', borderBottom: `2px solid var(--border)` }}>Δ %</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: rowBorder }}>
              <td style={{ padding: '10px 16px', color: '#00a63e', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{row.label}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{row.actual != null ? row.actual.toFixed(2) : '—'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{row.p50 != null ? row.p50.toFixed(2) : '—'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{row.diffPct != null ? `${row.diffPct > 0 ? '+' : ''}${row.diffPct}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Satellite kt helpers ───────────────────────────────────────────────────────

const _CAUSE_COLOR: Record<string, string> = {
  non_weather: '#ef4444',
  cloud_shadow: '#f59e0b',
  minor_underperformance: '#3b82f6',
  normal: '#00a63e',
  satellite_mismatch: '#00a63e',
  no_telemetry: '#8B87A8',
};

// ── SatelliteKtDailyChart ─────────────────────────────────────────────────────

export const SatelliteKtDailyChart: React.FC<{ satelliteKt: any[]; isDark: boolean }> = ({ satelliteKt, isDark }) => {
  const ktZoom = useChartZoomState();
  const totalNonWeather = satelliteKt.reduce((s: number, d: any) => s + (d.non_weather_count ?? 0), 0);
  const totalCloud = satelliteKt.reduce((s: number, d: any) => s + (d.cloud_count ?? 0), 0);

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { color: '#b8d0ec', font: { size: 11 }, boxWidth: 12 } },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: 'var(--foreground)', bodyColor: 'var(--muted-foreground)',
        borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
      },
      zoom: createDragZoomPlugins(() => ktZoom.onZoomComplete.current()),
    },
    scales: {
      x: { stacked: true, ticks: { color: 'var(--muted-foreground)', font: { size: 9 }, maxRotation: 45 }, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
      y: { stacked: true, ticks: { color: 'var(--muted-foreground)', font: { family: 'JetBrains Mono, monospace', size: 11 }, stepSize: 1 }, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const labels = satelliteKt.map((d: any) => d.date.slice(5));
  const data = {
    labels,
    datasets: [
      { label: 'Non-weather', data: satelliteKt.map((d: any) => d.non_weather_count ?? 0), backgroundColor: '#ef444480', borderColor: '#ef4444', borderWidth: 1 },
      { label: 'Cloud shadow', data: satelliteKt.map((d: any) => d.cloud_count ?? 0), backgroundColor: '#f59e0b80', borderColor: '#f59e0b', borderWidth: 1 },
    ],
  };

  return (
    <ChartCard
      title="Satellite kt Cross-Check — Daily Anomalies"
      subtitle={`EUMETSAT IODC satellite · last ${satelliteKt.length} days · ${totalNonWeather} non-weather / ${totalCloud} cloud-shadow 15-min slots`}
      isDark={isDark} height={200} accentColor="#ef4444" delay={0.5}
      headerRight={<ZoomResetButton visible={ktZoom.isZoomed} onClick={ktZoom.resetZoom} />}
    >
      <div style={{ height: 200 }}>
        <CJBar ref={ktZoom.chartRef} data={data} options={options} />
      </div>
    </ChartCard>
  );
};

// ── SatelliteKtSlotTimeline ───────────────────────────────────────────────────

export const SatelliteKtSlotTimeline: React.FC<{ slots: any[]; isDark: boolean }> = ({ slots, isDark }) => {
  const zoom = useChartZoomState();
  const daytimeSlots = slots.filter((s: any) => s.kt !== null && s.kt !== undefined);
  if (daytimeSlots.length === 0) return null;

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: 'var(--foreground)', bodyColor: 'var(--muted-foreground)',
        borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: {
          title: (items: any[]) => items[0]?.label ?? '',
          label: (item: TooltipItem<'bar'>) => {
            const s = daytimeSlots[item.dataIndex];
            if (!s) return '';
            return [` kt: ${Number(item.parsed.y).toFixed(3)}`, ` GHI: ${s.ghi_wm2?.toFixed(0)} W/m²`, ` Actual: ${s.actual_kw != null ? s.actual_kw.toFixed(2) : '—'} kW`, ` Exp: ${s.expected_kw != null ? s.expected_kw.toFixed(2) : '—'} kW`, ` ${s.cause}`];
          },
        },
      },
      zoom: createDragZoomPlugins(() => zoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: 'var(--muted-foreground)', font: { size: 8 }, maxRotation: 60 }, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
      y: { min: 0, max: 1.4, ticks: { color: 'var(--muted-foreground)', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => v.toFixed(2) }, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const labels = daytimeSlots.map((s: any) => s.timestamp?.slice(11) ?? '');
  const barData = {
    labels,
    datasets: [{ label: 'kt', data: daytimeSlots.map((s: any) => s.kt), backgroundColor: daytimeSlots.map((s: any) => (_CAUSE_COLOR[s.cause] ?? '#8B87A8') + 'CC'), borderColor: daytimeSlots.map((s: any) => _CAUSE_COLOR[s.cause] ?? '#8B87A8'), borderWidth: 1, borderRadius: 3 }],
  };

  return (
    <ChartCard
      title="Satellite kt — Most Recent Day (15-min slots)"
      subtitle="kt = actual kW / expected kW · red = non-weather fault · amber = cloud shadow · drag to zoom"
      isDark={isDark} height={200} accentColor="#ef4444" delay={0.6}
      headerRight={
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {Object.entries(_CAUSE_COLOR).filter(([k]) => k !== 'no_telemetry').map(([cause, color]) => (
            <span key={cause} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.6rem', fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: color, display: 'inline-block' }} />
              {cause.replace(/_/g, ' ')}
            </span>
          ))}
          <ZoomResetButton visible={zoom.isZoomed} onClick={zoom.resetZoom} />
        </div>
      }
    >
      <div style={{ height: 200 }}>
        <CJBar ref={zoom.chartRef} data={barData} options={options} />
      </div>
    </ChartCard>
  );
};

// ── EnhancedKPICard ────────────────────────────────────────────────────────────

export interface EnhancedKPICardProps {
  label: string;
  value: string;
  sub: string;
  accent: string;
  isDark: boolean;
  trend?: { direction: 'up' | 'down' | 'stable'; pct: number };
  status?: 'good' | 'warning' | 'critical';
  index?: number;
}

export const EnhancedKPICard: React.FC<EnhancedKPICardProps> = ({ label, value, sub, accent, isDark, trend, status, index = 0 }) => {
  const statusColors: Record<string, string> = { good: '#10b981', warning: '#f59e0b', critical: '#ef4444' };
  const statusColor = status ? statusColors[status] : accent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.08 }}
      whileHover={{ y: -4, boxShadow: `0 16px 32px ${statusColor}25` }}
      style={{
        position: 'relative', overflow: 'hidden', padding: '20px 18px', borderRadius: 18,
        background: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)',
        border: `1.5px solid ${statusColor}35`,
        boxShadow: isDark ? `0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px ${statusColor}20` : `0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px ${statusColor}20`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08, background: `radial-gradient(circle at top right, ${statusColor}, transparent 60%)`, pointerEvents: 'none' }} />
      {status && <div style={{ position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: '50%', background: statusColor, boxShadow: `0 0 12px ${statusColor}80` }} />}
      <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Poppins, sans-serif', color: 'var(--muted-foreground)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.6rem', background: `linear-gradient(135deg, ${statusColor}, ${statusColor}cc)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          {value}
        </div>
        {trend && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.75rem', fontWeight: 700, color: trend.direction === 'down' ? '#10b981' : trend.direction === 'up' ? '#ef4444' : 'var(--muted-foreground)' }}>
            {trend.direction === 'down' && '↓'} {trend.direction === 'up' && '↑'} {trend.pct.toFixed(1)}%
          </motion.div>
        )}
      </div>
      <div style={{ fontSize: '0.62rem', fontFamily: 'Poppins, sans-serif', color: 'var(--muted-foreground)' }}>{sub}</div>
    </motion.div>
  );
};

// ── PerformanceGauge ──────────────────────────────────────────────────────────

export const PerformanceGauge: React.FC<{ label: string; value: number; max: number; isDark: boolean; color?: string }> = ({ label, value, max, isDark, color = '#00a63e' }) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 120, height: 140 }}>
      <svg width="120" height="100" style={{ transform: 'scaleX(-1)' }}>
        <circle cx="60" cy="45" r="45" fill="none" stroke={isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.08)'} strokeWidth="6" />
        <motion.circle cx="60" cy="45" r="45" fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 0.8, ease: 'easeOut' }} />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.4rem', color }}>{percentage.toFixed(0)}%</div>
        <div style={{ fontSize: '0.65rem', fontFamily: 'Poppins, sans-serif', color: 'var(--muted-foreground)', marginTop: 2 }}>{label}</div>
      </div>
    </motion.div>
  );
};

// ── SatelliteKtCalendarPicker ─────────────────────────────────────────────────

const _MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const SatelliteKtCalendarPicker: React.FC<{
  availableDates: string[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
  isDark: boolean;
}> = ({ availableDates, selectedDate, onSelect, isDark }) => {
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const ref = selectedDate ?? availableDates[availableDates.length - 1];
    return ref ? new Date(ref + 'T00:00:00') : new Date();
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const fmt = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const containerStyle: React.CSSProperties = {
    display: 'inline-block', padding: '10px 12px', borderRadius: 10,
    background: isDark ? 'rgba(15,23,42,0.95)' : '#fff',
    border: `1px solid ${isDark ? 'rgba(0,166,62,0.25)' : 'rgba(0,166,62,0.2)'}`,
    fontFamily: 'Poppins, sans-serif',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.12)',
  };
  const navBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, color: 'var(--muted-foreground)', transition: 'all 0.15s',
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button style={navBtnStyle} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00a63e'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'; }} onClick={() => setCurrentMonth(new Date(year, month - 1))}>
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground)' }}>{_MONTH_NAMES[month]} {year}</span>
        <button style={navBtnStyle} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00a63e'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'; }} onClick={() => setCurrentMonth(new Date(year, month + 1))}>
          <ChevronRight size={15} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 2 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ width: 30, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 600, color: '#b8d0ec', letterSpacing: '0.04em' }}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} style={{ width: 30, height: 30 }} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ds = fmt(year, month, day);
          const avail = availableSet.has(ds);
          const selected = ds === selectedDate;
          return (
            <div key={ds} onClick={() => avail && onSelect(ds)}
              style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: selected ? 700 : avail ? 500 : 400, borderRadius: '50%', cursor: avail ? 'pointer' : 'default', color: selected ? '#fff' : avail ? '#00a63e' : ('var(--muted-foreground)'), background: selected ? '#00a63e' : 'transparent', transition: 'all 0.15s', userSelect: 'none' }}
              onMouseEnter={e => { if (avail && !selected) (e.currentTarget as HTMLElement).style.background = 'rgba(0,166,62,0.15)'; }}
              onMouseLeave={e => { if (avail && !selected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {day}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.58rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00a63e', display: 'inline-block' }} /> Has data
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.58rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--muted-foreground)', display: 'inline-block' }} /> No data
        </span>
      </div>
    </div>
  );
};

// ── SatelliteKtDayDetailChart ─────────────────────────────────────────────────

const _CAUSE_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'non_weather', label: 'Non-weather' },
  { key: 'cloud_shadow', label: 'Cloud shadow' },
  { key: 'minor_underperformance', label: 'Underperformance' },
  { key: 'normal', label: 'Normal' },
  { key: 'no_telemetry', label: 'No telemetry' },
] as const;

export const SatelliteKtDayDetailChart: React.FC<{ slots: any[]; causeFilter: string; isDark: boolean }> = ({ slots, causeFilter, isDark }) => {
  const zoom = useChartZoomState();
  const daytimeSlots = slots.filter((s: any) => s.cause !== 'night' && s.alert !== 'night');
  const filtered = causeFilter === 'all' ? daytimeSlots : daytimeSlots.filter((s: any) => s.cause === causeFilter);

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: 'var(--foreground)', bodyColor: 'var(--muted-foreground)',
        borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: {
          title: (items: any[]) => items[0]?.label ?? '',
          label: (item: TooltipItem<'bar'>) => {
            const s = filtered[item.dataIndex];
            if (!s) return '';
            if (s.cause === 'no_telemetry') return [` GHI: ${s.ghi_wm2?.toFixed(0)} W/m²`, ` Expected: ${s.expected_kw != null ? s.expected_kw.toFixed(2) : '—'} kW`, ` No PV telemetry — device offline or comms gap`];
            return [` kt: ${s.kt != null ? Number(s.kt).toFixed(3) : '—'}`, ` GHI: ${s.ghi_wm2?.toFixed(0)} W/m²`, ` Actual: ${s.actual_kw != null ? s.actual_kw.toFixed(2) : '—'} kW`, ` Expected: ${s.expected_kw != null ? s.expected_kw.toFixed(2) : '—'} kW`, ` ${(s.cause ?? '').replace(/_/g, ' ')}`];
          },
        },
      },
      zoom: createDragZoomPlugins(() => zoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: 'var(--muted-foreground)', font: { size: 8 }, maxRotation: 60 }, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
      y: { min: 0, max: 1.4, ticks: { color: 'var(--muted-foreground)', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => v.toFixed(2) }, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark, causeFilter]);

  if (filtered.length === 0) {
    return <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontSize: '0.8rem' }}>No slots match this filter</div>;
  }

  const barData = {
    labels: filtered.map((s: any) => s.timestamp?.slice(11, 16) ?? ''),
    datasets: [{ label: 'kt', data: filtered.map((s: any) => s.kt != null ? s.kt : (s.cause === 'no_telemetry' ? 0.02 : null)), backgroundColor: filtered.map((s: any) => (_CAUSE_COLOR[s.cause] ?? '#8B87A8') + 'CC'), borderColor: filtered.map((s: any) => _CAUSE_COLOR[s.cause] ?? '#8B87A8'), borderWidth: 1, borderRadius: 3 }],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ZoomResetButton visible={zoom.isZoomed} onClick={zoom.resetZoom} />
      </div>
      <div style={{ height: 220 }}>
        <CJBar ref={zoom.chartRef} data={barData} options={options} />
      </div>
    </div>
  );
};

// ── SatelliteKtTab ────────────────────────────────────────────────────────────

export const SatelliteKtTab: React.FC<{ accuracy: any; isDark: boolean }> = ({ accuracy, isDark }) => {
  const [detailView, setDetailView] = useState<'day' | 'month'>('day');
  const [analyticsView, setAnalyticsView] = useState<'overview' | 'scatter'>('overview');
  const [causeFilter, setCauseFilter] = useState<string>('all');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calendarOpen) return;
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) setCalendarOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calendarOpen]);

  const satelliteKt: any[] = accuracy?.satellite_kt ?? [];
  const slotsByDate: Record<string, any[]> = accuracy?.satellite_slots_by_date ?? {};
  const availableDates = satelliteKt.map((d: any) => d.date);
  const latestDate = availableDates[availableDates.length - 1] ?? null;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDate = selectedDate ?? latestDate;
  const slots: any[] = activeDate ? (slotsByDate[activeDate] ?? accuracy?.satellite_slots_recent ?? []) : [];
  const daytimeSlots = slots.filter((s: any) => s.cause !== 'night' && s.alert !== 'night');

  const normalCount = daytimeSlots.filter((s: any) => s.cause === 'normal').length;
  const totalDaytime = daytimeSlots.length;
  const healthPct = totalDaytime > 0 ? (normalCount / totalDaytime) * 100 : null;
  const nonWeatherCount = daytimeSlots.filter((s: any) => s.cause === 'non_weather').length;
  const cloudCount = daytimeSlots.filter((s: any) => s.cause === 'cloud_shadow').length;
  const avgKt = totalDaytime > 0 ? daytimeSlots.filter((s: any) => s.kt !== null).reduce((sum: number, s: any) => sum + (s.kt ?? 0), 0) / daytimeSlots.filter((s: any) => s.kt !== null).length : null;
  const firstFaultSlot = daytimeSlots.find((s: any) => s.cause === 'non_weather' || s.cause === 'cloud_shadow' || s.cause === 'minor_underperformance');
  const timeToFirstFault = firstFaultSlot ? firstFaultSlot.timestamp?.slice(11, 16) : null;
  const last7Days = satelliteKt.slice(-7);
  const rollingHealthPcts = last7Days.map((day: any) => {
    const totalSlots = (day.non_weather_count || 0) + (day.cloud_count || 0) + (day.normal_count || 0);
    return totalSlots > 0 ? ((day.normal_count || 0) / totalSlots) * 100 : 0;
  });
  const avgHealthPct7d = rollingHealthPcts.length > 0 ? rollingHealthPcts.reduce((a, b) => a + b, 0) / rollingHealthPcts.length : null;

  const scatterData = daytimeSlots.filter((s: any) => s.ghi_wm2 !== null && s.kt !== null && s.kt !== undefined).map((s: any) => ({ ghi: s.ghi_wm2, kt: s.kt, cause: s.cause }));

  const cardBase: React.CSSProperties = {
    flex: '1 1 140px', borderRadius: 12, padding: '14px 16px',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)'}`,
    background: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(249,250,251,0.9)',
    display: 'flex', flexDirection: 'column', gap: 4,
  };

  const kpiCards = [
    { label: 'System Health', value: healthPct != null ? `${healthPct.toFixed(1)}%` : '—', sub: `${normalCount} / ${totalDaytime} slots normal`, color: healthPct != null ? (healthPct >= 80 ? '#00a63e' : healthPct >= 60 ? '#f59e0b' : '#ef4444') : 'var(--muted-foreground)' },
    { label: 'Non-Weather Faults', value: String(nonWeatherCount), sub: 'Red: kt < 0.30, GHI ≥ 300 W/m²', color: '#ef4444' },
    { label: 'Cloud Events', value: String(cloudCount), sub: 'Amber: kt < 0.30, GHI < 300 W/m²', color: '#f59e0b' },
    { label: 'Avg Daytime kt', value: avgKt != null ? avgKt.toFixed(3) : '—', sub: 'kt = actual kW / expected kW', color: avgKt != null ? (avgKt >= 0.70 ? '#00a63e' : avgKt >= 0.30 ? '#3b82f6' : '#ef4444') : 'var(--muted-foreground)' },
    { label: 'Time to 1st Fault', value: timeToFirstFault ?? 'None', sub: 'First non-weather/cloud event', color: timeToFirstFault ? '#f59e0b' : '#00a63e' },
    { label: '7-Day Health Trend', value: avgHealthPct7d != null ? `${avgHealthPct7d.toFixed(1)}%` : '—', sub: 'Rolling average of system health', color: avgHealthPct7d != null ? (avgHealthPct7d >= 80 ? '#00a63e' : avgHealthPct7d >= 60 ? '#f59e0b' : '#ef4444') : 'var(--muted-foreground)' },
  ];

  if (!accuracy) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontSize: '0.875rem' }}>
        <Satellite size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No satellite data available</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Satellite kt data will appear once the forecast accuracy fetch completes.</div>
      </div>
    );
  }

  const detailCardStyle: React.CSSProperties = {
    borderRadius: 12, border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)'}`,
    background: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(249,250,251,0.9)', overflow: 'hidden',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {kpiCards.map((card) => (
          <div key={card.label} style={cardBase}>
            <div style={{ fontSize: '0.65rem', fontFamily: 'Poppins, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{card.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.5rem', color: card.color, lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', opacity: 0.75 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      <div style={detailCardStyle}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[{ id: 'overview', label: 'Overview', icon: BarChart2 }, { id: 'scatter', label: 'GHI vs kt', icon: TrendingUp }].map(tab => {
            const Icon = tab.icon;
            const isActive = analyticsView === tab.id as any;
            return (
              <button key={tab.id} onClick={() => setAnalyticsView(tab.id as any)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, fontFamily: 'Poppins, sans-serif', cursor: 'pointer', transition: 'all 0.2s', border: `1px solid ${isActive ? '#00a63e' : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.12)')}`, background: isActive ? 'rgba(0,166,62,0.12)' : 'transparent', color: isActive ? '#00a63e' : 'var(--text-muted)', boxShadow: isActive ? '0 0 0 2px rgba(0,166,62,0.1)' : 'none' }}>
                <Icon size={14} />{tab.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: '16px', minHeight: 200 }}>
          {analyticsView === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {[
                { label: 'System Health', value: `${healthPct !== null ? healthPct.toFixed(1) : '—'}%`, description: `${normalCount} / ${totalDaytime} normal slots`, color: healthPct !== null && healthPct >= 80 ? '#00a63e' : healthPct !== null && healthPct >= 60 ? '#f59e0b' : '#ef4444' },
                { label: 'Non-Weather Faults', value: nonWeatherCount, description: 'kt < 0.30, GHI ≥ 300 W/m²', color: '#ef4444' },
                { label: 'Cloud Events', value: cloudCount, description: 'kt < 0.30, GHI < 300 W/m²', color: '#f59e0b' },
                { label: 'Avg Daytime kt', value: daytimeSlots.filter((s: any) => s.kt !== null).length > 0 ? (daytimeSlots.filter((s: any) => s.kt !== null).reduce((sum: number, s: any) => sum + s.kt, 0) / daytimeSlots.filter((s: any) => s.kt !== null).length).toFixed(3) : '—', description: 'Clearness index (0–1)', color: '#3b82f6' },
              ].map((item) => (
                <div key={item.label}
                  style={{ padding: '20px', borderRadius: 12, border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)'}`, background: isDark ? `linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(15,23,42,0.3) 100%)` : `linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(249,250,251,0.6) 100%)`, position: 'relative', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', cursor: 'default' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 16px ${item.color}20`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 3px ${item.color}10`; }}
                >
                  <div style={{ position: 'absolute', top: -40, right: -40, width: 100, height: 100, borderRadius: '50%', background: `${item.color}08`, pointerEvents: 'none' }} />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: '0.7rem', fontFamily: 'Poppins, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>{item.label}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 900, color: item.color, lineHeight: 1, marginBottom: 8 }}>{item.value}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', opacity: 0.65 }}>{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {analyticsView === 'scatter' && scatterData.length > 0 && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                {[{ label: 'Normal', color: '#00a63e', count: scatterData.filter(d => d.cause === 'normal').length }, { label: 'Minor Underperf', color: '#3b82f6', count: scatterData.filter(d => d.cause === 'minor_underperformance').length }, { label: 'Cloud Shadow', color: '#f59e0b', count: scatterData.filter(d => d.cause === 'cloud_shadow').length }, { label: 'Non-Weather', color: '#ef4444', count: scatterData.filter(d => d.cause === 'non_weather').length }].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', padding: '6px 10px', borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', border: `1px solid ${item.color}40` }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                    <span style={{ fontWeight: 600 }}>{item.label}: {item.count}</span>
                  </div>
                ))}
              </div>
              <div style={{ overflowX: 'auto', fontSize: '0.7rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.65rem' }}>GHI Range</th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: '#00a63e', textTransform: 'uppercase', fontSize: '0.65rem' }}>Normal</th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', fontSize: '0.65rem' }}>Underperf</th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', fontSize: '0.65rem' }}>Cloud</th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Non-Weather</th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.65rem' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const ranges = [{ label: '0–200 W/m²', min: 0, max: 200 }, { label: '200–400 W/m²', min: 200, max: 400 }, { label: '400–600 W/m²', min: 400, max: 600 }, { label: '600–800 W/m²', min: 600, max: 800 }, { label: '800+ W/m²', min: 800, max: Infinity }];
                      return ranges.map(range => {
                        const inRange = scatterData.filter(d => d.ghi >= range.min && d.ghi < range.max);
                        const normal = inRange.filter(d => d.cause === 'normal').length;
                        const underperf = inRange.filter(d => d.cause === 'minor_underperformance').length;
                        const cloud = inRange.filter(d => d.cause === 'cloud_shadow').length;
                        const nonWeather = inRange.filter(d => d.cause === 'non_weather').length;
                        return (
                          <tr key={range.label} style={{ borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)'}` }}>
                            <td style={{ padding: '8px', fontWeight: 500 }}>{range.label}</td>
                            <td style={{ padding: '8px', textAlign: 'center', background: normal > 0 ? 'rgba(0, 166, 62, 0.1)' : 'transparent' }}>{normal}</td>
                            <td style={{ padding: '8px', textAlign: 'center', background: underperf > 0 ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>{underperf}</td>
                            <td style={{ padding: '8px', textAlign: 'center', background: cloud > 0 ? 'rgba(245, 158, 11, 0.1)' : 'transparent' }}>{cloud}</td>
                            <td style={{ padding: '8px', textAlign: 'center', background: nonWeather > 0 ? 'rgba(239, 68, 68, 0.1)' : 'transparent' }}>{nonWeather}</td>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{normal + underperf + cloud + nonWeather}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {analyticsView === 'scatter' && scatterData.length === 0 && (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>No scatter data available</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Slots with both GHI and kt measurements are required</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={detailCardStyle}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.8rem', color: 'var(--foreground)' }}>
              {detailView === 'day' ? `${activeDate ?? 'Today'} — 15-min Slot Detail` : 'Monthly — Daily Anomaly Counts'}
            </div>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.63rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {detailView === 'day' ? 'kt = actual kW / expected kW · EUMETSAT IODC satellite · drag to zoom' : `EUMETSAT IODC · last ${satelliteKt.length} days · stacked non-weather + cloud shadow`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 3, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 3 }}>
              {(['day', 'month'] as const).map(v => (
                <button key={v} onClick={() => setDetailView(v)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif', cursor: 'pointer', transition: 'all 0.15s', background: detailView === v ? (isDark ? 'rgba(0,166,62,0.2)' : 'rgba(0,166,62,0.12)') : 'transparent', color: detailView === v ? '#00a63e' : 'var(--text-muted)', border: detailView === v ? '1px solid rgba(0,166,62,0.3)' : '1px solid transparent' }}>
                  {v === 'day' ? 'Day' : 'Month'}
                </button>
              ))}
            </div>
            {detailView === 'day' && availableDates.length > 0 && (
              <div ref={calendarRef} style={{ position: 'relative' }}>
                <button onClick={() => setCalendarOpen(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, fontSize: '0.72rem', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer', border: `1px solid ${calendarOpen ? '#00a63e' : (isDark ? 'rgba(0,166,62,0.35)' : 'rgba(0,166,62,0.3)')}`, background: calendarOpen ? 'rgba(0,166,62,0.12)' : (isDark ? 'rgba(15,23,42,0.9)' : '#fff'), color: 'var(--success)', outline: 'none', transition: 'all 0.15s' }}>
                  <CalendarDays size={13} />{activeDate ?? 'Select date'}
                </button>
                <AnimatePresence>
                  {calendarOpen && (
                    <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.15 }} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50 }}>
                      <SatelliteKtCalendarPicker availableDates={availableDates} selectedDate={activeDate} isDark={isDark} onSelect={d => { setSelectedDate(d); setCalendarOpen(false); }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {detailView === 'day' && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {_CAUSE_FILTER_OPTIONS.map(({ key, label }) => {
                  const activeColor = key === 'all' ? '#00a63e' : (_CAUSE_COLOR[key] ?? '#00a63e');
                  return (
                    <button key={key} onClick={() => setCauseFilter(key)}
                      style={{ padding: '4px 9px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 600, fontFamily: 'Poppins, sans-serif', cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${causeFilter === key ? activeColor : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.12)')}`, background: causeFilter === key ? activeColor + '20' : 'transparent', color: causeFilter === key ? activeColor : 'var(--text-muted)' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {detailView === 'month' && Object.entries(_CAUSE_COLOR).filter(([k]) => k === 'non_weather' || k === 'cloud_shadow').map(([cause, color]) => (
              <span key={cause} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: color, display: 'inline-block' }} />{cause.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
        <div style={{ padding: '12px 16px 16px' }}>
          <AnimatePresence mode="wait">
            <motion.div key={detailView} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              {detailView === 'day' ? (
                daytimeSlots.length > 0
                  ? <SatelliteKtDayDetailChart slots={slots} causeFilter={causeFilter} isDark={isDark} />
                  : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontSize: '0.8rem' }}>No daytime slot data for today</div>
              ) : (
                satelliteKt.length > 0
                  ? <SatelliteKtDailyChart satelliteKt={satelliteKt} isDark={isDark} />
                  : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontSize: '0.8rem' }}>No monthly data available</div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

// ── ForecastAccuracySubTab ────────────────────────────────────────────────────

export const ForecastAccuracySubTab: React.FC<{ accuracy: any; isDark: boolean }> = ({ accuracy, isDark }) => {
  const [chartMode, setChartMode] = useState<'mae' | 'error'>('mae');
  const summary = accuracy?.overall ?? accuracy?.summary ?? {};
  const hourly: any[] = accuracy?.hourly ?? [];
  const chartZoom = useChartZoomState();

  const daytimeHourly = hourly.filter((h: any) => { const local = (h.hour_utc + 5) % 24; return local >= 6 && local <= 18; });
  const nighttimeHourly = hourly.filter((h: any) => { const local = (h.hour_utc + 5) % 24; return local < 6 || local > 18; });
  const avgPct = (arr: any[]) => { const vals = arr.map((h: any) => h.mean_error_pct).filter((v: any) => v != null); return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null; };
  const avgMae = (arr: any[]) => { const vals = arr.map((h: any) => h.mae_kw).filter((v: any) => v != null); return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null; };
  const dayErrorPct = avgPct(daytimeHourly);
  const nightMaeKw = avgMae(nighttimeHourly);
  const coverage = summary.coverage_pct ?? 0;
  const maeKw = summary.mae_kw ?? 0;
  const rmseKw = summary.rmse_kw ?? 0;

  const maxMae = Math.max(...hourly.map((h: any) => h.mae_kw ?? 0), 0.001);
  const overallMaeKw = summary.mae_kw ?? maxMae;
  const chartData = useMemo(() => hourly.map((h: any) => {
    const mae = h.mae_kw != null ? +Number(h.mae_kw).toFixed(2) : null;
    const ratio = mae != null ? mae / maxMae : 0;
    const barColor = ratio < 0.33 ? '#00a63e' : ratio < 0.66 ? '#f59e0b' : '#ef4444';
    const rawPct = h.mean_error_pct ?? h.error_pct;
    const errorPct = rawPct != null ? +Number(rawPct).toFixed(1) : (mae != null && overallMaeKw > 0 ? +(mae / overallMaeKw * 100).toFixed(1) : null);
    return { hour: `${String(h.hour_utc).padStart(2, '0')}:00`, mae, barColor, errorPct };
  }), [hourly, maxMae, overallMaeKw]);

  const maeChartOptions = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)', titleColor: 'var(--foreground)', bodyColor: 'var(--muted-foreground)', borderColor: 'rgba(0,166,62,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10, bodyFont: { family: 'JetBrains Mono, monospace', size: 11 }, callbacks: { label: (item: TooltipItem<'bar'>) => ` MAE: ${Number(item.parsed.y).toFixed(2)} kW` } },
      zoom: createDragZoomPlugins(() => chartZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: 'var(--muted-foreground)', font: { size: 10 }, maxRotation: 0 }, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
      y: { ticks: { color: 'var(--muted-foreground)', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => v.toFixed(2) }, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
    },
  }), [isDark]);

  const errorPctChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)', titleColor: 'var(--foreground)', bodyColor: 'var(--muted-foreground)', borderColor: 'rgba(59,130,246,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10, bodyFont: { family: 'JetBrains Mono, monospace', size: 11 }, callbacks: { label: (item: TooltipItem<'line'>) => ` Error: ${Number(item.parsed.y).toFixed(1)}%` } },
      zoom: createDragZoomPlugins(() => chartZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: 'var(--muted-foreground)', font: { size: 10 }, maxRotation: 0 }, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
      y: { ticks: { color: 'var(--muted-foreground)', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => `${v}%` }, grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
    },
  }), [isDark]);

  const daysComputed = summary.days_computed ?? '—';
  const getMaeStatus = (mae: number) => mae < 0.2 ? 'good' : mae < 0.35 ? 'warning' : 'critical';
  const getCoverageStatus = (cov: number) => cov > 85 ? 'good' : cov > 75 ? 'warning' : 'critical';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontSize: '0.7rem', fontFamily: 'Poppins, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)' }}>
          Performance Summary — Last {daysComputed} days
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <EnhancedKPICard label="MAE" value={maeKw != null ? `${Number(maeKw).toFixed(2)} kW` : '—'} sub="Mean absolute error" accent="#00a63e" isDark={isDark} status={getMaeStatus(maeKw)} trend={{ direction: maeKw < 0.2 ? 'down' : 'up', pct: 2.3 }} index={0} />
        <EnhancedKPICard label="RMSE" value={rmseKw != null ? `${Number(rmseKw).toFixed(2)} kW` : '—'} sub="Root mean sq error" accent="#3b82f6" isDark={isDark} status={getMaeStatus(rmseKw)} index={1} />
        <EnhancedKPICard label="Day Error" value={dayErrorPct != null ? `${Number(dayErrorPct).toFixed(1)}%` : '—'} sub="Avg (06–18 IST)" accent="#f59e0b" isDark={isDark} index={2} />
        <EnhancedKPICard label="Coverage" value={coverage != null ? `${Number(coverage).toFixed(1)}%` : '—'} sub="P10–P90 band" accent="#06b6d4" isDark={isDark} status={getCoverageStatus(coverage)} index={3} />
        <EnhancedKPICard label="Night MAE" value={nightMaeKw != null ? `±${Number(nightMaeKw).toFixed(3)} kW` : '—'} sub="18–06 IST" accent="#8b5cf6" isDark={isDark} index={4} />
      </div>
      <ChartCard
        title={chartMode === 'mae' ? 'MAE by Hour of Day (UTC)' : 'Error % by Hour of Day'}
        subtitle={chartMode === 'mae' ? 'Color-coded severity · green/amber/red = low/med/high error' : 'Relative forecast error across hours'}
        isDark={isDark} height={240} accentColor={chartMode === 'mae' ? '#00a63e' : '#3b82f6'} delay={0.3}
        headerRight={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: '4px 4px' }}>
              {[{ mode: 'mae' as const, label: 'MAE', icon: '📊' }, { mode: 'error' as const, label: 'Error %', icon: '📈' }].map(({ mode, label, icon }) => (
                <button key={mode} onClick={() => setChartMode(mode)}
                  style={{ padding: '6px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, fontFamily: 'Poppins, sans-serif', background: chartMode === mode ? (isDark ? 'rgba(0,166,62,0.2)' : 'rgba(0,166,62,0.1)') : 'transparent', color: chartMode === mode ? ('var(--success)') : ('var(--muted-foreground)'), border: chartMode === mode ? `1px solid rgba(0,166,62,0.3)` : '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {icon} {label}
                </button>
              ))}
            </div>
            {[['#00a63e', 'Low'], ['#f59e0b', 'Med'], ['#ef4444', 'High']].map(([c, l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c as string, display: 'inline-block' }} />{l}
              </span>
            ))}
            <ZoomResetButton visible={chartZoom.isZoomed} onClick={chartZoom.resetZoom} />
          </div>
        }
      >
        <AnimatePresence mode="wait">
          <motion.div key={chartMode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} style={{ height: 240 }}>
            {chartMode === 'mae' ? (
              <CJBar ref={chartZoom.chartRef} data={{ labels: chartData.map((d: any) => d.hour), datasets: [{ label: 'MAE (kW)', data: chartData.map((d: any) => d.mae), backgroundColor: chartData.map((d: any) => d.barColor + 'E0'), borderColor: chartData.map((d: any) => d.barColor), borderWidth: 1, borderRadius: 5 }] }} options={maeChartOptions} />
            ) : (
              <CJLine ref={chartZoom.chartRef} data={{ labels: chartData.map((d: any) => d.hour), datasets: [{ label: 'Error %', data: chartData.map((d: any) => d.errorPct), borderColor: '#3b82f6', borderWidth: 2.2, tension: 0.4, pointRadius: 0, fill: true, backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#3b82f620'; return makeGradient(chart.ctx, chart.chartArea, '#3b82f6', 0.40, 0.02); } }] }} options={errorPctChartOptions} />
            )}
          </motion.div>
        </AnimatePresence>
      </ChartCard>
    </motion.div>
  );
};

// ── ForecastTabProps ──────────────────────────────────────────────────────────

interface ForecastTabProps {
  forecast: any[];
  isDark: boolean;
  siteId: string;
  forecastSubTab: 'chart' | 'accuracy' | 'satellite';
  setForecastSubTab: (v: 'chart' | 'accuracy' | 'satellite') => void;
  forecastZoom: ReturnType<typeof useChartZoomState>;
  vsActualZoom: ReturnType<typeof useChartZoomState>;
  showBands: Record<string, boolean>;
  setShowBands: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  showVsActualSeries: Record<string, boolean>;
  setShowVsActualSeries: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  forecastView: 'chart' | 'table';
  setForecastView: (v: 'chart' | 'table') => void;
  forecastWindow: 'today' | '3d' | '2d';
  setForecastWindow: (v: 'today' | '3d' | '2d') => void;
  vsActualView: 'chart' | 'table';
  setVsActualView: (v: 'chart' | 'table') => void;
  vsActual7d: boolean;
  setVsActual7d: (v: boolean) => void;
  forecastAccuracy: any;
  weatherAccuracy: any;
  achievedPct: number | null | undefined;
}

// ── ForecastTab ───────────────────────────────────────────────────────────────

const tabTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

const ForecastTab: React.FC<ForecastTabProps> = ({
  forecast, isDark, siteId,
  forecastSubTab, setForecastSubTab,
  forecastZoom, vsActualZoom,
  showBands, setShowBands,
  showVsActualSeries, setShowVsActualSeries,
  forecastView, setForecastView,
  forecastWindow, setForecastWindow,
  vsActualView, setVsActualView,
  vsActual7d, setVsActual7d,
  forecastAccuracy, weatherAccuracy, achievedPct,
}) => {
  // Derived forecast data
  const { forecastFiltered, forecastData } = useMemo(() => {
    const todayIST = istDate(new Date());
    const filtered = forecast.filter(row => {
      const clean = row.forecast_for || row.timestamp?.replace('FORECAST#', '');
      if (!clean) return false;
      const forecastIST = istDate(new Date(clean));
      if (forecastWindow === 'today') return forecastIST === todayIST;
      if (forecastWindow === '3d') return forecastIST > istDateOffset(0) && forecastIST <= istDateOffset(3);
      return forecastIST > istDateOffset(0) && forecastIST <= istDateOffset(2);
    });
    const mapped = filtered.map(row => {
      const clean = row.forecast_for || row.timestamp?.replace('FORECAST#', '');
      const d = new Date(clean);
      const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
      const dateLabel = (forecastWindow === '3d' || forecastWindow === '2d')
        ? d.toLocaleDateString([], { weekday: 'short', day: 'numeric', timeZone: IST })
        : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: IST });
      const rawDate = istDate(d);
      const rawTs = d.getTime();
      const time = forecastWindow === 'today' ? timeLabel : `${dateLabel}||${timeLabel}`;
      return {
        time, dateLabel, timeLabel, rawDate, rawTs,
        p50: row.p50_kw != null ? +Number(row.p50_kw).toFixed(2) : null,
        p10: row.p10_kw != null ? +Number(row.p10_kw).toFixed(2) : null,
        p90: row.p90_kw != null ? +Number(row.p90_kw).toFixed(2) : null,
        physics: row.physics_baseline_kw != null ? +Number(row.physics_baseline_kw).toFixed(2) : null,
        ghi: row.ghi_input_wm2 != null ? +row.ghi_input_wm2 : null,
        temp: row.temperature_c != null ? +row.temperature_c : null,
        regime: row.regime ?? null,
      };
    });
    return { forecastFiltered: filtered, forecastData: mapped };
  }, [forecast, forecastWindow]);

  const forecastGeneratedAt = useMemo<Date | null>(() => {
    if (forecast.length === 0) return null;
    let maxGenAt = '';
    for (const row of forecast) {
      if (row.generated_at && row.generated_at > maxGenAt) maxGenAt = row.generated_at;
    }
    if (maxGenAt) return new Date(maxGenAt);
    if (forecast[0]?.timestamp) {
      return new Date(forecast[0].timestamp.replace('FORECAST#', '').split('T')[0] + 'T00:00:00Z');
    }
    return null;
  }, [forecast]);

  const { fcastP10, fcastP50, fcastP90 } = useMemo(() => {
    let p10 = 0, p50 = 0, p90 = 0;
    if (forecastFiltered.length > 1) {
      for (let i = 0; i < forecastFiltered.length - 1; i++) {
        const ts0 = forecastFiltered[i].forecast_for || forecastFiltered[i].timestamp?.replace('FORECAST#', '');
        const ts1 = forecastFiltered[i + 1].forecast_for || forecastFiltered[i + 1].timestamp?.replace('FORECAST#', '');
        if (!ts0 || !ts1) continue;
        const h = Math.abs(new Date(ts1).getTime() - new Date(ts0).getTime()) / 3_600_000;
        if (forecastFiltered[i].p10_kw != null && forecastFiltered[i + 1].p10_kw != null) p10 += (forecastFiltered[i].p10_kw + forecastFiltered[i + 1].p10_kw) / 2 * h;
        if (forecastFiltered[i].p50_kw != null && forecastFiltered[i + 1].p50_kw != null) p50 += (forecastFiltered[i].p50_kw + forecastFiltered[i + 1].p50_kw) / 2 * h;
        if (forecastFiltered[i].p90_kw != null && forecastFiltered[i + 1].p90_kw != null) p90 += (forecastFiltered[i].p90_kw + forecastFiltered[i + 1].p90_kw) / 2 * h;
      }
    }
    return { fcastP10: p10, fcastP50: p50, fcastP90: p90 };
  }, [forecastFiltered]);

  // vs actual data — from forecastAccuracy timeseries (today + 7d)
  const vsActualData = useMemo(() => {
    const ts: any[] = forecastAccuracy?.timeseries ?? [];
    // Keep rows with EITHER an actual reading or a forecast value — previously
    // requiring actual_kw != null silently dropped every future-dated row, so
    // "today" could never show anything past the last real telemetry sample.
    // Actual is real-time (stops at now, naturally, since no reading exists
    // yet); P50 forecast continues on its own past that point.
    const rows = ts
      .filter((r: any) => (r.actual_kw != null || r.predicted_kw != null) && (!!r.slot_ts || !!r.ts))
      .map((r: any) => { const slot = r.slot_ts || r.ts; return { ...r, __ms: new Date(slot).getTime(), _slot: slot }; })
      .filter((r: any) => !Number.isNaN(r.__ms));

    if (rows.length === 0) return [];

    const cutoffMs = vsActual7d
      ? Date.now() - 7 * 24 * 60 * 60 * 1000
      : new Date(startOfSolarDayIST()).getTime();
    // "Today" is bounded above by 6am IST the next day, so the forecast line
    // keeps drawing through the night instead of stopping wherever the data
    // happens to end. The 7-day view is historical-only and needs no upper
    // bound beyond "now".
    const upperBoundMs = vsActual7d ? Date.now() : new Date(endOfSolarDayIST()).getTime();

    // Bucket 5-min actual rows into 15-min slots (matching forecast resolution)
    const BUCKET_MS = 15 * 60 * 1000;
    const bucketMap = new Map<number, { sumActual: number; count: number; predicted_kw: number | null; p10_kw: number | null; p90_kw: number | null }>();
    for (const r of rows.filter((r: any) => r.__ms >= cutoffMs && r.__ms <= upperBoundMs)) {
      const bucketMs = Math.floor(r.__ms / BUCKET_MS) * BUCKET_MS;
      const b = bucketMap.get(bucketMs) ?? { sumActual: 0, count: 0, predicted_kw: r.predicted_kw ?? null, p10_kw: r.p10_kw ?? null, p90_kw: r.p90_kw ?? null };
      if (r.actual_kw != null) { b.sumActual += r.actual_kw; b.count += 1; }
      if (b.predicted_kw == null && r.predicted_kw != null) b.predicted_kw = r.predicted_kw;
      bucketMap.set(bucketMs, b);
    }

    return Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([bucketMs, b]) => ({
        label: vsActual7d
          ? new Date(bucketMs).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: IST })
          : new Date(bucketMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }),
        fTs: bucketMs,
        p50: b.predicted_kw != null ? +Number(b.predicted_kw).toFixed(2) : null,
        actual: b.count > 0 ? +Number(b.sumActual / b.count).toFixed(2) : null,
        diffPct: b.count > 0 && b.predicted_kw != null && b.predicted_kw > 0 ? Math.round(((b.sumActual / b.count - b.predicted_kw) / b.predicted_kw) * 100) : null,
      }));
  }, [forecastAccuracy, vsActual7d]);

  const activeVsActualData = vsActualData;

  // Chart options
  const forecastChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: 'var(--muted-foreground)', font: { family: 'Poppins, sans-serif', size: 11 }, boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 14 } },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: 'var(--foreground)', bodyColor: 'var(--muted-foreground)',
        borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,166,62,0.2)', borderWidth: 1, padding: 12, cornerRadius: 12,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold', size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => { const unit = item.dataset.label === 'GHI' ? 'W/m²' : 'kW'; return ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} ${unit}`; } },
      },
      zoom: createDragZoomPlugins(() => forecastZoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: { ticks: { color: 'var(--muted-foreground)', font: { family: 'Inter, sans-serif', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: 'var(--border)' } },
      y: { ticks: { color: 'var(--muted-foreground)', font: { family: 'JetBrains Mono, monospace', size: 11 } }, grid: { color: 'var(--border)' } },
      ghi: { type: 'linear', position: 'right', ticks: { color: '#eab308', font: { size: 10 }, callback: (v: any) => `${v}` }, grid: { drawOnChartArea: false } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const vsActualChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: 'var(--muted-foreground)', font: { family: 'Poppins, sans-serif', size: 11 }, boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 14 } },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: 'var(--foreground)', bodyColor: 'var(--muted-foreground)',
        borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(59,130,246,0.2)', borderWidth: 1, padding: 12, cornerRadius: 12,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold', size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => { const unit = item.dataset.label === 'Δ %' ? '%' : 'kW'; return ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(item.dataset.label === 'Δ %' ? 0 : 3)} ${unit}`; } },
      },
      zoom: createDragZoomPlugins(() => vsActualZoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: { ticks: { color: 'var(--muted-foreground)', font: { family: 'Inter, sans-serif', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: 'var(--border)' } },
      y: { ticks: { color: 'var(--muted-foreground)', font: { family: 'JetBrains Mono, monospace', size: 11 } }, grid: { color: 'var(--border)' } },
      pct: { type: 'linear', position: 'right', ticks: { color: 'var(--destructive)', font: { size: 11 }, callback: (v: any) => `${v}%` }, grid: { drawOnChartArea: false } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  return (
    <motion.div
      key="forecast"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={tabTransition}
    >
      {/* Sub-tab toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          { id: 'chart', label: 'Forecast', icon: <Sun size={13} /> },
          { id: 'accuracy', label: 'Accuracy', icon: <Target size={13} /> },
          { id: 'satellite', label: 'Satellite', icon: <Satellite size={13} /> },
        ] as const).map(st => (
          <motion.button
            key={st.id}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setForecastSubTab(st.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              border: `1px solid ${forecastSubTab === st.id ? '#00a63e' : 'rgba(0,166,62,0.2)'}`,
              background: forecastSubTab === st.id ? 'rgba(0, 166, 62, 0.12)' : 'transparent',
              color: forecastSubTab === st.id ? '#00a63e' : 'var(--text-muted)',
              borderRadius: 8, padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            {st.icon}{st.label}
          </motion.button>
        ))}
      </div>

      <div style={{ display: forecastSubTab === 'accuracy' ? 'block' : 'none' }}>
        <ForecastAccuracySubTab accuracy={forecastAccuracy} isDark={isDark} />
      </div>
      <div style={{ display: forecastSubTab === 'satellite' ? 'block' : 'none' }}>
        <SatelliteKtTab accuracy={forecastAccuracy} isDark={isDark} />
      </div>
      <div style={{ display: forecastSubTab === 'chart' ? 'block' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['chart', 'table'] as const).map(mode => (
              <button key={mode} onClick={() => setForecastView(mode)}
                style={{ border: '1px solid rgba(0, 166, 62, 0.25)', background: forecastView === mode ? 'rgba(0, 166, 62, 0.14)' : 'transparent', color: forecastView === mode ? '#00a63e' : 'var(--text-muted)', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {mode}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['P10', 'P50', 'P90'] as const).map(key => (
              <button key={key} onClick={() => setShowBands(prev => ({ ...prev, [key]: !prev[key] }))}
                style={{ border: '1px solid rgba(0, 166, 62, 0.25)', background: showBands[key] ? 'rgba(0, 166, 62, 0.14)' : 'transparent', color: showBands[key] ? '#00a63e' : 'var(--text-muted)', borderRadius: 8, padding: '6px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}>
                {key}
              </button>
            ))}
            <button onClick={() => setShowBands(prev => ({ ...prev, GHI: !prev.GHI }))}
              style={{ border: '1px solid rgba(234, 179, 8, 0.35)', background: showBands.GHI ? 'rgba(234, 179, 8, 0.14)' : 'transparent', color: showBands.GHI ? '#eab308' : 'var(--text-muted)', borderRadius: 8, padding: '6px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: showBands.GHI ? '#eab308' : 'var(--text-muted)', display: 'inline-block', flexShrink: 0 }} />
              GHI
            </button>
            <ZoomResetButton visible={forecastZoom.isZoomed} onClick={forecastZoom.resetZoom} />
          </div>
        </div>

        {forecastGeneratedAt && (
          <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'Poppins, sans-serif' }}>
            Forecast generated {forecastGeneratedAt.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', timeZone: IST })}
          </p>
        )}

        <ChartCard
          title="Solar Generation Forecast"
          subtitle={`${forecastData.length} × 15-min slots · P10 / P50 / P90 bands`}
          isDark={isDark} isLive={false} height={360} accentColor="#f59e0b" delay={0.1}
        >
          {forecastData.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontSize: '0.875rem' }}>No forecast points for the selected window.</p>
          ) : forecastView === 'chart' ? (
            <div style={{ width: '100%', height: 360 }}>
              <CJLine
                ref={forecastZoom.chartRef}
                data={{
                  labels: forecastData.map(d => d.time),
                  datasets: [
                    showBands.P10 && { label: 'P10', data: forecastData.map(d => d.p10), borderColor: '#f59e0b', borderWidth: 1.7, tension: 0.3, pointRadius: 0, fill: false },
                    showBands.P50 && { label: 'P50', data: forecastData.map(d => d.p50), borderColor: '#00a63e', borderWidth: 2.4, tension: 0.3, pointRadius: 0, fill: showBands.P10 ? '-1' : false, backgroundColor: 'rgba(0,166,62,0.08)' },
                    showBands.P90 && { label: 'P90', data: forecastData.map(d => d.p90), borderColor: '#3b82f6', borderWidth: 1.7, tension: 0.3, pointRadius: 0, fill: showBands.P50 ? '-1' : false, backgroundColor: 'rgba(59,130,246,0.06)' },
                    { label: 'Physics', data: forecastData.map(d => d.physics), borderColor: '#8B87A8', borderWidth: 1.5, tension: 0.3, pointRadius: 0, borderDash: [5, 4], fill: false },
                    showBands.GHI && { label: 'GHI', yAxisID: 'ghi', data: forecastData.map(d => d.ghi), borderColor: '#eab308', borderWidth: 1.3, tension: 0.3, pointRadius: 0, fill: true, backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#eab30820'; return makeGradient(chart.ctx, chart.chartArea, '#eab308', 0.15, 0.01); } },
                  ].filter(Boolean) as any[],
                }}
                options={forecastChartOptions}
              />
            </div>
          ) : (
            <ForecastTable data={forecastData} />
          )}
        </ChartCard>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[`P10 = ${fcastP10.toFixed(2)} kWh`, `P50 = ${fcastP50.toFixed(2)} kWh`, `P90 = ${fcastP90.toFixed(2)} kWh`, `Points ${forecastData.length}`].map((chip, idx) => (
            <span key={`${chip}-${idx}`} style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', border: '1px solid rgba(0, 166, 62, 0.2)', borderRadius: 999, padding: '5px 10px', background: isDark ? 'rgba(0, 166, 62, 0.08)' : 'rgba(0, 166, 62, 0.05)' }}>
              {chip}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16, marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif', color: 'var(--text-primary)' }}>
            Forecast vs Actual — {vsActual7d ? 'Last 7 Days' : 'Today'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                cacheService.clear(`forecast_accuracy_${siteId}_30`);
                setVsActual7d(!vsActual7d);
              }}
              aria-pressed={vsActual7d}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: `1px solid ${vsActual7d ? (isDark ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.4)') : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.2)')}`, background: vsActual7d ? (isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)') : 'transparent', color: vsActual7d ? ('var(--warning)') : ('var(--muted-foreground)'), cursor: 'pointer', fontWeight: 700, fontFamily: 'Poppins, sans-serif', fontSize: '0.72rem', transition: 'all 0.15s ease' }}>
              <Activity size={12} />Last 7 Days
            </button>
            {(['chart', 'table'] as const).map(mode => (
              <button key={mode} onClick={() => setVsActualView(mode)}
                style={{ border: '1px solid rgba(0, 166, 62, 0.25)', background: vsActualView === mode ? 'rgba(0, 166, 62, 0.14)' : 'transparent', color: vsActualView === mode ? '#00a63e' : 'var(--text-muted)', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {mode}
              </button>
            ))}
            {VS_ACTUAL_SERIES.map(series => (
              <button key={series.key} onClick={() => setShowVsActualSeries(prev => ({ ...prev, [series.key]: !prev[series.key] }))}
                style={{ border: '1px solid rgba(0, 166, 62, 0.25)', background: showVsActualSeries[series.key] ? 'rgba(0, 166, 62, 0.14)' : 'transparent', color: showVsActualSeries[series.key] ? '#00a63e' : 'var(--text-muted)', borderRadius: 8, padding: '6px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}>
                {series.label}
              </button>
            ))}
            <ZoomResetButton visible={vsActualZoom.isZoomed} onClick={vsActualZoom.resetZoom} />
          </div>
        </div>

        <div style={{ padding: 16, borderRadius: 16, marginTop: 4, background: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.8)', border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.25)'}` }}>
          {activeVsActualData.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{vsActual7d ? 'No scored forecast slots for the last 7 days yet.' : 'No overlap points yet between forecast and telemetry for today.'}</p>
          ) : vsActualView === 'chart' ? (
            <div style={{ width: '100%', height: 320 }}>
              <CJLine
                ref={vsActualZoom.chartRef}
                data={{
                  labels: activeVsActualData.map(d => d.label),
                  datasets: [
                    showVsActualSeries.Actual && { label: 'Actual', data: activeVsActualData.map(d => d.actual), borderColor: '#F07522', borderWidth: 2.2, tension: 0.3, pointRadius: 0, fill: false },
                    showVsActualSeries.P50 && { label: 'P50', data: activeVsActualData.map(d => d.p50), borderColor: '#00a63e', borderWidth: 2.2, tension: 0.3, pointRadius: 0, fill: false },
                    showVsActualSeries.Delta && { label: 'Δ %', yAxisID: 'pct', data: activeVsActualData.map(d => d.diffPct), borderColor: '#3b82f6', borderWidth: 1.7, tension: 0.3, pointRadius: 0, borderDash: [4, 4], fill: false },
                  ].filter(Boolean) as any[],
                }}
                options={vsActualChartOptions}
              />
            </div>
          ) : (
            <VsActualTable data={activeVsActualData} />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ForecastTab;
