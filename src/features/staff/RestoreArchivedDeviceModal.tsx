import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Archive, RotateCcw, X, Search, Cpu, Gauge, Clock, UserCircle2, HeartPulse } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';

interface ArchivedDevice {
  id: number;
  device_serial: string;
  device_type: 'gateway' | 'energy_meter';
  hw_id: string | null;
  model: string | null;
  site_id: string | null;
  last_heartbeat: string | null;
  provisioned_at: string;
  deleted_at: string;
  created_by_username: string | null;
}

interface RestoreArchivedDeviceModalProps {
  open: boolean;
  onClose: () => void;
  onRestored: (device: ArchivedDevice) => void;
}

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

export const RestoreArchivedDeviceModal: React.FC<RestoreArchivedDeviceModalProps> = ({
  open, onClose, onRestored,
}) => {
  const { isDark } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [devices, setDevices] = useState<ArchivedDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchArchived = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getArchivedDevices(term || undefined);
      setDevices(response.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load archived devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setSearch('');
      fetchArchived('');
      setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [open, fetchArchived]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchArchived(search), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleRestore = async (device: ArchivedDevice) => {
    if (restoringId) return;
    setRestoringId(device.id);
    setError(null);
    try {
      await apiService.restoreDevice(device.device_serial);
      setFlash(device.id);
      setTimeout(() => {
        setDevices(prev => prev.filter(d => d.id !== device.id));
        onRestored(device);
        setFlash(null);
      }, 620);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
      // Someone else may have already restored/claimed this serial — resync the list
      // instead of leaving a stale row whose Restore button would just fail again.
      fetchArchived(search);
    } finally {
      setRestoringId(null);
    }
  };

  if (!mounted) return null;

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
      border: `1px solid ${isDark ? 'rgba(47,191,113,0.18)' : 'rgba(47,191,113,0.15)'}`,
      borderRadius: 16,
      width: '100%', maxWidth: 560, maxHeight: '82vh',
      display: 'flex', flexDirection: 'column',
      boxShadow: isDark
        ? '0 0 0 1px rgba(47,191,113,0.06), 0 32px 64px rgba(0,0,0,0.6)'
        : '0 32px 64px rgba(0,0,0,0.15)',
      transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
      transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      overflow: 'hidden',
    },
    header: {
      padding: '20px 20px 16px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    },
    closeBtn: {
      width: 32, height: 32, borderRadius: 8,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      background: 'transparent', cursor: 'pointer', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: isDark ? 'rgba(240,244,255,0.4)' : 'rgba(18,21,26,0.4)',
      transition: 'all 0.15s',
    },
    searchWrap: {
      padding: '14px 20px',
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
    },
    searchBox: {
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 12px', borderRadius: 9,
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    },
    searchInput: {
      flex: 1, border: 'none', outline: 'none', background: 'transparent',
      fontSize: '0.825rem', color: isDark ? '#F0F4FF' : '#12151A',
      fontFamily: 'Fira Code, JetBrains Mono, monospace',
    },
    list: {
      overflowY: 'auto', flex: 1,
      padding: '10px 12px',
    },
  };

  const modal = (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.panel} role="dialog" aria-modal="true" aria-labelledby="restore-modal-title">

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(47,191,113,0.16), rgba(26,154,86,0.08))',
              border: '1px solid rgba(47,191,113,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Archive size={18} color="#2FBF71" />
            </div>
            <div>
              <div id="restore-modal-title" style={{
                fontSize: '0.9375rem', fontWeight: 700,
                color: isDark ? '#F0F4FF' : '#12151A',
                lineHeight: 1.2,
              }}>Restore Archived Device</div>
              <div style={{
                fontSize: '0.75rem', marginTop: 2,
                color: isDark ? 'rgba(240,244,255,0.4)' : 'rgba(18,21,26,0.45)',
              }}>Devices self-provision on first boot — this brings a soft-deleted serial back online</div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div style={S.searchWrap}>
          <div style={S.searchBox}>
            <Search size={14} color={isDark ? 'rgba(240,244,255,0.35)' : 'rgba(18,21,26,0.4)'} />
            <input
              ref={inputRef}
              style={S.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by serial or MAC address..."
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        {error && (
          <div style={{
            margin: '0 20px', marginTop: 12, padding: '9px 12px', borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#F87171', fontSize: '0.775rem',
          }}>{error}</div>
        )}

        {/* List */}
        <div style={S.list}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: isDark ? 'rgba(240,244,255,0.35)' : 'rgba(18,21,26,0.4)', fontSize: '0.825rem' }}>
              Scanning the archive…
            </div>
          ) : devices.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <Archive size={28} color={isDark ? 'rgba(240,244,255,0.15)' : 'rgba(18,21,26,0.15)'} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isDark ? 'rgba(240,244,255,0.55)' : 'rgba(18,21,26,0.6)' }}>
                {search ? 'No archived devices match your search' : 'The archive is empty'}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: 4, color: isDark ? 'rgba(240,244,255,0.3)' : 'rgba(18,21,26,0.35)' }}>
                Nothing has been soft-deleted yet.
              </div>
            </div>
          ) : devices.map((device) => {
            const isRestoring = restoringId === device.id;
            const isFlashing = flash === device.id;
            const Icon = device.device_type === 'energy_meter' ? Gauge : Cpu;
            return (
              <div
                key={device.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 12px', borderRadius: 11, marginBottom: 6,
                  border: `1px solid ${isFlashing ? 'rgba(47,191,113,0.5)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                  background: isFlashing
                    ? 'rgba(47,191,113,0.1)'
                    : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                  opacity: isFlashing ? 1 : 0.92,
                  transform: isFlashing ? 'scale(1.01)' : 'scale(1)',
                  transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                }}
              >
                {/* flatline -> pulse icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {isFlashing ? (
                    <HeartPulse size={16} color="#2FBF71" style={{ animation: 'pulseBeat 0.6s ease-in-out' }} />
                  ) : (
                    <Icon size={15} color={isDark ? 'rgba(240,244,255,0.4)' : 'rgba(18,21,26,0.4)'} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'Fira Code, JetBrains Mono, monospace',
                      fontSize: '0.825rem', fontWeight: 600, letterSpacing: '0.01em',
                      color: isDark ? '#F0F4FF' : '#12151A',
                    }}>{device.device_serial}</span>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '1px 6px', borderRadius: 4,
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      color: isDark ? 'rgba(240,244,255,0.5)' : 'rgba(18,21,26,0.55)',
                    }}>{device.device_type === 'energy_meter' ? 'Meter' : 'Gateway'}</span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap',
                    fontSize: '0.7rem', color: isDark ? 'rgba(240,244,255,0.35)' : 'rgba(18,21,26,0.4)',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} /> deleted {timeAgo(device.deleted_at)}
                    </span>
                    {device.site_id && <span>· site {device.site_id}</span>}
                    {device.created_by_username && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <UserCircle2 size={10} /> {device.created_by_username}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRestore(device)}
                  disabled={isRestoring || isFlashing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 8, border: 'none',
                    background: isFlashing
                      ? 'rgba(47,191,113,0.25)'
                      : 'linear-gradient(135deg, #2FBF71, #1A9A56)',
                    color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                    cursor: isRestoring ? 'wait' : 'pointer',
                    boxShadow: '0 3px 10px rgba(47,191,113,0.3)',
                    flexShrink: 0,
                    opacity: isRestoring ? 0.7 : 1,
                  }}
                >
                  {isFlashing ? (
                    'Restored ✓'
                  ) : (
                    <>
                      <RotateCcw size={12} style={isRestoring ? { animation: 'spin 0.8s linear infinite' } : undefined} />
                      {isRestoring ? 'Restoring…' : 'Restore'}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulseBeat { 0% { transform: scale(0.6); opacity: 0.4; } 50% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        `}</style>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default RestoreArchivedDeviceModal;
