import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { EmptyState } from './EmptyState';
import { SkeletonTableRow } from './SkeletonLoader';
import { DEFAULT_PAGE_SIZE } from '../constants';

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
    console.log('🗑️ handleDelete called with user:', user.username);
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
      <div className="admin-container">
        <h1>User Management</h1>
        <div className="card">
          <div className="card-header"><h2>Users</h2></div>
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
    );
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  // Show user dashboard when a user is selected
  if (selectedUser) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <button
            onClick={handleBackToList}
            className="btn btn-secondary"
            style={{ marginRight: '15px' }}
          >
            ← Back to Users
          </button>
          <h1 style={{ margin: 0 }}>{selectedUser.first_name} {selectedUser.last_name}'s Dashboard</h1>
        </div>

        {/* User Information */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h2>User Information</h2>
            <button onClick={() => handleEdit(selectedUser)} className="btn">
              Edit User
            </button>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
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
            <h2>Assigned Devices ({userDevices.length})</h2>
          </div>
          {loadingDevices ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>Loading devices...</div>
          ) : userDevices.length > 0 ? (
            <table className="table">
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
                {userDevices.map((device) => (
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
            </table>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.9375rem' }}>
              No devices assigned to this user yet.
            </div>
          )}
        </div>

        {/* Edit User modal */}
        {editingUser && (
          <div className="modal">
            <div className="modal-content">
              <h3>Edit User: {editingUser.username}</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <div className="modal-body">
                  <div className="form-section">
                    <h4 className="form-section-title">Account Information</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Email Address</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          required
                          autoComplete="off"
                          placeholder="john.doe@example.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h4 className="form-section-title">Personal Details</h4>
                    <div className="form-grid form-grid-2">
                      <div className="form-group">
                        <label>First Name</label>
                        <input
                          type="text"
                          value={editForm.first_name}
                          onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                          required
                          autoComplete="off"
                          placeholder="John"
                        />
                      </div>
                      <div className="form-group">
                        <label>Last Name</label>
                        <input
                          type="text"
                          value={editForm.last_name}
                          onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                          required
                          autoComplete="off"
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h4 className="form-section-title">Contact Information</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Mobile Number</label>
                        <input
                          type="tel"
                          value={editForm.mobile_number}
                          onChange={(e) => setEditForm({...editForm, mobile_number: e.target.value})}
                          required
                          autoComplete="off"
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                      <div className="form-group">
                        <label>Address</label>
                        <textarea
                          value={editForm.address}
                          onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                          autoComplete="off"
                          rows={3}
                          placeholder="123 Solar Street..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="form-actions" style={{ padding: '0 24px 24px 24px' }}>
                  <button type="submit" className="btn">Save Changes</button>
                  <button type="button" onClick={handleCancel} className="btn btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div>
      <h1>User Management</h1>

      <div className="card">
        <div className="card-header">
          <h2>Users ({totalCount})</h2>
          <div className="card-actions">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
            <button onClick={() => setCreatingUser(true)} className="btn">
              Register New User
            </button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>Name</th>
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
                <td style={{ textAlign: 'center' }}>{user.first_name} {user.last_name}</td>
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(user)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color, #ef4444)', margin: '0 6px' }} title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6"></polyline>
                      <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {totalCount > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderTop: '1px solid var(--border-color, rgba(148, 163, 184, 0.1))',
            gap: '16px'
          }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} users
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
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

      {(editingUser || creatingUser) && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingUser ? `Edit User: ${editingUser.username}` : 'Register New User'}</h3>
            <form onSubmit={(e) => { e.preventDefault(); editingUser ? handleSave() : handleCreate(); }}>
              <div className="modal-body">

                {/* Account Information */}
                <div className="form-section">
                  <h4 className="form-section-title">Account Information</h4>
                  <div className="form-grid">
                    {creatingUser && (
                      <>
                        <input type="text" autoComplete="username" style={{display: 'none'}} />
                        <input type="password" autoComplete="current-password" style={{display: 'none'}} />

                        <div className="form-group">
                          <label>Username</label>
                          <input
                            type="text"
                            value={createForm.username}
                            onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                            required
                            autoComplete="off"
                            placeholder="jdoe"
                          />
                        </div>
                        <div className="form-group">
                          <label>Password</label>
                          <input
                            type="password"
                            value={createForm.password}
                            onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                            required
                            autoComplete="new-password"
                            placeholder="••••••••"
                          />
                        </div>
                      </>
                    )}
                    <div className="form-group">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={editingUser ? editForm.email : createForm.email}
                        onChange={(e) => editingUser ? setEditForm({...editForm, email: e.target.value}) : setCreateForm({...createForm, email: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="john.doe@example.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                <div className="form-section">
                  <h4 className="form-section-title">Personal Details</h4>
                  <div className="form-grid form-grid-2">
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        value={editingUser ? editForm.first_name : createForm.first_name}
                        onChange={(e) => editingUser ? setEditForm({...editForm, first_name: e.target.value}) : setCreateForm({...createForm, first_name: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="John"
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={editingUser ? editForm.last_name : createForm.last_name}
                        onChange={(e) => editingUser ? setEditForm({...editForm, last_name: e.target.value}) : setCreateForm({...createForm, last_name: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="form-section">
                  <h4 className="form-section-title">Contact Information</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Mobile Number</label>
                      <input
                        type="tel"
                        value={editingUser ? editForm.mobile_number : createForm.mobile_number}
                        onChange={(e) => editingUser ? setEditForm({...editForm, mobile_number: e.target.value}) : setCreateForm({...createForm, mobile_number: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                    <div className="form-group">
                      <label>Address</label>
                      <textarea
                        value={editingUser ? editForm.address : createForm.address}
                        onChange={(e) => editingUser ? setEditForm({...editForm, address: e.target.value}) : setCreateForm({...createForm, address: e.target.value})}
                        autoComplete="off"
                        rows={3}
                        placeholder="123 Solar Street..."
                      />
                    </div>
                  </div>
                </div>

              </div>
              <div className="form-actions" style={{ padding: '0 24px 24px 24px' }}>
                <button type="submit" className="btn">{editingUser ? 'Save Changes' : 'Create Customer'}</button>
                <button type="button" onClick={handleCancel} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern Delete User Confirmation Modal */}
      {deleteModal.show && deleteModal.user && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: isDark ? '#2d2d2d' : 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.3)',
            border: isDark ? '2px solid #7f1d1d' : '2px solid #7f1d1d',
            animation: 'slideIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                animation: 'pulse 2s infinite'
              }}>
                🗑️
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, color: '#7f1d1d' }}>
                Delete User
              </h3>
            </div>
            
            <div style={{ marginBottom: '1.5rem', color: isDark ? '#b0b0b0' : '#495057', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '1rem' }}>
                Are you sure you want to delete user <strong style={{ color: isDark ? '#e0e0e0' : '#2c3e50' }}>{deleteModal.user.username}</strong>?
              </p>
              <div style={{
                background: isDark ? 'rgba(127, 29, 29, 0.1)' : '#fee2e2',
                border: isDark ? '1px solid rgba(127, 29, 29, 0.3)' : '1px solid #fecaca',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.9rem',
                color: isDark ? '#fca5a5' : '#991b1b'
              }}>
                <strong>⚠️ Warning:</strong> This will permanently delete the user account. Any devices associated with this user will become unassigned.
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteModal({ show: false, user: null })}
                style={{
                  background: isDark ? '#3a3a3a' : '#e0e0e0',
                  color: isDark ? '#e0e0e0' : '#495057',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = isDark ? '#4a4a4a' : '#d0d0d0'}
                onMouseOut={e => e.currentTarget.style.background = isDark ? '#3a3a3a' : '#e0e0e0'}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(127, 29, 29, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Success Notification Modal */}
      {successModal.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            background: isDark ? '#2d2d2d' : 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '450px',
            width: '90%',
            boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.3)',
            border: isDark ? '1px solid #28a745' : '2px solid #28a745',
            animation: 'slideIn 0.2s ease-out'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto 1rem',
                animation: 'scaleIn 0.3s ease-out'
              }}>
                ✓
              </div>
              
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: isDark ? '#e0e0e0' : '#2c3e50' }}>
                Success
              </h3>
              
              <p style={{ color: isDark ? '#b0b0b0' : '#495057', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                {successModal.message}
              </p>
              
              <button
                onClick={() => setSuccessModal({ show: false, message: '' })}
                style={{
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 2rem',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
