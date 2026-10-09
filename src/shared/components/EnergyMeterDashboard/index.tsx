// src/shared/components/EnergyMeterDashboard/index.tsx
// Dashboard for a standalone CT energy-meter gateway device — distinct from
// SiteDataPanel (inverter/PV/battery). Meters have no PV, no battery, no
// run_state; they only ever report three-phase V/I/frequency/power/PF.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip as CJTooltip, Legend as CJLegend, Filler,
  type ChartOptions, type TooltipItem,
} from 'chart.js';
import { Line as CJLine } from 'react-chartjs-2';
import ZoomPlugin from 'chartjs-plugin-zoom';
import { Zap, Gauge } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getDesignTokens } from '../../theme';
import { resolveCssVar } from '../../lib/resolveCssVar';
import { apiService, CtMeterReading } from '../../../services/api';
import ChartCard from '../SiteDataPanel/components/ChartCard';
import { useChartZoomState, ZoomResetButton, createDragZoomPlugins } from '../SiteDataPanel/chartUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, CJTooltip, CJLegend, Filler, ZoomPlugin);

const PHASE_COLORS = { l1: '#f59e0b', l2: '#3b82f6', l3: '#a855f7' } as const;

interface Props {
  siteId: string;
  autoRefresh?: boolean;
}

