// // contexts/AuthContext.tsx
// "use client";
// import React, { createContext, useContext, useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { SessionExpiredModal } from "@/components/auth/SessionExpiredModal";

// interface User {
//   id: string;
//   email: string;
//   name?: string;
//   role: string;
// }

// interface AuthContextType {
//   isAuthenticated: boolean;
//   user: User | null;
//   loading: boolean;
//   login: (email: string, password: string) => Promise<void>;
//   logout: () => Promise<void>;
//   handleSessionExpired: () => void;
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export function AuthProvider({ children }: { children: React.ReactNode }) {
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [user, setUser] = useState<User | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [showSessionExpired, setShowSessionExpired] = useState(false);
//   const router = useRouter();

//   // Check auth status on mount
//   useEffect(() => {
//     const checkAuth = async () => {
//       try {
//         const res = await fetch("/api/auth/me");
//         if (res.ok) {
//           const data = await res.json();
//           if (data.user) {
//             setUser(data.user);
//             setIsAuthenticated(true);
//           }
//         }
//       } finally {
//         setLoading(false);
//       }
//     };
//     checkAuth();
//   }, []);

//   // Global fetch interceptor for JWT expiration
//   useEffect(() => {
//     const originalFetch = window.fetch;

//     window.fetch = async (...args) => {
//       const response = await originalFetch(...args);

//       // Clone response to read it without consuming the stream
//       const clonedResponse = response.clone();

//       try {
//         const contentType = clonedResponse.headers.get("content-type");

//         // Only parse JSON responses
//         if (contentType && contentType.includes("application/json")) {
//           const data = await clonedResponse.json();

//           // Check for JWT expiration errors
//           if (
//             (response.status === 401 || response.status === 500) &&
//             (data.message?.includes('jwt expired') ||
//              data.message?.includes('Token expired') ||
//              data.message?.includes('TokenExpiredError') ||
//              data.error?.includes('jwt expired') ||
//              data.message?.includes('Unauthorized'))
//           ) {
//             // Show session expired modal
//             setShowSessionExpired(true);
//           }
//         }
//       } catch (e) {
//         // Response is not JSON or already consumed, ignore
//       }

//       return response;
//     };

//     // Cleanup: restore original fetch
//     return () => {
//       window.fetch = originalFetch;
//     };
//   }, []);

//   const login = async (email: string, password: string) => {
//     setLoading(true);
//     const res = await fetch("/api/login", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ email, password }),
//     });

//     if (!res.ok) {
//       const data = await res.json();
//       setLoading(false);
//       throw new Error(data.message || "Login failed");
//     }

//     const data = await res.json();
//     setUser(data.user);
//     setIsAuthenticated(true);
//     setLoading(false);
//   };

//   const logout = async () => {
//     try {
//       await fetch("/api/logout", { method: "POST" });
//     } catch (error) {
//       console.error("Logout error:", error);
//     } finally {
//       // Clear auth token cookie
//       document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';

//       setUser(null);
//       setIsAuthenticated(false);
//       router.push("/");
//     }
//   };

//   const handleSessionExpired = () => {
//     setShowSessionExpired(false);
//     logout();
//   };

//   return (
//     <AuthContext.Provider 
//       value={{ 
//         isAuthenticated, 
//         user, 
//         loading, 
//         login, 
//         logout,
//         handleSessionExpired
//       }}
//     >
//       {children}

//       {/* Session Expired Modal */}
//       <SessionExpiredModal 
//         isOpen={showSessionExpired} 
//         onClose={handleSessionExpired} 
//       />
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error("useAuth must be used within an AuthProvider");
//   }
//   return context;
// }


// contexts/AuthContext.tsx
"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionExpiredModal } from "@/components/auth/SessionExpiredModal";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  handleSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const router = useRouter();

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if token exists in localStorage
        const token = localStorage.getItem("authToken");

        const res = await fetch("/api/auth/me", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
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
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      // Clone response to read it without consuming the stream
      const clonedResponse = response.clone();

      try {
        const contentType = clonedResponse.headers.get("content-type");

        // Only parse JSON responses
        if (contentType && contentType.includes("application/json")) {
          const data = await clonedResponse.json();

          // Check for JWT expiration errors
          if (
            (response.status === 401 || response.status === 500) &&
            (data.message?.includes('jwt expired') ||
              data.message?.includes('Token expired') ||
              data.message?.includes('TokenExpiredError') ||
              data.error?.includes('jwt expired') ||
              data.message?.includes('Unauthorized'))
          ) {
            // Show session expired modal
            setShowSessionExpired(true);
          }
        }
      } catch (e) {
        // Response is not JSON or already consumed, ignore
      }

      return response;
    };

    // Cleanup: restore original fetch
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setLoading(false);
      throw new Error(data.message || "Login failed");
    }

    const data = await res.json();

    // ✅ Save token to localStorage
    if (data.token) {
      localStorage.setItem("authToken", data.token);
    }

    setUser(data.user);
    setIsAuthenticated(true);
    setLoading(false);
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem("authToken");

      // Add timeout so logout doesn't hang forever
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      await fetch("/api/logout", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

    } catch (error) {
      // Ignore abort errors from timeout - we still want to log out locally
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error("Logout error:", error);
      }
    } finally {
      // Clear auth token from localStorage
      localStorage.removeItem("authToken");

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

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        login,
        logout,
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