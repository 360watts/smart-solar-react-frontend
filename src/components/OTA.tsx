import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import '../App.css';

interface FirmwareVersion {
  id: number;
  version: string;
  filename: string;
  size: number;
  checksum?: string;
  description?: string;
  release_notes?: string;
  is_active: boolean;
  created_at: string;
}

interface OTAConfig {
  enable_auto_update: boolean;
  update_strategy: 'immediate' | 'scheduled' | 'manual';
  max_concurrent_updates: number;
  firmware_retention_days: number;
}

interface OTAHealth {
  status: string;
  service: string;
  firmware_versions: number;
  active_firmware: number;
  timestamp: string;
}

export const OTA: React.FC = () => {
  const [firmwares, setFirmwares] = useState<FirmwareVersion[]>([]);
  const [config, setConfig] = useState<OTAConfig | null>(null);
  const [health, setHealth] = useState<OTAHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadingMetadata, setUploadingMetadata] = useState({
    version: '',
    description: '',
    release_notes: '',
  });
  const [configForm, setConfigForm] = useState<OTAConfig | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [rollbackForm, setRollbackForm] = useState({
    deviceSerial: '',
    notes: '',
  });
  const [activeTab, setActiveTab] = useState<'upload' | 'versions' | 'config' | 'docs'>('upload');

  useEffect(() => {
    loadOTAData();
  }, []);

  const loadOTAData = async () => {
    setLoading(true);
    try {
      const [fwRes, configRes, healthRes] = await Promise.all([
        apiService.getFirmwareVersions(false),
        apiService.getOTAConfig(),
        apiService.getOTAHealth(),
      ]);

      setFirmwares(fwRes);
      setConfig(configRes);
      setConfigForm(configRes);
      setHealth(healthRes);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load OTA data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setUploadingFile(e.target.files[0]);
    }
  };

  const handleUploadFirmware = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingFile || !uploadingMetadata.version) {
      setErrorMessage('Please select a file and enter version number');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      
      const formData = new FormData();
      formData.append('file', uploadingFile);
      formData.append('version', uploadingMetadata.version);
      formData.append('description', uploadingMetadata.description || '');
      formData.append('release_notes', uploadingMetadata.release_notes || '');
      formData.append('is_active', 'false');

      await apiService.uploadFirmwareVersion(formData);
      setSuccessMessage('Firmware uploaded successfully');
      setUploadingFile(null);
      setUploadingMetadata({ version: '', description: '', release_notes: '' });
      
      // Reset file input
      const fileInput = document.querySelector('.ota-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      loadOTAData();
    } catch (error: any) {
      console.error('Upload error:', error);
      setErrorMessage(error.message || 'Failed to upload firmware');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFirmwareActive = async (firmware: FirmwareVersion) => {
    try {
      setLoading(true);
      await apiService.updateFirmwareVersion(firmware.id, {
        is_active: !firmware.is_active,
      });
      setSuccessMessage(`Firmware ${!firmware.is_active ? 'activated' : 'deactivated'} successfully`);
      loadOTAData();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update firmware status');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFirmware = async (firmware: FirmwareVersion) => {
    if (firmware.is_active) {
      setErrorMessage('Cannot delete active firmware. Deactivate it first.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete firmware version ${firmware.version}?\n\n` +
      `This will permanently delete the firmware file from storage.\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      
      await apiService.deleteFirmwareVersion(firmware.id);
      setSuccessMessage(`Firmware version ${firmware.version} deleted successfully`);
      loadOTAData();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete firmware');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configForm) return;

    try {
      setLoading(true);
      await apiService.updateOTAConfig(configForm);
      setSuccessMessage('OTA configuration updated successfully');
      setConfig(configForm);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollbackForm.deviceSerial) {
      setErrorMessage('Please enter a device serial for rollback');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to rollback device ${rollbackForm.deviceSerial}?\n\n` +
      `This will trigger a firmware rollback command to the device.\n` +
      `The device must already have the previous firmware stored locally.\n\n` +
      `The device will receive updateFirmware flag = 2 in the heartbeat response.`
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      
      await apiService.triggerRollback(
        rollbackForm.deviceSerial,
        rollbackForm.notes
      );
      setSuccessMessage(`Rollback command sent to device ${rollbackForm.deviceSerial}. Device will receive the command on next heartbeat.`);
      setRollbackForm({ deviceSerial: '', notes: '' });
    } catch (error: any) {
      console.error('Rollback error:', error);
      setErrorMessage(error.message || 'Failed to trigger rollback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            Over-The-Air (OTA) Updates
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Manage firmware versions and deploy updates to your devices
          </p>
        </div>
        <div className="health-status">
          {health && (
            <>
              <span className={`status-badge status-badge-${health.status === 'ok' ? 'success' : 'danger'}`}>
                {health.status.toUpperCase()}
              </span>
              <span className="ml-2">
                {health.firmware_versions} versions ({health.active_firmware} active)
              </span>
            </>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="alert alert-success mt-3 fade-in">
          {successMessage}
          <button
            className="alert-close"
            onClick={() => setSuccessMessage('')}
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger mt-3 fade-in">
          {errorMessage}
          <button
            className="alert-close"
            onClick={() => setErrorMessage('')}
          >
            ×
          </button>
        </div>
      )}

      {loading && <div className="loading-spinner">Loading OTA data...</div>}

      {/* Modern Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        borderBottom: '2px solid var(--border-color)',
        paddingBottom: '0'
      }}>
        <button
          onClick={() => setActiveTab('upload')}
          style={{
            background: activeTab === 'upload' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'upload' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'upload' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload & Rollback
        </button>
        <button
          onClick={() => setActiveTab('versions')}
          style={{
            background: activeTab === 'versions' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'versions' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'versions' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </svg>
          Firmware Versions ({firmwares.length})
        </button>
        <button
          onClick={() => setActiveTab('config')}
          style={{
            background: activeTab === 'config' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'config' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'config' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m-7-7h6m6 0h6"/>
          </svg>
          Configuration
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          style={{
            background: activeTab === 'docs' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'docs' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'docs' ? '600' : '500',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Documentation
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'upload' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          {/* Upload Section */}
          <div className="admin-card" style={{ height: 'fit-content' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload New Firmware
            </h2>
            <form onSubmit={handleUploadFirmware} className="form">
              <div className="form-group">
                <label>Version (e.g., 0x00020000)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="0x00020000"
                  value={uploadingMetadata.version}
                  onChange={(e) =>
                    setUploadingMetadata({ ...uploadingMetadata, version: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Firmware File</label>
                <input
                  type="file"
                  className="form-control ota-file-input"
                  accept=".bin,.hex,.elf"
                  onChange={handleFileSelect}
                />
                {uploadingFile && <small className="form-text">📦 {uploadingFile.name}</small>}
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-control"
                  placeholder="Brief description of this firmware version"
                  rows={2}
                  value={uploadingMetadata.description}
                  onChange={(e) =>
                    setUploadingMetadata({ ...uploadingMetadata, description: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Release Notes</label>
                <textarea
                  className="form-control"
                  placeholder="Detailed release notes and changelog"
                  rows={3}
                  value={uploadingMetadata.release_notes}
                  onChange={(e) =>
                    setUploadingMetadata({ ...uploadingMetadata, release_notes: e.target.value })
                  }
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Uploading...' : '⬆️ Upload Firmware'}
              </button>
            </form>
          </div>

          {/* Rollback Section */}
          <div className="admin-card" style={{ height: 'fit-content' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
              Rollback Device Firmware
            </h2>
            <div style={{
              background: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              gap: '0.75rem'
            }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <div>
                <strong>Important:</strong> Device must have previous firmware stored locally
              </div>
            </div>
            <form onSubmit={handleRollback} className="form">
              <div className="form-group">
                <label>Device Serial</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter device serial (e.g., STM32-001)"
                  value={rollbackForm.deviceSerial}
                  onChange={(e) =>
                    setRollbackForm({ ...rollbackForm, deviceSerial: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  className="form-control"
                  placeholder="Reason for rollback..."
                  rows={2}
                  value={rollbackForm.notes}
                  onChange={(e) =>
                    setRollbackForm({ ...rollbackForm, notes: e.target.value })
                  }
                />
              </div>

              <button type="submit" className="btn btn-warning" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Processing...' : '⏪ Trigger Rollback'}
              </button>
              <small className="form-text mt-2" style={{ display: 'block', textAlign: 'center' }}>
                Device will receive <strong>updateFirmware: 2</strong> flag on next heartbeat
              </small>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'versions' && (
        <div className="admin-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
            Firmware Versions
          </h2>
          {firmwares.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'var(--text-secondary)'
            }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1rem', opacity: 0.3 }}>
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              </svg>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No firmware versions uploaded yet</p>
              <p style={{ fontSize: '0.9rem' }}>Upload your first firmware to get started</p>
            </div>
          ) : (
            <div className="firmware-list">
              {firmwares.map((fw) => (
                <div key={fw.id} className={`firmware-item ${fw.is_active ? 'active' : ''}`} style={{
                  border: fw.is_active ? '2px solid var(--success-color)' : '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1rem',
                  background: fw.is_active ? 'rgba(40, 167, 69, 0.05)' : 'var(--bg-secondary)',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}>
                  {fw.is_active && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '20px',
                      background: 'var(--success-color)',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      boxShadow: '0 2px 8px rgba(40, 167, 69, 0.3)'
                    }}>
                      ✓ ACTIVE
                    </div>
                  )}
                  <div className="firmware-header" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{
                      background: fw.is_active ? 'var(--primary-gradient)' : 'var(--bg-tertiary)',
                      color: fw.is_active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '1rem',
                      fontFamily: 'monospace'
                    }}>
                      {fw.version}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      📦 {fw.filename}
                    </span>
                    <span style={{
                      marginLeft: 'auto',
                      background: 'var(--bg-tertiary)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {(fw.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  {fw.description && (
                    <p style={{
                      color: 'var(--text-secondary)',
                      margin: '0.5rem 0',
                      fontSize: '0.9rem'
                    }}>
                      {fw.description}
                    </p>
                  )}
                  <div className="firmware-footer" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-color)'
                  }}>
                    <small style={{ color: 'var(--text-secondary)' }}>
                      📅 {new Date(fw.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </small>
                    <div className="firmware-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className={`btn btn-sm ${fw.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleFirmwareActive(fw)}
                        disabled={loading}
                        style={{ minWidth: '100px' }}
                      >
                        {fw.is_active ? '🔴 Deactivate' : '✓ Activate'}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteFirmware(fw)}
                        disabled={loading || fw.is_active}
                        title={fw.is_active ? 'Deactivate firmware before deleting' : 'Delete firmware'}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                  {fw.release_notes && (
                    <details style={{ marginTop: '1rem' }}>
                      <summary style={{ 
                        cursor: 'pointer', 
                        fontWeight: '500',
                        color: 'var(--primary-color)',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        transition: 'background 0.2s'
                      }}>
                        📝 Release Notes
                      </summary>
                      <p style={{
                        marginTop: '0.75rem',
                        padding: '1rem',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '8px',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {fw.release_notes}
                      </p>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div className="admin-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6m-7-7h6m6 0h6"/>
            </svg>
            OTA Configuration
          </h2>
          {configForm && (
            <form onSubmit={handleSaveConfig} className="form" style={{ maxWidth: '800px' }}>
              <div className="form-group">
                <label>Update Strategy</label>
                <select
                  className="form-control"
                  value={configForm.update_strategy}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      update_strategy: e.target.value as any,
                    })
                  }
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)'
                  }}
                >
                  <option value="immediate">🚀 Immediate - Push updates immediately</option>
                  <option value="scheduled">📅 Scheduled - Push during maintenance window</option>
                  <option value="manual">👤 Manual - Wait for device to request</option>
                </select>
              </div>

              <div className="form-group">
                <label>Max Concurrent Updates</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="50"
                  value={configForm.max_concurrent_updates}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      max_concurrent_updates: parseInt(e.target.value),
                    })
                  }
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)'
                  }}
                />
                <small className="form-text" style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  Maximum number of devices updating simultaneously
                </small>
              </div>

              <div className="form-group">
                <label>Firmware Retention (days)</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="365"
                  value={configForm.firmware_retention_days}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      firmware_retention_days: parseInt(e.target.value),
                    })
                  }
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)'
                  }}
                />
                <small className="form-text" style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  Keep old firmware files for this many days before cleanup
                </small>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
                {loading ? 'Saving...' : '💾 Save Configuration'}
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="admin-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            API Documentation
          </h2>

          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {/* Update Strategy Info */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              padding: '1.5rem',
              border: '1px solid var(--border-color)'
            }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6m-7-7h6m6 0h6"/>
                </svg>
                OTA Update Strategy
              </h3>
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--primary-color)' }}>
                  Current: {config?.update_strategy.toUpperCase()}
                </strong>
              </div>
              <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  <strong>Immediate:</strong> Updates offered to devices immediately when activated
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <strong>Scheduled:</strong> Updates offered during configured maintenance windows
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  <strong>Manual:</strong> Devices must explicitly request updates via API
                </li>
              </ul>
            </div>

            {/* Heartbeat Flags */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              padding: '1.5rem',
              border: '1px solid var(--border-color)'
            }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Heartbeat updateFirmware Flags
              </h3>
              <div style={{
                display: 'grid',
                gap: '0.75rem',
                fontFamily: 'monospace',
                fontSize: '0.9rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px'
                }}>
                  <span style={{
                    background: 'var(--bg-primary)',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontWeight: '600',
                    minWidth: '40px',
                    textAlign: 'center'
                  }}>0</span>
                  <span style={{ color: 'var(--text-secondary)' }}>No firmware update needed (default)</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px'
                }}>
                  <span style={{
                    background: 'var(--primary-color)',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontWeight: '600',
                    minWidth: '40px',
                    textAlign: 'center'
                  }}>1</span>
                  <span style={{ color: 'var(--text-secondary)' }}>New firmware update available (device should update)</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px'
                }}>
                  <span style={{
                    background: 'var(--warning-color)',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontWeight: '600',
                    minWidth: '40px',
                    textAlign: 'center'
                  }}>2</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Rollback triggered (device should rollback to previous version)</span>
                </div>
              </div>
            </div>

            {/* API Endpoints */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              padding: '1.5rem',
              border: '1px solid var(--border-color)'
            }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6"/>
                  <polyline points="8 6 2 12 8 18"/>
                </svg>
                Device API Endpoints
              </h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <strong style={{ color: 'var(--primary-color)' }}>Check for Updates (STM32)</strong>
                  <pre style={{
                    background: 'var(--bg-tertiary)',
                    padding: '1rem',
                    borderRadius: '8px',
                    overflow: 'auto',
                    fontSize: '0.85rem',
                    marginTop: '0.5rem',
                    border: '1px solid var(--border-color)'
                  }}>
{`POST /ota/devices/{device_id}/check
Content-Type: application/json

{
  "device_id": "STM32-001",
  "firmware_version": "0x00010000"
}`}
                  </pre>
                </div>

                <div>
                  <strong style={{ color: 'var(--primary-color)' }}>Response Format</strong>
                  <pre style={{
                    background: 'var(--bg-tertiary)',
                    padding: '1rem',
                    borderRadius: '8px',
                    overflow: 'auto',
                    fontSize: '0.85rem',
                    marginTop: '0.5rem',
                    border: '1px solid var(--border-color)'
                  }}>
{JSON.stringify(
  {
    id: 'fw_1',
    version: '0x00020000',
    size: 1048576,
    url: 'https://api.../ota/firmware/1/download',
    checksum: 'sha256_hash',
    status: 1
  },
  null,
  2
)}
                  </pre>
                </div>

                <div>
                  <strong style={{ color: 'var(--primary-color)' }}>Heartbeat Endpoint</strong>
                  <pre style={{
                    background: 'var(--bg-tertiary)',
                    padding: '1rem',
                    borderRadius: '8px',
                    overflow: 'auto',
                    fontSize: '0.85rem',
                    marginTop: '0.5rem',
                    border: '1px solid var(--border-color)'
                  }}>
{`POST /api/devices/{device_id}/heartbeat/

Response includes:
{
  "updateFirmware": 0,  // 0=none, 1=update, 2=rollback
  "pendingReboot": false,
  "hardReset": false
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OTA;