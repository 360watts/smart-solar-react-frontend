/**
 * EditDeviceModal — Industrial Command-Centre Design
 *
 * Aesthetic: Dark OLED server-room panel. Amber telemetry readouts,
 * electric-blue editable fields, JetBrains Mono precision typography,
 * thin scan-line dividers, LED status indicators.
 *
 * Layout: Fixed left info panel (telemetry) + scrollable right edit panel
 * Two-column on desktop, stacked on mobile.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Copy, Check, Loader2, Server, Zap, Wifi, Thermometer,
  Signal, Clock, Shield, Bell, BellOff, ToggleLeft, ToggleRight,
  ScrollText, ChevronDown, ChevronUp, AlertTriangle, Cpu,
} from 'lucide-react';
import DeviceTypeSelector from './DeviceTypeSelector';

interface Device {
  id: number;
  device_serial: string;
  device_type?: 'gateway' | 'energy_meter';
  hw_id?: string;
  model?: string;
  user?: string;
  provisioned_at: string;
  config_version?: string;
  config_ack_ver?: number | null;
  config_downloaded_at?: string | null;
  config_acked_at?: string | null;
  pending_config_update?: boolean;
  is_online?: boolean;
  last_heartbeat?: string;
  last_seen_at?: string;
  firmware_version?: string | null;
  connectivity_type?: string;
  network_ip?: string;
  signal_strength_dbm?: number | null;
  device_temp_c?: number | null;
  memory_status?: { free_heap?: number; min_free?: number } | null;
  logs_enabled?: boolean;
  auto_reboot_enabled?: boolean;
  alerts_muted_until?: string | null;
  wifi_ssid?: string | null;
  wifi_password?: string | null;
  heartbeat_health?: { severity?: string; issues?: string[]; age_seconds?: number | null } | null;
  uptime_seconds?: number | null;
  created_by_username?: string;
  created_at?: string;
  updated_by_username?: string;
  updated_at?: string;
}

interface EditDeviceModalProps {
  isOpen: boolean;
  device: Device | null;
  isDark: boolean;
  onClose: () => void;
  onSave: (data: Partial<Device>) => Promise<void>;
}

// ── Palette ────────────────────────────────────────────────────────────────────
const P = {
  bg:           '#080C14',
  surface:      '#0D1420',
  panel:        '#111827',
  border:       'rgba(255,255,255,0.06)',
  borderAccent: 'rgba(255,255,255,0.12)',
  amber:        '#F59E0B',
  amberDim:     'rgba(245,158,11,0.12)',
  blue:         '#3B82F6',
  blueDim:      'rgba(59,130,246,0.12)',
  green:        '#10B981',
  greenDim:     'rgba(16,185,129,0.12)',
  red:          '#EF4444',
  redDim:       'rgba(239,68,68,0.12)',
  text:         '#E2E8F0',
  textMid:      '#94A3B8',
  textDim:      '#475569',
  mono:         '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
  sans:         '"Fira Sans", system-ui, sans-serif',
};

// Light mode overrides
const PL = {
  bg:      '#F1F5F9',
  surface: '#FFFFFF',
  panel:   '#F8FAFC',
  border:  'rgba(0,0,0,0.07)',
  borderAccent: 'rgba(0,0,0,0.12)',
  text:    '#0F172A',
  textMid: '#475569',
  textDim: '#94A3B8',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(val?: string | null) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtUptime(secs?: number | null) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function signalBars(dbm?: number | null) {
  if (dbm == null) return '—';
  const q = dbm > -50 ? 'Excellent' : dbm > -60 ? 'Good' : dbm > -70 ? 'Fair' : 'Weak';
  return `${dbm} dBm (${q})`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
      paddingBottom: 8, borderBottom: `1px solid rgba(245,158,11,0.2)`,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: P.amber, fontFamily: P.mono,
      }}>{children}</span>
    </div>
  );
}

function ReadonlyField({ label, value, mono = false, color }: {
  label: string; value: React.ReactNode; mono?: boolean; color?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: P.textDim, fontFamily: P.mono, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, color: color ?? P.amber, fontFamily: mono ? P.mono : P.sans,
        letterSpacing: mono ? '0.02em' : undefined, lineHeight: 1.4,
        wordBreak: 'break-all',
      }}>
        {value || '—'}
      </div>
    </div>
  );
}

function CopyableField({ label, value }: { label: string; value?: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: P.textDim, fontFamily: P.mono, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: P.amber, fontFamily: P.mono, letterSpacing: '0.02em', wordBreak: 'break-all' }}>
          {value || '—'}
        </span>
        {value && (
          <button onClick={copy} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            color: copied ? P.green : P.textDim, transition: 'color 200ms', flexShrink: 0,
          }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Input field ────────────────────────────────────────────────────────────────
function EditField({ label, value, onChange, type = 'text', placeholder, isDark }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; isDark: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const bg = isDark ? P.surface : PL.surface;
  const border = focused ? P.blue : isDark ? P.border : PL.border;
  const shadow = focused ? `0 0 0 2px rgba(59,130,246,0.25)` : 'none';

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 10, fontFamily: P.mono, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: P.blue, marginBottom: 6, fontWeight: 700,
      }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '9px 12px',
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 6,
          color: isDark ? P.text : PL.text,
          fontFamily: P.mono, fontSize: 13,
          outline: 'none', transition: 'border 150ms, box-shadow 150ms',
          boxShadow: shadow,
        }}
      />
    </div>
  );
}

// ── Toggle row ─────────────────────────────────────────────────────────────────
function ToggleField({ label, sublabel, value, onChange }: {
  label: string; sublabel: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px', marginBottom: 10,
      background: value ? P.blueDim : 'transparent',
      border: `1px solid ${value ? 'rgba(59,130,246,0.25)' : P.border}`,
      borderRadius: 8, cursor: 'pointer', transition: 'all 200ms',
    }} onClick={() => onChange(!value)}>
      <div>
        <div style={{ fontSize: 13, color: P.text, fontFamily: P.sans, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: P.textDim, fontFamily: P.sans, marginTop: 2 }}>{sublabel}</div>
      </div>
      <div style={{ color: value ? P.blue : P.textDim, transition: 'color 200ms' }}>
        {value ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
      </div>
    </div>
  );
}

// ── Status LED ─────────────────────────────────────────────────────────────────
function StatusLED({ online }: { online?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: online ? P.green : P.red,
        boxShadow: online ? `0 0 8px ${P.green}` : `0 0 8px ${P.red}`,
        animation: online ? 'led-pulse 2s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, fontFamily: P.mono, letterSpacing: '0.06em', textTransform: 'uppercase', color: online ? P.green : P.red }}>
        {online ? 'Online' : 'Offline'}
      </span>
    </span>
  );
}

// ── Device type chip ───────────────────────────────────────────────────────────
function DeviceTypeChip({ type }: { type?: string }) {
  const isGateway = type === 'gateway';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontFamily: P.mono, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '4px 10px', borderRadius: 4,
      background: isGateway ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)',
      color: isGateway ? P.blue : P.amber,
      border: `1px solid ${isGateway ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.3)'}`,
    }}>
      {isGateway ? <Server size={11} /> : <Zap size={11} />}
      {isGateway ? 'Gateway' : 'Energy Meter'}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const EditDeviceModal: React.FC<EditDeviceModalProps> = ({
  isOpen, device, isDark, onClose, onSave,
}) => {
  const [formData, setFormData] = useState<Partial<Device>>({});
  const [originalType, setOriginalType] = useState<string>('gateway');
  const [showTypeConfirm, setShowTypeConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWifi, setShowWifi] = useState(false);
  const [muteMode, setMuteMode] = useState<'none' | 'hours' | 'datetime'>('none');
  const muteRef = useRef<HTMLInputElement>(null);

  const C = isDark ? P : { ...P, ...PL };

  useEffect(() => {
    if (!device || !isOpen) return;
    const type = device.device_type || 'gateway';
    setOriginalType(type);
    setFormData({
      device_type: type,
      config_version: device.config_version || '',
      logs_enabled: device.logs_enabled ?? false,
      auto_reboot_enabled: device.auto_reboot_enabled ?? true,
      wifi_ssid: device.wifi_ssid || '',
      wifi_password: '',
      alerts_muted_until: device.alerts_muted_until || '',
    });
    setError(null);
    setSaved(false);
    setShowWifi(false);
    setMuteMode('none');
  }, [device, isOpen]);

  const set = (key: keyof Device, val: unknown) =>
    setFormData(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!device) return;
    const typeChanged = formData.device_type !== originalType;
    if (typeChanged) { setShowTypeConfirm(true); return; }
    await doSave();
  };

  const doSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Device> = {
        device_type: formData.device_type,
        config_version: formData.config_version,
        logs_enabled: formData.logs_enabled,
        auto_reboot_enabled: formData.auto_reboot_enabled,
        wifi_ssid: formData.wifi_ssid,
        alerts_muted_until: formData.alerts_muted_until || null,
      };
      if (showWifi && formData.wifi_password) {
        payload.wifi_password = formData.wifi_password;
      }
      await onSave(payload);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const applyMuteHours = (h: number) => {
    const d = new Date(Date.now() + h * 3600000);
    set('alerts_muted_until', d.toISOString().slice(0, 16));
  };

  if (!device) return null;

  const memFree = device.memory_status?.free_heap;
  const health = device.heartbeat_health;

  return (
    <>
      <style>{`
        @keyframes led-pulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.5; }
        }
        @keyframes modal-in {
          from { opacity:0; transform:translateY(16px) scale(0.98); }
          to   { opacity:1; transform:translateY(0)     scale(1);    }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .edm-input:focus { outline:none; }
        .edm-btn:hover { filter: brightness(1.1); }
        .edm-close:hover { background: rgba(255,255,255,0.08) !important; }
        .edm-cancel:hover { background: rgba(255,255,255,0.05) !important; }
      `}</style>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
              style={{
                position: 'fixed', inset: 0, zIndex: 999,
                background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
              }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px', pointerEvents: 'none',
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%', maxWidth: 920, maxHeight: '92vh',
                  display: 'flex', flexDirection: 'column',
                  background: isDark ? P.bg : PL.bg,
                  border: `1px solid ${isDark ? P.borderAccent : PL.borderAccent}`,
                  borderRadius: 14,
                  boxShadow: isDark
                    ? '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)'
                    : '0 32px 80px rgba(0,0,0,0.18)',
                  overflow: 'hidden',
                  pointerEvents: 'all',
                  fontFamily: P.sans,
                }}
              >
                {/* ── Header ─────────────────────────────────── */}
                <div style={{
                  padding: '18px 24px',
                  borderBottom: `1px solid ${isDark ? P.border : PL.border}`,
                  background: isDark
                    ? 'linear-gradient(90deg, rgba(59,130,246,0.06) 0%, rgba(245,158,11,0.04) 100%)'
                    : 'linear-gradient(90deg, rgba(59,130,246,0.04) 0%, rgba(245,158,11,0.02) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                      background: P.blueDim, border: `1px solid rgba(59,130,246,0.3)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Cpu size={18} style={{ color: P.blue }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 16, fontWeight: 700, fontFamily: P.mono,
                          color: isDark ? P.text : PL.text, letterSpacing: '-0.01em',
                        }}>
                          {device.device_serial}
                        </span>
                        <StatusLED online={device.is_online} />
                        <DeviceTypeChip type={device.device_type} />
                      </div>
                      <div style={{ fontSize: 11, color: isDark ? P.textDim : PL.textDim, marginTop: 3, fontFamily: P.mono }}>
                        {device.model || 'Unknown model'} · {device.firmware_version || 'fw unknown'} · id:{device.id}
                      </div>
                    </div>
                  </div>
                  <button
                    className="edm-close"
                    onClick={onClose}
                    style={{
                      flexShrink: 0, width: 32, height: 32, borderRadius: 6,
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isDark ? P.textMid : PL.textMid, transition: 'background 150ms',
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* ── Body: two panels ───────────────────────── */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'clamp(200px, 36%, 300px) 1fr',
                  flex: 1, overflow: 'hidden',
                }}>

                  {/* LEFT — read-only telemetry */}
                  <div style={{
                    overflowY: 'auto',
                    padding: '20px 20px',
                    borderRight: `1px solid ${isDark ? P.border : PL.border}`,
                    background: isDark
                      ? 'linear-gradient(180deg, rgba(245,158,11,0.025) 0%, transparent 40%)'
                      : 'linear-gradient(180deg, rgba(245,158,11,0.015) 0%, transparent 40%)',
                  }}>
                    {/* Hardware */}
                    <SectionLabel>Hardware</SectionLabel>
                    <CopyableField label="Serial" value={device.device_serial} />
                    <ReadonlyField label="HW ID / MAC" value={device.hw_id} mono />
                    <ReadonlyField label="Model" value={device.model} />
                    <ReadonlyField label="Firmware" value={device.firmware_version} mono />
                    <ReadonlyField label="Provisioned" value={fmtDate(device.provisioned_at)} color={isDark ? P.textMid : PL.textMid} />

                    {/* Network */}
                    <div style={{ marginTop: 20 }}>
                      <SectionLabel>Network</SectionLabel>
                      <ReadonlyField label="IP Address" value={device.network_ip} mono />
                      <ReadonlyField label="Signal" value={signalBars(device.signal_strength_dbm)} mono />
                      <ReadonlyField label="Link" value={device.connectivity_type} />
                    </div>

                    {/* Telemetry */}
                    <div style={{ marginTop: 20 }}>
                      <SectionLabel>Telemetry</SectionLabel>
                      <ReadonlyField
                        label="Temperature"
                        value={device.device_temp_c != null ? `${device.device_temp_c.toFixed(1)} °C` : undefined}
                        color={device.device_temp_c != null && device.device_temp_c > 70 ? P.red : P.amber}
                        mono
                      />
                      <ReadonlyField label="Free Heap" value={memFree != null ? `${(memFree / 1024).toFixed(0)} KB` : undefined} mono />
                      <ReadonlyField label="Uptime" value={fmtUptime(device.uptime_seconds)} mono />
                      <ReadonlyField label="Last Heartbeat" value={fmtDate(device.last_heartbeat)} color={isDark ? P.textMid : PL.textMid} />
                    </div>

                    {/* Config sync */}
                    <div style={{ marginTop: 20 }}>
                      <SectionLabel>Config Sync</SectionLabel>
                      <ReadonlyField label="Ack Version" value={device.config_ack_ver?.toString()} mono />
                      <ReadonlyField label="Downloaded" value={fmtDate(device.config_downloaded_at)} color={isDark ? P.textMid : PL.textMid} />
                      <ReadonlyField label="Acked at" value={fmtDate(device.config_acked_at)} color={isDark ? P.textMid : PL.textMid} />
                      {device.pending_config_update && (
                        <div style={{
                          marginTop: 6, padding: '6px 10px', borderRadius: 6,
                          background: P.amberDim, border: `1px solid rgba(245,158,11,0.25)`,
                          fontSize: 11, color: P.amber, fontFamily: P.mono,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <AlertTriangle size={12} /> Config update pending
                        </div>
                      )}
                    </div>

                    {/* Audit */}
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${isDark ? P.border : PL.border}` }}>
                      <div style={{ fontSize: 10, color: P.textDim, fontFamily: P.mono, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Audit</div>
                      <div style={{ fontSize: 11, color: isDark ? P.textDim : PL.textDim, lineHeight: 1.7, fontFamily: P.sans }}>
                        {device.created_by_username && <div>Created by <span style={{ color: isDark ? P.textMid : PL.textMid }}>{device.created_by_username}</span></div>}
                        {device.updated_by_username && <div>Updated by <span style={{ color: isDark ? P.textMid : PL.textMid }}>{device.updated_by_username}</span></div>}
                        {device.updated_at && <div style={{ marginTop: 2 }}>{fmtDate(device.updated_at)}</div>}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT — editable fields */}
                  <div style={{ overflowY: 'auto', padding: '20px 24px' }}>

                    {/* Error banner */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          style={{
                            marginBottom: 16, padding: '10px 14px',
                            background: P.redDim, border: `1px solid rgba(239,68,68,0.3)`,
                            borderRadius: 8, fontSize: 13, color: P.red, fontFamily: P.sans,
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}
                        >
                          <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Device Type */}
                    <div style={{ marginBottom: 20 }}>
                      <SectionLabel>Device Type</SectionLabel>
                      <DeviceTypeSelector
                        value={(formData.device_type || 'gateway') as 'gateway' | 'energy_meter'}
                        onChange={v => set('device_type', v)}
                        disabled={false}
                      />
                    </div>

                    {/* Configuration */}
                    <SectionLabel>Configuration</SectionLabel>
                    <EditField
                      label="Config Version"
                      value={formData.config_version || ''}
                      onChange={v => set('config_version', v)}
                      placeholder="e.g. v1.0.0"
                      isDark={isDark}
                    />

                    {/* Behaviour toggles */}
                    <div style={{ marginTop: 20, marginBottom: 20 }}>
                      <SectionLabel>Behaviour</SectionLabel>
                      <ToggleField
                        label="Auto Reboot"
                        sublabel="Automatically reboot when RS-485 registers freeze"
                        value={formData.auto_reboot_enabled ?? true}
                        onChange={v => set('auto_reboot_enabled', v)}
                      />
                      <ToggleField
                        label="Log Streaming"
                        sublabel="Device uploads logs to S3 on each heartbeat"
                        value={formData.logs_enabled ?? false}
                        onChange={v => set('logs_enabled', v)}
                      />
                    </div>

                    {/* Wi-Fi Credentials */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
                        paddingBottom: 8, borderBottom: `1px solid rgba(245,158,11,0.2)`,
                      }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: P.amber, fontFamily: P.mono }}>
                          Wi-Fi Credentials
                        </span>
                        <button
                          onClick={() => setShowWifi(!showWifi)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: P.blue, fontSize: 11, fontFamily: P.mono,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          {showWifi ? <><ChevronUp size={13} /> Hide</> : <><ChevronDown size={13} /> Change</>}
                        </button>
                      </div>

                      <EditField
                        label="SSID"
                        value={formData.wifi_ssid || ''}
                        onChange={v => set('wifi_ssid', v)}
                        placeholder="Network name"
                        isDark={isDark}
                      />

                      <AnimatePresence>
                        {showWifi && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <EditField
                              label="New Password"
                              value={formData.wifi_password || ''}
                              onChange={v => set('wifi_password', v)}
                              type="password"
                              placeholder="Leave blank to keep current"
                              isDark={isDark}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Alert Muting */}
                    <div>
                      <SectionLabel>Alert Muting</SectionLabel>
                      <div style={{ marginBottom: 10 }}>
                        {formData.alerts_muted_until ? (
                          <div style={{
                            padding: '8px 12px', borderRadius: 6, marginBottom: 10,
                            background: P.amberDim, border: `1px solid rgba(245,158,11,0.25)`,
                            fontSize: 12, color: P.amber, fontFamily: P.mono,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}>
                            <span><BellOff size={12} style={{ display: 'inline', marginRight: 6 }} />
                              Muted until {fmtDate(formData.alerts_muted_until)}
                            </span>
                            <button
                              onClick={() => set('alerts_muted_until', '')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.amber, padding: 0 }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: P.textDim, fontFamily: P.sans, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Bell size={12} style={{ color: P.green }} /> Alerts active
                          </div>
                        )}

                        {/* Quick mute buttons */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                          {[1, 4, 8, 24].map(h => (
                            <button key={h} onClick={() => applyMuteHours(h)} style={{
                              padding: '5px 12px', borderRadius: 5,
                              border: `1px solid rgba(245,158,11,0.25)`,
                              background: P.amberDim, color: P.amber,
                              cursor: 'pointer', fontSize: 11, fontFamily: P.mono,
                              transition: 'filter 150ms',
                            }}
                              className="edm-btn"
                            >
                              {h}h
                            </button>
                          ))}
                          <button onClick={() => setMuteMode(m => m === 'datetime' ? 'none' : 'datetime')} style={{
                            padding: '5px 12px', borderRadius: 5,
                            border: `1px solid ${isDark ? P.border : PL.border}`,
                            background: 'transparent', color: isDark ? P.textMid : PL.textMid,
                            cursor: 'pointer', fontSize: 11, fontFamily: P.mono,
                          }}>
                            Custom…
                          </button>
                        </div>

                        <AnimatePresence>
                          {muteMode === 'datetime' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                              <input
                                ref={muteRef}
                                type="datetime-local"
                                value={formData.alerts_muted_until?.slice(0, 16) || ''}
                                onChange={e => set('alerts_muted_until', e.target.value)}
                                style={{
                                  width: '100%', boxSizing: 'border-box',
                                  padding: '8px 12px', borderRadius: 6,
                                  border: `1px solid ${isDark ? P.border : PL.border}`,
                                  background: isDark ? P.surface : PL.surface,
                                  color: isDark ? P.text : PL.text,
                                  fontFamily: P.mono, fontSize: 13, outline: 'none',
                                }}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                  </div>
                </div>

                {/* ── Footer ─────────────────────────────────── */}
                <div style={{
                  padding: '14px 24px',
                  borderTop: `1px solid ${isDark ? P.border : PL.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                }}>
                  <div style={{ fontSize: 11, color: P.textDim, fontFamily: P.mono }}>
                    {device.updated_at ? `Last saved ${fmtDate(device.updated_at)}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="edm-cancel"
                      onClick={onClose}
                      style={{
                        padding: '8px 18px', borderRadius: 7,
                        border: `1px solid ${isDark ? P.border : PL.border}`,
                        background: 'transparent',
                        color: isDark ? P.textMid : PL.textMid,
                        cursor: 'pointer', fontSize: 13, fontFamily: P.sans, fontWeight: 600,
                        transition: 'background 150ms',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || saved}
                      style={{
                        padding: '8px 22px', borderRadius: 7, border: 'none',
                        background: saved ? P.green : P.blue,
                        color: '#fff', cursor: saving || saved ? 'default' : 'pointer',
                        fontSize: 13, fontFamily: P.sans, fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 7,
                        transition: 'background 200ms', minWidth: 120, justifyContent: 'center',
                        boxShadow: saved ? `0 0 16px rgba(16,185,129,0.4)` : `0 0 16px rgba(59,130,246,0.3)`,
                      }}
                    >
                      {saving ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
                        : saved ? <><Check size={15} /> Saved!</>
                        : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Type-change confirmation ──────────────────── */}
            <AnimatePresence>
              {showTypeConfirm && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ position: 'fixed', inset: 0, zIndex: 1010, background: 'rgba(0,0,0,0.4)' }}
                    onClick={() => setShowTypeConfirm(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                    style={{
                      position: 'fixed', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 1011, width: '90%', maxWidth: 420,
                      background: isDark ? P.panel : PL.surface,
                      border: `1px solid rgba(239,68,68,0.35)`,
                      borderRadius: 12, padding: 24,
                      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <AlertTriangle size={20} style={{ color: P.red, flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? P.text : PL.text, fontFamily: P.mono }}>
                        Change Device Type?
                      </span>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: isDark ? P.textMid : PL.textMid, fontFamily: P.sans, lineHeight: 1.5 }}>
                      Changing from <strong style={{ color: P.amber }}>{originalType}</strong> → <strong style={{ color: P.blue }}>{formData.device_type}</strong> may affect:
                    </p>
                    <ul style={{ margin: '0 0 20px', paddingLeft: 18, fontSize: 12, color: isDark ? P.textDim : PL.textDim, fontFamily: P.sans, lineHeight: 1.8 }}>
                      <li>Data interpretation and MQTT routing</li>
                      <li>Telemetry processing pipeline</li>
                      <li>Associated gateway configurations</li>
                    </ul>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setShowTypeConfirm(false)}
                        style={{
                          padding: '8px 16px', borderRadius: 7, border: `1px solid ${isDark ? P.border : PL.border}`,
                          background: 'transparent', color: isDark ? P.textMid : PL.textMid,
                          cursor: 'pointer', fontSize: 13, fontFamily: P.sans, fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => { setShowTypeConfirm(false); await doSave(); }}
                        style={{
                          padding: '8px 18px', borderRadius: 7, border: 'none',
                          background: P.red, color: '#fff',
                          cursor: 'pointer', fontSize: 13, fontFamily: P.sans, fontWeight: 700,
                          boxShadow: `0 0 16px rgba(239,68,68,0.35)`,
                        }}
                      >
                        Yes, Change & Save
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* spin keyframe */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default EditDeviceModal;
