import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  LayoutDashboard, ChevronDown, Wifi, WifiOff, RefreshCw, Search, X,
  Activity, Database, Server, CheckCircle, AlertTriangle, XCircle, Zap,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';
import SiteDataPanel from './SiteDataPanel';

// ── Interfaces ───────────────────────────────────────────────────────────────

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
}

interface SystemHealthData {
  total_devices: number;
  active_devices: number;
  total_telemetry_points: number;
  uptime_seconds: number;
  database_status: string;
  http_status: string;
  overall_health: string;
}

interface TelemetryBufferStats {
  total: number;
  pending_dynamo: number;
  pending_s3: number;
  failed_both: number;
  success_rate: number;
  oldest_pending_age_seconds: number;
  status: string;
  avg_ingestion_latency_s: number | null;
  max_ingestion_latency_s: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function siteIsOnline(site: Site): boolean {
  return site.devices.some(d => d.is_online);
}

function fmtAge(seconds: number): string {
  if (seconds === 0) return 'None';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function fmtLatency(s: number | null): string {
  if (s === null) return '—';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

// ── Component ────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { isDark } = useTheme();

  // Sites
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // System health + buffer
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [bufferStats, setBufferStats] = useState<TelemetryBufferStats | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const sitesInitialized = useRef(false);

  const fetchSites = useCallback(async () => {
    try {
      setSitesError(null);
      const data: Site[] = await apiService.getAllSites();
      setSites(data);
      if (data.length > 0 && !selectedSiteId) {
        setSelectedSiteId(data[0].site_id);
      }
    } catch {
      if (!sitesInitialized.current) setSitesError('Failed to load sites');
    } finally {
      setSitesLoading(false);
      sitesInitialized.current = true;
    }
  }, [selectedSiteId]);

  const healthInitialized = useRef(false);

  const fetchHealth = useCallback(async () => {
    if (!healthInitialized.current) setHealthLoading(true);
    const [healthData, bufferData] = await Promise.all([
      apiService.getSystemHealth().catch(() => null),
      apiService.getTelemetryBufferStats().catch(() => null),
    ]);
    setHealth(healthData ?? null);
    setBufferStats(bufferData ?? null);
    setHealthLoading(false);
    healthInitialized.current = true;
  }, []);

  useEffect(() => {
    fetchSites();
    fetchHealth();
    // Poll health + site status every 30 seconds silently
    const id = setInterval(() => {
      fetchSites();
      fetchHealth();
    }, 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus search on open
  useEffect(() => {
    if (dropdownOpen) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch('');
  }, [dropdownOpen]);

  const filteredSites = search.trim()
    ? sites.filter(s => {
        const q = search.toLowerCase();
        return (
          s.display_name.toLowerCase().includes(q) ||
          s.site_id.toLowerCase().includes(q) ||
          s.devices.some(d => d.device_serial.toLowerCase().includes(q))
        );
      })
    : sites;

  const selectedSite = sites.find(s => s.site_id === selectedSiteId);

  // ── Design tokens ────────────────────────────────────────────────────────

  const bg       = isDark ? '#020617' : '#f0fdf4';
  const surface  = isDark ? '#0f172a' : '#ffffff';
  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.15)';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMute = isDark ? '#64748b' : '#94a3b8';
  const textSub  = isDark ? '#94a3b8' : '#475569';

  const onlineDot = (online: boolean): React.CSSProperties => ({
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
    background: online ? '#22c55e' : '#64748b',
    boxShadow: online ? '0 0 6px rgba(34,197,94,0.55)' : 'none',
  });

  const statusPalette = {
    ok:   { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
    warn: { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
    err:  { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
  };

  // ── Loading / error ──────────────────────────────────────────────────────

  if (sitesLoading) {
    return (
      <div style={{ minHeight: '100vh', background: bg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 10, color: textMute }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.875rem' }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (sitesError || sites.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: bg }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutDashboard size={24} color={textMute} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: textMain, marginBottom: 4 }}>
              {sitesError ?? 'No sites configured'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: textMute }}>
              {sitesError ? 'Check your connection and try again.' : 'Add a solar site to a device in the Devices tab.'}
            </div>
          </div>
          {sitesError && (
            <button onClick={() => { setSitesLoading(true); fetchSites(); }}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#00a63e', color: '#fff', fontSize: '0.8125rem', fontWeight: 600 }}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Health KPI cards ─────────────────────────────────────────────────────

  const renderHealthKPIs = () => {
    if (healthLoading) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" style={{ padding: 20, minHeight: 110, opacity: 0.4 }}>
              <div style={{ height: 12, width: '60%', borderRadius: 6, background: isDark ? '#1e293b' : '#e5e7eb', marginBottom: 8 }} />
              <div style={{ height: 28, width: '40%', borderRadius: 6, background: isDark ? '#1e293b' : '#e5e7eb' }} />
            </div>
          ))}
        </div>
      );
    }

    if (!health) {
      return (
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <XCircle size={18} color="#ef4444" />
          <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>Failed to load health data.</span>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: '0.8rem' }} onClick={fetchHealth}>
            Retry
          </button>
        </div>
      );
    }

    const deviceRatio = health.active_devices / Math.max(health.total_devices, 1);
    const httpOk  = ['connected', 'ok'].includes(health.http_status?.toLowerCase());
    const sysOk   = ['healthy', 'ok'].includes(health.overall_health?.toLowerCase());

    const kpiCards = [
      {
        label: 'Active Devices',
        value: `${health.active_devices}/${health.total_devices}`,
        sub: `${(deviceRatio * 100).toFixed(0)}% online`,
        icon: <Activity size={22} />,
        status: (deviceRatio >= 0.9 ? 'ok' : deviceRatio >= 0.7 ? 'warn' : 'err') as keyof typeof statusPalette,
      },
      {
        label: 'Telemetry Points',
        value: health.total_telemetry_points.toLocaleString(),
        sub: 'Total ingested',
        icon: <Database size={22} />,
        status: 'ok' as const,
      },
      {
        label: 'HTTP API',
        value: health.http_status ?? 'N/A',
        sub: 'API connectivity',
        icon: <Wifi size={22} />,
        status: (httpOk ? 'ok' : 'err') as keyof typeof statusPalette,
      },
      {
        label: 'System Health',
        value: health.overall_health ?? 'N/A',
        sub: 'Overall status',
        icon: <Server size={22} />,
        status: (sysOk ? 'ok' : 'warn') as keyof typeof statusPalette,
      },
    ];

    const statusIcons  = { ok: <CheckCircle size={13} />, warn: <AlertTriangle size={13} />, err: <XCircle size={13} /> };
    const statusLabels = { ok: 'Healthy', warn: 'Warning', err: 'Error' };

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {kpiCards.map(({ label, value, sub, icon, status }) => {
          const s = statusPalette[status];
          return (
            <div key={label} className="card" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', top: -24, right: -24, width: 64, height: 64, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', display: 'block' }} />
              <span style={{ position: 'absolute', top: -8,  right: -8,  width: 32, height: 32, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', display: 'block' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                  {icon}
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                  {statusIcons[status]}{statusLabels[status]}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: textSub, marginBottom: 4, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: textMain, marginBottom: 4, lineHeight: 1.2 }}>{value}</div>
              <div style={{ fontSize: '0.72rem', color: textMute }}>{sub}</div>
              <div style={{ marginTop: 14, height: 3, width: 48, borderRadius: 999, background: s.color, opacity: 0.4 }} />
            </div>
          );
        })}
      </div>
    );
  };

  // ── Telemetry buffer panel ────────────────────────────────────────────────

  const renderBufferPanel = () => {
    if (!bufferStats) return null;

    const bufColor = bufferStats.status === 'healthy' ? '#10b981' : bufferStats.status === 'warning' ? '#f59e0b' : '#ef4444';
    const bufBg    = bufferStats.status === 'healthy' ? 'rgba(16,185,129,0.12)' : bufferStats.status === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
    const bufBdr   = bufferStats.status === 'healthy' ? 'rgba(16,185,129,0.25)' : bufferStats.status === 'warning' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)';

    const rows = [
      { label: 'Total Records',     value: bufferStats.total.toLocaleString() },
      { label: 'Pending DynamoDB',  value: String(bufferStats.pending_dynamo) },
      { label: 'Pending S3',        value: String(bufferStats.pending_s3) },
      { label: 'Failed Both',       value: String(bufferStats.failed_both) },
      { label: 'Success Rate',      value: `${bufferStats.success_rate}%` },
      { label: 'Oldest Pending',    value: fmtAge(bufferStats.oldest_pending_age_seconds) },
      { label: 'Avg Latency (24h)', value: fmtLatency(bufferStats.avg_ingestion_latency_s) },
      { label: 'Max Latency (24h)', value: fmtLatency(bufferStats.max_ingestion_latency_s) },
    ];

    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} style={{ color: bufColor }} />
            <h2 style={{ margin: 0 }}>Telemetry Buffer</h2>
          </div>
          <span style={{ fontSize: '0.72rem', padding: '2px 10px', borderRadius: 999, fontWeight: 700, letterSpacing: '0.05em', background: bufBg, color: bufColor, border: `1px solid ${bufBdr}` }}>
            {bufferStats.status.toUpperCase()}
          </span>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {rows.map(({ label, value }) => (
            <div key={label} style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
              <div style={{ fontSize: '0.7rem', color: textMute, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: textMain }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: bg, paddingBottom: 40 }}>

      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: isDark ? 'rgba(2,6,23,0.95)' : 'rgba(240,253,244,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${border}`,
        boxShadow: isDark ? '0 2px 16px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.06)',
        padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #00a63e 0%, #00843f 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,166,62,0.35)',
          }}>
            <LayoutDashboard size={16} color="#fff" />
          </div>
          <h1 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: textMain, letterSpacing: '-0.01em' }}>
            Dashboard
          </h1>
        </div>

        {/* Site selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 10,
              border: `1px solid ${border}`,
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
              cursor: 'pointer', color: textMain,
              fontSize: '0.8125rem', fontWeight: 500,
              userSelect: 'none', transition: 'background 150ms',
            }}
          >
            {selectedSite && <span style={onlineDot(siteIsOnline(selectedSite))} />}
            <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedSite?.display_name ?? 'Select site'}
            </span>
            {selectedSite && selectedSite.devices.length > 1 && (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', color: textSub }}>
                {selectedSite.devices.length} devices
              </span>
            )}
            <ChevronDown size={14} style={{ transition: 'transform 150ms', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: textMute, flexShrink: 0 }} />
          </button>

          {dropdownOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setDropdownOpen(false)} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 9999,
                minWidth: 280, maxHeight: 360,
                background: surface,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 14,
                boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.12)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
                {/* Search */}
                <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: '5px 10px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                    <Search size={13} color={textMute} style={{ flexShrink: 0 }} />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search sites or devices…"
                      style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: textMain, caretColor: '#00a63e' }}
                    />
                    {search && (
                      <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        <X size={12} color={textMute} />
                      </button>
                    )}
                  </div>
                </div>

                {/* List */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredSites.length === 0 ? (
                    <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: '0.8rem', color: textMute }}>
                      No sites match "{search}"
                    </div>
                  ) : (
                    filteredSites.map(site => {
                      const active = site.site_id === selectedSiteId;
                      const online = siteIsOnline(site);
                      return (
                        <div
                          key={site.site_id}
                          onClick={() => { setSelectedSiteId(site.site_id); setDropdownOpen(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', cursor: 'pointer',
                            background: active ? (isDark ? 'rgba(0,166,62,0.15)' : 'rgba(0,166,62,0.08)') : 'transparent',
                            borderLeft: `3px solid ${active ? '#00a63e' : 'transparent'}`,
                            transition: 'background 120ms',
                          }}
                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; }}
                          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                        >
                          <span style={onlineDot(online)} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {site.display_name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: textMute, fontFamily: 'JetBrains Mono, monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {site.devices.length === 0 ? 'No devices' : site.devices.map(d => d.device_serial).join(' · ')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                            {site.devices.length > 1 && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: textSub, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', padding: '1px 6px', borderRadius: 999 }}>
                                {site.devices.length} devices
                              </span>
                            )}
                            {online ? <Wifi size={12} color="#22c55e" /> : <WifiOff size={12} color="#64748b" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: '7px 14px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`, fontSize: '0.7rem', color: textMute }}>
                  {filteredSites.length} of {sites.length} site{sites.length !== 1 ? 's' : ''}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px 0' }}>

        {/* System Health KPIs */}
        {renderHealthKPIs()}

        {/* Telemetry Buffer */}
        {renderBufferPanel()}

        {/* Energy intelligence (SiteDataPanel) */}
        {selectedSiteId && (
          <div style={{ marginTop: 32 }}>
            <SiteDataPanel
              siteId={selectedSiteId}
              autoRefresh
              inverterCapacityKw={selectedSite?.inverter_capacity_kw}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
