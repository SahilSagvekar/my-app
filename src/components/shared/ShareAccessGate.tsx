'use client';

import { useState } from 'react';
import { Mail, ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface ShareAccessGateProps {
  shareToken: string;
  itemType: 'file' | 'folder';
  onVerified: () => void;
  dark?: boolean;
}

// Step-1: enter email → server sends an OTP if it's on the invite list
// (response is identical either way, so this never confirms who was invited).
// Step-2: enter the 6-digit code → server sets an access cookie, we retry
// the original load.
export function ShareAccessGate({ shareToken, itemType, onVerified, dark }: ShareAccessGateProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shared/${shareToken}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setInfo('If that email has access, a code was sent — check your inbox.');
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shared/${shareToken}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      onVerified();
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const cardCls = dark
    ? 'bg-neutral-900 border-neutral-800'
    : 'bg-card border';
  const labelCls = dark ? 'text-neutral-400' : 'text-muted-foreground';
  const headingCls = dark ? 'text-white' : 'text-foreground';

  return (
    <Card className={`${cardCls} max-w-md w-full`}>
      <CardContent className="p-8 text-center">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
            dark ? 'bg-neutral-800' : 'bg-muted'
          }`}
        >
          {step === 'email' ? (
            <Mail className={`h-6 w-6 ${dark ? 'text-white' : 'text-foreground'}`} />
          ) : (
            <ShieldCheck className={`h-6 w-6 ${dark ? 'text-white' : 'text-foreground'}`} />
          )}
        </div>

        {step === 'email' ? (
          <>
            <h2 className={`text-xl font-semibold mb-2 ${headingCls}`}>This {itemType} requires access</h2>
            <p className={`text-sm mb-6 ${labelCls}`}>
              Enter the email address this was shared with. We'll send a code to verify it's you.
            </p>
            <form onSubmit={submitEmail} className="space-y-3 text-left">
              <Input
                type="email"
                required
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={dark ? 'bg-neutral-800 border-neutral-700 text-white' : ''}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Code
              </Button>
            </form>
          </>
        ) : (
          <>
            <h2 className={`text-xl font-semibold mb-2 ${headingCls}`}>Enter your code</h2>
            <p className={`text-sm mb-6 ${labelCls}`}>{info || `We sent a 6-digit code to ${email}.`}</p>
            <form onSubmit={submitOtp} className="space-y-3 text-left">
              <Input
                inputMode="numeric"
                required
                autoFocus
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className={`text-center tracking-[0.5em] font-mono text-lg ${
                  dark ? 'bg-neutral-800 border-neutral-700 text-white' : ''
                }`}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" disabled={loading || otp.length !== 6} className="w-full">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setError(null);
                }}
                className={`w-full flex items-center justify-center gap-1.5 text-xs pt-1 ${labelCls} hover:underline`}
              >
                <ArrowLeft className="h-3 w-3" />
                Use a different email
              </button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}