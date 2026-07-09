/**
 * HistoryTab — extracted from SiteDataPanel.tsx
 * Contains: HistoryTable, VsActualTable, HistoryTab (default export)
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { Line as CJLine } from 'react-chartjs-2';
import { type ChartOptions } from 'chart.js';
import { makeGradient, useChartZoomState, ZoomResetButton } from '../chartUtils';
import ChartCard from '../components/ChartCard';
import { type HistorySeriesKey, type VsActualSeriesKey } from '../types';
import { useTheme } from '../../../../contexts/ThemeContext';

// ── HISTORY_SERIES ─────────────────────────────────────────────────────────────

export const HISTORY_SERIES = [
  { key: 'PV', label: 'PV' },
  { key: 'Load', label: 'Load' },
  { key: 'Grid', label: 'Grid' },
  { key: 'InvOut', label: 'Inv Out' },
  { key: 'SOC', label: 'SOC' },
] as const;

const VS_ACTUAL_SERIES = [
  { key: 'Actual', label: 'Actual' },
  { key: 'P50', label: 'P50' },
  { key: 'Delta', label: 'Δ %' },
] as const;

// ── HistoryTable ───────────────────────────────────────────────────────────────

const HistoryTable = ({ data }: { data: { time: string; 'PV (kW)': number; 'Load (kW)': number; 'Grid (kW)': number; 'Inv Out (kW)': number; 'Batt SOC (%)': number | null }[] }) => {
  const { isDark } = useTheme();
  const theadBg = isDark ? 'rgba(15, 23, 42, 0.95)' : '#f9fafb';
  const rowBorder = isDark ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid #f3f4f6';

  return (
    <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto', borderRadius: 12, border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'var(--border-strong)'}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', minWidth: 520 }}>
        <thead style={{ position: 'sticky', top: 0, background: theadBg, zIndex: 1 }}>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'var(--border-strong)'}` }}>Time</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#F07522', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'var(--border-strong)'}` }}>PV (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#8b5cf6', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'var(--border-strong)'}` }}>Load (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#3b82f6', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'var(--border-strong)'}` }}>Grid (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#f43f5e', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'var(--border-strong)'}` }}>Inv Out (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#00a63e', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'var(--border-strong)'}` }}>Batt SOC (%)</th>
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

// ── VsActualTable ──────────────────────────────────────────────────────────────

const VsActualTable = ({ data }: { data: { label: string; p50: number | null; actual: number | null; diffPct?: number | null }[] }) => {
  const { isDark } = useTheme();
  const theadBg = isDark ? 'rgba(15, 23, 42, 0.95)' : '#f9fafb';
  const rowBorder = isDark ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid #f3f4f6';

  return (
    <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto', borderRadius: 12, border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'var(--border-strong)'}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', minWidth: 520 }}>
        <thead style={{ position: 'sticky', top: 0, background: theadBg, zIndex: 1 }}>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'var(--border-strong)'}` }}>Time</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#F07522', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'var(--border-strong)'}` }}>Actual PV (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#00a63e', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'var(--border-strong)'}` }}>P50 Forecast (kW)</th>
            <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'var(--border-strong)'}` }}>Δ %</th>
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

// ── HistoryTabProps ────────────────────────────────────────────────────────────

interface HistoryTabProps {
  telemetry: any[];
  isDark: boolean;
  isTouch: boolean;
  historyError: string | null;
  dateRange: string;
  setDateRange: (v: string) => void;
  customStartDate: string;
  setCustomStartDate: (v: string) => void;
  customEndDate: string;
  setCustomEndDate: (v: string) => void;
  historyView: 'chart' | 'table';
  setHistoryView: (v: 'chart' | 'table') => void;
  vsActualView: 'chart' | 'table';
  setVsActualView: (v: 'chart' | 'table') => void;
  vsActual7d: boolean;
  setVsActual7d: (v: boolean) => void;
  showHistorySeries: Record<HistorySeriesKey, boolean>;
  setShowHistorySeries: React.Dispatch<React.SetStateAction<Record<HistorySeriesKey, boolean>>>;
  showVsActualSeries: Record<VsActualSeriesKey, boolean>;
  setShowVsActualSeries: React.Dispatch<React.SetStateAction<Record<VsActualSeriesKey, boolean>>>;
  historyZoom: ReturnType<typeof useChartZoomState>;
  vsActualZoom: ReturnType<typeof useChartZoomState>;
  historyChartOptions: ChartOptions<'line'>;
  vsActualChartOptions: ChartOptions<'line'>;
  // Computed data passed from SiteDataPanel
  historyData: any[];
  historyResolutionLabel: string;
  historyStatsVisible: {
    pvTotal: number;
    pvPeak: number;
    invOutPeak: number;
    invOutAvg: number;
    loadTotal: number;
    loadPeak: number;
    gridImport: number;
    gridExport: number;
    socAvg: number | null;
  } | null;
  loading: boolean;
  activeVsActualData: { label: string; p50: number | null; actual: number | null; diffPct?: number | null; fTs?: number }[];
  siteId: string;
  onToggleVsActual7d: () => void;
}

// ── HistoryTab ─────────────────────────────────────────────────────────────────

const HistoryTab: React.FC<HistoryTabProps> = ({
  isDark,
  historyError,
  historyView,
  setHistoryView,
  showHistorySeries,
  setShowHistorySeries,
  historyZoom,
  historyData,
  historyResolutionLabel,
  loading,
  historyChartOptions,
  historyStatsVisible,
  vsActual7d,
  onToggleVsActual7d,
  vsActualView,
  setVsActualView,
  showVsActualSeries,
  setShowVsActualSeries,
  vsActualZoom,
  activeVsActualData,
  vsActualChartOptions,
  dateRange,
}) => {
  const tabTransition = { type: 'spring', stiffness: 320, damping: 30 };

  return (
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
        subtitle={dateRange === '24h' ? `Solar day 06:00 → 06:00 IST · ${historyData.length} pts · drag to zoom` : `${historyData.length} data points · ${historyResolutionLabel} buckets · drag to zoom`}
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
              color: historyResolutionLabel === '5 min' ? '#00a63e' : (isDark ? '#d4e8f8' : '#374151'),
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

      {/* Forecast vs Actual section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16, marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif', color: 'var(--text-primary)' }}>
          Forecast vs Actual — {vsActual7d ? 'Last 7 Days' : 'Today'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onToggleVsActual7d}
            aria-pressed={vsActual7d}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 8,
              border: `1px solid ${vsActual7d ? (isDark ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.4)') : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.2)')}`,
              background: vsActual7d ? (isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)') : 'transparent',
              color: vsActual7d ? (isDark ? '#fcd34d' : '#92400e') : (isDark ? '#b8d0ec' : '#374151'),
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
          border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.25)'}`,
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
    </motion.div>
  );
};

export default HistoryTab;
