import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Shield, Trash2, Settings, Bell, FileText, AlertTriangle, X, ChevronRight, Lock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export interface DeleteDeviceOptions {
  revoke_iot: boolean;
  delete_config: boolean;
  delete_alerts: boolean;
  delete_logs: boolean;
}

interface DeleteDeviceModalProps {
  open: boolean;
  device: { id: number; device_serial: string; site?: string } | null;
  onClose: () => void;
  onConfirm: (options: DeleteDeviceOptions) => Promise<void>;
}

const CLEANUP_OPTIONS = [
  {
    key: 'revoke_iot' as keyof DeleteDeviceOptions,
    icon: Shield,
    label: 'Revoke IoT Certificates',
    description: 'Detach and revoke all AWS IoT Core certificates. Device cannot reconnect without re-provisioning.',
    recommended: true,
    danger: false,
  },
  {
    key: 'delete_config' as keyof DeleteDeviceOptions,
    icon: Settings,
    label: 'Delete Device Configuration',
    description: 'Remove gateway config, slave devices, and all register mappings.',
    recommended: false,
    danger: false,
  },
  {
    key: 'delete_alerts' as keyof DeleteDeviceOptions,
    icon: Bell,
    label: 'Delete Alert History',
    description: 'Permanently remove all alerts raised by this device.',
    recommended: false,
    danger: true,
  },
  {
    key: 'delete_logs' as keyof DeleteDeviceOptions,
    icon: FileText,
    label: 'Delete Log Files',
    description: 'Remove all uploaded diagnostic log files for this device.',
    recommended: false,
    danger: false,
  },
];

