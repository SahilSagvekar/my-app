"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Lock,
  Unlock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  Key,
  Clock,
  User,
  Users,
  AlertCircle,
  RefreshCw,
  Smartphone,
  ExternalLink,
  Mail,
  Phone,
  FileText as FileNote,
} from "lucide-react";
import {
  FaInstagram,
  FaTiktok,
  FaFacebook,
  FaYoutube,
  FaTwitter,
  FaLinkedin,
  FaSnapchat,
} from "react-icons/fa";
import { SlSocialSteam } from "react-icons/sl";
import { toast } from "sonner";
import { useAuth } from "./auth/AuthContext";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type SocialPlatform =
  | "Instagram"
  | "TikTok"
  | "Facebook"
  | "YouTube"
  | "Twitter"
  | "LinkedIn"
  | "Snapchat"
  | "Email"
  | "Other";

interface SocialLogin {
  id: string;
  clientId: string;
  clientName: string;
  platform: string;
  username: string;
  password: string;
  loginUrl?: string;
  email?: string;
  phone?: string;
  notes?: string;
  backupCodesLocation?: string;
  adminOnly?: boolean;
  // Per-login delegation — stored on the login record itself, saved via PUT /api/logins/:id
  allowedRoles?: string[];
  allowedUserIds?: number[];
  passwordChangedAt?: string;
  lastUpdated: string;
  updatedBy: string;
}

interface Client {
  id: string;
  name: string;
  companyName: string;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
}

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const PLATFORMS: SocialPlatform[] = [
  "Instagram",
  "TikTok",
  "Facebook",
  "YouTube",
  "Twitter",
  "LinkedIn",
  "Snapchat",
  "Email",
  "Other",
];

const GRANTABLE_ROLES = [
  { value: "manager", label: "Manager" },
  { value: "editor", label: "Editor" },
  { value: "qc", label: "QC" },
  { value: "videographer", label: "Videographer" },
  { value: "scheduler", label: "Scheduler" },
];

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const getPlatformIcon = (platform: string, size = "h-5 w-5") => {
  const iconProps = { className: size };
  const icons: Record<string, React.ReactElement> = {
    Instagram: <FaInstagram {...iconProps} className={`${size} text-pink-500`} />,
    TikTok: <FaTiktok {...iconProps} className={`${size} text-gray-900`} />,
    Facebook: <FaFacebook {...iconProps} className={`${size} text-blue-600`} />,
    YouTube: <FaYoutube {...iconProps} className={`${size} text-red-600`} />,
    Twitter: <FaTwitter {...iconProps} className={`${size} text-sky-500`} />,
    LinkedIn: <FaLinkedin {...iconProps} className={`${size} text-blue-700`} />,
    Snapchat: <FaSnapchat {...iconProps} className={`${size} text-yellow-400`} />,
    Email: <Mail className={`${size} text-emerald-600`} />,
  };
  return icons[platform] || <SlSocialSteam {...iconProps} className={`${size} text-violet-400`} />;
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
  if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  return "just now";
};

/* -------------------------------------------------------------------------- */
/* TOTP VERIFICATION DIALOG                                                   */
/* -------------------------------------------------------------------------- */

