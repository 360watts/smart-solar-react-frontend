import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '../../services/api';
import {
  Wifi, WifiOff, RefreshCw, Thermometer, Signal, AlertTriangle,
  Search, X, FileText, ChevronDown, ChevronUp, Loader2,
  Activity, Cpu, Clock, Radio, Settings, Shield,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface Device {
  id: number;
  device_serial: string;
  hw_id?: string;
  model?: string;
  firmware_version?: string;
  is_online?: boolean;
  last_seen_at?: string;
  last_heartbeat?: string;
  connectivity_type?: string;
  signal_strength_dbm?: number | null;
  device_temp_c?: number | null;
  heartbeat_health?: { severity?: 'ok' | 'warn' | 'critical'; issues?: string[] } | null;
  pending_config_update?: boolean;
  auto_reboot_enabled?: boolean;
  logs_enabled?: boolean;
  uptime_seconds?: number | null;
  free_memory_bytes?: number | null;
  cpu_usage_pct?: number | null;
}

interface LogEntry {
  id: number;
  timestamp: string;
  log_level: string;
  message: string;
}

// ── Log panel ─────────────────────────────────────────────────────────────────

const LogPanel: React.FC<{ deviceId: number; isDark: boolean; border: string; muted: string; sub: string }> = ({ deviceId, isDark, border, muted, sub }) => {
  const [logs, setLogs]       = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    apiService.getDeviceLogs(deviceId, 50)
      .then(res => { if (!cancelled) setLogs(Array.isArray(res) ? res : (res?.results ?? [])); })
      .catch(() => { if (!cancelled) setError('Failed to load logs'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deviceId]);

  const levelColor = (l: string) => {
    const u = l.toUpperCase();
    if (u === 'ERROR' || u === 'CRITICAL') return '#ef4444';
    if (u === 'WARNING' || u === 'WARN')   return '#f59e0b';
    if (u === 'INFO')                       return '#3b82f6';
    return muted;
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '14px 0', color: muted, fontSize: '0.72rem' }}>
      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading logs…
    </div>
  );
  if (error) return <div style={{ padding: '10px 0', textAlign: 'center', fontSize: '0.72rem', color: '#ef4444' }}>{error}</div>;
  if (logs.length === 0) return <div style={{ padding: '10px 0', textAlign: 'center', fontSize: '0.72rem', color: muted }}>No log entries found</div>;

  return (
    <div style={{ marginTop: 8, borderRadius: 8, border: `1px solid ${border}`, background: isDark ? '#050b14' : '#f8fafc', overflow: 'hidden' }}>
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {logs.map((entry, i) => (
          <div key={entry.id} style={{ display: 'flex', gap: 8, padding: '6px 10px', borderTop: i === 0 ? 'none' : `1px solid ${border}` }}>
            <span style={{ flexShrink: 0, minWidth: 32, fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', color: levelColor(entry.log_level), paddingTop: 1 }}>
              {entry.log_level.slice(0, 4)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.68rem', color: isDark ? '#cbd5e1' : '#334155', lineHeight: 1.4, wordBreak: 'break-word' }}>{entry.message}</div>
              <div style={{ fontSize: '0.6rem', color: muted, marginTop: 2 }}>
                {new Date(entry.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtLastSeen = (ts?: string) => {
  if (!ts) return '—';
  const d = Date.now() - new Date(ts).getTime();
  const m = Math.floor(d / 60_000);
  if (m < 2) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtUptime = (s?: number | null) => {
  if (s == null) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const fmtBytes = (b?: number | null) => {
  if (b == null) return null;
  if (b > 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
};

// ── Component ─────────────────────────────────────────────────────────────────

const MobileDevices: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';

  const [devices,    setDevices]    = useState<Device[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState<'all' | 'online' | 'offline'>('all');
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set());
  const [logsOpen,   setLogsOpen]   = useState<Set<number>>(new Set());

  const fetchDevices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiService.getDevices(undefined, 1, 100);
      setDevices(Array.isArray(res) ? res : (res?.results ?? []));
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const filtered = devices.filter(d => {
    if (filter === 'online'  && !d.is_online) return false;
    if (filter === 'offline' &&  d.is_online) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return d.device_serial.toLowerCase().includes(q) || (d.model ?? '').toLowerCase().includes(q) || (d.hw_id ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const counts = { total: devices.length, online: devices.filter(d => d.is_online).length, offline: devices.filter(d => !d.is_online).length, warn: devices.filter(d => d.heartbeat_health?.severity === 'warn' || d.heartbeat_health?.severity === 'critical').length };

  const healthColor = (h?: Device['heartbeat_health']) => !h || h.severity === 'ok' ? '#22c55e' : h.severity === 'warn' ? '#f59e0b' : '#ef4444';

  const signalBar = (dbm: number | null | undefined) => {
    if (dbm == null) return null;
    const c = dbm > -60 ? '#22c55e' : dbm > -75 ? '#f59e0b' : '#ef4444';
    const label = dbm > -60 ? 'Strong' : dbm > -75 ? 'Fair' : 'Weak';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem' }}>
        <Signal size={12} color={c} />
        <span style={{ color: c, fontWeight: 600 }}>{label}</span>
        <span style={{ color: muted }}>({dbm} dBm)</span>
      </div>
    );
  };

  const toggle = (set: Set<number>, setFn: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) => {
    setFn(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', ...extra,
  });

  const pill = (active: boolean, color = accent): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
    cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' as const, flexShrink: 0,
    background: active ? `${color}22` : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
    color: active ? color : sub,
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: muted }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.875rem' }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 96 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #004d1e, #006b2b)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Devices</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginTop: 1 }}>
              {counts.online} online · {counts.offline} offline
            </div>
          </div>
          <button onClick={() => { setRefreshing(true); fetchDevices(true); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', color: '#fff', padding: '6px 8px', display: 'flex' }}>
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { label: 'Total',   value: counts.total,   bg: 'rgba(255,255,255,0.1)',  color: 'rgba(255,255,255,0.9)' },
            { label: 'Online',  value: counts.online,  bg: 'rgba(34,197,94,0.25)',   color: '#86efac' },
            { label: 'Offline', value: counts.offline, bg: 'rgba(100,116,139,0.2)',  color: '#94a3b8' },
            { label: 'Issues',  value: counts.warn,    bg: counts.warn > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)', color: counts.warn > 0 ? '#fcd34d' : 'rgba(255,255,255,0.5)' },
          ].map(({ label, value, bg: kBg, color }) => (
            <div key={label} style={{ background: kBg, borderRadius: 10, padding: '8px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '8px 12px' }}>
          <Search size={14} color={muted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search serial, model, HW ID…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: text }} />
          {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} color={muted} /></button>}
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'online', 'offline'] as const).map(f => (
            <button key={f} style={pill(filter === f, f === 'online' ? '#22c55e' : f === 'offline' ? '#64748b' : accent)} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)} {f !== 'all' && `(${f === 'online' ? counts.online : counts.offline})`}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.7rem', color: muted }}>{filtered.length} device{filtered.length !== 1 ? 's' : ''}</div>

        {/* Device cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ ...card(), padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.875rem', color: muted }}>No devices match filter</div>
            </div>
          ) : filtered.map(device => {
            const hc      = healthColor(device.heartbeat_health);
            const isExp   = expanded.has(device.id);
            const isLogs  = logsOpen.has(device.id);
            const health  = device.heartbeat_health;
            const uptime  = fmtUptime(device.uptime_seconds);
            const freeMem = fmtBytes(device.free_memory_bytes);

            return (
              <div key={device.id} style={card()}>
                {/* Card header */}
                <button onClick={() => toggle(expanded, setExpanded, device.id)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: device.is_online ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${device.is_online ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.15)'}` }}>
                    {device.is_online ? <Wifi size={16} color="#22c55e" /> : <WifiOff size={16} color="#64748b" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, color: text }}>{device.device_serial}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, flexShrink: 0, background: device.is_online ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', color: device.is_online ? '#22c55e' : '#64748b' }}>
                        {device.is_online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    {device.model && <div style={{ fontSize: '0.7rem', color: muted, marginTop: 2 }}>{device.model}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: sub }}>
                        <Clock size={11} color={muted} />{fmtLastSeen(device.last_seen_at ?? device.last_heartbeat)}
                      </div>
                      {device.pending_config_update && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', color: '#f59e0b', fontWeight: 600 }}>
                          <AlertTriangle size={10} color="#f59e0b" />Config pending
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ color: muted, flexShrink: 0 }}>
                    {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {/* Expanded details */}
                {isExp && (
                  <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${border}`, paddingTop: 10 }}>

                    {/* Info grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      {device.hw_id && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>HW ID</div>
                          <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 600, color: sub }}>{device.hw_id}</div>
                        </div>
                      )}
                      {device.firmware_version && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Firmware</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: sub }}><Shield size={11} color={muted} />{device.firmware_version}</div>
                        </div>
                      )}
                      {device.connectivity_type && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Connectivity</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: sub }}><Radio size={11} color={muted} />{device.connectivity_type}</div>
                        </div>
                      )}
                      {device.device_temp_c != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Temperature</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: device.device_temp_c > 70 ? '#ef4444' : sub }}>
                            <Thermometer size={11} color={device.device_temp_c > 70 ? '#ef4444' : muted} />{device.device_temp_c.toFixed(1)}°C
                          </div>
                        </div>
                      )}
                      {uptime && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Uptime</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: sub }}><Activity size={11} color={muted} />{uptime}</div>
                        </div>
                      )}
                      {device.cpu_usage_pct != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>CPU</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: device.cpu_usage_pct > 80 ? '#ef4444' : sub }}>
                            <Cpu size={11} color={device.cpu_usage_pct > 80 ? '#ef4444' : muted} />{device.cpu_usage_pct.toFixed(0)}%
                          </div>
                        </div>
                      )}
                      {freeMem && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Free Mem</div>
                          <div style={{ fontSize: '0.72rem', color: sub }}>{freeMem}</div>
                        </div>
                      )}
                    </div>

                    {/* Signal */}
                    {device.signal_strength_dbm != null && signalBar(device.signal_strength_dbm)}

                    {/* Health issues */}
                    {health && health.severity !== 'ok' && (health.issues?.length ?? 0) > 0 && (
                      <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: `${hc}12`, border: `1px solid ${hc}30` }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: hc, marginBottom: 4, letterSpacing: '0.04em' }}>Health Issues</div>
                        {health.issues!.map((issue, i) => (
                          <div key={i} style={{ fontSize: '0.7rem', color: hc, fontWeight: 500, lineHeight: 1.5 }}>{issue}</div>
                        ))}
                      </div>
                    )}

                    {/* Feature flags */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Auto Reboot', on: device.auto_reboot_enabled },
                        { label: 'Logs',        on: device.logs_enabled !== false },
                        { label: 'Config Sync', on: !device.pending_config_update },
                      ].map(({ label, on }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 600, background: on ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', color: on ? '#22c55e' : '#64748b', border: `1px solid ${on ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.15)'}` }}>
                          <Settings size={9} />{label}
                        </div>
                      ))}
                    </div>

                    {/* Logs toggle */}
                    <button onClick={() => toggle(logsOpen, setLogsOpen, device.id)}
                      style={{ marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 600, color: muted }}>
                        <FileText size={12} color={muted} />Device Logs
                      </span>
                      {isLogs ? <ChevronUp size={13} color={muted} /> : <ChevronDown size={13} color={muted} />}
                    </button>

                    {isLogs && <LogPanel deviceId={device.id} isDark={isDark} border={border} muted={muted} sub={sub} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MobileDevices;
