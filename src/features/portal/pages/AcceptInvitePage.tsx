import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Sun, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { apiService, InviteDetails } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

type PageState =
  | { type: 'loading' }
  | { type: 'invite'; details: InviteDetails }
  | { type: 'not_found' }
  | { type: 'expired' }
  | { type: 'already_used' }
  | { type: 'accepted' }
  | { type: 'email_mismatch' }
  | { type: 'already_member' }
  | { type: 'error'; message: string };

const ROLE_LABELS: Record<string, string> = { viewer: 'Viewer', co_owner: 'Co-owner' };

const AcceptInvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [state, setState] = useState<PageState>({ type: 'loading' });
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) { setState({ type: 'not_found' }); return; }
    apiService.getInviteDetails(token)
      .then(details => setState({ type: 'invite', details }))
      .catch(err => {
        const status = err?.status || (err?.message?.includes('410') ? 410 : 0);
        if (status === 410) setState({ type: 'already_used' });
        else setState({ type: 'not_found' });
      });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      await apiService.acceptInvite(token);
      setState({ type: 'accepted' });
      setTimeout(() => navigate('/portal'), 2000);
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.includes('403') || msg.toLowerCase().includes('different email')) {
        setState({ type: 'email_mismatch' });
      } else if (msg.includes('409') || msg.toLowerCase().includes('already')) {
        setState({ type: 'already_member' });
      } else if (msg.includes('410')) {
        setState({ type: 'already_used' });
      } else {
        setState({ type: 'error', message: msg || 'Something went wrong. Please try again.' });
      }
    } finally {
      setAccepting(false);
    }
  };

  const card = (children: React.ReactNode) => (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f172a', padding: '16px',
    }}>
      <div style={{
        background: '#1e293b', borderRadius: '20px', padding: '40px 32px',
        width: '100%', maxWidth: '440px', textAlign: 'center',
        boxShadow: '0 25px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <Sun size={36} color="#22c55e" />
        </div>
        {children}
      </div>
    </div>
  );

  if (state.type === 'loading' || authLoading) {
    return card(
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading invitation…</p>
    );
  }

  if (state.type === 'not_found' || state.type === 'expired') {
    return card(<>
      <XCircle size={32} color="#ef4444" style={{ marginBottom: '12px' }} />
      <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
        Invite link expired
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
        This invite link has expired or is no longer valid. Ask the site owner to resend the invitation.
      </p>
      <Link to="/" style={{ color: '#22c55e', fontSize: '14px' }}>Go to home</Link>
    </>);
  }

  if (state.type === 'already_used') {
    return card(<>
      <AlertTriangle size={32} color="#f59e0b" style={{ marginBottom: '12px' }} />
      <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
        Invite already used
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
        This invite has already been accepted or revoked.
      </p>
      <Link to="/portal" style={{ color: '#22c55e', fontSize: '14px' }}>Go to portal →</Link>
    </>);
  }

  if (state.type === 'accepted') {
    return card(<>
      <CheckCircle size={36} color="#22c55e" style={{ marginBottom: '12px' }} />
      <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
        Welcome!
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>
        Invitation accepted. Redirecting to your portal…
      </p>
    </>);
  }

  if (state.type === 'email_mismatch') {
    return card(<>
      <XCircle size={32} color="#ef4444" style={{ marginBottom: '12px' }} />
      <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
        Wrong account
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
        This invite was sent to a different email address. Please log out and sign in with the invited account to accept.
      </p>
      <Link to="/login" style={{
        display: 'inline-block', padding: '10px 24px', borderRadius: '8px',
        background: '#22c55e', color: '#fff', fontWeight: 600, textDecoration: 'none', fontSize: '14px',
      }}>
        Log in with correct account
      </Link>
    </>);
  }

  if (state.type === 'already_member') {
    return card(<>
      <CheckCircle size={32} color="#22c55e" style={{ marginBottom: '12px' }} />
      <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
        Already a member
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
        You already have access to this site.
      </p>
      <Link to="/portal" style={{ color: '#22c55e', fontSize: '14px' }}>Go to portal →</Link>
    </>);
  }

  if (state.type === 'error') {
    return card(<>
      <XCircle size={32} color="#ef4444" style={{ marginBottom: '12px' }} />
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>{state.message}</p>
      <Link to="/" style={{ color: '#22c55e', fontSize: '14px' }}>Go to home</Link>
    </>);
  }

  // state.type === 'invite'
  const { details } = state as { type: 'invite'; details: InviteDetails };
  const loginUrl = `/login?next=/invite/${token}`;

  return card(<>
    <h2 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
      You're invited!
    </h2>
    <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
      <strong style={{ color: '#f1f5f9' }}>{details.invited_by}</strong> has invited you to access{' '}
      <strong style={{ color: '#f1f5f9' }}>{details.site_name}</strong> as{' '}
      <strong style={{ color: '#22c55e' }}>{ROLE_LABELS[details.role] || details.role}</strong>.
    </p>

    {!isAuthenticated ? (
      <>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>
          Log in or create an account to accept this invitation.
        </p>
        <a
          href={loginUrl}
          style={{
            display: 'inline-block', padding: '12px 28px', borderRadius: '10px',
            background: '#22c55e', color: '#fff', fontWeight: 700,
            textDecoration: 'none', fontSize: '15px',
          }}
        >
          Log in to accept
        </a>
      </>
    ) : (
      <>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>
          Accepting as <strong style={{ color: '#f1f5f9' }}>{user?.email}</strong>
        </p>
        <button
          onClick={handleAccept}
          disabled={accepting}
          style={{
            padding: '12px 28px', borderRadius: '10px', border: 'none',
            background: accepting ? '#86efac' : '#22c55e',
            color: '#fff', fontWeight: 700, fontSize: '15px',
            cursor: accepting ? 'not-allowed' : 'pointer',
          }}
        >
          {accepting ? 'Accepting…' : 'Accept Invitation'}
        </button>
      </>
    )}

    <p style={{ color: '#475569', fontSize: '12px', marginTop: '20px' }}>
      Expires {new Date(details.expires_at).toLocaleDateString()}
    </p>
  </>);
};

export default AcceptInvitePage;
