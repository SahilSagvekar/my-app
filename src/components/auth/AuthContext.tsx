import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'qc' | 'scheduler' | 'manager' | 'client' | 'videographer';
  avatar?: string;
  company?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (newPassword: string, confirmPassword: string, token: string) => Promise<void>;
  verifyTwoFactor: (code: string) => Promise<void>;
  resendTwoFactorCode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // Check for stored auth on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('authUser');
      }
    }
  }, []);

  const login = async (email: string, password: string, rememberMe: boolean): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.requires2FA) {
        setLoading(false);
        throw new Error('2FA_REQUIRED');
      }

      setUser(data.user);
      setIsAuthenticated(true);

      if (rememberMe) {
        localStorage.setItem('authUser', JSON.stringify(data.user));
      }

      setLoading(false);
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('authUser');
  };

  const forgotPassword = async (email: string): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Email not found');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (newPassword: string, confirmPassword: string, token: string): Promise<void> => {
    setLoading(true);
    try {
      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, token }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Password reset failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyTwoFactor = async (code: string): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Invalid verification code');
      }

      setUser(data.user);
      setIsAuthenticated(true);
      localStorage.setItem('authUser', JSON.stringify(data.user));
    } finally {
      setLoading(false);
    }
  };

  const resendTwoFactorCode = async (): Promise<void> => {
    setLoading(true);
    try {
      await fetch('/api/auth/resend-2fa', { method: 'POST' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      loading,
      login,
      logout,
      forgotPassword,
      resetPassword,
      verifyTwoFactor,
      resendTwoFactorCode
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
