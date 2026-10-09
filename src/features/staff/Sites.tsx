import React, { useEffect, useMemo, useState } from "react";
import MobileSites from '../mobile/staff/MobileSites';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { ArrowRight, CircleCheck, HardDrive, Plus, Search, Server, Wifi, WifiOff, X } from "lucide-react";
import { Link } from "react-router-dom";

import { apiService } from "../../services/api";
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
  setup?: { filled: number; total: number; missing: string[] } | null;
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
  setup: { filled: number; total: number; missing: string[] } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ORDER: SiteStatus[] = ["draft", "commissioning", "active", "inactive", "archived"];

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
    setup: row.setup ?? null,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Sites() {
  const isMobile = useIsMobile();

  // State
  const [sites, setSites] = useState<SiteCardModel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [needsSetupOnly, setNeedsSetupOnly] = useState(false);
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
    if (needsSetupOnly) list = list.filter(s => (s.setup?.missing.length ?? 0) > 0);
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.location.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
    return list;
  }, [sites, includeInactive, statusFilter, needsSetupOnly, searchQuery]);
  const needsSetupCount = useMemo(() => sites.filter(s => (s.setup?.missing.length ?? 0) > 0).length, [sites]);

  const totalSites = sites.length;
  const activeSites = statusCounts.active;
  const attentionSites = sites.filter(s => s.status === "inactive" || s.status === "commissioning" || s.gatewayState === "offline").length;
  const onlineRatio = totalSites === 0 ? 0 : Math.round((gatewayCounts.online / totalSites) * 100);

  // ── Render ────────────────────────────────────────────────────────────────

  const STATUS_CLASS: Record<string, string> = {
    active: 'bg-done-soft text-done-ink',
    commissioning: 'bg-[var(--info-soft)] text-[var(--info)]',
    inactive: 'bg-destructive/10 text-destructive',
    draft: 'bg-muted text-muted-foreground',
    archived: 'bg-muted text-muted-foreground',
  };
  const GW_CLASS: Record<GatewayState, string> = {
    online: 'text-done-ink',
    offline: 'text-destructive',
    'no-gateway': 'text-muted-foreground',
  };
  const GW_ICON: Record<GatewayState, React.ReactNode> = {
    online: <Wifi size={13} />, offline: <WifiOff size={13} />, 'no-gateway': <HardDrive size={13} />,
  };

  const readyCount = sites.filter(s => s.setup && s.setup.missing.length === 0).length;
  const summary = [
    { label: 'Needs setup', value: String(needsSetupCount), sub: 'sites with details missing', tone: 'bg-needed-soft text-needed-ink border-needed/40' },
    { label: 'Ready', value: String(readyCount), sub: 'fully set up', tone: 'bg-card text-foreground border-border' },
    { label: 'Operational', value: String(activeSites), sub: 'active and serving load', tone: 'bg-card text-foreground border-border' },
    { label: 'Gateways online', value: `${onlineRatio}%`, sub: `${gatewayCounts.online} of ${totalSites}`, tone: 'bg-card text-foreground border-border' },
  ];

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors ${active ? 'bg-foreground text-background' : 'bg-card text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground'}`;

  const list = needsSetupOnly
    ? [...filteredSites].sort((a, b) => (a.setup ? a.setup.filled / a.setup.total : 1) - (b.setup ? b.setup.filled / b.setup.total : 1))
    : filteredSites;

  const renderRow = (site: SiteCardModel) => {
    const setup = site.setup;
    const missing = setup?.missing ?? [];
    return (
      <div key={site.id}
        className={`[display:grid] items-center gap-x-5 gap-y-3 rounded-2xl border bg-card px-5 py-4 shadow-sm lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,2.4fr)_auto] ${missing.length ? 'border-needed/40' : 'border-border'}`}>
        <div className="min-w-0">
          <Link to={`/sites/${encodeURIComponent(site.id)}`} className="block truncate text-base font-semibold text-foreground no-underline hover:underline">
            {site.name}
          </Link>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span style={{ fontFamily: 'var(--font-mono)' }}>{site.id}</span>
            <span>·</span>
            <span>{site.updatedLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[site.status] ?? STATUS_CLASS.draft}`}>
            {site.status === 'commissioning' ? 'Being set up' : site.status.charAt(0).toUpperCase() + site.status.slice(1)}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${GW_CLASS[site.gatewayState]}`}>
            {GW_ICON[site.gatewayState]}
            {site.gatewayState === 'online' ? 'Monitor online' : site.gatewayState === 'offline' ? 'Monitor offline' : 'No monitor'}
          </span>
        </div>

        <div className="min-w-0">
          {!setup ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : missing.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-done-ink"><CircleCheck size={15} /> All set</span>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-needed" style={{ width: `${(setup.filled / setup.total) * 100}%` }} />
                </span>
                <span className="w-10 text-sm font-semibold tabular-nums text-foreground">{setup.filled}/{setup.total}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missing.slice(0, 3).map(m => (
                  <span key={m} className="rounded-full bg-needed-soft px-2.5 py-0.5 text-xs font-medium text-needed-ink">{m}</span>
                ))}
                {missing.length > 3 && <span className="px-1 text-xs text-muted-foreground">+{missing.length - 3} more</span>}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end">
          {missing.length > 0 ? (
            <Link to={`/sites/onboarding?site=${encodeURIComponent(site.id)}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-foreground px-4 text-sm font-semibold text-background no-underline">
              Finish setup <ArrowRight size={15} />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link to={`/sites/onboarding?site=${encodeURIComponent(site.id)}`}
                className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground no-underline hover:text-foreground">
                Edit setup
              </Link>
              <Link to={`/sites/${encodeURIComponent(site.id)}`}
                className="inline-flex min-h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground no-underline">
                View
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  };

  const FILTER_CHIPS: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all',           label: 'All',          count: sites.length },
    { value: 'active',        label: 'Active',       count: statusCounts.active },
    { value: 'commissioning', label: 'Being set up', count: statusCounts.commissioning },
    { value: 'draft',         label: 'Draft',        count: statusCounts.draft },
    { value: 'inactive',      label: 'Inactive',     count: statusCounts.inactive + statusCounts.archived },
  ];

  if (isMobile) return <MobileSites />;

  return (
    <div className="admin-container responsive-page min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-[1400px] px-[clamp(12px,2vw,24px)] pt-[clamp(16px,2vw,28px)]">

        <PageHeader
          title="Sites"
          subtitle={`${sites.length} site${sites.length !== 1 ? 's' : ''} · ${needsSetupCount} still need setup`}
          rightSlot={
            <div className="flex items-center gap-3">
              <Link to="/sites/commissioning" style={{ textDecoration: 'none' }}>
                <GradientCTAButton>
                  <Plus size={16} /> New site
                </GradientCTAButton>
              </Link>
            </div>
          }
        />

        <div className="mb-6 [display:grid] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {summary.map(c => (
            <div key={c.label} className={`rounded-2xl border p-5 ${c.tone}`}>
              <div className="text-sm font-semibold opacity-80">{c.label}</div>
              <div className="mt-1 text-4xl font-bold leading-tight tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{c.value}</div>
              <div className="text-[0.8125rem] opacity-75">{c.sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] max-w-md flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Search sites" placeholder="Search by name or site code" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-input bg-card pl-10 pr-10 text-sm text-foreground outline-none focus-visible:border-done focus-visible:ring-4 focus-visible:ring-done/20" />
            {searchQuery && (
              <button type="button" aria-label="Clear search" onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground"><X size={15} /></button>
            )}
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {needsSetupCount > 0 && (
              <button type="button" aria-pressed={needsSetupOnly} onClick={() => setNeedsSetupOnly(v => !v)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors ${needsSetupOnly ? 'bg-needed text-black ring-2 ring-needed' : 'bg-needed-soft text-needed-ink'}`}>
                Needs setup <span className="tabular-nums">{needsSetupCount}</span>
              </button>
            )}
            {FILTER_CHIPS.map(c => (
              <button key={c.value} type="button" aria-pressed={statusFilter === c.value} className={chip(statusFilter === c.value)}
                onClick={() => {
                  setStatusFilter(c.value);
                  if (c.value === 'inactive') setIncludeInactive(true);
                  else if (c.value === 'all') setIncludeInactive(false);
                }}>
                {c.label} <span className="tabular-nums opacity-60">{c.count}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center gap-2.5 py-16 text-sm text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-done" />
            Loading sites…
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl bg-destructive/10 p-5 text-sm text-destructive">{error}</div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center">
            <Server size={32} className="mx-auto mb-3 text-muted-foreground" />
            <div className="font-semibold text-foreground">{searchQuery ? 'No sites match your search' : needsSetupOnly ? 'Every site is set up' : 'No sites yet'}</div>
            <div className="mt-1 text-sm text-muted-foreground">{searchQuery ? 'Try a different name or site code' : 'Nothing to show here.'}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">{list.map(renderRow)}</div>
        )}
      </div>
    </div>
  );
}
