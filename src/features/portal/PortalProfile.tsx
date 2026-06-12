import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Upload, Mail, Phone, MapPin, Calendar, Edit2, Save, X, AlertCircle, Check, Zap, Star, Crown, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import SiteMembersCard from './members/SiteMembersCard';
import SecurityCard from './security/SecurityCard';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import MobilePortalProfile from '../mobile/portal/MobilePortalProfile';

const PRIMARY='#2FBF71', PRIMARY_D='#1A9955', AMBER='#E9B949', NAVY='#2B4A6B', WARN='#F59E0B';
const tokens=(dark:boolean)=>({bg:dark?'#0D1117':'#F6F8FA',surface:dark?'#161B22':'#FFFFFF',border:dark?'#30363D':'#D0D7DE',text:dark?'#E6EDF3':'#1F2328',muted:dark?'#8B949E':'#57606A',inputBg:dark?'#0D1117':'#FFFFFF'});

const PLAN:Record<string,{label:string;icon:React.ReactNode;color:string;border:string;bg:string}>={
  free:   {label:'Free',   icon:<Zap size={11}/>,  color:'#8B949E',border:'rgba(139,148,158,0.3)',bg:'rgba(139,148,158,0.1)'},
  basic:  {label:'Basic',  icon:<Star size={11}/>, color:'#79C0FF',border:'rgba(121,192,255,0.3)',bg:'rgba(121,192,255,0.08)'},
  premium:{label:'Premium',icon:<Crown size={11}/>,color:AMBER,   border:'rgba(233,185,73,0.35)',bg:'rgba(233,185,73,0.1)'},
};
const AV=[
  `linear-gradient(135deg,${PRIMARY} 0%,${PRIMARY_D} 100%)`,
  `linear-gradient(135deg,${NAVY} 0%,#1a2e42 100%)`,
  'linear-gradient(135deg,#4CAF82 0%,#2e6b53 100%)',
  'linear-gradient(135deg,#8B5CF6 0%,#6D28D9 100%)',
  `linear-gradient(135deg,${AMBER} 0%,#B45309 100%)`
];
const gac=(s:string)=>{let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return AV[Math.abs(h)%AV.length];};
const gin=(a:string,b:string,c:string)=>{if(a&&b)return`${a[0]}${b[0]}`.toUpperCase();if(a)return a.substring(0,2).toUpperCase();return c.substring(0,2).toUpperCase();};

const OTPInput:React.FC<{value:string;onChange:(v:string)=>void;accent:string;dark:boolean}>=({value,onChange,accent,dark})=>{
  const tok=tokens(dark);
  const r=[useRef<HTMLInputElement>(null),useRef<HTMLInputElement>(null),useRef<HTMLInputElement>(null),useRef<HTMLInputElement>(null),useRef<HTMLInputElement>(null),useRef<HTMLInputElement>(null)];
  const d=value.padEnd(6,'').split('').slice(0,6);
  const hk=(i:number,e:React.KeyboardEvent<HTMLInputElement>)=>{if(e.key==='Backspace'){onChange(d.map((x,idx)=>idx===i?'':x).join(''));if(i>0)r[i-1].current?.focus();}};
  const hc=(i:number,v:string)=>{const ch=v.replace(/\D/g,'').slice(-1);onChange(d.map((x,idx)=>idx===i?ch:x).join(''));if(ch&&i<5)r[i+1].current?.focus();};
  const hp=(e:React.ClipboardEvent)=>{const p=e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);onChange(p.padEnd(6,''));r[Math.min(p.length,5)].current?.focus();e.preventDefault();};
  return(<div style={{display:'flex',gap:8,justifyContent:'center'}}>{r.map((ref,i)=>(<input key={i} ref={ref} type="text" inputMode="numeric" maxLength={1} value={d[i]||''} onChange={e=>hc(i,e.target.value)} onKeyDown={e=>hk(i,e)} onPaste={hp} style={{width:44,height:52,textAlign:'center',fontSize:22,fontWeight:700,background:tok.inputBg,border:`2px solid ${d[i]?accent:tok.border}`,borderRadius:8,color:tok.text,outline:'none',transition:'border-color 0.15s',fontFamily:"'Fira Code',monospace",cursor:'text'}} onFocus={e=>e.currentTarget.style.borderColor=accent} onBlur={e=>e.currentTarget.style.borderColor=d[i]?accent:tok.border}/>))}</div>);
};

