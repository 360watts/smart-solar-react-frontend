import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Shield, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PhoneInput from './PhoneInput';
import { apiService } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';
import { MobileProfile } from './mobile';

interface ProfileData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  mobile_number?: string;
  address?: string;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
}

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'linear-gradient(135deg, #ec4899, #be185d)',
  'linear-gradient(135deg, #14b8a6, #0f766e)',
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
  if (isMobile) return <MobileProfile />;
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_number: '',
    address: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await apiService.getProfile();
      setProfile(data);
      setEditForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        mobile_number: data.mobile_number || '',
        address: data.address || '',
      });
      setError(null);
    } catch (err) {
      console.error('Profile fetch error:', err);
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
      setSuccess('Profile updated successfully!');
      if (updateUser) {
        updateUser({
          ...user,
          first_name: updatedProfile.first_name,
          last_name: updatedProfile.last_name,
          email: updatedProfile.email,
        });
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New passwords do not match');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    try {
      await apiService.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setIsChangingPassword(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setSuccess('Password changed successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
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

  const handleCancelPassword = () => {
    setIsChangingPassword(false);
    setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
  };

  if (loading) return <div className="loading">Loading profile...</div>;

  const initials = profile ? getInitials(profile.first_name, profile.last_name, profile.username) : '??';
  const avatarColor = profile ? getAvatarColor(profile.username) : AVATAR_COLORS[0];
  const roleLabel = profile?.is_superuser ? 'Administrator' : profile?.is_staff ? 'Staff' : 'User';
  const roleBadgeClass = profile?.is_superuser ? 'role-badge-admin' : profile?.is_staff ? 'role-badge-staff' : 'role-badge-user';
  const displayName = profile ? `${profile.first_name} ${profile.last_name}`.trim() || profile.username : '';

  return (
    <div className="admin-container responsive-page">
      <h1>My Profile</h1>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          {success}
        </div>
      )}

      {/* ── Account Card ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '20px', overflow: 'hidden' }}>

        {/* Hero banner + avatar */}
        {!isEditing && (
          <>
            <div className="profile-hero-banner" />
            <div className="profile-hero-body">
              <div className="profile-hero-row">
                <div
                  className="avatar-initials avatar-initials-lg"
                  style={{ background: avatarColor }}
                >
                  {initials}
                </div>
                <div style={{ paddingBottom: 2 }}>
                  <h2 className="profile-hero-name">{displayName}</h2>
                  <div className="profile-hero-meta">
                    <span className={`role-badge ${roleBadgeClass}`}>{roleLabel}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      <Calendar size={12} />
                      {profile?.date_joined
                        ? `Since ${new Date(profile.date_joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Card header */}
        <div className="card-header" style={isEditing ? {} : { borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-4)' }}>
          <h2>Account Information</h2>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="btn">
              Edit Profile
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleEditSubmit}>
            <div className="form-section" style={{ padding: '0 var(--space-5) var(--space-4)' }}>
              <h4 className="form-section-title">Account</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" value={profile?.username || ''} disabled className="input-disabled" />
                  <small className="form-hint">Username cannot be changed</small>
                </div>
              </div>
            </div>

            <div className="form-section" style={{ padding: '0 var(--space-5) var(--space-4)' }}>
              <h4 className="form-section-title">Personal Details</h4>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label>First Name</label>
                  <input type="text" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} required placeholder="John" />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input type="text" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} required placeholder="Doe" />
                </div>
              </div>
            </div>

            <div className="form-section" style={{ padding: '0 var(--space-5) var(--space-4)' }}>
              <h4 className="form-section-title">Contact Information</h4>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required placeholder="john.doe@example.com" />
                </div>
                <div className="form-group">
                  <label>Mobile Number</label>
                  <PhoneInput
                    value={editForm.mobile_number}
                    onChange={(v) => setEditForm({ ...editForm, mobile_number: v })}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Address</label>
                  <textarea value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} rows={3} placeholder="123 Solar Street..." />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn">Save Changes</button>
              <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        ) : (
          /* Info grid — icon + label + value */
          <div className="profile-info-grid">
            <div className="profile-info-row">
              <div className="profile-info-icon"><User size={15} /></div>
              <div>
                <div className="profile-info-label">Username</div>
                <div className="profile-info-value">{profile?.username}</div>
              </div>
            </div>
            <div className="profile-info-row">
              <div className="profile-info-icon"><Mail size={15} /></div>
              <div>
                <div className="profile-info-label">Email</div>
                <div className="profile-info-value">{profile?.email || '—'}</div>
              </div>
            </div>
            <div className="profile-info-row">
              <div className="profile-info-icon"><Phone size={15} /></div>
              <div>
                <div className="profile-info-label">Mobile</div>
                <div className="profile-info-value">{profile?.mobile_number || '—'}</div>
              </div>
            </div>
            <div className="profile-info-row">
              <div className="profile-info-icon"><MapPin size={15} /></div>
              <div>
                <div className="profile-info-label">Address</div>
                <div className="profile-info-value">{profile?.address || '—'}</div>
              </div>
            </div>
            <div className="profile-info-row">
              <div className="profile-info-icon"><Shield size={15} /></div>
              <div>
                <div className="profile-info-label">Role</div>
                <div className="profile-info-value">{roleLabel}</div>
              </div>
            </div>
            <div className="profile-info-row">
              <div className="profile-info-icon"><Calendar size={15} /></div>
              <div>
                <div className="profile-info-label">Member Since</div>
                <div className="profile-info-value">
                  {profile?.date_joined ? new Date(profile.date_joined).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Security Card ────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger-color)', flexShrink: 0 }}>
              <Lock size={16} />
            </div>
            <h2 style={{ margin: 0 }}>Security</h2>
          </div>
          {!isChangingPassword && (
            <button onClick={() => setIsChangingPassword(true)} className="btn">
              Change Password
            </button>
          )}
        </div>

        {isChangingPassword ? (
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-section" style={{ padding: '0 var(--space-5) var(--space-4)' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Current Password</label>
                  <input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required autoComplete="current-password" />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required autoComplete="new-password" minLength={8} />
                  <small className="form-hint">Must be at least 8 characters</small>
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} required autoComplete="new-password" />
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn">Change Password</button>
              <button type="button" onClick={handleCancelPassword} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        ) : (
          <div style={{ padding: 'var(--space-5)' }}>
            <p style={{ margin: '0 0 6px', color: 'var(--text-secondary)' }}>Change your password to keep your account secure.</p>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Use a strong password that you don't use on other websites.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
