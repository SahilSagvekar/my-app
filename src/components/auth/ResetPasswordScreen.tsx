import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import logoImage from 'figma:asset/575743c7bd0af4189cb4a7349ecfe505c6699243.png';

interface ResetPasswordScreenProps {
  onResetPassword: (newPassword: string, confirmPassword: string, token: string) => Promise<void>;
  token: string;
  loading: boolean;
  error: string | null;
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export function ResetPasswordScreen({ onResetPassword, token, loading, error }: ResetPasswordScreenProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    label: 'Very weak',
    color: 'bg-red-500',
    requirements: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false
    }
  });

  const calculatePasswordStrength = (password: string): PasswordStrength => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)
    };

    const score = Object.values(requirements).filter(Boolean).length;
    
    let label = 'Very weak';
    let color = 'bg-red-500';
    
    if (score >= 4) {
      label = 'Strong';
      color = 'bg-green-500';
    } else if (score >= 3) {
      label = 'Good';
      color = 'bg-yellow-500';
    } else if (score >= 2) {
      label = 'Fair';
      color = 'bg-orange-500';
    }

    return { score, label, color, requirements };
  };

  useEffect(() => {
    if (newPassword) {
      setPasswordStrength(calculatePasswordStrength(newPassword));
    }
  }, [newPassword]);

  const validateFields = () => {
    const errors: { newPassword?: string; confirmPassword?: string } = {};
    
    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    }
    
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateFields()) {
      return;
    }

    if (passwordStrength.score < 3) {
      setFieldErrors({ newPassword: 'Please choose a stronger password' });
      return;
    }

    try {
      await onResetPassword(newPassword, confirmPassword, token);
    } catch (error) {
      // Error is handled by parent component
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-lg shadow-sm p-8 space-y-6">
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
            <h1>Create a new password</h1>
            <p className="text-muted-foreground">
              Your new password must be different from previously used passwords
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password Field */}
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={fieldErrors.newPassword ? 'border-destructive focus-visible:ring-destructive/20 pr-10' : 'pr-10'}
                  aria-invalid={!!fieldErrors.newPassword}
                  aria-describedby={fieldErrors.newPassword ? 'new-password-error' : 'password-requirements'}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={loading}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {fieldErrors.newPassword && (
                <p id="new-password-error" className="text-sm text-destructive">
                  {fieldErrors.newPassword}
                </p>
              )}
            </div>

            {/* Password Strength Meter */}
            {newPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Password strength</span>
                  <span className="text-sm">{passwordStrength.label}</span>
                </div>
                <Progress value={(passwordStrength.score / 5) * 100} className="h-2" />
                
                <div id="password-requirements" className="space-y-1 text-xs">
                  {Object.entries(passwordStrength.requirements).map(([key, met]) => {
                    const labels = {
                      length: 'At least 8 characters',
                      uppercase: 'One uppercase letter',
                      lowercase: 'One lowercase letter',
                      number: 'One number',
                      special: 'One special character'
                    };
                    
                    return (
                      <div key={key} className="flex items-center gap-2">
                        {met ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className={met ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}>
                          {labels[key as keyof typeof labels]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={fieldErrors.confirmPassword ? 'border-destructive focus-visible:ring-destructive/20 pr-10' : 'pr-10'}
                  aria-invalid={!!fieldErrors.confirmPassword}
                  aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {fieldErrors.confirmPassword && (
                <p id="confirm-password-error" className="text-sm text-destructive">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Save & Sign In Button */}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Saving...' : 'Save & sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}