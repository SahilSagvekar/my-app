"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../components/auth/AuthContext";
import { ViewAsRoleProvider, useViewAsRole } from "../components/auth/ViewAsRoleContext";
import { NotificationProvider } from "../components/NotificationContext";
import { SearchProvider } from "../components/SearchContext";
import { LoginScreen } from "../components/auth/LoginScreen";
import { ForgotPasswordScreen } from "../components/auth/ForgotPasswordScreen";
import { ResetPasswordScreen } from "../components/auth/ResetPasswordScreen";
import { TwoFactorScreen } from "../components/auth/TwoFactorScreen";
import { LayoutShell } from "../components/LayoutShell";
import { getDefaultPage } from "../components/constants/navigation";
import { renderPage } from "../components/utils/pageRenderer";
import { PendingRoleScreen } from "../components/auth/PendingRoleScreen";
import { UploadProvider } from "../components/workflow/UploadContext";

type AuthScreen = "login" | "forgot-password" | "reset-password" | "two-factor";

function AuthenticatedAppInner() {
  const { user, logout, loading } = useAuth();
  const { viewingAsRole, isViewingAsOther } = useViewAsRole();
  const [currentPage, setCurrentPage] = useState(() =>
    getDefaultPage(viewingAsRole || user?.role || "admin")
  );

  // Reset page when role changes
  useEffect(() => {
    if (viewingAsRole) {
      setCurrentPage(getDefaultPage(viewingAsRole));
    }
  }, [viewingAsRole]);

  useEffect(() => {
    try {
      const savedPage = window.localStorage.getItem("returnToPage");
      if (savedPage) {
        console.log("Restoring page:", savedPage);
        window.localStorage.removeItem("returnToPage");
        setCurrentPage(savedPage);
      }
    } catch (err) {
      // localStorage can be blocked in some environments (private browsing, sandboxed iframe, strict privacy settings)
      // so we fail gracefully and just continue without restoring a saved page.
      console.warn("⚠️ localStorage unavailable (blocked by browser settings):", err);
    }
  }, []);

  const handlePageChange = (newPage: string) => {
    setCurrentPage(newPage);
  };

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not logged in</div>;

  // 🔥 Handle user with no role assigned yet
  if (!user.role) {
    return <PendingRoleScreen user={user} onLogout={logout} />;
  }

  // Use viewingAsRole for UI, but keep actual user.role for auth purposes
  const displayRole = (viewingAsRole || user.role || "admin").toLowerCase();

  return (
    <NotificationProvider>
      <SearchProvider>
        <LayoutShell
          currentRole={displayRole}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onLogout={logout}
        >
          {renderPage(displayRole, currentPage, handlePageChange, user.hasPostingServices)}
        </LayoutShell>
      </SearchProvider>
    </NotificationProvider>
  );
}

function AuthenticatedApp() {
  const { user, logout, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not logged in</div>;

  // 🔥 Handle user with no role assigned yet
  if (!user.role) {
    return <PendingRoleScreen user={user} onLogout={logout} />;
  }

  return (
    <ViewAsRoleProvider userEmail={user.email} userRole={user.role}>
      <AuthenticatedAppInner />
    </ViewAsRoleProvider>
  );
}

function AuthenticationFlow() {
  const {
    isAuthenticated,
    loading,
    login,
    verifyTwoFactor,
    resendTwoFactorCode,
  } = useAuth();

  const [currentScreen, setCurrentScreen] = useState<AuthScreen>("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingTwoFactorEmail, setPendingTwoFactorEmail] = useState<string>("");
  const [resetToken] = useState("demo-reset-token"); // Mock token

  const handleLogin = async (
    email: string,
    password: string,
    rememberMe: boolean
  ) => {
    try {
      setAuthError(null);
      await login(email, password, rememberMe);
    } catch (error: any) {
      if (error.message === "2FA_REQUIRED") {
        setPendingTwoFactorEmail(email);
        setCurrentScreen("two-factor");
      } else {
        setAuthError(error.message);
      }
    }
  };

  const handleTwoFactorVerification = async (code: string) => {
    try {
      setAuthError(null);
      await verifyTwoFactor(code);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleResendTwoFactorCode = async () => {
    try {
      setAuthError(null);
      await resendTwoFactorCode();
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    setAuthError("OAuth login handled by NextAuth");
  };

  const resetAuthState = () => {
    setAuthError(null);
    setPendingTwoFactorEmail("");
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated) {
    return <AuthenticatedApp />;
  }

  if (currentScreen === "login") {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onForgotPassword={() => {
          resetAuthState();
          setCurrentScreen("forgot-password");
        }}
        onOAuthLogin={handleOAuthLogin}
        loading={loading}
        error={authError}
      />
    );
  }

  if (currentScreen === "forgot-password") {
    return (
      <ForgotPasswordScreen
        onBackToLogin={() => {
          resetAuthState();
          setCurrentScreen("login");
        }}
      />
    );
  }

  if (currentScreen === "reset-password") {
    return (
      <ResetPasswordScreen
        onResetPassword={async () => console.log("Direct reset not implemented")}
        token={resetToken}
        loading={loading}
        error={authError}
      />
    );
  }

  if (currentScreen === "two-factor") {
    return (
      <TwoFactorScreen
        onVerifyCode={handleTwoFactorVerification}
        onResendCode={handleResendTwoFactorCode}
        onUseBackupCode={() => console.log("Backup code not implemented")}
        onBackToLogin={() => {
          resetAuthState();
          setCurrentScreen("login");
        }}
        loading={loading}
        error={authError}
        email={pendingTwoFactorEmail}
      />
    );
  }

  return null;
}

export default function App() {
  return (
    <UploadProvider>
      <div className="min-h-screen bg-background font-sans">
        <AuthenticationFlow />
      </div>
    </UploadProvider>
  );
}