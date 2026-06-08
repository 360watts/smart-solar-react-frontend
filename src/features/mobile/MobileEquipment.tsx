import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import finalLogo from '../../assets/finalLogo.png';
import {
  RefreshCw, Zap, Battery, Sun, ChevronDown, ChevronUp,
  Plus, Edit2, Trash2, X, Check, AlertCircle,
  Menu,
} from 'lucide-react';

interface Site { id: number; site_id: string; display_name: string; }
interface Inverter {
  id: number; site: number; make: string; model_name: string; serial_number: string;
  capacity_kva: string; is_active: boolean; notes: string;
  installed_at: string|null; warranty_expires_at: string|null;
  anti_islanding: boolean; teda_scheme: string;
}
interface BatteryItem {
  id: number; site: number; make: string; model_name: string; serial_number: string;
  capacity_kwh: string; is_active: boolean; notes: string;
  installed_at: string|null; warranty_expires_at: string|null;
  nominal_voltage_v: string|null;
}
interface Panel {
  id: number; site: number; make: string; model_name: string; serial_number: string;
  capacity_wp: string; technology: string; is_active: boolean; notes: string;
  installed_at: string|null; warranty_expires_at: string|null;
}
interface Bundle { inverters: Inverter[]; batteries: BatteryItem[]; panels: Panel[]; }

type ActiveSection = 'inverters'|'batteries'|'panels';

