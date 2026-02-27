import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  AreaChart, Area,
} from 'recharts';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { CHART_COLORS } from '../constants';
import { AnimatedNumber } from './AnimatedNumber';
import { StatusPill } from './StatusPill';
interface TelemetryData {
  deviceId: string;
  timestamp: string;
  data_type: string;
  value: number;
  unit: string;
  quality: string;
}
interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  device_id: string;
  timestamp: string;
  resolved: boolean;
}
interface KPIs {
  total_energy_generated: number;
  average_voltage: number;
  average_current: number;
  system_efficiency: number;
  data_points_last_24h: number;
  active_devices_24h: number;
}
interface SystemHealth {
  total_devices: number;
  active_devices: number;
  total_telemetry_points: number;
  uptime_seconds: number;
  database_status: string;
  mqtt_status: string;
  overall_health: string;
}

const IconBolt = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);
const IconGauge = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 11-4.93 18.72M12 12l-3.5-3.5"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
  </svg>
);
const IconDevices = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path strokeLinecap="round" d="M8 21h8M12 17v4"/>
  </svg>
);
const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconTrend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);
const IconSun = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F07522" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ filter: 'drop-shadow(0 0 6px rgba(240,117,34,0.8)) drop-shadow(0 0 14px rgba(251,191,36,0.5))' }}>
    <circle cx="12" cy="12" r="5" fill="#FFD600" stroke="#F07522" strokeWidth="1.5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

// CHART_COLORS imported from constants.ts

