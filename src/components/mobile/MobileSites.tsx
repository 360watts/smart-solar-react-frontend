import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService } from '../../services/api';
import { Wifi, WifiOff, RefreshCw, MapPin, ChevronRight, AlertTriangle, Search, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';

interface SiteDevice {
  device_id: number;
  device_serial: string;
  is_online: boolean;
}

interface GatewayDevice {
  is_online?: boolean;
  last_seen_at?: string;
  signal_strength_dbm?: number | null;
  heartbeat_health?: { severity?: 'ok' | 'warn' | 'critical' } | null;
}

interface SiteRow {
  site_id: string;
  display_name: string;
  latitude?: number;
  longitude?: number;
  site_status?: string;
  is_active?: boolean;
  updated_at?: string;
  devices?: SiteDevice[];
  gateway_device?: GatewayDevice | null;
}

const MobileSites: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const bg      = isDark ? '#020617' : '#f0fdf4';
  const surface = isDark ? '#0f172a' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,166,62,0.15)';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMute = isDark ? '#64748b' : '#94a3b8';
  const textSub  = isDark ? '#94a3b8' : '#475569';
  const accent   = '#00a63e';

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchSites = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiService.getSitesList({ includeInactive: true });
      setSites(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  const filtered = useMemo(() => sites.filter(s => {
    if (statusFilter !== 'all' && (s.site_status ?? 'active') !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.display_name.toLowerCase().includes(q) || s.site_id.toLowerCase().includes(q);
    }
    return true;
  }), [sites, search, statusFilter]);

  const counts = useMemo(() => ({
    total: sites.length,
    active: sites.filter(s => s.site_status === 'active' || s.is_active).length,
    online: sites.filter(s => s.gateway_device?.is_online).length,
    attention: sites.filter(s => {
      const h = s.gateway_device?.heartbeat_health?.severity;
      return h === 'warn' || h === 'critical';
    }).length,
  }), [sites]);

  const statusColor = (status?: string) => {
    if (status === 'active') return '#10b981';
    if (status === 'commissioning') return '#f59e0b';
    if (status === 'inactive' || status === 'archived') return '#64748b';
    return '#3b82f6';
  };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, ...extra,
  });

  const pill = (active: boolean, color = '#00a63e'): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
    cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' as const,
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
          <div style={{ fontWeight: 700, fontSize: '1rem', color: textMain }}>Sites</div>
          <div style={{ fontSize: '0.72rem', color: textMute, marginTop: 2 }}>
            {counts.online} gateways online · {counts.active} active
          </div>
        </div>
        <button onClick={() => { setRefreshing(true); fetchSites(true); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMute, display: 'flex', padding: 8 }}>
          <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      <div style={{ padding: '12px 12px 0' }}>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Total', value: counts.total, color: textMain },
            { label: 'Active', value: counts.active, color: accent },
            { label: 'Online', value: counts.online, color: '#10b981' },
            { label: 'Attention', value: counts.attention, color: counts.attention > 0 ? '#f59e0b' : textMute },
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
            placeholder="Search sites…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: textMain }}
          />
          {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} color={textMute} /></button>}
        </div>

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
          {['all', 'active', 'commissioning', 'inactive'].map(s => (
            <button key={s} style={pill(statusFilter === s, statusColor(s === 'all' ? 'active' : s))} onClick={() => setStatusFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Site cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ ...card({ padding: '40px 20px', textAlign: 'center' }) }}>
              <div style={{ fontSize: '0.875rem', color: textMute }}>No sites match filter</div>
            </div>
          ) : filtered.map(site => {
            const gwOnline = site.gateway_device?.is_online;
            const gwHealth = site.gateway_device?.heartbeat_health?.severity;
            const status = site.site_status ?? (site.is_active ? 'active' : 'inactive');
            const devCount = site.devices?.length ?? 0;

            return (
              <div
                key={site.site_id}
                onClick={() => navigate(`/sites/${site.site_id}`)}
                style={{ ...card({ padding: '14px', cursor: 'pointer' }) }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.display_name}</div>
                    <div style={{ fontSize: '0.68rem', color: textMute, fontFamily: 'monospace', marginTop: 2 }}>{site.site_id}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${statusColor(status)}18`, color: statusColor(status) }}>
                      {status}
                    </span>
                    <ChevronRight size={14} color={textMute} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Gateway status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {gwOnline ? <Wifi size={12} color="#22c55e" /> : <WifiOff size={12} color="#64748b" />}
                    <span style={{ fontSize: '0.7rem', color: gwOnline ? '#22c55e' : textMute, fontWeight: 600 }}>
                      {gwOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  {/* Device count */}
                  {devCount > 0 && (
                    <div style={{ fontSize: '0.7rem', color: textSub }}>
                      {devCount} device{devCount !== 1 ? 's' : ''}
                    </div>
                  )}

                  {/* Location */}
                  {site.latitude != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: textMute }}>
                      <MapPin size={11} />
                      {site.latitude.toFixed(2)}°N
                    </div>
                  )}

                  {/* Health warning */}
                  {(gwHealth === 'warn' || gwHealth === 'critical') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: gwHealth === 'critical' ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                      <AlertTriangle size={11} color={gwHealth === 'critical' ? '#ef4444' : '#f59e0b'} />
                      {gwHealth === 'critical' ? 'Critical' : 'Warning'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileSites;
