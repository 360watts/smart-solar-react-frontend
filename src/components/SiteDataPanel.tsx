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
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { apiService } from '../services/api';

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

function fmtForecast(ts: string): string {
  // "FORECAST#2026-02-23T14:30:00Z" → "14:30"
  const cleanTs = ts.replace('FORECAST#', '');
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
  const [dateRange, setDateRange] = useState<string>('24h'); // '24h' | '7d' | '30d' | 'custom'
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const fetchAll = useCallback(async () => {
    try {
      // Calculate date range parameters
      let telemetryParams: any = {};
      let forecastParams: any = {};
      
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        telemetryParams = {
          start_date: new Date(customStartDate).toISOString(),
          end_date: new Date(customEndDate).toISOString(),
        };
        forecastParams = {
          start_date: new Date(customStartDate).toISOString(),
          end_date: new Date(customEndDate).toISOString(),
        };
      } else if (dateRange === '7d') {
        telemetryParams = { days: 7 };
        // For forecast, get today's forecast
        forecastParams = {};
      } else if (dateRange === '30d') {
        telemetryParams = { days: 30 };
        forecastParams = {};
      } else {
        // Default 24h
        telemetryParams = {};
        forecastParams = {};
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
  const forecastData = forecast.map(row => ({
    time: fmtForecast(row.timestamp),
    p50: row.p50_kw != null ? +row.p50_kw.toFixed(3) : null,
    p10: row.p10_kw != null ? +row.p10_kw.toFixed(3) : null,
    p90: row.p90_kw != null ? +row.p90_kw.toFixed(3) : null,
  }));

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
              <option value="24h">Last 24 hours</option>
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
          No DynamoDB data found for site <strong style={{ color: '#00a63e' }}>{siteId}</strong> in the last 24 h.<br />
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
          {weather && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {[
                { label: 'Temp', value: weather.temperature_c != null ? `${weather.temperature_c.toFixed(1)} °C` : null },
                { label: 'Humidity', value: weather.humidity_pct != null ? `${weather.humidity_pct} %` : null },
                { label: 'Cloud', value: weather.cloud_cover_pct != null ? `${weather.cloud_cover_pct} %` : null, icon: <IconCloud /> },
                { label: 'Wind', value: weather.wind_speed_ms != null ? `${weather.wind_speed_ms.toFixed(1)} m/s` : null },
                { label: 'GHI', value: weather.ghi_wm2 != null ? `${Math.round(weather.ghi_wm2)} W/m²` : null },
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
                    dateRange === '24h' ? 'Last 24 hours' :
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
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) => [`${v} ${name.includes('%') ? '%' : 'kW'}`, name]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins, sans-serif' }} />
                    <Area type="monotone" dataKey="PV (kW)"   stroke="#F07522" strokeWidth={2} fill="url(#pvGrad)"   dot={false} />
                    <Area type="monotone" dataKey="Load (kW)" stroke="#8b5cf6" strokeWidth={2} fill="url(#loadGrad)" dot={false} />
                    <Line type="monotone" dataKey="Grid (kW)" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Forecast chart ── */}
          {forecastData.length > 0 && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontFamily: 'Urbanist, sans-serif', color: '#0a0a0a' }}>
                  Today's Solar Forecast
                </h3>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {[{ label: 'P10 pessimistic', color: '#fbbf24' }, { label: 'P50 median', color: '#00a63e' }, { label: 'P90 optimistic', color: '#4ade80' }].map(b => (
                    <span key={b.label} style={{ fontSize: '0.67rem', fontWeight: 600, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'Poppins, sans-serif' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00a63e" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#00a63e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,166,62,0.08)" />
                    <XAxis dataKey="time" stroke="#9ca3af" fontSize={10} interval="preserveStartEnd" />
                    <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={v => `${v}kW`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} kW`]} />
                    {/* Confidence band: p90 filled down to p10 */}
                    <Area type="monotone" dataKey="p90" stroke="#4ade80" strokeWidth={1} strokeDasharray="4 3" fill="rgba(74,222,128,0.08)" dot={false} />
                    <Area type="monotone" dataKey="p50" stroke="#00a63e" strokeWidth={2} fill="url(#p50Grad)" dot={false} />
                    <Area type="monotone" dataKey="p10" stroke="#fbbf24" strokeWidth={1} strokeDasharray="4 3" fill="none" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SiteDataPanel;
