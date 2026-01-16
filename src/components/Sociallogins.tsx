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
  AlertDialogAction,
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
  AlertTriangle,
  RefreshCw,
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
import { toast } from "sonner";
import { useAuth } from "./auth/AuthContext";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type SocialPlatform =
  | "Instagram"
  | "Tiktok"
  | "Facebook"
  | "Youtube"
  | "Twitter"
  | "Linkedin"
  | "Snapchat";

interface SocialLogin {
  id: string;
  clientId: string;
  clientName: string;
  platform: SocialPlatform;
  username: string;
  password: string; // Will be encrypted in DB, decrypted on fetch
  email?: string;
  phone?: string;
  notes?: string;
  lastUpdated: string;
  updatedBy: string;
}

interface Client {
  id: string;
  name: string;
  companyName: string;
}

interface AuditLog {
  id: string;
  action: "view" | "create" | "update" | "delete" | "copy";
  loginId: string;
  platform: string;
  clientName: string;
  userId: string;
  userName: string;
  timestamp: string;
  ipAddress?: string;
}

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const PLATFORMS: SocialPlatform[] = [
  "Instagram",
  "Tiktok",
  "Facebook",
  "Youtube",
  "Twitter",
  "Linkedin",
  "Snapchat",
];

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity
const PIN_LENGTH = 6;

/* -------------------------------------------------------------------------- */
/* HELPER FUNCTIONS                                                           */
/* -------------------------------------------------------------------------- */

const getPlatformIcon = (platform: SocialPlatform, size = "h-5 w-5") => {
  const iconProps = { className: size };
  const icons: Record<SocialPlatform, React.ReactElement> = {
    Instagram: <FaInstagram {...iconProps} className={`${size} text-pink-500`} />,
    Tiktok: <FaTiktok {...iconProps} className={`${size} text-gray-900`} />,
    Facebook: <FaFacebook {...iconProps} className={`${size} text-blue-600`} />,
    Youtube: <FaYoutube {...iconProps} className={`${size} text-red-600`} />,
    Twitter: <FaTwitter {...iconProps} className={`${size} text-sky-500`} />,
    Linkedin: <FaLinkedin {...iconProps} className={`${size} text-blue-700`} />,
    Snapchat: <FaSnapchat {...iconProps} className={`${size} text-yellow-400`} />,
  };
  return icons[platform];
};

const getPlatformBgColor = (platform: SocialPlatform): string => {
  const colors: Record<SocialPlatform, string> = {
    Instagram: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400",
    Tiktok: "bg-gray-900",
    Facebook: "bg-blue-600",
    Youtube: "bg-red-600",
    Twitter: "bg-sky-500",
    Linkedin: "bg-blue-700",
    Snapchat: "bg-yellow-400",
  };
  return colors[platform];
};

/* -------------------------------------------------------------------------- */
/* PIN VERIFICATION DIALOG                                                    */
/* -------------------------------------------------------------------------- */

