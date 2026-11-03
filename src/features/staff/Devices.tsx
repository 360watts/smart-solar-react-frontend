import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MobileDevices from '../mobile/staff/MobileDevices';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import ReactDOM from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, Info, X, CheckCircle2, Server, Settings } from 'lucide-react';
import { apiService } from '../../services/api';
import { useDebouncedCallback } from '../../shared/hooks/useDebounce';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../shared/access/useAccess';
import AuditTrail from './AuditTrail';
import SiteDataPanel from '../../shared/components/SiteDataPanel';
import EnergyMeterDashboard from '../../shared/components/EnergyMeterDashboard';
import { SkeletonDeviceList } from '../../shared/components/SkeletonLoader';
import { AccessibleModal } from '../../shared/components/AccessibleModal';
import PageHeader from '../../shared/layout/PageHeader';
import { useModal } from '../../shared/hooks';
import { DEFAULT_PAGE_SIZE } from '../../app/constants';
import EditDeviceModal from './EditDeviceModal';
import GatewayActivity, { GatewayFields } from './GatewayActivity';
import DeleteDeviceModal, { DeleteDeviceOptions } from './DeleteDeviceModal';
import RestoreArchivedDeviceModal from './RestoreArchivedDeviceModal';
import ManageProvisionsModal from './ManageProvisionsModal';

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
}

interface Device extends GatewayFields {
  id: number;
  device_serial: string;
  device_type?: 'gateway' | 'energy_meter';
  site_name?: string | null;
  customer_name?: string | null;
  open_alerts?: number;
  coverage?: ('full' | 'partial' | 'empty')[];
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
  is_active?: boolean;
  pending_config_update?: boolean;
  config_ack_ver?: number | null;
  config_downloaded_at?: string | null;
  config_acked_at?: string | null;
  created_by_username?: string;
  created_at?: string;
  updated_by_username?: string;
  updated_at?: string;
  alerts_muted_until?: string | null;
  wifi_ssid?: string | null;
  wifi_password?: string | null;
  firmware_version?: string | null;
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
  created_at?: string;
  updated_at?: string;
}

// ── Register Coverage Sub-components ─────────────────────────────────────────

const agoText = (ts?: string | null) => {
  const t = ts ? new Date(ts).getTime() : NaN;
  if (isNaN(t)) return 'Never';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec} s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return `${Math.floor(sec / 86400)} d ago`;
};

// Parses the backend's "Request was throttled. Expected available in N seconds." message
// so the poll can skip ticks until then instead of retrying every cycle and re-triggering
// the same throttle window.
function throttleBackoffMs(err: unknown): number | null {
  const message = err instanceof Error ? err.message : '';
  const match = message.match(/throttled.*?(\d+)\s*seconds?/i);
  if (!match) return null;
  return (parseInt(match[1], 10) + 1) * 1000; // +1s buffer past the backend's own estimate
}


