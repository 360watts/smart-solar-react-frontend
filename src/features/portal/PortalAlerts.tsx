import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, Bell, ShieldCheck, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';

interface AlertItem {
  id: string | number;
  type?: string;
  alert_type?: string;
  severity: string;
  message: string;
  device_id?: string;
  device_serial?: string;
  timestamp?: string;
  triggered_at?: string;
  status: string;
  resolved: boolean;
}

const SEV_CONFIG: Record<string, { border: string; glow: string; bg: string; label: string; icon: React.ReactNode }> = {
  critical: { border: '#F87171', glow: 'rgba(248,113,113,0.12)', bg: 'rgba(248,113,113,0.08)',  label: 'Critical', icon: <AlertTriangle size={13} /> },
  warning:  { border: '#FBBF24', glow: 'rgba(251,191,36,0.12)',  bg: 'rgba(251,191,36,0.08)',   label: 'Warning',  icon: <AlertTriangle size={13} /> },
  info:     { border: '#60A5FA', glow: 'rgba(96,165,250,0.12)',  bg: 'rgba(96,165,250,0.08)',   label: 'Info',     icon: <Zap size={13} /> },
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  active:       { color: '#F87171', icon: <AlertTriangle size={12} />, label: 'Active' },
  acknowledged: { color: '#FBBF24', icon: <Clock size={12} />,         label: 'Acknowledged' },
  resolved:     { color: '#34D399', icon: <CheckCircle size={12} />,   label: 'Resolved' },
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PortalAlerts: React.FC = () => {
  const { isDark } = useTheme();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');

  const text    = isDark ? '#F0F4FF' : '#0A0E1A';
  const muted   = isDark ? '#8892A4' : '#64748B';
  const surface = isDark ? '#0F1623'  : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const bg      = isDark ? '#080C14' : '#F0F4FF';

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data: AlertItem[] = await apiService.getAlerts();
      setAlerts(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = alerts.filter(a => {
    if (filter === 'active')   return !a.resolved && a.status !== 'resolved';
    if (filter === 'resolved') return a.resolved  || a.status === 'resolved';
    return true;
  });

  const activeCount   = alerts.filter(a => !a.resolved && a.status !== 'resolved').length;
  const resolvedCount = alerts.filter(a =>  a.resolved || a.status === 'resolved').length;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 16px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(245,158,11,0.15)', borderTop: '3px solid #F59E0B', animation: 'portal-spin 1s linear infinite' }} />
          <Bell size={20} color="#F59E0B" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        </div>
        <p style={{ color: muted, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading alerts…</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div className="portal-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 26, color: text, margin: 0, letterSpacing: '-0.02em' }}>
            Alerts
          </h1>
          <p style={{ fontSize: 13, color: muted, marginTop: 4 }}>
            {alerts.length} total · {activeCount} active · {resolvedCount} resolved
          </p>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: `1px solid ${border}`, background: surface, color: muted, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#FCA5A5', display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
          <AlertTriangle size={16} />
          {error}
          <button onClick={load} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="portal-fade-in" style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', width: 'fit-content', border: `1px solid ${border}` }}>
        {(['all', 'active', 'resolved'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 9,
            border: 'none',
            background: filter === f ? (isDark ? '#1A2438' : '#FFFFFF') : 'transparent',
            color: filter === f ? text : muted,
            fontWeight: filter === f ? 600 : 400,
            fontSize: 13, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: filter === f ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
            transition: 'all 0.15s ease',
            textTransform: 'capitalize' as const,
          }}>
            {f}
            {f === 'active' && activeCount > 0 && (
              <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 10, background: '#F87171', color: '#fff', fontSize: 10, fontWeight: 700 }}>{activeCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && !error && (
        <div className="portal-fade-in" style={{ textAlign: 'center', padding: '72px 20px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px', background: 'rgba(52,211,153,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={32} color="#34D399" />
          </div>
          <p style={{ fontSize: 18, fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: text, marginBottom: 8 }}>
            {filter === 'active' ? 'All clear!' : 'No alerts'}
          </p>
          <p style={{ fontSize: 14, color: muted }}>
            {filter === 'active' ? 'Your system is running smoothly.' : 'Nothing to show for this filter.'}
          </p>
        </div>
      )}

      {/* Alert timeline */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: 19, top: 20, bottom: 20, width: 2, background: `linear-gradient(to bottom, rgba(245,158,11,0.3), transparent)`, pointerEvents: 'none' }} />

          {filtered.map((alert, i) => {
            const sev    = SEV_CONFIG[alert.severity]    ?? SEV_CONFIG.info;
            const status = STATUS_CONFIG[alert.status]   ?? STATUS_CONFIG.active;
            const ts     = alert.timestamp || alert.triggered_at;
            const device = alert.device_serial || alert.device_id;

            return (
              <div
                key={alert.id}
                className="portal-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  {/* Timeline dot */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 14,
                    background: sev.glow,
                    border: `2px solid ${sev.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: sev.border, zIndex: 1,
                    boxShadow: `0 0 8px ${sev.glow}`,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: sev.border }} />
                  </div>

                  {/* Card */}
                  <div style={{
                    flex: 1,
                    background: isDark ? 'linear-gradient(145deg, #0F1623 0%, #0D1320 100%)' : '#FFFFFF',
                    border: `1px solid ${border}`,
                    borderLeft: `3px solid ${sev.border}`,
                    borderRadius: 12,
                    padding: '14px 18px',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'border-color 0.15s ease',
                  }}>
                    <div style={{ position: 'absolute', inset: 0, background: sev.glow, opacity: 0.4, pointerEvents: 'none' }} />
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '3px 10px', borderRadius: 20,
                            background: sev.bg, color: sev.border,
                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                          }}>
                            {sev.icon}
                            {sev.label}
                          </span>
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 12, color: status.color, fontWeight: 500,
                          }}>
                            {status.icon}
                            {status.label}
                          </span>
                        </div>
                        {ts && (
                          <span style={{ fontSize: 12, color: muted, fontVariantNumeric: 'tabular-nums' }}>
                            {timeAgo(ts)}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: text, lineHeight: 1.5, fontWeight: 500 }}>{alert.message}</p>
                      {device && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Zap size={11} />
                          {device}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortalAlerts;
