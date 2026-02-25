/**
 * SiteDataPanel — reusable panel that fetches and visualises DynamoDB data
 * for a solar site. Accepts a siteId prop and shows:
 *  - 4 live KPI cards (PV power, battery SOC, load, energy today)
 *  - 24 h power history area chart
 *  - Today's ML forecast with p10/p50/p90 confidence bands
 *  - Latest weather observation
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import html2canvas from 'html2canvas';
import { apiService } from '../services/api';
// Custom tooltip for forecast chart
const ForecastTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.9)', 
        backdropFilter: 'blur(8px)',
        border: '1px solid #f3f4f6', 
        borderRadius: 12, 
        padding: '0.75rem 1rem', 
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', 
        minWidth: 160 
      }}>
        <div style={{ 
          fontFamily: 'Urbanist, sans-serif', 
          fontWeight: 700, 
          color: '#111827', 
          fontSize: '0.9rem',
          marginBottom: '0.5rem',
          borderBottom: '1px solid #f3f4f6',
          paddingBottom: '0.25rem'
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {payload.map((entry: any) => (
            <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', color: '#374151' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color || entry.stroke || entry.fill }}></span>
                <span style={{ fontWeight: 600 }}>{entry.name.split(' ')[0]}</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#111827' }}>
                {Number(entry.value).toFixed(2)} {entry.name.includes('Temp') ? '°C' : entry.name.includes('GHI') ? 'W/m²' : 'kW'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(ts: string, range: string): string {
  // Format timestamp based on date range
  try {
    const date = new Date(ts);
    if (range === '24h') {
      // "14:30"
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (range === '7d') {
      // "Mon 14:00" for 7 days
      return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      // "Feb 23" for 30d or custom
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  } catch { return ts; }
}

function fmtForecast(ts: string, forecastFor?: string): string {
  // Use forecast_for if available, otherwise parse from timestamp
  // "FORECAST#2026-02-23T14:30:00Z" → "14:30"
  const cleanTs = forecastFor || ts.replace('FORECAST#', '');
  try {
    return new Date(cleanTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return cleanTs; }
}

function aggregateByPeriod(data: any[], range: string): any[] {
  // Aggregate telemetry data based on date range
  if (!data || data.length === 0) return [];
  
  if (range === '24h') {
    // 24h: downsample to ~48 points (every other 15-min = 30-min)
    return data.filter((_, i) => i % 2 === 0 || i === data.length - 1);
  } else if (range === '7d') {
    // 7d: aggregate by hour (~168 points max)
    const buckets = new Map<string, any[]>();
    data.forEach(row => {
      const date = new Date(row.timestamp);
      const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      if (!buckets.has(hourKey)) buckets.set(hourKey, []);
      buckets.get(hourKey)!.push(row);
    });
    
    return Array.from(buckets.values()).map(bucket => {
      const first = bucket[0];
      return {
        timestamp: first.timestamp,
        pv1_power_w: bucket.reduce((sum, r) => sum + (r.pv1_power_w ?? 0), 0) / bucket.length,
        pv2_power_w: bucket.reduce((sum, r) => sum + (r.pv2_power_w ?? 0), 0) / bucket.length,
        load_power_w: bucket.reduce((sum, r) => sum + (r.load_power_w ?? 0), 0) / bucket.length,
        grid_power_w: bucket.reduce((sum, r) => sum + (r.grid_power_w ?? 0), 0) / bucket.length,
        battery_soc_percent: bucket.reduce((sum, r) => sum + (r.battery_soc_percent ?? 0), 0) / bucket.length,
        pv_today_kwh: first.pv_today_kwh,
      };
    });
  } else {
    // 30d or custom: aggregate by day (max 30-90 points)
    const buckets = new Map<string, any[]>();
    data.forEach(row => {
      const date = new Date(row.timestamp);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!buckets.has(dayKey)) buckets.set(dayKey, []);
      buckets.get(dayKey)!.push(row);
    });
    
    return Array.from(buckets.values()).map(bucket => {
      const first = bucket[0];
      // For daily aggregation, use averages for instantaneous values, max for daily energy
      return {
        timestamp: first.timestamp,
        pv1_power_w: bucket.reduce((sum, r) => sum + (r.pv1_power_w ?? 0), 0) / bucket.length,
        pv2_power_w: bucket.reduce((sum, r) => sum + (r.pv2_power_w ?? 0), 0) / bucket.length,
        load_power_w: bucket.reduce((sum, r) => sum + (r.load_power_w ?? 0), 0) / bucket.length,
        grid_power_w: bucket.reduce((sum, r) => sum + (r.grid_power_w ?? 0), 0) / bucket.length,
        battery_soc_percent: bucket.reduce((sum, r) => sum + (r.battery_soc_percent ?? 0), 0) / bucket.length,
        pv_today_kwh: Math.max(...bucket.map(r => r.pv_today_kwh ?? 0)),
      };
    });
  }
}

const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(0,166,62,0.15)',
  borderRadius: 10,
  color: '#0a0a0a',
  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
  fontSize: 12,
};

// ── tiny inline icons ─────────────────────────────────────────────────────────
const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F07522" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" fill="#FFD600" stroke="#F07522" strokeWidth="1.5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
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

// ── sub-components ────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
}
const KpiCard: React.FC<KpiCardProps> = ({ label, value, unit, sub, accent, icon }) => (
  <div className="card" style={{ padding: '1.1rem', flex: 1, minWidth: 130 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>{label}</span>
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>{icon}</span>
    </div>
    <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '1.55rem', fontWeight: 800, color: '#0a0a0a', lineHeight: 1 }}>
      {value}
      {unit && <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#9ca3af', marginLeft: 4 }}>{unit}</span>}
    </p>
    {sub && <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>{sub}</p>}
  </div>
);

// ── data table component ──────────────────────────────────────────────────────

const ForecastTable = ({ data }: { data: any[] }) => (
  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>
      <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
        <tr>
          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>Time</th>
          <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#f59e0b', borderBottom: '1px solid #e5e7eb' }}>P10 (Low)</th>
          <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#00a63e', borderBottom: '1px solid #e5e7eb' }}>P50 (Median)</th>
          <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#3b82f6', borderBottom: '1px solid #e5e7eb' }}>P90 (High)</th>
          
          <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#eab308', borderBottom: '1px solid #e5e7eb' }}>GHI (W/m²)</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ padding: '0.6rem 1rem', color: '#111827', fontFamily: 'JetBrains Mono, monospace' }}>{row.time}</td>
            <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: '#4b5563' }}>{row.p10?.toFixed(2) ?? '-'}</td>
            <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{row.p50?.toFixed(2) ?? '-'}</td>
            <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: '#4b5563' }}>{row.p90?.toFixed(2) ?? '-'}</td>
            
            <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: '#4b5563' }}>{row.ghi?.toFixed(0) ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  siteId: string;
  /** If true, auto-refreshes every 60 s */
  autoRefresh?: boolean;
}

