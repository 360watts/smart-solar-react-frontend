import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import MobileSiteDetail from '../mobile/staff/MobileSiteDetail';
import {
  ArrowLeft, Battery, Server, Wifi, Activity,
  Settings, Save, AlertTriangle,
  RefreshCw, Zap, X,
  Plus, Pencil, Trash2, Sun,
} from 'lucide-react';
import SavingsBillingEditor from './SavingsBillingEditor';
import InverterMeasurementConfig from './InverterMeasurementConfig';
import {
  SetupCard, StatusChip, Field, controlStyle, Btn,
  EmptyState as FriendlyEmptyState, useTokens as useUiTokens,
} from './siteHardware/ui';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../../shared/layout/PageHeader';

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'gateway' | 'lifecycle' | 'appliances' | 'equipment';
const LIFECYCLE_OPTIONS = ['draft', 'commissioning', 'active', 'inactive', 'archived'];
interface OwnerUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}
const MOTION_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const tabVariants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

// ── Equipment section types & helpers (shared with Equipment.tsx CRUD) ────────

interface EqInverter {
  id: number; site: number;
  make: string; model_name: string; serial_number: string; capacity_kva: string;
  max_input_voltage_v: string | null; mppt_voltage_min_v: string | null; mppt_voltage_max_v: string | null;
  operating_voltage_min_v: string | null; operating_voltage_max_v: string | null; max_input_current_a: string | null;
  anti_islanding: boolean; teda_scheme: string;
  installed_at: string | null; warranty_expires_at: string | null; is_active: boolean; notes: string;
  logger_serial: string | null;
}
interface EqBattery {
  id: number; site: number;
  make: string; model_name: string; serial_number: string; capacity_kwh: string;
  nominal_capacity_ah: string | null; nominal_energy_kwh: string | null; nominal_voltage_v: string | null;
  max_charge_current_a: string | null; max_charge_current_peak_a: string | null;
  operating_voltage_min_v: string | null; operating_voltage_max_v: string | null;
  charge_temp_min_c: string | null; charge_temp_max_c: string | null;
  discharge_temp_min_c: string | null; discharge_temp_max_c: string | null;
  installed_at: string | null; warranty_expires_at: string | null; is_active: boolean; notes: string;
}
interface EqPanel {
  id: number; site: number;
  make: string; model_name: string; serial_number: string; capacity_wp: string;
  technology: string; installed_at: string | null; warranty_expires_at: string | null;
  is_active: boolean; notes: string;
}
interface EqBundle { inverters: EqInverter[]; batteries: EqBattery[]; panels: EqPanel[]; }

const EQ_TEXT_FIELDS = new Set(['make','model_name','serial_number','teda_scheme','technology','notes','logger_serial']);
const eqCleanNulls = (obj: Record<string, any>) =>
  Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, v !== '' ? v : EQ_TEXT_FIELDS.has(k) ? '' : null]));
const eqIsBlank = (v: unknown) => String(v ?? '').trim() === '';
const eqParsePos = (v: string | null | undefined): number | null => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null;
};
const eqNormKey = (v: string | null | undefined) => String(v ?? '').trim().toLowerCase();
const eqToPanelWp = (raw: string | null | undefined) => { const n = Number(raw); if (!Number.isFinite(n)||n<=0) return 0; return n<=20?n*1000:n; };
const eqHasDupSerial = <T extends {id:number;make:string;serial_number:string}>(items:T[],make:string,sn:string,curId?:number) =>
  items.some(i => { if(curId!=null&&i.id===curId) return false; return eqNormKey(i.make)===eqNormKey(make)&&eqNormKey(i.serial_number)===eqNormKey(sn); });
const eqValidateInverter = (f: Omit<EqInverter,'id'|'site'>): string | null => {
  if (eqIsBlank(f.make)) return 'Make is required.';
  if (eqIsBlank(f.serial_number)) return 'Serial Number is required.';
  if (eqParsePos(f.capacity_kva)==null) return 'Capacity (kVA) must be a number > 0.';
  const mn=eqParsePos(f.mppt_voltage_min_v),mx=eqParsePos(f.mppt_voltage_max_v);
  if(mn!=null&&mx!=null&&mn>mx) return 'MPPT Min must be ≤ MPPT Max.';
  if(f.installed_at&&f.warranty_expires_at&&f.warranty_expires_at<f.installed_at) return 'Warranty expiry cannot be before install date.';
  return null;
};
const blankEqInverter = (): Omit<EqInverter,'id'|'site'> => ({
  make:'',model_name:'',serial_number:'',capacity_kva:'',
  max_input_voltage_v:'',mppt_voltage_min_v:'',mppt_voltage_max_v:'',
  operating_voltage_min_v:'',operating_voltage_max_v:'',max_input_current_a:'',
  anti_islanding:true,teda_scheme:'',installed_at:'',warranty_expires_at:'',is_active:true,notes:'',logger_serial:'',
});
const blankEqBattery = (): Omit<EqBattery,'id'|'site'> => ({
  make:'',model_name:'',serial_number:'',capacity_kwh:'',
  nominal_capacity_ah:'',nominal_energy_kwh:'',nominal_voltage_v:'',
  max_charge_current_a:'',max_charge_current_peak_a:'',
  operating_voltage_min_v:'',operating_voltage_max_v:'',
  charge_temp_min_c:'',charge_temp_max_c:'',discharge_temp_min_c:'',discharge_temp_max_c:'',
  installed_at:'',warranty_expires_at:'',is_active:true,notes:'',
});
const blankEqPanel = (): Omit<EqPanel,'id'|'site'> => ({
  make:'',model_name:'',serial_number:'',capacity_wp:'',
  technology:'',installed_at:'',warranty_expires_at:'',is_active:true,notes:'',
});

const eqMkT = (isDark: boolean) => ({
  surface: 'var(--card)',
  border:  isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-strong)',
  text:    'var(--foreground)',
  textM:   'var(--muted-foreground)',
});
const eqInput = (isDark: boolean): React.CSSProperties => ({
  padding:'8px 10px',borderRadius:7,width:'100%',boxSizing:'border-box',
  border:isDark?'1px solid rgba(255,255,255,0.12)':'1px solid var(--border-strong)',
  background:'var(--card)',color:'var(--foreground)',fontSize:'0.875rem',
});
const eqLabel = (isDark: boolean): React.CSSProperties => ({
  fontSize:'0.8rem',fontWeight:600,
  color:'var(--muted-foreground)',display:'block',marginBottom:4,
});

const EqFormField: React.FC<{
  label:string;value:string|boolean;onChange:(v:any)=>void;type?:string;isDark:boolean;required?:boolean;placeholder?:string;
}> = ({label,value,onChange,type='text',isDark,required,placeholder}) => {
  if (type==='checkbox') return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <input type="checkbox" checked={value as boolean} onChange={e=>onChange(e.target.checked)} style={{width:16,height:16,accentColor:'#22c55e',cursor:'pointer'}}/>
      <span style={eqLabel(isDark)}>{label}</span>
    </div>
  );
  return (
    <div>
      <label style={eqLabel(isDark)}>{label}{required&&<span style={{color:'var(--muted-foreground)',fontWeight:400}}> · required</span>}</label>
      <input type={type} value={value as string} onChange={e=>onChange(e.target.value)} style={eqInput(isDark)} required={required} placeholder={placeholder}/>
    </div>
  );
};

const EqSectionHeader: React.FC<{icon:React.ReactNode;title:string;count:number;onAdd:()=>void;isDark:boolean}> = ({icon,title,count,onAdd,isDark}) => (
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',borderBottom:isDark?'1px solid rgba(255,255,255,0.08)':'1px solid var(--border-strong)'}}>
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <span style={{color:'#22c55e'}}>{icon}</span>
      <h3 style={{margin:0,fontSize:'1rem',fontWeight:700,color:'var(--foreground)'}}>{title}</h3>
      <span style={{background:isDark?'rgba(34,197,94,0.15)':'#dcfce7',color:'#16a34a',borderRadius:12,padding:'1px 10px',fontSize:'0.75rem',fontWeight:600}}>{count}</span>
    </div>
    <button onClick={onAdd} className="btn" style={{display:'flex',alignItems:'center',gap:6,fontSize:'0.85rem'}}><Plus size={14}/> Add</button>
  </div>
);

const EqDeleteModal: React.FC<{open:boolean;label:string;onConfirm:()=>void;onCancel:()=>void;isDark:boolean}> = ({open,label,onConfirm,onCancel,isDark}) => {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div style={{position:'fixed',inset:0,zIndex:2000,background:isDark?'rgba(0,0,0,0.7)':'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'var(--card)',borderRadius:14,padding:24,width:380,maxWidth:'95vw',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
        <h3 style={{margin:'0 0 8px',color:'var(--foreground)',fontSize:'1.05rem'}}>Remove {label}?</h3>
        <p style={{margin:'0 0 20px',color:'var(--muted-foreground)',fontSize:'0.9rem'}}>It’ll be taken off this site. You can add it again later.</p>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCancel} className="btn btn-secondary">Keep it</button>
          <button onClick={onConfirm} className="btn" style={{background:'#ef4444',color:'#fff',border:'none'}}>Remove</button>
        </div>
      </div>
    </div>, document.body,
  );
};

