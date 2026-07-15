import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  Archive, RotateCcw, X, Search, Cpu, Gauge, Clock, UserCircle2, HeartPulse,
  Trash2, ShieldAlert, CheckSquare, Square,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
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

type DeviceTypeFilter = 'all' | 'gateway' | 'energy_meter';

type ConfirmTarget =
  | { mode: 'single'; device: ArchivedDevice }
  | { mode: 'bulk'; devices: ArchivedDevice[] };

interface RestoreArchivedDeviceModalProps {
  open: boolean;
  onClose: () => void;
  onRestored: (device: ArchivedDevice) => void;
  /** Fired after a single or bulk hard-delete completes (even if some/all failed). */
  onHardDeleted?: (result: { deletedCount: number; failedCount: number }) => void;
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

const TYPE_FILTERS: { value: DeviceTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'gateway', label: 'Gateway' },
  { value: 'energy_meter', label: 'Meter' },
];

export const RestoreArchivedDeviceModal: React.FC<RestoreArchivedDeviceModalProps> = ({
  open, onClose, onRestored, onHardDeleted,
}) => {
  const { isDark } = useTheme();
  const { isAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DeviceTypeFilter>('all');
  const [devices, setDevices] = useState<ArchivedDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [hardDeleting, setHardDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchArchived = useCallback(async (term: string, type: DeviceTypeFilter) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getArchivedDevices(term || undefined, type === 'all' ? undefined : type);
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
      setTypeFilter('all');
      setSelectedIds(new Set());
      setRowErrors({});
      setConfirmTarget(null);
      setConfirmText('');
      fetchArchived('', 'all');
      setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [open, fetchArchived]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchArchived(search, typeFilter), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmTarget) setConfirmTarget(null);
      else onClose();
    };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, confirmTarget]);

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
      fetchArchived(search, typeFilter);
    } finally {
      setRestoringId(null);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = devices.length > 0 && devices.every(d => selectedIds.has(d.id));
  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(devices.map(d => d.id)));
  };

  const requiredConfirmText = confirmTarget?.mode === 'single'
    ? confirmTarget.device.device_serial
    : 'DELETE';
  const isConfirmed = confirmTarget?.mode === 'single'
    ? confirmText === requiredConfirmText
    : confirmText.trim().toUpperCase() === 'DELETE';

  const runHardDelete = async () => {
    if (!confirmTarget || !isConfirmed || hardDeleting) return;
    setHardDeleting(true);
    setError(null);

    const targetIds = confirmTarget.mode === 'single' ? [confirmTarget.device.id] : confirmTarget.devices.map(d => d.id);

    try {
      if (confirmTarget.mode === 'single') {
        const device = confirmTarget.device;
        try {
          await apiService.hardDeleteArchivedDevice(device.id);
          setDevices(prev => prev.filter(d => d.id !== device.id));
          setSelectedIds(prev => { const n = new Set(prev); n.delete(device.id); return n; });
          setRowErrors(prev => { const { [device.id]: _drop, ...rest } = prev; return rest; });
          onHardDeleted?.({ deletedCount: 1, failedCount: 0 });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Permanent delete failed';
          setRowErrors(prev => ({ ...prev, [device.id]: message }));
          onHardDeleted?.({ deletedCount: 0, failedCount: 1 });
        }
      } else {
        const response = await apiService.hardDeleteArchivedDevicesBulk(targetIds);
        const deletedIds = new Set<number>((response.deleted ?? []).map((d: { id: number }) => d.id));
        const failedEntries: { id: number; error: string }[] = response.failed ?? [];

        setDevices(prev => prev.filter(d => !deletedIds.has(d.id)));
        setSelectedIds(prev => {
          const next = new Set(prev);
          deletedIds.forEach(id => next.delete(id));
          return next;
        });
        setRowErrors(prev => {
          const next = { ...prev };
          deletedIds.forEach(id => { delete next[id]; });
          failedEntries.forEach(({ id, error: msg }) => { next[id] = msg; });
          return next;
        });
        onHardDeleted?.({ deletedCount: deletedIds.size, failedCount: failedEntries.length });
      }
      setConfirmTarget(null);
      setConfirmText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permanent delete failed');
    } finally {
      setHardDeleting(false);
    }
  };

  if (!mounted) return null;

  const selectedCount = selectedIds.size;

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
      width: '100%', maxWidth: 600, maxHeight: '84vh',
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
    filterWrap: {
      padding: '14px 20px',
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    },
    searchBox: {
      display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180,
      padding: '9px 12px', borderRadius: 9,
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    },
    searchInput: {
      flex: 1, border: 'none', outline: 'none', background: 'transparent',
      fontSize: '0.825rem', color: 'var(--foreground)',
      fontFamily: 'Fira Code, JetBrains Mono, monospace',
    },
    typePill: (active: boolean) => ({
      padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
      fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' as const,
      border: `1px solid ${active ? 'rgba(47,191,113,0.4)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      background: active
        ? 'rgba(47,191,113,0.14)'
        : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
      color: active ? '#2FBF71' : isDark ? 'rgba(240,244,255,0.5)' : 'rgba(18,21,26,0.55)',
      transition: 'all 0.15s',
    }),
    bulkBar: {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 20px',
      background: isDark ? 'rgba(239,68,68,0.07)' : 'rgba(239,68,68,0.05)',
      borderBottom: `1px solid ${isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.15)'}`,
    },
    list: {
      overflowY: 'auto', flex: 1,
      padding: '10px 12px',
      position: 'relative',
    },
  };

  const renderConfirmPanel = (target: ConfirmTarget) => {
    const affected = target.mode === 'single' ? [target.device] : target.devices;
    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5,
        background: isDark ? 'rgba(12,16,24,0.98)' : 'rgba(255,255,255,0.98)',
        display: 'flex', flexDirection: 'column',
        padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(220,38,38,0.1))',
            border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldAlert size={16} color="#EF4444" />
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)' }}>
            Permanently delete {affected.length} device{affected.length !== 1 ? 's' : ''}?
          </div>
        </div>

        <div style={{
          fontSize: '0.775rem', lineHeight: 1.5, marginBottom: 12,
          color: isDark ? 'rgba(240,244,255,0.5)' : 'rgba(18,21,26,0.55)',
        }}>
          This cannot be undone — unlike restore, there is no archive to bring these back from.
          Devices with existing telemetry history are protected at the database level and will be
          reported back as failed rather than destroyed.
        </div>

        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: 14,
          border: `1px solid ${isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)'}`,
          borderRadius: 10, background: isDark ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.03)',
        }}>
          {affected.map(d => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '8px 12px',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
            }}>
              <span style={{
                fontFamily: 'Fira Code, JetBrains Mono, monospace', fontSize: '0.8rem', fontWeight: 600,
                color: isDark ? '#F87171' : '#DC2626',
              }}>{d.device_serial}</span>
              {rowErrors[d.id] && (
                <span style={{ fontSize: '0.675rem', color: isDark ? 'rgba(240,244,255,0.35)' : 'rgba(18,21,26,0.4)' }}>
                  previously failed
                </span>
              )}
            </div>
          ))}
        </div>

        <label style={{
          fontSize: '0.75rem', marginBottom: 8, display: 'block',
          color: isDark ? 'rgba(240,244,255,0.45)' : 'rgba(18,21,26,0.5)',
        }}>
          Type <span style={{ fontFamily: 'Fira Code, JetBrains Mono, monospace', color: isDark ? '#F87171' : '#DC2626' }}>{requiredConfirmText}</span> to confirm
        </label>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={requiredConfirmText}
          autoComplete="off"
          spellCheck={false}
          style={{
            width: '100%', padding: '10px 12px', marginBottom: 14,
            fontFamily: 'Fira Code, JetBrains Mono, monospace',
            fontSize: '0.825rem', letterSpacing: '0.04em',
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${confirmText && !isConfirmed
              ? '#EF4444'
              : isConfirmed
                ? '#2FBF71'
                : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
            borderRadius: 8, color: 'var(--foreground)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { setConfirmTarget(null); setConfirmText(''); }}
            style={{
              flex: 1, padding: '10px', borderRadius: 8,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              background: 'transparent', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 500,
              color: isDark ? 'rgba(240,244,255,0.6)' : 'rgba(18,21,26,0.6)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={runHardDelete}
            disabled={!isConfirmed || hardDeleting}
            style={{
              flex: 2, padding: '10px 16px', borderRadius: 8, border: 'none',
              background: isConfirmed
                ? 'linear-gradient(135deg, #DC2626, #EF4444)'
                : isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
              cursor: isConfirmed ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem', fontWeight: 600,
              color: isConfirmed ? '#fff' : isDark ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              boxShadow: isConfirmed ? '0 4px 16px rgba(239,68,68,0.3)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <Trash2 size={14} style={hardDeleting ? { animation: 'spin 0.8s linear infinite' } : undefined} />
            {hardDeleting ? 'Deleting…' : `Permanently delete ${affected.length}`}
          </button>
        </div>
      </div>
    );
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
                color: 'var(--foreground)',
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

        {/* Search + filter */}
        <div style={S.filterWrap}>
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
          <div style={{ display: 'flex', gap: 6 }}>
            {TYPE_FILTERS.map(f => (
              <div key={f.value} style={S.typePill(typeFilter === f.value)} onClick={() => setTypeFilter(f.value)}>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* Bulk action bar — admin-only, appears once something's selected */}
        {isAdmin && selectedCount > 0 && (
          <div style={S.bulkBar}>
            <button
              onClick={toggleSelectAll}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '0.75rem', color: isDark ? 'rgba(240,244,255,0.5)' : 'rgba(18,21,26,0.55)',
              }}
            >
              {allVisibleSelected ? <CheckSquare size={14} color="#EF4444" /> : <Square size={14} />}
            </button>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isDark ? '#F87171' : '#DC2626' }}>
              {selectedCount} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.75rem', color: isDark ? 'rgba(240,244,255,0.4)' : 'rgba(18,21,26,0.45)',
                textDecoration: 'underline',
              }}
            >
              Clear
            </button>
            <button
              onClick={() => setConfirmTarget({ mode: 'bulk', devices: devices.filter(d => selectedIds.has(d.id)) })}
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #DC2626, #EF4444)',
                color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(239,68,68,0.3)',
              }}
            >
              <Trash2 size={12} /> Hard delete {selectedCount}
            </button>
          </div>
        )}

        {error && (
          <div style={{
            margin: '0 20px', marginTop: 12, padding: '9px 12px', borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#F87171', fontSize: '0.775rem',
          }}>{error}</div>
        )}

        {/* List */}
        <div style={S.list}>
          {confirmTarget && renderConfirmPanel(confirmTarget)}

          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: isDark ? 'rgba(240,244,255,0.35)' : 'rgba(18,21,26,0.4)', fontSize: '0.825rem' }}>
              Scanning the archive…
            </div>
          ) : devices.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <Archive size={28} color={isDark ? 'rgba(240,244,255,0.15)' : 'rgba(18,21,26,0.15)'} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isDark ? 'rgba(240,244,255,0.55)' : 'rgba(18,21,26,0.6)' }}>
                {search || typeFilter !== 'all' ? 'No archived devices match your filters' : 'The archive is empty'}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: 4, color: isDark ? 'rgba(240,244,255,0.3)' : 'rgba(18,21,26,0.35)' }}>
                Nothing has been soft-deleted yet.
              </div>
            </div>
          ) : devices.map((device) => {
            const isRestoring = restoringId === device.id;
            const isFlashing = flash === device.id;
            const isSelected = selectedIds.has(device.id);
            const rowError = rowErrors[device.id];
            const Icon = device.device_type === 'energy_meter' ? Gauge : Cpu;
            return (
              <div key={device.id}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 12px', borderRadius: 11, marginBottom: rowError ? 0 : 6,
                    border: `1px solid ${isFlashing ? 'rgba(47,191,113,0.5)' : isSelected ? 'rgba(239,68,68,0.35)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                    borderBottomLeftRadius: rowError ? 0 : 11,
                    borderBottomRightRadius: rowError ? 0 : 11,
                    background: isFlashing
                      ? 'rgba(47,191,113,0.1)'
                      : isSelected
                        ? isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)'
                        : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                    opacity: isFlashing ? 1 : 0.92,
                    transform: isFlashing ? 'scale(1.01)' : 'scale(1)',
                    transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                >
                  {isAdmin && (
                    <button
                      onClick={() => toggleSelect(device.id)}
                      aria-label={isSelected ? 'Deselect device' : 'Select device'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 2, display: 'flex' }}
                    >
                      {isSelected
                        ? <CheckSquare size={16} color="#EF4444" />
                        : <Square size={16} color={isDark ? 'rgba(240,244,255,0.25)' : 'rgba(18,21,26,0.25)'} />}
                    </button>
                  )}

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
                        color: 'var(--foreground)',
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

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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

                    {isAdmin && !isFlashing && (
                      <button
                        onClick={() => setConfirmTarget({ mode: 'single', device })}
                        aria-label="Permanently delete device"
                        title="Permanently delete — cannot be undone"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 30, height: 30, borderRadius: 8,
                          border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)'}`,
                          background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
                          color: '#EF4444', cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {rowError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px 8px', marginBottom: 6,
                    borderRadius: '0 0 11px 11px',
                    border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.18)'}`,
                    borderTop: 'none',
                    background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)',
                    fontSize: '0.7rem', color: isDark ? '#F87171' : '#DC2626',
                  }}>
                    <ShieldAlert size={11} style={{ flexShrink: 0 }} /> {rowError}
                  </div>
                )}
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
