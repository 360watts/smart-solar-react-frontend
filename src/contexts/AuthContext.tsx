import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { getCsrfToken } from '../services/api';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://api.360watts.com/api';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  mobile_number?: string;
  address?: string;
  is_staff: boolean;
  is_superuser: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  requestOtp: (mobileNumber: string) => Promise<void>;
  verifyOtp: (mobileNumber: string, otp: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  /** Re-checks the session cookie against the backend and updates `user`.
   * Used after flows (email verification, password setup) that log the
   * user in via a response this component didn't itself handle. */
  refreshSession: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth state lives in httpOnly cookies set by the backend — not localStorage.
  // Bootstrap by asking the backend who (if anyone) the cookie belongs to.
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/user/`, {
        credentials: 'include',
      });
      if (response.ok) {
        setUser(await response.json());
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  const requestOtp = useCallback(async (mobileNumber: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/auth/otp/request/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_number: mobileNumber }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to send OTP');
  }, []);

  const verifyOtp = useCallback(async (mobileNumber: string, otp: string): Promise<boolean> => {
    const response = await fetch(`${API_BASE_URL}/auth/otp/verify/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_number: mobileNumber, otp }),
    });
    if (response.ok) {
      const data = await response.json();
      setUser(data.user);
      if (data.site_id) localStorage.setItem('siteId', data.site_id);
      return true;
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'OTP verification failed');
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) {
      const data = await response.json();
      setUser(data.user);
      return true;
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Login failed');
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((userData: Partial<User>) => {
    setUser(prev => (prev ? { ...prev, ...userData } : prev));
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    login,
    requestOtp,
    verifyOtp,
    logout,
    updateUser,
    refreshSession,
    isAuthenticated: !!user,
    isAdmin: !!(user && user.is_superuser),
    loading,
  }), [user, login, requestOtp, verifyOtp, logout, updateUser, refreshSession, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
