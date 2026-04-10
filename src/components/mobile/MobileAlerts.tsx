import React, { useEffect, useState, useCallback } from 'react';
import { apiService, AlertItem } from '../../services/api';
import { RefreshCw, XCircle, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

type FilterStatus   = 'all' | 'active' | 'acknowledged' | 'resolved';
type FilterSeverity = 'all' | 'critical' | 'warning' | 'info';

// ── KPI tile ──────────────────────────────────────────────────────────────────

const KpiTile: React.FC<{ label: string; value: number; tone?: 'danger' | 'warning' | 'success' | 'default' }> = ({ label, value, tone = 'default' }) => {
  const toneClass = {
    danger:  'bg-red-100/70 dark:bg-red-900/30 ring-1 ring-red-200/60 dark:ring-red-800/60',
    warning: 'bg-amber-100/70 dark:bg-amber-900/30 ring-1 ring-amber-200/60 dark:ring-amber-800/60',
    success: 'bg-emerald-100/70 dark:bg-emerald-900/30 ring-1 ring-emerald-200/60 dark:ring-emerald-800/60',
    default: 'bg-muted ring-1 ring-border',
  }[tone];
  return (
    <div className={cn('rounded-xl p-3 text-center shadow-sm', toneClass)}>
      <div className="text-xl font-bold tracking-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
};

// ── Alert card ────────────────────────────────────────────────────────────────

const AlertCard: React.FC<{ alert: AlertItem }> = ({ alert }) => {
  const sevConfig = {
    critical: { Icon: XCircle,       color: 'text-red-500',   bg: 'bg-red-500/10',   dot: 'bg-red-500'   },
    warning:  { Icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
    info:     { Icon: Info,          color: 'text-blue-500',  bg: 'bg-blue-500/10',  dot: 'bg-blue-500'  },
  };
  const statusDot = {
    active:       'bg-red-500',
    acknowledged: 'bg-amber-500',
    resolved:     'bg-emerald-500',
  };

  const cfg = sevConfig[alert.severity] ?? sevConfig.info;
  const { Icon } = cfg;
  const isResolved = alert.resolved || alert.status === 'resolved';
  const dotColor = statusDot[alert.status as keyof typeof statusDot] ?? (isResolved ? 'bg-emerald-500' : 'bg-red-500');

  return (
    <Card className={cn('transition-opacity', isResolved && 'opacity-60')}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-full p-2 flex-shrink-0', cfg.bg)}>
            <Icon className={cn('h-4 w-4', cfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {alert.fault_code && (
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{alert.fault_code}</Badge>
              )}
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor)} />
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {alert.status ?? (isResolved ? 'resolved' : 'active')}
              </span>
            </div>
            <p className="text-sm font-medium leading-snug">{alert.message}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Device {alert.device_id} · {new Date(alert.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="flex gap-2 mb-6">
      {[{ icon: <CheckCircle />, rot: '-rotate-6' }, { icon: <AlertCircle />, rot: '' }, { icon: <Info />, rot: 'rotate-6' }].map(({ icon, rot }, i) => (
        <div key={i} className={cn('w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground', rot)}>
          {React.cloneElement(icon as React.ReactElement, { size: 22 })}
        </div>
      ))}
    </div>
    <h3 className="text-base font-semibold mb-1">No alerts found</h3>
    <p className="text-sm text-muted-foreground text-center">All clear — no alerts match your current filter.</p>
  </div>
);

// ── Filter pill ───────────────────────────────────────────────────────────────

const FilterPill: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0',
      active
        ? 'bg-foreground text-background'
        : 'bg-muted text-muted-foreground hover:bg-muted/80'
    )}
  >
    {label}
  </button>
);

// ── Component ─────────────────────────────────────────────────────────────────

const MobileAlerts: React.FC = () => {
  useTheme(); // keep theme context active

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus,   setFilterStatus]   = useState<FilterStatus>('all');
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');

  const fetchAlerts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiService.getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const filtered = alerts.filter(a => {
    const isResolved = a.status === 'resolved' || a.resolved;
    if (filterStatus === 'active'       && (isResolved || a.status === 'acknowledged')) return false;
    if (filterStatus === 'acknowledged' && a.status !== 'acknowledged') return false;
    if (filterStatus === 'resolved'     && !isResolved) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    return true;
  });

  const counts = {
    total:    alerts.length,
    active:   alerts.filter(a => !a.resolved && a.status === 'active').length,
    critical: alerts.filter(a => !a.resolved && a.severity === 'critical').length,
    resolved: alerts.filter(a => a.resolved || a.status === 'resolved').length,
  };

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
          <h1 className="text-lg font-bold">Alerts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{counts.active} active · {counts.critical} critical</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchAlerts(true); }}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-3 space-y-3">

        {/* KPI tiles */}
        <div className="grid grid-cols-4 gap-2">
          <KpiTile label="Total"    value={counts.total}    tone="default" />
          <KpiTile label="Active"   value={counts.active}   tone="warning" />
          <KpiTile label="Critical" value={counts.critical} tone="danger"  />
          <KpiTile label="Resolved" value={counts.resolved} tone="success" />
        </div>

        {/* Status filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {(['all', 'active', 'acknowledged', 'resolved'] as FilterStatus[]).map(s => (
            <FilterPill key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={filterStatus === s} onClick={() => setFilterStatus(s)} />
          ))}
        </div>

        {/* Severity filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {(['all', 'critical', 'warning', 'info'] as FilterSeverity[]).map(s => (
            <FilterPill key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={filterSeverity === s} onClick={() => setFilterSeverity(s)} />
          ))}
        </div>

        {/* Alert list */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'alert' : 'alerts'}</p>
          {filtered.length === 0 ? <EmptyState /> : filtered.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>

      </div>
    </div>
  );
};

export default MobileAlerts;
