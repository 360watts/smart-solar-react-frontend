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
import { useSpring as useMotionSpring } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip as CJTooltip, Legend as CJLegend, Filler,
  type ChartOptions, type TooltipItem, type ChartArea,
} from 'chart.js';
import { Line as CJLine, Bar as CJBar } from 'react-chartjs-2';
import ZoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, CJTooltip, CJLegend, Filler, ZoomPlugin,
);

// ── Chart.js gradient helper ───────────────────────────────────────────────────
function makeGradient(ctx: CanvasRenderingContext2D, area: ChartArea, color: string, topOpacity = 0.35, bottomOpacity = 0): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, color + Math.round(topOpacity * 255).toString(16).padStart(2, '0'));
  gradient.addColorStop(1, color + Math.round(bottomOpacity * 255).toString(16).padStart(2, '0'));
  return gradient;
}

function createDragZoomPlugins(onZoomComplete: () => void) {
  return {
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
      onZoomComplete,
    },
    pan: { enabled: false, mode: 'x' as const },
  };
}

function useChartZoomState() {
  const chartRef = useRef<any>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const onZoomComplete = useRef(() => setIsZoomed(true));

  const resetZoom = useCallback(() => {
    chartRef.current?.resetZoom();
    setIsZoomed(false);
  }, []);

  return { chartRef, isZoomed, onZoomComplete, resetZoom };
}

const zoomResetButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(0, 166, 62, 0.25)',
  background: 'transparent',
  color: '#00a63e',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: '0.75rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'Poppins, sans-serif',
};

const ZoomResetButton: React.FC<{ visible: boolean; onClick: () => void }> = ({ visible, onClick }) => {
  if (!visible) return null;
  return (
    <button onClick={onClick} style={zoomResetButtonStyle}>
      Reset Zoom
    </button>
  );
};
import { Home, CloudSun, TrendingUp, Sun, Moon, CloudRain, Cloud, Battery, Activity, Thermometer, RefreshCw, Zap, Layers, BarChart2, Target, Satellite, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../services/api';
import { cacheService } from '../../services/cacheService';
import { useTheme } from '../../contexts/ThemeContext';
import { IST_TIMEZONE } from '../../app/constants';
import DetailsTab from '../../features/staff/DetailsTab';
import EnergyFlowBlock from './EnergyFlow';

// ── Tabs ───────────────────────────────────────────────────────────────────────

const tabIconSize = 16;
const TABS = [
  { id: 'overview',  label: 'Overview',  icon: <Home size={tabIconSize} /> },
  { id: 'details',   label: 'Details',   icon: <Activity size={tabIconSize} /> },
  { id: 'weather',   label: 'Weather',   icon: <CloudSun size={tabIconSize} /> },
  { id: 'history',   label: 'History',   icon: <TrendingUp size={tabIconSize} /> },
  { id: 'forecast',  label: 'Solar Forecast',  icon: <Sun size={tabIconSize} /> },
  { id: 'phase-load', label: 'Load Forecast', icon: <Layers size={tabIconSize} /> },
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
                {Number(entry.value).toFixed(2)} {unit}
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
          const decimals = unit === '%' ? 0 : 3;
          const val = entry.value != null ? Number(entry.value).toFixed(decimals) : '—';
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

// ── ChartCard — animated glassmorphic chart container ─────────────────────────

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
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
      style={{
        position: 'relative', padding: '18px 16px', borderRadius: 18, marginBottom: 16,
        background: cardBg,
        backdropFilter: 'blur(24px)',
        border: `1px solid ${borderBase}`,
        boxShadow: isDark
          ? `0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)`
          : `0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.8)`,
        overflow: 'hidden',
      }}
    >
      {/* Subtle radial accent top-right */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at top right, ${accentColor}14, transparent 60%)` }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.92rem',
              color: isDark ? '#f1f5f9' : '#1e293b', letterSpacing: '-0.01em' }}>
              {title}
            </h3>
            {isLive && (
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ display: 'flex', alignItems: 'center', gap: 5,
                  padding: '2px 8px', borderRadius: 999,
                  background: isDark ? 'rgba(0,166,62,0.12)' : 'rgba(0,166,62,0.08)',
                  border: '1px solid rgba(0,166,62,0.3)' }}
              >
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#00a63e',
                    boxShadow: '0 0 6px #00a63e' }}
                />
                <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#00a63e', fontFamily: 'Poppins, sans-serif' }}>
                  Live
                </span>
              </motion.div>
            )}
          </div>
          {subtitle && (
            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', opacity: 0.5,
              fontFamily: 'Poppins, sans-serif', color: isDark ? '#e2e8f0' : '#94a3b8' }}>
              {subtitle}
            </p>
          )}
        </div>
        {headerRight}
      </div>

      {/* Content / Skeleton */}
      {isLoading ? (
        <div style={{ height, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'flex-end' }}>
          {[0.4, 0.7, 0.55, 0.85, 0.6, 0.75].map((w, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
              style={{ height: Math.random() * 20 + 20, borderRadius: 6, alignSelf: 'flex-end',
                width: `${w * 100}%`,
                background: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.1)' }}
            />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scaleY: 0.96 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 0.35, delay: delay + 0.12, ease: 'easeOut' }}
          style={{ height, position: 'relative' }}
        >
          {children}
        </motion.div>
      )}
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

function getTelemetryAggregateForRange(range: string, start?: string, end?: string): '5min' | undefined {
  if (range === '24h') return '5min';
  if (range === 'custom' && start && end) {
    const spanMs = new Date(end).getTime() - new Date(start).getTime();
    if (spanMs > 0 && spanMs <= 24 * 3600 * 1000) return '5min';
  }
  return undefined;
}

function getHistoryResolutionLabel(range: string, start?: string, end?: string): '5 min' | '15 min' {
  return getTelemetryAggregateForRange(range, start, end) === '5min' ? '5 min' : '15 min';
}

function fmt(ts: string, range: string): string {
  try {
    const d = new Date(ts);
    if (range === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
    if (range === '7d')  return d.toLocaleDateString([], { weekday: 'short', timeZone: IST }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: IST });
  } catch { return ts; }
}

function inferBucketHours(rows: any[]): number {
  if (!rows || rows.length < 2) return 0.25; // default to 15-minute buckets
  const gaps: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].timestamp).getTime();
    const curr = new Date(rows[i].timestamp).getTime();
    const diffHours = (curr - prev) / 3600000;
    if (Number.isFinite(diffHours) && diffHours > 0) gaps.push(diffHours);
  }
  if (!gaps.length) return 0.25;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
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
  index: number; noHover?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, unit, sub, accent, icon, badge, index, noHover }) => {
  const { isDark } = useTheme();

  return (
    <motion.div
      custom={index}
      variants={kpiCardVariants as any}
      initial="initial"
      animate="animate"
      whileHover={noHover ? undefined : 'hover'}
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
      <div style={{ overflowX: 'auto', paddingTop: 8, paddingBottom: 4, WebkitOverflowScrolling: 'touch' as const }}>
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
  const gridSell = Number(latest.grid_sell_today_kwh ?? 0);

  if (pvKwh === 0 && loadKwh === 0) return null;

  const co2Kg = pvKwh * 0.82;
  // Net grid = imports minus exports; clamp to 0 if site is a net exporter
  const netGrid = Math.max(0, gridBuy - gridSell);
  const gridDepPct = loadKwh > 0
    ? Math.max(0, Math.min(100, Math.round((netGrid / loadKwh) * 100)))
    : null;
  const selfSufPct = gridDepPct != null ? 100 - gridDepPct : null;

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
      sub: 'load met by solar+battery (net)',
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
      sub: 'net grid import / load',
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

// ── Forecast Table (keeping existing logic, adding subtle animations) ──────────

const REGIME_STYLE: Record<string, { bg: string; color: string }> = {
  night: { bg: '#1e293b1a', color: '#94a3b8' },
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

const VsActualTable = ({ data }: { data: { label: string; p50: number | null; actual: number | null; diffPct?: number | null }[] }) => {
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

// ── Satellite kt charts ────────────────────────────────────────────────────────

const _CAUSE_COLOR: Record<string, string> = {
  non_weather: '#ef4444',
  cloud_shadow: '#f59e0b',
  minor_underperformance: '#3b82f6',
  normal: '#00a63e',
  satellite_mismatch: '#00a63e',  // classified as ok — satellite GHI underestimated (cloud gap)
  no_telemetry: '#94a3b8',
};

const SatelliteKtDailyChart: React.FC<{ satelliteKt: any[]; isDark: boolean }> = ({ satelliteKt, isDark }) => {
  const ktZoom = useChartZoomState();
  const totalNonWeather = satelliteKt.reduce((s: number, d: any) => s + (d.non_weather_count ?? 0), 0);
  const totalCloud      = satelliteKt.reduce((s: number, d: any) => s + (d.cloud_count ?? 0), 0);

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { color: isDark ? '#94a3b8' : '#94a3b8', font: { size: 11 }, boxWidth: 12 } },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: isDark ? '#f1f5f9' : '#111827',
        bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
      },
      zoom: createDragZoomPlugins(() => ktZoom.onZoomComplete.current()),
    },
    scales: {
      x: { stacked: true, ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 9 }, maxRotation: 45 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
      y: { stacked: true, ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 }, stepSize: 1 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const labels = satelliteKt.map((d: any) => d.date.slice(5)); // MM-DD
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
      isDark={isDark}
      height={200}
      accentColor="#ef4444"
      delay={0.5}
      headerRight={<ZoomResetButton visible={ktZoom.isZoomed} onClick={ktZoom.resetZoom} />}
    >
      <div style={{ height: 200 }}>
        <CJBar ref={ktZoom.chartRef} data={data} options={options} />
      </div>
    </ChartCard>
  );
};

const SatelliteKtSlotTimeline: React.FC<{ slots: any[]; isDark: boolean }> = ({ slots, isDark }) => {
  const zoom = useChartZoomState();

  const daytimeSlots = slots.filter((s: any) => s.kt !== null && s.kt !== undefined);
  if (daytimeSlots.length === 0) return null;

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: isDark ? '#f1f5f9' : '#111827',
        bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: {
          title: (items: any[]) => items[0]?.label ?? '',
          label: (item: TooltipItem<'bar'>) => {
            const s = daytimeSlots[item.dataIndex];
            if (!s) return '';
            return [
              ` kt: ${Number(item.parsed.y).toFixed(3)}`,
              ` GHI: ${s.ghi_wm2?.toFixed(0)} W/m²`,
              ` Actual: ${s.actual_kw != null ? s.actual_kw.toFixed(2) : '—'} kW`,
              ` Exp: ${s.expected_kw != null ? s.expected_kw.toFixed(2) : '—'} kW`,
              ` ${s.cause}`,
            ];
          },
        },
      },
      zoom: createDragZoomPlugins(() => zoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 8 }, maxRotation: 60 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
      y: { min: 0, max: 1.4, ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => v.toFixed(2) }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const labels = daytimeSlots.map((s: any) => s.timestamp?.slice(11) ?? '');
  const barData = {
    labels,
    datasets: [{
      label: 'kt',
      data: daytimeSlots.map((s: any) => s.kt),
      backgroundColor: daytimeSlots.map((s: any) => (_CAUSE_COLOR[s.cause] ?? '#94a3b8') + 'CC'),
      borderColor: daytimeSlots.map((s: any) => _CAUSE_COLOR[s.cause] ?? '#94a3b8'),
      borderWidth: 1,
      borderRadius: 3,
    }],
  };

  return (
    <ChartCard
      title="Satellite kt — Most Recent Day (15-min slots)"
      subtitle="kt = actual kW / expected kW · red = non-weather fault · amber = cloud shadow · drag to zoom"
      isDark={isDark}
      height={200}
      accentColor="#ef4444"
      delay={0.6}
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

// ── Enhanced KPI Card with Trend Indicator ────────────────────────────────────

interface EnhancedKPICardProps {
  label: string;
  value: string;
  sub: string;
  accent: string;
  isDark: boolean;
  trend?: { direction: 'up' | 'down' | 'stable'; pct: number };
  status?: 'good' | 'warning' | 'critical';
  index?: number;
}

const EnhancedKPICard: React.FC<EnhancedKPICardProps> = ({ label, value, sub, accent, isDark, trend, status, index = 0 }) => {
  const statusColors: Record<string, string> = {
    good: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
  };
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
      {status && (
        <div style={{ position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: '50%', background: statusColor, boxShadow: `0 0 12px ${statusColor}80` }} />
      )}
      <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5, fontFamily: 'Poppins, sans-serif', color: isDark ? '#e2e8f0' : '#94a3b8', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.6rem',
          background: `linear-gradient(135deg, ${statusColor}, ${statusColor}cc)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          {value}
        </div>
        {trend && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.75rem', fontWeight: 700,
              color: trend.direction === 'down' ? '#10b981' : trend.direction === 'up' ? '#ef4444' : '#94a3b8',
            }}
          >
            {trend.direction === 'down' && '↓'} {trend.direction === 'up' && '↑'} {trend.pct.toFixed(1)}%
          </motion.div>
        )}
      </div>
      <div style={{ fontSize: '0.62rem', opacity: 0.45, fontFamily: 'Poppins, sans-serif', color: isDark ? '#e2e8f0' : '#94a3b8' }}>{sub}</div>
    </motion.div>
  );
};

// ── Circular Performance Gauge ─────────────────────────────────────────────────

const PerformanceGauge: React.FC<{ label: string; value: number; max: number; isDark: boolean; color?: string }> = ({ label, value, max, isDark, color = '#00a63e' }) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative', width: 120, height: 140,
      }}
    >
      <svg width="120" height="100" style={{ transform: 'scaleX(-1)' }}>
        <circle cx="60" cy="45" r="45" fill="none" stroke={isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.08)'} strokeWidth="6" />
        <motion.circle
          cx="60"
          cy="45"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.4rem', color }}>{percentage.toFixed(0)}%</div>
        <div style={{ fontSize: '0.65rem', opacity: 0.5, fontFamily: 'Poppins, sans-serif', color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>{label}</div>
      </div>
    </motion.div>
  );
};

// ── SatelliteKtCalendarPicker ──────────────────────────────────────────────────

