import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { useDebouncedCallback } from '../hooks/useDebounce';
import AuditTrail from './AuditTrail';
import SiteDataPanel from './SiteDataPanel';

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
}

interface Device {
  id: number;
  device_serial: string;
  hw_id?: string;
  model?: string;
  user?: string;
  provisioned_at: string;
  config_version?: string;
  is_online?: boolean;
  last_heartbeat?: string;
  logs_enabled?: boolean;
  created_by_username?: string;
  created_at?: string;
  updated_by_username?: string;
  updated_at?: string;
}

interface Preset {
  id: number;
  config_id?: string;
  name: string;
  gateway_configuration?: {
    general_settings?: {
      config_id?: string;
    };
  };
}

interface SystemHealthData {
  total_devices: number;
  active_devices: number;
  total_telemetry_points: number;
  uptime_seconds: number;
  database_status: string;
  mqtt_status: string;
  overall_health: string;
}

interface TelemetryData {
  deviceId: string;
  timestamp: string;
  data_type: string;
  value: number;
  unit: string;
}

interface TelemetrySummary {
  totalPoints: number;
  deviceCount: number;
  latestTimestamp: string | null;
}

interface SolarSite {
  id: number;
  device_id: number;
  site_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  capacity_kw: number;
  tilt_deg: number;
  azimuth_deg: number;
  timezone: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
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

const Devices: React.FC = () => {
  const [searchParams] = useSearchParams();
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
  const [selectedDevices, setSelectedDevices] = useState<Set<number>>(new Set());
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [telemetrySummary, setTelemetrySummary] = useState<TelemetrySummary | null>(null);
  const [telemetryData, setTelemetryData] = useState<TelemetryData[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceLogs, setDeviceLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
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

  const fetchDevices = useCallback(async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      const response = await apiService.getDevices(search || undefined, page, pageSize);
      
      // Handle paginated response
      if (response.results) {
        setDevices(response.results);
        setFilteredDevices(response.results);
        setTotalCount(response.count);
        setTotalPages(response.total_pages);
        setCurrentPage(response.current_page);
      } else {
        // Fallback for non-paginated response
        setDevices(Array.isArray(response) ? response : []);
        setFilteredDevices(Array.isArray(response) ? response : []);
        setTotalCount(Array.isArray(response) ? response.length : 0);
        setTotalPages(1);
        setCurrentPage(1);
      }
      
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }, [pageSize]);

  const fetchUsers = async () => {
    try {
      const data: User[] = await apiService.getUsers();
      // Filter out staff and superusers, only showing regular customers
      const customers = data.filter(user => !user.is_staff && !user.is_superuser);
      setUsers(customers);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users for device assignment');
    }
  };

  const fetchPresets = async () => {
    try {
      const data = await apiService.getPresets();
      setPresets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    } finally {
      setPresetsLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [healthData, telemetryData] = await Promise.all([
        apiService.getSystemHealth(),
        apiService.getTelemetry(),
      ]);

      setHealth(healthData || null);

      const telemetryArray = Array.isArray(telemetryData) ? telemetryData : [];
      setTelemetryData(telemetryArray);
      const latest = telemetryArray.reduce<string | null>((currentLatest, item) => {
        if (!item?.timestamp) return currentLatest;
        const itemDate = new Date(item.timestamp);
        if (Number.isNaN(itemDate.getTime())) return currentLatest;
        if (!currentLatest) return item.timestamp;
        const currentDate = new Date(currentLatest);
        return itemDate > currentDate ? item.timestamp : currentLatest;
      }, null);

      const deviceCount = new Set(telemetryArray.map((item: TelemetryData) => item.deviceId)).size;
      setTelemetrySummary({
        totalPoints: telemetryArray.length,
        deviceCount,
        latestTimestamp: latest,
      });
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setDashboardError('Failed to load device dashboards');
    }
  };

  const fetchDeviceLogs = useCallback(async (deviceId: number) => {
    setLogsLoading(true);
    try {
      const response = await apiService.getDeviceLogs(deviceId, 50, 0);
      setDeviceLogs(response.logs || []);
    } catch (err) {
      console.error('Failed to fetch device logs:', err);
      setDeviceLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [apiService]);

  const handleViewDevice = useCallback((device: Device) => {
    setSelectedDevice(device);
    setSiteDetails(null);
    setSiteLoading(true);
    setDeviceLogs([]);
    
    // Fetch site details and logs in parallel
    Promise.all([
      apiService.getDeviceSite(device.id)
        .then(data => setSiteDetails(data))
        .catch((err) => {
          console.error('Failed to fetch site for device', device.id, ':', err);
          setSiteDetails(null);
        }),
      fetchDeviceLogs(device.id)
    ]).finally(() => setSiteLoading(false));
  }, [fetchDeviceLogs]);

  useEffect(() => {
    fetchUsers();
    fetchPresets();
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const deviceIdParam = searchParams.get('deviceId');
    if (deviceIdParam) {
      const deviceId = parseInt(deviceIdParam, 10);
      if (!isNaN(deviceId)) {
        const foundDevice = devices.find(d => d.id === deviceId);
        if (foundDevice) {
          handleViewDevice(foundDevice);
        }
      }
    }
  }, [searchParams, devices, handleViewDevice]);
  
  useEffect(() => {
    fetchDevices(currentPage, searchTerm);
  }, [currentPage, searchTerm, pageSize, fetchDevices]);
  
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

  // Debounced search function that runs the actual search after 300ms of inactivity
  const debouncedSearch = useDebouncedCallback(
    (query: string) => {
      // The actual search happens via useEffect that watches currentPage and searchTerm
      // This ensures we don't make too many API calls
    },
    300
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchTerm(query);
    setCurrentPage(1);  // Reset to page 1 on new search
    debouncedSearch(query);  // Debounce the search
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
      await apiService.updateDevice(editingDevice.id, editForm);
      setEditingDevice(null);
      // Refetch to get the updated device with all fields including audit trail
      await fetchDevices(currentPage, searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update device');
    }
  };

  const handleCreate = async () => {
    try {
      await apiService.createDevice(createForm);
      setCreatingDevice(false);
      setCreateForm({
        device_serial: '',
        user: '',
        config_version: '',
      });
      // Refetch to get the new device with all fields including audit trail
      await fetchDevices(currentPage, searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create device');
    }
  };

  const handleDelete = async (device: any) => {
    if (window.confirm(`Are you sure you want to delete device ${device.device_serial}?`)) {
      try {
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

  const handleReboot = async (device: any) => {
    if (window.confirm(`Are you sure you want to reboot device ${device.device_serial}? The device will restart on its next heartbeat.`)) {
      try {
        await apiService.rebootDevice(device.id);
        alert(`Reboot command queued for ${device.device_serial}. Device will reboot on next heartbeat.`);
      } catch (err) {
        console.error('Reboot error:', err);
        setError(err instanceof Error ? err.message : 'Failed to queue reboot command');
      }
    }
  };

  const handleHardReset = async (device: any) => {
    if (window.confirm(`⚠️ WARNING: Hard reset will erase device configuration and restart it.\n\nAre you sure you want to hard reset device ${device.device_serial}?`)) {
      try {
        await apiService.hardResetDevice(device.id);
        alert(`Hard reset command queued for ${device.device_serial}. Device will reset on next heartbeat.`);
      } catch (err) {
        console.error('Hard reset error:', err);
        setError(err instanceof Error ? err.message : 'Failed to queue hard reset command');
      }
    }
  };

  const handleDeleteDevice = async (device: any) => {
    if (window.confirm(`⚠️ WARNING: This will permanently delete device ${device.device_serial} and all its data.\n\nAre you sure you want to delete this device?`)) {
      try {
        await apiService.deleteDevice(device.id);
        alert(`Device ${device.device_serial} deleted successfully.`);
        setSelectedDevice(null);
        fetchDevices(); // Refresh device list
      } catch (err) {
        console.error('Delete device error:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete device');
      }
    }
  };

  const handleToggleLogs = async (device: any, enabled: boolean) => {
    try {
      await apiService.toggleDeviceLogs(device.id, enabled);
      setSelectedDevice({ ...device, logs_enabled: enabled });
      fetchDevices(); // Refresh device list
    } catch (err) {
      console.error('Toggle logs error:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle device logs');
    }
  };

  const handleSelectDevice = (deviceId: number) => {
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(deviceId)) {
      newSelected.delete(deviceId);
    } else {
      newSelected.add(deviceId);
    }
    setSelectedDevices(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDevices.size === filteredDevices.length) {
      setSelectedDevices(new Set());
    } else {
      const allIds = new Set(filteredDevices.map(d => d.id));
      setSelectedDevices(allIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDevices.size === 0) {
      setError('No devices selected for deletion');
      return;
    }

    const deviceList = Array.from(selectedDevices)
      .map(id => devices.find(d => d.id === id))
      .filter(Boolean);

    const confirmMessage = `Are you sure you want to delete ${selectedDevices.size} device(s)?\n\n${deviceList.map(d => d?.device_serial).join(', ')}`;

    if (window.confirm(confirmMessage)) {
      try {
        setBulkDeleteLoading(true);
        await apiService.deleteDevicesBulk(Array.from(selectedDevices));
        
        const updatedDevices = devices.filter(d => !selectedDevices.has(d.id));
        setDevices(updatedDevices);
        setFilteredDevices(updatedDevices.filter(d => 
          d.device_serial.toLowerCase().includes(searchTerm.toLowerCase())
        ));
        setSelectedDevices(new Set());
        setBulkDeleteLoading(false);
      } catch (err) {
        setBulkDeleteLoading(false);
        console.error('Bulk delete error:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete devices');
      }
    }
  };

  const handleCancel = () => {
    setEditingDevice(null);
    setCreatingDevice(false);
    setUserSearchTerm('');
    setShowUserDropdown(false);
  };

  const handleBackToList = () => {
    setSelectedDevice(null);
    setSiteDetails(null);
    setEditingSite(false);
  };

  if (loading) {
    return <div className="loading">Loading devices...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const getPresetConfigId = (preset: Preset): string => {
    return preset.gateway_configuration?.general_settings?.config_id || preset.config_id || '';
  };

  if (selectedDevice) {
    const deviceTelemetry = telemetryData.filter((entry) => entry.deviceId === selectedDevice.device_serial);
    const latestTelemetry = deviceTelemetry.reduce<string | null>((currentLatest, item) => {
      if (!item?.timestamp) return currentLatest;
      const itemDate = new Date(item.timestamp);
      if (Number.isNaN(itemDate.getTime())) return currentLatest;
      if (!currentLatest) return item.timestamp;
      const currentDate = new Date(currentLatest);
      return itemDate > currentDate ? item.timestamp : currentLatest;
    }, null);

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <button
            onClick={handleBackToList}
            className="btn btn-secondary"
            style={{ marginRight: '15px' }}
          >
            ← Back to Devices
          </button>
          <h1 style={{ margin: 0 }}>{selectedDevice.device_serial} Dashboard</h1>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h2>Device Details</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => handleEdit(selectedDevice)} className="btn">
                Edit Device
              </button>
              <button 
                onClick={() => handleReboot(selectedDevice)} 
                className="btn"
                style={{ 
                  backgroundColor: '#f59e0b', 
                  color: 'white',
                  border: 'none'
                }}
                title="Queue reboot command for device"
              >
                🔄 Reboot
              </button>
              <button 
                onClick={() => handleHardReset(selectedDevice)} 
                className="btn"
                style={{ 
                  backgroundColor: '#dc2626', 
                  color: 'white',
                  border: 'none'
                }}
                title="Queue hard reset command for device (erases config)"
              >
                ⚠️ Hard Reset
              </button>
              <button 
                onClick={() => handleDeleteDevice(selectedDevice)} 
                className="btn"
                style={{ 
                  backgroundColor: '#7f1d1d', 
                  color: 'white',
                  border: 'none'
                }}
                title="Permanently delete device and all its data"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
              <div>
                <strong>Status:</strong>
                <p style={{ margin: '5px 0' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    backgroundColor: selectedDevice.is_online ? '#dcfce7' : '#fee2e2',
                    color: selectedDevice.is_online ? '#166534' : '#991b1b'
                  }}>
                    {selectedDevice.is_online ? '🟢 Online' : '🔴 Offline'}
                  </span>
                </p>
              </div>
              <div>
                <strong>Last Heartbeat:</strong>
                <p style={{ margin: '5px 0' }}>
                  {selectedDevice.last_heartbeat
                    ? new Date(selectedDevice.last_heartbeat).toLocaleString()
                    : 'Never'}
                </p>
              </div>
              <div>
                <strong>MAC / HW ID:</strong>
                <p style={{ margin: '5px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>{selectedDevice.hw_id || '—'}</p>
              </div>
              <div>
                <strong>Model:</strong>
                <p style={{ margin: '5px 0' }}>{selectedDevice.model || '—'}</p>
              </div>
              <div>
                <strong>Assigned User:</strong>
                <p style={{ margin: '5px 0' }}>{selectedDevice.user || '-'}</p>
              </div>
              <div>
                <strong>Config Version:</strong>
                <p style={{ margin: '5px 0' }}>{selectedDevice.config_version || '-'}</p>
              </div>
              <div>
                <strong>Provisioned At:</strong>
                <p style={{ margin: '5px 0' }}>
                  {selectedDevice.provisioned_at
                    ? new Date(selectedDevice.provisioned_at).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div>
                <strong>Created By:</strong>
                <p style={{ margin: '5px 0' }}>{selectedDevice.created_by_username || '-'}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedDevice.logs_enabled || false}
                    onChange={(e) => handleToggleLogs(selectedDevice, e.target.checked)}
                  />
                  <strong>Enable Device Logs</strong>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted, #9ca3af)' }}>
                    (Device will send logs when enabled)
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2" style={{ gap: 'var(--space-6, 24px)' }}>
          <div className="card">
            <h2>System Health</h2>
            {dashboardError && <p className="error">{dashboardError}</p>}
            {!dashboardError && !health && <p>Loading system health...</p>}
            {health && (
              <div>
                <p><strong>Overall:</strong> {health.overall_health}</p>
                <p><strong>Devices:</strong> {health.active_devices}/{health.total_devices} active</p>
                <p><strong>Telemetry Points:</strong> {health.total_telemetry_points.toLocaleString()}</p>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Telemetry Snapshot</h2>
            {dashboardError && <p className="error">{dashboardError}</p>}
            {!dashboardError && !telemetrySummary && <p>Loading telemetry...</p>}
            {telemetrySummary && (
              <div>
                <p><strong>Total Points:</strong> {deviceTelemetry.length.toLocaleString()}</p>
                <p><strong>Data Types:</strong> {new Set(deviceTelemetry.map((entry) => entry.data_type)).size}</p>
                <p><strong>Latest:</strong> {latestTelemetry ? new Date(latestTelemetry).toLocaleString() : 'N/A'}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Site Configuration ── */}
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h2>Site Configuration</h2>
            {!siteLoading && (
              <button className="btn" onClick={() => {
                if (siteDetails) {
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
                  setSiteForm({ site_id: '', display_name: '', latitude: '', longitude: '', capacity_kw: '', tilt_deg: '18', azimuth_deg: '180', timezone: 'Asia/Kolkata', is_active: true });
                }
                setSiteError(null);
                setEditingSite(true);
              }}>
                {siteDetails ? 'Edit Site' : 'Add Site'}
              </button>
            )}
          </div>
          <div style={{ padding: '20px' }}>
            {siteLoading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading site details…</p>
            ) : !siteDetails ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No site configured for this device yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                <div><strong>Site ID:</strong><p style={{ margin: '4px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.88rem', color: '#00a63e' }}>{siteDetails.site_id}</p></div>
                <div><strong>Display Name:</strong><p style={{ margin: '4px 0' }}>{siteDetails.display_name || '—'}</p></div>
                <div><strong>Status:</strong><p style={{ margin: '4px 0' }}><span className={siteDetails.is_active ? 'status-badge status-badge-success' : 'status-badge status-badge-danger'}>{siteDetails.is_active ? 'Active' : 'Inactive'}</span></p></div>
                <div><strong>Latitude:</strong><p style={{ margin: '4px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.88rem' }}>{siteDetails.latitude}°</p></div>
                <div><strong>Longitude:</strong><p style={{ margin: '4px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.88rem' }}>{siteDetails.longitude}°</p></div>
                <div><strong>Timezone:</strong><p style={{ margin: '4px 0' }}>{siteDetails.timezone}</p></div>
                <div><strong>Capacity:</strong><p style={{ margin: '4px 0', fontFamily: 'JetBrains Mono, monospace' }}>{siteDetails.capacity_kw} kW</p></div>
                <div><strong>Tilt:</strong><p style={{ margin: '4px 0', fontFamily: 'JetBrains Mono, monospace' }}>{siteDetails.tilt_deg}°</p></div>
                <div><strong>Azimuth:</strong><p style={{ margin: '4px 0', fontFamily: 'JetBrains Mono, monospace' }}>{siteDetails.azimuth_deg}°</p></div>
              </div>
            )}
          </div>
        </div>

        {/* ── Live Site Intelligence (DynamoDB) ── */}
        {siteDetails && (
          <SiteDataPanel siteId={siteDetails.site_id} autoRefresh />
        )}

        {/* ── Device Logs ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h2>Device Logs</h2>
            <button onClick={() => fetchDeviceLogs(selectedDevice.id)} className="btn" disabled={logsLoading}>
              {logsLoading ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>
          <div style={{ padding: '20px' }}>
            {!selectedDevice.logs_enabled && (
              <p style={{ color: 'var(--text-muted, #9ca3af)', fontStyle: 'italic' }}>
                Logging is disabled for this device. Enable it in Device Details to receive logs.
              </p>
            )}
            {deviceLogs.length === 0 && selectedDevice.logs_enabled && (
              <p style={{ color: 'var(--text-muted, #9ca3af)' }}>
                No logs available yet. Logs will appear when device sends them.
              </p>
            )}
            {deviceLogs.length > 0 && (
              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto', 
                fontFamily: 'JetBrains Mono, monospace', 
                fontSize: '0.85rem',
                backgroundColor: '#1e1e1e',
                padding: '10px',
                borderRadius: '4px'
              }}>
                {deviceLogs.map((log) => (
                  <div key={log.id} style={{ 
                    marginBottom: '8px', 
                    paddingBottom: '8px', 
                    borderBottom: '1px solid #333',
                    color: log.level === 'ERROR' ? '#ff6b6b' : 
                           log.level === 'WARNING' ? '#ffa500' : 
                           log.level === 'INFO' ? '#4dabf7' : '#ced4da'
                  }}>
                    <span style={{ color: '#888' }}>[{new Date(log.timestamp).toLocaleString()}]</span>
                    <span style={{ fontWeight: 'bold', marginLeft: '8px' }}>[{log.level}]</span>
                    <span style={{ marginLeft: '8px' }}>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Site edit modal ── */}
        {editingSite && (
          <div className="modal" onClick={() => setEditingSite(false)}>
            <div className="modal-content" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>{siteDetails ? 'Edit Site Configuration' : 'Add Site Configuration'}</h3>
                <button className="close-button" onClick={() => setEditingSite(false)}>×</button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setSiteSaving(true);
                setSiteError(null);
                try {
                  const payload = {
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
                  
                  let updated;
                  if (siteDetails) {
                    updated = await apiService.updateDeviceSite(selectedDevice.id, payload);
                  } else {
                    updated = await apiService.createDeviceSite(selectedDevice.id, payload);
                  }
                  
                  // Ensure the response contains site data
                  if (!updated || !updated.site_id) {
                    throw new Error('Invalid response from server - site data missing');
                  }
                  
                  // Update local state and re-fetch to ensure fresh data
                  setSiteDetails(updated);
                  setEditingSite(false);
                  setSiteSaving(false);
                  
                  // Re-fetch site details to ensure we have the complete data
                  if (!siteDetails) {
                    // Only refetch if it was a new site creation
                    setTimeout(() => {
                      apiService.getDeviceSite(selectedDevice.id)
                        .then(data => {
                          if (data) setSiteDetails(data);
                        })
                        .catch(err => console.error('Failed to re-fetch site:', err));
                    }, 500);
                  }
                } catch (err: any) {
                  setSiteError(err.message || 'Failed to save site');
                  setSiteSaving(false);
                }
              }}>
                <div className="modal-body" style={{ padding: '24px' }}>
                  {siteError && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>{siteError}</p>}
                  <p className="dash-section-label" style={{ marginBottom: '0.5rem' }}>Identification</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Site ID *</label>
                      <input required value={siteForm.site_id} disabled={!!siteDetails} onChange={e => setSiteForm({ ...siteForm, site_id: e.target.value })} placeholder="e.g. site_mumbai_01" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Display Name</label>
                      <input value={siteForm.display_name} onChange={e => setSiteForm({ ...siteForm, display_name: e.target.value })} placeholder="e.g. Mumbai Rooftop" />
                    </div>
                  </div>
                  <p className="dash-section-label" style={{ marginBottom: '0.5rem' }}>Location</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Latitude *</label>
                      <input required type="number" step="any" value={siteForm.latitude} onChange={e => setSiteForm({ ...siteForm, latitude: e.target.value })} placeholder="19.0760" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Longitude *</label>
                      <input required type="number" step="any" value={siteForm.longitude} onChange={e => setSiteForm({ ...siteForm, longitude: e.target.value })} placeholder="72.8777" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Timezone</label>
                      <input value={siteForm.timezone} onChange={e => setSiteForm({ ...siteForm, timezone: e.target.value })} placeholder="Asia/Kolkata" />
                    </div>
                  </div>
                  <p className="dash-section-label" style={{ marginBottom: '0.5rem' }}>Panel Configuration</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Capacity (kW) *</label>
                      <input required type="number" step="any" value={siteForm.capacity_kw} onChange={e => setSiteForm({ ...siteForm, capacity_kw: e.target.value })} placeholder="5.0" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Tilt (°)</label>
                      <input type="number" step="any" value={siteForm.tilt_deg} onChange={e => setSiteForm({ ...siteForm, tilt_deg: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Azimuth (°)</label>
                      <input type="number" step="any" value={siteForm.azimuth_deg} onChange={e => setSiteForm({ ...siteForm, azimuth_deg: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '1rem 0 0 0' }}>
                    <input type="checkbox" id="dev-site-active" checked={siteForm.is_active} onChange={e => setSiteForm({ ...siteForm, is_active: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                    <label htmlFor="dev-site-active" style={{ margin: 0, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}>Active</label>
                  </div>
                  
                  <div className="form-actions" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(148, 163, 184, 0.15)' }}>
                    <button type="submit" className="btn" disabled={siteSaving}>{siteSaving ? 'Saving…' : siteDetails ? 'Save Changes' : 'Add Site'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingSite(false)} disabled={siteSaving}>Cancel</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingDevice && (
          <div className="modal">
            <div className="modal-content">
              <h3>{editingDevice ? `Edit Device: ${editingDevice.device_serial}` : 'Register New Device'}</h3>
              <form onSubmit={(e) => { e.preventDefault(); editingDevice ? handleSave() : handleCreate(); }}>
                <div className="modal-body">
                  
                  {/* Device Identity */}
                  <div className="form-section">
                    <h4 className="form-section-title">Device Identity</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Device Serial Number</label>
                        <input
                          type="text"
                          value={editingDevice ? editForm.device_serial : createForm.device_serial}
                          onChange={(e) => editingDevice ? setEditForm({...editForm, device_serial: e.target.value}) : setCreateForm({...createForm, device_serial: e.target.value})}
                          required
                          autoComplete="off"
                          placeholder="SN-12345678"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ownership */}
                  <div className="form-section">
                    <h4 className="form-section-title">Ownership & Assignment</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Assigned User</label>
                        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            placeholder="Search by name, username, or email..."
                            value={userSearchTerm}
                            onChange={(e) => {
                              setUserSearchTerm(e.target.value);
                              setShowUserDropdown(true);
                            }}
                            onFocus={() => setShowUserDropdown(true)}
                            autoComplete="off"
                            className="full-width"
                          />
                          {showUserDropdown && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '0',
                              right: '0',
                              background: 'var(--bg-secondary, #1e293b)',
                              border: '1px solid var(--border-color, rgba(148, 163, 184, 0.2))',
                              borderRadius: '6px',
                              marginTop: '4px',
                              maxHeight: '200px',
                              overflowY: 'auto',
                              zIndex: 10,
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
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
                                    {user.first_name} {user.last_name} ({user.username}) <br/>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>{user.email}</span>
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
                    </div>
                  </div>

                  {/* Configuration */}
                  <div className="form-section">
                    <h4 className="form-section-title">Configuration</h4>
                    <div className="form-grid form-grid-2">
                      <div className="form-group">
                        <label>Preset Template</label>
                        <select
                          value={editingDevice ? editForm.config_version : createForm.config_version}
                          onChange={(e) => editingDevice ? setEditForm({ ...editForm, config_version: e.target.value }) : setCreateForm({ ...createForm, config_version: e.target.value })}
                          className="full-width"
                        >
                          <option value="">-- Manual Configuration --</option>
                          {presetsLoading && <option value="" disabled>Loading presets...</option>}
                          {!presetsLoading && presets.map((preset) => (
                            <option key={preset.id} value={getPresetConfigId(preset)}>
                              {preset.name} ({getPresetConfigId(preset) || 'no ID'})
                            </option>
                          ))}
                        </select>
                        <small className="form-hint">Selecting a preset sets the Config Version ID below.</small>
                      </div>
                      <div className="form-group">
                        <label>Config Version ID</label>
                        <input
                          type="text"
                          value={editingDevice ? editForm.config_version : createForm.config_version}
                          onChange={(e) => editingDevice ? setEditForm({...editForm, config_version: e.target.value}) : setCreateForm({...createForm, config_version: e.target.value})}
                          autoComplete="off"
                          placeholder="Manual Config ID"
                        />
                      </div>
                    </div>
                  </div>

                </div>
                {editingDevice && (
                  <div style={{ padding: '0 24px' }}>
                     <AuditTrail
                       createdBy={editingDevice.created_by_username}
                       createdAt={editingDevice.created_at}
                       updatedBy={editingDevice.updated_by_username}
                       updatedAt={editingDevice.updated_at}
                     />
                  </div>
                )}
                <div className="form-actions" style={{ padding: '0 24px 24px 24px' }}>
                  <button type="submit" className="btn">{editingDevice ? 'Save Changes' : 'Create Device'}</button>
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
            {selectedDevices.size > 0 && (
              <button 
                onClick={handleBulkDelete}
                disabled={bulkDeleteLoading}
                style={{ 
                  background: 'var(--danger-color, #ef4444)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: bulkDeleteLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  opacity: bulkDeleteLoading ? '0.6' : '1'
                }}
              >
                {bulkDeleteLoading ? `Deleting ${selectedDevices.size}...` : `Delete Selected (${selectedDevices.size})`}
              </button>
            )}
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
              <th style={{ textAlign: 'center', width: '40px' }}>
                <input
                  type="checkbox"
                  checked={selectedDevices.size === filteredDevices.length && filteredDevices.length > 0}
                  onChange={handleSelectAll}
                  title="Select all displayed devices"
                />
              </th>
              <th style={{ textAlign: 'center' }}>Device Serial</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>MAC / HW ID</th>
              <th style={{ textAlign: 'center' }}>Model</th>
              <th style={{ textAlign: 'center' }}>Assigned To</th>
              <th style={{ textAlign: 'center' }}>Config Version</th>
              <th style={{ textAlign: 'center' }}>Provisioned At</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => (
              <tr
                key={device.id}
                onClick={() => handleViewDevice(device)}
                style={{
                  background: selectedDevices.has(device.id) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  cursor: 'pointer'
                }}
                className="clickable-row"
              >
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedDevices.has(device.id)}
                    onChange={() => handleSelectDevice(device.id)}
                  />
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>{device.device_serial}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: device.is_online ? '#dcfce7' : '#fee2e2',
                    color: device.is_online ? '#166534' : '#991b1b'
                  }}>
                    {device.is_online ? '🟢 Online' : '🔴 Offline'}
                  </span>
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: device.hw_id ? 'inherit' : 'var(--text-muted, #9ca3af)' }}>{device.hw_id || '—'}</td>
                <td style={{ textAlign: 'center', fontSize: '0.875rem' }}>{device.model || <span style={{ color: 'var(--text-muted, #9ca3af)' }}>—</span>}</td>
                <td style={{ textAlign: 'center' }}>{device.user || '-'}</td>
                <td style={{ textAlign: 'center' }}>{device.config_version || '-'}</td>
                <td style={{ textAlign: 'center' }}>
                  {(() => {
                    if (!device.provisioned_at) return 'N/A';
                    const date = new Date(device.provisioned_at);
                    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
                  })()}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(device);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #94a3b8)', margin: '0 6px' }}
                    title="Edit"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(device);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color, #ef4444)', margin: '0 6px' }}
                    title="Delete"
                  >
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
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} devices
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
                    // Always show first page, last page, current page, and adjacent pages
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
                      // Add ellipsis if we skipped pages and haven't added one recently
                      pages.push(
                        <span key={`ellipsis-${Math.floor(i / 10)}`} style={{ padding: '0 4px', color: 'var(--text-secondary, #94a3b8)' }}>
                          ...
                        </span>
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
                border: '1px solid var(--border-color, rgba(148, 163, 184, 0.2))',
                borderRadius: '6px',
                background: 'var(--bg-primary, #0f172a)',
                color: 'var(--text-primary, #f8fafc)',
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

      {(editingDevice || creatingDevice) && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingDevice ? `Edit Device: ${editingDevice.device_serial}` : 'Register New Device'}</h3>
            <form onSubmit={(e) => { e.preventDefault(); editingDevice ? handleSave() : handleCreate(); }}>
              <div className="modal-body">
                
                {/* Device Identity */}
                <div className="form-section">
                  <h4 className="form-section-title">Device Identity</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Device Serial Number</label>
                      <input
                        type="text"
                        value={editingDevice ? editForm.device_serial : createForm.device_serial}
                        onChange={(e) => editingDevice ? setEditForm({...editForm, device_serial: e.target.value}) : setCreateForm({...createForm, device_serial: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="SN-12345678"
                      />
                    </div>
                  </div>
                </div>

                {/* Ownership */}
                <div className="form-section">
                  <h4 className="form-section-title">Ownership & Assignment</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Assigned User</label>
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
                            <strong>Selected:</strong> {users.find(u => u.username === (editingDevice ? editForm.user : createForm.user))?.first_name} {users.find(u => u.username === (editingDevice ? editForm.user : createForm.user))?.last_name} ({editingDevice ? editForm.user : createForm.user})
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
                              className="btn-icon btn-icon-danger"
                              style={{ marginLeft: '10px' }}
                              title="Remove Assignment"
                            >
                              ✕
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
                            borderRadius: '8px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            boxShadow: 'var(--shadow-xl)',
                            marginTop: '4px'
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
                                  {user.first_name} {user.last_name} ({user.username}) <br/>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>{user.email}</span>
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
                  </div>
                </div>

                {/* Configuration */}
                <div className="form-section">
                  <h4 className="form-section-title">Configuration</h4>
                  <div className="form-grid form-grid-2">
                    <div className="form-group">
                      <label>Preset Template</label>
                      <select
                        value={editingDevice ? editForm.config_version : createForm.config_version}
                        onChange={(e) => editingDevice ? setEditForm({ ...editForm, config_version: e.target.value }) : setCreateForm({ ...createForm, config_version: e.target.value })}
                        className="full-width"
                      >
                        <option value="">-- Manual Configuration --</option>
                        {presetsLoading && <option value="" disabled>Loading presets...</option>}
                        {!presetsLoading && presets.map((preset) => (
                          <option key={preset.id} value={getPresetConfigId(preset)}>
                            {preset.name} ({getPresetConfigId(preset) || 'no ID'})
                          </option>
                        ))}
                      </select>
                      <small className="form-hint">Selecting a preset sets the Config Version ID below.</small>
                    </div>
                    <div className="form-group">
                      <label>Config Version ID</label>
                      <input
                        type="text"
                        value={editingDevice ? editForm.config_version : createForm.config_version}
                        onChange={(e) => editingDevice ? setEditForm({...editForm, config_version: e.target.value}) : setCreateForm({...createForm, config_version: e.target.value})}
                        autoComplete="off"
                        placeholder="Manual Config ID"
                      />
                    </div>
                  </div>
                </div>

              </div>
              {editingDevice && (
                <div style={{ padding: '0 24px' }}>
                   <AuditTrail
                     createdBy={editingDevice.created_by_username}
                     createdAt={editingDevice.created_at}
                     updatedBy={editingDevice.updated_by_username}
                     updatedAt={editingDevice.updated_at}
                   />
                </div>
              )}
              <div className="form-actions" style={{ padding: '24px' }}>
                <button type="submit" className="btn">{editingDevice ? 'Save Changes' : 'Register Device'}</button>
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