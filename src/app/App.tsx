'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '../components/auth/AuthContext';
import { NotificationProvider } from '../components/NotificationContext';
import { SearchProvider } from '../components/SearchContext';
import { LoginScreen } from '../components/auth/LoginScreen';
import { ForgotPasswordScreen } from '../components/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../components/auth/ResetPasswordScreen';
import { TwoFactorScreen } from '../components/auth/TwoFactorScreen';
import { LayoutShell } from '../components/LayoutShell';
import { getDefaultPage } from '../components/constants/navigation';
import { renderPage } from '../components/utils/pageRenderer';

type AuthScreen = 'login' | 'forgot-password' | 'reset-password' | 'two-factor';



function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => getDefaultPage(user?.role || 'admin'));

  const handlePageChange = (newPage: string) => {
    setCurrentPage(newPage);
  };

  if (!user) return null;

  return (
    <NotificationProvider currentRole={user.role}>
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
    forgotPassword, 
    resetPassword, 
    verifyTwoFactor, 
    resendTwoFactorCode 
  } = useAuth();

  const [currentScreen, setCurrentScreen] = useState<AuthScreen>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [pendingTwoFactorEmail, setPendingTwoFactorEmail] = useState<string>('');
  const [resetToken] = useState('demo-reset-token'); // Mock token

  const handleLogin = async (email: string, password: string, rememberMe: boolean) => {
    try {
      setAuthError(null);
      await login(email, password, rememberMe);
    } catch (error: any) {
      if (error.message === '2FA_REQUIRED') {
        setPendingTwoFactorEmail(email);
        setCurrentScreen('two-factor');
      } else {
        setAuthError(error.message);
      }
    }
  };

  const handleForgotPassword = async (email: string) => {
    try {
      setAuthError(null);
      await forgotPassword(email);
      setForgotPasswordSuccess(true);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleResetPassword = async (newPassword: string, confirmPassword: string, token: string) => {
    try {
      setAuthError(null);
      await resetPassword(newPassword, confirmPassword, token);
    } catch (error: any) {
      setAuthError(error.message);
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
    console.log('OAuth login with:', provider);
    setAuthError('OAuth login not implemented in demo');
  };

  const resetAuthState = () => {
    setAuthError(null);
    setForgotPasswordSuccess(false);
    setPendingTwoFactorEmail('');
  };

  if (isAuthenticated) {
    return <AuthenticatedApp />;
  }

  if (currentScreen === 'login') {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onForgotPassword={() => {
          resetAuthState();
          setCurrentScreen('forgot-password');
        }}
        onOAuthLogin={handleOAuthLogin}
        loading={loading}
        error={authError}
      />
    );
  }

  if (currentScreen === 'forgot-password') {
    return (
      <ForgotPasswordScreen
        onSendResetLink={handleForgotPassword}
        onBackToLogin={() => {
          resetAuthState();
          setCurrentScreen('login');
        }}
        loading={loading}
        success={forgotPasswordSuccess}
        error={authError}
      />
    );
  }

  if (currentScreen === 'reset-password') {
    return (
      <ResetPasswordScreen
        onResetPassword={handleResetPassword}
        token={resetToken}
        loading={loading}
        error={authError}
      />
    );
  }

  if (currentScreen === 'two-factor') {
    return (
      <TwoFactorScreen
        onVerifyCode={handleTwoFactorVerification}
        onResendCode={handleResendTwoFactorCode}
        onUseBackupCode={() => console.log('Backup code not implemented')}
        onBackToLogin={() => {
          resetAuthState();
          setCurrentScreen('login');
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
      <div className="min-h-screen bg-background">
        <AuthenticationFlow />
      </div>
    </AuthProvider>
  );
}