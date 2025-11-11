"use client";

import { useState,useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Calendar,
  User,
  Building,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Upload,
  Download,
  Eye,
  Image,
  Palette,
  FileImage,
  FileX,
} from "lucide-react";
import { Separator } from "../ui/separator";
import { ImageWithFallback } from "../figma/ImageWithFallback";

interface BrandAsset {
  id: string;
  name: string;
  type:
    | "logo"
    | "color-palette"
    | "font"
    | "template"
    | "guideline"
    | "other";
  fileUrl: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  uploadedBy: string;
  description?: string;
}

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  accountManager: string;
  accountManagerId: string;
  startDate: string;
  renewalDate: string;
  status: "active" | "pending" | "expired";
  monthlyDeliverables: {
    longFormVideos: number;
    shortFormClips: number;
    socialPosts: number;
    customDeliverables: string;
  };
  currentProgress: {
    completed: number;
    total: number;
  };
  lastActivity: string;
  brandAssets: BrandAsset[];
  brandGuidelines: {
    primaryColors: string[];
    secondaryColors: string[];
    fonts: string[];
    logoUsage: string;
    toneOfVoice: string;
    brandValues: string;
    targetAudience: string;
    contentStyle: string;
  };
  projectSettings: {
    defaultVideoLength: string;
    preferredPlatforms: string[];
    contentApprovalRequired: boolean;
    quickTurnaroundAvailable: boolean;
  };
}

const mockBrandAssets: BrandAsset[] = [
  {
    id: "asset-001",
    name: "Primary Logo",
    type: "logo",
    fileUrl: "https://picsum.photos/800/600?random=1",
    fileName: "techstartup-logo-primary.svg",
    fileSize: "24 KB",
    uploadedAt: "2024-08-15",
    uploadedBy: "Alex Chen",
    description: "Main logo for all digital and print materials",
  },
  {
    id: "asset-002",
    name: "Brand Color Palette",
    type: "color-palette",
    fileUrl: "https://picsum.photos/800/400?random=2",
    fileName: "color-palette.png",
    fileSize: "156 KB",
    uploadedAt: "2024-08-15",
    uploadedBy: "Alex Chen",
    description: "Complete brand color system with hex codes",
  },
  {
    id: "asset-003",
    name: "Brand Guidelines PDF",
    type: "guideline",
    fileUrl: "https://picsum.photos/600/800?random=3",
    fileName: "brand-guidelines-v2.pdf",
    fileSize: "2.4 MB",
    uploadedAt: "2024-08-20",
    uploadedBy: "Sarah Wilson",
    description: "Complete brand guidelines document",
  },
];