const MobileEquipment: React.FC = () => {
  const { isDark } = useTheme();
  const [searchParams] = useSearchParams();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';
  const accent  = '#2FBF71';
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC';

  const [sites, setSites]             = useState<Site[]>([]);
  const [siteId, setSiteId]           = useState('');
  const [bundle, setBundle]           = useState<Bundle|null>(null);
  const [loading, setLoading]         = useState(false);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [section, setSection]         = useState<ActiveSection>('inverters');
  const [expanded, setExpanded]       = useState<Set<number>>(new Set());
  const [error, setError]             = useState('');

  const [modal, setModal]             = useState<'none'|'add'|'edit'|'delete'>('none');
  const [editTarget, setEditTarget]   = useState<any>(null);
  const [saving, setSaving]           = useState(false);
  const [formErr, setFormErr]         = useState('');
  const [form, setForm]               = useState<Record<string,any>>({});

  useEffect(() => {
    apiService.getAllSites().then((d: any) => {
      const list: Site[] = Array.isArray(d) ? d : [];
      setSites(list);
      const fromQuery = searchParams.get('site');
      if (fromQuery) { setSiteId(fromQuery); }
      else if (list.length > 0) { setSiteId(list[0].site_id); }
    }).catch(() => {}).finally(() => setSitesLoading(false));
  }, []);

  const fetchEquipment = useCallback(async (sid: string) => {
    if (!sid) return;
    setLoading(true); setError('');
    try {
      const data = await apiService.getSiteEquipment(sid);
      setBundle(data);
    } catch (e: any) { setError(e?.message ?? 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (siteId) fetchEquipment(siteId); }, [siteId]);

  const toggleExpand = (id: number) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const blankForm = (sec: ActiveSection) => {
    if (sec === 'inverters') return { make:'', model_name:'', serial_number:'', capacity_kva:'', anti_islanding:true, teda_scheme:'', installed_at:'', warranty_expires_at:'', is_active:true, notes:'' };
    if (sec === 'batteries') return { make:'', model_name:'', serial_number:'', capacity_kwh:'', nominal_voltage_v:'', installed_at:'', warranty_expires_at:'', is_active:true, notes:'' };
    return { make:'', model_name:'', serial_number:'', capacity_wp:'', technology:'', installed_at:'', warranty_expires_at:'', is_active:true, notes:'' };
  };

  const openAdd = () => { setForm(blankForm(section)); setFormErr(''); setEditTarget(null); setModal('add'); };
  const openEdit = (item: any) => { setForm({ ...item }); setFormErr(''); setEditTarget(item); setModal('edit'); };

  const handleSave = async () => {
    setSaving(true); setFormErr('');
    try {
      const payload = { ...form };
      ['capacity_kva','capacity_kwh','capacity_wp','nominal_voltage_v'].forEach(k => {
        if (k in payload && payload[k] === '') payload[k] = null;
      });
      ['installed_at','warranty_expires_at'].forEach(k => {
        if (payload[k] === '') payload[k] = null;
      });
      if (section === 'inverters') {
        if (modal === 'add') await apiService.createInverter(siteId, payload);
        else await apiService.updateInverter(siteId, editTarget.id, payload);
      } else if (section === 'batteries') {
        if (modal === 'add') await apiService.createBattery(siteId, payload);
        else await apiService.updateBattery(siteId, editTarget.id, payload);
      } else {
        if (modal === 'add') await apiService.createPanel(siteId, payload);
        else await apiService.updatePanel(siteId, editTarget.id, payload);
      }
      setModal('none'); fetchEquipment(siteId);
    } catch (e: any) { setFormErr(e?.message ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      if (section === 'inverters') await apiService.deleteInverter(siteId, editTarget.id);
      else if (section === 'batteries') await apiService.deleteBattery(siteId, editTarget.id);
      else await apiService.deletePanel(siteId, editTarget.id);
      setModal('none'); fetchEquipment(siteId);
    } catch { } finally { setSaving(false); }
  };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden', ...extra,
  });

  const inputStyle: React.CSSProperties = {
    width:'100%', background:inputBg, border:`1px solid ${border}`, borderRadius:10,
    padding:'10px 14px', fontSize:'0.82rem', color:text, outline:'none', boxSizing:'border-box', fontFamily:"'DM Sans', sans-serif",
  };

  const currentItems: any[] = bundle ? bundle[section] ?? [] : [];
  const sectionColor = { inverters: '#F59E0B', batteries: '#a78bfa', panels: '#f97316' };
  const sectionIcon = { inverters: <Zap size={15}/>, batteries: <Battery size={15}/>, panels: <Sun size={15}/> };

  const siteObj = sites.find(s => s.site_id === siteId);

  const totalKva  = bundle?.inverters.filter(i=>i.is_active).reduce((s,i)=>s+(Number(i.capacity_kva)||0),0) ?? 0;
  const totalKwh  = bundle?.batteries.filter(b=>b.is_active).reduce((s,b)=>s+(Number(b.capacity_kwh)||0),0) ?? 0;
  const totalWp   = bundle?.panels.filter(p=>p.is_active).reduce((s,p)=>{
    const v=Number(p.capacity_wp); return s+(Number.isFinite(v)&&v>0?(v<=20?v*1000:v):0);
  },0) ?? 0;

  return (
    <div style={{ background:bg, minHeight:'100dvh', paddingBottom:68 }}>

      <div style={{ position:'sticky', top:0, zIndex:20, background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)', backdropFilter:'blur(20px)', borderBottom:`1px solid ${border}`, padding:'12px 16px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(47,191,113,0.08)' : 'rgba(47,191,113,0.06)', border: '1px solid rgba(47,191,113,0.18)', boxShadow: '0 2px 8px rgba(47,191,113,0.2)', flexShrink: 0 }}>
              <img src={finalLogo} alt="360Watts" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: text, fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em' }}>360Watts</span>
          </div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))} style={{ background: isDark ? 'rgba(47,191,113,0.1)' : 'rgba(47,191,113,0.08)', border: '1px solid rgba(47,191,113,0.22)', borderRadius: 9, cursor: 'pointer', color: '#2FBF71', padding: '6px', display: 'flex' }}>
            <Menu size={16} />
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:'0.6rem', color:muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:"'DM Sans', sans-serif" }}>Equipment</div>
            <div style={{ fontSize:'1.05rem', fontWeight:700, color:text, marginTop:2, fontFamily:"'Outfit', sans-serif" }}>{siteObj?.display_name ?? 'Select a site'}</div>
          </div>
          <button onClick={() => fetchEquipment(siteId)}
            style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border:`1px solid ${border}`, borderRadius:10, cursor:'pointer', color:muted, padding:'7px 9px', display:'flex' }}>
            <RefreshCw size={15} style={{ animation:loading?'spin 1s linear infinite':'none' }}/>
          </button>
        </div>

        <select value={siteId} onChange={e => setSiteId(e.target.value)}
          style={{ width:'100%', background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', border:`1px solid ${border}`, borderRadius:10, padding:'9px 12px', color:text, fontSize:'0.82rem', outline:'none', fontFamily:"'DM Sans', sans-serif", marginBottom:10 }}>
          {sitesLoading ? <option>Loading…</option> : sites.map(s => (
            <option key={s.site_id} value={s.site_id} style={{ background: isDark?'#0D1117':'#fff', color:text }}>{s.display_name} ({s.site_id})</option>
          ))}
        </select>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
          {[
            { label:'Inverters', value:`${totalKva.toFixed(1)} kVA`, count:bundle?.inverters.length??0, color:'#F59E0B', bg:'rgba(245,158,11,0.1)' },
            { label:'Batteries', value:`${totalKwh.toFixed(1)} kWh`, count:bundle?.batteries.length??0, color:'#a78bfa', bg:'rgba(167,139,250,0.1)' },
            { label:'Panels',    value:`${(totalWp/1000).toFixed(2)} kWp`, count:bundle?.panels.length??0, color:'#f97316', bg:'rgba(249,115,22,0.1)' },
          ].map(({ label, value, count, color, bg: kb }) => (
            <div key={label} style={{ background:kb, borderRadius:10, padding:'8px 4px', textAlign:'center', border:`1px solid ${border}` }}>
              <div style={{ fontSize:'1.15rem', fontWeight:700, color, fontFamily:"'JetBrains Mono', monospace" }}>{count}</div>
              <div style={{ fontSize:'0.57rem', color:muted, marginTop:1, fontFamily:"'DM Sans', sans-serif" }}>{label}</div>
              <div style={{ fontSize:'0.6rem', color, marginTop:1, fontWeight:600, fontFamily:"'JetBrains Mono', monospace" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', background: surface, borderBottom:`1px solid ${border}`, padding:'6px 12px', gap:4 }}>
        {(['inverters','batteries','panels'] as ActiveSection[]).map(s => (
          <button key={s} onClick={() => setSection(s)}
            style={{ flex:1, padding:'7px 4px', background: section===s ? `${sectionColor[s]}18` : 'transparent', border: section===s ? `1px solid ${sectionColor[s]}30` : '1px solid transparent', borderRadius:999, cursor:'pointer', fontSize:'0.68rem', fontWeight:700, color: section===s ? sectionColor[s] : muted, textTransform:'capitalize', transition:'all 150ms', fontFamily:"'DM Sans', sans-serif" }}>
            {s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ margin:'12px', background:'rgba(248,113,113,0.08)', backdropFilter:'blur(16px)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:12, padding:'10px 14px', fontSize:'0.75rem', color:'#F87171', display:'flex', alignItems:'center', gap:6, fontFamily:"'DM Sans', sans-serif" }}>
          <AlertCircle size={14}/>{error}
        </div>
      )}

      <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:8 }}>

        <button onClick={openAdd}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'11px', background:`${accent}12`, border:`1px solid ${accent}25`, borderRadius:12, cursor:'pointer', color:accent, fontSize:'0.82rem', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>
          <Plus size={14}/> Add {section.slice(0,-1)}
        </button>

        {loading && <div style={{ textAlign:'center', padding:'28px 0', color:muted, fontSize:'0.8rem', fontFamily:"'DM Sans', sans-serif" }}>Loading…</div>}

        {!loading && currentItems.length === 0 && (
          <div style={{ textAlign:'center', padding:'36px 0', color:muted, fontSize:'0.82rem', fontFamily:"'DM Sans', sans-serif" }}>No {section} found for this site.</div>
        )}

        {currentItems.map((item: any) => {
          const isExp = expanded.has(item.id);
          const col = sectionColor[section];
          const subtitle = section === 'inverters' ? `${item.capacity_kva} kVA`
            : section === 'batteries' ? `${item.capacity_kwh} kWh`
            : `${item.capacity_wp} Wp`;
          return (
            <div key={item.id} style={card({ opacity: item.is_active ? 1 : 0.55 })}>
              <button onClick={() => toggleExpand(item.id)}
                style={{ width:'100%', background:'none', border:'none', cursor:'pointer', padding:'14px', textAlign:'left', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:`${col}12`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:col, border:`1px solid ${col}20` }}>
                  {sectionIcon[section]}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.88rem', fontWeight:600, color:text, fontFamily:"'DM Sans', sans-serif" }}>{item.make} {item.model_name}</div>
                  <div style={{ fontSize:'0.7rem', color:muted, marginTop:2, fontFamily:"'JetBrains Mono', monospace" }}>S/N: {item.serial_number || '—'} · {subtitle}</div>
                  <span style={{ display:'inline-block', marginTop:5, padding:'2px 8px', borderRadius:999, fontSize:'0.62rem', fontWeight:700, background: item.is_active ? 'rgba(47,191,113,0.12)' : 'rgba(248,113,113,0.12)', color: item.is_active ? accent : '#F87171', fontFamily:"'DM Sans', sans-serif" }}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {isExp ? <ChevronUp size={14} color={muted}/> : <ChevronDown size={14} color={muted}/>}
              </button>

              {isExp && (
                <div style={{ padding:'0 14px 14px', borderTop:`1px solid ${border}`, paddingTop:12, display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    {section === 'inverters' && <>
                      <div><div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Anti-Islanding</div><div style={{ fontSize:'0.78rem', color:text, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}>{item.anti_islanding ? 'Yes' : 'No'}</div></div>
                      <div><div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>TEDA Scheme</div><div style={{ fontSize:'0.78rem', color:text, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}>{item.teda_scheme || '—'}</div></div>
                    </>}
                    {section === 'batteries' && item.nominal_voltage_v && (
                      <div><div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Nominal Voltage</div><div style={{ fontSize:'0.78rem', color:text, marginTop:2, fontFamily:"'JetBrains Mono', monospace" }}>{item.nominal_voltage_v} V</div></div>
                    )}
                    {section === 'panels' && (
                      <div><div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Technology</div><div style={{ fontSize:'0.78rem', color:text, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}>{item.technology || '—'}</div></div>
                    )}
                    {item.installed_at && (
                      <div><div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Installed</div><div style={{ fontSize:'0.78rem', color:text, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}>{new Date(item.installed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div></div>
                    )}
                    {item.warranty_expires_at && (
                      <div><div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Warranty</div><div style={{ fontSize:'0.78rem', color:text, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}>{new Date(item.warranty_expires_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div></div>
                    )}
                  </div>
                  {item.notes && <div style={{ fontSize:'0.72rem', color:muted, fontStyle:'italic', fontFamily:"'DM Sans', sans-serif" }}>{item.notes}</div>}
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <button onClick={() => openEdit(item)}
                      style={{ flex:1, padding:'8px', background:`${accent}12`, border:`1px solid ${accent}25`, borderRadius:10, cursor:'pointer', color:accent, fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontFamily:"'DM Sans', sans-serif" }}>
                      <Edit2 size={12}/> Edit
                    </button>
                    <button onClick={() => { setEditTarget(item); setModal('delete'); }}
                      style={{ flex:1, padding:'8px', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:10, cursor:'pointer', color:'#F87171', fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontFamily:"'DM Sans', sans-serif" }}>
                      <Trash2 size={12}/> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'flex-end' }} onClick={() => setModal('none')}>
          <div style={{ background: isDark ? '#0D1117' : '#FFFFFF', backdropFilter:'blur(20px)', borderRadius:'20px 20px 0 0', padding:'20px 16px 32px', width:'100%', maxHeight:'85dvh', overflowY:'auto', border:`1px solid ${border}` }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:36, height:4, borderRadius:2, background:border, margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:'1rem', fontWeight:700, color:text, fontFamily:"'Outfit', sans-serif" }}>{modal==='add'?'Add':'Edit'} {section.slice(0,-1)}</div>
              <button onClick={() => setModal('none')} style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border:`1px solid ${border}`, borderRadius:8, cursor:'pointer', color:muted, padding:'6px' }}><X size={16}/></button>
            </div>
            {formErr && <div style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:10, padding:'9px 12px', fontSize:'0.75rem', color:'#F87171', marginBottom:14, fontFamily:"'DM Sans', sans-serif" }}>{formErr}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {Object.keys(blankForm(section)).filter(k => !['is_active'].includes(k)).map(key => {
                const isBool = typeof form[key] === 'boolean';
                if (isBool) return (
                  <label key={key} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:'0.82rem', color:text, fontFamily:"'DM Sans', sans-serif" }}>
                    <div onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                      style={{ width:20,height:20,borderRadius:6,border:`1.5px solid ${form[key]?accent:border}`,background:form[key]?accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                      {form[key] && <Check size={12} color="#fff"/>}
                    </div>
                    {key.replace(/_/g,' ')}
                  </label>
                );
                return (
                  <div key={key}>
                    <div style={{ fontSize:'0.62rem', color:muted, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>{key.replace(/_/g,' ')}</div>
                    <input value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle}/>
                  </div>
                );
              })}
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:'0.82rem', color:text, fontFamily:"'DM Sans', sans-serif" }}>
                <div onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  style={{ width:20,height:20,borderRadius:6,border:`1.5px solid ${form.is_active?accent:border}`,background:form.is_active?accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  {form.is_active && <Check size={12} color="#fff"/>}
                </div>
                Active
              </label>
              <button onClick={handleSave} disabled={saving}
                style={{ marginTop:6,padding:'12px',background:accent,border:'none',borderRadius:12,cursor:'pointer',color:'#fff',fontSize:'0.875rem',fontWeight:700,opacity:saving?0.7:1, fontFamily:"'DM Sans', sans-serif" }}>
                {saving?'Saving…':'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'delete' && editTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 16px' }} onClick={() => setModal('none')}>
          <div style={{ background: isDark ? '#0D1117' : '#FFFFFF', backdropFilter:'blur(20px)', borderRadius:20, padding:'22px 18px', width:'100%', maxWidth:360, border:`1px solid ${border}` }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:'1rem', fontWeight:700, color:text, marginBottom:8, fontFamily:"'Outfit', sans-serif" }}>Delete {section.slice(0,-1)}?</div>
            <div style={{ fontSize:'0.82rem', color:muted, marginBottom:22, fontFamily:"'DM Sans', sans-serif" }}>Remove <strong style={{ color:text }}>{editTarget.make} {editTarget.model_name}</strong>?</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setModal('none')} style={{ flex:1,padding:'11px',background:'transparent',border:`1px solid ${border}`,borderRadius:10,cursor:'pointer',color:text,fontSize:'0.82rem', fontFamily:"'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={handleDelete} disabled={saving} style={{ flex:1,padding:'11px',background:'#F87171',border:'none',borderRadius:10,cursor:'pointer',color:'#fff',fontSize:'0.82rem',fontWeight:700, fontFamily:"'DM Sans', sans-serif" }}>
                {saving?'Deleting…':'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
};

export default MobileEquipment;
