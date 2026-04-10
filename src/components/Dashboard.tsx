import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  LayoutDashboard, ChevronDown, Wifi, WifiOff, RefreshCw, Search, X,
  Activity, Server, CheckCircle, AlertTriangle, XCircle, Zap,
  MapPin, Globe, Compass, Bell,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { apiService, AlertItem } from '../services/api';
import SiteDataPanel from './SiteDataPanel';
import PageHeader from './PageHeader';
import MobileDashboard from './MobileDashboard';
import { useIsMobile } from '../hooks/useIsMobile';

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
  tilt_deg?: number;
  azimuth_deg?: number;
  is_active?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function siteIsOnline(site: Site): boolean {
  return site.devices.some(d => d.is_online);
}

// ── Component ────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const isMobile = useIsMobile();
  const { isDark } = useTheme();

  // Sites
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Alerts
  const [allAlerts, setAllAlerts] = useState<AlertItem[]>([]);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const sitesInitialized = useRef(false);

  const fetchSites = useCallback(async () => {
    try {
      setSitesError(null);
      const data: Site[] = await apiService.getAllSites();
      setSites(data);
      // Functional update: only auto-select if nothing is selected yet
      if (data.length > 0) {
        setSelectedSiteId(prev => prev ?? data[0].site_id);
      }
    } catch {
      if (!sitesInitialized.current) setSitesError('Failed to load sites');
    } finally {
      setSitesLoading(false);
      sitesInitialized.current = true;
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await apiService.getAlerts();
      setAllAlerts(Array.isArray(data) ? data : []);
    } catch {
      // ignore — alerts are non-critical
    }
  }, []);

  useEffect(() => {
    fetchSites();
    fetchAlerts();
    // Poll site status + alerts every 30 seconds silently
    const id = setInterval(() => {
      fetchSites();
      fetchAlerts();
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

  // Active (non-resolved) alerts for the selected site's devices
  const activeAlerts = useMemo(() => {
    if (!selectedSite) return [];
    const deviceIds = new Set(selectedSite.devices.map(d => d.device_id));
    return allAlerts.filter(a => {
      const id = parseInt(a.device_id);
      if (!deviceIds.has(id)) return false;
      if (a.resolved) return false;
      // Include both DB-backed fault alerts (generated===false) and ephemeral
      return a.status === 'active' || a.status === 'acknowledged' || a.status == null;
    });
  }, [allAlerts, selectedSite]);

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

  // ── Mobile handoff ───────────────────────────────────────────────────────
  if (isMobile) return <MobileDashboard />;

  // ── Loading / error ──────────────────────────────────────────────────────

  if (sitesLoading) {
    return (
      <div className="admin-container responsive-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 10, color: textMute }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.875rem' }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (sitesError || sites.length === 0) {
    return (
      <div className="admin-container responsive-page">
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

  const renderSiteKPIs = () => {
    if (!selectedSite) return null;

    const totalDevices  = selectedSite.devices.length;
    const onlineDevices = selectedSite.devices.filter(d => d.is_online).length;
    const deviceRatio   = onlineDevices / Math.max(totalDevices, 1);
    const siteOnline    = onlineDevices > 0;

    const statusIcons  = { ok: <CheckCircle size={13} />, warn: <AlertTriangle size={13} />, err: <XCircle size={13} /> };
    const statusLabels = { ok: 'Online', warn: 'Partial', err: 'Offline' };

    const hasCriticalAlerts = activeAlerts.some(a => a.severity === 'critical');
    const hasWarningAlerts = activeAlerts.length > 0;
    const siteStatusStatus = !siteOnline ? 'err' : hasCriticalAlerts ? 'err' : hasWarningAlerts ? 'warn' : 'ok';

    const kpiCards = [
      {
        label: 'Site Status',
        value: siteOnline ? 'Online' : 'Offline',
        sub: activeAlerts.length > 0
          ? `${activeAlerts.length} active alert${activeAlerts.length !== 1 ? 's' : ''}`
          : selectedSite.display_name,
        icon: siteOnline ? <Wifi size={22} /> : <WifiOff size={22} />,
        status: siteStatusStatus as keyof typeof statusPalette,
      },
      {
        label: 'Devices Online',
        value: `${onlineDevices} / ${totalDevices}`,
        sub: `${(deviceRatio * 100).toFixed(0)}% active`,
        icon: <Activity size={22} />,
        status: (deviceRatio >= 1 ? 'ok' : deviceRatio > 0 ? 'warn' : 'err') as keyof typeof statusPalette,
      },
      {
        label: 'PV Capacity',
        value: `${selectedSite.capacity_kw} kW`,
        sub: 'Installed solar panels',
        icon: <Zap size={22} />,
        status: 'ok' as keyof typeof statusPalette,
      },
      {
        label: 'Inverter Capacity',
        value: selectedSite.inverter_capacity_kw != null ? `${selectedSite.inverter_capacity_kw} kW` : '—',
        sub: 'Rated inverter output',
        icon: <Server size={22} />,
        status: 'ok' as keyof typeof statusPalette,
      },
      {
        label: 'Active Alerts',
        value: activeAlerts.length === 0 ? 'None' : `${activeAlerts.length}`,
        sub: activeAlerts.length === 0
          ? 'No faults detected'
          : hasCriticalAlerts ? 'Critical fault(s)' : 'Warning(s)',
        icon: <Bell size={22} />,
        status: (activeAlerts.length === 0 ? 'ok' : hasCriticalAlerts ? 'err' : 'warn') as keyof typeof statusPalette,
      },
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {kpiCards.map(({ label, value, sub, icon, status }) => {
          const s = statusPalette[status];
          return (
            <div key={label} className="card" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', top: -24, right: -24, width: 64, height: 64, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', display: 'block' }} />
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

  // ── Site info strip ───────────────────────────────────────────────────────

  const renderSiteInfoStrip = () => {
    if (!selectedSite) return null;

    const chipBg     = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    const chipBorder = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.09)';
    const isActive   = selectedSite.is_active !== false; // treat undefined as active

    const chips: { icon: React.ReactNode; text: string }[] = [
      { icon: <MapPin size={11} />, text: `${selectedSite.latitude}° N, ${selectedSite.longitude}° E` },
      { icon: <Globe size={11} />,  text: selectedSite.timezone },
      ...(selectedSite.tilt_deg != null && selectedSite.azimuth_deg != null
        ? [{ icon: <Compass size={11} />, text: `Tilt ${selectedSite.tilt_deg}° · Azimuth ${selectedSite.azimuth_deg}°` }]
        : []),
    ];

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 0 }}>
        {chips.map(({ icon, text }) => (
          <span key={text} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999,
            background: chipBg, border: `1px solid ${chipBorder}`,
            fontSize: '0.72rem', color: textSub, fontWeight: 500,
          }}>
            <span style={{ color: textMute, display: 'flex' }}>{icon}</span>
            {text}
          </span>
        ))}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 999,
          background: isActive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${isActive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          fontSize: '0.72rem', color: isActive ? '#10b981' : '#ef4444', fontWeight: 600,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? '#10b981' : '#ef4444', display: 'inline-block' }} />
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    );
  };

  // ── Active alerts strip ───────────────────────────────────────────────────

  const renderAlertsStrip = () => {
    if (activeAlerts.length === 0) return null;

    const severityPalette: Record<string, { bg: string; color: string; border: string }> = {
      critical: { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', border: 'rgba(239,68,68,0.25)'  },
      warning:  { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
      info:     { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
    };

    return (
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {activeAlerts.map(alert => {
          const p = severityPalette[alert.severity] ?? severityPalette.info;
          return (
            <div
              key={alert.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px', borderRadius: 10,
                background: p.bg, border: `1px solid ${p.border}`,
              }}
            >
              <AlertTriangle size={13} color={p.color} style={{ flexShrink: 0 }} />
              {alert.fault_code && (
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                  padding: '1px 6px', borderRadius: 4,
                  background: p.bg, border: `1px solid ${p.border}`, color: p.color, flexShrink: 0,
                }}>
                  {alert.fault_code}
                </span>
              )}
              <span style={{ fontSize: '0.75rem', color: p.color, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {alert.message}
              </span>
              {alert.status && (
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: p.color, opacity: 0.7, flexShrink: 0 }}>
                  {alert.status}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="admin-container responsive-page" style={{ paddingBottom: 40 }}>

      <PageHeader
        icon={<LayoutDashboard size={20} color="white" />}
        title="Dashboard"
        subtitle="Site overview and live health"
        rightSlot={
          <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 10,
              border: `1px solid ${border}`,
              background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
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
        }
      />

      {/* ── Content ── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px 0' }}>

        {/* Site KPIs */}
        {renderSiteKPIs()}

        {/* Active alerts strip */}
        {renderAlertsStrip()}

        {/* Site info strip */}
        {renderSiteInfoStrip()}

        {/* Energy intelligence (SiteDataPanel) */}
        {selectedSiteId && (
          <div style={{ marginTop: 24 }}>
            <SiteDataPanel
              key={selectedSiteId}
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
