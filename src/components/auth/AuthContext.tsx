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

// Demo users for development
const demoUsers: Record<string, User> = {
  'admin@demo.com': {
    id: '1',
    email: 'admin@demo.com',
    name: 'Admin User',
    role: 'admin',
    avatar: 'AU'
  },
  'editor@demo.com': {
    id: '2', 
    email: 'editor@demo.com',
    name: 'Editor User',
    role: 'editor',
    avatar: 'EU'
  },
  'qc@demo.com': {
    id: '3',
    email: 'qc@demo.com', 
    name: 'QC User',
    role: 'qc',
    avatar: 'QU'
  },
  'scheduler@demo.com': {
    id: '4',
    email: 'scheduler@demo.com',
    name: 'Scheduler User', 
    role: 'scheduler',
    avatar: 'SU'
  },
  'manager@demo.com': {
    id: '5',
    email: 'manager@demo.com',
    name: 'Manager User',
    role: 'manager', 
    avatar: 'MU'
  },
  'client@demo.com': {
    id: '6',
    email: 'client@demo.com',
    name: 'Client User',
    role: 'client',
    avatar: 'CU',
    company: 'Acme Corporation'
  },
  'videographer@demo.com': {
    id: '7',
    email: 'videographer@demo.com',
    name: 'Video Photographer',
    role: 'videographer',
    avatar: 'VP'
  }
};

// Demo users that require 2FA
const twoFactorUsers = ['admin@demo.com'];

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
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check for demo user
    const demoUser = demoUsers[email];
    
    if (demoUser && password === 'demo123') {
      // Check if user requires 2FA
      if (twoFactorUsers.includes(email)) {
        setLoading(false);
        throw new Error('2FA_REQUIRED');
      }
      
      setUser(demoUser);
      setIsAuthenticated(true);
      
      if (rememberMe) {
        localStorage.setItem('authUser', JSON.stringify(demoUser));
      }
      setLoading(false);
    } else {
      setLoading(false);
      throw new Error('Invalid email or password');
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('authUser');
  };

  const forgotPassword = async (email: string): Promise<void> => {
    setLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Check if email exists in demo users
    if (demoUsers[email]) {
      setLoading(false);
      // In a real app, this would send an email
      return;
    } else {
      setLoading(false);
      throw new Error('Email not found');
    }
  };

  const resetPassword = async (newPassword: string, confirmPassword: string, token: string): Promise<void> => {
    setLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (newPassword !== confirmPassword) {
      setLoading(false);
      throw new Error('Passwords do not match');
    }
    
    if (newPassword.length < 8) {
      setLoading(false);
      throw new Error('Password must be at least 8 characters');
    }
    
    // Simulate successful password reset
    setLoading(false);
  };

  const verifyTwoFactor = async (code: string): Promise<void> => {
    setLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (code === '123456') {
      // Mock successful 2FA verification for admin user
      const adminUser = demoUsers['admin@demo.com'];
      setUser(adminUser);
      setIsAuthenticated(true);
      localStorage.setItem('authUser', JSON.stringify(adminUser));
      setLoading(false);
    } else {
      setLoading(false);
      throw new Error('Invalid verification code');
    }
  };

  const resendTwoFactorCode = async (): Promise<void> => {
    setLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setLoading(false);
    // In a real app, this would resend the code
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