interface EMProps{profile:any;dark:boolean;onSave:(f:any)=>Promise<void>;onClose:()=>void;}
const EditModal:React.FC<EMProps>=({profile,dark,onSave,onClose})=>{
  const tok=tokens(dark);const accent=PRIMARY;
  const [step,setStep]=useState<'form'|'otp'>('form');
  const [form,setForm]=useState({first_name:profile.first_name||'',last_name:profile.last_name||'',email:profile.email||'',mobile_number:profile.mobile_number||'',address:profile.address||''});
  const [otp,setOtp]=useState('');const [saving,setSaving]=useState(false);const [sending,setSending]=useState(false);
  const [err,setErr]=useState<string|null>(null);const [otpErr,setOtpErr]=useState<string|null>(null);
  const emailChanged=form.email!==profile.email;const phoneChanged=form.mobile_number!==(profile.mobile_number||'');
  const sensitive=emailChanged||phoneChanged;
  const handleNext=async(e:React.FormEvent)=>{
    e.preventDefault();setErr(null);
    if(sensitive){
      setSending(true);
      try{
        if(emailChanged){const res=await apiService.checkContactAvailable('email',form.email);if(!res.available){setErr('This email is already registered to another account.');return;}}
        if(phoneChanged&&form.mobile_number){const res=await apiService.checkContactAvailable('phone',form.mobile_number);if(!res.available){setErr('This phone number is already registered to another account.');return;}}
        await apiService.requestPasswordResetOTP({email:profile.email});setStep('otp');
      }catch(e:any){setErr(e?.message||'Failed to send code');}finally{setSending(false);}
    }else{setSaving(true);try{await onSave(form);onClose();}catch(e:any){setErr(e?.message||'Failed to save');}finally{setSaving(false);}}
  };
  const handleVerify=async(e:React.FormEvent)=>{
    e.preventDefault();if(otp.replace(/\D/g,'').length<6){setOtpErr('Enter the 6-digit code');return;}
    setSaving(true);setOtpErr(null);
    try{await apiService.verifyPasswordResetOTP({email:profile.email,otp:otp.replace(/\D/g,'')});await onSave(form);onClose();}
    catch(e:any){setOtpErr(e?.message||'Invalid or expired code');}finally{setSaving(false);}
  };
  const inp={width:'100%',padding:'10px 13px',background:tok.inputBg,border:`1px solid ${tok.border}`,borderRadius:8,color:tok.text,fontSize:14,boxSizing:'border-box' as const,fontFamily:'inherit',outline:'none',transition:'border-color 0.2s,box-shadow 0.2s'};
  const lbl={display:'block' as const,fontSize:11,color:tok.muted,fontWeight:600 as const,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:7};
  const fo=(e:any)=>{e.currentTarget.style.borderColor=accent;e.currentTarget.style.boxShadow=`0 0 0 3px ${accent}18`;};
  const fb=(e:any,ov?:string)=>{e.currentTarget.style.borderColor=ov||tok.border;e.currentTarget.style.boxShadow='none';};
  return ReactDOM.createPortal(
    <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}} onClick={onClose}/>
      <div style={{position:'relative',width:'100%',maxWidth:540,background:tok.surface,border:`1px solid ${accent}55`,borderRadius:16,padding:32,boxShadow:`0 32px 80px rgba(0,0,0,0.35),0 0 0 1px ${accent}15`,animation:'pem-in 0.2s ease'}}>
        <style>{`@keyframes pem-in{from{opacity:0;transform:scale(0.96) translateY(10px);}to{opacity:1;transform:scale(1) translateY(0);}}`}</style>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:38,height:38,borderRadius:10,background:`${accent}18`,border:`1px solid ${accent}38`,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {step==='form'?<Edit2 size={17} color={accent}/>:<ShieldCheck size={17} color={accent}/>}
            </div>
            <div><h2 style={{fontSize:18,fontWeight:700,color:tok.text,margin:0}}>{step==='form'?'Edit Profile':'Verify Identity'}</h2>
              <p style={{fontSize:12,color:tok.muted,margin:'3px 0 0'}}>{step==='form'?'Update your account details':`Code sent to ${profile.email}`}</p></div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',cursor:'pointer',color:tok.muted,padding:6,borderRadius:8,display:'flex'}} onMouseEnter={e=>{(e.currentTarget as any).style.color=tok.text;}} onMouseLeave={e=>{(e.currentTarget as any).style.color=tok.muted;}}><X size={20}/></button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:22}}>
          {['Details','Verify'].map((label,i)=>(<React.Fragment key={i}><div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:22,height:22,borderRadius:'50%',background:(i===0&&step==='form')||(i===1&&step==='otp')?accent:i<(step==='otp'?1:0)?`${accent}60`:tok.border,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',flexShrink:0}}>
              {i<(step==='otp'?1:0)?<Check size={12}/>:i+1}</div>
            <span style={{fontSize:11,color:(i===0&&step==='form')||(i===1&&step==='otp')?tok.text:tok.muted,fontWeight:500}}>{label}</span>
          </div>{i===0&&<div style={{flex:1,height:1,background:step==='otp'?`${accent}50`:tok.border,maxWidth:40}}/>}</React.Fragment>))}
        </div>
        {step==='form'&&(<form onSubmit={handleNext}>
          {err&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(248,81,73,0.1)',border:'1px solid rgba(248,81,73,0.3)',borderRadius:8,marginBottom:14}}><AlertCircle size={14} color="#F85149"/><span style={{fontSize:13,color:'#F85149'}}>{err}</span></div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            {[{k:'first_name',l:'First Name',t:'text'},{k:'last_name',l:'Last Name',t:'text'}].map(f=>(<div key={f.k}><label style={lbl}>{f.l}</label><input type={f.t} value={(form as any)[f.k]} onChange={e=>setForm(x=>({...x,[f.k]:e.target.value}))} style={inp} onFocus={fo} onBlur={e=>fb(e)}/></div>))}
            <div style={{gridColumn:'1 / -1'}}><label style={lbl}>Email Address {emailChanged&&<span style={{marginLeft:6,fontSize:10,color:WARN,fontWeight:700}}>⚠ requires verification</span>}</label>
              <input type="email" value={form.email} onChange={e=>setForm(x=>({...x,email:e.target.value}))} style={{...inp,borderColor:emailChanged?WARN:tok.border}} onFocus={fo} onBlur={e=>fb(e,emailChanged?WARN:undefined)}/></div>
            <div style={{gridColumn:'1 / -1'}}><label style={lbl}>Phone Number {phoneChanged&&<span style={{marginLeft:6,fontSize:10,color:WARN,fontWeight:700}}>⚠ requires verification</span>}</label>
              <input type="tel" value={form.mobile_number} onChange={e=>setForm(x=>({...x,mobile_number:e.target.value}))} style={{...inp,borderColor:phoneChanged?WARN:tok.border}} onFocus={fo} onBlur={e=>fb(e,phoneChanged?WARN:undefined)}/></div>
            <div style={{gridColumn:'1 / -1'}}><label style={lbl}>Address</label><textarea value={form.address} onChange={e=>setForm(x=>({...x,address:e.target.value}))} style={{...inp,minHeight:68,resize:'vertical' as const}} onFocus={fo} onBlur={e=>fb(e)}/></div>
          </div>
          {sensitive&&<div style={{padding:'10px 14px',background:`${WARN}0d`,border:`1px solid ${WARN}28`,borderRadius:8,marginBottom:14,display:'flex',alignItems:'flex-start',gap:8}}><ShieldCheck size={14} color={WARN} style={{marginTop:1,flexShrink:0}}/><p style={{fontSize:12,color:tok.muted,margin:0,lineHeight:1.5}}>We will check availability and send a code to <strong style={{color:tok.text}}>{profile.email}</strong> to verify your identity.</p></div>}
          <div style={{display:'flex',gap:10}}>
            <button type="submit" disabled={sending||saving} style={{flex:1,padding:'11px 16px',background:sending||saving?`${accent}65`:accent,color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:sending||saving?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'background 0.2s'}} onMouseEnter={e=>{if(!sending&&!saving)(e.currentTarget as any).style.background=PRIMARY_D;}} onMouseLeave={e=>{if(!sending&&!saving)(e.currentTarget as any).style.background=accent;}}>
              {sending?'Checking…':sensitive?<><ShieldCheck size={14}/>Continue</>:<><Save size={14}/>Save Changes</>}
            </button>
            <button type="button" onClick={onClose} style={{padding:'11px 20px',background:'transparent',color:tok.muted,border:`1px solid ${tok.border}`,borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all 0.2s'}} onMouseEnter={e=>{(e.currentTarget as any).style.borderColor=tok.muted;(e.currentTarget as any).style.color=tok.text;}} onMouseLeave={e=>{(e.currentTarget as any).style.borderColor=tok.border;(e.currentTarget as any).style.color=tok.muted;}}>Cancel</button>
          </div>
        </form>)}
        {step==='otp'&&(<form onSubmit={handleVerify}>
          <p style={{fontSize:14,color:tok.muted,textAlign:'center',marginBottom:28,lineHeight:1.6}}>Enter the 6-digit code sent to<br/><strong style={{color:tok.text}}>{profile.email}</strong></p>
          <OTPInput value={otp} onChange={setOtp} accent={accent} dark={dark}/>
          {otpErr&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(248,81,73,0.1)',border:'1px solid rgba(248,81,73,0.3)',borderRadius:8,marginTop:14}}><AlertCircle size={14} color="#F85149"/><span style={{fontSize:13,color:'#F85149'}}>{otpErr}</span></div>}
          <div style={{display:'flex',gap:10,marginTop:22}}>
            <button type="button" onClick={()=>{setStep('form');setOtp('');setOtpErr(null);}} style={{padding:'11px 16px',background:'transparent',color:tok.muted,border:`1px solid ${tok.border}`,borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer'}} onMouseEnter={e=>{(e.currentTarget as any).style.borderColor=tok.muted;(e.currentTarget as any).style.color=tok.text;}} onMouseLeave={e=>{(e.currentTarget as any).style.borderColor=tok.border;(e.currentTarget as any).style.color=tok.muted;}}>← Back</button>
            <button type="submit" disabled={saving||otp.replace(/\D/g,'').length<6} style={{flex:1,padding:'11px 16px',background:saving||otp.replace(/\D/g,'').length<6?`${accent}50`:accent,color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}} onMouseEnter={e=>{if(!saving)(e.currentTarget as any).style.background=PRIMARY_D;}} onMouseLeave={e=>{if(!saving)(e.currentTarget as any).style.background=accent;}}><Save size={14}/>{saving?'Saving…':'Confirm & Save'}</button>
          </div>
          <p style={{textAlign:'center',marginTop:14,fontSize:12,color:tok.muted}}>Didn't receive it? <button type="button" style={{background:'none',border:'none',color:accent,fontSize:12,cursor:'pointer',fontWeight:600}} onClick={async()=>{try{await apiService.requestPasswordResetOTP({email:profile.email});}catch{}}}>Resend code</button></p>
        </form>)}
      </div>
    </div>,document.body
  );
};

const PortalProfile:React.FC=()=>{
  const isMobile = useIsMobile();
  const {user,updateUser}=useAuth();const {isDark}=useTheme();const tok=tokens(isDark);const ACCENT=PRIMARY;
  const fileRef=useRef<HTMLInputElement>(null);
  const [profile,setProfile]=useState<any>(null);const [portalSites,setPortalSites]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);const [success,setSuccess]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);const [showEdit,setShowEdit]=useState(false);
  const [avPrev,setAvPrev]=useState<string|null>(null);const [avUrl,setAvUrl]=useState<string|null>(null);
  const [upAv,setUpAv]=useState(false);

  useEffect(()=>{(async()=>{try{const [data,summary]=await Promise.all([apiService.getProfile(),apiService.getPortalSummary()]);setProfile(data);setAvUrl(data.avatar_url||null);setPortalSites(summary.sites||[]);}catch(e:any){setError(e?.message||'Failed to load profile');}finally{setLoading(false);}})();},[]);

  if (isMobile) return <MobilePortalProfile />;

  const handleSave=async(form:any)=>{const u=await apiService.updateProfile(form);setProfile((p:any)=>({...p,...u}));if(user)updateUser({first_name:form.first_name,last_name:form.last_name});setSuccess('Profile updated successfully');setTimeout(()=>setSuccess(null),3000);};
  const handleAv=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.currentTarget.files?.[0];if(!f)return;
    if(!f.type.startsWith('image/')){setError('Please select an image file');return;}
    if(f.size>5*1024*1024){setError('Image must be less than 5MB');return;}
    const r=new FileReader();r.onload=(ev)=>setAvPrev(ev.target?.result as string);r.readAsDataURL(f);
    setUpAv(true);try{const res=await apiService.uploadProfilePicture(f);if(res.avatar_url)setAvUrl(res.avatar_url);setSuccess('Photo updated');setTimeout(()=>{setAvPrev(null);setSuccess(null);},2000);}catch{setError('Failed to upload photo');setAvPrev(null);}finally{setUpAv(false);if(fileRef.current)fileRef.current.value='';}
  };

  if(loading)return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300,background:tok.bg}}><div style={{textAlign:'center'}}><div style={{width:44,height:44,borderRadius:'50%',border:`3px solid ${ACCENT}20`,borderTop:`3px solid ${ACCENT}`,animation:'ppsp 1s linear infinite',margin:'0 auto 14px'}}/><p style={{color:tok.muted,fontSize:13}}>Loading…</p></div><style>{`@keyframes ppsp{to{transform:rotate(360deg);}}`}</style></div>);
  if(!profile)return(<div style={{padding:40,textAlign:'center',background:tok.bg}}><AlertCircle size={36} color="#F85149" style={{margin:'0 auto 12px',display:'block'}}/><p style={{color:tok.text,fontWeight:600,marginBottom:6}}>Unable to load profile</p><p style={{color:tok.muted,fontSize:13}}>{error}</p></div>);

  const pt=profile?.plan_type??'free';const pc=PLAN[pt]??PLAN.free;
  const ini=gin(profile.first_name,profile.last_name,user?.username||'');
  const ag=gac(ini);
  const dn=`${profile.first_name} ${profile.last_name}`.trim()||user?.username||'';
  const jd=profile.date_joined?new Date(profile.date_joined).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'—';
  const ss=profile?.subscription_status?profile.subscription_status.charAt(0).toUpperCase()+profile.subscription_status.slice(1):'Trial';

  return(<div style={{minHeight:'100vh',background:tok.bg,padding:'48px 24px',fontFamily:"'Fira Sans','DM Sans',sans-serif",transition:'background 0.2s'}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Fira+Sans:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
    @keyframes ppsp{to{transform:rotate(360deg);}}@keyframes ppfu{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}@keyframes ppsd{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
    .pp-s:hover{border-color:${ACCENT}!important;transform:translateY(-3px);}.pp-c:hover{border-color:${ACCENT}!important;}.pp-aw:hover .pp-ao{opacity:1!important;}.pp-eb:hover{background:#3a5f8a!important;}`}</style>
    <div style={{maxWidth:1100,margin:'0 auto',animation:'ppfu 0.4s ease'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:48,flexWrap:'wrap',gap:24}}>
        <div style={{display:'flex',alignItems:'center',gap:32}}>
          <div style={{position:'relative',width:128,height:128,flexShrink:0}}>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAv} style={{display:'none'}}/>
            <div className="pp-aw" onClick={()=>fileRef.current?.click()} style={{width:128,height:128,borderRadius:'50%',cursor:'pointer',backgroundImage:avPrev?`url(${avPrev})`:avUrl?`url(${avUrl})`:ag,backgroundSize:'cover',backgroundPosition:'center',display:'flex',alignItems:'center',justifyContent:'center',fontSize:38,fontWeight:700,color:'#fff',border:`3px solid ${ACCENT}`,boxShadow:`0 0 20px ${ACCENT}30`,position:'relative',overflow:'hidden'} as React.CSSProperties}>
              {!avPrev&&!avUrl&&ini}
              <div className="pp-ao" style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5,opacity:0,transition:'opacity 0.25s',borderRadius:'50%'}}><Upload size={24} color={ACCENT}/><span style={{fontSize:10,color:ACCENT,fontWeight:600}}>Upload</span></div>
              {upAv&&<div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%'}}><div style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${ACCENT}35`,borderTop:`2px solid ${ACCENT}`,animation:'ppsp 0.8s linear infinite'}}/></div>}
            </div>
            <div style={{position:'absolute',bottom:5,right:5,width:14,height:14,borderRadius:'50%',background:'#3FB950',border:`2px solid ${tok.bg}`,boxShadow:'0 0 8px rgba(63,185,80,0.7)'}}/>
          </div>
          <div>
            <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,background:pc.bg,border:`1px solid ${pc.border}`,marginBottom:10}}>
              <span style={{color:pc.color,display:'flex'}}>{pc.icon}</span>
              <span style={{fontSize:10,color:pc.color,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>{pc.label}</span>
            </div>
            <h1 style={{fontSize:32,fontWeight:700,color:tok.text,margin:'0 0 5px',letterSpacing:'-0.02em'}}>{dn}</h1>
            <p style={{fontSize:15,color:ACCENT,margin:'0 0 7px',fontWeight:500}}>Customer</p>
            <div style={{display:'flex',alignItems:'center',gap:6}}><Calendar size={13} color={tok.muted}/><span style={{color:tok.muted,fontSize:13}}>Member since {jd}</span></div>
          </div>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <button className="pp-eb" onClick={()=>setShowEdit(true)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',background:NAVY,color:'#fff',border:'none',borderRadius:9,fontSize:14,fontWeight:600,cursor:'pointer',transition:'background 0.2s',boxShadow:'0 2px 8px rgba(43,74,107,0.3)'}}><Edit2 size={15}/>Edit Profile</button>
          <SecurityCard triggerOnly customerMode/>
        </div>
      </div>
      {success&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 16px',background:`${ACCENT}12`,border:`1px solid ${ACCENT}35`,borderRadius:8,marginBottom:24,animation:'ppsd 0.3s ease'}}><Check size={15} color={ACCENT}/><span style={{fontSize:13,color:ACCENT}}>{success}</span></div>}
      {error&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 16px',background:'rgba(248,81,73,0.08)',border:'1px solid rgba(248,81,73,0.22)',borderRadius:8,marginBottom:24}}><AlertCircle size={15} color="#F85149"/><span style={{fontSize:13,color:'#F85149'}}>{error}</span></div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(215px,1fr))',gap:14,marginBottom:28}}>
        {[{l:'Member Since',v:jd},{l:'Subscription',v:ss},{l:'Solar Devices',v:`${profile?.total_devices_count??0} / ${profile?.device_limit??5}`},{l:'Plan',v:pc.label}].map((s,i)=>(<div key={i} className="pp-s" style={{background:tok.surface,border:`1px solid ${tok.border}`,borderRadius:10,padding:'20px 22px',transition:'all 0.25s ease',cursor:'default',boxShadow:isDark?'none':'0 1px 4px rgba(0,0,0,0.06)'}}><div style={{fontSize:11,color:tok.muted,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:600,marginBottom:8}}>{s.l}</div><div style={{fontSize:19,fontWeight:700,color:ACCENT}}>{s.v}</div></div>))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(265px,1fr))',gap:14,marginBottom:32}}>
        {[{I:Mail,l:'Email',v:profile.email},{I:Phone,l:'Phone',v:profile.mobile_number||'Not provided'},{I:MapPin,l:'Address',v:profile.address||'Not provided'}].map((c,i)=>(<div key={i} className="pp-c" style={{background:tok.surface,border:`1px solid ${tok.border}`,borderRadius:10,padding:'20px 22px',transition:'border-color 0.2s',boxShadow:isDark?'none':'0 1px 4px rgba(0,0,0,0.06)'}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}><c.I size={16} color={ACCENT}/><span style={{fontSize:11,color:tok.muted,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:600}}>{c.l}</span></div><div style={{fontSize:14,color:tok.text,fontWeight:500,wordBreak:'break-all',fontFamily:"'Fira Code',monospace"}}>{c.v}</div></div>))}
      </div>
      {portalSites.filter((s:any)=>s.owner_user!=null&&Number(s.owner_user)===Number(user?.id)).map((site:any)=>(<div key={site.site_id} style={{marginBottom:20}}>{portalSites.length>1&&<div style={{fontSize:11,color:tok.muted,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600}}>{site.display_name}</div>}<SiteMembersCard siteId={site.site_id} ownerUserId={site.owner_user}/></div>))}
    </div>
    {showEdit&&profile&&<EditModal profile={profile} dark={isDark} onSave={handleSave} onClose={()=>setShowEdit(false)}/>}
  </div>);
};

export default PortalProfile;
