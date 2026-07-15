import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import ReactDOM from 'react-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { apiService } from '../../../services/api';
import OTPInput from './OTPInput';
import { getSecurityCardStyles } from './styles';

type PasswordChangeStep = 'remember' | 'forgot' | 'otp_sent' | 'otp_verified';

interface PasswordChangeModalProps {
  onClose: () => void;
}

const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ onClose }) => {
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  // Form state
  const [step, setStep] = useState<PasswordChangeStep>('remember');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [resetToken, setResetToken] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);

  // Calculate password strength
  useEffect(() => {
    let score = 0;
    if (newPassword.length >= 8) score += 25;
    if (newPassword.length >= 12) score += 25;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 25;
    if (/\d/.test(newPassword)) score += 25;
    setPasswordStrength(score);
  }, [newPassword]);

  // OTP Resend countdown
  useEffect(() => {
    if (otpResendCountdown <= 0) return;
    const timer = setTimeout(() => setOtpResendCountdown(otpResendCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpResendCountdown]);

  // Handle password change (remember password flow)
  const handleChangePassword = async () => {
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await apiService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccess(true);
      setTimeout(() => {
        logout();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  // Handle request OTP
  const handleRequestOTP = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiService.requestPasswordResetOTP({ email });
      setOtp('');
      setOtpResendCountdown(30);
      setStep('otp_sent');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Handle verify OTP
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const response: any = await apiService.verifyPasswordResetOTP({ email, otp });
      setResetToken(response.reset_token);
      setStep('otp_verified');
      setNewPassword('');
      setConfirmPassword('');
      setOtp('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Handle reset password
  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await apiService.resetPassword({
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Styles — Solar Noir portal palette
  const modalBg     = isDark ? 'rgba(10,20,14,0.99)' : 'rgba(252,255,253,0.99)';
  const modalBorder = isDark ? 'rgba(47,191,113,0.16)' : 'rgba(47,191,113,0.2)';
  const inputBg     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const inputBorder = isDark ? 'rgba(47,191,113,0.18)' : 'rgba(47,191,113,0.22)';
  const inputText   = 'var(--success-soft)';
  const labelText   = isDark ? 'rgba(240,247,242,0.5)' : 'rgba(13,35,24,0.5)';
  const buttonBg    = '#2FBF71';
  const buttonHover = '#1A9955';

  const modal = (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(13,35,24,0.46)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
    }}>
      <div style={{
        background: modalBg,
        border: `1px solid ${modalBorder}`,
        borderRadius: 16,
        maxWidth: 400,
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px',
          borderBottom: `1px solid ${modalBorder}`,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: inputText }}>
            {step === 'remember' ? 'Change Password' : 'Reset Password'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: labelText,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Success state */}
        {success && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{
              width: 48,
              height: 48,
              background: 'rgba(34,197,94,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#22C55E',
            }}>
              <Check size={24} />
            </div>
            <p style={{ color: inputText, fontSize: 14, marginBottom: 8 }}>
              {step === 'remember' ? 'Password changed successfully!' : 'Password reset successfully!'}
            </p>
            <p style={{ color: labelText, fontSize: 12 }}>
              Redirecting to login...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !success && (
          <div style={{
            margin: '16px',
            padding: '12px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            display: 'flex',
            gap: 8,
            color: '#EF4444',
            fontSize: 13,
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        {!success && (
          <div style={{ padding: '20px' }}>
            {/* Remember Password Tab */}
            {step === 'remember' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: labelText, marginBottom: 6, fontWeight: 600 }}>
                    Current Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: inputBg,
                        border: `1px solid ${inputBorder}`,
                        borderRadius: 8,
                        color: inputText,
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: labelText,
                        display: 'flex',
                      }}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: labelText, marginBottom: 6, fontWeight: 600 }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: inputBg,
                        border: `1px solid ${inputBorder}`,
                        borderRadius: 8,
                        color: inputText,
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: labelText,
                        display: 'flex',
                      }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {newPassword && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{
                          height: 4,
                          flex: 1,
                          background: passwordStrength < 50 ? '#EF4444' : passwordStrength < 75 ? '#F59E0B' : '#22C55E',
                          borderRadius: 2,
                        }} />
                        <span style={{ color: labelText, fontSize: 11 }}>
                          {passwordStrength < 50 ? 'Weak' : passwordStrength < 75 ? 'Good' : 'Strong'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: labelText, marginBottom: 6, fontWeight: 600 }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: inputBg,
                      border: `1px solid ${newPassword && confirmPassword && newPassword === confirmPassword ? '#22C55E' : newPassword && confirmPassword ? '#EF4444' : inputBorder}`,
                      borderRadius: 8,
                      color: inputText,
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  />
                  {newPassword && confirmPassword && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: newPassword === confirmPassword ? '#22C55E' : '#EF4444',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      {newPassword === confirmPassword ? <Check size={14} /> : <X size={14} />}
                      {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: buttonBg,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: loading || !currentPassword || !newPassword || newPassword !== confirmPassword ? 0.5 : 1,
                    marginBottom: 12,
                  }}
                >
                  {loading ? 'Changing...' : 'Change Password'}
                </button>

                <button
                  onClick={() => setStep('forgot')}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'transparent',
                    color: buttonBg,
                    border: `1px solid ${buttonBg}`,
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Forgot password?
                </button>
              </>
            )}

            {/* Forgot Password Tab */}
            {(step === 'forgot' || step === 'otp_sent' || step === 'otp_verified') && !success && (
              <>
                {step === 'forgot' && (
                  <>
                    <p style={{ color: labelText, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
                      We'll send a verification code to your email to reset your password.
                    </p>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, color: labelText, marginBottom: 6, fontWeight: 600 }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: inputBg,
                          border: `1px solid ${inputBorder}`,
                          borderRadius: 8,
                          color: inputText,
                          fontSize: 14,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <button
                      onClick={handleRequestOTP}
                      disabled={loading || !email}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: buttonBg,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginBottom: 12,
                        opacity: loading || !email ? 0.5 : 1,
                      }}
                    >
                      {loading ? 'Sending...' : 'Send Verification Code'}
                    </button>

                    <button
                      onClick={() => {
                        setStep('remember');
                        setError(null);
                      }}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'transparent',
                        color: buttonBg,
                        border: `1px solid ${buttonBg}`,
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      Remember password?
                    </button>
                  </>
                )}

                {step === 'otp_sent' && (
                  <>
                    <p style={{ color: labelText, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
                      Enter the 6-digit code sent to your email.
                    </p>

                    <div style={{ marginBottom: 20 }}>
                      <OTPInput
                        value={otp}
                        onChange={setOtp}
                        onComplete={handleVerifyOTP}
                        isDark={isDark}
                        disabled={loading}
                      />
                    </div>

                    <p style={{ color: labelText, fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
                      Code expires in 10 minutes
                    </p>

                    <button
                      onClick={handleVerifyOTP}
                      disabled={loading || otp.length !== 6}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: buttonBg,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginBottom: 12,
                        opacity: loading || otp.length !== 6 ? 0.5 : 1,
                      }}
                    >
                      {loading ? 'Verifying...' : 'Verify Code'}
                    </button>

                    <button
                      onClick={handleRequestOTP}
                      disabled={loading || otpResendCountdown > 0}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'transparent',
                        color: otpResendCountdown > 0 ? labelText : buttonBg,
                        border: `1px solid ${otpResendCountdown > 0 ? inputBorder : buttonBg}`,
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: otpResendCountdown > 0 ? 'default' : 'pointer',
                        fontSize: 13,
                      }}
                    >
                      {otpResendCountdown > 0 ? `Resend in ${otpResendCountdown}s` : 'Resend Code'}
                    </button>
                  </>
                )}

                {step === 'otp_verified' && (
                  <>
                    <p style={{ color: labelText, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
                      Set your new password.
                    </p>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, color: labelText, marginBottom: 6, fontWeight: 600 }}>
                        New Password
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={loading}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: inputBg,
                            border: `1px solid ${inputBorder}`,
                            borderRadius: 8,
                            color: inputText,
                            fontSize: 14,
                            boxSizing: 'border-box',
                          }}
                        />
                        <button
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: labelText,
                            display: 'flex',
                          }}
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {newPassword && (
                        <div style={{ marginTop: 6, fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <div style={{
                              height: 4,
                              flex: 1,
                              background: passwordStrength < 50 ? '#EF4444' : passwordStrength < 75 ? '#F59E0B' : '#22C55E',
                              borderRadius: 2,
                            }} />
                            <span style={{ color: labelText, fontSize: 11 }}>
                              {passwordStrength < 50 ? 'Weak' : passwordStrength < 75 ? 'Good' : 'Strong'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, color: labelText, marginBottom: 6, fontWeight: 600 }}>
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: inputBg,
                          border: `1px solid ${newPassword && confirmPassword && newPassword === confirmPassword ? '#22C55E' : newPassword && confirmPassword ? '#EF4444' : inputBorder}`,
                          borderRadius: 8,
                          color: inputText,
                          fontSize: 14,
                          boxSizing: 'border-box',
                        }}
                      />
                      {newPassword && confirmPassword && (
                        <div style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: newPassword === confirmPassword ? '#22C55E' : '#EF4444',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          {newPassword === confirmPassword ? <Check size={14} /> : <X size={14} />}
                          {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleResetPassword}
                      disabled={loading || !newPassword || newPassword !== confirmPassword}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: buttonBg,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: loading || !newPassword || newPassword !== confirmPassword ? 0.5 : 1,
                      }}
                    >
                      {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default PasswordChangeModal;
