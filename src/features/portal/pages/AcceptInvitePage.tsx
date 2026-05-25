import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { apiService, InviteDetails } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

/* ─── fonts ─── */
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Epilogue:wght@300;400;500;600&display=swap');
`;

/* ─── keyframes ─── */
const KEYFRAMES = `
@keyframes corona-spin {
  from { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  to   { transform: translate(-50%, -50%) rotate(360deg) scale(1); }
}
@keyframes corona-pulse {
  0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
  50%       { opacity: 0.75; transform: translate(-50%, -50%) scale(1.04); }
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
@keyframes checkmark-pop {
  0%   { transform: scale(0.5); opacity: 0; }
  70%  { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes spin-loader {
  to { transform: rotate(360deg); }
}
`;

/* ─── types ─── */
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

type AuthMode = 'choose' | 'login' | 'signup';

const ROLE_LABELS: Record<string, string> = { viewer: 'Viewer', co_owner: 'Co-owner' };

/* ─── design tokens ─── */
const C = {
  bg:        '#07090E',
  surface:   'rgba(255,255,255,0.035)',
  surfaceHover: 'rgba(255,255,255,0.055)',
  border:    'rgba(245,158,11,0.18)',
  borderMid: 'rgba(255,255,255,0.07)',
  amber:     '#F59E0B',
  amberDim:  '#D97706',
  amberGlow: 'rgba(245,158,11,0.22)',
  amberSoft: 'rgba(245,158,11,0.08)',
  textPrimary: '#F0EAD6',
  textSecondary: '#9CA3AF',
  textMuted:   '#4B5563',
  error:     '#F87171',
  errorBg:   'rgba(248,113,113,0.07)',
  errorBorder:'rgba(248,113,113,0.22)',
  success:   '#34D399',
};

/* ─── shared styles ─── */
const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 14px',
  borderRadius: 10,
  border: `1px solid ${C.borderMid}`,
  background: 'rgba(255,255,255,0.04)',
  color: C.textPrimary,
  fontFamily: "'Epilogue', sans-serif",
  fontSize: 14,
  fontWeight: 400,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  letterSpacing: '0.01em',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: C.textSecondary,
  marginBottom: 6,
  fontFamily: "'Epilogue', sans-serif",
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

/* ─── subcomponents ─── */
const SolarInput: React.FC<{
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  suffix?: React.ReactNode;
  readOnly?: boolean;
}> = ({ label, type = 'text', value, onChange, required, minLength, suffix, readOnly }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          readOnly={readOnly}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...inputStyle,
            paddingRight: suffix ? 42 : 14,
            borderColor: focused ? C.amber : C.borderMid,
            boxShadow: focused ? `0 0 0 3px ${C.amberGlow}` : 'none',
            opacity: readOnly ? 0.6 : 1,
          }}
        />
        {suffix && (
          <div style={{
            position: 'absolute', right: 12, top: '50%',
            transform: 'translateY(-50%)',
          }}>
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
};

const PrimaryBtn: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'submit' | 'button';
  disabled?: boolean;
  loading?: boolean;
}> = ({ children, onClick, type = 'button', disabled, loading }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '12px 0',
        borderRadius: 10,
        border: 'none',
        background: hovered && !disabled
          ? `linear-gradient(135deg, #FBBF24 0%, ${C.amber} 60%, ${C.amberDim} 100%)`
          : `linear-gradient(135deg, ${C.amber} 0%, ${C.amberDim} 100%)`,
        color: '#0D0F14',
        fontFamily: "'Epilogue', sans-serif",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        letterSpacing: '0.03em',
        boxShadow: hovered && !disabled ? `0 4px 20px ${C.amberGlow}` : 'none',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {loading && (
        <span style={{
          width: 14, height: 14,
          border: '2px solid rgba(0,0,0,0.2)',
          borderTopColor: '#0D0F14',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin-loader 0.7s linear infinite',
        }} />
      )}
      {children}
    </button>
  );
};

const GhostBtn: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '11px 0',
        borderRadius: 10,
        border: `1px solid ${hovered ? C.borderMid : 'rgba(255,255,255,0.05)'}`,
        background: hovered ? C.surfaceHover : 'transparent',
        color: hovered ? C.textPrimary : C.textSecondary,
        fontFamily: "'Epilogue', sans-serif",
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.18s',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </button>
  );
};

const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{
    padding: '10px 14px',
    borderRadius: 8,
    background: C.errorBg,
    border: `1px solid ${C.errorBorder}`,
    color: C.error,
    fontSize: 13,
    fontFamily: "'Epilogue', sans-serif",
    lineHeight: 1.5,
  }}>
    {msg}
  </div>
);

