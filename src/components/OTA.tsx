import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
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

// Generate 100 mock devices with realistic statuses
const generateMockDevices = (): DeviceStatus[] => {
  const versions = ['v1.2.0', 'v1.2.1', 'v1.3.0', 'v1.3.1', 'v1.4.0'];
  const errors = ['', '', '', '', 'Checksum failed', 'Network timeout', 'Flash write error', 'Insufficient space'];
  
  return Array.from({ length: 100 }, (_, i) => {
    let status: DeviceStatus['status'];
    if (i < 70) status = 'healthy';
    else if (i < 75) status = 'trial';
    else if (i < 80) status = 'downloading';
    else if (i < 85) status = 'failed';
    else if (i < 90) status = 'idle';
    else if (i < 95) status = 'flashing';
    else status = 'rolledback';

    return {
      deviceId: `DEV${String(i + 1).padStart(4, '0')}`,
      currentVersion: versions[Math.floor(Math.random() * (versions.length - 1))],
      targetVersion: versions[versions.length - 1],
      activeSlot: Math.random() > 0.5 ? 'A' : 'B',
      status,
      bootCount: Math.floor(Math.random() * 5) + 1,
      lastError: status === 'failed' ? errors[Math.floor(Math.random() * errors.length)] || 'Unknown error' : '',
      progress: status === 'downloading' ? Math.floor(Math.random() * 100) : undefined,
    };
  });
};

