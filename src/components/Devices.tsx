import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Device {
  id: number;
  device_serial: string;
  user?: string;
  provisioned_at: string;
  config_version?: string;
}

const Devices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [creatingDevice, setCreatingDevice] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [editForm, setEditForm] = useState({
    device_serial: '',
    user: '',
    config_version: '',
  });
  const [createForm, setCreateForm] = useState({
    device_serial: '',
    user: '',
    config_version: '',
  });

  useEffect(() => {
    fetchDevices();
    fetchUsers();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setShowUserDropdown(false);
    };

    if (showUserDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showUserDropdown]);

  useEffect(() => {
    if (userSearchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const searchLower = userSearchTerm.toLowerCase();
      const filtered = users.filter(user => {
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
        return (
          user.username.toLowerCase().includes(searchLower) ||
          user.first_name.toLowerCase().includes(searchLower) ||
          user.last_name.toLowerCase().includes(searchLower) ||
          fullName.includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        );
      });
      setFilteredUsers(filtered);
    }
  }, [users, userSearchTerm]);

  const fetchDevices = async (search?: string) => {
    try {
      const data = await apiService.getDevices(search);
      setDevices(data);
      setFilteredDevices(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users for device assignment');
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setEditForm({
      device_serial: device.device_serial,
      user: device.user || '',
      config_version: device.config_version || '',
    });
    setUserSearchTerm(device.user ? `${users.find(u => u.username === device.user)?.first_name} ${users.find(u => u.username === device.user)?.last_name} (${device.user})` : '');
    setShowUserDropdown(false);
  };

  const handleSave = async () => {
    if (!editingDevice) return;

    try {
      const updatedDevice = await apiService.updateDevice(editingDevice.id, editForm);
      setDevices(devices.map(d => d.id === editingDevice.id ? updatedDevice : d));
      setEditingDevice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update device');
    }
  };

  const handleCreate = async () => {
    try {
      const newDevice = await apiService.createDevice(createForm);
      setDevices([...devices, newDevice]);
      setCreatingDevice(false);
      setCreateForm({
        device_serial: '',
        user: '',
        config_version: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create device');
    }
  };

  const handleDelete = async (device: any) => {
    if (window.confirm(`Are you sure you want to delete device ${device.device_serial}?`)) {
      try {
        console.log('Deleting device with ID:', device.id, 'Serial:', device.device_serial);
        await apiService.deleteDevice(device.id);
        const updatedDevices = devices.filter(d => d.id !== device.id);
        setDevices(updatedDevices);
        setFilteredDevices(updatedDevices);
      } catch (err) {
        console.error('Delete error:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete device');
      }
    }
  };

  const handleCancel = () => {
    setEditingDevice(null);
    setCreatingDevice(false);
    setUserSearchTerm('');
    setShowUserDropdown(false);
  };

  if (loading) {
    return <div className="loading">Loading devices...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div>
      <h1>Device Management</h1>

      <div className="card">
        <div className="card-header">
          <h2>Devices ({filteredDevices.length})</h2>
          <div className="card-actions">
            <input
              type="text"
              placeholder="Search devices..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
            <button onClick={() => {
              setCreatingDevice(true);
              setUserSearchTerm('');
              setShowUserDropdown(false);
            }} className="btn">
              Register New Device
            </button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>Device Serial</th>
              <th style={{ textAlign: 'center' }}>User</th>
              <th style={{ textAlign: 'center' }}>Config Version</th>
              <th style={{ textAlign: 'center' }}>Provisioned At</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => (
              <tr key={device.id}>
                <td>{device.device_serial}</td>
                <td>{device.user || '-'}</td>
                <td>{device.config_version || '-'}</td>
                <td>
                  {(() => {
                    if (!device.provisioned_at) return 'N/A';
                    const date = new Date(device.provisioned_at);
                    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
                  })()}
                </td>
                <td>
                  <button onClick={() => handleEdit(device)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #94a3b8)' }} title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(device)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color, #ef4444)' }} title="Delete">
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

      {(editingDevice || creatingDevice) && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingDevice ? `Edit Device: ${editingDevice.device_serial}` : 'Register New Device'}</h3>
            <form onSubmit={(e) => { e.preventDefault(); editingDevice ? handleSave() : handleCreate(); }}>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Device Serial:</label>
                <input
                  type="text"
                  value={editingDevice ? editForm.device_serial : createForm.device_serial}
                  onChange={(e) => editingDevice ? setEditForm({...editForm, device_serial: e.target.value}) : setCreateForm({...createForm, device_serial: e.target.value})}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>User:</label>
                <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    placeholder="Search and select user..."
                    value={userSearchTerm}
                    onChange={(e) => {
                      setUserSearchTerm(e.target.value);
                      setShowUserDropdown(true);
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    autoComplete="off"
                  />
                  {(editingDevice ? editForm.user : createForm.user) && (
                    <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)' }}>
                      Selected: {users.find(u => u.username === (editingDevice ? editForm.user : createForm.user))?.first_name} {users.find(u => u.username === (editingDevice ? editForm.user : createForm.user))?.last_name} ({editingDevice ? editForm.user : createForm.user})
                      <button
                        type="button"
                        onClick={() => {
                          if (editingDevice) {
                            setEditForm({...editForm, user: ''});
                          } else {
                            setCreateForm({...createForm, user: ''});
                          }
                          setUserSearchTerm('');
                        }}
                        style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--danger-color, #ef4444)', cursor: 'pointer', fontSize: '1.25rem' }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {showUserDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--bg-secondary, #0f172a)',
                      border: '1px solid var(--border-color, rgba(148, 163, 184, 0.1))',
                      borderRadius: '10px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)'
                    }}>
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => {
                              if (editingDevice) {
                                setEditForm({...editForm, user: user.username});
                              } else {
                                setCreateForm({...createForm, user: user.username});
                              }
                              setUserSearchTerm(`${user.first_name} ${user.last_name} (${user.username})`);
                              setShowUserDropdown(false);
                            }}
                            style={{
                              padding: '12px 16px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-color, rgba(148, 163, 184, 0.1))',
                              background: (editingDevice ? editForm.user : createForm.user) === user.username ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                              color: 'var(--text-primary, #f8fafc)',
                              transition: 'all 0.15s ease',
                              fontSize: '0.875rem'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = (editingDevice ? editForm.user : createForm.user) === user.username ? 'rgba(99, 102, 241, 0.15)' : 'transparent'}
                          >
                            {user.first_name} {user.last_name} ({user.username}) - {user.email}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '12px 16px', color: 'var(--text-muted, #64748b)', fontSize: '0.875rem' }}>
                          {userSearchTerm.trim() === '' ? 'Start typing to search users...' : 'No users found'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Config Version:</label>
                <input
                  type="text"
                  value={editingDevice ? editForm.config_version : createForm.config_version}
                  onChange={(e) => editingDevice ? setEditForm({...editForm, config_version: e.target.value}) : setCreateForm({...createForm, config_version: e.target.value})}
                  autoComplete="off"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn">{editingDevice ? 'Save' : 'Create'}</button>
                <button type="button" onClick={handleCancel} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Devices;