function TotpVerificationDialog({
  open, onVerify, onCancel,
}: {
  open: boolean;
  onVerify: (code: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const clean = code.replace(/\s/g, "");
    if (clean.length !== 6) { setError("Enter the 6-digit code from your authenticator app"); return; }
    onVerify(clean);
    setCode(""); setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Enter the 6-digit code from your authenticator app (Google Authenticator, Authy, etc.)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="totp-code">Verification Code</Label>
            <Input
              id="totp-code" type="text" inputMode="numeric" maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="000000"
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This section contains sensitive client credentials. Access is logged for security purposes.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={code.length !== 6}>
            <Unlock className="h-4 w-4 mr-2" />Verify & Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 2FA SETUP DIALOG                                                           */
/* -------------------------------------------------------------------------- */

function TotpSetupDialog({
  open, onSetup, onCancel,
}: {
  open: boolean;
  onSetup: (code: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"loading" | "scan" | "verify">("loading");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  useEffect(() => {
    if (open && step === "loading") {
      fetch("/api/logins/2fa/setup", { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setQrCode(data.qrCode); setSecret(data.secret);
            setBackupCodes(data.backupCodes); setStep("scan");
          } else { setError(data.error || "Failed to generate 2FA setup"); }
        })
        .catch(() => setError("Failed to connect to server"));
    }
  }, [open, step]);

  const handleVerify = () => {
    if (verifyCode.length !== 6) { setError("Enter the 6-digit code"); return; }
    onSetup(verifyCode); setVerifyCode(""); setError("");
  };

  const handleClose = () => {
    setStep("loading"); setQrCode(""); setSecret(""); setBackupCodes([]);
    setVerifyCode(""); setError(""); onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />Set Up Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Secure your account with an authenticator app like Google Authenticator or Authy
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {step === "loading" && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}
          {step === "scan" && (
            <>
              <div className="flex flex-col items-center space-y-3">
                <p className="text-sm text-gray-600">1. Scan this QR code with your authenticator app:</p>
                {qrCode && <div className="p-3 bg-white rounded-lg border"><img src={qrCode} alt="QR Code" className="w-48 h-48" /></div>}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Or enter this code manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 rounded font-mono text-sm break-all">
                    {showSecret ? secret : "••••••••••••••••••••"}
                  </code>
                  <Button size="sm" variant="ghost" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(secret)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-amber-800">Save these backup codes:</p>
                  <Button size="sm" variant="ghost" className="text-amber-700"
                    onClick={async () => {
                      await navigator.clipboard.writeText(backupCodes.join("\n"));
                      setCopiedBackup(true); setTimeout(() => setCopiedBackup(false), 2000);
                    }}>
                    {copiedBackup ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span className="ml-1">{copiedBackup ? "Copied!" : "Copy"}</span>
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {backupCodes.map((c, i) => (
                    <code key={i} className="px-2 py-1 bg-white rounded text-xs font-mono text-center">{c}</code>
                  ))}
                </div>
                <p className="text-xs text-amber-600">Store these safely!</p>
              </div>
              <Button onClick={() => setStep("verify")} className="w-full">Continue to Verification</Button>
            </>
          )}
          {step === "verify" && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">2. Enter the 6-digit code from your authenticator app:</p>
                <Input
                  type="text" inputMode="numeric" maxLength={6} value={verifyCode}
                  onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, "")); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  placeholder="000000" className="text-center text-2xl tracking-[0.5em] font-mono" autoFocus
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  After verification, you'll need this code every time you access login credentials.
                </AlertDescription>
              </Alert>
            </>
          )}
          {error && step === "loading" && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>
        <DialogFooter>
          {step === "verify" && <Button variant="outline" onClick={() => setStep("scan")}>Back</Button>}
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step === "verify" && (
            <Button onClick={handleVerify} disabled={verifyCode.length !== 6}>
              <Lock className="h-4 w-4 mr-2" />Enable 2FA
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* PASSWORD FIELD                                                             */
/* -------------------------------------------------------------------------- */

function PasswordField({
  password, loginId, canView, onView, onCopy,
}: {
  password: string;
  loginId: string;
  canView: boolean;
  onView: (loginId: string) => void;
  onCopy: (password: string, loginId: string) => void;
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReveal = () => { if (!isRevealed) onView(loginId); setIsRevealed(!isRevealed); };
  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    onCopy(password, loginId);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("Password copied to clipboard");
  };

  useEffect(() => {
    if (isRevealed) {
      const t = setTimeout(() => setIsRevealed(false), 10000);
      return () => clearTimeout(t);
    }
  }, [isRevealed]);

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono">
        {isRevealed ? password : "••••••••••••"}
      </code>
      {canView && (
        <>
          <Button size="sm" variant="ghost" onClick={handleReveal}
            className="h-10 w-10 sm:h-8 sm:w-8 p-0 flex-shrink-0"
            title={isRevealed ? "Hide password" : "Reveal password"}>
            {isRevealed ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCopy}
            className="h-10 w-10 sm:h-8 sm:w-8 p-0 flex-shrink-0" title="Copy password">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-500" />}
          </Button>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ADD/EDIT LOGIN DIALOG (with embedded access control)                       */
/* -------------------------------------------------------------------------- */

function LoginFormDialog({
  open, onOpenChange, login, clients, onSave,
  isClient = false, userClientId = null, employees = [], isAdmin = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  login: SocialLogin | null;
  clients: Client[];
  onSave: (data: Partial<SocialLogin>) => void;
  isClient?: boolean;
  userClientId?: string | null;
  employees?: Employee[];
  isAdmin?: boolean;
}) {
  const [formData, setFormData] = useState({
    clientId: "",
    platform: "Instagram" as string,
    username: "",
    password: "",
    loginUrl: "",
    email: "",
    phone: "",
    notes: "",
    backupCodesLocation: "",
    adminOnly: false,
    allowedRoles: [] as string[],
    allowedUserIds: [] as number[],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [customPlatformName, setCustomPlatformName] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("Instagram");
  const [userSearchTerm, setUserSearchTerm] = useState("");

  useEffect(() => {
    const defaultPlatforms = PLATFORMS.filter((p) => p !== "Other");
    if (login) {
      const isDefault = defaultPlatforms.includes(login.platform as SocialPlatform);
      setSelectedPlatform(isDefault ? login.platform : "Other");
      setCustomPlatformName(isDefault ? "" : login.platform);
      setFormData({
        clientId: login.clientId || "",
        platform: login.platform,
        username: login.username,
        password: login.password,
        loginUrl: login.loginUrl || "",
        email: login.email || "",
        phone: login.phone || "",
        notes: login.notes || "",
        backupCodesLocation: login.backupCodesLocation || "",
        adminOnly: login.adminOnly || false,
        allowedRoles: login.allowedRoles || [],
        allowedUserIds: login.allowedUserIds || [],
      });
    } else {
      setSelectedPlatform("Instagram");
      setCustomPlatformName("");
      setFormData({
        clientId: isClient ? (userClientId || clients[0]?.id || "") : "",
        platform: "Instagram",
        username: "", password: "", loginUrl: "",
        email: "", phone: "", notes: "", backupCodesLocation: "",
        adminOnly: false, allowedRoles: [], allowedUserIds: [],
      });
    }
    setShowPassword(false);
    setUserSearchTerm("");
  }, [login, open, isClient, userClientId, clients]);

  const handleAdminOnlyChange = (checked: boolean) => {
    setFormData({ ...formData, adminOnly: checked, clientId: checked ? "" : formData.clientId });
  };

  const handleSubmit = () => {
    if (!formData.username) { toast.error("Username is required"); return; }
    if (!formData.password) { toast.error("Password is required"); return; }
    const finalPlatform = selectedPlatform === "Other" ? customPlatformName : selectedPlatform;
    if (!finalPlatform) { toast.error("Platform name is required"); return; }
    onSave({ ...formData, platform: finalPlatform });
    onOpenChange(false);
  };

  const toggleRole = (role: string) => {
    const next = formData.allowedRoles.includes(role)
      ? formData.allowedRoles.filter((r) => r !== role)
      : [...formData.allowedRoles, role];
    setFormData({ ...formData, allowedRoles: next });
  };

  const addUser = (emp: Employee) => {
    setFormData({ ...formData, allowedUserIds: [...formData.allowedUserIds, emp.id] });
    setUserSearchTerm("");
  };

  const removeUser = (id: number) => {
    setFormData({ ...formData, allowedUserIds: formData.allowedUserIds.filter((u) => u !== id) });
  };

  const searchResults = employees
    .filter((e) =>
      (e.name ?? "").toLowerCase().includes(userSearchTerm.toLowerCase()) &&
      !formData.allowedUserIds.includes(e.id) &&
      !["admin", "client"].includes((e.role ?? "").toLowerCase())
    )
    .slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{login ? "Edit Login Credentials" : "Add Login Credentials"}</DialogTitle>
          <DialogDescription>
            {login ? "Update the social media login information" : "Add new social media login credentials for a client"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto pr-2 -mr-2 space-y-4 py-4 px-1">
          {/* Admin Only toggle */}
          {!isClient && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <input type="checkbox" id="adminOnly" checked={formData.adminOnly}
                onChange={(e) => handleAdminOnlyChange(e.target.checked)}
                className="h-4 w-4 rounded border-amber-300" />
              <div>
                <label htmlFor="adminOnly" className="text-sm font-medium text-amber-800 dark:text-amber-200 cursor-pointer">
                  Admin Only
                </label>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Only admins can view this login.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={formData.adminOnly ? "text-gray-400" : ""}>
                Client <span className="text-xs text-gray-400 ml-1">(Optional)</span>
              </Label>
              {isClient && clients.length > 0 ? (
                <div className="flex items-center h-10 px-3 bg-gray-100 rounded-md border text-sm font-medium">
                  {clients[0]?.companyName || "Your Company"}
                </div>
              ) : (
                <Select value={formData.clientId}
                  onValueChange={(v) => setFormData({ ...formData, clientId: v })}
                  disabled={formData.adminOnly}>
                  <SelectTrigger className={formData.adminOnly ? "opacity-50 cursor-not-allowed bg-gray-100" : ""}>
                    <SelectValue placeholder="Select client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Platform *</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">{getPlatformIcon(p, "h-4 w-4")}{p}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedPlatform === "Other" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label>Custom Platform Name *</Label>
              <Input value={customPlatformName} onChange={(e) => setCustomPlatformName(e.target.value)}
                placeholder="Enter workspace or platform name" autoFocus />
            </div>
          )}

          <div className="space-y-2">
            <Label>Username / Handle *</Label>
            <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="@username or email" />
          </div>

          <div className="space-y-2">
            <Label>Password *</Label>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password" className="pr-10" />
              <Button type="button" size="sm" variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Login Page URL</Label>
            <div className="relative">
              <Input type="url" value={formData.loginUrl}
                onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
                placeholder="https://instagram.com/accounts/login/" className="pr-10" />
              {formData.loginUrl && (
                <Button type="button" size="sm" variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => window.open(formData.loginUrl, "_blank")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500">Direct link to the login or account management page</p>
          </div>

          <div className="space-y-2">
            <Label>Backup Codes Location</Label>
            <Input value={formData.backupCodesLocation}
              onChange={(e) => setFormData({ ...formData, backupCodesLocation: e.target.value })}
              placeholder="e.g. Google Drive link, Vault Note" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="recovery@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="2FA enabled, backup codes in drive, etc." />
          </div>

          {/* Access control — admin only, not applicable to adminOnly logins */}
          {isAdmin && !formData.adminOnly && (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <Label className="text-blue-800 dark:text-blue-200 font-medium">Additional Access Permissions</Label>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                By default, only Admin and Client (owner) can view logins. Grant additional access below.
              </p>

              {/* Role pills */}
              <div className="space-y-2">
                <Label className="text-sm">Grant access to roles</Label>
                <div className="flex flex-wrap gap-2">
                  {GRANTABLE_ROLES.map((r) => (
                    <button key={r.value} type="button" onClick={() => toggleRole(r.value)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        formData.allowedRoles.includes(r.value)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                      }`}>
                      {r.label}
                    </button>
                  ))}
                </div>
                {formData.allowedRoles.length > 0 && (
                  <p className="text-xs text-green-600">
                    {formData.allowedRoles
                      .map((r) => GRANTABLE_ROLES.find((g) => g.value === r)?.label)
                      .join(", ")}{" "}
                    can view this login
                  </p>
                )}
              </div>

              {/* Specific users */}
              <div className="space-y-2">
                <Label className="text-sm">Grant access to specific people</Label>
                <Input placeholder="Search employees by name..."
                  value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="bg-white" />

                {userSearchTerm && (
                  <div className="max-h-32 overflow-y-auto border rounded-md bg-white">
                    {searchResults.length === 0
                      ? <p className="px-3 py-2 text-sm text-gray-500">No matching employees</p>
                      : searchResults.map((emp) => (
                        <button key={emp.id} type="button" onClick={() => addUser(emp)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between">
                          <span>{emp.name}</span>
                          <Badge variant="outline" className="text-xs capitalize">{emp.role}</Badge>
                        </button>
                      ))}
                  </div>
                )}

                {formData.allowedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.allowedUserIds.map((uid) => {
                      const emp = employees.find((e) => e.id === uid);
                      return (
                        <Badge key={uid} variant="secondary" className="flex items-center gap-1 pr-1">
                          <User className="h-3 w-3" />
                          {emp?.name || `User #${uid}`}
                          <button type="button" onClick={() => removeUser(uid)}
                            className="ml-1 hover:bg-gray-300 rounded-full p-0.5">
                            <span className="sr-only">Remove</span>
                            <svg className="h-3 w-3" viewBox="0 0 14 14" fill="currentColor">
                              <path d="M4 4l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{login ? "Update Credentials" : "Save Credentials"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                                                             */
/* -------------------------------------------------------------------------- */

export function SocialLogins() {
  const { user } = useAuth();
  const [logins, setLogins] = useState<SocialLogin[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showTotpDialog, setShowTotpDialog] = useState(false);
  const [showTotpSetupDialog, setShowTotpSetupDialog] = useState(false);
  const [has2FA, setHas2FA] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [editingLogin, setEditingLogin] = useState<SocialLogin | null>(null);
  const [deleteConfirmLogin, setDeleteConfirmLogin] = useState<SocialLogin | null>(null);

  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
  const [isDeletingLogin, setIsDeletingLogin] = useState(false);

  const [loading, setLoading] = useState(true);

  const userRole = (user?.role ?? "").toLowerCase();
  const isAdmin = userRole === "admin";
  const isClient = userRole === "client";
  const userClientId = user?.linkedClientId || null;
  const userId = user?.id ? Number(user.id) : null;

  // Admin bypasses 2FA lock
  useEffect(() => { if (isAdmin) setIsUnlocked(true); }, [isAdmin]);

  // Per-login access check
  const canViewLogin = (login: SocialLogin): boolean => {
    if (isAdmin) return true;
    if (login.adminOnly) return false;
    if (isClient && login.clientId === userClientId) return true;
    if (userRole && login.allowedRoles?.includes(userRole)) return true;
    if (userId != null && login.allowedUserIds?.includes(userId)) return true;
    return false;
  };

  const canEdit = isAdmin || isClient;

  /* ----------------------------- AUTO-LOCK --------------------------------- */

  const resetActivity = useCallback(() => setLastActivity(Date.now()), []);

  useEffect(() => {
    if (!isUnlocked) return;
    const check = setInterval(() => {
      if (Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
        setIsUnlocked(false);
        toast.info("Session locked due to inactivity", { icon: <Lock className="h-4 w-4" /> });
      }
    }, 10000);
    return () => clearInterval(check);
  }, [isUnlocked, lastActivity]);

  useEffect(() => {
    if (!isUnlocked) return;
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetActivity));
    return () => events.forEach((e) => window.removeEventListener(e, resetActivity));
  }, [isUnlocked, resetActivity]);

  /* ----------------------------- DATA LOADING ------------------------------ */

  useEffect(() => {
    async function loadData() {
      try {
        const [clientsRes, twoFactorRes] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/logins/2fa/check"),
        ]);

        const clientsData = await clientsRes.json();
        const allClients = clientsData.clients || [];
        setClients(isClient && userClientId
          ? allClients.filter((c: Client) => c.id === userClientId)
          : allClients);

        const twoFactorData = await twoFactorRes.json();
        setHas2FA(twoFactorData.isEnabled || false);

        if (isAdmin) {
          const empRes = await fetch("/api/employee/list");
          if (empRes.ok) {
            const empData = await empRes.json();
            setEmployees(empData.employees || []);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to load data:", err);
        setLoading(false);
      }
    }
    loadData();
  }, [isClient, isAdmin, userClientId]);

  useEffect(() => {
    async function loadLogins() {
      try {
        const url = isClient && userClientId ? `/api/logins?clientId=${userClientId}` : "/api/logins";
        const res = await fetch(url);
        const data = await res.json();
        let fetched: SocialLogin[] = data.logins || [];
        if (isClient && userClientId) {
          fetched = fetched.filter((l) => l.clientId === userClientId);
        }
        setLogins(fetched);
      } catch (err) {
        console.error("Failed to load logins:", err);
      }
    }
    if (isUnlocked) loadLogins();
  }, [isUnlocked, isClient, userClientId]);

  /* ----------------------------- 2FA ---------------------------------------- */

  const handleUnlockAttempt = () => { if (has2FA) setShowTotpDialog(true); else setShowTotpSetupDialog(true); };

  const handleTotpVerify = async (code: string) => {
    try {
      const res = await fetch("/api/logins/2fa/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.verified) {
        setIsUnlocked(true); setShowTotpDialog(false); setLastActivity(Date.now());
        toast.success("Access granted", { icon: <ShieldCheck className="h-4 w-4" /> });
        await fetch("/api/logins/audit", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unlock" }),
        });
      } else { toast.error(data.error || "Invalid code"); }
    } catch { toast.error("Verification failed"); }
  };

  const handleTotpSetup = async (code: string) => {
    try {
      const res = await fetch("/api/logins/2fa/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, enableAfterVerify: true }),
      });
      const data = await res.json();
      if (data.enabled) {
        setHas2FA(true); setIsUnlocked(true); setShowTotpSetupDialog(false); setLastActivity(Date.now());
        toast.success("Two-Factor Authentication enabled successfully!");
      } else { toast.error(data.error || "Failed to enable 2FA"); }
    } catch { toast.error("Failed to enable 2FA"); }
  };

  /* ----------------------------- CRUD -------------------------------------- */

  const handleSaveLogin = async (data: Partial<SocialLogin>) => {
    try {
      const url = editingLogin ? `/api/logins/${editingLogin.id}` : "/api/logins";
      const method = editingLogin ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) { toast.error(result.message || "Failed to save"); return; }
      if (editingLogin) {
        setLogins((prev) => prev.map((l) => (l.id === editingLogin.id ? result.login : l)));
        toast.success("Credentials updated");
      } else {
        setLogins((prev) => [...prev, result.login]);
        toast.success("Credentials added");
      }
      setEditingLogin(null);
      resetActivity();
    } catch { toast.error("Server error"); }
  };

  const handleDeleteLogin = async () => {
    if (!deleteConfirmLogin) return;
    if (!deletePassword.trim()) { setDeletePasswordError("Please enter your password to confirm deletion."); return; }
    setIsDeletingLogin(true); setDeletePasswordError("");
    try {
      const verifyRes = await fetch("/api/auth/verify-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        setDeletePasswordError(verifyData.message || "Incorrect password. Please try again.");
        setIsDeletingLogin(false); return;
      }
      const res = await fetch(`/api/logins/${deleteConfirmLogin.id}`, { method: "DELETE" });
      if (res.ok) {
        setLogins((prev) => prev.filter((l) => l.id !== deleteConfirmLogin.id));
        toast.success("Credentials deleted");
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.message || "Failed to delete");
      }
      setDeleteConfirmLogin(null); setDeletePassword(""); setDeletePasswordError(""); resetActivity();
    } catch { toast.error("Server error"); }
    finally { setIsDeletingLogin(false); }
  };

  /* ----------------------------- AUDIT ------------------------------------- */

  const logPasswordView = async (loginId: string) => {
    try {
      await fetch("/api/logins/audit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "view", loginId }),
      });
    } catch { /* silent */ }
    resetActivity();
  };

  const logPasswordCopy = async (_password: string, loginId: string) => {
    try {
      await fetch("/api/logins/audit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy", loginId }),
      });
    } catch { /* silent */ }
    resetActivity();
  };

  /* ----------------------------- FILTERING --------------------------------- */

  const filteredLogins = logins.filter((login) => {
    if (!isAdmin && !canViewLogin(login)) return false;
    const matchesSearch =
      (login.username ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (login.clientName ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (login.platform ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = clientFilter === "all" || login.clientId === clientFilter;
    const matchesPlatform =
      platformFilter === "all" ||
      (platformFilter === "Other"
        ? !PLATFORMS.filter((p) => p !== "Other").includes(login.platform as SocialPlatform)
        : login.platform === platformFilter);
    return matchesSearch && matchesClient && matchesPlatform;
  });

  const loginsByClient = filteredLogins.reduce((acc, login) => {
    const key = login.clientId || "__admin__";
    if (!acc[key]) acc[key] = { clientName: login.clientName || "Admin Logins", logins: [] };
    acc[key].logins.push(login);
    return acc;
  }, {} as Record<string, { clientName: string; logins: SocialLogin[] }>);

  /* ----------------------------- ACCESS DENIED ----------------------------- */

  // if (!loading && !isAdmin && !isClient && !logins.some((l) => canViewLogin(l))) {
  //   return (
  //     <div className="flex items-center justify-center h-[60vh]">
  //       <Card className="max-w-md">
  //         <CardContent className="pt-6 text-center">
  //           <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
  //           <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
  //           <p className="text-gray-600">
  //             You don't have permission to view this section. Contact an admin to be granted access.
  //           </p>
  //         </CardContent>
  //       </Card>
  //     </div>
  //   );
  // }

  /* ----------------------------- LOCKED VIEW ------------------------------- */

  // if (!isUnlocked) {
  //   return (
  //     <div className="space-y-6">
  //       <div>
  //         <h2 className="text-3xl font-bold tracking-tight text-gray-900">Social Media Logins</h2>
  //         <p className="text-sm text-gray-600">
  //           {isClient ? "Access your social media credentials securely" : "Secure storage for client social media credentials"}
  //         </p>
  //       </div>
  //       <div className="flex items-center justify-center h-[50vh]">
  //         <Card className="max-w-md w-full">
  //           <CardContent className="pt-8 pb-8 text-center">
  //             <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
  //               <Lock className="h-10 w-10 text-gray-400" />
  //             </div>
  //             <h3 className="text-xl font-semibold mb-2">Section Locked</h3>
  //             <p className="text-gray-600 mb-6">
  //               This section contains sensitive {isClient ? "account" : "client"} credentials.
  //               {has2FA ? " Verify your identity with your authenticator app." : " Set up two-factor authentication to continue."}
  //             </p>
  //             <Button onClick={handleUnlockAttempt} size="lg" className="gap-2">
  //               <Smartphone className="h-4 w-4" />
  //               {has2FA ? "Verify with 2FA" : "Set Up Two-Factor Auth"}
  //             </Button>
  //             <div className="mt-6 pt-6 border-t">
  //               <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
  //                 <ShieldCheck className="h-4 w-4" />
  //                 <span>All access is logged for security</span>
  //               </div>
  //             </div>
  //           </CardContent>
  //         </Card>
  //       </div>
  //       <TotpVerificationDialog open={showTotpDialog} onVerify={handleTotpVerify} onCancel={() => setShowTotpDialog(false)} />
  //       <TotpSetupDialog open={showTotpSetupDialog} onSetup={handleTotpSetup} onCancel={() => setShowTotpSetupDialog(false)} />
  //     </div>
  //   );
  // }

  /* ----------------------------- UNLOCKED VIEW ----------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            {isClient ? "Your Social Media Logins" : "Social Media Logins"}
          </h2>
          <p className="text-sm text-gray-600">
            {isClient ? "Your social media credentials" : "Secure storage for client social media credentials"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"
            className="gap-2 text-green-600 border-green-300 bg-green-50 hover:bg-green-100 hover:text-green-700 pointer-events-none">
            <Unlock className="h-4 w-4" />Unlocked
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsUnlocked(false)} className="gap-2">
            <Lock className="h-4 w-4" />Lock
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => { setEditingLogin(null); setShowLoginDialog(true); }} className="gap-2">
              <Plus className="h-4 w-4" />Add Login
            </Button>
          )}
        </div>
      </div>

      {/* Session warning */}
      <Alert className="bg-amber-50 border-amber-200">
        <Clock className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-sm">
          Session will auto-lock after 5 minutes of inactivity. Your access is being logged.
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className={`grid grid-cols-1 gap-4 ${isClient ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search logins..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            {!isClient && (
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    <div className="flex items-center gap-2">{getPlatformIcon(p, "h-4 w-4")}{p}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logins grouped by client */}
      <div className="space-y-6">
        {Object.entries(loginsByClient).map(([clientId, { clientName, logins: clientLogins }]) => (
          <Card key={clientId}>
            <CardHeader className="pb-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-gray-400" />
                <span className="font-bold">{clientName}</span>
                <Badge variant="secondary" className="ml-2">
                  {clientLogins.length} Account{clientLogins.length !== 1 ? "s" : ""}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3 mt-3">
                {clientLogins.map((login) => (
                  <div key={login.id}
                    className="relative p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">

                    {/* Badges — top right */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 flex-wrap justify-end max-w-[50%]">
                      {login.adminOnly && !isClient && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                          Admin Only
                        </span>
                      )}
                      {isAdmin && !login.adminOnly && (login.allowedRoles?.length ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">
                          <Users className="h-2.5 w-2.5" />
                          {login.allowedRoles!.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")}
                        </span>
                      )}
                      {isAdmin && !login.adminOnly && (login.allowedUserIds?.length ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">
                          <User className="h-2.5 w-2.5" />
                          {login.allowedUserIds!.length} user{login.allowedUserIds!.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {/* Top row — icon + info */}
                    <div className="flex items-center gap-3 pr-32">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                        {getPlatformIcon(login.platform, "h-6 w-6")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900 truncate block">{login.platform}</span>
                        <p className="text-xs text-gray-500 truncate mt-0.5">@{login.username}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Updated {new Date(login.lastUpdated).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="mt-3 pl-0 sm:pl-[60px] space-y-1.5">
                      <PasswordField
                        password={login.password} loginId={login.id}
                        canView={canViewLogin(login)}
                        onView={logPasswordView} onCopy={logPasswordCopy}
                      />

                      {(login.email || login.phone) && (
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          {login.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3 flex-shrink-0" />{login.email}</span>}
                          {login.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 flex-shrink-0" />{login.phone}</span>}
                        </div>
                      )}

                      {login.notes && (
                        <p className="text-xs text-gray-500 flex items-start gap-1">
                          <FileNote className="h-3 w-3 flex-shrink-0 mt-0.5" />{login.notes}
                        </p>
                      )}

                      {login.passwordChangedAt && (
                        <p className={`text-xs ${
                          new Date().getTime() - new Date(login.passwordChangedAt).getTime() > 90 * 24 * 60 * 60 * 1000
                            ? "text-amber-600" : "text-gray-400"
                        }`} title={new Date(login.passwordChangedAt).toLocaleString()}>
                          Password changed: {formatTimeAgo(login.passwordChangedAt)}
                        </p>
                      )}

                      {login.backupCodesLocation && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Backup Codes:{" "}
                          {login.backupCodesLocation.startsWith("http") ? (
                            <a href={login.backupCodesLocation} target="_blank" rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-0.5">
                              Open Link <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ) : <span>{login.backupCodesLocation}</span>}
                        </p>
                      )}
                    </div>

                    {/* Bottom actions */}
                    {(login.loginUrl || canEdit) && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-1">
                        <div>
                          {login.loginUrl ? (
                            <Button size="sm" variant="ghost"
                              onClick={() => window.open(login.loginUrl, "_blank")}
                              className="text-blue-600 hover:text-blue-700 min-h-[44px] sm:min-h-0 gap-1.5">
                              <ExternalLink className="h-3.5 w-3.5" /><span className="text-xs">Login</span>
                            </Button>
                          ) : <span />}
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost"
                              onClick={() => { setEditingLogin(login); setShowLoginDialog(true); }}
                              className="text-gray-500 hover:text-gray-700 min-h-[44px] sm:min-h-0 gap-1.5">
                              <Edit className="h-3.5 w-3.5" /><span className="text-xs">Edit</span>
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => setDeleteConfirmLogin(login)}
                              className="text-red-500 hover:text-red-700 min-h-[44px] sm:min-h-0 gap-1.5">
                              <Trash2 className="h-3.5 w-3.5" /><span className="text-xs">Delete</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {Object.keys(loginsByClient).length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Key className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Login Credentials Found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || clientFilter !== "all" || platformFilter !== "all"
                  ? "No results match your filters"
                  : isClient
                    ? "No social media credentials have been added for your account yet"
                    : "Add your first social media login credentials"}
              </p>
              {canEdit && !searchTerm && clientFilter === "all" && platformFilter === "all" && (
                <Button onClick={() => { setEditingLogin(null); setShowLoginDialog(true); }} className="gap-2">
                  <Plus className="h-4 w-4" />Add Login
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <LoginFormDialog
        open={showLoginDialog} onOpenChange={setShowLoginDialog}
        login={editingLogin} clients={clients} onSave={handleSaveLogin}
        isClient={isClient} userClientId={userClientId}
        employees={employees} isAdmin={isAdmin}
      />

      <AlertDialog open={!!deleteConfirmLogin}
        onOpenChange={(o) => { if (!o) { setDeleteConfirmLogin(null); setDeletePassword(""); setDeletePasswordError(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Login Credentials?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleteConfirmLogin?.platform} credentials for{" "}
              {deleteConfirmLogin?.clientName}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm font-medium">Enter your password to confirm</Label>
            <Input type="password" placeholder="Your account password" value={deletePassword}
              onChange={(e) => { setDeletePassword(e.target.value); setDeletePasswordError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleDeleteLogin(); }} />
            {deletePasswordError && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{deletePasswordError}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLogin}>Cancel</AlertDialogCancel>
            <Button onClick={handleDeleteLogin} disabled={isDeletingLogin || !deletePassword.trim()}
              className="bg-red-600 hover:bg-red-700 text-white">
              {isDeletingLogin
                ? <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />Verifying...</>
                : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TotpVerificationDialog open={showTotpDialog} onVerify={handleTotpVerify} onCancel={() => setShowTotpDialog(false)} />
    </div>
  );
}