import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService } from '../../services/api';
import {
  Wifi, WifiOff, RefreshCw, MapPin, ChevronRight,
  AlertTriangle, Search, X, Zap, Clock, Globe, Cpu,
  Activity, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';

interface SiteDevice { device_id: number; device_serial: string; is_online: boolean; }
interface GatewayDevice {
  is_online?: boolean; last_seen_at?: string;
  signal_strength_dbm?: number | null;
  heartbeat_health?: { severity?: 'ok' | 'warn' | 'critical'; issues?: string[] } | null;
  model?: string; firmware_version?: string;
}
interface SiteRow {
  site_id: string; display_name: string;
  latitude?: number; longitude?: number; timezone?: string;
  site_status?: string; is_active?: boolean;
  capacity_kw?: number; inverter_capacity_kw?: number;
  updated_at?: string;
  devices?: SiteDevice[];
  gateway_device?: GatewayDevice | null;
}

const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e', commissioning: '#f59e0b', inactive: '#64748b', archived: '#475569',
};

const MobileSites: React.FC = () => {
  const { isDark } = useTheme();
  const navigate   = useNavigate();

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';

  const [sites,        setSites]        = useState<SiteRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());

  const fetchSites = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiService.getSitesList({ includeInactive: true });
      setSites(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  const counts = useMemo(() => ({
    total:     sites.length,
    active:    sites.filter(s => s.site_status === 'active' || s.is_active).length,
    online:    sites.filter(s => s.gateway_device?.is_online).length,
    attention: sites.filter(s => { const h = s.gateway_device?.heartbeat_health?.severity; return h === 'warn' || h === 'critical'; }).length,
    capacity:  sites.reduce((acc, s) => acc + (s.capacity_kw ?? 0), 0),
  }), [sites]);

  const filtered = useMemo(() => sites.filter(s => {
    const status = s.site_status ?? (s.is_active ? 'active' : 'inactive');
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.display_name.toLowerCase().includes(q) || s.site_id.toLowerCase().includes(q);
    }
    return true;
  }), [sites, search, statusFilter]);

  const toggle = (id: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', ...extra,
  });

  const pill = (active: boolean, color = accent): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
    cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' as const, flexShrink: 0,
    background: active ? `${color}22` : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
    color: active ? color : sub,
  });

  const fmtUpdated = (ts?: string) => {
    if (!ts) return null;
    const d = Date.now() - new Date(ts).getTime();
    const m = Math.floor(d / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  };

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
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sites</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginTop: 1 }}>{counts.active} active · {counts.online} gateways online</div>
          </div>
          <button onClick={() => { setRefreshing(true); fetchSites(true); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', color: '#fff', padding: '6px 8px', display: 'flex' }}>
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { label: 'Total',     value: counts.total,     bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' },
            { label: 'Active',    value: counts.active,    bg: 'rgba(34,197,94,0.25)',  color: '#86efac' },
            { label: 'Online',    value: counts.online,    bg: 'rgba(34,197,94,0.2)',   color: '#86efac' },
            { label: 'Attention', value: counts.attention, bg: counts.attention > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)', color: counts.attention > 0 ? '#fcd34d' : 'rgba(255,255,255,0.4)' },
          ].map(({ label, value, bg: kBg, color }) => (
            <div key={label} style={{ background: kBg, borderRadius: 10, padding: '8px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {counts.capacity > 0 && (
          <div style={card({ padding: '10px 14px' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={14} color="#eab308" />
              <span style={{ fontSize: '0.72rem', color: sub }}>Fleet capacity: </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: text }}>{counts.capacity.toFixed(1)} kWp</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '8px 12px' }}>
          <Search size={14} color={muted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: text }} />
          {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} color={muted} /></button>}
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {['all', 'active', 'commissioning', 'inactive'].map(s => (
            <button key={s} style={pill(statusFilter === s, STATUS_COLOR[s] ?? accent)} onClick={() => setStatusFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.7rem', color: muted }}>{filtered.length} site{filtered.length !== 1 ? 's' : ''}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ ...card(), padding: '40px 20px', textAlign: 'center' }}>
              <MapPin size={28} color={border} style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.875rem', color: muted }}>No sites match filter</div>
            </div>
          ) : filtered.map(site => {
            const gwOnline   = site.gateway_device?.is_online;
            const gwHealth   = site.gateway_device?.heartbeat_health?.severity;
            const status     = site.site_status ?? (site.is_active ? 'active' : 'inactive');
            const sc         = STATUS_COLOR[status] ?? '#3b82f6';
            const devCount   = site.devices?.length ?? 0;
            const onlineDev  = site.devices?.filter(d => d.is_online).length ?? 0;
            const isExp      = expanded.has(site.site_id);
            const updated    = fmtUpdated(site.updated_at);

            return (
              <div key={site.site_id} style={card()}>
                <button onClick={() => toggle(site.site_id)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${sc}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${sc}30` }}>
                    {gwOnline ? <Wifi size={16} color={sc} /> : <WifiOff size={16} color="#64748b" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{site.display_name}</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, flexShrink: 0, background: `${sc}18`, color: sc }}>{status}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: muted, fontFamily: 'monospace', marginBottom: 4 }}>{site.site_id}</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.68rem', color: gwOnline ? '#22c55e' : '#64748b', fontWeight: 600 }}>{gwOnline ? '● Online' : '○ Offline'}</span>
                      {devCount > 0 && <span style={{ fontSize: '0.68rem', color: sub }}>{onlineDev}/{devCount} devices</span>}
                      {site.capacity_kw && <span style={{ fontSize: '0.68rem', color: sub }}>{site.capacity_kw} kWp</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    {isExp ? <ChevronUp size={14} color={muted} /> : <ChevronDown size={14} color={muted} />}
                    <button onClick={e => { e.stopPropagation(); navigate(`/sites/${site.site_id}`); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, background: `${accent}15`, border: `1px solid ${accent}30`, cursor: 'pointer', color: accent, fontSize: '0.62rem', fontWeight: 700 }}>
                      Open <ChevronRight size={11} />
                    </button>
                  </div>
                </button>

                {isExp && (
                  <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${border}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {site.latitude != null && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: sub }}><MapPin size={10} color={muted} />{site.latitude.toFixed(4)}°, {site.longitude?.toFixed(4)}°</div>
                        </div>
                      )}
                      {site.timezone && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Timezone</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: sub }}><Globe size={10} color={muted} />{site.timezone}</div>
                        </div>
                      )}
                      {site.inverter_capacity_kw && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inverter cap.</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: sub }}><Activity size={10} color={muted} />{site.inverter_capacity_kw} kW</div>
                        </div>
                      )}
                      {updated && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Updated</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: sub }}><Clock size={10} color={muted} />{updated}</div>
                        </div>
                      )}
                      {site.gateway_device?.model && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gateway</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: sub }}><Cpu size={10} color={muted} />{site.gateway_device.model}</div>
                        </div>
                      )}
                      {site.gateway_device?.firmware_version && (
                        <div>
                          <div style={{ fontSize: '0.58rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Firmware</div>
                          <div style={{ fontSize: '0.7rem', color: sub, fontFamily: 'monospace' }}>{site.gateway_device.firmware_version}</div>
                        </div>
                      )}
                    </div>

                    {(gwHealth === 'warn' || gwHealth === 'critical') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, background: gwHealth === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${gwHealth === 'critical' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                        <AlertTriangle size={13} color={gwHealth === 'critical' ? '#ef4444' : '#f59e0b'} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: gwHealth === 'critical' ? '#ef4444' : '#f59e0b' }}>Gateway health: {gwHealth}</span>
                      </div>
                    )}

                    {(site.devices?.length ?? 0) > 0 && (
                      <div>
                        <div style={{ fontSize: '0.6rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Devices</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {site.devices!.map(d => (
                            <div key={d.device_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 7, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${border}` }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 600, color: sub }}>{d.device_serial}</span>
                              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: d.is_online ? '#22c55e' : '#64748b' }}>{d.is_online ? 'Online' : 'Offline'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

export default MobileSites;