const SiteDataPanel: React.FC<Props> = ({ siteId, autoRefresh = false }) => {
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Date range controls

  // Interactive forecast band toggles
  const [showBands, setShowBands] = useState<{ [key: string]: boolean }>({
    P10: true,
    P50: true,
    P90: true,
  });
  const [dateRange, setDateRange] = useState<string>('24h'); // '24h' | '7d' | '30d' | 'custom'
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [forecastView, setForecastView] = useState<'chart' | 'table'>('chart');
  // Zoom feature removed

  // Zoom feature removed

  const fetchAll = useCallback(async () => {
    try {
      // Calculate date range parameters for telemetry
      let telemetryParams: any = {};
      
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        telemetryParams = {
          start_date: new Date(customStartDate).toISOString(),
          end_date: new Date(customEndDate).toISOString(),
        };
      } else if (dateRange === '7d') {
        telemetryParams = { days: 7 };
      } else if (dateRange === '30d') {
        telemetryParams = { days: 30 };
      } else {
        // Default 24h
        telemetryParams = {};
      }
      
      // Fetch forecast for the correct date range
      let forecastParams: any = {};
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        forecastParams = {
          start_date: new Date(customStartDate).toISOString(),
          end_date: new Date(customEndDate).toISOString(),
        };
      } else if (dateRange === '7d') {
        // Last 7 days: start_date = 6 days ago, end_date = today
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 6);
        forecastParams = {
          start_date: start.toISOString().split('T')[0] + 'T00:00:00Z',
          end_date: end.toISOString().split('T')[0] + 'T23:59:59Z',
        };
      } else if (dateRange === '30d') {
        // Last 30 days: start_date = 29 days ago, end_date = today
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 29);
        forecastParams = {
          start_date: start.toISOString().split('T')[0] + 'T00:00:00Z',
          end_date: end.toISOString().split('T')[0] + 'T23:59:59Z',
        };
      } else {
        // Default: today only
        forecastParams = {};
      }

      const [tel, fcst, wth] = await Promise.all([
        apiService.getSiteTelemetry(siteId, telemetryParams),
        apiService.getSiteForecast(siteId, forecastParams),
        apiService.getSiteWeather(siteId),
      ]);
      
      // Debug logging
      console.log('[SiteDataPanel] Forecast API response:', fcst);
      console.log('[SiteDataPanel] Forecast count:', Array.isArray(fcst) ? fcst.length : 'not array');
      if (Array.isArray(fcst) && fcst.length > 0) {
        console.log('[SiteDataPanel] First forecast item:', fcst[0]);
      }
      
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

  // ── derived values ──────────────────────────────────────────────────────────
  const latest = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;

  const pvKw    = latest ? ((latest.pv1_power_w ?? 0) + (latest.pv2_power_w ?? 0)) / 1000 : null;
  const batSoc  = latest?.battery_soc_percent ?? null;
  const loadKw  = latest ? (latest.load_power_w ?? 0) / 1000 : null;
  const todayKwh = latest?.pv_today_kwh ?? null;

  // History chart: aggregate based on date range
  const aggregated = aggregateByPeriod(telemetry, dateRange);
  const historyData = aggregated.map(row => ({
    time: fmt(row.timestamp, dateRange),
    'PV (kW)': +((( row.pv1_power_w ?? 0) + (row.pv2_power_w ?? 0)) / 1000).toFixed(2),
    'Load (kW)': +((row.load_power_w ?? 0) / 1000).toFixed(2),
    'Grid (kW)': +((row.grid_power_w ?? 0) / 1000).toFixed(2),
    'Batt SOC (%)': row.battery_soc_percent ?? null,
  }));

  // Forecast chart
  const forecastData = forecast.map(row => {
    // For multi-day, show date + time; for 1 day, just time
    let label = '';
    if (dateRange === '7d' || dateRange === '30d' || dateRange === 'custom') {
      const cleanTs = row.forecast_for || row.timestamp.replace('FORECAST#', '');
      const d = new Date(cleanTs);
      label = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      label = fmtForecast(row.timestamp, row.forecast_for);
    }
    return {
      time: label,
      p50: row.p50_kw != null ? +row.p50_kw.toFixed(3) : null,
      p10: row.p10_kw != null ? +row.p10_kw.toFixed(3) : null,
      p90: row.p90_kw != null ? +row.p90_kw.toFixed(3) : null,
      // Only use weather fields from forecast record
      temp: row.temperature_c != null ? +row.temperature_c : null,
      ghi: row.ghi_input_wm2 != null ? +row.ghi_input_wm2 : null,
    };
  });

  // Calculate total forecasted energy for the day using trapezoidal integration
  let forecastEnergyP10 = 0, forecastEnergyP50 = 0, forecastEnergyP90 = 0;
  let forecastGeneratedAt: Date | null = null;
  
  if (forecast.length > 1) {
    // Extract forecast generation time from first record (if available)
    const firstForecast = forecast[0];
    if (firstForecast.generated_at) {
      forecastGeneratedAt = new Date(firstForecast.generated_at);
    } else if (firstForecast.timestamp) {
      // Use first timestamp as approximation
      const ts = firstForecast.timestamp.replace('FORECAST#', '');
      // Forecast is typically generated at midnight or early morning for the day
      forecastGeneratedAt = new Date(ts.split('T')[0] + 'T00:00:00Z');
    }
    
    // Use trapezoidal rule: energy = Σ[(power[i] + power[i+1]) / 2 × Δt]
    for (let i = 0; i < forecast.length - 1; i++) {
      const t1 = new Date(forecast[i].timestamp.replace('FORECAST#', '')).getTime();
      const t2 = new Date(forecast[i + 1].timestamp.replace('FORECAST#', '')).getTime();
      const intervalHours = Math.abs(t2 - t1) / (1000 * 60 * 60);
      
      // Trapezoidal integration: average of two consecutive power values × time interval
      if (forecast[i].p10_kw != null && forecast[i + 1].p10_kw != null) {
        forecastEnergyP10 += (forecast[i].p10_kw + forecast[i + 1].p10_kw) / 2 * intervalHours;
      }
      if (forecast[i].p50_kw != null && forecast[i + 1].p50_kw != null) {
        forecastEnergyP50 += (forecast[i].p50_kw + forecast[i + 1].p50_kw) / 2 * intervalHours;
      }
      if (forecast[i].p90_kw != null && forecast[i + 1].p90_kw != null) {
        forecastEnergyP90 += (forecast[i].p90_kw + forecast[i + 1].p90_kw) / 2 * intervalHours;
      }
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '1.5rem 0' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card skeleton" style={{ flex: 1, minWidth: 130, height: 96 }} />
          ))}
        </div>
        <div className="card skeleton" style={{ height: 220, marginBottom: '1rem' }} />
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

  // Check if we have any meaningful data (including forecast)
  const noData = telemetry.length === 0 && forecast.length === 0 && !weather;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <p className="dash-section-label" style={{ margin: 0 }}>Live Site Intelligence — <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00a63e' }}>{siteId}</span></p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Date range selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={{
                background: 'var(--card-bg, #fff)',
                border: '1px solid rgba(0,166,62,0.2)',
                borderRadius: 8,
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                color: 'var(--text-color, #0a0a0a)',
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
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{
                    background: 'var(--card-bg, #fff)',
                    border: '1px solid rgba(0,166,62,0.2)',
                    borderRadius: 8,
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.72rem',
                    color: 'var(--text-color, #0a0a0a)',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                  }}
                />
                <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{
                    background: 'var(--card-bg, #fff)',
                    border: '1px solid rgba(0,166,62,0.2)',
                    borderRadius: 8,
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.72rem',
                    color: 'var(--text-color, #0a0a0a)',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                  }}
                />
              </>
            )}
          </div>
          
          {lastUpdated && (
            <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchAll(); }}
            style={{ background: 'none', border: '1px solid rgba(0,166,62,0.2)', borderRadius: 8, padding: '0.2rem 0.6rem', fontSize: '0.72rem', color: '#00a63e', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {noData ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', background: 'rgba(0,166,62,0.03)', borderRadius: 12, border: '1px dashed rgba(0,166,62,0.15)' }}>
          No DynamoDB data found for site <strong style={{ color: '#00a63e' }}>{siteId}</strong> in the {
            dateRange === '24h' ? 'today' :
            dateRange === '7d' ? 'last 7 days' :
            dateRange === '30d' ? 'last 30 days' : 'selected date range'
          }.<br />
          <span style={{ fontSize: '0.78rem' }}>Data is written by the ML forecast scheduler when the device is actively posting telemetry.</span>
        </div>
      ) : (
        <>
          {/* ── KPI strip ── */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <KpiCard label="PV Power"     value={pvKw != null ? pvKw.toFixed(2) : '—'}         unit="kW"  sub="Current generation"   accent="#F07522" icon={<IconSun />}     />
            <KpiCard label="Battery SOC"  value={batSoc != null ? batSoc.toFixed(1) : '—'}      unit="%"   sub="State of charge"       accent="#00a63e" icon={<IconBattery />} />
            <KpiCard label="Load"         value={loadKw != null ? loadKw.toFixed(2) : '—'}      unit="kW"  sub="Current consumption"   accent="#8b5cf6" icon={<IconLoad />}    />
            <KpiCard label="Energy Today" value={todayKwh != null ? todayKwh.toFixed(2) : '—'}  unit="kWh" sub="Solar yield today"     accent="#10b981" icon={<IconEnergy />}  />
          </div>

          {/* ── Weather pill row ── */}
          {weather?.current && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {[
                { label: 'Temp', value: weather.current.temperature_c != null ? `${Number(weather.current.temperature_c).toFixed(1)} °C` : null },
                { label: 'Humidity', value: weather.current.humidity_pct != null ? `${weather.current.humidity_pct} %` : null },
                { label: 'Cloud', value: weather.current.cloud_cover_pct != null ? `${weather.current.cloud_cover_pct} %` : null, icon: <IconCloud /> },
                { label: 'Wind', value: weather.current.wind_speed_ms != null ? `${Number(weather.current.wind_speed_ms).toFixed(1)} m/s` : null },
                { label: 'GHI', value: weather.current.ghi_wm2 != null ? `${Math.round(weather.current.ghi_wm2)} W/m²` : null },
              ].filter(p => p.value != null).map(p => (
                <span key={p.label} style={{
                  fontSize: '0.72rem', fontWeight: 600, fontFamily: 'Poppins, sans-serif',
                  padding: '0.2rem 0.65rem', borderRadius: 99,
                  background: 'rgba(0,166,62,0.07)', border: '1px solid rgba(0,166,62,0.12)',
                  color: '#007a55', display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}>
                  {p.icon}{p.label}: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0a0a0a' }}>{p.value}</span>
                </span>
              ))}
            </div>
          )}

          {/* ── History chart ── */}
          {historyData.length > 0 && (
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.9rem', fontFamily: 'Urbanist, sans-serif', color: '#0a0a0a' }}>
                  Power History — {
                    dateRange === '24h' ? 'Today' :
                    dateRange === '7d' ? 'Last 7 days' :
                    dateRange === '30d' ? 'Last 30 days' :
                    dateRange === 'custom' && customStartDate && customEndDate ? 
                      `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}` :
                      'Custom range'
                  }
                </h3>
                {(dateRange === '7d' || dateRange === '30d' || dateRange === 'custom') && (
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>
                    {dateRange === '7d' ? 'Data aggregated by hour' : 'Data aggregated by day'}
                  </p>
                )}
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 4, right: 8, left: 0, bottom: dateRange === '7d' || dateRange === '30d' ? 20 : 0 }}>
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
                      dataKey="time" 
                      stroke="#9ca3af" 
                      fontSize={dateRange === '30d' ? 9 : 10} 
                      interval={dateRange === '24h' ? 'preserveStartEnd' : Math.ceil(historyData.length / 10)}
                      angle={dateRange === '7d' || dateRange === '30d' ? -15 : 0}
                      textAnchor={dateRange === '7d' || dateRange === '30d' ? 'end' : 'middle'}
                    />
                    <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={v => `${v}kW`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: any) => [`${v} ${name && name.includes('%') ? '%' : 'kW'}`, name]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins, sans-serif' }} />
                    <Area type="monotone" dataKey="PV (kW)"   stroke="#F07522" strokeWidth={2} fill="url(#pvGrad)"   dot={false} />
                    <Area type="monotone" dataKey="Load (kW)" stroke="#8b5cf6" strokeWidth={2} fill="url(#loadGrad)" dot={false} />
                    <Line type="monotone" dataKey="Grid (kW)" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {forecastData.length > 0 && (
            <div className="card" style={{ padding: 0, boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', borderRadius: 16, background: '#ffffff', overflow: 'hidden' }}>
              {/* Header Bar */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to right, #ffffff, #f9fafb)' }}>
                {/* Left: Title & Stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,166,62,0.1)', color: '#00a63e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🔆</div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Urbanist, sans-serif', color: '#111827', fontWeight: 700 }}>Solar Forecast</h3>
                    </div>
                    {forecastEnergyP50 > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '2.5rem' }}>
                         <span style={{ fontSize: '0.85rem', color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>Est. Yield:</span>
                         <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 600, color: '#111827', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                           {forecastEnergyP10.toFixed(1)} <span style={{color:'#9ca3af'}}>/</span> <span style={{color: '#00a63e'}}>{forecastEnergyP50.toFixed(1)}</span> <span style={{color:'#9ca3af'}}>/</span> {forecastEnergyP90.toFixed(1)} kWh
                         </span>
                      </div>
                    )}
                </div>

                {/* Right: Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* View Toggle */}
                  <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
                    <button 
                      onClick={() => setForecastView('chart')}
                      style={{ 
                        border: 'none', background: forecastView === 'chart' ? '#fff' : 'transparent', 
                        color: forecastView === 'chart' ? '#00a63e' : '#6b7280', borderRadius: 6,
                        padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        boxShadow: forecastView === 'chart' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}>
                      Chart
                    </button>
                     <button 
                      onClick={() => setForecastView('table')}
                      style={{ 
                        border: 'none', background: forecastView === 'table' ? '#fff' : 'transparent', 
                        color: forecastView === 'table' ? '#00a63e' : '#6b7280', borderRadius: 6,
                        padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        boxShadow: forecastView === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}>
                      Table
                    </button>
                  </div>

                  {forecastView === 'chart' && (
                    <>
                      {/* Toggle Pills */}
                      <div style={{ display: 'flex', background: '#f3f4f6', padding: 3, borderRadius: 8 }}>
                        {[{ label: 'P10', color: '#f59e0b', tooltip: 'Conservative' }, { label: 'P50', color: '#00a63e', tooltip: 'Median' }, { label: 'P90', color: '#3b82f6', tooltip: 'Optimistic' }].map(b => (
                           <button
                             key={b.label}
                             onClick={() => setShowBands(s => ({ ...s, [b.label]: !s[b.label] }))}
                             style={{
                               border: 'none',
                               background: showBands[b.label] ? '#ffffff' : 'transparent',
                               color: showBands[b.label] ? b.color : '#9ca3af',
                               boxShadow: showBands[b.label] ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                               borderRadius: 6,
                               padding: '0.35rem 0.75rem',
                               fontSize: '0.75rem',
                               fontWeight: 600,
                               cursor: 'pointer',
                               transition: 'all 0.2s ease',
                               display: 'flex', alignItems: 'center', gap: 4
                             }}
                             title={`Toggle ${b.tooltip} Forecast`}
                           >
                             <span style={{ width: 6, height: 6, borderRadius: '50%', background: showBands[b.label] ? b.color : '#d1d5db' }} />
                             {b.label}
                           </button>
                        ))}
                      </div>

                      {/* Zoom feature removed: controls deleted */}
                    </>
                  )}

                  {/* Export Button */}
                  <button
                    onClick={async () => {
                      const chartDiv = document.getElementById('forecast-chart-container');
                      if (chartDiv) {
                        const canvas = await html2canvas(chartDiv, { background: '#ffffff', scale: 2 } as any); // Higher scale for better quality
                        const link = document.createElement('a');
                        link.download = `solar-forecast-${new Date().toISOString().slice(0,10)}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                      }
                    }}
                    style={{
                      background: 'transparent', border: '1px solid #e5e7eb', color: '#374151',
                      borderRadius: 8, padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>📷</span> <span>Save</span>
                  </button>
                </div>
              </div>

              {/* Chart/Table Area */}
              <div id="forecast-chart-container" style={{ padding: '0 1.5rem 1.5rem 0.5rem', background: '#ffffff', position: 'relative' }}>
                {forecastView === 'chart' ? (
                <div style={{ height: 300, width: '100%', userSelect: 'none' }}>
                  <ResponsiveContainer>
                    <AreaChart 
                      data={forecastData} 
                      margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#00a63e" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#00a63e" stopOpacity={0}/>
                        </linearGradient>
                         <linearGradient id="p90Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                         <linearGradient id="p10Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9ca3af" 
                        fontSize={11}
                        fontFamily="Inter, sans-serif" 
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                        tickMargin={12}
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        angle={0}
                        textAnchor="middle"
                        allowDataOverflow
                        type="category"
                        tickFormatter={(val, index) => {
                          // Clean formatted ticks based on range
                          if (dateRange === '24h') return val; // Already HH:MM
                          
                          // Custom ticker to remove repeated dates:
                          const parts = val.split(' '); // ["Feb", "25", "14:00"]
                          if (parts.length >= 3) {
                             // "Feb 25 14:00"
                             // Simplest approach: show simplified date string
                             return `${parts[0]} ${parts[1]}`;
                          }
                          return val;
                        }}
                      />
                      <YAxis 
                        stroke="#9ca3af" 
                        fontSize={11}
                        fontFamily="Inter, sans-serif"
                        tickLine={false} 
                        axisLine={false} 
                        width={40}
                        tickFormatter={v => `${v}`} 
                        allowDataOverflow
//                        domain={['auto', 'auto']}
                        label={{ value: 'kW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10, offset: 0 }}
                      />
                      <Tooltip content={<ForecastTooltip />} cursor={{ stroke: '#00a63e', strokeWidth: 1, strokeDasharray: '4 4' }} animationDuration={300} wrapperStyle={{ pointerEvents: 'none' }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ right: 0, top: 0, fontSize: 12, color: '#6b7280', fontFamily: 'Inter, sans-serif' }} />
                      
                      {/* P90 (Optimistic) - Render first (back) */}
                      {showBands['P90'] && <Area type="monotone" dataKey="p90" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" fill="url(#p90Grad)" activeDot={false} name="P90 (Optimistic)" animationDuration={500} />}
                      
                      {/* P10 (Pessimistic) */}
                      {showBands['P10'] && <Area type="monotone" dataKey="p10" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" fill="url(#p10Grad)" activeDot={false} name="P10 (Reference)" animationDuration={500} />}

                      {/* P50 (Median) - Render last (front, boldest) */}
                      {showBands['P50'] && <Area type="monotone" dataKey="p50" stroke="#00a63e" strokeWidth={2.5} fill="url(#p50Grad)" activeDot={{r: 4, strokeWidth: 0}} name="P50 (Median)" animationDuration={800} />}
                      
                      <ReferenceLine x={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'NOW', position: 'top', fill: '#ef4444', fontSize: 10, fontWeight: 700 }} />
                      
                      {/* Zoom feature removed: ReferenceArea deleted */}

                      {/* Minimalist Brush (optional, user asked to remove slider bar but keep functionality, we keep minimal brush or rely on drag zoom. User said 'do all 3', so we keep brush but cleaner) 
                      <Brush 
                        dataKey="time" 
                        height={10} 
                        stroke="#e5e7eb" 
                        fill="#f9fafb" 
                        travellerWidth={6}
                        gap={1}
                        startIndex={0}
                        endIndex={forecastData.length - 1}
                        onChange={(metrics: any) => {
                           // Sync zoom state if brush moves
                        }}
                      />
                      */}
                    </AreaChart>
                  </ResponsiveContainer>
                  {/* Zoom Hint */}
                  <div style={{ position: 'absolute', bottom: 10, left: 24, fontSize: '0.65rem', color: '#9ca3af', background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: 4, pointerEvents: 'none' }}>
                    Tip: Click & drag on chart to zoom
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
        </>
      )}
    </div>
  );
};

export default SiteDataPanel;
