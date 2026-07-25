import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { QrCode, X, Copy, Check, ShieldAlert } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';

interface DeviceClaim {
  id: number;
  hwId: string;
  status: 'pending' | 'claimed' | 'expired';
  expiresAt: string;
  claimToken: string;
  qrCode: string;
}

interface ProvisionDeviceModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Generates a single-use claim token, unbound to any MAC — a technician scans/
 * enters it into the device during setup, and the device sends it back as
 * claimNonce in POST /devices/provision. provision() binds it to whichever
 * hw_id presents it first (same trust model as a WiFi/Bluetooth pairing code).
 * Without this, /devices/provision would accept any hwId with no proof the
 * caller actually owns that hardware.
 */
export const ProvisionDeviceModal: React.FC<ProvisionDeviceModalProps> = ({ open, onClose }) => {
  const { isDark } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [claim, setClaim] = useState<DeviceClaim | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hasGenerated = useRef(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiService.createDeviceClaim();
      setClaim(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate claim token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClaim(null);
      setError(null);
      setCopied(false);
      hasGenerated.current = false;
    } else {
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open || hasGenerated.current) return;
    hasGenerated.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const copyToken = () => {
    if (!claim?.claimToken) return;
    navigator.clipboard.writeText(claim.claimToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      width: '100%', maxWidth: 420,
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
      transition: 'all 0.15s',
    },
    body: { padding: '20px' },
    retryBtn: {
      width: '100%', marginTop: 12, padding: '10px 16px', borderRadius: 8, border: 'none',
      background: 'linear-gradient(135deg, #2FBF71, #1A9A56)',
      color: '#fff', fontSize: '0.875rem', fontWeight: 700,
      cursor: 'pointer',
      boxShadow: '0 3px 10px rgba(47,191,113,0.3)',
    },
  };

  const modal = (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.panel} role="dialog" aria-modal="true" aria-labelledby="provision-modal-title">
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
              <div id="provision-modal-title" style={{
                fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2,
              }}>Provision Device</div>
              <div style={{ fontSize: '0.75rem', marginTop: 2, color: 'var(--muted-foreground)' }}>
                Scan or enter this on the device during setup
              </div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div style={S.body}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderTopColor: '#2FBF71',
                animation: 'provisionSpin 0.8s linear infinite',
              }} />
              <style>{`@keyframes provisionSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!loading && error && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: '0.775rem', color: '#F87171',
              }}>
                <ShieldAlert size={13} /> {error}
              </div>
              <button style={S.retryBtn} onClick={generate}>Retry</button>
            </>
          )}

          {!loading && !error && claim && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-block', padding: 12, borderRadius: 12, marginBottom: 16,
                background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}>
                <img src={claim.qrCode} alt="Claim token QR code" width={160} height={160} style={{ display: 'block' }} />
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                padding: '9px 12px', borderRadius: 8,
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              }}>
                <span style={{
                  flex: 1, textAlign: 'left', fontSize: '0.75rem', color: 'var(--foreground)',
                  fontFamily: 'Fira Code, JetBrains Mono, monospace', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{claim.claimToken}</span>
                <button
                  onClick={copyToken}
                  title="Copy token"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                    color: copied ? '#2FBF71' : 'var(--muted-foreground)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>

              <div style={{ fontSize: '0.775rem', color: 'var(--muted-foreground)', marginBottom: 4 }}>
                Scan or enter this token on the device during setup — it binds to
                whichever device sends it back first, so no need to know the MAC in advance.
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                Expires {new Date(claim.expiresAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default ProvisionDeviceModal;
