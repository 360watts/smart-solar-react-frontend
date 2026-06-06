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
  active: '#2FBF71', commissioning: '#F59E0B', inactive: '#64748b', archived: '#94a3b8',
};

const MobileSites: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';
  const accent  = '#2FBF71';

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
      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.8rem', fontFamily: "'DM Sans', sans-serif" }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 96 }}>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${border}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif" }}>Sites</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: text, fontFamily: "'Outfit', sans-serif", marginTop: 1 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: accent }}>{counts.total}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 400, color: muted, fontFamily: "'DM Sans', sans-serif", marginLeft: 6 }}>{counts.online} online</span>
            </div>
          </div>
          <button
            onClick={() => { setRefreshing(true); fetchSites(true); }}
            style={{ background: `${accent}18`, border: `1px solid ${accent}30`, borderRadius: 10, cursor: 'pointer', color: accent, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {[
            { label: 'Total',  value: counts.total,     color: text },
            { label: 'Online', value: counts.online,    color: accent },
            { label: 'Offline', value: counts.total - counts.online, color: '#64748b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', border: `1px solid ${border}` }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', fontWeight: 700, color }}>{value}</span>
              <span style={{ fontSize: '0.62rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {counts.capacity > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 12 }}>
            <Zap size={13} color="#F59E0B" />
            <span style={{ fontSize: '0.7rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>Fleet capacity</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', fontWeight: 700, color: '#F59E0B', marginLeft: 'auto' }}>{counts.capacity.toFixed(1)} kWp</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 12, padding: '10px 12px' }}>
          <Search size={14} color={muted} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sites…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: text, fontFamily: "'DM Sans', sans-serif" }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
              <X size={13} color={muted} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {['all', 'active', 'commissioning', 'inactive'].map(s => {
            const color = STATUS_COLOR[s] ?? accent;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{ padding: '5px 14px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? color + '50' : border}`, whiteSpace: 'nowrap', flexShrink: 0, background: active ? `${color}20` : 'transparent', color: active ? color : muted, fontFamily: "'DM Sans', sans-serif" }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: '0.65rem', color: muted, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
          {filtered.length} site{filtered.length !== 1 ? 's' : ''}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 20px', background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 16 }}>
              <MapPin size={32} color={border} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: '0.85rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>No sites match filter</div>
            </div>
          ) : filtered.map(site => {
            const gwOnline  = site.gateway_device?.is_online;
            const gwHealth  = site.gateway_device?.heartbeat_health?.severity;
            const status    = site.site_status ?? (site.is_active ? 'active' : 'inactive');
            const sc        = STATUS_COLOR[status] ?? '#60A5FA';
            const devCount  = site.devices?.length ?? 0;
            const onlineDev = site.devices?.filter(d => d.is_online).length ?? 0;
            const isExp     = expanded.has(site.site_id);
            const updated   = fmtUpdated(site.updated_at);

            return (
              <div key={site.site_id} style={{ background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: 4, flexShrink: 0, background: gwOnline ? sc : '#334155' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      onClick={() => toggle(site.site_id)}
                      style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '13px 13px 13px 12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: text, fontFamily: "'Outfit', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{site.display_name}</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, flexShrink: 0, background: `${sc}20`, color: sc, fontFamily: "'DM Sans', sans-serif", border: `1px solid ${sc}40` }}>{status}</span>
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: muted, marginBottom: 5 }}>{site.site_id}</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.67rem', color: gwOnline ? '#2FBF71' : '#64748b', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{gwOnline ? '● Online' : '○ Offline'}</span>
                          {devCount > 0 && <span style={{ fontSize: '0.67rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>{onlineDev}/{devCount} devices</span>}
                          {site.capacity_kw && <span style={{ fontSize: '0.67rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}>{site.capacity_kw} kWp</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/sites/${site.site_id}`); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 10px', borderRadius: 8, background: `${accent}18`, border: `1px solid ${accent}35`, cursor: 'pointer', color: accent, fontSize: '0.65rem', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}
                        >
                          Open <ChevronRight size={11} />
                        </button>
                        {isExp ? <ChevronUp size={13} color={muted} /> : <ChevronDown size={13} color={muted} />}
                      </div>
                    </button>

                    {isExp && (
                      <div style={{ padding: '0 13px 13px 12px', borderTop: `1px solid ${border}` }}>
                        <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {site.capacity_kw && (
                              <div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Capacity</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}><Zap size={10} color="#F59E0B" />{site.capacity_kw} kWp</div>
                              </div>
                            )}
                            {site.latitude != null && (
                              <div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Location</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}><MapPin size={10} color={muted} />{site.latitude.toFixed(3)}°, {site.longitude?.toFixed(3)}°</div>
                              </div>
                            )}
                            {site.timezone && (
                              <div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Timezone</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}><Globe size={10} color={muted} />{site.timezone}</div>
                              </div>
                            )}
                            {site.inverter_capacity_kw && (
                              <div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Inverter cap.</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}><Activity size={10} color={muted} />{site.inverter_capacity_kw} kW</div>
                              </div>
                            )}
                            {updated && (
                              <div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Updated</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}><Clock size={10} color={muted} />{updated}</div>
                              </div>
                            )}
                            {site.gateway_device?.model && (
                              <div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Gateway</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}><Cpu size={10} color={muted} />{site.gateway_device.model}</div>
                              </div>
                            )}
                            {site.gateway_device?.firmware_version && (
                              <div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Firmware</div>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', color: muted }}>{site.gateway_device.firmware_version}</div>
                              </div>
                            )}
                          </div>

                          {(gwHealth === 'warn' || gwHealth === 'critical') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 10, background: gwHealth === 'critical' ? 'rgba(248,113,113,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${gwHealth === 'critical' ? 'rgba(248,113,113,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                              <AlertTriangle size={13} color={gwHealth === 'critical' ? '#F87171' : '#F59E0B'} />
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: gwHealth === 'critical' ? '#F87171' : '#F59E0B', fontFamily: "'DM Sans', sans-serif" }}>Gateway health: {gwHealth}</span>
                            </div>
                          )}

                          {(site.devices?.length ?? 0) > 0 && (
                            <div>
                              <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.45, color: text, fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>Devices</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {site.devices!.map(d => (
                                  <div key={d.device_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 9, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${border}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                      {d.is_online ? <Wifi size={12} color="#2FBF71" /> : <WifiOff size={12} color="#64748b" />}
                                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', fontWeight: 600, color: text }}>{d.device_serial}</span>
                                    </div>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: d.is_online ? '#2FBF71' : '#64748b', fontFamily: "'DM Sans', sans-serif" }}>{d.is_online ? 'Online' : 'Offline'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
