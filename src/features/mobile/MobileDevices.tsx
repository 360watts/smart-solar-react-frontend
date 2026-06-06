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

const LogPanel: React.FC<{ deviceId: number; isDark: boolean; border: string; muted: string; sub: string }> = ({ deviceId, isDark, border, muted, sub }) => {
  const [logs, setLogs]       = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    setLogs([]);
    setLoading(false);
    return () => { cancelled = true; };
  }, [deviceId]);

  const levelColor = (l: string) => {
    const u = l.toUpperCase();
    if (u === 'ERROR' || u === 'CRITICAL') return '#F87171';
    if (u === 'WARNING' || u === 'WARN')   return '#F59E0B';
    if (u === 'INFO')                       return '#60A5FA';
    return muted;
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '14px 0', color: muted, fontSize: '0.72rem', fontFamily: "'DM Sans', sans-serif" }}>
      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading logs…
    </div>
  );
  if (error) return <div style={{ padding: '10px 0', textAlign: 'center', fontSize: '0.72rem', color: '#F87171', fontFamily: "'DM Sans', sans-serif" }}>{error}</div>;
  if (logs.length === 0) return <div style={{ padding: '10px 0', textAlign: 'center', fontSize: '0.72rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>No log entries found</div>;

  return (
    <div style={{ marginTop: 8, borderRadius: 10, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC', overflow: 'hidden' }}>
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {logs.map((entry, i) => (
          <div key={entry.id} style={{ display: 'flex', gap: 8, padding: '7px 11px', borderTop: i === 0 ? 'none' : `1px solid ${border}` }}>
            <span style={{ flexShrink: 0, minWidth: 32, fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', color: levelColor(entry.log_level), paddingTop: 1, fontFamily: "'JetBrains Mono', monospace" }}>
              {entry.log_level.slice(0, 4)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.68rem', color: isDark ? '#CBD5E1' : '#334155', lineHeight: 1.4, wordBreak: 'break-word', fontFamily: "'DM Sans', sans-serif" }}>{entry.message}</div>
              <div style={{ fontSize: '0.6rem', color: muted, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                {new Date(entry.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

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

const MobileDevices: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';
  const accent  = '#2FBF71';

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

  const healthColor = (h?: Device['heartbeat_health']) => !h || h.severity === 'ok' ? '#2FBF71' : h.severity === 'warn' ? '#F59E0B' : '#F87171';

  const signalBar = (dbm: number | null | undefined) => {
    if (dbm == null) return null;
    const c = dbm > -60 ? '#2FBF71' : dbm > -75 ? '#F59E0B' : '#F87171';
    const label = dbm > -60 ? 'Strong' : dbm > -75 ? 'Fair' : 'Weak';
    const bars = [dbm > -90, dbm > -75, dbm > -60];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${border}` }}>
        <Signal size={13} color={c} />
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 14 }}>
          {bars.map((on, i) => (
            <div key={i} style={{ width: 4, height: `${(i + 1) * 33}%`, borderRadius: 2, background: on ? c : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }} />
          ))}
        </div>
        <span style={{ fontSize: '0.72rem', color: c, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
        <span style={{ fontSize: '0.68rem', color: muted, fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto' }}>{dbm} dBm</span>
      </div>
    );
  };

  const toggle = (set: Set<number>, setFn: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) => {
    setFn(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: muted }}>
      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.8rem', fontFamily: "'DM Sans', sans-serif" }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 68 }}>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${border}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif" }}>Devices</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: text, fontFamily: "'Outfit', sans-serif", marginTop: 1 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: accent }}>{counts.online}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: muted }}>/{counts.total}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 400, color: muted, fontFamily: "'DM Sans', sans-serif", marginLeft: 6 }}>online</span>
            </div>
          </div>
          <button
            onClick={() => { setRefreshing(true); fetchDevices(true); }}
            style={{ background: `${accent}18`, border: `1px solid ${accent}30`, borderRadius: 10, cursor: 'pointer', color: accent, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {[
            { label: 'Total',   value: counts.total,   color: text },
            { label: 'Online',  value: counts.online,  color: accent },
            { label: 'Offline', value: counts.offline, color: '#64748b' },
            { label: 'Issues',  value: counts.warn,    color: counts.warn > 0 ? '#F59E0B' : muted },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', border: `1px solid ${border}`, flexShrink: 0 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', fontWeight: 700, color }}>{value}</span>
              <span style={{ fontSize: '0.62rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 12, padding: '10px 12px' }}>
          <Search size={14} color={muted} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search serial, model, HW ID…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: text, fontFamily: "'DM Sans', sans-serif" }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
              <X size={13} color={muted} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'online', 'offline'] as const).map(f => {
            const color = f === 'online' ? accent : f === 'offline' ? '#64748b' : accent;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{ padding: '5px 14px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? color + '50' : border}`, whiteSpace: 'nowrap', flexShrink: 0, background: active ? `${color}20` : 'transparent', color: active ? color : muted, fontFamily: "'DM Sans', sans-serif" }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)} {f !== 'all' && `(${f === 'online' ? counts.online : counts.offline})`}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: '0.65rem', color: muted, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
          {filtered.length} device{filtered.length !== 1 ? 's' : ''}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 20px', background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 16 }}>
              <Cpu size={32} color={border} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: '0.85rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>No devices match filter</div>
            </div>
          ) : filtered.map(device => {
            const hc     = healthColor(device.heartbeat_health);
            const isExp  = expanded.has(device.id);
            const isLogs = logsOpen.has(device.id);
            const health = device.heartbeat_health;
            const uptime = fmtUptime(device.uptime_seconds);
            const freeMem = fmtBytes(device.free_memory_bytes);
            const onlineColor = device.is_online ? '#2FBF71' : '#475569';

            return (
              <div key={device.id} style={{ background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden' }}>
                <button
                  onClick={() => toggle(expanded, setExpanded, device.id)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '13px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11 }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: device.is_online ? 'rgba(47,191,113,0.12)' : 'rgba(71,85,105,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${device.is_online ? 'rgba(47,191,113,0.25)' : 'rgba(71,85,105,0.2)'}` }}>
                    {device.is_online ? <Wifi size={16} color="#2FBF71" /> : <WifiOff size={16} color="#475569" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem', fontWeight: 700, color: text, marginBottom: 3 }}>{device.device_serial}</div>
                    {device.model && <div style={{ fontSize: '0.68rem', color: muted, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{device.model}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.67rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>
                        <Clock size={10} color={muted} />{fmtLastSeen(device.last_seen_at ?? device.last_heartbeat)}
                      </div>
                      {device.pending_config_update && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', color: '#F59E0B', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                          <AlertTriangle size={10} color="#F59E0B" />Config pending
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: hc, boxShadow: `0 0 6px ${hc}80` }} />
                    <div style={{ color: muted }}>
                      {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </div>
                  </div>
                </button>

                {isExp && (
                  <div style={{ borderTop: `1px solid ${border}` }}>
                    {health && health.severity !== 'ok' && (
                      <div style={{ height: 3, background: hc, opacity: 0.7 }} />
                    )}
                    <div style={{ padding: '12px 13px 13px' }}>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        {device.hw_id && (
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>HW ID</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', fontWeight: 600, color: muted }}>{device.hw_id}</div>
                          </div>
                        )}
                        {device.firmware_version && (
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Firmware</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}><Shield size={10} color={muted} />{device.firmware_version}</div>
                          </div>
                        )}
                        {device.connectivity_type && (
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Connectivity</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}><Radio size={10} color={muted} />{device.connectivity_type}</div>
                          </div>
                        )}
                        {device.device_temp_c != null && (
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Temperature</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: device.device_temp_c > 70 ? '#F87171' : muted, fontFamily: "'JetBrains Mono', monospace" }}>
                              <Thermometer size={10} color={device.device_temp_c > 70 ? '#F87171' : muted} />{device.device_temp_c.toFixed(1)}°C
                            </div>
                          </div>
                        )}
                        {uptime && (
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Uptime</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}><Activity size={10} color={muted} />{uptime}</div>
                          </div>
                        )}
                        {device.cpu_usage_pct != null && (
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>CPU</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: device.cpu_usage_pct > 80 ? '#F87171' : muted, fontFamily: "'JetBrains Mono', monospace" }}>
                              <Cpu size={10} color={device.cpu_usage_pct > 80 ? '#F87171' : muted} />{device.cpu_usage_pct.toFixed(0)}%
                            </div>
                          </div>
                        )}
                        {freeMem && (
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Free Mem</div>
                            <div style={{ fontSize: '0.72rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}>{freeMem}</div>
                          </div>
                        )}
                      </div>

                      {device.signal_strength_dbm != null && (
                        <div style={{ marginBottom: 8 }}>
                          {signalBar(device.signal_strength_dbm)}
                        </div>
                      )}

                      {health && health.severity !== 'ok' && (health.issues?.length ?? 0) > 0 && (
                        <div style={{ marginBottom: 8, padding: '9px 11px', borderRadius: 10, background: `${hc}10`, border: `1px solid ${hc}30` }}>
                          <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: hc, marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>Health Issues</div>
                          {health.issues!.map((issue, i) => (
                            <div key={i} style={{ fontSize: '0.72rem', color: hc, fontWeight: 500, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{issue}</div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Auto Reboot', on: device.auto_reboot_enabled },
                          { label: 'Logs',        on: device.logs_enabled !== false },
                          { label: 'Config Sync', on: !device.pending_config_update },
                        ].map(({ label, on }) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 600, background: on ? 'rgba(47,191,113,0.1)' : 'rgba(71,85,105,0.12)', color: on ? '#2FBF71' : '#64748b', border: `1px solid ${on ? 'rgba(47,191,113,0.2)' : 'rgba(71,85,105,0.2)'}`, fontFamily: "'DM Sans', sans-serif" }}>
                            <Settings size={9} />{label}
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => toggle(logsOpen, setLogsOpen, device.id)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 11px', borderRadius: 9, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', cursor: 'pointer' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 600, color: muted, fontFamily: "'DM Sans', sans-serif" }}>
                          <FileText size={12} color={muted} />Device Logs
                        </span>
                        {isLogs ? <ChevronUp size={13} color={muted} /> : <ChevronDown size={13} color={muted} />}
                      </button>

                      {isLogs && <LogPanel deviceId={device.id} isDark={isDark} border={border} muted={muted} sub={muted} />}
                    </div>
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
