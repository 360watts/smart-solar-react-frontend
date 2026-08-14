/**
 * PhaseLoadTab — extracted from SiteDataPanel.tsx
 * Contains: LOAD_SOURCE_META, PHASE_COLORS, PhaseKpiCard, LoadForecastAccuracySubTab, PhaseLoadTab
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, BarChart2, Activity } from 'lucide-react';
import { Line as CJLine, Bar as CJBar } from 'react-chartjs-2';
import { type ChartOptions, type TooltipItem } from 'chart.js';
import { makeGradient, useChartZoomState, ZoomResetButton, createDragZoomPlugins } from '../chartUtils';
import { resolveCssVar } from '../../../lib/resolveCssVar';
import { apiService } from '../../../../services/api';
import { cacheService } from '../../../../services/cacheService';
import { IST_TIMEZONE } from '../../../../app/constants';
import { startOfSolarDayIST, istDateOffset } from '../istDate';

const IST = IST_TIMEZONE;

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
  title, subtitle, isDark, isLive, height, accentColor = '#00a63e',
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
        background: cardBg,
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: `1px solid ${borderBase}`,
        overflow: 'hidden',
        marginBottom: 20,
        boxShadow: isDark
          ? `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${accentColor}15`
          : `0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px ${accentColor}15`,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--foreground)' }}>
              {title}
            </h3>
            {isLive && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#00a63e',
                border: '1px solid rgba(0,166,62,0.3)', borderRadius: 999, padding: '2px 7px',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00a63e', display: 'inline-block' }} />
                Live
              </span>
            )}
          </div>
          {subtitle && (
            <p style={{ margin: '3px 0 0', fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {headerRight && <div style={{ flexShrink: 0 }}>{headerRight}</div>}
      </div>
      {/* Body */}
      <div style={{ padding: '16px 20px' }}>
        {children}
      </div>
    </motion.div>
  );
};

// ── EnhancedKPICard (needed by LoadForecastAccuracySubTab) ─────────────────────

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
      <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Poppins, sans-serif', color: 'var(--muted-foreground)', marginBottom: 8 }}>
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
              color: trend.direction === 'down' ? '#10b981' : trend.direction === 'up' ? '#ef4444' : 'var(--muted-foreground)',
            }}
          >
            {trend.direction === 'down' && '↓'} {trend.direction === 'up' && '↑'} {trend.pct.toFixed(1)}%
          </motion.div>
        )}
      </div>
      <div style={{ fontSize: '0.62rem', fontFamily: 'Poppins, sans-serif', color: 'var(--muted-foreground)' }}>{sub}</div>
    </motion.div>
  );
};

// ── Constants ──────────────────────────────────────────────────────────────────

export const LOAD_SOURCE_META = {
  inverter: { label: 'Inverter Load', color: '#f59e0b' },
  grid: { label: 'Grid Load', color: '#60a5fa' },
  ev: { label: 'EV Load', color: '#34d399' },
} as const;
type LoadSourceKey = keyof typeof LOAD_SOURCE_META;

export const PHASE_COLORS = { L1: '#3b82f6', L2: '#f59e0b', L3: '#8b5cf6' };

// ── PhaseKpiCard ───────────────────────────────────────────────────────────────

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

