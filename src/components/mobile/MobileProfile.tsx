import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  User, Mail, Phone, MapPin, Calendar, Shield, Lock,
  Edit2, Save, X, Check, Eye, EyeOff, RefreshCw,
  Crown, LogOut,
} from 'lucide-react';

interface ProfileData {
  id: number; username: string; email: string;
  first_name: string; last_name: string;
  mobile_number?: string; address?: string;
  is_staff: boolean; is_superuser: boolean; date_joined: string;
}

const AVATAR_COLORS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#ec4899,#be185d)',
  'linear-gradient(135deg,#14b8a6,#0f766e)',
];
const avatarBg = (s: string) => { let h=0; for (const c of s) h=c.charCodeAt(0)+((h<<5)-h); return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length]; };
const initials = (p: ProfileData) => {
  if (p.first_name && p.last_name) return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
  return p.username.substring(0,2).toUpperCase();
};

const MobileProfile: React.FC = () => {
  const { isDark } = useTheme();
  const { user: authUser, logout } = useAuth();

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';
  const inputBg = isDark ? '#0a1628' : '#f8fafc';

  const [profile, setProfile]       = useState<ProfileData|null>(null);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [success, setSuccess]       = useState('');
  const [error, setError]           = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [showNewPw, setShowNewPw]   = useState(false);

  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', email: '', mobile_number: '', address: '',
  });
  const [pwForm, setPwForm] = useState({
    current_password: '', new_password: '', confirm_password: '',
  });

  useEffect(() => {
    apiService.getProfile().then((data: ProfileData) => {
      setProfile(data);
      setEditForm({ first_name:data.first_name, last_name:data.last_name, email:data.email, mobile_number:data.mobile_number??'', address:data.address??'' });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const updated = await apiService.updateProfile(editForm);
      setProfile(updated);
      setEditing(false);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) { setError(e?.message ?? 'Update failed'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm_password) { setError('Passwords do not match'); return; }
    if (pwForm.new_password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiService.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setChangingPw(false);
      setPwForm({ current_password:'', new_password:'', confirm_password:'' });
      setSuccess('Password changed successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) { setError(e?.message ?? 'Password change failed'); }
    finally { setSaving(false); }
  };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, ...extra,
  });
  const inputStyle: React.CSSProperties = {
    width:'100%', background:inputBg, border:`1px solid ${border}`, borderRadius:8,
    padding:'9px 12px', fontSize:'0.8rem', color:text, outline:'none', boxSizing:'border-box',
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:bg, gap:10, color:muted }}>
      <RefreshCw size={18} style={{ animation:'spin 1s linear infinite' }}/><span style={{ fontSize:'0.875rem' }}>Loading…</span>
    </div>
  );

  if (!profile) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:bg, color:muted, fontSize:'0.85rem' }}>
      Failed to load profile
    </div>
  );

  const av = avatarBg(profile.username);

  return (
    <div style={{ background:bg, minHeight:'100dvh', paddingBottom:96 }}>

      {/* Hero header */}
      <div style={{ background:'linear-gradient(135deg,#004d1e,#006b2b)', padding:'24px 16px 32px', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
        <div style={{ width:72, height:72, borderRadius:22, background:av, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', fontWeight:700, color:'#fff', border:'3px solid rgba(255,255,255,0.25)', boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
          {initials(profile)}
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'1.1rem', fontWeight:700, color:'#fff' }}>
            {profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.username}
          </div>
          <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.7)', marginTop:2 }}>@{profile.username}</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {profile.is_superuser && (
            <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background:'rgba(245,158,11,0.25)', color:'#fcd34d', border:'1px solid rgba(245,158,11,0.3)' }}>
              <Crown size={10}/> Admin
            </span>
          )}
          {profile.is_staff && !profile.is_superuser && (
            <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background:'rgba(59,130,246,0.25)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.3)' }}>
              <Shield size={10}/> Staff
            </span>
          )}
          <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background:'rgba(34,197,94,0.2)', color:'#86efac', border:'1px solid rgba(34,197,94,0.3)' }}>
            <Check size={10}/> Active
          </span>
        </div>
      </div>

      <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:10, marginTop:-8 }}>

        {success && (
          <div style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:10, padding:'10px 12px', fontSize:'0.75rem', color:'#22c55e', display:'flex', alignItems:'center', gap:6 }}>
            <Check size={14}/>{success}
          </div>
        )}
        {error && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px 12px', fontSize:'0.75rem', color:'#ef4444' }}>
            {error}
          </div>
        )}

        {/* Profile info card */}
        <div style={card({ padding:'14px' })}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.8rem', fontWeight:700, color:text }}>
              <User size={14} color={accent}/> Personal Info
            </div>
            <button onClick={() => editing ? setEditing(false) : setEditing(true)}
              style={{ background:`${accent}18`, border:`1px solid ${accent}44`, borderRadius:8, padding:'5px 10px', cursor:'pointer', color:accent, fontSize:'0.72rem', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              {editing ? <><X size={11}/>Cancel</> : <><Edit2 size={11}/>Edit</>}
            </button>
          </div>

          {editing ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { key:'first_name', label:'First Name', icon:<User size={13} color={muted}/> },
                { key:'last_name',  label:'Last Name',  icon:<User size={13} color={muted}/> },
                { key:'email',      label:'Email',      icon:<Mail size={13} color={muted}/>, type:'email' },
                { key:'mobile_number', label:'Mobile',  icon:<Phone size={13} color={muted}/> },
                { key:'address',    label:'Address',    icon:<MapPin size={13} color={muted}/> },
              ].map(({ key, label, icon, type='text' }) => (
                <div key={key}>
                  <div style={{ fontSize:'0.65rem', color:muted, marginBottom:4, display:'flex', alignItems:'center', gap:4 }}>{icon}{label}</div>
                  <input type={type} value={(editForm as any)[key]}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle}/>
                </div>
              ))}
              <button onClick={handleSaveProfile} disabled={saving}
                style={{ padding:'11px', background:'linear-gradient(135deg,#004d1e,#006b2b)', border:'none', borderRadius:10, cursor:'pointer', color:'#fff', fontSize:'0.875rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:saving?0.7:1 }}>
                <Save size={14}/>{saving?'Saving…':'Save Changes'}
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { icon:<Mail size={13} color={accent}/>,   label:'Email',   value:profile.email },
                { icon:<Phone size={13} color={accent}/>,  label:'Mobile',  value:profile.mobile_number || '—' },
                { icon:<MapPin size={13} color={accent}/>, label:'Address', value:profile.address || '—' },
                { icon:<Calendar size={13} color={accent}/>, label:'Joined', value:new Date(profile.date_joined).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:`${accent}12`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize:'0.62rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</div>
                    <div style={{ fontSize:'0.8rem', color:sub, marginTop:1 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Change password card */}
        <div style={card({ padding:'14px' })}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: changingPw ? 14 : 0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.8rem', fontWeight:700, color:text }}>
              <Lock size={14} color={accent}/> Password
            </div>
            <button onClick={() => setChangingPw(v => !v)}
              style={{ background:`${accent}18`, border:`1px solid ${accent}44`, borderRadius:8, padding:'5px 10px', cursor:'pointer', color:accent, fontSize:'0.72rem', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              {changingPw ? <><X size={11}/>Cancel</> : <><Lock size={11}/>Change</>}
            </button>
          </div>
          {changingPw && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { key:'current_password', label:'Current Password', show:showPw, toggle:() => setShowPw(v=>!v) },
                { key:'new_password',     label:'New Password',     show:showNewPw, toggle:() => setShowNewPw(v=>!v) },
                { key:'confirm_password', label:'Confirm Password', show:showNewPw, toggle:() => {} },
              ].map(({ key, label, show, toggle }) => (
                <div key={key}>
                  <div style={{ fontSize:'0.65rem', color:muted, marginBottom:4 }}>{label}</div>
                  <div style={{ position:'relative' }}>
                    <input type={show?'text':'password'} value={(pwForm as any)[key]}
                      onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ ...inputStyle, paddingRight:36 }}/>
                    <button onClick={toggle} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:muted, display:'flex' }}>
                      {show ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={handleChangePassword} disabled={saving}
                style={{ padding:'11px', background:'linear-gradient(135deg,#004d1e,#006b2b)', border:'none', borderRadius:10, cursor:'pointer', color:'#fff', fontSize:'0.875rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:saving?0.7:1 }}>
                <Lock size={14}/>{saving?'Updating…':'Update Password'}
              </button>
            </div>
          )}
        </div>

        {/* Account info */}
        <div style={card({ padding:'14px' })}>
          <div style={{ fontSize:'0.8rem', fontWeight:700, color:text, marginBottom:12 }}>Account</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { label:'Role',      value:profile.is_superuser ? 'Administrator' : profile.is_staff ? 'Staff' : 'User' },
              { label:'User ID',   value:`#${profile.id}` },
              { label:'Username',  value:profile.username },
              { label:'Status',    value:'Active' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:'0.78rem', color:sub, fontWeight:500 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button onClick={() => logout && logout()}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, cursor:'pointer', color:'#ef4444', fontSize:'0.85rem', fontWeight:600 }}>
          <LogOut size={15}/> Sign Out
        </button>
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
};

export default MobileProfile;
