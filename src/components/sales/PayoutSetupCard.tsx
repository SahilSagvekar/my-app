import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader, Banknote, CheckCircle2, AlertCircle } from 'lucide-react';

interface OnboardingStatus {
  hasAccount: boolean;
  onboardingStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  payoutsEnabled: boolean;
  country: string | null;
  currency: string | null;
  taxFormType: string | null;
}

const COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'IN', label: 'India' },
  { code: 'PH', label: 'Philippines' },
  { code: 'MX', label: 'Mexico' },
];

export function PayoutSetupCard() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [country, setCountry] = useState('US');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/payouts/onboarding', { credentials: 'include' });
      const json = await res.json();
      if (json.success) setStatus(json.data);
    } catch {
      setError('Failed to load payout status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get('payoutOnboarding') === 'complete') {
      fetch('/api/payouts/onboarding/sync', { method: 'POST', credentials: 'include' })
        .then(() => fetchStatus())
        .finally(() => {
          params.delete('payoutOnboarding');
          window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`);
        });
    }
  }, []);

  const handleStart = async () => {
    setStarting(true);
    setError('');
    try {
      const res = await fetch('/api/payouts/onboarding', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to start onboarding');
      window.location.href = json.data.url;
    } catch (err: any) {
      setError(err.message);
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-bold">
          <Banknote className="h-5 w-5" />
          Commission Payout Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.payoutsEnabled ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Payout account active — you're set up to receive commission payouts
            {status.country && ` (${status.country}, ${status.currency?.toUpperCase()})`}
          </div>
        ) : status?.hasAccount ? (
          <>
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="h-4 w-4" />
              Onboarding started but not complete — finish setup to receive payouts
            </div>
            <Button onClick={handleStart} disabled={starting}>
              {starting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Continue Setup
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Set up your payout account to receive commission payments directly to your bank
              account. You'll be redirected to Stripe to securely enter your bank details and tax
              information.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Country</label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the country of your bank account. This can't be changed later.
              </p>
            </div>
            <Button onClick={handleStart} disabled={starting}>
              {starting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Set Up Payouts
            </Button>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
