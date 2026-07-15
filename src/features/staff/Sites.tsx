import React, { useEffect, useMemo, useState } from "react";
import MobileSites from '../mobile/staff/MobileSites';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { AnimatePresence, motion } from "framer-motion";
import {
  CircleCheck, Plus, Search,
  Server, Wifi, WifiOff, X,
  Globe, AlertTriangle, Zap, HardDrive,
} from "lucide-react";
import { Link } from "react-router-dom";

import { apiService } from "../../services/api";
import { useTheme } from "../../contexts/ThemeContext";
import PageHeader, { GradientCTAButton } from "../../shared/layout/PageHeader";

// ── Interfaces ───────────────────────────────────────────────────────────────

type SiteStatus = "draft" | "commissioning" | "active" | "inactive" | "archived";
type GatewayState = "online" | "offline" | "no-gateway";
type StatusFilter = "all" | SiteStatus;

interface SiteDeviceRow {
  device_id?: number;
  device_serial?: string;
  is_online?: boolean;
}

interface SiteRow {
  site_id?: string;
  display_name?: string;
  latitude?: number;
  longitude?: number;
  site_status?: SiteStatus;
  is_active?: boolean;
  updated_at?: string;
  devices?: SiteDeviceRow[];
  gateway_device?: {
    is_online?: boolean;
    last_seen_at?: string | null;
    signal_strength_dbm?: number | null;
    heartbeat_health?: {
      severity?: 'ok' | 'warn' | 'critical';
    } | null;
  } | null;
}