export const PhaseKpiCard: React.FC<PhaseKpiCardProps> = ({ phase, watts, volts, amps, color, isDark, index, estimated }) => {
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
      <div style={{ position: 'absolute', inset: 0, opacity: 0.12, background: `radial-gradient(circle at top right, ${color}, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>
            Phase {phase}
          </span>
          {estimated && (
            <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 6, background: isDark ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.12)', color: '#d97706' }}>est.</span>
          )}
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: `0 0 14px ${color}` }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Poppins, sans-serif', color: 'var(--muted-foreground)', marginBottom: 3 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Poppins, sans-serif', color: 'var(--muted-foreground)', marginBottom: 2 }}>Voltage</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: '1rem', color: 'var(--foreground)' }}>
              {volts != null ? `${dV.toFixed(1)} V` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Poppins, sans-serif', color: 'var(--muted-foreground)', marginBottom: 2 }}>Current</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: '1rem', color: 'var(--foreground)' }}>
              {amps != null ? `${dA.toFixed(2)} A` : '—'}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── LoadForecastAccuracySubTab ─────────────────────────────────────────────────

export const LoadForecastAccuracySubTab: React.FC<{ accuracy: any; isDark: boolean }> = ({ accuracy, isDark }) => {
  const [chartMode, setChartMode] = useState<'mae' | 'error'>('mae');
  const summary = accuracy?.overall ?? accuracy?.summary ?? {};
  const hourly: any[] = accuracy?.hourly ?? [];
  const chartZoom = useChartZoomState();

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
        backgroundColor: resolveCssVar('--popover'),
        titleColor: resolveCssVar('--foreground'),
        bodyColor: resolveCssVar('--muted-foreground'),
        borderColor: 'rgba(16,185,129,0.2)', borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold' as const, size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'bar'>) => ` MAE: ${Number(item.parsed.y).toFixed(3)} kW` },
      },
      zoom: createDragZoomPlugins(() => chartZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: resolveCssVar('--muted-foreground'), font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
      y: { ticks: { color: resolveCssVar('--muted-foreground'), font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => v.toFixed(3) }, grid: { display: false } },
    },
  }), [isDark]);

  const errorPctChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: resolveCssVar('--popover'),
        titleColor: resolveCssVar('--foreground'),
        bodyColor: resolveCssVar('--muted-foreground'),
        borderColor: 'rgba(16,185,129,0.2)', borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold' as const, size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => ` Error: ${Number(item.parsed.y).toFixed(1)}%` },
      },
      zoom: createDragZoomPlugins(() => chartZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: resolveCssVar('--muted-foreground'), font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
      y: { ticks: { color: resolveCssVar('--muted-foreground'), font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => `${v}%` }, grid: { display: false } },
    },
  }), [isDark]);

  const maeKw = summary.mae_kw ?? 0;
  const rmseKw = summary.rmse_kw ?? 0;
  const mapeKw = summary.mape_pct ?? 0;
  const coverage = summary.coverage_pct ?? 0;

  if (!hourly.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: 40, textAlign: 'center', color: 'var(--muted-foreground)',
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

  const daysComputed = summary.days_computed ?? '—';
  const getMaeStatus = (mae: number) => mae < 0.15 ? 'good' : mae < 0.30 ? 'warning' : 'critical';
  const getCoverageStatus = (cov: number) => cov > 85 ? 'good' : cov > 75 ? 'warning' : 'critical';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontSize: '0.7rem', fontFamily: 'Poppins, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)' }}>
          Performance Summary — Last {daysComputed} days
        </div>
      </div>

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
                    color: chartMode === mode ? ('var(--success)') : ('var(--muted-foreground)'),
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

// ── PhaseLoadTab ───────────────────────────────────────────────────────────────

interface PhaseLoadTabProps {
  siteId: string;
  phaseLoad: any[];
  loadForecast: any[];
  smartDevices: any[];
  latest: any;
  isDark: boolean;
  hours: number;
  onHoursChange: (h: number) => void;
  forecastAccuracy?: any;
  onRefreshVsActual?: () => void;
  ctLatest?: any;
}

const PhaseLoadTab: React.FC<PhaseLoadTabProps> = ({ siteId, phaseLoad, loadForecast, smartDevices, latest, isDark, hours, onHoursChange, forecastAccuracy, onRefreshVsActual, ctLatest }) => {
  const [phaseForecastSubTab, setPhaseForecastSubTab] = useState<'chart' | 'accuracy'>('chart');
  const [loadSourceView, setLoadSourceView] = useState<LoadSourceKey | 'total'>('inverter');
  // Instantaneous power (kW), not cumulative kWh, is the correct default: a
  // cumulative area chart never returns to zero once a load has run, so a
  // completed EV charge (or any load) reads as "still active" for the rest
  // of the window instead of dropping to a flat, empty baseline. Confirmed
  // against real coim_002 data: EV charged 16:55-20:15 IST, then power_w=0
  // for the next 18h+, but the cumulative default kept the "EV Charging
  // Trace" area filled the whole time, looking like an ongoing charge.
  const [loadChartCumulative, setLoadChartCumulative] = useState(false);
  const [loadTotalCombined, setLoadTotalCombined] = useState(false);
  const [selectedLoadDate, setSelectedLoadDate] = useState('');
  const phaseLoadChartZoom = useChartZoomState();
  const loadForecastChartZoom = useChartZoomState();
  const vsActualLoadChartZoom = useChartZoomState();
  const [showVsActual, setShowVsActual] = useState(false);
  const [vsActual7d, setVsActual7d] = useState(false);
  const vsActualFetchedRef = useRef(false);
  const [evHistory, setEvHistory] = useState<any[]>([]);
  const [ctHistoryRows, setCtHistoryRows] = useState<any[]>([]);
  const [siteHistoryRows, setSiteHistoryRows] = useState<any[]>([]);
  const loadBucketMinutes = 15;

  useEffect(() => {
    if (showVsActual && !vsActualFetchedRef.current) {
      vsActualFetchedRef.current = true;
      onRefreshVsActual?.();
    }
  }, [showVsActual, onRefreshVsActual]);

  useEffect(() => {
    let cancelled = false;
    if (!siteId) return;
    const end = new Date();
    const start = hours === 24 ? new Date(startOfSolarDayIST()) : new Date(end.getTime() - hours * 3600 * 1000);
    apiService.getEnergyMeterHistory(siteId, {
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      aggregate: '15min',
    }).then(rows => {
      if (!cancelled) setCtHistoryRows(Array.isArray(rows) ? rows : []);
    }).catch(() => {
      if (!cancelled) setCtHistoryRows([]);
    });
    apiService.getSiteHistory(siteId, {
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      aggregate: '15min',
    }).then(rows => {
      if (!cancelled) setSiteHistoryRows(Array.isArray(rows) ? rows : []);
    }).catch(() => {
      if (!cancelled) setSiteHistoryRows([]);
    });
    return () => { cancelled = true; };
  }, [siteId, hours]);

  useEffect(() => {
    let cancelled = false;
    const evDevices = smartDevices.filter((d: any) => d.appliance_label === 'ev_charger');
    if (evDevices.length === 0) {
      setEvHistory([]);
      return;
    }
    Promise.all(evDevices.map((d: any) => apiService.getSmartDeviceReadings(d.id, Math.max(hours, 24))))
      .then(results => {
        if (cancelled) return;
        const rows = results.flatMap((items, idx) =>
          (Array.isArray(items) ? items : []).map((row: any) => ({
            ...row,
            __device_id: evDevices[idx]?.id,
          }))
        );
        setEvHistory(rows);
      })
      .catch(() => {
        if (!cancelled) setEvHistory([]);
      });
    return () => { cancelled = true; };
  }, [smartDevices, hours]);

  const { chartData, availableLoadDates } = useMemo(() => {
    // For 24h view, clamp to solar day (6am IST → now) so the chart shows 6am→6am not a rolling window
    const solarDayStartMs = hours === 24 ? new Date(startOfSolarDayIST()).getTime() : 0;
    const phaseLoadFiltered = hours === 24
      ? phaseLoad.filter((r: any) => {
          const ts = r.hour || r.timestamp;
          return ts && new Date(ts).getTime() >= solarDayStartMs;
        })
      : phaseLoad;

    const toKw = (value: unknown) => {
      if (value == null || value === '') return null;
      const num = Number(value);
      if (!Number.isFinite(num)) return null;
      return Math.abs(num) > 1000 ? num / 1000 : num;
    };
    const fieldToKw = (row: any, key: string) => {
      const raw = row?.[key];
      if (raw == null || raw === '') return null;
      const num = Number(raw);
      if (!Number.isFinite(num)) return null;
      if (key.endsWith('_kw')) return num;
      if (
        key.endsWith('_power_w') ||
        key.startsWith('active_power_') ||
        key.startsWith('reactive_power_') ||
        key.startsWith('apparent_power_')
      ) {
        return num / 1000;
      }
      return toKw(num);
    };
    const pickFirstKw = (row: any, keys: string[]) => {
      for (const key of keys) {
        const val = fieldToKw(row, key);
        if (val != null) return val;
      }
      return null;
    };
    const evByBucket = new Map<string, { sum: number; count: number }>();
    for (const row of evHistory) {
      const baseTs = new Date(row.timestamp);
      if (Number.isNaN(baseTs.getTime()) || row.power_w == null) continue;
      if (hours === 24 && baseTs.getTime() < solarDayStartMs) continue;
      const bucketMs = loadBucketMinutes * 60 * 1000;
      const snapped = Math.floor(baseTs.getTime() / bucketMs) * bucketMs;
      const key = new Date(snapped).toISOString();
      const cur = evByBucket.get(key) ?? { sum: 0, count: 0 };
      cur.sum += row.power_w / 1000;
      cur.count += 1;
      evByBucket.set(key, cur);
    }

    const bucketMs = loadBucketMinutes * 60 * 1000;
    // Per-phase presence counters (inverterL1N/L2N/L3N, gridL1N/L2N/L3N), not
    // one shared counter — a bucket where L1 has a real reading but L2/L3
    // don't must still let L1 average correctly while L2/L3 stay unknown,
    // same principle as the backend's site_phase_load fix (per-field
    // presence counts, not one blanket sample count). inverterTotalFallback
    // is a genuinely separate accumulator for load_power_w (the aggregate,
    // real data) used ONLY when no real per-phase reading exists at all for
    // a bucket — it must never be written into inverterL1/L2/L3 themselves
    // (that fabricates "100% of load on L1, 0 on L2/L3", a specific shape
    // that never actually happened).
    const map = new Map<string, {
      ts: Date;
      inverterL1: number; inverterL2: number; inverterL3: number;
      inverterL1N: number; inverterL2N: number; inverterL3N: number;
      inverterTotalFallback: number; inverterTotalFallbackN: number;
      gridL1: number; gridL2: number; gridL3: number;
      gridL1N: number; gridL2N: number; gridL3N: number;
      ev: number;
      evN: number;
    }>();
    const ensureBucket = (key: string, snapped: number) => {
      if (!map.has(key)) {
        map.set(key, {
          ts: new Date(snapped),
          inverterL1: 0, inverterL2: 0, inverterL3: 0,
          inverterL1N: 0, inverterL2N: 0, inverterL3N: 0,
          inverterTotalFallback: 0, inverterTotalFallbackN: 0,
          gridL1: 0, gridL2: 0, gridL3: 0,
          gridL1N: 0, gridL2N: 0, gridL3N: 0,
          ev: 0, evN: 0,
        });
      }
      return map.get(key)!;
    };
    for (const row of phaseLoadFiltered) {
      const baseTs = new Date(row.hour || row.timestamp);
      if (Number.isNaN(baseTs.getTime())) continue;
      const snapped = Math.floor(baseTs.getTime() / bucketMs) * bucketMs;
      const key = new Date(snapped).toISOString();
      const b = ensureBucket(key, snapped);
      const inverterL1 = pickFirstKw(row, ['inverter_load_l1_kw', 'load_l1_kw', 'inverter_l1_kw', 'load_l1_power_w']);
      const inverterL2 = pickFirstKw(row, ['inverter_load_l2_kw', 'load_l2_kw', 'inverter_l2_kw', 'load_l2_power_w']);
      const inverterL3 = pickFirstKw(row, ['inverter_load_l3_kw', 'load_l3_kw', 'inverter_l3_kw', 'load_l3_power_w']);
      const gridL1Raw = pickFirstKw(row, ['grid_load_l1_kw', 'ct_l1_kw', 'active_power_l1']);
      const gridL2Raw = pickFirstKw(row, ['grid_load_l2_kw', 'ct_l2_kw', 'active_power_l2']);
      const gridL3Raw = pickFirstKw(row, ['grid_load_l3_kw', 'ct_l3_kw', 'active_power_l3']);
      const evFb = evByBucket.get(key);
      const ev = pickFirstKw(row, ['ev_load_kw', 'ev_kw', 'ev_charger_kw', 'smart_device_kw']) ?? (evFb ? evFb.sum / evFb.count : 0);
      if (inverterL1 != null) { b.inverterL1 += inverterL1; b.inverterL1N += 1; }
      if (inverterL2 != null) { b.inverterL2 += inverterL2; b.inverterL2N += 1; }
      if (inverterL3 != null) { b.inverterL3 += inverterL3; b.inverterL3N += 1; }
      // abs(), not max(0, ...): the CT meter is known to report negative
      // stretches (F-051, likely a noisy power channel on the substitute
      // device) that are still real load, not zero — clamping to 0 quietly
      // erased that magnitude from this stacked chart instead of showing it.
      if (gridL1Raw != null) { b.gridL1 += Math.abs(gridL1Raw); b.gridL1N += 1; }
      if (gridL2Raw != null) { b.gridL2 += Math.abs(gridL2Raw); b.gridL2N += 1; }
      if (gridL3Raw != null) { b.gridL3 += Math.abs(gridL3Raw); b.gridL3N += 1; }
      b.ev += ev;
      if (ev !== 0) b.evN += 1;
    }

    for (const row of ctHistoryRows) {
      const baseTs = new Date(row.timestamp);
      if (Number.isNaN(baseTs.getTime())) continue;
      if (hours === 24 && baseTs.getTime() < solarDayStartMs) continue;
      const snapped = Math.floor(baseTs.getTime() / bucketMs) * bucketMs;
      const key = new Date(snapped).toISOString();
      const b = ensureBucket(key, snapped);
      // abs(), same reason as the block above.
      const nextGridL1 = row.active_power_l1 != null && Number.isFinite(Number(row.active_power_l1)) ? Math.abs(Number(row.active_power_l1) / 1000) : null;
      const nextGridL2 = row.active_power_l2 != null && Number.isFinite(Number(row.active_power_l2)) ? Math.abs(Number(row.active_power_l2) / 1000) : null;
      const nextGridL3 = row.active_power_l3 != null && Number.isFinite(Number(row.active_power_l3)) ? Math.abs(Number(row.active_power_l3) / 1000) : null;
      if (nextGridL1 != null) { b.gridL1 += nextGridL1; b.gridL1N += 1; }
      if (nextGridL2 != null) { b.gridL2 += nextGridL2; b.gridL2N += 1; }
      if (nextGridL3 != null) { b.gridL3 += nextGridL3; b.gridL3N += 1; }
    }

    for (const row of siteHistoryRows) {
      const baseTs = new Date(row.timestamp);
      if (Number.isNaN(baseTs.getTime())) continue;
      if (hours === 24 && baseTs.getTime() < solarDayStartMs) continue;
      const snapped = Math.floor(baseTs.getTime() / bucketMs) * bucketMs;
      const key = new Date(snapped).toISOString();
      const b = ensureBucket(key, snapped);
      if (row.load_power_w != null && Number.isFinite(Number(row.load_power_w))) {
        b.inverterTotalFallback += Number(row.load_power_w) / 1000;
        b.inverterTotalFallbackN += 1;
      }
    }

    for (const [key, { sum, count }] of evByBucket.entries()) {
      const snapped = new Date(key).getTime();
      const bucket = ensureBucket(key, snapped);
      if (bucket.evN === 0) {
        bucket.ev = sum / count;
        bucket.evN = 1;
      }
    }

    const rows = Array.from(map.values())
      .sort((a, b) => a.ts.getTime() - b.ts.getTime())
      .map(b => {
        const rawDate = new Date(b.ts).toLocaleDateString('en-CA', { timeZone: IST });
        // null (not a divide-by-shared-count 0) when THIS SPECIFIC phase has
        // zero real readings in this bucket — same principle as the grid/CT
        // fix below and the backend's site_phase_load fix: a missing phase
        // register and a genuine 0 kW reading on that phase are not the same
        // thing, and per-phase (not per-bucket) counters are what let one
        // phase go missing without corrupting the others' averages.
        const inverterL1 = b.inverterL1N > 0 ? +Number(b.inverterL1 / b.inverterL1N).toFixed(2) : null;
        const inverterL2 = b.inverterL2N > 0 ? +Number(b.inverterL2 / b.inverterL2N).toFixed(2) : null;
        const inverterL3 = b.inverterL3N > 0 ? +Number(b.inverterL3 / b.inverterL3N).toFixed(2) : null;
        const hasAnyRealInverterPhase = b.inverterL1N > 0 || b.inverterL2N > 0 || b.inverterL3N > 0;
        // Combined total: sum whatever real per-phase data exists; only fall
        // back to the separate aggregate accumulator (real load_power_w, never
        // written into inverterL1/L2/L3 themselves) when NO phase has any
        // real reading at all for this bucket — never fabricate a specific
        // "100% on L1" shape to produce a total.
        const inverterTotal = hasAnyRealInverterPhase
          ? +((inverterL1 ?? 0) + (inverterL2 ?? 0) + (inverterL3 ?? 0)).toFixed(2)
          : (b.inverterTotalFallbackN > 0 ? +(b.inverterTotalFallback / b.inverterTotalFallbackN).toFixed(2) : null);
        // null (not 0/(gridN||1)) when this bucket has zero real CT-meter
        // readings — a genuine energy-meter outage must render as a gap, not
        // a confident flat 0 kW line (same fix as NodeDetailModal.tsx's
        // ctmeter/Energy-Meter series; see FAULT_LOG.md for the incident this
        // matches). Chart.js's default spanGaps:false (unset below) then
        // draws the break correctly.
        const gridL1 = b.gridL1N > 0 ? +Number(b.gridL1 / b.gridL1N).toFixed(2) : null;
        const gridL2 = b.gridL2N > 0 ? +Number(b.gridL2 / b.gridL2N).toFixed(2) : null;
        const gridL3 = b.gridL3N > 0 ? +Number(b.gridL3 / b.gridL3N).toFixed(2) : null;
        const hasAnyRealGridPhase = b.gridL1N > 0 || b.gridL2N > 0 || b.gridL3N > 0;
        const ev = +Number(b.ev / (b.evN || 1)).toFixed(2);
        return {
          rawTs: b.ts.getTime(),
          rawDate,
          time: b.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }),
          dateLabel: b.ts.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST }),
          inverterL1, inverterL2, inverterL3,
          inverter: inverterTotal,
          gridL1, gridL2, gridL3,
          grid: hasAnyRealGridPhase ? +((gridL1 ?? 0) + (gridL2 ?? 0) + (gridL3 ?? 0)).toFixed(2) : null,
          ev,
        };
      });
    const dates = Array.from(new Set(rows.map(row => row.rawDate))).sort();
    return { chartData: rows, availableLoadDates: dates };
  }, [phaseLoad, evHistory, ctHistoryRows, siteHistoryRows, loadBucketMinutes, hours]);

  useEffect(() => {
    if (selectedLoadDate && !availableLoadDates.includes(selectedLoadDate) && availableLoadDates.length > 0) {
      setSelectedLoadDate('');
    }
  }, [availableLoadDates, selectedLoadDate]);

  const filteredLoadChartData = useMemo(() => {
    if (!selectedLoadDate) return chartData;
    return chartData.filter(row => row.rawDate === selectedLoadDate);
  }, [chartData, selectedLoadDate]);

  const loadWindowLabel = useMemo(() => {
    if (hours <= 24) return `last ${hours}h`;
    if (selectedLoadDate) return `${selectedLoadDate} within last ${hours === 48 ? '48h' : '7d'}`;
    return `last ${hours === 48 ? '48h' : '7d'}`;
  }, [hours, selectedLoadDate]);

  const resolvedLoadChartData = useMemo(() => {
    const now = new Date();
    const todayIst = now.toLocaleDateString('en-CA', { timeZone: IST });
    const isCurrentWindow = hours <= 24 || !selectedLoadDate || selectedLoadDate === todayIst;
    const freshSmartLatest = (device: any) => {
      const ts = device?.latest?.timestamp;
      if (!ts) return null;
      return Date.now() - new Date(ts).getTime() <= 5 * 60 * 1000 ? device.latest : null;
    };
    const evLatestKw = smartDevices
      .filter((d: any) => d.appliance_label === 'ev_charger')
      .reduce((sum: number, d: any) => sum + ((freshSmartLatest(d)?.power_w ?? 0) / 1000), 0);
    const invL1 = latest?.load_l1_power_w != null ? Number(latest.load_l1_power_w) / 1000 : 0;
    const invL2 = latest?.load_l2_power_w != null ? Number(latest.load_l2_power_w) / 1000 : 0;
    const invL3 = latest?.load_l3_power_w != null ? Number(latest.load_l3_power_w) / 1000 : 0;
    // abs(), same reason as the bucket-aggregation block above (F-051).
    const gridL1 = ctLatest?.active_power_l1 != null ? Math.abs(Number(ctLatest.active_power_l1) / 1000) : 0;
    const gridL2 = ctLatest?.active_power_l2 != null ? Math.abs(Number(ctLatest.active_power_l2) / 1000) : 0;
    const gridL3 = ctLatest?.active_power_l3 != null ? Math.abs(Number(ctLatest.active_power_l3) / 1000) : 0;

    const base = filteredLoadChartData.length > 0
      ? filteredLoadChartData
      : isCurrentWindow
      ? [{
          rawTs: now.getTime(),
          rawDate: todayIst,
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }),
          dateLabel: now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST }),
          inverterL1: 0, inverterL2: 0, inverterL3: 0, inverter: 0,
          gridL1: 0, gridL2: 0, gridL3: 0, grid: 0,
          ev: 0,
        }]
      : [];

    if (!isCurrentWindow || base.length === 0) return base;

    const hasNonZero = (key: string) => base.some((row: any) => Math.abs(Number(row[key] ?? 0)) > 0.001);
    const useInvFallback = !hasNonZero('inverterL1') && !hasNonZero('inverterL2') && !hasNonZero('inverterL3') && (invL1 > 0 || invL2 > 0 || invL3 > 0);
    const useGridFallback = !hasNonZero('gridL1') && !hasNonZero('gridL2') && !hasNonZero('gridL3') && (gridL1 > 0 || gridL2 > 0 || gridL3 > 0);
    const useEvFallback = !hasNonZero('ev') && evLatestKw > 0;

    return base.map((row: any) => {
      const next = { ...row };
      if (useInvFallback) {
        next.inverterL1 = +invL1.toFixed(2); next.inverterL2 = +invL2.toFixed(2); next.inverterL3 = +invL3.toFixed(2);
        next.inverter = +(invL1 + invL2 + invL3).toFixed(2);
      }
      if (useGridFallback) {
        next.gridL1 = +gridL1.toFixed(2); next.gridL2 = +gridL2.toFixed(2); next.gridL3 = +gridL3.toFixed(2);
        next.grid = +(gridL1 + gridL2 + gridL3).toFixed(2);
      }
      if (useEvFallback) next.ev = +evLatestKw.toFixed(2);
      return next;
    });
  }, [filteredLoadChartData, hours, selectedLoadDate, smartDevices, latest, ctLatest]);

  const hasInverterPhaseBreakdown = useMemo(
    () => resolvedLoadChartData.some((row: any) => Math.abs(Number(row.inverterL2 ?? 0)) > 0.001 || Math.abs(Number(row.inverterL3 ?? 0)) > 0.001),
    [resolvedLoadChartData]
  );
  const hasGridPhaseBreakdown = useMemo(
    () => resolvedLoadChartData.some((row: any) => Math.abs(Number(row.gridL2 ?? 0)) > 0.001 || Math.abs(Number(row.gridL3 ?? 0)) > 0.001),
    [resolvedLoadChartData]
  );
  const loadViewTitle = useMemo(() => {
    if (loadSourceView === 'total') return 'Load Split Trends';
    if (loadSourceView === 'ev') return 'EV Charging Trace';
    if (loadSourceView === 'grid') return 'Grid Load Profile';
    return 'Inverter Load Profile';
  }, [loadSourceView]);
  const loadViewSubtitle = useMemo(() => {
    const window = hours === 24 ? 'Solar day 06:00 → 06:00 IST' : `Last ${hours === 48 ? '48h' : '7d'}`;
    if (loadSourceView === 'total') return `${window} · all sources`;
    if (loadSourceView === 'ev') return `${window} · smart-device charging`;
    if (loadSourceView === 'grid') return hasGridPhaseBreakdown ? `${window} · phase-wise CT draw` : `${window} · grid import/export`;
    return hasInverterPhaseBreakdown ? `${window} · phase-wise inverter load` : `${window} · inverter-side load`;
  }, [loadSourceView, hasGridPhaseBreakdown, hasInverterPhaseBreakdown, hours]);
  const loadInfoChips = useMemo(() => {
    const activeSource = loadSourceView === 'total' ? 'All sources' : LOAD_SOURCE_META[loadSourceView].label;
    return [
      { label: 'Source', value: activeSource, color: loadSourceView === 'total' ? 'var(--foreground)' : LOAD_SOURCE_META[loadSourceView as LoadSourceKey].color },
      { label: 'Timezone', value: 'IST', color: '#14b8a6' },
    ];
  }, [loadSourceView]);

  const loadRangeTotals = useMemo(() => {
    const keys: LoadSourceKey[] = ['inverter', 'grid', 'ev'];
    const totals = { inverter: 0, grid: 0, ev: 0 } as Record<LoadSourceKey, number>;
    if (resolvedLoadChartData.length > 1) {
      for (let i = 0; i < resolvedLoadChartData.length - 1; i += 1) {
        const current = resolvedLoadChartData[i];
        const next = resolvedLoadChartData[i + 1];
        const hoursDelta = (next.rawTs - current.rawTs) / 3_600_000;
        for (const key of keys) {
          totals[key] += ((current[key] ?? 0) + (next[key] ?? 0)) / 2 * hoursDelta;
        }
      }
    } else if (resolvedLoadChartData.length === 1) {
      for (const key of keys) totals[key] = resolvedLoadChartData[0][key];
    }

    const evRows = evHistory
      .filter((r: any) => r.power_w != null)
      .map((r: any) => ({ ts: new Date(r.timestamp).getTime(), kw: (r.power_w as number) / 1000 }))
      .filter((r) => {
        if (!selectedLoadDate) return true;
        const d = new Date(r.ts).toLocaleDateString('en-CA', { timeZone: IST });
        return d === selectedLoadDate;
      })
      .sort((a, b) => a.ts - b.ts);
    if (evRows.length > 1) {
      totals.ev = evRows.reduce((acc, cur, i) => {
        if (i === 0) return acc;
        const prev = evRows[i - 1];
        return acc + (prev.kw + cur.kw) / 2 * (cur.ts - prev.ts) / 3_600_000;
      }, 0);
    } else if (evRows.length === 1) {
      totals.ev = 0;
    }

    return totals;
  }, [resolvedLoadChartData, evHistory, selectedLoadDate]);

  const loadChartHasMultipleDays = new Set(resolvedLoadChartData.map((row: any) => row.rawDate)).size > 1;
  const loadChartLabels = resolvedLoadChartData.map((row: any) => (loadChartHasMultipleDays ? [row.dateLabel, row.time] : row.time));

  const cumulativeLoadChartData = useMemo(() => {
    const rows = resolvedLoadChartData;
    if (rows.length === 0) return [];
    const keys = ['inverter', 'grid', 'ev', 'inverterL1', 'inverterL2', 'inverterL3', 'gridL1', 'gridL2', 'gridL3'] as const;
    const acc: Record<string, number> = { inverter: 0, grid: 0, ev: 0, inverterL1: 0, inverterL2: 0, inverterL3: 0, gridL1: 0, gridL2: 0, gridL3: 0 };
    return rows.map((row: any, i: number) => {
      if (i === 0) return { ...acc, rawDate: row.rawDate };
      const prev = rows[i - 1];
      const dt = (row.rawTs - prev.rawTs) / 3_600_000;
      for (const k of keys) {
        acc[k] = +(acc[k] + ((Number(prev[k] ?? 0) + Number(row[k] ?? 0)) / 2) * dt).toFixed(3);
      }
      return { ...acc, rawDate: row.rawDate };
    });
  }, [resolvedLoadChartData]);

  const activeLoadChartData = loadChartCumulative ? cumulativeLoadChartData : resolvedLoadChartData;

  const loadChartValues = useMemo(() => {
    const src = loadChartCumulative ? cumulativeLoadChartData : resolvedLoadChartData;
    if (loadSourceView === 'total') return src.flatMap((r: any) => [r.inverter, r.grid, r.ev]).filter((v: any) => Number.isFinite(v));
    if (loadSourceView === 'inverter') return src.flatMap((r: any) => hasInverterPhaseBreakdown ? [r.inverterL1, r.inverterL2, r.inverterL3] : [r.inverter]).filter((v: any) => Number.isFinite(v));
    if (loadSourceView === 'grid') return src.flatMap((r: any) => hasGridPhaseBreakdown ? [r.gridL1, r.gridL2, r.gridL3] : [r.grid]).filter((v: any) => Number.isFinite(v));
    return src.map((r: any) => r[loadSourceView]).filter((v: any) => Number.isFinite(v));
  }, [cumulativeLoadChartData, resolvedLoadChartData, loadChartCumulative, loadSourceView, hasGridPhaseBreakdown, hasInverterPhaseBreakdown]);

  const loadChartUseWatts = useMemo(
    () => !loadChartCumulative && loadChartValues.length > 0 && loadChartValues.every((v: number) => Math.abs(v) < 1),
    [loadChartCumulative, loadChartValues]
  );

  const formatLoadChartValue = (value: number) => {
    if (loadChartCumulative) return `${value.toFixed(2)} kWh`;
    if (loadChartUseWatts) return `${(value * 1000).toFixed(0)} W`;
    return `${value.toFixed(2)} kW`;
  };

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
      : new Date(startOfSolarDayIST()).getTime();

    return rows
      .filter((r: any) => r.__ms >= cutoffMs)
      .map((r: any) => {
        const d = new Date(r.ts);
        return {
          time: vsActual7d
            ? d.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: IST })
            : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }),
          actual: r.actual_kw != null ? +Number(r.actual_kw).toFixed(2) : null,
          p50: r.predicted_kw != null ? +Number(r.predicted_kw).toFixed(2) : null,
          p10: r.p10_kw != null ? +Number(r.p10_kw).toFixed(2) : null,
          p90: r.p90_kw != null ? +Number(r.p90_kw).toFixed(2) : null,
        };
      });
  }, [forecastAccuracy, vsActual7d]);

  useEffect(() => {
    phaseLoadChartZoom.resetZoom();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, selectedLoadDate, loadSourceView]);

  const totalLoadW: number | null = latest?.load_power_w ?? null;
  const rawL1W: number | null = latest?.load_l1_power_w ?? null;
  const rawL2W: number | null = latest?.load_l2_power_w ?? null;
  const rawL3W: number | null = latest?.load_l3_power_w ?? null;
  const knownW = (rawL1W ?? 0) + (rawL2W ?? 0) + (rawL3W ?? 0);
  const unknownPhases = (rawL1W == null ? 1 : 0) + (rawL2W == null ? 1 : 0) + (rawL3W == null ? 1 : 0);
  const remainderW = totalLoadW != null ? Math.max(0, totalLoadW - knownW) : null;
  const estUnknownW = remainderW != null && unknownPhases > 0 ? Math.round(remainderW / unknownPhases) : null;

  const phaseLoadChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'top', align: 'center',
        labels: {
          color: resolveCssVar('--muted-foreground'),
          font: { family: 'Poppins, sans-serif', size: 11, weight: 700 as any },
          boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 16,
        },
      },
      tooltip: {
        backgroundColor: resolveCssVar('--popover'),
        titleColor: resolveCssVar('--foreground'), bodyColor: resolveCssVar('--muted-foreground'),
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold' as const, size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            const row = resolvedLoadChartData[items[0]?.dataIndex ?? -1];
            if (!row) return '';
            return loadChartHasMultipleDays ? `${row.dateLabel} · ${row.time}` : row.time;
          },
          label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${formatLoadChartValue(Number(item.parsed.y))}`,
        },
      },
      zoom: createDragZoomPlugins(() => phaseLoadChartZoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: {
        title: {
          display: true,
          text: loadChartHasMultipleDays ? 'Day / Time (IST)' : 'Time (IST)',
          color: resolveCssVar('--muted-foreground'),
          font: { family: 'Poppins, sans-serif', size: 11, weight: 700 as any },
          padding: { top: 10, bottom: 0 },
        },
        ticks: { color: resolveCssVar('--muted-foreground'), font: { family: 'Inter, sans-serif', size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        grid: { display: false },
      },
      y: {
        title: {
          display: true,
          text: loadChartCumulative ? 'Energy (kWh)' : (loadChartUseWatts ? 'Load (W)' : 'Load (kW)'),
          color: resolveCssVar('--muted-foreground'),
          font: { family: 'Poppins, sans-serif', size: 11, weight: 700 as any },
          padding: { bottom: 6 },
        },
        ticks: {
          color: resolveCssVar('--muted-foreground'),
          font: { family: 'JetBrains Mono, monospace', size: 11 },
          callback: (v: any) => loadChartCumulative ? Number(v).toFixed(1) : (loadChartUseWatts ? `${Math.round(Number(v) * 1000)}` : Number(v).toFixed(1)),
        },
        grid: { display: false },
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark, loadChartHasMultipleDays, resolvedLoadChartData, loadChartCumulative, loadChartUseWatts]);

  const loadForecastChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: resolveCssVar('--popover'),
        titleColor: resolveCssVar('--foreground'), bodyColor: resolveCssVar('--muted-foreground'),
        borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold' as const, size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} kW` },
      },
      zoom: createDragZoomPlugins(() => loadForecastChartZoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: { ticks: { color: resolveCssVar('--muted-foreground'), font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }, grid: { display: false } },
      y: { ticks: { color: resolveCssVar('--muted-foreground'), font: { family: 'JetBrains Mono, monospace', size: 11 } }, grid: { display: false } },
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
          color: resolveCssVar('--muted-foreground'),
          font: { family: 'Poppins, sans-serif', size: 11 },
          boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 14,
          filter: (item: any) => item.text !== 'P10',
        },
      },
      tooltip: {
        backgroundColor: resolveCssVar('--popover'),
        titleColor: resolveCssVar('--foreground'),
        bodyColor: resolveCssVar('--muted-foreground'),
        borderColor: isDark ? 'rgba(0,166,62,0.3)' : 'rgba(0,166,62,0.2)',
        borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold' as const, size: 12 },
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
        ticks: { color: resolveCssVar('--muted-foreground'), font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7, padding: 8 },
        grid: { display: false },
      },
      y: { ticks: { color: resolveCssVar('--muted-foreground'), font: { family: 'JetBrains Mono, monospace', size: 11 }, callback: (v: any) => `${Number(v).toFixed(1)}` }, grid: { display: false } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.35 }}>

      {/* ── Header row with hours selector ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--foreground)' }}>
            Load Source Monitoring
          </h2>
          <p style={{ margin: '2px 0 0', fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
            Inverter, energy meter, and EV demand across live and recent windows
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }} role="tablist" aria-label="Load forecast sub tabs">
            <button
              onClick={() => setPhaseForecastSubTab('chart')}
              aria-pressed={phaseForecastSubTab === 'chart'}
              style={{
                padding: '6px 10px', borderRadius: 8, border: phaseForecastSubTab === 'chart' ? `1px solid #00a63e` : '1px solid transparent',
                background: phaseForecastSubTab === 'chart' ? (isDark ? 'rgba(0,166,62,0.12)' : 'rgba(0,166,62,0.08)') : 'transparent',
                color: phaseForecastSubTab === 'chart' ? ('var(--success)') : 'var(--muted-foreground)',
                cursor: 'pointer', fontWeight: 700, fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem'
              }}
            >
              Forecast
            </button>
            <button
              onClick={() => setPhaseForecastSubTab('accuracy')}
              aria-pressed={phaseForecastSubTab === 'accuracy'}
              style={{
                padding: '6px 10px', borderRadius: 8, border: phaseForecastSubTab === 'accuracy' ? `1px solid #00a63e` : '1px solid transparent',
                background: phaseForecastSubTab === 'accuracy' ? (isDark ? 'rgba(0,166,62,0.12)' : 'rgba(0,166,62,0.08)') : 'transparent',
                color: phaseForecastSubTab === 'accuracy' ? ('var(--success)') : 'var(--muted-foreground)',
                cursor: 'pointer', fontWeight: 700, fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem'
              }}
            >
              Accuracy
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <input
            type="date"
            value={selectedLoadDate}
            max={istDateOffset(0)}
            onChange={e => {
              const picked = e.target.value;
              if (!picked) { setSelectedLoadDate(''); return; }
              const pickedMs = new Date(picked + 'T00:00:00+05:30').getTime();
              const windowStartMs = Date.now() - hours * 3_600_000;
              if (pickedMs < windowStartMs && onHoursChange) onHoursChange(168);
              setSelectedLoadDate(picked);
            }}
            style={{
              background: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.95)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: 10, padding: '7px 10px', fontSize: '0.78rem',
              color: 'var(--foreground)',
              fontFamily: 'Poppins, sans-serif', fontWeight: 600,
            }}
          />
          <select
            value={hours}
            onChange={e => onHoursChange(Number(e.target.value))}
            style={{
              background: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.95)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: 10, padding: '7px 14px', fontSize: '0.8rem',
              color: 'var(--foreground)',
              cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600,
              backdropFilter: 'blur(10px)',
            }}
          >
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={168}>7 days</option>
          </select>
        </div>
      </div>

      {/* ── Stacked area chart ── */}
      <ChartCard
        title={loadViewTitle}
        subtitle={loadViewSubtitle}
        isDark={isDark}
        isLive={true}
        height={0}
        accentColor="#3b82f6"
        delay={0.3}
        headerRight={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* Source segmented control */}
            <div style={{
              display: 'inline-flex', borderRadius: 10, overflow: 'hidden',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.1)'}`,
              background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(241,245,249,0.8)',
            }}>
              {(['inverter', 'grid', 'ev', 'total'] as const).map((view, i) => {
                const color = view === 'total' ? ('var(--foreground)') : LOAD_SOURCE_META[view as LoadSourceKey]?.color ?? '#3b82f6';
                const isActive = loadSourceView === view;
                return (
                  <button
                    key={view}
                    onClick={() => setLoadSourceView(view)}
                    style={{
                      border: 'none',
                      borderLeft: i > 0 ? `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)'}` : 'none',
                      background: isActive ? (isDark ? `${color}22` : `${color}15`) : 'transparent',
                      color: isActive ? color : 'var(--muted-foreground)',
                      padding: '5px 10px', fontSize: '0.67rem', fontWeight: isActive ? 700 : 600,
                      cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: color,
                      opacity: isActive ? 1 : 0.35, flexShrink: 0,
                      boxShadow: isActive ? `0 0 5px ${color}80` : 'none',
                    }} />
                    {view === 'total' ? 'All' : LOAD_SOURCE_META[view as LoadSourceKey].label.replace(' Load', '')}
                  </button>
                );
              })}
            </div>
            {/* kWh / kW toggle */}
            <div style={{
              display: 'inline-flex', borderRadius: 10, overflow: 'hidden',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.1)'}`,
              background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(241,245,249,0.8)',
            }}>
              {([['kW', false, '⚡'], ['kWh', true, '∑']] as const).map(([label, val, icon]) => {
                const isActive = loadChartCumulative === val;
                return (
                  <button
                    key={label}
                    onClick={() => setLoadChartCumulative(() => val)}
                    style={{
                      border: 'none',
                      borderLeft: label === 'kWh' ? `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)'}` : 'none',
                      background: isActive ? (isDark ? 'rgba(47,191,113,0.18)' : 'rgba(47,191,113,0.12)') : 'transparent',
                      color: isActive ? '#2FBF71' : 'var(--muted-foreground)',
                      padding: '5px 10px', fontSize: '0.67rem', fontWeight: isActive ? 700 : 600,
                      cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', lineHeight: 1 }}>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
            {loadSourceView === 'total' && (
              <button
                onClick={() => setLoadTotalCombined(v => !v)}
                title={loadTotalCombined ? 'Show sources separately' : 'Combine into one line'}
                style={{
                  border: `1px solid ${loadTotalCombined ? 'rgba(56,189,248,0.4)' : (isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.1)')}`,
                  background: loadTotalCombined ? (isDark ? 'rgba(56,189,248,0.14)' : 'rgba(56,189,248,0.09)') : 'transparent',
                  color: loadTotalCombined ? '#38bdf8' : 'var(--muted-foreground)',
                  borderRadius: 10, padding: '5px 10px', fontSize: '0.67rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '0.8rem', lineHeight: 1 }}>{loadTotalCombined ? '━' : '≡'}</span>
                {loadTotalCombined ? 'Combined' : 'Split'}
              </button>
            )}
            <ZoomResetButton visible={phaseLoadChartZoom.isZoomed} onClick={phaseLoadChartZoom.resetZoom} />
          </div>
        }
      >
        {resolvedLoadChartData.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontFamily: 'Poppins, sans-serif', fontSize: '0.875rem' }}>
            <Layers size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div>No load source data for this period.</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.6, marginTop: 4 }}>Inverter load, energy meter load, and EV smart-device history appear when those sources are mapped and reporting.</div>
          </div>
        ) : (
          <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Solar day progress bar — only shown on 24h view */}
            {hours === 24 && (() => {
              const nowMs = Date.now();
              const solarStartMs = new Date(startOfSolarDayIST()).getTime();
              const solarEndMs = solarStartMs + 24 * 3600 * 1000;
              const pct = Math.min(100, Math.max(0, (nowMs - solarStartMs) / (solarEndMs - solarStartMs) * 100));
              return (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#f59e0b', fontFamily: 'Poppins, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>☀ 06:00 IST</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--muted-foreground)', fontFamily: 'Poppins, sans-serif' }}>{pct.toFixed(0)}% of solar day elapsed</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6366f1', fontFamily: 'Poppins, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>☾ 06:00 IST</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, #f59e0b 0%, #3b82f6 60%, #6366f1 100%)',
                      borderRadius: 4,
                      transition: 'width 1s ease',
                    }} />
                  </div>
                </div>
              );
            })()}
            {/* Compact legend strip — info chips + source totals */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', paddingBottom: 8, borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`, marginBottom: 8 }}>
              {loadInfoChips.map(chip => (
                <span
                  key={`${chip.label}-${chip.value}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
                    borderRadius: 999,
                    background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.9)',
                    border: `1px solid ${chip.color}28`,
                    fontSize: '0.65rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  <span style={{ color: chip.color, textTransform: 'uppercase', fontSize: '0.58rem', letterSpacing: '0.04em' }}>{chip.label}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>{chip.value}</span>
                </span>
              ))}
              {loadSourceView === 'total' && (['inverter', 'grid', 'ev'] as const).map(key => (
                <span
                  key={key}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
                    borderRadius: 999,
                    background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.9)',
                    border: `1px solid ${LOAD_SOURCE_META[key].color}28`,
                    fontSize: '0.65rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: LOAD_SOURCE_META[key].color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--muted-foreground)' }}>
                    {key === 'ev' ? 'EV' : LOAD_SOURCE_META[key].label.replace(' Load', '')} {loadRangeTotals[key].toFixed(1)} kWh
                  </span>
                </span>
              ))}
            </div>
            <div style={{ height: 360, position: 'relative' }}>
            <CJLine
              ref={phaseLoadChartZoom.chartRef}
              data={{
                labels: loadChartLabels,
                datasets: loadSourceView === 'total'
                  ? (loadTotalCombined
                      ? [{
                          label: 'Total Load',
                          data: activeLoadChartData.map((d: any) => (Number(d.inverter ?? 0) + Number(d.grid ?? 0) + Number(d.ev ?? 0))),
                          borderColor: '#38bdf8', borderWidth: 2.5, tension: 0.35, pointRadius: 0,
                          fill: 'origin',
                          backgroundColor: (ctx: any) => {
                            const { chart } = ctx;
                            if (!chart.chartArea) return 'rgba(56,189,248,0.15)';
                            return makeGradient(chart.ctx, chart.chartArea, '#38bdf8', 0.32, 0.03);
                          },
                        }]
                      : (['inverter', 'grid', 'ev'] as const).map(key => ({
                          label: LOAD_SOURCE_META[key].label,
                          data: activeLoadChartData.map((d: any) => d[key] as number),
                          borderColor: LOAD_SOURCE_META[key].color,
                          borderWidth: key === 'inverter' ? 2.4 : 2,
                          tension: 0.35, pointRadius: 0, fill: false,
                        })))
                  : loadSourceView === 'inverter'
                  ? (hasInverterPhaseBreakdown ? ([
                      { key: 'inverterL1', label: 'L1', color: PHASE_COLORS.L1 },
                      { key: 'inverterL2', label: 'L2', color: PHASE_COLORS.L2 },
                      { key: 'inverterL3', label: 'L3', color: PHASE_COLORS.L3 },
                    ] as const).map(series => ({
                      label: series.label,
                      data: activeLoadChartData.map((d: any) => d[series.key] as number),
                      borderColor: series.color, borderWidth: 2.2, tension: 0.35, pointRadius: 0, fill: false,
                    })) : [{
                      label: LOAD_SOURCE_META.inverter.label,
                      data: activeLoadChartData.map((d: any) => d.inverter as number),
                      borderColor: LOAD_SOURCE_META.inverter.color, borderWidth: 2.4, tension: 0.35, pointRadius: 0, fill: false,
                    }])
                  : loadSourceView === 'grid'
                  ? (hasGridPhaseBreakdown ? ([
                      { key: 'gridL1', label: 'L1', color: PHASE_COLORS.L1 },
                      { key: 'gridL2', label: 'L2', color: PHASE_COLORS.L2 },
                      { key: 'gridL3', label: 'L3', color: PHASE_COLORS.L3 },
                    ] as const).map(series => ({
                      label: series.label,
                      data: activeLoadChartData.map((d: any) => d[series.key] as number),
                      borderColor: series.color, borderWidth: 2.2, tension: 0.35, pointRadius: 0, fill: false,
                    })) : [{
                      label: LOAD_SOURCE_META.grid.label,
                      data: activeLoadChartData.map((d: any) => d.grid as number),
                      borderColor: LOAD_SOURCE_META.grid.color, borderWidth: 2.4, tension: 0.35, pointRadius: 0, fill: false,
                    }])
                  : [{
                      label: LOAD_SOURCE_META[loadSourceView as LoadSourceKey].label,
                      data: activeLoadChartData.map((d: any) => d[loadSourceView] as number),
                      borderColor: LOAD_SOURCE_META[loadSourceView as LoadSourceKey].color,
                      borderWidth: 2.4, tension: 0.35, pointRadius: 0,
                      fill: 'origin',
                      backgroundColor: (ctx: any) => {
                        const { chart } = ctx;
                        if (!chart.chartArea) return `${LOAD_SOURCE_META[loadSourceView as LoadSourceKey].color}25`;
                        return makeGradient(chart.ctx, chart.chartArea, LOAD_SOURCE_META[loadSourceView as LoadSourceKey].color, 0.35, 0.04);
                      },
                    }],
              }}
              options={phaseLoadChartOptions}
            />
            </div>
          </div>
        )}
      </ChartCard>

      {/* ── 7-Day Load Forecast / vs Actual ── */}
      <div style={{ display: phaseForecastSubTab === 'chart' ? 'block' : 'none' }}>
        <ChartCard
          title={showVsActual ? `Load Forecast vs Actual — ${vsActual7d ? 'Last 7 Days' : 'Today'}` : '7-Day Load Forecast'}
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
                title={showVsActual ? 'Show 7-day forward forecast' : 'Show historical forecast vs actual'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 8,
                  border: `1px solid ${showVsActual ? (isDark ? 'rgba(0,166,62,0.5)' : 'rgba(0,166,62,0.4)') : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.2)')}`,
                  background: showVsActual ? (isDark ? 'rgba(0,166,62,0.15)' : 'rgba(0,166,62,0.1)') : 'transparent',
                  color: showVsActual ? ('var(--success)') : ('var(--muted-foreground)'),
                  cursor: 'pointer', fontWeight: 700, fontFamily: 'Poppins, sans-serif', fontSize: '0.72rem',
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
                    color: vsActual7d ? ('var(--warning)') : ('var(--muted-foreground)'),
                    cursor: 'pointer', fontWeight: 700, fontFamily: 'Poppins, sans-serif', fontSize: '0.72rem',
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
                      { label: 'P10', data: vsActualChartData.map(d => d.p10), borderColor: 'transparent', borderWidth: 0, tension: 0.4, pointRadius: 0, fill: false },
                      { label: 'P10–P90 Band', data: vsActualChartData.map(d => d.p90), borderColor: 'transparent', borderWidth: 0, tension: 0.4, pointRadius: 0, fill: '-1', backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)' },
                      { label: 'Historical Forecast (P50)', data: vsActualChartData.map(d => d.p50), borderColor: '#ef4444', borderWidth: 2, tension: 0.4, pointRadius: 0, fill: false, borderDash: [4, 3] },
                      { label: 'Actual Load', data: vsActualChartData.map(d => d.actual), borderColor: '#00a63e', borderWidth: 2.2, tension: 0.4, pointRadius: 0, fill: false },
                    ],
                  }}
                  options={vsActualLoadChartOptions}
                />
              </div>
            ) : (
              <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.85rem', padding: '0 20px' }}>
                <div>
                  <Activity size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
                  <div>No forecast accuracy data yet.</div>
                  <div style={{ fontSize: '0.76rem', opacity: 0.6, marginTop: 4 }}>Accuracy scores are computed daily after actuals are available (historical only).</div>
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
                      { label: 'P10', data: loadForecastChartData.map(d => d.p10), borderColor: 'transparent', borderWidth: 0, tension: 0.4, pointRadius: 0, fill: false },
                      { label: 'Forecast Load (P50)', data: loadForecastChartData.map(d => d.load), borderColor: '#ef4444', borderWidth: 2.2, tension: 0.4, pointRadius: 0, fill: '-1', backgroundColor: 'rgba(239,68,68,0.15)' },
                      { label: 'P90', data: loadForecastChartData.map(d => d.p90), borderColor: 'transparent', borderWidth: 0, tension: 0.4, pointRadius: 0, fill: '-1', backgroundColor: 'rgba(239,68,68,0.15)' },
                    ],
                  }}
                  options={loadForecastChartOptions}
                />
              </div>
            ) : (
              <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.85rem', padding: '0 20px' }}>
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

export default PhaseLoadTab;
