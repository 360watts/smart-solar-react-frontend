import React, { useState, useEffect } from 'react';
import { MobileAlerts } from './mobile';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  AlertTriangle, AlertCircle, Info, Bell,
  CheckCircle2, Clock, BarChart3, LayoutGrid, RefreshCw, Search,
  Shield, Activity, ChevronDown, ChevronRight, ChevronLeft, BookOpen, TrendingUp,
  Download, Filter, X, BarChart, LineChart, AreaChart,
  Brain, ChevronUp,
} from 'lucide-react';
import { apiService, AlertAnalyticsFaultSummary, AlertAnalyticsResponse, AlertItem } from '../services/api';
import type { DiagnoseBatchResponse, AlertDiagnosticResult } from '../services/api';
import AuditTrail from './AuditTrail';
import { useTheme } from '../contexts/ThemeContext';
import { EmptyState } from './EmptyState';
import { SkeletonLoader } from './SkeletonLoader';
import PageHeader from './PageHeader';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  AreaChart as RechartsAreaChart,
  Area,
  ComposedChart,
  Brush,
  ReferenceLine,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  device_id: string;
  device_serial?: string;
  timestamp: string;
  resolved: boolean;
  created_by_username?: string;
  created_at?: string;
  generated?: boolean;
  fault_code?: string;
  status?: 'active' | 'acknowledged' | 'resolved';
  metadata?: {
    diagnostic?: {
      root_cause: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      recommendation: string;
      llm_model?: string;
      call_duration_ms?: number;
      timestamp?: string;
      parse_error?: string;
    };
  };
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
  minHeight: 44,
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

const normalizeFaultTitle = (faultCode: string, title?: string): string => {
  if (faultCode === 'rs485_stale') return 'RS-485 Missing Data';
  if (faultCode === 'rs485_auto_reboot') return 'RS-485 Missing Data: Auto-Reboot Queued';
  return title || faultCode;
};

const normalizeFaultReason = (faultCode: string, reason?: string): string => {
  if (faultCode === 'rs485_stale') {
    return 'RS-485 missing data detected: device reported all register values as zero.';
  }
  if (faultCode === 'rs485_auto_reboot') {
    return 'Consecutive all-registers-zero stale verdicts reached the reboot threshold; device was commanded to reboot.';
  }
  return reason || '';
};

// ─── Component ────────────────────────────────────────────────────────────────

