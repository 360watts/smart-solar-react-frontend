import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

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

const Profile: React.FC = () => {
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

  useEffect(() => {
    fetchProfile();
  }, []);

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
      
      // Update the auth context with new user data
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
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
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
    setPasswordForm({
      current_password: '',
      new_password: '',
      confirm_password: '',
    });
  };

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  return (
    <div>
      <h1>My Profile</h1>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '4px' }}>
          {success}
        </div>
      )}

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h2>Account Information</h2>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="btn">
              Edit Profile
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleEditSubmit} style={{ padding: '20px' }}>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>Username:</label>
              <input
                type="text"
                value={profile?.username || ''}
                disabled
                style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              />
              <small style={{ color: '#666' }}>Username cannot be changed</small>
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>First Name:</label>
              <input
                type="text"
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>Last Name:</label>
              <input
                type="text"
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>Email:</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>Mobile Number:</label>
              <input
                type="tel"
                value={editForm.mobile_number}
                onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>Address:</label>
              <textarea
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                rows={3}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn">Save Changes</button>
              <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        ) : (
          <div style={{ padding: '20px' }}>
            <table className="profile-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold', width: '150px' }}>Username:</td>
                  <td style={{ padding: '10px' }}>{profile?.username}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>Name:</td>
                  <td style={{ padding: '10px' }}>{profile?.first_name} {profile?.last_name}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>Email:</td>
                  <td style={{ padding: '10px' }}>{profile?.email}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>Mobile:</td>
                  <td style={{ padding: '10px' }}>{profile?.mobile_number || '-'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>Address:</td>
                  <td style={{ padding: '10px' }}>{profile?.address || '-'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>Role:</td>
                  <td style={{ padding: '10px' }}>
                    {profile?.is_superuser ? 'Administrator' : profile?.is_staff ? 'Employee' : 'User'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>Member Since:</td>
                  <td style={{ padding: '10px' }}>
                    {profile?.date_joined ? new Date(profile.date_joined).toLocaleDateString() : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Security</h2>
          {!isChangingPassword && (
            <button onClick={() => setIsChangingPassword(true)} className="btn">
              Change Password
            </button>
          )}
        </div>

        {isChangingPassword ? (
          <form onSubmit={handlePasswordSubmit} style={{ padding: '20px' }}>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>Current Password:</label>
              <input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>New Password:</label>
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                required
                autoComplete="new-password"
                minLength={8}
              />
              <small style={{ color: '#666' }}>Must be at least 8 characters</small>
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>Confirm New Password:</label>
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn">Change Password</button>
              <button type="button" onClick={handleCancelPassword} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        ) : (
          <div style={{ padding: '20px' }}>
            <p>You can change your password here for security purposes.</p>
            <p style={{ color: '#666', fontSize: '14px' }}>
              It's recommended to use a strong password that you don't use on other websites.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
