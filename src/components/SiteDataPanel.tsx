/**
 * SiteDataPanel — solar site intelligence panel
 *
 * Tabs:
 *  - Overview: 6 live KPI cards + energy breakdown + insights
 *  - Weather:  current conditions + 24 h hourly outlook strip
 *  - History:  power area chart with Battery SOC on secondary axis
 *  - Forecast: P10/P50/P90 + physics baseline, regime tags, % achieved
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, ReferenceArea,
} from 'recharts';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

// ── Tabs ───────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview',  icon: '🏠' },
  { id: 'weather',   label: 'Weather',   icon: '🌤' },
  { id: 'history',   label: 'History',   icon: '📈' },
  { id: 'forecast',  label: 'Forecast',  icon: '🔆' },
] as const;
type TabId = typeof TABS[number]['id'];

// ── Custom forecast tooltip ────────────────────────────────────────────────────

const ForecastTooltip = ({ active, payload, label }: any) => {
  const { isDark } = useTheme();
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: isDark ? 'rgba(30,41,59,0.97)' : 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(8px)',
      border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#f3f4f6'}`,
      borderRadius: 12,
      padding: '0.75rem 1rem',
      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
      minWidth: 175,
    }}>
      <div style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827', fontSize: '0.85rem', marginBottom: '0.4rem', borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#f3f4f6'}`, paddingBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {payload.map((entry: any) => {
          const unit = entry.name?.includes('Temp') ? '°C' : entry.name?.includes('GHI') ? 'W/m²' : 'kW';
          return (
            <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', color: isDark ? '#94a3b8' : '#374151' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: entry.color || entry.stroke || entry.fill, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{entry.name?.split(' ')[0]}</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: isDark ? '#f1f5f9' : '#111827' }}>
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

// All time displays use IST (Asia/Kolkata, UTC+5:30) — the site is in India.
const IST = 'Asia/Kolkata';

/** Returns the ISO date string (YYYY-MM-DD) for a Date in IST, e.g. "2026-02-26" */
function istDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: IST }); // en-CA locale → YYYY-MM-DD
}

/**
 * Returns the YYYY-MM-DD string in IST that is N calendar days after today IST.
 * n=0 → today IST, n=1 → tomorrow IST, n=3 → 3 days from today IST.
 * Uses IST midnight as the reference so the result is always a clean calendar day.
 */
function istDateOffset(n: number): string {
  const IST_MS = 5.5 * 60 * 60 * 1000;               // UTC+5:30 in ms
  const nowIST = Date.now() + IST_MS;
  const istMidnightMS = Math.floor(nowIST / 86400000) * 86400000;  // floor to IST midnight
  return istDate(new Date(istMidnightMS + n * 86400000 - IST_MS)); // back to UTC Date
}

function fmt(ts: string, range: string): string {
  try {
    const d = new Date(ts);
    if (range === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
    if (range === '7d')  return d.toLocaleDateString([], { weekday: 'short', timeZone: IST }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: IST });
  } catch { return ts; }
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
      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>{label}</span>
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>{icon}</span>
    </div>
    <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
      {value}{unit && <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}
    </p>
    {sub   && <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>{sub}</p>}
    {badge && <div style={{ marginTop: '0.3rem' }}>{badge}</div>}
  </div>
);

// ── Weather Hourly Forecast Strip ──────────────────────────────────────────────

