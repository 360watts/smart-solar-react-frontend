import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive, ArrowRight, CircleAlert, CircleCheck, 
  Clock3, Cpu, Filter, MapPin, Plus, Search, 
  Server, Wifi, WifiOff, X, LayoutDashboard,
  Globe, AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";

import { apiService } from "../services/api";
import { useTheme } from "../contexts/ThemeContext";
import PageHeader from "./PageHeader";

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
  const { isDark } = useTheme();

  // ── Design Tokens ──
  const bg       = isDark ? '#020617' : '#f0fdf4';
  const surface  = isDark ? '#0f172a' : '#ffffff';
  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.15)';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMute = isDark ? '#64748b' : '#94a3b8';
  const textSub  = isDark ? '#94a3b8' : '#475569';
  const primary  = '#00a63e';
  const nativeSelectBg = isDark ? '#0f172a' : '#ffffff';
  const nativeSelectFg = isDark ? '#e2e8f0' : '#0f172a';

  const palette = {
    ok:   { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
    warn: { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
    err:  { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
    info: { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6', border: 'rgba(59,130,246,0.2)'  },
    mute: { bg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: textSub, border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)' },
  };

  const getStatusStyle = (status: SiteStatus | GatewayState | 'ok' | 'warn' | 'critical') => {
    switch (status) {
      case 'active': case 'online': return palette.ok;
      case 'commissioning': return palette.info;
      case 'inactive': case 'offline': return palette.err;
      case 'warn': return palette.warn;
      case 'critical': return palette.err;
      case 'ok': return palette.ok;
      case 'draft': case 'archived': case 'no-gateway': default: return palette.mute;
    }
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
    const kpiCards = [
      { label: 'Total Portfolio', value: totalSites, sub: 'Managed site records', icon: <Server size={22} />, status: 'mute' },
      { label: 'Operational', value: activeSites, sub: 'Active and serving load', icon: <CircleCheck size={22} />, status: 'ok' },
      { label: 'Gateways Online', value: `${onlineRatio}%`, sub: `${gatewayCounts.online} active gateways`, icon: <Wifi size={22} />, status: 'info' },
      { label: 'Require Attention', value: attentionSites, sub: 'Inactive, offline, or setup', icon: <AlertTriangle size={22} />, status: attentionSites > 0 ? 'warn' : 'ok' },
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {kpiCards.map(({ label, value, sub, icon, status }) => {
          const s = palette[status as keyof typeof palette];
          return (
            <div key={label} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 20, position: 'relative', overflow: 'hidden', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,166,62,0.03)' }}>
              <span style={{ position: 'absolute', top: -24, right: -24, width: 64, height: 64, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', display: 'block' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                  {icon}
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: textSub, marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: textMain, marginBottom: 4, lineHeight: 1.2 }}>{value}</div>
              <div style={{ fontSize: '0.72rem', color: textMute }}>{sub}</div>
              <div style={{ marginTop: 14, height: 3, width: 48, borderRadius: 999, background: s.color, opacity: 0.4 }} />
            </div>
          );
        })}
      </div>
    );
  };

  const renderSiteCard = (site: SiteCardModel) => {
    const sStyle = getStatusStyle(site.status);
    const gStyle = getStatusStyle(site.gatewayState);
    const hStyle = getStatusStyle(site.healthSeverity);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.16, ease: MOTION_EASE }}
        key={site.id}
        style={{
          background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: textMain, margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {site.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: textMute }}>
              <MapPin size={12} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{site.location}</span>
            </div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', background: sStyle.bg, color: sStyle.color, border: `1px solid ${sStyle.border}` }}>
            {site.status}
          </span>
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: palette.mute.bg, border: `1px solid ${palette.mute.border}` }}>
              <span style={{ fontSize: '0.75rem', color: textSub, fontWeight: 500 }}>Gateway</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 600, color: gStyle.color }}>
                 {site.gatewayState === 'online' ? <Wifi size={12}/> : <WifiOff size={12}/>}
                 {site.gatewayState}
              </span>
           </div>
           
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: palette.mute.bg, border: `1px solid ${palette.mute.border}` }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: textMute, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}><Cpu size={12}/> Devices</div>
                <div style={{ fontSize: '0.9rem', color: textMain, fontWeight: 600 }}>{site.devices}</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: palette.mute.bg, border: `1px solid ${palette.mute.border}` }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: textMute, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}><Clock3 size={12}/> Updated</div>
                <div style={{ fontSize: '0.9rem', color: textMain, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{site.updatedLabel}</div>
              </div>
           </div>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: palette.mute.bg, border: `1px solid ${palette.mute.border}` }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: textMute, fontWeight: 600, marginBottom: 4 }}>Last Seen</div>
                <div style={{ fontSize: '0.9rem', color: textMain, fontWeight: 600 }}>{site.lastSeenLabel}</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: palette.mute.bg, border: `1px solid ${palette.mute.border}` }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: textMute, fontWeight: 600, marginBottom: 4 }}>Signal</div>
                <div style={{ fontSize: '0.9rem', color: textMain, fontWeight: 600 }}>{site.signalLabel}</div>
              </div>
           </div>
           <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', width: 'fit-content', background: hStyle.bg, color: hStyle.color, border: `1px solid ${hStyle.border}` }}>
             Health: {site.healthSeverity}
           </div>
        </div>

        {/* Action */}
        <Link to={`/sites/${encodeURIComponent(site.id)}`} style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%', padding: '10px', borderRadius: 8,
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${palette.mute.border}`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: '0.8rem', fontWeight: 600, color: textMain, transition: 'background 150ms'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)')}
          >
            Open Details <ArrowRight size={14} style={{ color: textMute }} />
          </button>
        </Link>
      </motion.div>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────

  return (
    <div className="admin-container responsive-page" style={{ paddingBottom: 60 }}>
      <PageHeader
        icon={<Globe size={20} color="white" />}
        title="Sites & Operations"
        subtitle="Manage sites, lifecycle status, and ownership"
        rightSlot={
          <Link to="/sites/commissioning" style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: primary, color: '#fff', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 600, boxShadow: '0 2px 6px rgba(0,166,62,0.3)'
            }}>
              <Plus size={14} /> New Site
            </button>
          </Link>
        }
      />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px 0' }}>
        
        {/* KPI Cards */}
        {renderKPIs()}

        {/* Controls Row */}
        <div style={{ 
          display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', 
          background: surface, padding: '12px 16px', borderRadius: 12, border: `1px solid ${border}`, marginBottom: 24
        }}>
           
           {/* Search */}
           <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 280, background: palette.mute.bg, border: `1px solid ${palette.mute.border}`, borderRadius: 8, padding: '8px 12px' }}>
              <Search size={16} color={textMute} />
              <input 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sites, locations, or IDs..."
                style={{ background: 'transparent', border: 'none', outline: 'none', color: textMain, width: '100%', fontSize: '0.85rem' }}
              />
              {searchQuery && <X size={14} color={textMute} style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
           </div>

           {/* Filter Toggles */}
           <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: textSub, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} style={{ accentColor: primary }} />
                Include Inactive
              </label>

              <div style={{ width: 1, height: 24, background: border, margin: '0 8px' }} />
              
              <select 
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                style={{ 
                  background: palette.mute.bg, border: `1px solid ${palette.mute.border}`, color: textMain, 
                  padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', outline: 'none', cursor: 'pointer',
                }}
              >
                 <option value="all">All Statuses</option>
                 <option value="active">Active</option>
                 <option value="commissioning">Commissioning</option>
                 <option value="draft">Draft</option>
                 <option value="inactive">Inactive</option>
              </select>
           </div>
        </div>

        {/* Site Grid */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: textMute }}>
            Loading sites...
          </div>
        ) : error ? (
          <div style={{ padding: 20, borderRadius: 12, background: palette.err.bg, border: `1px solid ${palette.err.border}`, color: palette.err.color, fontSize: '0.85rem' }}>
            {error}
          </div>
        ) : filteredSites.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: surface, borderRadius: 14, border: `1px dashed ${textMute}` }}>
            <Server size={32} color={textMute} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <h3 style={{ color: textMain, margin: '0 0 8px 0', fontSize: '1.1rem' }}>No sites found</h3>
            <p style={{ color: textMute, margin: 0, fontSize: '0.85rem' }}>Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredSites.map(renderSiteCard)}
            </AnimatePresence>
          </motion.div>
        )}

      </div>
    </div>
  );
}