const _MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SatelliteKtCalendarPicker: React.FC<{
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

  const fmt = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

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
    borderRadius: 6, color: isDark ? '#64748b' : '#94a3b8', transition: 'all 0.15s',
  };

  return (
    <div style={containerStyle}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button style={navBtnStyle}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00a63e'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#64748b' : '#94a3b8'; }}
          onClick={() => setCurrentMonth(new Date(year, month - 1))}
        >
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827' }}>
          {_MONTH_NAMES[month]} {year}
        </span>
        <button style={navBtnStyle}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00a63e'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#64748b' : '#94a3b8'; }}
          onClick={() => setCurrentMonth(new Date(year, month + 1))}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 2 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ width: 30, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 600, color: isDark ? '#94a3b8' : '#94a3b8', letterSpacing: '0.04em' }}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} style={{ width: 30, height: 30 }} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ds = fmt(year, month, day);
          const avail = availableSet.has(ds);
          const selected = ds === selectedDate;
          return (
            <div key={ds}
              onClick={() => avail && onSelect(ds)}
              style={{
                width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: selected ? 700 : avail ? 500 : 400,
                borderRadius: '50%',
                cursor: avail ? 'pointer' : 'default',
                color: selected ? '#fff' : avail ? '#00a63e' : (isDark ? '#cbd5e1' : '#cbd5e1'),
                background: selected ? '#00a63e' : 'transparent',
                transition: 'all 0.15s',
                userSelect: 'none',
              }}
              onMouseEnter={e => { if (avail && !selected) (e.currentTarget as HTMLElement).style.background = 'rgba(0,166,62,0.15)'; }}
              onMouseLeave={e => { if (avail && !selected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.58rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00a63e', display: 'inline-block' }} /> Has data
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.58rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isDark ? '#cbd5e1' : '#cbd5e1', display: 'inline-block' }} /> No data
        </span>
      </div>
    </div>
  );
};

// ── SatelliteKtTab ─────────────────────────────────────────────────────────────

const _CAUSE_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'non_weather', label: 'Non-weather' },
  { key: 'cloud_shadow', label: 'Cloud shadow' },
  { key: 'minor_underperformance', label: 'Underperformance' },
  { key: 'normal', label: 'Normal' },
  { key: 'no_telemetry', label: 'No telemetry' },
] as const;

