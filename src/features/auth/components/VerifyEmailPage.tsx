import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/shared/ui/input-otp'
import { apiService } from '../../../services/api'
import logoWithFont from '../../../assets/logo_with_font.png'

/**
 * Standalone email verification page — /verify-email?email=...&otp=...
 * Linked from the pre-creation OTP email. Customer lands here, sees their
 * email pre-filled (and OTP if provided in URL), confirms, and sees success.
 * Staff gets unblocked to create the account once the token is confirmed.
 *
 * Note: this page confirms email ownership only — it does NOT log the user in
 * (no account exists yet). It calls confirm_precreation_otp and shows success.
 */
const OTP_LENGTH = 6

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const urlEmail = searchParams.get('email') ?? ''
  const urlOtp   = searchParams.get('otp')   ?? ''

  const [otp, setOtp]         = useState(urlOtp.replace(/\D/g, '').slice(0, OTP_LENGTH))
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [done, setDone]       = useState(false)

  // Auto-submit if OTP came pre-filled from the URL
  useEffect(() => {
    if (urlOtp.replace(/\D/g, '').length === OTP_LENGTH && urlEmail) {
      handleVerify(urlOtp.replace(/\D/g, '').slice(0, OTP_LENGTH))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleVerify = async (code = otp) => {
    if (code.length !== OTP_LENGTH || !urlEmail) return
    setError(null)
    setLoading(true)
    try {
      await apiService.confirmPrecreationOtp(urlEmail, code)
      setDone(true)
    } catch (err: any) {
      setError(err?.message ?? 'Verification failed. Please try again.')
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#080C14', padding: 20, fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(145deg, rgba(30,41,59,0.95), rgba(15,23,42,0.98))',
        borderRadius: 20, border: '1px solid rgba(148,163,184,0.12)',
        boxShadow: '0 25px 80px rgba(0,0,0,0.5)',
        padding: '40px 36px',
      }}>
        <img src={logoWithFont} alt="360Watts" style={{ height: 56, display: 'block', margin: '0 auto 28px' }} />

        {done ? (
          /* ── Success state ── */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 28,
            }}>✓</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700, color: '#f0f4ff', fontFamily: "'Syne', sans-serif" }}>
              Email confirmed!
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
              Your email address has been verified. Your 360Watts account is being set up —
              you'll receive your login credentials shortly.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
              You can close this tab.
            </p>
          </div>
        ) : (
          /* ── OTP entry state ── */
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#f0f4ff', fontFamily: "'Syne', sans-serif", textAlign: 'center' }}>
              Confirm your email
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 1.5 }}>
              Enter the 6-digit code sent to<br />
              <strong style={{ color: '#cbd5e1' }}>{urlEmail}</strong>
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <InputOTP
                maxLength={OTP_LENGTH}
                value={otp}
                onChange={v => {
                  setOtp(v)
                  setError(null)
                  if (v.length === OTP_LENGTH) setTimeout(() => handleVerify(v), 80)
                }}
              >
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

            {error && (
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#f87171', textAlign: 'center' }}>{error}</p>
            )}

            <button
              onClick={() => handleVerify()}
              disabled={loading || otp.length < OTP_LENGTH}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 9, border: 'none',
                background: loading || otp.length < OTP_LENGTH ? 'rgba(240,117,34,0.35)' : '#F07522',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: loading || otp.length < OTP_LENGTH ? 'not-allowed' : 'pointer',
                transition: 'background 0.18s',
              }}
            >
              {loading ? 'Verifying…' : 'Confirm Email'}
            </button>

            <p style={{ margin: '16px 0 0', fontSize: 12, color: '#475569', textAlign: 'center' }}>
              Wrong page?{' '}
              <button
                onClick={() => navigate('/login')}
                style={{ background: 'none', border: 'none', color: '#F07522', cursor: 'pointer', fontSize: 12, padding: 0 }}
              >
                Go to login
              </button>
            </p>
          </>
        )}
      </div>

      <style>{`
        .login-otp-slot[data-active=true] {
          border-color: #F07522 !important;
          box-shadow: 0 0 0 3px rgba(240,117,34,0.25) !important;
        }
      `}</style>
    </div>
  )
}

export default VerifyEmailPage
