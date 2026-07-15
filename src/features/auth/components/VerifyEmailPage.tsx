import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiService } from '../../../services/api'
import logoWithFont from '../../../assets/logo_with_font.png'

/**
 * /verify-email?email=...&otp=...
 * Customer lands here from the activation link in their email.
 * Silently submits the OTP and shows success/error — no interaction needed.
 */
const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const urlEmail = searchParams.get('email') ?? ''
  const urlOtp   = searchParams.get('otp')   ?? ''

  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!urlEmail || !urlOtp) {
      setState('error')
      setErrorMsg('Invalid verification link. Please contact support.')
      return
    }
    apiService.confirmPrecreationOtp(urlEmail, urlOtp)
      .then(() => setState('done'))
      .catch((err: any) => {
        setErrorMsg(err?.message ?? 'Verification failed. The link may have expired.')
        setState('error')
      })
  // run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      flex: 1, minHeight: '100vh', width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#080C14', padding: 20, fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 400, textAlign: 'center',
        background: 'linear-gradient(145deg, rgba(30,41,59,0.95), rgba(15,23,42,0.98))',
        borderRadius: 20, border: '1px solid rgba(148,163,184,0.12)',
        boxShadow: '0 25px 80px rgba(0,0,0,0.5)',
        padding: '44px 36px',
      }}>
        <img src={logoWithFont} alt="360Watts" style={{ height: 52, display: 'block', margin: '0 auto 32px' }} />

        {state === 'loading' && (
          <>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: '3px solid rgba(240,117,34,0.2)', borderTop: '3px solid #F07522',
              animation: 'spin 0.9s linear infinite',
              margin: '0 auto 20px',
            }} />
            <p style={{ margin: 0, fontSize: 15, color: 'var(--text-dim)' }}>Confirming your email…</p>
          </>
        )}

        {state === 'done' && (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 700, color: '#f0f4ff', fontFamily: "'Outfit', sans-serif" }}>
              Verification successful!
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.7 }}>
              Your email address has been confirmed.
            </p>
            <div style={{
              padding: '16px 20px', borderRadius: 10,
              background: 'rgba(240,117,34,0.08)', border: '1px solid rgba(240,117,34,0.2)',
              textAlign: 'left',
            }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#fb923c' }}>
                What happens next?
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                You will receive another email with your <strong style={{ color: '#cbd5e1' }}>login credentials</strong> once your account has been set up. This usually takes just a few minutes.
              </p>
            </div>
            <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>You can close this tab.</p>
          </>
        )}

        {state === 'error' && (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 26,
            }}>✕</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700, color: '#f0f4ff', fontFamily: "'Outfit', sans-serif" }}>
              Verification failed
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              {errorMsg}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>
              Ask your 360Watts administrator to resend the verification link.
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default VerifyEmailPage
