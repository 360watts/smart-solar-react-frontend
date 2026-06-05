import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, AlertTriangle, Copy, Check as CheckIcon, Mail, MessageCircle } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { apiService, SiteMember } from '../../../services/api';

interface Props {
  siteId: string;
  onClose: () => void;
  onInvited: (member: SiteMember) => void;
}

const InviteMemberModal: React.FC<Props> = ({ siteId, onClose, onInvited }) => {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<SiteMember | null>(null);
  const [copied, setCopied] = useState(false);
  const hasGeneratedRef = useRef(false);

  const text = isDark ? '#f1f5f9' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const surface = isDark ? '#1e293b' : '#ffffff';
  const border = isDark ? '#cbd5e1' : '#e2e8f0';
  const accent = '#22c55e';

  // Load or create invite on mount
  useEffect(() => {
    if (hasGeneratedRef.current) return;
    hasGeneratedRef.current = true;

    const loadOrCreateInvite = async () => {
      setLoading(true);
      setError(null);
      try {
        // Check for existing pending invite (now includes qr_code + invite_link from API)
        const members = await apiService.getSiteMembers(siteId);
        const existingInvite = members.find(m => m.status === 'pending');

        if (existingInvite?.qr_code && existingInvite?.invite_link) {
          setInviteResult(existingInvite);
          onInvited(existingInvite);
          return;
        }

        // None found — create new link invite (no email needed)
        const member = await apiService.inviteSiteMember(siteId, null, 'viewer');
        setInviteResult(member);
        onInvited(member);
      } catch (err: any) {
        setError(err?.message || 'Failed to load invite. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadOrCreateInvite();
  }, [siteId, onInvited]);

  const handleShare = (platform: 'whatsapp' | 'email' | 'copy') => {
    if (!inviteResult?.invite_link) return;

    const link = inviteResult.invite_link;
    const encodedLink = encodeURIComponent(link);
    const message = `Join 360Watts: ${link}`;
    const encodedMessage = encodeURIComponent(message);

    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
        break;
      case 'email':
        window.open(`mailto:?subject=Join%20360Watts&body=${encodedMessage}`, '_blank');
        break;
      case 'copy':
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        break;
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
      <style>{`
        @keyframes qrPopIn {
          0% { opacity: 0; transform: scale(0.85) rotateY(-20deg); }
          100% { opacity: 1; transform: scale(1) rotateY(0); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes iconPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${accent}40; }
          50% { box-shadow: 0 0 0 8px ${accent}00; }
        }
        @keyframes checkBounce {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .invite-qr-container {
          animation: qrPopIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          backdrop-filter: blur(20px);
        }
        .invite-icon-btn {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          border-radius: 12px;
          padding: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .invite-icon-btn:hover {
          transform: translateY(-4px) scale(1.1);
          color: ${accent} !important;
          background: ${accent}10;
          animation: iconPulse 0.6s ease-out;
        }
        .invite-check-icon {
          animation: checkBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .invite-link-container {
          background: linear-gradient(135deg, ${isDark ? '#cbd5e1' : '#f1f5f9'}, ${isDark ? '#1e293b' : '#ffffff'});
          transition: all 0.2s ease;
        }
        .invite-link-container:hover {
          background: ${isDark ? '#94a3b8' : '#e2e8f0'};
          border-color: ${accent}30;
        }
      `}</style>
      <div style={{
        background: surface, border: `1px solid ${border}`,
        borderRadius: '16px', padding: '32px 28px', width: '100%', maxWidth: '380px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: text }}>Invite a Member</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, padding: 0 }}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 36, height: 36, margin: '0 auto', border: `2px solid ${accent}20`, borderTop: `2px solid ${accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{error}</div>
          </div>
        ) : inviteResult ? (
          <div style={{ textAlign: 'center' }}>
            {/* QR Code */}
            {inviteResult.qr_code && (
              <div className="invite-qr-container" style={{
                display: 'inline-block', padding: 14,
                background: '#ffffff', borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                marginBottom: 24,
              }}>
                <img src={inviteResult.qr_code} alt="Invite QR code" style={{ width: 160, height: 160, display: 'block', borderRadius: 4 }} />
              </div>
            )}

            {/* Copyable Link */}
            {inviteResult.invite_link && (
              <div className="invite-link-container" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${border}`,
                marginBottom: 20,
              }}>
                <span style={{
                  flex: 1, fontSize: '11px', color: muted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textAlign: 'left', fontFamily: 'monospace',
                }}>
                  {inviteResult.invite_link}
                </span>
                <button
                  className="invite-icon-btn"
                  onClick={() => handleShare('copy')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? accent : muted, flexShrink: 0, padding: '4px' }}
                  title="Copy link"
                >
                  {copied ? <CheckIcon size={16} className="invite-check-icon" /> : <Copy size={16} />}
                </button>
              </div>
            )}

            {/* Share Icons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
              <button
                className="invite-icon-btn"
                onClick={() => handleShare('whatsapp')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, padding: 0, display: 'flex', alignItems: 'center', fontSize: 0 }}
                title="Share via WhatsApp"
              >
                <MessageCircle size={20} />
              </button>
              <button
                className="invite-icon-btn"
                onClick={() => handleShare('email')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, padding: 0, display: 'flex', alignItems: 'center', fontSize: 0 }}
                title="Share via Email"
              >
                <Mail size={20} />
              </button>
            </div>

            {/* Footer Text */}
            <div style={{ fontSize: '12px', color: muted, lineHeight: 1.5 }}>
              Share this invite link or scan the QR code.{'\n'}You can change their role later in Members.
            </div>

            {/* Expiration & Regenerate */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              {inviteResult.expires_at && (
                <div style={{ fontSize: '10px', color: muted, opacity: 0.7 }}>
                  Expires {new Date(inviteResult.expires_at).toLocaleDateString()}
                </div>
              )}
              <button
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const member = await apiService.inviteSiteMember(siteId, null, 'viewer');
                    setInviteResult(member);
                  } catch (err: any) {
                    setError(err?.message || 'Failed to regenerate invite.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                style={{
                  fontSize: '11px', fontWeight: 600, color: accent,
                  background: 'none', border: 'none', cursor: 'pointer',
                  textDecoration: 'underline', padding: 0,
                }}
              >
                Regenerate Invite
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
};

export default InviteMemberModal;
