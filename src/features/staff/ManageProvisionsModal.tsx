import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { QrCode, X, Copy, Check, ShieldAlert, Plus, Ban, Cpu, Clock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';

interface DeviceClaim {
  id: number;
  hwId: string;
  status: 'pending' | 'claimed' | 'expired';
  expiresAt: string;
  createdAt: string;
  claimedAt: string | null;
  createdByUsername: string | null;
  claimedDeviceSerial: string | null;
  claimToken?: string;
  qrCode?: string;
}

interface ManageProvisionsModalProps {
  open: boolean;
  onClose: () => void;
}

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const STATUS_STYLE: Record<DeviceClaim['status'], { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(47,191,113,0.12)', color: '#2FBF71', label: 'Pending' },
  claimed: { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', label: 'Claimed' },
  expired: { bg: 'rgba(148,163,184,0.14)', color: '#94A3B8', label: 'Expired' },
};

/**
 * Lists outstanding /devices/claims/ tokens (PendingDeviceClaim rows) and lets
 * staff generate new ones or revoke stale pending ones. A claim proves someone
 * authorized intends to provision a device before /devices/provision hands out
 * a JWT/MQTT cert — see api/views/iot_provisioning.py's claim-token check.
 */
export const ManageProvisionsModal: React.FC<ManageProvisionsModalProps> = ({ open, onClose }) => {
  const { isDark } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [claims, setClaims] = useState<DeviceClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [newClaim, setNewClaim] = useState<DeviceClaim | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiService.getDeviceClaims();
      setClaims(result ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setNewClaim(null);
      setGenError(null);
      setCopied(false);
      fetchClaims();
    } else {
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [open, fetchClaims]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const generate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const result = await apiService.createDeviceClaim();
      setNewClaim(result);
      fetchClaims();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate claim token');
    } finally {
      setGenerating(false);
    }
  };

  const copyToken = () => {
    if (!newClaim?.claimToken) return;
    navigator.clipboard.writeText(newClaim.claimToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async (claim: DeviceClaim) => {
    setRevokingId(claim.id);
    try {
      await apiService.revokeDeviceClaim(claim.id);
      setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status: 'expired' } : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke claim');
    } finally {
      setRevokingId(null);
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
      background: 'var(--card)',
      border: `1px solid ${isDark ? 'rgba(47,191,113,0.18)' : 'rgba(47,191,113,0.15)'}`,
      borderRadius: 16,
      width: '100%', maxWidth: 560, maxHeight: '84vh',
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
      color: 'var(--muted-foreground)',
    },
    actionsBar: {
      padding: '14px 20px',
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
    },
    generateBtn: {
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '9px 16px', borderRadius: 8, border: 'none',
      background: 'linear-gradient(135deg, #2FBF71, #1A9A56)',
      color: '#fff', fontSize: '0.8rem', fontWeight: 700,
      cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1,
      boxShadow: '0 3px 10px rgba(47,191,113,0.3)',
    },
    list: { overflowY: 'auto', flex: 1, padding: '10px 12px' },
  };

  const modal = (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.panel} role="dialog" aria-modal="true" aria-labelledby="manage-provisions-title">
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(47,191,113,0.16), rgba(26,154,86,0.08))',
              border: '1px solid rgba(47,191,113,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <QrCode size={18} color="#2FBF71" />
            </div>
            <div>
              <div id="manage-provisions-title" style={{
                fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2,
              }}>Manage Provisions</div>
              <div style={{ fontSize: '0.75rem', marginTop: 2, color: 'var(--muted-foreground)' }}>
                Claim tokens required before a device can self-provision
              </div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div style={S.actionsBar}>
          {!newClaim ? (
            <button style={S.generateBtn} onClick={generate} disabled={generating}>
              <Plus size={14} /> {generating ? 'Generating…' : 'Generate Claim Token'}
            </button>
          ) : (
            <div style={{
              borderRadius: 10, padding: 14,
              background: isDark ? 'rgba(47,191,113,0.06)' : 'rgba(47,191,113,0.05)',
              border: '1px solid rgba(47,191,113,0.2)',
              display: 'flex', gap: 14, alignItems: 'center',
            }}>
              {newClaim.qrCode && (
                <img src={newClaim.qrCode} alt="Claim token QR code" width={84} height={84}
                  style={{ borderRadius: 8, background: '#fff', padding: 6, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: 6 }}>
                  Scan or enter on the device during setup — binds to whichever device sends it back first.
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7,
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                }}>
                  <span style={{
                    flex: 1, fontSize: '0.72rem', color: 'var(--foreground)',
                    fontFamily: 'Fira Code, JetBrains Mono, monospace', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{newClaim.claimToken}</span>
                  <button onClick={copyToken} title="Copy token" style={{
                    background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                    color: copied ? '#2FBF71' : 'var(--muted-foreground)', display: 'flex',
                  }}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <button
                  onClick={() => setNewClaim(null)}
                  style={{
                    marginTop: 8, background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.7rem', color: 'var(--muted-foreground)', textDecoration: 'underline', padding: 0,
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {genError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.75rem', color: '#F87171' }}>
              <ShieldAlert size={12} /> {genError}
            </div>
          )}
        </div>

        {error && (
          <div style={{
            margin: '0 20px', marginTop: 12, padding: '9px 12px', borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#F87171', fontSize: '0.775rem',
          }}>{error}</div>
        )}

        <div style={S.list}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.825rem' }}>
              Loading claims…
            </div>
          ) : claims.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <QrCode size={24} color="var(--border)" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: '0.825rem', color: 'var(--muted-foreground)' }}>No claim tokens yet</div>
            </div>
          ) : claims.map(claim => {
            const s = STATUS_STYLE[claim.status];
            return (
              <div key={claim.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10, marginBottom: 6,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              }}>
                <span style={{
                  padding: '3px 9px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0,
                  background: s.bg, color: s.color,
                }}>{s.label}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)',
                    fontFamily: 'Fira Code, JetBrains Mono, monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {claim.claimedDeviceSerial || claim.hwId || 'Unbound — waiting for a device'}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, flexWrap: 'wrap',
                    fontSize: '0.68rem', color: 'var(--muted-foreground)',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} /> created {timeAgo(claim.createdAt)}
                    </span>
                    {claim.status === 'pending' && (
                      <span>· expires {new Date(claim.expiresAt).toLocaleString()}</span>
                    )}
                    {claim.claimedAt && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Cpu size={10} /> claimed {timeAgo(claim.claimedAt)}
                      </span>
                    )}
                    {claim.createdByUsername && <span>· by {claim.createdByUsername}</span>}
                  </div>
                </div>

                {claim.status === 'pending' && (
                  <button
                    onClick={() => revoke(claim)}
                    disabled={revokingId === claim.id}
                    title="Revoke this claim"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)'}`,
                      background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
                      color: '#EF4444', cursor: revokingId === claim.id ? 'wait' : 'pointer',
                      opacity: revokingId === claim.id ? 0.6 : 1,
                    }}
                  >
                    <Ban size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default ManageProvisionsModal;
