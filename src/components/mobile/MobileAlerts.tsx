import React, { useEffect, useState, useCallback } from 'react';
import { apiService, AlertItem } from '../../services/api';
import { AlertTriangle, CheckCircle, RefreshCw, XCircle, Info } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

type FilterStatus = 'all' | 'active' | 'acknowledged' | 'resolved';
type FilterSeverity = 'all' | 'critical' | 'warning' | 'info';

const MobileAlerts: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#020617' : '#f0fdf4';
  const surface = isDark ? '#0f172a' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,166,62,0.15)';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMute = isDark ? '#64748b' : '#94a3b8';
  const textSub  = isDark ? '#94a3b8' : '#475569';

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');

  const fetchAlerts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiService.getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const filtered = alerts.filter(a => {
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    if (filterStatus !== 'all') {
      const isResolved = a.status === 'resolved' || a.resolved;
      if (filterStatus === 'resolved' && !isResolved) return false;
      if (filterStatus === 'active' && (isResolved || a.status === 'acknowledged')) return false;
      if (filterStatus === 'acknowledged' && a.status !== 'acknowledged') return false;
    }
    return true;
  });

  const counts = {
    total: alerts.length,
    active: alerts.filter(a => !a.resolved && a.status === 'active').length,
    critical: alerts.filter(a => !a.resolved && a.severity === 'critical').length,
    resolved: alerts.filter(a => a.resolved || a.status === 'resolved').length,
  };

  const sevColor = (s: string) =>
    s === 'critical' ? '#ef4444' : s === 'warning' ? '#f59e0b' : '#3b82f6';
  const sevBg = (s: string) =>
    s === 'critical' ? 'rgba(239,68,68,0.1)' : s === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)';

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, ...extra,
  });

  const pill = (active: boolean, color = '#00a63e'): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
    cursor: 'pointer', border: 'none',
    background: active ? `${color}20` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
    color: active ? color : textSub,
    transition: 'background 120ms',
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: textMute }}>
        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '0.875rem' }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: textMain }}>Alerts</div>
          <div style={{ fontSize: '0.72rem', color: textMute, marginTop: 2 }}>
            {counts.active} active · {counts.critical} critical
          </div>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchAlerts(true); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMute, display: 'flex', padding: 8 }}
        >
          <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      <div style={{ padding: '12px 12px 0' }}>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Total', value: counts.total, color: textMain },
            { label: 'Active', value: counts.active, color: '#f59e0b' },
            { label: 'Critical', value: counts.critical, color: '#ef4444' },
            { label: 'Resolved', value: counts.resolved, color: '#10b981' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...card({ padding: '10px 8px', textAlign: 'center' }) }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: '0.65rem', color: textMute, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {(['all', 'active', 'acknowledged', 'resolved'] as FilterStatus[]).map(s => (
            <button key={s} style={pill(filterStatus === s)} onClick={() => setFilterStatus(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
          {(['all', 'critical', 'warning', 'info'] as FilterSeverity[]).map(s => (
            <button key={s} style={pill(filterSeverity === s, sevColor(s === 'all' ? 'info' : s))} onClick={() => setFilterSeverity(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {filtered.length === 0 ? (
          <div style={{ ...card({ padding: '40px 20px', textAlign: 'center' }) }}>
            <CheckCircle size={28} color="#10b981" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: textMain }}>All clear</div>
            <div style={{ fontSize: '0.75rem', color: textMute, marginTop: 4 }}>No alerts match the current filter</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(alert => {
              const c = sevColor(alert.severity);
              const bg2 = sevBg(alert.severity);
              const isResolved = alert.resolved || alert.status === 'resolved';
              return (
                <div key={alert.id} style={{ ...card({ padding: '12px 14px' }), opacity: isResolved ? 0.65 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: bg2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {alert.severity === 'critical' ? <XCircle size={16} color={c} /> :
                       alert.severity === 'warning'  ? <AlertTriangle size={16} color={c} /> :
                       <Info size={16} color={c} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        {alert.fault_code && (
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4, background: bg2, color: c }}>{alert.fault_code}</span>
                        )}
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: isResolved ? '#10b981' : c, opacity: 0.8 }}>
                          {alert.status ?? (alert.resolved ? 'resolved' : 'active')}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: textMain, fontWeight: 500, lineHeight: 1.4 }}>{alert.message}</div>
                      <div style={{ fontSize: '0.68rem', color: textMute, marginTop: 5 }}>
                        Device {alert.device_id} · {new Date(alert.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileAlerts;
