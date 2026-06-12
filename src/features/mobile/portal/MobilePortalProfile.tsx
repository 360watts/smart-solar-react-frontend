import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, Check, ChevronRight, Edit3, Leaf,
  Mail, MapPin, Phone, ShieldCheck, Sun, X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { apiService } from '../../../services/api';
import SecurityCard from '../../portal/security/SecurityCard';
import { getDesignTokens } from '../../../shared/theme';

/* ─── Helpers ────────────────────────────────────────────────────────── */
const GRADIENTS = [
  'linear-gradient(135deg, #2FBF71 0%, #1A8F52 100%)',
  'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
  'linear-gradient(135deg, #E9B949 0%, #B7791F 100%)',
  'linear-gradient(135deg, #8B5CF6 0%, #5B21B6 100%)',
];
const avatarGradient = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
};
const initials = (first?: string, last?: string, username?: string) => {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return (username || '?').slice(0, 2).toUpperCase();
};

/* ─── Field editor row ───────────────────────────────────────────────── */
const FieldRow: React.FC<{
  icon: React.ReactNode; label: string; value: string;
  editing: boolean; field: string;
  draft: Record<string, string>; onDraftChange: (k: string, v: string) => void;
  isDark: boolean;
}> = ({ icon, label, value, editing, field, draft, onDraftChange, isDark }) => {
  const textPrimary = isDark ? '#F0F7F2' : '#0D2318';
  const textMuted   = isDark ? 'rgba(240,247,242,0.45)' : 'rgba(13,35,24,0.45)';
  const cardBorder  = isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.2)';
  const divider     = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const green       = '#2FBF71';

  return (
    <div style={{ padding: '14px 0', borderBottom: `1px solid ${divider}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        <span style={{ color: green }}>{icon}</span>
        {label}
      </div>
      {editing ? (
        <input
          value={draft[field] ?? ''}
          onChange={e => onDraftChange(field, e.target.value)}
          style={{
            width: '100%', height: 44, padding: '0 14px',
            borderRadius: 12, border: `1px solid ${cardBorder}`,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
            color: textPrimary, fontSize: 15, boxSizing: 'border-box', outline: 'none',
            fontFamily: '"DM Sans", system-ui, sans-serif',
          }}
        />
      ) : (
        <div style={{ fontSize: 15, color: value ? textPrimary : textMuted, fontWeight: value ? 500 : 400 }}>
          {value || `No ${label.toLowerCase()} on file`}
        </div>
      )}
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────────────────── */
const MobilePortalProfile: React.FC = () => {
  const { user, updateUser }        = useAuth();
  const { isDark }                  = useTheme();
  const T = getDesignTokens(isDark);
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile]               = useState<any>(null);
  const [portalSummary, setPortalSummary]   = useState<any>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [success, setSuccess]               = useState<string | null>(null);
  const [editing, setEditing]               = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [mounted, setMounted]               = useState(false);
  const [draft, setDraft] = useState({ first_name: '', last_name: '', mobile_number: '', address: '' });

  const cardBg      = isDark ? 'rgba(12,22,16,0.95)' : 'rgba(255,255,255,0.95)';
  const cardBorder  = isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.2)';
  const textPrimary = isDark ? '#F0F7F2' : '#0D2318';
  const textMuted   = isDark ? 'rgba(240,247,242,0.45)' : 'rgba(13,35,24,0.45)';
  const green       = '#2FBF71';
  const amber       = '#E9B949';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, summaryData] = await Promise.all([apiService.getProfile(), apiService.getPortalSummary()]);
      setProfile(profileData);
      setPortalSummary(summaryData);
      setDraft({
        first_name: profileData.first_name ?? '',
        last_name: profileData.last_name ?? '',
        mobile_number: profileData.mobile_number ?? '',
        address: profileData.address ?? '',
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); setTimeout(() => setMounted(true), 60); }, []);

  const displayName = useMemo(() => {
    if (!profile) return user?.username || 'Customer';
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user?.username || 'Customer';
  }, [profile, user?.username]);

  const handleSave = async () => {
    try {
      const updated = await apiService.updateProfile({ ...profile, ...draft });
      setProfile((cur: any) => ({ ...cur, ...updated, ...draft }));
      updateUser({ first_name: draft.first_name, last_name: draft.last_name });
      setSuccess('Profile updated successfully');
      setEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || 'Failed to update profile');
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setError(null);
    try {
      const result = await apiService.uploadProfilePicture(file);
      setProfile((cur: any) => ({ ...cur, avatar_url: result.avatar_url ?? cur?.avatar_url }));
      setSuccess('Profile photo updated');
      setTimeout(() => setSuccess(null), 2600);
    } catch (ex: any) {
      setError(ex?.message || 'Failed to upload photo');
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fadeStyle = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.45s ${delay}ms ease, transform 0.45s ${delay}ms ease`,
  });

  if (loading) return (
    <div style={{ minHeight: '60dvh', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${green}`, borderTopColor: 'transparent', animation: 'portal-spin 0.9s linear infinite' }} />
        <span style={{ color: textMuted, fontWeight: 600, fontSize: 14 }}>Loading your profile…</span>
      </div>
    </div>
  );

  if (!profile) return (
    <div style={{ padding: 20 }}>
      <div style={{ background: cardBg, border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 20, padding: 20 }}>
        <div style={{ fontWeight: 700, color: '#EF4444', fontSize: 14 }}>Unable to load profile</div>
        {error && <div style={{ color: textMuted, fontSize: 13, marginTop: 6 }}>{error}</div>}
        <button onClick={() => void load()}
          style={{ marginTop: 14, padding: '10px 20px', borderRadius: 12, border: 'none', background: green, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          Retry
        </button>
      </div>
    </div>
  );

  const sites = portalSummary?.sites ?? [];
  const totalKwp = sites.reduce((s: number, site: any) => s + (site.capacity_kw ?? 0), 0);
  const planType = portalSummary?.profile?.plan_type ?? profile.plan_type ?? 'Portal';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes portal-spin { to { transform: rotate(360deg); } }
        @keyframes portal-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .snov-btn { cursor: pointer; transition: opacity 180ms ease, transform 180ms ease; }
        .snov-btn:hover { opacity: 0.85; }
        .snov-btn:active { transform: scale(0.96); }
        input:focus { border-color: #2FBF71 !important; box-shadow: 0 0 0 3px rgba(47,191,113,0.12); }
      `}</style>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} aria-label="Upload profile photo" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: '"DM Sans", system-ui, sans-serif' }}>

        {/* ── Hero identity card ── */}
        <section style={{
          ...fadeStyle(0),
          background: isDark
            ? 'linear-gradient(160deg, #0C1810 0%, #070E0A 100%)'
            : 'linear-gradient(160deg, #EDF7F1 0%, #F6FCF8 100%)',
          border: `1px solid ${cardBorder}`,
          borderRadius: 28, padding: '24px 20px 20px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Ambient orbs */}
          <div style={{ position: 'absolute', top: -70, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,191,113,0.15), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -50, left: -40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(233,185,73,0.12), transparent 70%)', pointerEvents: 'none' }} />

          {/* Avatar + name */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, position: 'relative' }}>
            <button className="snov-btn" onClick={() => fileRef.current?.click()} aria-label="Change avatar"
              style={{
                width: 76, height: 76, borderRadius: 24, flexShrink: 0,
                border: `2.5px solid ${green}`,
                backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : avatarGradient(displayName),
                backgroundSize: 'cover', backgroundPosition: 'center',
                color: '#fff', fontSize: 26, fontWeight: 700, fontFamily: '"DM Serif Display", serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
                opacity: avatarUploading ? 0.6 : 1,
              }}>
              {!profile.avatar_url && initials(profile.first_name, profile.last_name, user?.username)}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 5 }}>
                <Camera size={11} color="rgba(255,255,255,0.85)" />
              </div>
              {avatarUploading && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.45)' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'portal-spin 0.8s linear infinite' }} />
                </div>
              )}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: textMuted }}>Customer profile</div>
              <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 26, lineHeight: 1.1, color: textPrimary, marginTop: 6, wordBreak: 'break-word' }}>
                {displayName}
              </div>
              {profile.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, color: textMuted, fontSize: 12 }}>
                  <Mail size={11} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Plan + capacity row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
            <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)', border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '14px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: green, marginBottom: 8 }}>
                <ShieldCheck size={13} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted }}>Plan</span>
              </div>
              <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 20, color: textPrimary }}>{planType}</div>
            </div>
            <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)', border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '14px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sun size={13} color={amber} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted }}>Installed</span>
              </div>
              <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 20, color: textPrimary }}>{totalKwp > 0 ? `${totalKwp.toFixed(1)} kWp` : '—'}</div>
            </div>
          </div>

          {/* Sites pill row */}
          {sites.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {sites.map((site: any) => (
                <div key={site.site_id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 999, background: isDark ? 'rgba(47,191,113,0.1)' : 'rgba(47,191,113,0.08)', border: `1px solid ${cardBorder}`, color: green, fontSize: 12, fontWeight: 600 }}>
                  <MapPin size={10} />
                  {site.display_name}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Toast notifications ── */}
        {(success || error) && (
          <div style={{
            position: 'fixed', bottom: 24, left: 16, right: 16, zIndex: 50,
            background: success ? (isDark ? '#0D2318' : '#fff') : (isDark ? '#1A0707' : '#fff'),
            border: `1px solid ${success ? green : '#EF4444'}`,
            borderRadius: 18, padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            animation: 'portal-fade-up 0.3s ease both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {success ? <Check size={16} color={green} /> : <X size={16} color="#EF4444" />}
              <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{success ?? error}</span>
            </div>
            <button className="snov-btn" onClick={() => { setSuccess(null); setError(null); }}
              style={{ background: 'none', border: 'none', color: textMuted, display: 'grid', placeItems: 'center' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Info fields ── */}
        <section style={{
          ...fadeStyle(80),
          background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 24, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 14px' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: textMuted }}>Account details</div>
              <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 20, color: textPrimary, marginTop: 4 }}>Personal information</div>
            </div>
            {!editing ? (
              <button className="snov-btn" onClick={() => setEditing(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: `1px solid ${cardBorder}`, background: 'transparent', color: textMuted, fontSize: 13, fontWeight: 600 }}>
                <Edit3 size={13} /> Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="snov-btn" onClick={() => { setEditing(false); }}
                  style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${cardBorder}`, background: 'transparent', color: textMuted, display: 'grid', placeItems: 'center' }}>
                  <X size={14} />
                </button>
                <button className="snov-btn" onClick={() => void handleSave()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 36, borderRadius: 10, border: 'none', background: green, color: '#fff', fontSize: 13, fontWeight: 700 }}>
                  <Check size={13} /> Save
                </button>
              </div>
            )}
          </div>

          <div style={{ padding: '0 18px 18px' }}>
            <FieldRow icon={<Mail size={11} />} label="Email" value={profile.email ?? ''} editing={false} field="email" draft={draft} onDraftChange={() => {}} isDark={isDark} />
            <FieldRow icon={<Edit3 size={11} />} label="First name" value={editing ? draft.first_name : profile.first_name ?? ''} editing={editing} field="first_name" draft={draft} onDraftChange={(k, v) => setDraft(d => ({ ...d, [k]: v }))} isDark={isDark} />
            <FieldRow icon={<Edit3 size={11} />} label="Last name" value={editing ? draft.last_name : profile.last_name ?? ''} editing={editing} field="last_name" draft={draft} onDraftChange={(k, v) => setDraft(d => ({ ...d, [k]: v }))} isDark={isDark} />
            <FieldRow icon={<Phone size={11} />} label="Mobile number" value={editing ? draft.mobile_number : profile.mobile_number ?? ''} editing={editing} field="mobile_number" draft={draft} onDraftChange={(k, v) => setDraft(d => ({ ...d, [k]: v }))} isDark={isDark} />
            <FieldRow icon={<MapPin size={11} />} label="Address" value={editing ? draft.address : profile.address ?? ''} editing={editing} field="address" draft={draft} onDraftChange={(k, v) => setDraft(d => ({ ...d, [k]: v }))} isDark={isDark} />
          </div>
        </section>

        {/* ── Solar impact card ── */}
        {totalKwp > 0 && (
          <section style={{
            ...fadeStyle(160),
            background: isDark
              ? 'linear-gradient(135deg, rgba(15,30,20,0.95) 0%, rgba(10,22,14,0.95) 100%)'
              : 'linear-gradient(135deg, rgba(236,248,241,0.95) 0%, rgba(245,252,248,0.95) 100%)',
            border: `1px solid ${cardBorder}`, borderRadius: 24, padding: '18px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(47,191,113,0.12)', display: 'grid', placeItems: 'center' }}>
                <Leaf size={16} color={green} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted }}>Your solar footprint</div>
                <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 18, color: textPrimary, marginTop: 2 }}>Clean energy impact</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'System capacity', value: `${totalKwp.toFixed(1)} kWp` },
                { label: 'Active sites', value: String(sites.length) },
              ].map(item => (
                <div key={item.label} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)', border: `1px solid ${cardBorder}`, borderRadius: 14, padding: '12px 12px', textAlign: 'center' }}>
                  <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 24, color: green, fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: textMuted, marginTop: 5 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Security ── */}
        <section style={{ ...fadeStyle(220) }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: textMuted, marginBottom: 10, paddingLeft: 4 }}>
            Security
          </div>
          <SecurityCard />
        </section>

      </div>
    </>
  );
};

export default MobilePortalProfile;
