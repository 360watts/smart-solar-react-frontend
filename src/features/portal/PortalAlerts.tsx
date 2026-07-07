import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle, CheckCircle, Clock, RefreshCw, Bell,
  ShieldCheck, Zap, Search, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService, IncidentItem } from '../../services/api';
import { useIsMobile, useAutoRefresh } from '../../shared/hooks';
import MobilePortalAlerts from '../mobile/portal/MobilePortalAlerts';

const SEV_CONFIG: Record<string, { border: string; glow: string; bg: string; label: string; icon: React.ReactNode }> = {
  critical: { border: '#F87171', glow: 'rgba(248,113,113,0.12)', bg: 'rgba(248,113,113,0.08)',  label: 'Critical', icon: <AlertTriangle size={12} /> },
  warning:  { border: '#FBBF24', glow: 'rgba(251,191,36,0.12)',  bg: 'rgba(251,191,36,0.08)',   label: 'Warning',  icon: <AlertTriangle size={12} /> },
  info:     { border: '#60A5FA', glow: 'rgba(96,165,250,0.12)',  bg: 'rgba(96,165,250,0.08)',   label: 'Info',     icon: <Zap size={12} /> },
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  active:       { color: '#F87171', icon: <AlertTriangle size={11} />, label: 'Active' },
  acknowledged: { color: '#FBBF24', icon: <Clock size={11} />,         label: 'Acknowledged' },
  resolved:     { color: '#34D399', icon: <CheckCircle size={11} />,   label: 'Resolved' },
};

const PAGE_SIZE = 10;

