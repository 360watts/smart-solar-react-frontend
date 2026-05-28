import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Shield, Lock, Edit3, X, Check, AlertCircle, Building2, Briefcase, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import MobileProfile from '../mobile/MobileProfile';
import SecurityCard from '../portal/security/SecurityCard';

interface ProfileData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  mobile_number?: string;
  address?: string;
  avatar_url?: string | null;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  role?: string;
  department?: any;
  manager_id?: number;
  employment_status?: string;
  timezone?: string;
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
  'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
  'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
  'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)',
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

const Profile: React.FC = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_number: '',
    address: '',
  });

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await apiService.getProfile();
      setProfile(data);
      setAvatarUrl(data.avatar_url || null);
      setEditForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        mobile_number: data.mobile_number || '',
        address: data.address || '',
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedProfile = await apiService.updateProfile(editForm);
      setProfile(updatedProfile);
      setIsEditing(false);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (profile) {
      setEditForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        mobile_number: profile.mobile_number || '',
        address: profile.address || '',
      });
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    try {
      const response = await apiService.uploadProfilePicture(file);
      setSuccess('Profile picture updated successfully');
      if (response.avatar_url) {
        setAvatarUrl(response.avatar_url);
      }
      setTimeout(() => setAvatarPreview(null), 2000);
    } catch (err) {
      setError('Failed to upload profile picture');
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isMobile) return <MobileProfile />;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: isDark ? 'linear-gradient(135deg, #080C14 0%, #0F1623 100%)' : '#F5F7FA' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 20px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', border: '3px solid rgba(34,197,94,0.15)', borderTop: '3px solid #22C55E', animation: 'spin 1s linear infinite' }} />
          </div>
          <p style={{ color: isDark ? '#8892A4' : '#64748B', fontSize: 14 }}>Loading your profile...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: '40px 20px', background: isDark ? 'linear-gradient(135deg, #080C14 0%, #0F1623 100%)' : '#F5F7FA', minHeight: '100vh' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px', background: isDark ? 'rgba(15, 22, 35, 0.9)' : '#fff', borderRadius: 16, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, textAlign: 'center' }}>
          <AlertCircle size={48} style={{ margin: '0 auto 16px', color: '#F87171' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#F0F4FF' : '#0A0E1A', margin: '0 0 8px' }}>Unable to Load Profile</p>
          <p style={{ fontSize: 14, color: isDark ? '#8892A4' : '#64748B', marginBottom: 24 }}>{error}</p>
          <button onClick={fetchProfile} style={{ padding: '10px 24px', background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  const bgGradient = isDark ? 'linear-gradient(135deg, #080C14 0%, #0F1623 100%)' : 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)';
  const cardBg = isDark ? 'rgba(15, 22, 35, 0.85)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const text = isDark ? '#F0F4FF' : '#0A0E1A';
  const muted = isDark ? '#8892A4' : '#64748B';
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)';
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const initials = getInitials(profile.first_name, profile.last_name, profile.username);
  const avatarGradient = getAvatarColor(initials);
  const displayName = `${profile.first_name} ${profile.last_name}`.trim() || profile.username;
  const roleLabel = profile.is_superuser ? 'Admin' : profile.is_staff ? 'Staff' : 'Employee';

  return (
    <div style={{ background: bgGradient, minHeight: '100vh', padding: '40px 20px', transition: 'background 0.3s ease' }}>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .profile-container { animation: slideUp 0.5s ease both; }
        .stat-card { transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(34,197,94,0.15); }
        .edit-mode { animation: fadeIn 0.3s ease; }
      `}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto' }} className="profile-container">
        {/* Header with avatar and quick info */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, marginBottom: 40, alignItems: 'start' }}>
          {/* Avatar & Status */}
          <div style={{ position: 'relative' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              style={{ display: 'none' }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 200,
                height: 200,
                borderRadius: 16,
                backgroundImage: avatarPreview ? `url(${avatarPreview})` : avatarUrl ? `url(${avatarUrl})` : !avatarPreview && !avatarUrl ? avatarGradient : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 64,
                fontWeight: 700,
                color: '#fff',
                boxShadow: '0 20px 40px rgba(34,197,94,0.25)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              } as React.CSSProperties}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.filter = 'brightness(0.85)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.filter = 'brightness(1)';
              }}
            >
              {!avatarPreview && !avatarUrl && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), transparent)' }} />}

              {/* Upload overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.3s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.opacity = '1';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.opacity = '0';
              }}
              className="upload-overlay"
              >
                <Upload size={32} style={{ color: '#fff', marginBottom: 8 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Upload Photo</span>
              </div>

              {uploadingAvatar && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTop: '3px solid #fff', animation: 'spin 1s linear infinite' }} />
                </div>
              )}

              {!avatarPreview && !avatarUrl && initials}
            </div>
            {/* Status badge */}
            <div style={{
              position: 'absolute', bottom: 12, right: 12,
              background: '#22C55E', color: '#fff',
              padding: '4px 12px', borderRadius: 20,
              fontSize: 11, fontWeight: 700,
              boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
            }}>
              {profile.employment_status || 'Active'}
            </div>
          </div>

          {/* Name, role, actions */}
          <div>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 36, fontWeight: 700, color: text, margin: '0 0 8px', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em' }}>{displayName}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#22C55E', fontFamily: "'DM Sans', sans-serif" }}>{roleLabel}</span>
                {profile.department && (
                  <span style={{ fontSize: 13, color: muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Building2 size={14} /> {typeof profile.department === 'object' ? profile.department.name : profile.department}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: muted, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{profile.email}</p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => setIsEditing(!isEditing)}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: isEditing ? 'rgba(244,63,94,0.1)' : 'rgba(34,197,94,0.1)',
                  color: isEditing ? '#F43F5E' : '#22C55E',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.2s ease',
                }}
              >
                {isEditing ? <X size={16} /> : <Edit3 size={16} />}
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
              <button
                onClick={() => {}}
                style={{ display: 'none' }}
              />
              <SecurityCard triggerOnly />
            </div>
          </div>
        </div>

        {/* Success/Error messages */}
        {success && (
          <div style={{ padding: 16, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, animation: 'slideUp 0.3s ease' }}>
            <Check size={20} style={{ color: '#22C55E', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: '#22C55E', fontWeight: 500 }}>{success}</span>
          </div>
        )}
        {error && (
          <div style={{ padding: 16, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={20} style={{ color: '#F43F5E', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: '#F43F5E', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {/* Stats grid */}
        {!isEditing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 40 }} className="stat-card">
            {[
              { icon: Calendar, label: 'Joined', value: new Date(profile.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) },
              { icon: Briefcase, label: 'Role', value: profile.role || 'Employee' },
              { icon: MapPin, label: 'Timezone', value: profile.timezone || 'Asia/Kolkata' },
              { icon: Shield, label: 'Status', value: profile.employment_status || 'Active' },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  padding: 20, borderRadius: 12,
                  background: cardBg, border: `1px solid ${cardBorder}`,
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <stat.icon size={16} style={{ color: '#22C55E' }} />
                  <span style={{ fontSize: 12, color: muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</span>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: text, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Contact details */}
        {!isEditing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 40 }}>
            {[
              { icon: Mail, label: 'Email', value: profile.email },
              { icon: Phone, label: 'Phone', value: profile.mobile_number || 'Not provided' },
              { icon: MapPin, label: 'Address', value: profile.address || 'Not provided' },
            ].map((item, i) => (
              <div key={i} style={{ padding: 16, borderRadius: 12, background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <item.icon size={14} style={{ color: '#22C55E' }} />
                  <span style={{ fontSize: 11, color: muted, fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</span>
                </div>
                <p style={{ fontSize: 14, color: text, margin: 0, fontFamily: "'Fira Code', monospace", wordBreak: 'break-all' }}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Edit mode form */}
        {isEditing && (
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 40 }} className="edit-mode">
            <h2 style={{ fontSize: 24, fontWeight: 700, color: text, margin: '0 0 32px', fontFamily: "'Outfit', sans-serif" }}>Edit Profile</h2>
            <form onSubmit={handleEditSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 32 }}>
              {[
                { key: 'first_name', label: 'First Name', type: 'text' },
                { key: 'last_name', label: 'Last Name', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'mobile_number', label: 'Phone', type: 'tel' },
              ].map(field => (
                <div key={field.key} style={{ gridColumn: field.key === 'address' ? '1 / -1' : undefined }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={(editForm as any)[field.key]}
                    onChange={e => setEditForm(f => ({ ...f, [field.key]: e.target.value }))}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 8,
                      border: `1.5px solid ${inputBorder}`,
                      background: inputBg, color: text,
                      fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                      transition: 'border-color 0.2s ease',
                      outline: 'none',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#22C55E'}
                    onBlur={e => e.currentTarget.style.borderColor = inputBorder}
                  />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Address
                </label>
                <textarea
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 8,
                    border: `1.5px solid ${inputBorder}`,
                    background: inputBg, color: text,
                    fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                    transition: 'border-color 0.2s ease',
                    outline: 'none', minHeight: 100, resize: 'vertical',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#22C55E'}
                  onBlur={e => e.currentTarget.style.borderColor = inputBorder}
                />
              </div>

              {/* Form actions */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    padding: '10px 24px', borderRadius: 8,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    background: 'transparent', color: text,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none',
                    background: '#22C55E', color: '#fff',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Check size={16} />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}


      </div>
    </div>
  );
};

export default Profile;