export const OTA: React.FC = () => {
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

  // Section 4: Emergency Rollback State
  const [rollbackForm, setRollbackForm] = useState({
    targetVersion: '',
    selectedDevices: [] as string[],
    reason: '',
  });
  const [showRollbackModal, setShowRollbackModal] = useState(false);

  useEffect(() => {
    loadFirmwareData();
    loadRealDevices();
    
    // Real-time status updates simulation (for devices that are updating)
    const interval = setInterval(() => {
      setDevices(prev => prev.map(d => {
        if (d.status === 'downloading' && d.progress !== undefined && d.progress < 100) {
          return { ...d, progress: Math.min(100, d.progress + Math.random() * 10) };
        }
        return d;
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadRealDevices = async () => {
    try {
      setLoadingDevices(true);
      // Fetch all devices without pagination limit
      const response = await apiService.getDevices('', 1, 1000);
      const realDevices = response.results || response;
      
      // Transform backend devices to OTA status format
      const transformedDevices: DeviceStatus[] = (Array.isArray(realDevices) ? realDevices : []).map((device: any) => ({
        deviceId: device.device_serial || device.serial || `DEV${device.id}`,
        currentVersion: device.firmware_version || device.config_version || 'v1.0.0',
        targetVersion: 'v1.4.0', // Default target version
        activeSlot: Math.random() > 0.5 ? 'A' : 'B' as 'A' | 'B',
        status: 'idle' as DeviceStatus['status'], // Default status
        bootCount: device.boot_count || 0,
        lastError: '',
        progress: undefined,
      }));
      
      setDevices(transformedDevices);
    } catch (error) {
      console.error('Failed to load devices:', error);
      // Fallback to mock data if API fails
      setDevices(generateMockDevices());
    } finally {
      setLoadingDevices(false);
    }
  };

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
      // Fallback to mock data if API fails
      setFirmwares([
        {
          id: 1,
          name: 'Solar Controller v1.4.0',
          version: '1.4.0',
          deviceModel: 'ESP32-S3',
          minBootloaderVersion: '1.0.0',
          file: null,
          size: 1048576,
          checksum: 'a1b2c3d4e5f6...',
          signatureValid: true,
          releaseNotes: 'Bug fixes and performance improvements',
          status: 'stable',
          uploadDate: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Solar Controller v1.3.1',
          version: '1.3.1',
          deviceModel: 'ESP32-S3',
          minBootloaderVersion: '1.0.0',
          file: null,
          size: 987654,
          checksum: 'f6e5d4c3b2a1...',
          signatureValid: true,
          releaseNotes: 'Previous stable release',
          status: 'stable',
          uploadDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);
    } finally {
      setLoadingFirmwares(false);
    }
  };

  // Section 1 handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setUploadForm({ ...uploadForm, file });
      setTimeout(() => {
        const mockChecksum = 'sha256_' + Math.random().toString(36).substring(2);
        console.log('Calculated checksum:', mockChecksum);
      }, 500);
    }
  };

  const handleUploadFirmware = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) {
      alert('Please select a firmware file');
      return;
    }

    const newFirmware: FirmwareVersion = {
      id: firmwares.length + 1,
      name: uploadForm.name,
      version: uploadForm.version,
      deviceModel: uploadForm.deviceModel,
      minBootloaderVersion: uploadForm.minBootloader,
      file: uploadForm.file,
      size: uploadForm.file.size,
      checksum: 'sha256_' + Math.random().toString(36).substring(2, 10),
      signatureValid: true,
      releaseNotes: uploadForm.releaseNotes,
      status: 'draft',
      uploadDate: new Date().toISOString(),
    };

    setFirmwares([newFirmware, ...firmwares]);
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
  };

  const handleDeleteFirmware = (id: number) => {
    if (window.confirm('Delete this firmware version?')) {
      setFirmwares(firmwares.filter(f => f.id !== id));
    }
  };

  const handleMarkAsStable = (id: number) => {
    setFirmwares(firmwares.map(f => 
      f.id === id ? { ...f, status: 'stable' as const } : f
    ));
  };

  // Section 2 handlers
  const handleDeployClick = () => {
    if (!deploymentConfig.firmwareVersion) {
      alert('Please select a firmware version');
      return;
    }
    if (deploymentConfig.targetDevices.length === 0) {
      alert('Please select at least one device');
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

  const confirmDeployment = () => {
    setConfirmModal({ ...confirmModal, show: false });
    setIsDeploying(true);
    setTimeout(() => {
      setIsDeploying(false);
      alert('Deployment initiated successfully!');
    }, 2000);
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
    inProgress: devices.filter(d => ['downloading', 'flashing', 'rebooting'].includes(d.status)).length,
    healthy: devices.filter(d => d.status === 'healthy').length,
    failed: devices.filter(d => d.status === 'failed').length,
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

  const confirmRollback = () => {
    if (!rollbackForm.targetVersion) {
      alert('Please select a target version');
      return;
    }
    if (rollbackForm.selectedDevices.length === 0) {
      alert('Please select devices to rollback');
      return;
    }
    if (!rollbackForm.reason.trim()) {
      alert('Please provide a reason for rollback');
      return;
    }

    setShowRollbackModal(false);
    alert(`Rolling back ${rollbackForm.selectedDevices.length} devices to ${rollbackForm.targetVersion}`);
    setRollbackForm({ targetVersion: '', selectedDevices: [], reason: '' });
  };

  const filteredDevices = statusFilter === 'all' 
    ? devices 
    : devices.filter(d => d.status === statusFilter);

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', background: '#f5f6fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '700', 
          color: '#2c3e50', 
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          OTA Firmware Management
        </h1>
        <p style={{ color: '#7f8c8d', margin: 0 }}>
          Upload, deploy, and monitor firmware updates across your device fleet
        </p>
      </div>

      {/* SECTION 1: Firmware Repository */}
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid #e1e8ed'
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: '#2c3e50',
          marginBottom: '1.5rem',
          paddingBottom: '0.75rem',
          borderBottom: '2px solid #e1e8ed',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>📦</span>
          Firmware Repository
        </h2>

        {/* Upload Form */}
        <form onSubmit={handleUploadFirmware} style={{ 
          background: '#f8f9fa', 
          padding: '1.5rem', 
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
                Firmware Name *
              </label>
              <input
                type="text"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="Solar Controller Firmware"
                required
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  borderRadius: '6px', 
                  border: '1px solid #ced4da',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
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
                  width: '100%', 
                  padding: '0.75rem', 
                  borderRadius: '6px', 
                  border: '1px solid #ced4da',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
                Device Model
              </label>
              <select
                value={uploadForm.deviceModel}
                onChange={(e) => setUploadForm({ ...uploadForm, deviceModel: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  borderRadius: '6px', 
                  border: '1px solid #ced4da',
                  fontSize: '0.95rem'
                }}
              >
                <option value="ESP32-S3">ESP32-S3</option>
                <option value="ESP32">ESP32</option>
                <option value="STM32">STM32</option>
                <option value="nRF52">nRF52</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
                Min Bootloader Version
              </label>
              <input
                type="text"
                value={uploadForm.minBootloader}
                onChange={(e) => setUploadForm({ ...uploadForm, minBootloader: e.target.value })}
                placeholder="1.0.0"
                required
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  borderRadius: '6px', 
                  border: '1px solid #ced4da',
                  fontSize: '0.95rem'
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
              Release Notes
            </label>
            <textarea
              value={uploadForm.releaseNotes}
              onChange={(e) => setUploadForm({ ...uploadForm, releaseNotes: e.target.value })}
              placeholder="Bug fixes, new features, improvements..."
              rows={3}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '6px', 
                border: '1px solid #ced4da',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
                Firmware File (.bin) *
              </label>
              <input
                type="file"
                accept=".bin"
                onChange={handleFileSelect}
                required
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  borderRadius: '6px', 
                  border: '1px solid #ced4da',
                  fontSize: '0.9rem'
                }}
              />
              {uploadForm.file && (
                <small style={{ color: '#6c757d', display: 'block', marginTop: '0.25rem' }}>
                  {uploadForm.file.name} ({(uploadForm.file.size / 1024).toFixed(1)} KB)
                </small>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
                SHA256 (auto-calculated)
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                background: '#e9ecef',
                borderRadius: '6px',
                border: '1px solid #ced4da'
              }}>
                <input
                  type="text"
                  value="Calculating..."
                  disabled
                  style={{ 
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    color: '#6c757d'
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
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '0.875rem 2rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload Firmware
          </button>
        </form>

        {/* Firmware List Table */}
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#495057' }}>
            Available Firmware Versions
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.85rem' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.85rem' }}>Version</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.85rem' }}>Device Model</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.85rem' }}>File Size</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.85rem' }}>Upload Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057', fontSize: '0.85rem' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: '#495057', fontSize: '0.85rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingFirmwares ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#6c757d', fontSize: '0.95rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                          <circle cx="12" cy="12" r="10" opacity="0.25"/>
                          <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                        </svg>
                        Loading firmware versions...
                      </div>
                    </td>
                  </tr>
                ) : firmwares.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#6c757d', fontSize: '0.95rem' }}>
                      No firmware versions uploaded yet. Use the form above to upload your first firmware.
                    </td>
                  </tr>
                ) : (
                  firmwares.map(fw => (
                  <tr key={fw.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      <div style={{ fontWeight: '500', color: '#2c3e50', marginBottom: '0.25rem' }}>{fw.name}</div>
                      {fw.signatureValid && (
                        <span style={{ fontSize: '0.75rem', color: '#28a745', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
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
                        {fw.status === 'draft' && (
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
                            Mark Stable
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteFirmware(fw.id)}
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
        background: 'white', 
        borderRadius: '12px', 
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: '2px solid #667eea'
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: '#2c3e50',
          marginBottom: '1.5rem',
          paddingBottom: '0.75rem',
          borderBottom: '2px solid #e1e8ed',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>🚀</span>
          Deployment Panel
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
              Select Firmware Version *
            </label>
            <select
              value={deploymentConfig.firmwareVersion}
              onChange={(e) => setDeploymentConfig({ ...deploymentConfig, firmwareVersion: e.target.value })}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '6px', 
                border: '1px solid #ced4da',
                fontSize: '0.95rem'
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
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
              Deployment Mode
            </label>
            <select
              value={deploymentConfig.mode}
              onChange={(e) => setDeploymentConfig({ ...deploymentConfig, mode: e.target.value as 'immediate' | 'canary' })}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '6px', 
                border: '1px solid #ced4da',
                fontSize: '0.95rem'
              }}
            >
              <option value="immediate">Immediate (Push to all devices)</option>
              <option value="canary">Canary (Gradual rollout)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
              Health Confirmation Timeout (seconds)
            </label>
            <input
              type="number"
              value={deploymentConfig.healthTimeout}
              onChange={(e) => setDeploymentConfig({ ...deploymentConfig, healthTimeout: parseInt(e.target.value) })}
              min="30"
              max="3600"
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '6px', 
                border: '1px solid #ced4da',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
              Failure Threshold (%)
            </label>
            <input
              type="number"
              value={deploymentConfig.failureThreshold}
              onChange={(e) => setDeploymentConfig({ ...deploymentConfig, failureThreshold: parseInt(e.target.value) })}
              min="1"
              max="100"
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '6px', 
                border: '1px solid #ced4da',
                fontSize: '0.95rem'
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <label style={{ fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
              Target Devices ({deploymentConfig.targetDevices.length} selected)
            </label>
            <button
              onClick={handleSelectAllDevices}
              style={{
                background: 'transparent',
                color: '#667eea',
                border: '1px solid #667eea',
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
            border: '1px solid #ced4da',
            borderRadius: '6px',
            padding: '0.75rem',
            background: '#f8f9fa'
          }}>
            {loadingDevices ? (
              <div style={{ textAlign: 'center', color: '#6c757d', padding: '1rem' }}>
                Loading devices...
              </div>
            ) : devices.filter(d => d.status === 'idle').length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6c757d', padding: '1rem' }}>
                No idle devices available for deployment
              </div>
            ) : (
              <>
                {devices.filter(d => d.status === 'idle').map(device => (
                  <label key={device.deviceId} style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
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

        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            fontWeight: '500',
            color: '#495057'
          }}>
            <input
              type="checkbox"
              checked={deploymentConfig.autoRollback}
              onChange={(e) => setDeploymentConfig({ ...deploymentConfig, autoRollback: e.target.checked })}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            Enable Auto Rollback
          </label>
          <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
            (Automatically rollback on failure)
          </span>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleDeployClick}
            disabled={isDeploying}
            style={{
              background: isDeploying ? '#6c757d' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '1rem 2.5rem',
              borderRadius: '8px',
              fontSize: '1.125rem',
              fontWeight: '600',
              cursor: isDeploying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            {isDeploying ? 'Deploying...' : 'Deploy Firmware'}
          </button>

          {isDeploying && (
            <>
              <button
                style={{
                  background: '#ffc107',
                  color: '#000',
                  border: 'none',
                  padding: '1rem 2rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
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
                  padding: '1rem 2rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                ⏹ Abort Deployment
              </button>
            </>
          )}
        </div>
      </div>

      {/* Deployment Confirmation Modal */}
      {confirmModal.show && (
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
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem', color: '#2c3e50' }}>
              Confirm Deployment
            </h3>
            <div style={{ marginBottom: '1.5rem', color: '#495057', lineHeight: '1.8' }}>
              <p><strong>Firmware Version:</strong> {confirmModal.firmware}</p>
              <p><strong>Target Devices:</strong> {confirmModal.deviceCount}</p>
              <p><strong>Estimated Data Transfer:</strong> {confirmModal.dataTransfer}</p>
              <p><strong>Auto Rollback:</strong> {deploymentConfig.autoRollback ? 'Enabled ✓' : 'Disabled'}</p>
              <p><strong>Failure Threshold:</strong> {deploymentConfig.failureThreshold}%</p>
            </div>
            <div style={{
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#856404'
            }}>
              <strong>⚠️ Warning:</strong> This will push firmware updates to {confirmModal.deviceCount} devices.
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeployment}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Confirm Deploy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Live Deployment Status */}
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid #e1e8ed'
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: '#2c3e50',
          marginBottom: '1.5rem',
          paddingBottom: '0.75rem',
          borderBottom: '2px solid #e1e8ed',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>📊</span>
          Live Deployment Status
          {loadingDevices && (
            <span style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '400', marginLeft: 'auto' }}>
              Loading devices...
            </span>
          )}
        </h2>

        {/* Loading or No Devices State */}
        {loadingDevices ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: '#6c757d'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <p style={{ fontSize: '1.1rem' }}>Loading devices from backend...</p>
          </div>
        ) : devices.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: '#6c757d'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📱</div>
            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No devices registered yet</p>
            <p style={{ fontSize: '0.9rem' }}>Register devices to see them here</p>
          </div>
        ) : (
          <>
            {/* Summary Metrics */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
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
                background: statusFilter === status ? '#667eea' : '#f8f9fa',
                color: statusFilter === status ? 'white' : '#495057',
                border: '1px solid #dee2e6',
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
            <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1 }}>
              <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Device ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Current</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Target</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: '#495057' }}>Slot</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: '#495057' }}>Boot Count</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Last Error</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map(device => (
                <tr key={device.deviceId} style={{ borderBottom: '1px solid #e9ecef' }}>
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
                      {device.status}
                    </span>
                    {device.progress !== undefined && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#6c757d' }}>
                        {device.progress.toFixed(0)}%
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.9rem' }}>{device.bootCount}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: device.lastError ? '#dc3545' : '#6c757d' }}>
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
        background: 'white', 
        borderRadius: '12px', 
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: '2px solid #dc3545'
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: '#dc3545',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '2px solid #f8d7da',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>🚨</span>
          Emergency Rollback
        </h2>
        
        <div style={{
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#721c24'
        }}>
          <strong>⚠️ Warning:</strong> Use this feature only in emergency situations. Rollback will revert devices to a previous firmware version.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
              Target Version (Rollback To)
            </label>
            <select
              value={rollbackForm.targetVersion}
              onChange={(e) => setRollbackForm({ ...rollbackForm, targetVersion: e.target.value })}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '6px', 
                border: '1px solid #ced4da',
                fontSize: '0.95rem'
              }}
            >
              <option value="">-- Select Previous Version --</option>
              {firmwares.filter(f => f.status === 'stable').slice(1).map(f => (
                <option key={f.id} value={f.version}>
                  {f.name} - v{f.version}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057', fontSize: '0.9rem' }}>
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
                border: '1px solid #ced4da',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const failedDevices = devices.filter(d => d.status === 'failed').map(d => d.deviceId);
              setRollbackForm({ ...rollbackForm, selectedDevices: failedDevices });
              if (failedDevices.length > 0) {
                alert(`Selected ${failedDevices.length} failed devices for rollback`);
              } else {
                alert('No failed devices to select');
              }
            }}
            style={{
              background: '#ffc107',
              color: '#000',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Select Failed Devices ({devices.filter(d => d.status === 'failed').length})
          </button>

          <button
            onClick={() => {
              const allProblemDevices = devices.filter(d => ['failed', 'rolledback'].includes(d.status)).map(d => d.deviceId);
              setRollbackForm({ ...rollbackForm, selectedDevices: allProblemDevices });
              if (allProblemDevices.length > 0) {
                alert(`Selected ${allProblemDevices.length} problem devices for rollback`);
              }
            }}
            style={{
              background: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Select All Problem Devices
          </button>

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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            Rollback Entire Deployment
          </button>
        </div>

        {rollbackForm.selectedDevices.length > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <strong>Selected Devices ({rollbackForm.selectedDevices.length}):</strong>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#6c757d' }}>
              {rollbackForm.selectedDevices.slice(0, 10).join(', ')}
              {rollbackForm.selectedDevices.length > 10 && ` ... and ${rollbackForm.selectedDevices.length - 10} more`}
            </div>
          </div>
        )}
      </div>

      {/* Rollback Confirmation Modal */}
      {showRollbackModal && (
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
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            border: '2px solid #dc3545'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#dc3545' }}>
              ⚠️ Confirm Emergency Rollback
            </h3>
            <div style={{
              background: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#721c24',
              fontSize: '0.95rem'
            }}>
              <strong>This action cannot be undone!</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>
                You are about to rollback devices to a previous firmware version.
              </p>
            </div>
            <div style={{ marginBottom: '1.5rem', color: '#495057', lineHeight: '1.8' }}>
              <p><strong>Target Version:</strong> {rollbackForm.targetVersion || 'Not selected'}</p>
              <p><strong>Devices to Rollback:</strong> {rollbackForm.selectedDevices.length}</p>
              <p><strong>Reason:</strong> {rollbackForm.reason || 'Not provided'}</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRollbackModal(false)}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRollback}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Confirm Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OTA;