const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(0,166,62,0.15)',
  borderRadius: 10,
  color: '#0a0a0a',
  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
  fontSize: 12,
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [telemetryData, setTelemetryData] = useState<TelemetryData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [userDevices, setUserDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'activity' | 'health'>('overview');
  const fetchDashboardData = useCallback(async () => {
    try {
      const promises: Promise<any>[] = [
        apiService.getTelemetry(),
        apiService.getAlerts(),
        apiService.getKPIs(),
        apiService.getSystemHealth(),
      ];
      if (user && !user.is_staff) promises.push(apiService.getUserDevices(user.id));
      const results = await Promise.all(promises);
      setTelemetryData(results[0]);
      setAlerts(results[1]);
      setKpis(results[2]);
      setSystemHealth(results[3]);
      if (results[4]) setUserDevices(results[4]);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const latestValues = useMemo(() => {
    const map: { [k: string]: TelemetryData } = {};
    telemetryData.forEach(item => {
      if (!map[item.data_type] || new Date(item.timestamp) > new Date(map[item.data_type].timestamp))
        map[item.data_type] = item;
    });
    return Object.values(map);
  }, [telemetryData]);

  const chartData = useMemo(() => {
    const map: { [k: string]: any } = {};
    telemetryData.forEach(item => {
      const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (!map[time]) map[time] = { time };
      map[time][item.data_type] = item.value;
    });
    return Object.values(map).slice(-20);
  }, [telemetryData]);

  const sparklineData = useMemo(() => {
    const energyPoints = telemetryData
      .filter(d => d.data_type.toLowerCase().includes('energy') || d.data_type.toLowerCase().includes('power'))
      .slice(-12)
      .map((d, i) => ({ i, v: d.value }));
    return energyPoints.length === 0 ? Array.from({ length: 8 }, (_, i) => ({ i, v: 0 })) : energyPoints;
  }, [telemetryData]);

  const deviceStatusData = useMemo(() => systemHealth ? [
    { name: 'Active',   value: systemHealth.active_devices,                              color: '#00a63e' },
    { name: 'Inactive', value: systemHealth.total_devices - systemHealth.active_devices, color: '#e5e7eb' },
  ] : [], [systemHealth]);

  const alertSeverityData = useMemo(() => [
    { name: 'Critical', value: alerts.filter(a => a.severity === 'critical').length, color: '#ef4444' },
    { name: 'Warning',  value: alerts.filter(a => a.severity === 'warning').length,  color: '#f59e0b' },
    { name: 'Info',     value: alerts.filter(a => a.severity === 'info').length,     color: '#3b82f6' },
  ], [alerts]);

  const unresolvedAlerts = useMemo(() => alerts.filter(a => !a.resolved), [alerts]);
  const hasCritical = useMemo(() => unresolvedAlerts.some(a => a.severity === 'critical'), [unresolvedAlerts]);

  if (loading) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <div className="skeleton" style={{ height: '1.8rem', width: '220px', marginBottom: '1.5rem' }} />
        <div className="bento-grid">
          <div className="card bento-hero" style={{ padding: '1.25rem' }}>
            <div className="skeleton" style={{ height: '160px' }} />
          </div>
          <div className="card bento-side" style={{ padding: '1.25rem' }}>
            <div className="skeleton" style={{ height: '160px' }} />
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card bento-1x1" style={{ padding: '1.25rem' }}>
              <div className="skeleton" style={{ height: '0.7rem', width: '50%', marginBottom: '0.75rem' }} />
              <div className="skeleton" style={{ height: '2.2rem', width: '60%', marginBottom: '0.5rem' }} />
              <div className="skeleton" style={{ height: '0.7rem', width: '35%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', margin: '1.5rem' }}>
      Failed to load dashboard — {error}
    </div>
  );

  return (
    <div style={{ padding: '1.5rem' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontFamily: 'Urbanist, Poppins, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', color: '#0a0a0a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <IconSun />
            Solar Dashboard
          </h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>
            Live monitoring &mdash; auto-refreshes every 30s
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.9rem', background: 'rgba(0,166,62,0.07)', borderRadius: 999, border: '1px solid rgba(0,166,62,0.15)' }}>
          <span className="status-dot status-dot--pulse" style={{ background: '#00a63e', color: '#00a63e' }} />
          <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#007a55', fontFamily: 'Poppins, sans-serif', letterSpacing: '0.04em' }}>LIVE</span>
        </div>
      </div>

      {/* Modern Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        borderBottom: '2px solid var(--border-color)',
        paddingBottom: '0'
      }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: activeTab === 'overview' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'overview' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'overview' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          Overview
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            background: activeTab === 'analytics' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'analytics' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'analytics' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <IconTrend />
          Analytics
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          style={{
            background: activeTab === 'activity' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'activity' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'activity' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <IconBolt />
          Activity
        </button>
        <button
          onClick={() => setActiveTab('health')}
          style={{
            background: activeTab === 'health' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'health' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'health' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <IconDevices />
          System Health
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════
          OVERVIEW TAB — Hero card + KPIs + Live Readings
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
        <div className="bento-grid">
        {/* ── HERO: Energy Generated ── */}
        <div className="card bento-hero" style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #007a55 0%, #00a63e 55%, #4ade80 100%)',
          border: 'none',
          boxShadow: '0 12px 40px rgba(0,166,62,0.28), 0 2px 8px rgba(0,0,0,0.08)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Background orb */}
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, left: '30%', width: 260, height: 260,
            borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <IconSun />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', fontFamily: 'Poppins, sans-serif' }}>
                  Energy Generated
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'Poppins, sans-serif' }}>Last 24 hours</span>
            </div>

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: '#fff', marginBottom: '0.25rem', letterSpacing: '-0.03em' }}>
              {kpis ? <AnimatedNumber value={kpis.total_energy_generated} decimals={2} /> : '—'}
              <span style={{ fontSize: '1.2rem', fontWeight: 500, marginLeft: '0.3rem', color: 'rgba(255,255,255,0.75)' }}>kWh</span>
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins, sans-serif' }}>
              {kpis && kpis.system_efficiency >= 80 ? '↑ Above target efficiency' : kpis ? '↓ Below target efficiency' : 'Collecting data…'}
            </p>

            {/* Inline sparkline area chart */}
            <div style={{ height: 72, marginLeft: '-0.25rem', marginRight: '-0.25rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#fff" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="rgba(255,255,255,0.9)" strokeWidth={2}
                    fill="url(#sparkGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom stat pills */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {kpis && (
                <>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '0.2rem 0.65rem', fontFamily: 'Poppins, sans-serif' }}>
                    Eff: {kpis.system_efficiency.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '0.2rem 0.65rem', fontFamily: 'Poppins, sans-serif' }}>
                    {kpis.average_voltage.toFixed(1)} V avg
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '0.2rem 0.65rem', fontFamily: 'Poppins, sans-serif' }}>
                    {kpis.average_current.toFixed(2)} A avg
                  </span>
                </>
              )}
              {systemHealth && (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '0.2rem 0.65rem', fontFamily: 'Poppins, sans-serif' }}>
                  {systemHealth.active_devices}/{systemHealth.total_devices} devices active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── SIDE: Active Alerts panel ── */}
        <div className="card bento-side" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>Active Alerts</span>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: hasCritical ? 'rgba(239,68,68,0.1)' : unresolvedAlerts.length > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasCritical ? '#ef4444' : unresolvedAlerts.length > 0 ? '#f59e0b' : '#10b981', flexShrink: 0 }}>
              <IconAlert />
            </span>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2.8rem', fontWeight: 800, lineHeight: 1, color: hasCritical ? '#ef4444' : unresolvedAlerts.length > 0 ? '#f59e0b' : '#00a63e', marginBottom: '0.25rem' }}>
            <AnimatedNumber value={unresolvedAlerts.length} decimals={0} />
          </div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>
            {unresolvedAlerts.length === 0 ? 'All systems clear' : 'require attention'}
          </p>
          {unresolvedAlerts.length === 0
            ? <StatusPill status="online" label="All clear" pulse />
            : <StatusPill status={hasCritical ? 'critical' : 'warning'} label={hasCritical ? 'Critical alerts' : 'Warnings active'} />
          }
          {/* Top alerts list */}
          {unresolvedAlerts.length > 0 && (
            <div style={{ marginTop: '0.85rem', flex: 1, overflow: 'hidden' }}>
              {unresolvedAlerts.slice(0, 3).map((a, i) => (
                <div key={i} style={{ fontSize: '0.72rem', color: '#4a5565', padding: '0.35rem 0', borderBottom: '1px solid rgba(0,166,62,0.06)', fontFamily: 'Poppins, sans-serif', lineHeight: 1.4, display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.severity === 'critical' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#3b82f6', flexShrink: 0, marginTop: 4 }} />
                  {a.message.length > 42 ? a.message.slice(0, 42) + '…' : a.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW 2 — 4 equal KPI cards
          ══════════════════════════════════════════════════════════ */}
      <div className="bento-grid">

        {/* Efficiency */}
        <div className="card bento-1x1" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Efficiency</span>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(240,117,34,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F07522', flexShrink: 0 }}>
              <IconGauge />
            </span>
          </div>
          <p style={{ margin: '0.45rem 0 0.1rem', fontSize: '2rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#0a0a0a' }}>
            {kpis ? <AnimatedNumber value={kpis.system_efficiency} decimals={1} suffix="%" /> : '—'}
          </p>
          <p className="kpi-sub">System performance</p>
          {kpis && (
            <span className={`kpi-delta ${kpis.system_efficiency >= 80 ? 'kpi-delta--up' : 'kpi-delta--down'}`} style={{ marginTop: '0.4rem', display: 'inline-flex' }}>
              {kpis.system_efficiency >= 80 ? '↑ On target' : '↓ Below target'}
            </span>
          )}
        </div>

        {/* Devices */}
        <div className="card bento-1x1" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Devices</span>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
              <IconDevices />
            </span>
          </div>
          <p style={{ margin: '0.45rem 0 0.1rem', fontSize: '2rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#0a0a0a' }}>
            {systemHealth ? (
              <>
                <AnimatedNumber value={systemHealth.active_devices} decimals={0} />
                <span style={{ fontSize: '1rem', color: '#9ca3af', fontWeight: 400 }}>/{systemHealth.total_devices}</span>
              </>
            ) : '—'}
          </p>
          <p className="kpi-sub">Active / Total</p>
          {systemHealth && <StatusPill status={systemHealth.overall_health === 'healthy' ? 'online' : 'warning'} label={systemHealth.overall_health} pulse />}
        </div>

        {/* Voltage */}
        <div className="card bento-1x1" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Avg Voltage</span>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6', flexShrink: 0 }}>
              <IconBolt />
            </span>
          </div>
          <p style={{ margin: '0.45rem 0 0.1rem', fontSize: '2rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#0a0a0a' }}>
            {kpis ? <AnimatedNumber value={kpis.average_voltage} decimals={1} suffix=" V" /> : '—'}
          </p>
          <p className="kpi-sub">24h average</p>
          {kpis && <div className="power-bar" style={{ marginTop: '0.5rem' }}><div className="power-bar-fill" style={{ width: `${Math.min((kpis.average_voltage / 250) * 100, 100)}%`, background: '#8b5cf6' }} /></div>}
        </div>

        {/* Data Points */}
        <div className="card bento-1x1" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Data Points</span>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
              <IconTrend />
            </span>
          </div>
          <p style={{ margin: '0.45rem 0 0.1rem', fontSize: '2rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#0a0a0a' }}>
            {kpis ? <AnimatedNumber value={kpis.data_points_last_24h} decimals={0} /> : systemHealth ? <AnimatedNumber value={systemHealth.total_telemetry_points} decimals={0} /> : '—'}
          </p>
          <p className="kpi-sub">Last 24 hours</p>
          {systemHealth && (
            <span style={{ marginTop: '0.35rem', fontSize: '0.7rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontFamily: 'Poppins, sans-serif' }}>
              Uptime: {formatUptime(systemHealth.uptime_seconds)}
            </span>
          )}
        </div>
      </div>

      {/* ── Live readings ── */}
      {latestValues.length > 0 && (
        <>
          <p className="dash-section-label">Live Readings</p>
          <div className="bento-grid">
            {latestValues.map((item) => (
              <div key={item.data_type} className="card bento-1x1" style={{ padding: '1.1rem' }}>
                <span className="kpi-label">{item.data_type.replace(/_/g, ' ')}</span>
                <p className="metric-value" style={{ margin: '0.35rem 0 0.1rem', fontSize: '1.5rem', fontWeight: 700 }}>
                  <AnimatedNumber value={item.value} decimals={2} suffix={` ${item.unit}`} />
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                  <StatusPill status={item.quality === 'good' ? 'online' : 'warning'} label={item.quality} pulse={item.quality === 'good'} />
                  <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ANALYTICS TAB — Charts and trends
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <>
          <div className="bento-grid">
            <div className="card bento-hero" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ color: '#00a63e' }}><IconTrend /></span>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontFamily: 'Urbanist, sans-serif', color: '#0a0a0a' }}>Real-time Trends</h3>
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,166,62,0.08)" />
                    <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    {latestValues.map((item, i) => (
                      <Line key={item.data_type} type="monotone" dataKey={item.data_type}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card bento-side" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontFamily: 'Urbanist, sans-serif', color: '#0a0a0a' }}>Device Status</h3>
              <div style={{ height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deviceStatusData} cx="50%" cy="50%" outerRadius={72} innerRadius={38}
                      dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {deviceStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {systemHealth && (
                <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.75rem', background: 'rgba(0,166,62,0.05)', borderRadius: 8, border: '1px solid rgba(0,166,62,0.1)' }}>
                  <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>Overall Health</p>
                  <div style={{ marginTop: '0.3rem' }}><StatusPill status={systemHealth.overall_health === 'healthy' ? 'online' : 'warning'} label={systemHealth.overall_health} pulse /></div>
                </div>
              )}
            </div>
          </div>

          {(alerts.length > 0 || systemHealth) && (
            <div className="bento-grid">
              {alerts.length > 0 && (
                <div className="card bento-2x1" style={{ padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontFamily: 'Urbanist, sans-serif', color: '#0a0a0a' }}>Alert Distribution</h3>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={alertSeverityData} barSize={36}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,166,62,0.07)" vertical={false} />
                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                        <YAxis stroke="#9ca3af" fontSize={11} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {alertSeverityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ACTIVITY TAB — Recent telemetry and alerts
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <div className="bento-grid">
          <div className="card bento-2x1" style={{ padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontFamily: 'Urbanist, sans-serif', color: '#0a0a0a' }}>Recent Telemetry</h3>
            <div className="activity-list">
              {telemetryData.length === 0
                ? <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem', padding: '1rem 0' }}>No telemetry yet</p>
                : telemetryData.slice(0, 6).map((item, i) => (
                  <div key={i} className="activity-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,166,62,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#00a63e' }}>
                      <IconBolt />
                    </span>
                    <span className="activity-text" style={{ flex: 1, fontSize: '0.82rem', color: '#4a5565' }}>
                      <strong style={{ color: '#0a0a0a' }}>{item.data_type}</strong> &mdash; {item.value.toFixed(2)} {item.unit}
                    </span>
                    <span className="activity-time" style={{ fontSize: '0.7rem', color: '#9ca3af', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>

          <div className="card bento-2x1" style={{ padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontFamily: 'Urbanist, sans-serif', color: '#0a0a0a' }}>Recent Alerts</h3>
            <div className="activity-list">
              {alerts.length === 0
                ? <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem', padding: '1rem 0' }}>No alerts — all clear</p>
                : alerts.slice(0, 6).map((alert, i) => (
                  <div key={i} className="activity-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: alert.severity === 'critical' ? 'rgba(239,68,68,0.1)' : alert.severity === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                      color: alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6',
                    }}>
                      <IconAlert />
                    </span>
                    <span className="activity-text" style={{ flex: 1, fontSize: '0.82rem', color: '#4a5565' }}>
                      {alert.message.length > 48 ? alert.message.slice(0, 48) + '…' : alert.message}
                    </span>
                    <StatusPill status={alert.severity} />
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          HEALTH TAB — System health and devices
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'health' && (
        <>
          {systemHealth && (
            <div className="bento-grid">
              <div className="card bento-2x1" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontFamily: 'Urbanist, sans-serif', color: '#0a0a0a' }}>System Health</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { label: 'Database',    value: systemHealth.database_status,                        isStatus: true  },
                    { label: 'MQTT',        value: systemHealth.mqtt_status,                            isStatus: true  },
                    { label: 'Uptime',      value: formatUptime(systemHealth.uptime_seconds),           isStatus: false },
                    { label: 'Data Points', value: systemHealth.total_telemetry_points.toLocaleString(), isStatus: false },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '0.75rem', background: 'rgba(0,166,62,0.04)', borderRadius: 10, border: '1px solid rgba(0,166,62,0.08)' }}>
                      <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', fontFamily: 'Poppins, sans-serif' }}>{item.label}</p>
                      {item.isStatus
                        ? <div style={{ marginTop: '0.35rem' }}><StatusPill status={item.value === 'connected' || item.value === 'healthy' ? 'online' : 'warning'} label={item.value} /></div>
                        : <p style={{ margin: '0.3rem 0 0', fontSize: '0.88rem', fontWeight: 600, color: '#0a0a0a', fontFamily: 'JetBrains Mono, monospace' }}>{item.value}</p>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* My Devices (non-staff) */}
          {user && !user.is_staff && userDevices.length > 0 && (
            <>
              <p className="dash-section-label" style={{ marginTop: '1rem' }}>My Devices</p>
              <div className="card" style={{ padding: '1.25rem' }}>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr><th>Device Serial</th><th>Config Version</th><th>Provisioned</th></tr>
                  </thead>
                  <tbody>
                    {userDevices.map(device => (
                      <tr key={device.id}>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>{device.device_serial}</td>
                        <td>{device.config_version || '—'}</td>
                        <td>{device.provisioned_at ? new Date(device.provisioned_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

    </div>
  );
};

export default Dashboard;
