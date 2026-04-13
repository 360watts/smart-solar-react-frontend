import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService, AlertItem } from '../../services/api';
import {
  RefreshCw, XCircle, AlertTriangle, Info,
  CheckCircle, AlertCircle, Filter, Clock, Cpu, BarChart2,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

type FilterStatus   = 'all' | 'active' | 'acknowledged' | 'resolved';
type FilterSeverity = 'all' | 'critical' | 'warning' | 'info';

const SEV_CFG = {
  critical: { Icon: XCircle,       color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
  warning:  { Icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  info:     { Icon: Info,          color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
};
const STATUS_COLOR: Record<string, string> = {
  active: '#ef4444', acknowledged: '#f59e0b', resolved: '#22c55e',
};

const MobileAlerts: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';

  const [alerts,     setAlerts]     = useState<AlertItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus,   setFilterStatus]   = useState<FilterStatus>('all');
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const fetchAlerts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiService.getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const counts = useMemo(() => ({
    total:        alerts.length,
    active:       alerts.filter(a => !a.resolved && a.status === 'active').length,
    acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
    critical:     alerts.filter(a => !a.resolved && a.severity === 'critical').length,
    warning:      alerts.filter(a => !a.resolved && a.severity === 'warning').length,
    resolved:     alerts.filter(a => a.resolved || a.status === 'resolved').length,
  }), [alerts]);

  const filtered = useMemo(() => alerts.filter(a => {
    const isResolved = a.status === 'resolved' || a.resolved;
    if (filterStatus === 'active'       && (isResolved || a.status === 'acknowledged')) return false;
    if (filterStatus === 'acknowledged' && a.status !== 'acknowledged')                 return false;
    if (filterStatus === 'resolved'     && !isResolved)                                 return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity)                      return false;
    return true;
  }), [alerts, filterStatus, filterSeverity]);

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', ...extra,
  });

  const pill = (active: boolean, color = accent): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
    cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' as const, flexShrink: 0,
    background: active ? `${color}22` : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
    color: active ? color : sub,
  });

  const toggleExpand = (id: number) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: muted }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.875rem' }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 96 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #004d1e, #006b2b)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alerts</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginTop: 1 }}>
              {counts.active} active · {counts.critical} critical
            </div>
          </div>
          <button onClick={() => { setRefreshing(true); fetchAlerts(true); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', color: '#fff', padding: '6px 8px', display: 'flex' }}>
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { label: 'Total',    value: counts.total,    bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' },
            { label: 'Active',   value: counts.active,   bg: 'rgba(239,68,68,0.25)',  color: '#fca5a5' },
            { label: 'Critical', value: counts.critical, bg: 'rgba(239,68,68,0.35)',  color: '#fca5a5' },
            { label: 'Resolved', value: counts.resolved, bg: 'rgba(34,197,94,0.2)',   color: '#86efac' },
          ].map(({ label, value, bg: kBg, color }) => (
            <div key={label} style={{ background: kBg, borderRadius: 10, padding: '8px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Severity breakdown card */}
        <div style={card({ padding: '10px 14px' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={14} color={accent} />
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { label: 'Critical',     val: counts.critical,     color: '#ef4444' },
                { label: 'Warning',      val: counts.warning,      color: '#f59e0b' },
                { label: 'Acknowledged', val: counts.acknowledged, color: '#8b5cf6' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: '0.58rem', color: muted }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} color={muted} style={{ flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {(['all', 'active', 'acknowledged', 'resolved'] as FilterStatus[]).map(s => (
              <button key={s} style={pill(filterStatus === s, STATUS_COLOR[s] ?? accent)} onClick={() => setFilterStatus(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {(['all', 'critical', 'warning', 'info'] as FilterSeverity[]).map(s => (
            <button key={s} style={pill(filterSeverity === s, SEV_CFG[s as keyof typeof SEV_CFG]?.color ?? accent)} onClick={() => setFilterSeverity(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.7rem', color: muted }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[CheckCircle, AlertCircle, Info].map((Icon, i) => (
                <div key={i} style={{ width: 44, height: 44, borderRadius: 12, background: surface, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: i === 0 ? 'rotate(-6deg)' : i === 2 ? 'rotate(6deg)' : 'none' }}>
                  <Icon size={20} color={muted} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: text }}>No alerts found</div>
            <div style={{ fontSize: '0.75rem', color: muted }}>All clear — no alerts match your filter.</div>
          </div>
        )}

        {/* Alert cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(a => {
            const isResolved = a.status === 'resolved' || a.resolved;
            const cfg = SEV_CFG[a.severity as keyof typeof SEV_CFG] ?? SEV_CFG.info;
            const { Icon } = cfg;
            const isExp = expanded.has(a.id);
            return (
              <div key={a.id} style={{ ...card(), opacity: isResolved ? 0.65 : 1 }}>
                <button onClick={() => toggleExpand(a.id)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                      {a.fault_code && <span style={{ fontSize: '0.6rem', fontWeight: 700, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>{a.fault_code}</span>}
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[a.status ?? ''] ?? cfg.color, display: 'inline-block' }} />
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: STATUS_COLOR[a.status ?? ''] ?? muted }}>{a.status ?? (isResolved ? 'resolved' : 'active')}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: text, lineHeight: 1.35 }}>{a.message}</div>
                    <div style={{ fontSize: '0.66rem', color: muted, marginTop: 3 }}>
                      Device {a.device_id} · {new Date(a.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, color: muted }}>
                    {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {isExp && (
                  <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: '0.6rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Device</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: sub }}>{a.device_id}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.6rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Alert ID</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: sub }}><Cpu size={11} color={muted} />#{a.id}</div>
                      </div>
                      {a.site_id && (
                        <div>
                          <div style={{ fontSize: '0.6rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Site</div>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: sub }}>{a.site_id}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '0.6rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Triggered</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: sub }}><Clock size={11} color={muted} />{new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                    {(a.resolved || a.status === 'resolved') && a.resolved_at && (
                      <div style={{ fontSize: '0.7rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={12} /> Resolved {new Date(a.resolved_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MobileAlerts;
