import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { apiService, AlertItem } from '../../services/api';
import {
  Wifi, WifiOff, AlertTriangle, Zap, Battery,
  ChevronDown, MapPin, Globe, Compass, ChevronUp, RefreshCw,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

// ── Interfaces ────────────────────────────────────────────────────────────────

interface SiteDevice {
  device_id: number;
  device_serial: string;
  is_online: boolean;
}

interface Site {
  site_id: string;
  display_name: string;
  capacity_kw: number;
  inverter_capacity_kw?: number | null;
  latitude: number;
  longitude: number;
  timezone: string;
  devices: SiteDevice[];
  tilt_deg?: number;
  azimuth_deg?: number;
  is_active?: boolean;
}

interface TelemetryRow {
  timestamp: string;
  pv1_power_w?: number;
  pv2_power_w?: number;
  pv3_power_w?: number;
  pv4_power_w?: number;
  grid_power_w?: number;
  load_power_w?: number;
  battery_soc_percent?: number;
  pv_today_kwh?: number;
  load_today_kwh?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function siteIsOnline(site: Site) {
  return site.devices.some(d => d.is_online);
}

function fmtKW(w: number | undefined | null) {
  if (w == null) return '—';
  return `${(Math.abs(w) / 1000).toFixed(1)} kW`;
}

function fmtKWh(kwh: number | undefined | null) {
  if (kwh == null) return '—';
  return `${kwh.toFixed(1)} kWh`;
}

/** Start of today in IST (UTC+5:30) as UTC ISO string */
function startOfTodayIST(): string {
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 - now.getTimezoneOffset()) * 60_000;
  const istDate = new Date(istMs).toISOString().slice(0, 10);
  return new Date(`${istDate}T00:00:00+05:30`).toISOString();
}

// ── Component ─────────────────────────────────────────────────────────────────

const MobileDashboard: React.FC = () => {
  const { isDark } = useTheme();

  // Design tokens
  const bg      = isDark ? '#020617' : '#f0fdf4';
  const surface = isDark ? '#0f172a' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,166,62,0.15)';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMute = isDark ? '#64748b' : '#94a3b8';
  const textSub  = isDark ? '#94a3b8' : '#475569';
  const accent   = '#00a63e';

  // State
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitePickerOpen, setSitePickerOpen] = useState(false);
  const [allAlerts, setAllAlerts] = useState<AlertItem[]>([]);
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const sitesInitialized = useRef(false);

  // Derived
  const selectedSite = useMemo(
    () => sites.find(s => s.site_id === selectedSiteId) ?? null,
    [sites, selectedSiteId],
  );

  const activeAlerts = useMemo(() => {
    if (!selectedSite) return [];
    const ids = new Set(selectedSite.devices.map(d => d.device_id));
    return allAlerts.filter(a => {
      if (!ids.has(parseInt(a.device_id))) return false;
      if (a.resolved) return false;
      return a.status === 'active' || a.status === 'acknowledged' || a.status == null;
    });
  }, [allAlerts, selectedSite]);

  const latest = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;

  const pvW = latest
    ? (latest.pv1_power_w ?? 0) + (latest.pv2_power_w ?? 0) +
      (latest.pv3_power_w ?? 0) + (latest.pv4_power_w ?? 0)
    : null;
  const gridW   = latest?.grid_power_w ?? null;
  const loadW   = latest?.load_power_w ?? null;
  const soc     = latest?.battery_soc_percent ?? null;
  const pvToday = latest?.pv_today_kwh ?? null;
  const loadToday = latest?.load_today_kwh ?? null;

  const selfSufficiency = useMemo(() => {
    if (pvToday == null || loadToday == null || loadToday === 0) return null;
    return Math.min(100, Math.round((pvToday / loadToday) * 100));
  }, [pvToday, loadToday]);

  const gridLabel = useMemo(() => {
    if (gridW == null) return null;
    if (gridW < -50) return `Exporting ${fmtKW(gridW)}`;
    if (gridW > 50)  return `Importing ${fmtKW(gridW)}`;
    return 'Grid balanced';
  }, [gridW]);

  const gridColor = gridW != null && gridW < -50 ? '#10b981'
    : gridW != null && gridW > 50 ? '#f59e0b' : textSub;

  // Fetches
  const fetchSites = useCallback(async () => {
    try {
      const data: Site[] = await apiService.getAllSites();
      setSites(data);
      if (data.length > 0) setSelectedSiteId(prev => prev ?? data[0].site_id);
    } catch { /* silent on background polls */ } finally {
      setSitesLoading(false);
      sitesInitialized.current = true;
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await apiService.getAlerts();
      setAllAlerts(Array.isArray(data) ? data : []);
    } catch { /* non-critical */ }
  }, []);

  const fetchTelemetry = useCallback(async (siteId: string) => {
    setTelemetryLoading(true);
    try {
      const data = await apiService.getSiteTelemetry(siteId, {
        start_date: startOfTodayIST(),
        end_date: new Date().toISOString(),
      });
      setTelemetry(Array.isArray(data) ? data : []);
    } catch {
      setTelemetry([]);
    } finally {
      setTelemetryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSites(); fetchAlerts();
    const id = setInterval(() => { fetchSites(); fetchAlerts(); }, 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedSiteId) return;
    fetchTelemetry(selectedSiteId);
    const id = setInterval(() => fetchTelemetry(selectedSiteId), 60_000);
    return () => clearInterval(id);
  }, [selectedSiteId, fetchTelemetry]);

  // Chart
  const chartData = useMemo(() => {
    const rows = telemetry.filter(
      r => r.pv1_power_w != null || r.pv2_power_w != null,
    );
    return {
      labels: rows.map(r => {
        const d = new Date(r.timestamp);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }),
      datasets: [{
        label: 'PV Power (kW)',
        data: rows.map(r =>
          +(((r.pv1_power_w ?? 0) + (r.pv2_power_w ?? 0) +
             (r.pv3_power_w ?? 0) + (r.pv4_power_w ?? 0)) / 1000).toFixed(2)
        ),
        borderColor: isDark ? '#4CC9F0' : accent,
        backgroundColor: isDark ? 'rgba(76,201,240,0.12)' : 'rgba(0,166,62,0.10)',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      }],
    };
  }, [telemetry, isDark]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 } as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: { label: (ctx: any) => ` ${ctx.parsed.y} kW` },
      },
    },
    scales: {
      x: {
        ticks: { color: textMute, font: { size: 10 }, maxTicksLimit: 6, maxRotation: 0 },
        grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' },
      },
      y: {
        ticks: { color: textMute, font: { size: 10 }, callback: (v: any) => `${v}kW` },
        grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' },
      },
    },
  }), [isDark, textMute]);

  if (sitesLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: textMute }}>
        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '0.875rem' }}>Loading…</span>
      </div>
    );
  }

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, ...extra,
  });

  const sevColor = (s: string) =>
    s === 'critical' ? '#ef4444' : s === 'warning' ? '#f59e0b' : '#3b82f6';

  const online = selectedSite ? siteIsOnline(selectedSite) : false;

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 32 }}>

      {/* Site selector */}
      <div style={{ position: 'relative', zIndex: 20 }}>
        <button
          onClick={() => setSitePickerOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', background: surface, border: 'none',
            borderBottom: `1px solid ${border}`, color: textMain, cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? '#22c55e' : '#64748b', boxShadow: online ? '0 0 6px rgba(34,197,94,0.6)' : 'none' }} />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{selectedSite?.display_name ?? 'Select site'}</span>
          </div>
          <ChevronDown size={16} color={textMute} style={{ transform: sitePickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
        </button>

        {sitePickerOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 18 }} onClick={() => setSitePickerOpen(false)} />
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 19, background: surface, borderBottom: `1px solid ${border}`, maxHeight: 260, overflowY: 'auto' }}>
              {sites.map(site => {
                const sel = site.site_id === selectedSiteId;
                const on = siteIsOnline(site);
                return (
                  <div key={site.site_id} onClick={() => { setSelectedSiteId(site.site_id); setSitePickerOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', background: sel ? (isDark ? 'rgba(0,166,62,0.15)' : 'rgba(0,166,62,0.08)') : 'transparent', borderLeft: `3px solid ${sel ? accent : 'transparent'}` }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? '#22c55e' : '#64748b' }} />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: textMain }}>{site.display_name}</div>
                      <div style={{ fontSize: '0.7rem', color: textMute, marginTop: 1 }}>{site.site_id}</div>
                    </div>
                    {on ? <Wifi size={13} color="#22c55e" style={{ marginLeft: 'auto' }} /> : <WifiOff size={13} color="#64748b" style={{ marginLeft: 'auto' }} />}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedSite && (
        <div style={{ padding: '12px 12px 0' }}>

          {/* Status bar */}
          <div style={{ ...card({ padding: '10px 14px', marginBottom: 10 }), display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: online ? '#22c55e' : '#64748b', boxShadow: online ? '0 0 5px rgba(34,197,94,0.5)' : 'none' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: online ? '#22c55e' : textMute }}>{online ? 'Online' : 'Offline'}</span>
            </div>
            <div style={{ width: 1, height: 16, background: border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={13} color={accent} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: textMain }}>{pvW != null ? fmtKW(pvW) : '—'}</span>
            </div>
            <div style={{ width: 1, height: 16, background: border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Battery size={13} color={soc != null && soc < 20 ? '#ef4444' : '#10b981'} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: textMain }}>{soc != null ? `${Math.round(soc)}%` : '—'}</span>
            </div>
          </div>

          {/* 2-up KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={card({ padding: '16px 14px' })}>
              <div style={{ fontSize: '0.7rem', color: textMute, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Zap size={11} color={accent} /> Solar</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: textMain, lineHeight: 1 }}>{pvW != null ? (pvW / 1000).toFixed(1) : '—'}</div>
              <div style={{ fontSize: '0.7rem', color: textMute, marginTop: 4 }}>kW live</div>
            </div>
            <div style={card({ padding: '16px 14px' })}>
              <div style={{ fontSize: '0.7rem', color: textMute, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Zap size={11} color="#f59e0b" /> Load</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: textMain, lineHeight: 1 }}>{loadW != null ? (loadW / 1000).toFixed(1) : '—'}</div>
              <div style={{ fontSize: '0.7rem', color: textMute, marginTop: 4 }}>kW live</div>
            </div>
          </div>

          {/* Grid pill */}
          {gridLabel && (
            <div style={{ ...card({ padding: '10px 14px', marginBottom: 10 }), display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={14} color={gridColor} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: gridColor }}>Grid: {gridLabel}</span>
            </div>
          )}

          {/* Active alerts */}
          {activeAlerts.length > 0 && (
            <div style={{ ...card({ marginBottom: 10 }), overflow: 'hidden' }}>
              <button onClick={() => setAlertsExpanded(e => !e)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <AlertTriangle size={14} color="#f59e0b" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: textMain }}>
                    {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {alertsExpanded ? <ChevronUp size={14} color={textMute} /> : <ChevronDown size={14} color={textMute} />}
              </button>
              {alertsExpanded && (
                <div style={{ borderTop: `1px solid ${border}` }}>
                  {activeAlerts.map(alert => {
                    const c = sevColor(alert.severity);
                    return (
                      <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: `1px solid ${border}` }}>
                        <AlertTriangle size={12} color={c} style={{ flexShrink: 0 }} />
                        {alert.fault_code && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 4, background: `${c}18`, color: c, flexShrink: 0 }}>{alert.fault_code}</span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: c, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.message}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Daily summary */}
          <div style={{ ...card({ padding: '12px 14px', marginBottom: 10 }), display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: textSub, fontWeight: 500 }}>Today generated</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: textMain }}>{fmtKWh(pvToday)}</span>
            </div>
            {selfSufficiency != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: textSub, fontWeight: 500 }}>Self-sufficiency</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: selfSufficiency >= 70 ? '#10b981' : '#f59e0b' }}>{selfSufficiency}%</span>
              </div>
            )}
          </div>

          {/* PV Chart */}
          <div style={card({ padding: '12px 14px', marginBottom: 10 })}>
            <div style={{ fontSize: '0.7rem', color: textMute, fontWeight: 500, marginBottom: 8 }}>Today's PV Power</div>
            {telemetryLoading ? (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMute }}>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : chartData.labels.length === 0 ? (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: textMute }}>No data yet today</div>
            ) : (
              <div style={{ height: 180 }}><Line data={chartData} options={chartOptions} /></div>
            )}
          </div>

          {/* Site info chips */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {[
              { icon: <MapPin size={10} />, text: `${selectedSite.latitude}°N ${selectedSite.longitude}°E` },
              { icon: <Globe size={10} />, text: selectedSite.timezone },
              ...(selectedSite.tilt_deg != null ? [{ icon: <Compass size={10} />, text: `Tilt ${selectedSite.tilt_deg}°` }] : []),
              ...(selectedSite.azimuth_deg != null ? [{ icon: <Compass size={10} />, text: `Az ${selectedSite.azimuth_deg}°` }] : []),
            ].map(({ icon, text }) => (
              <span key={text} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '4px 10px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}`, fontSize: '0.68rem', color: textSub, fontWeight: 500 }}>
                <span style={{ color: textMute, display: 'flex' }}>{icon}</span>{text}
              </span>
            ))}
          </div>

        </div>
      )}
    </div>
  );
};

export default MobileDashboard;
