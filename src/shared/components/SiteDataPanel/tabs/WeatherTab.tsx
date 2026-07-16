/**
 * WeatherTab — extracted from SiteDataPanel.tsx
 * Contains: WeatherAccuracySubTab, WeatherTab (default export)
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CloudSun, BarChart2, Target } from 'lucide-react';
import { Line as CJLine, Bar as CJBar } from 'react-chartjs-2';
import { type ChartOptions, type TooltipItem } from 'chart.js';
import { makeGradient, useChartZoomState, ZoomResetButton, createDragZoomPlugins } from '../chartUtils';
import ChartCard from '../components/ChartCard';
import WeatherHourlyStrip from '../components/WeatherHourlyStrip';

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
          padding: 40, textAlign: 'center', color: 'var(--muted-foreground)',
          borderRadius: 16, fontSize: '0.875rem',
          background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(249,250,251,0.8)',
          border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,166,62,0.15)'}`,
        }}
      >
        <BarChart2 size={28} style={{ marginBottom: 10 }} />
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
        backgroundColor: 'var(--popover)',
        titleColor: 'var(--foreground)',
        bodyColor: 'var(--muted-foreground)',
        borderColor: 'rgba(234,179,8,0.2)', borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold' as const, size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'bar'>) => ` ${Number(item.parsed.y).toFixed(1)} W/m²` },
      },
      zoom: createDragZoomPlugins(() => ghiErrorZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: 'var(--muted-foreground)', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
      y: { ticks: { color: 'var(--muted-foreground)', font: { size: 11 } }, grid: { display: false } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const panelBg: React.CSSProperties = {
    padding: 20, borderRadius: 20,
    background: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.97)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.06)',
  };

  const tempChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'var(--popover)',
        titleColor: 'var(--foreground)',
        bodyColor: 'var(--muted-foreground)',
        borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold' as const, size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => ` ${Number(item.parsed.y).toFixed(2)}°C` },
      },
      zoom: createDragZoomPlugins(() => tempErrorZoom.onZoomComplete.current()),
    },
    scales: {
      x: { ticks: { color: 'var(--muted-foreground)', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
      y: { ticks: { color: 'var(--muted-foreground)', font: { size: 11 }, callback: (v: any) => `${v}°` }, grid: { display: false } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  if (!accuracy || !accuracy.records?.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ ...panelBg, padding: 48, textAlign: 'center', color: 'var(--muted-foreground)' }}
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
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', fontFamily: 'Poppins, sans-serif', marginBottom: 3 }}>{c.label}</div>
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

// ── WeatherTab ─────────────────────────────────────────────────────────────────

interface WeatherTabProps {
  weather: any;
  isDark: boolean;
  weatherSubTab: 'current' | 'accuracy';
  setWeatherSubTab: (v: 'current' | 'accuracy') => void;
  weatherAccuracy: any;
}

const WeatherTab: React.FC<WeatherTabProps> = ({
  weather,
  isDark,
  weatherSubTab,
  setWeatherSubTab,
  weatherAccuracy,
}) => {
  const tabTransition = { type: 'spring', stiffness: 320, damping: 30 };

  return (
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
            border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.25)'}`,
          }}
        >
          <p style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
            color: 'var(--muted-foreground)',
            borderRadius: 16,
            background: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(249, 250, 251, 0.8)',
            border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.25)'}`,
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
  );
};

export default WeatherTab;
