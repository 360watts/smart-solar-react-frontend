import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import MobileSiteDetail from '../mobile/staff/MobileSiteDetail';
import {
  ArrowLeft, Battery, Cpu, Server, Wifi, Activity,
  Settings, Save, AlertTriangle, Link as LinkIcon,
  Unlink, ArrowRightLeft, RefreshCw, Zap, X,
  Plus, Pencil, Trash2, Sun,
} from 'lucide-react';
import { EmptyState } from '../../shared/components/EmptyState';
import SavingsBillingEditor from './SavingsBillingEditor';
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
interface SmartDeviceForm {
  device_type: string;
  provider_device_id: string;
  appliance_label: string;
  display_name: string;
  is_active: boolean;
}
const blankSmartDeviceForm = (): SmartDeviceForm => ({
  device_type: 'tuya_plug',
  provider_device_id: '',
  appliance_label: 'ev_charger',
  display_name: '',
  is_active: true,
});

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
      <label style={eqLabel(isDark)}>{label}{required&&<span style={{color:'#ef4444'}}> *</span>}</label>
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
      <div style={{background:'var(--card)',borderRadius:12,padding:28,width:380,maxWidth:'95vw',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
        <h3 style={{margin:'0 0 10px',color:'var(--foreground)'}}>Delete {label}?</h3>
        <p style={{margin:'0 0 22px',color:'var(--muted-foreground)',fontSize:'0.9rem'}}>This cannot be undone.</p>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn" style={{background:'#ef4444',color:'#fff',border:'none'}}>Delete</button>
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
      {loading?<div style={{padding:24,textAlign:'center',color:'var(--muted-foreground)',fontSize:'0.875rem'}}>Loading…</div>:items.length===0?<div style={{padding:24}}><EmptyState title="No inverters" description="Add the inverter from the contract."/></div>:(
        <div className="table-responsive"><table className="table" style={{fontSize:'0.875rem'}}>
          <thead><tr><th>Make / Model</th><th>Serial</th><th>Capacity</th><th>MPPT Range</th><th>Installed</th><th>Warranty</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>{items.map(inv=>(
            <tr key={inv.id}>
              <td><div style={{fontWeight:600}}>{inv.make}</div>{inv.model_name&&<div style={{fontSize:'0.75rem',color:T.textM}}>{inv.model_name}</div>}</td>
              <td><code style={{fontSize:'0.8rem'}}>{inv.serial_number}</code></td>
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
              <div style={{fontSize:'0.78rem',fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase',color:'var(--info)',marginTop:4}}>DC Input Specs</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <EqFormField label="Max Input Voltage (V)" value={form.max_input_voltage_v??''} onChange={v=>f('max_input_voltage_v',v)} type="number" isDark={isDark}/>
                <EqFormField label="Max Input Current (A)" value={form.max_input_current_a??''} onChange={v=>f('max_input_current_a',v)} type="number" isDark={isDark}/>
                <EqFormField label="MPPT Min (V)" value={form.mppt_voltage_min_v??''} onChange={v=>f('mppt_voltage_min_v',v)} type="number" isDark={isDark}/>
                <EqFormField label="MPPT Max (V)" value={form.mppt_voltage_max_v??''} onChange={v=>f('mppt_voltage_max_v',v)} type="number" isDark={isDark}/>
                <EqFormField label="Operating Min (V)" value={form.operating_voltage_min_v??''} onChange={v=>f('operating_voltage_min_v',v)} type="number" isDark={isDark}/>
                <EqFormField label="Operating Max (V)" value={form.operating_voltage_max_v??''} onChange={v=>f('operating_voltage_max_v',v)} type="number" isDark={isDark}/>
              </div>
              <div style={{fontSize:'0.78rem',fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase',color:'var(--info)',marginTop:4}}>Installation</div>
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
      {loading?<div style={{padding:24,textAlign:'center',color:'var(--muted-foreground)',fontSize:'0.875rem'}}>Loading…</div>:items.length===0?<div style={{padding:24}}><EmptyState title="No batteries" description="Add the battery from the contract."/></div>:(
        <div className="table-responsive"><table className="table" style={{fontSize:'0.875rem'}}>
          <thead><tr><th>Make / Model</th><th>Serial</th><th>Capacity</th><th>Nominal Voltage</th><th>Installed</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>{items.map(bat=>(
            <tr key={bat.id}>
              <td><div style={{fontWeight:600}}>{bat.make}</div>{bat.model_name&&<div style={{fontSize:'0.75rem',color:T.textM}}>{bat.model_name}</div>}</td>
              <td><code style={{fontSize:'0.8rem'}}>{bat.serial_number}</code></td>
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
              <div style={{fontSize:'0.78rem',fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase',color:'var(--info)',marginTop:4}}>Electrical Specs</div>
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
      {loading?<div style={{padding:24,textAlign:'center',color:'var(--muted-foreground)',fontSize:'0.875rem'}}>Loading…</div>:items.length===0?<div style={{padding:24}}><EmptyState title="No panels" description="Add panels from the contract. One row per physical panel."/></div>:(
        <div className="table-responsive"><table className="table" style={{fontSize:'0.875rem'}}>
          <thead><tr><th>Make / Model</th><th>Serial</th><th>Capacity (Wp)</th><th>Technology</th><th>Installed</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>{items.map(p=>(
            <tr key={p.id}>
              <td><div style={{fontWeight:600}}>{p.make}</div>{p.model_name&&<div style={{fontSize:'0.75rem',color:T.textM}}>{p.model_name}</div>}</td>
              <td><code style={{fontSize:'0.8rem'}}>{p.serial_number}</code></td>
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
  const [gatewayDevicePk, setGatewayDevicePk] = useState('');
  const [energyMeterPk, setEnergyMeterPk] = useState('');
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  const [availableSites, setAvailableSites] = useState<any[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [moveSearch, setMoveSearch] = useState('');
  const [moveDropdownOpen, setMoveDropdownOpen] = useState(false);
  const [smartDevices, setSmartDevices] = useState<any[]>([]);
  const [smartDevicesLoading, setSmartDevicesLoading] = useState(false);
  const [smartDevicesSaving, setSmartDevicesSaving] = useState(false);
  const [editingSmartDeviceId, setEditingSmartDeviceId] = useState<number | null>(null);
  const [smartDeviceDraft, setSmartDeviceDraft] = useState<SmartDeviceForm>(blankSmartDeviceForm());
  const [lifecycleTo, setLifecycleTo] = useState('active');
  const [displayName, setDisplayName] = useState('');
  const [capacityKw, setCapacityKw] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [deyeStationId, setDeyeStationId] = useState('');
  const [loggerSerial, setLoggerSerial] = useState('');
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

  const refreshSmartDevices = useCallback(async () => {
    if (!siteId) return;
    setSmartDevicesLoading(true);
    try {
      const devices = await apiService.getSmartDevices(siteId);
      setSmartDevices(Array.isArray(devices) ? devices : []);
    } catch {
      setSmartDevices([]);
    } finally {
      setSmartDevicesLoading(false);
    }
  }, [siteId]);


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
      setLifecycleTo(data.site_status || 'active');
      setDeyeStationId(data.deye_station_id != null ? String(data.deye_station_id) : '');
      setLoggerSerial(data.gateway_device?.logger_serial ?? '');
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
      setOwnerUsers(users);
    } catch {
      setOwnerUsers([]);
      usersLoadedRef.current = false; // allow retry on next edit-open
    } finally {
      setUsersBusy(false);
    }
  }, [user]);

  // Load available devices and sites when gateway tab is opened
  useEffect(() => {
    if (tab !== 'gateway') return;
    const loadDevices = async () => {
      setDevicesLoading(true);
      try {
        const devices = await apiService.getDevices('', 1, 100);
        if (Array.isArray(devices)) setAvailableDevices(devices);
        else if (devices.results) setAvailableDevices(devices.results);
      } catch {
        setAvailableDevices([]);
      } finally {
        setDevicesLoading(false);
      }
    };
    const loadSites = async () => {
      setSitesLoading(true);
      try {
        const sites = await apiService.getSitesList({ includeInactive: true });
        const list = Array.isArray(sites) ? sites : (sites as any).results ?? [];
        setAvailableSites(list.filter((s: any) => s.site_id !== siteId));
      } catch {
        setAvailableSites([]);
      } finally {
        setSitesLoading(false);
      }
    };
    loadDevices();
    loadSites();
    refreshSmartDevices();
  }, [tab, refreshSmartDevices]);

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

  const handleAttach = async (rawPk: string, label: string) => {
    const pk = parseInt(rawPk, 10);
    if (!pk || Number.isNaN(pk)) return;
    setBusy(true); setError(null);
    try {
      const data = await apiService.siteAttachDevice(siteId, pk);
      setSite(data);
      if (label === 'gateway') setGatewayDevicePk('');
      else setEnergyMeterPk('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Attach failed'); }
    finally { setBusy(false); }
  };

  const handleSetMirror = async (deviceId: number, mirrorsDevicePk: number | null) => {
    setBusy(true); setError(null);
    try {
      const data = await apiService.siteSetDeviceMirror(siteId, deviceId, mirrorsDevicePk);
      setSite(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to update data-source pairing'); }
    finally { setBusy(false); }
  };

  const handleDetach = async (deviceId: number, deviceSerial: string, roleLabel: string) => {
    if (!window.confirm(`Detach ${roleLabel} ${deviceSerial} from this site?`)) return;
    setBusy(true); setError(null);
    try {
      const data = await apiService.siteDetachDevice(siteId, deviceId);
      setSite(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Detach failed'); } 
    finally { setBusy(false); }
  };

  const handleMove = async (deviceId: number, deviceLabel: string, targetSiteId?: string) => {
    const nextSiteId = (targetSiteId ?? moveTarget).trim();
    if (!deviceId || !nextSiteId) return;
    if (!window.confirm(`Move ${deviceLabel} to site "${nextSiteId}"?`)) return;
    setBusy(true); setError(null);
    try {
      await apiService.siteMoveDevice(nextSiteId, deviceId, siteId);
      await refresh();
      if (!targetSiteId) setMoveTarget('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Move failed'); } 
    finally { setBusy(false); }
  };

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
    setLoggerSerial(site?.gateway_device?.logger_serial ?? '');
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

      // Logger Serial lives on the device (gateway)
      if (gw?.device_id) {
        const devicePayload: Record<string, unknown> = {
          logger_serial: loggerSerial.trim() === '' ? null : loggerSerial.trim(),
        };
        await apiService.patchDevice(gw.device_id, devicePayload);
      }

      setEditingDeyeSettings(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const resetSmartDeviceForm = () => {
    setEditingSmartDeviceId(null);
    setSmartDeviceDraft(blankSmartDeviceForm());
  };

  const beginEditSmartDevice = (device: any) => {
    setEditingSmartDeviceId(device.id);
    setSmartDeviceDraft({
      device_type: device.device_type ?? 'tuya_plug',
      provider_device_id: device.provider_device_id ?? '',
      appliance_label: device.appliance_label ?? 'other',
      display_name: device.display_name ?? '',
      is_active: device.is_active !== false,
    });
  };

  const saveSmartDevice = async () => {
    if (!siteId) return;
    const payload = {
      device_type: smartDeviceDraft.device_type,
      provider_device_id: smartDeviceDraft.provider_device_id.trim(),
      appliance_label: smartDeviceDraft.appliance_label,
      display_name: smartDeviceDraft.display_name.trim(),
      is_active: smartDeviceDraft.is_active,
    };
    if (!payload.provider_device_id) {
      setError('Provider device ID is required for smart devices');
      return;
    }

    setSmartDevicesSaving(true);
    setError(null);
    try {
      if (editingSmartDeviceId != null) {
        await apiService.updateSmartDevice(editingSmartDeviceId, payload);
      } else {
        await apiService.createSmartDevice(siteId, payload);
      }
      resetSmartDeviceForm();
      await refreshSmartDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save smart device');
    } finally {
      setSmartDevicesSaving(false);
    }
  };

  const removeSmartDevice = async (device: any) => {
    if (!window.confirm(`Delete smart device ${device.display_name || device.provider_device_id || device.id}?`)) return;
    setSmartDevicesSaving(true);
    setError(null);
    try {
      await apiService.deleteSmartDevice(device.id);
      if (editingSmartDeviceId === device.id) resetSmartDeviceForm();
      await refreshSmartDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete smart device');
    } finally {
      setSmartDevicesSaving(false);
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

  const gw = site?.gateway_device;
  const energyMeters = Array.isArray(site?.energy_meters)
    ? site.energy_meters
    : Array.isArray(site?.devices)
      ? site.devices.filter((d: any) => d.device_type === 'energy_meter')
      : [];
  const availableGatewayDevices = availableDevices.filter((d: any) => !d.site_id && (d.device_type || 'gateway') === 'gateway');
  const availableEnergyMeterDevices = availableDevices.filter((d: any) => !d.site_id && d.device_type === 'energy_meter');
  const heartbeatHealth = gw?.heartbeat_health;

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
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 20, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,166,62,0.03)' }}>
            <div style={{ display: 'flex', gap: 24 }}>
               <div>
                  <div style={labelStyle}>Status</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', background: getStatusStyle(site.site_status).bg, color: getStatusStyle(site.site_status).color, border: `1px solid ${getStatusStyle(site.site_status).border}` }}>
                    {site.site_status}
                  </span>
               </div>
               <div>
                  <div style={labelStyle}>Capacity</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: textMain }}>{site.capacity_kw} <span style={{ fontSize: '0.8rem', color: textMute }}>kW</span></div>
               </div>
               <div>
                  <div style={labelStyle}>Owner</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: textMain }}>{site.owner_username || (site.owner_user != null ? `User #${site.owner_user}` : 'Unassigned')}</div>
               </div>
            </div>
          </div>
        )}

        {/* ── Segmented Tabs ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 6, background: inputBg, borderRadius: 12, border: `1px solid ${inputBorder}`, marginBottom: 24 }}>
          {[
            { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
            { id: 'equipment', label: 'Equipment', icon: <Server size={14} /> },
            { id: 'gateway', label: 'Gateway Settings', icon: <Wifi size={14} /> },
            { id: 'appliances', label: 'Appliances', icon: <Zap size={14} /> },
            { id: 'lifecycle', label: 'Lifecycle Operations', icon: <Settings size={14} /> }
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
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: textMain }}>General Configuration</h2>
                    {!editingDetails ? (
                      <button type="button" disabled={busy} onClick={() => { setEditingDetails(true); loadOwnerUsers(); }} style={buttonStyle(true)}>
                        <Settings size={14} /> Edit Details
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            resetDetailsForm();
                            setEditingDetails(false);
                          }}
                          style={buttonStyle(true)}
                        >
                          Cancel
                        </button>
                        <button type="button" disabled={busy} onClick={saveSiteDetails} style={buttonStyle()}>
                          <Save size={14} /> Save
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 8 }}>
                    <div>
                      <label style={labelStyle}>Display Name</label>
                      <input
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        placeholder="Site Name"
                        disabled={!editingDetails || busy}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Capacity (kW)</label>
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        border: `1px solid ${inputBorder}`, borderRadius: 8,
                        background: inputBg, opacity: editingDetails ? 1 : 0.8,
                        overflow: 'hidden',
                      }}>
                        <input
                          type="number"
                          step="0.01"
                          value={capacityKw}
                          onChange={e => { setCapacityKw(e.target.value); setCalcNote(null); }}
                          style={{
                            flex: 1, padding: '10px 14px', border: 'none', background: 'transparent',
                            color: textMain, fontSize: '0.85rem', outline: 'none', minWidth: 0,
                          }}
                          placeholder="e.g. 5.5"
                          disabled={!editingDetails || busy}
                        />
                        {editingDetails && (
                          <button
                            type="button"
                            onClick={calcCapacityFromEquipment}
                            disabled={calcBusy || busy}
                            title="Calculate from equipment"
                            style={{
                              padding: '0 12px', height: '100%', border: 'none',
                              borderLeft: `1px solid ${inputBorder}`,
                              background: 'transparent', color: textSub,
                              cursor: calcBusy ? 'not-allowed' : 'pointer',
                              fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                              opacity: calcBusy ? 0.5 : 1, transition: 'opacity 150ms',
                            }}
                          >
                            {calcBusy ? '…' : '⚡ Calc'}
                          </button>
                        )}
                      </div>
                      {calcNote && (
                        <div style={{ fontSize: '0.72rem', color: calcNote.startsWith('No') || calcNote.startsWith('Failed') ? '#f59e0b' : primary, marginTop: 4 }}>
                          {calcNote}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Latitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={latitude}
                        onChange={e => setLatitude(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        placeholder="e.g. 11.0168"
                        disabled={!editingDetails || busy}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Owner User</label>
                      <select
                        value={ownerUserId}
                        onChange={e => setOwnerUserId(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8, cursor: editingDetails ? 'pointer' : 'not-allowed', background: nativeSelectBg, color: nativeSelectFg }}
                        disabled={!editingDetails || busy || usersBusy}
                      >
                        <option value="">Unassigned</option>
                        {ownerUsers.map((u) => {
                          const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                          const label = fullName ? `${fullName} (${u.username || `#${u.id}`})` : (u.username || `User #${u.id}`);
                          return (
                            <option key={u.id} value={String(u.id)}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Longitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={longitude}
                        onChange={e => setLongitude(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        placeholder="e.g. 76.9558"
                        disabled={!editingDetails || busy}
                      />
                    </div>
                  </div>

                  <div style={{ height: 1, background: border, margin: '24px 0' }} />

                  <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', color: textMain }}>Vendor</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Vendor Name</label>
                      <input
                        value={vendorName}
                        onChange={e => setVendorName(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        placeholder="e.g. Beamz Energy Solutions"
                        disabled={!editingDetails || busy}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>GST Number</label>
                      <input
                        value={vendorGst}
                        onChange={e => setVendorGst(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        placeholder="e.g. 33AAQFT4234R1ZH"
                        disabled={!editingDetails || busy}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Phone</label>
                      <input
                        value={vendorPhone}
                        onChange={e => setVendorPhone(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        placeholder="e.g. +91 6379506240"
                        disabled={!editingDetails || busy}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Email</label>
                      <input
                        type="email"
                        value={vendorEmail}
                        onChange={e => setVendorEmail(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        placeholder="e.g. info@beamzenergy.com"
                        disabled={!editingDetails || busy}
                      />
                    </div>
                  </div>

                  <div style={{ height: 1, background: border, margin: '24px 0' }} />

                  <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', color: textMain }}>Billing</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Net metering commissioned on</label>
                      <input
                        type="date"
                        value={commissionedOn}
                        onChange={e => setCommissionedOn(e.target.value)}
                        style={{ ...inputStyle, width: '100%', opacity: editingDetails ? 1 : 0.8 }}
                        disabled={!editingDetails || busy}
                      />
                      <div style={{ fontSize: '0.7rem', color: textMute, marginTop: 4 }}>
                        Date the DISCOM billed net metering from — not the physical install date.
                        The first cycle&apos;s network charge is pro-rated from here; leave blank to charge the full cycle.
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: border, margin: '24px 0' }} />

                  <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', color: textMain }}>Related Records</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <button type="button" onClick={() => setTab('equipment')} style={{ textDecoration: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                      <div style={{ padding: 16, borderRadius: 10, background: inputBg, border: `1px solid ${inputBorder}`, color: textMain, display: 'flex', alignItems: 'center', gap: 12, transition: 'background 150ms' }} onMouseEnter={e => e.currentTarget.style.background = palette.mute.bg} onMouseLeave={e => e.currentTarget.style.background = inputBg}>
                        <div style={{ background: palette.info.bg, color: palette.info.color, padding: 8, borderRadius: 8 }}><Battery size={16} /></div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Equipment Registry</div>
                          <div style={{ fontSize: '0.7rem', color: textMute }}>Inverters, batteries & panels</div>
                        </div>
                      </div>
                    </button>
                    <Link to="/devices" style={{ textDecoration: 'none' }}>
                       <div style={{ padding: 16, borderRadius: 10, background: inputBg, border: `1px solid ${inputBorder}`, color: textMain, display: 'flex', alignItems: 'center', gap: 12, transition: 'background 150ms' }} onMouseEnter={e => e.currentTarget.style.background = palette.mute.bg} onMouseLeave={e => e.currentTarget.style.background = inputBg}>
                        <div style={{ background: palette.warn.bg, color: palette.warn.color, padding: 8, borderRadius: 8 }}><Cpu size={16} /></div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Hardware Devices</div>
                          <div style={{ fontSize: '0.7rem', color: textMute }}>View all devices</div>
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>

                {/* ── Savings & Billing Manual Entry ── */}
                <div style={{ marginTop: 20 }}>
                  <SavingsBillingEditor siteId={site.site_id} />
                </div>
              </motion.div>
            )}

            {/* GATEWAY TAB */}
            {tab === 'gateway' && (
              <motion.div key="gateway" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Wifi size={18} color={primary} />
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: textMain }}>Assign Devices</h2>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: textMute, margin: '0 0 24px' }}>
                    Manage hardware linked to this site. One gateway is allowed per site, while energy meters can be attached alongside it.
                  </p>

                  <div style={{ display: 'grid', gap: 18 }}>
                  {gw ? (
                    <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${palette.ok.border}`, background: palette.ok.bg }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: palette.ok.color, fontWeight: 700, marginBottom: 4, letterSpacing: '0.05em' }}>Attached Gateway</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: textMain }}>{gw.device_serial}</div>
                          <div style={{ fontSize: '0.8rem', color: textSub, fontFamily: 'monospace' }}>PK: {gw.device_id} · Type: gateway</div>
                        </div>
                        <button type="button" disabled={busy} onClick={() => handleDetach(gw.device_id, gw.device_serial, 'gateway')} style={buttonStyle(false, true)}>
                          <Unlink size={14} /> Detach
                        </button>
                      </div>

                      <div style={{ height: 1, background: palette.ok.border, margin: '16px 0' }} />
                      <div style={{ fontSize: '0.84rem', color: textSub, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        <span><strong>Last seen:</strong> {gw.last_seen_at ? new Date(gw.last_seen_at).toLocaleString() : 'Never'}</span>
                        <span><strong>Signal:</strong> {gw.signal_strength_dbm != null ? `${gw.signal_strength_dbm}%` : 'N/A'}</span>
                        <span style={{ textTransform: 'capitalize' }}><strong>Health:</strong> {heartbeatHealth?.severity || 'ok'}</span>
                      </div>
                      {Array.isArray(gw.mirrored_by_serials) && gw.mirrored_by_serials.length > 0 && (
                        <div style={{ fontSize: '0.78rem', color: palette.ok.color, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <LinkIcon size={12} />
                          Backed up by {gw.mirrored_by_serials.join(', ')} — it will publish directly if this gateway goes offline
                        </div>
                      )}

                      <div style={{ height: 1, background: palette.ok.border, margin: '20px 0' }} />

                      <label style={{ ...labelStyle, color: textMain }}>Reassign to another site</label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
                          <input
                            value={moveSearch || (moveTarget && !moveDropdownOpen ? (() => { const s = availableSites.find(s => s.site_id === moveTarget); return s ? `${s.site_id}${s.display_name ? ' — ' + s.display_name : ''}` : moveTarget; })() : moveSearch)}
                            onChange={e => { setMoveSearch(e.target.value); setMoveTarget(''); setMoveDropdownOpen(true); }}
                            onFocus={() => setMoveDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setMoveDropdownOpen(false), 150)}
                            placeholder={sitesLoading ? 'Loading sites…' : 'Search site ID or name…'}
                            disabled={sitesLoading}
                            style={{ ...inputStyle, width: '100%', background: surface, borderColor: palette.ok.border }}
                          />
                          {moveDropdownOpen && (
                            <div style={{
                              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                              background: surface, border: `1px solid ${palette.ok.border}`,
                              borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                            }}>
                              {availableSites
                                .filter(s => {
                                  const q = moveSearch.toLowerCase();
                                  return !q || s.site_id.toLowerCase().includes(q) || (s.display_name || '').toLowerCase().includes(q);
                                })
                                .map(s => (
                                  <div
                                    key={s.site_id}
                                    onMouseDown={() => { setMoveTarget(s.site_id); setMoveSearch(''); setMoveDropdownOpen(false); }}
                                    style={{
                                      padding: '9px 14px', cursor: 'pointer', fontSize: '0.84rem',
                                      background: s.site_id === moveTarget ? (isDark ? 'rgba(0,166,62,0.15)' : 'rgba(0,166,62,0.08)') : 'transparent',
                                      color: textMain,
                                      borderBottom: `1px solid ${border}`,
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = s.site_id === moveTarget ? (isDark ? 'rgba(0,166,62,0.15)' : 'rgba(0,166,62,0.08)') : 'transparent')}
                                  >
                                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{s.site_id}</span>
                                    {s.display_name && <span style={{ color: textSub, marginLeft: 8 }}>{s.display_name}</span>}
                                    {s.site_status && (
                                      <span style={{ marginLeft: 8, fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4, background: getStatusStyle(s.site_status).bg, color: getStatusStyle(s.site_status).color }}>
                                        {s.site_status}
                                      </span>
                                    )}
                                  </div>
                                ))
                              }
                              {availableSites.filter(s => { const q = moveSearch.toLowerCase(); return !q || s.site_id.toLowerCase().includes(q) || (s.display_name || '').toLowerCase().includes(q); }).length === 0 && (
                                <div style={{ padding: '10px 14px', fontSize: '0.84rem', color: textMute, textAlign: 'center' }}>No sites found</div>
                              )}
                            </div>
                          )}
                        </div>
                        <button type="button" disabled={busy || !moveTarget.trim()} onClick={() => handleMove(gw.device_id, 'gateway')} style={buttonStyle(true)}>
                          <ArrowRightLeft size={14} /> Move Device
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 24, borderRadius: 12, border: `1px dashed ${inputBorder}`, background: inputBg, textAlign: 'center' }}>
                      <Wifi size={28} color={textMute} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: textMain }}>No Gateway Attached</h3>
                      <p style={{ fontSize: '0.85rem', color: textSub, margin: '0 0 20px' }}>Select an available gateway to link hardware telemetry to this site.</p>

                      <div style={{ display: 'flex', gap: 12, maxWidth: 400, margin: '0 auto' }}>
                        <select value={gatewayDevicePk} onChange={e => setGatewayDevicePk(e.target.value)} disabled={devicesLoading || busy} style={{ ...inputStyle, flex: 1, background: nativeSelectBg, color: nativeSelectFg }}>
                          <option value="">-- Select Gateway --</option>
                          {availableGatewayDevices.map(d => (
                            <option key={d.id} value={String(d.id)}>
                              {d.device_serial} (ID: {d.id})
                            </option>
                          ))}
                        </select>
                        <button type="button" disabled={busy || !gatewayDevicePk || devicesLoading} onClick={() => handleAttach(gatewayDevicePk, 'gateway')} style={buttonStyle()}>
                          <LinkIcon size={14} /> Attach
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${inputBorder}`, background: inputBg }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: textMute, fontWeight: 700, letterSpacing: '0.05em' }}>Energy Meters</div>
                        <div style={{ fontSize: '0.9rem', color: textSub }}>Attach one or more energy meters for site-level load and import/export measurements.</div>
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: textMain }}>{energyMeters.length} attached</div>
                    </div>

                    {energyMeters.length > 0 ? (
                      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                        {energyMeters.map((meter: any) => (
                          <div key={meter.device_id} style={{ padding: 14, borderRadius: 10, border: `1px solid ${border}`, background: surface, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontWeight: 700, color: textMain }}>{meter.device_serial}</div>
                              <div style={{ fontSize: '0.78rem', color: textSub, fontFamily: 'monospace' }}>PK: {meter.device_id} · Type: energy_meter</div>
                              <div style={{ fontSize: '0.78rem', color: textSub }}>Last seen: {meter.last_seen_at ? new Date(meter.last_seen_at).toLocaleString() : 'Never'}</div>
                              {meter.mirrors_device_id && meter.mirrors_device_id === gw?.device_id ? (
                                <div style={{ fontSize: '0.76rem', color: palette.ok.color, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <LinkIcon size={12} />
                                  Normally relayed via <strong style={{ fontFamily: 'monospace' }}>{meter.mirrors_device_serial}</strong> — falls back to direct cloud publish if the gateway goes offline
                                </div>
                              ) : gw ? (
                                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.74rem', color: textMute }}>Not paired to the gateway's relay path.</span>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleSetMirror(meter.device_id, gw.device_id)}
                                    style={{ ...buttonStyle(true), padding: '2px 8px', fontSize: '0.74rem' }}
                                  >
                                    <LinkIcon size={11} /> Pair to {gw.device_serial}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button type="button" disabled={busy} onClick={() => {
                                const target = window.prompt(`Move energy meter ${meter.device_serial} to which site ID?`, '');
                                if (target) handleMove(meter.device_id, `energy meter ${meter.device_serial}`, target);
                              }} style={buttonStyle(true)}>
                                <ArrowRightLeft size={14} /> Move
                              </button>
                              <button type="button" disabled={busy} onClick={() => handleDetach(meter.device_id, meter.device_serial, 'energy meter')} style={buttonStyle(false, true)}>
                                <Unlink size={14} /> Detach
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.84rem', color: textMute, marginBottom: 16 }}>No energy meters attached yet.</div>
                    )}

                    <div style={{ display: 'flex', gap: 12, maxWidth: 420 }}>
                      <select value={energyMeterPk} onChange={e => setEnergyMeterPk(e.target.value)} disabled={devicesLoading || busy} style={{ ...inputStyle, flex: 1, background: nativeSelectBg, color: nativeSelectFg }}>
                        <option value="">-- Select Energy Meter --</option>
                        {availableEnergyMeterDevices.map(d => (
                          <option key={d.id} value={String(d.id)}>
                            {d.device_serial} (ID: {d.id})
                          </option>
                        ))}
                      </select>
                      <button type="button" disabled={busy || !energyMeterPk || devicesLoading} onClick={() => handleAttach(energyMeterPk, 'energy_meter')} style={buttonStyle()}>
                        <LinkIcon size={14} /> Attach
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${inputBorder}`, background: inputBg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <Zap size={16} color={primary} />
                      <div>
                        <div style={{ fontWeight: 700, color: textMain }}>Smart Devices</div>
                        <div style={{ fontSize: '0.8rem', color: textSub }}>Mapped separately from hardware devices. Appliance mapping remains the source of truth for what each smart device powers.</div>
                      </div>
                    </div>
                    {smartDevicesLoading ? (
                      <div style={{ fontSize: '0.84rem', color: textMute }}>Loading smart devices…</div>
                    ) : smartDevices.length === 0 ? (
                      <div style={{ fontSize: '0.84rem', color: textMute }}>No smart devices mapped to this site.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {smartDevices.map((device: any) => (
                          <div key={device.id} style={{ padding: 14, borderRadius: 10, border: `1px solid ${border}`, background: surface }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontWeight: 700, color: textMain }}>{device.display_name || device.appliance_label}</div>
                                <div style={{ fontSize: '0.78rem', color: textSub }}>
                                  Provider type: <strong>{String(device.device_type || '').replace(/_/g, ' ') || 'unknown'}</strong>
                                  {' · '}
                                  Appliance: <strong>{String(device.appliance_label || '').replace(/_/g, ' ') || 'unmapped'}</strong>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: textSub, fontFamily: 'monospace' }}>
                                  Provider ID: {device.provider_device_id || '—'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '0.78rem', color: textSub }}>
                                  {device.latest?.power_w != null ? `${(device.latest.power_w / 1000).toFixed(2)} kW` : 'No live power'}
                                </div>
                                <button type="button" disabled={smartDevicesSaving} onClick={() => beginEditSmartDevice(device)} style={buttonStyle(true)}>
                                  <Pencil size={14} /> Edit
                                </button>
                                <button type="button" disabled={smartDevicesSaving} onClick={() => removeSmartDevice(device)} style={buttonStyle(false, true)}>
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}`, display: 'grid', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: textMain }}>
                            {editingSmartDeviceId != null ? 'Edit Smart Device' : 'Add Smart Device'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: textSub }}>
                            Keep the appliance mapping explicit. EV-linked devices should stay mapped as <strong style={{ color: textMain }}>ev_charger</strong>.
                          </div>
                        </div>
                        {(editingSmartDeviceId != null || smartDeviceDraft.provider_device_id || smartDeviceDraft.display_name) && (
                          <button type="button" disabled={smartDevicesSaving} onClick={resetSmartDeviceForm} style={buttonStyle(true)}>
                            Cancel
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Provider Type</label>
                          <select
                            value={smartDeviceDraft.device_type}
                            onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, device_type: e.target.value })}
                            disabled={smartDevicesSaving}
                            style={{ ...inputStyle, width: '100%', background: nativeSelectBg, color: nativeSelectFg }}
                          >
                            <option value="tuya_plug">Tuya Plug</option>
                            <option value="tuya_switch">Tuya Switch</option>
                            <option value="ct_clamp">CT Clamp</option>
                            <option value="modbus_meter">Modbus Meter</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Appliance Mapping</label>
                          <select
                            value={smartDeviceDraft.appliance_label}
                            onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, appliance_label: e.target.value })}
                            disabled={smartDevicesSaving}
                            style={{ ...inputStyle, width: '100%', background: nativeSelectBg, color: nativeSelectFg }}
                          >
                            <option value="ev_charger">EV Charger</option>
                            <option value="geyser">Geyser</option>
                            <option value="ac_unit">AC Unit</option>
                            <option value="water_pump">Water Pump</option>
                            <option value="washing_machine">Washing Machine</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Provider Device ID</label>
                          <input
                            value={smartDeviceDraft.provider_device_id}
                            onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, provider_device_id: e.target.value })}
                            disabled={smartDevicesSaving}
                            style={{ ...inputStyle, width: '100%', background: surface }}
                            placeholder="e.g. bf12ab34cd56"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Display Name</label>
                          <input
                            value={smartDeviceDraft.display_name}
                            onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, display_name: e.target.value })}
                            disabled={smartDevicesSaving}
                            style={{ ...inputStyle, width: '100%', background: surface }}
                            placeholder="e.g. EV Charger Plug"
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          id="smart-device-active"
                          type="checkbox"
                          checked={smartDeviceDraft.is_active}
                          onChange={e => setSmartDeviceDraft({ ...smartDeviceDraft, is_active: e.target.checked })}
                          disabled={smartDevicesSaving}
                        />
                        <label htmlFor="smart-device-active" style={{ fontSize: '0.82rem', color: textSub }}>Active</label>
                      </div>

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button type="button" disabled={smartDevicesSaving} onClick={saveSmartDevice} style={buttonStyle()}>
                          {smartDevicesSaving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
                          {editingSmartDeviceId != null ? 'Update Smart Device' : 'Add Smart Device'}
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* Deye Cloud settings */}
                  <div style={{ marginTop: 20, padding: 20, borderRadius: 12, border: `1px solid ${inputBorder}`, background: inputBg }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Wifi size={18} color={primary} />
                        <div>
                          <div style={{ fontWeight: 700, color: textMain }}>Deye Cloud Settings</div>
                          <div style={{ fontSize: '0.8rem', color: textSub }}>Used for Deye Cloud fallback /device/latest rich payloads.</div>
                        </div>
                      </div>
                      {!editingDeyeSettings ? (
                        <button type="button" disabled={busy} onClick={() => { resetDeyeSettingsForm(); setEditingDeyeSettings(true); }} style={buttonStyle(true)}>
                          <Settings size={14} /> Edit
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" disabled={busy} onClick={() => { resetDeyeSettingsForm(); setEditingDeyeSettings(false); }} style={buttonStyle(true)}>
                            Cancel
                          </button>
                          <button type="button" disabled={busy} onClick={saveDeyeSettings} style={buttonStyle()}>
                            <Save size={14} /> Save
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
                      <div>
                        <label style={labelStyle}>Deye Station ID</label>
                        <input
                          type="number"
                          value={deyeStationId}
                          onChange={e => setDeyeStationId(e.target.value)}
                          disabled={!editingDeyeSettings || busy}
                          style={{ ...inputStyle, background: surface, opacity: !editingDeyeSettings ? 0.8 : 1 }}
                          placeholder="e.g. 12616 (from Deye Cloud portal)"
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Logger Serial (on Device)</label>
                        <input
                          value={loggerSerial}
                          onChange={e => setLoggerSerial(e.target.value)}
                          disabled={!editingDeyeSettings || busy}
                          style={{ ...inputStyle, background: surface, opacity: !editingDeyeSettings ? 0.8 : 1 }}
                          placeholder="e.g. 2509273375 (SolarmanV5/LSW3 dongle)"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Inverter & Measurement Config ── */}
                <div style={{ marginTop: 20, background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: textMain }}>Inverter & Measurement Config</h2>
                    {!editingAppliances ? (
                      <button type="button" disabled={busy || appliancesLoading} onClick={() => setEditingAppliances(true)} style={buttonStyle(true)}>
                        <Settings size={14} /> Edit
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" disabled={busy} onClick={() => { resetAppliancesForm(); setEditingAppliances(false); }} style={buttonStyle(true)}>Cancel</button>
                        <button type="button" disabled={busy} onClick={saveAppliances} style={buttonStyle()}><Save size={14} /> Save</button>
                      </div>
                    )}
                  </div>

                  {appliancesLoading ? (
                    <div style={{ textAlign: 'center', padding: 24, color: textMute }}>
                      <RefreshCw size={20} style={{ margin: '0 auto', animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>

                      {/* Topology type */}
                      <div>
                        <label style={labelStyle}>Topology Type</label>
                        <select
                          value={applianceDraft.topology_type ?? ''}
                          onChange={e => setApplianceDraft({ ...applianceDraft, topology_type: e.target.value })}
                          disabled={!editingAppliances || busy}
                          style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8, background: nativeSelectBg, color: nativeSelectFg }}
                        >
                          <option value="unknown">Unknown</option>
                          <option value="whole_home_backup">Whole-home Backup</option>
                          <option value="partial_backup">Partial Backup</option>
                          <option value="ac_coupled">AC Coupled</option>
                          <option value="dc_coupled">DC Coupled</option>
                          <option value="grid_tied">Grid-tied (no battery)</option>
                        </select>
                      </div>

                      {/* Work mode */}
                      <div>
                        <label style={labelStyle}>Work Mode</label>
                        <select
                          value={applianceDraft.work_mode ?? ''}
                          onChange={e => setApplianceDraft({ ...applianceDraft, work_mode: e.target.value })}
                          disabled={!editingAppliances || busy}
                          style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8, background: nativeSelectBg, color: nativeSelectFg }}
                        >
                          <option value="">Unknown</option>
                          <option value="zero_export">Zero Export</option>
                          <option value="selling_first">Selling First (export surplus)</option>
                          <option value="battery_first">Battery First</option>
                          <option value="load_first">Load First</option>
                        </select>
                      </div>

                      {/* CT Present toggle */}
                      <div>
                        <label style={labelStyle}>CT Clamp Installed</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <input
                            type="checkbox"
                            checked={applianceDraft.ct_present ?? false}
                            onChange={e => setApplianceDraft({ ...applianceDraft, ct_present: e.target.checked })}
                            disabled={!editingAppliances || busy}
                            style={{ cursor: editingAppliances ? 'pointer' : 'not-allowed', width: 18, height: 18 }}
                          />
                          <span style={{ fontSize: '0.85rem', color: textSub }}>Yes, CT clamp is installed</span>
                        </div>
                      </div>

                      {/* CT Placement (conditional) */}
                      {(applianceDraft.ct_present ?? false) && (
                        <div>
                          <label style={labelStyle}>CT Placement</label>
                          <select
                            value={applianceDraft.ct_placement ?? ''}
                            onChange={e => setApplianceDraft({ ...applianceDraft, ct_placement: e.target.value })}
                            disabled={!editingAppliances || busy}
                            style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8, background: nativeSelectBg, color: nativeSelectFg }}
                          >
                            <option value="">Select placement</option>
                            <option value="grid_side">Grid side (main panel incoming)</option>
                            <option value="load_side">Load side (after inverter)</option>
                            <option value="pv_side">PV side</option>
                          </select>
                        </div>
                      )}

                      {/* Zero export */}
                      <div>
                        <label style={labelStyle}>Zero Export Enabled</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <input
                            type="checkbox"
                            checked={applianceDraft.zero_export_enabled ?? false}
                            onChange={e => setApplianceDraft({ ...applianceDraft, zero_export_enabled: e.target.checked })}
                            disabled={!editingAppliances || busy}
                            style={{ cursor: editingAppliances ? 'pointer' : 'not-allowed', width: 18, height: 18 }}
                          />
                          <span style={{ fontSize: '0.85rem', color: textSub }}>Inverter blocks grid export</span>
                        </div>
                      </div>

                      {/* Grid charge */}
                      <div>
                        <label style={labelStyle}>Grid Charging Enabled</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <input
                            type="checkbox"
                            checked={applianceDraft.grid_charge_enabled ?? false}
                            onChange={e => setApplianceDraft({ ...applianceDraft, grid_charge_enabled: e.target.checked })}
                            disabled={!editingAppliances || busy}
                            style={{ cursor: editingAppliances ? 'pointer' : 'not-allowed', width: 18, height: 18 }}
                          />
                          <span style={{ fontSize: '0.85rem', color: textSub }}>Battery can charge from grid</span>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* APPLIANCES TAB */}
            {tab === 'appliances' && (
              <motion.div key="appliances" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: textMain }}>Appliance Inventory</h2>
                    {!editingAppliances ? (
                      <button type="button" disabled={busy || appliancesLoading} onClick={() => setEditingAppliances(true)} style={buttonStyle(true)}>
                        <Settings size={14} /> Edit
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            resetAppliancesForm();
                            setEditingAppliances(false);
                          }}
                          style={buttonStyle(true)}
                        >
                          Cancel
                        </button>
                        <button type="button" disabled={busy} onClick={saveAppliances} style={buttonStyle()}>
                          <Save size={14} /> Save
                        </button>
                      </div>
                    )}
                  </div>

                  {appliancesLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 24px', color: textMute }}>
                      <RefreshCw size={24} style={{ margin: '0 auto', animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                      {/* AC Units */}
                      <div>
                        <label style={labelStyle}>Number of AC Units</label>
                        <input
                          type="number"
                          min="0"
                          value={applianceDraft.num_ac_units ?? 0}
                          onChange={e => setApplianceDraft({ ...applianceDraft, num_ac_units: parseInt(e.target.value) || 0 })}
                          style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                          disabled={!editingAppliances || busy}
                        />
                      </div>

                      {/* AC Capacity (conditional) */}
                      {(applianceDraft.num_ac_units ?? 0) > 0 && (
                        <div>
                          <label style={labelStyle}>AC Capacity (kW)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={applianceDraft.ac_total_capacity_kw ?? ''}
                            onChange={e => setApplianceDraft({ ...applianceDraft, ac_total_capacity_kw: e.target.value ? parseFloat(e.target.value) : null })}
                            style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                            disabled={!editingAppliances || busy}
                            placeholder="e.g. 3, 5.5"
                          />
                        </div>
                      )}

                      {/* AC Setpoint (conditional) */}
                      {(applianceDraft.num_ac_units ?? 0) > 0 && (
                        <div>
                          <label style={labelStyle}>AC Typical Setpoint (°C)</label>
                          <input
                            type="number"
                            min="18"
                            max="32"
                            step="0.5"
                            value={applianceDraft.ac_typical_setpoint_c ?? ''}
                            onChange={e => setApplianceDraft({ ...applianceDraft, ac_typical_setpoint_c: e.target.value ? parseFloat(e.target.value) : null })}
                            style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                            placeholder="e.g. 24"
                            disabled={!editingAppliances || busy}
                          />
                        </div>
                      )}

                      {/* Geysers */}
                      <div>
                        <label style={labelStyle}>Number of Geysers</label>
                        <input
                          type="number"
                          min="0"
                          value={applianceDraft.num_geysers ?? 0}
                          onChange={e => setApplianceDraft({ ...applianceDraft, num_geysers: parseInt(e.target.value) || 0 })}
                          style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                          disabled={!editingAppliances || busy}
                        />
                      </div>

                      {/* Geyser Capacity (conditional) */}
                      {(applianceDraft.num_geysers ?? 0) > 0 && (
                        <div>
                          <label style={labelStyle}>Geyser Heating Capacity (kW)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={applianceDraft.geyser_total_capacity_kw ?? ''}
                            onChange={e => setApplianceDraft({ ...applianceDraft, geyser_total_capacity_kw: e.target.value ? parseFloat(e.target.value) : null })}
                            style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                            disabled={!editingAppliances || busy}
                            placeholder="e.g. 2, 4.5, 6"
                          />
                        </div>
                      )}

                      {/* Geyser Type (conditional) */}
                      {(applianceDraft.num_geysers ?? 0) > 0 && (
                        <div>
                          <label style={labelStyle}>Primary Geyser Type <span style={{ fontSize: '0.85em', opacity: 0.6 }}>(Optional)</span></label>
                          <select
                            value={applianceDraft.geyser_type ?? ''}
                            onChange={e => setApplianceDraft({ ...applianceDraft, geyser_type: e.target.value })}
                            style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8, cursor: editingAppliances ? 'pointer' : 'not-allowed', background: nativeSelectBg, color: nativeSelectFg }}
                            disabled={!editingAppliances || busy}
                          >
                            <option value="">Select type</option>
                            <option value="instant">Instant (Tankless)</option>
                            <option value="storage_tank">Storage Tank</option>
                            <option value="solar_backup">Solar with Backup</option>
                          </select>
                        </div>
                      )}

                      {/* Refrigerators */}
                      <div>
                        <label style={labelStyle}>Number of Refrigerators</label>
                        <input
                          type="number"
                          min="0"
                          value={applianceDraft.num_refrigerators ?? 0}
                          onChange={e => setApplianceDraft({ ...applianceDraft, num_refrigerators: parseInt(e.target.value) || 0 })}
                          style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                          disabled={!editingAppliances || busy}
                        />
                      </div>

                      {/* Washing Machines */}
                      <div>
                        <label style={labelStyle}>Number of Washing Machines</label>
                        <input
                          type="number"
                          min="0"
                          value={applianceDraft.num_washing_machines ?? 0}
                          onChange={e => setApplianceDraft({ ...applianceDraft, num_washing_machines: parseInt(e.target.value) || 0 })}
                          style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                          disabled={!editingAppliances || busy}
                        />
                      </div>

                      {/* EV Chargers */}
                      <div>
                        <label style={labelStyle}>Number of EV Chargers</label>
                        <input
                          type="number"
                          min="0"
                          value={applianceDraft.num_ev_chargers ?? 0}
                          onChange={e => setApplianceDraft({ ...applianceDraft, num_ev_chargers: parseInt(e.target.value) || 0 })}
                          style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                          disabled={!editingAppliances || busy}
                        />
                      </div>

                      {/* EV Charger Capacity (conditional) */}
                      {(applianceDraft.num_ev_chargers ?? 0) > 0 && (
                        <div>
                          <label style={labelStyle}>Charger Capacity (kW)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={applianceDraft.ev_typical_charging_capacity_kw ?? ''}
                            onChange={e => setApplianceDraft({ ...applianceDraft, ev_typical_charging_capacity_kw: e.target.value ? parseFloat(e.target.value) : null })}
                            style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                            disabled={!editingAppliances || busy}
                            placeholder="e.g. 3.3, 7, 11, 22"
                          />
                        </div>
                      )}

                      {/* EV Type (conditional) */}
                      {(applianceDraft.num_ev_chargers ?? 0) > 0 && (
                        <div>
                          <label style={labelStyle}>Primary EV Type</label>
                          <select
                            value={applianceDraft.ev_type ?? ''}
                            onChange={e => setApplianceDraft({ ...applianceDraft, ev_type: e.target.value })}
                            style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8, cursor: editingAppliances ? 'pointer' : 'not-allowed', background: nativeSelectBg, color: nativeSelectFg }}
                            disabled={!editingAppliances || busy}
                          >
                            <option value="">Select type</option>
                            <option value="two_wheeler">Two-wheeler</option>
                            <option value="three_wheeler">Three-wheeler</option>
                            <option value="four_wheeler">Four-wheeler</option>
                          </select>
                        </div>
                      )}

                      {/* Water Pump */}
                      <div>
                        <label style={labelStyle}>Has Water/Irrigation Pump</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <input
                            type="checkbox"
                            checked={applianceDraft.has_water_pump ?? false}
                            onChange={e => setApplianceDraft({ ...applianceDraft, has_water_pump: e.target.checked })}
                            disabled={!editingAppliances || busy}
                            style={{ cursor: editingAppliances ? 'pointer' : 'not-allowed', width: 18, height: 18 }}
                          />
                          <span style={{ fontSize: '0.85rem', color: textSub }}>Yes, has pump</span>
                        </div>
                      </div>

                      {/* Pump Capacity (conditional) */}
                      {(applianceDraft.has_water_pump ?? false) && (
                        <div>
                          <label style={labelStyle}>Pump Capacity (HP)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={applianceDraft.water_pump_capacity_hp ?? ''}
                            onChange={e => setApplianceDraft({ ...applianceDraft, water_pump_capacity_hp: e.target.value ? parseFloat(e.target.value) : null })}
                            style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                            disabled={!editingAppliances || busy}
                            placeholder="e.g. 0.5, 1, 2, 3"
                          />
                        </div>
                      )}

                      {/* Microwave */}
                      <div>
                        <label style={labelStyle}>Has Microwave</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <input
                            type="checkbox"
                            checked={applianceDraft.has_microwave ?? false}
                            onChange={e => setApplianceDraft({ ...applianceDraft, has_microwave: e.target.checked })}
                            disabled={!editingAppliances || busy}
                            style={{ cursor: editingAppliances ? 'pointer' : 'not-allowed', width: 18, height: 18 }}
                          />
                          <span style={{ fontSize: '0.85rem', color: textSub }}>Yes, has microwave</span>
                        </div>
                      </div>

                      {/* Desert Cooler */}
                      <div>
                        <label style={labelStyle}>Has Desert Cooler</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <input
                            type="checkbox"
                            checked={applianceDraft.has_desert_cooler ?? false}
                            onChange={e => setApplianceDraft({ ...applianceDraft, has_desert_cooler: e.target.checked })}
                            disabled={!editingAppliances || busy}
                            style={{ cursor: editingAppliances ? 'pointer' : 'not-allowed', width: 18, height: 18 }}
                          />
                          <span style={{ fontSize: '0.85rem', color: textSub }}>Yes, has desert cooler</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Circuit Topology Section */}
                  <div style={{ height: 1, background: border, margin: '24px 0' }} />
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', color: textMain }}>Inverter Circuit Topology</h3>
                    </div>
                    <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: textMute, lineHeight: 1.5 }}>
                      Deye inverters only measure loads on the backup AC output bus. Specify how many of each appliance
                      are wired to the inverter (vs. MSEB grid panel direct). The load forecast model uses these counts —
                      not the totals above — when no CT clamp is installed.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>

                      {/* AC units on inverter */}
                      {(applianceDraft.num_ac_units ?? 0) > 0 && (
                        <div>
                          <label style={labelStyle}>
                            ACs on Inverter Bus
                            <span style={{ marginLeft: 6, fontSize: '0.78rem', color: textMute }}>
                              (of {applianceDraft.num_ac_units} total)
                            </span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={applianceDraft.num_ac_units ?? 0}
                            value={applianceDraft.ac_units_on_inverter ?? ''}
                            onChange={e => setApplianceDraft({ ...applianceDraft, ac_units_on_inverter: e.target.value === '' ? null : Math.min(parseInt(e.target.value) || 0, applianceDraft.num_ac_units ?? 0) })}
                            style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                            disabled={!editingAppliances || busy}
                            placeholder="e.g. 3"
                          />
                        </div>
                      )}

                      {/* Geysers on inverter */}
                      {(applianceDraft.num_geysers ?? 0) > 0 && (
                        <div>
                          <label style={labelStyle}>
                            Geysers on Inverter Bus
                            <span style={{ marginLeft: 6, fontSize: '0.78rem', color: textMute }}>
                              (of {applianceDraft.num_geysers} total)
                            </span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={applianceDraft.num_geysers ?? 0}
                            value={applianceDraft.geysers_on_inverter ?? ''}
                            onChange={e => setApplianceDraft({ ...applianceDraft, geysers_on_inverter: e.target.value === '' ? null : Math.min(parseInt(e.target.value) || 0, applianceDraft.num_geysers ?? 0) })}
                            style={{ ...inputStyle, width: '100%', opacity: editingAppliances ? 1 : 0.8 }}
                            disabled={!editingAppliances || busy}
                            placeholder="e.g. 0"
                          />
                        </div>
                      )}

                      {/* EV charger on inverter */}
                      {(applianceDraft.num_ev_chargers ?? 0) > 0 && (
                        <div>
                          <label style={labelStyle}>EV Charger on Inverter Bus</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            <input
                              type="checkbox"
                              checked={applianceDraft.ev_charger_on_inverter ?? false}
                              onChange={e => setApplianceDraft({ ...applianceDraft, ev_charger_on_inverter: e.target.checked })}
                              disabled={!editingAppliances || busy}
                              style={{ cursor: editingAppliances ? 'pointer' : 'not-allowed', width: 18, height: 18 }}
                            />
                            <span style={{ fontSize: '0.85rem', color: textSub }}>Yes, charger is on inverter</span>
                          </div>
                        </div>
                      )}

                      {/* Pump on inverter */}
                      {(applianceDraft.has_water_pump ?? false) && (
                        <div>
                          <label style={labelStyle}>Pump on Inverter Bus</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            <input
                              type="checkbox"
                              checked={applianceDraft.pump_on_inverter ?? false}
                              onChange={e => setApplianceDraft({ ...applianceDraft, pump_on_inverter: e.target.checked })}
                              disabled={!editingAppliances || busy}
                              style={{ cursor: editingAppliances ? 'pointer' : 'not-allowed', width: 18, height: 18 }}
                            />
                            <span style={{ fontSize: '0.85rem', color: textSub }}>Yes, pump is on inverter</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CT Load Forecast Toggle */}
                    <div style={{
                      marginTop: 20, padding: '14px 16px', borderRadius: 10,
                      border: `1px solid ${applianceDraft.ct_load_forecast_enabled ? 'rgba(0,166,62,0.4)' : inputBorder}`,
                      background: applianceDraft.ct_load_forecast_enabled ? 'rgba(0,166,62,0.06)' : inputBg,
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}>
                      <input
                        type="checkbox"
                        checked={applianceDraft.ct_load_forecast_enabled ?? false}
                        onChange={e => setApplianceDraft({ ...applianceDraft, ct_load_forecast_enabled: e.target.checked })}
                        disabled={!editingAppliances || busy || !(applianceDraft.ct_present ?? false)}
                        style={{ cursor: (editingAppliances && (applianceDraft.ct_present ?? false)) ? 'pointer' : 'not-allowed', width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: textMain }}>
                          CT-Based Total Load Forecast
                        </div>
                        <div style={{ fontSize: '0.8rem', color: textMute, marginTop: 3, lineHeight: 1.5 }}>
                          {(applianceDraft.ct_present ?? false)
                            ? 'When enabled, the load model predicts total household load (inverter + grid-direct) using the CT clamp signal.'
                            : 'Requires a CT clamp to be installed and ct_present = True. Contact field ops to install a CT clamp before enabling.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div style={{ height: 1, background: border, margin: '24px 0' }} />
                  <div>
                    <label style={labelStyle}>Notes</label>
                    <textarea
                      value={applianceDraft.appliance_notes ?? ''}
                      onChange={e => setApplianceDraft({ ...applianceDraft, appliance_notes: e.target.value })}
                      style={{
                        width: '100%', minHeight: 100, padding: '10px 14px',
                        borderRadius: 8, border: `1px solid ${inputBorder}`, background: inputBg,
                        color: textMain, fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none',
                        opacity: editingAppliances ? 1 : 0.8, resize: 'vertical',
                        transition: 'border-color 150ms'
                      }}
                      placeholder="Additional notes about appliances (optional)"
                      disabled={!editingAppliances || busy}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* LIFECYCLE TAB */}
            {tab === 'lifecycle' && (
              <motion.div key="lifecycle" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: MOTION_EASE }}>
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Settings size={18} color={textMute} />
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: textMain }}>Lifecycle Management</h2>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: textMute, margin: '0 0 24px' }}>
                    Change the operational state of this site. Invalid API state transitions will be automatically rejected.
                  </p>

                  <div style={{ padding: 20, borderRadius: 12, background: inputBg, border: `1px solid ${inputBorder}` }}>
                    <label style={labelStyle}>Target Status</label>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <select
                        value={lifecycleTo} onChange={e => setLifecycleTo(e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', background: nativeSelectBg, color: nativeSelectFg }}
                      >
                        {LIFECYCLE_OPTIONS.map(o => (
                          <option key={o} value={o}>{o.toUpperCase()}</option>
                        ))}
                      </select>
                      <button type="button" disabled={busy || lifecycleTo === site?.site_status} onClick={handleLifecycle} style={buttonStyle()}>
                        Apply Transition
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 24, padding: 20, borderRadius: 12, border: `2px solid ${palette.err.border}`, background: palette.err.bg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <AlertTriangle size={18} color={palette.err.color} />
                      <h3 style={{ margin: 0, fontSize: '1rem', color: palette.err.color }}>Delete Site</h3>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: textSub, margin: '0 0 12px' }}>
                      Permanently delete this site and all associated data. This action cannot be undone.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { setShowDeleteModal(true); setDeleteConfirmationText(''); }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 6,
                        border: 'none',
                        background: palette.err.color,
                        color: '#fff',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: busy ? 0.5 : 1,
                      }}
                    >
                      Delete Site
                    </button>
                  </div>
                </div>
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
                    <span className="portal-modal-title">Delete Site</span>
                  </div>
                  <button onClick={() => setShowDeleteModal(false)} className="portal-modal-close-btn">
                    <X size={16} />
                  </button>
                </div>
                <div className="portal-modal-body">
                  <p>
                    Are you sure you want to permanently delete <strong>{site?.display_name || site?.site_id}</strong>?
                  </p>
                  <div className="portal-modal-warning-box">
                    <strong><AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Warning:</strong> This will permanently delete the site and all associated data. This action cannot be undone.
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 8 }}>Type "delete" to confirm:</label>
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
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteSite}
                    disabled={deleteConfirmationText !== 'delete' || busy}
                    className="portal-modal-btn portal-modal-btn-danger"
                    style={{ opacity: (deleteConfirmationText !== 'delete' || busy) ? 0.5 : 1 }}
                  >
                    {busy ? 'Deleting...' : 'Yes, Delete Site'}
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