function fmt(v: number | null | undefined, digits = 1): string {
  return v == null ? '—' : v.toFixed(digits);
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  return (
    <div style={{
      flex: 1, minWidth: 108, padding: '12px 14px', borderRadius: 12,
      background: tokens.surfaceMuted, border: `1px solid ${tokens.border}`,
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: tokens.textDim }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {value}<span style={{ fontSize: '0.75rem', fontWeight: 600, color: tokens.textMuted, marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  );
}

function PhaseRow({ label, l1, l2, l3, unit, digits }: { label: string; l1: number | null | undefined; l2: number | null | undefined; l3: number | null | undefined; unit: string; digits?: number }) {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${tokens.border}` }}>
      <div style={{ width: 90, fontSize: '0.78rem', fontWeight: 700, color: tokens.textMuted }}>{label}</div>
      {[['L1', l1, PHASE_COLORS.l1], ['L2', l2, PHASE_COLORS.l2], ['L3', l3, PHASE_COLORS.l3]].map(([tag, v, color]) => (
        <div key={tag as string} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color as string, flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: tokens.text, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(v as number | null, digits)}<span style={{ fontSize: '0.75rem', color: tokens.textDim, marginLeft: 2 }}>{unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const EnergyMeterDashboard: React.FC<Props> = ({ siteId, autoRefresh = true }) => {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  const [latest, setLatest] = useState<CtMeterReading | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const zoom = useChartZoomState();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [l, h] = await Promise.all([
        apiService.getLatestEnergyMeter(siteId),
        apiService.getEnergyMeterHistory(siteId, {
          start_date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          end_date: new Date().toISOString(),
          aggregate: '5min',
        }).catch(() => []),
      ]);
      if (cancelled) return;
      setLatest(l);
      setHistory(Array.isArray(h) ? h : []);
      setLoading(false);
    };
    load();
    if (!autoRefresh) return;
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [siteId, autoRefresh]);

  const isStale = latest ? Date.now() - new Date(latest.timestamp).getTime() > 5 * 60 * 1000 : true;

  const chartData = useMemo(() => ({
    labels: history.map(r => new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [
      { label: 'L1', data: history.map(r => r.active_power_l1), borderColor: PHASE_COLORS.l1, backgroundColor: `${PHASE_COLORS.l1}26`, fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.75 },
      { label: 'L2', data: history.map(r => r.active_power_l2), borderColor: PHASE_COLORS.l2, backgroundColor: `${PHASE_COLORS.l2}20`, fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.75 },
      { label: 'L3', data: history.map(r => r.active_power_l3), borderColor: PHASE_COLORS.l3, backgroundColor: `${PHASE_COLORS.l3}20`, fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.75 },
    ],
  }), [history]);

  const chartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: resolveCssVar('--muted-foreground'), font: { size: 11 }, boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: {
        backgroundColor: resolveCssVar('--popover'), titleColor: resolveCssVar('--foreground'), bodyColor: resolveCssVar('--muted-foreground'),
        borderColor: 'rgba(245,158,11,0.25)', borderWidth: 1, padding: 8,
        callbacks: { label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${Number(item.parsed.y ?? 0).toFixed(0)} W` },
      },
      zoom: createDragZoomPlugins(() => zoom.onZoomComplete.current()),
    } as any,
    scales: {
      x: { ticks: { color: resolveCssVar('--muted-foreground'), font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
      y: { ticks: { color: resolveCssVar('--muted-foreground'), font: { size: 10 }, callback: (v: any) => `${v} W` }, grid: { display: false } },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Live snapshot */}
      <div style={{
        borderRadius: 18, padding: '18px 20px', marginBottom: 16,
        background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(24px)', border: `1px solid ${tokens.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color="#f59e0b" />
            <span style={{ fontSize: '1rem', fontWeight: 800, color: tokens.text }}>Energy Meter — Live</span>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
            fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
            background: isStale ? 'rgba(245,158,11,0.12)' : 'rgba(15,159,143,0.12)',
            color: isStale ? '#f59e0b' : '#0F9F8F', border: `1px solid ${isStale ? 'rgba(245,158,11,0.3)' : 'rgba(15,159,143,0.3)'}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isStale ? '#f59e0b' : '#0F9F8F' }} />
            {loading ? 'Loading…' : isStale ? 'Not updating' : 'Live'}
          </span>
        </div>

        {!loading && !latest && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: tokens.textMuted, fontSize: '0.875rem' }}>
            No readings yet for this meter.
          </div>
        )}

        {latest && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <StatCard label="Active Power" value={fmt(latest.active_power_total, 0)} unit="W" color="#f59e0b" />
              <StatCard label="Reactive Power" value={fmt(latest.reactive_power_total, 0)} unit="VAR" color="#3b82f6" />
              <StatCard label="Apparent Power" value={fmt(latest.apparent_power_total, 0)} unit="VA" color="#a855f7" />
              <StatCard label="Power Factor" value={fmt(latest.power_factor_total, 2)} unit="" color={tokens.text} />
            </div>

            <PhaseRow label="Voltage" l1={latest.voltage_l1} l2={latest.voltage_l2} l3={latest.voltage_l3} unit="V" digits={0} />
            <PhaseRow label="Current" l1={latest.current_l1} l2={latest.current_l2} l3={latest.current_l3} unit="A" digits={2} />
            <PhaseRow label="Power" l1={latest.active_power_l1} l2={latest.active_power_l2} l3={latest.active_power_l3} unit="W" digits={0} />
            <div style={{ paddingTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: tokens.textDim, fontSize: '0.75rem' }}>
              <Gauge size={12} />
              Frequency {fmt(latest.frequency_l1, 1)} / {fmt(latest.frequency_l2, 1)} / {fmt(latest.frequency_l3, 1)} Hz
            </div>
          </>
        )}
      </div>

      {/* 24h power trend */}
      <ChartCard title="Power (24h)" subtitle="Per-phase active power · drag to zoom" isDark={isDark} height={220} accentColor="#f59e0b" isLoading={loading}>
        {history.length > 0 ? (
          <>
            <ZoomResetButton visible={zoom.isZoomed} onClick={zoom.resetZoom} overlay />
            <CJLine ref={zoom.chartRef} data={chartData} options={chartOptions} />
          </>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.textMuted, fontSize: '0.85rem' }}>
            No history for this window
          </div>
        )}
      </ChartCard>
    </div>
  );
};

export default EnergyMeterDashboard;
