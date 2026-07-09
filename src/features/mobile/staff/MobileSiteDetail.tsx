import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api';
import { useTheme } from '../../../contexts/ThemeContext';
import finalLogo from '../../../assets/finalLogo.png';
import { useAuth } from '../../../contexts/AuthContext';
import {
  ArrowLeft, RefreshCw, Wifi, WifiOff, Server, Activity,
  Settings, Save, X, MapPin, Zap, Clock, Link as LinkIcon,
  Unlink, ArrowRightLeft, AlertTriangle,
  Thermometer, MemoryStick, Signal,
  Menu,
} from 'lucide-react';

type Tab = 'overview' | 'gateway' | 'appliances' | 'lifecycle' | 'equipment';
const LIFECYCLE_OPTIONS = ['draft','commissioning','active','inactive','archived'];

const MobileSiteDetail: React.FC = () => {
  const { siteId: siteIdParam } = useParams<{ siteId: string }>();
  const siteId = siteIdParam ? (() => { try { return decodeURIComponent(siteIdParam); } catch { return siteIdParam; } })() : '';
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = 'var(--muted-foreground)';
  const accent  = '#2FBF71';
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC';

  const [tab, setTab]                   = useState<Tab>('overview');
  const [site, setSite]                 = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string|null>(null);
  const [busy, setBusy]                 = useState(false);
  const [editing, setEditing]           = useState(false);
  const [ownerUsers, setOwnerUsers]     = useState<any[]>([]);
  const [applianceData, setApplianceData] = useState<any>({
    num_ac_units: 0, ac_typical_setpoint_c: null, num_geysers: 0,
    geyser_type: '', num_refrigerators: 0, num_washing_machines: 0,
    num_ev_chargers: 0, ev_type: '', has_water_pump: false,
    has_microwave: false, has_desert_cooler: false, appliance_notes: '',
  });
  const [appliancesLoading, setAppliancesLoading] = useState(true);
  const [eqBundle, setEqBundle] = useState<{ inverters: any[]; batteries: any[]; panels: any[] } | null>(null);
  const [eqLoading, setEqLoading] = useState(false);

  const [displayName, setDisplayName]   = useState('');
  const [capacityKw, setCapacityKw]     = useState('');
  const [latitude, setLatitude]         = useState('');
  const [longitude, setLongitude]       = useState('');
  const [ownerUserId, setOwnerUserId]   = useState('');
  const [devicePk, setDevicePk]         = useState('');
  const [moveTarget, setMoveTarget]     = useState('');
  const [lifecycleTo, setLifecycleTo]   = useState('active');

  const refresh = useCallback(async () => {
    if (!siteId || !user?.is_staff) return;
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
  }, [siteId, user]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!siteId) return;
    setAppliancesLoading(true);
    apiService.getSiteProfileAppliances(siteId)
      .then(setApplianceData)
      .catch(e => console.warn('Failed to load appliances:', e))
      .finally(() => setAppliancesLoading(false));
  }, [siteId]);
  useEffect(() => {
    if (!user?.is_staff) { setOwnerUsers([]); return; }
    apiService.getUsers().then((res: any) => {
      setOwnerUsers(Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : []);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (tab !== 'equipment' || !siteId) return;
    setEqLoading(true);
    apiService.getSiteEquipment(siteId).then(d => {
      setEqBundle({ inverters: d.inverters ?? [], batteries: d.batteries ?? [], panels: d.panels ?? [] });
    }).catch(() => {}).finally(() => setEqLoading(false));
  }, [tab, siteId]);

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
    background: surface,
    backdropFilter: 'blur(16px)',
    border: `1px solid ${border}`,
    borderRadius: 12,
    overflow: 'hidden',
    ...extra,
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: inputBg,
    border: `1px solid ${border}`,
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: '0.82rem',
    color: text,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'DM Sans', sans-serif",
  };

  const statusColor: Record<string, string> = {
    active: '#2FBF71', commissioning: '#60A5FA', inactive: '#F87171', draft: 'var(--muted-foreground)', archived: 'var(--border-strong)',
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:bg, gap:10, color:muted }}>
      <RefreshCw size={18} style={{ animation:'spin 1s linear infinite' }}/><span style={{ fontSize:'0.875rem', fontFamily:"'DM Sans', sans-serif" }}>Loading…</span>
    </div>
  );

  const gw = site?.gateway_device;
  const gwOnline = gw?.is_online;
  const hbSeverity = gw?.heartbeat_health?.severity ?? 'ok';

  return (
    <div style={{ background:bg, minHeight:'100dvh', paddingBottom:68 }}>

      <div style={{ position:'sticky', top:0, zIndex:20, background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)', backdropFilter:'blur(20px)', borderBottom:`1px solid ${border}`, padding:'10px 14px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(47,191,113,0.08)' : 'rgba(47,191,113,0.06)', border: '1px solid rgba(47,191,113,0.18)', boxShadow: '0 2px 8px rgba(47,191,113,0.2)', flexShrink: 0 }}>
              <img src={finalLogo} alt="360Watts" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: text, fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em' }}>360Watts</span>
          </div>
          <button aria-label="Open navigation menu" onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))} style={{ background: isDark ? 'rgba(47,191,113,0.1)' : 'rgba(47,191,113,0.08)', border: '1px solid rgba(47,191,113,0.22)', borderRadius: 10, cursor: 'pointer', color: '#2FBF71', padding: 0, display: 'flex', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Menu size={18} />
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button aria-label="Go back" onClick={() => navigate(-1)}
            style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border:`1px solid ${border}`, borderRadius:10, padding:0, cursor:'pointer', color:muted, display:'flex', width:44, height:44, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <ArrowLeft size={16}/>
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'0.62rem', color:muted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:"'DM Sans', sans-serif" }}>{siteId}</div>
            <div style={{ fontSize:'0.95rem', fontWeight:700, color:text, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:"'Outfit', sans-serif" }}>
              {site?.display_name ?? 'Site Detail'}
            </div>
          </div>
          <button aria-label="Refresh site details" onClick={() => refresh()}
            style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border:`1px solid ${border}`, borderRadius:10, padding:0, cursor:'pointer', color:muted, display:'flex', width:44, height:44, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <RefreshCw size={15}/>
          </button>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
          {site?.site_status && (
            <span style={{ padding:'3px 10px', borderRadius:999, fontSize:'0.62rem', fontWeight:700, background:`color-mix(in srgb, ${statusColor[site.site_status]??'var(--muted-foreground)'} 18%, transparent)`, color:statusColor[site.site_status]??'var(--muted-foreground)', border:`1px solid color-mix(in srgb, ${statusColor[site.site_status]??'var(--muted-foreground)'} 30%, transparent)`, fontFamily:"'DM Sans', sans-serif" }}>
              {site.site_status.toUpperCase()}
            </span>
          )}
          {gw && (
            <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:999, fontSize:'0.62rem', fontWeight:700, background: gwOnline ? 'rgba(47,191,113,0.12)' : 'rgba(248,113,113,0.12)', color: gwOnline ? accent : '#F87171', border:`1px solid ${gwOnline?'rgba(47,191,113,0.25)':'rgba(248,113,113,0.25)'}`, fontFamily:"'DM Sans', sans-serif" }}>
              {gwOnline ? <Wifi size={10}/> : <WifiOff size={10}/>} {gwOnline ? 'Online' : 'Offline'}
            </span>
          )}
          {site?.capacity_kw && (
            <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:999, fontSize:'0.62rem', fontWeight:700, background:'rgba(245,158,11,0.12)', color:'#F59E0B', border:'1px solid rgba(245,158,11,0.25)', fontFamily:"'DM Sans', sans-serif" }}>
              <Zap size={10}/> {site.capacity_kw} kWp
            </span>
          )}
        </div>
      </div>

      <div style={{ padding:'0 12px', background: surface, backdropFilter:'blur(16px)', borderBottom:`1px solid ${border}` }}>
        <div style={{ display:'flex', gap:4, padding:'8px 0' }}>
          {(['overview','equipment','gateway','appliances','lifecycle'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex:1, minHeight:44, padding:'7px 4px', background: tab===t ? `${accent}18` : 'transparent', border: tab===t ? `1px solid ${accent}30` : '1px solid transparent', borderRadius:999, cursor:'pointer', fontSize:'0.68rem', fontWeight:700, color: tab===t ? accent : muted, textTransform:'capitalize', transition:'all 150ms', fontFamily:"'DM Sans', sans-serif" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ margin:'12px', background:'rgba(248,113,113,0.08)', backdropFilter:'blur(16px)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:12, padding:'10px 14px', fontSize:'0.75rem', color:'#F87171', display:'flex', alignItems:'center', gap:6, fontFamily:"'DM Sans', sans-serif" }}>
          <AlertTriangle size={14}/>{error}
        </div>
      )}

      <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:10 }}>

        {tab === 'overview' && (
          <>
            <div style={card({ padding:'16px' })}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:'0.78rem', fontWeight:700, color:text, fontFamily:"'Outfit', sans-serif" }}>Site Details</div>
                <button onClick={() => editing ? setEditing(false) : setEditing(true)}
                  style={{ background:`${accent}12`, border:`1px solid ${accent}30`, borderRadius:999, minHeight:44, padding:'5px 14px', cursor:'pointer', color:accent, fontSize:'0.7rem', fontWeight:600, display:'flex', alignItems:'center', gap:4, fontFamily:"'DM Sans', sans-serif" }}>
                  {editing ? <><X size={11}/>Cancel</> : <><Settings size={11}/>Edit</>}
                </button>
              </div>
              {editing ? (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[
                    { label:'Display Name', value:displayName, set:setDisplayName },
                    { label:'Capacity (kWp)', value:capacityKw, set:setCapacityKw },
                    { label:'Latitude', value:latitude, set:setLatitude },
                    { label:'Longitude', value:longitude, set:setLongitude },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <div style={{ fontSize:'0.62rem', color:muted, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>{label}</div>
                      <input value={value} onChange={e => set(e.target.value)} style={inputStyle}/>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize:'0.62rem', color:muted, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Owner User</div>
                    <select value={ownerUserId} onChange={e => setOwnerUserId(e.target.value)} style={{ ...inputStyle }}>
                      <option value="">— None —</option>
                      {ownerUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.username} {u.first_name ? `(${u.first_name})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={handleSaveDetails} disabled={busy}
                    style={{ padding:'12px', background: accent, border:'none', borderRadius:12, cursor:'pointer', color:'#fff', fontSize:'0.85rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:busy?0.7:1, fontFamily:"'DM Sans', sans-serif" }}>
                    <Save size={14}/>{busy ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
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
                      <div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3, fontFamily:"'DM Sans', sans-serif" }}>{label}</div>
                      <div style={{ fontSize:'0.8rem', color:text, fontWeight:500, fontFamily:"'DM Sans', sans-serif", overflowWrap:'anywhere' }}>{value ?? '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {site?.latitude && site?.longitude && (
              <div style={{ ...card(), padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
                <MapPin size={14} color={accent}/>
                <span style={{ fontSize:'0.75rem', color:muted, fontFamily:"'JetBrains Mono', monospace" }}>{site.latitude}, {site.longitude}</span>
              </div>
            )}
          </>
        )}

        {tab === 'gateway' && (
          <>
            {gw ? (
              <div style={card({ padding:'16px' })}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <div style={{ width:4, height:32, borderRadius:2, background: gwOnline ? accent : '#F87171', marginRight:4 }}/>
                  <Server size={16} color={gwOnline ? accent : '#F87171'}/>
                  <div style={{ fontSize:'0.85rem', fontWeight:700, color:text, fontFamily:"'Outfit', sans-serif" }}>Gateway Device</div>
                  <span style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:999, fontSize:'0.62rem', fontWeight:700, background: gwOnline ? 'rgba(47,191,113,0.12)' : 'rgba(248,113,113,0.12)', color: gwOnline ? accent : '#F87171', fontFamily:"'DM Sans', sans-serif" }}>
                    {gwOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
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
                      <div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3, fontFamily:"'DM Sans', sans-serif" }}>{label}</div>
                      <div style={{ fontSize:'0.8rem', color:text, fontWeight:500, fontFamily:"'JetBrains Mono', monospace" }}>{value}</div>
                    </div>
                  ))}
                </div>
                {gw.last_seen_at && (
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.7rem', color:muted, marginBottom:14, fontFamily:"'DM Sans', sans-serif" }}>
                    <Clock size={11}/> Last seen {new Date(gw.last_seen_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                )}
                <button onClick={handleDetach} disabled={busy}
                  style={{ width:'100%', minHeight:44, padding:'10px', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:10, cursor:'pointer', color:'#F87171', fontSize:'0.78rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'DM Sans', sans-serif" }}>
                  <Unlink size={13}/> Detach Gateway
                </button>
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:'0.62rem', color:muted, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Move to site ID</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <input value={moveTarget} onChange={e => setMoveTarget(e.target.value)} placeholder="target_site_id" style={{ ...inputStyle, flex:1 }}/>
                    <button onClick={handleMove} disabled={busy || !moveTarget.trim()}
                      style={{ minHeight:44, padding:'10px 14px', background:`${accent}18`, border:`1px solid ${accent}30`, borderRadius:10, cursor:'pointer', color:accent, fontSize:'0.78rem', fontWeight:600, display:'flex', alignItems:'center', gap:4, fontFamily:"'DM Sans', sans-serif" }}>
                      <ArrowRightLeft size={13}/>Move
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={card({ padding:'16px' })}>
                <div style={{ fontSize:'0.8rem', color:muted, marginBottom:14, fontFamily:"'DM Sans', sans-serif" }}>No gateway attached.</div>
                <div>
                  <div style={{ fontSize:'0.62rem', color:muted, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Attach device by PK</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <input value={devicePk} onChange={e => setDevicePk(e.target.value)} placeholder="Device PK (number)" style={{ ...inputStyle, flex:1 }}/>
                    <button onClick={handleAttach} disabled={busy || !devicePk}
                      style={{ minHeight:44, padding:'10px 14px', background:`${accent}18`, border:`1px solid ${accent}30`, borderRadius:10, cursor:'pointer', color:accent, fontSize:'0.78rem', fontWeight:600, display:'flex', alignItems:'center', gap:4, fontFamily:"'DM Sans', sans-serif" }}>
                      <LinkIcon size={13}/>Attach
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'appliances' && (
          <>
            {appliancesLoading ? (
              <div style={{ ...card(), padding:'24px', textAlign:'center', color:muted }}>
                <RefreshCw size={16} style={{ animation:'spin 1s linear infinite', margin:'0 auto' }} />
              </div>
            ) : (
              <div style={card({ padding:'16px' })}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <Zap size={16} color={accent}/>
                  <div style={{ fontSize:'0.85rem', fontWeight:700, color:text, fontFamily:"'Outfit', sans-serif" }}>Appliance Inventory</div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    { label:'AC Units', value: applianceData.num_ac_units ?? 0 },
                    { label:'AC Capacity', value: applianceData.num_ac_units > 0 && applianceData.ac_total_capacity_kw ? `${applianceData.ac_total_capacity_kw} kW` : '—' },
                    { label:'AC Setpoint', value: applianceData.num_ac_units > 0 && applianceData.ac_typical_setpoint_c ? `${applianceData.ac_typical_setpoint_c}°C` : '—' },
                    { label:'Geysers', value: applianceData.num_geysers ?? 0 },
                    { label:'Geyser Capacity', value: applianceData.num_geysers > 0 && applianceData.geyser_total_capacity_kw ? `${applianceData.geyser_total_capacity_kw} kW` : '—' },
                    { label:'Geyser Type', value: applianceData.num_geysers > 0 && applianceData.geyser_type ? applianceData.geyser_type.replace(/_/g, ' ') : '—' },
                    { label:'Refrigerators', value: applianceData.num_refrigerators ?? 0 },
                    { label:'Washing Machines', value: applianceData.num_washing_machines ?? 0 },
                    { label:'EV Chargers', value: applianceData.num_ev_chargers ?? 0 },
                    { label:'Charger Capacity', value: applianceData.num_ev_chargers > 0 && applianceData.ev_typical_charging_capacity_kw ? `${applianceData.ev_typical_charging_capacity_kw} kW` : '—' },
                    { label:'EV Type', value: applianceData.num_ev_chargers > 0 && applianceData.ev_type ? applianceData.ev_type.replace(/_/g, '-') : '—' },
                    { label:'Water Pump', value: applianceData.has_water_pump ? 'Yes' : 'No' },
                    { label:'Pump Capacity', value: applianceData.has_water_pump && applianceData.water_pump_capacity_hp ? `${applianceData.water_pump_capacity_hp} HP` : '—' },
                    { label:'Microwave', value: applianceData.has_microwave ? 'Yes' : 'No' },
                    { label:'Desert Cooler', value: applianceData.has_desert_cooler ? 'Yes' : 'No' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3, fontFamily:"'DM Sans', sans-serif" }}>{label}</div>
                      <div style={{ fontSize:'0.82rem', color:text, fontWeight:500, fontFamily:"'JetBrains Mono', monospace" }}>{value}</div>
                    </div>
                  ))}
                </div>
                {applianceData.appliance_notes && (
                  <>
                    <div style={{ height:1, background:border, margin:'14px 0' }} />
                    <div style={{ fontSize:'0.62rem', color:muted, marginBottom:5, fontFamily:"'DM Sans', sans-serif" }}>Notes</div>
                    <div style={{ fontSize:'0.8rem', color:muted, fontFamily:"'DM Sans', sans-serif" }}>{applianceData.appliance_notes}</div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'equipment' && (
          <div style={card({ padding: '16px' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Server size={16} color={accent} />
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: text, fontFamily: "'Outfit', sans-serif" }}>Site Equipment</div>
            </div>
            {eqLoading ? (
              <div style={{ textAlign: 'center', color: muted, fontSize: '0.8rem', padding: 20 }}>Loading…</div>
            ) : !eqBundle ? (
              <div style={{ textAlign: 'center', color: muted, fontSize: '0.8rem', padding: 20 }}>No equipment data.</div>
            ) : (
              <>
                {[
                  { label: 'Inverters', items: eqBundle.inverters, summary: (it: any) => `${it.make} ${it.model_name || ''} · ${it.capacity_kva} kVA` },
                  { label: 'Batteries', items: eqBundle.batteries, summary: (it: any) => `${it.make} ${it.model_name || ''} · ${it.capacity_kwh} kWh` },
                  { label: 'Solar Panels', items: eqBundle.panels, summary: (it: any) => `${it.make} ${it.model_name || ''} · ${it.capacity_wp} Wp` },
                ].map(({ label, items, summary }) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
                      {label} ({items.length})
                    </div>
                    {items.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: muted }}>None registered</div>
                    ) : items.map((it: any) => (
                      <div key={it.id} style={{ fontSize: '0.78rem', color: text, padding: '6px 0', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{summary(it)}</span>
                        <span style={{ color: it.is_active ? accent : '#ef4444', fontSize: '0.7rem', fontWeight: 600 }}>{it.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: '0.72rem', color: muted, textAlign: 'center' }}>Use desktop to add or edit equipment</div>
              </>
            )}
          </div>
        )}

        {tab === 'lifecycle' && (
          <div style={card({ padding:'16px' })}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <Activity size={16} color={accent}/>
              <div style={{ fontSize:'0.85rem', fontWeight:700, color:text, fontFamily:"'Outfit', sans-serif" }}>Lifecycle Transition</div>
            </div>
            <div style={{ marginBottom:6, fontSize:'0.62rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Current status</div>
            <div style={{ fontSize:'0.95rem', fontWeight:700, color:statusColor[site?.site_status]??text, marginBottom:18, fontFamily:"'JetBrains Mono', monospace" }}>
              {site?.site_status ?? '—'}
            </div>
            <div style={{ marginBottom:10, fontSize:'0.62rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Transition to</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:18 }}>
              {LIFECYCLE_OPTIONS.map(opt => (
                <button key={opt} onClick={() => setLifecycleTo(opt)}
                  style={{ minHeight:44, padding:'7px 16px', borderRadius:999, border:`1.5px solid ${lifecycleTo===opt ? accent : border}`, background: lifecycleTo===opt ? `${accent}18` : 'transparent', color: lifecycleTo===opt ? accent : muted, fontSize:'0.75rem', fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" }}>
                  {opt}
                </button>
              ))}
            </div>
            <button onClick={handleLifecycle} disabled={busy || lifecycleTo === site?.site_status}
              style={{ width:'100%', minHeight:44, padding:'12px', background: accent, border:'none', borderRadius:12, cursor:'pointer', color:'#fff', fontSize:'0.85rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:busy||lifecycleTo===site?.site_status?0.4:1, fontFamily:"'DM Sans', sans-serif" }}>
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
