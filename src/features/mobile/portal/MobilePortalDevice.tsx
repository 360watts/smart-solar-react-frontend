import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Clock, Cpu, MapPin, Radio, RefreshCw,
  Signal, Thermometer, Wifi, WifiOff, Zap,
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { apiService } from '../../../services/api';
import { getDesignTokens } from '../../../shared/theme';

/* ─── Types ────────────────────────────────────────────────────────────── */
interface DeviceItem {
  id: number;
  device_serial: string;
  is_online: boolean;
  last_seen_at?: string;
  connectivity_type?: string;
  signal_strength_dbm?: number | null;
  device_temp_c?: number | null;
  site_id?: string;
  site_name?: string;
  heartbeat_health?: { severity: 'ok' | 'warn' | 'critical' };
}

interface PortalSite {
  site_id: string;
  display_name: string;
  capacity_kw: number;
  devices: Array<{ device_id: number; device_serial: string; is_online: boolean; last_seen_at?: string }>;
  gateway_device: {
    device_id: number; device_serial: string; is_online: boolean; last_seen_at?: string;
    connectivity_type?: string; signal_strength_dbm?: number | null;
    device_temp_c?: number | null; heartbeat_health?: { severity: 'ok' | 'warn' | 'critical' };
  } | null;
}

const lastSeenText = (dateStr?: string): string => {
  if (!dateStr) return 'Unknown';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

/* ─── Signal ring SVG ─────────────────────────────────────────────────── */
const SignalRing: React.FC<{ dbm: number | null; isOnline: boolean; isDark: boolean }> = ({ dbm, isOnline, isDark }) => {
  const green = '#2FBF71';
  const amber = '#E9B949';
  const danger = '#EF4444';
  const color = !isOnline ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)')
    : dbm == null ? (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)')
    : dbm >= -70 ? green
    : dbm >= -85 ? amber
    : danger;

  const strength = dbm == null ? 0 : Math.max(0, Math.min(1, (dbm + 100) / 30));
  const R = 38;
  const circ = 2 * Math.PI * R;

  return (
    <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        <defs>
          <radialGradient id="device-orb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity={isOnline ? '0.18' : '0.06'} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <filter id="device-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="48" cy="48" r="44" fill="url(#device-orb)" />
        <circle cx="48" cy="48" r={R} fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
          strokeWidth="5" />
        {isOnline && strength > 0 && (
          <circle cx="48" cy="48" r={R} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${strength * circ} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            filter="url(#device-glow)"
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', display: 'grid', placeItems: 'center' }}>
          {isOnline ? <Wifi size={18} color={color} /> : <WifiOff size={18} color={color} />}
        </div>
      </div>
    </div>
  );
};

/* ─── Device card ────────────────────────────────────────────────────── */
const DeviceCard: React.FC<{
  device: DeviceItem; isDark: boolean; delay: number;
}> = ({ device, isDark, delay }) => {
  const green   = '#2FBF71';
  const amber   = '#E9B949';
  const danger  = '#EF4444';
  const textPrimary = isDark ? '#F0F7F2' : '#0D2318';
  const textMuted   = isDark ? 'rgba(240,247,242,0.45)' : 'rgba(13,35,24,0.45)';
  const cardBg     = isDark ? 'rgba(12,22,16,0.95)' : 'rgba(255,255,255,0.95)';
  const cardBorder = isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.2)';
  const divider    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const health = device.heartbeat_health?.severity ?? 'ok';
  const healthColor = health === 'ok' ? green : health === 'warn' ? amber : danger;

  const stats: Array<{ icon: React.ReactNode; label: string; value: string; color?: string }> = [
    {
      icon: <Clock size={13} />,
      label: 'Last seen',
      value: lastSeenText(device.last_seen_at ?? device.last_heartbeat),
    },
    {
      icon: <Signal size={13} />,
      label: 'Signal',
      value: device.signal_strength_dbm != null ? `${device.signal_strength_dbm} dBm` : '—',
      color: device.signal_strength_dbm != null
        ? device.signal_strength_dbm >= -70 ? green : device.signal_strength_dbm >= -85 ? amber : danger
        : undefined,
    },
    {
      icon: <Thermometer size={13} />,
      label: 'Temperature',
      value: device.device_temp_c != null ? `${device.device_temp_c.toFixed(1)}°C` : '—',
      color: device.device_temp_c != null && device.device_temp_c > 55 ? danger : undefined,
    },
    {
      icon: <Radio size={13} />,
      label: 'Connectivity',
      value: device.connectivity_type ?? '—',
    },
  ];

  return (
    <article style={{
      opacity: 1,
      animation: `portal-fade-up 0.45s ${delay}ms ease both`,
      background: cardBg,
      border: `1px solid ${device.is_online ? cardBorder : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
      borderRadius: 24, padding: 18, overflow: 'hidden',
    }}>
      {/* Top row: ring + identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <SignalRing dbm={device.signal_strength_dbm ?? null} isOnline={device.is_online} isDark={isDark} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 18, color: textPrimary, lineHeight: 1.2 }}>
              {device.site_name ?? 'Solar Device'}
            </span>
            <span style={{
              padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: device.is_online ? (isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.1)') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
              color: device.is_online ? green : textMuted,
            }}>
              {device.is_online ? 'Online' : 'Offline'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: textMuted, marginTop: 5, fontFamily: 'monospace', letterSpacing: '0.04em' }}>
            {device.device_serial}
          </div>
          {device.site_id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, color: textMuted, fontSize: 12 }}>
              <MapPin size={11} />
              <span>{device.site_id}</span>
            </div>
          )}

        </div>
      </div>

      {/* Health badge */}
      {health !== 'ok' && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 14,
          background: `rgba(${health === 'warn' ? '233,185,73' : '239,68,68'},0.1)`,
          border: `1px solid rgba(${health === 'warn' ? '233,185,73' : '239,68,68'},0.25)`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Activity size={14} color={healthColor} />
          <span style={{ fontSize: 13, fontWeight: 600, color: healthColor }}>
            {health === 'warn' ? 'Heartbeat delayed — check device connectivity' : 'Critical heartbeat failure detected'}
          </span>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: divider, margin: '16px 0' }} />

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {stats.map(stat => (
          <div key={stat.label} style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            borderRadius: 14, padding: '12px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {stat.icon}
              {stat.label}
            </div>
            <div style={{ marginTop: 6, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: stat.color ?? textPrimary }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
};

/* ─── Main component ─────────────────────────────────────────────────── */
const MobilePortalDevice: React.FC = () => {
  const { isDark } = useTheme();
  const T = getDesignTokens(isDark);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const cardBg     = isDark ? 'rgba(12,22,16,0.95)' : 'rgba(255,255,255,0.95)';
  const cardBorder = isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.2)';
  const textPrimary = isDark ? '#F0F7F2' : '#0D2318';
  const textMuted   = isDark ? 'rgba(240,247,242,0.45)' : 'rgba(13,35,24,0.45)';
  const green  = '#2FBF71';
  const amber  = '#E9B949';
  const danger = '#EF4444';

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const summary = await apiService.getPortalSummary() as { sites: PortalSite[] };
      // Flatten: one DeviceItem per site, using gateway_device for rich telemetry
      // and falling back to the devices[] array entries for sites with no gateway
      const items: DeviceItem[] = (summary.sites ?? []).flatMap(site => {
        if (site.gateway_device) {
          return [{
            id: site.gateway_device.device_id,
            device_serial: site.gateway_device.device_serial,
            is_online: site.gateway_device.is_online,
            last_seen_at: site.gateway_device.last_seen_at,
            connectivity_type: site.gateway_device.connectivity_type,
            signal_strength_dbm: site.gateway_device.signal_strength_dbm,
            device_temp_c: site.gateway_device.device_temp_c,
            heartbeat_health: site.gateway_device.heartbeat_health,
            site_id: site.site_id,
            site_name: site.display_name,
          }];
        }
        return site.devices.map(d => ({
          id: d.device_id,
          device_serial: d.device_serial,
          is_online: d.is_online,
          last_seen_at: d.last_seen_at,
          site_id: site.site_id,
          site_name: site.display_name,
        }));
      });
      setDevices(items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load devices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); setTimeout(() => setMounted(true), 60); }, []);

  const onlineCount  = useMemo(() => devices.filter(d => d.is_online).length, [devices]);
  const offlineCount = devices.length - onlineCount;
  const healthIssues = useMemo(() => devices.filter(d => d.heartbeat_health?.severity !== 'ok' && d.heartbeat_health?.severity != null).length, [devices]);

  const fadeStyle = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.45s ${delay}ms ease, transform 0.45s ${delay}ms ease`,
  });

  if (loading) return (
    <div style={{ minHeight: '60dvh', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${green}`, borderTopColor: 'transparent', animation: 'portal-spin 0.9s linear infinite' }} />
        <span style={{ color: textMuted, fontWeight: 600, fontSize: 14 }}>Loading devices…</span>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes portal-spin { to { transform: rotate(360deg); } }
        @keyframes portal-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .snov-btn { cursor: pointer; transition: opacity 180ms ease, transform 180ms ease; }
        .snov-btn:hover { opacity: 0.85; }
        .snov-btn:active { transform: scale(0.96); }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: '"DM Sans", system-ui, sans-serif' }}>

        {/* ── Hero ── */}
        <section style={{
          ...fadeStyle(0),
          background: isDark
            ? 'linear-gradient(160deg, #0C1810 0%, #070E0A 100%)'
            : 'linear-gradient(160deg, #EDF7F1 0%, #F6FCF8 100%)',
          border: `1px solid ${cardBorder}`,
          borderRadius: 28, padding: '22px 20px 18px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -60, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,191,113,0.14), transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: textMuted }}>My devices</div>
              <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 30, lineHeight: 1.1, color: textPrimary, marginTop: 6 }}>
                {devices.length} device{devices.length !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 13, color: textMuted, marginTop: 8 }}>
                {healthIssues > 0 ? `${healthIssues} health issue${healthIssues !== 1 ? 's' : ''} detected` : 'All systems healthy'}
              </div>
            </div>
            <button className="snov-btn" onClick={() => { setRefreshing(true); void load(true); }}
              aria-label="Refresh devices"
              style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${cardBorder}`, background: 'transparent', color: textMuted, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <RefreshCw size={15} style={{ animation: refreshing ? 'portal-spin 1s linear infinite' : undefined }} />
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18 }}>
            {[
              { label: 'Online', value: onlineCount, color: green, icon: <Wifi size={14} /> },
              { label: 'Offline', value: offlineCount, color: offlineCount > 0 ? amber : textMuted, icon: <WifiOff size={14} /> },
              { label: 'Issues', value: healthIssues, color: healthIssues > 0 ? danger : textMuted, icon: <Activity size={14} /> },
            ].map(item => (
              <div key={item.label} style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)',
                border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '14px 8px', textAlign: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: item.color, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 28, lineHeight: 1, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted, marginTop: 5 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 16, padding: 14 }}>
            <div style={{ fontWeight: 700, color: danger, fontSize: 14 }}>Failed to load devices</div>
            <div style={{ color: textMuted, fontSize: 13, marginTop: 4 }}>{error}</div>
            <button className="snov-btn" onClick={() => void load()}
              style={{ marginTop: 10, padding: '8px 16px', borderRadius: 10, border: 'none', background: danger, color: '#fff', fontWeight: 700, fontSize: 13 }}>
              Retry
            </button>
          </div>
        )}

        {/* ── Empty state ── */}
        {!error && devices.length === 0 && (
          <div style={{ ...fadeStyle(120), background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 24, padding: 32, textAlign: 'center' }}>
            <Cpu size={32} color={textMuted} style={{ margin: '0 auto 14px' }} />
            <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 24, color: textPrimary }}>No devices found</div>
            <div style={{ color: textMuted, marginTop: 8, fontSize: 14 }}>Devices will appear here after your installation is commissioned.</div>
          </div>
        )}

        {/* ── Device cards ── */}
        {devices.map((device, idx) => (
          <DeviceCard key={device.id} device={device} isDark={isDark} delay={(idx % 6) * 60} />
        ))}
      </div>
    </>
  );
};

export default MobilePortalDevice;