/* ─── solar corona background ─── */
const SolarBg: React.FC = () => (
  <div style={{
    position: 'fixed', inset: 0, overflow: 'hidden',
    background: C.bg, zIndex: 0,
    pointerEvents: 'none',
  }}>
    {/* deep radial glow */}
    <div style={{
      position: 'absolute',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 900, height: 900,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(245,158,11,0.09) 0%, rgba(245,158,11,0.03) 40%, transparent 70%)',
      animation: 'corona-pulse 6s ease-in-out infinite',
    }} />
    {/* spinning corona ring */}
    <div style={{
      position: 'absolute',
      top: '50%', left: '50%',
      width: 680, height: 680,
      borderRadius: '50%',
      background: `conic-gradient(
        from 0deg,
        transparent 0%,
        rgba(245,158,11,0.12) 8%,
        rgba(251,191,36,0.22) 15%,
        rgba(245,158,11,0.08) 22%,
        transparent 30%,
        transparent 50%,
        rgba(245,158,11,0.10) 58%,
        rgba(251,191,36,0.18) 65%,
        rgba(245,158,11,0.06) 72%,
        transparent 80%
      )`,
      animation: 'corona-spin 28s linear infinite',
    }} />
    {/* inner core */}
    <div style={{
      position: 'absolute',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 180, height: 180,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(251,191,36,0.16) 0%, rgba(245,158,11,0.06) 50%, transparent 70%)',
    }} />
    {/* grain texture overlay */}
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E")`,
      opacity: 0.6,
    }} />
  </div>
);

/* ─── wrapper card ─── */
const Card: React.FC<{ children: React.ReactNode; key?: string }> = ({ children }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px 16px',
    overflowY: 'auto',
  }}>
    <div style={{
      width: '100%', maxWidth: 432,
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 20,
      padding: '44px 40px 40px',
      boxShadow: `0 0 0 1px rgba(245,158,11,0.04), 0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(245,158,11,0.06)`,
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      animation: 'card-in 0.45s cubic-bezier(0.22,1,0.36,1) both',
      textAlign: 'center' as const,
    }}>
      {/* amber top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
        background: `linear-gradient(90deg, transparent, ${C.amber}, transparent)`,
        borderRadius: 1,
      }} />
      {children}
    </div>
  </div>
);

/* ─── solar wordmark ─── */
const Wordmark: React.FC = () => (
  <div style={{ textAlign: 'center', marginBottom: 32 }}>
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 9,
    }}>
      {/* sun icon */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4.5" fill={C.amber} />
        {[0,45,90,135,180,225,270,315].map((deg, i) => (
          <line
            key={i}
            x1="12" y1="12"
            x2={12 + 9 * Math.cos((deg - 90) * Math.PI / 180)}
            y2={12 + 9 * Math.sin((deg - 90) * Math.PI / 180)}
            stroke={C.amber} strokeWidth="1.5" strokeLinecap="round"
            opacity={i % 2 === 0 ? 1 : 0.45}
          />
        ))}
      </svg>
      <span style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 18,
        fontWeight: 500,
        color: C.textPrimary,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>360Watts</span>
    </div>
  </div>
);

/* ─── role badge ─── */
const RoleBadge: React.FC<{ role: string }> = ({ role }) => (
  <span style={{
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    background: C.amberSoft,
    border: `1px solid rgba(245,158,11,0.25)`,
    color: C.amber,
    fontSize: 12,
    fontFamily: "'Epilogue', sans-serif",
    fontWeight: 600,
    letterSpacing: '0.05em',
  }}>
    {ROLE_LABELS[role] || role}
  </span>
);