export const DeleteDeviceModal: React.FC<DeleteDeviceModalProps> = ({
  open, device, onClose, onConfirm,
}) => {
  const { isDark } = useTheme();
  const [options, setOptions] = useState<DeleteDeviceOptions>({
    revoke_iot: true,
    delete_config: false,
    delete_alerts: false,
    delete_logs: false,
  });
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const requiredText = device?.device_serial ?? '';
  const confirmed = confirmText === requiredText;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setOptions({ revoke_iot: true, delete_config: false, delete_alerts: false, delete_logs: false });
      setConfirmText('');
      setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const toggle = (key: keyof DeleteDeviceOptions) =>
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));

  const handleConfirm = async () => {
    if (!confirmed || loading) return;
    setLoading(true);
    try {
      await onConfirm(options);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !device) return null;

  const S: Record<string, React.CSSProperties> = {
    overlay: {
      position: 'fixed', inset: 0,
      background: 'rgba(4, 6, 10, 0.88)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '20px',
      opacity: open ? 1 : 0,
      transition: 'opacity 0.2s ease',
    },
    panel: {
      background: isDark ? '#0C1018' : '#FFFFFF',
      border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)'}`,
      borderRadius: 16,
      width: '100%', maxWidth: 480,
      boxShadow: isDark
        ? '0 0 0 1px rgba(239,68,68,0.08), 0 32px 64px rgba(0,0,0,0.6)'
        : '0 32px 64px rgba(0,0,0,0.15)',
      transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
      transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      overflow: 'hidden',
    },
    header: {
      padding: '20px 20px 0',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    },
    closeBtn: {
      width: 32, height: 32, borderRadius: 8,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      background: 'transparent', cursor: 'pointer', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: isDark ? 'rgba(240,244,255,0.4)' : 'rgba(18,21,26,0.4)',
      transition: 'all 0.15s',
    },
    body: { padding: '20px' },
    serialBox: {
      background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)',
      border: `1px solid ${isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)'}`,
      borderRadius: 10, padding: '12px 14px',
      marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 10,
    },
    serialText: {
      fontFamily: 'Fira Code, JetBrains Mono, monospace',
      fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.02em',
      color: isDark ? '#F87171' : '#DC2626',
    },
    sectionLabel: {
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      color: isDark ? 'rgba(240,244,255,0.3)' : 'rgba(18,21,26,0.35)',
      marginBottom: 10,
    },
    optionRow: (checked: boolean, danger: boolean) => ({
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '11px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
      border: `1px solid ${checked
        ? (danger ? 'rgba(239,68,68,0.35)' : 'rgba(47,191,113,0.3)')
        : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)')}`,
      background: checked
        ? (danger
          ? isDark ? 'rgba(239,68,68,0.07)' : 'rgba(239,68,68,0.04)'
          : isDark ? 'rgba(47,191,113,0.07)' : 'rgba(47,191,113,0.04)')
        : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
      transition: 'all 0.15s ease',
      userSelect: 'none' as const,
    }),
    checkbox: (checked: boolean, danger: boolean) => ({
      width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
      border: `2px solid ${checked
        ? (danger ? '#EF4444' : '#2FBF71')
        : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')}`,
      background: checked ? (danger ? '#EF4444' : '#2FBF71') : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
    }),
    confirmSection: {
      borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      padding: '16px 20px 20px',
    },
    confirmLabel: {
      fontSize: '0.75rem',
      color: isDark ? 'rgba(240,244,255,0.45)' : 'rgba(18,21,26,0.5)',
      marginBottom: 8, display: 'block',
    },
    confirmInput: {
      width: '100%', padding: '10px 12px',
      fontFamily: 'Fira Code, JetBrains Mono, monospace',
      fontSize: '0.825rem', letterSpacing: '0.04em',
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      border: `1px solid ${confirmText && !confirmed
        ? '#EF4444'
        : confirmed
          ? '#2FBF71'
          : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
      borderRadius: 8, color: isDark ? '#F0F4FF' : '#12151A',
      outline: 'none', boxSizing: 'border-box' as const,
      transition: 'border-color 0.15s',
    },
    actions: {
      display: 'flex', gap: 10, marginTop: 14,
    },
    cancelBtn: {
      flex: 1, padding: '10px', borderRadius: 8,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      background: 'transparent', cursor: 'pointer',
      fontSize: '0.875rem', fontWeight: 500,
      color: isDark ? 'rgba(240,244,255,0.6)' : 'rgba(18,21,26,0.6)',
      transition: 'all 0.15s',
    },
    deleteBtn: (active: boolean) => ({
      flex: 2, padding: '10px 16px', borderRadius: 8, border: 'none',
      background: active
        ? 'linear-gradient(135deg, #DC2626, #EF4444)'
        : isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
      cursor: active ? 'pointer' : 'not-allowed',
      fontSize: '0.875rem', fontWeight: 600,
      color: active ? '#fff' : isDark ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      transition: 'all 0.2s',
      boxShadow: active ? '0 4px 16px rgba(239,68,68,0.3)' : 'none',
    }),
  };

  const modal = (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.panel} role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.08))',
              border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trash2 size={18} color="#EF4444" />
            </div>
            <div>
              <div id="delete-modal-title" style={{
                fontSize: '0.9375rem', fontWeight: 700,
                color: isDark ? '#F0F4FF' : '#12151A',
                lineHeight: 1.2,
              }}>Delete Device</div>
              <div style={{
                fontSize: '0.75rem', marginTop: 2,
                color: isDark ? 'rgba(240,244,255,0.4)' : 'rgba(18,21,26,0.45)',
              }}>Soft delete — telemetry data is always retained</div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {/* Device serial */}
          <div style={S.serialBox}>
            <AlertTriangle size={15} color="#F87171" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: isDark ? 'rgba(240,244,255,0.35)' : 'rgba(18,21,26,0.4)', marginBottom: 2 }}>
                Device to delete
              </div>
              <div style={S.serialText}>{device.device_serial}</div>
            </div>
          </div>

          {/* Cleanup options */}
          <div style={S.sectionLabel}>Also remove</div>

          {CLEANUP_OPTIONS.map(({ key, icon: Icon, label, description, recommended, danger }) => {
            const checked = options[key];
            return (
              <div key={key} style={S.optionRow(checked, danger)} onClick={() => toggle(key)}>
                {/* Checkbox */}
                <div style={S.checkbox(checked, danger)}>
                  {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: checked
                    ? (danger ? 'rgba(239,68,68,0.12)' : 'rgba(47,191,113,0.1)')
                    : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}>
                  <Icon size={15} color={
                    checked ? (danger ? '#EF4444' : '#2FBF71')
                      : isDark ? 'rgba(240,244,255,0.4)' : 'rgba(18,21,26,0.4)'
                  } />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
                  }}>
                    <span style={{
                      fontSize: '0.8125rem', fontWeight: 600,
                      color: isDark ? '#F0F4FF' : '#12151A',
                    }}>{label}</span>
                    {recommended && (
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '1px 5px', borderRadius: 4,
                        background: 'rgba(47,191,113,0.12)',
                        color: '#2FBF71',
                        border: '1px solid rgba(47,191,113,0.2)',
                      }}>Recommended</span>
                    )}
                    {danger && (
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '1px 5px', borderRadius: 4,
                        background: 'rgba(239,68,68,0.1)',
                        color: '#F87171',
                        border: '1px solid rgba(239,68,68,0.2)',
                      }}>Destructive</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '0.72rem', lineHeight: 1.5,
                    color: isDark ? 'rgba(240,244,255,0.4)' : 'rgba(18,21,26,0.45)',
                  }}>{description}</div>
                </div>
              </div>
            );
          })}

          {/* Retained data note */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
            padding: '9px 12px', borderRadius: 8,
            background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <Lock size={13} color={isDark ? 'rgba(240,244,255,0.25)' : 'rgba(18,21,26,0.3)'} style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: '0.7rem',
              color: isDark ? 'rgba(240,244,255,0.3)' : 'rgba(18,21,26,0.35)',
            }}>
              Telemetry, energy readings, and S3 archives are always retained and cannot be deleted.
            </span>
          </div>
        </div>

        {/* Confirm + Actions */}
        <div style={S.confirmSection}>
          <label style={S.confirmLabel} htmlFor="confirm-serial-input">
            Type <span style={{ fontFamily: 'Fira Code, monospace', color: isDark ? '#F87171' : '#DC2626' }}>{requiredText}</span> to confirm
          </label>
          <input
            id="confirm-serial-input"
            ref={inputRef}
            style={S.confirmInput}
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            placeholder={requiredText}
            autoComplete="off"
            spellCheck={false}
          />
          <div style={S.actions}>
            <button style={S.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
            <button
              style={S.deleteBtn(confirmed && !loading)}
              onClick={handleConfirm}
              disabled={!confirmed || loading}
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <circle cx="7" cy="7" r="5.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                    <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Delete Device
                  <ChevronRight size={13} style={{ opacity: 0.7 }} />
                </>
              )}
            </button>
          </div>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default DeleteDeviceModal;
