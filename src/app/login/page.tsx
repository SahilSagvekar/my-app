"use client";

import { useState } from "react";
import { LoginScreen } from "../../components/auth/LoginScreen";
import { loginUser } from "../../components/utils/api";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (email: string, password: string, rememberMe: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const data = await loginUser(email, password);
      console.log("Logged in:", data);

      // Save token (localStorage example)
      localStorage.setItem("token", data.token);

      // Optionally redirect to dashboard
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert("Redirect to forgot password flow");
  };

  const handleOAuthLogin = (provider: string) => {
    alert(`OAuth login with ${provider} clicked`);
  };

  return (
    <LoginScreen
      onLogin={handleLogin}
      onForgotPassword={handleForgotPassword}
      onOAuthLogin={handleOAuthLogin}
      loading={loading}
      error={error}
    />
  );
}
