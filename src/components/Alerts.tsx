import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, AlertCircle, Info, Bell,
  CheckCircle2, Clock, BarChart3, LayoutGrid, RefreshCw, Search,
  Shield, Activity, ChevronDown, ChevronRight, BookOpen, TrendingUp,
} from 'lucide-react';
import { apiService, AlertAnalyticsFaultSummary, AlertAnalyticsResponse } from '../services/api';
import AuditTrail from './AuditTrail';
import { useTheme } from '../contexts/ThemeContext';
import { EmptyState } from './EmptyState';
import { SkeletonLoader } from './SkeletonLoader';
import PageHeader from './PageHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  device_id: string;
  timestamp: string;
  resolved: boolean;
  created_by_username?: string;
  created_at?: string;
  generated?: boolean;
  fault_code?: string;
  status?: 'active' | 'acknowledged' | 'resolved';
}

// ─── Design tokens (shared with OTA page) ────────────────────────────────────

const tok = {
  bgPage:  (d: boolean) => d ? '#0F172A' : '#F1F5F9',
  bgCard:  (d: boolean) => d ? '#1E293B' : '#FFFFFF',
  bgSub:   (d: boolean) => d ? '#0F172A' : '#F8FAFC',
  bgInput: (d: boolean) => d ? '#0F172A' : '#FFFFFF',
  bgMuted: (d: boolean) => d ? 'rgba(255,255,255,0.04)' : '#F3F4F6',
  border:  (d: boolean) => d ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
  textPrimary:   (d: boolean) => d ? '#F8FAFC' : '#0F172A',
  textSecondary: (d: boolean) => d ? '#94A3B8' : '#64748B',
  textMuted:     (d: boolean) => d ? '#64748B' : '#94A3B8',
};

const SEVERITY_CONFIG = {
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', label: 'Critical', icon: <AlertCircle size={16} /> },
  warning:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', label: 'Warning',  icon: <AlertTriangle size={16} /> },
  info:     { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  label: 'Info',     icon: <Info size={16} /> },
};

