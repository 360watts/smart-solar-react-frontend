import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Shield, Lock, Edit3, X, Check, AlertCircle, Zap, Star, Crown, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import SiteMembersCard from './members/SiteMembersCard';
import SecurityCard from './security/SecurityCard';

// ── Plan config ───────────────────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  free:    { label: 'Free',    icon: <Zap size={13} />,   color: '#8892A4', bg: 'rgba(136,146,164,0.1)', border: 'rgba(136,146,164,0.2)' },
  basic:   { label: 'Basic',   icon: <Star size={13} />,  color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)'  },
  premium: { label: 'Premium', icon: <Crown size={13} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)'  },
};

const SUBSCRIPTION_COLORS: Record<string, string> = {
  active: '#34D399', trial: '#FBBF24', suspended: '#F87171', cancelled: '#8892A4',
};

const AVATAR_COLORS = [
  'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
  'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
  'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
  'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
  'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)',
  'linear-gradient(135deg, #F26522 0%, #EA580C 100%)',
];

const getAvatarColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (first: string, last: string, username: string) => {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.substring(0, 2).toUpperCase();
  return username.substring(0, 2).toUpperCase();
};

// ── Component ─────────────────────────────────────────────────────────────────
const PortalProfile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { isDark } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile]             = useState<any>(null);
  const [portalSites, setPortalSites]     = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [isEditing, setIsEditing]         = useState(false);
  const [saving, setSaving]               = useState(false);
  const [success, setSuccess]             = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl]         = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', mobile_number: '', address: '' });

  // Theme tokens (amber accent for customer portal)
  const ACCENT      = '#F59E0B';
  const text        = isDark ? '#F0F4FF' : '#0A0E1A';
  const muted       = isDark ? '#8892A4' : '#64748B';
  const cardBg      = isDark ? 'rgba(15,22,35,0.85)' : '#FFFFFF';
  const cardBorder  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const inputBg     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const bgGradient  = isDark ? 'linear-gradient(135deg,#080C14 0%,#0F1623 100%)' : 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFC 100%)';

  useEffect(() => {
    (async () => {
      try {
        const [data, summary] = await Promise.all([
          apiService.getProfile(),
          apiService.getPortalSummary(),
        ]);
        setProfile(data);
        setAvatarUrl(data.avatar_url || null);
        setPortalSites(summary.sites || []);
        setEditForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          mobile_number: data.mobile_number || '',
          address: data.address || '',
        });
      } catch (e: any) {
        setError(e?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSuccess(null); setError(null);
    try {
      const updated = await apiService.updateProfile(editForm);
      setProfile((p: any) => ({ ...p, ...updated }));
      if (user) updateUser({ first_name: editForm.first_name, last_name: editForm.last_name });
      setIsEditing(false);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (profile) setEditForm({ first_name: profile.first_name || '', last_name: profile.last_name || '', email: profile.email || '', mobile_number: profile.mobile_number || '', address: profile.address || '' });
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    try {
      const response = await apiService.uploadProfilePicture(file);
      if (response.avatar_url) setAvatarUrl(response.avatar_url);
      setSuccess('Profile picture updated');
      setTimeout(() => { setAvatarPreview(null); setSuccess(null); }, 2000);
    } catch {
      setError('Failed to upload profile picture');
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid rgba(245,158,11,0.15)`, borderTop: `3px solid ${ACCENT}`, animation: 'portal-spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: muted, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading profile…</p>
      </div>
    </div>
  );

  if (!profile) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <AlertCircle size={40} style={{ color: '#F87171', margin: '0 auto 12px' }} />
      <p style={{ color: text, fontWeight: 600, marginBottom: 8 }}>Unable to load profile</p>
      <p style={{ color: muted, fontSize: 13 }}>{error}</p>
    </div>
  );

  const planType    = profile?.plan_type ?? 'free';
  const planCfg     = PLAN_CONFIG[planType] ?? PLAN_CONFIG.free;
  const subColor    = SUBSCRIPTION_COLORS[profile?.subscription_status ?? 'trial'] ?? '#8892A4';
  const initials    = getInitials(profile.first_name, profile.last_name, user?.username || '');
  const avatarGrad  = getAvatarColor(initials);
  const displayName = `${profile.first_name} ${profile.last_name}`.trim() || user?.username || '';

  return (
    <div style={{ background: bgGradient, minHeight: '100vh', padding: '40px 20px', transition: 'background 0.3s ease' }}>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        .pp-container { animation: slideUp 0.5s ease both; }
        .pp-stat:hover { transform:translateY(-4px); box-shadow:0 12px 24px rgba(245,158,11,0.12); }
        .pp-edit { animation: fadeIn 0.3s ease; }
      `}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto' }} className="pp-container">

        {/* ── Avatar hero ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, marginBottom: 40, alignItems: 'start' }}>

          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} style={{ display: 'none' }} />
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 200, height: 200, borderRadius: 16, cursor: 'pointer',
                backgroundImage: avatarPreview ? `url(${avatarPreview})` : avatarUrl ? `url(${avatarUrl})` : avatarGrad,
                backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 64, fontWeight: 700, color: '#fff',
                boxShadow: '0 20px 40px rgba(245,158,11,0.22)',
                position: 'relative', overflow: 'hidden',
                transition: 'all 0.3s ease',
              } as React.CSSProperties}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.filter = 'brightness(0.85)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.filter = 'brightness(1)'}
            >
              {!avatarPreview && !avatarUrl && (
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%,rgba(255,255,255,0.3),transparent)' }} />
              )}
              {/* Upload overlay */}
              <div
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.3s ease' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '0'}
              >
                <Upload size={32} style={{ color: '#fff', marginBottom: 8 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Upload Photo</span>
              </div>
              {uploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTop: '3px solid #fff', animation: 'portal-spin 1s linear infinite' }} />
                </div>
              )}
              {!avatarPreview && !avatarUrl && initials}
            </div>

            {/* Plan badge */}
            <div style={{ position: 'absolute', bottom: 12, right: 12, background: planCfg.bg, border: `1px solid ${planCfg.border}`, color: planCfg.color, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              {planCfg.icon} {planCfg.label}
            </div>
          </div>

          {/* Name + actions */}
          <div>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 36, fontWeight: 700, color: text, margin: '0 0 8px', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em' }}>{displayName}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: ACCENT, fontFamily: "'DM Sans', sans-serif" }}>Customer</span>
                <span style={{ fontSize: 13, color: subColor, fontWeight: 600, textTransform: 'capitalize' as const }}>{profile?.subscription_status ?? 'Trial'}</span>
              </div>
              <p style={{ fontSize: 13, color: muted, margin: 0 }}>{profile.email}</p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <button
                onClick={() => setIsEditing(!isEditing)}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: isEditing ? 'rgba(244,63,94,0.1)' : `rgba(245,158,11,0.1)`,
                  color: isEditing ? '#F43F5E' : ACCENT,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.2s ease',
                }}
              >
                {isEditing ? <X size={16} /> : <Edit3 size={16} />}
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
              <SecurityCard triggerOnly />
            </div>
          </div>
        </div>

        {/* ── Success / error ── */}
        {success && (
          <div style={{ padding: 16, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Check size={20} style={{ color: '#34D399', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: '#34D399', fontWeight: 500 }}>{success}</span>
          </div>
        )}
        {error && (
          <div style={{ padding: 16, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={20} style={{ color: '#F43F5E', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: '#F43F5E', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {/* ── Stat cards ── */}
        {!isEditing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16, marginBottom: 40 }}>
            {[
              { icon: Calendar, label: 'Member Since',  value: profile.date_joined ? new Date(profile.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
              { icon: Shield,   label: 'Plan',          value: planCfg.label },
              { icon: Zap,      label: 'Devices',       value: `${profile?.total_devices_count ?? 0} / ${profile?.device_limit ?? 5}` },
              { icon: Star,     label: 'Status',        value: profile?.subscription_status ?? 'Trial' },
            ].map((stat, i) => (
              <div key={i} className="pp-stat" style={{ padding: 20, borderRadius: 12, background: cardBg, border: `1px solid ${cardBorder}`, transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <stat.icon size={16} style={{ color: ACCENT }} />
                  <span style={{ fontSize: 12, color: muted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{stat.label}</span>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: text, margin: 0, fontFamily: "'DM Sans', sans-serif", textTransform: 'capitalize' as const }}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Contact detail cards ── */}
        {!isEditing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 40 }}>
            {[
              { icon: Mail,   label: 'Email',   value: profile.email },
              { icon: Phone,  label: 'Phone',   value: profile.mobile_number || 'Not provided' },
              { icon: MapPin, label: 'Address', value: profile.address || 'Not provided' },
            ].map((item, i) => (
              <div key={i} style={{ padding: 16, borderRadius: 12, background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <item.icon size={14} style={{ color: ACCENT }} />
                  <span style={{ fontSize: 11, color: muted, fontWeight: 600, textTransform: 'uppercase' as const }}>{item.label}</span>
                </div>
                <p style={{ fontSize: 14, color: text, margin: 0, fontFamily: "'Fira Code', monospace", wordBreak: 'break-all' as const }}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Edit form ── */}
        {isEditing && (
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 40, marginBottom: 40 }} className="pp-edit">
            <h2 style={{ fontSize: 24, fontWeight: 700, color: text, margin: '0 0 32px', fontFamily: "'Outfit', sans-serif" }}>Edit Profile</h2>
            <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
              {[
                { key: 'first_name', label: 'First Name', type: 'text' },
                { key: 'last_name',  label: 'Last Name',  type: 'text' },
                { key: 'email',      label: 'Email',      type: 'email' },
                { key: 'mobile_number', label: 'Phone',   type: 'tel' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={(editForm as any)[field.key]}
                    onChange={e => setEditForm(f => ({ ...f, [field.key]: e.target.value }))}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${inputBorder}`, background: inputBg, color: text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s ease' }}
                    onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                    onBlur={e => e.currentTarget.style.borderColor = inputBorder}
                  />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Address</label>
                <textarea
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${inputBorder}`, background: inputBg, color: text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', minHeight: 100, resize: 'vertical' as const, boxSizing: 'border-box' as const }}
                  onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                  onBlur={e => e.currentTarget.style.borderColor = inputBorder}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={handleCancelEdit} style={{ padding: '10px 24px', borderRadius: 8, border: `1px solid ${cardBorder}`, background: 'transparent', color: text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? 'rgba(245,158,11,0.4)' : ACCENT, color: '#0A0E1A', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={16} />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Site members ── */}
        {portalSites.filter(s => s.owner_user != null && Number(s.owner_user) === Number(user?.id)).map(site => (
          <div key={site.site_id} style={{ marginBottom: 20 }}>
            {portalSites.length > 1 && (
              <div style={{ fontSize: 12, color: muted, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 }}>
                {site.display_name}
              </div>
            )}
            <SiteMembersCard siteId={site.site_id} ownerUserId={site.owner_user} />
          </div>
        ))}

      </div>
    </div>
  );
};

export default PortalProfile;
