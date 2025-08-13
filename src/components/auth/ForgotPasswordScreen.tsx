
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import logoImage from 'figma:asset/575743c7bd0af4189cb4a7349ecfe505c6699243.png';

interface ForgotPasswordScreenProps {
  onSendResetLink: (email: string) => Promise<void>;
  onBackToLogin: () => void;
  loading: boolean;
  success: boolean;
  error: string | null;
}

export function ForgotPasswordScreen({ 
  onSendResetLink, 
  onBackToLogin, 
  loading, 
  success, 
  error 
}: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>('');

  const validateEmail = () => {
    if (!email) {
      setFieldError('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFieldError('Please enter a valid email address');
      return false;
    }
    setFieldError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail()) {
      return;
    }

    try {
      await onSendResetLink(email);
    } catch (error) {
      // Error is handled by parent component
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-lg shadow-sm p-8 space-y-6">
          {/* Back Button */}
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBackToLogin}
              disabled={loading}
              className="px-0 hover:bg-transparent"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to login
            </Button>
          </div>

          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-12 h-12 flex items-center justify-center">
              <img 
                // src={logoImage} 
                alt="E8 Logo" 
                className="w-12 h-12 object-contain"
              />
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h1>Reset your password</h1>
            <p className="text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <AlertDescription className="text-green-800 dark:text-green-200">
                If this email exists, we'll send a link to reset your password.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldError ? 'border-destructive focus-visible:ring-destructive/20' : ''}
                  aria-invalid={!!fieldError}
                  aria-describedby={fieldError ? 'email-error' : undefined}
                  disabled={loading}
                />
                {fieldError && (
                  <p id="email-error" className="text-sm text-destructive">
                    {fieldError}
                  </p>
                )}
              </div>

              {/* Send Reset Link Button */}
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          )}

          {success && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder.
              </p>
              <Button onClick={onBackToLogin} variant="outline" className="w-full h-11">
                Back to login
              </Button>
            </div>
          )}

          {/* Additional Info */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Remember your password?{' '}
              <Button 
                variant="link" 
                size="sm" 
                onClick={onBackToLogin}
                disabled={loading}
                className="px-0 h-auto text-sm"
              >
                Sign in
              </Button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}