const mockClients: Client[] = [
  {
    id: "client-001",
    name: "Sarah Johnson",
    company: "TechStartup Inc.",
    email: "sarah@techstartup.com",
    phone: "+1 (555) 123-4567",
    accountManager: "Alex Chen",
    accountManagerId: "mgr-001",
    startDate: "2024-01-15",
    renewalDate: "2025-01-15",
    status: "active",
    monthlyDeliverables: {
      longFormVideos: 4,
      shortFormClips: 8,
      socialPosts: 16,
      customDeliverables: "Monthly strategy consultation",
    },
    currentProgress: {
      completed: 22,
      total: 28,
    },
    lastActivity: "2024-08-29",
    brandAssets: mockBrandAssets,
    brandGuidelines: {
      primaryColors: ["#2563EB", "#1E40AF", "#3B82F6"],
      secondaryColors: ["#64748B", "#475569", "#94A3B8"],
      fonts: ["Inter", "Roboto", "Open Sans"],
      logoUsage: "Logo should maintain minimum clear space of 2x the height of the mark",
      toneOfVoice: "Professional, innovative, approachable",
      brandValues: "Innovation, reliability, customer-centric",
      targetAudience: "Tech professionals, startup founders, developers",
      contentStyle: "Clean, modern, data-driven with human touch",
    },
    projectSettings: {
      defaultVideoLength: "60-90 seconds",
      preferredPlatforms: ["LinkedIn", "Twitter", "YouTube"],
      contentApprovalRequired: true,
      quickTurnaroundAvailable: false,
    },
  },
  {
    id: "client-002",
    name: "Michael Rodriguez",
    company: "EcoFriendly Solutions",
    email: "michael@ecofriendly.com",
    phone: "+1 (555) 987-6543",
    accountManager: "Sarah Wilson",
    accountManagerId: "mgr-002",
    startDate: "2024-03-01",
    renewalDate: "2025-03-01",
    status: "active",
    monthlyDeliverables: {
      longFormVideos: 2,
      shortFormClips: 6,
      socialPosts: 12,
      customDeliverables: "Quarterly brand guideline updates",
    },
    currentProgress: {
      completed: 18,
      total: 20,
    },
    lastActivity: "2024-08-30",
    brandAssets: [],
    brandGuidelines: {
      primaryColors: ["#059669", "#047857", "#10B981"],
      secondaryColors: ["#6B7280", "#9CA3AF", "#D1D5DB"],
      fonts: ["Poppins", "Lato"],
      logoUsage: "Always use on light backgrounds, minimum size 24px",
      toneOfVoice: "Caring, sustainable, educational",
      brandValues: "Environmental responsibility, transparency, community",
      targetAudience: "Environmentally conscious consumers, families",
      contentStyle: "Natural, authentic, educational with emotional connection",
    },
    projectSettings: {
      defaultVideoLength: "30-60 seconds",
      preferredPlatforms: ["Instagram", "Facebook", "TikTok"],
      contentApprovalRequired: false,
      quickTurnaroundAvailable: true,
    },
  },
  {
    id: "client-003",
    name: "Emily Davis",
    company: "Fashion Forward",
    email: "emily@fashionforward.com",
    phone: "+1 (555) 456-7890",
    accountManager: "David Park",
    accountManagerId: "mgr-003",
    startDate: "2024-02-10",
    renewalDate: "2024-11-10",
    status: "pending",
    monthlyDeliverables: {
      longFormVideos: 6,
      shortFormClips: 12,
      socialPosts: 24,
      customDeliverables: "Weekly trend reports, influencer collaboration content",
    },
    currentProgress: {
      completed: 35,
      total: 42,
    },
    lastActivity: "2024-08-28",
    brandAssets: [],
    brandGuidelines: {
      primaryColors: ["#EC4899", "#DB2777", "#F472B6"],
      secondaryColors: ["#1F2937", "#374151", "#6B7280"],
      fonts: ["Montserrat", "Playfair Display"],
      logoUsage: "Versatile logo system for various applications",
      toneOfVoice: "Trendy, confident, inspiring",
      brandValues: "Style, individuality, empowerment",
      targetAudience: "Fashion-forward individuals, 18-35 years old",
      contentStyle: "Bold, vibrant, trend-focused with aspirational messaging",
    },
    projectSettings: {
      defaultVideoLength: "15-30 seconds",
      preferredPlatforms: ["Instagram", "TikTok", "Pinterest"],
      contentApprovalRequired: true,
      quickTurnaroundAvailable: true,
    },
  },
];

const mockAccountManagers = [
  { id: "mgr-001", name: "Alex Chen" },
  { id: "mgr-002", name: "Sarah Wilson" },
  { id: "mgr-003", name: "David Park" },
  { id: "mgr-004", name: "Lisa Rodriguez" },
  { id: "mgr-005", name: "James Kim" },
];

