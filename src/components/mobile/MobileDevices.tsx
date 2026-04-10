import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '../../services/api';
import { Wifi, WifiOff, RefreshCw, Thermometer, Signal, AlertTriangle, Search, X } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface Device {
  id: number;
  device_serial: string;
  hw_id?: string;
  model?: string;
  is_online?: boolean;
  last_seen_at?: string;
  last_heartbeat?: string;
  connectivity_type?: string;
  signal_strength_dbm?: number | null;
  device_temp_c?: number | null;
  heartbeat_health?: { severity?: 'ok' | 'warn' | 'critical'; issues?: string[] } | null;
  pending_config_update?: boolean;
  auto_reboot_enabled?: boolean;
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

const KpiTile: React.FC<{ label: string; value: number; tone?: 'success' | 'muted' | 'default' }> = ({ label, value, tone = 'default' }) => {
  const toneClass = {
    success: 'bg-emerald-100/70 dark:bg-emerald-900/30 ring-1 ring-emerald-200/60 dark:ring-emerald-800/60',
    muted:   'bg-muted ring-1 ring-border',
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtLastSeen(ts?: string) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function signalColor(dbm: number | null | undefined) {
  if (dbm == null) return null;
  return dbm > -60 ? 'text-emerald-500' : dbm > -75 ? 'text-amber-500' : 'text-red-500';
}

// ── Device card ───────────────────────────────────────────────────────────────

const DeviceCard: React.FC<{ device: Device }> = ({ device }) => {
  const health = device.heartbeat_health;
  const hasIssues = health && health.severity !== 'ok' && (health.issues?.length ?? 0) > 0;
  const issueBg = health?.severity === 'critical' ? 'bg-red-500/10 border border-red-500/20 text-red-500' : 'bg-amber-500/10 border border-amber-500/20 text-amber-500';
  const sigClass = signalColor(device.signal_strength_dbm);
  const hotTemp = (device.device_temp_c ?? 0) > 70;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="font-mono text-sm font-bold tracking-wide truncate">{device.device_serial}</div>
            {device.model && <div className="text-[11px] text-muted-foreground mt-0.5">{device.model}</div>}
          </div>
          <Badge
            variant="outline"
            className={cn(
              'ml-2 flex-shrink-0 flex items-center gap-1',
              device.is_online
                ? 'border-emerald-300/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-slate-300/50 bg-slate-500/10 text-slate-500'
            )}
          >
            {device.is_online ? <Wifi size={10} /> : <WifiOff size={10} />}
            {device.is_online ? 'Online' : 'Offline'}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="text-[11px] text-muted-foreground">
            Last seen <span className="text-foreground/70 font-medium">{fmtLastSeen(device.last_seen_at ?? device.last_heartbeat)}</span>
          </span>
          {device.signal_strength_dbm != null && sigClass && (
            <span className={cn('flex items-center gap-1 text-[11px]', sigClass)}>
              <Signal size={11} /> {device.signal_strength_dbm} dBm
            </span>
          )}
          {device.device_temp_c != null && (
            <span className={cn('flex items-center gap-1 text-[11px]', hotTemp ? 'text-red-500' : 'text-muted-foreground')}>
              <Thermometer size={11} /> {device.device_temp_c.toFixed(1)}°C
            </span>
          )}
          {device.pending_config_update && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-500">
              <AlertTriangle size={11} /> Config pending
            </span>
          )}
        </div>

        {hasIssues && (
          <div className={cn('mt-3 rounded-lg px-3 py-2', issueBg)}>
            {health!.issues!.map((issue, i) => (
              <div key={i} className="text-[11px] font-medium">{issue}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const MobileDevices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [onlineFilter, setOnlineFilter] = useState<'all' | 'online' | 'offline'>('all');

  const fetchDevices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiService.getDevices(undefined, 1, 100);
      setDevices(Array.isArray(res) ? res : (res?.results ?? []));
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const counts = {
    total:   devices.length,
    online:  devices.filter(d => d.is_online).length,
    offline: devices.filter(d => !d.is_online).length,
  };

  const filtered = devices.filter(d => {
    if (onlineFilter === 'online' && !d.is_online) return false;
    if (onlineFilter === 'offline' && d.is_online) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return d.device_serial.toLowerCase().includes(q) || (d.model ?? '').toLowerCase().includes(q);
    }
    return true;
  });

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
          <h1 className="text-lg font-bold">Devices</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{counts.online} online · {counts.offline} offline</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchDevices(true); }}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-3 space-y-3">

        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-2">
          <KpiTile label="Total"   value={counts.total}   />
          <KpiTile label="Online"  value={counts.online}  tone="success" />
          <KpiTile label="Offline" value={counts.offline} tone="muted"   />
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search serial or model…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {(['all', 'online', 'offline'] as const).map(f => (
            <FilterPill key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} active={onlineFilter === f} onClick={() => setOnlineFilter(f)} />
          ))}
        </div>

        {/* Device list */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'device' : 'devices'}</p>
          {filtered.length === 0
            ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No devices match filter</CardContent></Card>
            : filtered.map(d => <DeviceCard key={d.id} device={d} />)
          }
        </div>

      </div>
    </div>
  );
};

export default MobileDevices;
