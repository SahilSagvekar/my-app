import { useState, useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import logoImage from 'figma:asset/575743c7bd0af4189cb4a7349ecfe505c6699243.png';

interface TwoFactorScreenProps {
  onVerifyCode: (code: string) => Promise<void>;
  onResendCode: () => Promise<void>;
  onUseBackupCode: () => void;
  onBackToLogin: () => void;
  loading: boolean;
  error: string | null;
  email: string;
}

export function TwoFactorScreen({ 
  onVerifyCode, 
  onResendCode, 
  onUseBackupCode, 
  onBackToLogin, 
  loading, 
  error,
  email 
}: TwoFactorScreenProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digits
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      handleSubmit(pastedData);
    }
  };

  const handleSubmit = async (codeToSubmit?: string) => {
    const fullCode = codeToSubmit || code.join('');
    if (fullCode.length !== 6) return;

    try {
      await onVerifyCode(fullCode);
    } catch (error) {
      // Error is handled by parent component
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    try {
      await onResendCode();
      setResendCooldown(30); // 30 second cooldown
    } catch (error) {
      // Error is handled by parent component
    }
  };

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) return email;
    
    const maskedLocal = localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
    return `${maskedLocal}@${domain}`;
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
            <h1>Two-factor authentication</h1>
            <p className="text-muted-foreground">
              We sent a verification code to {maskEmail(email)}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Code Input */}
          <div className="space-y-4">
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-12 text-center text-lg font-medium"
                  disabled={loading}
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            {/* Verify Button */}
            <Button 
              onClick={() => handleSubmit()} 
              className="w-full h-11" 
              disabled={loading || code.some(digit => !digit)}
            >
              {loading ? 'Verifying...' : 'Verify code'}
            </Button>
          </div>

          {/* Resend Code */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Didn't receive the code?
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={handleResendCode}
              disabled={loading || resendCooldown > 0}
              className="px-0 h-auto text-sm"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </Button>
          </div>

          {/* Backup Code */}
          <div className="text-center">
            <Button
              variant="link"
              size="sm"
              onClick={onUseBackupCode}
              disabled={loading}
              className="px-0 h-auto text-sm"
            >
              Use backup code
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}