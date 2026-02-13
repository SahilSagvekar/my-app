// contexts/AuthContext.tsx
"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { SessionExpiredModal } from "@/components/auth/SessionExpiredModal";

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role: string | null;
  linkedClientId?: string; // Client ID for users with client role
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (newPassword: string, confirmPassword: string, token: string) => Promise<void>;
  verifyTwoFactor: (code: string) => Promise<void>;
  resendTwoFactorCode: () => Promise<void>;
  handleSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const router = useRouter();

  // Track auth state in a ref for the fetch interceptor
  const authStateRef = React.useRef({ isAuthenticated, user });
  React.useEffect(() => {
    authStateRef.current = { isAuthenticated, user };
  }, [isAuthenticated, user]);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setIsAuthenticated(true);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Global fetch interceptor for JWT expiration
  useEffect(() => {
    // 🛑 Prevent double wrapping if multiple instances are mounted
    if ((window.fetch as any).__isE8Wrapped) {
      console.warn('⚠️ Fetch is already wrapped, skipping to prevent recursion');
      return;
    }

    const originalFetch = window.fetch;

    const wrappedFetch = async (...args: any[]) => {
      // Execute the actual fetch using apply to handle arguments correctly
      const response = await (originalFetch as any).apply(window, args);

      // 🔥 Skip S3/AWS URLs - don't intercept file uploads or guest/public APIs
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
      const isPublicUrl =
        url.includes('s3.amazonaws.com') ||
        url.includes('amazonaws.com') ||
        url.includes('X-Amz-') ||
        url.includes('.s3.') ||
        url.includes('/api/shared/') ||
        (url.includes('/api/tasks/') && (url.includes('/feedback') || url.includes('/status')));

      if (isPublicUrl) {
        return response;
      }

      // Clone response to read it without consuming the stream
      try {
        const contentType = response.headers.get("content-type");

        // Only parse JSON responses
        if (contentType && contentType.includes("application/json")) {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();

          // Check for JWT expiration errors (401 Unauthorized or 500 with specific message)
          if (
            (response.status === 401 || response.status === 500) &&
            (data.message?.toLowerCase().includes('jwt expired') ||
              data.message?.toLowerCase().includes('token expired') ||
              data.error?.toLowerCase().includes('jwt expired'))
          ) {
            // Only show modal if user WAS authenticated
            if (authStateRef.current.isAuthenticated && !showSessionExpired) {
              console.log('🚨 Session expired detected in fetch interceptor');
              setShowSessionExpired(true);
            }
          }
        }
      } catch (e) {
        // Response is not JSON or already consumed, ignore
      }

      return response;
    };

    // Mark it to prevent double wrapping
    (wrappedFetch as any).__isE8Wrapped = true;
    window.fetch = wrappedFetch;

    // Cleanup: restore original fetch
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    setLoading(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    if (!res.ok) {
      const data = await res.json();
      setLoading(false);
      throw new Error(data.message || "Login failed");
    }

    const data = await res.json();
    setUser(data.user);
    setIsAuthenticated(true);
    setLoading(false);
  };

  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      await signOut({ redirect: false });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear auth token cookie
      document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';

      setUser(null);
      setIsAuthenticated(false);
      router.push("/");
    }
  };

  const handleSessionExpired = () => {
    setShowSessionExpired(false);
    logout();
  };

  const forgotPassword = async (email: string) => { console.log('Forgot password stub:', email); };
  const resetPassword = async (newPassword: string, confirmPassword: string, token: string) => { console.log('Reset password stub:', token); };
  const verifyTwoFactor = async (code: string) => { console.log('Verify 2FA stub:', code); };
  const resendTwoFactorCode = async () => { console.log('Resend 2FA stub'); };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        login,
        logout,
        forgotPassword,
        resetPassword,
        verifyTwoFactor,
        resendTwoFactorCode,
        handleSessionExpired
      }}
    >
      {children}

      {/* Session Expired Modal */}
      <SessionExpiredModal
        isOpen={showSessionExpired}
        onClose={handleSessionExpired}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}