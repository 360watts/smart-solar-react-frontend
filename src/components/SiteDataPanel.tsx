/**
 * SiteDataPanel — solar site intelligence panel with modern 3D animations & UX
 *
 * Tabs:
 *  - Overview: 6 live KPI cards + energy breakdown + insights
 *  - Weather:  current conditions + 24 h hourly outlook strip
 *  - History:  power area chart with Battery SOC on secondary axis
 *  - Forecast: P10/P50/P90 + physics baseline, regime tags, % achieved
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AreaChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceArea,
} from 'recharts';
import { Home, CloudSun, TrendingUp, Sun, Moon, CloudRain, Cloud, Battery, Activity, Thermometer, RefreshCw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { IST_TIMEZONE } from '../constants';
import DetailsTab from './DetailsTab';

// ── Tabs ───────────────────────────────────────────────────────────────────────

const tabIconSize = 16;
const TABS = [
  { id: 'overview',  label: 'Overview',  icon: <Home size={tabIconSize} /> },
  { id: 'details',   label: 'Details',   icon: <Activity size={tabIconSize} /> },
  { id: 'weather',   label: 'Weather',   icon: <CloudSun size={tabIconSize} /> },
  { id: 'history',   label: 'History',   icon: <TrendingUp size={tabIconSize} /> },
  { id: 'forecast',  label: 'Forecast',  icon: <Sun size={tabIconSize} /> },
] as const;
type TabId = typeof TABS[number]['id'];

const HISTORY_SERIES = [
  { key: 'PV', label: 'PV' },
  { key: 'Load', label: 'Load' },
  { key: 'Grid', label: 'Grid' },
  { key: 'InvOut', label: 'Inv Out' },
  { key: 'SOC', label: 'SOC' },
] as const;
type HistorySeriesKey = typeof HISTORY_SERIES[number]['key'];

const VS_ACTUAL_SERIES = [
  { key: 'Actual', label: 'Actual' },
  { key: 'P50', label: 'P50' },
  { key: 'Delta', label: 'Δ %' },
] as const;
type VsActualSeriesKey = typeof VS_ACTUAL_SERIES[number]['key'];

// ── Animation Variants ──────────────────────────────────────────────────────────

const kpiCardVariants = {
  initial: { opacity: 0, scale: 0.8, rotateX: -15 },
  animate: (i: number) => ({
    opacity: 1,
    scale: 1,
    rotateX: 0,
    transition: {
      delay: i * 0.08,
      type: 'spring' as const,
      stiffness: 200,
      damping: 15
    }
  }),
  hover: {
    scale: 1.05,
    rotateY: 2,
    rotateX: -2,
    boxShadow: '0 15px 35px rgba(0, 166, 62, 0.2)',
    transition: { type: 'spring' as const, stiffness: 300, damping: 20 }
  }
};

const tabTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30
};

const pulseAnimation = {
  scale: [1, 1.05, 1],
  opacity: [0.7, 1, 0.7],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut' as const
  }
};

// ── Custom forecast tooltip ────────────────────────────────────────────────────

const ForecastTooltip = ({ active, payload, label }: any) => {
  const { isDark } = useTheme();
  if (!active || !payload || !payload.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 166, 62, 0.2)'}`,
        borderRadius: 12,
        padding: '12px 16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        minWidth: 160,
      }}>
      <div style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827', fontSize: '0.875rem', marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 166, 62, 0.2)'}` }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map((entry: any, idx: number) => {
          const unit = entry.name?.includes('Temp') ? '°C' : entry.name?.includes('GHI') ? 'W/m²' : 'kW';
          return (
            <motion.div
              key={entry.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', color: isDark ? '#94a3b8' : '#374151' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color || entry.stroke || entry.fill, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{entry.name?.split(' ')[0]}</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827' }}>
                {Number(entry.value).toFixed(3)} {unit}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

/** Reusable chart tooltip matching Forecast style */
const ChartTooltip = ({ active, payload, label, unitResolver }: { active?: boolean; payload?: any[]; label?: string; unitResolver?: (entry: any) => string }) => {
  const { isDark } = useTheme();
  if (!active || !payload || !payload.length) return null;
  const getUnit = unitResolver ?? (() => 'kW');
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 166, 62, 0.2)'}`,
        borderRadius: 12,
        padding: '12px 16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        minWidth: 160,
      }}>
      <div style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827', fontSize: '0.875rem', marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 166, 62, 0.2)'}` }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map((entry: any, idx: number) => {
          const unit = getUnit(entry);
          const val = entry.value != null ? Number(entry.value).toFixed(3) : '—';
          return (
            <motion.div
              key={entry.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', color: isDark ? '#94a3b8' : '#374151' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color || entry.stroke || entry.fill, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{entry.name ?? ''}</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827' }}>
                {val} {unit}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const IST = IST_TIMEZONE;

function istDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: IST });
}

function istDateOffset(n: number): string {
  const IST_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = Date.now() + IST_MS;
  const istMidnightMS = Math.floor(nowIST / 86400000) * 86400000;
  return istDate(new Date(istMidnightMS + n * 86400000 - IST_MS));
}

function startOfTodayIST(): string {
  const todayStr = istDate(new Date());
  return new Date(`${todayStr}T00:00:00+05:30`).toISOString();
}

function fmt(ts: string, range: string): string {
  try {
    const d = new Date(ts);
    if (range === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
    if (range === '7d')  return d.toLocaleDateString([], { weekday: 'short', timeZone: IST }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: IST });
  } catch { return ts; }
}

function aggregateByPeriod(data: any[], range: string): any[] {
  if (!data.length) return [];
  if (range === '24h') return data.filter((_, i) => i % 2 === 0 || i === data.length - 1);

  const isDay = range !== '7d';
  const buckets = new Map<string, any[]>();
  data.forEach(row => {
    const d = new Date(row.timestamp);
    const key = isDay
      ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  });

  return Array.from(buckets.values()).map(bucket => {
    const avg = (field: string) => bucket.reduce((s, r) => s + (r[field] ?? 0), 0) / bucket.length;
    const first = bucket[0];
    return {
      timestamp:            first.timestamp,
      pv1_power_w:          avg('pv1_power_w'),
      pv2_power_w:          avg('pv2_power_w'),
      pv3_power_w:          avg('pv3_power_w'),
      pv4_power_w:          avg('pv4_power_w'),
      load_power_w:         avg('load_power_w'),
      grid_power_w:         avg('grid_power_w'),
      battery_soc_percent:  avg('battery_soc_percent'),
      battery_power_w:      avg('battery_power_w'),
      pv_today_kwh:         isDay ? Math.max(...bucket.map(r => r.pv_today_kwh ?? 0)) : first.pv_today_kwh,
      ac_output_power_w:    avg('ac_output_power_w'),
    };
  });
}

function buildSparseCategoryTicks<T>(data: T[], valueSelector: (row: T) => string, maxTicks = 8): string[] {
  if (!data.length) return [];
  if (data.length <= maxTicks) return data.map(valueSelector);

  const step = Math.max(1, Math.ceil((data.length - 1) / (maxTicks - 1)));
  const ticks: string[] = [];
  for (let i = 0; i < data.length; i += step) {
    ticks.push(valueSelector(data[i]));
  }

  const last = valueSelector(data[data.length - 1]);
  if (ticks[ticks.length - 1] !== last) ticks.push(last);
  return ticks;
}

// ── Icons ──────────────────────────────────────────────────────────────────────

const iconSize = 16;
const IconSunKpi = () => <Sun size={iconSize} className="site-data-panel-icon-solar" />;
const IconBattery = () => <Battery size={iconSize} />;
const IconLoad = () => <Home size={iconSize} />;
const IconGrid = () => <Activity size={iconSize} />;
const IconThermometer = () => <Thermometer size={iconSize} />;

const formatPowerForKpi = (kw: number | null | undefined): { value: string; unit: string } => {
  if (kw == null || Number.isNaN(kw)) return { value: '—', unit: 'kW' };
  const absKw = Math.abs(kw);
  if (absKw < 1) return { value: (kw * 1000).toFixed(0), unit: 'W' };
  return { value: kw.toFixed(2), unit: 'kW' };
};

const formatEnergyForDisplay = (kwh: number | null | undefined): { value: string; unit: string } => {
  if (kwh == null || Number.isNaN(kwh)) return { value: '—', unit: 'kWh' };
  const absKwh = Math.abs(kwh);
  if (absKwh < 1) return { value: (kwh * 1000).toFixed(0), unit: 'Wh' };
  return { value: kwh.toFixed(2), unit: 'kWh' };
};

// ── KPI Card with 3D tilt effect ───────────────────────────────────────────────

interface KpiCardProps {
  label: string; value: string; unit?: string; sub?: string;
  accent: string; icon: React.ReactNode; badge?: React.ReactNode;
  index: number;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, unit, sub, accent, icon, badge, index }) => {
  const { isDark } = useTheme();

  return (
    <motion.div
      custom={index}
      variants={kpiCardVariants as any}
      initial="initial"
      animate="animate"
      whileHover="hover"
      style={{
        padding: '20px',
        flex: 1,
        minWidth: 130,
        borderRadius: 16,
        background: isDark
          ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.8))'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.9))',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.15)'}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        cursor: 'pointer',
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
          {label}
        </span>
        <motion.div
          whileHover={{ rotate: 360, scale: 1.15 }}
          transition={{ duration: 0.6 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${accent}25, ${accent}15)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            flexShrink: 0,
            boxShadow: `0 4px 12px ${accent}30`,
          }}
        >
          {icon}
        </motion.div>
      </div>
      <motion.p
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 + index * 0.05 }}
        style={{
          margin: 0,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '1.75rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
          lineHeight: 1,
          background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {value}
        {unit && <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}
      </motion.p>
      {sub && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + index * 0.05 }}
          style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}
        >
          {sub}
        </motion.p>
      )}
      {badge && <div style={{ marginTop: 8 }}>{badge}</div>}
    </motion.div>
  );
};

// ── Weather Hourly Forecast Strip with scroll animation ────────────────────────

const weatherIconSize = 24;

const WeatherHourlyStrip = ({ hourly }: { hourly: any[] }) => {
  const { isDark } = useTheme();
  if (!hourly || hourly.length === 0) return null;
  
  const getWeatherIcon = (cloud: number, ghi: number, precip: number | null) => {
    if (ghi < 10) return <Moon size={weatherIconSize} />;
    if (precip != null && precip > 60) return <CloudRain size={weatherIconSize} />;
    if (precip != null && precip > 30) return cloud > 40 ? <CloudRain size={weatherIconSize} /> : <CloudSun size={weatherIconSize} />;
    if (cloud > 75) return <Cloud size={weatherIconSize} />;
    if (cloud > 40) return <CloudSun size={weatherIconSize} />;
    return <Sun size={weatherIconSize} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      style={{
        padding: '18px 20px',
        marginBottom: 16,
        borderRadius: 16,
        background: isDark
          ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.75))'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.9))',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.15)'}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      }}
    >
      <p style={{ margin: '0 0 12px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
        <CloudSun size={16} color="#00a63e" />
        24 h Weather Outlook
      </p>
      <div style={{ overflowX: 'auto', paddingTop: 8, paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
          {hourly.map((h, i) => {
            const time = (() => { try { return new Date(h.forecast_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }); } catch { return ''; } })();
            const cloud = h.cloud_cover_pct ?? 0;
            const ghi = h.ghi_wm2 ?? 0;
            const temp = Number(h.temperature_c ?? 0);
            const wind = Number(h.wind_speed_ms ?? 0);
            const humidity = h.humidity_pct != null ? Number(h.humidity_pct) : null;
            const precip = h.precip_prob_pct != null ? Number(h.precip_prob_pct) : null;
            const ghiPct = Math.min(100, (ghi / 900) * 100);
            const humPct = humidity != null ? Math.min(100, humidity) : null;
            const isNow = i === 0;
            const wi = getWeatherIcon(cloud, ghi, precip);
            const ghiColor = ghi > 600 ? '#F07522' : ghi > 200 ? '#f59e0b' : '#d1d5db';
            const humColor = humidity == null ? '#d1d5db'
              : humidity > 80 ? '#3b82f6'
              : humidity > 50 ? '#60a5fa'
              : '#93c5fd';
            const precipColor = precip == null ? '#d1d5db'
              : precip > 60 ? '#1d4ed8'
              : precip > 30 ? '#3b82f6'
              : '#93c5fd';

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 200 }}
                whileHover={{ scale: 1.08, y: -4 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: isNow 
                    ? 'linear-gradient(135deg, rgba(0, 166, 62, 0.15), rgba(0, 166, 62, 0.08))'
                    : isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
                  border: `1px solid ${isNow ? 'rgba(0, 166, 62, 0.4)' : isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  minWidth: 72,
                  gap: 3,
                  position: 'relative',
                  boxShadow: isNow ? '0 4px 12px rgba(0, 166, 62, 0.25)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {isNow && (
                  <motion.span
                    animate={pulseAnimation}
                    style={{
                      position: 'absolute',
                      top: -10,
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      background: '#00a63e',
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontFamily: 'Poppins, sans-serif',
                      boxShadow: '0 2px 8px rgba(0, 166, 62, 0.4)',
                    }}
                  >
                    NOW
                  </motion.span>
                )}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>{time}</span>
                <motion.span
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.6 }}
                  style={{ fontSize: '1.2rem', lineHeight: 1.4 }}
                >
                  {wi}
                </motion.span>
                <span style={{ fontSize: '0.875rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {temp.toFixed(1)}°
                </span>
                {/* GHI mini-bar with animation */}
                <div title={`GHI ${Math.round(ghi)} W/m²`} style={{ width: '100%', height: 4, background: 'rgba(0, 0, 0, 0.08)', borderRadius: 2, overflow: 'hidden', margin: '3px 0' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${ghiPct}%` }}
                    transition={{ delay: i * 0.05 + 0.2, duration: 0.6 }}
                    style={{ height: '100%', background: ghiColor, borderRadius: 2 }}
                  />
                </div>
                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>{Math.round(ghi)} W/m²</span>
                {/* Humidity bar */}
                {humPct != null && (
                  <>
                    <div title={`Humidity ${Math.round(humPct)}%`} style={{ width: '100%', height: 4, background: 'rgba(0, 0, 0, 0.06)', borderRadius: 2, overflow: 'hidden', margin: '3px 0' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${humPct}%` }}
                        transition={{ delay: i * 0.05 + 0.3, duration: 0.6 }}
                        style={{ height: '100%', background: humColor, borderRadius: 2 }}
                      />
                    </div>
                    <span style={{ fontSize: '0.625rem', color: humColor, fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>
                      💧{Math.round(humPct)}%
                    </span>
                  </>
                )}
                {/* Precipitation probability bar */}
                {precip != null && (
                  <>
                    <div title={`Rain ${Math.round(precip)}%`} style={{ width: '100%', height: 4, background: 'rgba(0, 0, 0, 0.06)', borderRadius: 2, overflow: 'hidden', margin: '3px 0' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${precip}%` }}
                        transition={{ delay: i * 0.05 + 0.4, duration: 0.6 }}
                        style={{ height: '100%', background: precipColor, borderRadius: 2 }}
                      />
                    </div>
                    <span style={{ fontSize: '0.625rem', color: precipColor, fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>
                      🌧{Math.round(precip)}%
                    </span>
                  </>
                )}
                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
                  {wind.toFixed(1)} m/s
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

// ── Daily Energy Breakdown with animations ──────────────────────────────────────

const EnergyBreakdownRow = ({ latest, isLatestToday }: { latest: any; isLatestToday: boolean }) => {
  if (!latest) return null;
  if (!isLatestToday) return null;
  
  const items = [
    { label: 'Grid In', value: latest.grid_buy_today_kwh, color: '#3b82f6', bg: '#3b82f615', icon: '⬇' },
    { label: 'Grid Out', value: latest.grid_sell_today_kwh, color: '#10b981', bg: '#10b98115', icon: '⬆' },
    { label: 'Batt Chg', value: latest.batt_charge_today_kwh, color: '#8b5cf6', bg: '#8b5cf615', icon: '↑' },
    { label: 'Batt Dchg', value: latest.batt_discharge_today_kwh, color: '#ec4899', bg: '#ec489915', icon: '↓' },
    { label: 'Consumption', value: latest.load_today_kwh, color: '#6b7280', bg: '#6b728015', icon: '⌂' },
  ].filter(e => e.value != null);
  
  if (!items.length) return null;

  const lastUpdated = latest?.timestamp
    ? new Date(latest.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: IST_TIMEZONE })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}
    >
      {items.map((e, idx) => (
        (() => {
          const energyDisplay = formatEnergyForDisplay(Number(e.value));
          return (
        <motion.span
          key={e.label}
          initial={{ opacity: 0, scale: 0.8, x: -20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: 0.5 + idx * 0.05, type: 'spring', stiffness: 200 }}
          whileHover={{ scale: 1.08, y: -2 }}
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            fontFamily: 'Poppins, sans-serif',
            padding: '6px 12px',
            borderRadius: 20,
            background: e.bg,
            border: `1px solid ${e.color}30`,
            color: e.color,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            boxShadow: `0 2px 8px ${e.color}20`,
          }}
        >
          <span style={{ opacity: 0.85, fontSize: '1rem' }}>{e.icon}</span>
          {e.label}:&nbsp;
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', fontWeight: 700 }}>
              {energyDisplay.value}
            </span>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{energyDisplay.unit}</span>
          </span>
        </motion.span>
          );
        })()
      ))}
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          fontFamily: 'Poppins, sans-serif',
          alignSelf: 'flex-start',
          flexBasis: '100%',
          marginTop: 2,
          whiteSpace: 'nowrap',
        }}
      >
        Today{lastUpdated && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> · {lastUpdated}</span>}
      </span>
    </motion.div>
  );
};

// ── Solar Insights Row with animations ──────────────────────────────────────────

const InsightsRow = ({ latest, isLatestToday }: { latest: any; isLatestToday: boolean }) => {
  if (!latest || !isLatestToday) return null;

  const pvKwh = Number(latest.pv_today_kwh ?? 0);
  const loadKwh = Number(latest.load_today_kwh ?? 0);
  const gridBuy = Number(latest.grid_buy_today_kwh ?? 0);

  if (pvKwh === 0 && loadKwh === 0) return null;

  const co2Kg = pvKwh * 0.82;
  const selfSufPct = loadKwh > 0
    ? Math.max(0, Math.min(100, Math.round(((loadKwh - gridBuy) / loadKwh) * 100)))
    : null;
  const gridDepPct = loadKwh > 0
    ? Math.max(0, Math.min(100, Math.round((gridBuy / loadKwh) * 100)))
    : null;

  const items: { icon: string; label: string; value: string; sub?: string; color: string; bg: string }[] = [];

  if (pvKwh > 0) {
    items.push({
      icon: '🌿',
      label: 'CO₂ Avoided',
      value: co2Kg >= 1 ? `${co2Kg.toFixed(2)} kg` : `${(co2Kg * 1000).toFixed(0)} g`,
      sub: 'vs grid (0.82 kg/kWh)',
      color: '#10b981',
      bg: '#10b98115',
    });
  }
  if (selfSufPct != null) {
    const color = selfSufPct >= 70 ? '#00a63e' : selfSufPct >= 40 ? '#f59e0b' : '#ef4444';
    items.push({
      icon: '⚡',
      label: 'Self-Sufficiency',
      value: `${selfSufPct}%`,
      sub: 'load met by solar+battery',
      color,
      bg: `${color}15`,
    });
  }
  if (gridDepPct != null) {
    const color = gridDepPct <= 20 ? '#10b981' : gridDepPct <= 50 ? '#f59e0b' : '#ef4444';
    items.push({
      icon: '🔌',
      label: 'Grid Dependency',
      value: `${gridDepPct}%`,
      sub: 'portion from grid',
      color,
      bg: `${color}15`,
    });
  }

  if (!items.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}
    >
      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', alignSelf: 'center', minWidth: 50 }}>
        Insights
      </span>
      {items.map((item, idx) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ delay: 0.7 + idx * 0.08, type: 'spring', stiffness: 200 }}
          whileHover={{ scale: 1.05, rotateY: 5, y: -4 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderRadius: 12,
            background: item.bg,
            border: `1px solid ${item.color}30`,
            flexShrink: 0,
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${item.color}20`,
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{item.icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.688rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {item.label}
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: item.color, fontSize: '1rem', lineHeight: 1 }}>
              {item.value}
            </span>
            {item.sub && (
              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
                {item.sub}
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

// ── Energy Flow Diagram ─────────────────────────────────────────────────────────

interface EnergyFlowBlockProps {
  pvKw: number | null;
  loadKw: number | null;
  gridKw: number | null;
  battKw: number | null;
  battSoc: number | null;
}

// ── EnergyFlowBlock — premium 4-corner cross layout ──────────────────────────
// Layout: Solar TL · Load TR · Battery BL · Grid BR · Hub center
// SVG viewBox 300×270 with preserveAspectRatio="none" — diagonal gradient lines
// with animateMotion flow dots indicating real-time power direction.
const EnergyFlowBlock: React.FC<EnergyFlowBlockProps> = ({ pvKw, loadKw, gridKw, battKw, battSoc }) => {
  const { isDark } = useTheme();

  const uidRef = useRef('');
  if (!uidRef.current) uidRef.current = `efb-${Math.random().toString(36).slice(2, 8)}`;
  const uid = uidRef.current;

  // Sign conventions (RS-485 register 625 / Deye Cloud — same in both sources):
  //   gridKw > 0  → exporting to grid (selling)
  //   gridKw < 0  → importing from grid (buying)
  //   battKw > 0  → battery charging
  //   battKw < 0  → battery discharging
  const isExporting   = (gridKw  ?? 0) >  0.01;
  const isImporting   = (gridKw  ?? 0) < -0.01;
  const isCharging    = (battKw  ?? 0) >  0.01;

  const pvValue        = pvKw   ?? 0;
  const loadValue      = loadKw ?? 0;
  const gridValue      = Math.abs(gridKw  ?? 0);
  const battSocValue   = battSoc ?? 0;
  const battPowerValue = Math.abs(battKw  ?? 0);

  const isPvActive    = pvValue        > 0.01;
  const isLoadActive  = loadValue      > 0.01;
  const isGridActive  = gridValue      > 0.01;
  const isBattActive  = battPowerValue > 0.01;
  const isBattPresent = isBattActive || battSocValue > 0;

  const gridColor  = isExporting ? '#5bbd79' : '#3b82f6';
  const labelColor = isDark ? '#64748b' : '#94a3b8';
  const trackColor = isDark ? 'rgba(148,163,184,0.38)' : 'rgba(71,85,105,0.28)';

  const statusText = isPvActive && !isImporting
    ? 'System optimal — solar powering load.'
    : isExporting
    ? 'Exporting surplus energy to grid.'
    : isImporting
    ? 'Drawing power from grid.'
    : 'No active solar generation.';
  const statusOk = isPvActive && !isImporting;

  // ── SVG geometry ─────────────────────────────────────────────────────────────
  // viewBox 300×270, preserveAspectRatio="none"
  // Hub at (150, 135) — geometric center
  // Corner anchors align with center of each node card's icon ring
  //   Node cards: 80px wide, icon ring center ~32px from top, 40px from left
  //   TL card at (0,0): icon center → SVG (40, 32)  → scaled to container coords
  //   TR card at (right:0): icon center → SVG (260, 32)
  //   BL card at (bottom:0, card height ~98px): icon center → SVG (40, 238)
  //   BR card: icon center → SVG (260, 238)
  const hub = { x: 150, y: 135 };
  const C   = { solar: {x:58,y:50}, load: {x:242,y:50}, batt: {x:58,y:220}, grid: {x:242,y:220} };

  // Hub circle radius in SVG units (hub is 58px CSS, container ~270px tall → ~29 SVG units)
  const hubR = 30;
  // Returns the point on the hub circle edge closest to (cx, cy)
  const hubEdge = (cx: number, cy: number) => {
    const dx = cx - hub.x, dy = cy - hub.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    return { x: hub.x + hubR * dx / d, y: hub.y + hubR * dy / d };
  };
  const HE = {
    solar: hubEdge(C.solar.x, C.solar.y),
    load:  hubEdge(C.load.x,  C.load.y),
    batt:  hubEdge(C.batt.x,  C.batt.y),
    grid:  hubEdge(C.grid.x,  C.grid.y),
  };

  // Paths named for animateMotion direction — stop at hub circle edge, not center
  const P = {
    solarToHub: `M ${C.solar.x} ${C.solar.y} L ${HE.solar.x} ${HE.solar.y}`,
    hubToLoad:  `M ${HE.load.x} ${HE.load.y} L ${C.load.x} ${C.load.y}`,
    hubToBatt:  `M ${HE.batt.x} ${HE.batt.y} L ${C.batt.x} ${C.batt.y}`,
    battToHub:  `M ${C.batt.x} ${C.batt.y} L ${HE.batt.x} ${HE.batt.y}`,
    hubToGrid:  `M ${HE.grid.x} ${HE.grid.y} L ${C.grid.x} ${C.grid.y}`,
    gridToHub:  `M ${C.grid.x} ${C.grid.y} L ${HE.grid.x} ${HE.grid.y}`,
  };

  // Track: full bi-directional lines stopping at hub edge
  const trackPaths = [
    `M ${C.solar.x} ${C.solar.y} L ${HE.solar.x} ${HE.solar.y}`,
    `M ${C.load.x}  ${C.load.y}  L ${HE.load.x}  ${HE.load.y}`,
    `M ${C.batt.x}  ${C.batt.y}  L ${HE.batt.x}  ${HE.batt.y}`,
    `M ${C.grid.x}  ${C.grid.y}  L ${HE.grid.x}  ${HE.grid.y}`,
  ];

  // Format kW value → "X W" below 1 kW, "X.XX kW" at 1 kW and above
  const fmtPower = (kw: number): { valueStr: string; unit: string } =>
    kw >= 1 ? { valueStr: kw.toFixed(2), unit: 'kW' } : { valueStr: (kw * 1000).toFixed(0), unit: 'W' };

  // ── Node card renderer ────────────────────────────────────────────────────────
  const NodeCard = ({
    label, icon, valueStr, unit, color, active, subLabel, extra, style,
  }: {
    label: string;
    icon: React.ReactNode;
    valueStr: string;
    unit: string;
    color: string;
    active: boolean;
    subLabel?: string;
    extra?: React.ReactNode;
    style: React.CSSProperties;
  }) => (
    <div
      style={{
        position: 'absolute',
        width: 80,
        padding: '9px 7px 8px',
        borderRadius: 13,
        background: active
          ? (isDark ? 'rgba(22,33,55,0.96)' : '#ffffff')
          : (isDark ? 'rgba(15,23,42,0.75)' : 'rgba(248,250,252,0.88)'),
        border: `1px solid ${active ? color + '4a' : isDark ? 'rgba(100,116,139,0.18)' : 'rgba(148,163,184,0.28)'}`,
        boxShadow: active
          ? `0 0 0 1.5px ${color}18, 0 6px 20px ${color}1a`
          : isDark ? '0 2px 10px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.07)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        zIndex: 2,
        backdropFilter: 'blur(8px)',
        ...style,
      }}
    >
      {/* Icon ring — static, no pulse (only SVG flow dots animate) */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: active
            ? (isDark ? `${color}16` : `${color}0f`)
            : (isDark ? 'rgba(100,116,139,0.09)' : 'rgba(148,163,184,0.1)'),
          border: `1.5px solid ${active ? color + '55' : isDark ? 'rgba(100,116,139,0.22)' : 'rgba(148,163,184,0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      {/* Label */}
      <span style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: active ? color : labelColor,
        fontFamily: 'Inter, sans-serif',
        lineHeight: 1,
      }}>
        {label}
      </span>
      {/* Value */}
      <span style={{
        fontSize: 13,
        fontWeight: 700,
        color: active ? (isDark ? '#f1f5f9' : '#0f172a') : labelColor,
        fontFamily: 'Inter, sans-serif',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'baseline',
        gap: 2,
      }}>
        {valueStr}
        <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.6 }}>{unit}</span>
        {subLabel && active && (
          <span style={{ fontSize: 10, fontWeight: 800, color, marginLeft: 1 }}>{subLabel}</span>
        )}
      </span>
      {extra}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      style={{
        padding: '10px 14px 14px',
        marginBottom: 16,
        borderRadius: 14,
        background: isDark ? '#0f172a' : '#ffffff',
        border: `0.6px solid ${isDark ? 'rgba(148,163,184,0.11)' : '#e2e8f0'}`,
        boxShadow: isDark
          ? '0 4px 24px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.03)'
          : '0 1px 4px rgba(0,0,0,0.07)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={13} color="#5bbd79" />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: labelColor, fontFamily: 'Inter, sans-serif' }}>
            Energy Flow
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}
          />
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#10b981' }}>LIVE</span>
        </div>
      </div>

      {/* ── Diagram ── */}
      <div style={{ position: 'relative', width: '100%', height: 270 }}>

        {/* SVG: gradient flow lines + animated dots */}
        <svg
          viewBox="0 0 300 270"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            {/* Path refs for animateMotion */}
            {Object.entries(P).map(([k, d]) => <path key={k} id={`${k}-${uid}`} d={d} />)}

            {/* Soft glow filter */}
            <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Per-node gradient for active lines */}
            <linearGradient id={`sg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F07522" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#5bbd79" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id={`lg-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id={`bg-${uid}`} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id={`gg-${uid}`} x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={gridColor} stopOpacity="0.95" />
              <stop offset="100%" stopColor={gridColor} stopOpacity="0.45" />
            </linearGradient>
          </defs>

          {/* ── Track lines (always visible, dashed, subtle) ── */}
          {trackPaths.map((d, i) => (
            <path key={i} d={d} stroke={trackColor} strokeWidth={1.5} fill="none"
              strokeLinecap="round" strokeDasharray="4 5" />
          ))}

          {/* ── Coloured lines: full glow when flowing, dim solid when idle ── */}
          {/* Solar */}
          {isPvActive && (
            <path d={P.solarToHub} stroke={`url(#sg-${uid})`} strokeWidth={2.5}
              fill="none" strokeLinecap="round" filter={`url(#glow-${uid})`} />
          )}
          {/* Load */}
          {isLoadActive && (
            <path d={P.hubToLoad} stroke={`url(#lg-${uid})`} strokeWidth={2.5}
              fill="none" strokeLinecap="round" filter={`url(#glow-${uid})`} />
          )}
          {/* Battery — glowing gradient whenever node is present */}
          {isBattPresent && (
            <path
              d={isCharging ? P.hubToBatt : P.battToHub}
              stroke={`url(#bg-${uid})`}
              strokeWidth={2.5} fill="none" strokeLinecap="round"
              filter={`url(#glow-${uid})`}
            />
          )}
          {/* Grid — coloured whenever node is active, glowing when power flows */}
          {isGridActive && (
            <path d={isExporting ? P.hubToGrid : P.gridToHub} stroke={`url(#gg-${uid})`}
              strokeWidth={2.5} fill="none" strokeLinecap="round" filter={`url(#glow-${uid})`} />
          )}

          {/* ── Flow dots — each node mirrors exactly when its line is shown ── */}
          {isPvActive && (
            <circle r={3.5} fill="#5bbd79" opacity={0.92}>
              <animateMotion dur="1.9s" repeatCount="indefinite">
                <mpath href={`#solarToHub-${uid}`} />
              </animateMotion>
            </circle>
          )}
          {isLoadActive && (
            <circle r={3.5} fill="#8b5cf6" opacity={0.92}>
              <animateMotion dur="1.9s" repeatCount="indefinite">
                <mpath href={`#hubToLoad-${uid}`} />
              </animateMotion>
            </circle>
          )}
          {isBattPresent && (
            <circle r={3.5} fill="#f59e0b" opacity={0.92}>
              <animateMotion dur="1.9s" repeatCount="indefinite">
                <mpath href={isCharging ? `#hubToBatt-${uid}` : `#battToHub-${uid}`} />
              </animateMotion>
            </circle>
          )}
          {isGridActive && (
            <circle r={3.5} fill={gridColor} opacity={0.92}>
              <animateMotion dur="1.9s" repeatCount="indefinite">
                <mpath href={isExporting ? `#hubToGrid-${uid}` : `#gridToHub-${uid}`} />
              </animateMotion>
            </circle>
          )}
        </svg>

        {/* ── Node: Solar — top-left ── */}
        <NodeCard
          label="Solar"
          icon={<Sun size={20} color={isPvActive ? '#F07522' : (isDark ? '#475569' : '#cbd5e1')} />}
          {...fmtPower(pvValue)}
          color="#5bbd79"
          active={isPvActive}
          style={{ top: 18, left: 14 }}
        />

        {/* ── Node: Load — top-right ── */}
        <NodeCard
          label="Load"
          icon={<Home size={20} color={isLoadActive ? '#8b5cf6' : (isDark ? '#475569' : '#cbd5e1')} />}
          {...fmtPower(loadValue)}
          color="#8b5cf6"
          active={isLoadActive}
          style={{ top: 18, right: 14 }}
        />

        {/* ── Node: Battery — bottom-left ── */}
        <NodeCard
          label="Battery"
          icon={<Battery size={20} color={isBattPresent ? '#f59e0b' : (isDark ? '#475569' : '#cbd5e1')} />}
          {...fmtPower(battPowerValue)}
          color="#f59e0b"
          active={isBattPresent}
          subLabel={isBattActive ? (isCharging ? '↑' : '↓') : undefined}
          extra={battSocValue > 0 ? (
            <div style={{ width: '100%', padding: '0 2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: labelColor, fontFamily: 'Inter, sans-serif' }}>SOC</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: battSocValue > 60 ? '#10b981' : battSocValue > 20 ? '#f59e0b' : '#ef4444', fontFamily: 'Inter, sans-serif' }}>
                  {battSocValue.toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <motion.div
                  animate={{ width: `${battSocValue}%` }}
                  transition={{ duration: 0.9 }}
                  style={{ height: '100%', borderRadius: 2, background: battSocValue > 60 ? '#10b981' : battSocValue > 20 ? '#f59e0b' : '#ef4444' }}
                />
              </div>
            </div>
          ) : undefined}
          style={{ bottom: 18, left: 14 }}
        />

        {/* ── Node: Grid — bottom-right ── */}
        <NodeCard
          label="Grid"
          icon={<Activity size={20} color={isGridActive ? gridColor : (isDark ? '#475569' : '#cbd5e1')} />}
          {...fmtPower(gridValue)}
          color={gridColor}
          active={isGridActive}
          subLabel={isGridActive ? (isExporting ? '↑' : '↓') : undefined}
          style={{ bottom: 18, right: 14 }}
        />

        {/* ── Center Hub ── */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 3 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: isDark
                ? 'radial-gradient(circle at 38% 38%, rgba(91,189,121,0.2) 0%, rgba(10,17,35,0.97) 70%)'
                : 'radial-gradient(circle at 38% 38%, rgba(91,189,121,0.14) 0%, rgba(248,250,252,0.99) 70%)',
              border: `1.5px solid ${isDark ? 'rgba(91,189,121,0.38)' : 'rgba(91,189,121,0.48)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              boxShadow: isDark
                ? '0 0 24px rgba(91,189,121,0.14), inset 0 1px 0 rgba(255,255,255,0.06)'
                : '0 0 18px rgba(91,189,121,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
            }}
          >
            <Zap size={19} color="#5bbd79" />
            <span style={{ fontSize: 8, fontWeight: 800, color: '#5bbd79', letterSpacing: '0.05em', lineHeight: 1 }}>HUB</span>
          </div>
        </div>
      </div>

      {/* ── Status row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTop: `0.6px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e5e7eb'}` }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
          background: statusOk ? 'rgba(91,189,121,0.14)' : 'rgba(245,158,11,0.12)',
          border: `1px solid ${statusOk ? '#5bbd79' : '#f59e0b'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: statusOk ? '#5bbd79' : '#f59e0b', lineHeight: 1 }}>
            {statusOk ? '✓' : '!'}
          </span>
        </div>
        <span style={{ fontSize: '0.7rem', color: isDark ? '#64748b' : '#6b7280', fontFamily: 'Inter, sans-serif' }}>
          {statusText}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: labelColor, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
};

// ── Forecast Table (keeping existing logic, adding subtle animations) ──────────

const REGIME_STYLE: Record<string, { bg: string; color: string }> = {
  night: { bg: '#1e293b1a', color: '#475569' },
  ramp: { bg: '#f59e0b18', color: '#d97706' },
  midday: { bg: '#F0752218', color: '#c2410c' },
};

const ForecastXAxisTick = ({ x, y, payload, forecastWindow: fw }: any) => {
  const val: string = payload?.value ?? '';
  if (!val) return null;
  const isToday = fw === 'today';
  const line1 = isToday ? val : (val.split('||')[0] ?? val).trim();
  const line2 = isToday ? '' : (val.split('||')[1] ?? '').trim();

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={13} textAnchor="middle" fill="#00a63e" fontSize={10} fontWeight={700} fontFamily="Inter, sans-serif">
        {line1}
      </text>
      {!isToday && line2 && (
        <text x={0} y={0} dy={25} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="Inter, sans-serif">
          {line2}
        </text>
      )}
    </g>
  );
};

const ChartXAxisTick = ({ x, y, payload }: any) => {
  const val: string = (payload?.value ?? '').toString().trim();
  if (!val) return null;
  const parts = val.split('||').map((s: string) => s.trim());
  const line1 = parts[0] ?? val;
  const line2 = parts.length > 1 ? parts[1] : '';

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={13} textAnchor="middle" fill="#00a63e" fontSize={10} fontWeight={700} fontFamily="Inter, sans-serif">
        {line1}
      </text>
      {line2 && (
        <text x={0} y={0} dy={25} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="Inter, sans-serif">
          {line2}
        </text>
      )}
    </g>
  );
};

const ForecastTable = ({ data }: { data: any[] }) => {
  const { isDark } = useTheme();
  const theadBg = isDark ? 'rgba(15, 23, 42, 0.95)' : '#f9fafb';
  const rowBorder = isDark ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid #f3f4f6';
  
  return (
    <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto', borderRadius: 12, border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : '#e5e7eb'}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', minWidth: 520 }}>
        <thead style={{ position: 'sticky', top: 0, background: theadBg, zIndex: 1 }}>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Time</th>
            <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Regime</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#f59e0b', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>P10 ↓</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#00a63e', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>P50</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#3b82f6', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>P90 ↑</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Physics</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#eab308', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>GHI W/m²</th>
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
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.p10?.toFixed(3) ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{row.p50?.toFixed(3) ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.p90?.toFixed(3) ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontStyle: 'italic' }}>{row.physics?.toFixed(3) ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.ghi?.toFixed(0) ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Similar tables for History and VsActual (keeping existing, adding border radius)
const HistoryTable = ({ data }: { data: { time: string; 'PV (kW)': number; 'Load (kW)': number; 'Grid (kW)': number; 'Inv Out (kW)': number; 'Batt SOC (%)': number | null }[] }) => {
  const { isDark } = useTheme();
  const theadBg = isDark ? 'rgba(15, 23, 42, 0.95)' : '#f9fafb';
  const rowBorder = isDark ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid #f3f4f6';
  
  return (
    <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto', borderRadius: 12, border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : '#e5e7eb'}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', minWidth: 520 }}>
        <thead style={{ position: 'sticky', top: 0, background: theadBg, zIndex: 1 }}>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Time</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#F07522', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>PV (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#8b5cf6', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Load (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#3b82f6', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Grid (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#f43f5e', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Inv Out (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#00a63e', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Batt SOC (%)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: rowBorder }}>
              <td style={{ padding: '10px 16px', color: '#00a63e', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{row.time.replace(/\s*\|\|\s*/g, ' ')}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{row['PV (kW)']?.toFixed(2) ?? '—'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{row['Load (kW)']?.toFixed(2) ?? '—'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{row['Grid (kW)']?.toFixed(2) ?? '—'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{row['Inv Out (kW)']?.toFixed(2) ?? '—'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{row['Batt SOC (%)'] != null ? `${row['Batt SOC (%)']}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const VsActualTable = ({ data }: { data: { label: string; p50: number; actual: number | null; diffPct?: number | null }[] }) => {
  const { isDark } = useTheme();
  const theadBg = isDark ? 'rgba(15, 23, 42, 0.95)' : '#f9fafb';
  const rowBorder = isDark ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid #f3f4f6';
  
  return (
    <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto', borderRadius: 12, border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : '#e5e7eb'}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', minWidth: 520 }}>
        <thead style={{ position: 'sticky', top: 0, background: theadBg, zIndex: 1 }}>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Time</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#F07522', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Actual PV (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#00a63e', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>P50 Forecast (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb'}` }}>Δ %</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: rowBorder }}>
              <td style={{ padding: '10px 16px', color: '#00a63e', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{row.label}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{row.actual != null ? row.actual.toFixed(3) : '—'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{row.p50.toFixed(3)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{row.diffPct != null ? `${row.diffPct > 0 ? '+' : ''}${row.diffPct}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  siteId: string;
  autoRefresh?: boolean;
  inverterCapacityKw?: number | null;
}

const SiteDataPanel: React.FC<Props> = ({ siteId, autoRefresh = false, inverterCapacityKw }) => {
  const { isDark } = useTheme();

  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState<number>(0);
  const isInitialLoad = useRef(true);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showBands, setShowBands] = useState<Record<string, boolean>>({ P10: true, P50: true, P90: true, GHI: true });
  const [showHistorySeries, setShowHistorySeries] = useState<Record<HistorySeriesKey, boolean>>({
    PV: true,
    Load: true,
    Grid: true,
    InvOut: false,
    SOC: true,
  });
  const [showVsActualSeries, setShowVsActualSeries] = useState<Record<VsActualSeriesKey, boolean>>({
    Actual: true,
    P50: true,
    Delta: true,
  });
  const [dateRange, setDateRange] = useState('24h');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [debouncedStart, setDebouncedStart] = useState('');
  const [debouncedEnd, setDebouncedEnd] = useState('');
  
  useEffect(() => { const t = setTimeout(() => setDebouncedStart(customStartDate), 600); return () => clearTimeout(t); }, [customStartDate]);
  useEffect(() => { const t = setTimeout(() => setDebouncedEnd(customEndDate), 600); return () => clearTimeout(t); }, [customEndDate]);
  
  const [forecastView, setForecastView] = useState<'chart' | 'table'>('chart');
  const [forecastWindow, setForecastWindow] = useState<'today' | '3d' | '7d'>('7d');
  const [historyView, setHistoryView] = useState<'chart' | 'table'>('chart');
  const [vsActualView, setVsActualView] = useState<'chart' | 'table'>('chart');

  const [refAreaLeft, setRefAreaLeft] = useState('');
  const [refAreaRight, setRefAreaRight] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [zoomStart, setZoomStart] = useState<string | null>(null);
  const [zoomEnd, setZoomEnd] = useState<string | null>(null);

  const [historyRefAreaLeft, setHistoryRefAreaLeft] = useState('');
  const [historyRefAreaRight, setHistoryRefAreaRight] = useState('');
  const [historyIsSelecting, setHistoryIsSelecting] = useState(false);
  const [historyZoomStart, setHistoryZoomStart] = useState<string | null>(null);
  const [historyZoomEnd, setHistoryZoomEnd] = useState<string | null>(null);

  const [vsActualRefAreaLeft, setVsActualRefAreaLeft] = useState('');
  const [vsActualRefAreaRight, setVsActualRefAreaRight] = useState('');
  const [vsActualIsSelecting, setVsActualIsSelecting] = useState(false);
  const [vsActualZoomStart, setVsActualZoomStart] = useState<string | null>(null);
  const [vsActualZoomEnd, setVsActualZoomEnd] = useState<string | null>(null);

  // ── Fetch latest telemetry only (silent, no loading flash) ──────────────────
  const fetchLatestTelemetry = useCallback(async () => {
    try {
      const now = new Date();
      let telemetryParams: any = {};
      if (dateRange === '24h') telemetryParams = { start_date: startOfTodayIST(), end_date: now.toISOString() };
      else if (dateRange === 'custom' && debouncedStart && debouncedEnd) telemetryParams = { start_date: new Date(debouncedStart).toISOString(), end_date: new Date(debouncedEnd).toISOString() };
      else if (dateRange === '7d') telemetryParams = { days: 7 };
      else if (dateRange === '30d') telemetryParams = { days: 30 };

      const tel = await apiService.getSiteTelemetry(siteId, telemetryParams);
      if (Array.isArray(tel) && tel.length > 0) {
        setTelemetry(prev => {
          // Merge: keep existing, append any new readings by timestamp
          const tsSet = new Set(prev.map((r: any) => r.timestamp));
          const newer = tel.filter((r: any) => !tsSet.has(r.timestamp));
          if (newer.length === 0) return prev; // nothing new
          return [...prev, ...newer].sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
        });
        setLastUpdated(new Date());
        setSecondsSinceUpdate(0);
      }
    } catch {
      // silent — don't show error on background poll
    }
  }, [siteId, dateRange, debouncedStart, debouncedEnd]);

  const fetchAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const now = new Date();
      const forecastStart = now.toISOString().split('T')[0] + 'T00:00:00Z';
      const forecastEndDt = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      const forecastEnd = forecastEndDt.toISOString().split('T')[0] + 'T23:59:59Z';

      // For multi-day views, fetch telemetry one day at a time to avoid DynamoDB's
      // 1 MB page size limit silently truncating results.
      const buildDayWindows = (start: Date, end: Date) => {
        const windows: { start_date: string; end_date: string }[] = [];
        const cursor = new Date(start);
        cursor.setUTCHours(0, 0, 0, 0);
        while (cursor < end) {
          const dayStart = cursor.toISOString();
          cursor.setUTCDate(cursor.getUTCDate() + 1);
          windows.push({ start_date: dayStart, end_date: (cursor < end ? new Date(cursor) : end).toISOString() });
        }
        return windows;
      };

      let telemetryRows: any[] = [];
      if (dateRange === '24h') {
        const rows = await apiService.getSiteTelemetry(siteId, { start_date: startOfTodayIST(), end_date: now.toISOString() });
        telemetryRows = Array.isArray(rows) ? rows : [];
      } else {
        let rangeStart: Date;
        let rangeEnd = now;
        if (dateRange === '7d') rangeStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        else if (dateRange === '30d') rangeStart = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        else if (dateRange === 'custom' && debouncedStart && debouncedEnd) {
          rangeStart = new Date(debouncedStart);
          rangeEnd = new Date(debouncedEnd);
        } else {
          rangeStart = new Date(now.getTime() - 24 * 3600 * 1000);
        }
        const windows = buildDayWindows(rangeStart, rangeEnd);
        // Fetch in parallel batches of 3 to balance speed vs backend load
        for (let i = 0; i < windows.length; i += 3) {
          const batch = windows.slice(i, i + 3);
          const results = await Promise.allSettled(
            batch.map(w => apiService.getSiteTelemetry(siteId, { start_date: w.start_date, end_date: w.end_date }))
          );
          for (const r of results) {
            if (r.status === 'fulfilled' && Array.isArray(r.value)) telemetryRows.push(...r.value);
          }
        }
        telemetryRows.sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
      }

      // Critical: forecast + weather fetched in parallel with first telemetry batch
      const [fcst, wth] = await Promise.all([
        apiService.getSiteForecast(siteId, { start_date: forecastStart, end_date: forecastEnd }),
        apiService.getSiteWeather(siteId),
      ] as Promise<any>[]);

      setTelemetry(telemetryRows);
      setForecast(Array.isArray(fcst) ? fcst : []);
      setWeather(wth || null);
      setLastUpdated(new Date());
      setSecondsSinceUpdate(0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load site data');
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, [siteId, dateRange, debouncedStart, debouncedEnd]);

  // History fetch — S3 archive for all multi-day ranges.
  // DynamoDB TTL may be shorter than 7 days, so S3 is the source of truth for anything
  // more than ~2 days old. We fetch the full requested range from S3 day-by-day.
  const fetchHistory = useCallback(async () => {
    const now = new Date();
    let rangeStart: Date | null = null;
    let rangeEnd: Date = now;

    if (dateRange === '7d') {
      rangeStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    } else if (dateRange === '30d') {
      rangeStart = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    } else if (dateRange === 'custom' && debouncedStart && debouncedEnd) {
      rangeStart = new Date(debouncedStart);
      rangeEnd   = new Date(debouncedEnd);
    }
    if (!rangeStart) { setHistoryError(null); return; }

    setHistoryError(null);

    // Build 6-hour windows — 1 day = 4 requests, each covering ~6 S3 hourly folders,
    // which is well within the backend's timeout vs a full 24-folder day request.
    const windows: { start_date: string; end_date: string }[] = [];
    const cursor = new Date(rangeStart);
    cursor.setUTCMinutes(0, 0, 0);
    // snap to nearest 6h boundary
    cursor.setUTCHours(Math.floor(cursor.getUTCHours() / 6) * 6);
    while (cursor < rangeEnd) {
      const windowStart = cursor.toISOString();
      cursor.setUTCHours(cursor.getUTCHours() + 6);
      const windowEnd = (cursor < rangeEnd ? new Date(cursor) : rangeEnd).toISOString();
      windows.push({ start_date: windowStart, end_date: windowEnd });
    }
    const days = windows;

    // Fetch each window sequentially — keeps each request well under the 10s timeout
    for (const params of days) {
      try {
        const hist = await apiService.getSiteHistory(siteId, params);
        if (Array.isArray(hist) && hist.length > 0) {
          setTelemetry(prev => {
            const tsSet = new Set(prev.map((r: any) => r.timestamp));
            const newer = hist.filter((r: any) => !tsSet.has(r.timestamp));
            if (newer.length === 0) return prev;
            return [...prev, ...newer].sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
          });
        }
      } catch (err) {
        // Show the error but keep going — partial history is better than none
        setHistoryError(err instanceof Error ? err.message : 'Failed to load history');
      }
    }
  }, [siteId, dateRange, debouncedStart, debouncedEnd]);

  // Initial load + full refresh every 5 minutes
  useEffect(() => {
    isInitialLoad.current = true;
    setLoading(true);
    fetchAll(false).then(() => fetchHistory());
    if (!autoRefresh) return;
    const fullId = setInterval(() => fetchAll(false).then(() => fetchHistory()), 5 * 60_000);
    return () => clearInterval(fullId);
  }, [fetchAll, fetchHistory, autoRefresh]);

  // Fast telemetry poll every 30 seconds (only when autoRefresh and not initial load)
  useEffect(() => {
    if (!autoRefresh) return;
    const fastId = setInterval(fetchLatestTelemetry, 30_000);
    return () => clearInterval(fastId);
  }, [fetchLatestTelemetry, autoRefresh]);

  // Tick counter: "X seconds ago"
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => {
      setSecondsSinceUpdate(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  useEffect(() => {
    setZoomStart(null);
    setZoomEnd(null);
  }, [forecastWindow]);

  useEffect(() => {
    setHistoryZoomStart(null);
    setHistoryZoomEnd(null);
  }, [dateRange]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const latest = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;

  const pvKw = latest ? (
    (Number(latest.pv1_power_w ?? 0) + Number(latest.pv2_power_w ?? 0) + Number(latest.pv3_power_w ?? 0) + Number(latest.pv4_power_w ?? 0)) / 1000
  ) : null;
  const batSoc = latest?.battery_soc_percent ?? null;
  const loadKw = latest ? (latest.load_power_w ?? 0) / 1000 : null;
  const todayKwh    = latest?.pv_today_kwh    ?? null;
  const totalPvKwh  = latest?.pv_total_kwh    ?? null;
  const gridKw = latest ? (latest.grid_power_w ?? 0) / 1000 : null;
  const batPowerKw = latest ? (latest.battery_power_w ?? 0) / 1000 : null;
  const invTemp = latest?.inverter_temp_c ?? null;
  const batVoltage = latest?.battery_voltage_v ?? null;
  const runState = latest?.run_state;
  const acOutputKw = latest?.ac_output_power_w != null ? latest.ac_output_power_w / 1000 : null;
  const pvPowerDisplay = formatPowerForKpi(pvKw);
  const loadPowerDisplay = formatPowerForKpi(loadKw);
  const gridPowerDisplay = formatPowerForKpi(gridKw != null ? Math.abs(gridKw) : null);
  const acOutputPowerDisplay = formatPowerForKpi(acOutputKw);
  const batteryPowerDisplay = formatPowerForKpi(Math.abs(batPowerKw ?? 0));

  // RS-485 staleness: backend sets data_stale=true when instantaneous power
  // registers are frozen (same value for ≥5 consecutive readings).
  // The Deye WiFi stick (used by the Deye app) reads from the internal COM port
  // and is unaffected — only our RS-485 Modbus path can freeze.
  const rs485Stale = latest?.data_stale === true;
  const isDeyeCloud = latest?.data_source === 'deye_cloud';

  const isLatestToday = latest?.timestamp
    ? istDate(new Date(latest.timestamp)) === istDate(new Date())
    : false;

  // "Live" = last reading arrived within the past 10 minutes
  // Deye Cloud data is ~5 min stale by the time the cron writes it + another 5 min until
  // the next cron run → allow 15 min before hiding the flow block for cloud-sourced records.
  const liveThresholdMs = isDeyeCloud ? 15 * 60 * 1000 : 10 * 60 * 1000;
  const isDataLive = latest?.timestamp
    ? (Date.now() - new Date(latest.timestamp).getTime()) < liveThresholdMs
    : false;

  const gridExporting = gridKw != null && gridKw >  0.01;  // positive = export (sell)
  const gridImporting = gridKw != null && gridKw < -0.01;  // negative = import (buy)
  const batCharging = batPowerKw != null && batPowerKw > 0.01;

  // Per-phase grid data.
  // addr 59 (run_status) is stuck at 0 on our hardware — cannot rely on run_state.
  // Instead: show cards when any phase field is present. Mark phase data as stale
  // when the sum of L1+L2+L3 powers deviates wildly from grid_total (stale holdover).
  // Fall back to grid_power_w / grid_voltage_v for L1 when the per-phase
  // DynamoDB attributes are absent (written by older backend deployments).
  const gridL1PowerW  = latest?.grid_l1_power_w   ?? latest?.grid_power_w   ?? null;
  const gridL2PowerW  = latest?.grid_l2_power_w   ?? null;
  const gridL3PowerW  = latest?.grid_l3_power_w   ?? null;
  const gridL1VoltageV = latest?.grid_l1_voltage_v ?? latest?.grid_voltage_v ?? null;
  const gridL2VoltageV = latest?.grid_l2_voltage_v ?? null;
  const gridL3VoltageV = latest?.grid_l3_voltage_v ?? null;
  const gridL1CurrentA = latest?.grid_l1_current_a ?? null;
  const gridL2CurrentA = latest?.grid_l2_current_a ?? null;
  const gridL3CurrentA = latest?.grid_l3_current_a ?? null;

  const hasPhaseData = gridL1PowerW != null || gridL2PowerW != null || gridL3PowerW != null;
  // Stale detection: if phase sum differs from total by >3×, the registers are holdovers
  const phaseSum = (gridL1PowerW ?? 0) + (gridL2PowerW ?? 0) + (gridL3PowerW ?? 0);
  const gridTotalW = (gridKw ?? 0) * 1000;
  const phaseDataStale = hasPhaseData && Math.abs(gridTotalW) < 50
    ? Math.abs(phaseSum) > 200           // low total: any large phase sum = stale
    : Math.abs(phaseSum - gridTotalW) > Math.abs(gridTotalW) * 3 + 200;

  const gridPhases = hasPhaseData ? [
    { label: 'L1', powerW: gridL1PowerW, voltageV: gridL1VoltageV, currentA: gridL1CurrentA },
    { label: 'L2', powerW: gridL2PowerW, voltageV: gridL2VoltageV, currentA: gridL2CurrentA },
    { label: 'L3', powerW: gridL3PowerW, voltageV: gridL3VoltageV, currentA: gridL3CurrentA },
  ] : null;

  // Per-phase load data (power only — no per-phase load voltage/current polled)
  const loadL1PowerW = latest?.load_l1_power_w ?? null;
  const loadL2PowerW = latest?.load_l2_power_w ?? null;
  const loadL3PowerW = latest?.load_l3_power_w ?? null;
  const hasLoadPhaseData = loadL1PowerW != null || loadL2PowerW != null || loadL3PowerW != null;
  const loadPhases = hasLoadPhaseData ? [
    { label: 'L1', powerW: loadL1PowerW },
    { label: 'L2', powerW: loadL2PowerW },
    { label: 'L3', powerW: loadL3PowerW },
  ] : null;

  // DC transformer temperature (addr 540)
  const dcTemp = latest?.dc_temp_c ?? null;

  const runStateBadge = runState != null ? (
    runState === 0 ? { label: 'Standby', color: '#9ca3af' } :
    runState === 1 ? { label: 'Starting', color: '#60a5fa' } :
    runState === 2 ? { label: 'Normal', color: '#00a63e' } :
    runState === 3 ? { label: 'Fault', color: '#ef4444' } :
    runState === 4 ? { label: 'Fault', color: '#ef4444' } :
      { label: `State ${runState}`, color: '#6b7280' }
  ) : null;

  const invTempColor = invTemp == null ? '#9ca3af'
    : invTemp > 60 ? '#ef4444'
    : invTemp > 45 ? '#f59e0b'
    : '#10b981';

  // ── Chart data ──────────────────────────────────────────────────────────────
  const historyData = useMemo(() => {
    const aggregated = aggregateByPeriod(telemetry, dateRange);
    return aggregated.map(row => {
      const d = new Date(row.timestamp);
      const timeLabel = dateRange === '7d'
        ? `${d.toLocaleDateString([], { weekday: 'short', timeZone: IST })} || ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST })}`
        : fmt(row.timestamp, dateRange);
      return {
        time: timeLabel,
        'PV (kW)': +(((row.pv1_power_w ?? 0) + (row.pv2_power_w ?? 0) + (row.pv3_power_w ?? 0) + (row.pv4_power_w ?? 0)) / 1000).toFixed(2),
        'Load (kW)': +((row.load_power_w ?? 0) / 1000).toFixed(2),
        'Grid (kW)': +((row.grid_power_w ?? 0) / 1000).toFixed(2),
        'Inv Out (kW)': +((row.ac_output_power_w ?? 0) / 1000).toFixed(2),
        'Batt SOC (%)': row.battery_soc_percent ?? null,
      };
    });
  }, [telemetry, dateRange]);

  const zoomedHistoryData = useMemo(() => {
    if (!historyZoomStart || !historyZoomEnd || historyData.length === 0) return historyData;
    const li = historyData.findIndex(d => d.time === historyZoomStart);
    const ri = historyData.findIndex(d => d.time === historyZoomEnd);
    if (li === -1 || ri === -1 || li === ri) return historyData;
    const [s, e] = li < ri ? [li, ri] : [ri, li];
    return historyData.slice(s, e + 1);
  }, [historyData, historyZoomStart, historyZoomEnd]);

  const historyTickValues = useMemo(
    () => buildSparseCategoryTicks(zoomedHistoryData, d => d.time, dateRange === '24h' ? 8 : 7),
    [zoomedHistoryData, dateRange]
  );

  const historyStatsVisible = useMemo(() => {
    const data = zoomedHistoryData;
    if (!data.length) return null;
    const intervalH = dateRange === '24h' ? 0.5 : dateRange === '7d' ? 1 : 24;
    const pvs     = data.map(d => d['PV (kW)'] as number).filter(v => v != null);
    const loads   = data.map(d => d['Load (kW)'] as number).filter(v => v != null);
    const grids   = data.map(d => d['Grid (kW)'] as number).filter(v => v != null);
    const invOuts = data.map(d => d['Inv Out (kW)'] as number).filter(v => v != null);
    const socs    = data.map(d => d['Batt SOC (%)'] as number | null).filter((v): v is number => v != null);
    const pvTotal    = pvs.reduce((s, v) => s + v, 0) * intervalH;
    const pvPeak     = pvs.length ? Math.max(...pvs) : 0;
    const loadTotal  = loads.reduce((s, v) => s + v, 0) * intervalH;
    const loadPeak   = loads.length ? Math.max(...loads) : 0;
    const loadAvg    = loads.length ? loads.reduce((s, v) => s + v, 0) / loads.length : 0;
    const invOutPeak = invOuts.length ? Math.max(...invOuts) : 0;
    const invOutAvg  = invOuts.length ? invOuts.reduce((s, v) => s + v, 0) / invOuts.length : 0;
    const gridExport = grids.filter(v => v > 0).reduce((s, v) => s + v, 0) * intervalH;  // positive = export
    const gridImport = grids.filter(v => v < 0).reduce((s, v) => s + Math.abs(v), 0) * intervalH;  // negative = import
    const socMin = socs.length ? Math.min(...socs) : null;
    const socMax = socs.length ? Math.max(...socs) : null;
    const socAvg = socs.length ? socs.reduce((s, v) => s + v, 0) / socs.length : null;
    return { pvTotal, pvPeak, loadTotal, loadPeak, loadAvg, invOutPeak, invOutAvg, gridImport, gridExport, socMin, socMax, socAvg };
  }, [zoomedHistoryData, dateRange]);

  // ── Prediction vs Actual ────────────────────────────────────────────────────
  const vsActualData = useMemo(() => {
    const todayISTStr = istDate(new Date());
    const todayForecast = forecast.filter(row => {
      const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
      return istDate(new Date(clean)) === todayISTStr && row.p50_kw != null;
    });
    if (!todayForecast.length || !telemetry.length) return [];

    const WINDOW_MS = 15 * 60 * 1000;
    const telTs = telemetry.map(t => ({ ms: new Date(t.timestamp).getTime(), row: t }));
    telTs.sort((a, b) => a.ms - b.ms);
    const tsMsArr = telTs.map(t => t.ms);

    return todayForecast.map(frow => {
      const clean = frow.forecast_for || frow.timestamp.replace('FORECAST#', '');
      const fTs = new Date(clean).getTime();
      const label = new Date(clean).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });

      let lo = 0, hi = tsMsArr.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (tsMsArr[mid] < fTs) lo = mid + 1; else hi = mid; }
      let nearest: any = null;
      let minDiff = Infinity;
      for (const idx of [lo - 1, lo]) {
        if (idx < 0 || idx >= telTs.length) continue;
        const diff = Math.abs(telTs[idx].ms - fTs);
        if (diff < minDiff && diff <= WINDOW_MS) { minDiff = diff; nearest = telTs[idx].row; }
      }

      const actualKw = nearest
        ? +(((nearest.pv1_power_w ?? 0) + (nearest.pv2_power_w ?? 0) + (nearest.pv3_power_w ?? 0) + (nearest.pv4_power_w ?? 0)) / 1000).toFixed(3)
        : null;
      const p50 = +Number(frow.p50_kw).toFixed(3);
      const diffPct = actualKw != null && p50 > 0
        ? Math.round(((actualKw - p50) / p50) * 100)
        : null;

      return { label, fTs, p50, actual: actualKw, diffPct };
    });
  }, [forecast, telemetry]);

  const zoomedVsActualData = useMemo(() => {
    if (!vsActualZoomStart || !vsActualZoomEnd || vsActualData.length === 0) return vsActualData;
    const li = vsActualData.findIndex(d => d.label === vsActualZoomStart);
    const ri = vsActualData.findIndex(d => d.label === vsActualZoomEnd);
    if (li === -1 || ri === -1 || li === ri) return vsActualData;
    const [s, e] = li < ri ? [li, ri] : [ri, li];
    return vsActualData.slice(s, e + 1);
  }, [vsActualData, vsActualZoomStart, vsActualZoomEnd]);

  const vsActualTickValues = useMemo(
    () => buildSparseCategoryTicks(zoomedVsActualData, d => d.label, 8),
    [zoomedVsActualData]
  );

  const { forecastFiltered, forecastData } = useMemo(() => {
    const todayIST = istDate(new Date());
    const filtered = forecast.filter(row => {
      const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
      const forecastIST = istDate(new Date(clean));
      if (forecastWindow === 'today') return forecastIST === todayIST;
      if (forecastWindow === '3d') return forecastIST > istDateOffset(0) && forecastIST <= istDateOffset(3);
      return forecastIST > istDateOffset(0) && forecastIST <= istDateOffset(7);
    });
    const mapped = filtered.map(row => {
      const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
      const d = new Date(clean);
      const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
      const dateLabel = forecastWindow === '3d'
        ? d.toLocaleDateString([], { weekday: 'short', day: 'numeric', timeZone: IST })
        : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: IST });
      const rawDate = istDate(d);
      const rawTs = d.getTime();
      const time = forecastWindow === 'today' ? timeLabel : `${dateLabel}||${timeLabel}`;
      return {
        time, dateLabel, timeLabel, rawDate, rawTs,
        p50: row.p50_kw != null ? +Number(row.p50_kw).toFixed(3) : null,
        p10: row.p10_kw != null ? +Number(row.p10_kw).toFixed(3) : null,
        p90: row.p90_kw != null ? +Number(row.p90_kw).toFixed(3) : null,
        physics: row.physics_baseline_kw != null ? +Number(row.physics_baseline_kw).toFixed(3) : null,
        ghi: row.ghi_input_wm2 != null ? +row.ghi_input_wm2 : null,
        temp: row.temperature_c != null ? +row.temperature_c : null,
        regime: row.regime ?? null,
      };
    });
    return { forecastFiltered: filtered, forecastData: mapped };
  }, [forecast, forecastWindow]);

  const zoomedForecastData = useMemo(() => {
    if (!zoomStart || !zoomEnd) return forecastData;
    const li = forecastData.findIndex(d => d.time === zoomStart);
    const ri = forecastData.findIndex(d => d.time === zoomEnd);
    if (li === -1 || ri === -1 || li === ri) return forecastData;
    const [s, e] = li < ri ? [li, ri] : [ri, li];
    return forecastData.slice(s, e + 1);
  }, [forecastData, zoomStart, zoomEnd]);

  const forecastTickObjects = useMemo(() => {
    if (forecastWindow === 'today') {
      return zoomedForecastData.filter(d => {
        const t = new Date(d.rawTs);
        return t.getUTCMinutes() === 30 && t.getUTCHours() % 2 === 0;
      });
    }
    const dayMap = new Map<string, (typeof zoomedForecastData)[0]>();
    for (const d of zoomedForecastData) {
      if (!dayMap.has(d.rawDate)) dayMap.set(d.rawDate, d);
      const t = new Date(d.rawTs);
      if (t.getUTCHours() === 6 && t.getUTCMinutes() === 30) {
        dayMap.set(d.rawDate, d);
      }
    }
    return Array.from(dayMap.values());
  }, [zoomedForecastData, forecastWindow]);
  
  const forecastTickValues = forecastTickObjects?.map(d => d.time);

  const forecastGeneratedAt = useMemo<Date | null>(() => {
    if (forecast.length === 0) return null;
    let maxGenAt = '';
    for (const row of forecast) {
      if (row.generated_at && row.generated_at > maxGenAt) maxGenAt = row.generated_at;
    }
    if (maxGenAt) return new Date(maxGenAt);
    if (forecast[0].timestamp) {
      return new Date(forecast[0].timestamp.replace('FORECAST#', '').split('T')[0] + 'T00:00:00Z');
    }
    return null;
  }, [forecast]);

  const { fcastP10, fcastP50, fcastP90 } = useMemo(() => {
    let p10 = 0, p50 = 0, p90 = 0;
    if (forecastFiltered.length > 1) {
      for (let i = 0; i < forecastFiltered.length - 1; i++) {
        const h = Math.abs(
          new Date(forecastFiltered[i + 1].timestamp.replace('FORECAST#', '')).getTime() -
          new Date(forecastFiltered[i].timestamp.replace('FORECAST#', '')).getTime()
        ) / 3_600_000;
        if (forecastFiltered[i].p10_kw != null && forecastFiltered[i + 1].p10_kw != null) p10 += (forecastFiltered[i].p10_kw + forecastFiltered[i + 1].p10_kw) / 2 * h;
        if (forecastFiltered[i].p50_kw != null && forecastFiltered[i + 1].p50_kw != null) p50 += (forecastFiltered[i].p50_kw + forecastFiltered[i + 1].p50_kw) / 2 * h;
        if (forecastFiltered[i].p90_kw != null && forecastFiltered[i + 1].p90_kw != null) p90 += (forecastFiltered[i].p90_kw + forecastFiltered[i + 1].p90_kw) / 2 * h;
      }
    }
    return { fcastP10: p10, fcastP50: p50, fcastP90: p90 };
  }, [forecastFiltered]);

  const achievedPct = useMemo(() => {
    const todayISTStr = istDate(new Date());
    if (!latest?.timestamp || istDate(new Date(latest.timestamp)) !== todayISTStr) return null;
    if (todayKwh == null) return null;
    const nowMs = new Date(latest.timestamp).getTime();

    // All today's forecast rows sorted by time
    const todayForecast = forecast
      .filter(row => {
        const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
        return istDate(new Date(clean)) === todayISTStr;
      })
      .map(row => ({
        t: new Date((row.forecast_for || row.timestamp.replace('FORECAST#', ''))).getTime(),
        p50: row.p50_kw as number | null,
      }))
      .sort((a, b) => a.t - b.t);

    if (todayForecast.length < 2) return null;

    // Find the two forecast points that bracket `nowMs`, then interpolate P50 at nowMs
    const beforeNow = todayForecast.filter(r => r.t <= nowMs);
    const afterNow  = todayForecast.filter(r => r.t >  nowMs);

    let points = [...beforeNow];

    // Interpolate a synthetic point at nowMs so the integral ends exactly at now
    if (beforeNow.length > 0 && afterNow.length > 0) {
      const prev = beforeNow[beforeNow.length - 1];
      const next = afterNow[0];
      const frac = (nowMs - prev.t) / (next.t - prev.t);
      const interpP50 = prev.p50 != null && next.p50 != null
        ? prev.p50 + frac * (next.p50 - prev.p50)
        : (prev.p50 ?? next.p50);
      points.push({ t: nowMs, p50: interpP50 });
    }

    if (points.length < 2) return null;

    // Trapezoidal integration up to nowMs
    let fcastP50UpToNow = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const h = (points[i + 1].t - points[i].t) / 3_600_000;
      if (points[i].p50 != null && points[i + 1].p50 != null)
        fcastP50UpToNow += (points[i].p50! + points[i + 1].p50!) / 2 * h;
    }

    console.debug('[achievedPct]', {
      lastReadingAt: latest.timestamp,
      nowMs: new Date(nowMs).toISOString(),
      todayKwh,
      forecastPointsTotal: forecast.length,
      forecastPointsToday: todayForecast.length,
      forecastPointsBeforeNow: beforeNow.length,
      fcastP50UpToNow: +fcastP50UpToNow.toFixed(4),
      result: fcastP50UpToNow > 0 ? Math.min(999, Math.round((todayKwh / fcastP50UpToNow) * 100)) : null,
    });

    return fcastP50UpToNow > 0
      ? Math.min(999, Math.round((todayKwh / fcastP50UpToNow) * 100))
      : null;
  }, [forecast, todayKwh, latest]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 0.6, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              style={{
                flex: 1,
                minWidth: 130,
                height: 120,
                borderRadius: 16,
                background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(249, 250, 251, 0.8)',
              }}
            />
          ))}
        </div>
        {[52, 140, 260, 220].map((h, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
            style={{
              height: h,
              marginBottom: 16,
              borderRadius: 16,
              background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(249, 250, 251, 0.8)',
            }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: 24,
          color: '#ef4444',
          fontSize: '0.875rem',
          background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.06)',
          borderRadius: 16,
          marginTop: 16,
          border: '1px solid rgba(239, 68, 68, 0.3)',
        }}
      >
        Failed to load data for <strong>{siteId}</strong>: {error}
      </motion.div>
    );
  }

  const noData = telemetry.length === 0 && forecast.length === 0 && !weather;

  return (
    <div style={{ marginTop: 24 }}>
      {/* ── Section header with glassmorphism ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 16,
          flexWrap: 'wrap',
          padding: '16px 20px',
          borderRadius: 16,
          background: isDark
            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.7), rgba(30, 41, 59, 0.5))'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(249, 250, 251, 0.8))',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.15)'}`,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif', color: 'var(--text-primary)' }}>
            Live Site Intelligence — <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00a63e' }}>{siteId}</span>
          </p>
          {runStateBadge && (
            <motion.span
              whileHover={{ scale: 1.05 }}
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                background: `${runStateBadge.color}20`,
                color: runStateBadge.color,
                padding: '4px 12px',
                borderRadius: 20,
                fontFamily: 'Poppins, sans-serif',
                border: `1px solid ${runStateBadge.color}40`,
              }}
            >
              ● {runStateBadge.label}
            </motion.span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(activeTab === 'overview' || activeTab === 'history') && (
              <>
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                  style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(0, 166, 62, 0.3)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                  }}
                >
                  <option value="24h">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>
                {dateRange === 'custom' && (
                  <>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      style={{
                        background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(0, 166, 62, 0.3)',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        color: 'var(--text-primary)',
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                      }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      style={{
                        background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(0, 166, 62, 0.3)',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        color: 'var(--text-primary)',
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                      }}
                    />
                  </>
                )}
              </>
            )}
            {activeTab === 'forecast' && (
              <select
                value={forecastWindow}
                onChange={e => setForecastWindow(e.target.value as 'today' | '3d' | '7d')}
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(0, 166, 62, 0.3)',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                }}
              >
                <option value="today">Today</option>
                <option value="3d">Next 3 days</option>
                <option value="7d">Next 7 days</option>
              </select>
            )}
          </div>
          {lastUpdated && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: secondsSinceUpdate < 60 ? '#22c55e' : '#f59e0b',
                boxShadow: secondsSinceUpdate < 60 ? '0 0 6px rgba(34,197,94,0.7)' : 'none',
                animation: secondsSinceUpdate < 60 ? 'pulse 2s ease-in-out infinite' : 'none',
              }} />
              {secondsSinceUpdate < 60
                ? `${secondsSinceUpdate}s ago`
                : secondsSinceUpdate < 3600
                ? `${Math.floor(secondsSinceUpdate / 60)}m ago`
                : lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }) + ' IST'}
            </span>
          )}
          <motion.button
            whileHover={{ scale: 1.05, rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300 }}
            onClick={() => { fetchAll(true); }}
            style={{
              background: 'none',
              border: '1px solid rgba(0, 166, 62, 0.3)',
              borderRadius: 8,
              padding: '4px 12px',
              fontSize: '0.75rem',
              color: '#00a63e',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </motion.button>
        </div>
      </motion.div>

      {noData ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            background: isDark ? 'rgba(0, 166, 62, 0.05)' : 'rgba(0, 166, 62, 0.03)',
            borderRadius: 16,
            border: '1px dashed rgba(0, 166, 62, 0.2)',
          }}
        >
          No data found for site <strong style={{ color: '#00a63e' }}>{siteId}</strong> in the{' '}
          {dateRange === '24h' ? 'today' : dateRange === '7d' ? 'last 7 days' : dateRange === '30d' ? 'last 30 days' : 'selected date range'}
          .<br />
          <span style={{ fontSize: '0.8rem' }}>Data is written by the ML forecast scheduler when the device is actively posting telemetry.</span>
        </motion.div>
      ) : (
        <>
          {/* ── Tab Bar with 3D effect ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              display: 'flex',
              borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.15)'}`,
              marginBottom: 20,
              gap: 0,
              background: isDark ? 'rgba(15, 23, 42, 0.3)' : 'rgba(249, 250, 251, 0.5)',
              borderRadius: '12px 12px 0 0',
              padding: '0 8px',
            }}
          >
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    border: 'none',
                    background: isActive
                      ? isDark
                        ? 'linear-gradient(135deg, rgba(0, 166, 62, 0.15), rgba(0, 166, 62, 0.08))'
                        : 'linear-gradient(135deg, rgba(0, 166, 62, 0.1), rgba(0, 166, 62, 0.05))'
                      : 'transparent',
                    cursor: 'pointer',
                    padding: '12px 20px',
                    fontSize: '0.813rem',
                    fontWeight: isActive ? 700 : 600,
                    fontFamily: 'Poppins, sans-serif',
                    color: isActive ? '#00a63e' : 'var(--text-muted)',
                    borderBottom: `3px solid ${isActive ? '#00a63e' : 'transparent'}`,
                    marginBottom: -2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.3s',
                    letterSpacing: '0.02em',
                    borderRadius: '8px 8px 0 0',
                    boxShadow: isActive ? '0 -2px 10px rgba(0, 166, 62, 0.2)' : 'none',
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </motion.button>
              );
            })}
          </motion.div>

          {/* ── Tab Content with AnimatePresence ── */}
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={{
                  initial: { opacity: 0, x: -20 },
                  animate: { opacity: 1, x: 0 },
                  exit: { opacity: 0, x: 20 }
                }}
                transition={tabTransition}
              >
                {/* ── Deye Cloud Fallback Banner ── */}
                {isDeyeCloud && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 16,
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)',
                      border: '1px solid rgba(59,130,246,0.35)',
                      fontSize: '0.8rem',
                      color: '#3b82f6',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>☁️</span>
                    <div>
                      <strong>Deye Cloud data</strong> — RS-485 link is down; live values are being sourced from the Deye Cloud API (WiFi stick).
                      <span style={{ marginLeft: 8, opacity: 0.75 }}>Check gateway RS-485 connection.</span>
                    </div>
                  </motion.div>
                )}

                {/* ── RS-485 Stale Data Banner ── */}
                {rs485Stale && !isDeyeCloud && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 16,
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      fontSize: '0.8rem',
                      color: '#d97706',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>⚠️</span>
                    <div>
                      <strong>RS-485 frozen</strong> — PV &amp; inverter readings are stale (holdover values).
                      The Deye app shows live data via the WiFi stick which is unaffected.
                      <span style={{ marginLeft: 8, opacity: 0.8 }}>Fix: restart the gateway or write reg 62–65.</span>
                    </div>
                  </motion.div>
                )}

                {/* ── KPI Cards ── */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <KpiCard
                    index={0}
                    label="Solar PV"
                    value={pvPowerDisplay.value}
                    unit={pvPowerDisplay.unit}
                    sub={rs485Stale && !isDeyeCloud
                      ? 'RS-485 frozen — value unreliable'
                      : todayKwh != null && isLatestToday
                        ? `${todayKwh.toFixed(2)} kWh today${totalPvKwh != null ? ` · ${totalPvKwh.toFixed(1)} kWh total` : ''}`
                        : undefined}
                    accent={rs485Stale && !isDeyeCloud ? '#9ca3af' : '#F07522'}
                    icon={<IconSunKpi />}
                    badge={rs485Stale && !isDeyeCloud ? (
                      <span style={{ fontSize: '0.65rem', color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        STALE
                      </span>
                    ) : undefined}
                  />
                  <KpiCard
                    index={1}
                    label="Battery"
                    value={batSoc != null ? batSoc.toFixed(0) : '—'}
                    unit="%"
                    sub={[
                      batPowerKw != null ? `${batCharging ? 'Charging' : 'Discharging'} ${batteryPowerDisplay.value} ${batteryPowerDisplay.unit}` : null,
                      latest?.battery_temp_c != null ? `${Number(latest.battery_temp_c).toFixed(0)}°C` : null,
                    ].filter(Boolean).join(' · ') || undefined}
                    accent="#00a63e"
                    icon={<IconBattery />}
                    badge={
                      batVoltage != null ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {batVoltage.toFixed(1)} V
                        </span>
                      ) : undefined
                    }
                  />
                  <KpiCard
                    index={2}
                    label="Load"
                    value={loadPowerDisplay.value}
                    unit={loadPowerDisplay.unit}
                    accent="#8b5cf6"
                    icon={<IconLoad />}
                  />
                  <KpiCard
                    index={3}
                    label="Grid"
                    value={gridPowerDisplay.value}
                    unit={gridPowerDisplay.unit}
                    sub={
                      gridKw != null
                        ? gridExporting
                          ? 'Exporting to grid'
                          : gridImporting
                          ? 'Importing from grid'
                          : 'No flow'
                        : undefined
                    }
                    accent={gridExporting ? '#10b981' : gridImporting ? '#3b82f6' : '#9ca3af'}
                    icon={<IconGrid />}
                  />
                  <KpiCard
                    index={4}
                    label="Temp"
                    value={invTemp != null ? invTemp.toFixed(1) : '—'}
                    unit="°C"
                    sub={dcTemp != null ? `Heat sink · DC ${dcTemp.toFixed(1)}°C` : 'Heat sink'}
                    accent={invTempColor}
                    icon={<IconThermometer />}
                  />
                  {acOutputKw != null && acOutputKw > 0 && (
                    <KpiCard
                      index={5}
                      label="AC Output"
                      value={acOutputPowerDisplay.value}
                      unit={acOutputPowerDisplay.unit}
                      sub={rs485Stale && !isDeyeCloud ? 'RS-485 frozen — value unreliable' : 'Inverter output'}
                      accent={rs485Stale && !isDeyeCloud ? '#9ca3af' : '#a78bfa'}
                      icon={<Zap size={iconSize} />}
                      badge={rs485Stale && !isDeyeCloud ? (
                        <span style={{ fontSize: '0.65rem', color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                          STALE
                        </span>
                      ) : undefined}
                    />
                  )}
                  {inverterCapacityKw != null && (
                    <KpiCard
                      index={6}
                      label="Inv. Capacity"
                      value={inverterCapacityKw.toFixed(1)}
                      unit="kW"
                      sub="Rated output"
                      accent="#6366f1"
                      icon={<Zap size={iconSize} />}
                    />
                  )}
                  {achievedPct != null && (
                    <KpiCard
                      index={7}
                      label="Forecast"
                      value={achievedPct.toString()}
                      unit="%"
                      sub="Actual vs P50 so far"
                      accent={achievedPct >= 90 ? '#00a63e' : achievedPct >= 70 ? '#f59e0b' : '#ef4444'}
                      icon={<Sun size={iconSize} />}
                    />
                  )}
                </div>

                {/* ── Per-Phase Grid Cards ── */}
                {gridPhases && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Grid Phases (EB)
                      </div>
                      {phaseDataStale && (
                        <span style={{ fontSize: '0.65rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                          stale — inverter standby
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', opacity: phaseDataStale ? 0.45 : 1 }}>
                      {gridPhases.map((ph, i) => {
                        const exporting = !phaseDataStale && ph.powerW != null && ph.powerW <= -1;
                        const importing = !phaseDataStale && ph.powerW != null && ph.powerW >= 1;
                        const accent = phaseDataStale ? '#9ca3af' : exporting ? '#10b981' : importing ? '#3b82f6' : '#9ca3af';
                        const powerLabel = phaseDataStale ? '—'
                          : ph.powerW != null
                            ? `${Math.abs(ph.powerW).toFixed(0)} W ${exporting ? '↑' : importing ? '↓' : ''}`
                            : '—';
                        const subParts: string[] = [];
                        if (!phaseDataStale && ph.voltageV != null) subParts.push(`${ph.voltageV.toFixed(1)} V`);
                        if (!phaseDataStale && ph.currentA != null) subParts.push(`${Math.abs(ph.currentA).toFixed(2)} A`);
                        return (
                          <KpiCard
                            key={ph.label}
                            index={i}
                            label={`Phase ${ph.label}`}
                            value={powerLabel}
                            accent={accent}
                            sub={subParts.join(' · ') || undefined}
                            icon={<IconGrid />}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Per-Phase Load Cards ── */}
                {loadPhases && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Load Phases
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {loadPhases.map((ph, i) => {
                        const hasLoad = ph.powerW != null && ph.powerW > 1;
                        const accent = hasLoad ? '#8b5cf6' : '#9ca3af';
                        const powerLabel = ph.powerW != null ? `${Math.abs(ph.powerW).toFixed(0)} W` : '—';
                        return (
                          <KpiCard
                            key={ph.label}
                            index={i}
                            label={`Phase ${ph.label}`}
                            value={powerLabel}
                            accent={accent}
                            icon={<IconLoad />}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Energy breakdown ── */}
                <EnergyBreakdownRow latest={latest} isLatestToday={isLatestToday} />

                {/* ── Insights ── */}
                <InsightsRow latest={latest} isLatestToday={isLatestToday} />

                {/* ── Live Energy Flow Diagram — only when data is fresh (< 10 min) ── */}
                {isDataLive ? (
                  <EnergyFlowBlock
                    pvKw={pvKw}
                    loadKw={loadKw}
                    gridKw={gridKw}
                    battKw={batPowerKw}
                    battSoc={batSoc}
                  />
                ) : (
                  <div style={{
                    padding: '20px', borderRadius: 12, textAlign: 'center',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                    color: isDark ? '#6b7280' : '#9ca3af', fontSize: '0.85rem',
                  }}>
                    {latest?.timestamp ? (() => {
                      const mins = Math.round((Date.now() - new Date(latest.timestamp).getTime()) / 60000);
                      const ago = mins >= 60
                        ? `${Math.floor(mins / 60)}h ${mins % 60}m ago`
                        : `${mins}m ago`;
                      return `No live data — last reading ${ago}`;
                    })() : 'No data received yet'}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'details' && (
              <motion.div
                key="details"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={{ initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 20 } }}
                transition={tabTransition}
              >
                <DetailsTab
                  telemetry={latest ?? undefined}
                  pvKw={pvKw}
                  loadKw={loadKw}
                  gridKw={gridKw}
                  batPowerKw={batPowerKw}
                  batSoc={batSoc}
                  todayKwh={todayKwh ?? undefined}
                  totalPvKwh={totalPvKwh ?? undefined}
                  invTemp={invTemp ?? undefined}
                  runStateLabel={runStateBadge?.label}
                  isLatestToday={isLatestToday}
                  achievedPct={achievedPct ?? undefined}
                />
              </motion.div>
            )}

            {activeTab === 'weather' && (
              <motion.div
                key="weather"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={{
                  initial: { opacity: 0, x: -20 },
                  animate: { opacity: 1, x: 0 },
                  exit: { opacity: 0, x: 20 }
                }}
                transition={tabTransition}
              >
                {weather?.current ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      marginBottom: 14,
                      background: isDark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.86)',
                      border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.15)'}`,
                    }}
                  >
                    <p style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Current Weather
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {[
                        { label: 'GHI', value: weather.current?.ghi_wm2 != null ? `${Math.round(weather.current.ghi_wm2)} W/m²` : '—' },
                        { label: 'Temp', value: weather.current?.temperature_c != null ? `${Number(weather.current.temperature_c).toFixed(1)}°C` : '—' },
                        { label: 'Humidity', value: weather.current?.humidity_pct != null ? `${Math.round(weather.current.humidity_pct)}%` : '—' },
                        { label: 'Cloud', value: weather.current?.cloud_cover_pct != null ? `${Math.round(weather.current.cloud_cover_pct)}%` : '—' },
                        { label: 'Wind', value: weather.current?.wind_speed_ms != null ? `${Number(weather.current.wind_speed_ms).toFixed(1)} m/s` : '—' },
                      ].map((item) => (
                        <span
                          key={item.label}
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            fontFamily: 'Poppins, sans-serif',
                            color: 'var(--text-secondary)',
                            border: '1px solid rgba(0, 166, 62, 0.2)',
                            borderRadius: 999,
                            padding: '6px 10px',
                            background: isDark ? 'rgba(0, 166, 62, 0.08)' : 'rgba(0, 166, 62, 0.05)',
                          }}
                        >
                          {item.label}: <span style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ) : null}

                {(weather?.hourly_forecast?.length ?? 0) > 0 ? (
                  <WeatherHourlyStrip hourly={weather?.hourly_forecast ?? []} />
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      borderRadius: 16,
                      background: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(249, 250, 251, 0.8)',
                      border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.15)'}`,
                    }}
                  >
                    No hourly weather forecast available.
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={{
                  initial: { opacity: 0, x: -20 },
                  animate: { opacity: 1, x: 0 },
                  exit: { opacity: 0, x: 20 }
                }}
                transition={tabTransition}
              >
                {historyError && (
                  <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif' }}>
                    History unavailable: {historyError}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['chart', 'table'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setHistoryView(mode)}
                        style={{
                          border: '1px solid rgba(0, 166, 62, 0.25)',
                          background: historyView === mode ? 'rgba(0, 166, 62, 0.14)' : 'transparent',
                          color: historyView === mode ? '#00a63e' : 'var(--text-muted)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {HISTORY_SERIES.map(series => (
                      <button
                        key={series.key}
                        onClick={() => setShowHistorySeries(prev => ({ ...prev, [series.key]: !prev[series.key] }))}
                        style={{
                          border: '1px solid rgba(0, 166, 62, 0.25)',
                          background: showHistorySeries[series.key] ? 'rgba(0, 166, 62, 0.14)' : 'transparent',
                          color: showHistorySeries[series.key] ? '#00a63e' : 'var(--text-muted)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        {series.label}
                      </button>
                    ))}
                    {historyZoomStart && historyZoomEnd ? (
                      <button
                        onClick={() => {
                          setHistoryZoomStart(null);
                          setHistoryZoomEnd(null);
                        }}
                        style={{
                          border: '1px solid rgba(0, 166, 62, 0.25)',
                          background: 'transparent',
                          color: '#00a63e',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        Reset Zoom
                      </button>
                    ) : null}
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.85)',
                    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.15)'}`,
                    marginBottom: 14,
                  }}
                >
                  {zoomedHistoryData.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>No history points for selected range.</p>
                  ) : historyView === 'chart' ? (
                    <div style={{ width: '100%', height: 360 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={zoomedHistoryData}
                          margin={{ top: 16, right: 24, left: 0, bottom: 28 }}
                          onMouseDown={(e: any) => {
                            if (!e?.activeLabel) return;
                            setHistoryIsSelecting(true);
                            setHistoryRefAreaLeft(e.activeLabel);
                            setHistoryRefAreaRight(e.activeLabel);
                          }}
                          onMouseMove={(e: any) => {
                            if (historyIsSelecting && e?.activeLabel) setHistoryRefAreaRight(e.activeLabel);
                          }}
                          onMouseUp={() => {
                            if (historyRefAreaLeft && historyRefAreaRight && historyRefAreaLeft !== historyRefAreaRight) {
                              setHistoryZoomStart(historyRefAreaLeft);
                              setHistoryZoomEnd(historyRefAreaRight);
                            }
                            setHistoryIsSelecting(false);
                            setHistoryRefAreaLeft('');
                            setHistoryRefAreaRight('');
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(148,163,184,0.18)' : '#e5e7eb'} />
                          <XAxis
                            dataKey="time"
                            ticks={historyTickValues}
                            tick={<ChartXAxisTick />}
                            interval={0}
                            height={36}
                          />
                          <YAxis yAxisId="power" width={44} tick={{ fill: isDark ? '#cbd5e1' : '#374151', fontSize: 11 }} />
                          <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} width={42} tick={{ fill: isDark ? '#86efac' : '#166534', fontSize: 11 }} />
                          <Tooltip content={<ChartTooltip unitResolver={(entry: any) => entry?.name?.includes('SOC') ? '%' : 'kW'} />} />
                          <Legend wrapperStyle={{ fontSize: '0.72rem', fontFamily: 'Poppins, sans-serif' }} />
                          {showHistorySeries.PV && (
                            <Area yAxisId="power" type="monotone" dataKey="PV (kW)" name="PV" stroke="#F07522" fill="#F07522" fillOpacity={0.18} strokeWidth={2} />
                          )}
                          {showHistorySeries.Load && (
                            <Area yAxisId="power" type="monotone" dataKey="Load (kW)" name="Load" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.12} strokeWidth={2} />
                          )}
                          {showHistorySeries.Grid && (
                            <Line yAxisId="power" type="monotone" dataKey="Grid (kW)" name="Grid" stroke="#3b82f6" strokeWidth={2} dot={false} />
                          )}
                          {showHistorySeries.InvOut && (
                            <Area yAxisId="power" type="monotone" dataKey="Inv Out (kW)" name="Inv Out" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.10} strokeWidth={2} strokeDasharray="4 2" />
                          )}
                          {showHistorySeries.SOC && (
                            <Line yAxisId="soc" type="monotone" dataKey="Batt SOC (%)" name="SOC" stroke="#00a63e" strokeWidth={2} dot={false} />
                          )}
                          {historyRefAreaLeft && historyRefAreaRight && historyRefAreaLeft !== historyRefAreaRight ? (
                            <ReferenceArea x1={historyRefAreaLeft} x2={historyRefAreaRight} strokeOpacity={0.3} fill="rgba(0,166,62,0.12)" />
                          ) : null}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <HistoryTable data={zoomedHistoryData} />
                  )}
                </motion.div>

                {historyStatsVisible && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {[
                      `☀ PV ${historyStatsVisible.pvTotal.toFixed(2)} kWh`,
                      `☀ PV Peak ${historyStatsVisible.pvPeak.toFixed(2)} kW`,
                      `⚡ Inv Peak ${historyStatsVisible.invOutPeak.toFixed(2)} kW`,
                      `⚡ Inv Avg ${historyStatsVisible.invOutAvg.toFixed(2)} kW`,
                      `Load ${historyStatsVisible.loadTotal.toFixed(2)} kWh`,
                      `Load Peak ${historyStatsVisible.loadPeak.toFixed(2)} kW`,
                      `Grid In ${historyStatsVisible.gridImport.toFixed(2)} kWh`,
                      `Grid Out ${historyStatsVisible.gridExport.toFixed(2)} kWh`,
                      historyStatsVisible.socAvg != null ? `SOC Avg ${historyStatsVisible.socAvg.toFixed(0)}%` : null,
                    ].filter(Boolean).map((chip, idx) => (
                      <span
                        key={`${chip}-${idx}`}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          fontFamily: 'Poppins, sans-serif',
                          color: 'var(--text-muted)',
                          border: '1px solid rgba(0, 166, 62, 0.2)',
                          borderRadius: 999,
                          padding: '5px 10px',
                          background: isDark ? 'rgba(0, 166, 62, 0.08)' : 'rgba(0, 166, 62, 0.05)',
                        }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'forecast' && (
              <motion.div
                key="forecast"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={{
                  initial: { opacity: 0, x: -20 },
                  animate: { opacity: 1, x: 0 },
                  exit: { opacity: 0, x: 20 }
                }}
                transition={tabTransition}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['chart', 'table'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setForecastView(mode)}
                        style={{
                          border: '1px solid rgba(0, 166, 62, 0.25)',
                          background: forecastView === mode ? 'rgba(0, 166, 62, 0.14)' : 'transparent',
                          color: forecastView === mode ? '#00a63e' : 'var(--text-muted)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {(['P10', 'P50', 'P90'] as const).map(key => (
                      <button
                        key={key}
                        onClick={() => setShowBands(prev => ({ ...prev, [key]: !prev[key] }))}
                        style={{
                          border: '1px solid rgba(0, 166, 62, 0.25)',
                          background: showBands[key] ? 'rgba(0, 166, 62, 0.14)' : 'transparent',
                          color: showBands[key] ? '#00a63e' : 'var(--text-muted)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        {key}
                      </button>
                    ))}
                    {/* GHI toggle */}
                    <button
                      onClick={() => setShowBands(prev => ({ ...prev, GHI: !prev.GHI }))}
                      style={{
                        border: '1px solid rgba(234, 179, 8, 0.35)',
                        background: showBands.GHI ? 'rgba(234, 179, 8, 0.14)' : 'transparent',
                        color: showBands.GHI ? '#eab308' : 'var(--text-muted)',
                        borderRadius: 8,
                        padding: '6px 10px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'Poppins, sans-serif',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: showBands.GHI ? '#eab308' : 'var(--text-muted)', display: 'inline-block', flexShrink: 0 }} />
                      GHI
                    </button>
                    {zoomStart && zoomEnd ? (
                      <button
                        onClick={() => {
                          setZoomStart(null);
                          setZoomEnd(null);
                        }}
                        style={{
                          border: '1px solid rgba(0, 166, 62, 0.25)',
                          background: 'transparent',
                          color: '#00a63e',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        Reset Zoom
                      </button>
                    ) : null}
                  </div>
                </div>

                {forecastGeneratedAt && (
                  <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'Poppins, sans-serif' }}>
                    Forecast generated {forecastGeneratedAt.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', timeZone: IST })}
                  </p>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.85)',
                    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.15)'}`,
                    marginBottom: 14,
                  }}
                >
                  {zoomedForecastData.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>No forecast points for the selected window.</p>
                  ) : forecastView === 'chart' ? (
                    <div style={{ width: '100%', height: 360 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={zoomedForecastData}
                          margin={{ top: 16, right: 24, left: 0, bottom: 28 }}
                          onMouseDown={(e: any) => {
                            if (!e?.activeLabel) return;
                            setIsSelecting(true);
                            setRefAreaLeft(e.activeLabel);
                            setRefAreaRight(e.activeLabel);
                          }}
                          onMouseMove={(e: any) => {
                            if (isSelecting && e?.activeLabel) setRefAreaRight(e.activeLabel);
                          }}
                          onMouseUp={() => {
                            if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
                              setZoomStart(refAreaLeft);
                              setZoomEnd(refAreaRight);
                            }
                            setIsSelecting(false);
                            setRefAreaLeft('');
                            setRefAreaRight('');
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(148,163,184,0.18)' : '#e5e7eb'} />
                          <XAxis
                            dataKey="time"
                            ticks={forecastTickValues}
                            tick={<ForecastXAxisTick forecastWindow={forecastWindow} />}
                            interval={0}
                            height={36}
                          />
                          <YAxis yAxisId="power" width={44} tick={{ fill: isDark ? '#cbd5e1' : '#374151', fontSize: 11 }} />
                          {showBands.GHI && <YAxis yAxisId="ghi" orientation="right" width={46} tick={{ fill: isDark ? '#fcd34d' : '#92400e', fontSize: 11 }} />}
                          <Tooltip content={<ForecastTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '0.72rem', fontFamily: 'Poppins, sans-serif' }} />
                          {showBands.P10 && <Line yAxisId="power" type="monotone" dataKey="p10" name="P10" stroke="#f59e0b" strokeWidth={1.7} dot={false} />}
                          {showBands.P50 && <Line yAxisId="power" type="monotone" dataKey="p50" name="P50" stroke="#00a63e" strokeWidth={2.4} dot={false} />}
                          {showBands.P90 && <Line yAxisId="power" type="monotone" dataKey="p90" name="P90" stroke="#3b82f6" strokeWidth={1.7} dot={false} />}
                          <Line yAxisId="power" type="monotone" dataKey="physics" name="Physics" stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
                          {showBands.GHI && <Area yAxisId="ghi" type="monotone" dataKey="ghi" name="GHI" stroke="#eab308" fill="#eab308" fillOpacity={0.12} strokeWidth={1.3} />}
                          {refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight ? (
                            <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="rgba(0,166,62,0.12)" />
                          ) : null}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <ForecastTable data={zoomedForecastData} />
                  )}
                </motion.div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    `P10 = ${fcastP10.toFixed(2)} kWh`,
                    `P50 = ${fcastP50.toFixed(2)} kWh`,
                    `P90 = ${fcastP90.toFixed(2)} kWh`,
                    `Points ${zoomedForecastData.length}`,
                  ].map((chip, idx) => (
                    <span
                      key={`${chip}-${idx}`}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        fontFamily: 'Poppins, sans-serif',
                        color: 'var(--text-muted)',
                        border: '1px solid rgba(0, 166, 62, 0.2)',
                        borderRadius: 999,
                        padding: '5px 10px',
                        background: isDark ? 'rgba(0, 166, 62, 0.08)' : 'rgba(0, 166, 62, 0.05)',
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16, marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif', color: 'var(--text-primary)' }}>
                    Forecast vs Actual (Today)
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['chart', 'table'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setVsActualView(mode)}
                        style={{
                          border: '1px solid rgba(0, 166, 62, 0.25)',
                          background: vsActualView === mode ? 'rgba(0, 166, 62, 0.14)' : 'transparent',
                          color: vsActualView === mode ? '#00a63e' : 'var(--text-muted)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                    {VS_ACTUAL_SERIES.map(series => (
                      <button
                        key={series.key}
                        onClick={() => setShowVsActualSeries(prev => ({ ...prev, [series.key]: !prev[series.key] }))}
                        style={{
                          border: '1px solid rgba(0, 166, 62, 0.25)',
                          background: showVsActualSeries[series.key] ? 'rgba(0, 166, 62, 0.14)' : 'transparent',
                          color: showVsActualSeries[series.key] ? '#00a63e' : 'var(--text-muted)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        {series.label}
                      </button>
                    ))}
                    {vsActualZoomStart && vsActualZoomEnd ? (
                      <button
                        onClick={() => {
                          setVsActualZoomStart(null);
                          setVsActualZoomEnd(null);
                        }}
                        style={{
                          border: '1px solid rgba(0, 166, 62, 0.25)',
                          background: 'transparent',
                          color: '#00a63e',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        Reset Zoom
                      </button>
                    ) : null}
                  </div>
                </div>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    marginTop: 4,
                    background: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.8)',
                    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.15)'}`,
                  }}
                >
                  {zoomedVsActualData.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>No overlap points yet between forecast and telemetry for today.</p>
                  ) : vsActualView === 'chart' ? (
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={zoomedVsActualData}
                          margin={{ top: 12, right: 24, left: 0, bottom: 24 }}
                          onMouseDown={(e: any) => {
                            if (!e?.activeLabel) return;
                            setVsActualIsSelecting(true);
                            setVsActualRefAreaLeft(e.activeLabel);
                            setVsActualRefAreaRight(e.activeLabel);
                          }}
                          onMouseMove={(e: any) => {
                            if (vsActualIsSelecting && e?.activeLabel) setVsActualRefAreaRight(e.activeLabel);
                          }}
                          onMouseUp={() => {
                            if (vsActualRefAreaLeft && vsActualRefAreaRight && vsActualRefAreaLeft !== vsActualRefAreaRight) {
                              setVsActualZoomStart(vsActualRefAreaLeft);
                              setVsActualZoomEnd(vsActualRefAreaRight);
                            }
                            setVsActualIsSelecting(false);
                            setVsActualRefAreaLeft('');
                            setVsActualRefAreaRight('');
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(148,163,184,0.18)' : '#e5e7eb'} />
                          <XAxis
                            dataKey="label"
                            ticks={vsActualTickValues}
                            tick={<ChartXAxisTick />}
                            interval={0}
                            height={36}
                          />
                          <YAxis yAxisId="kw" width={44} tick={{ fill: isDark ? '#cbd5e1' : '#374151', fontSize: 11 }} />
                          <YAxis yAxisId="pct" orientation="right" width={40} tickFormatter={(v: number) => `${v}%`} tick={{ fill: isDark ? '#fcd34d' : '#92400e', fontSize: 11 }} />
                          <Tooltip content={<ChartTooltip unitResolver={(entry: any) => entry?.name === 'Δ %' ? '%' : 'kW'} />} />
                          <Legend wrapperStyle={{ fontSize: '0.72rem', fontFamily: 'Poppins, sans-serif' }} />
                          {showVsActualSeries.Actual && (
                            <Line yAxisId="kw" type="monotone" dataKey="actual" name="Actual" stroke="#F07522" strokeWidth={2.2} dot={false} />
                          )}
                          {showVsActualSeries.P50 && (
                            <Line yAxisId="kw" type="monotone" dataKey="p50" name="P50" stroke="#00a63e" strokeWidth={2.2} dot={false} />
                          )}
                          {showVsActualSeries.Delta && (
                            <Line yAxisId="pct" type="monotone" dataKey="diffPct" name="Δ %" stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.7} dot={false} />
                          )}
                          {vsActualRefAreaLeft && vsActualRefAreaRight && vsActualRefAreaLeft !== vsActualRefAreaRight ? (
                            <ReferenceArea x1={vsActualRefAreaLeft} x2={vsActualRefAreaRight} strokeOpacity={0.3} fill="rgba(59,130,246,0.12)" />
                          ) : null}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <VsActualTable data={zoomedVsActualData} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default SiteDataPanel;
