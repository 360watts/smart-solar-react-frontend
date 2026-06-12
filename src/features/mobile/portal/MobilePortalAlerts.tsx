import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Info, RefreshCw, Search, ShieldAlert, X,
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { AlertItem, apiService } from '../../../services/api';
import { getDesignTokens } from '../../../shared/theme';

type StatusFilter = 'all' | 'active' | 'resolved';
type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

const SEVERITY_META: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'Critical' },
  warning:  { color: '#E9B949', bg: 'rgba(233,185,73,0.1)', label: 'Warning' },
  info:     { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', label: 'Info' },
};

const MobilePortalAlerts: React.FC = () => {
  const { isDark } = useTheme();
  const T = getDesignTokens(isDark);
  const [alerts, setAlerts]               = useState<AlertItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [filtersOpen, setFiltersOpen]     = useState(false);
  const [mounted, setMounted]             = useState(false);

  const cardBg     = isDark ? 'rgba(10,20,14,0.96)' : 'rgba(252,255,253,0.97)';
  const cardBorder = isDark ? 'rgba(47,191,113,0.13)' : 'rgba(47,191,113,0.18)';
  const textPrimary = isDark ? '#F0F7F2' : '#0D2318';
  const textMuted   = isDark ? 'rgba(240,247,242,0.45)' : 'rgba(13,35,24,0.45)';
  const green  = '#2FBF71';
  const amber  = '#E9B949';
  const danger = '#EF4444';

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await apiService.getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); setTimeout(() => setMounted(true), 60); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return alerts.filter(alert => {
      const resolved = alert.resolved || alert.status === 'resolved';
      if (statusFilter === 'active' && resolved) return false;
      if (statusFilter === 'resolved' && !resolved) return false;
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
      if (!term) return true;
      const hay = [alert.message, alert.device_serial, alert.device_id, alert.type, alert.fault_code]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [alerts, search, severityFilter, statusFilter]);

  const activeCount   = alerts.filter(a => !(a.resolved || a.status === 'resolved')).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !(a.resolved || a.status === 'resolved')).length;
  const resolvedCount = alerts.length - activeCount;

  const fadeStyle = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.45s ${delay}ms ease, transform 0.45s ${delay}ms ease`,
  });

  if (loading) return (
    <div style={{ minHeight: '60dvh', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${green}`, borderTopColor: 'transparent', animation: 'portal-spin 0.9s linear infinite' }} />
        <span style={{ color: textMuted, fontWeight: 600, fontSize: 14, letterSpacing: '0.04em' }}>Loading alerts…</span>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes portal-spin { to { transform: rotate(360deg); } }
        .snov-btn { cursor: pointer; transition: opacity 180ms ease, transform 180ms ease; }
        .snov-btn:hover { opacity: 0.85; }
        .snov-btn:active { transform: scale(0.96); }
        .alert-row { transition: transform 180ms ease; }
        .alert-row:active { transform: scale(0.992); }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: '"DM Sans", system-ui, sans-serif' }}>

        {/* ── Hero summary ── */}
        <section style={{
          ...fadeStyle(0),
          background: isDark
            ? 'linear-gradient(160deg, #0C1810 0%, #07100A 100%)'
            : 'linear-gradient(160deg, #EDF7F1 0%, #F6FCF8 100%)',
          border: `1px solid ${cardBorder}`,
          borderRadius: 28, padding: '22px 20px 18px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -50, right: -40, width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle, ${criticalCount ? 'rgba(239,68,68,0.14)' : 'rgba(47,191,113,0.12)'}, transparent 70%)`, pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: textMuted }}>System attention</div>
              <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 30, lineHeight: 1.1, color: textPrimary, marginTop: 6 }}>
                {activeCount === 0 ? 'All clear' : `${activeCount} active alert${activeCount !== 1 ? 's' : ''}`}
              </div>
              <div style={{ fontSize: 13, color: textMuted, marginTop: 8 }}>
                {criticalCount ? `${criticalCount} critical issue${criticalCount !== 1 ? 's' : ''} need attention` : 'No critical issues right now'}
              </div>
            </div>
            <button className="snov-btn" onClick={() => { setRefreshing(true); void load(true); }}
              aria-label="Refresh alerts"
              style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${cardBorder}`, background: 'transparent', color: textMuted, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <RefreshCw size={15} style={{ animation: refreshing ? 'portal-spin 1s linear infinite' : undefined }} />
            </button>
          </div>

          {/* Stat chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18 }}>
            {[
              { label: 'Active', value: activeCount, color: amber },
              { label: 'Critical', value: criticalCount, color: danger },
              { label: 'Resolved', value: resolvedCount, color: green },
            ].map(item => (
              <div key={item.label} style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)',
                border: `1px solid ${cardBorder}`,
                borderRadius: 16, padding: '14px 8px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 28, lineHeight: 1, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted, marginTop: 6 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Search + filters ── */}
        <section style={{
          ...fadeStyle(80),
          position: 'sticky', top: 70, zIndex: 10,
          background: isDark ? 'rgba(7,16,10,0.94)' : 'rgba(242,248,244,0.94)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${cardBorder}`,
          borderRadius: 20, padding: 14,
        }}>
          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <Search size={15} color={textMuted} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search alerts, fault codes, devices…"
              style={{
                width: '100%', height: 44, padding: '0 38px 0 38px',
                borderRadius: 12, border: `1px solid ${cardBorder}`,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
                color: textPrimary, fontSize: 14, boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            {search && (
              <button className="snov-btn" onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: textMuted, display: 'grid', placeItems: 'center' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button className="snov-btn" onClick={() => setFiltersOpen(o => !o)}
            style={{
              marginTop: 10, width: '100%', height: 40, borderRadius: 12,
              border: `1px solid ${filtersOpen ? green : cardBorder}`,
              background: filtersOpen ? (isDark ? 'rgba(47,191,113,0.1)' : 'rgba(47,191,113,0.08)') : 'transparent',
              color: filtersOpen ? green : textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px',
              fontSize: 13, fontWeight: 600,
            }}>
            <span>Filters {(statusFilter !== 'all' || severityFilter !== 'all') ? '·' : ''}</span>
            {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {filtersOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted }}>Status</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['all', 'active', 'resolved'] as StatusFilter[]).map(v => {
                  const on = statusFilter === v;
                  return (
                    <button key={v} className="snov-btn" onClick={() => setStatusFilter(v)}
                      style={{ padding: '7px 14px', borderRadius: 999, border: `1px solid ${on ? green : cardBorder}`, background: on ? (isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.1)') : 'transparent', color: on ? green : textMuted, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
                      {v}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted }}>Severity</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map(v => {
                  const on = severityFilter === v;
                  const meta = SEVERITY_META[v] ?? { color: textMuted, bg: 'transparent', label: v };
                  return (
                    <button key={v} className="snov-btn" onClick={() => setSeverityFilter(v)}
                      style={{ padding: '7px 14px', borderRadius: 999, border: `1px solid ${on ? meta.color : cardBorder}`, background: on ? meta.bg : 'transparent', color: on ? meta.color : textMuted, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── Error banner ── */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 16, padding: 14 }}>
            <div style={{ fontWeight: 700, color: danger, fontSize: 14 }}>Refresh failed</div>
            <div style={{ color: textMuted, fontSize: 13, marginTop: 4 }}>{error}</div>
          </div>
        )}

        {/* ── Empty state ── */}
        {filtered.length === 0 && (
          <div style={{ ...fadeStyle(160), background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 24, padding: 32, textAlign: 'center' }}>
            <CheckCircle2 size={34} color={green} style={{ margin: '0 auto 14px' }} />
            <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 24, color: textPrimary }}>
              {search || statusFilter !== 'all' || severityFilter !== 'all' ? 'No alerts match' : 'Everything looks healthy'}
            </div>
            <div style={{ color: textMuted, marginTop: 8, fontSize: 14 }}>
              {search ? 'Try clearing your search or filters.' : 'No active alerts on your system right now.'}
            </div>
          </div>
        )}

        {/* ── Alert list ── */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((alert, idx) => {
              const resolved = alert.resolved || alert.status === 'resolved';
              const meta = SEVERITY_META[alert.severity ?? 'info'] ?? SEVERITY_META.info;
              const Icon = alert.severity === 'critical' ? ShieldAlert : alert.severity === 'info' ? Info : AlertTriangle;
              return (
                <article key={alert.id} className="alert-row" style={{
                  opacity: mounted ? (resolved ? 0.75 : 1) : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(10px)',
                  transition: `opacity 0.4s ${(idx % 8) * 40}ms ease, transform 0.4s ${(idx % 8) * 40}ms ease`,
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  borderLeft: `4px solid ${resolved ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : meta.color}`,
                  borderRadius: 20, padding: 16, overflow: 'hidden',
                }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 36, height: 36, borderRadius: 12, background: resolved ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)') : meta.bg, display: 'grid', placeItems: 'center', color: resolved ? textMuted : meta.color, flexShrink: 0 }}>
                        <Icon size={16} />
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, color: textPrimary, fontSize: 14, textTransform: 'capitalize' }}>{meta.label}</div>
                        <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>{alert.device_serial || alert.device_id || 'Portal alert'}</div>
                      </div>
                    </div>
                    <span style={{
                      padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: resolved ? (isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.1)') : meta.bg,
                      color: resolved ? green : meta.color,
                    }}>
                      {resolved ? 'Resolved' : (alert.status ?? 'Active')}
                    </span>
                  </div>

                  {/* Message */}
                  <div style={{ marginTop: 12, color: textPrimary, lineHeight: 1.55, fontSize: 14 }}>{alert.message}</div>

                  {/* Meta chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {alert.fault_code && (
                      <span style={{ padding: '4px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: textMuted, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                        {alert.fault_code}
                      </span>
                    )}
                    {alert.timestamp && (
                      <span style={{ padding: '4px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: textMuted, fontSize: 11 }}>
                        {new Date(alert.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default MobilePortalAlerts;
