import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  LayoutDashboard, ChevronDown, Wifi, WifiOff, RefreshCw, Search, X,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiService, AlertItem } from '../../services/api';
import SiteDataPanel from '../../shared/components/SiteDataPanel';
import PageHeader from '../../shared/layout/PageHeader';
import MobileDashboard from '../mobile/staff/MobileDashboard';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { getDesignTokens } from '../../shared/theme';
import HealthBand from './HealthBand';

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
  const { user } = useAuth();
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase()
    || user?.username?.[0]?.toUpperCase() || '?';

  // Sites
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [alertsCollapsed, setAlertsCollapsed] = useState(true);
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
      if (document.hidden) return;
      fetchSites();
      fetchAlerts();
    }, 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Equipment health score for the health band (was in the energy-flow header strip).
  const [equipmentHealth, setEquipmentHealth] = useState<number | null>(null);
  useEffect(() => {
    setEquipmentHealth(null);
    if (!selectedSiteId) return;
    let cancelled = false;
    apiService.getSiteHardwareHealth(selectedSiteId)
      .then(d => { if (!cancelled) setEquipmentHealth(d?.overall_score ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedSiteId]);

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

  // ── Active alerts strip ───────────────────────────────────────────────────

  const renderAlertsStrip = () => {
    const severityPalette: Record<string, { bg: string; color: string; border: string }> = {
      critical: { bg: tokens.dangerSoft,  color: tokens.danger,  border: tokens.dangerSoft  },
      warning:  { bg: tokens.warningSoft, color: tokens.warning, border: tokens.warningSoft },
      info:     { bg: tokens.infoSoft,    color: tokens.info,    border: tokens.infoSoft    },
    };

    return (
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  fontSize: '0.75rem', fontWeight: 700, fontFamily: "'Fira Code', 'Fira Code', monospace",
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
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: p.color, opacity: 0.7, flexShrink: 0 }}>
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
      {/* ── Content: header, health band, tabs and panel share one 1400 px column (mockup alignment) ── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', minWidth: 0 }}>

      <PageHeader
        title="Dashboard"
        subtitle="Live site health and energy"
        rightSlot={
          <>
          <div style={{ position: 'relative', minWidth: 0 }}>
          {/* Site switcher pill (mockup): status dot, site name, chevron; 44 px tall, shrinks with ellipsis */}
          <button
            onClick={() => setDropdownOpen(o => !o)}
            aria-expanded={dropdownOpen}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              height: 44, padding: '0 16px', borderRadius: 999, maxWidth: '100%', minWidth: 0, boxSizing: 'border-box',
              border: `1px solid ${border}`,
              background: surface,
              cursor: 'pointer', color: textMain,
              fontSize: 14, fontWeight: 500, fontFamily: "'Rubik', sans-serif",
              userSelect: 'none', transition: 'background 150ms',
            }}
          >
            {selectedSite && <span style={{ ...onlineDot(siteIsOnline(selectedSite)), width: 8, height: 8, boxShadow: 'none' }} />}
            <span style={{ minWidth: 0, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedSite ? `${selectedSite.site_id} · ${selectedSite.display_name}` : 'Select site'}
            </span>
            {selectedSite && selectedSite.devices.length > 1 && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: tokens.surfaceMuted, color: textSub, whiteSpace: 'nowrap', flexShrink: 0 }}>
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
                            <div style={{ fontSize: '0.75rem', color: textMute, fontFamily: "'Fira Code', 'Fira Code', monospace", marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {site.devices.length === 0 ? 'No devices' : site.devices.map(d => d.device_serial).join(' · ')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                            {site.devices.length > 1 && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: textSub, background: tokens.surfaceMuted, padding: '1px 6px', borderRadius: 999 }}>
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
                <div style={{ padding: '7px 14px', borderTop: `1px solid ${tokens.border}`, fontSize: '0.75rem', color: textMute }}>
                  {filteredSites.length} of {sites.length} site{sites.length !== 1 ? 's' : ''}
                </div>
              </div>
            </>
          )}
          </div>
          {/* Avatar circle (mockup): opens the profile */}
          <Link to="/profile" title="My Profile" aria-label="My Profile" style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0, textDecoration: 'none',
            background: tokens.surfaceMuted, color: textMain,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Rubik', sans-serif", fontSize: 14, fontWeight: 600,
          }}>{initials}</Link>
          </>
        }
      />

        {/* Site health */}
        {selectedSite && (
          <HealthBand
            devicesOnline={selectedSite.devices.filter(d => d.is_online).length}
            devicesTotal={selectedSite.devices.length}
            pvKw={selectedSite.capacity_kw}
            inverterKw={selectedSite.inverter_capacity_kw ?? null}
            latitude={selectedSite.latitude} longitude={selectedSite.longitude} timezone={selectedSite.timezone}
            isActive={selectedSite.is_active !== false}
            alertCount={activeAlerts.length}
            hasCritical={activeAlerts.some(a => a.severity === 'critical')}
            onToggleAlerts={() => setAlertsCollapsed(c => !c)}
            alertsOpen={!alertsCollapsed}
            equipmentHealth={equipmentHealth}
            isDark={isDark}
          />
        )}

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

        {/* Active alerts: only when there are some and the health band opened them */}
        {activeAlerts.length > 0 && !alertsCollapsed && renderAlertsStrip()}

        {/* Energy intelligence (SiteDataPanel) */}
        {/* SiteDataPanel brings its own 24 px top margin */}
        {selectedSiteId && (
          <SiteDataPanel
            key={selectedSiteId}
            siteId={selectedSiteId}
            autoRefresh
            inverterCapacityKw={selectedSite?.inverter_capacity_kw}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
