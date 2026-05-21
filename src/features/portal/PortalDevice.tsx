import React, { useEffect, useState } from 'react';
import { Cpu, Wifi, WifiOff, Thermometer, Signal, RefreshCw, Radio, Clock, MapPin } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';

interface DeviceItem {
  id: number;
  device_serial: string;
  hw_id?: string;
  model?: string;
  is_online: boolean;
  last_heartbeat?: string;
  last_seen_at?: string;
  connectivity_type?: string;
  signal_strength_dbm?: number | null;
  device_temp_c?: number | null;
  site_id?: string;
  heartbeat_health?: { severity: 'ok' | 'warn' | 'critical' };
}

const HEALTH: Record<string, { color: string; label: string; glow: string }> = {
  ok:       { color: '#34D399', label: 'Healthy',  glow: 'rgba(52,211,153,0.25)'  },
  warn:     { color: '#FBBF24', label: 'Warning',  glow: 'rgba(251,191,36,0.25)'  },
  critical: { color: '#F87171', label: 'Critical', glow: 'rgba(248,113,113,0.25)' },
};

function signalBars(dbm: number | null | undefined): number {
  if (dbm == null) return 0;
  if (dbm >= -50)  return 4;
  if (dbm >= -65)  return 3;
  if (dbm >= -75)  return 2;
  if (dbm >= -85)  return 1;
  return 0;
}

function lastSeenText(dateStr?: string): string {
  if (!dateStr) return 'Unknown';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)   return 'Just now';
  if (mins < 60)  return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ─── Signal bar visual ──────────────────────────────────────────────────── */
const SignalBars: React.FC<{ dbm: number | null | undefined; color: string }> = ({ dbm, color }) => {
  const bars = signalBars(dbm);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16 }}>
      {[1, 2, 3, 4].map(b => (
        <div key={b} style={{
          width: 5,
          height: 4 + b * 3,
          borderRadius: 2,
          background: b <= bars ? color : 'rgba(255,255,255,0.1)',
          transition: 'background 0.3s ease',
        }} />
      ))}
    </div>
  );
};

/* ─── Stat row ───────────────────────────────────────────────────────────── */
const StatRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; muted: string; text: string }> = ({ icon, label, value, muted, text }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: muted }}>
      {icon}
      {label}
    </span>
    <span style={{ fontSize: 13, color: text, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{value}</span>
  </div>
);

/* ─── Device card ────────────────────────────────────────────────────────── */
const DeviceCard: React.FC<{ device: DeviceItem; isDark: boolean; delay: number }> = ({ device, isDark, delay }) => {
  const health      = HEALTH[device.heartbeat_health?.severity ?? (device.is_online ? 'ok' : 'critical')];
  const lastSeen    = device.last_seen_at || device.last_heartbeat;
  const text  = isDark ? '#F0F4FF' : '#0A0E1A';
  const muted = isDark ? '#8892A4' : '#64748B';

  return (
    <div
      className="portal-fade-in"
      style={{
        animationDelay: `${delay}ms`,
        background: isDark ? 'linear-gradient(145deg, #0F1623 0%, #0D1320 100%)' : '#FFFFFF',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Card header with health indicator */}
      <div style={{
        padding: '20px 20px 16px',
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Health ring */}
          <div style={{ position: 'relative', width: 44, height: 44 }}>
            {device.is_online && (
              <div style={{
                position: 'absolute', inset: -5, borderRadius: '50%',
                border: `2px solid ${health.color}`,
                animation: 'portal-pulse-ring 2s ease-out infinite',
                opacity: 0.6,
              }} />
            )}
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: `${health.color}15`,
              border: `2px solid ${health.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: health.color,
            }}>
              <Cpu size={18} strokeWidth={1.8} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 15, fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: text, letterSpacing: '-0.01em' }}>
              {device.device_serial}
            </div>
            {device.model && <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{device.model}</div>}
          </div>
        </div>

        {/* Online badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20,
          background: device.is_online ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
          border: `1px solid ${device.is_online ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
          color: device.is_online ? '#34D399' : '#F87171',
          fontSize: 12, fontWeight: 600,
        }}>
          {device.is_online ? <Wifi size={12} /> : <WifiOff size={12} />}
          {device.is_online ? 'Online' : 'Offline'}
          {device.is_online && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', animation: 'portal-pulse-ring 2s ease-out infinite', boxShadow: '0 0 6px #34D399' }} />
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '6px 20px 18px' }}>
        {device.connectivity_type && (
          <StatRow icon={<Radio size={13} />} label="Connection" value={device.connectivity_type} muted={muted} text={text} />
        )}
        {device.signal_strength_dbm != null && (
          <StatRow
            icon={<Signal size={13} />}
            label="Signal strength"
            value={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SignalBars dbm={device.signal_strength_dbm} color={health.color} />
                <span style={{ fontSize: 12, color: muted }}>{device.signal_strength_dbm} dBm</span>
              </div>
            }
            muted={muted} text={text}
          />
        )}
        {device.device_temp_c != null && (
          <StatRow
            icon={<Thermometer size={13} />}
            label="Temperature"
            value={
              <span style={{ color: device.device_temp_c >= 65 ? '#FBBF24' : text }}>
                {device.device_temp_c}°C
              </span>
            }
            muted={muted} text={text}
          />
        )}
        <StatRow
          icon={<Clock size={13} />}
          label="Last seen"
          value={lastSeenText(lastSeen)}
          muted={muted} text={text}
        />
        {device.site_id && (
          <StatRow icon={<MapPin size={13} />} label="Site" value={device.site_id} muted={muted} text={text} />
        )}

        {/* Health bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: muted }}>System Health</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: health.color }}>{health.label}</span>
          </div>
          <div style={{ height: 4, borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: health.label === 'Healthy' ? '100%' : health.label === 'Warning' ? '55%' : '20%',
              background: `linear-gradient(90deg, ${health.color}80, ${health.color})`,
              boxShadow: `0 0 8px ${health.glow}`,
              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────────────────────── */
const PortalDevice: React.FC = () => {
  const { isDark } = useTheme();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const text  = isDark ? '#F0F4FF' : '#0A0E1A';
  const muted = isDark ? '#8892A4' : '#64748B';
  const surface = isDark ? '#0F1623' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiService.getDevices();
      setDevices(data.results ?? data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 16px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(245,158,11,0.15)', borderTop: '3px solid #F59E0B', animation: 'portal-spin 1s linear infinite' }} />
          <Cpu size={20} color="#F59E0B" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        </div>
        <p style={{ color: muted, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading device info…</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div className="portal-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 26, color: text, margin: 0, letterSpacing: '-0.02em' }}>
            My Device
          </h1>
          <p style={{ fontSize: 13, color: muted, marginTop: 4 }}>
            {devices.length} gateway{devices.length !== 1 ? 's' : ''} · {devices.filter(d => d.is_online).length} online
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
          {error}
          <button onClick={load} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}

      {/* Empty */}
      {devices.length === 0 && !error && (
        <div className="portal-fade-in" style={{ textAlign: 'center', padding: '72px 20px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px', background: 'rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={32} color="#F59E0B" />
          </div>
          <p style={{ fontSize: 18, fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: text, marginBottom: 8 }}>No devices found</p>
          <p style={{ fontSize: 14, color: muted }}>Your gateway device will appear here once provisioned.</p>
        </div>
      )}

      {/* Device grid */}
      {devices.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {devices.map((device, i) => (
            <DeviceCard key={device.id} device={device} isDark={isDark} delay={i * 50} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalDevice;
