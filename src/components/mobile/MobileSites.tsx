import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService } from '../../services/api';
import { Wifi, WifiOff, RefreshCw, MapPin, ChevronRight, AlertTriangle, Search, X } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface SiteDevice {
  device_id: number;
  device_serial: string;
  is_online: boolean;
}

interface GatewayDevice {
  is_online?: boolean;
  last_seen_at?: string;
  signal_strength_dbm?: number | null;
  heartbeat_health?: { severity?: 'ok' | 'warn' | 'critical' } | null;
}

interface SiteRow {
  site_id: string;
  display_name: string;
  latitude?: number;
  longitude?: number;
  site_status?: string;
  is_active?: boolean;
  updated_at?: string;
  devices?: SiteDevice[];
  gateway_device?: GatewayDevice | null;
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

const KpiTile: React.FC<{ label: string; value: number; tone?: 'success' | 'warning' | 'default' }> = ({ label, value, tone = 'default' }) => {
  const toneClass = {
    success: 'bg-emerald-100/70 dark:bg-emerald-900/30 ring-1 ring-emerald-200/60 dark:ring-emerald-800/60',
    warning: 'bg-amber-100/70 dark:bg-amber-900/30 ring-1 ring-amber-200/60 dark:ring-amber-800/60',
    default: 'bg-muted ring-1 ring-border',
  }[tone];
  return (
    <div className={cn('rounded-xl p-3 text-center shadow-sm', toneClass)}>
      <div className="text-xl font-bold tracking-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
};

// ── Filter pill ───────────────────────────────────────────────────────────────

const FilterPill: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0',
      active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
    )}
  >
    {label}
  </button>
);

// ── Site card ─────────────────────────────────────────────────────────────────

const SiteCard: React.FC<{ site: SiteRow; onClick: () => void }> = ({ site, onClick }) => {
  const gwOnline  = site.gateway_device?.is_online;
  const gwHealth  = site.gateway_device?.heartbeat_health?.severity;
  const status    = site.site_status ?? (site.is_active ? 'active' : 'inactive');
  const devCount  = site.devices?.length ?? 0;

  const statusVariant: Record<string, string> = {
    active:        'border-emerald-300/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    commissioning: 'border-amber-300/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    inactive:      'border-slate-300/50 bg-slate-500/10 text-slate-500',
    archived:      'border-slate-300/50 bg-slate-500/10 text-slate-500',
  };

  return (
    <Card className="cursor-pointer active:opacity-80 transition-opacity" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{site.display_name}</div>
            <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{site.site_id}</div>
          </div>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            <Badge variant="outline" className={cn('text-[10px]', statusVariant[status] ?? statusVariant.inactive)}>
              {status}
            </Badge>
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <span className={cn('flex items-center gap-1 text-[11px] font-semibold', gwOnline ? 'text-emerald-500' : 'text-muted-foreground')}>
            {gwOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
            {gwOnline ? 'Online' : 'Offline'}
          </span>

          {devCount > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {devCount} device{devCount !== 1 ? 's' : ''}
            </span>
          )}

          {site.latitude != null && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin size={11} /> {site.latitude.toFixed(2)}°N
            </span>
          )}

          {(gwHealth === 'warn' || gwHealth === 'critical') && (
            <span className={cn('flex items-center gap-1 text-[11px] font-semibold', gwHealth === 'critical' ? 'text-red-500' : 'text-amber-500')}>
              <AlertTriangle size={11} />
              {gwHealth === 'critical' ? 'Critical' : 'Warning'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const MobileSites: React.FC = () => {
  const navigate = useNavigate();

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchSites = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiService.getSitesList({ includeInactive: true });
      setSites(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  const counts = useMemo(() => ({
    total:     sites.length,
    active:    sites.filter(s => s.site_status === 'active' || s.is_active).length,
    online:    sites.filter(s => s.gateway_device?.is_online).length,
    attention: sites.filter(s => { const h = s.gateway_device?.heartbeat_health?.severity; return h === 'warn' || h === 'critical'; }).length,
  }), [sites]);

  const filtered = useMemo(() => sites.filter(s => {
    if (statusFilter !== 'all' && (s.site_status ?? 'active') !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.display_name.toLowerCase().includes(q) || s.site_id.toLowerCase().includes(q);
    }
    return true;
  }), [sites, search, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh gap-3 text-muted-foreground">
        <RefreshCw size={18} className="animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-24 bg-background">

      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Sites</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{counts.online} gateways online · {counts.active} active</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchSites(true); }}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-3 space-y-3">

        {/* KPI tiles */}
        <div className="grid grid-cols-4 gap-2">
          <KpiTile label="Total"     value={counts.total}     />
          <KpiTile label="Active"    value={counts.active}    tone="success" />
          <KpiTile label="Online"    value={counts.online}    tone="success" />
          <KpiTile label="Attention" value={counts.attention} tone={counts.attention > 0 ? 'warning' : 'default'} />
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sites…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {(['all', 'active', 'commissioning', 'inactive'] as const).map(s => (
            <FilterPill key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
          ))}
        </div>

        {/* Site list */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'site' : 'sites'}</p>
          {filtered.length === 0
            ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No sites match filter</CardContent></Card>
            : filtered.map(s => <SiteCard key={s.site_id} site={s} onClick={() => navigate(`/sites/${s.site_id}`)} />)
          }
        </div>

      </div>
    </div>
  );
};

export default MobileSites;