const STATUS_CONFIG = {
  resolved:     { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Resolved',    dot: '#10B981' },
  acknowledged: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Acknowledged', dot: '#F59E0B' },
  active:       { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  label: 'Active',       dot: '#EF4444' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cardStyle = (d: boolean, extra?: React.CSSProperties): React.CSSProperties => ({
  background: tok.bgCard(d),
  borderRadius: 14,
  border: `1px solid ${tok.border(d)}`,
  boxShadow: d ? '0 4px 20px rgba(0,0,0,0.35)' : '0 1px 6px rgba(0,0,0,0.06)',
  overflow: 'hidden',
  ...extra,
});

const inputStyle = (d: boolean, extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '8px 12px',
  borderRadius: 8,
  border: `1px solid ${tok.border(d)}`,
  background: tok.bgInput(d),
  color: tok.textPrimary(d),
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box' as const,
  ...extra,
});

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
  padding: '8px 14px',
};

// ─── Analytics helpers ────────────────────────────────────────────────────────

const CATALOGUE_GROUPS: Record<string, string[]> = {
  'Connectivity': ['device_offline', 'rs485_stale', 'rs485_auto_reboot', 'deye_cloud_unavailable'],
  'Solar (PV)':   ['PV-002', 'PV-005', 'PV-006'],
  'Inverter':     ['INV-003', 'INV-006'],
  'Battery':      ['BAT-001', 'BAT-002', 'BAT-003', 'BAT-008'],
  'Grid':         ['GRID-001', 'GRID-002', 'GRID-003', 'GRID-004'],
};

const fmtTTR = (s: number | null): string => {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const fmtDateShort = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// ─── Component ────────────────────────────────────────────────────────────────

const Alerts: React.FC = () => {
  const { isDark } = useTheme();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [alertSearch, setAlertSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'analytics'>('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AlertAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [lookbackDays, setLookbackDays] = useState<7 | 30 | 90 | 180>(90);
  const [expandedFaultCode, setExpandedFaultCode] = useState<string | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [catalogueExpandedCode, setCatalogueExpandedCode] = useState<string | null>(null);
  const [hoveredTimelineDay, setHoveredTimelineDay] = useState<number | null>(null);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab !== 'analytics') return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    apiService.getAlertsAnalytics(lookbackDays)
      .then(setAnalyticsData)
      .catch(err => setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setAnalyticsLoading(false));
  }, [activeTab, lookbackDays]);

  const fetchAlerts = async () => {
    try {
      const data = await apiService.getAlerts();
      setAlerts(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (filterStatus !== 'all') {
      const resolvedOrStatus = alert.status === 'resolved' || alert.resolved;
      if (filterStatus === 'resolved' && !resolvedOrStatus) return false;
      if (filterStatus === 'active' && (resolvedOrStatus || alert.status === 'acknowledged')) return false;
      if (filterStatus === 'acknowledged' && alert.status !== 'acknowledged') return false;
    }
    if (alertSearch.trim()) {
      const q = alertSearch.toLowerCase();
      return alert.message.toLowerCase().includes(q) || alert.device_id.toLowerCase().includes(q) || alert.type.toLowerCase().includes(q);
    }
    return true;
  });

  const unresolvedAlerts = alerts.filter(a => !a.resolved && a.status !== 'resolved');
  const criticalCount  = alerts.filter(a => a.severity === 'critical').length;
  const warningCount   = alerts.filter(a => a.severity === 'warning').length;
  const infoCount      = alerts.filter(a => a.severity === 'info').length;
  const resolvedCount  = alerts.filter(a => a.resolved || a.status === 'resolved').length;
  const resolutionPct  = alerts.length > 0 ? Math.round((resolvedCount / alerts.length) * 100) : 0;

  const bdr = tok.border(isDark);
  const txt = tok.textPrimary(isDark);
  const sub = tok.textSecondary(isDark);

  const getAlertStatus = (alert: Alert) => {
    if (alert.status === 'resolved' || alert.resolved) return 'resolved';
    if (alert.status === 'acknowledged') return 'acknowledged';
    return 'active';
  };

  // ── Loading / Error ──
  if (loading) {
    return (
      <div className="admin-container responsive-page">
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #EF4444, #F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={26} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: txt, letterSpacing: '-0.02em' }}>System Alerts</h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: sub }}>Loading alert data…</p>
          </div>
        </div>
        <SkeletonLoader rows={8} height="24px" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-container responsive-page">
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '1rem 1.25rem', color: '#EF4444' }}>
          <strong>Error loading alerts:</strong> {error}
        </div>
      </div>
    );
  }

  // ── Tabs config ──
  const tabs: { key: 'overview' | 'alerts' | 'analytics'; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'overview',  label: 'Overview',   icon: <LayoutGrid size={15} /> },
    { key: 'alerts',    label: 'All Alerts', icon: <Bell size={15} />, badge: filteredAlerts.length },
    { key: 'analytics', label: 'Analytics',  icon: <BarChart3 size={15} /> },
  ];

  return (
    <div className="admin-container responsive-page">

      <PageHeader
        icon={<Bell size={20} color="white" />}
        title="System Alerts"
        subtitle="Monitor and track alerts across your device fleet"
        rightSlot={
          <>
          {/* Live status badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: '0.8125rem',
            background: unresolvedAlerts.length === 0
              ? 'rgba(34,197,94,0.12)'
              : unresolvedAlerts.some(a => a.severity === 'critical')
                ? 'rgba(239,68,68,0.12)'
                : 'rgba(245,158,11,0.12)',
            color: unresolvedAlerts.length === 0
              ? '#22C55E'
              : unresolvedAlerts.some(a => a.severity === 'critical')
                ? '#EF4444'
                : '#F59E0B',
            border: `1px solid ${unresolvedAlerts.length === 0 ? 'rgba(34,197,94,0.3)' : unresolvedAlerts.some(a => a.severity === 'critical') ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
            {unresolvedAlerts.length === 0 ? 'All Clear' : `${unresolvedAlerts.length} Unresolved`}
          </span>
          <button onClick={handleRefresh} style={{
            ...btnBase,
            background: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9',
            color: sub, border: `1px solid ${bdr}`,
          }}>
            <RefreshCw size={14} className={refreshing ? 'ota-spinner' : undefined} /> Refresh
          </button>
          </>
        }
      />

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {[
          { label: 'Total',       value: alerts.length,    color: '#6366F1', icon: <Bell size={17} /> },
          { label: 'Unresolved',  value: unresolvedAlerts.length, color: '#EF4444', icon: <AlertCircle size={17} /> },
          { label: 'Critical',    value: criticalCount,    color: '#DC2626', icon: <AlertCircle size={17} /> },
          { label: 'Warnings',    value: warningCount,     color: '#F59E0B', icon: <AlertTriangle size={17} /> },
          { label: 'Info',        value: infoCount,        color: '#3B82F6', icon: <Info size={17} /> },
          { label: 'Resolved',    value: resolvedCount,    color: '#10B981', icon: <CheckCircle2 size={17} /> },
        ].map(kpi => (
          <div key={kpi.label} style={{
            ...cardStyle(isDark),
            padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `${kpi.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                {kpi.icon}
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', background: tok.bgMuted(isDark), padding: 5, borderRadius: 12, width: 'fit-content' }}>
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              ...btnBase,
              background: active ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
              color: active ? txt : sub,
              boxShadow: active ? '0 1px 6px rgba(0,0,0,0.15)' : 'none',
              padding: '8px 16px',
              border: 'none',
            }}>
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span style={{
                  background: active ? '#6366F1' : tok.bgMuted(isDark),
                  color: active ? 'white' : sub,
                  fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                }}>{tab.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════ TAB: Overview ══════════════════════ */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>

          {/* Summary card */}
          <div style={cardStyle(isDark, { padding: 0 })}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={17} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: txt, fontSize: '0.9375rem' }}>Alert Summary</div>
                <div style={{ fontSize: '0.8125rem', color: sub }}>Fleet health overview</div>
              </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Total Alerts', value: alerts.length, color: '#6366F1' },
                { label: 'Unresolved',   value: unresolvedAlerts.length, color: '#EF4444' },
                { label: 'Critical',     value: criticalCount, color: '#DC2626' },
                { label: 'Warnings',     value: warningCount,  color: '#F59E0B' },
              ].map(item => (
                <div key={item.label} style={{
                  background: `${item.color}0f`,
                  border: `1px solid ${item.color}2a`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: '0.75rem', color: item.color, fontWeight: 600, marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                </div>
              ))}
            </div>
            {/* Resolution progress */}
            <div style={{ padding: '0 20px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: sub }}>Resolution Rate</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#10B981' }}>{resolutionPct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: tok.bgMuted(isDark), overflow: 'hidden' }}>
                <div style={{ width: `${resolutionPct}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #22C55E)', borderRadius: 6, transition: 'width 0.5s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: '0.75rem', color: sub }}>
                <span>{resolvedCount} resolved</span>
                <span>{unresolvedAlerts.length} pending</span>
              </div>
            </div>
          </div>

          {/* Filter card */}
          <div style={cardStyle(isDark, { padding: 0 })}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={17} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: txt, fontSize: '0.9375rem' }}>Quick Filters</div>
                <div style={{ fontSize: '0.8125rem', color: sub }}>Narrow down by severity or status</div>
              </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.75rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Severity</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['all', 'critical', 'warning', 'info'].map(s => {
                    const active = filterSeverity === s;
                    const cfg = s !== 'all' ? SEVERITY_CONFIG[s as keyof typeof SEVERITY_CONFIG] : null;
                    return (
                      <button key={s} onClick={() => { setFilterSeverity(s); setActiveTab('alerts'); }} style={{
                        ...btnBase, padding: '5px 12px', fontSize: '0.8125rem',
                        background: active ? (cfg ? cfg.bg : 'rgba(99,102,241,0.15)') : tok.bgMuted(isDark),
                        color: active ? (cfg ? cfg.color : '#818CF8') : sub,
                        border: `1px solid ${active ? (cfg ? cfg.border : 'rgba(99,102,241,0.35)') : bdr}`,
                      }}>
                        {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.75rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['all', 'active', 'acknowledged', 'resolved'].map(s => {
                    const active = filterStatus === s;
                    const cfg = s !== 'all' ? STATUS_CONFIG[s as keyof typeof STATUS_CONFIG] : null;
                    return (
                      <button key={s} onClick={() => { setFilterStatus(s); setActiveTab('alerts'); }} style={{
                        ...btnBase, padding: '5px 12px', fontSize: '0.8125rem',
                        background: active ? (cfg ? cfg.bg : 'rgba(99,102,241,0.15)') : tok.bgMuted(isDark),
                        color: active ? (cfg ? cfg.color : '#818CF8') : sub,
                        border: `1px solid ${active ? (cfg ? `${cfg.dot}44` : 'rgba(99,102,241,0.35)') : bdr}`,
                      }}>
                        {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginTop: 4, padding: '10px 14px', background: tok.bgMuted(isDark), borderRadius: 8 }}>
                <span style={{ fontSize: '0.8125rem', color: sub }}>Showing </span>
                <span style={{ fontWeight: 700, color: txt }}>{filteredAlerts.length}</span>
                <span style={{ fontSize: '0.8125rem', color: sub }}> of {alerts.length} alerts</span>
              </div>
            </div>
          </div>

          {/* Recent critical */}
          <div style={{ ...cardStyle(isDark, { padding: 0 }), gridColumn: 'span 2' } as React.CSSProperties}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #EF4444, #B91C1C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={17} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: txt, fontSize: '0.9375rem' }}>Recent Critical Alerts</div>
                <div style={{ fontSize: '0.8125rem', color: sub }}>Latest critical issues requiring attention</div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                {criticalCount} critical
              </span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {criticalCount === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: sub }}>
                  <CheckCircle2 size={36} style={{ marginBottom: 10, color: '#22C55E', opacity: 0.6 }} />
                  <div style={{ fontWeight: 600 }}>No critical alerts — system is stable</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alerts.filter(a => a.severity === 'critical').slice(0, 6).map(alert => (
                    <div key={alert.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(239,68,68,0.06)',
                      borderLeft: '3px solid #EF4444',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {alert.type.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: sub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {alert.message}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', padding: '3px 10px', borderRadius: 20,
                        background: (alert.resolved || alert.status === 'resolved') ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        color: (alert.resolved || alert.status === 'resolved') ? '#10B981' : '#EF4444',
                      }}>
                        {(alert.resolved || alert.status === 'resolved') ? 'Resolved' : 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB: Alerts List ══════════════════════ */}
      {activeTab === 'alerts' && (
        <div style={cardStyle(isDark, { padding: 0 })}>
          {/* Toolbar */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={17} color="white" />
              </div>
              <span style={{ fontWeight: 700, color: txt, fontSize: '0.9375rem' }}>
                Alerts ({filteredAlerts.length})
              </span>
            </div>
            {/* Severity pills */}
            <div style={{ display: 'flex', gap: 5 }}>
              {['all', 'critical', 'warning', 'info'].map(s => {
                const active = filterSeverity === s;
                const cfg = s !== 'all' ? SEVERITY_CONFIG[s as keyof typeof SEVERITY_CONFIG] : null;
                return (
                  <button key={s} onClick={() => setFilterSeverity(s)} style={{
                    ...btnBase, padding: '4px 10px', fontSize: '0.75rem',
                    background: active ? (cfg ? cfg.bg : 'rgba(99,102,241,0.15)') : tok.bgMuted(isDark),
                    color: active ? (cfg ? cfg.color : '#818CF8') : sub,
                    border: `1px solid ${active ? (cfg ? cfg.border : 'rgba(99,102,241,0.35)') : bdr}`,
                  }}>
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                );
              })}
            </div>
            {/* Status pills */}
            <div style={{ display: 'flex', gap: 5 }}>
              {(['all', 'active', 'acknowledged', 'resolved'] as const).map(s => {
                const active = filterStatus === s;
                const cfg = s !== 'all' ? STATUS_CONFIG[s] : null;
                return (
                  <button key={s} onClick={() => setFilterStatus(s)} style={{
                    ...btnBase, padding: '4px 10px', fontSize: '0.75rem',
                    background: active ? (cfg ? cfg.bg : 'rgba(99,102,241,0.15)') : tok.bgMuted(isDark),
                    color: active ? (cfg ? cfg.color : '#818CF8') : sub,
                    border: `1px solid ${active ? (cfg ? `${cfg.dot}55` : 'rgba(99,102,241,0.35)') : bdr}`,
                  }}>
                    {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                );
              })}
            </div>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: sub }} />
              <input placeholder="Search message, device, type…" value={alertSearch} onChange={e => setAlertSearch(e.target.value)}
                style={{ ...inputStyle(isDark, { paddingLeft: 28, width: 240 }) }} />
            </div>
          </div>

          {/* Alert list */}
          <div style={{ padding: '16px 20px' }}>
            {filteredAlerts.length === 0 ? (
              <EmptyState title="No alerts" description="No alerts match your current filters." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredAlerts.map(alert => {
                  const sevCfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
                  const alertStatus = getAlertStatus(alert);
                  const stsCfg = STATUS_CONFIG[alertStatus];
                  return (
                    <div key={alert.id} style={{
                      borderRadius: 12,
                      border: `1px solid ${bdr}`,
                      borderLeft: `3px solid ${sevCfg.color}`,
                      background: tok.bgSub(isDark),
                      padding: '14px 16px',
                      transition: 'background 0.15s',
                    }}>
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                        {/* Severity icon badge */}
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          background: sevCfg.bg, color: sevCfg.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {sevCfg.icon}
                        </div>
                        {/* Type */}
                        <span style={{
                          padding: '3px 10px', borderRadius: 6,
                          background: sevCfg.bg, color: sevCfg.color,
                          fontSize: '0.75rem', fontWeight: 700,
                          letterSpacing: '0.05em', textTransform: 'uppercase',
                        }}>
                          {alert.type.replace(/_/g, ' ')}
                        </span>
                        {/* Fault code */}
                        {alert.fault_code && (
                          <code style={{
                            fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700,
                            padding: '2px 8px', borderRadius: 5,
                            background: 'rgba(99,102,241,0.12)', color: '#818CF8',
                            border: '1px solid rgba(99,102,241,0.3)',
                          }}>{alert.fault_code}</code>
                        )}
                        {/* Device */}
                        <span style={{ fontSize: '0.8125rem', color: sub, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          {alert.device_id}
                        </span>
                        {/* Fault tag */}
                        {alert.generated === false && (
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: 'rgba(148,163,184,0.1)', color: sub, border: `1px solid ${bdr}`,
                          }}>Fault</span>
                        )}
                        {/* Timestamp - push right */}
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: tok.textMuted(isDark), whiteSpace: 'nowrap' }}>
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </div>

                      {/* Message */}
                      <div style={{ fontSize: '0.875rem', color: txt, lineHeight: 1.55, paddingLeft: 40 }}>
                        {alert.message}
                      </div>

                      {/* Footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${bdr}`, flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* Status badge */}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                            background: stsCfg.bg, color: stsCfg.color,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: stsCfg.dot }} />
                            {stsCfg.label}
                          </span>
                          {/* Severity badge */}
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                            background: sevCfg.bg, color: sevCfg.color,
                          }}>
                            {sevCfg.label}
                          </span>
                        </div>
                        <AuditTrail createdBy={alert.created_by_username} createdAt={alert.created_at} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB: Analytics ══════════════════════ */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── Lookback selector ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: sub }}>Lookback:</span>
            {([7, 30, 90, 180] as const).map(d => (
              <button key={d} onClick={() => setLookbackDays(d)} style={{
                ...btnBase,
                padding: '6px 14px',
                background: lookbackDays === d ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : tok.bgMuted(isDark),
                color: lookbackDays === d ? 'white' : sub,
                border: lookbackDays === d ? 'none' : `1px solid ${bdr}`,
                fontSize: '0.8125rem',
              }}>{d}d</button>
            ))}
          </div>

          {/* ── Loading / Error ── */}
          {analyticsLoading && <SkeletonLoader rows={6} height="28px" />}
          {analyticsError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '1rem 1.25rem', color: '#EF4444' }}>
              <strong>Error loading analytics:</strong> {analyticsError}
            </div>
          )}

          {analyticsData && !analyticsLoading && (() => {
            const totalOccurrences = analyticsData.fault_summaries.reduce((s, f) => s + f.total_occurrences, 0);
            const totalActive = analyticsData.fault_summaries.reduce((s, f) => s + f.active_count, 0);
            const mostFrequent = analyticsData.fault_summaries.reduce<AlertAnalyticsFaultSummary | null>(
              (best, f) => !best || f.total_occurrences > best.total_occurrences ? f : best, null
            );
            const resolvedFaults = analyticsData.fault_summaries.filter(f => f.avg_resolution_seconds != null);
            const avgTTR = resolvedFaults.length > 0
              ? resolvedFaults.reduce((s, f) => s + f.avg_resolution_seconds!, 0) / resolvedFaults.length
              : null;
            const catalogueByCode = Object.fromEntries(analyticsData.rule_catalogue.map(r => [r.fault_code, r]));
            const timelineDays = analyticsData.timeline.slice(-30);
            const maxDayCount = Math.max(1, ...timelineDays.map(d => d.faults.reduce((s, f) => s + f.count, 0)));

            return (
              <>
                {/* ── A. Summary cards ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {[
                    { label: 'Total Occurrences', value: totalOccurrences.toString(), sub: `in last ${analyticsData.lookback_days}d`, color: '#6366F1', icon: <BarChart3 size={17} /> },
                    { label: 'Active Now', value: totalActive.toString(), sub: totalActive === 0 ? 'All clear' : 'Needs attention', color: totalActive === 0 ? '#10B981' : '#EF4444', icon: <AlertCircle size={17} /> },
                    { label: 'Most Frequent', value: mostFrequent ? mostFrequent.fault_code : '—', sub: mostFrequent ? `${mostFrequent.total_occurrences}× — ${mostFrequent.title}` : 'No faults', color: mostFrequent ? SEVERITY_CONFIG[mostFrequent.severity].color : sub, icon: <AlertTriangle size={17} /> },
                    { label: 'Avg Time to Resolve', value: fmtTTR(avgTTR), sub: resolvedFaults.length > 0 ? `across ${resolvedFaults.length} fault type${resolvedFaults.length > 1 ? 's' : ''}` : 'No resolved faults', color: '#F59E0B', icon: <Clock size={17} /> },
                  ].map(card => (
                    <div key={card.label} style={{ ...cardStyle(isDark), padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color }}>{card.icon}</div>
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.color, lineHeight: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.value}</div>
                      <div style={{ fontSize: '0.75rem', color: sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.sub}</div>
                    </div>
                  ))}
                </div>

                {/* ── B. Fault frequency table ── */}
                {analyticsData.fault_summaries.length > 0 ? (
                  <div style={{ ...cardStyle(isDark), padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #EF4444, #F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp size={17} color="white" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: txt, fontSize: '0.9375rem' }}>Fault Frequency</div>
                        <div style={{ fontSize: '0.8125rem', color: sub }}>{analyticsData.fault_summaries.length} fault type{analyticsData.fault_summaries.length !== 1 ? 's' : ''} in period</div>
                      </div>
                    </div>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 110px 70px 60px 120px 110px 110px', gap: '0 12px', padding: '10px 20px', background: tok.bgSub(isDark), borderBottom: `1px solid ${bdr}`, fontSize: '0.7rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <span>Fault Code</span><span>Title</span><span>Severity</span><span>Count</span><span>Active</span><span>Avg Resolve</span><span>First Seen</span><span>Last Seen</span>
                    </div>
                    {[...analyticsData.fault_summaries].sort((a, b) => b.total_occurrences - a.total_occurrences).map(f => {
                      const sevCfg = SEVERITY_CONFIG[f.severity];
                      const isExpanded = expandedFaultCode === f.fault_code;
                      const instances = analyticsData.recent_instances[f.fault_code] ?? [];
                      const catEntry = catalogueByCode[f.fault_code];
                      return (
                        <div key={f.fault_code} style={{ borderBottom: `1px solid ${bdr}` }}>
                          <div onClick={() => setExpandedFaultCode(isExpanded ? null : f.fault_code)} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 110px 70px 60px 120px 110px 110px', gap: '0 12px', padding: '12px 20px', alignItems: 'center', cursor: 'pointer', background: isExpanded ? tok.bgSub(isDark) : 'transparent', transition: 'background 0.15s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isExpanded ? <ChevronDown size={13} style={{ color: sub, flexShrink: 0 }} /> : <ChevronRight size={13} style={{ color: sub, flexShrink: 0 }} />}
                              <code style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: sevCfg.color, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fault_code}</code>
                            </div>
                            <span style={{ fontSize: '0.875rem', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</span>
                            <div>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: sevCfg.bg, color: sevCfg.color, border: `1px solid ${sevCfg.border}` }}>
                                {sevCfg.icon} {sevCfg.label}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: txt, fontFamily: 'monospace' }}>{f.total_occurrences}</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: f.active_count > 0 ? 700 : 400, color: f.active_count > 0 ? '#EF4444' : sub, fontFamily: 'monospace' }}>{f.active_count}</span>
                            <span style={{ fontSize: '0.875rem', color: sub, fontFamily: 'monospace' }}>{fmtTTR(f.avg_resolution_seconds)}</span>
                            <span style={{ fontSize: '0.75rem', color: sub }}>{fmtDateShort(f.first_seen)}</span>
                            <span style={{ fontSize: '0.75rem', color: sub }}>{fmtDateShort(f.last_seen)}</span>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: '16px 24px 20px', background: tok.bgSub(isDark), borderTop: `1px solid ${bdr}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Reason</div>
                                  <div style={{ fontSize: '0.875rem', color: txt, lineHeight: 1.5 }}>{f.reason}</div>
                                </div>
                                {catEntry?.fix_guidance && (
                                  <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Fix Guidance</div>
                                    <div style={{ fontSize: '0.875rem', color: txt, lineHeight: 1.5 }}>{catEntry.fix_guidance}</div>
                                  </div>
                                )}
                              </div>
                              {instances.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Recent Instances ({instances.length})</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {instances.map(inst => {
                                      const durationSec = inst.resolved_at
                                        ? (new Date(inst.resolved_at).getTime() - new Date(inst.triggered_at).getTime()) / 1000
                                        : null;
                                      const stCfg = STATUS_CONFIG[inst.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
                                      return (
                                        <div key={inst.id} style={{ background: tok.bgCard(isDark), border: `1px solid ${bdr}`, borderRadius: 10, padding: '12px 14px' }}>
                                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                                            <div style={{ fontSize: '0.8125rem', color: txt, flex: 1 }}>{inst.message}</div>
                                            <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: stCfg.bg, color: stCfg.color }}>{stCfg.label}</span>
                                          </div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: '0.75rem', color: sub }}>
                                            <span><code style={{ fontFamily: 'monospace', color: txt }}>{inst.device_serial}</code></span>
                                            <span>Triggered: {fmtDate(inst.triggered_at)}</span>
                                            {inst.resolved_at && <span>Resolved: {fmtDate(inst.resolved_at)}</span>}
                                            {durationSec != null && <span>Duration: {fmtTTR(durationSec)}</span>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ ...cardStyle(isDark), padding: '2.5rem', textAlign: 'center', color: sub }}>
                    No faults recorded in the last {lookbackDays} days.
                  </div>
                )}

                {/* ── C. Timeline chart ── */}
                {timelineDays.length > 0 && (
                  <div style={{ ...cardStyle(isDark), padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Activity size={17} color="white" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: txt, fontSize: '0.9375rem' }}>Daily Timeline</div>
                          <div style={{ fontSize: '0.8125rem', color: sub }}>Fault counts per day</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {(['critical', 'warning', 'info'] as const).map(sev => (
                          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: SEVERITY_CONFIG[sev].color }} />
                            <span style={{ fontSize: '0.75rem', color: sub }}>{SEVERITY_CONFIG[sev].label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ padding: '20px 20px 12px', overflowX: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, minWidth: `${timelineDays.length * 22}px`, height: 160 }}>
                        {timelineDays.map((day, i) => {
                          const byCrit = day.faults.filter(f => f.severity === 'critical').reduce((s, f) => s + f.count, 0);
                          const byWarn = day.faults.filter(f => f.severity === 'warning').reduce((s, f) => s + f.count, 0);
                          const byInfo = day.faults.filter(f => f.severity === 'info').reduce((s, f) => s + f.count, 0);
                          const total = byCrit + byWarn + byInfo;
                          const barH = Math.round((total / maxDayCount) * 140);
                          const critH = total > 0 ? Math.round((byCrit / total) * barH) : 0;
                          const warnH = total > 0 ? Math.round((byWarn / total) * barH) : 0;
                          const infoH = barH - critH - warnH;
                          const isHov = hoveredTimelineDay === i;
                          return (
                            <div key={day.date} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', cursor: total > 0 ? 'pointer' : 'default', position: 'relative' }}
                              onMouseEnter={() => setHoveredTimelineDay(i)}
                              onMouseLeave={() => setHoveredTimelineDay(null)}
                            >
                              {isHov && total > 0 && (
                                <div style={{ position: 'absolute', bottom: barH + 8, left: '50%', transform: 'translateX(-50%)', background: isDark ? '#1E293B' : '#0F172A', color: 'white', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
                                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{fmtDateShort(day.date)}</div>
                                  {byCrit > 0 && <div style={{ color: '#EF4444' }}>Critical: {byCrit}</div>}
                                  {byWarn > 0 && <div style={{ color: '#F59E0B' }}>Warning: {byWarn}</div>}
                                  {byInfo > 0 && <div style={{ color: '#3B82F6' }}>Info: {byInfo}</div>}
                                  <div style={{ color: '#94A3B8', borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 4, paddingTop: 4 }}>Total: {total}</div>
                                </div>
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column-reverse', borderRadius: '3px 3px 0 0', overflow: 'hidden' }}>
                                {critH > 0 && <div style={{ height: critH, background: '#EF4444', opacity: isHov ? 1 : 0.85 }} />}
                                {warnH > 0 && <div style={{ height: warnH, background: '#F59E0B', opacity: isHov ? 1 : 0.85 }} />}
                                {infoH > 0 && <div style={{ height: infoH, background: '#3B82F6', opacity: isHov ? 1 : 0.85 }} />}
                                {total === 0 && <div style={{ height: 2, background: tok.bgMuted(isDark), borderRadius: 1 }} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.7rem', color: sub }}>
                        <span>{fmtDateShort(timelineDays[0].date)}</span>
                        {timelineDays.length > 2 && <span>{fmtDateShort(timelineDays[Math.floor(timelineDays.length / 2)].date)}</span>}
                        <span>{fmtDateShort(timelineDays[timelineDays.length - 1].date)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── E. Rule Catalogue ── */}
                <div style={{ ...cardStyle(isDark), padding: 0 }}>
                  <button onClick={() => setCatalogueOpen(o => !o)} style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: catalogueOpen ? `1px solid ${bdr}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #10B981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen size={17} color="white" />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, color: txt, fontSize: '0.9375rem' }}>Rule Catalogue</div>
                        <div style={{ fontSize: '0.8125rem', color: sub }}>{analyticsData.rule_catalogue.length} fault rules defined</div>
                      </div>
                    </div>
                    {catalogueOpen ? <ChevronDown size={18} style={{ color: sub }} /> : <ChevronRight size={18} style={{ color: sub }} />}
                  </button>
                  {catalogueOpen && (
                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {Object.entries(CATALOGUE_GROUPS).map(([groupName, codes]) => {
                        const entries = codes.map(code => catalogueByCode[code]).filter(Boolean);
                        if (entries.length === 0) return null;
                        return (
                          <div key={groupName}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{groupName}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {entries.map(entry => {
                                const sevCfg = SEVERITY_CONFIG[entry.severity];
                                const isExp = catalogueExpandedCode === entry.fault_code;
                                return (
                                  <div key={entry.fault_code} style={{ border: `1px solid ${isExp ? sevCfg.border : bdr}`, borderRadius: 10, background: isExp ? sevCfg.bg : 'transparent', overflow: 'hidden', transition: 'all 0.15s' }}>
                                    <button onClick={() => setCatalogueExpandedCode(isExp ? null : entry.fault_code)} style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                      {isExp ? <ChevronDown size={13} style={{ color: sub, flexShrink: 0 }} /> : <ChevronRight size={13} style={{ color: sub, flexShrink: 0 }} />}
                                      <code style={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 700, color: sevCfg.color, minWidth: 100 }}>{entry.fault_code}</code>
                                      <span style={{ fontSize: '0.875rem', color: txt, flex: 1 }}>{entry.title}</span>
                                      <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: sevCfg.bg, color: sevCfg.color, border: `1px solid ${sevCfg.border}` }}>{sevCfg.label}</span>
                                    </button>
                                    {isExp && (
                                      <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div>
                                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Reason</div>
                                          <div style={{ fontSize: '0.875rem', color: txt, lineHeight: 1.5 }}>{entry.reason}</div>
                                        </div>
                                        {entry.fix_guidance && (
                                          <div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Fix Guidance</div>
                                            <div style={{ fontSize: '0.875rem', color: txt, lineHeight: 1.5 }}>{entry.fix_guidance}</div>
                                          </div>
                                        )}
                                        {entry.cooldown_hours != null && (
                                          <div style={{ fontSize: '0.8125rem', color: sub }}>Cooldown: {entry.cooldown_hours}h</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

    </div>
  );
};

export default Alerts;
