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

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';
  const accent  = '#2FBF71';
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC';

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

  const inputStyle: React.CSSProperties = {
    width: '100%', background: inputBg, border: `1px solid ${border}`, borderRadius: 10,
    padding: '10px 12px', fontSize: '0.82rem', color: text, outline: 'none', boxSizing: 'border-box',
    fontFamily: "'DM Sans', sans-serif",
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:bg, gap:10, color:muted }}>
      <RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }} />
      <span style={{ fontSize:'0.8rem', fontFamily:"'DM Sans', sans-serif" }}>Loading…</span>
    </div>
  );

  if (!profile) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:bg, color:muted, fontSize:'0.85rem', fontFamily:"'DM Sans', sans-serif" }}>
      Failed to load profile
    </div>
  );

  const av = avatarBg(profile.username);

  return (
    <div style={{ background:bg, minHeight:'100dvh', paddingBottom:96 }}>

      <div style={{ position:'sticky', top:0, zIndex:20, background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)', backdropFilter:'blur(20px)', borderBottom:`1px solid ${border}`, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', opacity:0.45, color:text, fontFamily:"'DM Sans', sans-serif" }}>Profile</div>
          <div style={{ fontSize:'0.85rem', fontWeight:600, color:text, fontFamily:"'Outfit', sans-serif", marginTop:1 }}>@{profile.username}</div>
        </div>
        {(profile.is_superuser || profile.is_staff) && (
          <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 11px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background: profile.is_superuser ? 'rgba(245,158,11,0.15)' : 'rgba(96,165,250,0.15)', color: profile.is_superuser ? '#F59E0B' : '#60A5FA', border:`1px solid ${profile.is_superuser ? 'rgba(245,158,11,0.3)' : 'rgba(96,165,250,0.3)'}`, fontFamily:"'DM Sans', sans-serif" }}>
            {profile.is_superuser ? <Crown size={11} /> : <Shield size={11} />}
            {profile.is_superuser ? 'Admin' : 'Staff'}
          </div>
        )}
      </div>

      {success && (
        <div style={{ position:'fixed', top:72, left:'50%', transform:'translateX(-50%)', zIndex:50, display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:12, background: isDark ? 'rgba(47,191,113,0.15)' : '#DCFCE7', border:'1px solid rgba(47,191,113,0.4)', boxShadow:'0 8px 24px rgba(0,0,0,0.2)', backdropFilter:'blur(16px)', maxWidth:'calc(100vw - 32px)' }}>
          <Check size={14} color="#2FBF71" />
          <span style={{ fontSize:'0.78rem', color:'#2FBF71', fontWeight:600, fontFamily:"'DM Sans', sans-serif", whiteSpace:'nowrap' }}>{success}</span>
        </div>
      )}
      {error && (
        <div style={{ position:'fixed', top:72, left:'50%', transform:'translateX(-50%)', zIndex:50, display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:12, background: isDark ? 'rgba(248,113,113,0.15)' : '#FEE2E2', border:'1px solid rgba(248,113,113,0.4)', boxShadow:'0 8px 24px rgba(0,0,0,0.2)', backdropFilter:'blur(16px)', maxWidth:'calc(100vw - 32px)' }}>
          <X size={14} color="#F87171" />
          <span style={{ fontSize:'0.78rem', color:'#F87171', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>{error}</span>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'28px 16px 20px' }}>
        <div style={{ width:60, height:60, borderRadius:'50%', background:av, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', fontWeight:700, color:'#fff', border:`2px solid ${border}`, boxShadow:'0 8px 28px rgba(0,0,0,0.2)', fontFamily:"'Outfit', sans-serif", marginBottom:12 }}>
          {initials(profile)}
        </div>
        <div style={{ fontSize:'1.15rem', fontWeight:700, color:text, fontFamily:"'Outfit', sans-serif", textAlign:'center' }}>
          {profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.username}
        </div>
        <div style={{ fontSize:'0.75rem', color:muted, marginTop:3, fontFamily:"'DM Sans', sans-serif" }}>@{profile.username}</div>
        <div style={{ display:'flex', gap:6, marginTop:10 }}>
          {profile.is_superuser && (
            <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 11px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background:'rgba(245,158,11,0.15)', color:'#F59E0B', border:'1px solid rgba(245,158,11,0.3)', fontFamily:"'DM Sans', sans-serif" }}>
              <Crown size={10} /> Admin
            </span>
          )}
          {profile.is_staff && !profile.is_superuser && (
            <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 11px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background:'rgba(96,165,250,0.15)', color:'#60A5FA', border:'1px solid rgba(96,165,250,0.3)', fontFamily:"'DM Sans', sans-serif" }}>
              <Shield size={10} /> Staff
            </span>
          )}
          <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 11px', borderRadius:999, fontSize:'0.65rem', fontWeight:700, background:'rgba(47,191,113,0.15)', color:'#2FBF71', border:'1px solid rgba(47,191,113,0.3)', fontFamily:"'DM Sans', sans-serif" }}>
            <Check size={10} /> Active
          </span>
        </div>
      </div>

      <div style={{ padding:'0 12px', display:'flex', flexDirection:'column', gap:10 }}>

        <div style={{ background:surface, backdropFilter:'blur(16px)', border:`1px solid ${border}`, borderRadius:16, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 14px', borderBottom: editing ? `1px solid ${border}` : 'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <div style={{ width:28, height:28, borderRadius:9, background:`${accent}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <User size={13} color={accent} />
              </div>
              <span style={{ fontSize:'0.82rem', fontWeight:700, color:text, fontFamily:"'Outfit', sans-serif" }}>Personal Info</span>
            </div>
            <button
              onClick={() => editing ? setEditing(false) : setEditing(true)}
              style={{ background: editing ? 'rgba(248,113,113,0.12)' : `${accent}18`, border:`1px solid ${editing ? 'rgba(248,113,113,0.3)' : accent + '44'}`, borderRadius:9, padding:'5px 11px', cursor:'pointer', color: editing ? '#F87171' : accent, fontSize:'0.72rem', fontWeight:600, display:'flex', alignItems:'center', gap:4, fontFamily:"'DM Sans', sans-serif" }}
            >
              {editing ? <><X size={11} />Cancel</> : <><Edit2 size={11} />Edit</>}
            </button>
          </div>

          {editing ? (
            <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'first_name', label:'First Name', icon:<User size={12} color={muted} /> },
                { key:'last_name',  label:'Last Name',  icon:<User size={12} color={muted} /> },
                { key:'email',      label:'Email',      icon:<Mail size={12} color={muted} />, type:'email' },
                { key:'mobile_number', label:'Mobile',  icon:<Phone size={12} color={muted} /> },
                { key:'address',    label:'Address',    icon:<MapPin size={12} color={muted} /> },
              ].map(({ key, label, icon, type='text' }) => (
                <div key={key}>
                  <div style={{ fontSize:'0.65rem', color:muted, marginBottom:5, display:'flex', alignItems:'center', gap:5, fontFamily:"'DM Sans', sans-serif", fontWeight:500 }}>{icon}{label}</div>
                  <input
                    type={type}
                    value={(editForm as any)[key]}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                style={{ padding:'12px', background:accent, border:'none', borderRadius:12, cursor:'pointer', color:'#fff', fontSize:'0.875rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:7, opacity:saving?0.7:1, fontFamily:"'Outfit', sans-serif", marginTop:2 }}
              >
                <Save size={14} />{saving?'Saving…':'Save Changes'}
              </button>
            </div>
          ) : (
            <div style={{ padding:'0 14px 14px' }}>
              {[
                { icon:<Mail size={13} color={accent} />,     label:'Email',   value:profile.email },
                { icon:<Phone size={13} color={accent} />,    label:'Mobile',  value:profile.mobile_number || '—' },
                { icon:<MapPin size={13} color={accent} />,   label:'Address', value:profile.address || '—' },
                { icon:<Calendar size={13} color={accent} />, label:'Joined',  value:new Date(profile.date_joined).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) },
              ].map(({ icon, label, value }, i) => (
                <div key={label} style={{ display:'flex', alignItems:'flex-start', gap:11, paddingTop:12, borderTop: i === 0 ? 'none' : `1px solid ${border}`, marginTop: i === 0 ? 0 : 0 }}>
                  <div style={{ width:30, height:30, borderRadius:9, background:`${accent}12`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
                  <div style={{ paddingTop:3 }}>
                    <div style={{ fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', opacity:0.45, color:text, fontFamily:"'DM Sans', sans-serif", marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:'0.82rem', color:muted, fontFamily:"'DM Sans', sans-serif" }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background:surface, backdropFilter:'blur(16px)', border:`1px solid ${border}`, borderRadius:16, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 14px', borderBottom: changingPw ? `1px solid ${border}` : 'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <div style={{ width:28, height:28, borderRadius:9, background:`${accent}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Lock size={13} color={accent} />
              </div>
              <span style={{ fontSize:'0.82rem', fontWeight:700, color:text, fontFamily:"'Outfit', sans-serif" }}>Password</span>
            </div>
            <button
              onClick={() => setChangingPw(v => !v)}
              style={{ background: changingPw ? 'rgba(248,113,113,0.12)' : `${accent}18`, border:`1px solid ${changingPw ? 'rgba(248,113,113,0.3)' : accent + '44'}`, borderRadius:9, padding:'5px 11px', cursor:'pointer', color: changingPw ? '#F87171' : accent, fontSize:'0.72rem', fontWeight:600, display:'flex', alignItems:'center', gap:4, fontFamily:"'DM Sans', sans-serif" }}
            >
              {changingPw ? <><X size={11} />Cancel</> : <><Lock size={11} />Change</>}
            </button>
          </div>
          {changingPw && (
            <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'current_password', label:'Current Password', show:showPw, toggle:() => setShowPw(v=>!v) },
                { key:'new_password',     label:'New Password',     show:showNewPw, toggle:() => setShowNewPw(v=>!v) },
                { key:'confirm_password', label:'Confirm Password', show:showNewPw, toggle:() => {} },
              ].map(({ key, label, show, toggle }) => (
                <div key={key}>
                  <div style={{ fontSize:'0.65rem', color:muted, marginBottom:5, fontFamily:"'DM Sans', sans-serif", fontWeight:500 }}>{label}</div>
                  <div style={{ position:'relative' }}>
                    <input
                      type={show?'text':'password'}
                      value={(pwForm as any)[key]}
                      onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ ...inputStyle, paddingRight:38 }}
                    />
                    <button onClick={toggle} style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:muted, display:'flex' }}>
                      {show ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={handleChangePassword}
                disabled={saving}
                style={{ padding:'12px', background:accent, border:'none', borderRadius:12, cursor:'pointer', color:'#fff', fontSize:'0.875rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:7, opacity:saving?0.7:1, fontFamily:"'Outfit', sans-serif", marginTop:2 }}
              >
                <Lock size={14} />{saving?'Updating…':'Update Password'}
              </button>
            </div>
          )}
        </div>

        <div style={{ background:surface, backdropFilter:'blur(16px)', border:`1px solid ${border}`, borderRadius:16, padding:'14px' }}>
          <div style={{ fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', opacity:0.45, color:text, fontFamily:"'DM Sans', sans-serif", marginBottom:12 }}>Account</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[
              ...(authUser?.is_staff ? [{ label:'Role', value:profile.is_superuser ? 'Administrator' : profile.is_staff ? 'Staff' : 'User' }] : []),
              { label:'User ID',  value:`#${profile.id}` },
              { label:'Username', value:profile.username },
              { label:'Status',   value:'Active' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', opacity:0.45, color:text, fontFamily:"'DM Sans', sans-serif", marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:'0.8rem', color:muted, fontWeight:500, fontFamily: label === 'User ID' || label === 'Username' ? "'JetBrains Mono', monospace" : "'DM Sans', sans-serif" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:'rgba(248,113,113,0.05)', border:'1px solid rgba(248,113,113,0.18)', borderRadius:16, padding:'4px' }}>
          <div style={{ padding:'6px 10px 8px', fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#F87171', opacity:0.7, fontFamily:"'DM Sans', sans-serif" }}>Danger Zone</div>
          <button
            onClick={() => logout && logout()}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px', width:'100%', background:'rgba(248,113,113,0.08)', border:'none', borderRadius:12, cursor:'pointer', color:'#F87171', fontSize:'0.875rem', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>

      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
};

export default MobileProfile;
