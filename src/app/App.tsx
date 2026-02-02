"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../components/auth/AuthContext";
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

function AuthenticatedApp() {
  const { user, logout, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState(() =>
    getDefaultPage(user?.role || "admin")
  );

  useEffect(() => {
    const savedPage = localStorage.getItem("returnToPage");
    if (savedPage) {
      console.log("Restoring page:", savedPage);
      localStorage.removeItem("returnToPage");
      setCurrentPage(savedPage);
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

  return (
    <NotificationProvider>
      <SearchProvider>
        <LayoutShell
          currentRole={user.role}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onLogout={logout}
        >
          {renderPage(user.role, currentPage)}
        </LayoutShell>
      </SearchProvider>
    </NotificationProvider>
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
        onResetPassword={() => console.log("Direct reset not implemented")}
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
    <AuthProvider>
      <UploadProvider>
        <div className="min-h-screen bg-background">
          <AuthenticationFlow />
        </div>
      </UploadProvider>
    </AuthProvider>
  );
}