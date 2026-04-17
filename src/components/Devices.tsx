import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MobileDevices } from './mobile';
import { useIsMobile } from '../hooks/useIsMobile';
import ReactDOM from 'react-dom';
import { useSearchParams, Link } from 'react-router-dom';
import { Pencil, Trash2, AlertTriangle, Info, X, CheckCircle2, MapPin, ChevronLeft, RefreshCw, RotateCcw, ScrollText, Sun, Server, Clock, Settings, Wifi, WifiOff, ChevronDown, ChevronRight, Activity, BellOff, Bell } from 'lucide-react';
import { apiService, AlertItem } from '../services/api';
import { useDebouncedCallback } from '../hooks/useDebounce';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import AuditTrail from './AuditTrail';
import SiteDataPanel from './SiteDataPanel';
import { EmptyState } from './EmptyState';
import { SkeletonDeviceList } from './SkeletonLoader';
import { AccessibleModal } from './AccessibleModal';
import PageHeader from './PageHeader';
import { useModal } from '../hooks';
import { IST_TIMEZONE, DEFAULT_PAGE_SIZE } from '../constants';

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
  last_seen_at?: string;
  connectivity_type?: string;
  network_ip?: string;
  signal_strength_dbm?: number | null;
  device_temp_c?: number | null;
  memory_status?: { free_heap?: number } | null;
  heartbeat_health?: {
    severity?: 'ok' | 'warn' | 'critical';
    issues?: string[];
    age_seconds?: number | null;
  } | null;
  logs_enabled?: boolean;
  auto_reboot_enabled?: boolean;
  pending_config_update?: boolean;
  config_ack_ver?: number | null;
  config_downloaded_at?: string | null;
  config_acked_at?: string | null;
  created_by_username?: string;
  created_at?: string;
  updated_by_username?: string;
  updated_at?: string;
  alerts_muted_until?: string | null;
}

interface Preset {
  id: number;
  config_id?: string;
  name: string;
  description?: string;
  slaves_count?: number;
  version?: number;
  updated_at?: string;
  gateway_configuration?: {
    general_settings?: {
      config_id?: string;
      last_updated?: string;
    };
  };
}


