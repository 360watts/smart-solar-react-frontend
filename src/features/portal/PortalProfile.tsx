import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Shield, Lock, Check, Zap, Star, Crown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import SiteMembersCard from './members/SiteMembersCard';

const PLAN_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  free:    { label: 'Free',    icon: <Zap size={13} />,   color: '#8892A4', bg: 'rgba(136,146,164,0.1)', border: 'rgba(136,146,164,0.2)' },
  basic:   { label: 'Basic',   icon: <Star size={13} />,  color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)'  },
  premium: { label: 'Premium', icon: <Crown size={13} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)'  },
};

const SUBSCRIPTION_COLORS: Record<string, string> = {
  active:    '#34D399',
  trial:     '#FBBF24',
  suspended: '#F87171',
  cancelled: '#8892A4',
};

/* ─── Floating label input ───────────────────────────────────────────────── */
interface FloatInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  span?: boolean;
  isDark: boolean;
}

const FloatInput: React.FC<FloatInputProps> = ({ label, value, onChange, type = 'text', span, isDark }) => {
  const [focused, setFocused] = useState(false);
  const elevated = focused || value.length > 0;
  const border  = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const focusB  = '#F59E0B';
  const text    = isDark ? '#F0F4FF' : '#0A0E1A';
  const muted   = isDark ? '#8892A4' : '#64748B';
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';

  return (
    <div style={{ position: 'relative', gridColumn: span ? 'span 2' : undefined }}>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '22px 14px 8px',
          borderRadius: 10, outline: 'none', boxSizing: 'border-box',
          border: `1.5px solid ${focused ? focusB : border}`,
          background: inputBg,
          color: text, fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
          transition: 'border-color 0.18s ease',
          boxShadow: focused ? `0 0 0 3px rgba(245,158,11,0.1)` : 'none',
        }}
      />
      <label style={{
        position: 'absolute',
        left: 14,
        top: elevated ? 7 : '50%',
        transform: elevated ? 'none' : 'translateY(-50%)',
        fontSize: elevated ? 11 : 14,
        color: focused ? '#F59E0B' : muted,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: elevated ? 600 : 400,
        pointerEvents: 'none',
        transition: 'all 0.15s ease',
        letterSpacing: elevated ? '0.04em' : 0,
        textTransform: elevated ? 'uppercase' as const : 'none' as const,
      }}>
        {label}
      </label>
    </div>
  );
};

