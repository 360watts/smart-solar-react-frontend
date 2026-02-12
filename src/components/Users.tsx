import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

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
  provisioned_at?: string;
  config_version?: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDevices, setUserDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
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

  useEffect(() => {
    fetchUsers();
  }, []);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchUsers(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  const fetchUsers = async (search?: string) => {
    try {
      const data = await apiService.getUsers(search);
      const filteredData = data.filter((user: any) => !user.is_staff);
      setUsers(filteredData);
      setFilteredUsers(filteredData);
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
      // Refetch to get the updated user with all fields
      await fetchUsers(searchTerm);
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
      // Refetch to get the new user with all fields
      await fetchUsers(searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleDelete = async (user: any) => {
    if (window.confirm(`Are you sure you want to delete user ${user.username}?`)) {
      try {
        await apiService.deleteUser(user.id);
        setUsers(users.filter(u => u.id !== user.id));
        setFilteredUsers(filteredUsers.filter(u => u.id !== user.id));
        if (selectedUser?.id === user.id) {
          setSelectedUser(null);
          setUserDevices([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete user');
      }
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
      // If no devices endpoint or error, just show empty
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
    return <div className="loading">Loading users...</div>;
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

        <div className="card">
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
                  <th style={{ textAlign: 'center' }}>Config Version</th>
                  <th style={{ textAlign: 'center' }}>Provisioned At</th>
                </tr>
              </thead>
              <tbody>
                {userDevices.map((device) => (
                  <tr key={device.id}>
                    <td style={{ textAlign: 'center' }}>{device.device_serial}</td>
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

        {editingUser && (
          <div className="modal">
            <div className="modal-content">
              <h3>Edit User: {editingUser.username}</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>First Name:</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>Last Name:</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>Email:</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>Mobile Number:</label>
                  <input
                    type="tel"
                    value={editForm.mobile_number}
                    onChange={(e) => setEditForm({...editForm, mobile_number: e.target.value})}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>Address:</label>
                  <textarea
                    value={editForm.address}
                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                    autoComplete="off"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn">Save</button>
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
          <h2>Users ({filteredUsers.length})</h2>
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
            {filteredUsers.map((user) => (
              <tr 
                key={user.id} 
                onClick={() => handleViewUser(user)}
                style={{ cursor: 'pointer' }}
                className="clickable-row"
              >
                <td>{user.first_name} {user.last_name}</td>
                <td>{user.email}</td>
                <td>{user.mobile_number || '-'}</td>
                <td>{user.address || '-'}</td>
                <td>
                  {(() => {
                    if (!user.date_joined) return 'N/A';
                    const date = new Date(user.date_joined);
                    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
                  })()}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleEdit(user)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #94a3b8)' }} title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(user)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color, #ef4444)' }} title="Delete">
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
      </div>

      {(editingUser || creatingUser) && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingUser ? `Edit User: ${editingUser.username}` : 'Register New User'}</h3>
            <form onSubmit={(e) => { e.preventDefault(); editingUser ? handleSave() : handleCreate(); }}>
              <div className="modal-body">
                {creatingUser && (
                  <>
                    {/* Hidden inputs to prevent autofill */}
                    <input type="text" autoComplete="username" style={{display: 'none'}} />
                    <input type="password" autoComplete="current-password" style={{display: 'none'}} />
                    <div className="form-group">
                      <label>Username:</label>
                      <input
                        type="text"
                        value={createForm.username}
                        onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                        required
                        autoComplete="off"
                      />
                    </div>
                    <div className="form-group">
                      <label>Password:</label>
                      <input
                        type="password"
                        value={createForm.password}
                        onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label>First Name:</label>
                  <input
                    type="text"
                    value={editingUser ? editForm.first_name : createForm.first_name}
                    onChange={(e) => editingUser ? setEditForm({...editForm, first_name: e.target.value}) : setCreateForm({...createForm, first_name: e.target.value})}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label>Last Name:</label>
                  <input
                    type="text"
                    value={editingUser ? editForm.last_name : createForm.last_name}
                    onChange={(e) => editingUser ? setEditForm({...editForm, last_name: e.target.value}) : setCreateForm({...createForm, last_name: e.target.value})}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label>Email:</label>
                  <input
                    type="email"
                    value={editingUser ? editForm.email : createForm.email}
                    onChange={(e) => editingUser ? setEditForm({...editForm, email: e.target.value}) : setCreateForm({...createForm, email: e.target.value})}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label>Mobile Number:</label>
                  <input
                    type="tel"
                    value={editingUser ? editForm.mobile_number : createForm.mobile_number}
                    onChange={(e) => editingUser ? setEditForm({...editForm, mobile_number: e.target.value}) : setCreateForm({...createForm, mobile_number: e.target.value})}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label>Address:</label>
                  <textarea
                    value={editingUser ? editForm.address : createForm.address}
                    onChange={(e) => editingUser ? setEditForm({...editForm, address: e.target.value}) : setCreateForm({...createForm, address: e.target.value})}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn">{editingUser ? 'Save' : 'Create'}</button>
                <button type="button" onClick={handleCancel} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
