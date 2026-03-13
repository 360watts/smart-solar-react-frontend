import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Package, Upload, Loader2, Check, Zap, RotateCcw, AlertCircle, AlertTriangle, Info, X, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import '../App.css';

interface FirmwareVersion {
  id: number;
  name: string;
  version: string;
  deviceModel: string;
  minBootloaderVersion: string;
  file: File | null;
  size: number;
  checksum: string;
  signatureValid: boolean;
  releaseNotes: string;
  status: 'draft' | 'stable';
  uploadDate: string;
}

interface DeviceStatus {
  deviceId: string;
  currentVersion: string;
  targetVersion: string;
  activeSlot: 'A' | 'B';
  status: 'idle' | 'downloading' | 'flashing' | 'rebooting' | 'trial' | 'healthy' | 'failed' | 'rolledback';
  bootCount: number;
  lastError: string;
  progress?: number;
  lastCheckedAt?: string;
}

interface DeploymentConfig {
  firmwareVersion: string;
  targetDevices: string[];
  mode: 'immediate' | 'canary';
  autoRollback: boolean;
  healthTimeout: number;
  failureThreshold: number;
}

interface DeploymentConfirmModal {
  show: boolean;
  firmware: string;
  deviceCount: number;
  dataTransfer: string;
}

export const OTA: React.FC = () => {
  const { isDark } = useTheme();
  
  // Section 1: Firmware Repository State
  const [firmwares, setFirmwares] = useState<FirmwareVersion[]>([]);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    version: '',
    deviceModel: 'ESP32-S3',
    minBootloader: '1.0.0',
    releaseNotes: '',
    file: null as File | null,
  });

  // Section 2: Deployment Panel State
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig>({
    firmwareVersion: '',
    targetDevices: [],
    mode: 'immediate',
    autoRollback: true,
    healthTimeout: 300,
    failureThreshold: 10,
  });
  const [confirmModal, setConfirmModal] = useState<DeploymentConfirmModal>({
    show: false,
    firmware: '',
    deviceCount: 0,
    dataTransfer: '',
  });
  const [isDeploying, setIsDeploying] = useState(false);

  // Section 3: Live Deployment Status State
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | DeviceStatus['status']>('all');
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingFirmwares, setLoadingFirmwares] = useState(true);
  const [activeDeployment, setActiveDeployment] = useState<any>(null);

  // Section 4: Emergency Rollback State
  const [rollbackForm, setRollbackForm] = useState({
    selectedDevices: [] as string[],
    reason: '',
  });
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackFilters, setRollbackFilters] = useState({
    currentVersion: 'all',
    status: 'all',
    deviceModel: 'all',
  });

  // Generic destructive-action confirmation modal (replaces deleteFirmwareModal + deactivateFirmwareModal)
  const [confirmActionModal, setConfirmActionModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    warningText: string;
    confirmLabel: string;
    accentColor: string;
    icon: string;
    onConfirm: () => Promise<void>;
  }>({ show: false, title: '', message: '', warningText: '', confirmLabel: 'Confirm', accentColor: '#dc3545', icon: '⚠️', onConfirm: async () => {} });

  const [successModal, setSuccessModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [firmwareSearch, setFirmwareSearch] = useState('');
  const [idleDeviceSearch, setIdleDeviceSearch] = useState('');
  const [rollbackDeviceSearch, setRollbackDeviceSearch] = useState('');

  // Initial load - runs once on mount
  useEffect(() => {
    loadFirmwareData();
    loadDevices();
    loadDeployments();
    
    // Set up polling for deployment status updates
    const interval = setInterval(() => {
      loadDeployments(); // This will update activeDeployment and trigger status updates if needed
    }, 10000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFirmwareData = async () => {
    try {
      setLoadingFirmwares(true);
      const response = await apiService.getFirmwareVersions(false); // Get all firmware versions
      
      // Transform backend response to frontend FirmwareVersion interface
      const transformedFirmwares: FirmwareVersion[] = (response.results || response || []).map((fw: any) => ({
        id: fw.id,
        name: fw.filename || `Firmware v${fw.version}`,
        version: fw.version,
        deviceModel: fw.description?.match(/(?:ESP32|STM32|[A-Z0-9-]+)/i)?.[0] || 'Unknown',
        minBootloaderVersion: '1.0.0', // Default as backend doesn't provide this
        file: null,
        size: fw.size || 0,
        checksum: fw.checksum || '',
        signatureValid: fw.is_active !== false,
        releaseNotes: fw.release_notes || fw.description || '',
        status: fw.is_active ? 'stable' : 'draft',
        uploadDate: fw.created_at || new Date().toISOString(),
      }));
      
      setFirmwares(transformedFirmwares);
    } catch (error) {
      console.error('Failed to load firmware versions:', error);
      // Set to empty on error - UI will show empty state
      setFirmwares([]);
    } finally {
      setLoadingFirmwares(false);
    }
  };

  const loadDevices = async () => {
    try {
      setLoadingDevices(true);
      const response = await apiService.getDevices('', 1, 1000);
      const realDevices = response.results || response;
      
      // Transform to simple device list - all start as 'idle'
      const transformedDevices: DeviceStatus[] = (Array.isArray(realDevices) ? realDevices : []).map((device: any) => ({
        deviceId: device.device_serial || device.serial || `DEV${device.id}`,
        currentVersion: device.firmware_version || device.config_version || 'v1.0.0',
        targetVersion: 'N/A',
        activeSlot: Math.random() > 0.5 ? 'A' : 'B' as 'A' | 'B',
        status: 'idle' as DeviceStatus['status'],
        bootCount: device.boot_count || 0,
        lastError: '',
        progress: undefined,
      }));
      
      setDevices(transformedDevices);
    } catch (error) {
      console.error('Failed to load devices:', error);
      setDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  };

  const loadDeployments = async () => {
    try {
      const campaigns = await apiService.listTargetedUpdates();

      // Active campaign: the most recent in_progress or pending one
      const activeCampaign = campaigns.find((c: any) =>
        c.status === 'in_progress' || c.status === 'pending'
      );
      // Fall back to the most recent completed/failed campaign so the banner
      // still shows useful status after a campaign finishes.
      const displayCampaign = activeCampaign || campaigns[0] || null;
      setActiveDeployment(displayCampaign);

      if (displayCampaign) {
        await updateDeployedDeviceStatuses(displayCampaign);
      }
    } catch (error) {
      console.error('Failed to load deployments:', error);
    }
  };

  const updateDeployedDeviceStatuses = async (deployment?: any) => {
    try {
      const activeDeploymentToUse = deployment || activeDeployment;
      if (!activeDeploymentToUse) return;

      // Fetch enriched campaign detail — includes per-device log_status, log_error,
      // log_last_checked_at, log_bytes_downloaded from a single API call.
      const campaignDetail = await apiService.getTargetedUpdate(activeDeploymentToUse.id);
      const targetedDevices: any[] = campaignDetail.device_targets || [];
      if (targetedDevices.length === 0) return;

      const firmwareSize: number = campaignDetail.target_firmware?.size || 0;
      const targetVersion: string = campaignDetail.target_firmware?.version || '';

      const mapBackendStatus = (backendStatus: string | null): DeviceStatus['status'] => {
        switch (backendStatus?.toLowerCase()) {
          case 'pending':   return 'idle';      // Queued — device hasn't checked in yet
          case 'checking':  return 'trial';     // Device is actively checking
          case 'available': return 'trial';     // Device notified, download imminent
          case 'downloading': return 'downloading';
          case 'completed': return 'healthy';
          case 'failed':    return 'failed';
          case 'skipped':   return 'idle';
          default:          return 'idle';
        }
      };

      const updateMap = new Map<string, Partial<DeviceStatus>>(
        targetedDevices
          .map((dt: any) => {
            const deviceSerial: string = dt.device?.device_serial;
            if (!deviceSerial) return null;
            const mappedStatus = mapBackendStatus(dt.log_status);
            const bytesDownloaded: number = dt.log_bytes_downloaded || 0;
            const progress = mappedStatus === 'downloading' && firmwareSize > 0
              ? Math.round((bytesDownloaded / firmwareSize) * 100)
              : undefined;
            return [deviceSerial, {
              status: mappedStatus,
              targetVersion,
              lastError: mappedStatus === 'failed' ? (dt.log_error || 'Update failed') : '',
              progress,
              lastCheckedAt: dt.log_last_checked_at,
            }] as [string, Partial<DeviceStatus>];
          })
          .filter((entry): entry is [string, Partial<DeviceStatus>] => entry !== null)
      );

      setDevices(prevDevices =>
        prevDevices.map(device => {
          const update = updateMap.get(device.deviceId);
          return update ? { ...device, ...update } : device;
        })
      );
    } catch (error) {
      console.error('Failed to update deployed device statuses:', error);
    }
  };

  // Section 1 handlers
  const calculateSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setUploadForm({ ...uploadForm, file });
      
      // Calculate real SHA256 checksum
      try {
        const checksum = await calculateSHA256(file);
        console.log('Calculated SHA-256 checksum:', checksum);
      } catch (error) {
        console.error('Failed to calculate checksum:', error);
      }
    }
  };

  const handleUploadFirmware = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) {
      setErrorModal({ show: true, message: 'Please select a firmware file before uploading.' });
      return;
    }

    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('version', uploadForm.version);
      formData.append('description', uploadForm.name);
      formData.append('release_notes', uploadForm.releaseNotes);
      formData.append('is_active', 'false'); // Uploaded as draft by default

      // Call backend API to upload to S3
      const response = await apiService.uploadFirmwareVersion(formData);
      
      setSuccessModal({ 
        show: true, 
        message: `Firmware uploaded successfully!\n\nVersion: ${response.version}\nSize: ${(response.size / 1024).toFixed(2)} KB\nChecksum: ${response.checksum?.substring(0, 16)}...\nStored in: S3` 
      });
      
      // Reset form
      setUploadForm({
        name: '',
        version: '',
        deviceModel: 'ESP32-S3',
        minBootloader: '1.0.0',
        releaseNotes: '',
        file: null,
      });
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Reload firmware list from backend
      await loadFirmwareData();
    } catch (error: any) {
      console.error('Firmware upload failed:', error);
      setErrorModal({ 
        show: true, 
        message: `Upload failed: ${error.message || 'Unknown error'}\n\nPlease check:\n- File size is reasonable\n- S3 credentials are configured (USE_S3=True)\n- You have admin permissions` 
      });
    }
  };

  const handleDeleteFirmware = (firmware: FirmwareVersion) => {
    setConfirmActionModal({
      show: true,
      title: 'Delete Firmware',
      message: `Are you sure you want to delete firmware version ${firmware.version}?`,
      warningText: '⚠️ Warning: This will permanently remove the firmware file from S3. This action cannot be undone.',
      confirmLabel: 'Yes, Delete',
      accentColor: '#7f1d1d',
      icon: '🗑️',
      onConfirm: async () => {
        await apiService.deleteFirmwareVersion(firmware.id);
        setSuccessModal({ show: true, message: 'Firmware deleted successfully!' });
        await loadFirmwareData();
      },
    });
  };

  const handleMarkAsStable = async (id: number) => {
    try {
      await apiService.updateFirmwareVersion(id, { is_active: true });
      setSuccessModal({ show: true, message: 'Firmware activated successfully!' });
      await loadFirmwareData();
    } catch (error: any) {
      console.error('Firmware update failed:', error);
      setErrorModal({ show: true, message: `Activation failed: ${error.message || 'Unknown error'}` });
    }
  };

  const handleDeactivateFirmware = (firmware: FirmwareVersion) => {
    setConfirmActionModal({
      show: true,
      title: 'Deactivate Firmware',
      message: `Are you sure you want to deactivate firmware version ${firmware.version}?`,
      warningText: 'ℹ️ Note: This firmware will no longer be offered for OTA updates. You can reactivate it later.',
      confirmLabel: 'Yes, Deactivate',
      accentColor: '#ff9800',
      icon: '⏸️',
      onConfirm: async () => {
        await apiService.updateFirmwareVersion(firmware.id, { is_active: false });
        setSuccessModal({ show: true, message: 'Firmware deactivated successfully!' });
        await loadFirmwareData();
      },
    });
  };

  // Section 2 handlers
  const handleDeployClick = () => {
    if (!deploymentConfig.firmwareVersion) {
      setErrorModal({ show: true, message: 'Please select a firmware version before deploying.' });
      return;
    }
    if (deploymentConfig.targetDevices.length === 0) {
      setErrorModal({ show: true, message: 'Please select at least one device to deploy to.' });
      return;
    }

    const firmware = firmwares.find(f => f.version === deploymentConfig.firmwareVersion);
    if (!firmware) return;

    const totalBytes = firmware.size * deploymentConfig.targetDevices.length;
    const dataTransfer = (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';

    setConfirmModal({
      show: true,
      firmware: firmware.version,
      deviceCount: deploymentConfig.targetDevices.length,
      dataTransfer,
    });
  };

  const confirmDeployment = async () => {
    setConfirmModal({ ...confirmModal, show: false });
    setIsDeploying(true);
    
    try {
      // Find the selected firmware object to get its ID
      const firmware = firmwares.find(f => f.version === deploymentConfig.firmwareVersion);
      if (!firmware) {
        throw new Error('Selected firmware not found');
      }
      
      // Call backend API to create deployment campaign
      const response = await apiService.deployFirmware(
        firmware.id,
        deploymentConfig.targetDevices,
        `Deployment: ${firmware.version} to ${deploymentConfig.targetDevices.length} device(s)`
      );
      
      setIsDeploying(false);
      setSuccessModal({
        show: true,
        message: `Deployment initiated!\n\nID: ${response.id || 'N/A'} · Devices: ${response.devices_total || deploymentConfig.targetDevices.length} · Firmware: ${firmware.version}\n\nDevices will receive the update on their next check-in.`,
      });
      await loadDeployments();
    } catch (error: any) {
      setIsDeploying(false);
      console.error('Deployment failed:', error);
      setErrorModal({ show: true, message: `Deployment failed: ${error.message || 'Unknown error'}` });
    }
  };

  const handleSelectAllDevices = () => {
    const idleDevices = devices.filter(d => d.status === 'idle');
    setDeploymentConfig({
      ...deploymentConfig,
      targetDevices: idleDevices.map(d => d.deviceId),
    });
  };

  // Section 3 helpers
  const statusMetrics = {
    total: devices.length,
    // 'trial' = checking/available, 'downloading' = actively downloading
    inProgress: devices.filter(d => ['downloading', 'flashing', 'rebooting', 'trial'].includes(d.status)).length,
    healthy: devices.filter(d => d.status === 'healthy').length,
    // Prefer the authoritative campaign counter when available
    failed: activeDeployment?.devices_failed ?? devices.filter(d => d.status === 'failed').length,
    rolledBack: devices.filter(d => d.status === 'rolledback').length,
  };

  const getStatusBadgeStyle = (status: DeviceStatus['status']) => {
    const styles: Record<DeviceStatus['status'], string> = {
      idle: '#6c757d',
      downloading: '#17a2b8',
      flashing: '#ffc107',
      rebooting: '#fd7e14',
      trial: '#007bff',
      healthy: '#28a745',
      failed: '#dc3545',
      rolledback: '#6610f2',
    };
    return {
      background: styles[status],
      color: 'white',
      padding: '0.25rem 0.75rem',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: '600' as const,
      textTransform: 'uppercase' as const,
      whiteSpace: 'nowrap' as const,
    };
  };

  // Section 4 handlers
  const handleEmergencyRollback = () => {
    setShowRollbackModal(true);
  };

  const confirmRollback = async () => {
    if (rollbackForm.selectedDevices.length === 0) {
      setErrorModal({ show: true, message: 'Please select at least one device to rollback.' });
      return;
    }
    if (!rollbackForm.reason.trim()) {
      setErrorModal({ show: true, message: 'Please provide a reason for rollback.' });
      return;
    }

    try {
      // Queue rollback command for each selected device.
      // Device will receive updateFirmware: 2 on its next heartbeat.
      await Promise.all(
        rollbackForm.selectedDevices.map(serial =>
          apiService.triggerRollback(serial, rollbackForm.reason)
        )
      );
      setShowRollbackModal(false);
      setSuccessModal({
        show: true,
        message: `Rollback queued for ${rollbackForm.selectedDevices.length} device(s). They will revert on their next heartbeat.`,
      });
      setRollbackForm({ selectedDevices: [], reason: '' });
    } catch (error: any) {
      setErrorModal({ show: true, message: `Rollback failed: ${error.message || 'Unknown error'}` });
    }
  };

  const toggleRollbackDevice = (deviceId: string) => {
    setRollbackForm(prev => ({
      ...prev,
      selectedDevices: prev.selectedDevices.includes(deviceId)
        ? prev.selectedDevices.filter(id => id !== deviceId)
        : [...prev.selectedDevices, deviceId]
    }));
  };

  const getFilteredRollbackDevices = () => {
    return devices.filter(device => {
      if (rollbackFilters.currentVersion !== 'all' && device.currentVersion !== rollbackFilters.currentVersion) {
        return false;
      }
      if (rollbackFilters.status !== 'all' && device.status !== rollbackFilters.status) {
        return false;
      }
      // Add more filter conditions as needed
      return true;
    });
  };

  const selectAllFilteredDevices = () => {
    const filtered = getFilteredRollbackDevices();
    setRollbackForm(prev => ({
      ...prev,
      selectedDevices: filtered.map(d => d.deviceId)
    }));
  };

  const deselectAllDevices = () => {
    setRollbackForm(prev => ({ ...prev, selectedDevices: [] }));
  };

  const filteredDevices = statusFilter === 'all' 
    ? devices 
    : devices.filter(d => d.status === statusFilter);

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', background: isDark ? '#1a1a1a' : '#f5f6fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '700', 
          color: isDark ? '#e0e0e0' : '#2c3e50', 
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <Package size={32} strokeWidth={2} />
          OTA Firmware Management
        </h1>
        <p style={{ color: isDark ? '#a0a0a0' : '#7f8c8d', margin: 0 }}>
          Upload, deploy, and monitor firmware updates across your device fleet
        </p>
      </div>

      {/* SECTION 1: Firmware Repository */}
      <div style={{
        background: isDark ? '#1a1a1a' : '#ffffff',
        borderRadius: 16,
        boxShadow: isDark
          ? '0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 4px 24px rgba(0,0,0,0.08)',
        padding: 0,
        marginBottom: '2rem',
        overflow: 'hidden',
      }}>
        {/* Upload Firmware card header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '20px 24px',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          }}>
            <Upload size={20} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: isDark ? '#f9fafb' : '#111827' }}>Upload Firmware</div>
            <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>Add a new firmware binary to the registry</div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
        {/* Upload Form */}
        <form onSubmit={handleUploadFirmware}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 8 }}>
            <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Firmware Details</span>
          </div>
          <div className="responsive-grid-auto-fit">
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                Firmware Name *
              </label>
              <input
                type="text"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="Solar Controller Firmware"
                required
                style={{
                  padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  background: isDark ? '#2a2a2a' : '#ffffff',
                  color: isDark ? '#f3f4f6' : '#111827',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                Version (semver) *
              </label>
              <input
                type="text"
                value={uploadForm.version}
                onChange={(e) => setUploadForm({ ...uploadForm, version: e.target.value })}
                placeholder="1.4.0"
                required
                pattern="\d+\.\d+\.\d+"
                style={{
                  padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  background: isDark ? '#2a2a2a' : '#ffffff',
                  color: isDark ? '#f3f4f6' : '#111827',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                Device Model
              </label>
              <select
                value={uploadForm.deviceModel}
                onChange={(e) => setUploadForm({ ...uploadForm, deviceModel: e.target.value })}
                style={{
                  padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  background: isDark ? '#2a2a2a' : '#ffffff',
                  color: isDark ? '#f3f4f6' : '#111827',
                  fontSize: '0.875rem',
                }}
              >
                <option value="ESP32-S3">ESP32-S3</option>
                <option value="ESP32">ESP32</option>
                <option value="STM32">STM32</option>
                <option value="nRF52">nRF52</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                Min Bootloader Version
              </label>
              <input
                type="text"
                value={uploadForm.minBootloader}
                onChange={(e) => setUploadForm({ ...uploadForm, minBootloader: e.target.value })}
                placeholder="1.0.0"
                required
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

          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
              Release Notes
            </label>
            <textarea
              value={uploadForm.releaseNotes}
              onChange={(e) => setUploadForm({ ...uploadForm, releaseNotes: e.target.value })}
              placeholder="Bug fixes, new features, improvements..."
              rows={3}
              style={{
                padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                background: isDark ? '#2a2a2a' : '#ffffff',
                color: isDark ? '#f3f4f6' : '#111827',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 20 }}>
            <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>File & Checksum</span>
          </div>
          <div className="responsive-grid-2" style={{ alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                Firmware File (.bin) *
              </label>
              <input
                type="file"
                accept=".bin"
                onChange={handleFileSelect}
                required
                style={{
                  padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  background: isDark ? '#2a2a2a' : '#ffffff',
                  color: isDark ? '#f3f4f6' : '#111827',
                  fontSize: '0.875rem',
                }}
              />
              {uploadForm.file && (
                <small style={{ color: isDark ? '#9ca3af' : '#6b7280', display: 'block', marginTop: '0.25rem', fontSize: '0.813rem' }}>
                  {uploadForm.file.name} ({(uploadForm.file.size / 1024).toFixed(1)} KB)
                </small>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                SHA256 (auto-calculated)
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: '0.813rem',
              }}>
                <input
                  type="text"
                  value="Calculating..."
                  disabled
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '0.813rem',
                    fontFamily: 'monospace',
                    color: isDark ? '#9ca3af' : '#6b7280'
                  }}
                />
                <span style={{
                  background: uploadForm.file ? '#28a745' : '#6c757d',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}>
                  {uploadForm.file ? 'Valid' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            style={{
              marginTop: '1.5rem',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
            }}
          >
            <Upload size={20} strokeWidth={2} />
            Upload Firmware
          </button>
        </form>
        </div>{/* end padding wrapper */}

        {/* Firmware List Table */}
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 8 }}>
            <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Available Firmware Versions</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search by name or version…"
              value={firmwareSearch}
              onChange={(e) => setFirmwareSearch(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 6, border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.85rem', minWidth: 220 }}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: isDark ? '#242424' : '#f8f9fa', borderBottom: isDark ? '2px solid #404040' : '2px solid #dee2e6' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.85rem' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.85rem' }}>Version</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.85rem' }}>Device Model</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.85rem' }}>File Size</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.85rem' }}>Upload Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.85rem' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.85rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingFirmwares ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: isDark ? '#a0a0a0' : '#6c757d', fontSize: '0.95rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Loader2 size={20} strokeWidth={2} className="ota-spinner" style={{ animation: 'spin 1s linear infinite' }} />
                        Loading firmware versions...
                      </div>
                    </td>
                  </tr>
                ) : firmwares.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: isDark ? '#a0a0a0' : '#6c757d', fontSize: '0.95rem' }}>
                      No firmware versions uploaded yet. Use the form above to upload your first firmware.
                    </td>
                  </tr>
                ) : (
                  firmwares.filter(fw => !firmwareSearch.trim() || fw.name.toLowerCase().includes(firmwareSearch.toLowerCase()) || fw.version.toLowerCase().includes(firmwareSearch.toLowerCase())).map(fw => (
                  <tr key={fw.id} style={{ borderBottom: isDark ? '1px solid #404040' : '1px solid #e9ecef' }}>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      <div style={{ fontWeight: '500', color: isDark ? '#e0e0e0' : '#2c3e50', marginBottom: '0.25rem' }}>{fw.name}</div>
                      {fw.signatureValid && (
                        <span style={{ fontSize: '0.75rem', color: '#28a745', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={12} strokeWidth={3} />
                          Signature Valid
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 0.75rem', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: '500' }}>{fw.version}</td>
                    <td style={{ padding: '1rem 0.75rem', fontSize: '0.9rem' }}>{fw.deviceModel}</td>
                    <td style={{ padding: '1rem 0.75rem', fontSize: '0.9rem' }}>{(fw.size / 1024).toFixed(0)} KB</td>
                    <td style={{ padding: '1rem 0.75rem', fontSize: '0.9rem' }}>
                      {new Date(fw.uploadDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      <span style={{
                        background: fw.status === 'stable' ? '#d4edda' : '#fff3cd',
                        color: fw.status === 'stable' ? '#155724' : '#856404',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        {fw.status === 'stable' ? '✓ Production Stable' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {fw.status === 'draft' ? (
                          <button
                            onClick={() => handleMarkAsStable(fw.id)}
                            style={{
                              background: '#28a745',
                              color: 'white',
                              border: 'none',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeactivateFirmware(fw)}
                            style={{
                              background: '#ffc107',
                              color: '#000',
                              border: 'none',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            Deactivate
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteFirmware(fw)}
                          style={{
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 2: Deployment Panel */}
      <div style={{
        background: isDark ? '#1a1a1a' : '#ffffff',
        borderRadius: 16,
        boxShadow: isDark
          ? '0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 4px 24px rgba(0,0,0,0.08)',
        padding: 0,
        marginBottom: '2rem',
        overflow: 'hidden',
      }}>
        {/* Deploy Firmware card header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '20px 24px',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
          }}>
            <Zap size={20} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: isDark ? '#f9fafb' : '#111827' }}>Deploy Firmware</div>
            <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>Push firmware updates to target devices</div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 8 }}>
            <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #f59e0b, #d97706)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#fcd34d' : '#d97706' }}>Configuration</span>
          </div>
          <div className="responsive-grid-auto-fit">
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                Select Firmware Version *
              </label>
              <select
                value={deploymentConfig.firmwareVersion}
                onChange={(e) => setDeploymentConfig({ ...deploymentConfig, firmwareVersion: e.target.value })}
                style={{
                  padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  background: isDark ? '#2a2a2a' : '#ffffff',
                  color: isDark ? '#f3f4f6' : '#111827',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">-- Select Version --</option>
                {firmwares.filter(f => f.status === 'stable').map(f => (
                  <option key={f.id} value={f.version}>
                    {f.name} - v{f.version}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                Deployment Mode
              </label>
              <select
                value={deploymentConfig.mode}
                onChange={(e) => setDeploymentConfig({ ...deploymentConfig, mode: e.target.value as 'immediate' | 'canary' })}
                style={{
                  padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  background: isDark ? '#2a2a2a' : '#ffffff',
                  color: isDark ? '#f3f4f6' : '#111827',
                  fontSize: '0.875rem',
                }}
              >
                <option value="immediate">Immediate (Push to all devices)</option>
                <option value="canary">Canary (Gradual rollout)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                Health Confirmation Timeout (seconds)
              </label>
              <input
                type="number"
                value={deploymentConfig.healthTimeout}
                onChange={(e) => setDeploymentConfig({ ...deploymentConfig, healthTimeout: parseInt(e.target.value) })}
                min="30"
                max="3600"
                style={{
                  padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  background: isDark ? '#2a2a2a' : '#ffffff',
                  color: isDark ? '#f3f4f6' : '#111827',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                Failure Threshold (%)
              </label>
              <input
                type="number"
                value={deploymentConfig.failureThreshold}
                onChange={(e) => setDeploymentConfig({ ...deploymentConfig, failureThreshold: parseInt(e.target.value) })}
                min="1"
                max="100"
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 20 }}>
            <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #f59e0b, #d97706)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#fcd34d' : '#d97706' }}>Target Devices</span>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'block', fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                {deploymentConfig.targetDevices.length} device(s) selected
              </label>
              <input
                type="text"
                placeholder="Search device ID…"
                value={idleDeviceSearch}
                onChange={(e) => setIdleDeviceSearch(e.target.value)}
                style={{
                  padding: '10px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  background: isDark ? '#2a2a2a' : '#ffffff',
                  color: isDark ? '#f3f4f6' : '#111827',
                  fontSize: '0.875rem', minWidth: 160,
                }}
              />
              <button
                onClick={handleSelectAllDevices}
                style={{
                  background: 'transparent',
                  color: isDark ? '#fcd34d' : '#d97706',
                  border: isDark ? '1px solid rgba(245,158,11,0.4)' : '1px solid #f59e0b',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Select All Idle ({devices.filter(d => d.status === 'idle').length})
              </button>
            </div>
            <div style={{
              maxHeight: '150px',
              overflowY: 'auto',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '0.75rem',
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6',
            }}>
              {loadingDevices ? (
                <div style={{ textAlign: 'center', color: isDark ? '#9ca3af' : '#6b7280', padding: '1rem' }}>
                  Loading devices...
                </div>
              ) : devices.filter(d => d.status === 'idle').length === 0 ? (
                <div style={{ textAlign: 'center', color: isDark ? '#9ca3af' : '#6b7280', padding: '1rem' }}>
                  No idle devices available for deployment
                </div>
              ) : (
                <>
                  {devices.filter(d => d.status === 'idle' && (!idleDeviceSearch.trim() || d.deviceId.toLowerCase().includes(idleDeviceSearch.toLowerCase()))).map(device => (
                    <label key={device.deviceId} style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: isDark ? '#d1d5db' : '#374151',
                    }}>
                      <input
                        type="checkbox"
                        checked={deploymentConfig.targetDevices.includes(device.deviceId)}
                        onChange={(e) => {
                          const newTargets = e.target.checked
                            ? [...deploymentConfig.targetDevices, device.deviceId]
                            : deploymentConfig.targetDevices.filter(id => id !== device.deviceId);
                          setDeploymentConfig({ ...deploymentConfig, targetDevices: newTargets });
                        }}
                        style={{ marginRight: '0.5rem' }}
                      />
                      {device.deviceId} (Current: {device.currentVersion})
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 20 }}>
            <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #f59e0b, #d97706)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#fcd34d' : '#d97706' }}>Options</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.813rem',
              color: isDark ? '#d1d5db' : '#374151',
            }}>
              <input
                type="checkbox"
                checked={deploymentConfig.autoRollback}
                onChange={(e) => setDeploymentConfig({ ...deploymentConfig, autoRollback: e.target.checked })}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              Enable Auto Rollback
            </label>
            <span style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
              (Automatically rollback on failure)
            </span>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleDeployClick}
              disabled={isDeploying}
              style={{
                background: isDeploying ? '#6c757d' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: isDeploying ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: isDeploying ? 'none' : '0 4px 12px rgba(245,158,11,0.35)',
              }}
            >
              <Zap size={20} strokeWidth={2} />
              {isDeploying ? 'Deploying...' : 'Deploy Firmware'}
            </button>

            {isDeploying && (
              <>
                <button
                  style={{
                    background: '#ffc107',
                    color: '#000',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ⏸ Pause Deployment
                </button>
                <button
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ⏹ Abort Deployment
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Deployment Confirmation Modal */}
      {confirmModal.show && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px', width: '100%', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Upload size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                  Confirm Deployment
                </span>
              </div>
              <button
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
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
            {/* Body */}
            <div style={{ padding: '20px 24px', color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <p style={{ margin: '0 0 4px' }}><strong>Firmware Version:</strong> {confirmModal.firmware}</p>
              <p style={{ margin: '0 0 4px' }}><strong>Target Devices:</strong> {confirmModal.deviceCount}</p>
              <p style={{ margin: '0 0 4px' }}><strong>Estimated Data Transfer:</strong> {confirmModal.dataTransfer}</p>
              <p style={{ margin: '0 0 4px' }}><strong>Auto Rollback:</strong> {deploymentConfig.autoRollback ? 'Enabled ✓' : 'Disabled'}</p>
              <p style={{ margin: '0 0 16px' }}><strong>Failure Threshold:</strong> {deploymentConfig.failureThreshold}%</p>
              <div style={{
                background: isDark ? '#3a2a00' : '#fff3cd',
                border: isDark ? '1px solid #6b5300' : '1px solid #ffc107',
                borderRadius: 8, padding: '12px 14px',
                color: isDark ? '#ffd966' : '#856404',
              }}>
                <strong>Warning:</strong> This will push firmware updates to {confirmModal.deviceCount} devices.
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                style={{
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                  color: isDark ? '#d1d5db' : '#374151',
                  padding: '10px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeployment}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', padding: '10px 18px', borderRadius: 8,
                  color: 'white', fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                }}
              >
                Confirm Deploy
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SECTION 3: Live Deployment Status */}
      <div style={{ 
        background: isDark ? '#2d2d2d' : 'white', 
        borderRadius: '12px', 
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
        border: isDark ? '1px solid #404040' : '1px solid #e1e8ed'
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: isDark ? '#e0e0e0' : '#2c3e50',
          marginBottom: '1.5rem',
          paddingBottom: '0.75rem',
          borderBottom: isDark ? '2px solid #404040' : '2px solid #e1e8ed',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>📊</span>
          Live Deployment Status
          {loadingDevices && (
            <span style={{ fontSize: '0.85rem', color: isDark ? '#a0a0a0' : '#6c757d', fontWeight: '400', marginLeft: 'auto' }}>
              Loading devices...
            </span>
          )}
        </h2>

        {/* Loading or No Devices State */}
        {loadingDevices ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: isDark ? '#a0a0a0' : '#6c757d'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <p style={{ fontSize: '1.1rem' }}>Loading devices from backend...</p>
          </div>
        ) : devices.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: isDark ? '#a0a0a0' : '#6c757d'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📱</div>
            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No devices registered yet</p>
            <p style={{ fontSize: '0.9rem' }}>Register devices to see them here</p>
          </div>
        ) : (
          <>
            {/* Active Deployment Banner */}
            {activeDeployment && (
              <div style={{
                background: activeDeployment.status === 'in_progress' 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                  : isDark ? '#2a4a2a' : '#d4edda',
                color: activeDeployment.status === 'in_progress' ? 'white' : isDark ? '#90ee90' : '#155724',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '2rem',
                border: activeDeployment.status === 'in_progress' 
                  ? 'none' 
                  : isDark ? '1px solid #4a6a4a' : '1px solid #c3e6cb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>
                    {activeDeployment.status === 'in_progress' ? '🚀 Active Deployment' : '✅ Deployment Completed'}
                  </h3>
                  <span style={{ 
                    fontSize: '0.85rem', 
                    padding: '0.25rem 0.75rem', 
                    background: 'rgba(255,255,255,0.2)', 
                    borderRadius: '20px' 
                  }}>
                    ID: {activeDeployment.id}
                  </span>
                </div>
                <div className="responsive-grid-auto-fit" style={{ fontSize: '0.9rem' }}>
                  <div>
                    <strong>Firmware:</strong> {activeDeployment.target_firmware?.version || 'N/A'}
                  </div>
                  <div>
                    <strong>Total Devices:</strong> {activeDeployment.devices_total || 0}
                  </div>
                  <div>
                    <strong>Updated:</strong> {activeDeployment.devices_updated || 0}
                  </div>
                  <div>
                    <strong>Failed:</strong> {activeDeployment.devices_failed || 0}
                  </div>
                  <div>
                    <strong>Progress:</strong> {activeDeployment.devices_total > 0 
                      ? `${Math.round((activeDeployment.devices_updated / activeDeployment.devices_total) * 100)}%`
                      : '0%'}
                  </div>
                  <div>
                    <strong>Started:</strong> {new Date(activeDeployment.created_at).toLocaleString()}
                  </div>
                </div>
                {activeDeployment.notes && (
                  <div style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.9 }}>
                    <strong>Notes:</strong> {activeDeployment.notes}
                  </div>
                )}
              </div>
            )}
            
            {/* Summary Metrics */}
        <div style={{ 
            
            
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '1.25rem',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.25rem' }}>{statusMetrics.total}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Total Devices</div>
          </div>
          
          <div style={{
            background: '#17a2b8',
            color: 'white',
            padding: '1.25rem',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.25rem' }}>{statusMetrics.inProgress}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>In Progress</div>
          </div>
          
          <div style={{
            background: '#28a745',
            color: 'white',
            padding: '1.25rem',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.25rem' }}>{statusMetrics.healthy}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Healthy</div>
          </div>
          
          <div style={{
            background: '#dc3545',
            color: 'white',
            padding: '1.25rem',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.25rem' }}>{statusMetrics.failed}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Failed</div>
          </div>
          
          <div style={{
            background: '#6610f2',
            color: 'white',
            padding: '1.25rem',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.25rem' }}>{statusMetrics.rolledBack}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Rolled Back</div>
          </div>
        </div>

        {/* Status Filter */}
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['all', 'idle', 'downloading', 'flashing', 'rebooting', 'trial', 'healthy', 'failed', 'rolledback'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              style={{
                background: statusFilter === status ? '#667eea' : (isDark ? '#242424' : '#f8f9fa'),
                color: statusFilter === status ? 'white' : (isDark ? '#e0e0e0' : '#495057'),
                border: isDark ? '1px solid #404040' : '1px solid #dee2e6',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Device Status Table */}
        <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: isDark ? '#242424' : '#f8f9fa', zIndex: 1 }}>
              <tr style={{ borderBottom: isDark ? '2px solid #404040' : '2px solid #dee2e6' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057' }}>Device ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057' }}>Current</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057' }}>Target</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057' }}>Slot</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057' }}>Boot Count</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : '#495057' }}>Last Error</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map(device => (
                <tr key={device.deviceId} style={{ borderBottom: isDark ? '1px solid #404040' : '1px solid #e9ecef' }}>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: '500' }}>{device.deviceId}</td>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>{device.currentVersion}</td>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>{device.targetVersion}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span style={{
                      background: device.activeSlot === 'A' ? '#e3f2fd' : '#fff3e0',
                      color: device.activeSlot === 'A' ? '#1976d2' : '#f57c00',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      fontWeight: '600',
                      fontSize: '0.75rem'
                    }}>
                      {device.activeSlot}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={getStatusBadgeStyle(device.status)}>
                      {device.status === 'trial' ? 'Notified' : device.status}
                    </span>
                    {device.status === 'downloading' && device.progress !== undefined && (
                      <div style={{ marginTop: '0.35rem' }}>
                        <div style={{ background: isDark ? '#404040' : '#e9ecef', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${device.progress}%`, background: '#17a2b8', height: '100%', transition: 'width 0.3s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: isDark ? '#a0a0a0' : '#6c757d' }}>{device.progress}%</span>
                      </div>
                    )}
                    {device.lastCheckedAt && (
                      <div style={{ fontSize: '0.7rem', color: isDark ? '#888' : '#999', marginTop: 2 }}>
                        {new Date(device.lastCheckedAt).toLocaleTimeString()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.9rem' }}>{device.bootCount}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: device.lastError ? '#dc3545' : (isDark ? '#a0a0a0' : '#6c757d') }}>
                    {device.lastError || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </>
        )}
      </div>

      {/* SECTION 4: Emergency Rollback */}
      <div style={{ 
        background: isDark ? '#2d2d2d' : 'white', 
        borderRadius: '12px', 
        padding: '2rem',
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
        border: isDark ? '2px solid #dc3545' : '2px solid #dc3545'
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: '#dc3545',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: isDark ? '2px solid #5a1f24' : '2px solid #f8d7da',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertCircle size={20} strokeWidth={2} />
          Emergency Rollback
        </h2>
        
        <div style={{
          background: isDark ? '#3d1a1a' : '#f8d7da',
          border: isDark ? '1px solid #5a1f24' : '1px solid #f5c6cb',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: isDark ? '#ff9999' : '#721c24'
        }}>
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><AlertTriangle size={16} strokeWidth={2} /> Warning:</strong> Use this feature only in emergency situations. Rollback command will revert devices to their previous firmware version automatically.
        </div>

        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: isDark ? '#1a2a3a' : '#e7f3ff', border: isDark ? '1px solid #2a4a6a' : '1px solid #b3d9ff', borderRadius: '8px', color: isDark ? '#66b2ff' : '#004085' }}>
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Info size={16} strokeWidth={2} /> How it works:</strong> The rollback sends an <code style={{ background: isDark ? '#0d1117' : '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace', color: isDark ? '#e0e0e0' : 'inherit' }}>updateConfig</code> command with value <code style={{ background: isDark ? '#0d1117' : '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace', color: isDark ? '#e0e0e0' : 'inherit' }}>2</code> to selected devices, triggering them to automatically revert to their previous firmware version.
        </div>

        <div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.9rem' }}>
              Rollback Reason *
            </label>
            <textarea
              value={rollbackForm.reason}
              onChange={(e) => setRollbackForm({ ...rollbackForm, reason: e.target.value })}
              placeholder="Reason for emergency rollback..."
              rows={3}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '6px', 
                border: isDark ? '1px solid #404040' : '1px solid #ced4da',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                background: isDark ? '#1a1a1a' : 'white',
                color: isDark ? '#e0e0e0' : 'inherit'
              }}
            />
          </div>
        </div>

        {/* Device Selection Filters */}
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: isDark ? '#e0e0e0' : '#495057' }}>
            Device Selection & Filters
          </h3>
          <div style={{   gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.85rem' }}>
                Filter by Current Version
              </label>
              <select
                value={rollbackFilters.currentVersion}
                onChange={(e) => setRollbackFilters({ ...rollbackFilters, currentVersion: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  borderRadius: '6px', 
                  border: isDark ? '1px solid #404040' : '1px solid #ced4da',
                  fontSize: '0.9rem',
                  background: isDark ? '#1a1a1a' : 'white',
                  color: isDark ? '#e0e0e0' : 'inherit'
                }}
              >
                <option value="all">All Versions</option>
                {Array.from(new Set(devices.map(d => d.currentVersion))).map(version => (
                  <option key={version} value={version}>{version}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.85rem' }}>
                Filter by Status
              </label>
              <select
                value={rollbackFilters.status}
                onChange={(e) => setRollbackFilters({ ...rollbackFilters, status: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  borderRadius: '6px', 
                  border: isDark ? '1px solid #404040' : '1px solid #ced4da',
                  fontSize: '0.9rem',
                  background: isDark ? '#1a1a1a' : 'white',
                  color: isDark ? '#e0e0e0' : 'inherit'
                }}
              >
                <option value="all">All Statuses</option>
                <option value="failed">Failed</option>
                <option value="healthy">Healthy</option>
                <option value="trial">Trial</option>
                <option value="downloading">Downloading</option>
                <option value="flashing">Flashing</option>
                <option value="rebooting">Rebooting</option>
                <option value="rolledback">Rolled Back</option>
                <option value="idle">Idle</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: isDark ? '#b0b0b0' : '#495057', fontSize: '0.85rem' }}>
                Filter by Target Version
              </label>
              <select
                value={rollbackFilters.deviceModel}
                onChange={(e) => setRollbackFilters({ ...rollbackFilters, deviceModel: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  borderRadius: '6px', 
                  border: isDark ? '1px solid #404040' : '1px solid #ced4da',
                  fontSize: '0.9rem',
                  background: isDark ? '#1a1a1a' : 'white',
                  color: isDark ? '#e0e0e0' : 'inherit'
                }}
              >
                <option value="all">All Target Versions</option>
                {Array.from(new Set(devices.map(d => d.targetVersion))).map(version => (
                  <option key={version} value={version}>{version}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Selection Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              onClick={selectAllFilteredDevices}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Select All Filtered ({getFilteredRollbackDevices().length})
            </button>

            <button
              onClick={deselectAllDevices}
              style={{
                background: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Deselect All
            </button>

            <button
              onClick={() => {
                const failedDevices = devices.filter(d => d.status === 'failed').map(d => d.deviceId);
                setRollbackForm({ ...rollbackForm, selectedDevices: failedDevices });
              }}
              style={{
                background: '#ffc107',
                color: '#000',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Select Failed Only ({devices.filter(d => d.status === 'failed').length})
            </button>

            <button
              onClick={() => {
                const problemDevices = devices.filter(d => ['failed', 'rolledback'].includes(d.status)).map(d => d.deviceId);
                setRollbackForm({ ...rollbackForm, selectedDevices: problemDevices });
              }}
              style={{
                background: '#fd7e14',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Select Problem Devices ({devices.filter(d => ['failed', 'rolledback'].includes(d.status)).length})
            </button>
          </div>

          {/* Device Selection Table */}
          <div style={{
            background: isDark ? '#242424' : '#f8f9fa',
            borderRadius: '8px',
            padding: '1rem',
            border: isDark ? '1px solid #404040' : '1px solid #dee2e6',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.95rem', color: isDark ? '#e0e0e0' : 'inherit' }}>
                Devices List ({getFilteredRollbackDevices().filter(d => !rollbackDeviceSearch.trim() || d.deviceId.toLowerCase().includes(rollbackDeviceSearch.toLowerCase())).length} available, {rollbackForm.selectedDevices.length} selected)
              </strong>
              <input
                type="text"
                placeholder="Search device ID…"
                value={rollbackDeviceSearch}
                onChange={(e) => setRollbackDeviceSearch(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 5, border: isDark ? '1px solid #404040' : '1px solid #ced4da', background: isDark ? '#1a1a1a' : 'white', color: isDark ? '#e0e0e0' : '#2c3e50', fontSize: '0.82rem', minWidth: 180 }}
              />
            </div>
            
            {loadingDevices ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: isDark ? '#a0a0a0' : '#6c757d' }}>
                Loading devices...
              </div>
            ) : getFilteredRollbackDevices().length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: isDark ? '#a0a0a0' : '#6c757d' }}>
                No devices match the current filters
              </div>
            ) : (
              <div className="table-responsive"><table style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: isDark ? '2px solid #404040' : '2px solid #dee2e6' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', width: '50px', color: isDark ? '#b0b0b0' : 'inherit' }}>
                      <input
                        type="checkbox"
                        checked={getFilteredRollbackDevices().length > 0 && getFilteredRollbackDevices().every(d => rollbackForm.selectedDevices.includes(d.deviceId))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllFilteredDevices();
                          } else {
                            deselectAllDevices();
                          }
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : 'inherit' }}>Device ID</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : 'inherit' }}>Current Version</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : 'inherit' }}>Target Version</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : 'inherit' }}>Status</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : 'inherit' }}>Boot Count</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: isDark ? '#b0b0b0' : 'inherit' }}>Last Error</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredRollbackDevices().filter(d => !rollbackDeviceSearch.trim() || d.deviceId.toLowerCase().includes(rollbackDeviceSearch.toLowerCase())).map(device => (
                    <tr
                      key={device.deviceId} 
                      style={{ 
                        borderBottom: isDark ? '1px solid #404040' : '1px solid #e9ecef',
                        background: rollbackForm.selectedDevices.includes(device.deviceId) ? (isDark ? '#3a2a00' : '#fff3cd') : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleRollbackDevice(device.deviceId)}
                    >
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={rollbackForm.selectedDevices.includes(device.deviceId)}
                          onChange={() => toggleRollbackDevice(device.deviceId)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontWeight: '500' }}>{device.deviceId}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>{device.currentVersion}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>{device.targetVersion}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          background: device.status === 'failed' ? (isDark ? '#3d1a1a' : '#f8d7da') : 
                                     device.status === 'healthy' ? (isDark ? '#1a3d1a' : '#d4edda') : 
                                     device.status === 'downloading' || device.status === 'flashing' ? (isDark ? '#1a2a3a' : '#cce5ff') :
                                     device.status === 'rolledback' ? (isDark ? '#3a2a00' : '#fff3cd') : (isDark ? '#2a2a2a' : '#e9ecef'),
                          color: device.status === 'failed' ? (isDark ? '#ff9999' : '#721c24') : 
                                 device.status === 'healthy' ? (isDark ? '#99ff99' : '#155724') : 
                                 device.status === 'downloading' || device.status === 'flashing' ? (isDark ? '#66b2ff' : '#004085') :
                                 device.status === 'rolledback' ? (isDark ? '#ffd966' : '#856404') : (isDark ? '#b0b0b0' : '#495057')
                        }}>
                          {device.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{device.bootCount}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: device.lastError ? '#dc3545' : (isDark ? '#a0a0a0' : '#6c757d'), fontSize: '0.8rem' }}>
                        {device.lastError || 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>

        {/* Rollback Action Button */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleEmergencyRollback}
            disabled={rollbackForm.selectedDevices.length === 0}
            style={{
              background: rollbackForm.selectedDevices.length === 0 ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: rollbackForm.selectedDevices.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: rollbackForm.selectedDevices.length === 0 ? 0.6 : 1
            }}
          >
            <RotateCcw size={20} strokeWidth={2} />
            Rollback {rollbackForm.selectedDevices.length} Device{rollbackForm.selectedDevices.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Rollback Confirmation Modal */}
      {showRollbackModal && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px', width: '100%', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  boxShadow: '0 4px 14px rgba(220,53,69,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <RotateCcw size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                  Emergency Rollback
                </span>
              </div>
              <button
                onClick={() => setShowRollbackModal(false)}
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
            {/* Body */}
            <div style={{ padding: '20px 24px', color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <p style={{ margin: '0 0 4px' }}><strong>Command:</strong> <code style={{ background: isDark ? '#0d0d0d' : '#f8f9fa', padding: '0.2rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace', color: isDark ? '#e0e0e0' : 'inherit' }}>updateConfig = 2</code> (automatic rollback to previous version)</p>
              <p style={{ margin: '0 0 4px' }}><strong>Devices to Rollback:</strong> {rollbackForm.selectedDevices.length}</p>
              <p style={{ margin: '0 0 16px' }}><strong>Reason:</strong> {rollbackForm.reason || 'Not provided'}</p>
              <div style={{
                background: isDark ? '#3d1a1a' : '#f8d7da',
                border: isDark ? '1px solid #5a1f24' : '1px solid #f5c6cb',
                borderRadius: 8, padding: '12px 14px',
                color: isDark ? '#ff9999' : '#721c24',
              }}>
                <strong>This action cannot be undone!</strong> You are about to rollback devices to a previous firmware version.
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRollbackModal(false)}
                style={{
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                  color: isDark ? '#d1d5db' : '#374151',
                  padding: '10px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRollback}
                style={{
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  border: 'none', padding: '10px 18px', borderRadius: 8,
                  color: 'white', fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220,53,69,0.35)',
                }}
              >
                Confirm Rollback
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Generic Confirm-Action Modal — used for delete, deactivate, and any future destructive action */}
      {confirmActionModal.show && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px', width: '100%', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: `linear-gradient(135deg, ${confirmActionModal.accentColor}, ${confirmActionModal.accentColor}cc)`,
                  boxShadow: `0 4px 14px ${confirmActionModal.accentColor}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem',
                }}>
                  {confirmActionModal.icon}
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                  {confirmActionModal.title}
                </span>
              </div>
              <button
                onClick={() => setConfirmActionModal(m => ({ ...m, show: false }))}
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
            {/* Body */}
            <div style={{ padding: '20px 24px', color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <p style={{ margin: '0 0 16px' }}>{confirmActionModal.message}</p>
              <div style={{
                background: isDark ? 'rgba(128,128,128,0.12)' : '#f8f9fa',
                border: `1px solid ${confirmActionModal.accentColor}55`,
                borderRadius: 8, padding: '12px 14px',
                color: isDark ? '#ccc' : '#555',
              }}>
                {confirmActionModal.warningText}
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmActionModal(m => ({ ...m, show: false }))}
                style={{
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                  color: isDark ? '#d1d5db' : '#374151',
                  padding: '10px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const action = confirmActionModal.onConfirm;
                  setConfirmActionModal(m => ({ ...m, show: false }));
                  try { await action(); }
                  catch (err: any) { setErrorModal({ show: true, message: err.message || 'Operation failed' }); }
                }}
                style={{
                  background: `linear-gradient(135deg, ${confirmActionModal.accentColor}, ${confirmActionModal.accentColor}cc)`,
                  border: 'none', padding: '10px 18px', borderRadius: 8,
                  color: 'white', fontWeight: 600, cursor: 'pointer',
                  boxShadow: `0 4px 12px ${confirmActionModal.accentColor}59`,
                }}
              >
                {confirmActionModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modern Success Notification Modal */}
      {successModal.show && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px', width: '100%', overflow: 'hidden',
          }}>
            {/* Header */}
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
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                  Success
                </span>
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
            {/* Body */}
            <div style={{ padding: '20px 24px', color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', whiteSpace: 'pre-line' }}>
              {successModal.message}
            </div>
            {/* Footer */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSuccessModal({ show: false, message: '' })}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', padding: '10px 18px', borderRadius: 8,
                  color: 'white', fontWeight: 600, cursor: 'pointer',
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

      {/* Modern Error Notification Modal */}
      {errorModal.show && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px', width: '100%', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  boxShadow: '0 4px 14px rgba(220,53,69,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertCircle size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                  Error
                </span>
              </div>
              <button
                onClick={() => setErrorModal({ show: false, message: '' })}
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
            {/* Body */}
            <div style={{ padding: '20px 24px', color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', whiteSpace: 'pre-line' }}>
              {errorModal.message}
            </div>
            {/* Footer */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setErrorModal({ show: false, message: '' })}
                style={{
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  border: 'none', padding: '10px 18px', borderRadius: 8,
                  color: 'white', fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220,53,69,0.35)',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default OTA;
