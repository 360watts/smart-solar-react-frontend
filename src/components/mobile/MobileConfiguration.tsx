import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '../../services/api';
import { RefreshCw, Search, X, Settings, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface SlaveDevice {
  id: number;
  slaveId?: number;
  slave_id?: number;
  deviceName?: string;
  name?: string;
  pollingIntervalMs?: number;
  polling_interval_ms?: number;
  timeoutMs?: number;
  timeout_ms?: number;
  enabled?: boolean;
  registers?: { enabled?: boolean }[];
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

// ── Slave card ────────────────────────────────────────────────────────────────

const SlaveCard: React.FC<{ slave: SlaveDevice }> = ({ slave }) => {
  const enabled   = slave.enabled !== false;
  const name      = slave.deviceName ?? slave.name ?? `Slave ${slave.slaveId ?? slave.slave_id}`;
  const slaveId   = slave.slaveId ?? slave.slave_id;
  const polling   = slave.pollingIntervalMs ?? slave.polling_interval_ms;
  const timeout   = slave.timeoutMs ?? slave.timeout_ms;
  const regs      = slave.registers ?? [];
  const activeRegs = regs.filter(r => r.enabled !== false).length;

  const fmtMs = (ms?: number) => {
    if (ms == null) return '—';
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{name}</div>
            {slaveId != null && <div className="text-[11px] text-muted-foreground mt-0.5">Slave ID: {slaveId}</div>}
          </div>
          <Badge
            variant="outline"
            className={cn(
              'ml-2 flex-shrink-0 flex items-center gap-1',
              enabled
                ? 'border-emerald-300/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-slate-300/50 bg-slate-500/10 text-slate-500'
            )}
          >
            {enabled ? <CheckCircle size={10} /> : <XCircle size={10} />}
            {enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {polling != null && (
            <span className="text-[11px] text-muted-foreground">
              Poll <span className="text-foreground/70 font-medium">{fmtMs(polling)}</span>
            </span>
          )}
          {timeout != null && (
            <span className="text-[11px] text-muted-foreground">
              Timeout <span className="text-foreground/70 font-medium">{fmtMs(timeout)}</span>
            </span>
          )}
          {regs.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Settings size={11} />
              <span className="text-foreground/70 font-medium">{activeRegs}/{regs.length}</span> registers
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const MobileConfiguration: React.FC = () => {
  const [slaves, setSlaves] = useState<SlaveDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchSlaves = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiService.getGlobalSlaves(undefined, 1, 100);
      setSlaves(Array.isArray(res) ? res : (res?.results ?? []));
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchSlaves(); }, [fetchSlaves]);

  const counts = {
    total:    slaves.length,
    enabled:  slaves.filter(s => s.enabled !== false).length,
    disabled: slaves.filter(s => s.enabled === false).length,
  };

  const filtered = slaves.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const n = (s.deviceName ?? s.name ?? '').toLowerCase();
    const id = String(s.slaveId ?? s.slave_id ?? '');
    return n.includes(q) || id.includes(q);
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
          <h1 className="text-lg font-bold">Configuration</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{counts.total} slave device{counts.total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchSlaves(true); }}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-3 space-y-3">

        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-2">
          <KpiTile label="Total"    value={counts.total}    />
          <KpiTile label="Enabled"  value={counts.enabled}  tone="success" />
          <KpiTile label="Disabled" value={counts.disabled} tone="muted"   />
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or slave ID…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Slave list */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'slave' : 'slaves'}</p>
          {filtered.length === 0
            ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No slave devices found</CardContent></Card>
            : filtered.map(s => <SlaveCard key={s.id} slave={s} />)
          }
        </div>

      </div>
    </div>
  );
};

export default MobileConfiguration;
