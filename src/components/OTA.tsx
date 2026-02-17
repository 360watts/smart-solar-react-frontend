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
      const formData = new FormData();
      formData.append('file', uploadingFile);
      formData.append('version', uploadingMetadata.version);
      formData.append('filename', uploadingFile.name);
      formData.append('size', uploadingFile.size.toString());
      formData.append('description', uploadingMetadata.description || '');
      formData.append('release_notes', uploadingMetadata.release_notes || '');
      formData.append('is_active', 'false');

      await apiService.uploadFirmwareVersion(formData);
      setSuccessMessage('Firmware uploaded successfully');
      setUploadingFile(null);
      setUploadingMetadata({ version: '', description: '', release_notes: '' });
      loadOTAData();
    } catch (error: any) {
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

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Over-The-Air (OTA) Updates</h1>
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

      <div className="admin-grid">
        {/* Upload Section */}
        <div className="admin-card">
          <h2>Upload New Firmware</h2>
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
                className="form-control"
                accept=".bin,.hex,.elf"
                onChange={handleFileSelect}
              />
              {uploadingFile && <small className="form-text">File: {uploadingFile.name}</small>}
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

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Uploading...' : 'Upload Firmware'}
            </button>
          </form>
        </div>

        {/* Firmware Versions */}
        <div className="admin-card">
          <h2>Firmware Versions</h2>
          {firmwares.length === 0 ? (
            <p className="text-muted">No firmware versions uploaded yet</p>
          ) : (
            <div className="firmware-list">
              {firmwares.map((fw) => (
                <div key={fw.id} className={`firmware-item ${fw.is_active ? 'active' : ''}`}>
                  <div className="firmware-header">
                    <span className={`version-badge ${fw.is_active ? 'active' : 'inactive'}`}>
                      {fw.version}
                    </span>
                    <span className="filename">{fw.filename}</span>
                    <span className="size">({(fw.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  {fw.description && <p className="description">{fw.description}</p>}
                  <div className="firmware-footer">
                    <small className="text-muted">
                      Created: {new Date(fw.created_at).toLocaleDateString()}
                    </small>
                    <button
                      className={`btn btn-sm ${fw.is_active ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => handleToggleFirmwareActive(fw)}
                      disabled={loading}
                    >
                      {fw.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                  {fw.release_notes && (
                    <details className="mt-2">
                      <summary>Release Notes</summary>
                      <p className="release-notes">{fw.release_notes}</p>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OTA Configuration */}
        <div className="admin-card">
          <h2>OTA Configuration</h2>
          {configForm && (
            <form onSubmit={handleSaveConfig} className="form">
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={configForm.enable_auto_update}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, enable_auto_update: e.target.checked })
                    }
                  />
                  <span>Enable Automatic Updates</span>
                </label>
              </div>

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
                >
                  <option value="immediate">Immediate - Push updates immediately</option>
                  <option value="scheduled">Scheduled - Push during maintenance window</option>
                  <option value="manual">Manual - Wait for device to request</option>
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
                />
                <small className="form-text">
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
                />
                <small className="form-text">
                  Keep old firmware files for this many days before cleanup
                </small>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Configuration'}
              </button>
            </form>
          )}
        </div>

        {/* Device Update Info */}
        <div className="admin-card">
          <h2>OTA Update Strategy</h2>
          <div className="info-box">
            <h4>Current Strategy: {config?.update_strategy.toUpperCase()}</h4>
            <ul>
              <li>
                <strong>Immediate:</strong> Updates offered to devices immediately when
                activated
              </li>
              <li>
                <strong>Scheduled:</strong> Updates offered during configured maintenance
                windows
              </li>
              <li>
                <strong>Manual:</strong> Devices must explicitly request updates via API
              </li>
            </ul>

            <h4 className="mt-3">For STM32 Devices:</h4>
            <code className="code-block">
              POST /ota/devices/&#123;device_id&#125;/check
              <br />
              With: &#123;"device_id": "...", "firmware_version": "0x00010000"&#125;
            </code>

            <h4 className="mt-3">Device Response Format:</h4>
            <pre className="code-block">
              {JSON.stringify(
                {
                  id: 'fw_1',
                  version: '0x00020000',
                  size: 1048576,
                  url: 'https://api.../ota/firmware/1/download',
                  checksum: 'sha256_hash',
                  status: 1,
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
