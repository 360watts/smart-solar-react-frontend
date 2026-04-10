import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '../../services/api';
import { Wifi, WifiOff, RefreshCw, Thermometer, Signal, AlertTriangle, CheckCircle, Search, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface Device {
  id: number;
  device_serial: string;
  hw_id?: string;
  model?: string;
  is_online?: boolean;
  last_seen_at?: string;
  last_heartbeat?: string;
  connectivity_type?: string;
  signal_strength_dbm?: number | null;
  device_temp_c?: number | null;
  heartbeat_health?: { severity?: 'ok' | 'warn' | 'critical'; issues?: string[] } | null;
  pending_config_update?: boolean;
  auto_reboot_enabled?: boolean;
}

const MobileDevices: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#020617' : '#f0fdf4';
  const surface = isDark ? '#0f172a' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,166,62,0.15)';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMute = isDark ? '#64748b' : '#94a3b8';
  const textSub  = isDark ? '#94a3b8' : '#475569';

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [onlineFilter, setOnlineFilter] = useState<'all' | 'online' | 'offline'>('all');

  const fetchDevices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiService.getDevices(undefined, 1, 100);
      const rows: Device[] = Array.isArray(res) ? res : (res?.results ?? []);
      setDevices(rows);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const filtered = devices.filter(d => {
    if (onlineFilter === 'online' && !d.is_online) return false;
    if (onlineFilter === 'offline' && d.is_online) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return d.device_serial.toLowerCase().includes(q) || (d.model ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    total: devices.length,
    online: devices.filter(d => d.is_online).length,
    offline: devices.filter(d => !d.is_online).length,
  };

  const healthColor = (h?: Device['heartbeat_health']) => {
    if (!h || h.severity === 'ok') return '#10b981';
    if (h.severity === 'warn') return '#f59e0b';
    return '#ef4444';
  };

  const signalBars = (dbm: number | null | undefined) => {
    if (dbm == null) return null;
    const strength = dbm > -60 ? 'strong' : dbm > -75 ? 'medium' : 'weak';
    const c = strength === 'strong' ? '#10b981' : strength === 'medium' ? '#f59e0b' : '#ef4444';
    return <Signal size={13} color={c} />;
  };

  const fmtLastSeen = (ts?: string) => {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, ...extra,
  });

  const pill = (active: boolean, color = '#00a63e'): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
    cursor: 'pointer', border: 'none',
    background: active ? `${color}20` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
    color: active ? color : textSub,
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
          <div style={{ fontWeight: 700, fontSize: '1rem', color: textMain }}>Devices</div>
          <div style={{ fontSize: '0.72rem', color: textMute, marginTop: 2 }}>
            {counts.online} online · {counts.offline} offline
          </div>
        </div>
        <button onClick={() => { setRefreshing(true); fetchDevices(true); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMute, display: 'flex', padding: 8 }}>
          <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      <div style={{ padding: '12px 12px 0' }}>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Total', value: counts.total, color: textMain },
            { label: 'Online', value: counts.online, color: '#10b981' },
            { label: 'Offline', value: counts.offline, color: '#64748b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...card({ padding: '10px 8px', textAlign: 'center' }) }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: '0.65rem', color: textMute, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '8px 12px' }}>
          <Search size={14} color={textMute} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search serial or model…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: textMain }}
          />
          {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} color={textMute} /></button>}
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['all', 'online', 'offline'] as const).map(f => (
            <button key={f} style={pill(onlineFilter === f, f === 'online' ? '#10b981' : f === 'offline' ? '#64748b' : '#00a63e')} onClick={() => setOnlineFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Device cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ ...card({ padding: '40px 20px', textAlign: 'center' }) }}>
              <div style={{ fontSize: '0.875rem', color: textMute }}>No devices match filter</div>
            </div>
          ) : filtered.map(device => {
            const health = device.heartbeat_health;
            const hc = healthColor(health);
            return (
              <div key={device.id} style={card({ padding: '14px' })}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, color: textMain, letterSpacing: '0.02em' }}>{device.device_serial}</div>
                    {device.model && <div style={{ fontSize: '0.7rem', color: textMute, marginTop: 2 }}>{device.model}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: device.is_online ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', border: `1px solid ${device.is_online ? 'rgba(34,197,94,0.25)' : 'rgba(100,116,139,0.2)'}` }}>
                    {device.is_online ? <Wifi size={12} color="#22c55e" /> : <WifiOff size={12} color="#64748b" />}
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: device.is_online ? '#22c55e' : '#64748b' }}>
                      {device.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {/* Last seen */}
                  <div style={{ fontSize: '0.7rem', color: textSub }}>
                    <span style={{ color: textMute }}>Last seen </span>
                    {fmtLastSeen(device.last_seen_at ?? device.last_heartbeat)}
                  </div>
                  {/* Signal */}
                  {device.signal_strength_dbm != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: textSub }}>
                      {signalBars(device.signal_strength_dbm)}
                      {device.signal_strength_dbm} dBm
                    </div>
                  )}
                  {/* Temp */}
                  {device.device_temp_c != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: device.device_temp_c > 70 ? '#ef4444' : textSub }}>
                      <Thermometer size={12} color={device.device_temp_c > 70 ? '#ef4444' : textMute} />
                      {device.device_temp_c.toFixed(1)}°C
                    </div>
                  )}
                  {/* Config pending */}
                  {device.pending_config_update && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: '#f59e0b', fontWeight: 600 }}>
                      <AlertTriangle size={11} color="#f59e0b" /> Config pending
                    </div>
                  )}
                </div>

                {/* Health issues */}
                {health && health.severity !== 'ok' && health.issues && health.issues.length > 0 && (
                  <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: `${hc}12`, border: `1px solid ${hc}30` }}>
                    {health.issues.map((issue, i) => (
                      <div key={i} style={{ fontSize: '0.68rem', color: hc, fontWeight: 500 }}>{issue}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileDevices;
