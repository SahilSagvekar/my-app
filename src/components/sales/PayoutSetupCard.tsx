import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader, Banknote, CheckCircle2, AlertCircle, FileText, Download } from 'lucide-react';

interface OnboardingStatus {
  hasAccount: boolean;
  onboardingStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  payoutsEnabled: boolean;
  country: string | null;
  currency: string | null;
  taxFormType: string | null;
  taxFormSubmitted: boolean;
}

interface TaxFormStatus {
  submitted: boolean;
  taxFormType: string | null;
  submittedAt: string | null;
  downloadUrl: string | null;
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

const TAX_CLASSIFICATIONS = [
  { value: 'individual', label: 'Individual / sole proprietor' },
  { value: 'c_corp', label: 'C Corporation' },
  { value: 's_corp', label: 'S Corporation' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'trust_estate', label: 'Trust / estate' },
  { value: 'llc', label: 'LLC' },
  { value: 'other', label: 'Other' },
];

function W9Form({ onSubmitted }: { onSubmitted: () => void }) {
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [taxClassification, setTaxClassification] = useState('individual');
  const [llcClassificationLetter, setLlcClassificationLetter] = useState('');
  const [otherDescription, setOtherDescription] = useState('');
  const [address, setAddress] = useState('');
  const [cityStateZip, setCityStateZip] = useState('');
  const [ssn, setSsn] = useState('');
  const [ein, setEin] = useState('');
  const [signedName, setSignedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!name || !address || !cityStateZip || !signedName) {
      setError('Please fill in all required fields');
      return;
    }
    if (!ssn && !ein) {
      setError('Enter either an SSN or an EIN');
      return;
    }
    if (signedName.trim().toLowerCase() !== name.trim().toLowerCase()) {
      setError('Signature must match the name entered above');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/payouts/tax-form', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          businessName: businessName || undefined,
          taxClassification,
          llcClassificationLetter: llcClassificationLetter || undefined,
          otherDescription: otherDescription || undefined,
          address,
          cityStateZip,
          ssn: ssn || undefined,
          ein: ein || undefined,
          signedName,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to submit W-9');
      onSubmitted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileText className="h-4 w-4" />
        W-9 Tax Form
      </div>
      <p className="text-xs text-muted-foreground">
        Required by the IRS before we can pay you. Your SSN/EIN is stored only inside the signed
        PDF, never as plain text in our database.
      </p>

      <div className="space-y-2">
        <Label>Full legal name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
      </div>

      <div className="space-y-2">
        <Label>Business name (if different)</Label>
        <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Federal tax classification *</Label>
        <RadioGroup value={taxClassification} onValueChange={setTaxClassification}>
          {TAX_CLASSIFICATIONS.map((c) => (
            <div key={c.value} className="flex items-center gap-2">
              <RadioGroupItem value={c.value} id={`tc-${c.value}`} />
              <Label htmlFor={`tc-${c.value}`} className="font-normal">
                {c.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {taxClassification === 'llc' && (
        <div className="space-y-2">
          <Label>LLC tax classification (C, S, or P) *</Label>
          <Input
            value={llcClassificationLetter}
            onChange={(e) => setLlcClassificationLetter(e.target.value.toUpperCase().slice(0, 1))}
            maxLength={1}
            className="max-w-[80px]"
          />
        </div>
      )}
      {taxClassification === 'other' && (
        <div className="space-y-2">
          <Label>Describe *</Label>
          <Input value={otherDescription} onChange={(e) => setOtherDescription(e.target.value)} />
        </div>
      )}

      <div className="space-y-2">
        <Label>Address (number, street) *</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>City, state, ZIP *</Label>
        <Input value={cityStateZip} onChange={(e) => setCityStateZip(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>SSN</Label>
          <Input
            value={ssn}
            onChange={(e) => setSsn(e.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="123456789"
          />
        </div>
        <div className="space-y-2">
          <Label>EIN</Label>
          <Input
            value={ein}
            onChange={(e) => setEin(e.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="123456789"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Enter one of SSN or EIN, not both.</p>

      <div className="space-y-2">
        <Label>Signature (type your full legal name) *</Label>
        <Input value={signedName} onChange={(e) => setSignedName(e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
        Submit W-9
      </Button>
    </div>
  );
}

export function PayoutSetupCard() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [taxForm, setTaxForm] = useState<TaxFormStatus | null>(null);
  const [country, setCountry] = useState('US');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      const [onboardingRes, taxFormRes] = await Promise.all([
        fetch('/api/payouts/onboarding', { credentials: 'include' }),
        fetch('/api/payouts/tax-form', { credentials: 'include' }),
      ]);
      const onboardingJson = await onboardingRes.json();
      const taxFormJson = await taxFormRes.json();
      if (onboardingJson.success) setStatus(onboardingJson.data);
      if (taxFormJson.success) setTaxForm(taxFormJson.data);
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

  const taxFormSubmitted = !!(status?.taxFormSubmitted ?? taxForm?.submitted);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-bold">
          <Banknote className="h-5 w-5" />
          Commission Payout Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!taxFormSubmitted ? (
          <W9Form onSubmitted={fetchStatus} />
        ) : (
          <div className="flex items-center justify-between text-sm text-green-600 border rounded-lg p-3">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {taxForm?.taxFormType || 'W9'} on file
              {taxForm?.submittedAt && ` (${new Date(taxForm.submittedAt).toLocaleDateString()})`}
            </span>
            {taxForm?.downloadUrl && (
              <a href={taxForm.downloadUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              </a>
            )}
          </div>
        )}

        {taxFormSubmitted && (
          <>
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
                  account. You'll be redirected to Stripe to securely enter your bank details.
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
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
