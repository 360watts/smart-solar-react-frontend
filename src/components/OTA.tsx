import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Package, Upload, Loader2, Check, Zap, RotateCcw, AlertCircle,
  AlertTriangle, Info, X, CheckCircle2, Cpu, Activity,
  Search, Trash2, RefreshCw, Radio, HardDrive,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import PageHeader from './PageHeader';
import '../App.css';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Design tokens ────────────────────────────────────────────────────────────

const tok = {
  // Backgrounds
  bgPage:   (d: boolean) => d ? '#0F172A' : '#F1F5F9',
  bgCard:   (d: boolean) => d ? '#1E293B' : '#FFFFFF',
  bgSub:    (d: boolean) => d ? '#0F172A' : '#F8FAFC',
  bgInput:  (d: boolean) => d ? '#0F172A' : '#FFFFFF',
  bgMuted:  (d: boolean) => d ? 'rgba(255,255,255,0.04)' : '#F3F4F6',

  // Borders
  border:   (d: boolean) => d ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
  borderFocus: '#22C55E',

  // Text
  textPrimary:   (d: boolean) => d ? '#F8FAFC' : '#0F172A',
  textSecondary: (d: boolean) => d ? '#94A3B8' : '#64748B',
  textMuted:     (d: boolean) => d ? '#64748B' : '#94A3B8',

  // Accents
  green:  '#22C55E',
  indigo: '#6366F1',
  amber:  '#F59E0B',
  red:    '#EF4444',
  blue:   '#3B82F6',
  purple: '#8B5CF6',
  cyan:   '#06B6D4',
};

// ─── Shared style helpers ─────────────────────────────────────────────────────

const cardStyle = (d: boolean, extra?: React.CSSProperties): React.CSSProperties => ({
  background: tok.bgCard(d),
  borderRadius: 16,
  border: `1px solid ${tok.border(d)}`,
  boxShadow: d
    ? '0 4px 24px rgba(0,0,0,0.4)'
    : '0 1px 8px rgba(0,0,0,0.06)',
  overflow: 'hidden',
  marginBottom: '1.5rem',
  ...extra,
});

const inputStyle = (d: boolean, extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '9px 12px',
  borderRadius: 8,
  width: '100%',
  boxSizing: 'border-box' as const,
  border: `1px solid ${tok.border(d)}`,
  background: tok.bgInput(d),
  color: tok.textPrimary(d),
  fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 0.15s',
  ...extra,
});

const labelStyle = (d: boolean): React.CSSProperties => ({
  display: 'block',
  marginBottom: 5,
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: tok.textSecondary(d),
});

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
  transition: 'opacity 0.15s, transform 0.1s',
  padding: '9px 16px',
};

const sectionPill = (color: string): React.CSSProperties => ({
  width: 3,
  height: 16,
  borderRadius: 3,
  background: color,
  flexShrink: 0,
});

// ─── Status badge config ──────────────────────────────────────────────────────

const mapLogStatus = (s: string | null): DeviceStatus['status'] => {
  switch (s?.toLowerCase()) {
    case 'pending':    return 'idle';
    case 'checking':
    case 'available':  return 'trial';
    case 'downloading':return 'downloading';
    case 'completed':  return 'healthy';
    case 'failed':     return 'failed';
    case 'skipped':    return 'idle';
    default:           return 'idle';
  }
};