// Inner chart: 15-min slots filtered by cause, with cause-colored bars
// no_telemetry slots (kt=null, PV data missing) are shown as grey bars at 0
const SatelliteKtDayDetailChart: React.FC<{ slots: any[]; causeFilter: string; isDark: boolean }> = ({ slots, causeFilter, isDark }) => {
  const zoom = useChartZoomState();
  // Include daytime slots + no_telemetry (has ghi but missing PV data); exclude true night
  const daytimeSlots = slots.filter((s: any) => s.cause !== 'night' && s.alert !== 'night');
  const filtered = causeFilter === 'all' ? daytimeSlots : daytimeSlots.filter((s: any) => s.cause === causeFilter);

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: isDark ? '#f1f5f9' : '#111827',
        bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: {
          title: (items: any[]) => items[0]?.label ?? '',
          label: (item: TooltipItem<'bar'>) => {
            const s = filtered[item.dataIndex];
            if (!s) return '';
            if (s.cause === 'no_telemetry') return [
              ` GHI: ${s.ghi_wm2?.toFixed(0)} W/m²`,
              ` Expected: ${s.expected_kw != null ? s.expected_kw.toFixed(2) : '—'} kW`,
              ` No PV telemetry — device offline or comms gap`,
            ];
            return [
              ` kt: ${s.kt != null ? Number(s.kt).toFixed(3) : '—'}`,
              ` GHI: ${s.ghi_wm2?.toFixed(0)} W/m²`,
              ` Actual: ${s.actual_kw != null ? s.actual_kw.toFixed(2) : '—'} kW`,
              ` Expected: ${s.expected_kw != null ? s.expected_kw.toFixed(2) : '—'} kW`,
              ` ${(s.cause ?? '').replace(/_/g, ' ')}`,
            ];
          },
        },
      },
      zoom: createDragZoomPlugins(() => zoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 8 }, maxRotation: 60 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
      y: { min: 0, max: 1.4, ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => v.toFixed(2) }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark, causeFilter]);

  if (filtered.length === 0) {
    return <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontSize: '0.8rem' }}>No slots match this filter</div>;
  }

  const barData = {
    labels: filtered.map((s: any) => s.timestamp?.slice(11, 16) ?? ''),
    datasets: [{
      label: 'kt',
      // no_telemetry slots show as a small marker at 0.02 so they're visible
      data: filtered.map((s: any) => s.kt != null ? s.kt : (s.cause === 'no_telemetry' ? 0.02 : null)),
      backgroundColor: filtered.map((s: any) => (_CAUSE_COLOR[s.cause] ?? '#94a3b8') + 'CC'),
      borderColor: filtered.map((s: any) => _CAUSE_COLOR[s.cause] ?? '#94a3b8'),
      borderWidth: 1, borderRadius: 3,
    }],
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

const SatelliteKtTab: React.FC<{ accuracy: any; isDark: boolean }> = ({ accuracy, isDark }) => {
  const [detailView, setDetailView] = useState<'day' | 'month'>('day');
  const [analyticsView, setAnalyticsView] = useState<'overview' | 'hourly' | 'scatter' | 'weekday' | 'trend' | 'heatmap'>('overview');
  const [causeFilter, setCauseFilter] = useState<string>('all');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [comparisonDate, setComparisonDate] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Close calendar on outside click
  useEffect(() => {
    if (!calendarOpen) return;
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calendarOpen]);

  const satelliteKt: any[] = accuracy?.satellite_kt ?? [];
  const slotsByDate: Record<string, any[]> = accuracy?.satellite_slots_by_date ?? {};

  // Available dates derived from daily summaries (most recent last)
  const availableDates = satelliteKt.map((d: any) => d.date);
  const latestDate = availableDates[availableDates.length - 1] ?? null;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDate = selectedDate ?? latestDate;
  const slots: any[] = activeDate ? (slotsByDate[activeDate] ?? accuracy?.satellite_slots_recent ?? []) : [];

  // Daytime = any slot that isn't classified as night (includes no_telemetry gaps)
  const daytimeSlots = slots.filter((s: any) => s.cause !== 'night' && s.alert !== 'night');

  // KPI computations
  const normalCount  = daytimeSlots.filter((s: any) => s.cause === 'normal').length;
  const totalDaytime = daytimeSlots.length;
  const healthPct    = totalDaytime > 0 ? (normalCount / totalDaytime) * 100 : null;
  const nonWeatherCount = daytimeSlots.filter((s: any) => s.cause === 'non_weather').length;
  const cloudCount      = daytimeSlots.filter((s: any) => s.cause === 'cloud_shadow').length;
  const underperformanceCount = daytimeSlots.filter((s: any) => s.cause === 'minor_underperformance').length;
  const avgKt = totalDaytime > 0
    ? daytimeSlots.filter((s: any) => s.kt !== null).reduce((sum: number, s: any) => sum + (s.kt ?? 0), 0) / daytimeSlots.filter((s: any) => s.kt !== null).length
    : null;

  // Time-to-first-fault: find first non-weather, cloud, or underperformance event
  const firstFaultSlot = daytimeSlots.find((s: any) =>
    s.cause === 'non_weather' || s.cause === 'cloud_shadow' || s.cause === 'minor_underperformance'
  );
  const timeToFirstFault = firstFaultSlot ? firstFaultSlot.timestamp?.slice(11, 16) : null;

  // 7-day rolling average of health % (from satellite_kt daily summaries)
  const last7Days = satelliteKt.slice(-7);
  const rollingHealthPcts = last7Days.map((day: any) => {
    const totalSlots = (day.non_weather_count || 0) + (day.cloud_count || 0) + (day.normal_count || 0);
    return totalSlots > 0 ? ((day.normal_count || 0) / totalSlots) * 100 : 0;
  });
  const avgHealthPct7d = rollingHealthPcts.length > 0
    ? rollingHealthPcts.reduce((a, b) => a + b, 0) / rollingHealthPcts.length
    : null;

  // Hourly profile: compute mean kt by hour
  const hourlyProfile = useMemo(() => {
    const hourMap: Record<string, { sum: number; count: number }> = {};
    daytimeSlots.forEach((s: any) => {
      const hour = s.timestamp?.slice(11, 13);
      if (hour !== undefined) {
        if (!hourMap[hour]) hourMap[hour] = { sum: 0, count: 0 };
        if (s.kt !== null && s.kt !== undefined) {
          hourMap[hour].sum += s.kt;
          hourMap[hour].count += 1;
        }
      }
    });
    return Object.entries(hourMap)
      .map(([hour, { sum, count }]) => ({ hour: `${hour}:00`, kt: sum / count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [daytimeSlots]);

  // GHI vs kt scatter: all daytime slots with ghi and kt
  const scatterData = daytimeSlots
    .filter((s: any) => s.ghi_wm2 !== null && s.kt !== null && s.kt !== undefined)
    .map((s: any) => ({
      ghi: s.ghi_wm2,
      kt: s.kt,
      cause: s.cause,
    }));

  // Day-of-week profile: compute from last 7 days
  const dayOfWeekData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayStats: Record<string, { sum: number; count: number }> = {};

    last7Days.forEach((day: any, idx: number) => {
      const date = new Date(day.date);
      const dayIndex = (date.getDay() + 6) % 7; // Mon = 0, Sun = 6
      const dayName = days[dayIndex];

      if (!dayStats[dayName]) dayStats[dayName] = { sum: 0, count: 0 };
      const totalSlots = (day.non_weather_count || 0) + (day.cloud_count || 0) + (day.normal_count || 0);
      if (totalSlots > 0) {
        const dayHealth = ((day.normal_count || 0) / totalSlots) * 100;
        dayStats[dayName].sum += dayHealth;
        dayStats[dayName].count += 1;
      }
    });

    return days.map(day => ({
      day,
      avgKt: dayStats[day] ? dayStats[day].sum / dayStats[day].count : 0,
    }));
  }, [last7Days]);

  // Cause frequency heatmap: count by cause across last N days
  const causeHeatmap = useMemo(() => {
    const causes = ['normal', 'non_weather', 'cloud_shadow', 'minor_underperformance'];
    const dates = satelliteKt.slice(-14).map((d: any) => d.date);

    return dates.map((date: any) => {
      const dayCounts = {
        date,
        normal: satelliteKt.find((d: any) => d.date === date)?.normal_count ?? 0,
        non_weather: satelliteKt.find((d: any) => d.date === date)?.non_weather_count ?? 0,
        cloud_shadow: satelliteKt.find((d: any) => d.date === date)?.cloud_count ?? 0,
        minor_underperformance: 0, // not tracked in daily summaries
      };
      return dayCounts;
    });
  }, [satelliteKt]);

  const cardBase: React.CSSProperties = {
    flex: '1 1 140px', borderRadius: 12, padding: '14px 16px',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)'}`,
    background: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(249,250,251,0.9)',
    display: 'flex', flexDirection: 'column', gap: 4,
  };

  const kpiCards = [
    {
      label: 'System Health',
      value: healthPct != null ? `${healthPct.toFixed(1)}%` : '—',
      sub: `${normalCount} / ${totalDaytime} slots normal`,
      color: healthPct != null ? (healthPct >= 80 ? '#00a63e' : healthPct >= 60 ? '#f59e0b' : '#ef4444') : '#94a3b8',
    },
    {
      label: 'Non-Weather Faults',
      value: String(nonWeatherCount),
      sub: 'Red: kt < 0.30, GHI ≥ 300 W/m²',
      color: '#ef4444',
    },
    {
      label: 'Cloud Events',
      value: String(cloudCount),
      sub: 'Amber: kt < 0.30, GHI < 300 W/m²',
      color: '#f59e0b',
    },
    {
      label: 'Avg Daytime kt',
      value: avgKt != null ? avgKt.toFixed(3) : '—',
      sub: 'kt = actual kW / expected kW',
      color: avgKt != null ? (avgKt >= 0.70 ? '#00a63e' : avgKt >= 0.30 ? '#3b82f6' : '#ef4444') : '#94a3b8',
    },
    {
      label: 'Time to 1st Fault',
      value: timeToFirstFault ?? 'None',
      sub: 'First non-weather/cloud event',
      color: timeToFirstFault ? '#f59e0b' : '#00a63e',
    },
    {
      label: '7-Day Health Trend',
      value: avgHealthPct7d != null ? `${avgHealthPct7d.toFixed(1)}%` : '—',
      sub: 'Rolling average of system health',
      color: avgHealthPct7d != null ? (avgHealthPct7d >= 80 ? '#00a63e' : avgHealthPct7d >= 60 ? '#f59e0b' : '#ef4444') : '#94a3b8',
    },
  ];

  // Hourly kt profile chart data
  const hourlyChartRef = useRef<any>(null);
  const hourlyChartData = useMemo(() => ({
    labels: hourlyProfile.map(d => d.hour),
    datasets: [{
      label: 'Mean Hourly kt',
      data: hourlyProfile.map(d => d.kt),
      borderColor: '#00a63e',
      backgroundColor: 'rgba(0, 166, 62, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#00a63e',
      pointBorderColor: isDark ? 'rgba(15,23,42,0.9)' : '#fff',
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    }],
  }), [hourlyProfile, isDark]);

  // Trend line: 7-day rolling average
  const trendData = useMemo(() => ({
    labels: last7Days.map((d: any) => d.date),
    datasets: [
      {
        label: 'Daily Health %',
        data: last7Days.map((day: any) => {
          const total = (day.non_weather_count || 0) + (day.cloud_count || 0) + (day.normal_count || 0);
          return total > 0 ? ((day.normal_count || 0) / total) * 100 : 0;
        }),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: isDark ? 'rgba(15,23,42,0.9)' : '#fff',
        pointRadius: 3,
        borderWidth: 2,
      },
      {
        label: '7-Day Rolling Avg',
        data: rollingHealthPcts,
        borderColor: '#f59e0b',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: isDark ? 'rgba(15,23,42,0.9)' : '#fff',
        pointRadius: 3,
      },
    ],
  }), [last7Days, rollingHealthPcts, isDark]);

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
    background: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(249,250,251,0.9)',
    overflow: 'hidden',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {kpiCards.map((card) => (
          <div key={card.label} style={cardBase}>
            <div style={{ fontSize: '0.65rem', fontFamily: 'Poppins, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{card.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.5rem', color: card.color, lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', opacity: 0.75 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Analytics View Tabs */}
      <div style={detailCardStyle}>
        {/* Tab buttons */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { id: 'overview', label: 'Overview', icon: BarChart2 },
            { id: 'scatter', label: 'GHI vs kt', icon: TrendingUp },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = analyticsView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAnalyticsView(tab.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
                  fontFamily: 'Poppins, sans-serif', cursor: 'pointer', transition: 'all 0.2s',
                  border: `1px solid ${isActive ? '#00a63e' : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.12)')}`,
                  background: isActive ? 'rgba(0,166,62,0.12)' : 'transparent',
                  color: isActive ? '#00a63e' : 'var(--text-muted)',
                  boxShadow: isActive ? '0 0 0 2px rgba(0,166,62,0.1)' : 'none',
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ padding: '16px', minHeight: 200 }}>
          {analyticsView === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {[
                {
                  label: 'System Health',
                  value: `${healthPct !== null ? healthPct.toFixed(1) : '—'}%`,
                  description: `${normalCount} / ${totalDaytime} normal slots`,
                  color: healthPct !== null && healthPct >= 80 ? '#00a63e' : healthPct !== null && healthPct >= 60 ? '#f59e0b' : '#ef4444',
                },
                {
                  label: 'Non-Weather Faults',
                  value: nonWeatherCount,
                  description: 'kt < 0.30, GHI ≥ 300 W/m²',
                  color: '#ef4444',
                },
                {
                  label: 'Cloud Events',
                  value: cloudCount,
                  description: 'kt < 0.30, GHI < 300 W/m²',
                  color: '#f59e0b',
                },
                {
                  label: 'Avg Daytime kt',
                  value: daytimeSlots.filter((s: any) => s.kt !== null).length > 0
                    ? (daytimeSlots.filter((s: any) => s.kt !== null).reduce((sum: number, s: any) => sum + s.kt, 0) / daytimeSlots.filter((s: any) => s.kt !== null).length).toFixed(3)
                    : '—',
                  description: 'Clearness index (0–1)',
                  color: '#3b82f6',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: '20px',
                    borderRadius: 12,
                    border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)'}`,
                    background: isDark
                      ? `linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(15,23,42,0.3) 100%)`
                      : `linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(249,250,251,0.6) 100%)`,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 16px ${item.color}20`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 3px ${item.color}10`;
                  }}
                >
                  {/* Background accent */}
                  <div style={{ position: 'absolute', top: -40, right: -40, width: 100, height: 100, borderRadius: '50%', background: `${item.color}08`, pointerEvents: 'none' }} />

                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: '0.7rem', fontFamily: 'Poppins, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
                      {item.label}
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 900, color: item.color, lineHeight: 1, marginBottom: 8 }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', opacity: 0.65 }}>
                      {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}


          {analyticsView === 'scatter' && scatterData.length > 0 && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Normal', color: '#00a63e', count: scatterData.filter(d => d.cause === 'normal').length },
                  { label: 'Minor Underperf', color: '#3b82f6', count: scatterData.filter(d => d.cause === 'minor_underperformance').length },
                  { label: 'Cloud Shadow', color: '#f59e0b', count: scatterData.filter(d => d.cause === 'cloud_shadow').length },
                  { label: 'Non-Weather', color: '#ef4444', count: scatterData.filter(d => d.cause === 'non_weather').length },
                ].map(item => (
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
                      const ranges = [
                        { label: '0–200 W/m²', min: 0, max: 200 },
                        { label: '200–400 W/m²', min: 200, max: 400 },
                        { label: '400–600 W/m²', min: 400, max: 600 },
                        { label: '600–800 W/m²', min: 600, max: 800 },
                        { label: '800+ W/m²', min: 800, max: Infinity },
                      ];
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

      {/* Detail chart card with day/month toggle */}
      <div style={detailCardStyle}>
        {/* Card header */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.8rem', color: isDark ? '#f1f5f9' : '#111827' }}>
              {detailView === 'day' ? `${activeDate ?? 'Today'} — 15-min Slot Detail` : 'Monthly — Daily Anomaly Counts'}
            </div>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.63rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {detailView === 'day'
                ? 'kt = actual kW / expected kW · EUMETSAT IODC satellite · drag to zoom'
                : `EUMETSAT IODC · last ${satelliteKt.length} days · stacked non-weather + cloud shadow`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Day / Month toggle */}
            <div style={{ display: 'flex', gap: 3, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 3 }}>
              {(['day', 'month'] as const).map(v => (
                <button key={v} onClick={() => setDetailView(v)} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700,
                  fontFamily: 'Poppins, sans-serif', cursor: 'pointer', transition: 'all 0.15s',
                  background: detailView === v ? (isDark ? 'rgba(0,166,62,0.2)' : 'rgba(0,166,62,0.12)') : 'transparent',
                  color: detailView === v ? '#00a63e' : 'var(--text-muted)',
                  border: detailView === v ? '1px solid rgba(0,166,62,0.3)' : '1px solid transparent',
                }}>
                  {v === 'day' ? 'Day' : 'Month'}
                </button>
              ))}
            </div>
            {/* Date selector — calendar popover, only shown in day view */}
            {detailView === 'day' && availableDates.length > 0 && (
              <div ref={calendarRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setCalendarOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 7, fontSize: '0.72rem', fontWeight: 600,
                    fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
                    border: `1px solid ${calendarOpen ? '#00a63e' : (isDark ? 'rgba(0,166,62,0.35)' : 'rgba(0,166,62,0.3)')}`,
                    background: calendarOpen ? 'rgba(0,166,62,0.12)' : (isDark ? 'rgba(15,23,42,0.9)' : '#fff'),
                    color: isDark ? '#d1fae5' : '#065f46',
                    outline: 'none', transition: 'all 0.15s',
                  }}
                >
                  <CalendarDays size={13} />
                  {activeDate ?? 'Select date'}
                </button>
                <AnimatePresence>
                  {calendarOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50 }}
                    >
                      <SatelliteKtCalendarPicker
                        availableDates={availableDates}
                        selectedDate={activeDate}
                        isDark={isDark}
                        onSelect={d => { setSelectedDate(d); setCalendarOpen(false); }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {/* Cause filter — only shown in day view */}
            {detailView === 'day' && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {_CAUSE_FILTER_OPTIONS.map(({ key, label }) => {
                  const activeColor = key === 'all' ? '#00a63e' : (_CAUSE_COLOR[key] ?? '#00a63e');
                  return (
                    <button key={key} onClick={() => setCauseFilter(key)} style={{
                      padding: '4px 9px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 600,
                      fontFamily: 'Poppins, sans-serif', cursor: 'pointer', transition: 'all 0.15s',
                      border: `1px solid ${causeFilter === key ? activeColor : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.12)')}`,
                      background: causeFilter === key ? activeColor + '20' : 'transparent',
                      color: causeFilter === key ? activeColor : 'var(--text-muted)',
                    }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Cause legend — shown in month view */}
            {detailView === 'month' && Object.entries(_CAUSE_COLOR).filter(([k]) => k === 'non_weather' || k === 'cloud_shadow').map(([cause, color]) => (
              <span key={cause} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: color, display: 'inline-block' }} />
                {cause.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Chart area */}
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

// ── ForecastAccuracySubTab (Enhanced) ───────────────────────────────────────────

const ForecastAccuracySubTab: React.FC<{ accuracy: any; isDark: boolean }> = ({ accuracy, isDark }) => {
  const [chartMode, setChartMode] = useState<'mae' | 'error'>('mae');
  const summary = accuracy?.overall ?? accuracy?.summary ?? {};
  const hourly: any[] = accuracy?.hourly ?? [];
  const chartZoom = useChartZoomState();

  const daytimeHourly = hourly.filter((h: any) => { const local = (h.hour_utc + 5) % 24; return local >= 6 && local <= 18; });
  const nighttimeHourly = hourly.filter((h: any) => { const local = (h.hour_utc + 5) % 24; return local < 6 || local > 18; });
  const avgPct = (arr: any[]) => {
    const vals = arr.map((h: any) => h.mean_error_pct).filter((v: any) => v != null);
    return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
  };
  const avgMae = (arr: any[]) => {
    const vals = arr.map((h: any) => h.mae_kw).filter((v: any) => v != null);
    return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
  };
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
    const errorPct = rawPct != null
      ? +Number(rawPct).toFixed(1)
      : (mae != null && overallMaeKw > 0 ? +(mae / overallMaeKw * 100).toFixed(1) : null);
    return { hour: `${String(h.hour_utc).padStart(2, '0')}:00`, mae, barColor, errorPct };
  }), [hourly, maxMae, overallMaeKw]);

  const maeChartOptions = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: isDark ? '#f1f5f9' : '#111827',
        bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: 'rgba(0,166,62,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'bar'>) => ` MAE: ${Number(item.parsed.y).toFixed(2)} kW` },
      },
      zoom: createDragZoomPlugins(() => chartZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 }, maxRotation: 0 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
      y: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => v.toFixed(2) }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
    },
  }), [isDark]);

  const errorPctChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: isDark ? '#f1f5f9' : '#111827',
        bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: 'rgba(59,130,246,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => ` Error: ${Number(item.parsed.y).toFixed(1)}%` },
      },
      zoom: createDragZoomPlugins(() => chartZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 }, maxRotation: 0 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
      y: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => `${v}%` }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
    },
  }), [isDark]);

  const daysComputed = summary.days_computed ?? '—';
  const getMaeStatus = (mae: number) => mae < 0.2 ? 'good' : mae < 0.35 ? 'warning' : 'critical';
  const getCoverageStatus = (cov: number) => cov > 85 ? 'good' : cov > 75 ? 'warning' : 'critical';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontSize: '0.7rem', fontFamily: 'Poppins, sans-serif', fontWeight: 600, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? '#e2e8f0' : '#94a3b8' }}>
          Performance Summary — Last {daysComputed} days
        </div>
      </div>

      {/* Enhanced KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <EnhancedKPICard
          label="MAE" value={maeKw != null ? `${Number(maeKw).toFixed(2)} kW` : '—'} sub="Mean absolute error"
          accent="#00a63e" isDark={isDark} status={getMaeStatus(maeKw)} trend={{ direction: maeKw < 0.2 ? 'down' : 'up', pct: 2.3 }} index={0}
        />
        <EnhancedKPICard
          label="RMSE" value={rmseKw != null ? `${Number(rmseKw).toFixed(2)} kW` : '—'} sub="Root mean sq error"
          accent="#3b82f6" isDark={isDark} status={getMaeStatus(rmseKw)} index={1}
        />
        <EnhancedKPICard
          label="Day Error" value={dayErrorPct != null ? `${Number(dayErrorPct).toFixed(1)}%` : '—'} sub="Avg (06–18 IST)"
          accent="#f59e0b" isDark={isDark} index={2}
        />
        <EnhancedKPICard
          label="Coverage" value={coverage != null ? `${Number(coverage).toFixed(1)}%` : '—'} sub="P10–P90 band"
          accent="#06b6d4" isDark={isDark} status={getCoverageStatus(coverage)} index={3}
        />
        <EnhancedKPICard
          label="Night MAE" value={nightMaeKw != null ? `±${Number(nightMaeKw).toFixed(3)} kW` : '—'} sub="18–06 IST"
          accent="#8b5cf6" isDark={isDark} index={4}
        />
      </div>

      {/* Unified Chart with Mode Toggle */}
      <ChartCard
        title={chartMode === 'mae' ? 'MAE by Hour of Day (UTC)' : 'Error % by Hour of Day'}
        subtitle={chartMode === 'mae' ? 'Color-coded severity · green/amber/red = low/med/high error' : 'Relative forecast error across hours'}
        isDark={isDark}
        height={240}
        accentColor={chartMode === 'mae' ? '#00a63e' : '#3b82f6'}
        delay={0.3}
        headerRight={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: '4px 4px' }}>
              {[
                { mode: 'mae' as const, label: 'MAE', icon: '📊' },
                { mode: 'error' as const, label: 'Error %', icon: '📈' },
              ].map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, fontFamily: 'Poppins, sans-serif',
                    background: chartMode === mode ? (isDark ? 'rgba(0,166,62,0.2)' : 'rgba(0,166,62,0.1)') : 'transparent',
                    color: chartMode === mode ? (isDark ? '#d1fae5' : '#065f46') : (isDark ? '#94a3b8' : '#64748b'),
                    border: chartMode === mode ? `1px solid rgba(0,166,62,0.3)` : '1px solid transparent',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
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
          <motion.div
            key={chartMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{ height: 240 }}
          >
            {chartMode === 'mae' ? (
              <CJBar
                ref={chartZoom.chartRef}
                data={{
                  labels: chartData.map((d: any) => d.hour),
                  datasets: [{
                    label: 'MAE (kW)',
                    data: chartData.map((d: any) => d.mae),
                    backgroundColor: chartData.map((d: any) => d.barColor + 'E0'),
                    borderColor: chartData.map((d: any) => d.barColor),
                    borderWidth: 1,
                    borderRadius: 5,
                  }],
                }}
                options={maeChartOptions}
              />
            ) : (
              <CJLine
                ref={chartZoom.chartRef}
                data={{
                  labels: chartData.map((d: any) => d.hour),
                  datasets: [{
                    label: 'Error %',
                    data: chartData.map((d: any) => d.errorPct),
                    borderColor: '#3b82f6', borderWidth: 2.2, tension: 0.4, pointRadius: 0,
                    fill: true,
                    backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#3b82f620'; return makeGradient(chart.ctx, chart.chartArea, '#3b82f6', 0.40, 0.02); },
                  }],
                }}
                options={errorPctChartOptions}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </ChartCard>
    </motion.div>
  );
};

// ── LoadForecastAccuracySubTab (Enhanced) ──────────────────────────────────────

const LoadForecastAccuracySubTab: React.FC<{ accuracy: any; isDark: boolean }> = ({ accuracy, isDark }) => {
  const [chartMode, setChartMode] = useState<'mae' | 'error'>('mae');
  const summary = accuracy?.overall ?? accuracy?.summary ?? {};
  const hourly: any[] = accuracy?.hourly ?? [];
  const chartZoom = useChartZoomState();

  if (!hourly.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: 40, textAlign: 'center', color: 'var(--text-muted)',
          borderRadius: 16, fontSize: '0.875rem',
          background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(249,250,251,0.8)',
          border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,166,62,0.15)'}`,
        }}
      >
        <BarChart2 size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
        <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, marginBottom: 6 }}>No load accuracy data yet</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Load forecast accuracy data will appear once historical forecasts become verifiable.</div>
      </motion.div>
    );
  }

  const maeKw = summary.mae_kw ?? 0;
  const rmseKw = summary.rmse_kw ?? 0;
  const mapeKw = summary.mape_pct ?? 0;
  const coverage = summary.coverage_pct ?? 0;

  const maxMae = Math.max(...hourly.map((h: any) => h.mae_kw ?? 0), 0.01);
  const chartData = useMemo(() => hourly.map((h: any) => {
    const mae = h.mae_kw != null ? +Number(h.mae_kw).toFixed(3) : null;
    const ratio = mae != null ? mae / maxMae : 0;
    const barColor = ratio < 0.33 ? '#10b981' : ratio < 0.66 ? '#f59e0b' : '#ef4444';
    const errorPct = h.mean_error_pct != null ? +Number(h.mean_error_pct).toFixed(1) : null;
    return { hour: `${String(h.hour_utc).padStart(2, '0')}:00`, mae, barColor, errorPct };
  }), [hourly, maxMae]);

  const maeChartOptions = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: isDark ? '#f1f5f9' : '#111827',
        bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: 'rgba(16,185,129,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'bar'>) => ` MAE: ${Number(item.parsed.y).toFixed(3)} kW` },
      },
      zoom: createDragZoomPlugins(() => chartZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 }, maxRotation: 0 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
      y: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => v.toFixed(3) }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
    },
  }), [isDark]);

  const errorPctChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: isDark ? '#f1f5f9' : '#111827',
        bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: 'rgba(16,185,129,0.2)', borderWidth: 1, padding: 10, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => ` Error: ${Number(item.parsed.y).toFixed(1)}%` },
      },
      zoom: createDragZoomPlugins(() => chartZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 }, maxRotation: 0 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
      y: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => `${v}%` }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
    },
  }), [isDark]);

  const daysComputed = summary.days_computed ?? '—';
  const getMaeStatus = (mae: number) => mae < 0.15 ? 'good' : mae < 0.30 ? 'warning' : 'critical';
  const getCoverageStatus = (cov: number) => cov > 85 ? 'good' : cov > 75 ? 'warning' : 'critical';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontSize: '0.7rem', fontFamily: 'Poppins, sans-serif', fontWeight: 600, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? '#e2e8f0' : '#94a3b8' }}>
          Performance Summary — Last {daysComputed} days
        </div>
      </div>

      {/* Enhanced KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <EnhancedKPICard
          label="MAE" value={maeKw != null ? `${Number(maeKw).toFixed(3)} kW` : '—'} sub="Mean absolute error"
          accent="#10b981" isDark={isDark} status={getMaeStatus(maeKw)} trend={{ direction: maeKw < 0.15 ? 'down' : 'up', pct: 1.8 }} index={0}
        />
        <EnhancedKPICard
          label="RMSE" value={rmseKw != null ? `${Number(rmseKw).toFixed(3)} kW` : '—'} sub="Root mean sq error"
          accent="#3b82f6" isDark={isDark} status={getMaeStatus(rmseKw)} index={1}
        />
        <EnhancedKPICard
          label="MAPE" value={mapeKw != null ? `${Number(mapeKw).toFixed(1)}%` : '—'} sub="Mean absolute % error"
          accent="#f59e0b" isDark={isDark} index={2}
        />
        <EnhancedKPICard
          label="Coverage" value={coverage != null ? `${Number(coverage).toFixed(1)}%` : '—'} sub="P10–P90 band"
          accent="#06b6d4" isDark={isDark} status={getCoverageStatus(coverage)} index={3}
        />
      </div>

      {/* Unified Chart with Mode Toggle */}
      <ChartCard
        title={chartMode === 'mae' ? 'Load MAE by Hour of Day' : 'Error % by Hour of Day'}
        subtitle={chartMode === 'mae' ? 'Mean absolute error (kW) · green/amber/red = low/med/high error' : 'Relative load forecast error across hours'}
        isDark={isDark}
        height={240}
        accentColor="#10b981"
        delay={0.3}
        headerRight={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: '4px 4px' }}>
              {[
                { mode: 'mae' as const, label: 'MAE', icon: '📊' },
                { mode: 'error' as const, label: 'Error %', icon: '📈' },
              ].map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, fontFamily: 'Poppins, sans-serif',
                    background: chartMode === mode ? (isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.1)') : 'transparent',
                    color: chartMode === mode ? (isDark ? '#a7f3d0' : '#065f46') : (isDark ? '#94a3b8' : '#64748b'),
                    border: chartMode === mode ? `1px solid rgba(16,185,129,0.3)` : '1px solid transparent',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
            {[['#10b981', 'Low'], ['#f59e0b', 'Med'], ['#ef4444', 'High']].map(([c, l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c as string, display: 'inline-block' }} />{l}
              </span>
            ))}
            <ZoomResetButton visible={chartZoom.isZoomed} onClick={chartZoom.resetZoom} />
          </div>
        }
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={chartMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{ height: 240 }}
          >
            {chartMode === 'mae' ? (
              <CJBar
                ref={chartZoom.chartRef}
                data={{
                  labels: chartData.map((d: any) => d.hour),
                  datasets: [{
                    label: 'MAE (kW)',
                    data: chartData.map((d: any) => d.mae),
                    backgroundColor: chartData.map((d: any) => d.barColor + 'E0'),
                    borderColor: chartData.map((d: any) => d.barColor),
                    borderWidth: 1,
                    borderRadius: 5,
                  }],
                }}
                options={maeChartOptions}
              />
            ) : (
              <CJLine
                ref={chartZoom.chartRef}
                data={{
                  labels: chartData.map((d: any) => d.hour),
                  datasets: [{
                    label: 'Error %',
                    data: chartData.map((d: any) => d.errorPct),
                    borderColor: '#10b981', borderWidth: 2.2, tension: 0.4, pointRadius: 0,
                    fill: true,
                    backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#10b98120'; return makeGradient(chart.ctx, chart.chartArea, '#10b981', 0.40, 0.02); },
                  }],
                }}
                options={errorPctChartOptions}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </ChartCard>
    </motion.div>
  );
};

