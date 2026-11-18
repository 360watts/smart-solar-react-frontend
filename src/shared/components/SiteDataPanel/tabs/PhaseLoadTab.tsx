import { EmptyState } from '../../Feedback';
/**
 * PhaseLoadTab — extracted from SiteDataPanel.tsx
 * Contains: PhaseKpiCard, LoadForecastAccuracySubTab, PhaseLoadTab (the Load chart itself is LoadCard.tsx)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2 } from 'lucide-react';
import { Line as CJLine, Bar as CJBar } from 'react-chartjs-2';
import { type ChartOptions, type TooltipItem } from 'chart.js';
import { makeGradient, useChartZoomState, ZoomResetButton, createDragZoomPlugins } from '../chartUtils';
import { resolveCssVar } from '../../../lib/resolveCssVar';
import { apiService } from '../../../../services/api';
import { IST_TIMEZONE } from '../../../../app/constants';
import { startOfSolarDayIST } from '../istDate';
import LoadCard from './LoadCard';

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
  title, subtitle, isDark, isLive, height, accentColor = '#0F9F8F',
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
            <h3 style={{ margin: 0, fontFamily: 'Rubik, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--foreground)' }}>
              {title}
            </h3>
            {isLive && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#0F9F8F',
                border: '1px solid rgba(15,159,143,0.3)', borderRadius: 999, padding: '2px 7px',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#0F9F8F', display: 'inline-block' }} />
                Live
              </span>
            )}
          </div>
          {subtitle && (
            <p style={{ margin: '3px 0 0', fontFamily: 'Rubik, sans-serif', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
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
  const statusColors: Record<string, string> = { good: '#0F9F8F', warning: '#f59e0b', critical: '#ef4444' };
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
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Rubik, sans-serif', color: 'var(--muted-foreground)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <div style={{
          fontFamily: 'Fira Code, monospace', fontWeight: 800, fontSize: '1.6rem',
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
              color: trend.direction === 'down' ? '#0F9F8F' : trend.direction === 'up' ? '#ef4444' : 'var(--muted-foreground)',
            }}
          >
            {trend.direction === 'down' && '↓'} {trend.direction === 'up' && '↑'} {trend.pct.toFixed(1)}%
          </motion.div>
        )}
      </div>
      <div style={{ fontSize: '0.75rem', fontFamily: 'Rubik, sans-serif', color: 'var(--muted-foreground)' }}>{sub}</div>
    </motion.div>
  );
};

// ── Constants ──────────────────────────────────────────────────────────────────

export { PHASE_COLORS } from './loadCardModel';

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
          <span style={{ fontFamily: 'Rubik, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>
            Phase {phase}
          </span>
          {estimated && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 6, background: isDark ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.12)', color: '#d97706' }}>est.</span>
          )}
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: `0 0 14px ${color}` }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Rubik, sans-serif', color: 'var(--muted-foreground)', marginBottom: 3 }}>
            Power
          </div>
          <div style={{
            fontFamily: 'Fira Code, monospace', fontWeight: 800, fontSize: '2rem',
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {watts != null ? `${Math.round(Math.abs(dW))} W` : '—'}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Rubik, sans-serif', color: 'var(--muted-foreground)', marginBottom: 2 }}>Voltage</div>
            <div style={{ fontFamily: 'Fira Code, monospace', fontWeight: 600, fontSize: '1rem', color: 'var(--foreground)' }}>
              {volts != null ? `${dV.toFixed(1)} V` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Rubik, sans-serif', color: 'var(--muted-foreground)', marginBottom: 2 }}>Current</div>
            <div style={{ fontFamily: 'Fira Code, monospace', fontWeight: 600, fontSize: '1rem', color: 'var(--foreground)' }}>
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
    const barColor = ratio < 0.33 ? '#0F9F8F' : ratio < 0.66 ? '#f59e0b' : '#ef4444';
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
        titleFont: { family: 'Rubik, sans-serif', weight: 'bold' as const, size: 12 },
        bodyFont: { family: 'Fira Code, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'bar'>) => ` MAE: ${Number(item.parsed.y).toFixed(3)} kW` },
      },
      zoom: createDragZoomPlugins(() => chartZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: resolveCssVar('--muted-foreground'), font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
      y: { ticks: { color: resolveCssVar('--muted-foreground'), font: { family: 'Fira Code, monospace', size: 11 }, callback: (v: any) => v.toFixed(3) }, grid: { display: false } },
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
        titleFont: { family: 'Rubik, sans-serif', weight: 'bold' as const, size: 12 },
        bodyFont: { family: 'Fira Code, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => ` Error: ${Number(item.parsed.y).toFixed(1)}%` },
      },
      zoom: createDragZoomPlugins(() => chartZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: resolveCssVar('--muted-foreground'), font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
      y: { ticks: { color: resolveCssVar('--muted-foreground'), font: { family: 'Fira Code, monospace', size: 11 }, callback: (v: any) => `${v}%` }, grid: { display: false } },
    },
  }), [isDark]);

  const maeKw = summary.mae_kw ?? 0;
  const rmseKw = summary.rmse_kw ?? 0;
  const mapeKw = summary.mape_pct ?? 0;
  const coverage = summary.coverage_pct ?? 0;

  if (!hourly.length) {
    return (
      <EmptyState icon={BarChart2} title="No load accuracy data yet" description="Accuracy shows up once past load forecasts can be checked against real readings." />
    );
  }

  const daysComputed = summary.days_computed ?? '—';
  const getMaeStatus = (mae: number) => mae < 0.15 ? 'good' : mae < 0.30 ? 'warning' : 'critical';
  const getCoverageStatus = (cov: number) => cov > 85 ? 'good' : cov > 75 ? 'warning' : 'critical';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontSize: '0.75rem', fontFamily: 'Rubik, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)' }}>
          Performance Summary — Last {daysComputed} days
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <EnhancedKPICard
          label="MAE" value={maeKw != null ? `${Number(maeKw).toFixed(3)} kW` : '—'} sub="Mean absolute error"
          accent="#0F9F8F" isDark={isDark} status={getMaeStatus(maeKw)} trend={{ direction: maeKw < 0.15 ? 'down' : 'up', pct: 1.8 }} index={0}
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
        accentColor="#0F9F8F"
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
                    padding: '6px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Rubik, sans-serif',
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
            {[['#0F9F8F', 'Low'], ['#f59e0b', 'Med'], ['#ef4444', 'High']].map(([c, l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontFamily: 'Rubik, sans-serif', color: 'var(--text-muted)', fontWeight: 600 }}>
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
                    borderColor: '#0F9F8F', borderWidth: 2.2, tension: 0.4, pointRadius: 0,
                    fill: true,
                    backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#0F9F8F20'; return makeGradient(chart.ctx, chart.chartArea, '#0F9F8F', 0.40, 0.02); },
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
  onRefreshVsActual?: (lead?: string) => void;
  ctLatest?: any;
}

const PhaseLoadTab: React.FC<PhaseLoadTabProps> = ({ siteId, phaseLoad, loadForecast, smartDevices, latest, isDark, hours, onHoursChange, forecastAccuracy, onRefreshVsActual, ctLatest }) => {
  const [phaseForecastSubTab, setPhaseForecastSubTab] = useState<'chart' | 'accuracy'>('chart');
  const [evHistory, setEvHistory] = useState<any[]>([]);
  const [ctHistoryRows, setCtHistoryRows] = useState<any[]>([]);
  const [siteHistoryRows, setSiteHistoryRows] = useState<any[]>([]);
  // Grid-direct line: meter actual + 7-day median forecast (backend docs/test-scenarios/load-line-grid-forecast.md)
  const [gridAccuracy, setGridAccuracy] = useState<any>(null);
  const loadBucketMinutes = 15;

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    apiService.getLoadForecastAccuracy(siteId, 7, 'latest', 'grid')
      .then(r => { if (!cancelled) setGridAccuracy(r ?? null); })
      .catch(() => { if (!cancelled) setGridAccuracy(null); });
    return () => { cancelled = true; };
  }, [siteId]);

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

  // keyed on the EV plug ids, not the list: the overview poll hands over a new smartDevices array every 30 s,
  // which re-fetched the EV readings (uncached) and re-rendered the Load card each time (Nov 18)
  const evIds = smartDevices.filter((d: any) => d.appliance_label === 'ev_charger').map((d: any) => d.id).join(',');
  useEffect(() => {
    let cancelled = false;
    const ids = evIds ? evIds.split(',').map(Number) : [];
    if (ids.length === 0) {
      setEvHistory(prev => (prev.length ? [] : prev));
      return;
    }
    Promise.all(ids.map(id => apiService.getSmartDeviceReadings(id, Math.max(hours, 24))))
      .then(results => {
        if (cancelled) return;
        const rows = results.flatMap((items, idx) =>
          (Array.isArray(items) ? items : []).map((row: any) => ({
            ...row,
            __device_id: ids[idx],
          }))
        );
        setEvHistory(rows);
      })
      .catch(() => {
        if (!cancelled) setEvHistory([]);
      });
    return () => { cancelled = true; };
  }, [evIds, hours]);

  const chartData = useMemo(() => {
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
        // null, not 0, when no EV reading landed in this bucket: the Load card shows it as a gap
        const ev = b.evN > 0 ? +Number(b.ev / b.evN).toFixed(2) : null;
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
    return rows;
  }, [phaseLoad, evHistory, ctHistoryRows, siteHistoryRows, loadBucketMinutes, hours]);

  const resolvedLoadChartData = useMemo(() => {
    const now = new Date();
    const todayIst = now.toLocaleDateString('en-CA', { timeZone: IST });
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

    const base = chartData.length > 0
      ? chartData
      : [{
          rawTs: now.getTime(),
          rawDate: todayIst,
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }),
          dateLabel: now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST }),
          inverterL1: 0, inverterL2: 0, inverterL3: 0, inverter: 0,
          gridL1: 0, gridL2: 0, gridL3: 0, grid: 0,
          ev: 0,
        }];

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
  }, [chartData, smartDevices, latest, ctLatest]);

  const hasEv = smartDevices.some((d: any) => d.appliance_label === 'ev_charger');
  const subTabStyle = (on: boolean): React.CSSProperties => ({
    padding: '6px 10px', borderRadius: 8, border: on ? '1px solid #0F9F8F' : '1px solid transparent',
    background: on ? (isDark ? 'rgba(15,159,143,0.12)' : 'rgba(15,159,143,0.08)') : 'transparent',
    color: on ? 'var(--success)' : 'var(--muted-foreground)',
    cursor: 'pointer', fontWeight: 700, fontFamily: 'Rubik, sans-serif', fontSize: '0.75rem',
  });

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.35 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: 'Rubik, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--foreground)' }}>
          Load Source Monitoring
        </h2>
        <p style={{ margin: '2px 0 0', fontFamily: 'Rubik, sans-serif', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
          Inverter, energy meter and EV load, actual and forecast
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }} role="tablist" aria-label="Load sub tabs">
          <button onClick={() => setPhaseForecastSubTab('chart')} aria-pressed={phaseForecastSubTab === 'chart'} style={subTabStyle(phaseForecastSubTab === 'chart')}>
            Load
          </button>
          <button onClick={() => setPhaseForecastSubTab('accuracy')} aria-pressed={phaseForecastSubTab === 'accuracy'} style={subTabStyle(phaseForecastSubTab === 'accuracy')}>
            Accuracy
          </button>
        </div>
      </div>

      <div style={{ display: phaseForecastSubTab === 'chart' ? 'block' : 'none' }}>
        <LoadCard
          isDark={isDark}
          actual={resolvedLoadChartData}
          invAccuracy={forecastAccuracy}
          invForward={loadForecast}
          gridAccuracy={gridAccuracy}
          hasEv={hasEv}
          hours={hours}
          onHoursChange={onHoursChange}
          onLeadChange={lead => onRefreshVsActual?.(lead)}
          solarStartMs={new Date(startOfSolarDayIST()).getTime()}
        />
      </div>
      <div style={{ display: phaseForecastSubTab === 'accuracy' ? 'block' : 'none', marginBottom: 12 }}>
        <LoadForecastAccuracySubTab accuracy={forecastAccuracy} isDark={isDark} />
      </div>
    </motion.div>
  );
};

export default PhaseLoadTab;