interface SolarSite {
  id: number;
  device_id: number;
  site_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  capacity_kw: number;
  inverter_capacity_kw?: number | null;
  tilt_deg: number;
  azimuth_deg: number;
  timezone: string;
  is_active: boolean;
  deye_station_id?: number | null;
  logger_serial?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Register Coverage Sub-components ─────────────────────────────────────────

const SlaveRegisterSection: React.FC<{ slave: any; isDark: boolean }> = ({ slave, isDark }) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
          transition: 'background 150ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {open
            ? <ChevronDown size={13} style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
            : <ChevronRight size={13} style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
          }
          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: isDark ? '#cbd5e1' : '#374151', fontFamily: 'Poppins, sans-serif' }}>
            Slave {slave.slave_id} — {slave.device_name}
          </span>
          {!slave.enabled && (
            <span style={{ fontSize: '0.68rem', padding: '1px 7px', borderRadius: 99, background: 'rgba(148,163,184,0.12)', color: isDark ? '#64748b' : '#94a3b8' }}>disabled</span>
          )}
        </div>
        <span style={{ fontSize: '0.75rem', fontFamily: 'Fira Code, JetBrains Mono, monospace', color: slave.received === slave.configured ? '#22c55e' : '#f59e0b' }}>
          {slave.received}/{slave.configured}
        </span>
      </button>

      {open && (
        <div style={{ overflowX: 'auto', padding: '0 20px 12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                {['Label', 'Addr', 'Category', 'Unit', 'Value', 'Status'].map(h => (
                  <th key={h} style={{ padding: '4px 8px 6px', textAlign: 'left', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slave.registers.map((reg: any) => (
                <tr
                  key={reg.id}
                  style={{
                    borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    background: reg.received ? 'transparent' : isDark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.03)',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = reg.received ? 'transparent' : isDark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.03)')}
                >
                  <td style={{ padding: '5px 8px', fontFamily: 'Fira Code, JetBrains Mono, monospace', color: isDark ? '#e2e8f0' : '#1e293b', whiteSpace: 'nowrap' }}>
                    {reg.label}
                  </td>
                  <td style={{ padding: '5px 8px', fontFamily: 'Fira Code, JetBrains Mono, monospace', color: isDark ? '#64748b' : '#94a3b8' }}>
                    {reg.address}
                  </td>
                  <td style={{ padding: '5px 8px', color: isDark ? '#94a3b8' : '#64748b' }}>
                    {reg.category || '—'}
                  </td>
                  <td style={{ padding: '5px 8px', color: isDark ? '#94a3b8' : '#64748b', fontFamily: 'Fira Code, JetBrains Mono, monospace' }}>
                    {reg.unit || '—'}
                  </td>
                  <td style={{ padding: '5px 8px', fontFamily: 'Fira Code, JetBrains Mono, monospace', fontWeight: 600, color: reg.received ? '#22c55e' : isDark ? '#475569' : '#cbd5e1' }}>
                    {reg.value != null ? reg.value : '—'}
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    {reg.received
                      ? <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                      : <X size={13} style={{ color: '#ef4444' }} />
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const Devices: React.FC = () => {
  const isMobile = useIsMobile();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const isStaffUser = !!user?.is_staff;
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
  const [presetSearch, setPresetSearch] = useState('');
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Set<number>>(new Set());
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceLogFiles, setDeviceLogFiles] = useState<any[]>([]);
  const [logFilesLoading, setLogFilesLoading] = useState(false);
  const [logFilesTotal, setLogFilesTotal] = useState(0);
  const [logFilesPage, setLogFilesPage] = useState(0);
  const [viewingFileContent, setViewingFileContent] = useState<string | null>(null);
  const [viewingFileId, setViewingFileId] = useState<number | null>(null);
  const [viewingFileName, setViewingFileName] = useState<string>('');
  const [viewingFileLoading, setViewingFileLoading] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [fileFilterFrom, setFileFilterFrom] = useState('');
  const [fileFilterTo, setFileFilterTo] = useState('');
  const LOG_FILES_PAGE_SIZE = 20;
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

  // Site management state
  const [siteDetails, setSiteDetails] = useState<SolarSite | null>(null);
  const [siteLoading, setSiteLoading] = useState(false);
  const [devicePreset, setDevicePreset] = useState<Preset | null>(null);

  // Register coverage state
  const [regCoverage, setRegCoverage] = useState<any | null>(null);
  const [regCoverageLoading, setRegCoverageLoading] = useState(false);
  const [regCoverageExpanded, setRegCoverageExpanded] = useState(false);
  const [deviceAlerts, setDeviceAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  
  // Modern modal states
  const rebootModal = useModal<Device>();
  const deleteModal = useModal<Device>();
  const muteAlertsModal = useModal<Device>();
  const [muteHours, setMuteHours] = useState<number | null>(4);
  const [hardResetModal, setHardResetModal] = useState<{ show: boolean; device: Device | null }>({ show: false, device: null });
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{ show: boolean; deviceList: Device[] }>({ show: false, deviceList: [] });
  const [successModal, setSuccessModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  const fetchDevices = useCallback(async (page: number = 1, search: string = '', silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await apiService.getDevices(search || undefined, page, pageSize);
      let latestRows: Device[] = [];

      // Handle paginated response
      if (response.results) {
        latestRows = response.results;
        setDevices(latestRows);
        setFilteredDevices(latestRows);
        setTotalCount(response.count);
        setTotalPages(response.total_pages);
        setCurrentPage(response.current_page);
      } else {
        // Fallback for non-paginated response
        latestRows = Array.isArray(response) ? response : [];
        setDevices(latestRows);
        setFilteredDevices(latestRows);
        setTotalCount(latestRows.length);
        setTotalPages(1);
        setCurrentPage(1);
      }

      // Keep detail panel in sync with fresh heartbeat/status values.
      setSelectedDevice((prev) => {
        if (!prev) return prev;
        const fresh = latestRows.find((d) => d.id === prev.id);
        return fresh ? { ...prev, ...fresh } : prev;
      });
      
      if (!silent) setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      if (!silent) setLoading(false);
    }
  }, [pageSize]);

  const fetchUsers = async () => {
    try {
      const response = await apiService.getUsers();
      setUsers(response.results ?? []);
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

  const fetchAlerts = useCallback(async (silent: boolean = false) => {
    try {
      if (!silent) setAlertsLoading(true);
      const data = await apiService.getAlerts();
      setDeviceAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch alerts for devices view:', err);
    } finally {
      if (!silent) setAlertsLoading(false);
    }
  }, []);

  const activeAlerts = useMemo(() => {
    return deviceAlerts.filter((a) => a.status !== 'resolved' && !a.resolved);
  }, [deviceAlerts]);

  const activeAlertsByDevice = useMemo(() => {
    const map = new Map<string, AlertItem[]>();
    for (const alert of activeAlerts) {
      const key = alert.device_id || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(alert);
    }
    return map;
  }, [activeAlerts]);

  const getAlertDisplayMessage = (alert: AlertItem) => {
    if (alert.fault_code === 'rs485_stale') {
      return 'RS-485 missing data: all register values reported as zero by device firmware.';
    }
    if (alert.fault_code === 'rs485_auto_reboot') {
      return 'Auto-reboot queued after consecutive RS-485 missing-data verdicts.';
    }
    return alert.message;
  };


  const fetchDeviceLogFiles = useCallback(async (deviceId: number, page = 0, start?: string, end?: string) => {
    setLogFilesLoading(true);
    try {
      const response = await apiService.getDeviceLogFiles(deviceId, 20, page * 20, start, end);
      setDeviceLogFiles(response.files || []);
      setLogFilesTotal(response.total || 0);
      setLogFilesPage(page);
    } catch (err) {
      console.error('Failed to fetch log files:', err);
      setDeviceLogFiles([]);
      setLogFilesTotal(0);
    } finally {
      setLogFilesLoading(false);
    }
  }, []);

  const handleViewLogFile = async (fileId: number, filename: string) => {
    if (viewingFileId === fileId) {
      setViewingFileContent(null);
      setViewingFileId(null);
      setViewingFileName('');
      return;
    }
    setViewingFileLoading(true);
    setViewingFileId(fileId);
    setViewingFileName(filename);
    setViewingFileContent(null);
    try {
      const { url } = await apiService.getDeviceLogFileDownloadUrl(selectedDevice!.id, fileId);
      const res = await fetch(url);
      const text = await res.text();
      setViewingFileContent(text);
    } catch (err) {
      console.error('Failed to load log file', err);
      setViewingFileId(null);
      setViewingFileName('');
    } finally {
      setViewingFileLoading(false);
    }
  };

  const handleDownloadLogFile = async (fileId: number) => {
    try {
      const { url } = await apiService.getDeviceLogFileDownloadUrl(selectedDevice!.id, fileId);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to get download URL', err);
    }
  };

  const handleBulkDownload = async () => {
    setBulkDownloading(true);
    try {
      const toIST = (v: string) => v ? new Date(v + ':00+05:30').toISOString() : undefined;
      await apiService.bulkDownloadLogFiles(selectedDevice!.id, toIST(fileFilterFrom), toIST(fileFilterTo));
    } catch (err) {
      console.error('Bulk download failed', err);
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleViewDevice = useCallback((device: Device) => {
    setSelectedDevice(device);
    setSiteDetails(null);
    setSiteLoading(true);
    setDeviceLogFiles([]);
    setLogFilesTotal(0);
    setLogFilesPage(0);
    setViewingFileContent(null);
    setViewingFileId(null);
    setViewingFileName('');
    setViewingFileLoading(false);
    setBulkDownloading(false);
    setFileFilterFrom('');
    setFileFilterTo('');
    setRegCoverage(null);
    setRegCoverageLoading(true);

    // Set preset from cache immediately for instant display, then refresh from server
    if (device.config_version) {
      const cached = presets.find(p => p.config_id === device.config_version);
      setDevicePreset(cached || null);
    } else {
      setDevicePreset(null);
    }

    // Fetch site details, logs, register coverage, and fresh preset version in parallel
    Promise.all([
      apiService.getDeviceSite(device.id)
        .then(data => setSiteDetails(data))
        .catch((err) => {
          console.error('Failed to fetch site for device', device.id, ':', err);
          setSiteDetails(null);
        }),
      fetchDeviceLogFiles(device.id),
      apiService.getRegisterCoverage(device.id)
        .then(data => setRegCoverage(data))
        .catch(() => setRegCoverage(null)),
      // Bypass cache to get the real current config version
      device.config_version
        ? apiService.getPresetFresh(device.config_version)
            .then(data => {
              const list: any[] = Array.isArray(data) ? data : (data?.results ?? []);
              const fresh = list.find((p: any) => p.config_id === device.config_version);
              if (fresh) setDevicePreset(fresh);
            })
            .catch(() => {/* keep cached value */})
        : Promise.resolve(),
    ]).finally(() => {
      setSiteLoading(false);
      setRegCoverageLoading(false);
    });
  }, [fetchDeviceLogFiles, presets]);

  useEffect(() => {
    fetchUsers();
    fetchPresets();
    fetchAlerts();
  }, [fetchAlerts]);

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

  // Heartbeat/status auto-refresh so UI reflects new device heartbeats without user action.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchDevices(currentPage, searchTerm, true);
      fetchAlerts(true);
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [currentPage, searchTerm, fetchDevices, fetchAlerts]);
  
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
    const handleClickOutside = () => {
      setShowPresetDropdown(false);
    };

    if (showPresetDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showPresetDropdown]);

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
    (_query: string) => {
      // The actual search happens via useEffect that watches currentPage and searchTerm
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

  const handleDelete = (device: any) => {
    deleteModal.openModal(device);
  };

  const handleReboot = async (device: any) => {
    rebootModal.openModal(device);
  };
  
  const confirmReboot = async () => {
    if (!rebootModal.data) return;
    try {
      await apiService.rebootDevice(rebootModal.data.id);
      const serial = rebootModal.data.device_serial;
      rebootModal.closeModal();
      setSuccessModal({ show: true, message: `Reboot command queued for ${serial}. Device will reboot on next heartbeat.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue reboot command');
      rebootModal.closeModal();
    }
  };

  const handleMuteAlerts = (device: any) => {
    muteAlertsModal.openModal(device);
  };

  const confirmMuteAlerts = async () => {
    if (!muteAlertsModal.data) return;
    const deviceId = muteAlertsModal.data.id;
    const serial = muteAlertsModal.data.device_serial;
    try {
      const result = await apiService.muteDeviceAlerts(deviceId, muteHours);
      muteAlertsModal.closeModal();
      const durationLabel = muteHours === null ? 'indefinitely' : `for ${muteHours} hour${muteHours !== 1 ? 's' : ''}`;
      setSuccessModal({ show: true, message: `Alerts muted for ${serial} ${durationLabel}.` });
      const mutedUntil = result?.alerts_muted_until ?? '9999-12-31T23:59:59Z';
      setSelectedDevice(prev => prev?.id === deviceId ? { ...prev, alerts_muted_until: mutedUntil } : prev);
      fetchDevices(currentPage, searchTerm, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mute alerts');
      muteAlertsModal.closeModal();
    }
  };

  const handleUnmuteAlerts = async (device: any) => {
    try {
      await apiService.unmuteDeviceAlerts(device.id);
      setSuccessModal({ show: true, message: `Alerts re-enabled for ${device.device_serial}.` });
      setSelectedDevice(prev => prev?.id === device.id ? ({ ...prev, alerts_muted_until: null }) as Device : prev);
      fetchDevices(currentPage, searchTerm, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unmute alerts');
    }
  };

  const handleHardReset = async (device: any) => {
    setHardResetModal({ show: true, device });
  };
  
  const confirmHardReset = async () => {
    if (!hardResetModal.device) return;
    
    try {
      await apiService.hardResetDevice(hardResetModal.device.id);
      setHardResetModal({ show: false, device: null });
      setSuccessModal({ 
        show: true, 
        message: `Hard reset command queued for ${hardResetModal.device.device_serial}. Device will reset on next heartbeat.` 
      });
    } catch (err) {
      console.error('Hard reset error:', err);
      setError(err instanceof Error ? err.message : 'Failed to queue hard reset command');
      setHardResetModal({ show: false, device: null });
    }
  };

  const handleDeleteDevice = (device: any) => {
    deleteModal.openModal(device);
  };

  const confirmDelete = async () => {
    if (!deleteModal.data) return;
    try {
      await apiService.deleteDevice(deleteModal.data.id);
      const serial = deleteModal.data.device_serial;
      deleteModal.closeModal();
      setSuccessModal({ show: true, message: `Device ${serial} has been permanently deleted.` });
      setSelectedDevice(null);
      fetchDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete device');
      deleteModal.closeModal();
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


  const handleToggleAutoReboot = async (device: any, enabled: boolean) => {
    try {
      await apiService.patchDevice(device.id, { auto_reboot_enabled: enabled });
      setSelectedDevice({ ...device, auto_reboot_enabled: enabled });
      fetchDevices();
    } catch (err) {
      console.error('Toggle auto reboot error:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle auto reboot');
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

  const handleBulkDelete = () => {
    if (selectedDevices.size === 0) {
      setError('No devices selected for deletion');
      return;
    }

    const deviceList = Array.from(selectedDevices)
      .map(id => devices.find(d => d.id === id))
      .filter(Boolean) as Device[];

    setBulkDeleteModal({ show: true, deviceList });
  };

  const confirmBulkDelete = async () => {
    try {
      setBulkDeleteLoading(true);
      await apiService.deleteDevicesBulk(Array.from(selectedDevices));

      const updatedDevices = devices.filter(d => !selectedDevices.has(d.id));
      setDevices(updatedDevices);
      setFilteredDevices(updatedDevices.filter(d =>
        d.device_serial.toLowerCase().includes(searchTerm.toLowerCase())
      ));
      setSelectedDevices(new Set());
      setBulkDeleteModal({ show: false, deviceList: [] });
      setBulkDeleteLoading(false);
    } catch (err) {
      setBulkDeleteLoading(false);
      setBulkDeleteModal({ show: false, deviceList: [] });
      console.error('Bulk delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete devices');
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
  };

  if (isMobile) return <MobileDevices />;

  if (loading) {
    return (
      <div className="admin-container responsive-page">
        <PageHeader
          icon={<Server size={20} color="white" />}
          title="Device Management"
          subtitle="Monitor and manage your IoT gateway fleet"
        />
        <div className="card">
          <div className="card-header"><h2>Devices</h2></div>
          <SkeletonDeviceList count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const getPresetConfigId = (preset: Preset): string => {
    return preset.gateway_configuration?.general_settings?.config_id || preset.config_id || '';
  };

  if (selectedDevice) {

    return (
      <div className="admin-container responsive-page">
        {/* ── Device Detail Sticky Header ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          marginBottom: '20px',
          borderRadius: '12px',
          background: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(247,255,249,0.95)',
          backdropFilter: 'blur(12px)',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,166,62,0.15)',
          boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.08)',
        }}>
          {/* Left: back + title + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <button
              onClick={handleBackToList}
              title="Back to Devices"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                color: isDark ? '#94a3b8' : '#475569',
                transition: 'background 150ms, color 150ms',
                flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }}
            >
              <ChevronLeft size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedDevice.device_serial}
              </h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0,
                padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
                background: selectedDevice.is_online ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                color: selectedDevice.is_online ? '#10b981' : '#64748b',
                border: selectedDevice.is_online ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(148,163,184,0.25)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedDevice.is_online ? '#10b981' : '#64748b', display: 'inline-block' }} />
                {selectedDevice.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Right: action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {[
              { label: 'Edit', icon: <Pencil size={14} />, onClick: () => handleEdit(selectedDevice), color: 'default', title: 'Edit device configuration' },
              { label: 'Reboot', icon: <RotateCcw size={14} />, onClick: () => handleReboot(selectedDevice), color: 'amber', title: 'Queue reboot command' },
              { label: 'Hard Reset', icon: <AlertTriangle size={14} />, onClick: () => handleHardReset(selectedDevice), color: 'amber', title: 'Queue hard reset (erases config)' },
              ...(selectedDevice.alerts_muted_until && new Date(selectedDevice.alerts_muted_until) > new Date()
                ? [{
                    label: 'Unmute',
                    icon: <Bell size={14} />,
                    onClick: () => handleUnmuteAlerts(selectedDevice),
                    color: 'default',
                    title: new Date(selectedDevice.alerts_muted_until!).getFullYear() >= 9999
                      ? 'Alerts muted indefinitely'
                      : `Alerts muted until ${new Date(selectedDevice.alerts_muted_until!).toLocaleString()}`,
                  }]
                : [{ label: 'Mute Alerts', icon: <BellOff size={14} />, onClick: () => handleMuteAlerts(selectedDevice), color: 'default', title: 'Suppress fault alerts for this device' }]),
              { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDeleteDevice(selectedDevice), color: 'red', title: 'Permanently delete device' },
            ].map(({ label, icon, onClick, color, title }) => (
              <button
                key={label}
                onClick={onClick}
                title={title}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                  padding: '5px 10px', borderRadius: 7, border: 'none', fontSize: '0.8rem', fontWeight: 500,
                  transition: 'background 150ms, color 150ms',
                  background: 'transparent',
                  color: color === 'red' ? '#ef4444' : color === 'amber' ? '#f59e0b' : isDark ? '#cbd5e1' : '#475569',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = color === 'red' ? 'rgba(239,68,68,0.1)' : color === 'amber' ? 'rgba(245,158,11,0.1)' : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
                }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Device KPI Cards ── */}
        {(() => {
          const statusPalette = {
            ok:   { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
            warn: { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
            err:  { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
          };

          const fmtHeartbeat = (ts: string | undefined): { display: string; sub: string; status: 'ok' | 'warn' | 'err' } => {
            if (!ts) return { display: 'Never', sub: '—', status: 'err' };
            const diff = (Date.now() - new Date(ts).getTime()) / 1000;
            const sub = new Date(ts).toLocaleString();
            if (diff < 300) return { display: `${Math.floor(diff / 60)}m ago`, sub, status: 'ok' };
            if (diff < 3600) return { display: `${Math.floor(diff / 60)}m ago`, sub, status: 'warn' };
            if (diff < 86400) return { display: `${Math.floor(diff / 3600)}h ago`, sub, status: 'warn' };
            return { display: `${Math.floor(diff / 86400)}d ago`, sub, status: 'err' };
          };

          const effectiveLastSeen = selectedDevice.last_seen_at || selectedDevice.last_heartbeat;
          const heartbeat = fmtHeartbeat(effectiveLastSeen);

          const configStatus = !selectedDevice.config_version
            ? { display: 'Not Configured', sub: 'No preset assigned', status: 'err' as const }
            : selectedDevice.pending_config_update
              ? { display: 'Pending', sub: `Preset: ${selectedDevice.config_version}`, status: 'warn' as const }
              : { display: 'Synced', sub: `v${selectedDevice.config_ack_ver ?? '—'} · ${selectedDevice.config_version}`, status: 'ok' as const };

          const deviceOnline = !!selectedDevice.is_online;
          const textMain = isDark ? '#f1f5f9' : '#0f172a';
          const textMute = isDark ? '#64748b' : '#94a3b8';
          const textSub  = isDark ? '#94a3b8' : '#475569';

          const kpiCards = [
            {
              label: 'Device Status',
              value: deviceOnline ? 'Online' : 'Offline',
              sub: selectedDevice.model || 'IoT Gateway',
              icon: deviceOnline ? <Wifi size={22} /> : <WifiOff size={22} />,
              status: (deviceOnline ? 'ok' : 'err') as keyof typeof statusPalette,
            },
            {
              label: 'Last Heartbeat',
              value: heartbeat.display,
              sub: heartbeat.sub,
              icon: <Clock size={22} />,
              status: heartbeat.status,
            },
            {
              label: 'Config Sync',
              value: configStatus.display,
              sub: configStatus.sub,
              icon: <Settings size={22} />,
              status: configStatus.status,
            },
            {
              label: 'Linked Site',
              value: siteDetails?.display_name || 'No Site',
              sub: siteDetails?.site_id || 'Not linked',
              icon: <MapPin size={22} />,
              status: (siteDetails ? 'ok' : 'err') as keyof typeof statusPalette,
              href:
                isStaffUser && siteDetails?.site_id
                  ? `/sites/${encodeURIComponent(siteDetails.site_id)}`
                  : undefined,
            },
          ];

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
              {kpiCards.map(({ label, value, sub, icon, status, href }) => {
                const s = statusPalette[status];
                const cardStyle: React.CSSProperties = {
                  padding: 20, borderRadius: 14, position: 'relative', overflow: 'hidden',
                  cursor: href ? 'pointer' : 'default',
                  background: isDark ? '#0f172a' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.15)'}`,
                  boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'transform 150ms, box-shadow 150ms',
                  textDecoration: 'none', color: 'inherit', display: 'block',
                };
                const inner = (
                  <>
                    <span style={{ position: 'absolute', top: -24, right: -24, width: 64, height: 64, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', display: 'block' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                        {icon}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: textSub, marginBottom: 4, fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: textMain, marginBottom: 4, lineHeight: 1.2 }}>{value}</div>
                    <div style={{ fontSize: '0.72rem', color: textMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
                    <div style={{ marginTop: 14, height: 3, width: 48, borderRadius: 999, background: s.color, opacity: 0.4 }} />
                  </>
                );
                return href ? (
                  <Link key={label} to={href} style={cardStyle}>
                    {inner}
                  </Link>
                ) : (
                  <div key={label} style={cardStyle}>
                    {inner}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── Device Alerts Panel ── */}
        {(() => {
          const selectedAlerts = activeAlertsByDevice.get(selectedDevice.device_serial) || [];
          const critical = selectedAlerts.filter(a => a.severity === 'critical').length;
          const warning = selectedAlerts.filter(a => a.severity === 'warning').length;
          const info = selectedAlerts.filter(a => a.severity === 'info').length;
          return (
            <div style={{
              marginBottom: 24,
              borderRadius: 14,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,166,62,0.15)'}`,
              background: isDark ? '#0f172a' : '#fff',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 18px',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.1)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={16} style={{ color: '#f59e0b' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isDark ? '#f1f5f9' : '#111827' }}>
                    Active Alerts
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 9px',
                    borderRadius: 999,
                    background: selectedAlerts.length > 0 ? 'rgba(245,158,11,0.15)' : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
                    color: selectedAlerts.length > 0 ? '#f59e0b' : (isDark ? '#94a3b8' : '#64748b'),
                  }}>
                    {selectedAlerts.length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {[
                    { label: 'Critical', value: critical, color: '#ef4444' },
                    { label: 'Warning', value: warning, color: '#f59e0b' },
                    { label: 'Info', value: info, color: '#3b82f6' },
                  ].map(chip => (
                    <span key={chip.label} style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: `${chip.color}1a`,
                      color: chip.color,
                      border: `1px solid ${chip.color}4d`,
                    }}>
                      {chip.label}: {chip.value}
                    </span>
                  ))}
                  <Link to="/alerts" style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: isDark ? '#93c5fd' : '#2563eb',
                    textDecoration: 'none',
                  }}>
                    Open full alerts
                  </Link>
                </div>
              </div>

              <div style={{ padding: '12px 18px 14px' }}>
                {alertsLoading ? (
                  <div style={{ fontSize: '0.85rem', color: isDark ? '#64748b' : '#94a3b8' }}>Loading alerts…</div>
                ) : selectedAlerts.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                    No active alerts for this device.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedAlerts.slice(0, 5).map(alert => (
                      <div key={`${alert.id}-${alert.timestamp}`} style={{
                        borderRadius: 10,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                        background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                        padding: '10px 12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6',
                          }}>
                            {alert.severity}
                          </span>
                          {alert.fault_code && (
                            <code style={{
                              fontSize: '0.72rem',
                              fontFamily: 'JetBrains Mono, monospace',
                              padding: '2px 6px',
                              borderRadius: 5,
                              background: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)',
                              color: '#818cf8',
                            }}>
                              {alert.fault_code}
                            </code>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: isDark ? '#64748b' : '#94a3b8' }}>
                            {new Date(alert.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.83rem', color: isDark ? '#e2e8f0' : '#1f2937', lineHeight: 1.45 }}>
                          {getAlertDisplayMessage(alert)}
                        </div>
                      </div>
                    ))}
                    {selectedAlerts.length > 5 && (
                      <div style={{ fontSize: '0.78rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                        Showing latest 5 of {selectedAlerts.length} active alerts.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Site Energy Dashboard ── */}
        {siteLoading && !siteDetails && (
          <div style={{ marginBottom: 24, padding: 24, borderRadius: 14, background: isDark ? '#0f172a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.12)'}`, display: 'flex', alignItems: 'center', gap: 10, color: isDark ? '#64748b' : '#94a3b8' }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.875rem' }}>Loading site energy data…</span>
          </div>
        )}
        {siteDetails && (
          <div style={{ marginBottom: 24 }}>
            <SiteDataPanel
              key={siteDetails.site_id}
              siteId={siteDetails.site_id}
              autoRefresh
              inverterCapacityKw={siteDetails.inverter_capacity_kw}
            />
          </div>
        )}

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h2>Device Details</h2>
          </div>
          <div style={{ padding: '20px' }}>
            {(() => {
              const effectiveLastSeen = selectedDevice.last_seen_at || selectedDevice.last_heartbeat;
              return (
            <div className="device-info-grid responsive-grid-2">
              {[
                { label: 'Status', content: (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                    background: selectedDevice.is_online ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                    color: selectedDevice.is_online ? '#10b981' : '#64748b',
                    border: selectedDevice.is_online ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(148,163,184,0.25)',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedDevice.is_online ? '#10b981' : '#64748b', display: 'inline-block' }} />
                    {selectedDevice.is_online ? 'Online' : 'Offline'}
                  </span>
                )},
                { label: 'Last Heartbeat', content: <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>{effectiveLastSeen ? new Date(effectiveLastSeen).toLocaleString() : 'Never'}</span> },
                { label: 'MAC / HW ID', content: <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#475569' }}>{selectedDevice.hw_id || '—'}</span> },
                { label: 'Model', content: <span>{selectedDevice.model || '—'}</span> },
                { label: 'Assigned User', content: <span>{selectedDevice.user || '—'}</span> },
                {
                  label: 'Connectivity',
                  content: <span>{selectedDevice.connectivity_type || 'Unknown'}</span>,
                },
                {
                  label: 'Network IP',
                  content: <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem' }}>{selectedDevice.network_ip || '—'}</span>,
                },
                {
                  label: 'Signal',
                  content: <span>{selectedDevice.signal_strength_dbm != null ? `${selectedDevice.signal_strength_dbm}%` : 'N/A'}</span>,
                },
                {
                  label: 'Device Temp',
                  content: <span>{selectedDevice.device_temp_c != null ? `${Number(selectedDevice.device_temp_c).toFixed(1)} C` : 'N/A'}</span>,
                },
                {
                  label: 'Free Heap',
                  content: <span>{selectedDevice.memory_status?.free_heap != null ? `${selectedDevice.memory_status.free_heap} bytes` : 'N/A'}</span>,
                },
                {
                  label: 'Heartbeat Health',
                  content: (
                    <span style={{ textTransform: 'capitalize' }}>
                      {selectedDevice.heartbeat_health?.severity || (selectedDevice.is_online ? 'ok' : 'critical')}
                      {selectedDevice.heartbeat_health?.issues?.length ? ` (${selectedDevice.heartbeat_health.issues.join(', ')})` : ''}
                    </span>
                  ),
                },
              ].map(({ label, content }) => (
                <div key={label}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? '#64748b' : '#94a3b8', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b' }}>{content}</div>
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1', padding: '15px', backgroundColor: 'transparent', borderRadius: '8px', border: isDark ? '1px solid #404040' : '1px solid rgba(0, 0, 0, 0.1)' }} className="config-sync-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: 'inherit' }} className="config-heading">Configuration</strong>
                    {devicePreset && (
                      <div style={{ fontSize: '0.875rem', color: isDark ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)', marginTop: '2px' }} className="config-label">
                        {devicePreset.name || selectedDevice.config_version}
                      </div>
                    )}
                  </div>
                  {!selectedDevice.config_version ? (
                    <span style={{ color: isDark ? '#a0a0a0' : 'rgba(0, 0, 0, 0.5)', fontSize: '0.875rem' }} className="config-no-preset">No preset assigned</span>
                  ) : selectedDevice.pending_config_update ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '500',
                      backgroundColor: '#fef9c3', color: '#854d0e'
                    }}>⏳ Pending update</span>
                  ) : (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '500',
                      backgroundColor: '#dcfce7', color: '#166534'
                    }}>✓ Synced</span>
                  )}
                </div>
                {selectedDevice.config_version && (
                  <div className="device-info-grid responsive-grid-2">
                    <div style={{ padding: '8px', backgroundColor: isDark ? '#242424' : 'rgba(0, 0, 0, 0.05)', borderRadius: '6px', border: isDark ? '1px solid #404040' : '1px solid rgba(0, 0, 0, 0.1)' }} className="config-info-box">
                      <div style={{ color: isDark ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)', marginBottom: '2px' }} className="config-label">Preset ID</div>
                      <div style={{ fontWeight: '500', fontFamily: 'monospace', color: 'inherit' }}>{selectedDevice.config_version}</div>
                    </div>
                    {devicePreset?.slaves_count != null && (
                      <div style={{ padding: '8px', backgroundColor: isDark ? '#242424' : 'rgba(0, 0, 0, 0.05)', borderRadius: '6px', border: isDark ? '1px solid #404040' : '1px solid rgba(0, 0, 0, 0.1)' }} className="config-info-box">
                        <div style={{ color: isDark ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)', marginBottom: '2px' }} className="config-label">Slaves</div>
                        <div style={{ fontWeight: '500', color: 'inherit' }}>{devicePreset.slaves_count} device{devicePreset.slaves_count !== 1 ? 's' : ''}</div>
                      </div>
                    )}
                    {selectedDevice.config_ack_ver != null && devicePreset?.version != null && (
                      <div style={{ 
                        padding: '8px', 
                        backgroundColor: isDark ? '#242424' : 'rgba(0, 0, 0, 0.05)', 
                        borderRadius: '6px',
                        gridColumn: '1 / -1',
                        border: selectedDevice.config_ack_ver === devicePreset.version ? '2px solid #dcfce7' : '2px solid #fef9c3'
                      }} className="config-info-box">
                        <div style={{ color: isDark ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)', marginBottom: '4px' }} className="config-label">Version Status</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: isDark ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)' }} className="config-label">Device: </span>
                            <span style={{ fontWeight: '500', fontFamily: 'monospace', color: 'inherit' }}>v{selectedDevice.config_ack_ver}</span>
                            <span style={{ margin: '0 8px', color: isDark ? '#808080' : 'rgba(0, 0, 0, 0.4)' }} className="config-arrow">→</span>
                            <span style={{ fontSize: '0.75rem', color: isDark ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)' }} className="config-label">Latest: </span>
                            <span style={{ fontWeight: '500', fontFamily: 'monospace', color: 'inherit' }}>v{devicePreset.version}</span>
                          </div>
                          {selectedDevice.config_ack_ver === devicePreset.version ? (
                            <span style={{ color: '#166534', fontSize: '0.75rem', fontWeight: '500' }}>✓ Up to date</span>
                          ) : (
                            <span style={{ color: '#854d0e', fontSize: '0.75rem', fontWeight: '500' }}>⟳ Update available</span>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedDevice.config_ack_ver != null && devicePreset?.version == null && (
                      <div style={{ padding: '8px', backgroundColor: isDark ? '#242424' : 'rgba(0, 0, 0, 0.05)', borderRadius: '6px', border: isDark ? '1px solid #404040' : '1px solid rgba(0, 0, 0, 0.1)' }} className="config-info-box">
                        <div style={{ color: isDark ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)', marginBottom: '2px' }} className="config-label">Device Version</div>
                        <div style={{ fontWeight: '500', fontFamily: 'monospace', color: 'inherit' }}>v{selectedDevice.config_ack_ver}</div>
                      </div>
                    )}
                    {devicePreset?.gateway_configuration?.general_settings?.last_updated && (
                      <div style={{ padding: '8px', backgroundColor: isDark ? '#242424' : 'rgba(0, 0, 0, 0.05)', borderRadius: '6px', border: isDark ? '1px solid #404040' : '1px solid rgba(0, 0, 0, 0.1)' }} className="config-info-box">
                        <div style={{ color: isDark ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)', marginBottom: '2px' }} className="config-label">Last Modified</div>
                        <div style={{ fontWeight: '500', fontSize: '0.75rem', color: 'inherit' }}>
                          {new Date(devicePreset.gateway_configuration.general_settings.last_updated).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {selectedDevice.config_acked_at && (
                      <div style={{ padding: '8px', backgroundColor: isDark ? '#242424' : 'rgba(0, 0, 0, 0.05)', borderRadius: '6px', border: isDark ? '1px solid #404040' : '1px solid rgba(0, 0, 0, 0.1)', gridColumn: '1 / -1' }} className="config-info-box">
                        <div style={{ color: isDark ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)', marginBottom: '2px' }} className="config-label">Last Synced</div>
                        <div style={{ fontWeight: '500', fontSize: '0.75rem', color: 'inherit' }}>
                          {new Date(selectedDevice.config_acked_at).toLocaleString()}
                          {(() => {
                            const ackTime = new Date(selectedDevice.config_acked_at);
                            const now = new Date();
                            const diffMs = now.getTime() - ackTime.getTime();
                            const diffMins = Math.floor(diffMs / 60000);
                            const diffHours = Math.floor(diffMins / 60);
                            const diffDays = Math.floor(diffHours / 24);
                            if (diffMins < 1) return ' • just now';
                            if (diffMins < 60) return ` • ${diffMins}m ago`;
                            if (diffHours < 24) return ` • ${diffHours}h ago`;
                            return ` • ${diffDays}d ago`;
                          })()}
                        </div>
                      </div>
                    )}
                    {selectedDevice.config_downloaded_at && selectedDevice.config_acked_at && (
                      <div style={{ padding: '8px', backgroundColor: isDark ? '#242424' : 'rgba(0, 0, 0, 0.05)', borderRadius: '6px', border: isDark ? '1px solid #404040' : '1px solid rgba(0, 0, 0, 0.1)', gridColumn: '1 / -1' }} className="config-info-box">
                        <div style={{ color: isDark ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)', marginBottom: '2px' }} className="config-label">Apply Duration</div>
                        <div style={{ fontWeight: '500', color: 'inherit' }}>
                          {Math.round((new Date(selectedDevice.config_acked_at).getTime() - new Date(selectedDevice.config_downloaded_at).getTime()) / 1000)} seconds
                          <span style={{ color: isDark ? '#a0a0a0' : 'rgba(0, 0, 0, 0.5)', marginLeft: '8px', fontSize: '0.75rem' }} className="config-label">
                            (download → acknowledge)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? '#64748b' : '#94a3b8', marginBottom: 4 }}>Provisioned At</div>
                <div style={{ fontSize: '0.9rem', fontFamily: 'JetBrains Mono, monospace', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                  {selectedDevice.provisioned_at ? new Date(selectedDevice.provisioned_at).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? '#64748b' : '#94a3b8', marginBottom: 4 }}>Created By</div>
                <div style={{ fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b' }}>{selectedDevice.created_by_username || '—'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedDevice.logs_enabled || false}
                    onChange={(e) => handleToggleLogs(selectedDevice, e.target.checked)}
                    style={{ background: isDark ? '#1a1a1a' : 'white', border: isDark ? '1px solid #404040' : '1px solid #ced4da' }}
                  />
                  <strong>Enable Device Logs</strong>
                  <span style={{ fontSize: '0.875rem', color: isDark ? '#b0b0b0' : '#9ca3af' }}>
                    (Device will send logs when enabled)
                  </span>
                </label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedDevice.auto_reboot_enabled || false}
                    onChange={(e) => handleToggleAutoReboot(selectedDevice, e.target.checked)}
                    style={{ background: isDark ? '#1a1a1a' : 'white', border: isDark ? '1px solid #404040' : '1px solid #ced4da' }}
                  />
                  <strong>Auto Reboot</strong>
                  <span style={{ fontSize: '0.875rem', color: isDark ? '#b0b0b0' : '#9ca3af' }}>
                    (Automatically reboot device when RS-485 registers freeze)
                  </span>
                </label>
              </div>
            </div>
              );
            })()}
          </div>
        </div>

        {/* ── Register Coverage ── */}
        <div style={{
          marginTop: 24,
          borderRadius: 14,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,166,62,0.15)'}`,
          background: isDark ? '#0f172a' : '#fff',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <button
            onClick={() => setRegCoverageExpanded(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: regCoverageExpanded ? `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.1)'}` : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={16} style={{ color: '#22c55e' }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isDark ? '#f1f5f9' : '#111827', fontFamily: 'Poppins, sans-serif' }}>
                Register Coverage
              </span>
              {regCoverage && !regCoverageLoading && (
                <span style={{
                  padding: '2px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
                  background: regCoverage.coverage_pct >= 80
                    ? 'rgba(34,197,94,0.15)' : regCoverage.coverage_pct >= 50
                    ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
                  color: regCoverage.coverage_pct >= 80 ? '#22c55e' : regCoverage.coverage_pct >= 50 ? '#f59e0b' : '#ef4444',
                  border: `1px solid ${regCoverage.coverage_pct >= 80 ? 'rgba(34,197,94,0.3)' : regCoverage.coverage_pct >= 50 ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  {regCoverage.coverage_pct}%
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {regCoverage && !regCoverageLoading && (
                <span style={{ fontSize: '0.78rem', color: isDark ? '#64748b' : '#94a3b8', fontFamily: 'Fira Code, JetBrains Mono, monospace' }}>
                  {regCoverage.total_received} / {regCoverage.total_configured} registers
                </span>
              )}
              {regCoverageExpanded
                ? <ChevronDown size={16} style={{ color: isDark ? '#64748b' : '#94a3b8', transition: 'transform 200ms' }} />
                : <ChevronRight size={16} style={{ color: isDark ? '#64748b' : '#94a3b8', transition: 'transform 200ms' }} />
              }
            </div>
          </button>

          {regCoverageExpanded && (
            <div style={{ padding: '0 0 8px' }}>
              {regCoverageLoading ? (
                /* Skeleton */
                <div style={{ padding: '20px 20px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: 14, borderRadius: 6, marginBottom: 10,
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      width: i === 2 ? '60%' : i === 3 ? '80%' : '100%',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                  ))}
                </div>
              ) : !regCoverage ? (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.85rem' }}>
                  No telemetry data available yet.
                </div>
              ) : (
                <>
                  {/* Summary bar */}
                  <div style={{ padding: '12px 20px 8px', display: 'flex', gap: 20, flexWrap: 'wrap', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                    {[
                      { label: 'Configured', value: regCoverage.total_configured, color: isDark ? '#94a3b8' : '#64748b' },
                      { label: 'Received', value: regCoverage.total_received, color: '#22c55e' },
                      { label: 'Missing', value: regCoverage.total_configured - regCoverage.total_received, color: '#ef4444' },
                      { label: 'Last sample', value: new Date(regCoverage.last_telemetry_at).toLocaleTimeString(), color: isDark ? '#94a3b8' : '#64748b' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? '#475569' : '#94a3b8' }}>{label}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color, fontFamily: 'Fira Code, JetBrains Mono, monospace' }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Coverage bar */}
                  <div style={{ padding: '10px 20px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                    <div style={{ height: 6, borderRadius: 99, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99, transition: 'width 600ms ease',
                        width: `${regCoverage.coverage_pct}%`,
                        background: regCoverage.coverage_pct >= 80 ? '#22c55e' : regCoverage.coverage_pct >= 50 ? '#f59e0b' : '#ef4444',
                      }} />
                    </div>
                  </div>

                  {/* Slave sections */}
                  {regCoverage.slaves.map((slave: any) => (
                    <SlaveRegisterSection key={slave.slave_id} slave={slave} isDark={isDark} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Session Logs ── */}
        <div className="card" style={{ marginTop: '48px', marginBottom: '20px' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ScrollText size={16} style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
              <h2 style={{ margin: 0 }}>Session Logs</h2>
              {logFilesTotal > 0 && (
                <span style={{ fontSize: '0.75rem', color: isDark ? '#64748b' : '#94a3b8' }}>{logFilesTotal} files</span>
              )}
            </div>
            <button onClick={() => fetchDeviceLogFiles(selectedDevice.id, 0, fileFilterFrom || undefined, fileFilterTo || undefined)} disabled={logFilesLoading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', background: 'transparent', color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.8rem', fontWeight: 500, cursor: logFilesLoading ? 'not-allowed' : 'pointer', opacity: logFilesLoading ? 0.6 : 1 }}>
              <RefreshCw size={13} style={{ animation: logFilesLoading ? 'spin 1s linear infinite' : 'none' }} />
              {logFilesLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
            {!selectedDevice.logs_enabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)', marginBottom: 12 }}>
                <Info size={15} style={{ color: '#94a3b8', flexShrink: 0 }} />
                <p style={{ margin: 0, color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.875rem', fontStyle: 'italic' }}>
                  Logging is disabled. Enable it in Device Details to receive logs.
                </p>
              </div>
            )}
            {/* Date filter + fetch + bulk download */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <input type="datetime-local" value={fileFilterFrom} onChange={e => setFileFilterFrom(e.target.value)} title="From (IST)"
                style={{ padding: '6px 10px', borderRadius: 7, fontSize: '0.82rem', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)', background: isDark ? '#1a1a1a' : '#f8fafc', color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none' }} />
              <input type="datetime-local" value={fileFilterTo} onChange={e => setFileFilterTo(e.target.value)} title="To (IST)"
                style={{ padding: '6px 10px', borderRadius: 7, fontSize: '0.82rem', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)', background: isDark ? '#1a1a1a' : '#f8fafc', color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none' }} />
              <button onClick={() => {
                const toIST = (v: string) => v ? new Date(v + ':00+05:30').toISOString() : undefined;
                setLogFilesPage(0);
                fetchDeviceLogFiles(selectedDevice.id, 0, toIST(fileFilterFrom), toIST(fileFilterTo));
              }} disabled={logFilesLoading}
                style={{ padding: '6px 14px', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600, cursor: logFilesLoading ? 'not-allowed' : 'pointer', border: 'none', background: '#3b82f6', color: '#fff', opacity: logFilesLoading ? 0.6 : 1 }}>
                Fetch
              </button>
              <button onClick={handleBulkDownload} disabled={bulkDownloading || logFilesTotal === 0}
                title="Download all files in the selected range as a single .txt"
                style={{ padding: '6px 14px', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600, cursor: (bulkDownloading || logFilesTotal === 0) ? 'not-allowed' : 'pointer', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)', background: 'transparent', color: isDark ? '#94a3b8' : '#64748b', opacity: (bulkDownloading || logFilesTotal === 0) ? 0.5 : 1 }}>
                {bulkDownloading ? 'Downloading…' : 'Download All'}
              </button>
            </div>

            {logFilesLoading && <p style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.875rem', margin: 0 }}>Loading…</p>}
            {!logFilesLoading && deviceLogFiles.length === 0 && (
              <p style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.875rem', margin: 0 }}>No log files found.</p>
            )}

            {deviceLogFiles.length > 0 && (
              <>
                <div style={{ borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                        {['Filename', 'Size', 'Uploaded', ''].map(h => (
                          <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deviceLogFiles.map((f: any) => (
                        <tr key={f.id} style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                          <td style={{ padding: '8px 14px', color: isDark ? '#e2e8f0' : '#1e293b', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>{f.filename}</td>
                          <td style={{ padding: '8px 14px', color: isDark ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}>{(f.file_size / 1024).toFixed(1)} KB</td>
                          <td style={{ padding: '8px 14px', color: isDark ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}>{new Date(f.uploaded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                          <td style={{ padding: '8px 14px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => handleViewLogFile(f.id, f.filename)}
                                style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: '#3b82f6', color: '#fff' }}>
                                View
                              </button>
                              <button onClick={() => handleDownloadLogFile(f.id)}
                                style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)', background: 'transparent', color: isDark ? '#94a3b8' : '#64748b' }}>
                                Download
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logFilesTotal > LOG_FILES_PAGE_SIZE && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: '0.8rem', color: isDark ? '#64748b' : '#94a3b8' }}>
                      {logFilesPage * LOG_FILES_PAGE_SIZE + 1}–{Math.min((logFilesPage + 1) * LOG_FILES_PAGE_SIZE, logFilesTotal)} of {logFilesTotal}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => fetchDeviceLogFiles(selectedDevice.id, logFilesPage - 1, fileFilterFrom || undefined, fileFilterTo || undefined)}
                        disabled={logFilesPage === 0 || logFilesLoading}
                        style={{ padding: '5px 12px', borderRadius: 7, fontSize: '0.8rem', cursor: logFilesPage === 0 ? 'not-allowed' : 'pointer', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)', background: 'transparent', color: isDark ? '#94a3b8' : '#64748b', opacity: logFilesPage === 0 ? 0.4 : 1 }}>
                        ← Prev
                      </button>
                      <button
                        onClick={() => fetchDeviceLogFiles(selectedDevice.id, logFilesPage + 1, fileFilterFrom || undefined, fileFilterTo || undefined)}
                        disabled={(logFilesPage + 1) * LOG_FILES_PAGE_SIZE >= logFilesTotal || logFilesLoading}
                        style={{ padding: '5px 12px', borderRadius: 7, fontSize: '0.8rem', cursor: (logFilesPage + 1) * LOG_FILES_PAGE_SIZE >= logFilesTotal ? 'not-allowed' : 'pointer', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)', background: 'transparent', color: isDark ? '#94a3b8' : '#64748b', opacity: (logFilesPage + 1) * LOG_FILES_PAGE_SIZE >= logFilesTotal ? 0.4 : 1 }}>
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {/* ── Site edit modal removed (moved to /sites tab) ── */}
        {/* false && editingSite && ReactDOM.createPortal(
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }} onClick={() => setEditingSite(false)}>
            <div style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
              borderRadius: 16,
              boxShadow: isDark
                ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
                : '0 25px 50px -12px rgba(0,0,0,0.25)',
              maxWidth: '640px', width: '100%',
              maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }} onClick={e => e.stopPropagation()}>
              Header
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
                    <MapPin size={22} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                      {siteDetails ? 'Edit Site' : 'Add Site'}
                    </div>
                    <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                      Configure solar site parameters
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setEditingSite(false)} style={{
                  width: 40, height: 40, borderRadius: 10, border: 'none',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setSiteSaving(true);
                setSiteError(null);
                try {
                  const selectedId = selectedDevice?.id;
                  if (!selectedId) {
                    throw new Error('No device selected');
                  }
                  const payload = {
                    site_id: siteForm.site_id.trim(),
                    display_name: siteForm.display_name.trim(),
                    latitude: parseFloat(siteForm.latitude),
                    longitude: parseFloat(siteForm.longitude),
                    capacity_kw: parseFloat(siteForm.capacity_kw),
                    inverter_capacity_kw: siteForm.inverter_capacity_kw !== '' ? parseFloat(siteForm.inverter_capacity_kw) : null,
                    tilt_deg: parseFloat(siteForm.tilt_deg),
                    azimuth_deg: parseFloat(siteForm.azimuth_deg),
                    timezone: siteForm.timezone.trim(),
                    is_active: siteForm.is_active,
                    deye_station_id: siteForm.deye_station_id !== '' ? parseInt(siteForm.deye_station_id, 10) : null,
                    logger_serial: siteForm.logger_serial.trim() !== '' ? siteForm.logger_serial.trim() : null,
                  };

                  let updated;
                  if (siteDetails) {
                    updated = await apiService.updateDeviceSite(selectedId, payload);
                  } else {
                    updated = await apiService.createDeviceSite(selectedId, payload);
                  }

                  if (!updated || !updated.site_id) {
                    throw new Error('Invalid response from server — site data missing');
                  }

                  setSiteDetails(updated);
                  setEditingSite(false);
                  setSiteSaving(false);

                  // Re-fetch after creation to get server-assigned fields
                  if (!siteDetails) {
                    setTimeout(() => {
                      apiService.getDeviceSite(selectedId)
                        .then(data => { if (data) setSiteDetails(data); })
                        .catch(err => console.error('Failed to re-fetch site:', err));
                    }, 500);
                  }
                } catch (err: any) {
                  setSiteError(err.message || 'Failed to save site');
                  setSiteSaving(false);
                }
              }} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                Scrollable body
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                  {siteError && (
                    <p style={{ color: isDark ? '#fca5a5' : '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>{siteError}</p>
                  )}

                  Identification
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                        Identification
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Site ID *</label>
                        <input
                          type="text"
                          required
                          value={siteForm.site_id}
                          disabled={!!siteDetails}
                          onChange={e => setSiteForm({ ...siteForm, site_id: e.target.value })}
                          placeholder="e.g. site_mumbai_01"
                          autoComplete="off"
                          style={{
                            padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                            background: isDark ? '#2a2a2a' : '#ffffff',
                            color: isDark ? '#f3f4f6' : '#111827',
                            fontSize: '0.875rem',
                          }}
                        />
                        {!!siteDetails && <small className="form-hint">Site ID cannot be changed after creation.</small>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Display Name</label>
                        <input
                          type="text"
                          value={siteForm.display_name}
                          onChange={e => setSiteForm({ ...siteForm, display_name: e.target.value })}
                          placeholder="e.g. Mumbai Rooftop"
                          autoComplete="off"
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

                  Location
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                        Location
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Latitude *</label>
                        <input
                          type="number"
                          required
                          step="any"
                          value={siteForm.latitude}
                          onChange={e => setSiteForm({ ...siteForm, latitude: e.target.value })}
                          placeholder="19.0760"
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
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Longitude *</label>
                        <input
                          type="number"
                          required
                          step="any"
                          value={siteForm.longitude}
                          onChange={e => setSiteForm({ ...siteForm, longitude: e.target.value })}
                          placeholder="72.8777"
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
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Timezone</label>
                        <input
                          type="text"
                          value={siteForm.timezone}
                          onChange={e => setSiteForm({ ...siteForm, timezone: e.target.value })}
                          placeholder="Asia/Kolkata"
                          autoComplete="off"
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

                  Panel Configuration
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                        Panel Configuration
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>PV Capacity (kW) *</label>
                        <input
                          type="number"
                          required
                          step="any"
                          value={siteForm.capacity_kw}
                          onChange={e => setSiteForm({ ...siteForm, capacity_kw: e.target.value })}
                          placeholder="5.0"
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
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Inverter Capacity (kW)</label>
                        <input
                          type="number"
                          step="any"
                          value={siteForm.inverter_capacity_kw}
                          onChange={e => setSiteForm({ ...siteForm, inverter_capacity_kw: e.target.value })}
                          placeholder="5.0"
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
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Tilt (°)</label>
                        <input
                          type="number"
                          step="any"
                          value={siteForm.tilt_deg}
                          onChange={e => setSiteForm({ ...siteForm, tilt_deg: e.target.value })}
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
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Azimuth (°)</label>
                        <input
                          type="number"
                          step="any"
                          value={siteForm.azimuth_deg}
                          onChange={e => setSiteForm({ ...siteForm, azimuth_deg: e.target.value })}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                        <input
                          type="checkbox"
                          id="dev-site-active"
                          checked={siteForm.is_active}
                          onChange={e => setSiteForm({ ...siteForm, is_active: e.target.checked })}
                          style={{ width: '16px', height: '16px' }}
                        />
                        Active
                      </label>
                    </div>
                  </div>
                </div>

                Deye Cloud Logger
                <div style={{ padding: '0 28px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #06b6d4, #0891b2)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#67e8f9' : '#0891b2' }}>
                      Deye Cloud
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Station ID</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={siteForm.deye_station_id}
                        onChange={e => setSiteForm({ ...siteForm, deye_station_id: e.target.value })}
                        placeholder="e.g. 12616"
                        style={{
                          padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          background: isDark ? '#2a2a2a' : '#ffffff',
                          color: isDark ? '#f3f4f6' : '#111827',
                          fontSize: '0.875rem',
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: isDark ? '#64748b' : '#9ca3af' }}>
                        Deye Cloud portal → Station settings.
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Logger Serial</label>
                      <input
                        type="text"
                        value={siteForm.logger_serial}
                        onChange={e => setSiteForm({ ...siteForm, logger_serial: e.target.value })}
                        placeholder="e.g. 2509273375"
                        style={{
                          padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          background: isDark ? '#2a2a2a' : '#ffffff',
                          color: isDark ? '#f3f4f6' : '#111827',
                          fontSize: '0.875rem',
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: isDark ? '#64748b' : '#9ca3af' }}>
                        SolarmanV5/LSW3 serial printed on the dongle.
                      </span>
                    </div>
                  </div>
                </div>

                Footer
                <div style={{
                  display: 'flex', gap: 10, justifyContent: 'flex-end',
                  padding: '16px 28px',
                  borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  flexShrink: 0,
                }}>
                  <button type="button" onClick={() => setEditingSite(false)} disabled={siteSaving} style={{
                    padding: '10px 20px', borderRadius: 8,
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                    color: isDark ? '#d1d5db' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  }}>Cancel</button>
                  <button type="submit" disabled={siteSaving} style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                  }}>
                    {siteSaving ? 'Saving…' : siteDetails ? 'Save Changes' : 'Add Site'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        */}

        {editingDevice && ReactDOM.createPortal(
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }} onClick={() => setEditingDevice(null)}>
            <div style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
              borderRadius: 16,
              boxShadow: isDark
                ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
                : '0 25px 50px -12px rgba(0,0,0,0.25)',
              maxWidth: '640px', width: '100%',
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
                      Edit Device: {editingDevice.device_serial}
                    </div>
                    <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                      Update device configuration
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setEditingDevice(null)} style={{
                  width: 40, height: 40, borderRadius: 10, border: 'none',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); editingDevice ? handleSave() : handleCreate(); }} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                {/* Scrollable body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

                  {/* Device Identity */}
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                        Device Identity
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Device Serial Number</label>
                        <input
                          type="text"
                          value={editingDevice ? editForm.device_serial : createForm.device_serial}
                          onChange={(e) => editingDevice ? setEditForm({...editForm, device_serial: e.target.value}) : setCreateForm({...createForm, device_serial: e.target.value})}
                          required
                          autoComplete="off"
                          placeholder="SN-12345678"
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

                  {/* Ownership */}
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                        Ownership &amp; Assignment
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Assigned User</label>
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
                            style={{
                              padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                              background: isDark ? '#2a2a2a' : '#ffffff',
                              color: isDark ? '#f3f4f6' : '#111827',
                              fontSize: '0.875rem',
                            }}
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
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                        Configuration
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Preset Template</label>
                        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            placeholder={presetsLoading ? 'Loading presets…' : 'Search presets…'}
                            value={presetSearch}
                            onChange={(e) => { setPresetSearch(e.target.value); setShowPresetDropdown(true); }}
                            onFocus={() => setShowPresetDropdown(true)}
                            autoComplete="off"
                            className="full-width"
                            style={{
                              padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                              background: isDark ? '#2a2a2a' : '#ffffff',
                              color: isDark ? '#f3f4f6' : '#111827',
                              fontSize: '0.875rem',
                            }}
                          />
                          {showPresetDropdown && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary, #1e293b)', border: '1px solid var(--border-color, rgba(148,163,184,0.2))', borderRadius: '6px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                              <div
                                onClick={() => { if (editingDevice) setEditForm({ ...editForm, config_version: '' }); else setCreateForm({ ...createForm, config_version: '' }); setPresetSearch(''); setShowPresetDropdown(false); }}
                                style={{ padding: '10px 14px', cursor: 'pointer', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.875rem', borderBottom: '1px solid var(--border-color, rgba(148,163,184,0.1))' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >— Manual Configuration —</div>
                              {presets.filter(p => !presetSearch.trim() || p.name.toLowerCase().includes(presetSearch.toLowerCase()) || (getPresetConfigId(p) || '').toLowerCase().includes(presetSearch.toLowerCase())).map((preset) => (
                                <div
                                  key={preset.id}
                                  onClick={() => { const cid = getPresetConfigId(preset); if (editingDevice) setEditForm({ ...editForm, config_version: cid }); else setCreateForm({ ...createForm, config_version: cid }); setPresetSearch(preset.name); setShowPresetDropdown(false); }}
                                  style={{ padding: '10px 14px', cursor: 'pointer', background: (editingDevice ? editForm.config_version : createForm.config_version) === getPresetConfigId(preset) ? 'rgba(99,102,241,0.15)' : 'transparent', color: 'var(--text-primary, #f8fafc)', fontSize: '0.875rem', borderBottom: '1px solid var(--border-color, rgba(148,163,184,0.1))' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = (editingDevice ? editForm.config_version : createForm.config_version) === getPresetConfigId(preset) ? 'rgba(99,102,241,0.15)' : 'transparent'}
                                >
                                  {preset.name} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>({getPresetConfigId(preset) || 'no ID'})</span>
                                </div>
                              ))}
                              {!presetsLoading && presets.filter(p => !presetSearch.trim() || p.name.toLowerCase().includes(presetSearch.toLowerCase()) || (getPresetConfigId(p) || '').toLowerCase().includes(presetSearch.toLowerCase())).length === 0 && (
                                <div style={{ padding: '10px 14px', color: 'var(--text-muted, #64748b)', fontSize: '0.875rem' }}>No presets match</div>
                              )}
                            </div>
                          )}
                        </div>
                        <small className="form-hint">Selecting a preset sets the Config Version ID below.</small>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Config Version ID</label>
                        <input
                          type="text"
                          value={editingDevice ? editForm.config_version : createForm.config_version}
                          onChange={(e) => editingDevice ? setEditForm({...editForm, config_version: e.target.value}) : setCreateForm({...createForm, config_version: e.target.value})}
                          autoComplete="off"
                          placeholder="Manual Config ID"
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

                  {editingDevice && (
                    <AuditTrail
                      createdBy={editingDevice.created_by_username}
                      createdAt={editingDevice.created_at}
                      updatedBy={editingDevice.updated_by_username}
                      updatedAt={editingDevice.updated_at}
                    />
                  )}
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
                  }}>
                    {editingDevice ? 'Save Changes' : 'Create Device'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Modern Reboot Confirmation Modal */}
        <AccessibleModal
          open={rebootModal.open}
          onClose={rebootModal.closeModal}
          title="Confirm Reboot"
          id="reboot-modal-title"
        >
          {rebootModal.data && (
            <div className="modal-reboot-content">
              <p className="modal-reboot-message">
                Are you sure you want to reboot device <strong>{rebootModal.data.device_serial}</strong>?
              </p>
              <div className="modal-warning-box modal-reboot-note">
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Info size={16} strokeWidth={2} /> Note:</strong> The device will restart on its next heartbeat. Any unsaved data may be lost.
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={rebootModal.closeModal}>Cancel</button>
                <button type="button" className="btn-primary" onClick={confirmReboot}>Confirm Reboot</button>
              </div>
            </div>
          )}
        </AccessibleModal>

        {/* Mute Alerts Modal */}
        <AccessibleModal
          open={muteAlertsModal.open}
          onClose={muteAlertsModal.closeModal}
          title="Mute Alerts"
          id="mute-alerts-modal-title"
        >
          {muteAlertsModal.data && (
            <div className="modal-reboot-content">
              <p className="modal-reboot-message">
                Suppress fault alert creation for <strong>{muteAlertsModal.data.device_serial}</strong>. Select duration:
              </p>
              <div className="mute-duration-pills">
                {([1, 2, 4, 8, 24, 72, null] as (number | null)[]).map(h => (
                  <button
                    key={h ?? 'indefinite'}
                    type="button"
                    onClick={() => setMuteHours(h)}
                    className={`mute-duration-pill${muteHours === h ? ' mute-duration-pill--selected' : ''}`}
                  >
                    {h === null ? 'Indefinitely' : `${h}h`}
                  </button>
                ))}
              </div>
              <div className="modal-warning-box modal-reboot-note">
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Info size={16} strokeWidth={2} /> Note:</strong> Existing active alerts are unaffected. Faults will still auto-resolve when conditions clear.
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={muteAlertsModal.closeModal}>Cancel</button>
                <button type="button" className="btn-primary" onClick={confirmMuteAlerts}>
                  {muteHours === null ? 'Mute Indefinitely' : `Mute for ${muteHours}h`}
                </button>
              </div>
            </div>
          )}
        </AccessibleModal>

        {/* Modern Hard Reset Confirmation Modal */}
        {hardResetModal.show && hardResetModal.device && ReactDOM.createPortal(
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }}>
            <div style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
              borderRadius: 16,
              boxShadow: isDark
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxWidth: '480px', width: '100%', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #dc3545, #c82333)',
                    boxShadow: '0 4px 14px rgba(220,53,69,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <AlertTriangle size={22} color="white" />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>Hard Reset Warning</span>
                </div>
                <button
                  onClick={() => setHardResetModal({ show: false, device: null })}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: 'none',
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    color: isDark ? '#9ca3af' : '#6b7280',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: '20px 24px' }}>
                <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 16 }}>
                  Device to reset: <strong style={{ color: isDark ? '#f9fafb' : '#111827' }}>{hardResetModal.device.device_serial}</strong>
                </p>
                <div style={{
                  background: isDark ? 'rgba(220,53,69,0.12)' : '#f8d7da',
                  border: isDark ? '1px solid rgba(220,53,69,0.25)' : '1px solid #f5c6cb',
                  borderRadius: 8, padding: '12px 14px', fontSize: '0.875rem',
                  color: isDark ? '#fca5a5' : '#721c24',
                }}>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><AlertTriangle size={15} /> CRITICAL WARNING</strong>
                  <p style={{ margin: '6px 0 0 0' }}>
                    This action will <strong>erase all device configuration</strong> and restart the device to factory settings.
                  </p>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '1.25rem' }}>
                    <li>All configuration will be lost</li>
                    <li>Device will return to factory defaults</li>
                    <li>Re-provisioning will be required</li>
                  </ul>
                </div>
              </div>
              <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setHardResetModal({ show: false, device: null })}
                  style={{
                    padding: '10px 18px', borderRadius: 8,
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                    color: isDark ? '#d1d5db' : '#374151',
                    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmHardReset}
                  style={{
                    padding: '10px 18px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #dc3545, #c82333)',
                    color: 'white', fontSize: '0.875rem', fontWeight: 600,
                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,53,69,0.35)',
                  }}
                >
                  Yes, Hard Reset
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        <AccessibleModal
          open={deleteModal.open}
          onClose={deleteModal.closeModal}
          title="Delete Device Permanently"
          id="delete-modal-title"
        >
          {deleteModal.data && (
            <div className="modal-delete-content">
              <div className="modal-warning-box">
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><AlertTriangle size={18} strokeWidth={2} /> PERMANENT DELETION</strong>
                <p>This action cannot be undone. All device data will be permanently deleted.</p>
              </div>
              <p>Device to delete: <strong>{deleteModal.data.device_serial}</strong></p>
              <ul className="modal-consequences-list">
                <li>All telemetry data will be lost</li>
                <li>All command history will be deleted</li>
                <li>Device must be re-provisioned to use again</li>
              </ul>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={deleteModal.closeModal}>Cancel</button>
                <button type="button" className="btn-danger" onClick={confirmDelete}>Yes, Delete Permanently</button>
              </div>
            </div>
          )}
        </AccessibleModal>

        {/* Modern Success Notification Modal */}
        {successModal.show && ReactDOM.createPortal(
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }}>
            <div style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
              borderRadius: 16,
              boxShadow: isDark
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxWidth: '480px', width: '100%', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckCircle2 size={22} color="white" />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>Command Queued</span>
                </div>
                <button
                  onClick={() => setSuccessModal({ show: false, message: '' })}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: 'none',
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    color: isDark ? '#9ca3af' : '#6b7280',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: '20px 24px' }}>
                <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 16 }}>
                  {successModal.message}
                </p>
              </div>
              <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSuccessModal({ show: false, message: '' })}
                  style={{
                    padding: '10px 18px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white', fontSize: '0.875rem', fontWeight: 600,
                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
                  }}
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Log file viewer modal ── */}
        {viewingFileId !== null && ReactDOM.createPortal(
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}
            onClick={() => { setViewingFileContent(null); setViewingFileId(null); setViewingFileName(''); }}
          >
            <div
              style={{ background: '#0d1117', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: 900, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {['#ef4444','#f59e0b','#10b981'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7, display: 'inline-block' }} />)}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#6b7280', marginLeft: 6 }}>{viewingFileName}</span>
                  {viewingFileContent && (
                    <span style={{ fontSize: '0.72rem', color: '#4b5563', marginLeft: 4 }}>— {viewingFileContent.split('\n').filter(Boolean).length} lines</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleDownloadLogFile(viewingFileId)}
                    style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#94a3b8' }}>
                    Download
                  </button>
                  <button
                    onClick={() => { setViewingFileContent(null); setViewingFileId(null); setViewingFileName(''); }}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#94a3b8' }}>
                    ✕
                  </button>
                </div>
              </div>
              {/* Modal body */}
              <div style={{ overflowY: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', flex: 1 }}>
                {viewingFileLoading && (
                  <p style={{ color: '#4b5563', padding: '20px 16px', margin: 0 }}>Loading…</p>
                )}
                {!viewingFileLoading && viewingFileContent === null && (
                  <p style={{ color: '#ef4444', padding: '20px 16px', margin: 0 }}>Failed to load file.</p>
                )}
                {viewingFileContent !== null && viewingFileContent.split('\n').filter(Boolean).map((line, i) => {
                  const isError = /error|exception|fail/i.test(line);
                  const isWarn = /warn/i.test(line);
                  const lineColor = isError ? '#f87171' : isWarn ? '#fbbf24' : '#d1d5db';
                  const lineBg = isError ? 'rgba(248,113,113,0.07)' : 'transparent';
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '3px 16px', background: lineBg, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span style={{ color: '#374151', flexShrink: 0, fontSize: '0.7rem', minWidth: 32, textAlign: 'right', userSelect: 'none' }}>{i + 1}</span>
                      <span style={{ color: lineColor, wordBreak: 'break-all' }}>{line}</span>
                    </div>
                  );
                })}
              </div>
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
        icon={<Server size={20} color="white" />}
        title="Device Management"
        subtitle="Monitor and manage your IoT gateway fleet"
      />

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0 }}>Devices</h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: isDark ? '#94a3b8' : '#64748b' }}>{filteredDevices.length}</span>
          </div>
          <div className="card-actions">
            <input
              type="text"
              placeholder="Search devices..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
              style={{ background: isDark ? '#1a1a1a' : 'white', color: isDark ? '#e0e0e0' : 'inherit', border: isDark ? '1px solid #404040' : '1px solid #ced4da' }}
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
        <div className="table-responsive"><table className="table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: '40px' }}>
                <input
                  type="checkbox"
                  checked={selectedDevices.size === filteredDevices.length && filteredDevices.length > 0}
                  onChange={handleSelectAll}
                  title="Select all displayed devices"
                  style={{ background: isDark ? '#1a1a1a' : 'white', border: isDark ? '1px solid #404040' : '1px solid #ced4da' }}
                />
              </th>
              <th style={{ textAlign: 'center' }}>Device Serial</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>MAC / HW ID</th>
              <th style={{ textAlign: 'center' }}>Model</th>
              <th style={{ textAlign: 'center' }}>Assigned To</th>
              <th style={{ textAlign: 'center' }}>Config Version</th>
              <th style={{ textAlign: 'center' }}>Alerts</th>
              <th style={{ textAlign: 'center' }}>Last Seen</th>
              <th style={{ textAlign: 'center' }}>Provisioned At</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="stagger-children">
            {filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>
                  <EmptyState
                    title={searchTerm ? 'No devices match your search' : 'No devices yet'}
                    description={searchTerm ? 'Try a different search term.' : 'Register a device to get started.'}
                    action={!searchTerm ? { label: 'Register New Device', onClick: () => { setCreatingDevice(true); setUserSearchTerm(''); setShowUserDropdown(false); } } : undefined}
                  />
                </td>
              </tr>
            ) : filteredDevices.map((device) => (
              <tr
                key={device.id}
                onClick={() => handleViewDevice(device)}
                style={{
                  background: selectedDevices.has(device.id) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  cursor: 'pointer'
                }}
                className="clickable-row"
              >
                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedDevices.has(device.id)}
                    onChange={() => handleSelectDevice(device.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: isDark ? '#1a1a1a' : 'white', border: isDark ? '1px solid #404040' : '1px solid #ced4da' }}
                  />
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>{device.device_serial}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
                    background: device.is_online ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                    color: device.is_online ? '#10b981' : '#64748b',
                    border: device.is_online ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(148,163,184,0.25)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: device.is_online ? '#10b981' : '#64748b', display: 'inline-block', flexShrink: 0 }} />
                    {device.is_online ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: device.hw_id ? 'inherit' : 'var(--text-muted, #9ca3af)' }}>{device.hw_id || '—'}</td>
                <td style={{ textAlign: 'center', fontSize: '0.875rem' }}>{device.model || <span style={{ color: 'var(--text-muted, #9ca3af)' }}>—</span>}</td>
                <td style={{ textAlign: 'center' }}>{device.user || '-'}</td>
                <td style={{ textAlign: 'center' }}>{device.config_version || '-'}</td>
                <td style={{ textAlign: 'center' }}>
                  {(() => {
                    const count = (activeAlertsByDevice.get(device.device_serial) || []).length;
                    if (count === 0) {
                      return <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>—</span>;
                    }
                    return (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 9px',
                        borderRadius: 999,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'rgba(245,158,11,0.15)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245,158,11,0.3)',
                      }}>
                        <AlertTriangle size={12} />
                        {count}
                      </span>
                    );
                  })()}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {(() => {
                    const ts = device.last_seen_at || device.last_heartbeat;
                    if (!ts) return 'Never';
                    const date = new Date(ts);
                    return isNaN(date.getTime()) ? 'Unknown' : date.toLocaleTimeString();
                  })()}
                </td>
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
                    <Pencil size={16} strokeWidth={2} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(device);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color, #ef4444)', margin: '0 6px' }}
                    title="Delete"
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>

        {/* Pagination Controls */}
        {totalCount > 0 && (
          <div className="pagination-bar devices-pagination-bar" style={{
            padding: '16px',
            borderTop: '1px solid var(--border-color, rgba(148, 163, 184, 0.1))',
            gap: '16px'
          }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} devices
            </div>
            
            <div className="pagination-controls devices-pagination-controls">
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

      {(editingDevice || creatingDevice) && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
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
            maxWidth: '640px', width: '100%',
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
                    {editingDevice ? `Edit Device: ${editingDevice.device_serial}` : 'Register New Device'}
                  </div>
                  <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                    {editingDevice ? 'Update device configuration and assignment' : 'Add a new device to the fleet'}
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

            <form onSubmit={(e) => { e.preventDefault(); editingDevice ? handleSave() : handleCreate(); }} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

                {/* Device Identity */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Device Identity</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Device Serial Number</label>
                    <input
                      type="text"
                      value={editingDevice ? editForm.device_serial : createForm.device_serial}
                      onChange={(e) => editingDevice ? setEditForm({...editForm, device_serial: e.target.value}) : setCreateForm({...createForm, device_serial: e.target.value})}
                      required
                      autoComplete="off"
                      placeholder="SN-12345678"
                      style={{
                        padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                        background: isDark ? '#2a2a2a' : '#ffffff',
                        color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem',
                      }}
                    />
                  </div>
                </div>

                {/* Ownership */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Ownership & Assignment</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Assigned User</label>
                    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="Search and select user..."
                        value={userSearchTerm}
                        onChange={(e) => { setUserSearchTerm(e.target.value); setShowUserDropdown(true); }}
                        onFocus={() => setShowUserDropdown(true)}
                        autoComplete="off"
                        style={{
                          padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          background: isDark ? '#2a2a2a' : '#ffffff',
                          color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem',
                        }}
                      />
                      {(editingDevice ? editForm.user : createForm.user) && (
                        <div style={{ marginTop: '8px', fontSize: '0.875rem', color: isDark ? '#b0b0b0' : '#94a3b8' }}>
                          <strong>Selected:</strong> {users.find(u => u.username === (editingDevice ? editForm.user : createForm.user))?.first_name} {users.find(u => u.username === (editingDevice ? editForm.user : createForm.user))?.last_name} ({editingDevice ? editForm.user : createForm.user})
                          <button
                            type="button"
                            onClick={() => {
                              if (editingDevice) { setEditForm({...editForm, user: ''}); } else { setCreateForm({...createForm, user: ''}); }
                              setUserSearchTerm('');
                            }}
                            className="btn-icon btn-icon-danger"
                            style={{ marginLeft: '10px' }}
                            title="Remove Assignment"
                          >✕</button>
                        </div>
                      )}
                      {showUserDropdown && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          background: 'var(--bg-secondary, #0f172a)',
                          border: '1px solid var(--border-color, rgba(148, 163, 184, 0.1))',
                          borderRadius: '8px', maxHeight: '200px', overflowY: 'auto',
                          zIndex: 1000, boxShadow: 'var(--shadow-xl)', marginTop: '4px',
                        }}>
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                              <div
                                key={user.id}
                                onClick={() => {
                                  if (editingDevice) { setEditForm({...editForm, user: user.username}); } else { setCreateForm({...createForm, user: user.username}); }
                                  setUserSearchTerm(`${user.first_name} ${user.last_name} (${user.username})`);
                                  setShowUserDropdown(false);
                                }}
                                style={{
                                  padding: '12px 16px', cursor: 'pointer',
                                  borderBottom: '1px solid var(--border-color, rgba(148, 163, 184, 0.1))',
                                  background: (editingDevice ? editForm.user : createForm.user) === user.username ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                  color: 'var(--text-primary, #f8fafc)', transition: 'all 0.15s ease', fontSize: '0.875rem',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = (editingDevice ? editForm.user : createForm.user) === user.username ? 'rgba(99, 102, 241, 0.15)' : 'transparent'}
                              >
                                {user.first_name} {user.last_name} ({user.username})<br/>
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

                {/* Configuration */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Configuration</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Preset Template</label>
                      <select
                        value={editingDevice ? editForm.config_version : createForm.config_version}
                        onChange={(e) => editingDevice ? setEditForm({ ...editForm, config_version: e.target.value }) : setCreateForm({ ...createForm, config_version: e.target.value })}
                        style={{
                          padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          background: isDark ? '#2a2a2a' : '#ffffff',
                          color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem',
                        }}
                      >
                        <option value="">-- Manual Configuration --</option>
                        {presetsLoading && <option value="" disabled>Loading presets...</option>}
                        {!presetsLoading && presets.map((preset) => (
                          <option key={preset.id} value={getPresetConfigId(preset)}>
                            {preset.name} ({getPresetConfigId(preset) || 'no ID'})
                          </option>
                        ))}
                      </select>
                      <small style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>Selecting a preset sets the Config Version ID below.</small>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Config Version ID</label>
                      <input
                        type="text"
                        value={editingDevice ? editForm.config_version : createForm.config_version}
                        onChange={(e) => editingDevice ? setEditForm({...editForm, config_version: e.target.value}) : setCreateForm({...createForm, config_version: e.target.value})}
                        autoComplete="off"
                        placeholder="Manual Config ID"
                        style={{
                          padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          background: isDark ? '#2a2a2a' : '#ffffff',
                          color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {editingDevice && (
                  <AuditTrail
                    createdBy={editingDevice.created_by_username}
                    createdAt={editingDevice.created_at}
                    updatedBy={editingDevice.updated_by_username}
                    updatedAt={editingDevice.updated_at}
                  />
                )}
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
                }}>{editingDevice ? 'Save Changes' : 'Register Device'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    {/* Modern Reboot Confirmation Modal */}
    <AccessibleModal
      open={rebootModal.open}
      onClose={rebootModal.closeModal}
      title="Confirm Reboot"
      id="reboot-modal-title-list"
    >
      {rebootModal.data && (
        <div className="modal-reboot-content">
          <p className="modal-reboot-message">
            Are you sure you want to reboot device <strong>{rebootModal.data.device_serial}</strong>?
          </p>
          <div className="modal-warning-box modal-reboot-note">
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Info size={16} strokeWidth={2} /> Note:</strong> The device will restart on its next heartbeat. Any unsaved data may be lost.
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={rebootModal.closeModal}>Cancel</button>
            <button type="button" className="btn-primary" onClick={confirmReboot}>Confirm Reboot</button>
          </div>
        </div>
      )}
    </AccessibleModal>

    {/* Modern Hard Reset Confirmation Modal */}
    {hardResetModal.show && hardResetModal.device && ReactDOM.createPortal(
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: '20px',
      }}>
        <div style={{
          background: isDark ? '#1a1a1a' : '#ffffff',
          borderRadius: 16,
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '480px', width: '100%', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, #dc3545, #c82333)',
                boxShadow: '0 4px 14px rgba(220,53,69,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={22} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>Hard Reset Warning</span>
            </div>
            <button
              onClick={() => setHardResetModal({ show: false, device: null })}
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                color: isDark ? '#9ca3af' : '#6b7280',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 16 }}>
              Device to reset: <strong style={{ color: isDark ? '#f9fafb' : '#111827' }}>{hardResetModal.device.device_serial}</strong>
            </p>
            <div style={{
              background: isDark ? 'rgba(220,53,69,0.12)' : '#f8d7da',
              border: isDark ? '1px solid rgba(220,53,69,0.25)' : '1px solid #f5c6cb',
              borderRadius: 8, padding: '12px 14px', fontSize: '0.875rem',
              color: isDark ? '#fca5a5' : '#721c24',
            }}>
              <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><AlertTriangle size={15} /> CRITICAL WARNING</strong>
              <p style={{ margin: '6px 0 0 0' }}>
                This action will <strong>erase all device configuration</strong> and restart the device to factory settings.
              </p>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '1.25rem' }}>
                <li>All configuration will be lost</li>
                <li>Device will return to factory defaults</li>
                <li>Re-provisioning will be required</li>
              </ul>
            </div>
          </div>
          <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setHardResetModal({ show: false, device: null })}
              style={{
                padding: '10px 18px', borderRadius: 8,
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                color: isDark ? '#d1d5db' : '#374151',
                fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmHardReset}
              style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #dc3545, #c82333)',
                color: 'white', fontSize: '0.875rem', fontWeight: 600,
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,53,69,0.35)',
              }}
            >
              Yes, Hard Reset
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    <AccessibleModal
      open={deleteModal.open}
      onClose={deleteModal.closeModal}
      title="Delete Device Permanently"
      id="delete-modal-title-list"
    >
      {deleteModal.data && (
        <div className="modal-delete-content">
          <div className="modal-warning-box">
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><AlertTriangle size={18} strokeWidth={2} /> PERMANENT DELETION</strong>
            <p>This action cannot be undone. All device data will be permanently deleted.</p>
          </div>
          <p>Device to delete: <strong>{deleteModal.data.device_serial}</strong></p>
          <ul className="modal-consequences-list">
            <li>All telemetry data will be lost</li>
            <li>All command history will be deleted</li>
            <li>Device must be re-provisioned to use again</li>
          </ul>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={deleteModal.closeModal}>Cancel</button>
            <button type="button" className="btn-danger" onClick={confirmDelete}>Yes, Delete Permanently</button>
          </div>
        </div>
      )}
    </AccessibleModal>

    {/* Modern Success Notification Modal */}
    {successModal.show && ReactDOM.createPortal(
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: '20px',
      }}>
        <div style={{
          background: isDark ? '#1a1a1a' : '#ffffff',
          borderRadius: 16,
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '480px', width: '100%', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle2 size={22} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>Command Queued</span>
            </div>
            <button
              onClick={() => setSuccessModal({ show: false, message: '' })}
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                color: isDark ? '#9ca3af' : '#6b7280',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 16 }}>
              {successModal.message}
            </p>
          </div>
          <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setSuccessModal({ show: false, message: '' })}
              style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white', fontSize: '0.875rem', fontWeight: 600,
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Bulk Delete Confirmation Modal */}
    {bulkDeleteModal.show && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)'
      }}>
        <div style={{
          background: isDark ? '#2d2d2d' : 'white', borderRadius: '16px',
          padding: '2rem', maxWidth: '520px', width: '90%',
          boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.3)',
          border: '2px solid #7f1d1d', animation: 'slideIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', animation: 'pulse 2s infinite'
            }}>🗑️</div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, color: '#7f1d1d' }}>
              Delete {bulkDeleteModal.deviceList.length} Device{bulkDeleteModal.deviceList.length !== 1 ? 's' : ''} Permanently
            </h3>
          </div>

          <div style={{ marginBottom: '1.5rem', color: isDark ? '#b0b0b0' : '#495057', lineHeight: '1.6' }}>
            <div style={{
              background: isDark ? 'rgba(127, 29, 29, 0.1)' : '#fee2e2',
              border: isDark ? '1px solid rgba(127, 29, 29, 0.3)' : '1px solid #fecaca',
              borderRadius: '8px', padding: '1rem', marginBottom: '1rem',
              color: isDark ? '#fca5a5' : '#991b1b'
            }}>
              <strong style={{ fontSize: '1.05rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><AlertTriangle size={18} strokeWidth={2} /> PERMANENT DELETION</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                This action <strong>cannot be undone</strong>. All data for these devices will be permanently deleted.
              </p>
            </div>
            <p style={{ marginBottom: '0.5rem' }}>Devices to delete:</p>
            <ul style={{ margin: '0', paddingLeft: '1.5rem', fontSize: '0.9rem', maxHeight: '120px', overflowY: 'auto' }}>
              {bulkDeleteModal.deviceList.map(d => (
                <li key={d.id} style={{ color: isDark ? '#e0e0e0' : '#2c3e50', fontWeight: '600' }}>{d.device_serial}</li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setBulkDeleteModal({ show: false, deviceList: [] })}
              style={{
                background: isDark ? '#3a3a3a' : '#e0e0e0', color: isDark ? '#e0e0e0' : '#495057',
                border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px',
                fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >Cancel</button>
            <button
              onClick={confirmBulkDelete}
              disabled={bulkDeleteLoading}
              style={{
                background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)', color: 'white',
                border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px',
                fontSize: '0.95rem', fontWeight: '600', cursor: bulkDeleteLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(127, 29, 29, 0.3)', transition: 'all 0.2s',
                opacity: bulkDeleteLoading ? 0.7 : 1
              }}
            >{bulkDeleteLoading ? 'Deleting…' : 'Yes, Delete All'}</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default Devices;