const STATUS_CONFIG: Record<DeviceStatus['status'], { label: string; bg: string; text: string; dot: string }> = {
  idle:       { label: 'Idle',        bg: 'rgba(100,116,139,0.15)', text: '#94A3B8', dot: '#64748B' },
  downloading:{ label: 'Downloading', bg: 'rgba(6,182,212,0.15)',   text: '#06B6D4', dot: '#06B6D4' },
  flashing:   { label: 'Flashing',    bg: 'rgba(245,158,11,0.15)',  text: '#F59E0B', dot: '#F59E0B' },
  rebooting:  { label: 'Rebooting',   bg: 'rgba(251,146,60,0.15)',  text: '#FB923C', dot: '#FB923C' },
  trial:      { label: 'Notified',    bg: 'rgba(99,102,241,0.15)',  text: '#818CF8', dot: '#818CF8' },
  healthy:    { label: 'Healthy',     bg: 'rgba(34,197,94,0.15)',   text: '#22C55E', dot: '#22C55E' },
  failed:     { label: 'Failed',      bg: 'rgba(239,68,68,0.15)',   text: '#EF4444', dot: '#EF4444' },
  rolledback: { label: 'Rolled Back', bg: 'rgba(139,92,246,0.15)',  text: '#A78BFA', dot: '#A78BFA' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const CardHeader: React.FC<{
  icon: React.ReactNode;
  gradient: string;
  glowColor: string;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}> = ({ icon, gradient, glowColor, title, subtitle, right }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 14px ${glowColor}`,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#F8FAFC' }}>{title}</div>
        <div style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
    {right}
  </div>
);

const StatusBadge: React.FC<{ status: DeviceStatus['status'] }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg,
      color: cfg.text,
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: '0.75rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

const Modal: React.FC<{
  show: boolean;
  onClose: () => void;
  icon: React.ReactNode;
  gradient: string;
  glow: string;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  isDark: boolean;
}> = ({ show, onClose, icon, gradient, glow, title, children, footer, isDark }) => {
  if (!show) return null;
  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20,
    }}>
      <div style={{
        background: isDark ? '#1E293B' : '#FFFFFF',
        borderRadius: 16,
        border: `1px solid ${tok.border(isDark)}`,
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        maxWidth: 480, width: '100%', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: gradient, boxShadow: `0 4px 14px ${glow}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {icon}
            </div>
            <span style={{ fontWeight: 700, fontSize: '1.0625rem', color: tok.textPrimary(isDark) }}>{title}</span>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: tok.bgMuted(isDark), color: tok.textSecondary(isDark),
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '16px 24px', color: tok.textSecondary(isDark), lineHeight: 1.65, fontSize: '0.875rem' }}>
          {children}
        </div>
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {footer}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const OTA: React.FC = () => {
  const { isDark } = useTheme();

  // ── State ──
  const [firmwares, setFirmwares] = useState<FirmwareVersion[]>([]);
  const [uploadForm, setUploadForm] = useState({
    name: '', version: '', deviceModel: 'ESP32-S3', minBootloader: '1.0.0',
    releaseNotes: '', file: null as File | null,
  });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig>({
    firmwareVersion: '', targetDevices: [], mode: 'immediate',
    autoRollback: true, healthTimeout: 300, failureThreshold: 10,
  });
  const [confirmModal, setConfirmModal] = useState<DeploymentConfirmModal>({
    show: false, firmware: '', deviceCount: 0, dataTransfer: '',
  });
  const [isDeploying, setIsDeploying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | DeviceStatus['status']>('all');
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingFirmwares, setLoadingFirmwares] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDeployment, setActiveDeployment] = useState<any>(null);

  const [rollbackForm, setRollbackForm] = useState({ selectedDevices: [] as string[], reason: '' });
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackFilters, setRollbackFilters] = useState({ currentVersion: 'all', status: 'all', deviceModel: 'all' });

  const [confirmActionModal, setConfirmActionModal] = useState<{
    show: boolean; title: string; message: string; warningText: string;
    confirmLabel: string; accentColor: string; icon: React.ReactNode; onConfirm: () => Promise<void>;
  }>({ show: false, title: '', message: '', warningText: '', confirmLabel: 'Confirm', accentColor: '#EF4444', icon: <AlertTriangle size={18} color="white" />, onConfirm: async () => {} });

  const [successModal, setSuccessModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [firmwareSearch, setFirmwareSearch] = useState('');
  const [idleDeviceSearch, setIdleDeviceSearch] = useState('');
  const [rollbackDeviceSearch, setRollbackDeviceSearch] = useState('');

  // ── Data loading ──
  useEffect(() => {
    // Run all three independent loads in parallel — previously sequential
    Promise.all([loadFirmwareData(), loadDevices(), loadDeployments()]);
    const interval = setInterval(() => { loadDeployments(); }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFirmwareData = async () => {
    try {
      setLoadingFirmwares(true);
      setLoadError(null);
      const response = await apiService.getFirmwareVersions(false);
      const transformed: FirmwareVersion[] = (response.results || response || []).map((fw: any) => ({
        id: fw.id,
        name: fw.filename || `Firmware v${fw.version}`,
        version: fw.version,
        deviceModel: fw.description?.match(/(?:ESP32|STM32|[A-Z0-9-]+)/i)?.[0] || 'Unknown',
        minBootloaderVersion: '1.0.0',
        file: null,
        size: fw.size || 0,
        checksum: fw.checksum || '',
        signatureValid: fw.is_active !== false,
        releaseNotes: fw.release_notes || fw.description || '',
        status: fw.is_active ? 'stable' : 'draft',
        uploadDate: fw.created_at || new Date().toISOString(),
      }));
      setFirmwares(transformed);
      setLoadError(null);
    } catch (err: any) {
      setFirmwares([]);
      if (err?.name === 'AbortError') {
        setLoadError('warming-up');
        setTimeout(() => Promise.all([loadFirmwareData(), loadDevices(), loadDeployments()]), 5000);
      }
    }
    finally { setLoadingFirmwares(false); }
  };

  const loadDevices = async () => {
    try {
      setLoadingDevices(true);
      const otaDevices: any[] = await apiService.getOTADevices();
      const transformed: DeviceStatus[] = (Array.isArray(otaDevices) ? otaDevices : []).map((d: any) => ({
        deviceId: d.device_serial,
        currentVersion: d.current_firmware || 'Not reported',
        targetVersion: d.target_firmware_version || 'N/A',
        activeSlot: 'A' as 'A' | 'B',
        status: mapLogStatus(d.log_status),
        bootCount: 0,
        lastError: d.log_error || '',
        progress: undefined,
        lastCheckedAt: d.log_last_checked_at || undefined,
      }));
      setDevices(transformed);
    } catch (err: any) {
      setDevices([]);
      if (err?.name === 'AbortError') {
        setLoadError('warming-up');
        setTimeout(() => Promise.all([loadFirmwareData(), loadDevices(), loadDeployments()]), 5000);
      }
    }
    finally { setLoadingDevices(false); }
  };

  const loadDeployments = async () => {
    try {
      const campaigns = await apiService.listTargetedUpdates();
      const activeCampaign = campaigns.find((c: any) => c.status === 'in_progress' || c.status === 'pending');
      const displayCampaign = activeCampaign || campaigns[0] || null;
      setActiveDeployment(displayCampaign);
      if (displayCampaign) await updateDeployedDeviceStatuses(displayCampaign);
    } catch { /* silent */ }
  };

  const updateDeployedDeviceStatuses = async (deployment?: any) => {
    try {
      const dep = deployment || activeDeployment;
      if (!dep) return;
      let campaignDetail: any;
      try {
        campaignDetail = await apiService.getTargetedUpdate(dep.id);
      } catch {
        // Campaign no longer exists — clear stale state
        setActiveDeployment(null);
        return;
      }
      const targetedDevices: any[] = campaignDetail.device_targets || [];
      if (targetedDevices.length === 0) return;
      const firmwareSize: number = campaignDetail.target_firmware?.size || 0;
      const targetVersion: string = campaignDetail.target_firmware?.version || '';
      const updateMap = new Map<string, Partial<DeviceStatus>>(
        targetedDevices.map((dt: any) => {
          const serial: string = dt.device?.device_serial;
          if (!serial) return null;
          const mapped = mapLogStatus(dt.log_status);
          const bytes: number = dt.log_bytes_downloaded || 0;
          const progress = mapped === 'downloading' && firmwareSize > 0
            ? Math.round((bytes / firmwareSize) * 100) : undefined;
          return [serial, { status: mapped, targetVersion, lastError: mapped === 'failed' ? (dt.log_error || 'Update failed') : '', progress, lastCheckedAt: dt.log_last_checked_at }] as [string, Partial<DeviceStatus>];
        }).filter((e): e is [string, Partial<DeviceStatus>] => e !== null)
      );
      setDevices(prev => prev.map(d => { const u = updateMap.get(d.deviceId); return u ? { ...d, ...u } : d; }));
    } catch { /* silent */ }
  };

  // ── Upload handlers ──
  const calculateSHA256 = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadForm(f => ({ ...f, file }));
    try { await calculateSHA256(file); } catch { /* silent */ }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUploadFirmware = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) {
      setErrorModal({ show: true, message: 'Please select a firmware file before uploading.' });
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('version', uploadForm.version);
      formData.append('description', uploadForm.name);
      formData.append('release_notes', uploadForm.releaseNotes);
      formData.append('is_active', 'false');
      setUploadProgress(0);
      const response = await apiService.uploadFirmwareVersion(formData, setUploadProgress);
      setUploadProgress(null);
      const storageLabel = response.storage_backend === 's3' ? 'S3 (persistent)' : 'Local filesystem (ephemeral — re-upload with S3 enabled!)';
      const warningLine = response.storage_warning ? `\n\n⚠️ ${response.storage_warning}` : '';
      setSuccessModal({
        show: true,
        message: `Firmware uploaded successfully!\n\nVersion: ${response.version}\nSize: ${(response.size / 1024).toFixed(2)} KB\nChecksum: ${response.checksum?.substring(0, 16)}...\nStored in: ${storageLabel}${warningLine}`,
      });
      setUploadForm({ name: '', version: '', deviceModel: 'ESP32-S3', minBootloader: '1.0.0', releaseNotes: '', file: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadFirmwareData();
    } catch (error: any) {
      setUploadProgress(null);
      setErrorModal({ show: true, message: `Upload failed: ${error.message || 'Unknown error'}` });
    }
  };

  const handleDeleteFirmware = (firmware: FirmwareVersion) => {
    setConfirmActionModal({
      show: true, title: 'Delete Firmware',
      message: `Delete firmware version ${firmware.version}?`,
      warningText: 'This will permanently remove the firmware binary from S3. This action cannot be undone.',
      confirmLabel: 'Delete', accentColor: '#EF4444',
      icon: <Trash2 size={18} color="white" />,
      onConfirm: async () => {
        await apiService.deleteFirmwareVersion(firmware.id);
        setSuccessModal({ show: true, message: 'Firmware deleted.' });
        await loadFirmwareData();
      },
    });
  };

  const handleMarkAsStable = async (id: number) => {
    try {
      await apiService.updateFirmwareVersion(id, { is_active: true });
      setSuccessModal({ show: true, message: 'Firmware activated.' });
      await loadFirmwareData();
    } catch (error: any) {
      setErrorModal({ show: true, message: `Activation failed: ${error.message}` });
    }
  };

  const handleDeactivateFirmware = (firmware: FirmwareVersion) => {
    setConfirmActionModal({
      show: true, title: 'Deactivate Firmware',
      message: `Deactivate firmware version ${firmware.version}?`,
      warningText: 'This firmware will no longer be offered for OTA updates.',
      confirmLabel: 'Deactivate', accentColor: '#F59E0B',
      icon: <AlertCircle size={18} color="white" />,
      onConfirm: async () => {
        await apiService.updateFirmwareVersion(firmware.id, { is_active: false });
        setSuccessModal({ show: true, message: 'Firmware deactivated.' });
        await loadFirmwareData();
      },
    });
  };

  // ── Deploy handlers ──
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
    setConfirmModal({ show: true, firmware: firmware.version, deviceCount: deploymentConfig.targetDevices.length, dataTransfer });
  };

  const confirmDeployment = async () => {
    setConfirmModal(m => ({ ...m, show: false }));
    setIsDeploying(true);
    try {
      const firmware = firmwares.find(f => f.version === deploymentConfig.firmwareVersion);
      if (!firmware) throw new Error('Selected firmware not found');
      const response = await apiService.deployFirmware(
        firmware.id, deploymentConfig.targetDevices,
        `Deployment: ${firmware.version} to ${deploymentConfig.targetDevices.length} device(s)`
      );
      setIsDeploying(false);
      setSuccessModal({ show: true, message: `Deployment initiated!\n\nID: ${response.id || 'N/A'} · Devices: ${response.devices_total || deploymentConfig.targetDevices.length} · Firmware: ${firmware.version}\n\nDevices will receive the update on their next check-in.` });
      await loadDeployments();
    } catch (error: any) {
      setIsDeploying(false);
      const msg = error?.name === 'AbortError'
        ? 'Server is warming up — please wait a moment and try again.'
        : `Deployment failed: ${error.message || 'Unknown error'}`;
      setErrorModal({ show: true, message: msg });
    }
  };

  const handleSelectAllDevices = () => {
    setDeploymentConfig(c => ({ ...c, targetDevices: devices.filter(d => d.status === 'idle' || d.status === 'healthy' || d.status === 'failed').map(d => d.deviceId) }));
  };

  // ── Rollback ──
  const getFilteredRollbackDevices = () => {
    return devices.filter(d => {
      if (rollbackFilters.currentVersion !== 'all' && d.currentVersion !== rollbackFilters.currentVersion) return false;
      if (rollbackFilters.status !== 'all' && d.status !== rollbackFilters.status) return false;
      return true;
    });
  };

  const confirmRollback = async () => {
    if (rollbackForm.selectedDevices.length === 0) { setErrorModal({ show: true, message: 'Please select at least one device to rollback.' }); return; }
    if (!rollbackForm.reason.trim()) { setErrorModal({ show: true, message: 'Please provide a reason for rollback.' }); return; }
    try {
      await Promise.all(rollbackForm.selectedDevices.map(serial => apiService.triggerRollback(serial, rollbackForm.reason)));
      setShowRollbackModal(false);
      setSuccessModal({ show: true, message: `Rollback queued for ${rollbackForm.selectedDevices.length} device(s). They will revert on their next heartbeat.` });
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
        : [...prev.selectedDevices, deviceId],
    }));
  };

  // ── Derived ──
  const statusMetrics = {
    total: devices.length,
    inProgress: devices.filter(d => ['downloading', 'flashing', 'rebooting', 'trial'].includes(d.status)).length,
    healthy: devices.filter(d => d.status === 'healthy').length,
    failed: activeDeployment?.devices_failed ?? devices.filter(d => d.status === 'failed').length,
    rolledBack: devices.filter(d => d.status === 'rolledback').length,
  };
  const filteredDevices = statusFilter === 'all' ? devices : devices.filter(d => d.status === statusFilter);
  const bg = tok.bgPage(isDark);
  const card = tok.bgCard(isDark);
  const bdr = tok.border(isDark);
  const txt = tok.textPrimary(isDark);
  const sub = tok.textSecondary(isDark);

  // ── Render ──
  return (
    <div className="admin-container responsive-page">

      <PageHeader
        icon={<Package size={20} color="white" />}
        title="OTA Firmware Management"
        subtitle="Upload, deploy, and monitor firmware across your device fleet"
        rightSlot={
          <button
            onClick={() => { setLoadError(null); Promise.all([loadFirmwareData(), loadDevices(), loadDeployments()]); }}
            style={{ ...btnBase, background: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9', color: sub, border: `1px solid ${bdr}` }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      {loadError === 'warming-up' && (
        <div style={{ marginBottom: '1rem', padding: '12px 16px', borderRadius: 8, background: isDark ? 'rgba(251,191,36,0.1)' : '#fffbeb', border: '1px solid rgba(251,191,36,0.4)', color: isDark ? '#fcd34d' : '#92400e', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 size={15} className="ota-spinner" style={{ flexShrink: 0 }} />
          Server is warming up — retrying automatically…
        </div>
      )}

      {/* ── Fleet Overview KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {[
          { label: 'Total Devices', value: statusMetrics.total, icon: <Cpu size={18} />, color: '#6366F1', glow: 'rgba(99,102,241,0.25)' },
          { label: 'In Progress',   value: statusMetrics.inProgress, icon: <Activity size={18} />, color: '#06B6D4', glow: 'rgba(6,182,212,0.25)' },
          { label: 'Healthy',       value: statusMetrics.healthy, icon: <CheckCircle2 size={18} />, color: '#22C55E', glow: 'rgba(34,197,94,0.25)' },
          { label: 'Failed',        value: statusMetrics.failed, icon: <AlertCircle size={18} />, color: '#EF4444', glow: 'rgba(239,68,68,0.25)' },
          { label: 'Rolled Back',   value: statusMetrics.rolledBack, icon: <RotateCcw size={18} />, color: '#A78BFA', glow: 'rgba(167,139,250,0.25)' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: card, borderRadius: 12, border: `1px solid ${bdr}`,
            padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</span>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: `${kpi.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: kpi.color,
              }}>
                {kpi.icon}
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION 1: Firmware Repository                            */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div style={cardStyle(isDark)}>
        <CardHeader
          icon={<Upload size={19} color="white" />}
          gradient="linear-gradient(135deg, #6366F1, #8B5CF6)"
          glowColor="rgba(99,102,241,0.45)"
          title="Firmware Repository"
          subtitle="Upload binaries and manage firmware versions"
        />

        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: '2rem' }}>
          {/* Upload Form */}
          <form onSubmit={handleUploadFirmware} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={sectionPill('linear-gradient(135deg, #6366F1, #8B5CF6)')} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#818CF8' }}>Upload New Firmware</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: 12 }}>
              <div>
                <label style={labelStyle(isDark)}>Firmware Name *</label>
                <input value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Solar Controller v2" required style={inputStyle(isDark)} />
              </div>
              <div>
                <label style={labelStyle(isDark)}>Version (semver) *</label>
                <input value={uploadForm.version} onChange={e => setUploadForm(f => ({ ...f, version: e.target.value }))}
                  placeholder="1.4.0" required pattern="\d+\.\d+\.\d+" style={inputStyle(isDark)} />
              </div>
              <div>
                <label style={labelStyle(isDark)}>Device Model</label>
                <select value={uploadForm.deviceModel} onChange={e => setUploadForm(f => ({ ...f, deviceModel: e.target.value }))}
                  style={inputStyle(isDark)}>
                  <option value="ESP32-S3">ESP32-S3</option>
                  <option value="ESP32">ESP32</option>
                  <option value="STM32">STM32</option>
                  <option value="nRF52">nRF52</option>
                </select>
              </div>
              <div>
                <label style={labelStyle(isDark)}>Min Bootloader</label>
                <input value={uploadForm.minBootloader} onChange={e => setUploadForm(f => ({ ...f, minBootloader: e.target.value }))}
                  placeholder="1.0.0" style={inputStyle(isDark)} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle(isDark)}>Release Notes</label>
              <textarea value={uploadForm.releaseNotes} onChange={e => setUploadForm(f => ({ ...f, releaseNotes: e.target.value }))}
                placeholder="Bug fixes, improvements…" rows={3}
                style={{ ...inputStyle(isDark), resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#6366F1' : (uploadForm.file ? '#22C55E' : bdr)}`,
                borderRadius: 10,
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver
                  ? 'rgba(99,102,241,0.08)'
                  : uploadForm.file
                    ? 'rgba(34,197,94,0.06)'
                    : tok.bgMuted(isDark),
                transition: 'all 0.2s',
                marginBottom: 16,
              }}
            >
              <input ref={fileInputRef} type="file" accept=".bin" onChange={handleInputChange} style={{ display: 'none' }} />
              {uploadForm.file ? (
                <div>
                  <CheckCircle2 size={24} color="#22C55E" style={{ marginBottom: 6 }} />
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#22C55E' }}>{uploadForm.file.name}</div>
                  <div style={{ fontSize: '0.75rem', color: sub, marginTop: 3 }}>
                    {(uploadForm.file.size / 1024).toFixed(1)} KB · SHA-256 auto-calculated
                  </div>
                </div>
              ) : (
                <div>
                  <HardDrive size={24} color={sub} style={{ marginBottom: 6 }} />
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: txt }}>Drop .bin file here</div>
                  <div style={{ fontSize: '0.75rem', color: sub, marginTop: 3 }}>or click to browse</div>
                </div>
              )}
            </div>

            {uploadProgress !== null && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: isDark ? '#94A3B8' : '#64748B', marginBottom: 4 }}>
                  <span>{uploadProgress < 100 ? 'Uploading…' : 'Processing…'}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: isDark ? '#1E293B' : '#E2E8F0', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
                    width: `${uploadProgress}%`,
                    transition: 'width 0.2s ease',
                  }} />
                </div>
              </div>
            )}

            <button type="submit" disabled={uploadProgress !== null} style={{
              ...btnBase,
              background: uploadProgress !== null ? (isDark ? '#334155' : '#CBD5E1') : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: uploadProgress !== null ? (isDark ? '#64748B' : '#94A3B8') : 'white',
              boxShadow: uploadProgress !== null ? 'none' : '0 4px 14px rgba(99,102,241,0.4)',
              justifyContent: 'center',
              cursor: uploadProgress !== null ? 'not-allowed' : 'pointer',
            }}>
              <Upload size={16} /> {uploadProgress !== null ? `Uploading ${uploadProgress}%` : 'Upload to S3'}
            </button>
          </form>

          {/* Firmware List */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={sectionPill('linear-gradient(135deg, #6366F1, #8B5CF6)')} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#818CF8', flex: 1 }}>Available Versions</span>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: sub }} />
                <input
                  placeholder="Search…"
                  value={firmwareSearch}
                  onChange={e => setFirmwareSearch(e.target.value)}
                  style={{ ...inputStyle(isDark, { paddingLeft: 28, width: 180 }) }}
                />
              </div>
            </div>

            {loadingFirmwares ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: sub, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Loader2 size={18} className="ota-spinner" /> Loading firmware…
              </div>
            ) : firmwares.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: sub }}>
                <Package size={36} style={{ marginBottom: 10, opacity: 0.3 }} />
                <div style={{ fontWeight: 600 }}>No firmware uploaded yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {firmwares
                  .filter(fw => !firmwareSearch.trim() || fw.name.toLowerCase().includes(firmwareSearch.toLowerCase()) || fw.version.toLowerCase().includes(firmwareSearch.toLowerCase()))
                  .map(fw => (
                    <div key={fw.id} style={{
                      background: tok.bgSub(isDark),
                      borderRadius: 10,
                      border: `1px solid ${bdr}`,
                      padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                        background: fw.status === 'stable' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: fw.status === 'stable' ? '#22C55E' : '#F59E0B',
                      }}>
                        <Cpu size={17} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: txt }}>{fw.name}</span>
                          <code style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#818CF8', background: 'rgba(99,102,241,0.12)', padding: '1px 6px', borderRadius: 4 }}>v{fw.version}</code>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700,
                            padding: '2px 8px', borderRadius: 20,
                            background: fw.status === 'stable' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                            color: fw.status === 'stable' ? '#22C55E' : '#F59E0B',
                          }}>
                            {fw.status === 'stable' ? 'STABLE' : 'DRAFT'}
                          </span>
                          {fw.signatureValid && <Check size={12} color="#22C55E" />}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: sub, marginTop: 3 }}>
                          {fw.deviceModel} · {(fw.size / 1024).toFixed(0)} KB · {new Date(fw.uploadDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {fw.status === 'draft' ? (
                          <button onClick={() => handleMarkAsStable(fw.id)} style={{
                            ...btnBase, background: 'rgba(34,197,94,0.15)', color: '#22C55E',
                            border: '1px solid rgba(34,197,94,0.3)', padding: '5px 10px', fontSize: '0.75rem',
                          }}>Activate</button>
                        ) : (
                          <button onClick={() => handleDeactivateFirmware(fw)} style={{
                            ...btnBase, background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
                            border: '1px solid rgba(245,158,11,0.3)', padding: '5px 10px', fontSize: '0.75rem',
                          }}>Deactivate</button>
                        )}
                        <button onClick={() => handleDeleteFirmware(fw)} style={{
                          ...btnBase, background: 'rgba(239,68,68,0.1)', color: '#EF4444',
                          border: '1px solid rgba(239,68,68,0.25)', padding: '5px 8px', fontSize: '0.75rem',
                        }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION 2: Deploy Firmware                                */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div style={cardStyle(isDark)}>
        <CardHeader
          icon={<Zap size={19} color="white" />}
          gradient="linear-gradient(135deg, #F59E0B, #D97706)"
          glowColor="rgba(245,158,11,0.45)"
          title="Deploy Firmware"
          subtitle="Push an update campaign to target devices"
        />

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={sectionPill('linear-gradient(135deg, #F59E0B, #D97706)')} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FCD34D' }}>Campaign Configuration</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={labelStyle(isDark)}>Firmware Version *</label>
              <select value={deploymentConfig.firmwareVersion}
                onChange={e => setDeploymentConfig(c => ({ ...c, firmwareVersion: e.target.value }))}
                style={inputStyle(isDark)}>
                <option value="">— Select Version —</option>
                {firmwares.filter(f => f.status === 'stable').map(f => (
                  <option key={f.id} value={f.version}>{f.name} v{f.version}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle(isDark)}>Deployment Mode</label>
              <select value={deploymentConfig.mode}
                onChange={e => setDeploymentConfig(c => ({ ...c, mode: e.target.value as 'immediate' | 'canary' }))}
                style={inputStyle(isDark)}>
                <option value="immediate">Immediate (all devices)</option>
                <option value="canary">Canary (gradual rollout)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle(isDark)}>Health Timeout (s)</label>
              <input type="number" min="30" max="3600" value={deploymentConfig.healthTimeout}
                onChange={e => setDeploymentConfig(c => ({ ...c, healthTimeout: parseInt(e.target.value) }))}
                style={inputStyle(isDark)} />
            </div>
            <div>
              <label style={labelStyle(isDark)}>Failure Threshold (%)</label>
              <input type="number" min="1" max="100" value={deploymentConfig.failureThreshold}
                onChange={e => setDeploymentConfig(c => ({ ...c, failureThreshold: parseInt(e.target.value) }))}
                style={inputStyle(isDark)} />
            </div>
          </div>

          {/* Target Devices */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={sectionPill('linear-gradient(135deg, #F59E0B, #D97706)')} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FCD34D', flex: 1 }}>
              Target Devices — {deploymentConfig.targetDevices.length} selected
            </span>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: sub }} />
              <input placeholder="Search device…" value={idleDeviceSearch} onChange={e => setIdleDeviceSearch(e.target.value)}
                style={{ ...inputStyle(isDark, { paddingLeft: 28, width: 160 }) }} />
            </div>
            <button onClick={handleSelectAllDevices} style={{
              ...btnBase, background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
              border: '1px solid rgba(245,158,11,0.3)', padding: '5px 12px', fontSize: '0.75rem',
            }}>
              Select All Available ({devices.filter(d => d.status === 'idle' || d.status === 'healthy' || d.status === 'failed').length})
            </button>
          </div>

          <div style={{
            maxHeight: 160, overflowY: 'auto', borderRadius: 8,
            border: `1px solid ${bdr}`, background: tok.bgMuted(isDark), padding: '10px 12px',
            marginBottom: 16,
          }}>
            {loadingDevices ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: sub, fontSize: '0.875rem' }}>Loading devices…</div>
            ) : devices.filter(d => d.status === 'idle' || d.status === 'healthy' || d.status === 'failed').length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: sub, fontSize: '0.875rem' }}>No devices available</div>
            ) : (
              devices.filter(d => (d.status === 'idle' || d.status === 'healthy' || d.status === 'failed') && (!idleDeviceSearch.trim() || d.deviceId.toLowerCase().includes(idleDeviceSearch.toLowerCase()))).map(device => (
                <label key={device.deviceId} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                  cursor: 'pointer', fontSize: '0.875rem', color: txt,
                }}>
                  <input type="checkbox"
                    checked={deploymentConfig.targetDevices.includes(device.deviceId)}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...deploymentConfig.targetDevices, device.deviceId]
                        : deploymentConfig.targetDevices.filter(id => id !== device.deviceId);
                      setDeploymentConfig(c => ({ ...c, targetDevices: next }));
                    }}
                    style={{ accentColor: '#F59E0B', width: 15, height: 15 }}
                  />
                  <code style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{device.deviceId}</code>
                  <span style={{ color: sub, fontSize: '0.75rem' }}>({device.currentVersion})</span>
                  {device.status === 'failed' && <span style={{ fontSize: '0.65rem', color: '#EF4444', background: 'rgba(239,68,68,0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>FAILED</span>}
                </label>
              ))
            )}
          </div>

          {/* Options row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: txt }}>
              <input type="checkbox" checked={deploymentConfig.autoRollback}
                onChange={e => setDeploymentConfig(c => ({ ...c, autoRollback: e.target.checked }))}
                style={{ accentColor: '#22C55E', width: 16, height: 16, cursor: 'pointer' }}
              />
              Auto Rollback on Failure
            </label>
            <span style={{ fontSize: '0.8125rem', color: sub }}>Automatically reverts if failure threshold exceeded</span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={handleDeployClick} disabled={isDeploying} style={{
              ...btnBase,
              background: isDeploying ? '#374151' : 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: isDeploying ? sub : 'white',
              boxShadow: isDeploying ? 'none' : '0 4px 14px rgba(245,158,11,0.4)',
              cursor: isDeploying ? 'not-allowed' : 'pointer',
            }}>
              {isDeploying ? <Loader2 size={15} className="ota-spinner" /> : <Zap size={15} />}
              {isDeploying ? 'Deploying…' : 'Deploy Firmware'}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION 3: Live Deployment Status                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div style={cardStyle(isDark)}>
        <CardHeader
          icon={<Radio size={19} color="white" />}
          gradient="linear-gradient(135deg, #06B6D4, #0284C7)"
          glowColor="rgba(6,182,212,0.45)"
          title="Live Deployment Status"
          subtitle="Per-device update progress and fleet health"
          right={
            loadingDevices ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: sub, fontSize: '0.8125rem' }}>
                <Loader2 size={14} className="ota-spinner" /> Syncing…
              </div>
            ) : undefined
          }
        />

        <div style={{ padding: 24 }}>
          {/* Active Deployment Banner */}
          {activeDeployment && (
            <div style={{
              borderRadius: 10,
              padding: '14px 18px',
              marginBottom: 20,
              background: activeDeployment.status === 'in_progress'
                ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))'
                : 'rgba(34,197,94,0.08)',
              border: `1px solid ${activeDeployment.status === 'in_progress' ? 'rgba(99,102,241,0.35)' : 'rgba(34,197,94,0.25)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeDeployment.status === 'in_progress' ? '#6366F1' : '#22C55E', animation: activeDeployment.status === 'in_progress' ? 'pulse 1.5s infinite' : 'none' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: txt }}>
                    {activeDeployment.status === 'in_progress' ? 'Active Campaign' : 'Deployment Complete'}
                  </span>
                </div>
                <code style={{ fontSize: '0.75rem', color: sub, background: tok.bgMuted(isDark), padding: '2px 8px', borderRadius: 6 }}>
                  ID #{activeDeployment.id}
                </code>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Firmware', value: activeDeployment.target_firmware?.version || 'N/A' },
                  { label: 'Total', value: activeDeployment.devices_total || 0 },
                  { label: 'Updated', value: activeDeployment.devices_updated || 0 },
                  { label: 'Failed', value: activeDeployment.devices_failed || 0 },
                  { label: 'Progress', value: activeDeployment.devices_total > 0 ? `${Math.round((activeDeployment.devices_updated / activeDeployment.devices_total) * 100)}%` : '0%' },
                  { label: 'Started', value: new Date(activeDeployment.created_at).toLocaleTimeString() },
                ].map(item => (
                  <div key={item.label} style={{ background: tok.bgMuted(isDark), borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: '0.7rem', color: sub, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: txt, fontFamily: typeof item.value === 'string' && item.value.startsWith('v') ? 'monospace' : 'inherit' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {/* Overall progress bar */}
              {activeDeployment.devices_total > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ height: 4, borderRadius: 4, background: tok.bgMuted(isDark), overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round((activeDeployment.devices_updated / activeDeployment.devices_total) * 100)}%`,
                      background: activeDeployment.status === 'in_progress' ? 'linear-gradient(90deg, #6366F1, #22C55E)' : '#22C55E',
                      transition: 'width 0.5s ease',
                      borderRadius: 4,
                    }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Filter Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {(['all', 'idle', 'downloading', 'flashing', 'rebooting', 'trial', 'healthy', 'failed', 'rolledback'] as const).map(s => {
              const isActive = statusFilter === s;
              const cfg = s !== 'all' ? STATUS_CONFIG[s] : null;
              return (
                <button key={s} onClick={() => setStatusFilter(s)} style={{
                  ...btnBase,
                  padding: '4px 12px', fontSize: '0.75rem',
                  background: isActive ? (cfg ? cfg.bg : 'rgba(99,102,241,0.18)') : tok.bgMuted(isDark),
                  color: isActive ? (cfg ? cfg.text : '#818CF8') : sub,
                  border: `1px solid ${isActive ? (cfg ? cfg.dot + '55' : 'rgba(99,102,241,0.4)') : bdr}`,
                }}>
                  {s === 'trial' ? 'Notified' : s.charAt(0).toUpperCase() + s.slice(1)}
                  {s !== 'all' && <span style={{ marginLeft: 4, opacity: 0.7 }}>({devices.filter(d => d.status === s).length})</span>}
                </button>
              );
            })}
          </div>

          {/* Device Table */}
          {loadingDevices ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: sub }}>
              <Loader2 size={28} className="ota-spinner" style={{ marginBottom: 10 }} />
              <div>Loading devices from backend…</div>
            </div>
          ) : devices.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: sub }}>
              <Cpu size={40} style={{ marginBottom: 10, opacity: 0.3 }} />
              <div style={{ fontWeight: 600 }}>No devices registered yet</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: card, zIndex: 1 }}>
                  <tr style={{ borderBottom: `2px solid ${bdr}` }}>
                    {['Device ID', 'Current', 'Target', 'Slot', 'Status', 'Boot #', 'Last Error'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: sub, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map(device => (
                    <tr key={device.deviceId} style={{ borderBottom: `1px solid ${bdr}`, transition: 'background 0.1s' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: txt, whiteSpace: 'nowrap' }}>{device.deviceId}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8125rem', color: sub }}>{device.currentVersion}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8125rem', color: device.targetVersion === 'N/A' ? tok.textMuted(isDark) : '#818CF8' }}>{device.targetVersion}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: device.activeSlot === 'A' ? 'rgba(59,130,246,0.15)' : 'rgba(251,146,60,0.15)',
                          color: device.activeSlot === 'A' ? '#3B82F6' : '#FB923C',
                          padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: '0.75rem',
                        }}>{device.activeSlot}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <StatusBadge status={device.status} />
                        {device.status === 'downloading' && device.progress !== undefined && (
                          <div style={{ marginTop: 5, width: 100 }}>
                            <div style={{ height: 3, borderRadius: 3, background: bdr, overflow: 'hidden' }}>
                              <div style={{ width: `${device.progress}%`, height: '100%', background: '#06B6D4', transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#06B6D4' }}>{device.progress}%</span>
                          </div>
                        )}
                        {device.lastCheckedAt && (
                          <div style={{ fontSize: '0.7rem', color: tok.textMuted(isDark), marginTop: 2 }}>
                            {new Date(device.lastCheckedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', color: sub }}>{device.bootCount}</td>
                      <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: device.lastError ? '#EF4444' : tok.textMuted(isDark), maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {device.lastError || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION 4: Emergency Rollback                             */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div style={{ ...cardStyle(isDark, { border: `1px solid rgba(239,68,68,0.35)` }) }}>
        <CardHeader
          icon={<RotateCcw size={19} color="white" />}
          gradient="linear-gradient(135deg, #EF4444, #B91C1C)"
          glowColor="rgba(239,68,68,0.45)"
          title="Emergency Rollback"
          subtitle="Revert selected devices to previous firmware immediately"
        />

        <div style={{ padding: 24 }}>
          {/* Warning + Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#EF4444', fontWeight: 700, fontSize: '0.8125rem' }}>
                <AlertTriangle size={14} /> Warning
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: sub, lineHeight: 1.5 }}>
                Use only in emergency situations. Devices will revert to previous firmware on next heartbeat.
              </p>
            </div>
            <div style={{ background: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#3B82F6', fontWeight: 700, fontSize: '0.8125rem' }}>
                <Info size={14} /> How it works
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: sub, lineHeight: 1.5 }}>
                Sends <code style={{ background: tok.bgMuted(isDark), padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>updateConfig=2</code> to trigger automatic revert to the previous firmware slot.
              </p>
            </div>
          </div>

          {/* Rollback Reason */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle(isDark)}>Rollback Reason *</label>
            <textarea value={rollbackForm.reason} onChange={e => setRollbackForm(r => ({ ...r, reason: e.target.value }))}
              placeholder="Describe the issue that requires rollback…" rows={2}
              style={{ ...inputStyle(isDark), resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={sectionPill('linear-gradient(135deg, #EF4444, #B91C1C)')} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FCA5A5' }}>Device Selection</span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <select value={rollbackFilters.currentVersion} onChange={e => setRollbackFilters(f => ({ ...f, currentVersion: e.target.value }))} style={inputStyle(isDark, { width: 'auto', minWidth: 160 })}>
              <option value="all">All Versions</option>
              {Array.from(new Set(devices.map(d => d.currentVersion))).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={rollbackFilters.status} onChange={e => setRollbackFilters(f => ({ ...f, status: e.target.value }))} style={inputStyle(isDark, { width: 'auto', minWidth: 140 })}>
              <option value="all">All Statuses</option>
              {(['idle', 'failed', 'healthy', 'trial', 'downloading', 'flashing', 'rebooting', 'rolledback'] as const).map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <button onClick={() => { const f = getFilteredRollbackDevices(); setRollbackForm(r => ({ ...r, selectedDevices: f.map(d => d.deviceId) })); }} style={{ ...btnBase, background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)', padding: '6px 12px', fontSize: '0.75rem' }}>
              Select All Filtered ({getFilteredRollbackDevices().length})
            </button>
            <button onClick={() => { const f = devices.filter(d => d.status === 'failed'); setRollbackForm(r => ({ ...r, selectedDevices: f.map(d => d.deviceId) })); }} style={{ ...btnBase, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', padding: '6px 12px', fontSize: '0.75rem' }}>
              Failed Only ({devices.filter(d => d.status === 'failed').length})
            </button>
            <button onClick={() => setRollbackForm(r => ({ ...r, selectedDevices: [] }))} style={{ ...btnBase, background: tok.bgMuted(isDark), color: sub, border: `1px solid ${bdr}`, padding: '6px 12px', fontSize: '0.75rem' }}>
              Deselect All
            </button>
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: sub }} />
              <input placeholder="Search device…" value={rollbackDeviceSearch} onChange={e => setRollbackDeviceSearch(e.target.value)}
                style={{ ...inputStyle(isDark, { paddingLeft: 28, width: 160 }) }} />
            </div>
          </div>

          {/* Device selection table */}
          <div style={{ background: tok.bgSub(isDark), border: `1px solid ${bdr}`, borderRadius: 10, maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: tok.bgSub(isDark), zIndex: 1 }}>
                <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                  <th style={{ padding: '8px 12px', width: 40 }}>
                    <input type="checkbox"
                      checked={getFilteredRollbackDevices().length > 0 && getFilteredRollbackDevices().every(d => rollbackForm.selectedDevices.includes(d.deviceId))}
                      onChange={e => {
                        const f = getFilteredRollbackDevices();
                        setRollbackForm(r => ({ ...r, selectedDevices: e.target.checked ? f.map(d => d.deviceId) : [] }));
                      }}
                      style={{ accentColor: '#EF4444', cursor: 'pointer' }}
                    />
                  </th>
                  {['Device ID', 'Current', 'Target', 'Status', 'Boot #', 'Last Error'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: sub }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getFilteredRollbackDevices()
                  .filter(d => !rollbackDeviceSearch.trim() || d.deviceId.toLowerCase().includes(rollbackDeviceSearch.toLowerCase()))
                  .map(device => {
                    const selected = rollbackForm.selectedDevices.includes(device.deviceId);
                    return (
                      <tr key={device.deviceId} onClick={() => toggleRollbackDevice(device.deviceId)}
                        style={{ borderBottom: `1px solid ${bdr}`, background: selected ? 'rgba(239,68,68,0.07)' : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <input type="checkbox" checked={selected} onChange={() => toggleRollbackDevice(device.deviceId)}
                            onClick={e => e.stopPropagation()} style={{ accentColor: '#EF4444', cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: txt }}>{device.deviceId}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.8125rem', color: sub }}>{device.currentVersion}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.8125rem', color: '#818CF8' }}>{device.targetVersion}</td>
                        <td style={{ padding: '8px 12px' }}><StatusBadge status={device.status} /></td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: sub }}>{device.bootCount}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: device.lastError ? '#EF4444' : tok.textMuted(isDark) }}>{device.lastError || '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Rollback Button */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowRollbackModal(true)}
              disabled={rollbackForm.selectedDevices.length === 0}
              style={{
                ...btnBase,
                background: rollbackForm.selectedDevices.length === 0 ? tok.bgMuted(isDark) : 'linear-gradient(135deg, #EF4444, #B91C1C)',
                color: rollbackForm.selectedDevices.length === 0 ? sub : 'white',
                boxShadow: rollbackForm.selectedDevices.length === 0 ? 'none' : '0 4px 14px rgba(239,68,68,0.4)',
                cursor: rollbackForm.selectedDevices.length === 0 ? 'not-allowed' : 'pointer',
                opacity: rollbackForm.selectedDevices.length === 0 ? 0.5 : 1,
                padding: '10px 24px',
              }}
            >
              <RotateCcw size={15} />
              Rollback {rollbackForm.selectedDevices.length} Device{rollbackForm.selectedDevices.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>

      {/* ── Deployment Confirm Modal ── */}
      <Modal show={confirmModal.show} onClose={() => setConfirmModal(m => ({ ...m, show: false }))}
        icon={<Zap size={20} color="white" />}
        gradient="linear-gradient(135deg, #F59E0B, #D97706)"
        glow="rgba(245,158,11,0.45)"
        title="Confirm Deployment"
        isDark={isDark}
        footer={<>
          <button onClick={() => setConfirmModal(m => ({ ...m, show: false }))} style={{ ...btnBase, background: tok.bgMuted(isDark), color: sub, border: `1px solid ${bdr}` }}>Cancel</button>
          <button onClick={confirmDeployment} style={{ ...btnBase, background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'white', boxShadow: '0 4px 12px rgba(245,158,11,0.35)' }}>Confirm Deploy</button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['Firmware', confirmModal.firmware], ['Target Devices', confirmModal.deviceCount], ['Data Transfer', confirmModal.dataTransfer], ['Auto Rollback', deploymentConfig.autoRollback ? 'Enabled' : 'Disabled'], ['Failure Threshold', `${deploymentConfig.failureThreshold}%`]].map(([k, v]) => (
            <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${bdr}`, paddingBottom: 5 }}>
              <span style={{ color: sub }}>{k}</span>
              <span style={{ fontWeight: 600, color: txt }}>{String(v)}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '8px 12px', color: '#FCD34D', fontSize: '0.8125rem' }}>
            This will push firmware updates to {confirmModal.deviceCount} device{confirmModal.deviceCount !== 1 ? 's' : ''}.
          </div>
        </div>
      </Modal>

      {/* ── Rollback Confirm Modal ── */}
      <Modal show={showRollbackModal} onClose={() => setShowRollbackModal(false)}
        icon={<RotateCcw size={20} color="white" />}
        gradient="linear-gradient(135deg, #EF4444, #B91C1C)"
        glow="rgba(239,68,68,0.45)"
        title="Confirm Emergency Rollback"
        isDark={isDark}
        footer={<>
          <button onClick={() => setShowRollbackModal(false)} style={{ ...btnBase, background: tok.bgMuted(isDark), color: sub, border: `1px solid ${bdr}` }}>Cancel</button>
          <button onClick={confirmRollback} style={{ ...btnBase, background: 'linear-gradient(135deg, #EF4444, #B91C1C)', color: 'white', boxShadow: '0 4px 12px rgba(239,68,68,0.35)' }}>Confirm Rollback</button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['Command', 'updateConfig = 2 (auto-revert)'], ['Devices', rollbackForm.selectedDevices.length], ['Reason', rollbackForm.reason || 'Not provided']].map(([k, v]) => (
            <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${bdr}`, paddingBottom: 5 }}>
              <span style={{ color: sub }}>{k}</span>
              <span style={{ fontWeight: 600, color: txt, maxWidth: 260, textAlign: 'right', wordBreak: 'break-word' }}>{String(v)}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '8px 12px', color: '#FCA5A5', fontSize: '0.8125rem' }}>
            This action cannot be undone. Devices will revert on their next heartbeat.
          </div>
        </div>
      </Modal>

      {/* ── Generic Confirm Modal ── */}
      <Modal show={confirmActionModal.show} onClose={() => setConfirmActionModal(m => ({ ...m, show: false }))}
        icon={confirmActionModal.icon}
        gradient={`linear-gradient(135deg, ${confirmActionModal.accentColor}, ${confirmActionModal.accentColor}bb)`}
        glow={`${confirmActionModal.accentColor}55`}
        title={confirmActionModal.title}
        isDark={isDark}
        footer={<>
          <button onClick={() => setConfirmActionModal(m => ({ ...m, show: false }))} style={{ ...btnBase, background: tok.bgMuted(isDark), color: sub, border: `1px solid ${bdr}` }}>Cancel</button>
          <button onClick={async () => {
            const action = confirmActionModal.onConfirm;
            setConfirmActionModal(m => ({ ...m, show: false }));
            try { await action(); } catch (err: any) { setErrorModal({ show: true, message: err.message || 'Operation failed' }); }
          }} style={{ ...btnBase, background: `linear-gradient(135deg, ${confirmActionModal.accentColor}, ${confirmActionModal.accentColor}bb)`, color: 'white', boxShadow: `0 4px 12px ${confirmActionModal.accentColor}44` }}>
            {confirmActionModal.confirmLabel}
          </button>
        </>}
      >
        <p style={{ margin: '0 0 12px' }}>{confirmActionModal.message}</p>
        <div style={{ background: tok.bgMuted(isDark), border: `1px solid ${confirmActionModal.accentColor}33`, borderRadius: 6, padding: '8px 12px', fontSize: '0.8125rem', color: sub }}>
          {confirmActionModal.warningText}
        </div>
      </Modal>

      {/* ── Success Modal ── */}
      <Modal show={successModal.show} onClose={() => setSuccessModal({ show: false, message: '' })}
        icon={<CheckCircle2 size={20} color="white" />}
        gradient="linear-gradient(135deg, #10B981, #059669)"
        glow="rgba(16,185,129,0.45)"
        title="Success"
        isDark={isDark}
        footer={<button onClick={() => setSuccessModal({ show: false, message: '' })} style={{ ...btnBase, background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>Done</button>}
      >
        <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{successModal.message}</p>
      </Modal>

      {/* ── Error Modal ── */}
      <Modal show={errorModal.show} onClose={() => setErrorModal({ show: false, message: '' })}
        icon={<AlertCircle size={20} color="white" />}
        gradient="linear-gradient(135deg, #EF4444, #B91C1C)"
        glow="rgba(239,68,68,0.45)"
        title="Error"
        isDark={isDark}
        footer={<button onClick={() => setErrorModal({ show: false, message: '' })} style={{ ...btnBase, background: 'linear-gradient(135deg, #EF4444, #B91C1C)', color: 'white', boxShadow: '0 4px 12px rgba(239,68,68,0.35)' }}>Dismiss</button>}
      >
        <p style={{ margin: 0 }}>{errorModal.message}</p>
      </Modal>

    </div>
  );
};