const Alerts: React.FC = () => {
  const isMobile = useIsMobile();
  const { isDark } = useTheme();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [alertSearch, setAlertSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'analytics'>('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [analyticsData, setAnalyticsData] = useState<AlertAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [lookbackDays, setLookbackDays] = useState<7 | 30 | 90 | 180>(90);
  const [expandedFaultCode, setExpandedFaultCode] = useState<string | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [catalogueExpandedCode, setCatalogueExpandedCode] = useState<string | null>(null);
  const [hoveredTimelineDay, setHoveredTimelineDay] = useState<number | null>(null);

  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState<DiagnoseBatchResponse | null>(null);
  const [diagPanelOpen, setDiagPanelOpen] = useState(false);
  const [selectedAlertForDiag, setSelectedAlertForDiag] = useState<string | null>(null);
  const [diagRunStartedAt, setDiagRunStartedAt] = useState<string | null>(null);

  // Chart interactivity state
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'composed'>('bar');
  const [chartSeverityFilter, setChartSeverityFilter] = useState<Set<'critical' | 'warning' | 'info'>>(new Set(['critical', 'warning', 'info']));
  const [chartMetric, setChartMetric] = useState<'total' | 'critical' | 'warning' | 'info'>('total');
  const [showBrush, setShowBrush] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Chart data transformation
  const getChartData = () => {
    if (!analyticsData) return [];

    const timelineDays = analyticsData.timeline.slice(-30);
    return timelineDays.map(day => {
      const byCrit = day.faults.filter(f => f.severity === 'critical').reduce((s, f) => s + f.count, 0);
      const byWarn = day.faults.filter(f => f.severity === 'warning').reduce((s, f) => s + f.count, 0);
      const byInfo = day.faults.filter(f => f.severity === 'info').reduce((s, f) => s + f.count, 0);
      const total = byCrit + byWarn + byInfo;
      const visibleTotal = (chartSeverityFilter.has('critical') ? byCrit : 0)
        + (chartSeverityFilter.has('warning') ? byWarn : 0)
        + (chartSeverityFilter.has('info') ? byInfo : 0);

      return {
        date: day.date,
        dateShort: fmtDateShort(day.date),
        critical: chartSeverityFilter.has('critical') ? byCrit : 0,
        warning: chartSeverityFilter.has('warning') ? byWarn : 0,
        info: chartSeverityFilter.has('info') ? byInfo : 0,
        visibleTotal,
        total,
        // For composed chart
        criticalLine: byCrit,
        warningLine: byWarn,
        infoLine: byInfo,
        totalLine: total,
      };
    });
  };

  const toggleSeverityFilter = (severity: 'critical' | 'warning' | 'info') => {
    const newFilter = new Set(chartSeverityFilter);
    if (newFilter.has(severity)) {
      newFilter.delete(severity);
    } else {
      newFilter.add(severity);
    }
    setChartSeverityFilter(newFilter);
  };

  const exportChartData = () => {
    const data = getChartData();
    const csvContent = [
      ['Date', 'Critical', 'Warning', 'Info', 'Visible Total', 'Total'].join(','),
      ...data.map(row => [row.date, row.critical, row.warning, row.info, row.visibleTotal, row.total].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `alerts-timeline-${lookbackDays}d.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (!analyticsData) return;
    const latest = analyticsData.timeline.slice(-1)[0];
    if (latest) {
      setSelectedDate(latest.date);
    }
  }, [analyticsData]);

  const selectedChartDay = React.useMemo(() => {
    const data = getChartData();
    return selectedDate ? data.find(day => day.date === selectedDate) : data[data.length - 1];
  }, [selectedDate, analyticsData, chartSeverityFilter]);

  const handleChartHover = (state: any) => {
    if (!state?.activePayload?.[0]?.payload) return;
    const payload = state.activePayload[0].payload;
    if (payload?.date) {
      setSelectedDate(payload.date);
    }
  };

  useEffect(() => {
    if (!selectedChartDay && analyticsData?.timeline.length) {
      setSelectedDate(analyticsData.timeline.slice(-1)[0].date);
    }
  }, [selectedChartDay, analyticsData]);

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
      return alert.message.toLowerCase().includes(q)
        || getAlertDisplayMessage(alert).toLowerCase().includes(q)
        || alert.device_id.toLowerCase().includes(q)
        || alert.type.toLowerCase().includes(q)
        || (alert.fault_code?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAlerts = filteredAlerts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSeverity, filterStatus, alertSearch]);

  const unresolvedAlerts = alerts.filter(a => !a.resolved && a.status !== 'resolved');
  const criticalCount  = alerts.filter(a => a.severity === 'critical').length;
  const unresolvedCriticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.resolved && a.status !== 'resolved');
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

  const getAlertDisplayMessage = (alert: Alert) => {
    if (alert.fault_code === 'rs485_stale') {
      return 'RS-485 missing data detected: device firmware reported all register values as zero.';
    }
    if (alert.fault_code === 'rs485_auto_reboot') {
      return 'Auto-reboot queued after consecutive RS-485 missing-data verdicts (all-registers-zero condition).';
    }
    return alert.message;
  };

  if (isMobile) return <MobileAlerts />;

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
                {unresolvedCriticalAlerts.length} critical
              </span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {unresolvedCriticalAlerts.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: sub }}>
                  <CheckCircle2 size={36} style={{ marginBottom: 10, color: '#22C55E', opacity: 0.6 }} />
                  <div style={{ fontWeight: 600 }}>No critical alerts — system is stable</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {unresolvedCriticalAlerts.slice(0, 6).map(alert => (
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
                          {getAlertDisplayMessage(alert)}
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
              <input placeholder="Search message, device, type, code…" value={alertSearch} onChange={e => setAlertSearch(e.target.value)}
                style={{ ...inputStyle(isDark, { paddingLeft: 28, width: 240 }) }} />
            </div>
          </div>

          {/* Alert list */}
            <div style={{ padding: '0 20px 16px' }}>

              {/* ── AI Diagnostics button + results panel ── */}
              <div style={{ padding: '14px 0 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  disabled={diagRunning}
                  onClick={async () => {
                    setDiagRunning(true);
                    setDiagPanelOpen(true);
                    setDiagRunStartedAt(new Date().toISOString());
                    try {
                      const res = await apiService.diagnoseBatch();
                      setDiagResults(res);
                      // Async diagnostics are queued server-side; refresh alerts shortly after queueing
                      // so completed results appear in the list/modal without manual reload.
                      setTimeout(() => { fetchAlerts(); }, 6000);
                      setTimeout(() => { fetchAlerts(); }, 14000);
                    } catch (err: any) {
                      setDiagResults({ queued: 0, skipped: 0, no_api_key: false, results: [] });
                    } finally {
                      setDiagRunning(false);
                    }
                  }}
                  style={{
                    ...btnBase,
                    background: diagRunning
                      ? tok.bgMuted(isDark)
                      : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    color: diagRunning ? sub : 'white',
                    border: diagRunning ? `1px solid ${bdr}` : 'none',
                    opacity: diagRunning ? 0.7 : 1,
                  }}
                >
                  <Brain size={14} className={diagRunning ? 'ota-spinner' : undefined} />
                  {diagRunning ? 'Analysing…' : 'Run AI Diagnostics'}
                </button>
                {diagResults && !diagRunning && (
                  <button onClick={() => setDiagPanelOpen(p => !p)} style={{
                    ...btnBase,
                    background: tok.bgMuted(isDark), color: sub, border: `1px solid ${bdr}`,
                    padding: '6px 12px', fontSize: '0.8rem',
                  }}>
                    {diagPanelOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {diagPanelOpen ? 'Hide' : 'Show'} results ({diagResults.results.length})
                  </button>
                )}
              </div>

              {diagPanelOpen && (
                <div style={{
                  marginBottom: 14,
                  borderRadius: 12,
                  border: `1px solid rgba(99,102,241,0.3)`,
                  background: isDark ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.04)',
                  overflow: 'hidden',
                }}>
                  {/* Panel header */}
                  <div style={{
                    padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    borderBottom: `1px solid rgba(99,102,241,0.2)`,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Brain size={14} color="white" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, color: txt, fontSize: '0.9rem' }}>AI Diagnostic Results</span>
                      {diagResults && (
                        <span style={{ marginLeft: 10, fontSize: '0.75rem', color: sub }}>
                          {diagResults.queued} analysed · {diagResults.skipped} already had results
                        </span>
                      )}
                    </div>
                    <button onClick={() => setDiagPanelOpen(false)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: sub, padding: 4, borderRadius: 4,
                      display: 'flex', alignItems: 'center',
                    }}>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Loading placeholder */}
                  {diagRunning && (
                    <div style={{ padding: '18px 16px', color: sub, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Brain size={16} className="ota-spinner" style={{ color: '#818CF8' }} />
                      Calling AI for each active alert — may take up to 45s per alert…
                    </div>
                  )}

                  {/* Empty state */}
                  {!diagRunning && diagResults && diagResults.results.length === 0 && (
                    <div style={{ padding: '18px 16px', color: sub, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={16} style={{ color: '#10B981' }} />
                      No active alerts with devices found — nothing to diagnose.
                    </div>
                  )}

                  {/* Per-alert diagnostic cards */}
                  {!diagRunning && diagResults && diagResults.results.map((r, idx) => {
                    const diag = r.diagnostic;
                    const sevColor: Record<string, string> = {
                      CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#F59E0B', LOW: '#10B981',
                    };
                    const col = diag ? (sevColor[diag.severity] ?? '#6366F1') : sub;
                    const completedThisRun = Boolean(
                      diag
                      && diag.timestamp
                      && diagRunStartedAt
                      && new Date(diag.timestamp).getTime() >= new Date(diagRunStartedAt).getTime()
                    );
                    return (
                      <div key={r.alert_id} style={{
                        padding: '14px 16px',
                        borderTop: idx === 0 ? 'none' : `1px solid rgba(99,102,241,0.15)`,
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 12, alignItems: 'start',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <code style={{
                              fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700,
                              padding: '2px 8px', borderRadius: 5,
                              background: 'rgba(99,102,241,0.12)', color: '#818CF8',
                              border: '1px solid rgba(99,102,241,0.3)',
                            }}>{r.fault_code}</code>
                            <span style={{ fontSize: '0.8rem', color: sub }}>{r.device_serial ?? '—'}</span>
                            {r.triggered_at && (
                              <span style={{ fontSize: '0.7rem', color: tok.textMuted(isDark) }}>
                                {new Date(r.triggered_at).toLocaleString()}
                              </span>
                            )}
                            {r.queue_status === 'queued' && (
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                background: 'rgba(99,102,241,0.12)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.28)',
                              }}>
                                Queued
                              </span>
                            )}
                            {r.queue_status !== 'queued' && completedThisRun && (
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.28)',
                              }}>
                                Completed This Run
                              </span>
                            )}
                            {r.queue_status === 'done' && !completedThisRun && (
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                background: 'rgba(148,163,184,0.12)', color: '#64748B', border: '1px solid rgba(148,163,184,0.28)',
                              }}>
                                Historical
                              </span>
                            )}
                          </div>
                          {r.queue_status === 'queued' && !diag ? (
                            <div style={{ fontSize: '0.8125rem', color: '#6366F1', fontStyle: 'italic' }}>
                              Diagnostic queued. Results will appear in a few seconds.
                            </div>
                          ) : diag ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ fontSize: '0.875rem', color: txt, lineHeight: 1.55 }}>
                                <span style={{ fontWeight: 600, color: col }}>Root cause: </span>
                                {diag.root_cause}
                              </div>
                              <div style={{ fontSize: '0.8125rem', color: sub, lineHeight: 1.55 }}>
                                <span style={{ fontWeight: 600, color: txt }}>Recommendation: </span>
                                {diag.recommendation}
                              </div>
                              {diag.llm_model && (
                                <div style={{ fontSize: '0.7rem', color: tok.textMuted(isDark), marginTop: 2 }}>
                                  via {diag.llm_model}{diag.call_duration_ms ? ` · ${(diag.call_duration_ms / 1000).toFixed(1)}s` : ''}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.8125rem', color: sub, fontStyle: 'italic' }}>No diagnostic available</div>
                          )}
                        </div>
                        {diag && (
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                            background: `${col}18`, color: col, border: `1px solid ${col}44`,
                            whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2,
                          }}>
                            {diag.severity}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            {filteredAlerts.length === 0 ? (
              <EmptyState title="No alerts" description="No alerts match your current filters." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {paginatedAlerts.map(alert => {
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
                        {/* Diagnostic badge */}
                        {alert.metadata?.diagnostic && (
                          <button
                            onClick={() => setSelectedAlertForDiag(alert.id)}
                            style={{
                              ...btnBase,
                              padding: '4px 8px',
                              borderRadius: 6,
                              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
                              color: '#818CF8',
                              border: '1px solid rgba(99,102,241,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="View diagnostic report"
                          >
                            <Brain size={12} />
                            Diagnostic
                          </button>
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
                        {getAlertDisplayMessage(alert)}
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ padding: '16px 20px', borderTop: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.8125rem', color: sub }}>
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredAlerts.length)} of {filteredAlerts.length} alerts
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.75rem', color: sub }}>Show:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      style={{ ...inputStyle(isDark, { padding: '4px 8px', fontSize: '0.75rem', width: 'auto', minWidth: 60 }) }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    style={{
                      ...btnBase,
                      padding: '6px 12px',
                      background: currentPage === 1 ? tok.bgMuted(isDark) : tok.bgSub(isDark),
                      color: currentPage === 1 ? sub : txt,
                      border: `1px solid ${bdr}`,
                      opacity: currentPage === 1 ? 0.5 : 1,
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ChevronLeft size={14} style={{ marginRight: 4 }} />
                    Previous
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      if (pageNum > totalPages) return null;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          style={{
                            ...btnBase,
                            padding: '6px 10px',
                            minWidth: 36,
                            background: currentPage === pageNum ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : tok.bgMuted(isDark),
                            color: currentPage === pageNum ? 'white' : sub,
                            border: currentPage === pageNum ? 'none' : `1px solid ${bdr}`,
                            fontSize: '0.8125rem',
                            fontWeight: currentPage === pageNum ? 700 : 500,
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      ...btnBase,
                      padding: '6px 12px',
                      background: currentPage === totalPages ? tok.bgMuted(isDark) : tok.bgSub(isDark),
                      color: currentPage === totalPages ? sub : txt,
                      border: `1px solid ${bdr}`,
                      opacity: currentPage === totalPages ? 0.5 : 1,
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next
                    <ChevronRight size={14} style={{ marginLeft: 4 }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ DIAGNOSTIC DETAIL MODAL ══════════════════════ */}
      {selectedAlertForDiag !== null && (() => {
        const alert = paginatedAlerts.find((a: AlertItem) => a.id === selectedAlertForDiag);
        if (!alert || !alert.metadata?.diagnostic) return null;
        const diag = alert.metadata.diagnostic;
        const sevColor: Record<string, string> = {
          CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#F59E0B', LOW: '#10B981',
        };
        const col = sevColor[diag.severity] ?? '#6366F1';
        
        return (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}>
            <div style={{
              borderRadius: 16, background: tok.bgCard(isDark), border: `1px solid ${bdr}`,
              maxWidth: 700, width: '100%', maxHeight: '80vh', overflow: 'auto',
              padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Brain size={20} color="white" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: txt }}>
                      AI Diagnostic Report
                    </h3>
                  </div>
                  {alert.fault_code && (
                    <code style={{
                      fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700,
                      padding: '4px 10px', borderRadius: 6,
                      background: 'rgba(99,102,241,0.12)', color: '#818CF8',
                      border: '1px solid rgba(99,102,241,0.3)', display: 'inline-block',
                    }}>
                      {alert.fault_code}
                    </code>
                  )}
                </div>
                <button
                  onClick={() => setSelectedAlertForDiag(null)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: sub,
                    padding: 8, borderRadius: 6, display: 'flex', alignItems: 'center',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Alert info section */}
              <div style={{
                padding: 16, borderRadius: 12,
                background: tok.bgSub(isDark), border: `1px solid ${bdr}`,
                marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Device
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '0.9375rem', fontWeight: 600, color: txt }}>
                    {alert.device_serial ?? alert.device_id ?? '—'}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Triggered
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '0.9375rem', fontWeight: 600, color: txt }}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Root Cause */}
              <div style={{ marginBottom: 20 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontSize: '0.875rem', fontWeight: 700, color: col, marginBottom: 8,
                }}>
                  <AlertTriangle size={16} />
                  Root Cause
                </span>
                <p style={{
                  margin: 0, fontSize: '0.95rem', color: txt, lineHeight: 1.65,
                  padding: 12, borderRadius: 8, background: `${col}12`, border: `1px solid ${col}30`,
                }}>
                  {diag.root_cause || 'No root cause available'}
                </p>
              </div>

              {/* Recommendation */}
              <div style={{ marginBottom: 20 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontSize: '0.875rem', fontWeight: 700, color: '#10B981', marginBottom: 8,
                }}>
                  <CheckCircle2 size={16} />
                  Recommendation
                </span>
                <p style={{
                  margin: 0, fontSize: '0.95rem', color: txt, lineHeight: 1.65,
                  padding: 12, borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                }}>
                  {diag.recommendation || 'No recommendation available'}
                </p>
              </div>

              {/* Metadata footer */}
              <div style={{
                paddingTop: 16, borderTop: `1px solid ${bdr}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                    background: `${col}18`, color: col, border: `1px solid ${col}44`,
                  }}>
                    {diag.severity || 'UNKNOWN'}
                  </span>
                  {diag.llm_model && (
                    <span style={{ fontSize: '0.75rem', color: tok.textMuted(isDark) }}>
                      via {diag.llm_model}
                    </span>
                  )}
                </div>
                {diag.call_duration_ms && (
                  <span style={{ fontSize: '0.75rem', color: tok.textMuted(isDark) }}>
                    Analysis time: {(diag.call_duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
                    { label: 'Most Frequent', value: mostFrequent ? mostFrequent.fault_code : '—', sub: mostFrequent ? `${mostFrequent.total_occurrences}× — ${normalizeFaultTitle(mostFrequent.fault_code, mostFrequent.title)}` : 'No faults', color: mostFrequent ? SEVERITY_CONFIG[mostFrequent.severity].color : sub, icon: <AlertTriangle size={17} /> },
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
                    {/* Scrollable table wrapper */}
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ minWidth: 730 }}>
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
                            <span style={{ fontSize: '0.875rem', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{normalizeFaultTitle(f.fault_code, f.title)}</span>
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
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                                <div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Reason</div>
                                  <div style={{ fontSize: '0.875rem', color: txt, lineHeight: 1.5 }}>{normalizeFaultReason(f.fault_code, f.reason)}</div>
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
                    </div>{/* end minWidth wrapper */}
                    </div>{/* end overflow wrapper */}
                  </div>
                ) : (
                  <div style={{ ...cardStyle(isDark), padding: '2.5rem', textAlign: 'center', color: sub }}>
                    No faults recorded in the last {lookbackDays} days.
                  </div>
                )}

                {/* ── C. Interactive Timeline Chart ── */}
                {timelineDays.length > 0 && (
                  <div style={{ ...cardStyle(isDark), padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Activity size={17} color="white" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: txt, fontSize: '0.9375rem' }}>Interactive Timeline</div>
                          <div style={{ fontSize: '0.8125rem', color: sub }}>Fault counts per day • {timelineDays.length} days</div>
                        </div>
                      </div>

                      {/* Chart Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* Chart Type Selector */}
                        <div style={{ display: 'flex', gap: 2, background: tok.bgMuted(isDark), padding: 2, borderRadius: 6 }}>
                          {[
                            { type: 'bar' as const, icon: BarChart, label: 'Bar' },
                            { type: 'line' as const, icon: LineChart, label: 'Line' },
                            { type: 'area' as const, icon: AreaChart, label: 'Area' },
                            { type: 'composed' as const, icon: TrendingUp, label: 'Mixed' },
                          ].map(({ type, icon: Icon, label }) => (
                            <button
                              key={type}
                              onClick={() => setChartType(type)}
                              style={{
                                ...btnBase,
                                padding: '6px 10px',
                                background: chartType === type ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'transparent',
                                color: chartType === type ? 'white' : sub,
                                border: 'none',
                                fontSize: '0.75rem',
                                borderRadius: 4,
                              }}
                            >
                              <Icon size={12} /> {label}
                            </button>
                          ))}
                        </div>

                        {/* Severity Filter */}
                        <div style={{ display: 'flex', gap: 2 }}>
                          {(['critical', 'warning', 'info'] as const).map(severity => {
                            const cfg = SEVERITY_CONFIG[severity];
                            const isActive = chartSeverityFilter.has(severity);
                            return (
                              <button
                                key={severity}
                                onClick={() => toggleSeverityFilter(severity)}
                                style={{
                                  ...btnBase,
                                  padding: '4px 8px',
                                  background: isActive ? cfg.bg : tok.bgMuted(isDark),
                                  color: isActive ? cfg.color : sub,
                                  border: `1px solid ${isActive ? cfg.border : bdr}`,
                                  fontSize: '0.7rem',
                                  borderRadius: 4,
                                  opacity: isActive ? 1 : 0.6,
                                }}
                              >
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Additional Controls */}
                        <button
                          onClick={() => setShowBrush(!showBrush)}
                          style={{
                            ...btnBase,
                            padding: '6px 10px',
                            background: showBrush ? 'linear-gradient(135deg, #10B981, #059669)' : tok.bgMuted(isDark),
                            color: showBrush ? 'white' : sub,
                            border: `1px solid ${bdr}`,
                            fontSize: '0.75rem',
                          }}
                        >
                          <Filter size={12} /> Zoom
                        </button>

                        <button
                          onClick={exportChartData}
                          style={{
                            ...btnBase,
                            padding: '6px 10px',
                            background: tok.bgMuted(isDark),
                            color: sub,
                            border: `1px solid ${bdr}`,
                            fontSize: '0.75rem',
                          }}
                        >
                          <Download size={12} /> Export
                        </button>
                      </div>
                    </div>

                    {/* Chart */}
                    <div style={{ padding: '20px', height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        {chartType === 'bar' && (
                          <RechartsBarChart
                            data={getChartData()}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            onMouseMove={handleChartHover}
                            onClick={handleChartHover}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={bdr} />
                            <XAxis
                              dataKey="dateShort"
                              stroke={sub}
                              fontSize={12}
                              tick={{ fill: sub }}
                            />
                            <YAxis stroke={sub} fontSize={12} tick={{ fill: sub }} />
                             <Tooltip
                               contentStyle={{
                                 backgroundColor: tok.bgCard(isDark),
                                 border: `1px solid ${bdr}`,
                                 borderRadius: 12,
                                 color: txt,
                                 padding: '12px 16px',
                                 boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                 backdropFilter: isDark ? 'blur(4px)' : 'none',
                                 WebkitBackdropFilter: isDark ? 'blur(4px)' : 'none',
                               }}
                               labelStyle={{ 
                                 color: txt,
                                 fontWeight: 600,
                                 fontSize: '14px'
                               }}
                                formatter={(value: number | undefined, name: string | undefined) => {
                                  if (value === undefined || name === undefined) return '';
                                  const severityLabel = SEVERITY_CONFIG[name as keyof typeof SEVERITY_CONFIG]?.label || name;
                                  return `${value} faults · ${severityLabel}`;
                                }}
                               labelFormatter={(label) => `Date: ${label}`}
                             />
                            <Legend
                              wrapperStyle={{ color: sub }}
                              iconType="rect"
                            />
                            {selectedChartDay && <ReferenceLine x={selectedChartDay.dateShort} stroke={tok.textSecondary(isDark)} strokeDasharray="4 4" />}
                            {chartSeverityFilter.has('critical') && <Bar dataKey="critical" stackId="a" fill="#EF4444" name="Critical" />}
                            {chartSeverityFilter.has('warning') && <Bar dataKey="warning" stackId="a" fill="#F59E0B" name="Warning" />}
                            {chartSeverityFilter.has('info') && <Bar dataKey="info" stackId="a" fill="#3B82F6" name="Info" />}
                            {showBrush && <Brush dataKey="dateShort" height={30} stroke={tok.textSecondary(isDark)} />}
                          </RechartsBarChart>
                        )}

                        {chartType === 'line' && (
                          <RechartsLineChart
                            data={getChartData()}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            onMouseMove={handleChartHover}
                            onClick={handleChartHover}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={bdr} />
                            <XAxis
                              dataKey="dateShort"
                              stroke={sub}
                              fontSize={12}
                              tick={{ fill: sub }}
                            />
                            <YAxis stroke={sub} fontSize={12} tick={{ fill: sub }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: tok.bgCard(isDark),
                                border: `1px solid ${bdr}`,
                                borderRadius: 8,
                                color: txt,
                              }}
                              labelStyle={{ color: txt }}
                                formatter={(value: number | undefined, name: string | undefined) => {
                                  if (value === undefined || name === undefined) return '';
                                  const severityLabel = SEVERITY_CONFIG[name as keyof typeof SEVERITY_CONFIG]?.label || name;
                                  return `${value} faults · ${severityLabel}`;
                                }}
                              labelFormatter={(label) => `Date: ${label}`}
                            />
                            <Legend wrapperStyle={{ color: sub }} />
                            {selectedChartDay && <ReferenceLine x={selectedChartDay.dateShort} stroke={tok.textSecondary(isDark)} strokeDasharray="4 4" />}
                            {chartSeverityFilter.has('critical') && <Line type="monotone" dataKey="critical" stroke="#EF4444" strokeWidth={2} name="Critical" dot={{ r: 3 }} />}
                            {chartSeverityFilter.has('warning') && <Line type="monotone" dataKey="warning" stroke="#F59E0B" strokeWidth={2} name="Warning" dot={{ r: 3 }} />}
                            {chartSeverityFilter.has('info') && <Line type="monotone" dataKey="info" stroke="#3B82F6" strokeWidth={2} name="Info" dot={{ r: 3 }} />}
                            {showBrush && <Brush dataKey="dateShort" height={30} stroke={tok.textSecondary(isDark)} />}
                          </RechartsLineChart>
                        )}

                        {chartType === 'area' && (
                          <RechartsAreaChart
                            data={getChartData()}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            onMouseMove={handleChartHover}
                            onClick={handleChartHover}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={bdr} />
                            <XAxis
                              dataKey="dateShort"
                              stroke={sub}
                              fontSize={12}
                              tick={{ fill: sub }}
                            />
                            <YAxis stroke={sub} fontSize={12} tick={{ fill: sub }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: tok.bgCard(isDark),
                                border: `1px solid ${bdr}`,
                                borderRadius: 8,
                                color: txt,
                              }}
                              labelStyle={{ color: txt }}
                                formatter={(value: number | undefined, name: string | undefined) => {
                                  if (value === undefined || name === undefined) return '';
                                  const severityLabel = SEVERITY_CONFIG[name as keyof typeof SEVERITY_CONFIG]?.label || name;
                                  return `${value} faults · ${severityLabel}`;
                                }}
                              labelFormatter={(label) => `Date: ${label}`}
                            />
                            <Legend wrapperStyle={{ color: sub }} />
                            {selectedChartDay && <ReferenceLine x={selectedChartDay.dateShort} stroke={tok.textSecondary(isDark)} strokeDasharray="4 4" />}
                            {chartSeverityFilter.has('critical') && <Area type="monotone" dataKey="critical" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} name="Critical" />}
                            {chartSeverityFilter.has('warning') && <Area type="monotone" dataKey="warning" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} name="Warning" />}
                            {chartSeverityFilter.has('info') && <Area type="monotone" dataKey="info" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="Info" />}
                            {showBrush && <Brush dataKey="dateShort" height={30} stroke={tok.textSecondary(isDark)} />}
                          </RechartsAreaChart>
                        )}

                        {chartType === 'composed' && (
                          <ComposedChart
                            data={getChartData()}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            onMouseMove={handleChartHover}
                            onClick={handleChartHover}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={bdr} />
                            <XAxis
                              dataKey="dateShort"
                              stroke={sub}
                              fontSize={12}
                              tick={{ fill: sub }}
                            />
                            <YAxis stroke={sub} fontSize={12} tick={{ fill: sub }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: tok.bgCard(isDark),
                                border: `1px solid ${bdr}`,
                                borderRadius: 8,
                                color: txt,
                              }}
                              labelStyle={{ color: txt }}
                                formatter={(value: number | undefined, name: string | undefined) => {
                                  if (value === undefined || name === undefined) return '';
                                  return [`${value} faults`, name.includes('Line') ? name.replace('Line', '') : name];
                                }}
                              labelFormatter={(label) => `Date: ${label}`}
                            />
                            <Legend wrapperStyle={{ color: sub }} />
                            {selectedChartDay && <ReferenceLine x={selectedChartDay.dateShort} stroke={tok.textSecondary(isDark)} strokeDasharray="4 4" />}
                            {chartSeverityFilter.has('critical') && <Bar dataKey="critical" fill="#EF4444" name="Critical" />}
                            {chartSeverityFilter.has('warning') && <Bar dataKey="warning" fill="#F59E0B" name="Warning" />}
                            {chartSeverityFilter.has('info') && <Bar dataKey="info" fill="#3B82F6" name="Info" />}
                            <Line type="monotone" dataKey="totalLine" stroke="#6366F1" strokeWidth={3} name="Total Trend" dot={false} />
                            {showBrush && <Brush dataKey="dateShort" height={30} stroke={tok.textSecondary(isDark)} />}
                          </ComposedChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                    <div style={{ padding: '18px 20px', borderTop: `1px solid ${bdr}`, background: tok.bgSub(isDark), display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', fontSize: '0.75rem', color: sub }}>
                      <div>
                        {selectedChartDay ? (
                          <div style={{ display: 'grid', gap: 4 }}>
                            <div style={{ fontWeight: 700, color: txt }}>Selected day: {fmtDateShort(selectedChartDay.date)}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                              <span>Critical: <strong>{selectedChartDay.critical}</strong></span>
                              <span>Warning: <strong>{selectedChartDay.warning}</strong></span>
                              <span>Info: <strong>{selectedChartDay.info}</strong></span>
                              <span>Visible total: <strong>{selectedChartDay.visibleTotal}</strong></span>
                              <span>Total actual: <strong>{selectedChartDay.total}</strong></span>
                            </div>
                          </div>
                        ) : (
                          <div>Hover or click a point to inspect that day.</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end', color: sub }}>
                        <div>Visible faults: <strong>{getChartData().reduce((sum, day) => sum + day.visibleTotal, 0)}</strong></div>
                        <div>Peak day: <strong>{(() => {
                          const peak = getChartData().reduce((max, day) => day.visibleTotal > max.visibleTotal ? day : max, getChartData()[0] || { dateShort: '', visibleTotal: 0 });
                          return `${peak.dateShort} (${peak.visibleTotal} faults)`;
                        })()}</strong></div>
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
                                      <span style={{ fontSize: '0.875rem', color: txt, flex: 1 }}>{normalizeFaultTitle(entry.fault_code, entry.title)}</span>
                                      <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: sevCfg.bg, color: sevCfg.color, border: `1px solid ${sevCfg.border}` }}>{sevCfg.label}</span>
                                    </button>
                                    {isExp && (
                                      <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div>
                                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Reason</div>
                                          <div style={{ fontSize: '0.875rem', color: txt, lineHeight: 1.5 }}>{normalizeFaultReason(entry.fault_code, entry.reason)}</div>
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
