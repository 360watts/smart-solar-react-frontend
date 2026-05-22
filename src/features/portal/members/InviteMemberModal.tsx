import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, AlertTriangle, Copy, Check as CheckIcon } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { apiService, SiteMember } from '../../../services/api';

interface Props {
  siteId: string;
  onClose: () => void;
  onInvited: (member: SiteMember) => void;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  viewer: 'Can view live data, energy history, and alerts. Cannot change settings.',
  co_owner: 'Full access — same as owner, except cannot revoke other members.',
};

const InviteMemberModal: React.FC<Props> = ({ siteId, onClose, onInvited }) => {
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'co_owner'>('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<SiteMember | null>(null);
  const [copied, setCopied] = useState(false);

  const text = isDark ? '#f1f5f9' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const surface = isDark ? '#1e293b' : '#ffffff';
  const border = isDark ? '#334155' : '#e2e8f0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Email is required.'); return; }

    setLoading(true);
    try {
      const member = await apiService.inviteSiteMember(siteId, trimmed, role);
      setInviteResult(member);
      onInvited(member);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('409') || msg.toLowerCase().includes('already')) {
        setError('This email already has an active or pending membership for this site.');
      } else {
        setError(msg || 'Failed to send invite. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        background: isDark ? 'rgba(8,12,20,0.75)' : 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: surface, border: `1px solid ${border}`,
        borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: text }}>Invite a Member</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted }}>
            <X size={20} />
          </button>
        </div>

        {inviteResult ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, marginBottom: 4 }}>
              ✓ Invite sent to {inviteResult.invite_email}
            </div>
            <div style={{ color: muted, fontSize: '12px', marginBottom: 20 }}>
              An email was sent. You can also share this link or QR code directly.
            </div>

            {/* QR code */}
            {inviteResult.qr_code && (
              <div style={{
                display: 'inline-block', padding: 12,
                background: '#fff', borderRadius: 12,
                boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
                marginBottom: 16,
              }}>
                <img src={inviteResult.qr_code} alt="Invite QR code" style={{ width: 160, height: 160, display: 'block' }} />
              </div>
            )}

            {/* Copyable link */}
            {inviteResult.invite_link && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8,
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${border}`,
                marginBottom: 16,
              }}>
                <span style={{
                  flex: 1, fontSize: 11, color: muted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textAlign: 'left',
                }}>
                  {inviteResult.invite_link}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteResult.invite_link!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#22c55e' : muted, flexShrink: 0, padding: 0 }}
                >
                  {copied ? <CheckIcon size={14} /> : <Copy size={14} />}
                </button>
              </div>
            )}

            {inviteResult.expires_at && (
              <div style={{ fontSize: 11, color: muted, marginBottom: 20 }}>
                Expires {new Date(inviteResult.expires_at).toLocaleString()}
              </div>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '10px 32px', borderRadius: '8px', border: 'none',
                background: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: text, marginBottom: '6px' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="family@example.com"
                required
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  border: `1px solid ${border}`, background: surface, color: text,
                  fontSize: '14px', boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: text, marginBottom: '8px' }}>
                Access level
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(['viewer', 'co_owner'] as const).map(r => (
                  <label
                    key={r}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                      padding: '12px', borderRadius: '8px', cursor: 'pointer',
                      border: `1px solid ${role === r ? '#22c55e' : border}`,
                      background: role === r ? (isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)') : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: text }}>
                        {r === 'viewer' ? 'Viewer' : 'Co-owner'}
                      </div>
                      <div style={{ fontSize: '12px', color: muted, marginTop: '2px' }}>
                        {ROLE_DESCRIPTIONS[r]}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 20px', borderRadius: '8px',
                  border: `1px solid ${border}`, background: 'transparent',
                  color: text, fontSize: '14px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: 'none',
                  background: loading ? '#86efac' : '#22c55e',
                  color: '#fff', fontSize: '14px', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

export default InviteMemberModal;
