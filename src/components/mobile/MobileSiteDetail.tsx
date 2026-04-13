import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import {
  ArrowLeft, RefreshCw, Wifi, WifiOff, Server, Activity,
  Settings, Save, X, MapPin, Zap, Clock, Link as LinkIcon,
  Unlink, ArrowRightLeft, AlertTriangle, ChevronDown, ChevronUp,
  Thermometer, MemoryStick, Signal,
} from 'lucide-react';

type Tab = 'overview' | 'gateway' | 'lifecycle';
const LIFECYCLE_OPTIONS = ['draft','commissioning','active','inactive','archived'];

const MobileSiteDetail: React.FC = () => {
  const { siteId: siteIdParam } = useParams<{ siteId: string }>();
  const siteId = siteIdParam ? (() => { try { return decodeURIComponent(siteIdParam); } catch { return siteIdParam; } })() : '';
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';
  const inputBg = isDark ? '#0a1628' : '#f8fafc';

  const [tab, setTab]                   = useState<Tab>('overview');
  const [site, setSite]                 = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string|null>(null);
  const [busy, setBusy]                 = useState(false);
  const [editing, setEditing]           = useState(false);
  const [ownerUsers, setOwnerUsers]     = useState<any[]>([]);

  // form
  const [displayName, setDisplayName]   = useState('');
  const [capacityKw, setCapacityKw]     = useState('');
  const [latitude, setLatitude]         = useState('');
  const [longitude, setLongitude]       = useState('');
  const [ownerUserId, setOwnerUserId]   = useState('');
  const [devicePk, setDevicePk]         = useState('');
  const [moveTarget, setMoveTarget]     = useState('');
  const [lifecycleTo, setLifecycleTo]   = useState('active');

  const refresh = useCallback(async () => {
    if (!siteId) return;
    setLoading(true); setError(null);
    try {
      const data = await apiService.getSiteStaffDetail(siteId);
      setSite(data);
      setDisplayName(data.display_name ?? '');
      setCapacityKw(data.capacity_kw != null ? String(data.capacity_kw) : '');
      setLatitude(data.latitude != null ? String(data.latitude) : '');
      setLongitude(data.longitude != null ? String(data.longitude) : '');
      setOwnerUserId(data.owner_user != null ? String(data.owner_user) : '');
      setLifecycleTo(data.site_status || 'active');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [siteId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    apiService.getUsers().then((res: any) => {
      setOwnerUsers(Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : []);
    }).catch(() => {});
  }, []);

  const handleSaveDetails = async () => {
    setBusy(true); setError(null);
    try {
      const payload: any = { display_name: displayName.trim() };
      const cap = Number(capacityKw);
      if (capacityKw.trim() && Number.isFinite(cap)) payload.capacity_kw = cap;
      const lat = Number(latitude);
      if (latitude.trim() && Number.isFinite(lat)) payload.latitude = lat;
      const lon = Number(longitude);
      if (longitude.trim() && Number.isFinite(lon)) payload.longitude = lon;
      payload.owner_user_id = ownerUserId.trim() === '' ? null : Number(ownerUserId);
      const data = await apiService.patchSiteStaff(siteId, payload);
      setSite(data); setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  };

  const handleAttach = async () => {
    const pk = parseInt(devicePk, 10);
    if (!pk || isNaN(pk)) return;
    setBusy(true);
    try { const d = await apiService.siteAttachDevice(siteId, pk); setSite(d); setDevicePk(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Attach failed'); }
    finally { setBusy(false); }
  };

  const handleDetach = async () => {
    if (!site?.gateway_device?.device_id) return;
    setBusy(true);
    try { const d = await apiService.siteDetachDevice(siteId, site.gateway_device.device_id); setSite(d); }
    catch (e) { setError(e instanceof Error ? e.message : 'Detach failed'); }
    finally { setBusy(false); }
  };

  const handleMove = async () => {
    if (!site?.gateway_device?.device_id || !moveTarget.trim()) return;
    setBusy(true);
    try { await apiService.siteMoveDevice(moveTarget.trim(), site.gateway_device.device_id, siteId); await refresh(); setMoveTarget(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Move failed'); }
    finally { setBusy(false); }
  };

  const handleLifecycle = async () => {
    setBusy(true);
    try { const d = await apiService.siteLifecycle(siteId, lifecycleTo); setSite(d); }
    catch (e) { setError(e instanceof Error ? e.message : 'Transition failed'); }
    finally { setBusy(false); }
  };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, ...extra,
  });
  const inputStyle: React.CSSProperties = {
    width: '100%', background: inputBg, border: `1px solid ${border}`, borderRadius: 8,
    padding: '9px 12px', fontSize: '0.8rem', color: text, outline: 'none', boxSizing: 'border-box',
  };
  const statusColor: Record<string, string> = {
    active: '#22c55e', commissioning: '#3b82f6', inactive: '#ef4444', draft: '#94a3b8', archived: '#64748b',
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:bg, gap:10, color:muted }}>
      <RefreshCw size={18} style={{ animation:'spin 1s linear infinite' }}/><span style={{ fontSize:'0.875rem' }}>Loading…</span>
    </div>
  );

  const gw = site?.gateway_device;
  const gwOnline = gw?.is_online;
  const hbSeverity = gw?.heartbeat_health?.severity ?? 'ok';

  return (
    <div style={{ background:bg, minHeight:'100dvh', paddingBottom:96 }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#004d1e,#006b2b)', padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <button onClick={() => navigate(-1)}
            style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'6px 8px', cursor:'pointer', color:'#fff', display:'flex' }}>
            <ArrowLeft size={16}/>
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.6)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{siteId}</div>
            <div style={{ fontSize:'1rem', fontWeight:700, color:'#fff', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {site?.display_name ?? 'Site Detail'}
            </div>
          </div>
          <button onClick={() => refresh()}
            style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'6px 8px', cursor:'pointer', color:'#fff', display:'flex' }}>
            <RefreshCw size={15}/>
          </button>
        </div>
        {/* Status chips */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {site?.site_status && (
            <span style={{ padding:'3px 10px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background:`${statusColor[site.site_status]??'#94a3b8'}22`, color:statusColor[site.site_status]??'#94a3b8', border:`1px solid ${statusColor[site.site_status]??'#94a3b8'}44` }}>
              {site.site_status.toUpperCase()}
            </span>
          )}
          {gw && (
            <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background: gwOnline ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: gwOnline ? '#86efac' : '#fca5a5', border:`1px solid ${gwOnline?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}` }}>
              {gwOnline ? <Wifi size={10}/> : <WifiOff size={10}/>} {gwOnline ? 'Online' : 'Offline'}
            </span>
          )}
          {site?.capacity_kw && (
            <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background:'rgba(245,158,11,0.2)', color:'#fcd34d', border:'1px solid rgba(245,158,11,0.3)' }}>
              <Zap size={10}/> {site.capacity_kw} kWp
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', background:surface, borderBottom:`1px solid ${border}`, padding:'0 4px' }}>
        {(['overview','gateway','lifecycle'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex:1, padding:'11px 4px', background:'none', border:'none', cursor:'pointer',
              fontSize:'0.72rem', fontWeight:700, color: tab===t ? accent : muted,
              borderBottom: tab===t ? `2px solid ${accent}` : '2px solid transparent',
              textTransform:'capitalize', transition:'color 150ms' }}>
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ margin:'12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px 12px', fontSize:'0.75rem', color:'#ef4444', display:'flex', alignItems:'center', gap:6 }}>
          <AlertTriangle size={14}/>{error}
        </div>
      )}

      <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:10 }}>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <>
            {/* Site details card */}
            <div style={card({ padding:'14px' })}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:'0.75rem', fontWeight:700, color:text }}>Site Details</div>
                <button onClick={() => editing ? (setEditing(false)) : setEditing(true)}
                  style={{ background:`${accent}18`, border:`1px solid ${accent}44`, borderRadius:8, padding:'5px 10px', cursor:'pointer', color:accent, fontSize:'0.72rem', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                  {editing ? <><X size={11}/>Cancel</> : <><Settings size={11}/>Edit</>}
                </button>
              </div>
              {editing ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    { label:'Display Name', value:displayName, set:setDisplayName },
                    { label:'Capacity (kWp)', value:capacityKw, set:setCapacityKw },
                    { label:'Latitude', value:latitude, set:setLatitude },
                    { label:'Longitude', value:longitude, set:setLongitude },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <div style={{ fontSize:'0.65rem', color:muted, marginBottom:4 }}>{label}</div>
                      <input value={value} onChange={e => set(e.target.value)} style={inputStyle}/>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize:'0.65rem', color:muted, marginBottom:4 }}>Owner User</div>
                    <select value={ownerUserId} onChange={e => setOwnerUserId(e.target.value)}
                      style={{ ...inputStyle }}>
                      <option value="">— None —</option>
                      {ownerUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.username} {u.first_name ? `(${u.first_name})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={handleSaveDetails} disabled={busy}
                    style={{ padding:'11px', background:'linear-gradient(135deg,#004d1e,#006b2b)', border:'none', borderRadius:10, cursor:'pointer', color:'#fff', fontSize:'0.85rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:busy?0.7:1 }}>
                    <Save size={14}/>{busy ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { label:'Site ID',   value:site?.site_id },
                    { label:'Capacity',  value:site?.capacity_kw != null ? `${site.capacity_kw} kWp` : '—' },
                    { label:'Latitude',  value:site?.latitude != null ? String(site.latitude) : '—' },
                    { label:'Longitude', value:site?.longitude != null ? String(site.longitude) : '—' },
                    { label:'Timezone',  value:site?.timezone ?? '—' },
                    { label:'Owner',     value:site?.owner_username ?? '—' },
                    { label:'Created',   value:site?.created_at ? new Date(site.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—' },
                    { label:'Updated',   value:site?.updated_at ? new Date(site.updated_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:'0.78rem', color:sub, fontWeight:500 }}>{value ?? '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Location chip */}
            {site?.latitude && site?.longitude && (
              <div style={{ ...card(), padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
                <MapPin size={14} color={accent}/>
                <span style={{ fontSize:'0.75rem', color:sub }}>{site.latitude}, {site.longitude}</span>
              </div>
            )}
          </>
        )}

        {/* GATEWAY TAB */}
        {tab === 'gateway' && (
          <>
            {gw ? (
              <div style={card({ padding:'14px' })}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <Server size={16} color={accent}/>
                  <div style={{ fontSize:'0.85rem', fontWeight:700, color:text }}>Gateway Device</div>
                  <span style={{ marginLeft:'auto', padding:'3px 8px', borderRadius:999, fontSize:'0.65rem', fontWeight:700,
                    background: gwOnline ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: gwOnline ? '#22c55e' : '#ef4444' }}>
                    {gwOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  {[
                    { label:'Serial',      value:gw.device_serial },
                    { label:'Model',       value:gw.model ?? '—' },
                    { label:'Firmware',    value:gw.firmware_version ?? '—' },
                    { label:'Connectivity',value:gw.connectivity_type ?? '—' },
                    { label:'Signal',      value:gw.signal_strength_dbm != null ? `${gw.signal_strength_dbm} dBm` : '—' },
                    { label:'Temp',        value:gw.device_temp_c != null ? `${gw.device_temp_c.toFixed(1)} °C` : '—' },
                    { label:'Free Heap',   value:gw.memory_status?.free_heap != null ? `${Math.round(gw.memory_status.free_heap/1024)} KB` : '—' },
                    { label:'Health',      value:hbSeverity },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:'0.78rem', color:sub, fontWeight:500 }}>{value}</div>
                    </div>
                  ))}
                </div>
                {gw.last_seen_at && (
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.7rem', color:muted, marginBottom:12 }}>
                    <Clock size={11}/> Last seen {new Date(gw.last_seen_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                )}
                {/* Detach */}
                <button onClick={handleDetach} disabled={busy}
                  style={{ width:'100%', padding:'9px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, cursor:'pointer', color:'#ef4444', fontSize:'0.78rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <Unlink size={13}/> Detach Gateway
                </button>
                {/* Move */}
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:'0.65rem', color:muted, marginBottom:4 }}>Move to site ID</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <input value={moveTarget} onChange={e => setMoveTarget(e.target.value)} placeholder="target_site_id"
                      style={{ ...inputStyle, flex:1 }}/>
                    <button onClick={handleMove} disabled={busy || !moveTarget.trim()}
                      style={{ padding:'9px 12px', background:`${accent}22`, border:`1px solid ${accent}44`, borderRadius:8, cursor:'pointer', color:accent, fontSize:'0.78rem', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                      <ArrowRightLeft size={13}/>Move
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={card({ padding:'14px' })}>
                <div style={{ fontSize:'0.8rem', color:muted, marginBottom:12 }}>No gateway attached.</div>
                <div>
                  <div style={{ fontSize:'0.65rem', color:muted, marginBottom:4 }}>Attach device by PK</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <input value={devicePk} onChange={e => setDevicePk(e.target.value)} placeholder="Device PK (number)"
                      style={{ ...inputStyle, flex:1 }}/>
                    <button onClick={handleAttach} disabled={busy || !devicePk}
                      style={{ padding:'9px 12px', background:`${accent}22`, border:`1px solid ${accent}44`, borderRadius:8, cursor:'pointer', color:accent, fontSize:'0.78rem', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                      <LinkIcon size={13}/>Attach
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* LIFECYCLE TAB */}
        {tab === 'lifecycle' && (
          <div style={card({ padding:'14px' })}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <Activity size={16} color={accent}/>
              <div style={{ fontSize:'0.85rem', fontWeight:700, color:text }}>Lifecycle Transition</div>
            </div>
            <div style={{ marginBottom:6, fontSize:'0.65rem', color:muted }}>Current status</div>
            <div style={{ fontSize:'0.9rem', fontWeight:700, color:statusColor[site?.site_status]??sub, marginBottom:16 }}>
              {site?.site_status ?? '—'}
            </div>
            <div style={{ marginBottom:8, fontSize:'0.65rem', color:muted }}>Transition to</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {LIFECYCLE_OPTIONS.map(opt => (
                <button key={opt} onClick={() => setLifecycleTo(opt)}
                  style={{ padding:'7px 14px', borderRadius:8, border:`1.5px solid ${lifecycleTo===opt ? accent : border}`,
                    background: lifecycleTo===opt ? `${accent}22` : 'transparent',
                    color: lifecycleTo===opt ? accent : sub, fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
                  {opt}
                </button>
              ))}
            </div>
            <button onClick={handleLifecycle} disabled={busy || lifecycleTo === site?.site_status}
              style={{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#004d1e,#006b2b)', border:'none', borderRadius:10, cursor:'pointer', color:'#fff', fontSize:'0.85rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:busy||lifecycleTo===site?.site_status?0.5:1 }}>
              <Activity size={14}/>{busy ? 'Transitioning…' : `Set to "${lifecycleTo}"`}
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
};

export default MobileSiteDetail;