/* ─── main component ─── */
const AcceptInvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user, login } = useAuth();

  const [state, setState] = useState<PageState>({ type: 'loading' });
  const [accepting, setAccepting] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('choose');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setState({ type: 'not_found' }); return; }
    apiService.getInviteDetails(token)
      .then(details => {
        setState({ type: 'invite', details });
        setLoginEmail(details.invite_email || '');
        setSignupEmail(details.invite_email || '');
      })
      .catch(err => {
        const s = err?.status || (err?.message?.includes('410') ? 410 : 0);
        if (s === 410) setState({ type: 'already_used' });
        else setState({ type: 'not_found' });
      });
  }, [token]);

  const handleAccept = useCallback(async () => {
    if (!token) return;
    setAccepting(true);
    try {
      await apiService.acceptInvite(token);
      setState({ type: 'accepted' });
      setTimeout(() => navigate('/portal'), 2200);
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.includes('403') || msg.toLowerCase().includes('different email')) setState({ type: 'email_mismatch' });
      else if (msg.includes('409') || msg.toLowerCase().includes('already')) setState({ type: 'already_member' });
      else if (msg.includes('410')) setState({ type: 'already_used' });
      else setState({ type: 'error', message: msg || 'Something went wrong. Please try again.' });
    } finally { setAccepting(false); }
  }, [token, navigate]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const ok = await login(loginEmail, loginPassword);
      if (!ok) { setLoginError('Invalid email or password. Please try again.'); return; }
      if (token) {
        await apiService.acceptInvite(token);
        setState({ type: 'accepted' });
        setTimeout(() => navigate('/portal'), 2200);
      }
    } catch { setLoginError('Sign in failed. Please try again.'); }
    finally { setLoginLoading(false); }
  }, [loginEmail, loginPassword, login, token, navigate]);

  const handleSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    setSignupLoading(true);
    try {
      await apiService.registerUser({
        email: signupEmail,
        password: signupPassword,
        first_name: signupFirstName,
        last_name: signupLastName,
        invite_token: token!,
      });
      const ok = await login(signupEmail, signupPassword);
      if (ok && token) {
        await apiService.acceptInvite(token);
        setState({ type: 'accepted' });
        setTimeout(() => navigate('/portal'), 2200);
      }
    } catch { setSignupError('Registration failed. Please try again.'); }
    finally { setSignupLoading(false); }
  }, [signupEmail, signupPassword, signupFirstName, signupLastName, login, token, navigate]);

  /* ── render ── */

  if (state.type === 'loading' || authLoading) {
    return (
      <>
        <style>{FONTS}{KEYFRAMES}</style>
        <SolarBg />
        <Card>
          <Wordmark />
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 36, height: 36, margin: '0 auto 16px',
              border: `2px solid ${C.borderMid}`,
              borderTopColor: C.amber,
              borderRadius: '50%',
              animation: 'spin-loader 0.9s linear infinite',
            }} />
            <p style={{ color: C.textMuted, fontSize: 14, fontFamily: "'Epilogue', sans-serif" }}>
              Verifying your invitation…
            </p>
          </div>
        </Card>
      </>
    );
  }

  if (state.type === 'not_found' || state.type === 'expired') {
    return (
      <>
        <style>{FONTS}{KEYFRAMES}</style>
        <SolarBg />
        <Card>
          <Wordmark />
          <div style={{ textAlign: 'center' }}>
            <XCircle size={40} color={C.error} style={{ marginBottom: 16 }} />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 26, fontWeight: 500,
              color: C.textPrimary, marginBottom: 10,
            }}>Link Expired</h2>
            <p style={{ color: C.textSecondary, fontSize: 14, lineHeight: 1.65, marginBottom: 28, fontFamily: "'Epilogue', sans-serif" }}>
              This invitation link has expired or is no longer valid.<br />
              Ask the site owner to resend a fresh invitation.
            </p>
            <Link to="/" style={{
              color: C.amber, fontSize: 13,
              fontFamily: "'Epilogue', sans-serif", textDecoration: 'none',
              fontWeight: 500,
            }}>← Return home</Link>
          </div>
        </Card>
      </>
    );
  }

  if (state.type === 'already_used') {
    return (
      <>
        <style>{FONTS}{KEYFRAMES}</style>
        <SolarBg />
        <Card>
          <Wordmark />
          <div style={{ textAlign: 'center' }}>
            <AlertTriangle size={40} color={C.amber} style={{ marginBottom: 16 }} />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 26, fontWeight: 500,
              color: C.textPrimary, marginBottom: 10,
            }}>Already Accepted</h2>
            <p style={{ color: C.textSecondary, fontSize: 14, lineHeight: 1.65, marginBottom: 28, fontFamily: "'Epilogue', sans-serif" }}>
              This invite has already been used or revoked.
            </p>
            <Link to="/portal" style={{
              color: C.amber, fontSize: 13,
              fontFamily: "'Epilogue', sans-serif", textDecoration: 'none', fontWeight: 500,
            }}>Go to portal →</Link>
          </div>
        </Card>
      </>
    );
  }

  if (state.type === 'accepted') {
    return (
      <>
        <style>{FONTS}{KEYFRAMES}</style>
        <SolarBg />
        <Card>
          <Wordmark />
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ animation: 'checkmark-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both', marginBottom: 18 }}>
              <CheckCircle size={48} color={C.success} />
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 30, fontWeight: 500, letterSpacing: '0.02em',
              color: C.textPrimary, marginBottom: 10,
            }}>Welcome aboard</h2>
            <p style={{ color: C.textSecondary, fontSize: 14, lineHeight: 1.65, fontFamily: "'Epilogue', sans-serif" }}>
              Your invitation has been accepted.<br />Redirecting to your portal…
            </p>
            <div style={{
              marginTop: 24, height: 2, borderRadius: 1,
              background: C.borderMid, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: '100%',
                background: `linear-gradient(90deg, ${C.amber}, ${C.success})`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.8s linear infinite',
              }} />
            </div>
          </div>
        </Card>
      </>
    );
  }

  if (state.type === 'email_mismatch') {
    return (
      <>
        <style>{FONTS}{KEYFRAMES}</style>
        <SolarBg />
        <Card>
          <Wordmark />
          <div style={{ textAlign: 'center' }}>
            <XCircle size={40} color={C.error} style={{ marginBottom: 16 }} />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 26, fontWeight: 500,
              color: C.textPrimary, marginBottom: 10,
            }}>Wrong Account</h2>
            <p style={{ color: C.textSecondary, fontSize: 14, lineHeight: 1.65, marginBottom: 28, fontFamily: "'Epilogue', sans-serif" }}>
              This invite was sent to a different email address.<br />
              Sign in with the invited account to accept.
            </p>
            <Link to="/login" style={{
              display: 'inline-block',
              padding: '11px 28px', borderRadius: 10,
              background: `linear-gradient(135deg, ${C.amber}, ${C.amberDim})`,
              color: '#0D0F14', fontWeight: 600, textDecoration: 'none',
              fontSize: 14, fontFamily: "'Epilogue', sans-serif",
            }}>Sign in with correct account</Link>
          </div>
        </Card>
      </>
    );
  }

  if (state.type === 'already_member') {
    return (
      <>
        <style>{FONTS}{KEYFRAMES}</style>
        <SolarBg />
        <Card>
          <Wordmark />
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={40} color={C.success} style={{ marginBottom: 16 }} />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 26, fontWeight: 500,
              color: C.textPrimary, marginBottom: 10,
            }}>Already a Member</h2>
            <p style={{ color: C.textSecondary, fontSize: 14, lineHeight: 1.65, marginBottom: 28, fontFamily: "'Epilogue', sans-serif" }}>
              You already have access to this site.
            </p>
            <Link to="/portal" style={{
              color: C.amber, fontSize: 13,
              fontFamily: "'Epilogue', sans-serif", textDecoration: 'none', fontWeight: 500,
            }}>Go to portal →</Link>
          </div>
        </Card>
      </>
    );
  }

  if (state.type === 'error') {
    return (
      <>
        <style>{FONTS}{KEYFRAMES}</style>
        <SolarBg />
        <Card>
          <Wordmark />
          <div style={{ textAlign: 'center' }}>
            <XCircle size={40} color={C.error} style={{ marginBottom: 16 }} />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 26, fontWeight: 500,
              color: C.textPrimary, marginBottom: 10,
            }}>Something went wrong</h2>
            <p style={{ color: C.textSecondary, fontSize: 14, lineHeight: 1.65, marginBottom: 28, fontFamily: "'Epilogue', sans-serif" }}>
              {state.message}
            </p>
            <Link to="/" style={{
              color: C.amber, fontSize: 13,
              fontFamily: "'Epilogue', sans-serif", textDecoration: 'none', fontWeight: 500,
            }}>← Return home</Link>
          </div>
        </Card>
      </>
    );
  }

  /* ── state.type === 'invite' ── */
  const { details } = state as { type: 'invite'; details: InviteDetails };

  const InviteHeader = (
    <div style={{ marginBottom: 28, textAlign: 'center' }}>
      <p style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 11, fontWeight: 400,
        color: C.amber, letterSpacing: '0.18em',
        textTransform: 'uppercase', marginBottom: 10,
      }}>
        You've been invited
      </p>
      <h1 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 30, fontWeight: 500, lineHeight: 1.2,
        color: C.textPrimary, marginBottom: 12,
        letterSpacing: '0.01em',
      }}>
        Join {details.site_name}
      </h1>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8,
        fontSize: 13, color: C.textSecondary,
        fontFamily: "'Epilogue', sans-serif",
      }}>
        <span>Invited by</span>
        <strong style={{ color: C.textPrimary, fontWeight: 500 }}>{details.invited_by}</strong>
        <span>·</span>
        <RoleBadge role={details.role} />
      </div>
      {details.expires_at && (
        <p style={{
          marginTop: 10, fontSize: 12,
          color: C.textMuted,
          fontFamily: "'Epilogue', sans-serif",
        }}>
          Expires {new Date(details.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  );

  /* authenticated */
  if (isAuthenticated) {
    return (
      <>
        <style>{FONTS}{KEYFRAMES}</style>
        <SolarBg />
        <Card>
          <Wordmark />
          {InviteHeader}
          <div style={{
            padding: '12px 16px', borderRadius: 10,
            background: C.amberSoft,
            border: `1px solid rgba(245,158,11,0.15)`,
            marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: C.amberGlow,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontSize: 13, fontWeight: 600, color: C.amber,
              fontFamily: "'Epilogue', sans-serif",
            }}>
              {user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p style={{ fontSize: 12, color: C.textMuted, fontFamily: "'Epilogue', sans-serif", marginBottom: 1 }}>Accepting as</p>
              <p style={{ fontSize: 13, color: C.textPrimary, fontFamily: "'Epilogue', sans-serif", fontWeight: 500 }}>{user?.email}</p>
            </div>
          </div>
          <PrimaryBtn onClick={handleAccept} loading={accepting}>
            Accept Invitation
          </PrimaryBtn>
        </Card>
      </>
    );
  }

  /* login form */
  if (authMode === 'login') {
    return (
      <>
        <style>{FONTS}{KEYFRAMES}</style>
        <SolarBg />
        <Card>
          <Wordmark />
          {InviteHeader}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
            {loginError && <ErrorBox msg={loginError} />}
            <SolarInput label="Email" type="email" value={loginEmail} onChange={setLoginEmail} required />
            <SolarInput
              label="Password"
              type={showLoginPw ? 'text' : 'password'}
              value={loginPassword}
              onChange={setLoginPassword}
              required
              suffix={
                <button
                  type="button"
                  onClick={() => setShowLoginPw(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0, display: 'flex' }}
                >
                  {showLoginPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <PrimaryBtn type="submit" loading={loginLoading}>Sign In &amp; Accept</PrimaryBtn>
              <GhostBtn onClick={() => setAuthMode('choose')}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <ArrowLeft size={14} /> Back
                </span>
              </GhostBtn>
            </div>
          </form>
        </Card>
      </>
    );
  }

  /* signup form */
  if (authMode === 'signup') {
    return (
      <>
        <style>{FONTS}{KEYFRAMES}</style>
        <SolarBg />
        <Card>
          <Wordmark />
          {InviteHeader}
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
            {signupError && <ErrorBox msg={signupError} />}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <SolarInput label="First name" value={signupFirstName} onChange={setSignupFirstName} required />
              <SolarInput label="Last name" value={signupLastName} onChange={setSignupLastName} />
            </div>
            <SolarInput label="Email" type="email" value={signupEmail} onChange={setSignupEmail} required />
            <SolarInput
              label="Password"
              type={showSignupPw ? 'text' : 'password'}
              value={signupPassword}
              onChange={setSignupPassword}
              required
              minLength={8}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowSignupPw(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0, display: 'flex' }}
                >
                  {showSignupPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <PrimaryBtn type="submit" loading={signupLoading}>Create Account &amp; Accept</PrimaryBtn>
              <GhostBtn onClick={() => setAuthMode('choose')}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <ArrowLeft size={14} /> Back
                </span>
              </GhostBtn>
            </div>
          </form>
        </Card>
      </>
    );
  }

  /* choose: login or signup */
  return (
    <>
      <style>{FONTS}{KEYFRAMES}</style>
      <SolarBg />
      <Card>
        <Wordmark />
        {InviteHeader}

        {/* divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        }}>
          <div style={{ flex: 1, height: 1, background: C.borderMid }} />
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Epilogue', sans-serif", letterSpacing: '0.06em' }}>
            TO ACCEPT
          </span>
          <div style={{ flex: 1, height: 1, background: C.borderMid }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryBtn onClick={() => setAuthMode('login')}>Sign In</PrimaryBtn>
          <GhostBtn onClick={() => setAuthMode('signup')}>Create Account</GhostBtn>
        </div>

        <p style={{
          marginTop: 20, textAlign: 'center',
          fontSize: 11, color: C.textMuted,
          fontFamily: "'Epilogue', sans-serif",
          lineHeight: 1.6,
        }}>
          By accepting you agree to the 360Watts{' '}
          <span style={{ color: C.amber, cursor: 'pointer' }}>Terms of Service</span>
        </p>
      </Card>
    </>
  );
};

export default AcceptInvitePage;
