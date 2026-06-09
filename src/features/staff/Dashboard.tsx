import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  LayoutDashboard, ChevronDown, Wifi, WifiOff, RefreshCw, Search, X,
  Activity, Server, CheckCircle, AlertTriangle, XCircle, Zap,
  MapPin, Globe, Compass, Bell,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService, AlertItem } from '../../services/api';
import SiteDataPanel from '../../shared/components/SiteDataPanel';
import PageHeader from '../../shared/layout/PageHeader';
import MobileDashboard from '../mobile/MobileDashboard';
import { useIsMobile } from '../../shared/hooks/useIsMobile';

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
  const [alertsError, setAlertsError] = useState<string | null>(null);
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
      setAlertsError(null);
    } catch (err) {
      console.error('Failed to load alerts:', err);
      setAlertsError('Could not load alerts');
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

  // ── Design tokens — matches mobile AppTheme ─────────────────────────────
  const bg       = isDark ? '#080C14' : '#F4F6F8';
  const surface  = isDark ? '#0F1623' : '#FFFFFF';
  const cardEl   = isDark ? '#111927' : '#EDF0F4';
  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(18,21,26,0.09)';
  const borderMuted = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(18,21,26,0.05)';
  const textMain = isDark ? '#F0F4FF' : '#12151A';
  const textMute = isDark ? 'rgba(240,244,255,0.52)' : 'rgba(18,21,26,0.52)';
  const textSub  = isDark ? '#8892A4' : '#717182';
  const textDim  = isDark ? 'rgba(240,244,255,0.32)' : 'rgba(18,21,26,0.32)';
  const accent   = '#2FBF71';

  const onlineDot = (online: boolean): React.CSSProperties => ({
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
    background: online ? accent : '#EF4444',
    boxShadow: online ? `0 0 5px ${accent}88` : 'none',
  });

  const statusPalette = {
    ok:   { bg: 'rgba(47,191,113,0.10)',  color: accent,    border: 'rgba(47,191,113,0.25)' },
    warn: { bg: 'rgba(233,185,73,0.10)',  color: '#E9B949', border: 'rgba(233,185,73,0.25)' },
    err:  { bg: 'rgba(239,68,68,0.10)',   color: '#EF4444', border: 'rgba(239,68,68,0.25)'  },
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {kpiCards.map(({ label, value, sub, icon, status }) => {
          const s = statusPalette[status];
          return (
            <div key={label} style={{
              background: surface, border: `1px solid ${border}`, borderRadius: 18,
              padding: 14, position: 'relative', overflow: 'hidden', minHeight: 100,
              boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 1px 6px rgba(0,0,0,0.04)',
            }}>
              {/* Corner glow */}
              <span style={{ position: 'absolute', top: -18, right: -18, width: 56, height: 56, borderRadius: '50%', background: `${s.color}0A`, pointerEvents: 'none' }} />
              <span style={{ position: 'absolute', top: -6, right: -6, width: 28, height: 28, borderRadius: '50%', background: `${s.color}0D`, pointerEvents: 'none' }} />

              {/* Icon badge + label row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 10,
                  background: s.bg, color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${s.color}25`, flexShrink: 0,
                }}>
                  {React.cloneElement(icon as React.ReactElement<any>, { size: 15 })}
                </div>
                <span style={{ color: textMute, fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              </div>

              {/* Value */}
              <div className="staff-data" style={{ color: textMain, fontSize: '1.625rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
              <div style={{ color: textDim, fontSize: '0.6875rem', marginTop: 4 }}>{sub}</div>

              {/* Accent baseline bar */}
              <div style={{ position: 'absolute', bottom: 8, left: 14, width: 24, height: 2, borderRadius: 1, background: `${s.color}50` }} />
            </div>
          );
        })}
      </div>
    );
  };

  // ── Site info strip ───────────────────────────────────────────────────────

  const renderSiteInfoStrip = () => {
    if (!selectedSite) return null;

    const chipBg     = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(18,21,26,0.04)';
    const chipBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(18,21,26,0.09)';
    const isActive   = selectedSite.is_active !== false;

    const chips: { icon: React.ReactNode; text: string }[] = [
      { icon: <MapPin size={11} />, text: `${selectedSite.latitude}° N, ${selectedSite.longitude}° E` },
      { icon: <Globe size={11} />,  text: selectedSite.timezone },
      ...(selectedSite.tilt_deg != null && selectedSite.azimuth_deg != null
        ? [{ icon: <Compass size={11} />, text: `Tilt ${selectedSite.tilt_deg}° · Azimuth ${selectedSite.azimuth_deg}°` }]
        : []),
    ];

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 0 }}>
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
    const severityPalette: Record<string, { bg: string; color: string; border: string }> = {
      critical: { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', border: 'rgba(239,68,68,0.25)'  },
      warning:  { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
      info:     { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
    };

    return (
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 14px',
          borderRadius: 12,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(47,191,113,0.18)'}`,
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(47,191,113,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Bell size={14} color={activeAlerts.length > 0 ? '#2FBF71' : textMute} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: textMain }}>
              Active alerts
            </span>
          </div>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: activeAlerts.length > 0 ? '#2FBF71' : textMute,
          }}>
            {activeAlerts.length > 0 ? `${activeAlerts.length} open` : 'None'}
          </span>
        </div>

        {activeAlerts.length === 0 ? (
          <div style={{
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.28)'}`,
            color: textMute,
            fontSize: '0.78rem',
            background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
          }}>
            No active alerts for the selected site.
          </div>
        ) : activeAlerts.map(alert => {
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
                  fontSize: '0.65rem', fontWeight: 700, fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
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
    <div className="admin-container responsive-page" style={{ paddingBottom: 40, background: bg }}>

      <PageHeader
        title="Dashboard"
        subtitle="Live site health and energy intelligence"
        rightSlot={
          <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 999,
              border: `1px solid ${border}`,
              background: surface,
              cursor: 'pointer', color: textMain,
              fontSize: '0.8125rem', fontWeight: 600,
              userSelect: 'none', transition: 'background 150ms',
              boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
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
                minWidth: 'min(280px, calc(100vw - 32px))', maxHeight: 360,
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
                            <div style={{ fontSize: '0.7rem', color: textMute, fontFamily: "'Fira Code', 'JetBrains Mono', monospace", marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

        {/* Alerts error */}
        {alertsError && (
          <div style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: '0.875rem' }}>
              <AlertTriangle size={16} />
              <span>{alertsError}</span>
            </div>
            <button
              onClick={() => fetchAlerts()}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                background: '#ef4444',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        )}

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
