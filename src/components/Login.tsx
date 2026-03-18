import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, X, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import logoWithFont from '../assets/logo_with_font.png';

const SolarScene3D = lazy(() => import('./SolarScene3D'));

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Load remembered username
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  // Redirect authenticated users away from login page
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/devices', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Save or remove remembered username
    if (rememberMe) {
      localStorage.setItem('rememberedUsername', username);
    } else {
      localStorage.removeItem('rememberedUsername');
    }

    try {
      const success = await login(username, password);
      if (success) {
        navigate('/devices', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth state
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

  // Don't render login form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="auth-container">
      <Suspense fallback={null}>
        <SolarScene3D />
      </Suspense>
      <div className="auth-card">
        {/* Official 360watts logo */}
        <div className="auth-logo">
          <img src={logoWithFont} alt="360watts" className="auth-logo-img" />
        </div>

        <div className="auth-header">
          <p>Smart Solar Monitor &mdash; Secure Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              <span>{error}</span>
              <button 
                type="button" 
                className="error-dismiss" 
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">
              <User size={16} strokeWidth={2} />
              Username
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                disabled={loading}
                autoComplete="username"
                autoFocus
              />
              {username && (
                <button
                  type="button"
                  className="input-clear"
                  onClick={() => setUsername('')}
                  aria-label="Clear username"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <Lock size={16} strokeWidth={2} />
              Password
            </label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={18} strokeWidth={2} />
                ) : (
                  <Eye size={18} strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkmark"></span>
              Remember me
            </label>
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading || !username || !password}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={18} strokeWidth={2} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p><Lock size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> Secure connection established</p>
        </div>
      </div>
    </div>
  );
};

export default Login;