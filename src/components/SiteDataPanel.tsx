/**
 * SiteDataPanel — solar site intelligence panel
 *
 * Sections:
 *  - 6 live KPI cards: PV power, Battery (SOC + charge state), Load,
 *    Energy Today, Grid (import/export), Inverter Temperature
 *  - Daily energy breakdown: PV yield, grid buy/sell, battery in/out, consumption
 *  - Current weather pills
 *  - 24 h weather outlook (hourly scrollable strip)
 *  - Power history area chart with Battery SOC on secondary axis
 *  - Solar forecast card: P10/P50/P90 + physics baseline, regime tags, % achieved
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import html2canvas from 'html2canvas';
import { apiService } from '../services/api';

// ── Custom forecast tooltip ────────────────────────────────────────────────────

const ForecastTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)',
      border: '1px solid #f3f4f6', borderRadius: 12,
      padding: '0.75rem 1rem',
      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
      minWidth: 175,
    }}>
      <div style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 700, color: '#111827', fontSize: '0.85rem', marginBottom: '0.4rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {payload.map((entry: any) => {
          const unit = entry.name?.includes('Temp') ? '°C' : entry.name?.includes('GHI') ? 'W/m²' : 'kW';
          return (
            <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', color: '#374151' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: entry.color || entry.stroke || entry.fill, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{entry.name?.split(' ')[0]}</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#111827' }}>
                {Number(entry.value).toFixed(3)} {unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(ts: string, range: string): string {
  try {
    const d = new Date(ts);
    if (range === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (range === '7d')  return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return ts; }
}

function fmtForecast(ts: string, forecastFor?: string): string {
  const clean = forecastFor || ts.replace('FORECAST#', '');
  try { return new Date(clean).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return clean; }
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
      load_power_w:         avg('load_power_w'),
      grid_power_w:         avg('grid_power_w'),
      battery_soc_percent:  avg('battery_soc_percent'),
      battery_power_w:      avg('battery_power_w'),
      pv_today_kwh:         isDay ? Math.max(...bucket.map(r => r.pv_today_kwh ?? 0)) : first.pv_today_kwh,
    };
  });
}

const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(0,166,62,0.15)',
  borderRadius: 10, color: '#0a0a0a',
  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
  fontSize: 12,
};

// ── Icons ──────────────────────────────────────────────────────────────────────

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F07522" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" fill="#FFD600" stroke="#F07522" strokeWidth="1.5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
  </svg>
);
const IconBattery = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="6" width="18" height="12" rx="2"/>
    <line x1="23" y1="13" x2="23" y2="11"/>
    <rect x="3" y="8" width="10" height="8" fill="currentColor" rx="1"/>
  </svg>
);
const IconLoad = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IconEnergy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);
const IconCloud = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
  </svg>
);
const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconThermometer = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
  </svg>
);

// ── KPI Card ───────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string; value: string; unit?: string; sub?: string;
  accent: string; icon: React.ReactNode; badge?: React.ReactNode;
}
const KpiCard: React.FC<KpiCardProps> = ({ label, value, unit, sub, accent, icon, badge }) => (
  <div className="card" style={{ padding: '1.1rem', flex: 1, minWidth: 140 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>{label}</span>
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>{icon}</span>
    </div>
    <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '1.5rem', fontWeight: 800, color: '#0a0a0a', lineHeight: 1 }}>
      {value}{unit && <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#9ca3af', marginLeft: 4 }}>{unit}</span>}
    </p>
    {sub   && <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>{sub}</p>}
    {badge && <div style={{ marginTop: '0.3rem' }}>{badge}</div>}
  </div>
);

// ── Weather Hourly Forecast Strip ──────────────────────────────────────────────

const WeatherHourlyStrip = ({ hourly }: { hourly: any[] }) => {
  if (!hourly || hourly.length === 0) return null;
  const icon = (cloud: number, ghi: number) =>
    ghi < 10 ? '🌙' : cloud > 75 ? '☁️' : cloud > 40 ? '⛅' : '☀️';

  return (
    <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
      <p style={{ margin: '0 0 0.65rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>
        24 h Weather Outlook
      </p>
      <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
        <div style={{ display: 'flex', gap: '0.45rem', minWidth: 'max-content' }}>
          {hourly.map((h, i) => {
            const time = (() => { try { return new Date(h.forecast_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })();
            const cloud  = h.cloud_cover_pct ?? 0;
            const ghi    = h.ghi_wm2 ?? 0;
            const temp   = Number(h.temperature_c ?? 0);
            const wind   = Number(h.wind_speed_ms ?? 0);
            const ghiPct = Math.min(100, (ghi / 900) * 100);
            const isNow  = i === 0;
            const wi     = icon(cloud, ghi);
            const ghiColor = ghi > 600 ? '#F07522' : ghi > 200 ? '#f59e0b' : '#d1d5db';
            return (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: isNow ? 'rgba(0,166,62,0.09)' : 'rgba(0,0,0,0.025)',
                border: `1px solid ${isNow ? 'rgba(0,166,62,0.28)' : 'rgba(0,0,0,0.07)'}`,
                borderRadius: 10, padding: '0.45rem 0.65rem', minWidth: 64, gap: '0.1rem',
                position: 'relative',
              }}>
                {isNow && (
                  <span style={{ position: 'absolute', top: -9, fontSize: '0.55rem', fontWeight: 700, background: '#00a63e', color: '#fff', padding: '1px 5px', borderRadius: 4, fontFamily: 'Poppins, sans-serif' }}>NOW</span>
                )}
                <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>{time}</span>
                <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>{wi}</span>
                <span style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#111827' }}>{temp.toFixed(1)}°</span>
                {/* GHI mini-bar */}
                <div title={`GHI ${Math.round(ghi)} W/m²`} style={{ width: '100%', height: 3, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden', margin: '2px 0' }}>
                  <div style={{ width: `${ghiPct}%`, height: '100%', background: ghiColor, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: '0.6rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>{Math.round(ghi)} W/m²</span>
                <span style={{ fontSize: '0.6rem', color: '#b0bec5', fontFamily: 'Poppins, sans-serif' }}>{wind.toFixed(1)} m/s</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Daily Energy Breakdown ─────────────────────────────────────────────────────

const EnergyBreakdownRow = ({ latest }: { latest: any }) => {
  if (!latest) return null;
  const items = [
    { label: 'PV Yield',    value: latest.pv_today_kwh,              color: '#F07522', bg: '#F0752212', icon: '☀' },
    { label: 'Grid In',     value: latest.grid_buy_today_kwh,         color: '#3b82f6', bg: '#3b82f612', icon: '⬇' },
    { label: 'Grid Out',    value: latest.grid_sell_today_kwh,        color: '#10b981', bg: '#10b98112', icon: '⬆' },
    { label: 'Batt Chg',    value: latest.batt_charge_today_kwh,      color: '#8b5cf6', bg: '#8b5cf612', icon: '↑' },
    { label: 'Batt Dchg',   value: latest.batt_discharge_today_kwh,   color: '#ec4899', bg: '#ec489912', icon: '↓' },
    { label: 'Consumption', value: latest.load_today_kwh,             color: '#6b7280', bg: '#6b728012', icon: '⌂' },
  ].filter(e => e.value != null);
  if (!items.length) return null;

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', fontFamily: 'Poppins, sans-serif', alignSelf: 'center', minWidth: 40 }}>Today</span>
      {items.map(e => (
        <span key={e.label} style={{
          fontSize: '0.72rem', fontWeight: 600, fontFamily: 'Poppins, sans-serif',
          padding: '0.2rem 0.65rem', borderRadius: 99,
          background: e.bg, border: `1px solid ${e.color}28`,
          color: e.color, display: 'flex', alignItems: 'center', gap: '0.3rem',
        }}>
          <span style={{ opacity: 0.85 }}>{e.icon}</span>
          {e.label}:&nbsp;
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0a0a0a' }}>{Number(e.value).toFixed(2)}</span>
          <span style={{ fontSize: '0.6rem', color: '#9ca3af' }}>kWh</span>
        </span>
      ))}
    </div>
  );
};

// ── Forecast Table ─────────────────────────────────────────────────────────────

const REGIME_STYLE: Record<string, { bg: string; color: string }> = {
  night:  { bg: '#1e293b1a', color: '#475569' },
  ramp:   { bg: '#f59e0b18', color: '#d97706' },
  midday: { bg: '#F0752218', color: '#c2410c' },
};

const ForecastTable = ({ data }: { data: any[] }) => (
  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>
      <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
        <tr>
          <th style={{ padding: '0.7rem 1rem', textAlign: 'left',   fontWeight: 600, color: '#4b5563',  borderBottom: '1px solid #e5e7eb' }}>Time</th>
          <th style={{ padding: '0.7rem 0.6rem', textAlign: 'center', fontWeight: 600, color: '#6b7280',  borderBottom: '1px solid #e5e7eb' }}>Regime</th>
          <th style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 600, color: '#f59e0b',  borderBottom: '1px solid #e5e7eb' }}>P10 ↓</th>
          <th style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 600, color: '#00a63e',  borderBottom: '1px solid #e5e7eb' }}>P50</th>
          <th style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 600, color: '#3b82f6',  borderBottom: '1px solid #e5e7eb' }}>P90 ↑</th>
          <th style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 600, color: '#9ca3af',  borderBottom: '1px solid #e5e7eb' }}>Physics</th>
          <th style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 600, color: '#eab308',  borderBottom: '1px solid #e5e7eb' }}>GHI W/m²</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => {
          const rc = row.regime ? (REGIME_STYLE[row.regime] ?? { bg: 'transparent', color: '#6b7280' }) : null;
          return (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '0.55rem 1rem', color: '#111827', fontFamily: 'JetBrains Mono, monospace' }}>{row.time}</td>
              <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                {row.regime && rc && (
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: rc.bg, color: rc.color, padding: '2px 6px', borderRadius: 4, fontFamily: 'Poppins, sans-serif' }}>
                    {row.regime}
                  </span>
                )}
              </td>
              <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', color: '#4b5563' }}>{row.p10?.toFixed(3) ?? '—'}</td>
              <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{row.p50?.toFixed(3) ?? '—'}</td>
              <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', color: '#4b5563' }}>{row.p90?.toFixed(3) ?? '—'}</td>
              <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', color: '#9ca3af', fontStyle: 'italic' }}>{row.physics?.toFixed(3) ?? '—'}</td>
              <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', color: '#4b5563' }}>{row.ghi?.toFixed(0) ?? '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  siteId: string;
  autoRefresh?: boolean;
}