const EqInverterSection: React.FC<{siteId:string;isDark:boolean;items:EqInverter[];loading:boolean;onRefresh:()=>Promise<void>}> = ({siteId,isDark,items,loading,onRefresh}) => {
  const [err,setErr]=React.useState<string|null>(null);
  const [modal,setModal]=React.useState<{open:boolean;item:EqInverter|null}>({open:false,item:null});
  const [form,setForm]=React.useState(blankEqInverter());
  const [saving,setSaving]=React.useState(false);
  const [del,setDel]=React.useState<EqInverter|null>(null);
  const T=eqMkT(isDark);
  const open=(item?:EqInverter)=>{setForm(item?{...item}:blankEqInverter());setModal({open:true,item:item??null});};
  const f=(k:keyof typeof form,v:any)=>setForm(p=>({...p,[k]:v}));
  const save=async()=>{setErr(null);const ve=eqValidateInverter(form);if(ve){setErr(ve);return;}if(eqHasDupSerial(items,form.make,form.serial_number,modal.item?.id)){setErr('Serial must be unique for this make.');return;}setSaving(true);try{const p=eqCleanNulls(form as any);if(modal.item)await apiService.updateInverter(siteId,modal.item.id,p);else await apiService.createInverter(siteId,p);setModal({open:false,item:null});await onRefresh();}catch(e){setErr(e instanceof Error?e.message:'Save failed');}finally{setSaving(false);}};
  const doDelete=async()=>{if(!del)return;try{await apiService.deleteInverter(siteId,del.id);setDel(null);await onRefresh();}catch(e){setErr(e instanceof Error?e.message:'Delete failed');}};
  return (
    <div style={{background:'var(--card)',borderRadius:10,border:isDark?'1px solid rgba(255,255,255,0.08)':'1px solid var(--border-strong)',marginBottom:20,overflow:'hidden'}}>
      <EqSectionHeader icon={<Zap size={17}/>} title="Inverters" count={items.length} onAdd={()=>open()} isDark={isDark}/>
      {err&&<div style={{padding:'10px 20px',color:'#ef4444',fontSize:'0.875rem'}}>{err}</div>}
      {loading?<div style={{padding:24,textAlign:'center',color:'var(--muted-foreground)',fontSize:'0.875rem'}}>Loading…</div>:items.length===0?<div style={{padding:20}}><FriendlyEmptyState isDark={isDark} headline="No inverters added yet" detail="Add the inverter listed on the customer’s contract."/></div>:(
        <div className="table-responsive"><table className="table" style={{fontSize:'0.875rem'}}>
          <thead><tr><th>Make / Model</th><th>Serial</th><th>Capacity</th><th>MPPT Range</th><th>Installed</th><th>Warranty</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>{items.map(inv=>(
            <tr key={inv.id}>
              <td><div style={{fontWeight:600}}>{inv.make}</div>{inv.model_name&&<div style={{fontSize:'0.75rem',color:T.textM}}>{inv.model_name}</div>}</td>
              <td style={{fontSize:'0.83rem'}}>{inv.serial_number}</td>
              <td>{inv.capacity_kva} kVA</td>
              <td style={{fontSize:'0.8rem'}}>{inv.mppt_voltage_min_v&&inv.mppt_voltage_max_v?`${inv.mppt_voltage_min_v}–${inv.mppt_voltage_max_v} V`:'—'}</td>
              <td>{inv.installed_at||'—'}</td><td>{inv.warranty_expires_at||'—'}</td>
              <td><span style={{color:inv.is_active?'#22c55e':'#ef4444',fontWeight:600,fontSize:'0.8rem'}}>{inv.is_active?'Yes':'No'}</span></td>
              <td><div style={{display:'flex',gap:6}}>
                <button onClick={()=>open(inv)} className="btn btn-secondary" style={{padding:'4px 8px'}}><Pencil size={13}/></button>
                <button onClick={()=>setDel(inv)} className="btn btn-secondary" style={{padding:'4px 8px',color:'#ef4444'}}><Trash2 size={13}/></button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <EqDeleteModal open={!!del} label={del?.serial_number??'inverter'} onConfirm={doDelete} onCancel={()=>setDel(null)} isDark={isDark}/>
      {modal.open&&ReactDOM.createPortal(
        <div style={{position:'fixed',inset:0,zIndex:2000,background:isDark?'rgba(0,0,0,0.7)':'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:T.surface,borderRadius:12,width:'100%',maxWidth:580,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.35)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:`1px solid ${T.border}`}}>
              <h3 style={{margin:0,color:T.text}}>{modal.item?'Edit Inverter':'Add Inverter'}</h3>
              <button onClick={()=>setModal({open:false,item:null})} style={{background:'none',border:'none',cursor:'pointer',color:T.textM}}><X size={20}/></button>
            </div>
            <div style={{overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <EqFormField label="Make" value={form.make} onChange={v=>f('make',v)} isDark={isDark} required placeholder="e.g., Sungrow"/>
                <EqFormField label="Model Name" value={form.model_name} onChange={v=>f('model_name',v)} isDark={isDark} placeholder="e.g., SG33CX"/>
                <EqFormField label="Serial Number" value={form.serial_number} onChange={v=>f('serial_number',v)} isDark={isDark} required placeholder="e.g., INV-2026-0001"/>
                <EqFormField label="Capacity (kVA)" value={form.capacity_kva} onChange={v=>f('capacity_kva',v)} type="number" isDark={isDark} required placeholder="e.g., 10"/>
              </div>
              <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--muted-foreground)',marginTop:8}}>DC input specs <span style={{fontWeight:400}}>· optional</span></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <EqFormField label="Max Input Voltage (V)" value={form.max_input_voltage_v??''} onChange={v=>f('max_input_voltage_v',v)} type="number" isDark={isDark}/>
                <EqFormField label="Max Input Current (A)" value={form.max_input_current_a??''} onChange={v=>f('max_input_current_a',v)} type="number" isDark={isDark}/>
                <EqFormField label="MPPT Min (V)" value={form.mppt_voltage_min_v??''} onChange={v=>f('mppt_voltage_min_v',v)} type="number" isDark={isDark}/>
                <EqFormField label="MPPT Max (V)" value={form.mppt_voltage_max_v??''} onChange={v=>f('mppt_voltage_max_v',v)} type="number" isDark={isDark}/>
                <EqFormField label="Operating Min (V)" value={form.operating_voltage_min_v??''} onChange={v=>f('operating_voltage_min_v',v)} type="number" isDark={isDark}/>
                <EqFormField label="Operating Max (V)" value={form.operating_voltage_max_v??''} onChange={v=>f('operating_voltage_max_v',v)} type="number" isDark={isDark}/>
              </div>
              <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--muted-foreground)',marginTop:8}}>Installation <span style={{fontWeight:400}}>· optional</span></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <EqFormField label="TEDA Scheme" value={form.teda_scheme} onChange={v=>f('teda_scheme',v)} isDark={isDark}/>
                <EqFormField label="Logger Serial" value={form.logger_serial??''} onChange={v=>f('logger_serial',v)} isDark={isDark}/>
                <EqFormField label="Installed Date" value={form.installed_at??''} onChange={v=>f('installed_at',v)} type="date" isDark={isDark}/>
                <EqFormField label="Warranty Expires" value={form.warranty_expires_at??''} onChange={v=>f('warranty_expires_at',v)} type="date" isDark={isDark}/>
              </div>
              <div style={{display:'flex',gap:20}}>
                <EqFormField label="Anti-Islanding" value={form.anti_islanding} onChange={v=>f('anti_islanding',v)} type="checkbox" isDark={isDark}/>
                <EqFormField label="Active" value={form.is_active} onChange={v=>f('is_active',v)} type="checkbox" isDark={isDark}/>
              </div>
              <div><label style={eqLabel(isDark)}>Notes</label><textarea value={form.notes} onChange={e=>f('notes',e.target.value)} rows={2} style={{...eqInput(isDark),resize:'vertical'}}/></div>
            </div>
            <div style={{padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setModal({open:false,item:null})} className="btn btn-secondary">Cancel</button>
              <button onClick={save} className="btn" disabled={saving}>{saving?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>, document.body,
      )}
    </div>
  );
};

const EqBatterySection: React.FC<{siteId:string;isDark:boolean;items:EqBattery[];loading:boolean;onRefresh:()=>Promise<void>}> = ({siteId,isDark,items,loading,onRefresh}) => {
  const [err,setErr]=React.useState<string|null>(null);
  const [modal,setModal]=React.useState<{open:boolean;item:EqBattery|null}>({open:false,item:null});
  const [form,setForm]=React.useState(blankEqBattery());
  const [saving,setSaving]=React.useState(false);
  const [del,setDel]=React.useState<EqBattery|null>(null);
  const T=eqMkT(isDark);
  const open=(item?:EqBattery)=>{setForm(item?{...item}:blankEqBattery());setModal({open:true,item:item??null});};
  const f=(k:keyof typeof form,v:any)=>setForm(p=>({...p,[k]:v}));
  const save=async()=>{setErr(null);if(eqIsBlank(form.make)){setErr('Make is required.');return;}if(eqIsBlank(form.serial_number)){setErr('Serial Number is required.');return;}if(eqParsePos(form.capacity_kwh)==null){setErr('Capacity (kWh) must be > 0.');return;}if(eqHasDupSerial(items,form.make,form.serial_number,modal.item?.id)){setErr('Serial must be unique for this make.');return;}setSaving(true);try{const p=eqCleanNulls(form as any);if(modal.item)await apiService.updateBattery(siteId,modal.item.id,p);else await apiService.createBattery(siteId,p);setModal({open:false,item:null});await onRefresh();}catch(e){setErr(e instanceof Error?e.message:'Save failed');}finally{setSaving(false);}};
  const doDelete=async()=>{if(!del)return;try{await apiService.deleteBattery(siteId,del.id);setDel(null);await onRefresh();}catch(e){setErr(e instanceof Error?e.message:'Delete failed');}};
  return (
    <div style={{background:'var(--card)',borderRadius:10,border:isDark?'1px solid rgba(255,255,255,0.08)':'1px solid var(--border-strong)',marginBottom:20,overflow:'hidden'}}>
      <EqSectionHeader icon={<Battery size={17}/>} title="Batteries" count={items.length} onAdd={()=>open()} isDark={isDark}/>
      {err&&<div style={{padding:'10px 20px',color:'#ef4444',fontSize:'0.875rem'}}>{err}</div>}
      {loading?<div style={{padding:24,textAlign:'center',color:'var(--muted-foreground)',fontSize:'0.875rem'}}>Loading…</div>:items.length===0?<div style={{padding:20}}><FriendlyEmptyState isDark={isDark} headline="No batteries added yet" detail="Add the battery listed on the customer’s contract."/></div>:(
        <div className="table-responsive"><table className="table" style={{fontSize:'0.875rem'}}>
          <thead><tr><th>Make / Model</th><th>Serial</th><th>Capacity</th><th>Nominal Voltage</th><th>Installed</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>{items.map(bat=>(
            <tr key={bat.id}>
              <td><div style={{fontWeight:600}}>{bat.make}</div>{bat.model_name&&<div style={{fontSize:'0.75rem',color:T.textM}}>{bat.model_name}</div>}</td>
              <td style={{fontSize:'0.83rem'}}>{bat.serial_number}</td>
              <td>{bat.capacity_kwh} kWh</td>
              <td>{bat.nominal_voltage_v?`${bat.nominal_voltage_v} V`:'—'}</td>
              <td>{bat.installed_at||'—'}</td>
              <td><span style={{color:bat.is_active?'#22c55e':'#ef4444',fontWeight:600,fontSize:'0.8rem'}}>{bat.is_active?'Yes':'No'}</span></td>
              <td><div style={{display:'flex',gap:6}}>
                <button onClick={()=>open(bat)} className="btn btn-secondary" style={{padding:'4px 8px'}}><Pencil size={13}/></button>
                <button onClick={()=>setDel(bat)} className="btn btn-secondary" style={{padding:'4px 8px',color:'#ef4444'}}><Trash2 size={13}/></button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <EqDeleteModal open={!!del} label={del?.serial_number??'battery'} onConfirm={doDelete} onCancel={()=>setDel(null)} isDark={isDark}/>
      {modal.open&&ReactDOM.createPortal(
        <div style={{position:'fixed',inset:0,zIndex:2000,background:isDark?'rgba(0,0,0,0.7)':'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:T.surface,borderRadius:12,width:'100%',maxWidth:580,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.35)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:`1px solid ${T.border}`}}>
              <h3 style={{margin:0,color:T.text}}>{modal.item?'Edit Battery':'Add Battery'}</h3>
              <button onClick={()=>setModal({open:false,item:null})} style={{background:'none',border:'none',cursor:'pointer',color:T.textM}}><X size={20}/></button>
            </div>
            <div style={{overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <EqFormField label="Make" value={form.make} onChange={v=>f('make',v)} isDark={isDark} required placeholder="e.g., BYD"/>
                <EqFormField label="Model Name" value={form.model_name} onChange={v=>f('model_name',v)} isDark={isDark}/>
                <EqFormField label="Serial Number" value={form.serial_number} onChange={v=>f('serial_number',v)} isDark={isDark} required/>
                <EqFormField label="Capacity (kWh)" value={form.capacity_kwh} onChange={v=>f('capacity_kwh',v)} type="number" isDark={isDark} required/>
              </div>
              <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--muted-foreground)',marginTop:8}}>Electrical specs <span style={{fontWeight:400}}>· optional</span></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <EqFormField label="Nominal Capacity (Ah)" value={form.nominal_capacity_ah??''} onChange={v=>f('nominal_capacity_ah',v)} type="number" isDark={isDark}/>
                <EqFormField label="Nominal Voltage (V)" value={form.nominal_voltage_v??''} onChange={v=>f('nominal_voltage_v',v)} type="number" isDark={isDark}/>
                <EqFormField label="Max Charge (A)" value={form.max_charge_current_a??''} onChange={v=>f('max_charge_current_a',v)} type="number" isDark={isDark}/>
                <EqFormField label="Op. V Min (V)" value={form.operating_voltage_min_v??''} onChange={v=>f('operating_voltage_min_v',v)} type="number" isDark={isDark}/>
                <EqFormField label="Op. V Max (V)" value={form.operating_voltage_max_v??''} onChange={v=>f('operating_voltage_max_v',v)} type="number" isDark={isDark}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <EqFormField label="Installed Date" value={form.installed_at??''} onChange={v=>f('installed_at',v)} type="date" isDark={isDark}/>
                <EqFormField label="Warranty Expires" value={form.warranty_expires_at??''} onChange={v=>f('warranty_expires_at',v)} type="date" isDark={isDark}/>
              </div>
              <EqFormField label="Active" value={form.is_active} onChange={v=>f('is_active',v)} type="checkbox" isDark={isDark}/>
              <div><label style={eqLabel(isDark)}>Notes</label><textarea value={form.notes} onChange={e=>f('notes',e.target.value)} rows={2} style={{...eqInput(isDark),resize:'vertical'}}/></div>
            </div>
            <div style={{padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setModal({open:false,item:null})} className="btn btn-secondary">Cancel</button>
              <button onClick={save} className="btn" disabled={saving}>{saving?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>, document.body,
      )}
    </div>
  );
};

const EqPanelSection: React.FC<{siteId:string;isDark:boolean;items:EqPanel[];loading:boolean;onRefresh:()=>Promise<void>}> = ({siteId,isDark,items,loading,onRefresh}) => {
  const [err,setErr]=React.useState<string|null>(null);
  const [modal,setModal]=React.useState<{open:boolean;item:EqPanel|null}>({open:false,item:null});
  const [form,setForm]=React.useState(blankEqPanel());
  const [saving,setSaving]=React.useState(false);
  const [del,setDel]=React.useState<EqPanel|null>(null);
  const T=eqMkT(isDark);
  const open=(item?:EqPanel)=>{setForm(item?{...item}:blankEqPanel());setModal({open:true,item:item??null});};
  const f=(k:keyof typeof form,v:any)=>setForm(p=>({...p,[k]:v}));
  const save=async()=>{setErr(null);if(eqIsBlank(form.make)){setErr('Make is required.');return;}if(eqIsBlank(form.serial_number)){setErr('Serial Number is required.');return;}if(eqParsePos(form.capacity_wp)==null){setErr('Capacity (Wp) must be > 0.');return;}if(eqHasDupSerial(items,form.make,form.serial_number,modal.item?.id)){setErr('Serial must be unique for this make.');return;}setSaving(true);try{const p=eqCleanNulls(form as any);if(modal.item)await apiService.updatePanel(siteId,modal.item.id,p);else await apiService.createPanel(siteId,p);setModal({open:false,item:null});await onRefresh();}catch(e){setErr(e instanceof Error?e.message:'Save failed');}finally{setSaving(false);}};
  const doDelete=async()=>{if(!del)return;try{await apiService.deletePanel(siteId,del.id);setDel(null);await onRefresh();}catch(e){setErr(e instanceof Error?e.message:'Delete failed');}};
  const activeWp=items.filter(p=>p.is_active).reduce((s,p)=>s+eqToPanelWp(p.capacity_wp),0);
  return (
    <div style={{background:'var(--card)',borderRadius:10,border:isDark?'1px solid rgba(255,255,255,0.08)':'1px solid var(--border-strong)',marginBottom:20,overflow:'hidden'}}>
      <EqSectionHeader icon={<Sun size={17}/>} title="Solar Panels" count={items.length} onAdd={()=>open()} isDark={isDark}/>
      {activeWp>0&&<div style={{padding:'8px 20px',fontSize:'0.8rem',color:'var(--muted-foreground)',borderBottom:isDark?'1px solid rgba(255,255,255,0.06)':'1px solid #f1f5f9'}}>{items.filter(p=>p.is_active).length} active · <strong>{(activeWp/1000).toFixed(2)} kWp</strong> DC</div>}
      {err&&<div style={{padding:'10px 20px',color:'#ef4444',fontSize:'0.875rem'}}>{err}</div>}
      {loading?<div style={{padding:24,textAlign:'center',color:'var(--muted-foreground)',fontSize:'0.875rem'}}>Loading…</div>:items.length===0?<div style={{padding:20}}><FriendlyEmptyState isDark={isDark} headline="No panels added yet" detail="Add panels from the contract — one row per physical panel."/></div>:(
        <div className="table-responsive"><table className="table" style={{fontSize:'0.875rem'}}>
          <thead><tr><th>Make / Model</th><th>Serial</th><th>Capacity (Wp)</th><th>Technology</th><th>Installed</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>{items.map(p=>(
            <tr key={p.id}>
              <td><div style={{fontWeight:600}}>{p.make}</div>{p.model_name&&<div style={{fontSize:'0.75rem',color:T.textM}}>{p.model_name}</div>}</td>
              <td style={{fontSize:'0.83rem'}}>{p.serial_number}</td>
              <td>{eqToPanelWp(p.capacity_wp).toFixed(0)}</td>
              <td>{p.technology||'—'}</td>
              <td>{p.installed_at||'—'}</td>
              <td><span style={{color:p.is_active?'#22c55e':'#ef4444',fontWeight:600,fontSize:'0.8rem'}}>{p.is_active?'Yes':'No'}</span></td>
              <td><div style={{display:'flex',gap:6}}>
                <button onClick={()=>open(p)} className="btn btn-secondary" style={{padding:'4px 8px'}}><Pencil size={13}/></button>
                <button onClick={()=>setDel(p)} className="btn btn-secondary" style={{padding:'4px 8px',color:'#ef4444'}}><Trash2 size={13}/></button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <EqDeleteModal open={!!del} label={del?.serial_number??'panel'} onConfirm={doDelete} onCancel={()=>setDel(null)} isDark={isDark}/>
      {modal.open&&ReactDOM.createPortal(
        <div style={{position:'fixed',inset:0,zIndex:2000,background:isDark?'rgba(0,0,0,0.7)':'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:T.surface,borderRadius:12,width:'100%',maxWidth:480,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.35)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:`1px solid ${T.border}`}}>
              <h3 style={{margin:0,color:T.text}}>{modal.item?'Edit Panel':'Add Panel'}</h3>
              <button onClick={()=>setModal({open:false,item:null})} style={{background:'none',border:'none',cursor:'pointer',color:T.textM}}><X size={20}/></button>
            </div>
            <div style={{overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <EqFormField label="Make" value={form.make} onChange={v=>f('make',v)} isDark={isDark} required placeholder="e.g., Waaree"/>
                <EqFormField label="Model Name" value={form.model_name} onChange={v=>f('model_name',v)} isDark={isDark}/>
                <EqFormField label="Serial Number" value={form.serial_number} onChange={v=>f('serial_number',v)} isDark={isDark} required/>
                <EqFormField label="Capacity (Wp)" value={form.capacity_wp} onChange={v=>f('capacity_wp',v)} type="number" isDark={isDark} required placeholder="e.g., 560"/>
                <div>
                  <label style={eqLabel(isDark)}>Technology</label>
                  <select value={form.technology} onChange={e=>f('technology',e.target.value)} style={{...eqInput(isDark),cursor:'pointer'}}>
                    <option value="">— Select —</option>
                    {['Mono PERC','Mono PERC Half-Cut','TOPCon','Bifacial TOPCon','Bifacial PERC','HJT','Polycrystalline','CIGS','Amorphous'].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <EqFormField label="Installed Date" value={form.installed_at??''} onChange={v=>f('installed_at',v)} type="date" isDark={isDark}/>
                <EqFormField label="Warranty Expires" value={form.warranty_expires_at??''} onChange={v=>f('warranty_expires_at',v)} type="date" isDark={isDark}/>
              </div>
              <EqFormField label="Active" value={form.is_active} onChange={v=>f('is_active',v)} type="checkbox" isDark={isDark}/>
              <div><label style={eqLabel(isDark)}>Notes</label><textarea value={form.notes} onChange={e=>f('notes',e.target.value)} rows={2} style={{...eqInput(isDark),resize:'vertical'}} placeholder="Per-panel capacity in Wp (not total array)"/></div>
            </div>
            <div style={{padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setModal({open:false,item:null})} className="btn btn-secondary">Cancel</button>
              <button onClick={save} className="btn" disabled={saving}>{saving?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>, document.body,
      )}
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export default function SiteDetail() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileSiteDetail />;
  const { siteId: siteIdParam } = useParams<{ siteId: string }>();
  const siteId = siteIdParam ? (() => { try { return decodeURIComponent(siteIdParam); } catch { return siteIdParam; } })() : '';
  const { isDark } = useTheme();
  const { user } = useAuth();

  // ── State ──
  const [tab, setTab] = useState<Tab>('overview');
  const [site, setSite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [ownerUsers, setOwnerUsers] = useState<OwnerUser[]>([]);
  const [usersBusy, setUsersBusy] = useState(false);
  const [calcBusy, setCalcBusy] = useState(false);
  const [eqBundle, setEqBundle] = useState<EqBundle | null>(null);
  const [eqLoading, setEqLoading] = useState(false);
  const [eqError, setEqError] = useState<string | null>(null);
  const [calcNote, setCalcNote] = useState<string | null>(null);

  // Form State
  const [lifecycleTo, setLifecycleTo] = useState('active');
  const [displayName, setDisplayName] = useState('');
  const [capacityKw, setCapacityKw] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [deyeStationId, setDeyeStationId] = useState('');
  const [loggerSerial, setLoggerSerial] = useState('');
  const [savedLoggerSerial, setSavedLoggerSerial] = useState('');
  const [activeInverterId, setActiveInverterId] = useState<number | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [vendorGst, setVendorGst] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [commissionedOn, setCommissionedOn] = useState('');
  const [editingDeyeSettings, setEditingDeyeSettings] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // Appliance Inventory State
  const [applianceData, setApplianceData] = useState<any>({
    num_ac_units: 0,
    ac_typical_setpoint_c: null,
    num_geysers: 0,
    geyser_type: '',
    num_refrigerators: 0,
    num_washing_machines: 0,
    num_ev_chargers: 0,
    ev_type: '',
    has_water_pump: false,
    has_microwave: false,
    has_desert_cooler: false,
    appliance_notes: '',
  });
  const [editingAppliances, setEditingAppliances] = useState(false);
  const [applianceDraft, setApplianceDraft] = useState<Record<string, any>>({});
  const [appliancesLoading, setAppliancesLoading] = useState(true);

  // ── Design Tokens ──
  const ut = useUiTokens(isDark);
  // Read-only-until-editing input style, in the friendly control shape.
  const roStyle = (editing: boolean, extra: React.CSSProperties = {}): React.CSSProperties => ({
    ...controlStyle(isDark), opacity: editing ? 1 : 0.65,
    cursor: editing ? 'auto' : 'not-allowed', ...extra,
  });
  const ToggleRow = ({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) => (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', borderRadius: 12,
      border: `1.5px solid ${checked ? ut.good : ut.line}`, background: checked ? ut.goodBg : ut.card2,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
    }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} style={{ accentColor: ut.good, width: 17, height: 17, marginTop: 1 }} />
      <span>
        <span style={{ fontSize: '0.88rem', fontWeight: 500, color: ut.ink }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: '0.78rem', color: ut.ink2, marginTop: 2 }}>{hint}</span>}
      </span>
    </label>
  );
  const surface     = 'var(--card)';
  const border      = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.15)';
  const inputBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)';
  const textMain    = 'var(--foreground)';
  const textMute    = 'var(--muted-foreground)';
  const textSub     = 'var(--muted-foreground)';
  const primary     = '#00a63e';
  const nativeSelectBg = 'var(--foreground)';
  const nativeSelectFg = 'var(--foreground)';

  const palette = {
    ok:   { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
    warn: { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
    err:  { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
    info: { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6', border: 'rgba(59,130,246,0.2)'  },
    mute: { bg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: textSub, border: inputBorder },
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return palette.ok;
      case 'commissioning': return palette.info;
      case 'inactive': return palette.err;
      case 'draft': case 'archived': default: return palette.mute;
    }
  };

  // Friendly, non-technical status wording + calm colour state (see UI_GUIDE.md).
  const STATUS_WORD: Record<string, string> = {
    draft: 'Draft', commissioning: 'Being set up', active: 'Live',
    inactive: 'Paused', archived: 'Archived',
  };
  const statusWord = (s: string) => STATUS_WORD[s] ?? s;
  const statusState = (s: string): 'good' | 'wait' | 'idle' =>
    s === 'active' ? 'good' : (s === 'commissioning' || s === 'inactive') ? 'wait' : 'idle';

  // ── Shared Styles ──
  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '10px 14px', borderRadius: 8,
    border: `1px solid ${inputBorder}`, background: inputBg, color: textMain,
    fontSize: '0.85rem', outline: 'none', transition: 'border-color 150ms',
    minWidth: 180
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', 
    letterSpacing: '0.05em', color: textMute, display: 'block', marginBottom: 6
  };

  const buttonStyle = (isSecondary = false, isDanger = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 16px', borderRadius: 8, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
    background: isDanger ? palette.err.bg : isSecondary ? palette.mute.bg : primary,
    color: isDanger ? palette.err.color : isSecondary ? textMain : '#fff',
    borderStyle: 'solid', borderWidth: 1,
    borderColor: isDanger ? palette.err.border : isSecondary ? palette.mute.border : primary,
    fontSize: '0.85rem', fontWeight: 600, transition: 'all 150ms', opacity: busy ? 0.7 : 1,
    boxShadow: isSecondary || isDanger ? 'none' : '0 4px 12px rgba(0,166,62,0.2)'
  });

  // ── Data Fetching & Handlers ──
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
      // Seed a minimal owner option immediately so the (disabled, read-only) Owner
      // User select shows the correct name before "Edit Details" is clicked — the
      // full dropdown list is intentionally lazy-loaded only on edit (loadOwnerUsers),
      // so without this the select has no matching <option> yet and silently falls
      // back to its "Unassigned" placeholder despite the site having a real owner.
      if (data.owner_user != null && !usersLoadedRef.current) {
        setOwnerUsers([{ id: data.owner_user, first_name: data.owner_username || '', last_name: '', username: '' }]);
      }
      setLifecycleTo(data.site_status || 'active');
      setDeyeStationId(data.deye_station_id != null ? String(data.deye_station_id) : '');
      try {
        const eq = await apiService.getSiteEquipment(siteId);
        const activeInv = (eq.inverters ?? []).find((i: any) => i.is_active !== false) ?? null;
        setActiveInverterId(activeInv?.id ?? null);
        setLoggerSerial(activeInv?.logger_serial ?? '');
        setSavedLoggerSerial(activeInv?.logger_serial ?? '');
      } catch {
        setActiveInverterId(null);
        setLoggerSerial('');
        setSavedLoggerSerial('');
      }
      setVendorName(data.vendor_name ?? '');
      setVendorGst(data.vendor_gst ?? '');
      setVendorPhone(data.vendor_phone ?? '');
      setVendorEmail(data.vendor_email ?? '');
      setCommissionedOn(data.commissioned_on ?? '');
    } catch (e) {
      setSite(null);
      setError(e instanceof Error ? e.message : 'Failed to load site');
    } finally {
      setLoading(false);
    }
  }, [siteId, user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!siteId) return;
    let mounted = true;
    const loadAppliances = async () => {
      setAppliancesLoading(true);
      try {
        const data = await apiService.getSiteProfile(siteId);
        if (mounted) {
          setApplianceData(data);
          setApplianceDraft(data);
        }
      } catch (e) {
        // Appliance endpoint uses get_or_create, so error shouldn't happen
        // But if it does, keep defaults initialized above
        if (mounted) console.warn('Failed to load appliances:', e);
      } finally {
        if (mounted) setAppliancesLoading(false);
      }
    };
    // This page's own refresh() already fires several concurrent requests on mount —
    // staggering the non-critical ones behind a short delay keeps this page from
    // adding to that burst and tripping the backend's throttle.
    const kickoff = setTimeout(loadAppliances, 900);
    return () => {
      mounted = false;
      clearTimeout(kickoff);
    };
  }, [siteId]);

  // The owner dropdown this list feeds is disabled until editingDetails is true
  // (see the "Owner User" <select>), so there's no reason to fetch it on every
  // mount — load it lazily the moment the user actually opens the edit form
  // (see the "Edit" button's onClick below), not unconditionally after mount.
  const usersLoadedRef = useRef(false);
  const loadOwnerUsers = useCallback(async () => {
    if (!user?.is_staff || usersLoadedRef.current) return;
    usersLoadedRef.current = true;
    setUsersBusy(true);
    try {
      const response = await apiService.getUsers();
      const users = Array.isArray(response?.results) ? response.results : Array.isArray(response) ? response : [];
      // The dropdown only shows the most recently created 25 customers — the
      // site's current owner can easily fall outside that window, which made
      // the select silently fall back to its "Unassigned" placeholder option
      // even though the site had a real owner. Fetch and merge it in if missing.
      const currentOwnerId = site?.owner_user;
      if (currentOwnerId != null && !users.some((u: any) => u.id === currentOwnerId)) {
        const owner = await apiService.getUserById(currentOwnerId).catch(() => null);
        if (owner) users.unshift(owner);
      }
      setOwnerUsers(users);
    } catch {
      setOwnerUsers([]);
      usersLoadedRef.current = false; // allow retry on next edit-open
    } finally {
      setUsersBusy(false);
    }
  }, [user, site]);

  // Load equipment when equipment tab is opened
  const refreshEquipment = useCallback(async () => {
    if (!siteId) return;
    setEqLoading(true); setEqError(null);
    try {
      const data = await apiService.getSiteEquipment(siteId);
      setEqBundle({
        inverters: Array.isArray(data.inverters) ? data.inverters : [],
        batteries: Array.isArray(data.batteries) ? data.batteries : [],
        panels: Array.isArray(data.panels) ? data.panels : [],
      });
    } catch (e) {
      setEqError(e instanceof Error ? e.message : 'Failed to load equipment');
    } finally {
      setEqLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    if (tab !== 'equipment') return;
    refreshEquipment();
  }, [tab, refreshEquipment]);

  const handleLifecycle = async () => {
    setBusy(true); setError(null);
    try {
      const data = await apiService.siteLifecycle(siteId, lifecycleTo);
      setSite(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Lifecycle transition failed'); }
    finally { setBusy(false); }
  };

  const handleDeleteSite = async () => {
    if (deleteConfirmationText !== 'delete') return;
    setBusy(true); setError(null);
    try {
      await apiService.deleteSite(siteId);
      window.location.href = '/sites';
    } catch (e) { setError(e instanceof Error ? e.message : 'Site deletion failed'); }
    finally { setBusy(false); }
  };

  const resetDetailsForm = () => {
    setDisplayName(site?.display_name ?? '');
    setCapacityKw(site?.capacity_kw != null ? String(site.capacity_kw) : '');
    setLatitude(site?.latitude != null ? String(site.latitude) : '');
    setLongitude(site?.longitude != null ? String(site.longitude) : '');
    setOwnerUserId(site?.owner_user != null ? String(site.owner_user) : '');
    setVendorName(site?.vendor_name ?? '');
    setVendorGst(site?.vendor_gst ?? '');
    setCommissionedOn(site?.commissioned_on ?? '');
    setVendorPhone(site?.vendor_phone ?? '');
    setVendorEmail(site?.vendor_email ?? '');
    setCalcNote(null);
  };

  const calcCapacityFromEquipment = async () => {
    setCalcBusy(true); setCalcNote(null);
    try {
      const eq = await apiService.getSiteEquipment(siteId);
      // toPanelWp: old rows may store kWp-style values, so n<=20 → ×1000
      const toPanelWp = (raw: string | null | undefined) => {
        const n = Number(raw); if (!Number.isFinite(n) || n <= 0) return 0;
        return n <= 20 ? n * 1000 : n;
      };
      const activePanels = (eq.panels ?? []).filter((p: any) => p.is_active !== false);
      const totalPanelWp = activePanels.reduce((s: number, p: any) => s + toPanelWp(p.capacity_wp), 0);
      if (totalPanelWp > 0) {
        const kWp = +(totalPanelWp / 1000).toFixed(2);
        setCapacityKw(String(kWp));
        setCalcNote(`${activePanels.length} panel${activePanels.length !== 1 ? 's' : ''} → ${kWp} kWp`);
        return;
      }
      const activeInverters = (eq.inverters ?? []).filter((i: any) => i.is_active !== false);
      const totalKva = activeInverters.reduce((s: number, i: any) => s + (Number(i.capacity_kva) || 0), 0);
      if (totalKva > 0) {
        const kva = +totalKva.toFixed(2);
        setCapacityKw(String(kva));
        setCalcNote(`${activeInverters.length} inverter${activeInverters.length !== 1 ? 's' : ''} → ${kva} kVA`);
        return;
      }
      setCalcNote('No equipment found for this site.');
    } catch {
      setCalcNote('Failed to fetch equipment.');
    } finally {
      setCalcBusy(false);
    }
  };

  const saveSiteDetails = async () => {
    setBusy(true); setError(null);
    try {
      const payload: Record<string, unknown> = {
        display_name: displayName.trim(),
      };

      const parsedCapacity = Number(capacityKw);
      const parsedLatitude = Number(latitude);
      const parsedLongitude = Number(longitude);

      if (capacityKw.trim() !== '' && Number.isFinite(parsedCapacity)) payload.capacity_kw = parsedCapacity;
      if (latitude.trim() !== '' && Number.isFinite(parsedLatitude)) payload.latitude = parsedLatitude;
      if (longitude.trim() !== '' && Number.isFinite(parsedLongitude)) payload.longitude = parsedLongitude;
      payload.owner_user_id = ownerUserId.trim() === '' ? null : Number(ownerUserId);
      payload.vendor_name = vendorName.trim();
      payload.vendor_gst = vendorGst.trim();
      payload.vendor_phone = vendorPhone.trim();
      payload.vendor_email = vendorEmail.trim();
      payload.commissioned_on = commissionedOn.trim() === '' ? null : commissionedOn.trim();

      const data = await apiService.patchSiteStaff(siteId, payload);
      setSite(data);
      setEditingDetails(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); } 
    finally { setBusy(false); }
  };

  const resetDeyeSettingsForm = () => {
    setDeyeStationId(site?.deye_station_id != null ? String(site.deye_station_id) : '');
    setLoggerSerial(savedLoggerSerial);
  };

  const saveDeyeSettings = async () => {
    setBusy(true);
    setError(null);
    try {
      const parsedStation = deyeStationId.trim() === '' ? null : Number(deyeStationId);
      if (parsedStation !== null && Number.isNaN(parsedStation)) {
        throw new Error('Invalid Deye Station ID');
      }

      // Deye Station ID lives on the site
      const sitePayload: Record<string, unknown> = {
        deye_station_id: parsedStation,
      };
      const data = await apiService.patchSiteStaff(siteId, sitePayload);
      setSite(data);

      // Logger Serial lives on the site's active inverter
      const value = loggerSerial.trim() === '' ? null : loggerSerial.trim();
      if (activeInverterId != null) {
        await apiService.updateInverter(siteId, activeInverterId, { logger_serial: value });
        setSavedLoggerSerial(value ?? '');
      } else if (value !== null) {
        throw new Error('No active inverter on this site — add one on the Equipment tab before setting Logger Serial');
      }

      setEditingDeyeSettings(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const resetAppliancesForm = () => {
    if (applianceData) setApplianceDraft(applianceData);
  };

  const saveAppliances = async () => {
    setBusy(true); setError(null);
    try {
      const updated = await apiService.updateSiteProfile(siteId, applianceDraft);
      setApplianceData(updated);
      setApplianceDraft(updated);
      setEditingAppliances(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save appliances');
    } finally {
      setBusy(false);
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="admin-container responsive-page" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={24} color={textMute} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  // ── Main Render ──
  return (
    <div className="admin-container responsive-page" style={{ paddingBottom: 60 }}>
      
      <PageHeader
        icon={<Server size={20} color="white" />}
        title={site?.display_name || 'Unnamed Site'}
        subtitle={siteId}
        rightSlot={
          <Link
            to="/sites"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, color: textMute, fontSize: '0.85rem', fontWeight: 600, transition: 'color 150ms' }}
            onMouseEnter={e => e.currentTarget.style.color = textMain}
            onMouseLeave={e => e.currentTarget.style.color = textMute}
          >
            <ArrowLeft size={16} /> Back to Sites
          </Link>
        }
      />

      <div style={{ maxWidth: 800, margin: '32px auto 0', padding: '0 24px' }}>
        
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 24, background: palette.err.bg, border: `1px solid ${palette.err.border}`, color: palette.err.color, fontSize: '0.85rem', fontWeight: 500 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Sub-header Profile Card ── */}
        {site && (
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,166,62,0.03)' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: ut.ink2, marginBottom: 6 }}>Status</div>
              <StatusChip isDark={isDark} state={statusState(site.site_status)}>{statusWord(site.site_status)}</StatusChip>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: ut.ink2, marginBottom: 4 }}>System size</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: textMain }}>{site.capacity_kw} <span style={{ fontSize: '0.8rem', color: textMute }}>kW</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: ut.ink2, marginBottom: 4 }}>Customer</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 500, color: textMain }}>{site.owner_username || (site.owner_user != null ? `Customer #${site.owner_user}` : 'Not assigned yet')}</div>
            </div>
          </div>
        )}

        {/* ── Segmented Tabs ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 6, background: inputBg, borderRadius: 12, border: `1px solid ${inputBorder}`, marginBottom: 24 }}>
          {[
            { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
            { id: 'equipment', label: 'Equipment', icon: <Server size={14} /> },
            { id: 'gateway', label: 'Inverter & monitoring', icon: <Wifi size={14} /> },
            { id: 'appliances', label: 'What’s in the home', icon: <Zap size={14} /> },
            { id: 'lifecycle', label: 'Site status', icon: <Settings size={14} /> }
          ].map(t => (
            <button
              key={t.id} onClick={() => setTab(t.id as Tab)}
              style={{
                flex: '1 1 120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600, transition: 'all 200ms', whiteSpace: 'nowrap',
                background: tab === t.id ? (isDark ? 'rgba(255,255,255,0.08)' : '#ffffff') : 'transparent',
                color: tab === t.id ? textMain : textMute,
                boxShadow: tab === t.id && !isDark ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div style={{ position: 'relative' }}>
          <AnimatePresence mode="wait">
            
            {/* OVERVIEW TAB */}
            {tab === 'overview' && site && (
              <motion.div key="overview" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                {(() => {
                  const ro = (v: React.CSSProperties = {}): React.CSSProperties => ({
                    ...controlStyle(isDark), opacity: editingDetails ? 1 : 0.65,
                    cursor: editingDetails ? 'auto' : 'not-allowed', ...v,
                  });
                  return (
                <SetupCard
                  isDark={isDark}
                  icon={<Server size={21} strokeWidth={1.8} />}
                  title="Site details"
                  purpose="The name, size and customer for this address."
                  status={!editingDetails
                    ? <Btn isDark={isDark} variant="soft" size="sm" disabled={busy} onClick={() => { setEditingDetails(true); loadOwnerUsers(); }}><Settings size={14} /> Edit</Btn>
                    : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn isDark={isDark} variant="plain" size="sm" disabled={busy} onClick={() => { resetDetailsForm(); setEditingDetails(false); }}>Cancel</Btn>
                        <Btn isDark={isDark} size="sm" disabled={busy} onClick={saveSiteDetails}><Save size={14} /> Save</Btn>
                      </div>
                    )}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <Field isDark={isDark} label="Site name">
                      <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={ro()} placeholder="e.g. Ramesh — Coimbatore" disabled={!editingDetails || busy} />
                    </Field>
                    <Field isDark={isDark} label="System size" hint={calcNote ?? 'in kilowatts (kW)'}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="number" step="0.01" value={capacityKw} onChange={e => { setCapacityKw(e.target.value); setCalcNote(null); }} style={ro({ flex: 1 })} placeholder="e.g. 5.5" disabled={!editingDetails || busy} />
                        {editingDetails && (
                          <Btn isDark={isDark} variant="plain" size="sm" disabled={calcBusy || busy} onClick={calcCapacityFromEquipment}>
                            {calcBusy ? '…' : 'Work it out'}
                          </Btn>
                        )}
                      </div>
                    </Field>
                    <Field isDark={isDark} label="Customer">
                      <select value={ownerUserId} onChange={e => setOwnerUserId(e.target.value)} style={ro()} disabled={!editingDetails || busy || usersBusy}>
                        <option value="">Not assigned yet</option>
                        {ownerUsers.map((u) => {
                          const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                          const label = fullName ? `${fullName} (${u.username || `#${u.id}`})` : (u.username || `User #${u.id}`);
                          return <option key={u.id} value={String(u.id)}>{label}</option>;
                        })}
                      </select>
                    </Field>
                    <Field isDark={isDark} label="Latitude" hint="for weather & sun position">
                      <input type="number" step="0.0001" value={latitude} onChange={e => setLatitude(e.target.value)} style={ro()} placeholder="e.g. 11.0168" disabled={!editingDetails || busy} />
                    </Field>
                    <Field isDark={isDark} label="Longitude">
                      <input type="number" step="0.0001" value={longitude} onChange={e => setLongitude(e.target.value)} style={ro()} placeholder="e.g. 76.9558" disabled={!editingDetails || busy} />
                    </Field>
                  </div>

                  <div style={{ height: 1, background: ut.line2, margin: '6px 0' }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: ut.ink }}>Installer</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <Field isDark={isDark} label="Company name">
                      <input value={vendorName} onChange={e => setVendorName(e.target.value)} style={ro()} placeholder="e.g. Beamz Energy Solutions" disabled={!editingDetails || busy} />
                    </Field>
                    <Field isDark={isDark} label="GST number">
                      <input value={vendorGst} onChange={e => setVendorGst(e.target.value)} style={ro()} placeholder="e.g. 33AAQFT4234R1ZH" disabled={!editingDetails || busy} />
                    </Field>
                    <Field isDark={isDark} label="Phone">
                      <input value={vendorPhone} onChange={e => setVendorPhone(e.target.value)} style={ro()} placeholder="e.g. +91 6379506240" disabled={!editingDetails || busy} />
                    </Field>
                    <Field isDark={isDark} label="Email">
                      <input type="email" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)} style={ro()} placeholder="e.g. info@beamzenergy.com" disabled={!editingDetails || busy} />
                    </Field>
                  </div>

                  <div style={{ height: 1, background: ut.line2, margin: '6px 0' }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: ut.ink }}>Billing</div>
                  <Field
                    isDark={isDark}
                    label="Net metering started on"
                    hint="The date the electricity board began billing net metering — not the install date. The first bill's network charge is worked out from here; leave blank to charge the whole cycle."
                  >
                    <input type="date" value={commissionedOn} onChange={e => setCommissionedOn(e.target.value)} style={ro({ maxWidth: 240 })} disabled={!editingDetails || busy} />
                  </Field>
                </SetupCard>
                  );
                })()}

                {/* ── Savings & Billing Manual Entry ── */}
                <div style={{ marginTop: 20 }}>
                  <SavingsBillingEditor siteId={site.site_id} />
                </div>
              </motion.div>
            )}

            {/* GATEWAY TAB */}
            {tab === 'gateway' && (
              <motion.div key="gateway" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                <InverterMeasurementConfig siteId={siteId} ownerUserId={site?.owner_user != null ? String(site.owner_user) : undefined} />

                <div style={{ marginTop: 14 }}>
                <SetupCard
                  isDark={isDark}
                  icon={<Wifi size={21} strokeWidth={1.8} />}
                  title="Deye Cloud (backup data source)"
                  purpose="Used to pull richer readings from Deye's own cloud when the on-site link is quiet."
                  status={!editingDeyeSettings
                    ? <Btn isDark={isDark} variant="soft" size="sm" disabled={busy} onClick={() => { resetDeyeSettingsForm(); setEditingDeyeSettings(true); }}><Settings size={14} /> Edit</Btn>
                    : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn isDark={isDark} variant="plain" size="sm" disabled={busy} onClick={() => { resetDeyeSettingsForm(); setEditingDeyeSettings(false); }}>Cancel</Btn>
                        <Btn isDark={isDark} size="sm" disabled={busy} onClick={saveDeyeSettings}><Save size={14} /> Save</Btn>
                      </div>
                    )}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <Field isDark={isDark} label="Deye station ID" hint="from the Deye Cloud portal">
                      <input type="number" value={deyeStationId} onChange={e => setDeyeStationId(e.target.value)} disabled={!editingDeyeSettings || busy} style={roStyle(editingDeyeSettings)} placeholder="e.g. 12616" />
                    </Field>
                    <Field isDark={isDark} label="Logger serial" hint="the Wi-Fi dongle on the inverter (SolarmanV5 / LSW3)">
                      <input value={loggerSerial} onChange={e => setLoggerSerial(e.target.value)} disabled={!editingDeyeSettings || busy} style={roStyle(editingDeyeSettings)} placeholder="e.g. 2509273375" />
                    </Field>
                  </div>
                </SetupCard>
                </div>

                <div style={{ marginTop: 14 }}>
                <SetupCard
                  isDark={isDark}
                  icon={<Settings size={21} strokeWidth={1.8} />}
                  title="How the inverter is wired"
                  purpose="Helps the forecast model understand what this inverter can and can't see."
                  status={!editingAppliances
                    ? <Btn isDark={isDark} variant="soft" size="sm" disabled={busy || appliancesLoading} onClick={() => setEditingAppliances(true)}><Settings size={14} /> Edit</Btn>
                    : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn isDark={isDark} variant="plain" size="sm" disabled={busy} onClick={() => { resetAppliancesForm(); setEditingAppliances(false); }}>Cancel</Btn>
                        <Btn isDark={isDark} size="sm" disabled={busy} onClick={saveAppliances}><Save size={14} /> Save</Btn>
                      </div>
                    )}
                >
                  {appliancesLoading ? (
                    <div style={{ textAlign: 'center', padding: 24, color: ut.ink2 }}>
                      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        <Field isDark={isDark} label="Setup type">
                          <select value={applianceDraft.topology_type ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, topology_type: e.target.value })} disabled={!editingAppliances || busy} style={roStyle(editingAppliances)}>
                            <option value="unknown">Not sure yet</option>
                            <option value="whole_home_backup">Whole-home backup</option>
                            <option value="partial_backup">Some circuits on backup</option>
                            <option value="ac_coupled">AC coupled</option>
                            <option value="dc_coupled">DC coupled</option>
                            <option value="grid_tied">Grid-tied (no battery)</option>
                          </select>
                        </Field>
                        <Field isDark={isDark} label="Inverter mode">
                          <select value={applianceDraft.work_mode ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, work_mode: e.target.value })} disabled={!editingAppliances || busy} style={roStyle(editingAppliances)}>
                            <option value="">Not sure yet</option>
                            <option value="zero_export">Never sends power to the grid</option>
                            <option value="selling_first">Sends spare power to the grid</option>
                            <option value="battery_first">Fills the battery first</option>
                            <option value="load_first">Powers the home first</option>
                          </select>
                        </Field>
                        {(applianceDraft.ct_present ?? false) && (
                          <Field isDark={isDark} label="Where the clamp meter sits">
                            <select value={applianceDraft.ct_placement ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, ct_placement: e.target.value })} disabled={!editingAppliances || busy} style={roStyle(editingAppliances)}>
                              <option value="">Choose one…</option>
                              <option value="grid_side">On the main incoming supply</option>
                              <option value="load_side">After the inverter</option>
                              <option value="pv_side">On the solar side</option>
                            </select>
                          </Field>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        <ToggleRow disabled={!editingAppliances || busy} checked={applianceDraft.ct_present ?? false} onChange={v => setApplianceDraft({ ...applianceDraft, ct_present: v })} label="A clamp meter is fitted" hint="measures whole-home power" />
                        <ToggleRow disabled={!editingAppliances || busy} checked={applianceDraft.zero_export_enabled ?? false} onChange={v => setApplianceDraft({ ...applianceDraft, zero_export_enabled: v })} label="Blocks power going to the grid" />
                        <ToggleRow disabled={!editingAppliances || busy} checked={applianceDraft.grid_charge_enabled ?? false} onChange={v => setApplianceDraft({ ...applianceDraft, grid_charge_enabled: v })} label="Battery can charge from the grid" />
                      </div>
                    </>
                  )}
                </SetupCard>
                </div>
              </motion.div>
            )}

            {/* APPLIANCES TAB */}
            {tab === 'appliances' && (
              <motion.div key="appliances" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                <SetupCard
                  isDark={isDark}
                  icon={<Zap size={21} strokeWidth={1.8} />}
                  title="What’s in the home"
                  purpose="The big appliances here. The forecast uses this to estimate what the home will use."
                  status={!editingAppliances
                    ? <Btn isDark={isDark} variant="soft" size="sm" disabled={busy || appliancesLoading} onClick={() => setEditingAppliances(true)}><Settings size={14} /> Edit</Btn>
                    : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn isDark={isDark} variant="plain" size="sm" disabled={busy} onClick={() => { resetAppliancesForm(); setEditingAppliances(false); }}>Cancel</Btn>
                        <Btn isDark={isDark} size="sm" disabled={busy} onClick={saveAppliances}><Save size={14} /> Save</Btn>
                      </div>
                    )}
                >
                  {appliancesLoading ? (
                    <div style={{ textAlign: 'center', padding: '32px 24px', color: ut.ink2 }}>
                      <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        <Field isDark={isDark} label="Air conditioners">
                          <input type="number" min="0" value={applianceDraft.num_ac_units ?? 0} onChange={e => setApplianceDraft({ ...applianceDraft, num_ac_units: parseInt(e.target.value) || 0 })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} />
                        </Field>
                        {(applianceDraft.num_ac_units ?? 0) > 0 && (
                          <Field isDark={isDark} label="Total AC size (kW)">
                            <input type="number" min="0" step="0.1" value={applianceDraft.ac_total_capacity_kw ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, ac_total_capacity_kw: e.target.value ? parseFloat(e.target.value) : null })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} placeholder="e.g. 3, 5.5" />
                          </Field>
                        )}
                        {(applianceDraft.num_ac_units ?? 0) > 0 && (
                          <Field isDark={isDark} label="Usual temperature setting (°C)">
                            <input type="number" min="18" max="32" step="0.5" value={applianceDraft.ac_typical_setpoint_c ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, ac_typical_setpoint_c: e.target.value ? parseFloat(e.target.value) : null })} style={roStyle(editingAppliances)} placeholder="e.g. 24" disabled={!editingAppliances || busy} />
                          </Field>
                        )}
                        <Field isDark={isDark} label="Water heaters (geysers)">
                          <input type="number" min="0" value={applianceDraft.num_geysers ?? 0} onChange={e => setApplianceDraft({ ...applianceDraft, num_geysers: parseInt(e.target.value) || 0 })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} />
                        </Field>
                        {(applianceDraft.num_geysers ?? 0) > 0 && (
                          <Field isDark={isDark} label="Total heater size (kW)">
                            <input type="number" min="0" step="0.1" value={applianceDraft.geyser_total_capacity_kw ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, geyser_total_capacity_kw: e.target.value ? parseFloat(e.target.value) : null })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} placeholder="e.g. 2, 4.5, 6" />
                          </Field>
                        )}
                        {(applianceDraft.num_geysers ?? 0) > 0 && (
                          <Field isDark={isDark} label="Water heater type" hint="optional">
                            <select value={applianceDraft.geyser_type ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, geyser_type: e.target.value })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy}>
                              <option value="">Choose one…</option>
                              <option value="instant">Instant (tankless)</option>
                              <option value="storage_tank">Storage tank</option>
                              <option value="solar_backup">Solar with backup</option>
                            </select>
                          </Field>
                        )}
                        <Field isDark={isDark} label="Fridges">
                          <input type="number" min="0" value={applianceDraft.num_refrigerators ?? 0} onChange={e => setApplianceDraft({ ...applianceDraft, num_refrigerators: parseInt(e.target.value) || 0 })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} />
                        </Field>
                        <Field isDark={isDark} label="Washing machines">
                          <input type="number" min="0" value={applianceDraft.num_washing_machines ?? 0} onChange={e => setApplianceDraft({ ...applianceDraft, num_washing_machines: parseInt(e.target.value) || 0 })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} />
                        </Field>
                        <Field isDark={isDark} label="EV chargers">
                          <input type="number" min="0" value={applianceDraft.num_ev_chargers ?? 0} onChange={e => setApplianceDraft({ ...applianceDraft, num_ev_chargers: parseInt(e.target.value) || 0 })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} />
                        </Field>
                        {(applianceDraft.num_ev_chargers ?? 0) > 0 && (
                          <Field isDark={isDark} label="Charger size (kW)">
                            <input type="number" min="0" step="0.1" value={applianceDraft.ev_typical_charging_capacity_kw ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, ev_typical_charging_capacity_kw: e.target.value ? parseFloat(e.target.value) : null })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} placeholder="e.g. 3.3, 7, 11, 22" />
                          </Field>
                        )}
                        {(applianceDraft.num_ev_chargers ?? 0) > 0 && (
                          <Field isDark={isDark} label="Vehicle type">
                            <select value={applianceDraft.ev_type ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, ev_type: e.target.value })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy}>
                              <option value="">Choose one…</option>
                              <option value="two_wheeler">Two-wheeler</option>
                              <option value="three_wheeler">Three-wheeler</option>
                              <option value="four_wheeler">Car</option>
                            </select>
                          </Field>
                        )}
                        {(applianceDraft.has_water_pump ?? false) && (
                          <Field isDark={isDark} label="Pump size (HP)">
                            <input type="number" min="0" step="0.1" value={applianceDraft.water_pump_capacity_hp ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, water_pump_capacity_hp: e.target.value ? parseFloat(e.target.value) : null })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} placeholder="e.g. 0.5, 1, 2, 3" />
                          </Field>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        <ToggleRow disabled={!editingAppliances || busy} checked={applianceDraft.has_water_pump ?? false} onChange={v => setApplianceDraft({ ...applianceDraft, has_water_pump: v })} label="Water or irrigation pump" />
                        <ToggleRow disabled={!editingAppliances || busy} checked={applianceDraft.has_microwave ?? false} onChange={v => setApplianceDraft({ ...applianceDraft, has_microwave: v })} label="Microwave" />
                        <ToggleRow disabled={!editingAppliances || busy} checked={applianceDraft.has_desert_cooler ?? false} onChange={v => setApplianceDraft({ ...applianceDraft, has_desert_cooler: v })} label="Desert cooler" />
                      </div>

                      {/* What's on the inverter */}
                      <div style={{ height: 1, background: ut.line2, margin: '6px 0' }} />
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: ut.ink }}>What’s on the inverter</div>
                        <p style={{ margin: '4px 0 12px', fontSize: '0.82rem', color: ut.ink2, lineHeight: 1.5 }}>
                          The inverter only sees what’s wired through it. Tell us how many of each run that way — the rest
                          run off the grid. Without a clamp meter, the forecast leans on these.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                          {(applianceDraft.num_ac_units ?? 0) > 0 && (
                            <Field isDark={isDark} label="Air conditioners on the inverter" hint={`of ${applianceDraft.num_ac_units}`}>
                              <input type="number" min="0" max={applianceDraft.num_ac_units ?? 0} value={applianceDraft.ac_units_on_inverter ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, ac_units_on_inverter: e.target.value === '' ? null : Math.min(parseInt(e.target.value) || 0, applianceDraft.num_ac_units ?? 0) })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} placeholder="e.g. 3" />
                            </Field>
                          )}
                          {(applianceDraft.num_geysers ?? 0) > 0 && (
                            <Field isDark={isDark} label="Water heaters on the inverter" hint={`of ${applianceDraft.num_geysers}`}>
                              <input type="number" min="0" max={applianceDraft.num_geysers ?? 0} value={applianceDraft.geysers_on_inverter ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, geysers_on_inverter: e.target.value === '' ? null : Math.min(parseInt(e.target.value) || 0, applianceDraft.num_geysers ?? 0) })} style={roStyle(editingAppliances)} disabled={!editingAppliances || busy} placeholder="e.g. 0" />
                            </Field>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
                          {(applianceDraft.num_ev_chargers ?? 0) > 0 && (
                            <ToggleRow disabled={!editingAppliances || busy} checked={applianceDraft.ev_charger_on_inverter ?? false} onChange={v => setApplianceDraft({ ...applianceDraft, ev_charger_on_inverter: v })} label="EV charger is on the inverter" />
                          )}
                          {(applianceDraft.has_water_pump ?? false) && (
                            <ToggleRow disabled={!editingAppliances || busy} checked={applianceDraft.pump_on_inverter ?? false} onChange={v => setApplianceDraft({ ...applianceDraft, pump_on_inverter: v })} label="Pump is on the inverter" />
                          )}
                        </div>

                        <div style={{ marginTop: 14 }}>
                          <ToggleRow
                            disabled={!editingAppliances || busy || !(applianceDraft.ct_present ?? false)}
                            checked={applianceDraft.ct_load_forecast_enabled ?? false}
                            onChange={v => setApplianceDraft({ ...applianceDraft, ct_load_forecast_enabled: v })}
                            label="Use the clamp meter for load forecasting"
                            hint={(applianceDraft.ct_present ?? false)
                              ? 'The forecast will use the clamp meter to predict the whole home’s usage, not just the inverter side.'
                              : 'Needs a clamp meter fitted first — ask field ops to install one.'}
                          />
                        </div>
                      </div>

                      <div style={{ height: 1, background: ut.line2, margin: '6px 0' }} />
                      <Field isDark={isDark} label="Notes" hint="optional">
                        <textarea value={applianceDraft.appliance_notes ?? ''} onChange={e => setApplianceDraft({ ...applianceDraft, appliance_notes: e.target.value })} style={{ ...roStyle(editingAppliances), minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Anything else worth noting about the appliances" disabled={!editingAppliances || busy} />
                      </Field>
                    </>
                  )}
                </SetupCard>
              </motion.div>
            )}

            {/* LIFECYCLE TAB */}
            {tab === 'lifecycle' && (
              <motion.div key="lifecycle" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                <SetupCard
                  isDark={isDark}
                  icon={<Settings size={21} strokeWidth={1.8} />}
                  title="Site status"
                  purpose="Where this site is in its life — from draft, through setup, to live."
                  status={site && <StatusChip isDark={isDark} state={statusState(site.site_status)}>{statusWord(site.site_status)}</StatusChip>}
                >
                  <Field isDark={isDark} label="Change status to" hint="a step that doesn’t make sense will be turned down">
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <select value={lifecycleTo} onChange={e => setLifecycleTo(e.target.value)} style={{ ...controlStyle(isDark), flex: 1, minWidth: 180 }}>
                        {LIFECYCLE_OPTIONS.map(o => (
                          <option key={o} value={o}>{statusWord(o)}</option>
                        ))}
                      </select>
                      <Btn isDark={isDark} disabled={busy || lifecycleTo === site?.site_status} onClick={handleLifecycle}>Update status</Btn>
                    </div>
                  </Field>
                </SetupCard>

                <SetupCard
                  isDark={isDark}
                  icon={<AlertTriangle size={21} strokeWidth={1.8} />}
                  title="Remove this site"
                  purpose="Deletes the site and everything recorded against it. This can’t be undone."
                >
                  <div>
                    <Btn isDark={isDark} variant="plain" disabled={busy} onClick={() => { setShowDeleteModal(true); setDeleteConfirmationText(''); }}>
                      <Trash2 size={14} /> Remove site…
                    </Btn>
                  </div>
                </SetupCard>
              </motion.div>
            )}

            {/* EQUIPMENT TAB */}
            {tab === 'equipment' && (
              <motion.div key="equipment" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                {eqError && (
                  <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 8, background: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2', border: isDark ? '1px solid rgba(239,68,68,0.35)' : '1px solid #fecaca', color: '#ef4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span>{eqError}</span>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={refreshEquipment} disabled={eqLoading}>{eqLoading ? 'Retrying…' : 'Retry'}</button>
                  </div>
                )}
                <EqInverterSection siteId={siteId} isDark={isDark} items={eqBundle?.inverters ?? []} loading={eqLoading} onRefresh={refreshEquipment} />
                <EqBatterySection siteId={siteId} isDark={isDark} items={eqBundle?.batteries ?? []} loading={eqLoading} onRefresh={refreshEquipment} />
                <EqPanelSection siteId={siteId} isDark={isDark} items={eqBundle?.panels ?? []} loading={eqLoading} onRefresh={refreshEquipment} />
              </motion.div>
            )}

          </AnimatePresence>

          {/* Delete Site Confirmation Modal */}
          {showDeleteModal && ReactDOM.createPortal(
            <div className="portal-modal-backdrop">
              <div className="portal-modal-container">
                <div className="portal-modal-header">
                  <div className="portal-modal-header-left">
                    <div className="portal-modal-icon portal-modal-icon-danger">
                      <AlertTriangle size={22} color="white" />
                    </div>
                    <span className="portal-modal-title">Remove site</span>
                  </div>
                  <button onClick={() => setShowDeleteModal(false)} className="portal-modal-close-btn">
                    <X size={16} />
                  </button>
                </div>
                <div className="portal-modal-body">
                  <p>
                    Remove <strong>{site?.display_name || site?.site_id}</strong> for good?
                  </p>
                  <div className="portal-modal-warning-box">
                    <strong><AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Heads up:</strong> the site and everything recorded against it will be deleted. This can’t be undone.
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 8 }}>Type <em>delete</em> to confirm</label>
                    <input
                      type="text"
                      value={deleteConfirmationText}
                      onChange={e => setDeleteConfirmationText(e.target.value)}
                      placeholder='Type "delete"'
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: `1px solid ${palette.info.border || '#e0e0e0'}`,
                        fontSize: '0.85rem',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>
                <div className="portal-modal-footer">
                  <button onClick={() => setShowDeleteModal(false)} className="portal-modal-btn portal-modal-btn-cancel">
                    Keep it
                  </button>
                  <button
                    onClick={handleDeleteSite}
                    disabled={deleteConfirmationText !== 'delete' || busy}
                    className="portal-modal-btn portal-modal-btn-danger"
                    style={{ opacity: (deleteConfirmationText !== 'delete' || busy) ? 0.5 : 1 }}
                  >
                    {busy ? 'Removing…' : 'Remove site'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}
