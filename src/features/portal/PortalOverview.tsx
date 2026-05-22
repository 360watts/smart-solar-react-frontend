import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, Zap, Sun, RefreshCw, Battery, Activity } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import SiteDataPanel from '../../shared/components/SiteDataPanel';

interface PortalSummary {
  profile: {
    first_name: string;
    last_name: string;
    plan_type: string;
    plan_features: { can_access_ai: boolean; can_view_history_90d: boolean };
  };
  sites: Array<{
    site_id: string;
    display_name: string;
    capacity_kw: number;
    inverter_capacity_kw: number | null;
    site_status: string;
    devices: Array<{ device_serial: string; is_online: boolean }>;
  }>;
  active_alert_count: number;
}

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(target * ease);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

interface KpiProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accentColor: string;
  delay?: number;
  isDark: boolean;
}

const KpiCard: React.FC<KpiProps> = ({ icon, label, value, sub, accentColor, delay = 0, isDark }) => (
  <div
    className="portal-fade-in"
    style={{
      animationDelay: `${delay}ms`,
      background: isDark ? 'linear-gradient(145deg, #0F1623 0%, #0D1320 100%)' : 'rgba(255,255,255,0.9)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
      borderTop: `2px solid ${accentColor}`,
      borderRadius: 14,
      padding: '20px 20px 18px',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div style={{
      position: 'absolute', top: -20, right: -20,
      width: 80, height: 80, borderRadius: '50%',
      background: `radial-gradient(circle, ${accentColor}18 0%, transparent 70%)`,
      pointerEvents: 'none',
    }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${accentColor}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accentColor,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: isDark ? '#8892A4' : '#64748B', letterSpacing: '0.03em', textTransform: 'uppercase' as const }}>
        {label}
      </span>
    </div>
    <div style={{ fontSize: 24, fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: isDark ? '#F0F4FF' : '#0A0E1A', lineHeight: 1 }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 12, color: isDark ? '#4A5568' : '#94A3B8', marginTop: 5 }}>{sub}</div>}
  </div>
);

const PortalOverview: React.FC = () => {
  const { isDark } = useTheme();
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeSite = summary?.sites.find(s => s.site_id === selectedSiteId) ?? summary?.sites[0];
  const capacityCount = useCountUp(activeSite?.capacity_kw ?? 0, 1000);

  const text    = isDark ? '#F0F4FF' : '#0A0E1A';
  const muted   = isDark ? '#8892A4' : '#64748B';
  const surface = isDark ? '#0F1623'  : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiService.getPortalSummary() as PortalSummary;
      setSummary(data);
      if (data.sites.length > 0 && !selectedSiteId) setSelectedSiteId(data.sites[0].site_id);
    } catch (e: any) {
      setError(e?.message || 'Failed to load portal data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 16px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            border: '3px solid rgba(245,158,11,0.15)',
            borderTop: '3px solid #F59E0B',
            animation: 'portal-spin 1s linear infinite',
          }} />
          <Zap size={20} color="#F59E0B" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        </div>
        <p style={{ color: muted, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading your solar data…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{
      padding: '20px 24px', borderRadius: 14,
      background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
      color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <AlertTriangle size={18} />
      <span style={{ flex: 1, fontSize: 14 }}>{error}</span>
      <button onClick={load} style={{ fontSize: 13, fontWeight: 600, color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
    </div>
  );

  if (!summary || summary.sites.length === 0) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px', background: 'rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sun size={32} color="#F59E0B" />
      </div>
      <p style={{ fontSize: 18, fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: text, marginBottom: 8 }}>No active sites yet</p>
      <p style={{ fontSize: 14, color: muted }}>Your solar site will appear here once it's commissioned.</p>
    </div>
  );

  const site = activeSite!;
  const onlineDevices = site.devices.filter(d => d.is_online).length;
  const totalDevices  = site.devices.length;
  const statusColor   = site.site_status === 'active' ? '#34D399' : '#F59E0B';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div className="portal-fade-in" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 28,
            color: text, margin: 0, letterSpacing: '-0.02em',
            ...(isDark ? {
              background: 'linear-gradient(135deg, #F0F4FF 30%, #F59E0B 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            } : {}),
          }}>
            Welcome back{summary.profile.first_name ? `, ${summary.profile.first_name}` : ''} ☀️
          </h1>
          <p style={{ fontSize: 14, color: muted, marginTop: 6 }}>
            {site.display_name} · {site.capacity_kw} kWp installed
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {summary.active_alert_count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(251,191,36,0.1)', color: '#FBBF24', fontSize: 13, fontWeight: 600, border: '1px solid rgba(251,191,36,0.2)' }}>
              <AlertTriangle size={13} />
              {summary.active_alert_count} alert{summary.active_alert_count !== 1 ? 's' : ''}
            </div>
          )}
          <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(52,211,153,0.1)', color: '#34D399', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', border: '1px solid rgba(52,211,153,0.2)' }}>
            {summary.profile.plan_type}
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: `1px solid ${border}`, background: surface, color: muted, cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Site selector */}
      {summary.sites.length > 1 && (
        <div className="portal-fade-in" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {summary.sites.map(s => (
            <button key={s.site_id} onClick={() => setSelectedSiteId(s.site_id)} style={{
              padding: '8px 18px', borderRadius: 10,
              border: s.site_id === selectedSiteId ? '1px solid #F59E0B' : `1px solid ${border}`,
              background: s.site_id === selectedSiteId ? 'rgba(245,158,11,0.12)' : surface,
              color: s.site_id === selectedSiteId ? '#F59E0B' : muted,
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif", transition: 'all 0.18s ease',
            }}>
              {s.display_name}
            </button>
          ))}
        </div>
      )}

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        <KpiCard icon={<Zap size={15} />} label="Capacity" value={`${capacityCount.toFixed(2)} kWp`} sub="Installed solar panels" accentColor="#F59E0B" delay={0} isDark={isDark} />
        <KpiCard icon={<Activity size={15} />} label="Status" value={site.site_status.charAt(0).toUpperCase() + site.site_status.slice(1)} sub={`System ${site.site_status}`} accentColor={statusColor} delay={60} isDark={isDark} />
        <KpiCard icon={<Battery size={15} />} label="Devices" value={`${onlineDevices} / ${totalDevices}`} sub={onlineDevices === totalDevices ? 'All online' : `${totalDevices - onlineDevices} offline`} accentColor={onlineDevices === totalDevices ? '#34D399' : '#F87171'} delay={120} isDark={isDark} />
        <KpiCard icon={<AlertTriangle size={15} />} label="Active Alerts" value={String(summary.active_alert_count)} sub={summary.active_alert_count === 0 ? 'System healthy' : 'Needs attention'} accentColor={summary.active_alert_count > 0 ? '#FBBF24' : '#34D399'} delay={180} isDark={isDark} />
      </div>

      {/* Live separator */}
      <div className="portal-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#34D399', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', animation: 'portal-pulse-ring 2s ease-out infinite', display: 'inline-block', boxShadow: '0 0 8px #34D399' }} />
          Live Data
        </div>
        <div style={{ flex: 1, height: 1, background: border }} />
      </div>

      {/* Site data panel */}
      <div className="portal-fade-in" style={{ borderRadius: 16, border: `1px solid ${border}`, overflow: 'hidden', background: surface, padding: '0 20px 20px' }}>
        <SiteDataPanel siteId={selectedSiteId ?? site.site_id} autoRefresh inverterCapacityKw={site.inverter_capacity_kw} />
      </div>
    </div>
  );
};

export default PortalOverview;