/* ─── Section card ───────────────────────────────────────────────────────── */
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; isDark: boolean; delay?: number }> = ({ title, icon, children, isDark, delay = 0 }) => (
  <div className="portal-fade-in" style={{ animationDelay: `${delay}ms`, background: isDark ? 'linear-gradient(145deg, #0F1623 0%, #0D1320 100%)' : '#FFFFFF', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 16 }}>
    <div style={{ padding: '18px 22px 16px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>{icon}</div>
      <h2 style={{ margin: 0, fontSize: 15, fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: isDark ? '#F0F4FF' : '#0A0E1A' }}>{title}</h2>
    </div>
    <div style={{ padding: '20px 22px' }}>{children}</div>
  </div>
);

/* ─── Main component ─────────────────────────────────────────────────────── */
const PortalProfile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { isDark } = useTheme();

  const [profile, setProfile]         = useState<any>(null);
  const [portalSites, setPortalSites] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [success, setSuccess]         = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [editForm, setEditForm]       = useState({ first_name: '', last_name: '', email: '', mobile_number: '', address: '' });
  const [pwForm, setPwForm]           = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwError, setPwError]         = useState<string | null>(null);
  const [pwSuccess, setPwSuccess]     = useState(false);

  const text    = isDark ? '#F0F4FF' : '#0A0E1A';
  const muted   = isDark ? '#8892A4' : '#64748B';

  useEffect(() => {
    (async () => {
      try {
        const [data, summary] = await Promise.all([apiService.getProfile(), apiService.getPortalSummary()]);
        setProfile(data);
        setPortalSites(summary.sites || []);
        setEditForm({ first_name: data.first_name || '', last_name: data.last_name || '', email: data.email || '', mobile_number: data.mobile_number || '', address: data.address || '' });
      } catch (e: any) {
        setError(e?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveProfile = async () => {
    setSaving(true); setSuccess(null); setError(null);
    try {
      const updated = await apiService.updateProfile(editForm);
      setProfile((p: any) => ({ ...p, ...updated }));
      if (user) updateUser({ first_name: editForm.first_name, last_name: editForm.last_name });
      setSuccess('Profile updated');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setPwError(null);
    if (pwForm.new_password !== pwForm.confirm_password) { setPwError('Passwords do not match'); return; }
    if (pwForm.new_password.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    try {
      await apiService.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwSuccess(true);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (e: any) {
      setPwError(e?.message || 'Failed to change password');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 16px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(245,158,11,0.15)', borderTop: '3px solid #F59E0B', animation: 'portal-spin 1s linear infinite' }} />
          <User size={20} color="#F59E0B" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        </div>
        <p style={{ color: muted, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading profile…</p>
      </div>
    </div>
  );

  const planType  = profile?.plan_type ?? 'free';
  const planCfg   = PLAN_CONFIG[planType] ?? PLAN_CONFIG.free;
  const subColor  = SUBSCRIPTION_COLORS[profile?.subscription_status ?? 'trial'] ?? '#8892A4';
  const initials  = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || user?.username?.[0]?.toUpperCase() || '?';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680, margin: '0 auto', width: '100%', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Page title + avatar */}
      <div className="portal-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 20, color: '#0A0E1A',
          boxShadow: '0 0 20px rgba(245,158,11,0.35)',
        }}>
          {initials}
        </div>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 26, color: text, margin: 0, letterSpacing: '-0.02em' }}>
            My Profile
          </h1>
          <p style={{ fontSize: 13, color: muted, marginTop: 3 }}>
            {user?.email}
          </p>
        </div>
      </div>

      {/* Plan banner */}
      <div className="portal-fade-in" style={{
        animationDelay: '40ms',
        background: isDark ? 'linear-gradient(145deg, #0F1623 0%, #0D1320 100%)' : '#FFFFFF',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
        borderLeft: `3px solid ${planCfg.color}`,
        borderRadius: 14, padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: planCfg.bg, border: `1px solid ${planCfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: planCfg.color }}>
            <Shield size={16} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: muted, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 }}>Current Plan</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: planCfg.bg, color: planCfg.color, fontSize: 12, fontWeight: 700, border: `1px solid ${planCfg.border}` }}>
                {planCfg.icon}
                {planCfg.label}
              </span>
              <span style={{ fontSize: 13, color: subColor, fontWeight: 600, textTransform: 'capitalize' as const }}>
                {profile?.subscription_status ?? 'trial'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: muted, textAlign: 'right' as const }}>
          <span style={{ color: text, fontWeight: 700 }}>{profile?.total_devices_count ?? 0}</span>
          <span> / {profile?.device_limit ?? 5} devices</span>
        </div>
      </div>

      {/* Personal info form */}
      <Section title="Personal Information" icon={<User size={14} />} isDark={isDark} delay={80}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FloatInput label="First Name" value={editForm.first_name} onChange={v => setEditForm(f => ({ ...f, first_name: v }))} isDark={isDark} />
          <FloatInput label="Last Name"  value={editForm.last_name}  onChange={v => setEditForm(f => ({ ...f, last_name: v }))}  isDark={isDark} />
          <FloatInput label="Email Address" type="email" value={editForm.email} onChange={v => setEditForm(f => ({ ...f, email: v }))} span isDark={isDark} />
          <FloatInput label="Mobile Number" type="tel" value={editForm.mobile_number} onChange={v => setEditForm(f => ({ ...f, mobile_number: v }))} isDark={isDark} />
          <FloatInput label="Address" value={editForm.address} onChange={v => setEditForm(f => ({ ...f, address: v }))} isDark={isDark} />
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#FCA5A5', fontSize: 13 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#34D399', fontSize: 13, fontWeight: 600 }}>
            <Check size={14} /> {success}
          </div>
        )}
        <button
          onClick={saveProfile}
          disabled={saving}
          style={{
            marginTop: 18, padding: '10px 24px', borderRadius: 10, border: 'none',
            background: saving ? 'rgba(245,158,11,0.4)' : 'linear-gradient(135deg, #F59E0B, #FBBF24)',
            color: '#0A0E1A', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em',
            boxShadow: saving ? 'none' : '0 4px 16px rgba(245,158,11,0.3)',
            transition: 'all 0.18s ease',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </Section>

      {/* Change password */}
      <Section title="Change Password" icon={<Lock size={14} />} isDark={isDark} delay={160}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'current_password', label: 'Current Password' },
            { key: 'new_password',     label: 'New Password' },
            { key: 'confirm_password', label: 'Confirm New Password' },
          ].map(({ key, label }) => (
            <FloatInput
              key={key} type="password" label={label}
              value={(pwForm as any)[key]}
              onChange={v => setPwForm(f => ({ ...f, [key]: v }))}
              isDark={isDark}
            />
          ))}
        </div>

        {pwError && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#FCA5A5', fontSize: 13 }}>
            {pwError}
          </div>
        )}
        {pwSuccess && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#34D399', fontSize: 13, fontWeight: 600 }}>
            <Check size={14} /> Password changed successfully
          </div>
        )}
        <button
          onClick={changePassword}
          style={{
            marginTop: 18, padding: '10px 24px', borderRadius: 10,
            border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
            background: 'transparent', color: text, fontWeight: 600, fontSize: 14,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.18s ease',
          }}
        >
          Update Password
        </button>
      </Section>

      {/* Site Members — only for owned sites */}
      {portalSites.filter(s => s.owner_user != null && Number(s.owner_user) === Number(user?.id)).map(site => (
        <div key={site.site_id} className="portal-fade-in" style={{ animationDelay: '240ms' }}>
          {portalSites.length > 1 && (
            <div style={{ fontSize: 12, color: muted, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 }}>
              {site.display_name}
            </div>
          )}
          <SiteMembersCard siteId={site.site_id} ownerUserId={site.owner_user} />
        </div>
      ))}
    </div>
  );
};

export default PortalProfile;
