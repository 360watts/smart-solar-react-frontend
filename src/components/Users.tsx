import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import SiteDataPanel from './SiteDataPanel';

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

interface SolarSite {
  id: number;
  device_id: number;
  device_serial: string;
  site_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  capacity_kw: number;
  tilt_deg: number;
  azimuth_deg: number;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SolarSiteForm {
  site_id: string;
  display_name: string;
  latitude: string;
  longitude: string;
  capacity_kw: string;
  tilt_deg: string;
  azimuth_deg: string;
  timezone: string;
  is_active: boolean;
}

const defaultSiteForm: SolarSiteForm = {
  site_id: '',
  display_name: '',
  latitude: '',
  longitude: '',
  capacity_kw: '',
  tilt_deg: '18',
  azimuth_deg: '180',
  timezone: 'Asia/Kolkata',
  is_active: true,
};

const Users: React.FC = () => {
  const navigate = useNavigate();
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

  // Solar site state
  const [siteDetails, setSiteDetails] = useState<SolarSite | null>(null);
  const [siteLoading, setSiteLoading] = useState(false);
  const [editingSite, setEditingSite] = useState(false);
  const [siteForm, setSiteForm] = useState<SolarSiteForm>(defaultSiteForm);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [siteSaving, setSiteSaving] = useState(false);

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
          setSiteDetails(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete user');
      }
    }
  };

  const handleViewUser = async (user: User) => {
    setSelectedUser(user);
    setLoadingDevices(true);
    setSiteLoading(true);
    setSiteDetails(null);
    setSiteError(null);

    try {
      const devices = await apiService.getUserDevices(user.id);
      setUserDevices(devices);
    } catch (err) {
      console.error('Error fetching user devices:', err);
      setUserDevices([]);
    } finally {
      setLoadingDevices(false);
    }

    try {
      const site = await apiService.getUserSite(user.id);
      setSiteDetails(site);
    } catch (err: any) {
      // 404 means no device assigned — not an error we need to surface
      if (err?.status !== 404) {
        console.error('Error fetching site details:', err);
      }
      setSiteDetails(null);
    } finally {
      setSiteLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedUser(null);
    setUserDevices([]);
    setSiteDetails(null);
    setSiteError(null);
    setEditingSite(false);
  };

  const handleCancel = () => {
    setEditingUser(null);
    setCreatingUser(false);
  };

  const handleOpenSiteModal = () => {
    setSiteError(null);
    if (siteDetails) {
      // Editing existing site
      setSiteForm({
        site_id: siteDetails.site_id,
        display_name: siteDetails.display_name,
        latitude: String(siteDetails.latitude),
        longitude: String(siteDetails.longitude),
        capacity_kw: String(siteDetails.capacity_kw),
        tilt_deg: String(siteDetails.tilt_deg),
        azimuth_deg: String(siteDetails.azimuth_deg),
        timezone: siteDetails.timezone,
        is_active: siteDetails.is_active,
      });
    } else {
      setSiteForm(defaultSiteForm);
    }
    setEditingSite(true);
  };

  const handleCloseSiteModal = () => {
    setEditingSite(false);
    setSiteError(null);
  };

  const handleSaveSite = async () => {
    if (!selectedUser) return;
    setSiteSaving(true);
    setSiteError(null);

    const payload: Record<string, unknown> = {
      site_id: siteForm.site_id.trim(),
      display_name: siteForm.display_name.trim(),
      latitude: parseFloat(siteForm.latitude),
      longitude: parseFloat(siteForm.longitude),
      capacity_kw: parseFloat(siteForm.capacity_kw),
      tilt_deg: parseFloat(siteForm.tilt_deg),
      azimuth_deg: parseFloat(siteForm.azimuth_deg),
      timezone: siteForm.timezone.trim(),
      is_active: siteForm.is_active,
    };

    // Validate required numeric fields
    if (
      isNaN(payload.latitude as number) ||
      isNaN(payload.longitude as number) ||
      isNaN(payload.capacity_kw as number)
    ) {
      setSiteError('Latitude, longitude, and capacity are required numeric fields.');
      setSiteSaving(false);
      return;
    }

    try {
      let updated: SolarSite;
      if (siteDetails) {
        updated = await apiService.updateUserSite(selectedUser.id, payload);
      } else {
        updated = await apiService.createUserSite(selectedUser.id, payload);
      }
      setSiteDetails(updated);
      setEditingSite(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save site details. Please check all fields and try again.';
      setSiteError(msg);
    } finally {
      setSiteSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  // Show user dashboard when a user is selected
  if (selectedUser) {
    const hasDevice = userDevices.length > 0;

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

        {/* Solar Site Details */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h2>Solar Site Details</h2>
            {hasDevice && !siteLoading && (
              <button className="btn" onClick={handleOpenSiteModal}>
                {siteDetails ? 'Edit Site' : 'Add Site Details'}
              </button>
            )}
          </div>

          {siteLoading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
              Loading site details...
            </div>
          ) : !hasDevice ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.9rem' }}>
              Assign a device to this user first to configure site details.
            </div>
          ) : siteDetails ? (
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Site ID</span>
                  <p style={{ margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-color, #00a63e)' }}>
                    {siteDetails.site_id}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Display Name</span>
                  <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>{siteDetails.display_name || '-'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
                  <p style={{ margin: '4px 0 0' }}>
                    <span className={siteDetails.is_active ? 'status-badge status-badge-success' : 'status-badge status-badge-danger'}>
                      {siteDetails.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latitude</span>
                  <p style={{ margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>{siteDetails.latitude}°</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Longitude</span>
                  <p style={{ margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>{siteDetails.longitude}°</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capacity</span>
                  <p style={{ margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>{siteDetails.capacity_kw} kW</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tilt</span>
                  <p style={{ margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>{siteDetails.tilt_deg}°</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Azimuth</span>
                  <p style={{ margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>{siteDetails.azimuth_deg}°</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timezone</span>
                  <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>{siteDetails.timezone}</p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted, #64748b)', marginBottom: '16px', fontSize: '0.9rem' }}>
                No site details configured yet. Add the installation location and panel specs.
              </p>
              <button className="btn" onClick={handleOpenSiteModal}>
                + Add Site Details
              </button>
            </div>
          )}
        </div>

        {/* DynamoDB Site Telemetry, Forecast & Weather */}
        {siteDetails && (
          <SiteDataPanel siteId={siteDetails.site_id} autoRefresh />
        )}

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

        {/* Site Details modal */}
        {editingSite && (
          <div className="modal">
            <div className="modal-content">
              <h3>{siteDetails ? 'Edit Solar Site' : 'Add Solar Site Details'}</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleSaveSite(); }}>
                <div className="modal-body">

                  {siteError && (
                    <div style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '16px',
                      color: 'var(--danger-color, #ef4444)',
                      fontSize: '0.85rem',
                    }}>
                      {siteError}
                    </div>
                  )}

                  {/* Identification */}
                  <div className="form-section">
                    <h4 className="form-section-title">Site Identification</h4>
                    <div className="form-grid form-grid-2">
                      <div className="form-group">
                        <label>Site ID <span style={{ color: 'var(--danger-color,#ef4444)' }}>*</span></label>
                        <input
                          type="text"
                          value={siteForm.site_id}
                          onChange={(e) => setSiteForm({ ...siteForm, site_id: e.target.value })}
                          required
                          disabled={!!siteDetails}
                          autoComplete="off"
                          placeholder="coim_001"
                          style={siteDetails ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                        />
                      </div>
                      <div className="form-group">
                        <label>Display Name</label>
                        <input
                          type="text"
                          value={siteForm.display_name}
                          onChange={(e) => setSiteForm({ ...siteForm, display_name: e.target.value })}
                          autoComplete="off"
                          placeholder="Coimbatore Site 1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="form-section">
                    <h4 className="form-section-title">Location</h4>
                    <div className="form-grid form-grid-2">
                      <div className="form-group">
                        <label>Latitude <span style={{ color: 'var(--danger-color,#ef4444)' }}>*</span></label>
                        <input
                          type="number"
                          step="0.0001"
                          value={siteForm.latitude}
                          onChange={(e) => setSiteForm({ ...siteForm, latitude: e.target.value })}
                          required
                          autoComplete="off"
                          placeholder="11.0086"
                        />
                      </div>
                      <div className="form-group">
                        <label>Longitude <span style={{ color: 'var(--danger-color,#ef4444)' }}>*</span></label>
                        <input
                          type="number"
                          step="0.0001"
                          value={siteForm.longitude}
                          onChange={(e) => setSiteForm({ ...siteForm, longitude: e.target.value })}
                          required
                          autoComplete="off"
                          placeholder="76.9909"
                        />
                      </div>
                      <div className="form-group">
                        <label>Timezone</label>
                        <input
                          type="text"
                          value={siteForm.timezone}
                          onChange={(e) => setSiteForm({ ...siteForm, timezone: e.target.value })}
                          autoComplete="off"
                          placeholder="Asia/Kolkata"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Panel Configuration */}
                  <div className="form-section">
                    <h4 className="form-section-title">Panel Configuration</h4>
                    <div className="form-grid form-grid-2">
                      <div className="form-group">
                        <label>Capacity (kW) <span style={{ color: 'var(--danger-color,#ef4444)' }}>*</span></label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={siteForm.capacity_kw}
                          onChange={(e) => setSiteForm({ ...siteForm, capacity_kw: e.target.value })}
                          required
                          autoComplete="off"
                          placeholder="5.0"
                        />
                      </div>
                      <div className="form-group">
                        <label>Tilt (°)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="90"
                          value={siteForm.tilt_deg}
                          onChange={(e) => setSiteForm({ ...siteForm, tilt_deg: e.target.value })}
                          autoComplete="off"
                          placeholder="18"
                        />
                      </div>
                      <div className="form-group">
                        <label>Azimuth (°)</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="360"
                          value={siteForm.azimuth_deg}
                          onChange={(e) => setSiteForm({ ...siteForm, azimuth_deg: e.target.value })}
                          autoComplete="off"
                          placeholder="180"
                        />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '28px' }}>
                        <input
                          type="checkbox"
                          id="site-is-active"
                          checked={siteForm.is_active}
                          onChange={(e) => setSiteForm({ ...siteForm, is_active: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color, #00a63e)' }}
                        />
                        <label htmlFor="site-is-active" style={{ margin: 0, cursor: 'pointer' }}>Active</label>
                      </div>
                    </div>
                  </div>

                </div>
                <div className="form-actions" style={{ padding: '0 24px 24px 24px' }}>
                  <button type="submit" className="btn" disabled={siteSaving}>
                    {siteSaving ? 'Saving...' : siteDetails ? 'Save Changes' : 'Add Site'}
                  </button>
                  <button type="button" onClick={handleCloseSiteModal} className="btn btn-secondary" disabled={siteSaving}>
                    Cancel
                  </button>
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
    </div>
  );
};

export default Users;
