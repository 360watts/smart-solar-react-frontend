import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Smartphone, X, Eye, EyeOff, LogIn, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PhoneInput from './PhoneInput';
import logoWithFont from '../assets/logo_with_font.png';

const SolarScene3D = lazy(() => import('./SolarScene3D'));

type Mode = 'password' | 'otp-phone' | 'otp-verify';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

const Login: React.FC = () => {
  // Password login state
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);

  // OTP state
  const [mobile, setMobile]           = useState('');
  const [otp, setOtp]                 = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [cooldown, setCooldown]       = useState(0);

  // Shared state
  const [mode, setMode]               = useState<Mode>('password');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { login, requestOtp, verifyOtp, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('rememberedUsername');
    if (saved) { setUsername(saved); setRememberMe(true); }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate('/devices', { replace: true });
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const switchMode = (next: Mode) => {
    setError('');
    setMode(next);
  };

  // ── Password login ──
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (rememberMe) localStorage.setItem('rememberedUsername', username);
    else localStorage.removeItem('rememberedUsername');
    try {
      const ok = await login(username, password);
      if (ok) navigate('/devices', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP: request ──
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!mobile || mobile.replace(/\D/g, '').length < 7) {
      setError('Please enter a valid mobile number.');
      return;
    }
    setLoading(true);
    try {
      await requestOtp(mobile);
      setOtp(Array(OTP_LENGTH).fill(''));
      setCooldown(RESEND_COOLDOWN);
      setMode('otp-verify');
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      await requestOtp(mobile);
      setOtp(Array(OTP_LENGTH).fill(''));
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP: digit input handlers ──
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
    if (digit && next.every(d => d)) submitOtp(next.join(''));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otp[index]) { const n = [...otp]; n[index] = ''; setOtp(n); }
      else if (index > 0) otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    if (pasted.length === OTP_LENGTH) submitOtp(pasted);
  };

  const submitOtp = async (code: string) => {
    setError('');
    setLoading(true);
    try {
      const ok = await verifyOtp(mobile, code);
      if (ok) navigate('/devices', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < OTP_LENGTH) { setError('Please enter all 6 digits.'); return; }
    submitOtp(code);
  };

  if (authLoading) {
    return (
      <div className="auth-container">
        <div className="auth-loading-screen">
          <div className="solar-loader">
            <img src={logoWithFont} alt="360watts" className="auth-logo-img auth-logo-img--pulse" />
          </div>
          <p className="loading-text">Initializing...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="auth-container">
      <Suspense fallback={null}>
        <SolarScene3D />
      </Suspense>

      <div className="auth-card">
        <div className="auth-logo">
          <img src={logoWithFont} alt="360watts" className="auth-logo-img" />
        </div>
        <div className="auth-header">
          <p>Smart Solar Monitor &mdash; Secure Portal</p>
        </div>

        {error && (
          <div className="auth-error">
            <span>{error}</span>
            <button type="button" className="error-dismiss" onClick={() => setError('')} aria-label="Dismiss error">
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* ── Mode: Username + Password (default) ── */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="username">
                <User size={16} strokeWidth={2} /> Username
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                />
                {username && (
                  <button type="button" className="input-clear" onClick={() => setUsername('')} aria-label="Clear">
                    <X size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">
                <Lock size={16} strokeWidth={2} /> Password
              </label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                <span className="checkmark" />
                Remember me
              </label>
            </div>

            <button type="submit" className="auth-button" disabled={loading || !username || !password}>
              {loading ? <><span className="spinner" /> Signing in...</> : <><LogIn size={18} strokeWidth={2} /> Sign In</>}
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button type="button" className="auth-alt-btn" onClick={() => switchMode('otp-phone')} disabled={loading}>
              <Smartphone size={16} strokeWidth={2} />
              Sign in with Mobile OTP
            </button>
          </form>
        )}

        {/* ── Mode: OTP — enter mobile ── */}
        {mode === 'otp-phone' && (
          <form onSubmit={handleRequestOtp} className="auth-form">
            <div className="form-group">
              <label>
                <Smartphone size={16} strokeWidth={2} /> Mobile Number
              </label>
              <PhoneInput
                value={mobile}
                onChange={setMobile}
                required
                placeholder="98765 43210"
                disabled={loading}
              />
            </div>

            <button type="submit" className="auth-button" disabled={loading || !mobile}>
              {loading ? <><span className="spinner" /> Sending OTP...</> : <>Send OTP</>}
            </button>

            <div className="auth-divider"><span>or</span></div>

            <button type="button" className="auth-alt-btn" onClick={() => switchMode('password')} disabled={loading}>
              <Lock size={16} strokeWidth={2} />
              Sign in with Password
            </button>
          </form>
        )}

        {/* ── Mode: OTP — enter code ── */}
        {mode === 'otp-verify' && (
          <form onSubmit={handleVerifySubmit} className="auth-form">
            <div className="otp-info">
              <p>OTP sent to <strong>{mobile}</strong></p>
            </div>

            <div className="form-group">
              <label>Enter 6-digit OTP</label>
              <div className="otp-boxes" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    disabled={loading}
                    className={`otp-box${digit ? ' otp-box--filled' : ''}`}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            <button type="submit" className="auth-button" disabled={loading || otp.some(d => !d)}>
              {loading ? <><span className="spinner" /> Verifying...</> : <><LogIn size={18} strokeWidth={2} /> Verify & Sign In</>}
            </button>

            <div className="otp-actions">
              <button
                type="button"
                className="otp-back-btn"
                onClick={() => { switchMode('otp-phone'); setOtp(Array(OTP_LENGTH).fill('')); }}
                disabled={loading}
              >
                <ArrowLeft size={14} strokeWidth={2} /> Change number
              </button>
              <button
                type="button"
                className="otp-resend-btn"
                onClick={handleResend}
                disabled={loading || cooldown > 0}
              >
                <RefreshCw size={14} strokeWidth={2} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
