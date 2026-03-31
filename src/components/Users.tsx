import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PhoneInput from './PhoneInput';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, X, AlertTriangle, CheckCircle2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { EmptyState } from './EmptyState';
import { SkeletonTableRow } from './SkeletonLoader';
import PageHeader from './PageHeader';
import { DEFAULT_PAGE_SIZE } from '../constants';

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS_U = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#ec4899,#be185d)',
  'linear-gradient(135deg,#14b8a6,#0f766e)',
];
const userAvatarColor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS_U[Math.abs(h) % AVATAR_COLORS_U.length];
};
const userInitials = (first: string, last: string, username: string) => {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.substring(0, 2).toUpperCase();
  return username.substring(0, 2).toUpperCase();
};

interface User {
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

interface Device {
  id: number;
  device_serial: string;
  hw_id?: string;
  model?: string;
  provisioned_at?: string;
  config_version?: string;
}

const Users: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDevices, setUserDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_number: '',
    address: '',
  });
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    mobile_number: '',
    address: '',
  });

  // Modern modal states
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; user: User | null }>({ show: false, user: null });
  const [successModal, setSuccessModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchUsers(debouncedSearchTerm, currentPage, pageSize);
  }, [debouncedSearchTerm, currentPage, pageSize]);

  const fetchUsers = async (search?: string, page = 1, size = DEFAULT_PAGE_SIZE) => {
    setLoading(true);
    try {
      const response = await apiService.getUsers(search, page, size);
      const list = response.results || [];
      setFilteredUsers(list);
      setTotalCount(response.count ?? 0);
      setTotalPages(response.total_pages ?? 0);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      mobile_number: user.mobile_number || '',
      address: user.address || '',
    });
  };

  const handleSave = async () => {
    if (!editingUser) return;

    try {
      await apiService.updateUser(editingUser.id, editForm);
      setEditingUser(null);
      await fetchUsers(debouncedSearchTerm, currentPage, pageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleCreate = async () => {
    try {
      await apiService.createUser(createForm);
      setCreatingUser(false);
      setCreateForm({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        mobile_number: '',
        address: '',
      });
      await fetchUsers(debouncedSearchTerm, currentPage, pageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleDelete = (user: any) => {
    setDeleteModal({ show: true, user });
  };

  const confirmDelete = async () => {
    if (!deleteModal.user) return;
    
    try {
      await apiService.deleteUser(deleteModal.user.id);
      if (selectedUser?.id === deleteModal.user.id) {
        setSelectedUser(null);
        setUserDevices([]);
      }
      setDeleteModal({ show: false, user: null });
      await fetchUsers(debouncedSearchTerm, currentPage, pageSize);
      setSuccessModal({ 
        show: true, 
        message: `User "${deleteModal.user.username}" has been deleted successfully.` 
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      setDeleteModal({ show: false, user: null });
    }
  };

  const handleViewUser = async (user: User) => {
    setSelectedUser(user);
    setLoadingDevices(true);

    try {
      const devices = await apiService.getUserDevices(user.id);
      setUserDevices(devices);
    } catch (err) {
      console.error('Error fetching user devices:', err);
      setUserDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleBackToList = () => {
    setSelectedUser(null);
    setUserDevices([]);
  };

  const handleCancel = () => {
    setEditingUser(null);
    setCreatingUser(false);
  };

  if (loading) {
    return (
      <div className="admin-container responsive-page">
        <PageHeader
          icon={<UsersIcon size={20} color="white" />}
          title="User Management"
          subtitle="Manage portal users and their assigned devices"
        />
        <div className="card">
          <div className="card-header"><h2>Users</h2></div>
          <div className="table-responsive">
          <table className="table">
            <thead><tr><th>Username</th><th>Email</th><th>Name</th><th>Actions</th></tr></thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonTableRow key={i} columns={4} />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  // Show user dashboard when a user is selected
  if (selectedUser) {
    return (
      <div className="admin-container responsive-page">
        <PageHeader
          icon={<UsersIcon size={20} color="white" />}
          title={`${selectedUser.first_name} ${selectedUser.last_name}'s Dashboard`}
          subtitle={`@${selectedUser.username}`}
          rightSlot={
            <button
              onClick={handleBackToList}
              className="btn btn-secondary"
            >
              ← Back to Users
            </button>
          }
        />

        {/* User Information */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h2>User Information</h2>
            <button onClick={() => handleEdit(selectedUser)} className="btn">
              Edit User
            </button>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="device-info-grid responsive-grid-2">
              <div>
                <strong>Username:</strong>
                <p style={{ margin: '5px 0' }}>{selectedUser.username}</p>
              </div>
              <div>
                <strong>Email:</strong>
                <p style={{ margin: '5px 0' }}>{selectedUser.email}</p>
              </div>
              <div>
                <strong>Mobile:</strong>
                <p style={{ margin: '5px 0' }}>{selectedUser.mobile_number || '-'}</p>
              </div>
              <div>
                <strong>Address:</strong>
                <p style={{ margin: '5px 0' }}>{selectedUser.address || '-'}</p>
              </div>
              <div>
                <strong>Joined:</strong>
                <p style={{ margin: '5px 0' }}>
                  {selectedUser.date_joined
                    ? new Date(selectedUser.date_joined).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Devices */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h2>Assigned Devices ({userDevices.length}{deviceSearch ? ` · ${userDevices.filter(d => d.device_serial.toLowerCase().includes(deviceSearch.toLowerCase()) || (d.hw_id || '').toLowerCase().includes(deviceSearch.toLowerCase())).length} shown` : ''})</h2>
            {userDevices.length > 0 && (
              <input
                type="text"
                placeholder="Search by serial or HW ID…"
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '0.82rem', minWidth: 200 }}
              />
            )}
          </div>
          {loadingDevices ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>Loading devices...</div>
          ) : userDevices.length > 0 ? (
            <div className="table-responsive"><table className="table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>Device Serial</th>
                  <th style={{ textAlign: 'center' }}>MAC / HW ID</th>
                  <th style={{ textAlign: 'center' }}>Model</th>
                  <th style={{ textAlign: 'center' }}>Config Version</th>
                  <th style={{ textAlign: 'center' }}>Provisioned At</th>
                </tr>
              </thead>
              <tbody>
                {userDevices.filter(d => !deviceSearch || d.device_serial.toLowerCase().includes(deviceSearch.toLowerCase()) || (d.hw_id || '').toLowerCase().includes(deviceSearch.toLowerCase())).map((device) => (
                  <tr
                    key={device.id}
                    className="clickable-row"
                    onClick={() => navigate(`/devices?deviceId=${device.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>{device.device_serial}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>{device.hw_id || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ textAlign: 'center' }}>{device.model || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ textAlign: 'center' }}>{device.config_version || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {device.provisioned_at
                        ? new Date(device.provisioned_at).toLocaleDateString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.9375rem' }}>
              No devices assigned to this user yet.
            </div>
          )}
        </div>

        {/* Edit User modal */}
        {editingUser && ReactDOM.createPortal(
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }} onClick={handleCancel}>
            <div style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
              borderRadius: 16,
              boxShadow: isDark
                ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
                : '0 25px 50px -12px rgba(0,0,0,0.25)',
              maxWidth: '600px', width: '100%',
              maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '24px 28px',
                borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                  }}>
                    <Pencil size={22} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                      Edit User: {editingUser.username}
                    </div>
                    <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                      Update user account details
                    </div>
                  </div>
                </div>
                <button type="button" onClick={handleCancel} style={{
                  width: 40, height: 40, borderRadius: 10, border: 'none',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={18} />
                </button>
              </div>
              {/* Scrollable body */}
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                  {/* Account Information */}
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                        Account Information
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Email Address</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          required
                          autoComplete="off"
                          placeholder="john.doe@example.com"
                          style={{
                            padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                            background: isDark ? '#2a2a2a' : '#ffffff',
                            color: isDark ? '#f3f4f6' : '#111827',
                            fontSize: '0.875rem',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Personal Details */}
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                        Personal Details
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>First Name</label>
                        <input
                          type="text"
                          value={editForm.first_name}
                          onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                          required
                          autoComplete="off"
                          placeholder="John"
                          style={{
                            padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                            background: isDark ? '#2a2a2a' : '#ffffff',
                            color: isDark ? '#f3f4f6' : '#111827',
                            fontSize: '0.875rem',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Last Name</label>
                        <input
                          type="text"
                          value={editForm.last_name}
                          onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                          required
                          autoComplete="off"
                          placeholder="Doe"
                          style={{
                            padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                            background: isDark ? '#2a2a2a' : '#ffffff',
                            color: isDark ? '#f3f4f6' : '#111827',
                            fontSize: '0.875rem',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                        Contact Information
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Mobile Number</label>
                        <PhoneInput
                          value={editForm.mobile_number}
                          onChange={(v) => setEditForm({...editForm, mobile_number: v})}
                          required
                          isDark={isDark}
                          inlineStyle
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Address</label>
                        <textarea
                          value={editForm.address}
                          onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                          autoComplete="off"
                          rows={3}
                          placeholder="123 Solar Street..."
                          style={{
                            padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                            background: isDark ? '#2a2a2a' : '#ffffff',
                            color: isDark ? '#f3f4f6' : '#111827',
                            fontSize: '0.875rem',
                            resize: 'vertical',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Footer */}
                <div style={{
                  display: 'flex', gap: 10, justifyContent: 'flex-end',
                  padding: '16px 28px',
                  borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  flexShrink: 0,
                }}>
                  <button type="button" onClick={handleCancel} style={{
                    padding: '10px 20px', borderRadius: 8,
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                    color: isDark ? '#d1d5db' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  }}>Cancel</button>
                  <button type="submit" style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                  }}>Save Changes</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      </div>
    );
  }

  return (
    <div className="admin-container responsive-page">
      <PageHeader
        icon={<UsersIcon size={20} color="white" />}
        title="User Management"
        subtitle="Manage portal users and their assigned devices"
      />

      <div className="card">
        <div className="card-header">
          <h2>Users</h2>
          <div className="card-actions">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
            <button onClick={() => setCreatingUser(true)} className="btn">
              <UserPlus size={15} style={{ marginRight: 6 }} />
              Register New User
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="stats-chips-row">
          <div className="stats-chip">
            <UsersIcon size={13} />
            <span className="stats-chip-count">{totalCount}</span>
            <span>Total Users</span>
          </div>
        </div>

        <div className="table-responsive"><table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ textAlign: 'center' }}>Email</th>
              <th style={{ textAlign: 'center' }}>Mobile</th>
              <th style={{ textAlign: 'center' }}>Address</th>
              <th style={{ textAlign: 'center' }}>Joined</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                  <EmptyState
                    title={searchTerm ? 'No users match your search' : 'No users yet'}
                    description={searchTerm ? 'Try a different search term.' : 'Create a user to get started.'}
                    action={!searchTerm ? { label: 'Create User', onClick: () => setCreatingUser(true) } : undefined}
                  />
                </td>
              </tr>
            ) : filteredUsers.map((user) => (
              <tr
                key={user.id}
                onClick={() => handleViewUser(user)}
                style={{ cursor: 'pointer' }}
                className="clickable-row"
              >
                <td>
                  <div className="table-avatar-cell">
                    <div
                      className="avatar-initials avatar-initials-sm"
                      style={{ background: userAvatarColor(user.username) }}
                    >
                      {userInitials(user.first_name, user.last_name, user.username)}
                    </div>
                    <div className="table-name-block">
                      <span className="table-name-primary">{user.first_name} {user.last_name}</span>
                      <span className="table-name-secondary">@{user.username}</span>
                    </div>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>{user.email}</td>
                <td style={{ textAlign: 'center' }}>{user.mobile_number || '-'}</td>
                <td style={{ textAlign: 'center' }}>{user.address || '-'}</td>
                <td style={{ textAlign: 'center' }}>
                  {(() => {
                    if (!user.date_joined) return 'N/A';
                    const date = new Date(user.date_joined);
                    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
                  })()}
                </td>
                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleEdit(user)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #94a3b8)', margin: '0 6px' }} title="Edit">
                    <Pencil size={16} strokeWidth={2} />
                  </button>
                  <button onClick={() => handleDelete(user)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color, #ef4444)', margin: '0 6px' }} title="Delete">
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>

        {/* Pagination Controls */}
        {totalCount > 0 && (
          <div className="pagination-bar" style={{
            padding: '16px',
            borderTop: '1px solid var(--border-color, rgba(148, 163, 184, 0.1))',
            gap: '16px'
          }}>
            <div className="pagination-info" style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} users
            </div>
            <div className="pagination-controls">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-color, rgba(148, 163, 184, 0.2))',
                  borderRadius: '6px',
                  background: currentPage === 1 ? 'rgba(148, 163, 184, 0.1)' : 'transparent',
                  color: 'var(--text-primary, #f8fafc)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? '0.5' : '1'
                }}
              >
                ← Previous
              </button>
              <div className="pagination-pages">
                {(() => {
                  const pages = [];
                  for (let i = 1; i <= totalPages; i++) {
                    const showPage = i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1;
                    if (showPage) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          style={{
                            padding: '6px 10px',
                            border: '1px solid var(--border-color, rgba(148, 163, 184, 0.2))',
                            borderRadius: '4px',
                            background: i === currentPage ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                            color: 'var(--text-primary, #f8fafc)',
                            cursor: 'pointer',
                            fontWeight: i === currentPage ? 'bold' : 'normal',
                            minWidth: '32px'
                          }}
                        >
                          {i}
                        </button>
                      );
                    } else if (pages[pages.length - 1]?.key !== 'ellipsis-' + Math.floor(i / 10)) {
                      pages.push(
                        <span key={`ellipsis-${Math.floor(i / 10)}`} style={{ padding: '0 4px', color: 'var(--text-secondary, #94a3b8)' }}>...</span>
                      );
                    }
                  }
                  return pages;
                })()}
              </div>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-color, rgba(148, 163, 184, 0.2))',
                  borderRadius: '6px',
                  background: currentPage === totalPages ? 'rgba(148, 163, 184, 0.1)' : 'transparent',
                  color: 'var(--text-primary, #f8fafc)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? '0.5' : '1'
                }}
              >
                Next →
              </button>
            </div>
            <select
              className="pagination-size-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: '8px',
                border: isDark ? '1px solid #404040' : '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '6px',
                background: isDark ? '#1a1a1a' : '#0f172a',
                color: isDark ? '#e0e0e0' : '#f8fafc',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        )}
      </div>

      {(editingUser || creatingUser) && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }} onClick={handleCancel}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
              : '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxWidth: '600px', width: '100%',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '24px 28px',
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: editingUser ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: editingUser ? '0 4px 14px rgba(99,102,241,0.4)' : '0 4px 14px rgba(16,185,129,0.4)',
                }}>
                  {editingUser ? <Pencil size={22} color="white" /> : <UserPlus size={22} color="white" />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                    {editingUser ? `Edit User: ${editingUser.username}` : 'Register New User'}
                  </div>
                  <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                    {editingUser ? 'Update user account details' : 'Create a new user account'}
                  </div>
                </div>
              </div>
              <button type="button" onClick={handleCancel} style={{
                width: 40, height: 40, borderRadius: 10, border: 'none',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={18} />
              </button>
            </div>
            {/* Scrollable body + footer */}
            <form onSubmit={(e) => { e.preventDefault(); editingUser ? handleSave() : handleCreate(); }} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

                {/* Account Information */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                      Account Information
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {creatingUser && (
                      <>
                        <input type="text" autoComplete="username" style={{display: 'none'}} />
                        <input type="password" autoComplete="current-password" style={{display: 'none'}} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Username</label>
                            <input
                              type="text"
                              value={createForm.username}
                              onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                              required
                              autoComplete="off"
                              placeholder="jdoe"
                              style={{
                                padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                                background: isDark ? '#2a2a2a' : '#ffffff',
                                color: isDark ? '#f3f4f6' : '#111827',
                                fontSize: '0.875rem',
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Password</label>
                            <input
                              type="password"
                              value={createForm.password}
                              onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                              required
                              autoComplete="new-password"
                              placeholder="••••••••"
                              style={{
                                padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                                background: isDark ? '#2a2a2a' : '#ffffff',
                                color: isDark ? '#f3f4f6' : '#111827',
                                fontSize: '0.875rem',
                              }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Email Address</label>
                      <input
                        type="email"
                        value={editingUser ? editForm.email : createForm.email}
                        onChange={(e) => editingUser ? setEditForm({...editForm, email: e.target.value}) : setCreateForm({...createForm, email: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="john.doe@example.com"
                        style={{
                          padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          background: isDark ? '#2a2a2a' : '#ffffff',
                          color: isDark ? '#f3f4f6' : '#111827',
                          fontSize: '0.875rem',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                      Personal Details
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>First Name</label>
                      <input
                        type="text"
                        value={editingUser ? editForm.first_name : createForm.first_name}
                        onChange={(e) => editingUser ? setEditForm({...editForm, first_name: e.target.value}) : setCreateForm({...createForm, first_name: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="John"
                        style={{
                          padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          background: isDark ? '#2a2a2a' : '#ffffff',
                          color: isDark ? '#f3f4f6' : '#111827',
                          fontSize: '0.875rem',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Last Name</label>
                      <input
                        type="text"
                        value={editingUser ? editForm.last_name : createForm.last_name}
                        onChange={(e) => editingUser ? setEditForm({...editForm, last_name: e.target.value}) : setCreateForm({...createForm, last_name: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="Doe"
                        style={{
                          padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          background: isDark ? '#2a2a2a' : '#ffffff',
                          color: isDark ? '#f3f4f6' : '#111827',
                          fontSize: '0.875rem',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                      Contact Information
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Mobile Number</label>
                      <PhoneInput
                        value={editingUser ? editForm.mobile_number : createForm.mobile_number}
                        onChange={(v) => editingUser ? setEditForm({...editForm, mobile_number: v}) : setCreateForm({...createForm, mobile_number: v})}
                        required
                        isDark={isDark}
                        inlineStyle
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Address</label>
                      <textarea
                        value={editingUser ? editForm.address : createForm.address}
                        onChange={(e) => editingUser ? setEditForm({...editForm, address: e.target.value}) : setCreateForm({...createForm, address: e.target.value})}
                        autoComplete="off"
                        rows={3}
                        placeholder="123 Solar Street..."
                        style={{
                          padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          background: isDark ? '#2a2a2a' : '#ffffff',
                          color: isDark ? '#f3f4f6' : '#111827',
                          fontSize: '0.875rem',
                          resize: 'vertical',
                        }}
                      />
                    </div>
                  </div>
                </div>

              </div>
              {/* Footer */}
              <div style={{
                display: 'flex', gap: 10, justifyContent: 'flex-end',
                padding: '16px 28px',
                borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                flexShrink: 0,
              }}>
                <button type="button" onClick={handleCancel} style={{
                  padding: '10px 20px', borderRadius: 8,
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                  color: isDark ? '#d1d5db' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                }}>{editingUser ? 'Save Changes' : 'Create user'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modern Delete User Confirmation Modal */}
      {deleteModal.show && deleteModal.user && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  boxShadow: '0 4px 14px rgba(220,53,69,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <AlertTriangle size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                  Delete User
                </span>
              </div>
              <button
                onClick={() => setDeleteModal({ show: false, user: null })}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: 'none',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 14 }}>
                Are you sure you want to delete user <strong>{deleteModal.user.username}</strong>?
              </p>
              <div style={{
                background: isDark ? 'rgba(220,53,69,0.12)' : '#fef2f2',
                border: isDark ? '1px solid rgba(220,53,69,0.25)' : '1px solid #fecaca',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: '0.875rem',
                color: isDark ? '#fca5a5' : '#991b1b',
              }}>
                This will permanently delete the user account. Any devices associated with this user will become unassigned.
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteModal({ show: false, user: null })}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                  color: isDark ? '#d1d5db' : '#374151',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220,53,69,0.35)',
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modern Success Notification Modal */}
      {successModal.show && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <CheckCircle2 size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                  Success
                </span>
              </div>
              <button
                onClick={() => setSuccessModal({ show: false, message: '' })}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: 'none',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 14 }}>
                {successModal.message}
              </p>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSuccessModal({ show: false, message: '' })}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
                }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Users;