const Devices: React.FC = () => {
  const isMobile = useIsMobile();
  const { isDark } = useTheme();
  // ── Design tokens — mobile AppTheme aligned ──────────────────────────────
  const T = {
    bg:      'var(--background)',
    surface: 'var(--card)',
    cardEl:  'var(--card)',
    border:  'var(--border)',
    borderM: 'var(--border)',
    text:    'var(--foreground)',
    textM:   'var(--muted-foreground)',
    textD:   'var(--text-dim)',
    accent:  'var(--primary)',
  };
  const { user } = useAuth();
  const { can } = useAccess();
  const canDestroy = can('destructive');
  // Device operations switch: off means watch only, so device-writing controls are hidden.
  const canOps = can('device_control');
  const isStaffUser = !!user?.is_staff;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<'' | 'online' | 'offline' | 'attention'>('');
  const [typeFilter, setTypeFilter] = useState<'' | 'gateway' | 'energy_meter'>('');
  const [facets, setFacets] = useState({ all: 0, online: 0, offline: 0, attention: 0 });
  const [peekId, setPeekId] = useState<number | null>(null);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
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
  const [mqttCertData, setMqttCertData] = useState<{ cert: string; key: string; endpoint: string } | null>(null);
  const [showMqttCertModal, setShowMqttCertModal] = useState(false);


  // Site management state

  // Register coverage state
  
  // Modern modal states
  const rebootModal = useModal<Device>();
  const deleteModal = useModal<Device>();
  const [hardResetModal, setHardResetModal] = useState<{ show: boolean; device: Device | null }>({ show: false, device: null });
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{ show: boolean; deviceList: Device[] }>({ show: false, deviceList: [] });
  const [successModal, setSuccessModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalDevice, setModalDevice] = useState<Device | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showManageProvisionsModal, setShowManageProvisionsModal] = useState(false);

  // Shared throttle backoff for the silent heartbeat poll below — a 429 sets this to the
  // moment the backend says it'll accept requests again, so the poll skips ticks instead of
  // immediately retrying and re-triggering the same throttle every cycle.
  const pollBackoffUntilRef = useRef<number>(0);

  const fetchDevices = useCallback(async (page: number = 1, search: string = '', silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await apiService.getDevices(search || undefined, page, pageSize, { state: stateFilter, deviceType: typeFilter });
      let latestRows: Device[] = [];

      // Handle paginated response
      if (response.results) {
        latestRows = response.results;
        setDevices(latestRows);
        setFilteredDevices(latestRows);
        setTotalCount(response.count);
        setTotalPages(response.total_pages);
        setCurrentPage(response.current_page);
        setFacets(response.facets ?? {  // backend predates facets: count this page only
          all: latestRows.length,
          online: latestRows.filter((d) => d.is_active !== false && d.is_online).length,
          offline: latestRows.filter((d) => d.is_active !== false && !d.is_online).length,
          attention: latestRows.filter((d) => d.is_active !== false && (!d.is_online || (d.open_alerts ?? 0) > 0)).length,
        });
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
      const backoff = throttleBackoffMs(err);
      if (backoff) pollBackoffUntilRef.current = Math.max(pollBackoffUntilRef.current, Date.now() + backoff);
      setError(err instanceof Error ? err.message : 'An error occurred');
      if (!silent) setLoading(false);
    }
  }, [pageSize, stateFilter, typeFilter]);

  const fetchPresets = async () => {
    try {
      const data = await apiService.getPresets();
      setPresets(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch presets:', err);
      setError('Failed to load device presets');
    } finally {
      setPresetsLoading(false);
    }
  };

  // One page per device: the list only picks, the device page shows it.
  const handleViewDevice = useCallback((device: Device) => navigate(`/devices/${device.id}/dashboard`), [navigate]);

  useEffect(() => {
    fetchPresets();
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

  // Heartbeat/status auto-refresh so UI reflects new device heartbeats without user action.
  // Skips a tick entirely while pollBackoffUntilRef is in the future (set by a 429 above) so
  // a throttled request doesn't just get retried every cycle and re-trigger the same window.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      if (Date.now() < pollBackoffUntilRef.current) return;
      fetchDevices(currentPage, searchTerm, true);
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [currentPage, searchTerm, fetchDevices]);
  
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

  const handleEdit = async (device: Device) => {
    try {
      const fullDevice = await apiService.getDevice(device.id);
      setModalDevice(fullDevice);
      setShowEditModal(true);
    } catch (err) {
      console.error('Failed to fetch device details for editing:', err);
      setModalDevice(device);
      setShowEditModal(true);
    }
  };

  const handleEditModalSave = async (data: Partial<Device>) => {
    if (!modalDevice) return;
    try {
      await apiService.updateDevice(modalDevice.id, data);
      setShowEditModal(false);
      setModalDevice(null);
      await fetchDevices(currentPage, searchTerm);
    } catch (err) {
      console.error('Failed to update device:', err);
      throw err;
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

  const confirmDelete = async (options: DeleteDeviceOptions) => {
    if (!deleteModal.data) return;
    const serial = deleteModal.data.device_serial;
    try {
      await apiService.deleteDevice(deleteModal.data.id, options);
      deleteModal.closeModal();
      setSuccessModal({ show: true, message: `Device ${serial} has been deleted successfully.` });
      setSelectedDevice(null);
      fetchDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete device');
      deleteModal.closeModal();
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

  const confirmBulkDelete = async (options: DeleteDeviceOptions) => {
    try {
      setBulkDeleteLoading(true);
      await apiService.deleteDevicesBulk(Array.from(selectedDevices), options);

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


  if (loading && devices.length === 0) {  // first load only: a search or chip refetch must not unmount the finder (focus would be lost)
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

  // Rendered in both the list and the detail return below: the detail view returns early, so a
  // modal mounted only in the list return would never appear when Edit is clicked from detail.
  const editDeviceModal = (
    <EditDeviceModal
      isOpen={showEditModal}
      device={modalDevice}
      isDark={isDark}
      presets={presets}
      onClose={() => {
        setShowEditModal(false);
        setModalDevice(null);
      }}
      onSave={handleEditModalSave}
    />
  );


  const peek = filteredDevices.find((d) => d.id === peekId) ?? filteredDevices[0];

  return (
    <div className="admin-container responsive-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[2rem] font-semibold leading-tight tracking-tight text-foreground">Devices</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{facets.online + facets.offline} active gateways and meters</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => setShowRestoreModal(true)}
            className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">Restore archived device</button>
          <button type="button" onClick={() => setShowManageProvisionsModal(true)}
            className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">Manage provisions</button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3.5">
        <label htmlFor="device-finder" className="sr-only">Find a device</label>
        <div className="relative">
          <Search size={22} aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input id="device-finder" type="search" value={searchTerm} onChange={handleSearch} autoComplete="off"
            placeholder="Find a device by serial, site or customer"
            className="h-[58px] w-full rounded-[22px] border-[1.5px] border-border bg-card pl-[54px] pr-5 text-[17px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)]" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {([['', 'All', facets.all], ['online', 'Online', facets.online], ['offline', 'Offline', facets.offline], ['attention', 'Needs attention', facets.attention]] as const).map(([k, label, n]) => (
              <button key={k} type="button" aria-pressed={stateFilter === k} onClick={() => { setStateFilter(k); setCurrentPage(1); }}
                className={`inline-flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-2 text-sm font-medium ${stateFilter === k ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:bg-muted'}`}>
                {label}<span className="text-xs opacity-80" style={{ fontFamily: 'Fira Code, monospace' }}>{n}</span>
              </button>
            ))}
          </div>
          <div role="group" aria-label="Device type" className="inline-flex gap-0.5 rounded-full bg-muted p-1">
            {([['', 'All types'], ['gateway', 'Gateways'], ['energy_meter', 'Meters']] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={typeFilter === k} onClick={() => { setTypeFilter(k); setCurrentPage(1); }}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${typeFilter === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-[999_1_640px] overflow-hidden rounded-[22px] border border-border bg-card">
        <div className="hidden items-center gap-4 px-5 py-3 text-[13px] text-muted-foreground md:[display:grid] md:grid-cols-[minmax(0,1.25fr)_minmax(0,1.3fr)_168px_84px_44px]" style={{ paddingLeft: canDestroy ? 52 : undefined }}>
          <span>Device</span><span>Site and customer</span><span>Last 24 hours</span><span className="text-right">Last seen</span><span className="text-right">Alerts</span>
        </div>
        {canDestroy && selectedDevices.size > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted px-5 py-2.5 text-sm">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" aria-label="Select all devices on this page" checked={selectedDevices.size === filteredDevices.length} onChange={handleSelectAll} />
              {selectedDevices.size} selected
            </label>
            <button type="button" onClick={handleBulkDelete} disabled={bulkDeleteLoading}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 font-semibold text-red-600 disabled:opacity-60">
              {bulkDeleteLoading ? `Deleting ${selectedDevices.size}…` : `Delete ${selectedDevices.size}`}
            </button>
          </div>
        )}
        {canDestroy && selectedDevices.size === 0 && filteredDevices.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2.5 border-t border-border px-5 py-2 text-[13px] text-muted-foreground">
            <input type="checkbox" aria-label="Select all devices on this page" checked={false} onChange={handleSelectAll} />
            Select all on this page
          </label>
        )}
        {filteredDevices.length === 0 && (
          <div className="border-t border-border px-6 py-14 text-center">
            <p className="m-0 mb-1.5 text-lg font-semibold text-foreground">
              {loading ? 'Loading devices…' : searchTerm ? `No device matches “${searchTerm}”` : 'No devices here'}
            </p>
            {!loading && <p className="m-0 text-muted-foreground">Check the serial or clear the filters. A device that went missing can be restored from the archive.</p>}
          </div>
        )}
        {filteredDevices.map((device) => {
          const on = peek?.id === device.id;
          const inactive = device.is_active === false;
          const dot = inactive ? 'border-2 border-dashed border-muted-foreground' : device.is_online ? 'bg-[var(--brand-green)]' : 'bg-muted-foreground';
          const alerts = device.open_alerts ?? 0;
          return (
            <div key={device.id} className="flex items-stretch border-t border-border" style={{ opacity: inactive ? 0.62 : 1, background: on ? 'color-mix(in srgb, var(--brand-green) 10%, transparent)' : undefined, boxShadow: on ? 'inset 3px 0 0 var(--brand-green)' : undefined }}>
              {canDestroy && (
                <label className="flex w-[52px] flex-none cursor-pointer items-center justify-center">
                  <input type="checkbox" aria-label={`Select ${device.device_serial}`} checked={selectedDevices.has(device.id)} onChange={() => handleSelectDevice(device.id)} />
                </label>
              )}
              <button type="button" aria-pressed={on} onClick={() => setPeekId(device.id)} onDoubleClick={() => handleViewDevice(device)}
                className="[display:grid] min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-0 bg-transparent px-5 py-3.5 text-left text-foreground hover:bg-muted/50 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1.3fr)_168px_84px_44px]"
                style={canDestroy ? { paddingLeft: 0 } : undefined}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`h-2.5 w-2.5 flex-none rounded-full ${dot}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium" style={{ fontFamily: 'Fira Code, monospace' }}>{device.device_serial}</span>
                    <span className="block text-[13px] text-muted-foreground">{device.device_type === 'energy_meter' ? 'Meter' : 'Gateway'} · {inactive ? 'Inactive' : device.is_online ? 'Online' : 'Offline'}</span>
                  </span>
                </span>
                <span className="hidden min-w-0 md:block">
                  <span className="block truncate font-medium">{device.site_name || 'No site yet'}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{device.customer_name || 'No customer'}</span>
                </span>
                <span className="hidden items-center gap-0.5 md:flex" aria-hidden="true">
                  {(device.coverage ?? []).map((c, i) => (
                    <span key={i} className="h-5 w-[5px] rounded-sm" style={{ background: c === 'full' ? 'var(--brand-green)' : c === 'partial' ? 'var(--needed)' : 'var(--border)' }} />
                  ))}
                </span>
                <span className="whitespace-nowrap text-right text-sm text-foreground">{agoText(device.last_seen_at || device.last_heartbeat)}</span>
                <span className="hidden justify-self-end md:block">
                  {alerts > 0 && <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-needed-soft px-1.5 text-[13px] font-semibold text-needed-ink">{alerts}</span>}
                </span>
              </button>
            </div>
          );
        })}

        {/* Pagination Controls */}
        {totalCount > 0 && (
          <div className="pagination-bar devices-pagination-bar" style={{
            padding: '16px',
            borderTop: `1px solid ${T.border}`,
            gap: '16px'
          }}>
            <div style={{ fontSize: '0.875rem', color: T.textM }}>
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} devices
            </div>
            
            <div className="pagination-controls devices-pagination-controls">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 14px',
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  background: 'transparent',
                  color: T.textM,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.4 : 1,
                  fontSize: '0.825rem', fontWeight: 500,
                }}
              >
                ← Prev
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
                            border: i === currentPage ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
                            borderRadius: '8px',
                            background: i === currentPage ? 'rgba(15,159,143,0.12)' : 'transparent',
                            color: i === currentPage ? T.accent : T.textM,
                            cursor: 'pointer',
                            fontWeight: i === currentPage ? 700 : 400,
                            minWidth: '32px', fontSize: '0.825rem',
                          }}
                        >
                          {i}
                        </button>
                      );
                    } else if (pages[pages.length - 1]?.key !== 'ellipsis-' + Math.floor(i / 10)) {
                      // Add ellipsis if we skipped pages and haven't added one recently
                      pages.push(
                        <span key={`ellipsis-${Math.floor(i / 10)}`} style={{ padding: '0 4px', color: T.textD }}>
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
                  padding: '8px 14px',
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  background: 'transparent',
                  color: T.textM,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.4 : 1,
                  fontSize: '0.825rem', fontWeight: 500,
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
                padding: '8px 10px',
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                background: T.surface,
                color: T.textM,
                cursor: 'pointer',
                fontSize: '0.825rem',
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
      {peek && (
        <aside aria-label="Selected device" className="sticky top-6 flex min-w-[300px] max-w-[400px] flex-[1_1_340px] flex-col gap-5 rounded-[22px] border border-border bg-card p-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {peek.device_type === 'energy_meter' ? 'Energy meter' : 'Gateway'} · {peek.is_active === false ? 'Inactive' : peek.is_online ? 'Online' : 'Offline'}
            </div>
            <h2 className="m-0 mt-2 break-all text-[22px] font-medium tracking-tight text-foreground" style={{ fontFamily: 'Fira Code, monospace' }}>{peek.device_serial}</h2>
          </div>
          <dl className="m-0 [display:grid] grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
            {([
              ['Site', peek.site_name || 'No site yet'],
              ['Customer', peek.customer_name || 'No customer'],
              ['Last heard from', agoText(peek.last_seen_at || peek.last_heartbeat)],
              ['Wi-Fi strength', peek.signal_strength_dbm != null ? `${peek.signal_strength_dbm}%` : '—'],
              ['Address', peek.network_ip || '—'],
              ['Settings', peek.pending_config_update ? 'Waiting for device' : 'Up to date'],
            ] as const).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="m-0 text-right font-medium text-foreground">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
          {(peek.open_alerts ?? 0) > 0 && (
            <div className="rounded-2xl bg-needed-soft px-3.5 py-3 text-sm text-needed-ink">
              {peek.open_alerts} open {peek.open_alerts === 1 ? 'alert' : 'alerts'} on this device.
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={() => handleViewDevice(peek)}
              className="rounded-2xl border-0 bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-black">Open device</button>
            {(canOps || canDestroy) && (
              <div className="flex gap-2.5">
                {canOps && <button type="button" onClick={() => handleEdit(peek)} className="flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">Edit</button>}
                {canOps && <button type="button" onClick={() => handleReboot(peek)} className="flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">Reboot</button>}
                {canDestroy && <button type="button" onClick={() => handleDelete(peek)} className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-muted">Delete</button>}
              </div>
            )}
          </div>
        </aside>
      )}
      </div>

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
          background: T.surface,
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
              <span style={{ fontWeight: 700, fontSize: '1.125rem', color: T.text }}>Hard Reset Warning</span>
            </div>
            <button
              onClick={() => setHardResetModal({ show: false, device: null })}
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none',
                background: T.borderM,
                color: T.textM,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: T.textM, lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 16 }}>
              Device to reset: <strong style={{ color: T.text }}>{hardResetModal.device.device_serial}</strong>
            </p>
            <div style={{
              background: isDark ? 'rgba(220,53,69,0.12)' : '#f8d7da',
              border: isDark ? '1px solid rgba(220,53,69,0.25)' : '1px solid #f5c6cb',
              borderRadius: 8, padding: '12px 14px', fontSize: '0.875rem',
              color: 'var(--destructive)',
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
                border: `1px solid ${T.border}`,
                background: T.cardEl,
                color: T.textM,
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

    <DeleteDeviceModal
      open={deleteModal.open}
      device={deleteModal.data}
      onClose={deleteModal.closeModal}
      onConfirm={confirmDelete}
    />

    <RestoreArchivedDeviceModal
      open={showRestoreModal}
      onClose={() => setShowRestoreModal(false)}
      onRestored={(device) => {
        setSuccessModal({ show: true, message: `Device ${device.device_serial} has been restored.` });
        fetchDevices(currentPage, searchTerm);
      }}
      onHardDeleted={({ deletedCount, failedCount }) => {
        if (deletedCount > 0) {
          setSuccessModal({
            show: true,
            message: failedCount > 0
              ? `${deletedCount} device${deletedCount !== 1 ? 's' : ''} permanently deleted, ${failedCount} could not be deleted (telemetry history).`
              : `${deletedCount} device${deletedCount !== 1 ? 's' : ''} permanently deleted.`,
          });
        }
      }}
    />

    <ManageProvisionsModal
      open={showManageProvisionsModal}
      onClose={() => setShowManageProvisionsModal(false)}
    />

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
          background: T.surface,
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
                background: 'linear-gradient(135deg, #0F9F8F, #138881)',
                boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle2 size={22} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.125rem', color: T.text }}>Command Queued</span>
            </div>
            <button
              onClick={() => setSuccessModal({ show: false, message: '' })}
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none',
                background: T.borderM,
                color: T.textM,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: T.textM, lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 16 }}>
              {successModal.message}
            </p>
          </div>
          <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setSuccessModal({ show: false, message: '' })}
              style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #0F9F8F, #138881)',
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

    {/* Bulk Delete Confirmation Modal — same DeleteDeviceModal as single-delete
        (bulk mode via `devices` prop), so cleanup options and copy stay in
        sync instead of drifting like the old hand-rolled version did. */}
    <DeleteDeviceModal
      open={bulkDeleteModal.show}
      device={null}
      devices={bulkDeleteModal.deviceList}
      onClose={() => setBulkDeleteModal({ show: false, deviceList: [] })}
      onConfirm={confirmBulkDelete}
    />

    {/* MQTT Certificate Display Modal — one-time popup */}
    {showMqttCertModal && mqttCertData && (
      <AccessibleModal
        open={showMqttCertModal}
        onClose={() => setShowMqttCertModal(false)}
        title="MQTT Certificate Issued"
      >
        <div style={{ padding: '20px' }}>
          <p style={{ marginBottom: '12px', color: '#666' }}>
            Device provisioned successfully. Download or copy the credentials below to send to your IoT team.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>Endpoint:</label>
            <div style={{
              backgroundColor: '#f5f5f5',
              padding: '10px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '12px',
              wordBreak: 'break-all',
              userSelect: 'all',
            }}>
              {mqttCertData.endpoint}
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(mqttCertData.endpoint)}
              style={{ marginTop: '6px', padding: '6px 12px', fontSize: '12px' }}
              className="btn-secondary"
            >
              Copy Endpoint
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>Certificate (PEM):</label>
            <textarea
              readOnly
              value={mqttCertData.cert}
              style={{
                width: '100%',
                height: '120px',
                fontFamily: 'monospace',
                fontSize: '11px',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                userSelect: 'all',
              }}
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(mqttCertData.cert)}
              style={{ marginTop: '6px', padding: '6px 12px', fontSize: '12px' }}
              className="btn-secondary"
            >
              Copy Certificate
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>Private Key (PEM):</label>
            <textarea
              readOnly
              value={mqttCertData.key}
              style={{
                width: '100%',
                height: '120px',
                fontFamily: 'monospace',
                fontSize: '11px',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                userSelect: 'all',
              }}
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(mqttCertData.key)}
              style={{ marginTop: '6px', padding: '6px 12px', fontSize: '12px' }}
              className="btn-secondary"
            >
              Copy Private Key
            </button>
          </div>

          <p style={{ fontSize: '12px', color: '#999', marginBottom: '0' }}>
            ⚠️ Keep the private key secure. Do not share or commit to version control.
          </p>

          <div style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowMqttCertModal(false)}
            >
              Got it
            </button>
          </div>
        </div>
      </AccessibleModal>
    )}

    {editDeviceModal}

    </div>
  );
};

export default Devices;
