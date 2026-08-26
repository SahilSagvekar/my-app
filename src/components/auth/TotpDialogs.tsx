"use client";

import { useEffect, useState } from "react";
import {
  Smartphone,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/* -------------------------------------------------------------------------- */
/* Verify                                                                     */
/* -------------------------------------------------------------------------- */

export function TotpVerifyDialog({
  open,
  title = "Authenticator verification",
  description = "Enter the 6-digit code from your authenticator app (Google Authenticator, Authy, etc.)",
  confirmLabel = "Verify",
  onVerify,
  onCancel,
  secondaryAction,
}: {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onVerify: (code: string) => void | Promise<void>;
  onCancel: () => void;
  secondaryAction?: { label: string; onClick: () => void };
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCode("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    const clean = code.replace(/\s/g, "");
    if (clean.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onVerify(clean);
      setCode("");
    } catch (e: any) {
      setError(e?.message || "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="totp-verify-code">Verification code</Label>
            <Input
              id="totp-verify-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && !submitting && handleSubmit()}
              placeholder="000000"
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
              disabled={submitting}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          {secondaryAction && (
            <Button
              type="button"
              variant="link"
              className="px-0 h-auto text-sm"
              onClick={secondaryAction.onClick}
              disabled={submitting}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={code.length !== 6 || submitting}>
            <Unlock className="h-4 w-4 mr-2" />
            {submitting ? "Verifying…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Setup (QR scan)                                                            */
/* -------------------------------------------------------------------------- */

export function TotpSetupDialog({
  open,
  onEnabled,
  onCancel,
  purposeNote = "After setup, you'll need this code for sensitive actions like deleting files.",
}: {
  open: boolean;
  onEnabled: () => void | Promise<void>;
  onCancel: () => void;
  purposeNote?: string;
}) {
  const [step, setStep] = useState<"loading" | "scan" | "verify">("loading");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetLocal = () => {
    setStep("loading");
    setQrCode("");
    setSecret("");
    setBackupCodes([]);
    setVerifyCode("");
    setError("");
    setShowSecret(false);
    setCopiedBackup(false);
    setSubmitting(false);
  };

  useEffect(() => {
    if (!open) {
      resetLocal();
      return;
    }
    if (step !== "loading") return;

    fetch("/api/logins/2fa/setup", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setQrCode(data.qrCode);
          setSecret(data.secret);
          setBackupCodes(data.backupCodes || []);
          setStep("scan");
        } else {
          setError(data.error || "Failed to generate authenticator setup");
        }
      })
      .catch(() => setError("Failed to connect to server"));
  }, [open, step]);

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/logins/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode, enableAfterVerify: true }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to enable authenticator");
      }
      toast.success("Authenticator app enabled");
      setVerifyCode("");
      await onEnabled();
    } catch (e: any) {
      setError(e?.message || "Failed to enable authenticator");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetLocal();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            Set up authenticator app
          </DialogTitle>
          <DialogDescription>
            Scan the QR code with Google Authenticator, Authy, or a similar app
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {step === "loading" && (
            <div className="flex items-center justify-center py-8">
              {error ? (
                <p className="text-sm text-red-500 text-center">{error}</p>
              ) : (
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              )}
            </div>
          )}
          {step === "scan" && (
            <>
              <div className="flex flex-col items-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  1. Scan this QR code with your authenticator app:
                </p>
                {qrCode && (
                  <div className="p-3 bg-white rounded-lg border">
                    <img src={qrCode} alt="Authenticator QR code" className="w-48 h-48" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Or enter this code manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded font-mono text-sm break-all">
                    {showSecret ? secret : "••••••••••••••••••••"}
                  </code>
                  <Button size="sm" variant="ghost" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(secret);
                      toast.success("Secret copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {backupCodes.length > 0 && (
                <div className="space-y-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-amber-800">Save these backup codes:</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-700"
                      onClick={async () => {
                        await navigator.clipboard.writeText(backupCodes.join("\n"));
                        setCopiedBackup(true);
                        setTimeout(() => setCopiedBackup(false), 2000);
                      }}
                    >
                      {copiedBackup ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span className="ml-1">{copiedBackup ? "Copied!" : "Copy"}</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {backupCodes.map((c, i) => (
                      <code
                        key={i}
                        className="px-2 py-1 bg-white rounded text-xs font-mono text-center"
                      >
                        {c}
                      </code>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600">Store these safely — each works once.</p>
                </div>
              )}
              <Button onClick={() => setStep("verify")} className="w-full">
                Continue to verification
              </Button>
            </>
          )}
          {step === "verify" && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  2. Enter the 6-digit code from your authenticator app:
                </p>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => {
                    setVerifyCode(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && !submitting && handleVerify()}
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  autoFocus
                  disabled={submitting}
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription className="text-xs">{purposeNote}</AlertDescription>
              </Alert>
            </>
          )}
        </div>
        <DialogFooter>
          {step === "verify" && (
            <Button variant="outline" onClick={() => setStep("scan")} disabled={submitting}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          {step === "verify" && (
            <Button onClick={handleVerify} disabled={verifyCode.length !== 6 || submitting}>
              <Lock className="h-4 w-4 mr-2" />
              {submitting ? "Enabling…" : "Enable authenticator"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Reset (verify current → clear → caller opens setup)                        */
/* -------------------------------------------------------------------------- */

export function TotpResetDialog({
  open,
  onReset,
  onCancel,
}: {
  open: boolean;
  onReset: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCode("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    const clean = code.replace(/\s/g, "");
    if (clean.length !== 6) {
      setError("Enter the 6-digit code from your current authenticator app");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/logins/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to reset authenticator");
      }
      toast.success("Authenticator reset — set up a new one next");
      setCode("");
      await onReset();
    } catch (e: any) {
      setError(e?.message || "Failed to reset authenticator");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-600" />
            Reset authenticator
          </DialogTitle>
          <DialogDescription>
            Enter a code from your current authenticator app to remove it, then scan a new QR
            code. If you lost your device, ask an admin to reset 2FA for your account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="totp-reset-code">Current verification code</Label>
            <Input
              id="totp-reset-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && !submitting && handleSubmit()}
              placeholder="000000"
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
              disabled={submitting}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This removes your existing authenticator. You&apos;ll need to scan a new QR code
              before deleting files again.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={code.length !== 6 || submitting}
          >
            {submitting ? "Resetting…" : "Reset & set up again"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Fetch whether the signed-in user has authenticator enabled. */
export async function fetchTotpEnabled(): Promise<boolean> {
  try {
    const res = await fetch("/api/logins/2fa/check");
    const data = await res.json();
    return Boolean(data.isEnabled);
  } catch {
    return false;
  }
}
