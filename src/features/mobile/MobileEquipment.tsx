import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import {
  RefreshCw, Zap, Battery, Sun, ChevronDown, ChevronUp,
  Plus, Edit2, Trash2, X, Check, AlertCircle,
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

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';
  const inputBg = isDark ? '#0a1628' : '#f8fafc';

  const [sites, setSites]             = useState<Site[]>([]);
  const [siteId, setSiteId]           = useState('');
  const [bundle, setBundle]           = useState<Bundle|null>(null);
  const [loading, setLoading]         = useState(false);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [section, setSection]         = useState<ActiveSection>('inverters');
  const [expanded, setExpanded]       = useState<Set<number>>(new Set());
  const [error, setError]             = useState('');

  // Modal
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
      // clean empty strings → null for numeric fields
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
    background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', ...extra,
  });
  const inputStyle: React.CSSProperties = {
    width:'100%', background:inputBg, border:`1px solid ${border}`, borderRadius:8,
    padding:'9px 12px', fontSize:'0.8rem', color:text, outline:'none', boxSizing:'border-box',
  };
  const pill = (active: boolean): React.CSSProperties => ({
    padding:'7px 0', flex:1, borderRadius:8, fontSize:'0.72rem', fontWeight:700,
    cursor:'pointer', border:'none',
    background: active ? `${accent}22` : 'transparent',
    color: active ? accent : muted,
    borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
  });

  const currentItems: any[] = bundle ? bundle[section] ?? [] : [];
  const sectionIcon = { inverters: <Zap size={14}/>, batteries: <Battery size={14}/>, panels: <Sun size={14}/> };
  const sectionColor = { inverters: '#f59e0b', batteries: '#a78bfa', panels: '#f97316' };

  const siteObj = sites.find(s => s.site_id === siteId);

  // Summary stats
  const totalKva  = bundle?.inverters.filter(i=>i.is_active).reduce((s,i)=>s+(Number(i.capacity_kva)||0),0) ?? 0;
  const totalKwh  = bundle?.batteries.filter(b=>b.is_active).reduce((s,b)=>s+(Number(b.capacity_kwh)||0),0) ?? 0;
  const totalWp   = bundle?.panels.filter(p=>p.is_active).reduce((s,p)=>{
    const v=Number(p.capacity_wp); return s+(Number.isFinite(v)&&v>0?(v<=20?v*1000:v):0);
  },0) ?? 0;

  return (
    <div style={{ background:bg, minHeight:'100dvh', paddingBottom:96 }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#004d1e,#006b2b)', padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.6)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Equipment</div>
            <div style={{ fontSize:'1rem', fontWeight:700, color:'#fff', marginTop:1 }}>{siteObj?.display_name ?? 'Select a site'}</div>
          </div>
          <button onClick={() => fetchEquipment(siteId)}
            style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, cursor:'pointer', color:'#fff', padding:'6px 8px', display:'flex' }}>
            <RefreshCw size={15} style={{ animation:loading?'spin 1s linear infinite':'none' }}/>
          </button>
        </div>
        {/* Site picker */}
        <select value={siteId} onChange={e => setSiteId(e.target.value)}
          style={{ width:'100%', background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'8px 10px', color:'#fff', fontSize:'0.8rem', outline:'none' }}>
          {sitesLoading ? <option>Loading…</option> : sites.map(s => (
            <option key={s.site_id} value={s.site_id} style={{ background:isDark?'#0d1829':'#fff', color:text }}>{s.display_name} ({s.site_id})</option>
          ))}
        </select>
        {/* KPI */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginTop:10 }}>
          {[
            { label:'Inverters', value:`${totalKva.toFixed(1)} kVA`, count:bundle?.inverters.length??0, color:'#fcd34d' },
            { label:'Batteries', value:`${totalKwh.toFixed(1)} kWh`, count:bundle?.batteries.length??0, color:'#c4b5fd' },
            { label:'Panels',    value:`${(totalWp/1000).toFixed(2)} kWp`, count:bundle?.panels.length??0, color:'#fb923c' },
          ].map(({ label, value, count, color }) => (
            <div key={label} style={{ background:'rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 4px', textAlign:'center', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize:'1rem', fontWeight:700, color }}>{count}</div>
              <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.55)', marginTop:1 }}>{label}</div>
              <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.8)', marginTop:1, fontWeight:600 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display:'flex', background:surface, borderBottom:`1px solid ${border}` }}>
        {(['inverters','batteries','panels'] as ActiveSection[]).map(s => (
          <button key={s} onClick={() => setSection(s)} style={pill(section===s)}>
            {s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ margin:'12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px 12px', fontSize:'0.75rem', color:'#ef4444', display:'flex', alignItems:'center', gap:6 }}>
          <AlertCircle size={14}/>{error}
        </div>
      )}

      <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:8 }}>

        {/* Add button */}
        <button onClick={openAdd}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', background:`${accent}18`, border:`1px solid ${accent}44`, borderRadius:10, cursor:'pointer', color:accent, fontSize:'0.8rem', fontWeight:600 }}>
          <Plus size={14}/> Add {section.slice(0,-1)}
        </button>

        {loading && <div style={{ textAlign:'center', padding:'24px 0', color:muted, fontSize:'0.8rem' }}>Loading…</div>}

        {!loading && currentItems.length === 0 && (
          <div style={{ textAlign:'center', padding:'32px 0', color:muted, fontSize:'0.8rem' }}>No {section} found for this site.</div>
        )}

        {currentItems.map((item: any) => {
          const isExp = expanded.has(item.id);
          const col = sectionColor[section];
          const subtitle = section === 'inverters' ? `${item.capacity_kva} kVA`
            : section === 'batteries' ? `${item.capacity_kwh} kWh`
            : `${item.capacity_wp} Wp`;
          return (
            <div key={item.id} style={card({ opacity: item.is_active ? 1 : 0.6 })}>
              <button onClick={() => toggleExpand(item.id)}
                style={{ width:'100%', background:'none', border:'none', cursor:'pointer', padding:'12px', textAlign:'left', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:`${col}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:col }}>
                  {sectionIcon[section]}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.85rem', fontWeight:600, color:text }}>{item.make} {item.model_name}</div>
                  <div style={{ fontSize:'0.7rem', color:muted }}>S/N: {item.serial_number || '—'} · {subtitle}</div>
                  <div style={{ fontSize:'0.65rem', color: item.is_active ? accent : '#ef4444', fontWeight:600, marginTop:2 }}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                {isExp ? <ChevronUp size={14} color={muted}/> : <ChevronDown size={14} color={muted}/>}
              </button>

              {isExp && (
                <div style={{ padding:'10px 12px 12px', borderTop:`1px solid ${border}`, display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {section === 'inverters' && <>
                      <div><div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Anti-Islanding</div><div style={{ fontSize:'0.75rem', color:sub }}>{item.anti_islanding ? 'Yes' : 'No'}</div></div>
                      <div><div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>TEDA Scheme</div><div style={{ fontSize:'0.75rem', color:sub }}>{item.teda_scheme || '—'}</div></div>
                    </>}
                    {section === 'batteries' && item.nominal_voltage_v && (
                      <div><div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Nominal Voltage</div><div style={{ fontSize:'0.75rem', color:sub }}>{item.nominal_voltage_v} V</div></div>
                    )}
                    {section === 'panels' && (
                      <div><div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Technology</div><div style={{ fontSize:'0.75rem', color:sub }}>{item.technology || '—'}</div></div>
                    )}
                    {item.installed_at && (
                      <div><div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Installed</div><div style={{ fontSize:'0.75rem', color:sub }}>{new Date(item.installed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div></div>
                    )}
                    {item.warranty_expires_at && (
                      <div><div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Warranty</div><div style={{ fontSize:'0.75rem', color:sub }}>{new Date(item.warranty_expires_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div></div>
                    )}
                  </div>
                  {item.notes && <div style={{ fontSize:'0.72rem', color:sub, fontStyle:'italic' }}>{item.notes}</div>}
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <button onClick={() => openEdit(item)}
                      style={{ flex:1, padding:'7px', background:`${accent}18`, border:`1px solid ${accent}44`, borderRadius:8, cursor:'pointer', color:accent, fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                      <Edit2 size={12}/> Edit
                    </button>
                    <button onClick={() => { setEditTarget(item); setModal('delete'); }}
                      style={{ flex:1, padding:'7px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, cursor:'pointer', color:'#ef4444', fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                      <Trash2 size={12}/> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'flex-end' }} onClick={() => setModal('none')}>
          <div style={{ background:surface, borderRadius:'20px 20px 0 0', padding:'20px 16px 32px', width:'100%', maxHeight:'85dvh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:'1rem', fontWeight:700, color:text }}>{modal==='add'?'Add':'Edit'} {section.slice(0,-1)}</div>
              <button onClick={() => setModal('none')} style={{ background:'none', border:'none', cursor:'pointer', color:muted }}><X size={18}/></button>
            </div>
            {formErr && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'8px 12px', fontSize:'0.75rem', color:'#ef4444', marginBottom:12 }}>{formErr}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {Object.keys(blankForm(section)).filter(k => !['is_active'].includes(k)).map(key => {
                const isBool = typeof form[key] === 'boolean';
                if (isBool) return (
                  <label key={key} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:'0.8rem', color:sub }}>
                    <div onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                      style={{ width:18,height:18,borderRadius:5,border:`1.5px solid ${form[key]?accent:border}`,background:form[key]?accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center' }}>
                      {form[key] && <Check size={11} color="#fff"/>}
                    </div>
                    {key.replace(/_/g,' ')}
                  </label>
                );
                return (
                  <div key={key}>
                    <div style={{ fontSize:'0.7rem', color:muted, marginBottom:4 }}>{key.replace(/_/g,' ')}</div>
                    <input value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle}/>
                  </div>
                );
              })}
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:'0.8rem', color:sub }}>
                <div onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  style={{ width:18,height:18,borderRadius:5,border:`1.5px solid ${form.is_active?accent:border}`,background:form.is_active?accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  {form.is_active && <Check size={11} color="#fff"/>}
                </div>
                Active
              </label>
              <button onClick={handleSave} disabled={saving}
                style={{ marginTop:8,padding:'11px',background:'linear-gradient(135deg,#004d1e,#006b2b)',border:'none',borderRadius:10,cursor:'pointer',color:'#fff',fontSize:'0.875rem',fontWeight:700,opacity:saving?0.7:1 }}>
                {saving?'Saving…':'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'delete' && editTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 16px' }} onClick={() => setModal('none')}>
          <div style={{ background:surface, borderRadius:16, padding:'20px 16px', width:'100%', maxWidth:360 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:'1rem', fontWeight:700, color:text, marginBottom:8 }}>Delete {section.slice(0,-1)}?</div>
            <div style={{ fontSize:'0.8rem', color:sub, marginBottom:20 }}>Remove <strong>{editTarget.make} {editTarget.model_name}</strong>?</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setModal('none')} style={{ flex:1,padding:'10px',background:'transparent',border:`1px solid ${border}`,borderRadius:8,cursor:'pointer',color:text,fontSize:'0.8rem' }}>Cancel</button>
              <button onClick={handleDelete} disabled={saving} style={{ flex:1,padding:'10px',background:'#ef4444',border:'none',borderRadius:8,cursor:'pointer',color:'#fff',fontSize:'0.8rem',fontWeight:700 }}>
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
