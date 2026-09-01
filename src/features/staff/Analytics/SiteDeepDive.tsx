import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Zap, TrendingUp, ShieldAlert, Activity, Sun, Gauge, type LucideIcon } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getDesignTokens } from '../../../shared/theme';
import { apiService } from '../../../services/api';
import { useDebouncedValue } from '../../../shared/hooks/useDebounce';
import EnergyFlowSnapshot from './sections/EnergyFlowSnapshot';
import PerformanceSection from './sections/PerformanceSection';
import GridReliabilitySection from './sections/GridReliabilitySection';
import PowerQualitySection from './sections/PowerQualitySection';
import SolarResourceSection from './sections/SolarResourceSection';
import UtilizationSection from './sections/UtilizationSection';
import type { AnalyticsSite, AnalyticsWindow, DataQualityGap, EnergySummaryCombined, ForecastRow, TelemetryRow } from './types';

interface Props {
  sites: AnalyticsSite[];
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
}

const WINDOWS: { key: AnalyticsWindow; label: string; days: number }[] = [
  { key: '24h', label: 'Last 24h', days: 1 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
];

type SectionKey = 'energy' | 'performance' | 'grid' | 'power-quality' | 'solar' | 'utilization';

const SECTION_TABS: { key: SectionKey; label: string; icon: LucideIcon }[] = [
  { key: 'energy',        label: 'Energy Flow',      icon: Zap },
  { key: 'performance',   label: 'Performance',      icon: TrendingUp },
  { key: 'grid',          label: 'Grid Reliability', icon: ShieldAlert },
  { key: 'power-quality', label: 'Power Quality',    icon: Activity },
  { key: 'solar',         label: 'Solar Resource',   icon: Sun },
  { key: 'utilization',   label: 'Utilization',      icon: Gauge },
];

function windowRange(win: AnalyticsWindow, customStart: string, customEnd: string): { start: Date; end: Date } | null {
  if (win === 'custom') {
    if (!customStart || !customEnd) return null;
    const start = new Date(customStart);
    const end = new Date(customEnd + 'T23:59:59');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    return { start, end };
  }
  const end = new Date();
  const days = WINDOWS.find(w => w.key === win)?.days ?? 7;
  const start = new Date(end.getTime() - days * 86_400_000);
  return { start, end };
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

interface DeepDiveData {
  telemetry: TelemetryRow[];
  forecast: ForecastRow[];
  gaps: DataQualityGap[];
  uptime: { rollingAvgUptimePct: number | null } | null;
  energySummary: EnergySummaryCombined | null;
  forecastAccuracy: any;
  latest: any | null;
  smartDevices: any[];
  ctReading: any | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: DeepDiveData = {
  telemetry: [], forecast: [], gaps: [], uptime: null, energySummary: null,
  forecastAccuracy: null, latest: null, smartDevices: [], ctReading: null,
  loading: true, error: null,
};

export default function SiteDeepDive({ sites, selectedSiteId, onSelectSite }: Props) {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  const [win, setWin] = useState<AnalyticsWindow>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const debouncedStart = useDebouncedValue(customStart, { delay: 500 });
  const debouncedEnd = useDebouncedValue(customEnd, { delay: 500 });
  const [data, setData] = useState<DeepDiveData>(INITIAL);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('energy');

  const site = useMemo(() => sites.find(s => s.site_id === selectedSiteId) ?? null, [sites, selectedSiteId]);

  const load = useCallback(async (showSpinner: boolean) => {
    if (!selectedSiteId) return;
    const range = windowRange(win, debouncedStart, debouncedEnd);
    if (!range) return; // custom range selected but not fully/validly entered yet
    if (showSpinner) setData(d => ({ ...d, loading: true, error: null }));
    try {
      const { start, end } = range;
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const uptimeDays = win === 'custom' ? daysBetween(start, end) : (WINDOWS.find(w => w.key === win)?.days ?? 7);
      const spanMs = end.getTime() - start.getTime();

      // Live 5-min telemetry for short windows (≤24h — DynamoDB's live path);
      // S3-backed 15-min-aggregated history for anything longer, matching
      // SiteDataPanel's own aggregate-selection convention.
      const useRawTelemetry = spanMs <= 24 * 3_600_000;
      const telemetryPromise = useRawTelemetry
        ? apiService.getSiteTelemetry(selectedSiteId, { start_date: startIso, end_date: endIso, aggregate: '5min' })
        : apiService.getSiteHistory(selectedSiteId, { start_date: startIso, end_date: endIso, aggregate: '15min' });

      const [telemetry, forecast, gaps, uptime, energySummary, forecastAccuracy, overview] = await Promise.all([
        telemetryPromise.catch(() => []),
        apiService.getSiteForecast(selectedSiteId, { start_date: startIso, end_date: endIso }).catch(() => []),
        apiService.getSiteDataQualityGaps(selectedSiteId, startIso, endIso).catch(() => []),
        apiService.getSiteUptime(selectedSiteId, uptimeDays).catch(() => null),
        apiService.getEnergySummaryCombined(selectedSiteId).catch(() => null),
        apiService.getForecastAccuracy(selectedSiteId, 30).catch(() => null),
        apiService.getStaffOverview(selectedSiteId).catch(() => null),
      ]);

      setData({
        telemetry: Array.isArray(telemetry) ? telemetry : [],
        forecast: Array.isArray(forecast) ? forecast : [],
        gaps: Array.isArray(gaps) ? gaps : [],
        uptime,
        energySummary,
        forecastAccuracy,
        latest: overview?.realtime ?? null,
        smartDevices: Array.isArray(overview?.smart_devices) ? overview!.smart_devices : [],
        ctReading: overview?.energy_meter_latest ?? null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setData(d => ({ ...d, loading: false, error: err instanceof Error ? err.message : 'Failed to load analytics' }));
    }
  }, [selectedSiteId, win, debouncedStart, debouncedEnd]);

  useEffect(() => {
    load(true);
    const iv = setInterval(() => { if (!document.hidden) load(false); }, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!selectedSiteId) {
    return <div style={{ padding: 40, textAlign: 'center', color: tokens.textMuted }}>Select a site to view its analytics.</div>;
  }

  const inputStyle: React.CSSProperties = {
    background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 8,
    padding: '6px 10px', fontSize: '0.78rem', color: tokens.text, fontWeight: 600,
  };

  const latestTelemetryTs = data.latest?.latest_telemetry?.timestamp
    ?? (data.telemetry.length ? data.telemetry[data.telemetry.length - 1].timestamp : null);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setPickerOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
              borderRadius: 10, border: `1px solid ${tokens.border}`, background: tokens.surface,
              color: tokens.text, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            {site?.display_name ?? selectedSiteId}
            <ChevronDown size={14} />
          </button>
          {pickerOpen && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, zIndex: 10, minWidth: 220,
              background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 10,
              boxShadow: tokens.shadow, maxHeight: 320, overflowY: 'auto',
            }}>
              {sites.map(s => (
                <button
                  key={s.site_id}
                  onClick={() => { onSelectSite(s.site_id); setPickerOpen(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                    background: s.site_id === selectedSiteId ? tokens.primarySoft : 'transparent',
                    border: 'none', cursor: 'pointer', color: tokens.text, fontSize: '0.85rem',
                  }}
                >
                  {s.display_name} <span style={{ color: tokens.textDim, fontSize: '0.75rem' }}>· {s.site_id}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: tokens.surfaceMuted }}>
            {WINDOWS.map(w => (
              <button
                key={w.key}
                onClick={() => setWin(w.key)}
                style={{
                  border: 'none', borderRadius: 6, cursor: 'pointer', padding: '6px 12px',
                  fontSize: '0.78rem', fontWeight: 600,
                  background: win === w.key ? tokens.surface : 'transparent',
                  color: win === w.key ? tokens.text : tokens.textMuted,
                }}
              >
                {w.label}
              </button>
            ))}
            <button
              onClick={() => setWin('custom')}
              style={{
                border: 'none', borderRadius: 6, cursor: 'pointer', padding: '6px 12px',
                fontSize: '0.78rem', fontWeight: 600,
                background: win === 'custom' ? tokens.surface : 'transparent',
                color: win === 'custom' ? tokens.text : tokens.textMuted,
              }}
            >
              Custom
            </button>
          </div>
          {win === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={inputStyle} />
              <span style={{ color: tokens.textMuted, fontSize: '0.78rem' }}>to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={inputStyle} />
            </div>
          )}
        </div>
      </div>

      {win === 'custom' && !windowRange(win, debouncedStart, debouncedEnd) && (
        <div style={{ padding: 12, borderRadius: 10, background: tokens.surfaceMuted, color: tokens.textMuted, marginBottom: 16, fontSize: '0.82rem' }}>
          Pick a start and end date (end after start) to load this range.
        </div>
      )}

      {data.error && (
        <div style={{ padding: 14, borderRadius: 10, background: tokens.dangerSoft, color: tokens.danger, marginBottom: 16, fontSize: '0.85rem' }}>
          {data.error}
        </div>
      )}

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: `1px solid ${tokens.border}`, overflowX: 'auto' }}>
        {SECTION_TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeSection === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '10px 14px', fontSize: '0.82rem', fontWeight: 700,
                color: active ? tokens.primary : tokens.textMuted,
                borderBottom: active ? `2px solid ${tokens.primary}` : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {data.loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ height: 240, borderRadius: 16, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />
        </div>
      ) : (
        <>
          {activeSection === 'energy' && (
            <EnergyFlowSnapshot
              siteId={selectedSiteId}
              telemetry={data.telemetry}
              win={win}
              smartDevices={data.smartDevices}
              ctReading={data.ctReading}
            />
          )}
          {activeSection === 'performance' && (
            <PerformanceSection telemetry={data.telemetry} forecast={data.forecast} forecastAccuracy={data.forecastAccuracy} />
          )}
          {activeSection === 'grid' && (
            <GridReliabilitySection
              gaps={data.gaps}
              availabilityPct={data.uptime?.rollingAvgUptimePct ?? null}
              latestTelemetryTs={latestTelemetryTs}
            />
          )}
          {activeSection === 'power-quality' && <PowerQualitySection telemetry={data.telemetry} />}
          {activeSection === 'solar' && <SolarResourceSection telemetry={data.telemetry} capacityKw={site?.capacity_kw} />}
          {activeSection === 'utilization' && <UtilizationSection telemetry={data.telemetry} capacityKw={site?.capacity_kw} />}
        </>
      )}
    </div>
  );
}