type StatusFilter   = 'all' | 'active' | 'resolved';
type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const PortalAlerts: React.FC = () => {
  const isMobile = useIsMobile();
  const { isDark } = useTheme();
  const [alerts, setAlerts]       = useState<IncidentItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [siteId, setSiteId]       = useState<string | null>(null);

  const text    = isDark ? '#F0F4FF' : '#0A0E1A';
  const muted   = isDark ? '#8892A4' : '#64748B';
  const surface = isDark ? '#0F1623' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const pillBg  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

  const load = useCallback(async (sid: string) => {
    setLoading(true); setError(null);
    try {
      const data = await apiService.getSiteIncidents(sid);
      setAlerts(data.results);
    } catch (e: any) {
      setError(e?.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  const silentLoad = useCallback(async () => {
    if (!siteId) return;
    setError(null);
    try {
      const data = await apiService.getSiteIncidents(siteId);
      setAlerts(data.results);
    } catch {}
  }, [siteId]);

  const { triggerNow } = useAutoRefresh(silentLoad, 120);

  // Resolve the portal user's site once, then load its incidents.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const summary: any = await apiService.getPortalSummary();
        const site = summary?.sites?.[0];
        if (cancelled) return;
        if (site?.site_id) {
          setSiteId(site.site_id);
          load(site.site_id);
        } else {
          setError('No site found for your account.');
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load alerts');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  // Reset page whenever filters change
  useEffect(() => { setPage(1); }, [statusFilter, severityFilter, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter(a => {
      if (statusFilter === 'active'   && a.status === 'resolved') return false;
      if (statusFilter === 'resolved' && a.status !== 'resolved') return false;
      if (severityFilter !== 'all'    && a.severity !== severityFilter)            return false;
      if (q) {
        const haystack = [a.summary, a.deviceSerial, a.incidentType, a.severity, a.status]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, statusFilter, severityFilter, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const pageItems   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeCount   = alerts.filter(a => a.status !== 'resolved').length;
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;

  const hasFilters = statusFilter !== 'all' || severityFilter !== 'all' || search.trim() !== '';

  if (isMobile) return <MobilePortalAlerts />;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 16px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(47,191,113,0.15)', borderTop: '3px solid #2FBF71', animation: 'portal-spin 1s linear infinite' }} />
          <Bell size={20} color="#2FBF71" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        </div>
        <p style={{ color: muted, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading alerts…</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="portal-fade-in" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 26, color: text, margin: 0, letterSpacing: '-0.02em' }}>
            Alerts
          </h1>
          <p style={{ fontSize: 13, color: muted, marginTop: 4, margin: '4px 0 0' }}>
            {alerts.length} total · {activeCount} active
            {criticalCount > 0 && <span style={{ color: '#F87171', fontWeight: 600 }}> · {criticalCount} critical</span>}
            {' '}· {resolvedCount} resolved
          </p>
        </div>
        <button
          onClick={triggerNow}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: `1px solid ${border}`, background: surface, color: muted, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#FCA5A5', display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => siteId && load(siteId)} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}

      {/* ── Controls bar ───────────────────────────────────────────────────── */}
      <div className="portal-fade-in" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>

        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={14} color={muted} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search alerts…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 32px 8px 33px',
              borderRadius: 10, border: `1px solid ${border}`,
              background: inputBg, color: text,
              fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              outline: 'none',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: muted, padding: 2 }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: pillBg, border: `1px solid ${border}` }}>
          {(['all', 'active', 'resolved'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: '5px 14px', borderRadius: 8, border: 'none',
                background: statusFilter === f ? (isDark ? '#1A2438' : '#FFFFFF') : 'transparent',
                color: statusFilter === f ? text : muted,
                fontWeight: statusFilter === f ? 600 : 400,
                fontSize: 12, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: statusFilter === f ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                transition: 'all 0.15s ease',
                textTransform: 'capitalize' as const,
                whiteSpace: 'nowrap' as const,
              }}
            >
              {f}
              {f === 'active' && activeCount > 0 && (
                <span style={{ marginLeft: 5, padding: '1px 5px', borderRadius: 8, background: '#F87171', color: '#fff', fontSize: 10, fontWeight: 700 }}>{activeCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Severity pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map(s => {
            const cfg = s !== 'all' ? SEV_CONFIG[s] : null;
            const active = severityFilter === s;
            return (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                style={{
                  padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  fontFamily: "'DM Sans', sans-serif",
                  border: active && cfg ? `1px solid ${cfg.border}` : `1px solid ${border}`,
                  background: active && cfg ? cfg.bg : 'transparent',
                  color: active && cfg ? cfg.border : muted,
                  transition: 'all 0.15s ease',
                  textTransform: 'capitalize' as const,
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setStatusFilter('all'); setSeverityFilter('all'); setSearch(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: muted, cursor: 'pointer', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* ── Results count ──────────────────────────────────────────────────── */}
      {hasFilters && !error && (
        <p style={{ fontSize: 12, color: muted, margin: 0 }}>
          {filtered.length === 0 ? 'No results' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {filtered.length === 0 && !error && (
        <div className="portal-fade-in" style={{ textAlign: 'center', padding: '72px 20px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px', background: 'rgba(52,211,153,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={32} color="#34D399" />
          </div>
          <p style={{ fontSize: 18, fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: text, margin: '0 0 8px' }}>
            {hasFilters ? 'No matching alerts' : statusFilter === 'active' ? 'All clear!' : 'No alerts'}
          </p>
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>
            {hasFilters ? 'Try adjusting your search or filters.' : statusFilter === 'active' ? 'Your system is running smoothly.' : 'Nothing to show for this filter.'}
          </p>
        </div>
      )}

      {/* ── Alert timeline ─────────────────────────────────────────────────── */}
      {pageItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 19, top: 20, bottom: 20, width: 2, background: `linear-gradient(to bottom, rgba(47,191,113,0.3), transparent)`, pointerEvents: 'none' }} />

          {pageItems.map((alert, i) => {
            const sev    = SEV_CONFIG[alert.severity]  ?? SEV_CONFIG.info;
            const status = STATUS_CONFIG[alert.status] ?? STATUS_CONFIG.active;
            const ts     = alert.tsStart;
            const device = alert.deviceSerial;

            return (
              <div key={alert.id} className="portal-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Timeline dot */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 14,
                    background: sev.glow, border: `2px solid ${sev.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: sev.border, zIndex: 1, boxShadow: `0 0 8px ${sev.glow}`,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: sev.border }} />
                  </div>

                  {/* Card */}
                  <div style={{
                    flex: 1,
                    background: isDark ? 'linear-gradient(145deg, #0F1623 0%, #0D1320 100%)' : '#FFFFFF',
                    border: `1px solid ${border}`,
                    borderLeft: `3px solid ${sev.border}`,
                    borderRadius: 12, padding: '14px 18px',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{ position: 'absolute', inset: 0, background: sev.glow, opacity: 0.4, pointerEvents: 'none' }} />
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: sev.bg, color: sev.border, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                            {sev.icon} {sev.label}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: status.color, fontWeight: 500 }}>
                            {status.icon} {status.label}
                          </span>
                        </div>
                        {ts && <span style={{ fontSize: 12, color: muted, fontVariantNumeric: 'tabular-nums' }}>{timeAgo(ts)}</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: text, lineHeight: 1.5, fontWeight: 500 }}>{alert.summary}</p>
                      {device && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Zap size={11} /> {device}
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

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="portal-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingTop: 8 }}>
          <span style={{ fontSize: 12, color: muted }}>
            Page {safePage} of {totalPages} · {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              style={pageBtn(isDark, border, muted, safePage === 1)}
              title="First page"
            >
              «
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={pageBtn(isDark, border, muted, safePage === 1)}
            >
              <ChevronLeft size={14} />
            </button>

            {/* Page number pills */}
            {pageRange(safePage, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} style={{ padding: '6px 4px', fontSize: 13, color: muted, lineHeight: 1 }}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  style={{
                    ...pageBtn(isDark, border, muted, false),
                    fontWeight: p === safePage ? 700 : 400,
                    background: p === safePage ? (isDark ? '#1A2438' : '#FFFFFF') : 'transparent',
                    color: p === safePage ? text : muted,
                    boxShadow: p === safePage ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                    minWidth: 32,
                  }}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={pageBtn(isDark, border, muted, safePage === totalPages)}
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              style={pageBtn(isDark, border, muted, safePage === totalPages)}
              title="Last page"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function pageBtn(isDark: boolean, border: string, muted: string, disabled: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 32, height: 32, padding: '0 8px',
    borderRadius: 8, border: `1px solid ${border}`,
    background: 'transparent',
    color: disabled ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)') : muted,
    fontSize: 13, cursor: disabled ? 'default' : 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s ease',
  };
}

function pageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const delta = 1;
  const range: (number | '…')[] = [];
  const left  = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);
  range.push(1);
  if (left > 2)       range.push('…');
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push('…');
  range.push(total);
  return range;
}

export default PortalAlerts;
