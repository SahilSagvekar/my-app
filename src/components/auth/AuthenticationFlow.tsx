"use client";

import { useState } from "react";
import { useAuth } from "./AuthContext";
import { LoginScreen } from "./LoginScreen";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import { ResetPasswordScreen } from "./ResetPasswordScreen";
import { TwoFactorScreen } from "./TwoFactorScreen";
import dynamic from "next/dynamic";

// Dynamically import the heavy authenticated app so it's not downloaded until needed
const AuthenticatedApp = dynamic(() => import("../AuthenticatedApp").then(mod => mod.AuthenticatedApp), {
  loading: () => <div className="flex items-center justify-center min-h-screen">Loading application...</div>,
  ssr: false
});

type AuthScreen = "login" | "forgot-password" | "reset-password" | "two-factor";

export function AuthenticationFlow() {
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
    return <div className="flex items-center justify-center min-h-screen text-gray-400 font-medium animate-pulse">Initializing session...</div>;
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
