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
import MobileDashboard from '../mobile/staff/MobileDashboard';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { getDesignTokens } from '../../shared/theme';

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
  const tokens = getDesignTokens(isDark);
  const bg       = tokens.pageBg;
  const surface  = tokens.surface;
  const cardEl   = tokens.surfaceMuted;
  const border   = tokens.border;
  const textMain = tokens.text;
  const textMute = tokens.textMuted;
  const textSub  = tokens.textMuted;
  const textDim  = tokens.textDim;
  const accent   = tokens.primary;

  const onlineDot = (online: boolean): React.CSSProperties => ({
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
    background: online ? tokens.success : tokens.danger,
    boxShadow: online ? `0 0 5px ${accent}88` : 'none',
  });

  const statusPalette = {
    ok:   { bg: tokens.successSoft, color: tokens.success, border: tokens.successSoft },
    warn: { bg: tokens.warningSoft, color: tokens.warning, border: tokens.warningSoft },
    err:  { bg: tokens.dangerSoft,  color: tokens.danger,  border: tokens.dangerSoft  },
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
          <div style={{ width: 56, height: 56, borderRadius: 14, background: cardEl, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: tokens.primary, color: tokens.textInverse, fontSize: '0.8125rem', fontWeight: 600 }}>
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
              boxShadow: tokens.shadow,
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
          background: isActive ? tokens.successSoft : tokens.dangerSoft,
          border: `1px solid ${isActive ? tokens.successSoft : tokens.dangerSoft}`,
          fontSize: '0.72rem', color: isActive ? tokens.success : tokens.danger, fontWeight: 600,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? tokens.success : tokens.danger, display: 'inline-block' }} />
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    );
  };

  // ── Active alerts strip ───────────────────────────────────────────────────

  const renderAlertsStrip = () => {
    const severityPalette: Record<string, { bg: string; color: string; border: string }> = {
      critical: { bg: tokens.dangerSoft,  color: tokens.danger,  border: tokens.dangerSoft  },
      warning:  { bg: tokens.warningSoft, color: tokens.warning, border: tokens.warningSoft },
      info:     { bg: tokens.infoSoft,    color: tokens.info,    border: tokens.infoSoft    },
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
          border: `1px solid ${tokens.border}`,
          background: tokens.primarySoft,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Bell size={14} color={activeAlerts.length > 0 ? tokens.primary : textMute} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: textMain }}>
              Active alerts
            </span>
          </div>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: activeAlerts.length > 0 ? tokens.primary : textMute,
          }}>
            {activeAlerts.length > 0 ? `${activeAlerts.length} open` : 'None'}
          </span>
        </div>

        {activeAlerts.length === 0 ? (
          <div style={{
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px dashed ${tokens.borderStrong}`,
            color: textMute,
            fontSize: '0.78rem',
            background: tokens.surface,
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
              boxShadow: isDark ? 'none' : tokens.shadow,
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
                border: `1px solid ${tokens.border}`,
                borderRadius: 14,
                boxShadow: tokens.shadow,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
                {/* Search */}
                <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${tokens.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: tokens.surfaceMuted, borderRadius: 8, padding: '5px 10px', border: `1px solid ${tokens.border}` }}>
                    <Search size={13} color={textMute} style={{ flexShrink: 0 }} />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search sites or devices…"
                      style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: textMain, caretColor: tokens.primary }}
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
                            background: active ? tokens.primarySoft : 'transparent',
                            borderLeft: `3px solid ${active ? tokens.primary : 'transparent'}`,
                            transition: 'background 120ms',
                          }}
                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = tokens.surfaceMuted; }}
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
                              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: textSub, background: tokens.surfaceMuted, padding: '1px 6px', borderRadius: 999 }}>
                                {site.devices.length} devices
                              </span>
                            )}
                            {online ? <Wifi size={12} color={tokens.success} /> : <WifiOff size={12} color={tokens.textMuted} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: '7px 14px', borderTop: `1px solid ${tokens.border}`, fontSize: '0.7rem', color: textMute }}>
                  {filteredSites.length} of {sites.length} site{sites.length !== 1 ? 's' : ''}
                </div>
              </div>
            </>
          )}
          </div>
        }
      />

      {/* ── Content ── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 'clamp(16px, 2vw, 28px) clamp(12px, 2vw, 24px) 0' }}>

        {/* Site KPIs */}
        {renderSiteKPIs()}

        {/* Alerts error */}
        {alertsError && (
          <div style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: 10,
            background: tokens.dangerSoft,
            border: `1px solid ${tokens.dangerSoft}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: tokens.danger, fontSize: '0.875rem' }}>
              <AlertTriangle size={16} />
              <span>{alertsError}</span>
            </div>
            <button
              onClick={() => fetchAlerts()}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                background: tokens.danger,
                color: '#FFFFFF',
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