const WeatherHourlyStrip = ({ hourly }: { hourly: any[] }) => {
  if (!hourly || hourly.length === 0) return null;
  const icon = (cloud: number, ghi: number, precip: number | null) =>
    ghi < 10  ? '🌙' :
    precip != null && precip > 60 ? '🌧' :
    precip != null && precip > 30 ? (cloud > 40 ? '🌦' : '⛅') :
    cloud > 75 ? '☁️' : cloud > 40 ? '⛅' : '☀️';

  return (
    <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
      <p style={{ margin: '0 0 0.65rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
        24 h Weather Outlook
      </p>
      <div style={{ overflowX: 'auto', paddingTop: 14, paddingBottom: 2 }}>
        <div style={{ display: 'flex', gap: '0.45rem', minWidth: 'max-content' }}>
          {hourly.map((h, i) => {
            const time = (() => { try { return new Date(h.forecast_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }); } catch { return ''; } })();
            const cloud    = h.cloud_cover_pct ?? 0;
            const ghi      = h.ghi_wm2 ?? 0;
            const temp     = Number(h.temperature_c ?? 0);
            const wind     = Number(h.wind_speed_ms ?? 0);
            const humidity = h.humidity_pct != null ? Number(h.humidity_pct) : null;
            const precip   = h.precip_prob_pct != null ? Number(h.precip_prob_pct) : null;
            const ghiPct   = Math.min(100, (ghi / 900) * 100);
            const humPct   = humidity != null ? Math.min(100, humidity) : null;
            const isNow    = i === 0;
            const wi       = icon(cloud, ghi, precip);
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
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>{time}</span>
                <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>{wi}</span>
                <span style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{temp.toFixed(1)}°</span>
                {/* GHI mini-bar */}
                <div title={`GHI ${Math.round(ghi)} W/m²`} style={{ width: '100%', height: 3, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden', margin: '2px 0' }}>
                  <div style={{ width: `${ghiPct}%`, height: '100%', background: ghiColor, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>{Math.round(ghi)} W/m²</span>
                {/* Humidity bar */}
                {humPct != null && (
                  <>
                    <div title={`Humidity ${Math.round(humPct)}%`} style={{ width: '100%', height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden', margin: '2px 0' }}>
                      <div style={{ width: `${humPct}%`, height: '100%', background: humColor, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: '0.6rem', color: humColor, fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>💧{Math.round(humPct)}%</span>
                  </>
                )}
                {/* Precipitation probability bar */}
                {precip != null && (
                  <>
                    <div title={`Rain ${Math.round(precip)}%`} style={{ width: '100%', height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden', margin: '2px 0' }}>
                      <div style={{ width: `${precip}%`, height: '100%', background: precipColor, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: '0.6rem', color: precipColor, fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>🌧{Math.round(precip)}%</span>
                  </>
                )}
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>{wind.toFixed(1)} m/s</span>
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
      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', alignSelf: 'center', minWidth: 40 }}>Today</span>
      {items.map(e => (
        <span key={e.label} style={{
          fontSize: '0.72rem', fontWeight: 600, fontFamily: 'Poppins, sans-serif',
          padding: '0.2rem 0.65rem', borderRadius: 99,
          background: e.bg, border: `1px solid ${e.color}28`,
          color: e.color, display: 'flex', alignItems: 'center', gap: '0.3rem',
        }}>
          <span style={{ opacity: 0.85 }}>{e.icon}</span>
          {e.label}:&nbsp;
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{Number(e.value).toFixed(2)}</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>kWh</span>
        </span>
      ))}
    </div>
  );
};

// ── Solar Insights Row ─────────────────────────────────────────────────────────

const InsightsRow = ({ latest }: { latest: any }) => {
  if (!latest) return null;

  const pvKwh    = Number(latest.pv_today_kwh      ?? 0);
  const loadKwh  = Number(latest.load_today_kwh    ?? 0);
  const gridBuy  = Number(latest.grid_buy_today_kwh ?? 0);

  // Only render if we have at least PV data
  if (pvKwh === 0 && loadKwh === 0) return null;

  const co2Kg       = pvKwh * 0.82;  // India grid factor ~0.82 kg CO₂/kWh
  // Self-sufficiency = portion of load met by solar+battery (not from grid)
  const selfSufPct = loadKwh > 0
    ? Math.max(0, Math.min(100, Math.round(((loadKwh - gridBuy) / loadKwh) * 100)))
    : null;
  const gridDepPct  = loadKwh > 0
    ? Math.max(0, Math.min(100, Math.round((gridBuy / loadKwh) * 100)))
    : null;

  const items: { icon: string; label: string; value: string; sub?: string; color: string; bg: string }[] = [];

  if (pvKwh > 0) {
    items.push({
      icon: '🌿', label: 'CO₂ Avoided',
      value: co2Kg >= 1 ? `${co2Kg.toFixed(2)} kg` : `${(co2Kg * 1000).toFixed(0)} g`,
      sub: 'vs grid (0.82 kg/kWh)',
      color: '#10b981', bg: '#10b98110',
    });
  }
  if (selfSufPct != null) {
    const color = selfSufPct >= 70 ? '#00a63e' : selfSufPct >= 40 ? '#f59e0b' : '#ef4444';
    items.push({
      icon: '⚡', label: 'Self-Sufficiency',
      value: `${selfSufPct}%`,
      sub: 'load met by solar+battery',
      color, bg: `${color}10`,
    });
  }
  if (gridDepPct != null) {
    const color = gridDepPct <= 20 ? '#10b981' : gridDepPct <= 50 ? '#f59e0b' : '#ef4444';
    items.push({
      icon: '🔌', label: 'Grid Dependency',
      value: `${gridDepPct}%`,
      sub: 'portion from grid',
      color, bg: `${color}10`,
    });
  }

  if (!items.length) return null;

  return (
    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', alignSelf: 'center', minWidth: 40 }}>
        Insights
      </span>
      {items.map(item => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', gap: '0.55rem',
          padding: '0.35rem 0.85rem', borderRadius: 10,
          background: item.bg, border: `1px solid ${item.color}28`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>{item.icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: item.color, fontSize: '0.88rem', lineHeight: 1 }}>{item.value}</span>
            {item.sub && <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>{item.sub}</span>}
          </div>
        </div>
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

// XAxis tick for the forecast chart.
// 'today' view: time on line 1 (green bold), no line 2.
// '3d'/'7d' view: date on line 1 (green bold), time on line 2 (muted).
const ForecastXAxisTick = ({ x, y, payload, forecastWindow: fw }: any) => {
  const val: string = payload?.value ?? '';
  if (!val) return null;
  const isToday = fw === 'today';
  const line1 = isToday ? val : (val.split('||')[0] ?? val);
  const line2 = isToday ? '' : (val.split('||')[1] ?? '');

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

const ForecastTable = ({ data }: { data: any[] }) => {
  const { isDark } = useTheme();
  const theadBg  = isDark ? 'rgba(15,23,42,0.9)'  : '#f9fafb';
  const rowBorder = isDark ? '1px solid rgba(148,163,184,0.07)' : '1px solid #f3f4f6';
  return (
    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>
        <thead style={{ position: 'sticky', top: 0, background: theadBg, zIndex: 1 }}>
          <tr>
            <th style={{ padding: '0.7rem 1rem', textAlign: 'left',   fontWeight: 600, color: 'var(--text-secondary)',  borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e5e7eb'}` }}>Time</th>
            <th style={{ padding: '0.7rem 0.6rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)',  borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e5e7eb'}` }}>Regime</th>
            <th style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 600, color: '#f59e0b',  borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e5e7eb'}` }}>P10 ↓</th>
            <th style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 600, color: '#00a63e',  borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e5e7eb'}` }}>P50</th>
            <th style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 600, color: '#3b82f6',  borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e5e7eb'}` }}>P90 ↑</th>
            <th style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)',  borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e5e7eb'}` }}>Physics</th>
            <th style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 600, color: '#eab308',  borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#e5e7eb'}` }}>GHI W/m²</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const rc = row.regime ? (REGIME_STYLE[row.regime] ?? { bg: 'transparent', color: 'var(--text-muted)' }) : null;
            return (
              <tr key={i} style={{ borderBottom: rowBorder }}>
                <td style={{ padding: '0.55rem 1rem', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {row.dateLabel ? <span style={{ marginRight: '0.5rem', color: '#00a63e', fontWeight: 700 }}>{row.dateLabel}</span> : null}
                  {row.timeLabel ?? row.time}
                </td>
                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                  {row.regime && rc && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: rc.bg, color: rc.color, padding: '2px 6px', borderRadius: 4, fontFamily: 'Poppins, sans-serif' }}>
                      {row.regime}
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.p10?.toFixed(3) ?? '—'}</td>
                <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{row.p50?.toFixed(3) ?? '—'}</td>
                <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.p90?.toFixed(3) ?? '—'}</td>
                <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', color: 'var(--text-muted)', fontStyle: 'italic' }}>{row.physics?.toFixed(3) ?? '—'}</td>
                <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.ghi?.toFixed(0) ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  siteId: string;
  autoRefresh?: boolean;
}

const SiteDataPanel: React.FC<Props> = ({ siteId, autoRefresh = false }) => {
  const { isDark } = useTheme();

  const [telemetry,  setTelemetry]  = useState<any[]>([]);
  const [forecast,   setForecast]   = useState<any[]>([]);
  const [weather,    setWeather]    = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [activeTab,       setActiveTab]       = useState<TabId>('overview');
  const [showBands,       setShowBands]       = useState<Record<string, boolean>>({ P10: true, P50: true, P90: true });
  const [dateRange,       setDateRange]       = useState('24h');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate,   setCustomEndDate]   = useState('');
  // Debounced versions used as fetchAll deps — avoids a fetch on every keystroke
  const [debouncedStart,  setDebouncedStart]  = useState('');
  const [debouncedEnd,    setDebouncedEnd]    = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedStart(customStartDate), 600); return () => clearTimeout(t); }, [customStartDate]);
  useEffect(() => { const t = setTimeout(() => setDebouncedEnd(customEndDate),     600); return () => clearTimeout(t); }, [customEndDate]);
  const [forecastView,    setForecastView]    = useState<'chart' | 'table'>('chart');
  const [forecastWindow,  setForecastWindow]  = useState<'today' | '3d' | '7d'>('7d');

  // Drag-to-zoom state (stock-chart style)
  const [refAreaLeft,  setRefAreaLeft]  = useState('');
  const [refAreaRight, setRefAreaRight] = useState('');
  const [isSelecting,  setIsSelecting]  = useState(false);
  const [zoomStart,    setZoomStart]    = useState<string | null>(null);
  const [zoomEnd,      setZoomEnd]      = useState<string | null>(null);

  // Dark-mode-aware tooltip style for recharts — memoized so recharts never gets a new object ref
  const tooltipStyle = useMemo(() => ({
    background: isDark ? 'rgba(30,41,59,0.97)' : 'rgba(255,255,255,0.97)',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,166,62,0.15)'}`,
    borderRadius: 10,
    color: isDark ? '#f1f5f9' : '#0a0a0a',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    fontSize: 12,
  }), [isDark]);

  const fetchAll = useCallback(async () => {
    try {
      // Forecast: always next 7 days from today (independent of history dateRange)
      const now = new Date();
      const forecastStart = now.toISOString().split('T')[0] + 'T00:00:00Z';
      const forecastEndDt = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      const forecastEnd   = forecastEndDt.toISOString().split('T')[0] + 'T23:59:59Z';

      // Telemetry from DynamoDB based on selected date range
      let telemetryParams: any = {};
      if      (dateRange === 'custom' && debouncedStart && debouncedEnd) telemetryParams = { start_date: new Date(debouncedStart).toISOString(), end_date: new Date(debouncedEnd).toISOString() };
      else if (dateRange === '7d')  telemetryParams = { days: 7 };
      else if (dateRange === '30d') telemetryParams = { days: 30 };

      // DynamoDB telemetry TTL is 24 h — fetch S3 history for any range > 24 h
      // so there is no gap between DynamoDB's recent 24 h and older S3 records.
      let historyParams: { start_date: string; end_date: string } | null = null;
      const sevenDaysAgo   = new Date(now.getTime() -  7 * 24 * 3600 * 1000);
      const thirtyDaysAgo  = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      if (dateRange === '7d') {
        historyParams = { start_date: sevenDaysAgo.toISOString(), end_date: now.toISOString() };
      } else if (dateRange === '30d') {
        historyParams = { start_date: thirtyDaysAgo.toISOString(), end_date: now.toISOString() };
      } else if (dateRange === 'custom' && debouncedStart && debouncedEnd) {
        const customStart = new Date(debouncedStart);
        const customEnd   = new Date(debouncedEnd);
        // Always fetch S3 for the full custom range; DynamoDB + dedup handles the recent overlap
        historyParams = { start_date: customStart.toISOString(), end_date: customEnd.toISOString() };
      }

      const results = await Promise.all([
        apiService.getSiteTelemetry(siteId, telemetryParams),
        apiService.getSiteForecast(siteId, { start_date: forecastStart, end_date: forecastEnd }),
        apiService.getSiteWeather(siteId),
        historyParams ? apiService.getSiteHistory(siteId, historyParams) : Promise.resolve(null),
      ] as Promise<any>[]);
      const [tel, fcst, wth, hist] = results;

      // Merge DynamoDB telemetry + S3 history, deduplicate by timestamp
      let merged: any[] = Array.isArray(tel) ? tel : [];
      if (Array.isArray(hist) && hist.length > 0) {
        const tsSet = new Set(merged.map((r: any) => r.timestamp));
        const older = (hist as any[]).filter(r => !tsSet.has(r.timestamp));
        merged = [...older, ...merged].sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
      }

      setTelemetry(merged);
      setForecast(Array.isArray(fcst) ? fcst : []);
      setWeather(wth || null);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load site data');
    } finally {
      setLoading(false);
    }
  }, [siteId, dateRange, debouncedStart, debouncedEnd]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
    if (!autoRefresh) return;
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll, autoRefresh]);

  // Reset zoom when forecast window changes
  useEffect(() => {
    setZoomStart(null);
    setZoomEnd(null);
  }, [forecastWindow]);

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
  const historyData = useMemo(() => {
    const aggregated = aggregateByPeriod(telemetry, dateRange);
    return aggregated.map(row => ({
      time:           fmt(row.timestamp, dateRange),
      'PV (kW)':      +((( row.pv1_power_w ?? 0) + (row.pv2_power_w ?? 0)) / 1000).toFixed(2),
      'Load (kW)':    +((row.load_power_w ?? 0) / 1000).toFixed(2),
      'Grid (kW)':    +((row.grid_power_w ?? 0) / 1000).toFixed(2),
      'Batt SOC (%)': row.battery_soc_percent ?? null,
    }));
  }, [telemetry, dateRange]);

  // Filter + map forecast — memoized on forecast array and window selection
  const { forecastFiltered, forecastData } = useMemo(() => {
    const todayIST = istDate(new Date());
    const filtered = forecast.filter(row => {
      const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
      const forecastIST = istDate(new Date(clean));
      if (forecastWindow === 'today') return forecastIST === todayIST;
      if (forecastWindow === '3d')    return forecastIST > istDateOffset(0) && forecastIST <= istDateOffset(3);
      // 7d: next 7 IST calendar days (today excluded)
      return forecastIST > istDateOffset(0) && forecastIST <= istDateOffset(7);
    });
    const mapped = filtered.map(row => {
      const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
      const d = new Date(clean);
      const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
      const dateLabel = forecastWindow === '3d'
        ? d.toLocaleDateString([], { weekday: 'short', day: 'numeric', timeZone: IST })
        : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: IST });
      const rawDate = istDate(d);
      const rawTs   = d.getTime();
      const time    = forecastWindow === 'today' ? timeLabel : `${dateLabel}||${timeLabel}`;
      return {
        time, dateLabel, timeLabel, rawDate, rawTs,
        p50:     row.p50_kw             != null ? +Number(row.p50_kw).toFixed(3)             : null,
        p10:     row.p10_kw             != null ? +Number(row.p10_kw).toFixed(3)             : null,
        p90:     row.p90_kw             != null ? +Number(row.p90_kw).toFixed(3)             : null,
        physics: row.physics_baseline_kw != null ? +Number(row.physics_baseline_kw).toFixed(3) : null,
        ghi:     row.ghi_input_wm2      != null ? +row.ghi_input_wm2                        : null,
        temp:    row.temperature_c      != null ? +row.temperature_c                         : null,
        regime:  row.regime             ?? null,
      };
    });
    return { forecastFiltered: filtered, forecastData: mapped };
  }, [forecast, forecastWindow]);

  // Zoom-sliced data for the chart (stock-market drag-to-zoom)
  const zoomedForecastData = useMemo(() => {
    if (!zoomStart || !zoomEnd) return forecastData;
    const li = forecastData.findIndex(d => d.time === zoomStart);
    const ri = forecastData.findIndex(d => d.time === zoomEnd);
    if (li === -1 || ri === -1 || li === ri) return forecastData;
    const [s, e] = li < ri ? [li, ri] : [ri, li];
    return forecastData.slice(s, e + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastData, zoomStart, zoomEnd]);

  // Pre-computed tick list for XAxis.
  // For today: one tick per even IST hour (every 2h = UTC minutes=30, UTC hours even).
  // For 3d/7d: one tick per IST calendar day, placed at 12:00 PM IST (06:30 UTC).
  // Falls back to the first slot of that day if the noon slot isn't in the data.
  const forecastTickObjects = useMemo(() => {
    if (forecastWindow === 'today') {
      // Pick slots at even IST hours (00:00, 02:00, 04:00, ... 22:00 IST)
      // Even IST hours → UTC minutes=30 and UTC hours even
      return zoomedForecastData.filter(d => {
        const t = new Date(d.rawTs);
        return t.getUTCMinutes() === 30 && t.getUTCHours() % 2 === 0;
      });
    }
    // Build a map: rawDate → best tick (noon preferred, else first of day)
    const dayMap = new Map<string, (typeof zoomedForecastData)[0]>();
    for (const d of zoomedForecastData) {
      if (!dayMap.has(d.rawDate)) dayMap.set(d.rawDate, d); // first = fallback
      // 12:00 PM IST = 06:30 UTC
      const t = new Date(d.rawTs);
      if (t.getUTCHours() === 6 && t.getUTCMinutes() === 30) {
        dayMap.set(d.rawDate, d); // overwrite with noon slot
      }
    }
    return Array.from(dayMap.values());
  }, [zoomedForecastData, forecastWindow]);
  const forecastTickValues = forecastTickObjects?.map(d => d.time);

  // "Last updated" = most recent generated_at across ALL fetched records — memoized on forecast array
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

  // Trapezoidal energy integration over the selected forecast window — memoized on filtered data
  const { fcastP10, fcastP50, fcastP90 } = useMemo(() => {
    let p10 = 0, p50 = 0, p90 = 0;
    if (forecastFiltered.length > 1) {
      for (let i = 0; i < forecastFiltered.length - 1; i++) {
        const h = Math.abs(
          new Date(forecastFiltered[i+1].timestamp.replace('FORECAST#', '')).getTime() -
          new Date(forecastFiltered[i].timestamp.replace('FORECAST#', '')).getTime()
        ) / 3_600_000;
        if (forecastFiltered[i].p10_kw != null && forecastFiltered[i+1].p10_kw != null) p10 += (forecastFiltered[i].p10_kw + forecastFiltered[i+1].p10_kw) / 2 * h;
        if (forecastFiltered[i].p50_kw != null && forecastFiltered[i+1].p50_kw != null) p50 += (forecastFiltered[i].p50_kw + forecastFiltered[i+1].p50_kw) / 2 * h;
        if (forecastFiltered[i].p90_kw != null && forecastFiltered[i+1].p90_kw != null) p90 += (forecastFiltered[i].p90_kw + forecastFiltered[i+1].p90_kw) / 2 * h;
      }
    }
    return { fcastP10: p10, fcastP50: p50, fcastP90: p90 };
  }, [forecastFiltered]);

  // achievedPct: today's actual kWh vs today's P50 forecast — memoized on forecast + todayKwh
  const achievedPct = useMemo(() => {
    const todayISTStr = istDate(new Date());
    const todayForecast = forecast.filter(row => {
      const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
      return istDate(new Date(clean)) === todayISTStr;
    });
    let todayFcastP50 = 0;
    if (todayForecast.length > 1) {
      for (let i = 0; i < todayForecast.length - 1; i++) {
        const h = Math.abs(
          new Date(todayForecast[i+1].timestamp.replace('FORECAST#', '')).getTime() -
          new Date(todayForecast[i].timestamp.replace('FORECAST#', '')).getTime()
        ) / 3_600_000;
        if (todayForecast[i].p50_kw != null && todayForecast[i+1].p50_kw != null)
          todayFcastP50 += (todayForecast[i].p50_kw + todayForecast[i+1].p50_kw) / 2 * h;
      }
    }
    return todayKwh != null && todayFcastP50 > 0
      ? Math.min(999, Math.round((todayKwh / todayFcastP50) * 100))
      : null;
  }, [forecast, todayKwh]);

  // ── Derived dark-mode colours ────────────────────────────────────────────────
  const cardBg     = isDark ? 'rgba(30,41,59,0.85)'   : '#ffffff';
  const headerGrad = isDark ? 'rgba(30,41,59,0.6)'    : 'linear-gradient(to right,#ffffff,#f9fafb)';
  const toggleBg   = isDark ? 'rgba(15,23,42,0.6)'    : '#f3f4f6';
  const toggleActive = isDark ? 'rgba(30,41,59,0.95)' : '#fff';
  const borderClr  = isDark ? 'rgba(148,163,184,0.1)' : '#e5e7eb';

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
            {/* History range — shown on Overview and History tabs */}
            {(activeTab === 'overview' || activeTab === 'history') && (<>
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                style={{ background: 'var(--bg-card,#fff)', border: '1px solid rgba(0,166,62,0.2)', borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-primary,#0a0a0a)', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
              >
                <option value="24h">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom range</option>
              </select>
              {dateRange === 'custom' && (<>
                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}
                  style={{ background: 'var(--bg-card,#fff)', border: '1px solid rgba(0,166,62,0.2)', borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-primary,#0a0a0a)', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>to</span>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}
                  style={{ background: 'var(--bg-card,#fff)', border: '1px solid rgba(0,166,62,0.2)', borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-primary,#0a0a0a)', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }} />
              </>)}
            </>)}
            {/* Forecast window — shown on Forecast tab */}
            {activeTab === 'forecast' && (
              <select
                value={forecastWindow}
                onChange={e => setForecastWindow(e.target.value as 'today' | '3d' | '7d')}
                style={{ background: 'var(--bg-card,#fff)', border: '1px solid rgba(0,166,62,0.2)', borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-primary,#0a0a0a)', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
              >
                <option value="today">Today</option>
                <option value="3d">Next 3 days</option>
                <option value="7d">Next 7 days</option>
              </select>
            )}
          </div>
          {lastUpdated && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST })} IST
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchAll(); }}
            style={{ background: 'none', border: '1px solid rgba(0,166,62,0.2)', borderRadius: 8, padding: '0.2rem 0.6rem', fontSize: '0.72rem', color: '#00a63e', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
          >↻ Refresh</button>
        </div>
      </div>

      {noData ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', background: 'rgba(0,166,62,0.03)', borderRadius: 12, border: '1px dashed rgba(0,166,62,0.15)' }}>
          No DynamoDB data found for site <strong style={{ color: '#00a63e' }}>{siteId}</strong> in the {
            dateRange === '24h' ? 'today' : dateRange === '7d' ? 'last 7 days' : dateRange === '30d' ? 'last 30 days' : 'selected date range'
          }.<br />
          <span style={{ fontSize: '0.78rem' }}>Data is written by the ML forecast scheduler when the device is actively posting telemetry.</span>
        </div>
      ) : (<>

        {/* ── Tab Bar ── */}
        <div style={{ display: 'flex', borderBottom: `2px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#f3f4f6'}`, marginBottom: '1rem', gap: 0 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  padding: '0.5rem 1rem',
                  fontSize: '0.78rem', fontWeight: isActive ? 700 : 600,
                  fontFamily: 'Poppins, sans-serif',
                  color: isActive ? '#00a63e' : 'var(--text-muted)',
                  borderBottom: `2px solid ${isActive ? '#00a63e' : 'transparent'}`,
                  marginBottom: -2,
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  transition: 'color 0.15s',
                  letterSpacing: '0.01em',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ══ OVERVIEW TAB ══ */}
        {activeTab === 'overview' && (<>

          {/* 6-card KPI strip */}
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
              ) : <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>Idle</span>}
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
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: gridImporting ? '#3b82f6' : gridExporting ? '#10b981' : 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
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

          {/* Daily energy breakdown */}
          <EnergyBreakdownRow latest={latest} />
          <InsightsRow latest={latest} />

        </>)}

        {/* ══ WEATHER TAB ══ */}
        {activeTab === 'weather' && (<>

          {/* Current weather pills */}
          {weather?.current ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>Now</span>
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
                  {(p as any).icon}{p.label}: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{p.value}</span>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,166,62,0.03)', borderRadius: 12, border: '1px dashed rgba(0,166,62,0.15)', marginBottom: '1rem' }}>
              No current weather data available.
            </div>
          )}

          {/* 24 h weather outlook */}
          {weather?.hourly_forecast && weather.hourly_forecast.length > 0
            ? <WeatherHourlyStrip hourly={weather.hourly_forecast} />
            : !weather?.current && null
          }

        </>)}

        {/* ══ HISTORY TAB ══ */}
        {activeTab === 'history' && (
          historyData.length > 0 ? (
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ margin: '0 0 0.2rem', fontSize: '0.9rem', fontFamily: 'Urbanist, sans-serif', color: 'var(--text-primary)' }}>
                  Power History — {
                    dateRange === '24h'   ? 'Today' :
                    dateRange === '7d'    ? 'Last 7 days' :
                    dateRange === '30d'   ? 'Last 30 days' :
                    customStartDate && customEndDate
                      ? `${new Date(customStartDate).toLocaleDateString([], { timeZone: IST })} – ${new Date(customEndDate).toLocaleDateString([], { timeZone: IST })}`
                      : 'Custom range'
                  }
                </h3>
                <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(148,163,184,0.07)' : 'rgba(0,166,62,0.08)'} />
                    <XAxis
                      dataKey="time" stroke="var(--text-muted)"
                      interval={dateRange === '24h' ? 'preserveStartEnd' : Math.ceil(historyData.length / 10)}
                      angle={dateRange === '7d' || dateRange === '30d' ? -15 : 0}
                      textAnchor={dateRange === '7d' || dateRange === '30d' ? 'end' : 'middle'}
                      tick={{ fontSize: dateRange === '30d' ? 9 : 10, fill: 'var(--text-muted)' }}
                    />
                    <YAxis yAxisId="power" stroke="var(--text-muted)" tickFormatter={(v: number) => `${v}kW`} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis yAxisId="soc" orientation="right" stroke="var(--text-muted)" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} width={36} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [`${v} ${String(name).includes('%') ? '%' : 'kW'}`, name]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins, sans-serif', color: 'var(--text-secondary)' }} />
                    <Area yAxisId="power" type="monotone" dataKey="PV (kW)"   stroke="#F07522" strokeWidth={2} fill="url(#pvGrad)"   dot={false} />
                    <Area yAxisId="power" type="monotone" dataKey="Load (kW)" stroke="#8b5cf6" strokeWidth={2} fill="url(#loadGrad)" dot={false} />
                    <Line  yAxisId="power" type="monotone" dataKey="Grid (kW)"     stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                    <Line  yAxisId="soc"   type="monotone" dataKey="Batt SOC (%)"  stroke="#00a63e" strokeWidth={1.5} dot={false} strokeDasharray="2 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,166,62,0.03)', borderRadius: 12, border: '1px dashed rgba(0,166,62,0.15)' }}>
              No telemetry history data available for the selected range.
            </div>
          )
        )}

        {/* ══ FORECAST TAB ══ */}
        {activeTab === 'forecast' && (
          forecastData.length > 0 ? (
            <div className="card" style={{ padding: 0, boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', border: `1px solid ${borderClr}`, borderRadius: 16, background: cardBg, overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${borderClr}`, display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', background: headerGrad }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,166,62,0.1)', color: '#00a63e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🔆</div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Urbanist, sans-serif', color: 'var(--text-primary)', fontWeight: 700 }}>Solar Forecast</h3>
                  </div>
                  {fcastP50 > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: '2.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                      {forecastWindow === 'today' ? 'Today' : forecastWindow === '3d' ? '3-day' : '7-day'} Est. Yield:
                    </span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', background: isDark ? 'rgba(148,163,184,0.1)' : '#f3f4f6', padding: '2px 7px', borderRadius: 4 }}>
                        {fcastP10.toFixed(1)} <span style={{ color: 'var(--text-muted)' }}>/</span> <span style={{ color: '#00a63e' }}>{fcastP50.toFixed(1)}</span> <span style={{ color: 'var(--text-muted)' }}>/</span> {fcastP90.toFixed(1)} kWh
                      </span>
                      {achievedPct != null && (
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, fontFamily: 'Poppins, sans-serif',
                          padding: '2px 8px', borderRadius: 99,
                          background: achievedPct >= 80 ? '#10b98118' : achievedPct >= 40 ? '#f59e0b18' : isDark ? 'rgba(148,163,184,0.1)' : '#e5e7eb',
                          color:      achievedPct >= 80 ? '#059669'  : achievedPct >= 40 ? '#d97706'  : 'var(--text-muted)',
                          border:     `1px solid ${achievedPct >= 80 ? '#10b98128' : achievedPct >= 40 ? '#f59e0b28' : borderClr}`,
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
                  <div style={{ display: 'flex', background: toggleBg, borderRadius: 8, padding: 3 }}>
                    {(['chart', 'table'] as const).map(v => (
                      <button key={v} onClick={() => setForecastView(v)} style={{ border: 'none', background: forecastView === v ? toggleActive : 'transparent', color: forecastView === v ? '#00a63e' : 'var(--text-muted)', borderRadius: 6, padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', boxShadow: forecastView === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', textTransform: 'capitalize' }}>
                        {v}
                      </button>
                    ))}
                  </div>

                  {/* Band toggles */}
                  {forecastView === 'chart' && (
                    <div style={{ display: 'flex', background: toggleBg, padding: 3, borderRadius: 8 }}>
                      {[{ label: 'P10', color: '#f59e0b', desc: 'Conservative' }, { label: 'P50', color: '#00a63e', desc: 'Median' }, { label: 'P90', color: '#3b82f6', desc: 'Optimistic' }].map(b => (
                        <button key={b.label} onClick={() => setShowBands(s => ({ ...s, [b.label]: !s[b.label] }))} style={{ border: 'none', background: showBands[b.label] ? toggleActive : 'transparent', color: showBands[b.label] ? b.color : 'var(--text-muted)', boxShadow: showBands[b.label] ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', borderRadius: 6, padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4 }} title={b.desc}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: showBands[b.label] ? b.color : isDark ? '#475569' : '#d1d5db' }} />
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
                        const { default: html2canvas } = await import('html2canvas');
                        const canvas = await html2canvas(el, { background: '#ffffff', scale: 2 } as any);
                        const a = document.createElement('a');
                        a.download = `solar-forecast-${new Date().toISOString().slice(0,10)}.png`;
                        a.href = canvas.toDataURL(); a.click();
                      }
                    }}
                    style={{ background: 'transparent', border: `1px solid ${borderClr}`, color: 'var(--text-secondary)', borderRadius: 8, padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
                    onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(148,163,184,0.07)' : '#f9fafb'}
                    onMouseOut={e  => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>📷</span><span>Save</span>
                  </button>

                  {/* CSV Export */}
                  <button
                    onClick={() => {
                      if (!forecastData || forecastData.length === 0) return;
                      // Get all keys from the first row
                      const keys = Object.keys(forecastData[0]);
                      // Build CSV header
                      const header = keys.join(',');
                      // Build CSV rows
                      const rows = forecastData.map(row => keys.map(k => JSON.stringify((row as Record<string, any>)[k] ?? '')).join(','));
                      const csv = [header, ...rows].join('\n');
                      // Download
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `solar-forecast-${new Date().toISOString().slice(0,10)}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    style={{ background: 'transparent', border: `1px solid ${borderClr}`, color: '#00a63e', borderRadius: 8, padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
                    onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(148,163,184,0.07)' : '#f9fafb'}
                    onMouseOut={e  => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>💾</span><span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Chart / Table area */}
              <div id="forecast-chart-container" style={{ padding: '0 1.5rem 1.5rem 0.5rem', background: cardBg, position: 'relative' }}>
                {forecastView === 'chart' ? (
                  <div style={{ height: forecastWindow === '7d' ? 360 : 300, width: '100%', userSelect: 'none', cursor: isSelecting ? 'crosshair' : 'default' }}>
                    <ResponsiveContainer>
                      <AreaChart
                        data={zoomedForecastData}
                        margin={{ top: 20, right: 10, left: 0, bottom: forecastWindow !== 'today' ? 10 : 0 }}
                        onMouseDown={(e: any) => {
                          if (e?.activeLabel) { setRefAreaLeft(e.activeLabel); setIsSelecting(true); }
                        }}
                        onMouseMove={(e: any) => {
                          if (isSelecting && e?.activeLabel) setRefAreaRight(e.activeLabel);
                        }}
                        onMouseUp={() => {
                          if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
                            setZoomStart(refAreaLeft);
                            setZoomEnd(refAreaRight);
                          }
                          setIsSelecting(false);
                          setRefAreaLeft('');
                          setRefAreaRight('');
                        }}
                      >
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
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(148,163,184,0.07)' : '#f3f4f6'} vertical={false} />
                        <XAxis
                          dataKey="time" stroke="var(--text-muted)"
                          tickLine={false} axisLine={false}
                          height={42}
                          allowDataOverflow type="category"
                          ticks={forecastTickValues}
                          minTickGap={-1}
                          tick={(props: any) => (
                            <ForecastXAxisTick
                              {...props}
                              forecastWindow={forecastWindow}
                            />
                          )}
                        />
                        <YAxis
                          stroke="var(--text-muted)"
                          tickLine={false} axisLine={false} width={40} allowDataOverflow
                          tick={{ fontSize: 11, fontFamily: 'Inter, sans-serif', fill: 'var(--text-muted)' }}
                          label={{ value: 'kW', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10 }}
                        />
                        <Tooltip content={<ForecastTooltip />} cursor={{ stroke: '#00a63e', strokeWidth: 1, strokeDasharray: '4 4' }} animationDuration={300} wrapperStyle={{ pointerEvents: 'none' }} />
                        <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ right: 0, top: 0, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }} />

                        {showBands['P90'] && <Area type="monotone" dataKey="p90" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" fill="url(#p90Grad)" activeDot={false} name="P90 (Optimistic)" animationDuration={500} />}
                        {showBands['P10'] && <Area type="monotone" dataKey="p10" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" fill="url(#p10Grad)" activeDot={false} name="P10 (Conservative)" animationDuration={500} />}
                        {showBands['P50'] && <Area type="monotone" dataKey="p50" stroke="#00a63e" strokeWidth={2.5} fill="url(#p50Grad)" activeDot={{ r: 4, strokeWidth: 0 }} name="P50 (Median)" animationDuration={800} />}
                        <Line type="monotone" dataKey="physics" stroke={isDark ? '#475569' : '#d1d5db'} strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Physics Baseline" activeDot={false} />

                        <ReferenceLine
                          x={(() => {
                            const n = new Date();
                            const t = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
                            if (forecastWindow === 'today') return t;
                            const dateL = forecastWindow === '3d'
                              ? n.toLocaleDateString([], { weekday: 'short', day: 'numeric', timeZone: IST })
                              : n.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: IST });
                            return `${dateL} || ${t}`;
                          })()}
                          stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3"
                          label={{ value: 'NOW', position: 'top', fill: '#ef4444', fontSize: 9, fontWeight: 700 }}
                        />

                        {/* Drag-selection highlight */}
                        {isSelecting && refAreaLeft && refAreaRight && (
                          <ReferenceArea x1={refAreaLeft} x2={refAreaRight} fill="#00a63e" fillOpacity={0.08} stroke="#00a63e" strokeOpacity={0.3} strokeDasharray="3 3" />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                    {/* Reset zoom button */}
                    {(zoomStart || zoomEnd) && (
                      <button
                        onClick={() => { setZoomStart(null); setZoomEnd(null); }}
                        style={{
                          position: 'absolute', top: 10, right: 10,
                          background: isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.92)',
                          border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,166,62,0.2)'}`,
                          borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem',
                          color: '#00a63e', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600,
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        ↺ Reset Zoom
                      </button>
                    )}
                    <div style={{ position: 'absolute', bottom: 10, left: 24, fontSize: '0.62rem', color: 'var(--text-muted)', background: isDark ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.85)', padding: '2px 6px', borderRadius: 4, pointerEvents: 'none' }}>
                      {zoomStart ? 'Drag to select · Click ↺ to reset' : 'Drag on chart to zoom'}
                    </div>
                  </div>
                ) : (
                  <ForecastTable data={zoomedForecastData} />
                )}
                {forecastGeneratedAt && (
                  <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontFamily: 'Inter, sans-serif', padding: '0 1rem 1rem' }}>
                    last updated: {forecastGeneratedAt.toLocaleString([], { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,166,62,0.03)', borderRadius: 12, border: '1px dashed rgba(0,166,62,0.15)' }}>
              No forecast data available for the selected range.
            </div>
          )
        )}

      </>)}
    </div>
  );
};

export default SiteDataPanel;