// ── WeatherAccuracySubTab ──────────────────────────────────────────────────────

const WeatherAccuracySubTab: React.FC<{ accuracy: any; isDark: boolean }> = ({ accuracy, isDark }) => {
  const records: any[] = accuracy?.records ?? [];
  const summary = accuracy?.summary ?? {};
  const maeZoom = useChartZoomState();
  const errorPctZoom = useChartZoomState();
  const ghiErrorZoom = useChartZoomState();
  const tempErrorZoom = useChartZoomState();

  if (!records.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: 40, textAlign: 'center', color: 'var(--text-muted)',
          borderRadius: 16, fontSize: '0.875rem',
          background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(249,250,251,0.8)',
          border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,166,62,0.15)'}`,
        }}
      >
        <BarChart2 size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
        <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, marginBottom: 6 }}>No weather accuracy data yet</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Needs overlapping weather forecast and observation records for past hours. Data appears as recent forecasts become verifiable.</div>
      </motion.div>
    );
  }

  const chartData = useMemo(() => records.slice(-48).map((d: any) => ({
    time: new Date(d.timestamp).toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
    ghiErr: d.ghi_error_wm2 != null ? +Math.abs(Number(d.ghi_error_wm2)).toFixed(1) : null,
    tempErr: d.temp_error_c != null ? +Math.abs(Number(d.temp_error_c)).toFixed(2) : null,
    cloudErr: d.cloud_error_pct != null ? +Math.abs(Number(d.cloud_error_pct)).toFixed(1) : null,
  })), [records]);

  const ghiChartOptions = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
        titleColor: isDark ? '#f1f5f9' : '#111827',
        bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: 'rgba(234,179,8,0.2)', borderWidth: 1, padding: 10, cornerRadius: 8,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'bar'>) => ` ${Number(item.parsed.y).toFixed(1)} W/m²` },
      },
      zoom: createDragZoomPlugins(() => ghiErrorZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: isDark ? '#cbd5e1' : '#374151', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: isDark ? 'rgba(148,163,184,0.12)' : '#e5e7eb' } },
      y: { ticks: { color: isDark ? '#cbd5e1' : '#374151', font: { size: 11 } }, grid: { color: isDark ? 'rgba(148,163,184,0.12)' : '#e5e7eb' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const panelBg: React.CSSProperties = {
    padding: 20, borderRadius: 20,
    background: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.97)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
    boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.06)',
  };

  const tempChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
        titleColor: isDark ? '#f1f5f9' : '#111827',
        bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 10, cornerRadius: 8,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => ` ${Number(item.parsed.y).toFixed(2)}°C` },
      },
      zoom: createDragZoomPlugins(() => tempErrorZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: isDark ? '#cbd5e1' : '#374151', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: isDark ? 'rgba(148,163,184,0.12)' : '#e5e7eb' } },
      y: { ticks: { color: isDark ? '#cbd5e1' : '#374151', font: { size: 11 }, callback: (v: any) => `${v}°` }, grid: { color: isDark ? 'rgba(148,163,184,0.12)' : '#e5e7eb' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  if (!accuracy || !accuracy.records?.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ ...panelBg, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}
      >
        <Target size={36} style={{ marginBottom: 12, opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
        <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>No accuracy data yet</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.65, maxWidth: 340, margin: '0 auto' }}>Accuracy scores are computed nightly. Data will appear tomorrow after the first overnight run.</div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Summary chips */}
      {(summary.ghi_mae_wm2 != null || summary.temp_mae_c != null) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { label: 'GHI MAE', value: summary.ghi_mae_wm2 != null ? `${Number(summary.ghi_mae_wm2).toFixed(1)} W/m²` : '—', color: '#eab308' },
            { label: 'Temp MAE', value: summary.temp_mae_c != null ? `${Number(summary.temp_mae_c).toFixed(2)}°C` : '—', color: '#ef4444' },
            { label: 'Cloud MAE', value: summary.cloud_mae_pct != null ? `${Number(summary.cloud_mae_pct).toFixed(1)}%` : '—', color: '#3b82f6' },
            { label: 'Hours', value: summary.hours_compared ?? '—', color: '#8b5cf6' },
          ].map(c => (
            <div key={c.label} style={{ padding: '10px 14px', borderRadius: 12, background: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.95)', border: `1px solid ${c.color}30` }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.1rem', color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <ChartCard
        title="GHI Error — Forecast vs Observed"
        subtitle="Solar irradiance forecast accuracy (W/m²) · drag to zoom"
        isDark={isDark}
        height={200}
        accentColor="#eab308"
        delay={0.2}
        headerRight={<ZoomResetButton visible={ghiErrorZoom.isZoomed} onClick={ghiErrorZoom.resetZoom} />}
      >
        <div style={{ width: '100%', height: 200 }}>
          <CJBar
            ref={ghiErrorZoom.chartRef}
            data={{
              labels: chartData.map((d: any) => d.time),
              datasets: [{
                label: 'GHI error',
                data: chartData.map((d: any) => d.ghiErr),
                backgroundColor: '#eab30899',
                borderColor: '#eab308',
                borderWidth: 1,
                borderRadius: 4,
              }],
            }}
            options={ghiChartOptions}
          />
        </div>
      </ChartCard>

      <ChartCard
        title="Temperature Error — Forecast vs Observed"
        subtitle="Absolute temperature error (°C) · drag to zoom"
        isDark={isDark}
        height={180}
        accentColor="#ef4444"
        delay={0.3}
        headerRight={<ZoomResetButton visible={tempErrorZoom.isZoomed} onClick={tempErrorZoom.resetZoom} />}
      >
        <div style={{ width: '100%', height: 180 }}>
          <CJLine
            ref={tempErrorZoom.chartRef}
            data={{
              labels: chartData.map((d: any) => d.time),
              datasets: [{
                label: 'Temp error',
                data: chartData.map((d: any) => d.tempErr),
                borderColor: '#ef4444', borderWidth: 2, tension: 0.4, pointRadius: 0,
                fill: true,
                backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#ef444420'; return makeGradient(chart.ctx, chart.chartArea, '#ef4444', 0.20, 0.01); },
              }],
            }}
            options={tempChartOptions}
          />
        </div>
      </ChartCard>
    </motion.div>
  );
};

// ── PhaseLoadTab ───────────────────────────────────────────────────────────────

const PHASE_COLORS = { L1: '#3b82f6', L2: '#f59e0b', L3: '#8b5cf6' };

// Animated spring counter card for each phase — from Magic MCP design
interface PhaseKpiCardProps {
  phase: 'L1' | 'L2' | 'L3';
  watts: number | null;
  volts: number | null;
  amps: number | null;
  color: string;
  isDark: boolean;
  index: number;
  estimated?: boolean;
}

const PhaseKpiCard: React.FC<PhaseKpiCardProps> = ({ phase, watts, volts, amps, color, isDark, index, estimated }) => {
  const [dW, setDW] = useState(0);
  const [dV, setDV] = useState(0);
  const [dA, setDA] = useState(0);

  useEffect(() => {
    const tw = setTimeout(() => setDW(watts ?? 0), 100 * index);
    const tv = setTimeout(() => setDV(volts ?? 0), 150 * index);
    const ta = setTimeout(() => setDA(Math.abs(amps ?? 0)), 200 * index);
    return () => { clearTimeout(tw); clearTimeout(tv); clearTimeout(ta); };
  }, [watts, volts, amps, index]);


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.1 }}
      whileHover={{ y: -6, boxShadow: `0 20px 40px ${color}30` }}
      style={{
        position: 'relative', overflow: 'hidden', flex: 1, minWidth: 150,
        borderRadius: 20, padding: '22px 20px',
        background: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${color}25`,
        boxShadow: isDark
          ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${color}20`
          : `0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px ${color}15`,
      }}
    >
      {/* Radial glow background */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.12,
        background: `radial-gradient(circle at top right, ${color}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>
            Phase {phase}
          </span>
          {estimated && (
            <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 6, background: isDark ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.12)', color: '#d97706' }}>est.</span>
          )}
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: `0 0 14px ${color}` }} />
        </div>

        {/* Watts — large counter (dW state drives display; spring is decorative only) */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.55, fontFamily: 'Poppins, sans-serif', color: isDark ? '#e2e8f0' : '#94a3b8', marginBottom: 3 }}>
            Power
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '2rem',
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {watts != null ? `${Math.round(Math.abs(dW))} W` : '—'}
          </div>
        </div>

        {/* Volts + Amps */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.55, fontFamily: 'Poppins, sans-serif', color: isDark ? '#e2e8f0' : '#94a3b8', marginBottom: 2 }}>Voltage</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: '1rem', color: isDark ? '#e2e8f0' : '#334155' }}>
              {volts != null ? `${dV.toFixed(1)} V` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.55, fontFamily: 'Poppins, sans-serif', color: isDark ? '#e2e8f0' : '#94a3b8', marginBottom: 2 }}>Current</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: '1rem', color: isDark ? '#e2e8f0' : '#334155' }}>
              {amps != null ? `${dA.toFixed(2)} A` : '—'}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const PhaseLoadTab: React.FC<{
  phaseLoad: any[];
  loadForecast: any[];
  latest: any;
  isDark: boolean;
  hours: number;
  onHoursChange: (h: number) => void;
  forecastAccuracy?: any;
  onRefreshVsActual?: () => void;
}> = ({ phaseLoad, loadForecast, latest, isDark, hours, onHoursChange, forecastAccuracy, onRefreshVsActual }) => {
  // Allow switching between forecast chart and accuracy view
  const [phaseForecastSubTab, setPhaseForecastSubTab] = useState<'chart' | 'accuracy'>('chart');
  const [showTotalLoad, setShowTotalLoad] = useState(false);
  const phaseLoadChartZoom = useChartZoomState();
  const loadForecastChartZoom = useChartZoomState();
  const vsActualLoadChartZoom = useChartZoomState();
  const [showVsActual, setShowVsActual] = useState(false);
  const [vsActual7d, setVsActual7d] = useState(false);
  const vsActualFetchedRef = useRef(false);

  // Force-refresh vs-actual data (bypass cache) the first time the chart is shown
  useEffect(() => {
    if (showVsActual && !vsActualFetchedRef.current) {
      vsActualFetchedRef.current = true;
      onRefreshVsActual?.();
    }
  }, [showVsActual, onRefreshVsActual]);
  const { chartData, chartData15 } = useMemo(() => {
    if (!phaseLoad.length) return { chartData: [], chartData15: [] };

    const make = (bucketMinutes: number) => {
      const bucketMs = bucketMinutes * 60 * 1000;
      const map = new Map<string, { ts: Date; l1: number; l2: number; l3: number; n: number }>();
      for (const row of phaseLoad) {
        const baseTs = new Date(row.hour || row.timestamp);
        if (Number.isNaN(baseTs.getTime())) continue;
        const snapped = Math.floor(baseTs.getTime() / bucketMs) * bucketMs;
        const key = new Date(snapped).toISOString();
        if (!map.has(key)) map.set(key, { ts: new Date(snapped), l1: 0, l2: 0, l3: 0, n: 0 });
        const b = map.get(key)!;
        b.l1 += Number(row.load_l1_kw ?? 0);
        b.l2 += Number(row.load_l2_kw ?? 0);
        b.l3 += Number(row.load_l3_kw ?? 0);
        b.n += 1;
      }
      return Array.from(map.values())
        .sort((a, b) => a.ts.getTime() - b.ts.getTime())
        .map(b => ({
          time: b.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }),
          L1: +Number(b.l1 / (b.n || 1)).toFixed(2),
          L2: +Number(b.l2 / (b.n || 1)).toFixed(2),
          L3: +Number(b.l3 / (b.n || 1)).toFixed(2),
        }));
    };

    return { chartData: make(5), chartData15: make(15) };
  }, [phaseLoad]);

  const loadForecastChartData = useMemo(() => {
    return loadForecast.map((r: any) => {
      const d = new Date(r.forecast_for);
      return {
        time: d.toLocaleDateString([], { weekday: 'short', day: 'numeric', timeZone: IST }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }),
        load: r.predicted_kw != null ? +Number(r.predicted_kw).toFixed(2) : null,
        p10: r.p10_kw != null ? +Number(r.p10_kw).toFixed(2) : null,
        p90: r.p90_kw != null ? +Number(r.p90_kw).toFixed(2) : null,
      };
    });
  }, [loadForecast]);

  const vsActualChartData = useMemo(() => {
    const ts: any[] = forecastAccuracy?.timeseries ?? [];
    const rows = ts
      .filter((r: any) => r.actual_kw != null && !!r.ts)
      .map((r: any) => ({ ...r, __ms: new Date(r.ts).getTime() }))
      .filter((r: any) => !Number.isNaN(r.__ms))
      .sort((a: any, b: any) => a.__ms - b.__ms);

    if (rows.length === 0) return [];

    const cutoffMs = vsActual7d
      ? Date.now() - 7 * 24 * 60 * 60 * 1000
      : (() => { const s = new Date().toLocaleDateString('en-CA', { timeZone: IST }); return new Date(s + 'T00:00:00+05:30').getTime(); })();

    return rows
      .filter((r: any) => r.__ms >= cutoffMs)
      .map((r: any) => {
        const d = new Date(r.ts);
        return {
          time: vsActual7d
            ? d.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: IST })
            : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }),
          actual:  r.actual_kw  != null ? +Number(r.actual_kw).toFixed(2)  : null,
          p50:     r.predicted_kw != null ? +Number(r.predicted_kw).toFixed(2) : null,
          p10:     r.p10_kw  != null ? +Number(r.p10_kw).toFixed(2)  : null,
          p90:     r.p90_kw  != null ? +Number(r.p90_kw).toFixed(2)  : null,
        };
      });
  }, [forecastAccuracy, vsActual7d]);

  useEffect(() => {
    phaseLoadChartZoom.resetZoom();
  }, [hours]);

  // Per-phase load power — use dedicated load-side registers only.
  // Preserve legitimate zero readings so a real 0 W phase does not fall through to unrelated grid values.
  const totalLoadW: number | null = latest?.load_power_w ?? null;
  const rawL1W: number | null = latest?.load_l1_power_w ?? null;
  const rawL2W: number | null = latest?.load_l2_power_w ?? null;
  const rawL3W: number | null = latest?.load_l3_power_w ?? null;
  // Smarter estimate: subtract known phases from total, split remainder equally
  const knownW = (rawL1W ?? 0) + (rawL2W ?? 0) + (rawL3W ?? 0);
  const unknownPhases = (rawL1W == null ? 1 : 0) + (rawL2W == null ? 1 : 0) + (rawL3W == null ? 1 : 0);
  const remainderW = totalLoadW != null ? Math.max(0, totalLoadW - knownW) : null;
  const estUnknownW = remainderW != null && unknownPhases > 0 ? Math.round(remainderW / unknownPhases) : null;
  const liveW1: number | null = rawL1W ?? estUnknownW ?? null;
  const liveW2: number | null = rawL2W ?? estUnknownW ?? null;
  const liveW3: number | null = rawL3W ?? estUnknownW ?? null;
  const liveV1: number | null = latest?.load_l1_voltage_v ?? null;
  const liveV2: number | null = latest?.load_l2_voltage_v ?? null;
  const liveV3: number | null = latest?.load_l3_voltage_v ?? null;
  const liveA1: number | null = latest?.load_l1_current_a ?? null;
  const liveA2: number | null = latest?.load_l2_current_a ?? null;
  const liveA3: number | null = latest?.load_l3_current_a ?? null;
  // Show cards whenever we have any live telemetry
  const hasLive = latest != null && latest.load_power_w !== undefined;

  

  const phaseLoadChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: isDark ? '#cbd5e1' : '#374151', font: { family: 'Poppins, sans-serif', size: 11 }, boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 14 } },
      tooltip: {
        backgroundColor: isDark ? 'rgba(30,41,59,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: isDark ? '#e2e8f0' : '#334155', bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1, padding: 12, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} kW` },
      },
      zoom: createDragZoomPlugins(() => phaseLoadChartZoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
      y: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => v.toFixed(1) }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const loadForecastChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(30,41,59,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: isDark ? '#e2e8f0' : '#334155', bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 12, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} kW` },
      },
      zoom: createDragZoomPlugins(() => loadForecastChartZoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
      y: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 } }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const vsActualLoadChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: isDark ? '#cbd5e1' : '#374151',
          font: { family: 'Poppins, sans-serif', size: 11 },
          boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 14,
          filter: (item: any) => item.text !== 'P10',
        },
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(30,41,59,0.97)' : 'rgba(255,255,255,0.97)',
        titleColor: isDark ? '#e2e8f0' : '#334155',
        bodyColor: isDark ? '#94a3b8' : '#374151',
        borderColor: isDark ? 'rgba(0,166,62,0.3)' : 'rgba(0,166,62,0.2)',
        borderWidth: 1, padding: 12, cornerRadius: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: {
          label: (item: TooltipItem<'line'>) =>
            item.dataset.label !== 'P10' ? ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} kW` : '',
        },
      },
      zoom: createDragZoomPlugins(() => vsActualLoadChartZoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: {
        offset: true,
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7,
          padding: 8,
        },
        grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' },
      },
      y: { ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => `${Number(v).toFixed(1)}` }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

      {/* ── Header row with hours selector ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>
            Three Phase Load Monitoring
          </h2>
          <p style={{ margin: '2px 0 0', fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', opacity: 0.55, color: isDark ? '#e2e8f0' : '#94a3b8' }}>
            Real-time per-phase load analysis and 48-hour forecast
          </p>
          {/* Sub-tab toggle: Forecast / Accuracy */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }} role="tablist" aria-label="Load forecast sub tabs">
            <button
              onClick={() => setPhaseForecastSubTab('chart')}
              aria-pressed={phaseForecastSubTab === 'chart'}
              style={{
                padding: '6px 10px', borderRadius: 8, border: phaseForecastSubTab === 'chart' ? `1px solid ${isDark ? '#00a63e' : '#00a63e'}` : '1px solid transparent',
                background: phaseForecastSubTab === 'chart' ? (isDark ? 'rgba(0,166,62,0.12)' : 'rgba(0,166,62,0.08)') : 'transparent',
                color: phaseForecastSubTab === 'chart' ? (isDark ? '#d1fae5' : '#065f46') : (isDark ? '#e2e8f0' : '#94a3b8'),
                cursor: 'pointer', fontWeight: 700, fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem'
              }}
            >
              Forecast
            </button>
            <button
              onClick={() => setPhaseForecastSubTab('accuracy')}
              aria-pressed={phaseForecastSubTab === 'accuracy'}
              style={{
                padding: '6px 10px', borderRadius: 8, border: phaseForecastSubTab === 'accuracy' ? `1px solid ${isDark ? '#00a63e' : '#00a63e'}` : '1px solid transparent',
                background: phaseForecastSubTab === 'accuracy' ? (isDark ? 'rgba(0,166,62,0.12)' : 'rgba(0,166,62,0.08)') : 'transparent',
                color: phaseForecastSubTab === 'accuracy' ? (isDark ? '#d1fae5' : '#065f46') : (isDark ? '#e2e8f0' : '#94a3b8'),
                cursor: 'pointer', fontWeight: 700, fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem'
              }}
            >
              Accuracy
            </button>
          </div>
        </div>
        <select
          value={hours}
          onChange={e => onHoursChange(Number(e.target.value))}
          style={{
            background: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.95)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: 10, padding: '7px 14px', fontSize: '0.8rem',
            color: isDark ? '#e2e8f0' : '#334155',
            cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600,
            backdropFilter: 'blur(10px)',
          }}
        >
          <option value={6}>6 hours</option>
          <option value={12}>12 hours</option>
          <option value={24}>24 hours</option>
          <option value={48}>48 hours</option>
        </select>
      </div>

      {/* ── Phase KPI Cards ── always shown when we have any live reading ── */}
      {hasLive && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 20 }}>
          <PhaseKpiCard phase="L1" watts={liveW1} volts={liveV1} amps={liveA1} color={PHASE_COLORS.L1} isDark={isDark} index={0} estimated={rawL1W == null && liveW1 != null} />
          <PhaseKpiCard phase="L2" watts={liveW2} volts={liveV2} amps={liveA2} color={PHASE_COLORS.L2} isDark={isDark} index={1} estimated={rawL2W == null && liveW2 != null} />
          <PhaseKpiCard phase="L3" watts={liveW3} volts={liveV3} amps={liveA3} color={PHASE_COLORS.L3} isDark={isDark} index={2} estimated={rawL3W == null && liveW3 != null} />
        </div>
      )}

      {/* ── Stacked area chart with glow strokes ── */}
      <ChartCard
        title={showTotalLoad ? 'Total Phase Load (15 min)' : 'Phase Load Distribution (5 min)'}
        subtitle={showTotalLoad ? `L1 + L2 + L3 combined · 15-minute buckets · last ${hours}h · drag to zoom` : `L1 + L2 + L3 stacked · 5-minute buckets · last ${hours}h · drag to zoom`}
        isDark={isDark}
        isLive={true}
        height={chartData.length === 0 ? 100 : 300}
        accentColor="#3b82f6"
        delay={0.3}
        headerRight={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowTotalLoad(prev => !prev)}
              style={{
                border: '1px solid rgba(59,130,246,0.25)',
                background: showTotalLoad ? 'rgba(59,130,246,0.14)' : 'transparent',
                color: showTotalLoad ? '#3b82f6' : 'var(--text-muted)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              Total Load
            </button>
            <ZoomResetButton visible={phaseLoadChartZoom.isZoomed} onClick={phaseLoadChartZoom.resetZoom} />
          </div>
        }
      >
        {chartData.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontSize: '0.875rem' }}>
            <Layers size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div>No phase load data for this period.</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.6, marginTop: 4 }}>Per-phase registers (load_l1_power, load_l2_power, load_l3_power) must be mapped in the device config.</div>
          </div>
        ) : (
          <div style={{ height: 300 }}>
            <CJLine
              ref={phaseLoadChartZoom.chartRef}
              data={{
                labels: (showTotalLoad ? chartData15 : chartData).map((d: any) => d.time),
                datasets: showTotalLoad
                  ? [{
                      label: 'Total Load',
                      data: chartData15.map((d: any) => +(d.L1 + d.L2 + d.L3).toFixed(2)),
                      borderColor: isDark ? '#f8fafc' : '#111827',
                      borderWidth: 2.4,
                      tension: 0.25,
                      pointRadius: 0,
                      fill: 'origin',
                      backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return 'rgba(100,116,139,0.3)'; return makeGradient(chart.ctx, chart.chartArea, isDark ? '#94a3b8' : '#64748b', 0.45, 0.05); },
                    }]
                  : (['L1', 'L2', 'L3'] as const).map(ph => ({
                      label: `Phase ${ph}`,
                      data: chartData.map((d: any) => d[ph] as number),
                      borderColor: PHASE_COLORS[ph], borderWidth: 2.2, tension: 0.4, pointRadius: 0,
                      fill: ph === 'L1' ? 'origin' : '-1',
                      backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return PHASE_COLORS[ph] + '30'; return makeGradient(chart.ctx, chart.chartArea, PHASE_COLORS[ph], 0.55, 0.05); },
                    })),
              }}
              options={phaseLoadChartOptions}
            />
          </div>
        )}
      </ChartCard>

      {/* ── 7-Day Load Forecast / vs Actual (sub-tab) ── */}
      <div style={{ display: phaseForecastSubTab === 'chart' ? 'block' : 'none' }}>
        <ChartCard
          title={showVsActual ? `Load Forecast vs Actual — ${vsActual7d ? 'Last 7 Days' : 'Today'}` : '48-Hour Load Forecast'}
          subtitle={showVsActual
            ? `Historical scored forecasts (15-min slots · IST) · ${vsActual7d ? 'last 7 days' : 'today'} · drag to zoom`
            : (() => {
                if (!loadForecast.length) return 'Predictive load forecasting';
                const firstMethod = loadForecast[0]?.method || 'weighted_historical_avg';
                if (firstMethod.startsWith('ml_v1.0')) return 'ML-based forecast (v1.0)';
                if (firstMethod === 'weighted_historical_avg') return 'Weighted historical average';
                return firstMethod;
              })() + ' · drag to zoom'
          }
          isDark={isDark}
          isLive={false}
          height={showVsActual ? (vsActualChartData.length > 0 ? 250 : 170) : (loadForecast.length > 0 ? 230 : 170)}
          accentColor={showVsActual ? '#00a63e' : '#ef4444'}
          delay={0.4}
          headerRight={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setShowVsActual(v => !v)}
                aria-pressed={showVsActual}
                title={showVsActual ? 'Show 48-hour forward forecast' : 'Show historical forecast vs actual'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 8,
                  border: `1px solid ${showVsActual
                    ? (isDark ? 'rgba(0,166,62,0.5)' : 'rgba(0,166,62,0.4)')
                    : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.2)')}`,
                  background: showVsActual
                    ? (isDark ? 'rgba(0,166,62,0.15)' : 'rgba(0,166,62,0.1)')
                    : 'transparent',
                  color: showVsActual
                    ? (isDark ? '#86efac' : '#065f46')
                    : (isDark ? '#94a3b8' : '#64748b'),
                  cursor: 'pointer', fontWeight: 700,
                  fontFamily: 'Poppins, sans-serif', fontSize: '0.72rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <Activity size={12} />
                Historical vs Actual
              </button>
              {showVsActual && (
                <button
                  onClick={() => setVsActual7d(v => !v)}
                  aria-pressed={vsActual7d}
                  title={vsActual7d ? 'Show today only' : 'Show last 7 days'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 8,
                    border: `1px solid ${vsActual7d ? (isDark ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.4)') : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.2)')}`,
                    background: vsActual7d ? (isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)') : 'transparent',
                    color: vsActual7d ? (isDark ? '#fcd34d' : '#92400e') : (isDark ? '#94a3b8' : '#64748b'),
                    cursor: 'pointer', fontWeight: 700,
                    fontFamily: 'Poppins, sans-serif', fontSize: '0.72rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Activity size={12} />
                  Last 7 Days
                </button>
              )}
              <ZoomResetButton
                visible={showVsActual ? vsActualLoadChartZoom.isZoomed : loadForecastChartZoom.isZoomed}
                onClick={showVsActual ? vsActualLoadChartZoom.resetZoom : loadForecastChartZoom.resetZoom}
              />
            </div>
          }
        >
          {showVsActual ? (
            vsActualChartData.length > 0 ? (
              <div style={{ height: 250 }}>
                <CJLine
                  ref={vsActualLoadChartZoom.chartRef}
                  data={{
                    labels: vsActualChartData.map(d => d.time),
                    datasets: [
                      {
                        label: 'P10',
                        data: vsActualChartData.map(d => d.p10),
                        borderColor: 'transparent', borderWidth: 0,
                        tension: 0.4, pointRadius: 0, fill: false,
                      },
                      {
                        label: 'P10–P90 Band',
                        data: vsActualChartData.map(d => d.p90),
                        borderColor: 'transparent', borderWidth: 0,
                        tension: 0.4, pointRadius: 0,
                        fill: '-1',
                        backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)',
                      },
                      {
                        label: 'Historical Forecast (P50)',
                        data: vsActualChartData.map(d => d.p50),
                        borderColor: '#ef4444', borderWidth: 2,
                        tension: 0.4, pointRadius: 0,
                        fill: false,
                        borderDash: [4, 3],
                      },
                      {
                        label: 'Actual Load',
                        data: vsActualChartData.map(d => d.actual),
                        borderColor: '#00a63e', borderWidth: 2.2,
                        tension: 0.4, pointRadius: 0,
                        fill: false,
                      },
                    ],
                  }}
                  options={vsActualLoadChartOptions}
                />
              </div>
            ) : (
              <div style={{
                height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0 20px',
              }}>
                <div>
                  <Activity size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
                  <div>No forecast accuracy data yet.</div>
                  <div style={{ fontSize: '0.76rem', opacity: 0.6, marginTop: 4 }}>
                    Accuracy scores are computed daily after actuals are available (historical only).
                  </div>
                </div>
              </div>
            )
          ) : (
            loadForecast.length > 0 ? (
              <div style={{ height: 230 }}>
                <CJLine
                  ref={loadForecastChartZoom.chartRef}
                  data={{
                    labels: loadForecastChartData.map(d => d.time),
                    datasets: [
                      {
                        label: 'P10',
                        data: loadForecastChartData.map(d => d.p10),
                        borderColor: 'transparent', borderWidth: 0, tension: 0.4, pointRadius: 0, fill: false,
                      },
                      {
                        label: 'Forecast Load (P50)',
                        data: loadForecastChartData.map(d => d.load),
                        borderColor: '#ef4444', borderWidth: 2.2, tension: 0.4, pointRadius: 0,
                        fill: '-1',
                        backgroundColor: 'rgba(239,68,68,0.15)',
                      },
                      {
                        label: 'P90',
                        data: loadForecastChartData.map(d => d.p90),
                        borderColor: 'transparent', borderWidth: 0, tension: 0.4, pointRadius: 0,
                        fill: '-1',
                        backgroundColor: 'rgba(239,68,68,0.15)',
                      },
                    ],
                  }}
                  options={loadForecastChartOptions}
                />
              </div>
            ) : (
              <div style={{
                height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0 20px',
              }}>
                No load forecast data yet. Forecasts generated every 30 minutes by the backend.
              </div>
            )
          )}
        </ChartCard>
      </div>
      <div style={{ display: phaseForecastSubTab === 'accuracy' ? 'block' : 'none', marginBottom: 12 }}>
        <LoadForecastAccuracySubTab accuracy={forecastAccuracy} isDark={isDark} />
      </div>
    </motion.div>
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
  const [isTouch, setIsTouch] = useState(() => window.matchMedia('(hover: none)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [smartDevices, setSmartDevices] = useState<any[]>([]);
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
  const [forecastWindow, setForecastWindow] = useState<'today' | '3d' | '2d'>('2d');
  const [historyView, setHistoryView] = useState<'chart' | 'table'>('chart');
  const [vsActualView, setVsActualView] = useState<'chart' | 'table'>('chart');
  const [vsActual7d, setVsActual7d] = useState(false);

  // Chart.js refs for zoom reset
  const historyZoom = useChartZoomState();
  const forecastZoom = useChartZoomState();
  const vsActualZoom = useChartZoomState();

  // Fully memoized chart options — stable object reference prevents react-chartjs-2 from calling
  // chart.update() on every render, which would overwrite scale.min/max set by the zoom plugin.
  const tickColor   = isDark ? '#94a3b8' : '#64748b';
  const gridColor   = isDark ? 'rgba(148,163,184,0.12)' : '#e5e7eb';
  const ttBg        = isDark ? 'rgba(15,23,42,0.97)'    : 'rgba(255,255,255,0.97)';
  const ttTitle     = isDark ? '#f1f5f9' : '#111827';
  const ttBody      = isDark ? '#94a3b8' : '#374151';
  const ttBorder    = isDark ? 'rgba(148,163,184,0.2)'  : 'rgba(0,166,62,0.2)';
  const legendColor = isDark ? '#cbd5e1' : '#374151';

  const historyChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: legendColor, font: { family: 'Poppins, sans-serif', size: 11 }, boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 14 } },
      tooltip: {
        backgroundColor: ttBg, titleColor: ttTitle, bodyColor: ttBody,
        borderColor: ttBorder, borderWidth: 1, padding: 12, cornerRadius: 12,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold', size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => { const unit = item.dataset.label === 'SOC' ? '%' : 'kW'; return ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(item.dataset.label === 'SOC' ? 0 : 3)} ${unit}`; } },
      },
      zoom: createDragZoomPlugins(() => historyZoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: { ticks: { color: tickColor, font: { family: 'Inter, sans-serif', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: gridColor } },
      power: { type: 'linear', position: 'left', ticks: { color: isDark ? '#cbd5e1' : '#374151', font: { family: 'JetBrains Mono, monospace', size: 11 } }, grid: { color: gridColor } },
      soc: { type: 'linear', position: 'right', min: 0, max: 100, ticks: { color: isDark ? '#86efac' : '#166534', font: { size: 11 }, callback: (v: any) => `${v}%` }, grid: { drawOnChartArea: false } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const forecastChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: legendColor, font: { family: 'Poppins, sans-serif', size: 11 }, boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 14 } },
      tooltip: {
        backgroundColor: ttBg, titleColor: ttTitle, bodyColor: ttBody,
        borderColor: ttBorder, borderWidth: 1, padding: 12, cornerRadius: 12,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold', size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => { const unit = item.dataset.label === 'GHI' ? 'W/m²' : 'kW'; return ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} ${unit}`; } },
      },
      zoom: createDragZoomPlugins(() => forecastZoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: { ticks: { color: tickColor, font: { family: 'Inter, sans-serif', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: gridColor } },
      y: { ticks: { color: isDark ? '#cbd5e1' : '#374151', font: { family: 'JetBrains Mono, monospace', size: 11 } }, grid: { color: gridColor } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const vsActualChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: legendColor, font: { family: 'Poppins, sans-serif', size: 11 }, boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 14 } },
      tooltip: {
        backgroundColor: ttBg, titleColor: ttTitle, bodyColor: ttBody,
        borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(59,130,246,0.2)', borderWidth: 1, padding: 12, cornerRadius: 12,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold', size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => { const unit = item.dataset.label === 'Δ %' ? '%' : 'kW'; return ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(item.dataset.label === 'Δ %' ? 0 : 3)} ${unit}`; } },
      },
      zoom: createDragZoomPlugins(() => vsActualZoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: { ticks: { color: tickColor, font: { family: 'Inter, sans-serif', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: gridColor } },
      y: { ticks: { color: isDark ? '#cbd5e1' : '#374151', font: { family: 'JetBrains Mono, monospace', size: 11 } }, grid: { color: gridColor } },
      delta: { type: 'linear', position: 'right', ticks: { color: isDark ? '#f87171' : '#dc2626', font: { size: 11 }, callback: (v: any) => `${v}%` }, grid: { drawOnChartArea: false } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  // Analytics data
  const [phaseLoad, setPhaseLoad] = useState<any[]>([]);
  const [forecastAccuracy, setForecastAccuracy] = useState<any>(null);
  const [loadForecastAccuracy, setLoadForecastAccuracy] = useState<any>(null);
  const [loadForecast, setLoadForecast] = useState<any[]>([]);
  const [weatherAccuracy, setWeatherAccuracy] = useState<any>(null);
  const [forecastSubTab, setForecastSubTab] = useState<'chart' | 'accuracy' | 'satellite'>('chart');
  const [weatherSubTab, setWeatherSubTab] = useState<'current' | 'accuracy'>('current');
  const [phaseLoadHours, setPhaseLoadHours] = useState(24);
  const [latestLiveTelemetry, setLatestLiveTelemetry] = useState<any | null>(null);
  const [gatewayOnline, setGatewayOnline] = useState<boolean | null>(null); // null = not yet fetched

  // Poll gateway online status every 30s so EnergyFlow hides immediately when device goes offline.
  // Complements isDataLive (timestamp age) which has up to 10-min lag after device disconnects.
  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    const poll = async () => {
      const status = await apiService.getGatewayStatus(siteId);
      if (!cancelled) setGatewayOnline(status?.is_online ?? null);
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [siteId]);

  // Force-refresh vs-actual data, bypassing the in-memory cache, when the chart is first opened
  const refreshVsActualData = useCallback(async () => {
    if (!siteId) return;
    cacheService.clear(`load_forecast_accuracy_${siteId}_7`);
    try {
      const lfa = await apiService.getLoadForecastAccuracy(siteId, 7);
      setLoadForecastAccuracy(lfa ?? null);
    } catch {
      // ignore — stale data remains if fetch fails
    }
  }, [siteId]);

  // ── Fetch latest telemetry only (silent, no loading flash) ──────────────────
  const fetchLatestTelemetry = useCallback(async () => {
    try {
      const now = new Date();
      // Always probe the latest raw points so Overview freshness is not blocked
      // by 5/15-minute CAGG materialization lag.
      const telemetryParams: any = {
        start_date: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        end_date: now.toISOString(),
        aggregate: 'none',
      };

      const tel = await apiService.getSiteTelemetry(siteId, telemetryParams);
      if (Array.isArray(tel) && tel.length > 0) {
        const latest = tel[tel.length - 1];
        setLatestLiveTelemetry(latest ?? null);
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

      // Kick off forecast + weather + smart devices immediately — runs in parallel with all telemetry fetches
      const forecastWeatherPromise = Promise.all([
        apiService.getSiteForecast(siteId, { start_date: forecastStart, end_date: forecastEnd }),
        apiService.getSiteWeather(siteId),
        apiService.getSmartDevices(siteId),
      ] as Promise<any>[]);

      let telemetryRows: any[] = [];
      if (dateRange === '24h') {
        const rows = await apiService.getSiteTelemetry(siteId, { start_date: startOfTodayIST(), end_date: now.toISOString(), aggregate: '5min' });
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
        const aggregate = getTelemetryAggregateForRange(dateRange, debouncedStart, debouncedEnd);
        // Fetch in parallel batches of 3 to balance speed vs backend load
        for (let i = 0; i < windows.length; i += 3) {
          const batch = windows.slice(i, i + 3);
          const results = await Promise.allSettled(
            batch.map(w => apiService.getSiteTelemetry(siteId, { start_date: w.start_date, end_date: w.end_date, aggregate }))
          );
          for (const r of results) {
            if (r.status === 'fulfilled' && Array.isArray(r.value)) telemetryRows.push(...r.value);
          }
        }
        telemetryRows.sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
      }

      const [fcst, wth, devices] = await forecastWeatherPromise;
      setSmartDevices(Array.isArray(devices) ? devices : []);

      // Pull latest raw rows to drive Overview freshness and Energy Flow block.
      let latestRawRows: any[] = [];
      try {
        const raw = await apiService.getSiteTelemetry(siteId, {
          start_date: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
          end_date: now.toISOString(),
          aggregate: 'none',
        });
        latestRawRows = Array.isArray(raw) ? raw : [];
      } catch {
        latestRawRows = [];
      }

      if (latestRawRows.length > 0) {
        setLatestLiveTelemetry(latestRawRows[latestRawRows.length - 1] ?? null);
      } else {
        setLatestLiveTelemetry(null);
      }

      setTelemetry(telemetryRows);
      setForecast(Array.isArray(fcst) ? fcst : []);
      setWeather(wth || null);
      setLastUpdated(new Date());
      setSecondsSinceUpdate(0);
      setError(null);

      // Analytics — fire-and-forget (non-blocking, won't break on error)
      Promise.allSettled([
        apiService.getPhaseLoad(siteId, phaseLoadHours, 'raw'),
        apiService.getForecastAccuracy(siteId, 30),
        apiService.getLoadForecast(siteId, 2),
        apiService.getWeatherAccuracy(siteId, 7),
        apiService.getLoadForecastAccuracy(siteId, 7),
      ]).then(([pl, fa, lf, wa, lfa]) => {
        if (pl.status === 'fulfilled') setPhaseLoad(Array.isArray(pl.value) ? pl.value : []);
        if (fa.status === 'fulfilled') setForecastAccuracy(fa.value ?? null);
        if (lf.status === 'fulfilled') setLoadForecast(Array.isArray(lf.value) ? lf.value : []);
        if (wa.status === 'fulfilled') setWeatherAccuracy(wa.value ?? null);
        if (lfa.status === 'fulfilled') setLoadForecastAccuracy(lfa.value ?? null);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load site data');
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, [siteId, dateRange, debouncedStart, debouncedEnd, phaseLoadHours]);

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
    if (dateRange === 'custom' && rangeStart && (rangeEnd.getTime() - rangeStart.getTime()) <= 24 * 3600 * 1000) {
      setHistoryError(null);
      return;
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
        const hist = await apiService.getSiteHistory(siteId, { ...params, aggregate: '15min' });
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
    forecastZoom.resetZoom();
  }, [forecastWindow]);

  useEffect(() => {
    historyZoom.resetZoom();
  }, [dateRange]);

  // Re-fetch phase load when hours selector changes
  useEffect(() => {
    apiService.getPhaseLoad(siteId, phaseLoadHours, 'raw')
      .then(data => setPhaseLoad(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [siteId, phaseLoadHours]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const latest = latestLiveTelemetry ?? (telemetry.length > 0 ? telemetry[telemetry.length - 1] : null);

  const pvKw = latest ? (
    (Number(latest.pv1_power_w ?? 0) + Number(latest.pv2_power_w ?? 0) + Number(latest.pv3_power_w ?? 0) + Number(latest.pv4_power_w ?? 0)) / 1000
  ) : null;
  const batSoc = latest?.battery_soc_percent ?? null;
  const loadKwRaw = latest ? (latest.load_power_w ?? 0) / 1000 : null;
  const todayKwh    = latest?.pv_today_kwh    ?? null;
  const totalPvKwh  = latest?.pv_total_kwh    ?? null;
  const gridKw = latest ? (latest.grid_power_w ?? 0) / 1000 : null;
  const batPowerKw = latest ? (latest.battery_power_w ?? 0) / 1000 : null;
  const invTemp = latest?.inverter_temp_c ?? null;
  const batVoltage = latest?.battery_voltage_v ?? null;
  const runState = latest?.run_state;
  const acOutputKw = latest?.ac_output_power_w != null ? latest.ac_output_power_w / 1000 : null;
  const pvPowerDisplay = formatPowerForKpi(pvKw);
  const gridPowerDisplay = formatPowerForKpi(gridKw != null ? Math.abs(gridKw) : null);
  const acOutputPowerDisplay = formatPowerForKpi(acOutputKw);
  const batteryPowerDisplay = formatPowerForKpi(Math.abs(batPowerKw ?? 0));

  // RS-485 staleness: backend sets data_stale=true when instantaneous power
  // registers are frozen (same value for ≥5 consecutive readings).
  const rs485Stale = latest?.data_stale === true;
  const isDeyeCloud = latest?.data_source === 'deye_cloud';

  // Infer gateway and logger status from data_source + timestamp age.
  // Gateway (ESP32) = our RS-485 Modbus monitoring device.
  // Logger (SolarmanV5 WiFi stick) = Deye's own cloud reporting path.
  const latestAgeMs = latest?.timestamp ? Date.now() - new Date(latest.timestamp).getTime() : Infinity;
  const gatewayOffline = !isDeyeCloud && latestAgeMs > 10 * 60 * 1000;  // no RS-485 data > 10 min
  const deyeCloudAgeMs = isDeyeCloud ? latestAgeMs : null;
  // Logger considered offline/standby if Deye Cloud data is older than 20 min
  const loggerOffline = isDeyeCloud && deyeCloudAgeMs != null && deyeCloudAgeMs > 20 * 60 * 1000;

  const isLatestToday = latest?.timestamp
    ? istDate(new Date(latest.timestamp)) === istDate(new Date())
    : false;

  // "Live" = last reading arrived within the past 10 minutes AND gateway is online.
  // gatewayOnline uses device.last_heartbeat (5-min timeout) — reflects the actual
  // MQTT connection state, not just data freshness. When null (first load), fall back
  // to timestamp-only check so there's no flash of "offline" on mount.
  // Deye Cloud data is ~5 min stale by the time the cron writes it + another 5 min until
  // the next cron run → allow 15 min before hiding the flow block for cloud-sourced records.
  const liveThresholdMs = isDeyeCloud ? 15 * 60 * 1000 : 10 * 60 * 1000;
  const dataFresh = latest?.timestamp
    ? (Date.now() - new Date(latest.timestamp).getTime()) < liveThresholdMs
    : false;
  // For RS-485 gateway sites: use real-time is_online. For Deye Cloud or unresolved: timestamp only.
  const isDataLive = isDeyeCloud
    ? dataFresh
    : dataFresh && (gatewayOnline === null ? true : gatewayOnline);

  const gridExporting = gridKw != null && gridKw < -0.01;  // negative = export (sell)
  const gridImporting = gridKw != null && gridKw >  0.01;  // positive = import (buy)
  const batCharging = batPowerKw != null && batPowerKw < -0.01;

  // Data age for battery KPI badge — show when last reading is older than 30 min
  const batDataAgeMs = latest?.timestamp ? Date.now() - new Date(latest.timestamp).getTime() : null;
  const BAT_STALE_THRESHOLD_MS = 30 * 60 * 1000;
  const batDataStale = batDataAgeMs != null && batDataAgeMs > BAT_STALE_THRESHOLD_MS;
  const batDataAgeLabel = (() => {
    if (batDataAgeMs == null) return null;
    const min = Math.floor(batDataAgeMs / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  })();

  // Per-phase grid data.
  // addr 59 (run_status) is stuck at 0 on our hardware — cannot rely on run_state.
  // Instead: show cards when any phase field is present. Mark phase data as stale
  // when the sum of L1+L2+L3 powers deviates wildly from grid_total (stale holdover).
  // Fall back to grid_power_w / grid_voltage_v for L1 when the per-phase
  // DynamoDB attributes are absent (written by older backend deployments).
  // Use || (not ??) so that DynamoDB-defaulted zeros fall through to the next fallback
  const gridL1PowerW  = latest?.grid_l1_power_w   || latest?.grid_power_w   || null;
  const gridL2PowerW  = latest?.grid_l2_power_w   || null;
  const gridL3PowerW  = latest?.grid_l3_power_w   || null;
  const gridL1VoltageV = latest?.grid_l1_voltage_v || latest?.grid_voltage_v || null;
  const gridL2VoltageV = latest?.grid_l2_voltage_v || null;
  const gridL3VoltageV = latest?.grid_l3_voltage_v || null;
  const gridL1CurrentA = latest?.grid_l1_current_a || null;
  const gridL2CurrentA = latest?.grid_l2_current_a || null;
  const gridL3CurrentA = latest?.grid_l3_current_a || null;

  const hasPhaseData = (gridL1PowerW != null && gridL1PowerW !== 0) || gridL2PowerW != null || gridL3PowerW != null
    || (gridL1VoltageV != null && gridL1VoltageV > 50);
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
  const loadL1PowerW = latest?.load_l1_power_w || null;
  const loadL2PowerW = latest?.load_l2_power_w || null;
  const loadL3PowerW = latest?.load_l3_power_w || null;
  const hasLoadPhaseData = loadL1PowerW != null || loadL2PowerW != null || loadL3PowerW != null;
  const loadPhaseSumW = hasLoadPhaseData ? (loadL1PowerW ?? 0) + (loadL2PowerW ?? 0) + (loadL3PowerW ?? 0) : null;
  // Prefer per-phase summed load when available so Energy Flow "Home Load"
  // matches Phase L1/L2/L3 cards. Fall back to aggregate register otherwise.
  const loadKw = loadPhaseSumW != null ? loadPhaseSumW / 1000 : loadKwRaw;
  const loadPowerDisplay = formatPowerForKpi(loadKw);
  const loadPhases = hasLoadPhaseData ? [
    { label: 'L1', powerW: loadL1PowerW },
    { label: 'L2', powerW: loadL2PowerW },
    { label: 'L3', powerW: loadL3PowerW },
  ] : null;

  // DC transformer temperature (addr 540)
  const dcTemp = latest?.dc_temp_c ?? null;

  const runStateBadge = runState != null ? (
    runState === 0 ? { label: 'Standby',    color: '#9ca3af' } :
    runState === 1 ? { label: 'Self-Check', color: '#60a5fa' } :
    runState === 2 ? { label: 'Normal',     color: '#00a63e' } :
    runState === 3 ? { label: 'Alarm',      color: '#f59e0b' } :
    runState === 4 ? { label: 'Fault',      color: '#ef4444' } :
    runState === 5 ? { label: 'Activating', color: '#a78bfa' } :
      { label: `State ${runState}`, color: '#6b7280' }
  ) : null;

  const invTempColor = invTemp == null ? '#9ca3af'
    : invTemp > 60 ? '#ef4444'
    : invTemp > 45 ? '#f59e0b'
    : '#10b981';

  // ── Chart data ──────────────────────────────────────────────────────────────
  const historyData = useMemo(() => {
    return telemetry.map(row => {
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

  const historyStatsVisible = useMemo(() => {
    const data = historyData;
    if (!data.length) return null;
    const intervalH = inferBucketHours(telemetry);
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
    const gridExport = grids.filter(v => v < 0).reduce((s, v) => s + Math.abs(v), 0) * intervalH;  // negative = export
    const gridImport = grids.filter(v => v > 0).reduce((s, v) => s + v, 0) * intervalH;  // positive = import
    const socMin = socs.length ? Math.min(...socs) : null;
    const socMax = socs.length ? Math.max(...socs) : null;
    const socAvg = socs.length ? socs.reduce((s, v) => s + v, 0) / socs.length : null;
    return { pvTotal, pvPeak, loadTotal, loadPeak, loadAvg, invOutPeak, invOutAvg, gridImport, gridExport, socMin, socMax, socAvg };
  }, [historyData, telemetry]);

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
        ? +(((nearest.pv1_power_w ?? 0) + (nearest.pv2_power_w ?? 0) + (nearest.pv3_power_w ?? 0) + (nearest.pv4_power_w ?? 0)) / 1000).toFixed(2)
        : null;
      const p50 = +Number(frow.p50_kw).toFixed(2);
      const diffPct = actualKw != null && p50 > 0
        ? Math.round(((actualKw - p50) / p50) * 100)
        : null;

      return { label, fTs, p50, actual: actualKw, diffPct };
    });
  }, [forecast, telemetry]);

  const zoomedVsActualData = vsActualData;

  // 7-day scored data from SolarForecastSlot (backend accuracy timeseries)
  const vsActual7dData = useMemo(() => {
    const ts: any[] = forecastAccuracy?.timeseries ?? [];
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return ts
      .filter((r: any) => r.actual_kw != null && !!r.slot_ts)
      .map((r: any) => ({ ...r, __ms: new Date(r.slot_ts).getTime() }))
      .filter((r: any) => !Number.isNaN(r.__ms) && r.__ms >= cutoffMs)
      .sort((a: any, b: any) => a.__ms - b.__ms)
      .map((r: any) => ({
        label: new Date(r.slot_ts).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: IST }),
        fTs: r.__ms,
        p50: r.predicted_kw != null ? +Number(r.predicted_kw).toFixed(2) : null,
        actual: r.actual_kw != null ? +Number(r.actual_kw).toFixed(2) : null,
        diffPct: r.actual_kw != null && r.predicted_kw > 0
          ? Math.round(((r.actual_kw - r.predicted_kw) / r.predicted_kw) * 100)
          : null,
      }));
  }, [forecastAccuracy]);

  const activeVsActualData = vsActual7d ? vsActual7dData : zoomedVsActualData;

  const vsActualTickValues = useMemo(
    () => buildSparseCategoryTicks(vsActualData, d => d.label, 8),
    [vsActualData]
  );

  const { forecastFiltered, forecastData } = useMemo(() => {
    const todayIST = istDate(new Date());
    const filtered = forecast.filter(row => {
      const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
      const forecastIST = istDate(new Date(clean));
      if (forecastWindow === 'today') return forecastIST === todayIST;
      if (forecastWindow === '3d') return forecastIST > istDateOffset(0) && forecastIST <= istDateOffset(3);
      // '2d' — 48-hour verified accurate window (matches Lambda output)
      return forecastIST > istDateOffset(0) && forecastIST <= istDateOffset(2);
    });
    const mapped = filtered.map(row => {
      const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
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

  const zoomedForecastData = forecastData;

  const forecastTickObjects = useMemo(() => {
    if (forecastWindow === 'today') {
      return forecastData.filter(d => {
        const t = new Date(d.rawTs);
        return t.getUTCMinutes() === 30 && t.getUTCHours() % 2 === 0;
      });
    }
    const dayMap = new Map<string, (typeof forecastData)[0]>();
    for (const d of forecastData) {
      if (!dayMap.has(d.rawDate)) dayMap.set(d.rawDate, d);
      const t = new Date(d.rawTs);
      if (t.getUTCHours() === 6 && t.getUTCMinutes() === 30) {
        dayMap.set(d.rawDate, d);
      }
    }
    return Array.from(dayMap.values());
  }, [forecastData, forecastWindow]);
  
  const forecastTickValues = forecastTickObjects?.map(d => d.time);

  const historyResolutionLabel = useMemo(
    () => getHistoryResolutionLabel(dateRange, debouncedStart, debouncedEnd),
    [dateRange, debouncedStart, debouncedEnd]
  );

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
            {activeTab === 'forecast' && forecastSubTab === 'chart' && (
              <select
                value={forecastWindow}
                onChange={e => setForecastWindow(e.target.value as 'today' | '3d' | '2d')}
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
                <option value="2d">Next 48 hours</option>
                <option value="3d">Next 3 days</option>
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
          No data found for site <strong style={{ color: '#00a63e' }}>{siteId}</strong> for{' '}
          {dateRange === '24h' ? 'today' : dateRange === '7d' ? 'the last 7 days' : dateRange === '30d' ? 'the last 30 days' : 'the selected date range'}
          .<br />
          <span style={{ fontSize: '0.8rem' }}>Telemetry is posted by the gateway device. Forecast and weather data load once telemetry is available.</span>
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
              overflowX: 'auto',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
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
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    WebkitTapHighlightColor: 'transparent',
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
                    <div style={{ flex: 1 }}>
                      {/* Status pills */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                          background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                          border: '1px solid rgba(239,68,68,0.3)',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                          Gateway offline
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                          background: loggerOffline ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                          color: loggerOffline ? '#ef4444' : '#3b82f6',
                          border: `1px solid ${loggerOffline ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: loggerOffline ? '#ef4444' : '#3b82f6', display: 'inline-block' }} />
                          {loggerOffline ? 'Logger offline / standby' : 'Deye logger online'}
                        </span>
                      </div>
                      {/* Context message */}
                      <span style={{ opacity: 0.85 }}>
                        {loggerOffline
                          ? <>RS-485 monitoring unavailable. Deye Cloud data is <strong>{Math.round((deyeCloudAgeMs ?? 0) / 60000)} min old</strong> — logger may be in nighttime standby.</>
                          : <>RS-485 gateway offline. Showing last known values from the <strong>Deye Cloud logger</strong> (WiFi stick).</>
                        }
                      </span>
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

                {/* ── Live Energy Flow Diagram — only when data is fresh (< 10 min) ── */}
                {isDataLive ? (
                  <EnergyFlowBlock
                    pvKw={pvKw}
                    loadKw={loadKw}
                    gridKw={gridKw}
                    battKw={batPowerKw}
                    battSoc={batSoc}
                    smartDevices={smartDevices}
                    siteId={siteId}
                  />
                ) : (
                  <div style={{
                    padding: '20px', borderRadius: 12, textAlign: 'center',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                    color: isDark ? '#6b7280' : '#9ca3af', fontSize: '0.85rem',
                    marginBottom: 20,
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

                {/* ── KPI Cards ── */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <KpiCard
                    index={0}
                    label="Solar PV"
                    noHover={isTouch}
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
                    noHover={isTouch}
                    value={batSoc != null ? batSoc.toFixed(0) : '—'}
                    unit="%"
                    sub={[
                      batPowerKw != null ? (Math.abs(batPowerKw) < 0.01 ? `Idle ${batteryPowerDisplay.value} ${batteryPowerDisplay.unit}` : `${batCharging ? 'Charging' : 'Discharging'} ${batteryPowerDisplay.value} ${batteryPowerDisplay.unit}`) : null,
                      latest?.battery_temp_c != null ? `${Number(latest.battery_temp_c).toFixed(0)}°C` : null,
                    ].filter(Boolean).join(' · ') || undefined}
                    accent="#00a63e"
                    icon={<IconBattery />}
                    badge={
                      batDataStale && batDataAgeLabel ? (
                        <span style={{ fontSize: '0.65rem', color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                          {batDataAgeLabel}
                        </span>
                      ) : batVoltage != null ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {batVoltage.toFixed(1)} V
                        </span>
                      ) : undefined
                    }
                  />
                  <KpiCard
                    index={2}
                    label="Load"
                    noHover={isTouch}
                    value={loadPowerDisplay.value}
                    unit={loadPowerDisplay.unit}
                    sub={rs485Stale && !isDeyeCloud
                      ? 'RS-485 frozen — value unreliable'
                      : latest?.load_today_kwh != null && isLatestToday
                        ? `${Number(latest.load_today_kwh).toFixed(2)} kWh today`
                        : undefined}
                    accent={rs485Stale && !isDeyeCloud ? '#9ca3af' : '#8b5cf6'}
                    icon={<IconLoad />}
                    badge={rs485Stale && !isDeyeCloud ? (
                      <span style={{ fontSize: '0.65rem', color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        STALE
                      </span>
                    ) : undefined}
                  />
                  <KpiCard
                    index={3}
                    label="Grid"
                    noHover={isTouch}
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
                    noHover={isTouch}
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
                      noHover={isTouch}
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
                      noHover={isTouch}
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
                      noHover={isTouch}
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
                            noHover={isTouch}
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
                            noHover={isTouch}
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
                {/* Weather Sub-tab toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {([
                    { id: 'current', label: 'Current', icon: <CloudSun size={13} /> },
                    { id: 'accuracy', label: 'Accuracy', icon: <BarChart2 size={13} /> },
                  ] as const).map(st => (
                    <motion.button
                      key={st.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setWeatherSubTab(st.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        border: `1px solid ${weatherSubTab === st.id ? '#00a63e' : 'rgba(0,166,62,0.2)'}`,
                        background: weatherSubTab === st.id ? 'rgba(0, 166, 62, 0.12)' : 'transparent',
                        color: weatherSubTab === st.id ? '#00a63e' : 'var(--text-muted)',
                        borderRadius: 8, padding: '6px 14px',
                        fontSize: '0.75rem', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}
                    >
                      {st.icon}{st.label}
                    </motion.button>
                  ))}
                </div>

                <div style={{ display: weatherSubTab === 'current' ? 'block' : 'none' }}>
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
                </div>
                <div style={{ display: weatherSubTab === 'accuracy' ? 'block' : 'none' }}>
                  <WeatherAccuracySubTab accuracy={weatherAccuracy} isDark={isDark} />
                </div>
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
                    <ZoomResetButton visible={historyZoom.isZoomed} onClick={historyZoom.resetZoom} />
                  </div>
                </div>

                <ChartCard
                  title="Power Flow"
                  subtitle={`${historyData.length} data points · ${historyResolutionLabel} buckets · drag to zoom`}
                  isDark={isDark}
                  isLive={dateRange === '24h'}
                  isLoading={loading && historyData.length === 0}
                  height={360}
                  delay={0.1}
                  headerRight={
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 10px',
                        borderRadius: 999,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        fontFamily: 'Poppins, sans-serif',
                        color: historyResolutionLabel === '5 min' ? '#00a63e' : (isDark ? '#cbd5e1' : '#94a3b8'),
                        background: historyResolutionLabel === '5 min'
                          ? (isDark ? 'rgba(0,166,62,0.14)' : 'rgba(0,166,62,0.08)')
                          : (isDark ? 'rgba(148,163,184,0.12)' : 'rgba(71,85,105,0.08)'),
                        border: `1px solid ${historyResolutionLabel === '5 min'
                          ? 'rgba(0,166,62,0.24)'
                          : (isDark ? 'rgba(148,163,184,0.18)' : 'rgba(71,85,105,0.14)')}`,
                      }}
                      aria-label={`History chart aggregation: ${historyResolutionLabel}`}
                    >
                      {historyResolutionLabel}
                    </span>
                  }
                >
                  {historyData.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontSize: '0.875rem' }}>No history points for selected range.</p>
                  ) : historyView === 'chart' ? (
                    <div style={{ width: '100%', height: 360 }}>
                      <CJLine
                        ref={historyZoom.chartRef}
                        data={{
                          labels: historyData.map(d => d.time),
                          datasets: [
                            showHistorySeries.PV && {
                              label: 'PV', yAxisID: 'power',
                              data: historyData.map(d => d['PV (kW)']),
                              borderColor: '#F07522', borderWidth: 2, tension: 0.3, pointRadius: 0,
                              fill: true,
                              backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#F0752230'; return makeGradient(chart.ctx, chart.chartArea, '#F07522', 0.30, 0.02); },
                            },
                            showHistorySeries.Load && {
                              label: 'Load', yAxisID: 'power',
                              data: historyData.map(d => d['Load (kW)']),
                              borderColor: '#8b5cf6', borderWidth: 2, tension: 0.3, pointRadius: 0,
                              fill: true,
                              backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#8b5cf620'; return makeGradient(chart.ctx, chart.chartArea, '#8b5cf6', 0.20, 0.01); },
                            },
                            showHistorySeries.Grid && {
                              label: 'Grid', yAxisID: 'power',
                              data: historyData.map(d => d['Grid (kW)']),
                              borderColor: '#3b82f6', borderWidth: 2, tension: 0.3, pointRadius: 0,
                              fill: false,
                              borderDash: undefined,
                            },
                            showHistorySeries.InvOut && {
                              label: 'Inv Out', yAxisID: 'power',
                              data: historyData.map(d => d['Inv Out (kW)']),
                              borderColor: '#f43f5e', borderWidth: 2, tension: 0.3, pointRadius: 0,
                              fill: true, borderDash: [4, 2],
                              backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#f43f5e18'; return makeGradient(chart.ctx, chart.chartArea, '#f43f5e', 0.14, 0.01); },
                            },
                            showHistorySeries.SOC && {
                              label: 'SOC', yAxisID: 'soc',
                              data: historyData.map(d => d['Batt SOC (%)']),
                              borderColor: '#00a63e', borderWidth: 2, tension: 0.3, pointRadius: 0, fill: false,
                            },
                          ].filter(Boolean) as any[],
                        }}
                        options={historyChartOptions}
                      />
                    </div>
                  ) : (
                    <HistoryTable data={historyData} />
                  )}
                </ChartCard>

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
                        borderRadius: 8, padding: '6px 14px',
                        fontSize: '0.75rem', fontWeight: 700,
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
                  isDark={isDark}
                  isLive={false}
                  isLoading={loading && forecastData.length === 0}
                  height={360}
                  accentColor="#f59e0b"
                  delay={0.1}
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
                            showBands.P10 && {
                              label: 'P10',
                              data: forecastData.map(d => d.p10),
                              borderColor: '#f59e0b', borderWidth: 1.7, tension: 0.3, pointRadius: 0, fill: false,
                            },
                            showBands.P50 && {
                              label: 'P50',
                              data: forecastData.map(d => d.p50),
                              borderColor: '#00a63e', borderWidth: 2.4, tension: 0.3, pointRadius: 0,
                              fill: showBands.P10 ? '-1' : false,
                              backgroundColor: 'rgba(0,166,62,0.08)',
                            },
                            showBands.P90 && {
                              label: 'P90',
                              data: forecastData.map(d => d.p90),
                              borderColor: '#3b82f6', borderWidth: 1.7, tension: 0.3, pointRadius: 0,
                              fill: showBands.P50 ? '-1' : false,
                              backgroundColor: 'rgba(59,130,246,0.06)',
                            },
                            {
                              label: 'Physics',
                              data: forecastData.map(d => d.physics),
                              borderColor: '#94a3b8', borderWidth: 1.5, tension: 0.3, pointRadius: 0,
                              borderDash: [5, 4], fill: false,
                            },
                            showBands.GHI && {
                              label: 'GHI', yAxisID: 'ghi',
                              data: forecastData.map(d => d.ghi),
                              borderColor: '#eab308', borderWidth: 1.3, tension: 0.3, pointRadius: 0,
                              fill: true, backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#eab30820'; return makeGradient(chart.ctx, chart.chartArea, '#eab308', 0.15, 0.01); },
                            },
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
                  {[
                    `P10 = ${fcastP10.toFixed(2)} kWh`,
                    `P50 = ${fcastP50.toFixed(2)} kWh`,
                    `P90 = ${fcastP90.toFixed(2)} kWh`,
                    `Points ${forecastData.length}`,
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
                    Forecast vs Actual — {vsActual7d ? 'Last 7 Days' : 'Today'}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        cacheService.clear(`forecast_accuracy_${siteId}_30`);
                        setForecastAccuracy(null);
                        setVsActual7d(v => !v);
                        apiService.getForecastAccuracy(siteId, 30).then(fa => setForecastAccuracy(fa ?? null)).catch(() => {});
                      }}
                      aria-pressed={vsActual7d}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 8,
                        border: `1px solid ${vsActual7d ? (isDark ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.4)') : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.2)')}`,
                        background: vsActual7d ? (isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)') : 'transparent',
                        color: vsActual7d ? (isDark ? '#fcd34d' : '#92400e') : (isDark ? '#94a3b8' : '#64748b'),
                        cursor: 'pointer', fontWeight: 700,
                        fontFamily: 'Poppins, sans-serif', fontSize: '0.72rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Activity size={12} />
                      Last 7 Days
                    </button>
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
                    <ZoomResetButton visible={vsActualZoom.isZoomed} onClick={vsActualZoom.resetZoom} />
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
                  {activeVsActualData.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>{vsActual7d ? 'No scored forecast slots for the last 7 days yet.' : 'No overlap points yet between forecast and telemetry for today.'}</p>
                  ) : vsActualView === 'chart' ? (
                    <div style={{ width: '100%', height: 320 }}>
                      <CJLine
                        ref={vsActualZoom.chartRef}
                        data={{
                          labels: activeVsActualData.map(d => d.label),
                          datasets: [
                            showVsActualSeries.Actual && {
                              label: 'Actual',
                              data: activeVsActualData.map(d => d.actual),
                              borderColor: '#F07522', borderWidth: 2.2, tension: 0.3, pointRadius: 0, fill: false,
                            },
                            showVsActualSeries.P50 && {
                              label: 'P50',
                              data: activeVsActualData.map(d => d.p50),
                              borderColor: '#00a63e', borderWidth: 2.2, tension: 0.3, pointRadius: 0, fill: false,
                            },
                            showVsActualSeries.Delta && {
                              label: 'Δ %', yAxisID: 'pct',
                              data: activeVsActualData.map(d => d.diffPct),
                              borderColor: '#3b82f6', borderWidth: 1.7, tension: 0.3, pointRadius: 0,
                              borderDash: [4, 4], fill: false,
                            },
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
            )}

            {/* ── Phase Load Tab ── */}
            {activeTab === 'phase-load' && (
              <motion.div
                key="phase-load"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={{ initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 20 } }}
                transition={tabTransition}
              >
                <PhaseLoadTab
                  phaseLoad={phaseLoad}
                  loadForecast={loadForecast}
                  latest={latest}
                  isDark={isDark}
                  hours={phaseLoadHours}
                  onHoursChange={setPhaseLoadHours}
                  forecastAccuracy={loadForecastAccuracy}
                  onRefreshVsActual={refreshVsActualData}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default SiteDataPanel;
