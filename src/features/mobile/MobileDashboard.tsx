import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { apiService, AlertItem } from '../../services/api';
import {
  Sun, Battery, Zap, TrendingUp, TrendingDown, AlertTriangle,
  ChevronDown, ChevronUp, MapPin, Clock, RefreshCw, Wifi, WifiOff,
  Compass, Globe, CloudSun, Droplets, Wind,
  Activity, BarChart3, Search, Menu,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { IST_TIMEZONE } from '../../app/constants';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import EnergyFlowBlock from '../../shared/components/EnergyFlow';
import { SmartDeviceNode } from '../../shared/components/EnergyFlow/types';
import finalLogo from '../../assets/finalLogo.png';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface SiteDevice { device_id: number; device_serial: string; is_online: boolean; }
interface Site {
  site_id: string; display_name: string; capacity_kw: number;
  inverter_capacity_kw?: number | null; latitude: number; longitude: number;
  timezone: string; devices: SiteDevice[]; tilt_deg?: number; azimuth_deg?: number;
  is_active?: boolean; site_status?: string;
}
interface TelemetryRow {
  timestamp: string;
  data_stale?: boolean;
  pv1_power_w?: number; pv2_power_w?: number; pv3_power_w?: number; pv4_power_w?: number;
  grid_power_w?: number; load_power_w?: number; battery_power_w?: number;
  battery_soc_percent?: number; pv_today_kwh?: number; load_today_kwh?: number;
  grid_sell_today_kwh?: number; grid_buy_today_kwh?: number;
  batt_charge_today_kwh?: number; batt_discharge_today_kwh?: number;
  battery_voltage_v?: number;
}
interface WeatherData {
  current?: {
    temperature_c?: number; feels_like_c?: number; humidity_pct?: number;
    wind_speed_kmh?: number; description?: string; cloud_cover_pct?: number;
    uv_index?: number; solar_irradiance_wm2?: number;
  };
}

const siteIsOnline = (site: Site) => site.devices.some(d => d.is_online);
const fmtKW  = (w: number | null | undefined) => w != null ? `${(Math.abs(w) / 1000).toFixed(1)}` : '—';
const fmtKWh = (k: number | null | undefined) => k != null ? `${k.toFixed(1)}` : '—';
const FRESH_DATA_MS = 5 * 60 * 1000;
const isFreshTimestamp = (timestamp?: string | null) =>
  !!timestamp && Date.now() - new Date(timestamp).getTime() <= FRESH_DATA_MS;
const isFreshTelemetry = (row?: TelemetryRow | null) =>
  !!row && row.data_stale !== true && isFreshTimestamp(row.timestamp);
const formatAge = (timestamp?: string | null) => {
  if (!timestamp) return 'No telemetry received';
  const diff = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m ago` : `${hours}h ago`;
};
const siteName = (site: Pick<Site, 'display_name' | 'site_id'>) =>
  site.display_name || site.site_id || 'Unnamed site';
function startOfTodayIST(): string {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
  return new Date(`${todayStr}T00:00:00+05:30`).toISOString();
}


const MobileDashboard: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';

  const [sites, setSites]         = useState<Site[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
  const [allAlerts, setAllAlerts] = useState<AlertItem[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [telLoading, setTelLoading] = useState(false);
  const [weather, setWeather]     = useState<WeatherData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [smartDevices, setSmartDevices] = useState<SmartDeviceNode[]>([]);
  const sitesInit = useRef(false);

  const site = useMemo(() => sites.find(s => s.site_id === selectedId) ?? null, [sites, selectedId]);

  const activeAlerts = useMemo(() => {
    if (!site) return [];
    const ids = new Set(site.devices.map(d => d.device_id));
    return allAlerts.filter(a => ids.has(parseInt(a.device_id)) && !a.resolved && (a.status === 'active' || a.status === 'acknowledged' || a.status == null));
  }, [allAlerts, site]);
  const hasCriticalAlerts = activeAlerts.some(a => a.severity === 'critical');

  const lastTelemetry = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;
  const dataIsStale = !!lastTelemetry && !isFreshTelemetry(lastTelemetry);
  const lat = dataIsStale ? null : lastTelemetry;
  const day = lastTelemetry;
  const lastTelemetryLabel = formatAge(lastTelemetry?.timestamp);
  const pvW    = lat ? (lat.pv1_power_w ?? 0) + (lat.pv2_power_w ?? 0) + (lat.pv3_power_w ?? 0) + (lat.pv4_power_w ?? 0) : null;
  const gridW  = lat?.grid_power_w ?? null;
  const loadW  = lat?.load_power_w ?? null;
  const batW   = lat?.battery_power_w ?? null;
  const soc    = lat?.battery_soc_percent ?? null;
  const batV   = lat?.battery_voltage_v ?? null;
  const pvKWh  = day?.pv_today_kwh ?? null;
  const ldKWh  = day?.load_today_kwh ?? null;
  const exKWh  = day?.grid_sell_today_kwh ?? null;
  const imKWh  = day?.grid_buy_today_kwh ?? null;
  const bcKWh  = day?.batt_charge_today_kwh ?? null;
  const bdKWh  = day?.batt_discharge_today_kwh ?? null;
  const selfSuf = pvKWh != null && ldKWh != null && ldKWh > 0 ? Math.min(100, Math.round((pvKWh / ldKWh) * 100)) : null;
  const isExporting = gridW != null && gridW < -50;
  const isImporting = gridW != null && gridW > 50;
  const isBatCharging = batW != null && batW > 50;
  const isBatDischarging = batW != null && batW < -50;
  const online = site ? siteIsOnline(site) : false;
  const liveStatusText = !lastTelemetry ? 'No live data' : dataIsStale ? `Stale · ${lastTelemetryLabel}` : `Live · ${lastTelemetryLabel}`;

  const fetchAll = useCallback(async () => {
    try {
      const [sitesData, alertsData] = await Promise.all([apiService.getAllSites(), apiService.getAlerts()]);
      setSites(sitesData);
      if (sitesData.length > 0 && !sitesInit.current) {
        setSelectedId(sitesData[0].site_id);
        sitesInit.current = true;
      }
      setAllAlerts(Array.isArray(alertsData) ? alertsData : []);
    } catch { } finally { setSitesLoading(false); setRefreshing(false); }
  }, []);

  const fetchTelemetry = useCallback(async (id: string) => {
    setTelLoading(true);
    try {
      const d = await apiService.getSiteTelemetry(id, { start_date: startOfTodayIST(), end_date: new Date().toISOString(), aggregate: 'none' });
      setTelemetry(Array.isArray(d) ? d : []);
    } catch { setTelemetry([]); } finally { setTelLoading(false); }
  }, []);

  const fetchWeather = useCallback(async (id: string) => {
    try { const w = await apiService.getSiteWeather(id); setWeather(w); } catch { setWeather(null); }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!selectedId) return;
    setTelemetry([]);
    setSmartDevices([]);
    setWeather(null);
    fetchTelemetry(selectedId);
    fetchWeather(selectedId);
    apiService.getSmartDevices(selectedId).then(d => setSmartDevices(Array.isArray(d) ? d : [])).catch(() => setSmartDevices([]));
    const id = setInterval(() => fetchTelemetry(selectedId), 60_000);
    return () => clearInterval(id);
  }, [selectedId, fetchTelemetry, fetchWeather]);

  useEffect(() => {
    if (activeAlerts.length === 0) {
      setAlertsOpen(false);
      return;
    }
    if (hasCriticalAlerts || !online || dataIsStale) {
      setAlertsOpen(true);
    }
  }, [activeAlerts.length, hasCriticalAlerts, online, dataIsStale]);

  const chartData = useMemo(() => {
    const rows = telemetry.filter(r => r.pv1_power_w != null || r.load_power_w != null);
    return {
      labels: rows.map(r => {
        const d = new Date(r.timestamp);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }),
      datasets: [
        {
          label: 'PV', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2,
          borderColor: '#F59E0B',
          backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)',
          data: rows.map(r => +(((r.pv1_power_w ?? 0) + (r.pv2_power_w ?? 0) + (r.pv3_power_w ?? 0) + (r.pv4_power_w ?? 0)) / 1000).toFixed(2)),
        },
        {
          label: 'Load', fill: false, tension: 0.4, pointRadius: 0, borderWidth: 1.5,
          borderColor: '#60A5FA', borderDash: [4, 3],
          data: rows.map(r => r.load_power_w != null ? +((r.load_power_w) / 1000).toFixed(2) : null),
        },
      ],
    };
  }, [telemetry, isDark]);

  const chartOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 0 } as const,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, font: { size: 10 }, color: muted, padding: 12 } },
      tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${c.parsed.y} kW` } },
    },
    scales: {
      x: { ticks: { font: { size: 10 }, maxTicksLimit: 6, maxRotation: 0, color: muted }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
      y: { ticks: { font: { size: 10 }, callback: (v: any) => `${v}kW`, color: muted }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
    },
  }), [isDark, muted]);

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface,
    backdropFilter: 'blur(16px)',
    border: `1px solid ${border}`,
    borderRadius: 16,
    overflow: 'hidden',
    ...extra,
  });


  const sectionLabel: React.CSSProperties = {
    fontSize: '0.6rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: muted,
    opacity: 0.9,
    marginBottom: 8,
    fontFamily: "'DM Sans', sans-serif",
  };

  if (sitesLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: muted }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.875rem', fontFamily: "'DM Sans', sans-serif" }}>Loading…</span>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 68, overflowX: 'clip' }}>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(47,191,113,0.4); }
          70% { box-shadow: 0 0 0 6px rgba(47,191,113,0); }
          100% { box-shadow: 0 0 0 0 rgba(47,191,113,0); }
        }
        .online-dot { animation: pulse-ring 2s ease-out infinite; }
      `}</style>

      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: isDark ? 'rgba(7,9,15,0.94)' : 'rgba(244,247,250,0.94)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${border}`,
        padding: '12px 16px 14px',
      }}>
        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: isDark ? 'rgba(47,191,113,0.08)' : 'rgba(47,191,113,0.06)',
              border: `1px solid rgba(47,191,113,0.18)`,
              boxShadow: '0 2px 10px rgba(47,191,113,0.2)',
            }}>
              <img src={finalLogo} alt="360Watts" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: text, lineHeight: 1.2, fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em' }}>
              360Watts
            </div>
          </div>

          <button
            aria-label="Open navigation menu"
            onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))}
            style={{
              background: isDark ? 'rgba(47,191,113,0.1)' : 'rgba(47,191,113,0.08)',
              border: `1px solid rgba(47,191,113,0.22)`,
              borderRadius: 10, cursor: 'pointer', color: '#2FBF71', padding: 0, display: 'flex',
              width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* ── Site picker dropdown ── */}
      {pickerOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 18 }} onClick={() => { setPickerOpen(false); setSiteSearch(''); }} />
          <div style={{
            position: 'sticky', top: 115, zIndex: 19,
            margin: '0 16px',
            background: isDark ? 'rgba(10,13,20,0.98)' : 'rgba(252,253,255,0.98)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `1.5px solid ${isDark ? 'rgba(47,191,113,0.2)' : 'rgba(47,191,113,0.25)'}`,
            borderRadius: 16,
            boxShadow: isDark
              ? '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(47,191,113,0.08)'
              : '0 12px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(47,191,113,0.06)',
            overflow: 'hidden',
            animation: 'sitePickerIn 0.18s cubic-bezier(0.34,1.4,0.64,1)',
          }}>
            <style>{`
              @keyframes sitePickerIn {
                from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>

            {/* Search */}
            <div style={{
              padding: '12px 12px 10px',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              background: isDark ? 'rgba(47,191,113,0.04)' : 'rgba(47,191,113,0.03)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 10, padding: '8px 12px',
                transition: 'border-color 0.15s',
              }}
                onFocus={() => {}}
              >
                <Search size={13} color="#2FBF71" style={{ flexShrink: 0 }} />
                <input
                  autoFocus
                  placeholder="Search by name or ID…"
                  value={siteSearch}
                  onChange={e => setSiteSearch(e.target.value)}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: '0.82rem', color: text, fontFamily: "'DM Sans', sans-serif",
                  }}
                />
                {siteSearch && (
                  <button aria-label="Clear site search" onClick={() => setSiteSearch('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: muted, lineHeight: 1, borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                )}
              </div>
              <div style={{ marginTop: 7, fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, paddingLeft: 2 }}>
                {sites.length} site{sites.length !== 1 ? 's' : ''} available
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', maxHeight: 280 }}>
              {(() => {
                const filtered = sites.filter(s =>
                  !siteSearch ||
                  s.display_name.toLowerCase().includes(siteSearch.toLowerCase()) ||
                  s.site_id.toLowerCase().includes(siteSearch.toLowerCase())
                );
                if (filtered.length === 0) return (
                  <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                    <Search size={20} color={muted} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                    <div style={{ fontSize: '0.82rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>No sites match</div>
                    <div style={{ fontSize: '0.7rem', color: muted, opacity: 0.6, marginTop: 3 }}>"{siteSearch}"</div>
                  </div>
                );
                return filtered.map((s, idx) => {
                  const on = siteIsOnline(s);
                  const sel = s.site_id === selectedId;
                  const name = siteName(s);
                  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                  return (
                    <div key={s.site_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setSelectedId(s.site_id); setPickerOpen(false); setSiteSearch(''); }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(s.site_id); setPickerOpen(false); setSiteSearch(''); } }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px',
                        cursor: 'pointer',
                        borderBottom: idx < filtered.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                        background: sel
                          ? isDark ? 'rgba(47,191,113,0.1)' : 'rgba(47,191,113,0.08)'
                          : 'transparent',
                        transition: 'background 0.12s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; }}
                      onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {/* Selected accent bar */}
                      {sel && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#2FBF71', borderRadius: '0 2px 2px 0' }} />}

                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: sel
                          ? 'linear-gradient(135deg,#2FBF71,#00a650)'
                          : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${sel ? 'rgba(47,191,113,0.5)' : border}`,
                        boxShadow: sel ? '0 4px 12px rgba(47,191,113,0.25)' : 'none',
                      }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: sel ? '#fff' : muted, fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.02em' }}>{initials}</span>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: sel ? (isDark ? '#fff' : '#0f172a') : text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                            {name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.62rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}>{s.site_id}</span>
                          <span style={{ fontSize: '0.6rem', color: muted, opacity: 0.5 }}>·</span>
                          <span style={{ fontSize: '0.62rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}>{s.capacity_kw} kWp</span>
                          <span style={{ fontSize: '0.6rem', color: muted, opacity: 0.5 }}>·</span>
                          <span style={{ fontSize: '0.62rem', color: muted }}>{s.devices.length} dev</span>
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{
                        flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 999,
                        background: on
                          ? isDark ? 'rgba(47,191,113,0.14)' : 'rgba(47,191,113,0.1)'
                          : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                        border: `1px solid ${on ? 'rgba(47,191,113,0.3)' : border}`,
                      }}>
                        {on ? <Wifi size={10} color="#2FBF71" /> : <WifiOff size={10} color="#94A3B8" />}
                        <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: on ? '#2FBF71' : '#94A3B8', fontFamily: "'DM Sans', sans-serif" }}>
                          {on ? 'On' : 'Off'}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </>
      )}

      {site && (
        <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Site selector button ── */}
          <button
            aria-label="Select site"
            onClick={() => { setPickerOpen(o => !o); setSiteSearch(''); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: pickerOpen
                ? isDark ? 'rgba(47,191,113,0.08)' : 'rgba(47,191,113,0.06)'
                : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              border: `1.5px solid ${pickerOpen ? 'rgba(47,191,113,0.45)' : border}`,
              borderRadius: 12,
              padding: '10px 14px', cursor: 'pointer', color: text,
              transition: 'border-color 0.2s, background 0.2s',
              boxShadow: pickerOpen ? '0 0 0 3px rgba(47,191,113,0.1)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: online ? (isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.1)') : (isDark ? 'rgba(100,100,100,0.1)' : 'rgba(0,0,0,0.08)'),
                border: `1px solid ${online ? 'rgba(47,191,113,0.2)' : border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: online ? '#2FBF71' : '#94A3B8', display: 'inline-block' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                  {site ? siteName(site) : 'Select a site'}
                </div>
                <div style={{ fontSize: '0.6rem', color: online && !dataIsStale ? '#2FBF71' : muted, fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
                  {online ? 'Online' : 'Offline'} · {liveStatusText}
                </div>
              </div>
            </div>
            <ChevronDown size={15} color={pickerOpen ? '#2FBF71' : muted}
              style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s, color 0.2s', flexShrink: 0 }} />
          </button>

          {activeAlerts.length > 0 && (
            <div style={{
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid ${hasCriticalAlerts ? 'rgba(239,68,68,0.24)' : 'rgba(245,158,11,0.24)'}`,
              background: hasCriticalAlerts
                ? (isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)')
                : (isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)'),
            }}>
              <button
                onClick={() => setAlertsOpen(o => !o)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', border: 'none', background: 'transparent',
                  color: hasCriticalAlerts ? '#EF4444' : '#F59E0B', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>{activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}</div>
                    <div style={{ fontSize: '0.62rem', opacity: 0.85, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'normal', lineHeight: 1.35 }}>
                      {activeAlerts[0]?.message}
                    </div>
                  </div>
                </div>
                {alertsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {alertsOpen && (
                <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeAlerts.map(a => {
                    const palette = a.severity === 'critical'
                      ? { bg: isDark ? 'rgba(127,29,29,0.35)' : 'rgba(254,226,226,0.9)', border: 'rgba(239,68,68,0.28)', color: '#EF4444' }
                      : a.severity === 'warning'
                        ? { bg: isDark ? 'rgba(120,53,15,0.28)' : 'rgba(255,247,237,0.95)', border: 'rgba(245,158,11,0.28)', color: '#F59E0B' }
                        : { bg: isDark ? 'rgba(30,64,175,0.22)' : 'rgba(239,246,255,0.95)', border: 'rgba(96,165,250,0.28)', color: '#60A5FA' };
                    return (
                      <div key={a.id} style={{ borderRadius: 10, border: `1px solid ${palette.border}`, background: palette.bg, padding: '9px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                          <AlertTriangle size={12} color={palette.color} style={{ marginTop: 2, flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            {a.fault_code && (
                              <div style={{ fontSize: '0.58rem', fontWeight: 800, color: palette.color, fontFamily: "'JetBrains Mono', monospace", marginBottom: 3 }}>
                                {a.fault_code}
                              </div>
                            )}
                            <div style={{ fontSize: '0.69rem', fontWeight: 700, color: palette.color, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.35 }}>
                              {a.message}
                            </div>
                            <div style={{ fontSize: '0.58rem', color: muted, fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
                              Device {a.device_id}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {(dataIsStale || !lastTelemetry) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              borderRadius: 12,
              background: dataIsStale ? 'rgba(245,158,11,0.08)' : isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.06)',
              border: `1px solid ${dataIsStale ? 'rgba(245,158,11,0.24)' : border}`,
              color: dataIsStale ? '#F59E0B' : muted,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                  {dataIsStale ? 'Live data is stale' : 'Waiting for live telemetry'}
                </div>
                <div style={{ fontSize: '0.62rem', marginTop: 2, opacity: 0.85 }}>
                  {dataIsStale ? `Last telemetry ${lastTelemetryLabel}. Current power is hidden after 5 minutes; today's totals and charts still show historical data.` : 'Live cards will populate after a fresh telemetry packet arrives.'}
                </div>
              </div>
            </div>
          )}

          <div style={{
            ...card(),
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          }}>
            {[
              { icon: <Sun size={13} color={pvW == null ? muted : '#F59E0B'} />, label: 'Solar', value: pvW != null ? `${fmtKW(pvW)} kW` : '—', color: pvW == null ? muted : '#F59E0B' },
              { icon: <Zap size={13} color={loadW == null ? muted : '#60A5FA'} />, label: 'Load', value: loadW != null ? `${fmtKW(loadW)} kW` : '—', color: loadW == null ? muted : '#60A5FA' },
              { icon: <Battery size={13} color={soc == null ? muted : soc < 20 ? '#F87171' : '#2FBF71'} />, label: 'Battery', value: soc != null ? `${Math.round(soc)}%` : '—', color: soc == null ? muted : soc < 20 ? '#F87171' : '#2FBF71' },
              { icon: isExporting ? <TrendingUp size={13} color="#2FBF71" /> : isImporting ? <TrendingDown size={13} color="#F59E0B" /> : <Globe size={13} color={muted} />, label: 'Grid', value: gridW != null ? `${fmtKW(gridW)} kW` : '—', color: gridW == null ? muted : isExporting ? '#2FBF71' : isImporting ? '#F59E0B' : muted },
            ].map(({ icon, label, value, color }, idx, arr) => (
              <React.Fragment key={label}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {icon}
                    <span style={{ fontSize: '0.7rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
                </div>
                {idx < arr.length - 1 && <div style={{ width: 1, height: 32, background: border, flexShrink: 0 }} />}
              </React.Fragment>
            ))}
          </div>

          {weather?.current && (
            <div style={{ ...card(), padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CloudSun size={28} color="#F59E0B" />
                  <div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: text, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                      {weather.current.temperature_c != null ? `${Math.round(weather.current.temperature_c)}°` : '—'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: muted, marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>{weather.current.description ?? 'Weather'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', maxWidth: '55%' }}>
                  {weather.current.humidity_pct != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: isDark ? 'rgba(96,165,250,0.1)' : 'rgba(96,165,250,0.08)', border: `1px solid rgba(96,165,250,0.2)` }}>
                      <Droplets size={10} color="#60A5FA" />
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#60A5FA', fontFamily: "'JetBrains Mono', monospace" }}>{weather.current.humidity_pct}%</span>
                    </div>
                  )}
                  {weather.current.wind_speed_kmh != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}` }}>
                      <Wind size={10} color={muted} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: muted, fontFamily: "'JetBrains Mono', monospace" }}>{weather.current.wind_speed_kmh} km/h</span>
                    </div>
                  )}
                  {weather.current.solar_irradiance_wm2 != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.07)', border: `1px solid rgba(245,158,11,0.2)` }}>
                      <Sun size={10} color="#F59E0B" />
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>{weather.current.solar_irradiance_wm2} W/m²</span>
                    </div>
                  )}
                  {weather.current.uv_index != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}` }}>
                      <span style={{ fontSize: '0.58rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>UV</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: weather.current.uv_index > 7 ? '#F87171' : weather.current.uv_index > 4 ? '#F59E0B' : '#2FBF71', fontFamily: "'JetBrains Mono', monospace" }}>{weather.current.uv_index}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <EnergyFlowBlock
            pvKw={pvW != null ? pvW / 1000 : null}
            loadKw={loadW != null ? loadW / 1000 : null}
            gridKw={gridW != null ? gridW / 1000 : null}
            battKw={batW != null ? batW / 1000 : null}
            battSoc={soc}
            smartDevices={smartDevices}
            siteId={selectedId ?? undefined}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {[
              { label: 'Solar Power', val: `${fmtKW(pvW)}`, unit: 'kW', sub2: `${fmtKWh(pvKWh)} kWh today`, icon: <Sun size={17} color="#F59E0B" />, color: '#F59E0B' },
              { label: 'Load', val: `${fmtKW(loadW)}`, unit: 'kW', sub2: `${fmtKWh(ldKWh)} kWh today`, icon: <Zap size={17} color="#60A5FA" />, color: '#60A5FA' },
              { label: 'Battery', val: soc != null ? `${Math.round(soc)}` : '—', unit: '%', sub2: batW != null ? `${fmtKW(batW)} kW` : '—', icon: <Battery size={17} color="#A78BFA" />, color: '#A78BFA' },
              { label: 'Grid', val: gridW != null ? `${fmtKW(gridW)}` : '—', unit: 'kW', sub2: isExporting ? `Export ${fmtKWh(exKWh)} kWh` : isImporting ? `Import ${fmtKWh(imKWh)} kWh` : 'Balanced', icon: <Globe size={17} color="#60A5FA" />, color: isExporting ? '#2FBF71' : isImporting ? '#F59E0B' : '#60A5FA' },
            ].map(({ label, val, unit, sub2, icon, color }) => (
              <div key={label} style={{ ...card(), padding: '14px 12px', borderTop: `3px solid ${color}`, borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 12, right: 10, opacity: 0.6 }}>{icon}</div>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: muted, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
                  <span style={{ fontSize: '1.7rem', fontWeight: 700, color, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{val}</span>
                  <span style={{ fontSize: '0.72rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>{unit}</span>
                </div>
                <div style={{ fontSize: '0.62rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>{sub2}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card(), padding: '14px 14px' }}>
            <div style={sectionLabel}>Today's Energy</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
              {[
                { label: 'Generated', val: fmtKWh(pvKWh), color: '#F59E0B', unit: 'kWh' },
                { label: 'Consumed',  val: fmtKWh(ldKWh), color: '#60A5FA', unit: 'kWh' },
                { label: 'Self-suf.', val: selfSuf != null ? `${selfSuf}%` : '—', color: selfSuf != null && selfSuf >= 70 ? '#2FBF71' : '#F59E0B', unit: '' },
                { label: 'Bat. Chg',  val: fmtKWh(bcKWh), color: '#2FBF71', unit: 'kWh' },
                { label: 'Bat. Dis',  val: fmtKWh(bdKWh), color: '#A78BFA', unit: 'kWh' },
                { label: 'Exported',  val: fmtKWh(exKWh), color: '#2FBF71', unit: 'kWh' },
                { label: 'Imported',  val: fmtKWh(imKWh), color: '#F59E0B', unit: 'kWh' },
                { label: 'Net Grid',  val: exKWh != null && imKWh != null ? fmtKWh(exKWh - imKWh) : '—', color: exKWh != null && imKWh != null && exKWh >= imKWh ? '#2FBF71' : '#F87171', unit: 'kWh' },
              ].map(({ label, val, color, unit }) => (
                <div key={label} style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: '0.58rem', color: muted, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                  {unit && val !== '—' && <div style={{ fontSize: '0.55rem', color: muted, opacity: 0.7, fontFamily: "'DM Sans', sans-serif" }}>{unit}</div>}
                </div>
              ))}
            </div>
          </div>


          <div style={{ ...card(), padding: '14px 12px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <BarChart3 size={14} color="#2FBF71" />
              <span style={sectionLabel}>Today's Generation</span>
            </div>
            {telLoading ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted }}>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : chartData.labels.length === 0 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: muted, fontFamily: "'DM Sans', sans-serif", textAlign: 'center', padding: '0 16px' }}>
                No data yet today
              </div>
            ) : (
              <div style={{ height: 160 }}><Line data={chartData} options={chartOpts} /></div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {[
              site.capacity_kw && { icon: <Zap size={10} />, text: `${site.capacity_kw} kWp` },
              site.inverter_capacity_kw && { icon: <Activity size={10} />, text: `${site.inverter_capacity_kw} kW inv.` },
              site.latitude != null && { icon: <MapPin size={10} />, text: `${site.latitude.toFixed(3)}° ${site.longitude.toFixed(3)}°` },
              site.tilt_deg != null && { icon: <Compass size={10} />, text: `Tilt ${site.tilt_deg}°` },
              site.azimuth_deg != null && { icon: <Compass size={10} />, text: `Az ${site.azimuth_deg}°` },
              { icon: <Globe size={10} />, text: site.timezone },
              { icon: <Clock size={10} />, text: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: site.timezone }) },
            ].filter(Boolean).map((chip: any) => (
              <div key={chip.text} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, fontSize: '0.62rem', color: muted, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ opacity: 0.6 }}>{chip.icon}</span>{chip.text}
              </div>
            ))}
          </div>

          <div style={{ ...card(), padding: '14px 14px' }}>
            <div style={sectionLabel}>Devices ({site.devices.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {site.devices.map(d => (
                <div key={d.device_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)', border: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    {d.is_online ? <Wifi size={13} color="#2FBF71" /> : <WifiOff size={13} color="#64748B" />}
                    <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: text }}>{d.device_serial}</span>
                  </div>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: d.is_online ? 'rgba(47,191,113,0.1)' : 'rgba(100,116,139,0.1)', color: d.is_online ? '#2FBF71' : '#64748B', fontFamily: "'DM Sans', sans-serif" }}>
                    {d.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {!site && !sitesLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60dvh', flexDirection: 'column', gap: 8, color: muted }}>
          <MapPin size={32} color={border} />
          <span style={{ fontSize: '0.875rem', fontFamily: "'DM Sans', sans-serif" }}>No sites found</span>
        </div>
      )}
    </div>
  );
};

export default MobileDashboard;