function PinVerificationDialog({
  open,
  onVerify,
  onCancel,
}: {
  open: boolean;
  onVerify: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (pin.length !== PIN_LENGTH) {
      setError(`PIN must be ${PIN_LENGTH} digits`);
      return;
    }
    onVerify(pin);
    setPin("");
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Security Verification Required
          </DialogTitle>
          <DialogDescription>
            Enter your {PIN_LENGTH}-digit security PIN to access sensitive login information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pin">Security PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setPin(value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="••••••"
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
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pin.length !== PIN_LENGTH}>
            <Unlock className="h-4 w-4 mr-2" />
            Verify & Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* SET PIN DIALOG (First time setup)                                          */
/* -------------------------------------------------------------------------- */

function SetPinDialog({
  open,
  onSetPin,
  onCancel,
}: {
  open: boolean;
  onSetPin: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (pin.length !== PIN_LENGTH) {
      setError(`PIN must be ${PIN_LENGTH} digits`);
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    onSetPin(pin);
    setPin("");
    setConfirmPin("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-600" />
            Set Security PIN
          </DialogTitle>
          <DialogDescription>
            Create a {PIN_LENGTH}-digit PIN to protect access to client login credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-pin">New PIN</Label>
            <Input
              id="new-pin"
              type="password"
              inputMode="numeric"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setPin(value);
                setError("");
              }}
              placeholder="••••••"
              className="text-center text-2xl tracking-[0.5em] font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-pin">Confirm PIN</Label>
            <Input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              maxLength={PIN_LENGTH}
              value={confirmPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setConfirmPin(value);
                setError("");
              }}
              placeholder="••••••"
              className="text-center text-2xl tracking-[0.5em] font-mono"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Remember this PIN! You'll need it every time you access login credentials.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH}>
            <Lock className="h-4 w-4 mr-2" />
            Set PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* PASSWORD FIELD WITH MASK/REVEAL                                            */
/* -------------------------------------------------------------------------- */

function PasswordField({
  password,
  loginId,
  canView,
  onView,
  onCopy,
}: {
  password: string;
  loginId: string;
  canView: boolean;
  onView: (loginId: string) => void;
  onCopy: (password: string, loginId: string) => void;
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReveal = () => {
    if (!isRevealed) {
      onView(loginId);
    }
    setIsRevealed(!isRevealed);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    onCopy(password, loginId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Password copied to clipboard");
  };

  // Auto-hide after 10 seconds
  useEffect(() => {
    if (isRevealed) {
      const timer = setTimeout(() => setIsRevealed(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [isRevealed]);

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 px-2 py-1 bg-gray-100 rounded text-sm font-mono">
        {isRevealed ? password : "••••••••••••"}
      </code>
      {canView && (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReveal}
            className="h-8 w-8 p-0"
            title={isRevealed ? "Hide password" : "Reveal password"}
          >
            {isRevealed ? (
              <EyeOff className="h-4 w-4 text-gray-500" />
            ) : (
              <Eye className="h-4 w-4 text-gray-500" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-8 w-8 p-0"
            title="Copy password"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-gray-500" />
            )}
          </Button>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ADD/EDIT LOGIN DIALOG                                                      */
/* -------------------------------------------------------------------------- */

function LoginFormDialog({
  open,
  onOpenChange,
  login,
  clients,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  login: SocialLogin | null;
  clients: Client[];
  onSave: (data: Partial<SocialLogin>) => void;
}) {
  const [formData, setFormData] = useState({
    clientId: "",
    platform: "Instagram" as SocialPlatform,
    username: "",
    password: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (login) {
      setFormData({
        clientId: login.clientId,
        platform: login.platform,
        username: login.username,
        password: login.password,
        email: login.email || "",
        phone: login.phone || "",
        notes: login.notes || "",
      });
    } else {
      setFormData({
        clientId: "",
        platform: "Instagram",
        username: "",
        password: "",
        email: "",
        phone: "",
        notes: "",
      });
    }
    setShowPassword(false);
  }, [login, open]);

  const handleSubmit = () => {
    if (!formData.clientId) {
      toast.error("Please select a client");
      return;
    }
    if (!formData.username) {
      toast.error("Username is required");
      return;
    }
    if (!formData.password) {
      toast.error("Password is required");
      return;
    }

    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {login ? "Edit Login Credentials" : "Add Login Credentials"}
          </DialogTitle>
          <DialogDescription>
            {login
              ? "Update the social media login information"
              : "Add new social media login credentials for a client"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select
                value={formData.clientId}
                onValueChange={(value) =>
                  setFormData({ ...formData, clientId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Platform *</Label>
              <Select
                value={formData.platform}
                onValueChange={(value) =>
                  setFormData({ ...formData, platform: value as SocialPlatform })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(platform, "h-4 w-4")}
                        {platform}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Username / Handle *</Label>
            <Input
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              placeholder="@username or email"
            />
          </div>

          <div className="space-y-2">
            <Label>Password *</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Enter password"
                className="pr-10"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Recovery Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="recovery@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Recovery Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="2FA enabled, backup codes in drive, etc."
            />
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This information will be encrypted and stored securely. Only authorized personnel can access it.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {login ? "Update Credentials" : "Save Credentials"}
          </Button>
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
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  // Security state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showSetPinDialog, setShowSetPinDialog] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Dialog state
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [editingLogin, setEditingLogin] = useState<SocialLogin | null>(null);
  const [deleteConfirmLogin, setDeleteConfirmLogin] = useState<SocialLogin | null>(null);

  // Loading state
  const [loading, setLoading] = useState(true);

  // Role checks
  const userRole = user?.role?.toLowerCase() || "";
  const canView = ["admin", "client", "scheduler"].includes(userRole);
  const canEdit = userRole === "admin";
  const isClient = userRole === "client";
  const userClientId = user?.clientId || null;

  /* ----------------------------- AUTO-LOCK --------------------------------- */

  // Reset activity timer on any interaction
  const resetActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  // Auto-lock after inactivity
  useEffect(() => {
    if (!isUnlocked) return;

    const checkInactivity = setInterval(() => {
      if (Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
        setIsUnlocked(false);
        toast.info("Session locked due to inactivity", {
          icon: <Lock className="h-4 w-4" />,
        });
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInactivity);
  }, [isUnlocked, lastActivity]);

  // Add activity listeners
  useEffect(() => {
    if (!isUnlocked) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetActivity));

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetActivity));
    };
  }, [isUnlocked, resetActivity]);

  /* ----------------------------- DATA LOADING ------------------------------ */

  useEffect(() => {
    async function loadData() {
      try {
        // Load clients
        const clientsRes = await fetch("/api/clients");
        const clientsData = await clientsRes.json();
        
        // If user is a client, only show their own client in the list
        const allClients = clientsData.clients || [];
        if (isClient && userClientId) {
          setClients(allClients.filter((c: Client) => c.id === userClientId));
        } else {
          setClients(allClients);
        }

        // Check if user has PIN set
        const pinRes = await fetch("/api/logins/check-pin");
        const pinData = await pinRes.json();
        setHasPin(pinData.hasPin);

        setLoading(false);
      } catch (err) {
        console.error("Failed to load data:", err);
        setLoading(false);
      }
    }

    if (canView) {
      loadData();
    }
  }, [canView, isClient, userClientId]);

  // Load logins only when unlocked
  useEffect(() => {
    async function loadLogins() {
      try {
        // For clients, fetch only their logins; for others, fetch all
        const url = isClient && userClientId 
          ? `/api/logins?clientId=${userClientId}`
          : "/api/logins";
        const res = await fetch(url);
        const data = await res.json();
        
        // Double-check filtering on client side for extra security
        let fetchedLogins = data.logins || [];
        if (isClient && userClientId) {
          fetchedLogins = fetchedLogins.filter(
            (login: SocialLogin) => login.clientId === userClientId
          );
        }
        
        setLogins(fetchedLogins);
      } catch (err) {
        console.error("Failed to load logins:", err);
      }
    }

    if (isUnlocked) {
      loadLogins();
    }
  }, [isUnlocked, isClient, userClientId]);

  /* ----------------------------- PIN HANDLERS ------------------------------ */

  const handleUnlockAttempt = () => {
    if (hasPin) {
      setShowPinDialog(true);
    } else {
      setShowSetPinDialog(true);
    }
  };

  const handlePinVerify = async (pin: string) => {
    try {
      const res = await fetch("/api/logins/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (data.valid) {
        setIsUnlocked(true);
        setShowPinDialog(false);
        setLastActivity(Date.now());
        toast.success("Access granted", {
          icon: <ShieldCheck className="h-4 w-4" />,
        });

        // Log access
        await fetch("/api/logins/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unlock" }),
        });
      } else {
        toast.error("Invalid PIN");
      }
    } catch (err) {
      toast.error("Verification failed");
    }
  };

  const handleSetPin = async (pin: string) => {
    try {
      const res = await fetch("/api/logins/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        setHasPin(true);
        setIsUnlocked(true);
        setShowSetPinDialog(false);
        setLastActivity(Date.now());
        toast.success("Security PIN set successfully");
      } else {
        toast.error("Failed to set PIN");
      }
    } catch (err) {
      toast.error("Failed to set PIN");
    }
  };

  /* ----------------------------- CRUD HANDLERS ----------------------------- */

  const handleSaveLogin = async (data: Partial<SocialLogin>) => {
    try {
      const url = editingLogin
        ? `/api/logins/${editingLogin.id}`
        : "/api/logins";
      const method = editingLogin ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.message || "Failed to save");
        return;
      }

      if (editingLogin) {
        setLogins((prev) =>
          prev.map((l) => (l.id === editingLogin.id ? result.login : l))
        );
        toast.success("Credentials updated");
      } else {
        setLogins((prev) => [...prev, result.login]);
        toast.success("Credentials added");
      }

      setEditingLogin(null);
      resetActivity();
    } catch (err) {
      toast.error("Server error");
    }
  };

  const handleDeleteLogin = async () => {
    if (!deleteConfirmLogin) return;

    try {
      const res = await fetch(`/api/logins/${deleteConfirmLogin.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setLogins((prev) => prev.filter((l) => l.id !== deleteConfirmLogin.id));
        toast.success("Credentials deleted");
      } else {
        toast.error("Failed to delete");
      }

      setDeleteConfirmLogin(null);
      resetActivity();
    } catch (err) {
      toast.error("Server error");
    }
  };

  /* ----------------------------- AUDIT LOGGING ----------------------------- */

  const logPasswordView = async (loginId: string) => {
    try {
      await fetch("/api/logins/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "view", loginId }),
      });
    } catch (err) {
      console.error("Failed to log view:", err);
    }
    resetActivity();
  };

  const logPasswordCopy = async (password: string, loginId: string) => {
    try {
      await fetch("/api/logins/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy", loginId }),
      });
    } catch (err) {
      console.error("Failed to log copy:", err);
    }
    resetActivity();
  };

  /* ----------------------------- FILTERING --------------------------------- */

  const filteredLogins = logins.filter((login) => {
    const matchesSearch =
      login.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      login.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      login.platform.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesClient =
      clientFilter === "all" || login.clientId === clientFilter;

    const matchesPlatform =
      platformFilter === "all" || login.platform === platformFilter;

    return matchesSearch && matchesClient && matchesPlatform;
  });

  // Group by client
  const loginsByClient = filteredLogins.reduce((acc, login) => {
    if (!acc[login.clientId]) {
      acc[login.clientId] = {
        clientName: login.clientName,
        logins: [],
      };
    }
    acc[login.clientId].logins.push(login);
    return acc;
  }, {} as Record<string, { clientName: string; logins: SocialLogin[] }>);

  /* ----------------------------- ACCESS CHECK ------------------------------ */

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-gray-600">
              You don't have permission to view this section. Only Admin, Client, and Scheduler roles can access login credentials.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ----------------------------- LOCKED VIEW ------------------------------- */

  if (!isUnlocked) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Social Media Logins</h2>
          <p className="text-sm text-gray-600">
            {isClient 
              ? "Access your social media credentials securely" 
              : "Secure storage for client social media credentials"}
          </p>
        </div>

        <div className="flex items-center justify-center h-[50vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Section Locked</h3>
              <p className="text-gray-600 mb-6">
                This section contains sensitive {isClient ? "account" : "client"} credentials.
                {hasPin
                  ? " Enter your security PIN to access."
                  : " Set up a security PIN to continue."}
              </p>
              <Button onClick={handleUnlockAttempt} size="lg" className="gap-2">
                <Key className="h-4 w-4" />
                {hasPin ? "Unlock with PIN" : "Set Up Security PIN"}
              </Button>

              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <ShieldCheck className="h-4 w-4" />
                  <span>All access is logged for security</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <PinVerificationDialog
          open={showPinDialog}
          onVerify={handlePinVerify}
          onCancel={() => setShowPinDialog(false)}
        />

        <SetPinDialog
          open={showSetPinDialog}
          onSetPin={handleSetPin}
          onCancel={() => setShowSetPinDialog(false)}
        />
      </div>
    );
  }

  /* ----------------------------- UNLOCKED VIEW ----------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">
              {isClient ? "Your Social Media Logins" : "Social Media Logins"}
            </h2>
            <Badge variant="outline" className="gap-1 text-green-600 border-green-300 bg-green-50">
              <Unlock className="h-3 w-3" />
              Unlocked
            </Badge>
          </div>
          <p className="text-sm text-gray-600">
            {isClient 
              ? "Your social media credentials" 
              : "Secure storage for client social media credentials"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsUnlocked(false)}
            className="gap-2"
          >
            <Lock className="h-4 w-4" />
            Lock
          </Button>

          {canEdit && (
            <Button
              onClick={() => {
                setEditingLogin(null);
                setShowLoginDialog(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Login
            </Button>
          )}
        </div>
      </div>

      {/* Session Timer Warning */}
      <Alert className="bg-amber-50 border-amber-200">
        <Clock className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-sm">
          Session will auto-lock after 5 minutes of inactivity. Your access is being logged.
        </AlertDescription>
      </Alert>

      {/* Filters - Hide client filter for client users since they only see their own */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className={`grid grid-cols-1 gap-4 ${isClient ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search logins..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Only show client filter for non-client users */}
            {!isClient && (
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {PLATFORMS.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    <div className="flex items-center gap-2">
                      {getPlatformIcon(platform, "h-4 w-4")}
                      {platform}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logins List - Grouped by Client */}
      <div className="space-y-6">
        {Object.entries(loginsByClient).map(([clientId, { clientName, logins }]) => (
          <Card key={clientId}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-gray-400" />
                {clientName}
                <Badge variant="secondary" className="ml-2">
                  {logins.length} account{logins.length !== 1 ? "s" : ""}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logins.map((login) => (
                  <div
                    key={login.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border"
                  >
                    {/* Platform Icon */}
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center text-white ${getPlatformBgColor(
                        login.platform
                      )}`}
                    >
                      {getPlatformIcon(login.platform, "h-6 w-6")}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {login.platform}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          @{login.username}
                        </Badge>
                      </div>

                      <PasswordField
                        password={login.password}
                        loginId={login.id}
                        canView={canView}
                        onView={logPasswordView}
                        onCopy={logPasswordCopy}
                      />

                      {(login.email || login.phone) && (
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          {login.email && <span>📧 {login.email}</span>}
                          {login.phone && <span>📱 {login.phone}</span>}
                        </div>
                      )}

                      {login.notes && (
                        <p className="text-xs text-gray-500 mt-1">
                          📝 {login.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions - Admin Only */}
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingLogin(login);
                            setShowLoginDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirmLogin(login)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* Last Updated */}
                    <div className="text-xs text-gray-400 text-right">
                      <div>Updated</div>
                      <div>{new Date(login.lastUpdated).toLocaleDateString()}</div>
                    </div>
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Login Credentials Found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || clientFilter !== "all" || platformFilter !== "all"
                  ? "No results match your filters"
                  : isClient 
                    ? "No social media credentials have been added for your account yet"
                    : "Add your first social media login credentials"}
              </p>
              {canEdit && !searchTerm && clientFilter === "all" && platformFilter === "all" && (
                <Button
                  onClick={() => {
                    setEditingLogin(null);
                    setShowLoginDialog(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Login
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <LoginFormDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        login={editingLogin}
        clients={clients}
        onSave={handleSaveLogin}
      />

      <AlertDialog
        open={!!deleteConfirmLogin}
        onOpenChange={(open) => !open && setDeleteConfirmLogin(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Login Credentials?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleteConfirmLogin?.platform} credentials for{" "}
              {deleteConfirmLogin?.clientName}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLogin}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PinVerificationDialog
        open={showPinDialog}
        onVerify={handlePinVerify}
        onCancel={() => setShowPinDialog(false)}
      />
    </div>
  );
}