import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Separator } from "../ui/separator";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
import Link from "next/link";
// import logoImage from 'figma:asset/575743c7bd0af4189cb4a7349ecfe505c6699243.png';
// import logo from '../images/logo.png'

interface LoginScreenProps {
  onLogin: (email: string, password: string, rememberMe: boolean) => void;
  onForgotPassword: () => void;
  onOAuthLogin: (provider: string) => void;
  loading: boolean;
  error: string | null;
}

const demoCredentials = [
  { email: "admin@demo.com", role: "Admin", password: "demo123" },
  { email: "manager@demo.com", role: "Manager", password: "demo123" },
  { email: "editor@demo.com", role: "Editor", password: "demo123" },
  { email: "qc@demo.com", role: "QC Specialist", password: "demo123" },
  { email: "scheduler@demo.com", role: "Scheduler", password: "demo123" },
  { email: "videographer@demo.com", role: "Videographer", password: "demo123" },
  { email: "client@demo.com", role: "Client", password: "demo123" },
];

export function LoginScreen({
  onLogin,
  onForgotPassword,
  onOAuthLogin,
  loading,
  error,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password, rememberMe);
  };

  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setTimeout(() => {
      onLogin(demoEmail, demoPassword, false);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-12 h-12 flex items-center justify-center">
            <img
              src="/images/logo.png"
              alt="E8 Logo"
              className="w-12 h-12 object-contain"
            />
          </div>
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1>Welcome back</h1>
          <p className="text-muted-foreground">
            Sign in to your Project Manager account
          </p>
        </div>

        {/* Demo Credentials */}
        {/* <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-blue-900">Demo Credentials</CardTitle>
            <p className="text-sm text-blue-700">Click any role to auto-fill login credentials</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {demoCredentials.map((cred) => (
                <Button
                  key={cred.email}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-white hover:bg-blue-100 border-blue-300"
                  onClick={() => handleDemoLogin(cred.email, cred.password)}
                  disabled={loading}
                >
                  {cred.role}
                </Button>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-2">
              All accounts use password: <strong>demo123</strong>
            </p>
          </CardContent>
        </Card> */}

        {/* Login Form */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="pl-10"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="pl-10 pr-10"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) =>
                      setRememberMe(checked as boolean)
                    }
                    disabled={loading}
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 text-sm text-gray-900"
                  >
                    Remember me
                  </label>
                </div>

                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
                  onClick={onForgotPassword}
                  disabled={loading}
                >
                  Forgot your password?
                </button>
              </div>

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOAuthLogin("google")}
                  disabled={loading}
                  className="w-full h-11"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285f4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34a853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#fbbc05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#ea4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </Button>

                <Button
                  variant="outline"
                  onClick={() => onOAuthLogin("slack")}
                  disabled={loading}
                  className="w-full h-11"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#e01e5a"
                      d="M6 15a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2h2zm1 0a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2z"
                    />
                    <path
                      fill="#36c5f0"
                      d="M9 6a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2zm0 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2z"
                    />
                    <path
                      fill="#2eb67d"
                      d="M18 9a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2zm-1 0a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2 2 2 0 0 1 2 2z"
                    />
                    <path
                      fill="#ecb22e"
                      d="M15 18a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2zm0-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 2 2 2 2 0 0 1-2 2z"
                    />
                  </svg>
                  Slack
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="text-primary hover:underline cursor-pointer"
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
