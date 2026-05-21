import React, { useEffect, useState } from 'react';
import { UserPlus, RefreshCw, RotateCcw } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { apiService, SiteMember } from '../../../services/api';
import InviteMemberModal from './InviteMemberModal';

interface Props {
  siteId: string;
  ownerUserId: number | null;
}

const ROLE_LABELS: Record<string, string> = { viewer: 'Viewer', co_owner: 'Co-owner' };
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  active: '#22c55e',
  revoked: '#94a3b8',
};

const SiteMembersCard: React.FC<Props> = ({ siteId, ownerUserId }) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [members, setMembers] = useState<SiteMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const isOwner = user?.id === ownerUserId;

  const text = isDark ? '#f1f5f9' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const surface = isDark ? '#1e293b' : '#ffffff';
  const border = isDark ? '#334155' : '#e2e8f0';
  const rowHover = isDark ? '#263044' : '#f8fafc';

  const load = async () => {
    if (!siteId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getSiteMembers(siteId);
      setMembers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg = e?.message || 'Failed to load members.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [siteId]);

  const handleRoleChange = async (m: SiteMember, role: 'viewer' | 'co_owner') => {
    setActionLoading(m.id);
    try {
      const updated = await apiService.updateSiteMember(siteId, m.id, { role });
      setMembers(prev => prev.map(x => x.id === m.id ? updated : x));
    } catch {
      alert('Failed to update role.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (m: SiteMember) => {
    if (!confirm(`Revoke access for ${m.invite_email}?`)) return;
    setActionLoading(m.id);
    try {
      const updated = await apiService.updateSiteMember(siteId, m.id, { status: 'revoked' });
      setMembers(prev => prev.map(x => x.id === m.id ? updated : x));
    } catch {
      alert('Failed to revoke access.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (m: SiteMember) => {
    setActionLoading(m.id);
    try {
      await apiService.resendSiteInvite(siteId, m.id);
      alert(`Invite resent to ${m.invite_email}`);
    } catch {
      alert('Failed to resend invite.');
    } finally {
      setActionLoading(null);
    }
  };

  const displayName = (m: SiteMember) => {
    if (m.user) {
      const name = `${m.user.first_name} ${m.user.last_name}`.trim();
      return name || m.invite_email;
    }
    return m.invite_email;
  };

  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: text }}>Site Members</h3>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '8px', border: 'none',
            background: '#22c55e', color: '#fff', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          <UserPlus size={14} /> Invite Member
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: muted, fontSize: '13px' }}>
          <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
        </div>
      )}
      {error && <p style={{ color: '#ef4444', fontSize: '13px' }}>{error}</p>}

      {!loading && !error && members.length === 0 && (
        <p style={{ color: muted, fontSize: '13px', margin: 0 }}>
          No members yet. Invite a family member or co-owner to share access.
        </p>
      )}

      {!loading && members.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {members.map(m => (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 8px', borderRadius: '8px',
                background: actionLoading === m.id ? rowHover : 'transparent',
                transition: 'background 0.15s',
                flexWrap: 'wrap', gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: isDark ? '#334155' : '#e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, color: muted,
                }}>
                  {displayName(m).charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName(m)}
                  </div>
                  <div style={{ fontSize: '11px', color: muted }}>{m.invite_email}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{
                  fontSize: '11px', fontWeight: 600,
                  color: STATUS_COLORS[m.status],
                  padding: '2px 8px', borderRadius: '12px',
                  background: `${STATUS_COLORS[m.status]}20`,
                }}>
                  {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                </span>

                {m.status !== 'revoked' && (
                  <select
                    value={m.role}
                    onChange={e => handleRoleChange(m, e.target.value as 'viewer' | 'co_owner')}
                    disabled={actionLoading === m.id}
                    style={{
                      fontSize: '12px', padding: '3px 8px', borderRadius: '6px',
                      border: `1px solid ${border}`, background: surface, color: text,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="co_owner">Co-owner</option>
                  </select>
                )}

                {m.status === 'pending' && (
                  <button
                    onClick={() => handleResend(m)}
                    disabled={actionLoading === m.id}
                    title="Resend invite"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: muted, padding: '4px',
                    }}
                  >
                    <RotateCcw size={14} />
                  </button>
                )}

                {isOwner && m.status !== 'revoked' && (
                  <button
                    onClick={() => handleRevoke(m)}
                    disabled={actionLoading === m.id}
                    style={{
                      fontSize: '11px', padding: '3px 10px', borderRadius: '6px',
                      border: `1px solid #fca5a5`, background: 'transparent',
                      color: '#ef4444', cursor: 'pointer',
                    }}
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <InviteMemberModal
          siteId={siteId}
          onClose={() => setShowModal(false)}
          onInvited={m => { setMembers(prev => [...prev, m]); setShowModal(false); }}
        />
      )}
    </div>
  );
};

export default SiteMembersCard;