interface SiteCardModel {
  id: string;
  name: string;
  location: string;
  status: SiteStatus;
  gatewayState: GatewayState;
  updatedLabel: string;
  devices: number;
  lastSeenLabel: string;
  signalLabel: string;
  healthSeverity: 'ok' | 'warn' | 'critical';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ORDER: SiteStatus[] = ["draft", "commissioning", "active", "inactive", "archived"];
const MOTION_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const isKnownStatus = (value: unknown): value is SiteStatus =>
  ["draft", "commissioning", "active", "inactive", "archived"].includes(value as string);

function resolveStatus(row: SiteRow): SiteStatus {
  if (isKnownStatus(row.site_status)) return row.site_status;
  if (typeof row.is_active === "boolean") return row.is_active ? "active" : "inactive";
  const count = Array.isArray(row.devices) ? row.devices.length : 0;
  return count > 0 ? "active" : "draft";
}

function resolveGatewayState(row: SiteRow): GatewayState {
  if (row.gateway_device) return row.gateway_device.is_online ? "online" : "offline";
  const devices = Array.isArray(row.devices) ? row.devices : [];
  if (devices.length === 0) return "no-gateway";
  return devices.some((device) => device.is_online) ? "online" : "offline";
}

function formatLocation(row: SiteRow): string {
  if (typeof row.latitude === "number" && typeof row.longitude === "number") {
    return `${row.latitude.toFixed(4)}°, ${row.longitude.toFixed(4)}°`;
  }
  return "Location unavailable";
}

function toRelativeTime(iso?: string): string {
  if (!iso) return "Unknown";
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown";
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "Just now";
  const minute = 60_000, hour = 60 * minute, day = 24 * hour;
  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  return `${Math.floor(diffMs / day)}d ago`;
}

function mapRowToSite(row: SiteRow, fallbackIndex: number): SiteCardModel {
  const id = row.site_id || `site-${fallbackIndex + 1}`;
  const gateway = row.gateway_device;
  const rawSignal = gateway?.signal_strength_dbm;
  const signalLabel = typeof rawSignal === 'number' ? `${rawSignal}%` : 'N/A';
  const lastSeenIso = gateway?.last_seen_at || undefined;
  const lastSeenLabel = toRelativeTime(lastSeenIso);
  const healthSeverity = gateway?.heartbeat_health?.severity || 'ok';
  return {
    id,
    name: row.display_name || id,
    location: formatLocation(row),
    status: resolveStatus(row),
    gatewayState: resolveGatewayState(row),
    updatedLabel: toRelativeTime(row.updated_at || lastSeenIso),
    devices: Array.isArray(row.devices) ? row.devices.length : 0,
    lastSeenLabel,
    signalLabel,
    healthSeverity,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Sites() {
  const isMobile = useIsMobile();
  const { isDark } = useTheme();

  // ── Design Tokens ──
  // ── Design tokens — matches mobile AppTheme ───────────────────────────────
  const bg      = 'var(--background)';
  const surface = 'var(--card)';
  const cardEl  = 'var(--card)';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(18,21,26,0.09)';
  const borderMuted = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(18,21,26,0.05)';
  const text    = 'var(--foreground)';
  const textMute = 'var(--muted-foreground)';
  const textDim  = 'var(--text-dim)';
  const accent   = '#2FBF71';

  const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
    active:        { color: accent,     bg: 'rgba(47,191,113,0.10)',  label: 'Active' },
    commissioning: { color: '#3B82F6',  bg: 'rgba(59,130,246,0.10)', label: 'Commissioning' },
    inactive:      { color: '#EF4444',  bg: 'rgba(239,68,68,0.10)',  label: 'Inactive' },
    draft:         { color: textDim,    bg: surface,                  label: 'Draft' },
    archived:      { color: textDim,    bg: surface,                  label: 'Archived' },
  };

  const GW_CFG: Record<GatewayState, { color: string; icon: React.ReactNode; label: string }> = {
    online:     { color: accent,    icon: <Wifi size={12} />,    label: 'GW Online' },
    offline:    { color: '#EF4444', icon: <WifiOff size={12} />, label: 'GW Offline' },
    'no-gateway': { color: textDim, icon: <HardDrive size={12}/>, label: 'No gateway' },
  };

  const statusCfg = (s: string) => STATUS_CFG[s] ?? { color: textDim, bg: surface, label: s };

  // KPI palette
  const kpiCfg = {
    portfolio: { accent: textMute,   bg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(18,21,26,0.05)' },
    active:    { accent,             bg: 'rgba(47,191,113,0.10)' },
    gateways:  { accent: '#3B82F6',  bg: 'rgba(59,130,246,0.10)' },
    attention: { accent: '#E9B949',  bg: 'rgba(233,185,73,0.10)' },
  };

  // State
  const [sites, setSites] = useState<SiteCardModel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data Fetching
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true); setError(null);
      try {
        const rows = await apiService.getSitesList(includeInactive ? { includeInactive: true } : undefined);
        const list = Array.isArray(rows) ? rows : [];
        if (mounted) setSites(list.map((row, index) => mapRowToSite(row as SiteRow, index)));
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load sites");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [includeInactive]);

  // Derived Metrics
  const statusCounts = useMemo(() => ({
    draft: sites.filter(s => s.status === "draft").length,
    commissioning: sites.filter(s => s.status === "commissioning").length,
    active: sites.filter(s => s.status === "active").length,
    inactive: sites.filter(s => s.status === "inactive").length,
    archived: sites.filter(s => s.status === "archived").length,
  }), [sites]);

  const gatewayCounts = useMemo(() => ({
    online: sites.filter(s => s.gatewayState === "online").length,
    offline: sites.filter(s => s.gatewayState === "offline").length,
    noGateway: sites.filter(s => s.gatewayState === "no-gateway").length,
  }), [sites]);

  const filteredSites = useMemo(() => {
    let list = sites;
    if (!includeInactive) list = list.filter(s => s.status !== "inactive" && s.status !== "archived");
    if (statusFilter !== "all") list = list.filter(s => s.status === statusFilter);
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.location.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
    return list;
  }, [sites, includeInactive, statusFilter, searchQuery]);

  const totalSites = sites.length;
  const activeSites = statusCounts.active;
  const attentionSites = sites.filter(s => s.status === "inactive" || s.status === "commissioning" || s.gatewayState === "offline").length;
  const onlineRatio = totalSites === 0 ? 0 : Math.round((gatewayCounts.online / totalSites) * 100);

  // ── Render Helpers ────────────────────────────────────────────────────────

  const renderKPIs = () => {
    const cards = [
      { key: 'portfolio', label: 'Total Portfolio', value: String(totalSites),  sub: 'Managed site records',        icon: <Server size={15} />,        cfg: kpiCfg.portfolio },
      { key: 'active',    label: 'Operational',     value: String(activeSites), sub: 'Active and serving load',     icon: <CircleCheck size={15} />,    cfg: kpiCfg.active },
      { key: 'gateways',  label: 'Gateways Online', value: `${onlineRatio}%`,   sub: `${gatewayCounts.online} online`, icon: <Wifi size={15} />,       cfg: kpiCfg.gateways },
      { key: 'attention', label: 'Need Attention',  value: String(attentionSites), sub: 'Inactive, offline, setup', icon: <AlertTriangle size={15} />, cfg: kpiCfg.attention },
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
        {cards.map(({ key, label, value, sub, icon, cfg }) => (
          <div key={key} style={{
            background: surface, border: `1px solid ${border}`, borderRadius: 18,
            padding: 14, position: 'relative', overflow: 'hidden', minHeight: 100,
            boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 1px 6px rgba(0,0,0,0.04)',
          }}>
            {/* Corner glow */}
            <span style={{ position: 'absolute', top: -18, right: -18, width: 56, height: 56, borderRadius: '50%', background: `${cfg.accent}0A`, pointerEvents: 'none' }} />
            <span style={{ position: 'absolute', top: -6, right: -6, width: 28, height: 28, borderRadius: '50%', background: `${cfg.accent}0D`, pointerEvents: 'none' }} />

            {/* Icon badge + label row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 10,
                background: cfg.bg, color: cfg.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${cfg.accent}25`, flexShrink: 0,
              }}>
                {icon}
              </div>
              <span style={{ color: textMute, fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            </div>

            {/* Value */}
            <div style={{ color: text, fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
            <div style={{ color: textDim, fontSize: '0.6875rem', marginTop: 4 }}>{sub}</div>

            {/* Accent baseline bar */}
            <div style={{ position: 'absolute', bottom: 8, left: 14, width: 24, height: 2, borderRadius: 1, background: `${cfg.accent}50` }} />
          </div>
        ))}
      </div>
    );
  };

  const renderSiteCard = (site: SiteCardModel) => {
    const sc  = statusCfg(site.status);
    const gwc = GW_CFG[site.gatewayState];
    const accentColor = sc.color === textDim ? border : sc.color;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.16, ease: MOTION_EASE }}
        key={site.id}
      >
        <Link to={`/sites/${encodeURIComponent(site.id)}`} style={{ textDecoration: 'none' }}>
          <div
            style={{
              background: surface,
              border: `1px solid ${border}`,
              borderLeft: `3px solid ${accentColor}`,
              borderRadius: 18,
              padding: 16,
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = cardEl)}
            onMouseLeave={e => (e.currentTarget.style.background = surface)}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: text, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {site.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: textDim, fontFamily: 'monospace' }}>{site.id}</div>
              </div>
              {/* Status chip: dot + label */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 8px', borderRadius: 999,
                background: sc.bg,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: sc.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: sc.color }}>{sc.label}</span>
              </div>
            </div>

            {/* Footer row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              paddingTop: 10, borderTop: `1px solid ${borderMuted}`,
            }}>
              {/* Gateway */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: gwc.color, display: 'flex' }}>{gwc.icon}</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: gwc.color }}>{gwc.label}</span>
              </div>

              {/* Device count */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <HardDrive size={13} color={textMute} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: text }}>
                  {site.devices}
                  <span style={{ fontWeight: 400, color: textMute }}> devices</span>
                </span>
              </div>

              {/* Updated */}
              <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: textDim }}>{site.updatedLabel}</div>
            </div>

            {/* Health bar */}
            {site.devices > 0 && (
              <div style={{ height: 3, background: borderMuted, borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                <div style={{
                  height: 3, borderRadius: 2,
                  width: site.gatewayState === 'online' ? '100%' : site.gatewayState === 'offline' ? '100%' : '0%',
                  background: site.gatewayState === 'online' ? accent : site.gatewayState === 'offline' ? '#EF4444' : textDim,
                  transition: 'width 0.4s',
                }} />
              </div>
            )}
          </div>
        </Link>
      </motion.div>
    );
  };

  // Filter chip options
  const FILTER_CHIPS: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all',           label: 'All',           count: sites.length },
    { value: 'active',        label: 'Active',        count: statusCounts.active },
    { value: 'commissioning', label: 'Commissioning', count: statusCounts.commissioning },
    { value: 'draft',         label: 'Draft',         count: statusCounts.draft },
    { value: 'inactive',      label: 'Inactive',      count: statusCounts.inactive + statusCounts.archived },
  ];

  if (isMobile) return <MobileSites />;

  // ── Main Render ───────────────────────────────────────────────────────────

  return (
    <div className="admin-container responsive-page" style={{ paddingBottom: 60, background: bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 'clamp(16px, 2vw, 28px) clamp(12px, 2vw, 24px) 0' }}>

        <PageHeader
          title="Sites & Operations"
          subtitle={`${sites.length} site${sites.length !== 1 ? 's' : ''} · manage lifecycle and ownership`}
          rightSlot={
            <Link to="/sites/commissioning" style={{ textDecoration: 'none' }}>
              <GradientCTAButton>
                <Plus size={16} /> Commission New Site
              </GradientCTAButton>
            </Link>
          }
        />

        {/* KPI Cards */}
        {renderKPIs()}

        {/* Search bar — matching mobile search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: surface, border: `1px solid ${border}`, borderRadius: 14,
          padding: '0 12px', height: 44, marginBottom: 14,
          boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <Search size={18} color={textDim} style={{ flexShrink: 0 }} />
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search sites…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: text, fontSize: '0.9375rem',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={17} color={textDim} />
            </button>
          )}
        </div>

        {/* Filter chips — horizontal scrollable row matching mobile */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 20 }}>
          {FILTER_CHIPS.map(chip => {
            const isActive = statusFilter === chip.value && !(chip.value === 'inactive' && includeInactive && statusFilter === 'all');
            const active = statusFilter === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => {
                  setStatusFilter(chip.value);
                  if (chip.value === 'inactive') setIncludeInactive(true);
                  else if (chip.value === 'all') setIncludeInactive(false);
                }}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px', borderRadius: 999,
                  border: `1px solid ${active ? accent : border}`,
                  background: active ? accent : surface,
                  color: active ? '#fff' : textMute,
                  fontSize: '0.8125rem', fontWeight: active ? 700 : 500,
                  cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap',
                }}
              >
                {chip.label} ({chip.count})
              </button>
            );
          })}
        </div>

        {/* Site list */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 10, color: textMute }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${border}`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: '0.8125rem' }}>Loading sites…</span>
          </div>
        ) : error ? (
          <div style={{ padding: 20, borderRadius: 14, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)', color: '#EF4444', fontSize: '0.875rem' }}>
            {error}
          </div>
        ) : filteredSites.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 36, background: surface, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Server size={32} color={textDim} />
            </div>
            <div style={{ color: text, fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>
              {searchQuery ? 'No sites match your search' : 'No sites yet'}
            </div>
            <div style={{ color: textMute, fontSize: '0.875rem' }}>
              {searchQuery ? 'Try a different name or site ID' : 'Commission your first site to get started'}
            </div>
          </div>
        ) : (
          <>
            {/* "Recent" / "Results" section */}
            {filteredSites.slice(0, 3).length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.075em', textTransform: 'uppercase', color: textDim, marginBottom: 10 }}>
                  {searchQuery ? 'Results' : 'Recent'}
                </div>
                <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filteredSites.slice(0, 3).map(renderSiteCard)}
                  </AnimatePresence>
                </motion.div>
              </div>
            )}

            {/* "All Sites" section */}
            {!searchQuery && filteredSites.slice(3).length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.075em', textTransform: 'uppercase', color: textDim, marginBottom: 10 }}>
                  All Sites
                </div>
                <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filteredSites.slice(3).map(renderSiteCard)}
                  </AnimatePresence>
                </motion.div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
