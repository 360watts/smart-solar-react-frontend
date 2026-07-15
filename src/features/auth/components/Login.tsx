import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Check, ArrowLeft, RefreshCw } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/shared/ui/input-otp'
import { useAuth } from '../../../contexts/AuthContext'
import PhoneInput from '../../../shared/components/PhoneInput'
import logoWithFont from '../../../assets/logo_with_font.png'
import { apiService } from '../../../services/api'

type Mode = 'password' | 'otp-phone' | 'otp-verify' | 'email-verify'

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 30

/* ─── Particle canvas ────────────────────────────────────────────────────── */
const ParticleCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()

    interface Particle { x: number; y: number; size: number; speedY: number; opacity: number }
    const particles: Particle[] = []

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2.5 + 0.5,
        speedY: -(Math.random() * 0.8 + 0.3),
        opacity: Math.random() * 0.5 + 0.2,
      })
    }

    let raf = 0
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // radial glow at center
      const grd = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.6, 0,
        canvas.width * 0.5, canvas.height * 0.6, canvas.width * 0.5,
      )
      grd.addColorStop(0, 'rgba(245,158,11,0.07)')
      grd.addColorStop(1, 'transparent')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particles.forEach(p => {
        ctx.fillStyle = `rgba(245,158,11,${p.opacity})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        p.y += p.speedY
        if (p.y < -4) {
          p.y = canvas.height + 4
          p.x = Math.random() * canvas.width
        }
      })

      raf = requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => resize()
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}

/* ─── Main component ──────────────────────────────────────────────────────── */
const Login: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, requestOtp, verifyOtp } = useAuth()

  // Initialise from URL params (?verify=1&email=...) — set by activation link in email
  const urlVerifyEmail = searchParams.get('email') ?? ''
  const urlVerify = searchParams.get('verify') === '1'

  const [mode, setMode] = useState<Mode>(urlVerify && urlVerifyEmail ? 'email-verify' : 'password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [verifyEmail, setVerifyEmail] = useState(urlVerify ? urlVerifyEmail : '')
  const [verifyOtpVal, setVerifyOtpVal] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const clearError = () => setError(null)

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setLoading(true)
    try {
      const ok = await login(email, password)
      if (ok) navigate('/', { replace: true })
      else setError('Invalid email or password.')
    } catch (err: any) {
      // Backend returns error='EMAIL_NOT_VERIFIED' with the user's email
      const body = err?.response ? await err.response.json().catch(() => null) : null
      const msg = body?.error ?? err?.message ?? ''
      if (msg === 'EMAIL_NOT_VERIFIED' || (body?.email && msg.includes('verify'))) {
        setVerifyEmail(body?.email ?? email)
        setVerifyOtpVal('')
        setMode('email-verify')
      } else {
        setError('Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEmailVerify = async () => {
    if (verifyOtpVal.length !== OTP_LENGTH) return
    clearError()
    setLoading(true)
    try {
      const data = await apiService.verifyEmail({ email: verifyEmail, otp: verifyOtpVal })
      // Store tokens and navigate — mirror what login() does
      localStorage.setItem('authTokens', JSON.stringify({ access: data.access, refresh: data.refresh }))
      localStorage.setItem('authUser', JSON.stringify(data.user))
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err?.message ?? 'Verification failed. Please try again.')
      setVerifyOtpVal('')
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (cooldown > 0) return
    try {
      await apiService.resendVerificationEmail({ email: verifyEmail })
      setCooldown(RESEND_COOLDOWN)
      setVerifyOtpVal('')
      clearError()
    } catch {
      setError('Failed to resend code.')
    }
  }

  const handleOTPRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setLoading(true)
    try {
      await requestOtp(phone)
      setMode('otp-verify')
      setCooldown(RESEND_COOLDOWN)
    } catch {
      setError('Failed to send OTP. Check the number and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length < OTP_LENGTH) return
    clearError()
    setLoading(true)
    try {
      const ok = await verifyOtp(phone, otp)
      if (ok) navigate('/', { replace: true })
      else setError('Incorrect OTP. Please try again.')
    } catch {
      setError('Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setError(null)
    setLoading(true)
    try {
      await requestOtp(phone)
      setCooldown(RESEND_COOLDOWN)
    } catch {
      setError('Failed to resend OTP.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="login-root min-h-screen w-full flex"
      style={{ background: '#060A12', isolation: 'isolate' }}
    >
      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden"
        style={{ background: '#060A12' }}
      >
        {/* subtle amber glow blob */}
        <div style={{
          position: 'absolute', width: 520, height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)',
          top: '30%', left: '10%', pointerEvents: 'none',
        }} />
        <ParticleCanvas />
        <div className="relative z-10 flex flex-col w-full" style={{ gap: 0, padding: '48px 64px' }}>
          {/* Hero — vertically centered in remaining space */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 40, paddingBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <Badge
                className="border-green-500/30 px-3 py-1"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', marginBottom: 20, display: 'inline-flex' }}
              >
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                Live System Active
              </Badge>

              <div
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 46,
                  fontWeight: 800,
                  lineHeight: 1.12,
                  color: '#fff',
                  marginBottom: 16,
                }}
              >
                Power Your Future
                <br />
                <span style={{ color: '#F59E0B' }}>With Solar Energy</span>
              </div>

              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: 'var(--muted-foreground)', maxWidth: 360, lineHeight: 1.6 }}>
                Monitor, manage, and optimize your solar energy systems in real-time.
              </p>
            </div>

          </div>

          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--foreground)' }}>
            © 2026 360Watts. All rights reserved.
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 lg:p-12" style={{ position: 'relative', overflow: 'hidden' }}>
        <ParticleCanvas />
        <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 20,
              padding: '36px 32px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ marginBottom: 28 }}>
              <img
                src={logoWithFont}
                alt="360Watts"
                style={{ height: 82, objectFit: 'contain', display: 'block', margin: '0 auto 20px' }}
              />
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>
                {mode === 'email-verify' ? 'Verify your email' : 'Welcome back'}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: 'var(--muted-foreground)' }}>
                {mode === 'email-verify' ? 'Enter the code sent to your inbox' : 'Sign in to access your solar dashboard'}
              </div>
            </div>

            {/* Mode tabs */}
            <div
              style={{
                display: 'flex', gap: 4, padding: 4,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 10, marginBottom: 24,
              }}
            >
              {(['password', 'otp-phone'] as const).map(m => {
                const active = m === 'password' ? mode === 'password' : mode !== 'password'
                return (
                  <button
                    key={m}
                    onClick={() => { setMode(m); clearError(); setOtp('') }}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: active ? 600 : 500,
                      background: active ? '#F59E0B' : 'transparent',
                      color: active ? '#fff' : '#94A3B8',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    {m === 'password' ? 'Password' : 'OTP'}
                  </button>
                )
              })}
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  padding: '10px 14px', borderRadius: 9, marginBottom: 16,
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.25)',
                  color: '#fca5a5',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {/* ── Password form ── */}
            {mode === 'password' && (
              <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
                    Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} color="var(--muted-foreground)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                        borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)', color: '#F0F4FF',
                        fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="var(--muted-foreground)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        paddingLeft: 36, paddingRight: 40, paddingTop: 10, paddingBottom: 10,
                        borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)', color: '#F0F4FF',
                        fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 0 }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 9, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? 'rgba(245,158,11,0.5)' : '#F59E0B',
                    color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                    transition: 'background 0.18s',
                  }}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            )}

            {/* ── OTP phone form ── */}
            {mode === 'otp-phone' && (
              <form onSubmit={handleOTPRequest} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
                    Phone number
                  </label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    required
                    isDark
                    inlineStyle
                    placeholder="Enter your number"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 9, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? 'rgba(245,158,11,0.5)' : '#F59E0B',
                    color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                    transition: 'background 0.18s',
                  }}
                >
                  {loading ? 'Sending…' : 'Send OTP'}
                </button>
              </form>
            )}

            {/* ── OTP verify form ── */}
            {mode === 'otp-verify' && (
              <form onSubmit={handleOTPVerify} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 4 }}>
                    Enter 6-digit code
                  </label>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14 }}>
                    Sent to {phone}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <InputOTP maxLength={OTP_LENGTH} value={otp} onChange={setOtp}>
                      <InputOTPGroup>
                        {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                          <InputOTPSlot
                            key={i}
                            index={i}
                            className="login-otp-slot bg-white/5 border-white/10 text-white"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < OTP_LENGTH}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 9, border: 'none',
                    cursor: loading || otp.length < OTP_LENGTH ? 'not-allowed' : 'pointer',
                    background: loading || otp.length < OTP_LENGTH ? 'rgba(245,158,11,0.4)' : '#F59E0B',
                    color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.18s',
                  }}
                >
                  <Check size={14} />
                  {loading ? 'Verifying…' : 'Verify & Sign In'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => { setMode('otp-phone'); setOtp(''); clearError() }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--muted-foreground)' }}
                  >
                    <ArrowLeft size={13} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || loading}
                    style={{
                      background: 'none', border: 'none', cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                      color: cooldown > 0 ? 'var(--text-dim)' : '#F59E0B',
                    }}
                  >
                    <RefreshCw size={13} />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Email verification (new account) ── */}
            {mode === 'email-verify' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📧</span>
                  <div>
                    <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: '#86efac' }}>Check your email</p>
                    <p style={{ margin: '4px 0 0', fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                      A 6-digit verification code was sent to <strong style={{ color: '#CBD5E1' }}>{verifyEmail}</strong>. Enter it below to activate your account.
                    </p>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 12 }}>
                    Verification code
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <InputOTP maxLength={OTP_LENGTH} value={verifyOtpVal} onChange={v => { setVerifyOtpVal(v); if (v.length === OTP_LENGTH) setTimeout(handleEmailVerify, 80) }}>
                      <InputOTPGroup>
                        {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                          <InputOTPSlot key={i} index={i} className="login-otp-slot bg-white/5 border-white/10 text-white" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEmailVerify}
                  disabled={loading || verifyOtpVal.length < OTP_LENGTH}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 9, border: 'none',
                    cursor: loading || verifyOtpVal.length < OTP_LENGTH ? 'not-allowed' : 'pointer',
                    background: loading || verifyOtpVal.length < OTP_LENGTH ? 'rgba(34,197,94,0.3)' : '#22c55e',
                    color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.18s',
                  }}
                >
                  <Check size={14} />
                  {loading ? 'Activating…' : 'Activate Account'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => { setMode('password'); setVerifyOtpVal(''); clearError() }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--muted-foreground)' }}
                  >
                    <ArrowLeft size={13} /> Back to login
                  </button>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={cooldown > 0 || loading}
                    style={{ background: 'none', border: 'none', cursor: cooldown > 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: cooldown > 0 ? 'var(--text-dim)' : '#22c55e' }}
                  >
                    <RefreshCw size={13} />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .login-root h1, .login-root h2, .login-root h3 {
          font-size: unset; line-height: unset; letter-spacing: unset;
          background: none; -webkit-background-clip: unset; -webkit-text-fill-color: unset;
          background-clip: unset; font-weight: unset; margin: 0;
        }
        .login-root::before, .login-root::after { display: none !important; }
        .login-otp-slot[data-active=true] { border-color: #F59E0B !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.25) !important; }
      `}</style>
    </div>
  )
}

export default Login