function ClientOnboardingDialog(props: { onClientCreated: (client: Client) => void }) {
  const { onClientCreated } = props;
  const [showAddDialog, setShowAddDialog] = useState(false);
 const [newClient, setNewClient] = useState({
  name: "",
  company: "",
  email: "",
  phone: "",
  monthlyDeliverables: {
    longFormVideos: 0,
    shortFormClips: 0,
    socialPosts: 0,
    customDeliverables: "",
  },
});

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

// const handleSaveClient = async () => {
//   setLoading(true);
//   setMessage("");

//   try {
//     const res = await fetch("/api/clients", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         name: newClient.name,
//         companyName: newClient.company,
//         email: newClient.email,
//         phone: newClient.phone,
//         longFormVideos: newClient.monthlyDeliverables.longFormVideos,
//         shortFormClips: newClient.monthlyDeliverables.shortFormClips,
//         socialPosts: newClient.monthlyDeliverables.socialPosts,
//         customDeliverables: newClient.monthlyDeliverables.customDeliverables,
//       }),
//     });

//     const data = await res.json();

//     if (!res.ok) {
//       throw new Error(data.message || "Failed to create client");
//     }

//     setMessage("✅ Client created successfully!");
//     setShowAddDialog(false);

//     // 🔥 Add this to notify parent
//     onClientCreated(data.client);

//     // Reset form
//     setNewClient({
//       name: "",
//       company: "",
//       email: "",
//       phone: "",
//       monthlyDeliverables: {
//         longFormVideos: 0,
//         shortFormClips: 0,
//         socialPosts: 0,
//         customDeliverables: "",
//       },
//     });
//   } catch (err: any) {
//     setMessage(`❌ ${err.message}`);
//   } finally {
//     setLoading(false);
//   }
// };

const handleSaveClient = async () => {
  setLoading(true);
  setMessage("");

  try {
    // ✅ Safely destructure deliverables (avoid undefined errors)
    const deliverables = newClient?.monthlyDeliverables ?? {
      longFormVideos: 0,
      shortFormClips: 0,
      socialPosts: 0,
      customDeliverables: "",
    };

    const payload = {
      name: newClient?.name?.trim() || "",
      companyName: newClient?.company?.trim() || "",
      email: newClient?.email?.trim() || "",
      phone: newClient?.phone?.trim() || "",
      longFormVideos: Number(deliverables.longFormVideos) || 0,
      shortFormClips: Number(deliverables.shortFormClips) || 0,
      socialPosts: Number(deliverables.socialPosts) || 0,
      customDeliverables: deliverables.customDeliverables?.trim() || "",
    };

    // ✅ Validate required fields before hitting API
    if (!payload.name || !payload.email) {
      throw new Error("Client name and email are required.");
    }

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // keep session cookies if applicable
      body: JSON.stringify(payload),
    });

    // ✅ Parse safely
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      console.error("⚠ Invalid JSON from /api/clients:", text);
    }

    // ✅ Handle server errors
    if (!res.ok) {
      const message = data?.message || `Request failed (${res.status})`;
      throw new Error(message);
    }

    // ✅ Add to list and reset form
    if (data?.client) onClientCreated?.(data.client);

    setMessage("✅ Client created successfully!");
    setShowAddDialog(false);
    setNewClient({
      name: "",
      company: "",
      email: "",
      phone: "",
      monthlyDeliverables: {
        longFormVideos: 0,
        shortFormClips: 0,
        socialPosts: 0,
        customDeliverables: "",
      },
    });
  } catch (err: any) {
    console.error("❌ Create client error:", err);
    setMessage(`❌ ${err.message || "Something went wrong."}`);
  } finally {
    setLoading(false);
  }
};


  return (
    <div>
  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
    <DialogTrigger asChild>
      <Button variant="default" className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Add New Client
      </Button>
    </DialogTrigger>

    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

      <VisuallyHidden>
    <DialogTitle>Add Client</DialogTitle>
  </VisuallyHidden>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSaveClient();
        }}
        className="space-y-6"
      >
        {/* Client Information */}
        <div className="space-y-4">
          <h4 className="font-medium">Client Information</h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={newClient.name || ""}
                onChange={(e) =>
                  setNewClient((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter client name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={newClient.company || ""}
                onChange={(e) =>
                  setNewClient((prev) => ({ ...prev, company: e.target.value }))
                }
                placeholder="Enter company name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newClient.email || ""}
                onChange={(e) =>
                  setNewClient((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="client@company.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newClient.phone || ""}
                onChange={(e) =>
                  setNewClient((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Monthly Deliverables */}
        <div className="space-y-4">
          <h4 className="font-medium">Monthly Deliverables</h4>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="longForm">Long-form Videos</Label>
              <Input
                id="longForm"
                type="number"
                min={0}
                value={newClient.monthlyDeliverables?.longFormVideos ?? 0}
                onChange={(e) =>
                  setNewClient((prev) => ({
                    ...prev,
                    monthlyDeliverables: {
                      ...prev.monthlyDeliverables,
                      longFormVideos: parseInt(e.target.value) || 0,
                    },
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shortForm">Short-form Clips</Label>
              <Input
                id="shortForm"
                type="number"
                min={0}
                value={newClient.monthlyDeliverables?.shortFormClips ?? 0}
                onChange={(e) =>
                  setNewClient((prev) => ({
                    ...prev,
                    monthlyDeliverables: {
                      ...prev.monthlyDeliverables,
                      shortFormClips: parseInt(e.target.value) || 0,
                    },
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="socialPosts">Social Posts</Label>
              <Input
                id="socialPosts"
                type="number"
                min={0}
                value={newClient.monthlyDeliverables?.socialPosts ?? 0}
                onChange={(e) =>
                  setNewClient((prev) => ({
                    ...prev,
                    monthlyDeliverables: {
                      ...prev.monthlyDeliverables,
                      socialPosts: parseInt(e.target.value) || 0,
                    },
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customDeliverables">Custom Deliverables</Label>
            <Textarea
              id="customDeliverables"
              rows={3}
              value={newClient.monthlyDeliverables?.customDeliverables ?? ""}
              onChange={(e) =>
                setNewClient((prev) => ({
                  ...prev,
                  monthlyDeliverables: {
                    ...prev.monthlyDeliverables,
                    customDeliverables: e.target.value,
                  },
                }))
              }
              placeholder="Additional custom deliverables, consultations, etc."
            />
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAddDialog(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading} onClick={handleSaveClient}>
            {loading ? "Saving..." : "Add Client"}
          </Button>
        </DialogFooter>

        {message && (
          <p className="mt-2 text-sm text-gray-700" role="alert">
            {message}
          </p>
        )}
      </form>
    </DialogContent>
  </Dialog>
</div>

  );
}

export function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/clients");
      const data = await res.json();
      if (res.ok) setClients(data.clients);
    })();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDetailsDialog, setShowClientDetailsDialog] = useState(false);
  const [newClient, setNewClient] = useState<Partial<Client>>({
    name: "",
    company: "",
    email: "",
    phone: "",
    accountManagerId: "",
    startDate: "",
    renewalDate: "",
    status: "active",
    monthlyDeliverables: {
      longFormVideos: 0,
      shortFormClips: 0,
      socialPosts: 0,
      customDeliverables: "",
    },
    brandAssets: [],
    brandGuidelines: {
      primaryColors: [],
      secondaryColors: [],
      fonts: [],
      logoUsage: "",
      toneOfVoice: "",
      brandValues: "",
      targetAudience: "",
      contentStyle: "",
    },
    projectSettings: {
      defaultVideoLength: "60 seconds",
      preferredPlatforms: [],
      contentApprovalRequired: true,
      quickTurnaroundAvailable: false,
    },
  });

  // Filtering clients based on search and filters
  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    const matchesManager = managerFilter === "all" || client.accountManagerId === managerFilter;
    return matchesSearch && matchesStatus && matchesManager;
  });

  // Icons for status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "expired":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Badge variant for status
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "pending":
        return "secondary";
      case "expired":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Percentage progress
  const getProgressPercentage = (completed: number, total: number) => {
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  };

  // Icon for asset type
  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case "logo":
        return <Image className="h-4 w-4" />;
      case "color-palette":
        return <Palette className="h-4 w-4" />;
      case "font":
        return <FileText className="h-4 w-4" />;
      case "template":
        return <FileImage className="h-4 w-4" />;
      case "guideline":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Add new client to state after successful onboarding
  // const onClientCreated = (client: Client) => {
  //   setClients((prev) => [...prev, client]);
  // };

  const onClientCreated = (client: Client) => {
  setClients((prev) => [client, ...prev]);
};


  // Edit existing client
  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setNewClient({
      name: client.name,
      company: client.company,
      email: client.email,
      phone: client.phone,
      accountManagerId: client.accountManagerId,
      startDate: client.startDate,
      renewalDate: client.renewalDate,
      status: client.status,
      monthlyDeliverables: client.monthlyDeliverables,
      brandGuidelines: client.brandGuidelines,
      projectSettings: client.projectSettings,
    });
    setShowAddDialog(true);
  };

  // Delete client
  const handleDeleteClient = (clientId: string) => {
    if (confirm("Are you sure you want to delete this client?")) {
      setClients((prev) => prev.filter((client) => client.id !== clientId));
    }
  };

  // View client details
  const handleViewClientDetails = (client: Client) => {
    setSelectedClient(client);
    setShowClientDetailsDialog(true);
  };

  // File upload handler (mock)
  const handleFileUpload = (clientId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const mockAssets: BrandAsset[] = Array.from(files).map((file, index) => ({
      id: `asset-${Date.now()}-${index}`,
      name: file.name.split(".")[0],
      type: file.type.includes("image") ? "logo" : "other",
      fileUrl: URL.createObjectURL(file),
      fileName: file.name,
      fileSize: `${Math.round(file.size / 1024)} KB`,
      uploadedAt: new Date().toISOString().split("T")[0],
      uploadedBy: "Current User",
    }));

    setClients((prev) =>
      prev.map((client) =>
        client.id === clientId
          ? {
              ...client,
              brandAssets: [...client.brandAssets, ...mockAssets],
            }
          : client,
      ),
    );
  };

  // Client Details Dialog
  const ClientDetailsDialog = () => {
    if (!selectedClient) return null;
    return (
      <Dialog open={showClientDetailsDialog} onOpenChange={setShowClientDetailsDialog}>
        <DialogContent
          className="max-w-6xl max-h-[90vh] overflow-hidden"
          aria-describedby="client-details-description"
        >
          <DialogHeader>
            <DialogTitle id="client-details-title" className="flex items-center gap-3">
              <Building className="h-6 w-6" />
              {selectedClient.company} - Brand Assets & Guidelines
            </DialogTitle>
            <DialogDescription id="client-details-description">
              Manage brand assets, guidelines, and project settings for {selectedClient.name}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="assets" className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="assets">Brand Assets</TabsTrigger>
              <TabsTrigger value="guidelines">Brand Guidelines</TabsTrigger>
              <TabsTrigger value="settings">Project Settings</TabsTrigger>
            </TabsList>

            <div className="mt-6 overflow-y-auto max-h-[60vh]">
              <TabsContent value="assets" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">
                    Brand Assets ({selectedClient.brandAssets.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.svg"
                      onChange={(e) => handleFileUpload(selectedClient.id, e.target.files)}
                      className="hidden"
                      id="asset-upload"
                    />
                    <label htmlFor="asset-upload">
                      <Button asChild size="sm">
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Assets
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                {selectedClient.brandAssets.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedClient.brandAssets.map((asset) => (
                      <Card key={asset.id}>
                        <CardContent className="p-4">
                          <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden">
                            <ImageWithFallback
                              src={asset.fileUrl}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {getAssetTypeIcon(asset.type)}
                              <h5 className="font-medium text-sm truncate">{asset.name}</h5>
                            </div>

                            <p className="text-xs text-muted-foreground">{asset.fileName}</p>

                            {asset.description && (
                              <p className="text-xs text-muted-foreground">{asset.description}</p>
                            )}

                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{asset.fileSize}</span>
                              <span>{new Date(asset.uploadedAt).toLocaleDateString()}</span>
                            </div>

                            <div className="flex items-center gap-1 pt-2">
                              <Button variant="outline" size="sm" className="flex-1">
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1">
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <FileX className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="mb-2">No brand assets uploaded</h3>
                    <p className="text-muted-foreground mb-4">
                      Upload logos, brand guidelines, templates, and other assets
                    </p>
                    <label htmlFor="asset-upload-empty">
                      <Button asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload First Asset
                        </span>
                      </Button>
                    </label>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.svg"
                      onChange={(e) => handleFileUpload(selectedClient.id, e.target.files)}
                      className="hidden"
                      id="asset-upload-empty"
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="guidelines" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Brand Colors */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Brand Colors
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Primary Colors</Label>
                        <div className="flex gap-2 mt-2">
                          {selectedClient.brandGuidelines.primaryColors.map((color, index) => (
                            <div key={index} className="flex flex-col items-center">
                              <div
                                className="w-8 h-8 rounded border border-border"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-xs mt-1">{color}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Secondary Colors</Label>
                        <div className="flex gap-2 mt-2">
                          {selectedClient.brandGuidelines.secondaryColors.map((color, index) => (
                            <div key={index} className="flex flex-col items-center">
                              <div
                                className="w-8 h-8 rounded border border-border"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-xs mt-1">{color}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Typography */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Typography</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Label className="text-sm font-medium">Brand Fonts</Label>
                      <div className="mt-2 space-y-2">
                        {selectedClient.brandGuidelines.fonts.map((font, index) => (
                          <div key={index} className="p-2 bg-muted rounded text-sm">
                            {font}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Logo Usage */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Logo Usage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {selectedClient.brandGuidelines.logoUsage || "No logo usage guidelines specified"}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Brand Voice & Values */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Brand Voice & Values</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Tone of Voice</Label>
                        <p className="text-sm text-muted-foreground mt-1">{selectedClient.brandGuidelines.toneOfVoice}</p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Brand Values</Label>
                        <p className="text-sm text-muted-foreground mt-1">{selectedClient.brandGuidelines.brandValues}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Target Audience */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Target Audience</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{selectedClient.brandGuidelines.targetAudience}</p>
                    </CardContent>
                  </Card>

                  {/* Content Style */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Content Style</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{selectedClient.brandGuidelines.contentStyle}</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Content Preferences</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Default Video Length</Label>
                        <p className="text-sm text-muted-foreground mt-1">{selectedClient.projectSettings.defaultVideoLength}</p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Preferred Platforms</Label>
                        <div className="flex gap-1 mt-2">
                          {selectedClient.projectSettings.preferredPlatforms.map((platform, index) => (
                            <Badge key={index} variant="secondary">
                              {platform}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Workflow Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Client Approval Required</Label>
                        <Badge variant={selectedClient.projectSettings.contentApprovalRequired ? "default" : "secondary"}>
                          {selectedClient.projectSettings.contentApprovalRequired ? "Yes" : "No"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Quick Turnaround Available</Label>
                        <Badge variant={selectedClient.projectSettings.quickTurnaroundAvailable ? "default" : "secondary"}>
                          {selectedClient.projectSettings.quickTurnaroundAvailable ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter>
            <Button onClick={() => setShowClientDetailsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Add New Client */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2>Client Management</h2>
          <p className="text-muted-foreground mt-1">
            Manage client accounts, brand assets, guidelines, and team assignments
          </p>
        </div>

        {/* Client Onboarding Dialog for adding clients */}
        <ClientOnboardingDialog onClientCreated={onClientCreated} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            <Select value={managerFilter} onValueChange={setManagerFilter}>
              <SelectTrigger className="w-48">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Managers</SelectItem>
                {mockAccountManagers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Clients List */}
      <div className="grid gap-4">
        {filteredClients.map((client) => (
          <Card key={client.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{client.name}</h3>
                    <p className="text-sm text-muted-foreground">{client.company}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(client.status)} className="flex items-center gap-1">
                    {getStatusIcon(client.status)}
                    {/* {client?.status?.charAt(0).toUpperCase() + client.status.slice(1)}x */}
                  </Badge>

                  <Button variant="ghost" size="sm" onClick={() => handleViewClientDetails(client)}>
                    <Eye className="h-4 w-4" />
                  </Button>

                  <Button variant="ghost" size="sm" onClick={() => handleEditClient(client)}>
                    <Edit className="h-4 w-4" />
                  </Button>

                  <Button variant="ghost" size="sm" onClick={() => handleDeleteClient(client.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Account Info */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Account Manager</h4>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {client.accountManager}
                  </p>

                  <h4 className="font-medium text-sm mt-3">Contract Period</h4>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(client.startDate).toLocaleDateString()} - {new Date(client.renewalDate).toLocaleDateString()}
                  </p>
                </div>

                {/* Deliverables */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Monthly Deliverables</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {/* <p>• {client.monthlyDeliverables.longFormVideos} Long-form videos</p> */}
                    <p>• {client.monthlyDeliverables.longFormVideos} Long-form videos</p>
                    <p>• {client.monthlyDeliverables.shortFormClips} Short-form clips</p>
                    <p>• {client.monthlyDeliverables.socialPosts} Social posts</p>
                    {client.monthlyDeliverables.customDeliverables && (
                      <p>• {client.monthlyDeliverables.customDeliverables}</p>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">This Month's Progress</h4>
                  <div className="space-y-2">
                    {/* <div className="flex items-center justify-between text-sm">
                      <span>
                        {client.currentProgress.completed} / {client.currentProgress.total} completed
                      </span>
                      <span className="font-medium">
                        {getProgressPercentage(client.currentProgress.completed, client.currentProgress.total)}%
                      </span>
                    </div> */}
                    {/* <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${getProgressPercentage(client.currentProgress.completed, client.currentProgress.total)}%` }}
                      />
                    </div> */}
                    <p className="text-xs text-muted-foreground">Last activity: {new Date(client.lastActivity).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Brand Assets */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Brand Assets</h4>
                  <div className="space-y-2">
                    {/* <p className="text-sm text-muted-foreground">{client.brandAssets.length} assets uploaded</p> */}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleViewClientDetails(client)}>
                      <Eye className="h-3 w-3 mr-1" />
                      View Assets
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="mb-2">No clients found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all" || managerFilter !== "all"
                ? "Try adjusting your filters or search terms"
                : "Get started by adding your first client"}
            </p>
          </CardContent>
        </Card>
      )}

      <ClientDetailsDialog />
    </div>
  );
}