const SiteDataPanel: React.FC<Props> = ({ siteId, autoRefresh = false }) => {
  const [telemetry,  setTelemetry]  = useState<any[]>([]);
  const [forecast,   setForecast]   = useState<any[]>([]);
  const [weather,    setWeather]    = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [showBands,       setShowBands]       = useState<Record<string, boolean>>({ P10: true, P50: true, P90: true });
  const [dateRange,       setDateRange]       = useState('24h');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate,   setCustomEndDate]   = useState('');
  const [forecastView,    setForecastView]    = useState<'chart' | 'table'>('chart');

  const fetchAll = useCallback(async () => {
    try {
      let telemetryParams: any = {};
      if      (dateRange === 'custom' && customStartDate && customEndDate) telemetryParams = { start_date: new Date(customStartDate).toISOString(), end_date: new Date(customEndDate).toISOString() };
      else if (dateRange === '7d')  telemetryParams = { days: 7 };
      else if (dateRange === '30d') telemetryParams = { days: 30 };

      let forecastParams: any = {};
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        forecastParams = { start_date: new Date(customStartDate).toISOString(), end_date: new Date(customEndDate).toISOString() };
      } else if (dateRange === '7d' || dateRange === '30d') {
        const days = dateRange === '7d' ? 6 : 29;
        const end = new Date(), start = new Date();
        start.setDate(end.getDate() - days);
        forecastParams = {
          start_date: start.toISOString().split('T')[0] + 'T00:00:00Z',
          end_date:   end.toISOString().split('T')[0]   + 'T23:59:59Z',
        };
      }

      const [tel, fcst, wth] = await Promise.all([
        apiService.getSiteTelemetry(siteId, telemetryParams),
        apiService.getSiteForecast(siteId, forecastParams),
        apiService.getSiteWeather(siteId),
      ]);

      setTelemetry(Array.isArray(tel) ? tel : []);
      setForecast(Array.isArray(fcst) ? fcst : []);
      setWeather(wth || null);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load site data');
    } finally {
      setLoading(false);
    }
  }, [siteId, dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
    if (!autoRefresh) return;
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll, autoRefresh]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const latest = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;

  const pvKw       = latest ? ((latest.pv1_power_w ?? 0) + (latest.pv2_power_w ?? 0)) / 1000 : null;
  const batSoc     = latest?.battery_soc_percent ?? null;
  const loadKw     = latest ? (latest.load_power_w    ?? 0) / 1000 : null;
  const todayKwh   = latest?.pv_today_kwh ?? null;
  const gridKw     = latest ? (latest.grid_power_w    ?? 0) / 1000 : null;
  const batPowerKw = latest ? (latest.battery_power_w ?? 0) / 1000 : null;
  const invTemp    = latest?.inverter_temp_c   ?? null;
  const batVoltage = latest?.battery_voltage_v ?? null;
  const runState   = latest?.run_state;

  const gridImporting  = gridKw     != null && gridKw     > 0.01;
  const gridExporting  = gridKw     != null && gridKw     < -0.01;
  const batCharging    = batPowerKw != null && batPowerKw > 0.01;
  const batDischarging = batPowerKw != null && batPowerKw < -0.01;

  const runStateBadge = runState != null ? (
    runState === 0 ? { label: 'Standby', color: '#9ca3af' } :
    runState === 1 ? { label: 'Online',  color: '#00a63e' } :
    runState === 2 ? { label: 'Warning', color: '#f59e0b' } :
    runState === 3 ? { label: 'Fault',   color: '#ef4444' } :
                     { label: `State ${runState}`, color: '#6b7280' }
  ) : null;

  const invTempColor = invTemp == null ? '#9ca3af'
    : invTemp > 60 ? '#ef4444'
    : invTemp > 45 ? '#f59e0b'
    : '#10b981';

  // ── Chart data ──────────────────────────────────────────────────────────────
  const aggregated  = aggregateByPeriod(telemetry, dateRange);
  const historyData = aggregated.map(row => ({
    time:           fmt(row.timestamp, dateRange),
    'PV (kW)':      +((( row.pv1_power_w ?? 0) + (row.pv2_power_w ?? 0)) / 1000).toFixed(2),
    'Load (kW)':    +((row.load_power_w ?? 0) / 1000).toFixed(2),
    'Grid (kW)':    +((row.grid_power_w ?? 0) / 1000).toFixed(2),
    'Batt SOC (%)': row.battery_soc_percent ?? null,
  }));

  const forecastData = forecast.map(row => {
    let label = '';
    if (dateRange !== '24h') {
      const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
      const d = new Date(clean);
      label = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      label = fmtForecast(row.timestamp, row.forecast_for);
    }
    return {
      time:    label,
      p50:     row.p50_kw            != null ? +Number(row.p50_kw).toFixed(3)            : null,
      p10:     row.p10_kw            != null ? +Number(row.p10_kw).toFixed(3)            : null,
      p90:     row.p90_kw            != null ? +Number(row.p90_kw).toFixed(3)            : null,
      physics: row.physics_baseline_kw != null ? +Number(row.physics_baseline_kw).toFixed(3) : null,
      ghi:     row.ghi_input_wm2     != null ? +row.ghi_input_wm2                       : null,
      temp:    row.temperature_c     != null ? +row.temperature_c                        : null,
      regime:  row.regime            ?? null,
    };
  });

  // Trapezoidal energy integration
  let fcastP10 = 0, fcastP50 = 0, fcastP90 = 0;
  let forecastGeneratedAt: Date | null = null;
  if (forecast.length > 1) {
    const first = forecast[0];
    if (first.generated_at) {
      forecastGeneratedAt = new Date(first.generated_at);
    } else if (first.timestamp) {
      forecastGeneratedAt = new Date(first.timestamp.replace('FORECAST#', '').split('T')[0] + 'T00:00:00Z');
    }
    for (let i = 0; i < forecast.length - 1; i++) {
      const h = Math.abs(
        new Date(forecast[i+1].timestamp.replace('FORECAST#', '')).getTime() -
        new Date(forecast[i].timestamp.replace('FORECAST#', '')).getTime()
      ) / 3_600_000;
      if (forecast[i].p10_kw != null && forecast[i+1].p10_kw != null) fcastP10 += (forecast[i].p10_kw + forecast[i+1].p10_kw) / 2 * h;
      if (forecast[i].p50_kw != null && forecast[i+1].p50_kw != null) fcastP50 += (forecast[i].p50_kw + forecast[i+1].p50_kw) / 2 * h;
      if (forecast[i].p90_kw != null && forecast[i+1].p90_kw != null) fcastP90 += (forecast[i].p90_kw + forecast[i+1].p90_kw) / 2 * h;
    }
  }

  const achievedPct = todayKwh != null && fcastP50 > 0
    ? Math.min(999, Math.round((todayKwh / fcastP50) * 100))
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '1.5rem 0' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[...Array(6)].map((_, i) => <div key={i} className="card skeleton" style={{ flex: 1, minWidth: 140, height: 100 }} />)}
        </div>
        <div className="card skeleton" style={{ height: 52, marginBottom: '0.75rem' }} />
        <div className="card skeleton" style={{ height: 130, marginBottom: '1rem' }} />
        <div className="card skeleton" style={{ height: 240, marginBottom: '1rem' }} />
        <div className="card skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239,68,68,0.06)', borderRadius: 10, marginTop: '1rem' }}>
        Failed to load DynamoDB data for <strong>{siteId}</strong>: {error}
      </div>
    );
  }

  const noData = telemetry.length === 0 && forecast.length === 0 && !weather;

  return (
    <div style={{ marginTop: '1.5rem' }}>

      {/* ── Section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <p className="dash-section-label" style={{ margin: 0 }}>
            Live Site Intelligence — <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00a63e' }}>{siteId}</span>
          </p>
          {runStateBadge && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              background: `${runStateBadge.color}18`, color: runStateBadge.color,
              padding: '2px 8px', borderRadius: 99, fontFamily: 'Poppins, sans-serif',
              border: `1px solid ${runStateBadge.color}30`,
            }}>
              ● {runStateBadge.label}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              style={{ background: 'var(--card-bg,#fff)', border: '1px solid rgba(0,166,62,0.2)', borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-color,#0a0a0a)', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              <option value="24h">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
            {dateRange === 'custom' && (<>
              <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}
                style={{ background: 'var(--card-bg,#fff)', border: '1px solid rgba(0,166,62,0.2)', borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-color,#0a0a0a)', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }} />
              <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>to</span>
              <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}
                style={{ background: 'var(--card-bg,#fff)', border: '1px solid rgba(0,166,62,0.2)', borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-color,#0a0a0a)', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }} />
            </>)}
          </div>
          {lastUpdated && (
            <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchAll(); }}
            style={{ background: 'none', border: '1px solid rgba(0,166,62,0.2)', borderRadius: 8, padding: '0.2rem 0.6rem', fontSize: '0.72rem', color: '#00a63e', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
          >↻ Refresh</button>
        </div>
      </div>

      {noData ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', background: 'rgba(0,166,62,0.03)', borderRadius: 12, border: '1px dashed rgba(0,166,62,0.15)' }}>
          No DynamoDB data found for site <strong style={{ color: '#00a63e' }}>{siteId}</strong> in the {
            dateRange === '24h' ? 'today' : dateRange === '7d' ? 'last 7 days' : dateRange === '30d' ? 'last 30 days' : 'selected date range'
          }.<br />
          <span style={{ fontSize: '0.78rem' }}>Data is written by the ML forecast scheduler when the device is actively posting telemetry.</span>
        </div>
      ) : (<>

        {/* ── 6-card KPI strip ── */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <KpiCard
            label="PV Power" value={pvKw != null ? pvKw.toFixed(2) : '—'} unit="kW"
            sub={latest?.pv1_power_w != null && latest?.pv2_power_w != null
              ? `S1: ${(latest.pv1_power_w/1000).toFixed(2)} · S2: ${(latest.pv2_power_w/1000).toFixed(2)} kW`
              : 'Current generation'}
            accent="#F07522" icon={<IconSun />}
          />
          <KpiCard
            label="Battery" value={batSoc != null ? batSoc.toFixed(1) : '—'} unit="%"
            sub={batVoltage != null ? `${batVoltage.toFixed(1)} V` : 'State of charge'}
            accent="#00a63e" icon={<IconBattery />}
            badge={batPowerKw != null && Math.abs(batPowerKw) > 0.01 ? (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: batCharging ? '#00a63e' : '#ec4899', fontFamily: 'Poppins, sans-serif' }}>
                {batCharging ? '⚡ Charging' : '⬇ Discharging'} {Math.abs(batPowerKw).toFixed(2)} kW
              </span>
            ) : <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>Idle</span>}
          />
          <KpiCard
            label="Load" value={loadKw != null ? loadKw.toFixed(2) : '—'} unit="kW"
            sub="Current consumption" accent="#8b5cf6" icon={<IconLoad />}
          />
          <KpiCard
            label="Energy Today" value={todayKwh != null ? todayKwh.toFixed(2) : '—'} unit="kWh"
            sub="Solar yield today" accent="#10b981" icon={<IconEnergy />}
          />
          <KpiCard
            label="Grid" value={gridKw != null ? Math.abs(gridKw).toFixed(2) : '—'} unit="kW"
            sub={latest?.grid_voltage_v != null
              ? `${Number(latest.grid_voltage_v).toFixed(0)} V · ${Number(latest.grid_frequency_hz ?? 0).toFixed(1)} Hz`
              : 'Grid power'}
            accent="#3b82f6" icon={<IconGrid />}
            badge={gridKw != null ? (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: gridImporting ? '#3b82f6' : gridExporting ? '#10b981' : '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>
                {gridImporting ? '⬇ Importing' : gridExporting ? '⬆ Exporting' : '↔ Standby'}
              </span>
            ) : undefined}
          />
          <KpiCard
            label="Inv. Temp" value={invTemp != null ? invTemp.toFixed(1) : '—'} unit="°C"
            sub={invTemp != null
              ? invTemp > 60 ? '🔴 Hot — check cooling' : invTemp > 45 ? '🟡 Warm' : '🟢 Normal'
              : 'No data'}
            accent={invTempColor} icon={<IconThermometer />}
          />
        </div>

        {/* ── Daily energy breakdown ── */}
        <EnergyBreakdownRow latest={latest} />

        {/* ── Current weather pills ── */}
        {weather?.current && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>Now</span>
            {[
              { label: 'Temp',     value: weather.current.temperature_c  != null ? `${Number(weather.current.temperature_c).toFixed(1)} °C`  : null },
              { label: 'Humidity', value: weather.current.humidity_pct   != null ? `${weather.current.humidity_pct} %`                        : null },
              { label: 'Cloud',    value: weather.current.cloud_cover_pct != null ? `${weather.current.cloud_cover_pct} %`                    : null, icon: <IconCloud /> },
              { label: 'Wind',     value: weather.current.wind_speed_ms  != null ? `${Number(weather.current.wind_speed_ms).toFixed(1)} m/s`  : null },
              { label: 'GHI',      value: weather.current.ghi_wm2        != null ? `${Math.round(weather.current.ghi_wm2)} W/m²`              : null },
            ].filter(p => p.value).map(p => (
              <span key={p.label} style={{
                fontSize: '0.72rem', fontWeight: 600, fontFamily: 'Poppins, sans-serif',
                padding: '0.2rem 0.65rem', borderRadius: 99,
                background: 'rgba(0,166,62,0.07)', border: '1px solid rgba(0,166,62,0.12)',
                color: '#007a55', display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}>
                {(p as any).icon}{p.label}: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0a0a0a' }}>{p.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* ── 24 h weather outlook ── */}
        {weather?.hourly_forecast && weather.hourly_forecast.length > 0 && (
          <WeatherHourlyStrip hourly={weather.hourly_forecast} />
        )}

        {/* ── Power history chart ── */}
        {historyData.length > 0 && (
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ margin: '0 0 0.2rem', fontSize: '0.9rem', fontFamily: 'Urbanist, sans-serif', color: '#0a0a0a' }}>
                Power History — {
                  dateRange === '24h'   ? 'Today' :
                  dateRange === '7d'    ? 'Last 7 days' :
                  dateRange === '30d'   ? 'Last 30 days' :
                  customStartDate && customEndDate
                    ? `${new Date(customStartDate).toLocaleDateString()} – ${new Date(customEndDate).toLocaleDateString()}`
                    : 'Custom range'
                }
              </h3>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>
                {dateRange === '7d' ? 'Hourly aggregates' : dateRange !== '24h' ? 'Daily aggregates' : '30-min samples'} · Battery SOC on right axis
              </p>
            </div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 4, right: 44, left: 0, bottom: dateRange === '7d' || dateRange === '30d' ? 20 : 0 }}>
                  <defs>
                    <linearGradient id="pvGrad"   x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F07522" stopOpacity={0.22}/>
                      <stop offset="95%" stopColor="#F07522" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.18}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,166,62,0.08)" />
                  <XAxis
                    dataKey="time" stroke="#9ca3af"
                    fontSize={dateRange === '30d' ? 9 : 10}
                    interval={dateRange === '24h' ? 'preserveStartEnd' : Math.ceil(historyData.length / 10)}
                    angle={dateRange === '7d' || dateRange === '30d' ? -15 : 0}
                    textAnchor={dateRange === '7d' || dateRange === '30d' ? 'end' : 'middle'}
                  />
                  <YAxis yAxisId="power" stroke="#9ca3af" fontSize={10} tickFormatter={(v: number) => `${v}kW`} />
                  <YAxis yAxisId="soc" orientation="right" stroke="#9ca3af" fontSize={10} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} width={36} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: any) => [`${v} ${String(name).includes('%') ? '%' : 'kW'}`, name]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins, sans-serif' }} />
                  <Area yAxisId="power" type="monotone" dataKey="PV (kW)"   stroke="#F07522" strokeWidth={2} fill="url(#pvGrad)"   dot={false} />
                  <Area yAxisId="power" type="monotone" dataKey="Load (kW)" stroke="#8b5cf6" strokeWidth={2} fill="url(#loadGrad)" dot={false} />
                  <Line  yAxisId="power" type="monotone" dataKey="Grid (kW)"     stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                  <Line  yAxisId="soc"   type="monotone" dataKey="Batt SOC (%)"  stroke="#00a63e" strokeWidth={1.5} dot={false} strokeDasharray="2 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Solar Forecast ── */}
        {forecastData.length > 0 && (
          <div className="card" style={{ padding: 0, boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', borderRadius: 16, background: '#ffffff', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to right,#ffffff,#f9fafb)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,166,62,0.1)', color: '#00a63e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🔆</div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Urbanist, sans-serif', color: '#111827', fontWeight: 700 }}>Solar Forecast</h3>
                </div>
                {fcastP50 > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: '2.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>Est. Yield:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', fontWeight: 600, color: '#111827', background: '#f3f4f6', padding: '2px 7px', borderRadius: 4 }}>
                      {fcastP10.toFixed(1)} <span style={{ color: '#9ca3af' }}>/</span> <span style={{ color: '#00a63e' }}>{fcastP50.toFixed(1)}</span> <span style={{ color: '#9ca3af' }}>/</span> {fcastP90.toFixed(1)} kWh
                    </span>
                    {achievedPct != null && (
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif',
                        padding: '2px 8px', borderRadius: 99,
                        background: achievedPct >= 80 ? '#10b98118' : achievedPct >= 40 ? '#f59e0b18' : '#e5e7eb',
                        color:      achievedPct >= 80 ? '#059669'  : achievedPct >= 40 ? '#d97706'  : '#9ca3af',
                        border:     `1px solid ${achievedPct >= 80 ? '#10b98128' : achievedPct >= 40 ? '#f59e0b28' : '#d1d5db'}`,
                      }}>
                        {achievedPct}% achieved
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Chart / Table toggle */}
                <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
                  {(['chart', 'table'] as const).map(v => (
                    <button key={v} onClick={() => setForecastView(v)} style={{ border: 'none', background: forecastView === v ? '#fff' : 'transparent', color: forecastView === v ? '#00a63e' : '#6b7280', borderRadius: 6, padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', boxShadow: forecastView === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', textTransform: 'capitalize' }}>
                      {v}
                    </button>
                  ))}
                </div>

                {/* Band toggles */}
                {forecastView === 'chart' && (
                  <div style={{ display: 'flex', background: '#f3f4f6', padding: 3, borderRadius: 8 }}>
                    {[{ label: 'P10', color: '#f59e0b' }, { label: 'P50', color: '#00a63e' }, { label: 'P90', color: '#3b82f6' }].map(b => (
                      <button key={b.label} onClick={() => setShowBands(s => ({ ...s, [b.label]: !s[b.label] }))} style={{ border: 'none', background: showBands[b.label] ? '#ffffff' : 'transparent', color: showBands[b.label] ? b.color : '#9ca3af', boxShadow: showBands[b.label] ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', borderRadius: 6, padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: showBands[b.label] ? b.color : '#d1d5db' }} />
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Export */}
                <button
                  onClick={async () => {
                    const el = document.getElementById('forecast-chart-container');
                    if (el) {
                      const canvas = await html2canvas(el, { background: '#ffffff', scale: 2 } as any);
                      const a = document.createElement('a');
                      a.download = `solar-forecast-${new Date().toISOString().slice(0,10)}.png`;
                      a.href = canvas.toDataURL(); a.click();
                    }
                  }}
                  style={{ background: 'transparent', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 8, padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
                  onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseOut={e  => e.currentTarget.style.background = 'transparent'}
                >
                  <span>📷</span><span>Save</span>
                </button>
              </div>
            </div>

            {/* Chart / Table area */}
            <div id="forecast-chart-container" style={{ padding: '0 1.5rem 1.5rem 0.5rem', background: '#ffffff', position: 'relative' }}>
              {forecastView === 'chart' ? (
                <div style={{ height: 300, width: '100%', userSelect: 'none' }}>
                  <ResponsiveContainer>
                    <AreaChart data={forecastData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#00a63e" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#00a63e" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="p90Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.14}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="p10Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.14}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="time" stroke="#9ca3af" fontSize={11} fontFamily="Inter, sans-serif"
                        tickLine={false} axisLine={false} minTickGap={30} tickMargin={12}
                        tick={{ fill: '#6b7280', fontSize: 11 }} textAnchor="middle"
                        allowDataOverflow type="category"
                        tickFormatter={(val: string) => {
                          if (dateRange === '24h') return val;
                          const p = val.split(' ');
                          return p.length >= 3 ? `${p[0]} ${p[1]}` : val;
                        }}
                      />
                      <YAxis
                        stroke="#9ca3af" fontSize={11} fontFamily="Inter, sans-serif"
                        tickLine={false} axisLine={false} width={40} allowDataOverflow
                        label={{ value: 'kW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
                      />
                      <Tooltip content={<ForecastTooltip />} cursor={{ stroke: '#00a63e', strokeWidth: 1, strokeDasharray: '4 4' }} animationDuration={300} wrapperStyle={{ pointerEvents: 'none' }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ right: 0, top: 0, fontSize: 12, color: '#6b7280', fontFamily: 'Inter, sans-serif' }} />

                      {showBands['P90'] && <Area type="monotone" dataKey="p90" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" fill="url(#p90Grad)" activeDot={false} name="P90 (Optimistic)" animationDuration={500} />}
                      {showBands['P10'] && <Area type="monotone" dataKey="p10" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" fill="url(#p10Grad)" activeDot={false} name="P10 (Conservative)" animationDuration={500} />}
                      {showBands['P50'] && <Area type="monotone" dataKey="p50" stroke="#00a63e" strokeWidth={2.5} fill="url(#p50Grad)" activeDot={{ r: 4, strokeWidth: 0 }} name="P50 (Median)" animationDuration={800} />}
                      <Line type="monotone" dataKey="physics" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Physics Baseline" activeDot={false} />

                      <ReferenceLine
                        x={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        stroke="#ef4444" strokeDasharray="3 3"
                        label={{ value: 'NOW', position: 'top', fill: '#ef4444', fontSize: 10, fontWeight: 700 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', bottom: 10, left: 24, fontSize: '0.62rem', color: '#9ca3af', background: 'rgba(255,255,255,0.85)', padding: '2px 6px', borderRadius: 4, pointerEvents: 'none' }}>
                    Dashed grey = physics baseline (ideal clear-sky output)
                  </div>
                </div>
              ) : (
                <ForecastTable data={forecastData} />
              )}
              {forecastGeneratedAt && (
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.5rem', fontFamily: 'Inter, sans-serif', padding: '0 1rem 1rem' }}>
                  Forecast generated: {forecastGeneratedAt.toLocaleDateString()} {forecastGeneratedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        )}

      </>)}
    </div>
  );
};

export default SiteDataPanel;
