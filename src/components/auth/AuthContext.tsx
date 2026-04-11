// contexts/AuthContext.tsx
"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { SessionExpiredModal } from "@/components/auth/SessionExpiredModal";

const AUTH_TOKEN_STORAGE_KEY = "e8_auth_token";
const AUTH_TOKEN_REMEMBERED_KEY = "e8_auth_token_remembered";

interface User {
  id: string | number;
  email: string;
  name?: string;
  image?: string;
  role: string | null;
  linkedClientId?: string; // Client ID for users with client role
  hasPostingServices?: boolean;
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

function safeStorageRead(storage: Storage | undefined, key: string) {
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch (error) {
    console.warn("⚠️ Unable to read auth storage:", error);
    return null;
  }
}

function safeStorageWrite(storage: Storage | undefined, key: string, value: string) {
  if (!storage) return;

  try {
    storage.setItem(key, value);
  } catch (error) {
    console.warn("⚠️ Unable to write auth storage:", error);
  }
}

function safeStorageRemove(storage: Storage | undefined, key: string) {
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch (error) {
    console.warn("⚠️ Unable to clear auth storage:", error);
  }
}

function getSafeStorage(type: "local" | "session") {
  if (typeof window === "undefined") return undefined;

  try {
    return type === "local" ? window.localStorage : window.sessionStorage;
  } catch (error) {
    console.warn(`⚠️ Unable to access ${type}Storage:`, error);
    return undefined;
  }
}

function getPersistentStorage(rememberMe: boolean) {
  return getSafeStorage(rememberMe ? "local" : "session");
}

function readStoredAuthToken() {
  return (
    safeStorageRead(getSafeStorage("session"), AUTH_TOKEN_STORAGE_KEY) ||
    safeStorageRead(getSafeStorage("local"), AUTH_TOKEN_STORAGE_KEY)
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const router = useRouter();
  const authTokenRef = React.useRef<string | null>(null);

  const persistAuthToken = React.useCallback((token: string, rememberMe: boolean) => {
    authTokenRef.current = token;

    if (typeof window === "undefined") return;

    safeStorageWrite(getPersistentStorage(rememberMe), AUTH_TOKEN_STORAGE_KEY, token);
    safeStorageWrite(getSafeStorage("local"), AUTH_TOKEN_REMEMBERED_KEY, rememberMe ? "true" : "false");

    const alternateStorage = getPersistentStorage(!rememberMe);
    safeStorageRemove(alternateStorage, AUTH_TOKEN_STORAGE_KEY);
  }, []);

  const clearStoredAuthToken = React.useCallback(() => {
    authTokenRef.current = null;

    safeStorageRemove(getSafeStorage("session"), AUTH_TOKEN_STORAGE_KEY);
    safeStorageRemove(getSafeStorage("local"), AUTH_TOKEN_STORAGE_KEY);
    safeStorageRemove(getSafeStorage("local"), AUTH_TOKEN_REMEMBERED_KEY);
  }, []);

  const getAuthHeaders = React.useCallback((headers?: HeadersInit) => {
    const mergedHeaders = new Headers(headers);
    const token = authTokenRef.current || readStoredAuthToken();

    if (token && !mergedHeaders.has("Authorization")) {
      mergedHeaders.set("Authorization", `Bearer ${token}`);
    }

    return mergedHeaders;
  }, []);

  // Track auth state in a ref for the fetch interceptor
  const authStateRef = React.useRef({ isAuthenticated, user });
  React.useEffect(() => {
    authStateRef.current = { isAuthenticated, user };
  }, [isAuthenticated, user]);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        authTokenRef.current = readStoredAuthToken();

        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setIsAuthenticated(true);
          } else if (authTokenRef.current) {
            clearStoredAuthToken();
          }
        }
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [clearStoredAuthToken, getAuthHeaders]);

  const fetchAuthenticatedUser = async (attempts = 6, delayMs = 150): Promise<User | null> => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          return data.user as User;
        }
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }
    }

    return null;
  };

  // Global fetch interceptor for JWT expiration
  useEffect(() => {
    // 🛑 Prevent double wrapping if multiple instances are mounted
    if ((window.fetch as any).__isE8Wrapped) {
      console.warn('⚠️ Fetch is already wrapped, skipping to prevent recursion');
      return;
    }

    const originalFetch = window.fetch;

    const wrappedFetch = async (...args: any[]) => {
      let response: Response;
      const requestInput = args[0];
      const requestUrl =
        typeof requestInput === 'string'
          ? requestInput
          : requestInput instanceof URL
            ? requestInput.toString()
            : (requestInput as Request)?.url || '';
      const isInternalApiRequest =
        requestUrl.startsWith('/api/') ||
        requestUrl.startsWith(`${window.location.origin}/api/`);

      if (isInternalApiRequest) {
        const init = (args[1] ?? {}) as RequestInit;
        args[1] = {
          ...init,
          credentials: init.credentials ?? "include",
          headers: getAuthHeaders(init.headers),
        };
      }

      try {
        // Execute the actual fetch using apply to handle arguments correctly
        response = await (originalFetch as any).apply(window, args);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }

        // Normalize low-level network errors (TypeError: Failed to fetch, CORS, offline, etc.)
        console.error('Global fetch error:', error);
        return new Response(
          JSON.stringify({
            error: 'network_error',
            message: error instanceof Error ? error.message : 'Failed to fetch',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // 🔥 Skip S3/AWS URLs - don't intercept file uploads or guest/public APIs
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
      const isPublicUrl =
        url.includes('s3.amazonaws.com') ||
        url.includes('amazonaws.com') ||
        url.includes('r2.cloudflarestorage.com') ||
        url.includes('r2.dev') ||
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
  }, [getAuthHeaders, showSessionExpired]);

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    setLoading(true);
    const res = await fetch("/api/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    if (!res.ok) {
      const data = await res.json();
      setLoading(false);
      throw new Error(data.message || "Login failed");
    }

    const data = await res.json() as { token?: string; user?: User };

    if (data.token) {
      persistAuthToken(data.token, Boolean(rememberMe));
    }

    const nextUser = await fetchAuthenticatedUser(3, 100) || data.user || null;
    if (!nextUser) {
      setLoading(false);
      throw new Error("Session initialization failed. Please try logging in again.");
    }

    setUser(nextUser);
    setIsAuthenticated(true);
    setLoading(false);

    if (window.location.pathname !== "/dashboard") {
      window.location.replace("/dashboard");
    }
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
      clearStoredAuthToken();

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
