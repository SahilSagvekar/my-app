"use client";

import { useState, useEffect, useRef  } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
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
  X,
  Video,
  Zap,
  Share2,
  Repeat,
  DollarSign,
  CreditCard,
} from "lucide-react";
import { Separator } from "../ui/separator";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { VisuallyHidden } from "../ui/visually-hidden";
import { Checkbox } from "../ui/checkbox";
import { toast } from "sonner";
import { globalTaskManager } from "../workflow/GlobalTaskManager";

type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "twitter"
  | "linkedin";

type DeliverableType =
  | "Short Form Videos"
  | "Long Form Videos"
  | "Square Form Videos"
  | "Snapchat Show Episode"
  | "Social/Hard Post";

type PostingSchedule = "weekly" | "bi-weekly" | "monthly" | "custom";

interface MonthlyDeliverable {
  id: string;
  type: DeliverableType;
  quantity: number; // how many per month
  videosPerDay?: number; // how many videos per posting day (e.g., 2 videos every Tuesday)
  platforms: SocialPlatform[];
  postingSchedule: PostingSchedule;
  postingDays?: string[]; // e.g., ["Monday", "Wednesday"] or ["1st", "15th"]
  postingTimes: string[]; // e.g., ["10:00", "11:00", "14:00"] - one for each video per day
  description?: string;
}

interface BrandAsset {
  id: string;
  name: string;
  type: "logo" | "color-palette" | "font" | "template" | "guideline" | "other";
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
  companyName: string;
  email: string;
  phone: string;
  accountManager: string;
  accountManagerId: string;
  startDate: string;
  renewalDate: string;
  status: "active" | "pending" | "expired";
  monthlyDeliverables: MonthlyDeliverable[];
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
  billing?: {
    monthlyFee: string;
    billingFrequency: "monthly" | "quarterly" | "annually";
    billingDay: number; // 1-31
    paymentMethod: "credit-card" | "bank-transfer" | "check" | "paypal";
    nextBillingDate: string;
    notes?: string;
  };
  postingSchedule?: {
    instagram?: {
      weekdays: string;
      weekends: string;
      bestTimes: string;
    };
    tiktok?: {
      weekdays: string;
      weekends: string;
      bestTimes: string;
    };
    youtube?: {
      weekdays: string;
      weekends: string;
      bestTimes: string;
    };
    facebook?: {
      weekdays: string;
      weekends: string;
      bestTimes: string;
    };
    twitter?: {
      weekdays: string;
      weekends: string;
      bestTimes: string;
    };
    linkedin?: {
      weekdays: string;
      weekends: string;
      bestTimes: string;
    };
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
    companyName: "TechStartup Inc.",
    email: "sarah@techstartup.com",
    phone: "+1 (555) 123-4567",
    accountManager: "Alex Chen",
    accountManagerId: "mgr-001",
    startDate: "2024-01-15",
    renewalDate: "2025-01-15",
    status: "active",
    monthlyDeliverables: [
      {
        id: "del-001",
        type: "Long Form Videos",
        quantity: 4,
        videosPerDay: 1,
        platforms: ["youtube", "linkedin"],
        postingSchedule: "weekly",
        postingDays: ["Monday"],
        postingTimes: ["10:00"],
        description: "Weekly thought leadership content",
      },
      {
        id: "del-002",
        type: "Short Form Videos",
        quantity: 8,
        videosPerDay: 2,
        platforms: ["instagram", "tiktok"],
        postingSchedule: "bi-weekly",
        postingDays: ["Tuesday", "Thursday"],
        postingTimes: ["14:00", "16:00"],
        description: "Bi-weekly tips and quick insights",
      },
    ],
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
      logoUsage:
        "Logo should maintain minimum clear space of 2x the height of the mark",
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
    postingSchedule: {
      instagram: {
        weekdays: "10am-12pm, 6-8pm",
        weekends: "11am-1pm",
        bestTimes: "Tue-Thu 6-8pm",
      },
      tiktok: {
        weekdays: "7-9am, 8-10pm",
        weekends: "10am-12pm",
        bestTimes: "Wed-Fri 8-9pm",
      },
      youtube: {
        weekdays: "3-5pm",
        weekends: "10am-12pm",
        bestTimes: "Thu-Fri 3-4pm",
      },
      linkedin: {
        weekdays: "8-10am, 12-2pm",
        weekends: "N/A - B2B audience",
        bestTimes: "Tue-Wed 8-9am",
      },
      twitter: {
        weekdays: "9am-12pm, 5-7pm",
        weekends: "11am-1pm",
        bestTimes: "Weekdays 9-10am",
      },
      facebook: {
        weekdays: "1-3pm, 7-9pm",
        weekends: "12-2pm",
        bestTimes: "Wed-Thu 1-2pm",
      },
    },
  },
  {
    id: "client-002",
    name: "Michael Rodriguez",
    companyName: "EcoFriendly Solutions",
    email: "michael@ecofriendly.com",
    phone: "+1 (555) 987-6543",
    accountManager: "Sarah Wilson",
    accountManagerId: "mgr-002",
    startDate: "2024-03-01",
    renewalDate: "2025-03-01",
    status: "active",
    monthlyDeliverables: [
      {
        id: "del-003",
        type: "Long Form Videos",
        quantity: 2,
        videosPerDay: 1,
        platforms: ["youtube", "facebook"],
        postingSchedule: "bi-weekly",
        postingDays: ["1st", "15th"],
        postingTimes: ["12:00"],
        description: "Bi-monthly educational content",
      },
      {
        id: "del-004",
        type: "Social/Hard Post",
        quantity: 12,
        videosPerDay: 1,
        platforms: ["instagram", "facebook"],
        postingSchedule: "custom",
        postingDays: ["Monday", "Wednesday", "Friday"],
        postingTimes: ["09:00"],
        description: "Regular social media posts",
      },
    ],
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
    postingSchedule: {
      instagram: {
        weekdays: "11am-1pm, 5-7pm",
        weekends: "10am-2pm",
        bestTimes: "Daily 11am-12pm",
      },
      facebook: {
        weekdays: "12-2pm, 6-8pm",
        weekends: "11am-3pm",
        bestTimes: "Weekdays 12-1pm",
      },
      tiktok: {
        weekdays: "6-9am, 7-10pm",
        weekends: "9am-12pm",
        bestTimes: "Daily 7-9pm",
      },
    },
  },
  {
    id: "client-003",
    name: "Emily Davis",
    companyName: "Fashion Forward",
    email: "emily@fashionforward.com",
    phone: "+1 (555) 456-7890",
    accountManager: "David Park",
    accountManagerId: "mgr-003",
    startDate: "2024-02-10",
    renewalDate: "2024-11-10",
    status: "pending",
    monthlyDeliverables: [
      {
        id: "del-005",
        type: "Short Form Videos",
        quantity: 12,
        videosPerDay: 3,
        platforms: ["instagram", "tiktok"],
        postingSchedule: "custom",
        postingDays: ["Monday", "Wednesday", "Friday", "Sunday"],
        postingTimes: ["10:00", "14:00", "18:00"],
        description: "Fashion tips and trends",
      },
      {
        id: "del-006",
        type: "Long Form Videos",
        quantity: 6,
        videosPerDay: 1,
        platforms: ["youtube", "instagram"],
        postingSchedule: "weekly",
        postingDays: ["Friday"],
        postingTimes: ["15:00"],
        description: "Weekly lookbook and styling guides",
      },
    ],
    currentProgress: {
      completed: 35,
      total: 42,
    },
    lastActivity: "2024-08-28",
    brandAssets: [],
    brandGuidelines: {
      primaryColors: ["#EC4899", "#DB2777", "##F472B6"],
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
    postingSchedule: {
      instagram: {
        weekdays: "9am-11am, 6-9pm",
        weekends: "11am-4pm",
        bestTimes: "Daily 6-7pm",
      },
      tiktok: {
        weekdays: "7-10am, 8-11pm",
        weekends: "10am-2pm",
        bestTimes: "Daily 8-10pm",
      },
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

export function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDetailsDialog, setShowClientDetailsDialog] = useState(false);
  const [uploadFolder, setUploadFolder] = useState("elements");
  const fileInputRef = useRef<HTMLInputElement | null>(null); 

  const [newClient, setNewClient] = useState<Partial<Client>>({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    accountManagerId: "",
    startDate: "",
    renewalDate: "",
    status: "active",
    monthlyDeliverables: [],
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

  const [newDeliverable, setNewDeliverable] = useState<
    Partial<MonthlyDeliverable>
  >({
    type: "Short Form Videos",
    quantity: 1,
    videosPerDay: 1,
    platforms: [],
    postingSchedule: "weekly",
    postingDays: [],
    postingTimes: ["10:00"],
    description: "",
  });

  const [showAddDeliverableDialog, setShowAddDeliverableDialog] =
    useState(false);

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || client.status === statusFilter;
    const matchesManager =
      managerFilter === "all" || client.accountManagerId === managerFilter;

    return matchesSearch && matchesStatus && matchesManager;
  });

  //   useEffect(() => {
  //   async function loadClients() {
  //     try {
  //       const res = await fetch("/api/clients");
  //       const data = await res.json();
  //       setClients(Array.isArray(data.clients) ? data.clients : []);
  //     } catch (err) {
  //       console.error("Failed to load clients", err);
  //     }
  //   }

  //   loadClients();
  // }, []);

  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();

        setClients(Array.isArray(data.clients) ? data.clients : []);
      } catch (err) {
        console.error("Failed to load clients", err);
        setClients([]);
      }
    }

    loadClients();
  }, []);

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

  const getProgressPercentage = (completed: number, total: number) => {
    return Math.round((completed / total) * 100);
  };

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

  const getPlatformBadgeColor = (platform: SocialPlatform): string => {
    const colors: Record<SocialPlatform, string> = {
      instagram: "bg-pink-100 text-pink-700 border-pink-300",
      tiktok: "bg-gray-900 text-white border-gray-700",
      facebook: "bg-blue-100 text-blue-700 border-blue-300",
      youtube: "bg-red-100 text-red-700 border-red-300",
      twitter: "bg-sky-100 text-sky-700 border-sky-300",
      linkedin: "bg-indigo-100 text-indigo-700 border-indigo-300",
    };
    return colors[platform] || "bg-gray-100 text-gray-700";
  };

  const getDeliverableTypeIcon = (type: string) => {
    switch (type) {
      case "Long Form Videos":
        return <Video className="h-4 w-4" />;
      case "Short Form Videos":
        return <Zap className="h-4 w-4" />;
      case "Square Form Videos":
        return <Video className="h-4 w-4" />;
      case "Snapchat Show Episode":
        return <Video className="h-4 w-4" />;
      case "Social/Hard Post":
        return <Share2 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const toggleDay = (day: string) => {
    const currentDays = newDeliverable.postingDays || [];
    if (currentDays.includes(day)) {
      setNewDeliverable({
        ...newDeliverable,
        postingDays: currentDays.filter((d) => d !== day),
      });
    } else {
      setNewDeliverable({
        ...newDeliverable,
        postingDays: [...currentDays, day],
      });
    }
  };

  const setEveryDay = () => {
    const allDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const currentDays = newDeliverable.postingDays || [];

    // If all days are selected, deselect all. Otherwise, select all.
    if (currentDays.length === 7) {
      setNewDeliverable({
        ...newDeliverable,
        postingDays: [],
      });
    } else {
      setNewDeliverable({
        ...newDeliverable,
        postingDays: allDays,
      });
    }
  };

  const updatePostingTime = (index: number, time: string) => {
    const currentTimes = newDeliverable.postingTimes || ["10:00"];
    const newTimes = [...currentTimes];
    newTimes[index] = time;
    setNewDeliverable({
      ...newDeliverable,
      postingTimes: newTimes,
    });
  };

  const syncPostingTimesWithVideosPerDay = (videosPerDay: number) => {
    const currentTimes = newDeliverable.postingTimes || ["10:00"];
    const newTimes = [...currentTimes];

    // If we need more times, add default ones
    while (newTimes.length < videosPerDay) {
      // Add times spaced 2 hours apart
      const lastTime = newTimes[newTimes.length - 1];
      const [hours, minutes] = lastTime.split(":").map(Number);
      const newHours = (hours + 2) % 24;
      newTimes.push(
        `${String(newHours).padStart(2, "0")}:${String(minutes).padStart(
          2,
          "0"
        )}`
      );
    }

    // If we have too many times, trim
    while (newTimes.length > videosPerDay) {
      newTimes.pop();
    }

    setNewDeliverable({
      ...newDeliverable,
      videosPerDay,
      postingTimes: newTimes,
    });
  };

  const handleAddDeliverable = () => {
    if (
      !newDeliverable.quantity ||
      !newDeliverable.platforms ||
      newDeliverable.platforms.length === 0
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    const deliverable: MonthlyDeliverable = {
      id: `deliverable-${Date.now()}`,
      type: newDeliverable.type as DeliverableType,
      quantity: newDeliverable.quantity,
      videosPerDay: newDeliverable.videosPerDay || 1,
      platforms: newDeliverable.platforms,
      postingSchedule: newDeliverable.postingSchedule as PostingSchedule,
      postingDays: newDeliverable.postingDays,
      postingTimes: newDeliverable.postingTimes || ["10:00"],
      description: newDeliverable.description || "",
    };

    setNewClient((prev) => ({
      ...prev,
      monthlyDeliverables: [...(prev.monthlyDeliverables || []), deliverable],
    }));

    // Reset form
    setNewDeliverable({
      type: "Short Form Videos",
      quantity: 1,
      videosPerDay: 1,
      platforms: [],
      postingSchedule: "weekly",
      postingDays: [],
      postingTimes: ["10:00"],
      description: "",
    });
    setShowAddDeliverableDialog(false);
    toast.success("Monthly deliverable added");
  };

  const handleRemoveDeliverable = (id: string) => {
    setNewClient((prev) => ({
      ...prev,
      monthlyDeliverables: (prev.monthlyDeliverables || []).filter(
        (d) => d.id !== id
      ),
    }));
    toast.success("Deliverable removed");
  };

  const togglePlatform = (platform: SocialPlatform) => {
    setNewDeliverable((prev) => {
      const platforms = prev.platforms || [];
      const isSelected = platforms.includes(platform);
      return {
        ...prev,
        platforms: isSelected
          ? platforms.filter((p) => p !== platform)
          : [...platforms, platform],
      };
    });
  };

  const generateMonthlyTasks = (
    clientId: string,
    clientName: string,
    deliverables: MonthlyDeliverable[]
  ) => {
    const taskManager = GlobalTaskManager.getInstance();
    let tasksCreated = 0;
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    deliverables.forEach((deliverable) => {
      const videosPerDay = deliverable.videosPerDay || 1;

      // For each deliverable, create tasks based on quantity
      // The quantity represents the total videos for the month
      // videosPerDay tells us how many videos go out on each posting day
      const totalPostingDays = Math.ceil(deliverable.quantity / videosPerDay);

      for (let dayIndex = 0; dayIndex < totalPostingDays; dayIndex++) {
        // Calculate due dates based on posting schedule
        let dueDate = new Date(currentYear, currentMonth, 1);

        if (deliverable.postingSchedule === "weekly") {
          // Space tasks weekly throughout the month
          dueDate.setDate(dueDate.getDate() + dayIndex * 7);
        } else if (deliverable.postingSchedule === "bi-weekly") {
          // Space tasks bi-weekly
          dueDate.setDate(dueDate.getDate() + dayIndex * 14);
        } else if (deliverable.postingSchedule === "monthly") {
          // All tasks due at beginning of month
          dueDate.setDate(dueDate.getDate() + dayIndex);
        } else {
          // Custom - distribute evenly
          const daysInMonth = new Date(
            currentYear,
            currentMonth + 1,
            0
          ).getDate();
          const spacing = Math.floor(daysInMonth / deliverable.quantity);
          dueDate.setDate(dueDate.getDate() + dayIndex * spacing);
        }

        // Set due date 5 days before posting to allow for workflow
        dueDate.setDate(dueDate.getDate() - 5);

        // Determine task type based on deliverable type
        const taskType =
          deliverable.type === "Long Form Videos" ||
          deliverable.type === "Square Form Videos" ||
          deliverable.type === "Snapchat Show Episode"
            ? "video"
            : "design";

        // Determine estimated hours based on deliverable type
        const estimatedHours =
          deliverable.type === "Long Form Videos"
            ? "4"
            : deliverable.type === "Snapchat Show Episode"
            ? "3"
            : "2";

        // Create the initial editor task
        const platformsText = deliverable.platforms.join(", ");
        const task = taskManager.createTask({
          title: `${deliverable.type} #${i + 1} - ${clientName}`,
          description: `${
            deliverable.type
          } deliverable for ${clientName}\\n\\nPlatforms: ${platformsText}\\nPosting Schedule: ${
            deliverable.postingSchedule
          }\\n\\n${deliverable.description || "No additional notes"}`,
          // description: `${deliverable.type} deliverable for ${clientName}\\n\\nPlatforms: ${platformsText}\\nPosting Schedule: ${deliverable.postingSchedule}\\nPosting Time: ${deliverable.defaultPostingTime}\\n\\n${deliverable.description || 'No additional notes'}`,
          type: taskType,
          assignedTo: "editor",
          dueDate: dueDate.toISOString().split("T")[0],
          estimatedHours: estimatedHours,
          projectId: clientId,
          createdBy: "admin",
          createdByName: "Admin",
          taskTypeLabel: `${deliverable.type} - ${platformsText}`,
        });

        tasksCreated++;
      }
    });

    return tasksCreated;
  };

  const handleSaveClient = async () => {
  try {
    const url = editingClient 
      ? `/api/clients/${editingClient.id}`
      : `/api/clients`;

    const method = editingClient ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClient),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.message || "Failed to save client");
      return;
    }

    toast.success(editingClient ? "Client updated" : "Client created");

    // Update UI list immediately
    if (editingClient) {
      setClients(prev =>
        prev.map(c => (c.id === editingClient.id ? data.updated : c))
      );
    } else {
      setClients(prev => [...prev, data.client]);
    }

    setShowAddDialog(false);
    setEditingClient(null);
  } catch (err) {
    console.error("Save client failed:", err);
    toast.error("Server error");
  }
};


  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setNewClient({
      name: client.name,
      companyName: client.companyName,
      email: client.email,
      phone: client.phone,
      accountManagerId: client.accountManagerId,
      startDate: client.startDate,
      renewalDate: client.renewalDate,
      status: client.status,
      monthlyDeliverables: client.monthlyDeliverables ?? [],
      billing: client.billing,
      brandGuidelines: client.brandGuidelines ?? {},
      projectSettings: client.projectSettings ?? {},
    });
    setShowAddDialog(true);
  };

const handleDeleteClient = async (clientId: string) => {
  const confirmed = confirm("Are you sure you want to delete this client?");
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      toast.error("Failed to delete client");
      return;
    }

    // Remove from client list
    setClients(prev => prev.filter(c => c.id !== clientId));

    // If the user is currently viewing this client, close the dialog
    if (selectedClient?.id === clientId) {
      setShowClientDetailsDialog(false);
      setSelectedClient(null);
    }

    toast.success("Client deleted");
  } catch (err) {
    console.error("DELETE failed:", err);
    toast.error("Server error");
  }
};



  const handleViewClientDetails = async (client: Client) => {
  try {
    const res = await fetch(`/api/clients/${client.id}`);
    const data = await res.json();

    if (!res.ok) {
      toast.error("Failed to load client details");
      return;
    }

    setSelectedClient(data.client);
    setShowClientDetailsDialog(true);
  } catch (err) {
    console.error("Failed to fetch client:", err);
    toast.error("Server error");
  }
};


  // const calculateTotalDeliverables = (
  //   deliverables: MonthlyDeliverable[],
  // ) => {
  //   return deliverables.reduce((sum, d) => sum + d.quantity, 0);
  // };

  const calculateTotalDeliverables = (
    deliverables: MonthlyDeliverable[] | null | undefined
  ) => {
    if (!Array.isArray(deliverables)) return 0;
    return deliverables.reduce((sum, d) => sum + (d?.quantity ?? 0), 0);
  };

  const handleFileUpload = async (
    clientId: string,
    folder: "elements" | "raw-footage",
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("folder", folder);
    formData.append("file", files[0]);

    const res = await fetch("/api/upload/brand-asset", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error("Upload failed");
      return;
    }

    // Update UI immediately
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? { ...c, brandAssets: [...c.brandAssets, data.asset] }
          : c
      )
    );

    toast.success("Uploaded successfully");
  };

  const ClientDetailsDialog = () => {
    if (!selectedClient) return null;

    return (
      <Dialog
        open={showClientDetailsDialog}
        onOpenChange={setShowClientDetailsDialog}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {selectedClient.companyName} - Client Details
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Complete client information and monthly deliverables
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-100">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="deliverables">
                Monthly Deliverables
              </TabsTrigger>
              <TabsTrigger value="brand">Brand Assets</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card className="bg-white border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-gray-500">Contact Name</Label>
                    <div className="flex items-center gap-2 text-gray-900">
                      <User className="h-4 w-4" />
                      {selectedClient.name}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-500">Company</Label>
                    <div className="flex items-center gap-2 text-gray-900">
                      <Building className="h-4 w-4" />
                      {selectedClient.companyName}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-500">Email</Label>
                    <div className="flex items-center gap-2 text-gray-900">
                      <Mail className="h-4 w-4" />
                      {selectedClient.email}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-500">Phone</Label>
                    <div className="flex items-center gap-2 text-gray-900">
                      <Phone className="h-4 w-4" />
                      {selectedClient.phone}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-500">Account Manager</Label>
                    <div className="flex items-center gap-2 text-gray-900">
                      <User className="h-4 w-4" />
                      {selectedClient.accountManager}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-gray-500">Status</Label>
                    <Badge variant={getStatusVariant(selectedClient.status)}>
                      {selectedClient.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Monthly Progress</span>
                      <span>
                        {selectedClient.currentProgress.completed} /{" "}
                        {selectedClient.currentProgress.total}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{
                          width: `${getProgressPercentage(
                            selectedClient.currentProgress.completed,
                            selectedClient.currentProgress.total
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deliverables" className="space-y-4">
              <Card className="bg-white border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <Repeat className="h-5 w-5" />
                    Monthly Recurring Deliverables
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    These deliverables automatically generate tasks each month
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* {selectedClient.monthlyDeliverables.map((deliverable) => ( */}
                  {(selectedClient.monthlyDeliverables ?? []).map(
                    (deliverable) => (
                      <div
                        key={deliverable.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getDeliverableTypeIcon(deliverable.type)}
                            <div>
                              <div className="text-gray-900">
                                {deliverable.type}
                              </div>
                              <div className="text-sm text-gray-600">
                                {deliverable.quantity} per month (
                                {deliverable.videosPerDay || 1} per day) •{" "}
                                {deliverable.postingSchedule}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-gray-700">
                            {deliverable.postingDays &&
                            deliverable.postingDays.length > 0
                              ? deliverable.postingDays.join(", ")
                              : "Various"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-2">
                          {deliverable.platforms.map((platform) => (
                            <Badge
                              key={platform}
                              variant="outline"
                              className={getPlatformBadgeColor(platform)}
                            >
                              {platform}
                            </Badge>
                          ))}
                        </div>

                        {deliverable.description && (
                          <p className="text-sm text-gray-600 mt-2">
                            {deliverable.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          Posting time
                          {(deliverable.postingTimes?.length || 1) > 1
                            ? "s"
                            : ""}
                          : {(deliverable.postingTimes || ["10:00"]).join(", ")}
                        </div>
                      </div>
                    )
                  )}

                  {/* {selectedClient.monthlyDeliverables.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      No monthly deliverables configured
                    </div>
                  )} */}

                  {!selectedClient.monthlyDeliverables ||
                    (selectedClient.monthlyDeliverables.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        No monthly deliverables configured
                      </div>
                    ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="brand" className="space-y-4">
              <Card className="bg-white border-gray-200">
                {/* <CardHeader>
                  <CardTitle className="text-gray-900">Brand Assets</CardTitle>
                </CardHeader> */}

                <CardHeader>
                  <CardTitle className="text-gray-900">Brand Assets</CardTitle>

                  {/* Folder selector */}
                  <Select value={uploadFolder} onValueChange={setUploadFolder}>
                    <SelectTrigger className="w-48 bg-white border-gray-200">
                      <SelectValue placeholder="Select Folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elements">Elements Folder</SelectItem>
                      <SelectItem value="raw-footage">
                        Raw Footage Folder
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) =>
                      handleFileUpload(
                        selectedClient.id,
                        uploadFolder,
                        e.target.files
                      )
                    }
                  />

                  {/* Button that triggers the input */}
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 mt-3"
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.click();
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    Upload Asset
                  </Button>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {(selectedClient.brandAssets ?? []).map((asset) => (
                      <div
                        key={asset.id}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          {getAssetTypeIcon(asset.type)}
                          <span className="text-gray-900">{asset.name}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {asset.fileName} • {asset.fileSize}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!selectedClient.brandAssets ||
                    (selectedClient.brandAssets.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        No brand assets uploaded
                      </div>
                    ))}
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">
                    Brand Guidelines
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-gray-500">Tone of Voice</Label>
                    <p className="text-gray-900">
                      {selectedClient.brandGuidelines.toneOfVoice}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Target Audience</Label>
                    <p className="text-gray-900">
                      {selectedClient.brandGuidelines.targetAudience}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Content Style</Label>
                    <p className="text-gray-900">
                      {selectedClient.brandGuidelines.contentStyle}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card className="bg-white border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">
                    Project Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-gray-500">
                      Default Video Length
                    </Label>
                    <p className="text-gray-900">
                      {selectedClient.projectSettings.defaultVideoLength}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Preferred Platforms</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedClient.projectSettings.preferredPlatforms.map(
                        (platform) => (
                          <Badge
                            key={platform}
                            variant="outline"
                            className="text-gray-700"
                          >
                            {platform}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={
                          selectedClient.projectSettings.contentApprovalRequired
                        }
                        disabled
                      />
                      <Label className="text-gray-700">
                        Content Approval Required
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={
                          selectedClient.projectSettings
                            .quickTurnaroundAvailable
                        }
                        disabled
                      />
                      <Label className="text-gray-700">
                        Quick Turnaround Available
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClientDetailsDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">Client Management</h2>
          <p className="text-sm text-gray-600">
            Manage client accounts and monthly deliverables
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingClient(null);
            setShowAddDialog(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search clients..."
                value={searchTerm ?? ""}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-gray-200 text-gray-900"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={managerFilter} onValueChange={setManagerFilter}>
              <SelectTrigger className="bg-white border-gray-200 text-gray-900">
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

      {/* Client List */}
      <div className="grid gap-4">
        {filteredClients.map((client) => (
          <Card
            key={client.id}
            className="bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-gray-900">{client.companyName}</h3>
                    <Badge
                      variant={getStatusVariant(client.status)}
                      className="flex items-center gap-1"
                    >
                      {getStatusIcon(client.status)}
                      {client.status.charAt(0).toUpperCase() +
                        client.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label className="text-gray-500 text-xs">Contact</Label>
                      <p className="text-gray-900 text-sm">{client.name}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500 text-xs">
                        Account Manager
                      </Label>
                      <p className="text-gray-900 text-sm">
                        {client.accountManager}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-500 text-xs">
                        Monthly Deliverables
                      </Label>
                      <p className="text-gray-900 text-sm">
                        {calculateTotalDeliverables(
                          client.monthlyDeliverables ?? []
                        )}{" "}
                        items
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-500 text-xs">Progress</Label>
                      <p className="text-gray-900 text-sm">
                        {client.currentProgress.completed}/
                        {client.currentProgress.total}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(client.monthlyDeliverables ?? [])
                      .slice(0, 3)
                      .map((deliverable) => (
                        <Badge
                          key={deliverable.id}
                          variant="outline"
                          className="text-gray-700 gap-1"
                        >
                          {getDeliverableTypeIcon(deliverable.type)}
                          {deliverable.quantity} {deliverable.type}
                        </Badge>
                      ))}
                    {(client.monthlyDeliverables?.length ?? 0) > 3 && (
                      <Badge variant="outline" className="text-gray-500">
                        +{(client.monthlyDeliverables?.length ?? 0) - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewClientDetails(client)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditClient(client)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteClient(client.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredClients.length === 0 && (
          <Card className="bg-white border-gray-200">
            <CardContent className="p-12 text-center">
              <p className="text-gray-400">No clients found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Client Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="!max-w-[1400px] w-[95vw] h-[95vh] !max-h-[95vh] overflow-y-auto bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingClient ? "Edit Client" : "Add New Client"}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {editingClient
                ? "Update client information and monthly deliverables"
                : "Add a new client with their monthly deliverable schedule"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-gray-900">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-700">
                    Contact Name
                  </Label>
                  <Input
                    id="name"
                    value={newClient.name ?? ""}
                    onChange={(e) =>
                      setNewClient({ ...newClient, name: e.target.value })
                    }
                    className="bg-white border-gray-200 text-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-gray-700">
                    Company
                  </Label>
                  <Input
                    id="company"
                    value={newClient.companyName ?? ""}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        companyName: e.target.value,
                      })
                    }
                    className="bg-white border-gray-200 text-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email ?? ""}
                    onChange={(e) =>
                      setNewClient({ ...newClient, email: e.target.value })
                    }
                    className="bg-white border-gray-200 text-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-700">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={newClient.phone ?? ""}
                    onChange={(e) =>
                      setNewClient({ ...newClient, phone: e.target.value })
                    }
                    className="bg-white border-gray-200 text-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountManager" className="text-gray-700">
                    Account Manager
                  </Label>
                  <Select
                    value={newClient.accountManagerId}
                    onValueChange={(value) =>
                      setNewClient({ ...newClient, accountManagerId: value })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockAccountManagers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-gray-700">
                    Status
                  </Label>
                  <Select
                    value={newClient.status}
                    onValueChange={(value) =>
                      setNewClient({
                        ...newClient,
                        status: value as "active" | "pending" | "expired",
                      })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-gray-700">
                    Start Date
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newClient.startDate ?? ""}
                    onChange={(e) =>
                      setNewClient({ ...newClient, startDate: e.target.value })
                    }
                    className="bg-white border-gray-200 text-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="renewalDate" className="text-gray-700">
                    Renewal Date
                  </Label>
                  <Input
                    id="renewalDate"
                    type="date"
                    value={newClient.renewalDate ?? ""}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        renewalDate: e.target.value,
                      })
                    }
                    className="bg-white border-gray-200 text-gray-900"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Monthly Deliverables */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-gray-900 flex items-center gap-2">
                    <Repeat className="h-5 w-5" />
                    Monthly Deliverables
                  </h3>
                  <p className="text-sm text-gray-600">
                    Set up recurring deliverables that auto-generate tasks
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAddDeliverableDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Deliverable
                </Button>
              </div>

              <div className="space-y-2">
                {(newClient.monthlyDeliverables || []).map((deliverable) => (
                  <div
                    key={deliverable.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-start justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getDeliverableTypeIcon(deliverable.type)}
                        <span className="text-gray-900">
                          {deliverable.type}
                        </span>
                        <Badge variant="outline" className="text-gray-600">
                          {deliverable.quantity} per month
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-blue-600 bg-blue-50"
                        >
                          {deliverable.videosPerDay || 1} per day
                        </Badge>
                      </div>
                      {/* <div className="text-sm text-gray-600">
                        {deliverable.postingSchedule} • {(deliverable.postingDays && deliverable.postingDays.length > 0) 
                          ? deliverable.postingDays.join(", ") 
                          : "Various days"} • {deliverable.defaultPostingTime}
                      </div> */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {deliverable.platforms.map((platform) => (
                          <Badge
                            key={platform}
                            variant="outline"
                            className={`text-xs ${getPlatformBadgeColor(
                              platform
                            )}`}
                          >
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveDeliverable(deliverable.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {(!newClient.monthlyDeliverables ||
                  newClient.monthlyDeliverables.length === 0) && (
                  <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-gray-200">
                    No monthly deliverables added yet
                  </div>
                )}
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Payment & Billing */}
            <div className="space-y-4">
              <div>
                <h3 className="text-gray-900 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment & Billing
                </h3>
                <p className="text-sm text-gray-600">
                  Set up payment schedule and billing information
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyFee" className="text-gray-700">
                    Monthly Fee ($)
                  </Label>
                  <Input
                    id="monthlyFee"
                    type="number"
                    placeholder="5000"
                    value={newClient.billing?.monthlyFee || ""}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        billing: {
                          ...newClient.billing,
                          monthlyFee: e.target.value,
                          billingFrequency:
                            newClient.billing?.billingFrequency || "monthly",
                          billingDay: newClient.billing?.billingDay || 1,
                          paymentMethod:
                            newClient.billing?.paymentMethod || "credit-card",
                          nextBillingDate:
                            newClient.billing?.nextBillingDate || "",
                        },
                      })
                    }
                    className="bg-white border-gray-200 text-gray-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingFrequency" className="text-gray-700">
                    Billing Frequency
                  </Label>
                  <Select
                    value={newClient.billing?.billingFrequency || "monthly"}
                    onValueChange={(value) =>
                      setNewClient({
                        ...newClient,
                        billing: {
                          ...newClient.billing,
                          monthlyFee: newClient.billing?.monthlyFee || "",
                          billingFrequency: value as
                            | "monthly"
                            | "quarterly"
                            | "annually",
                          billingDay: newClient.billing?.billingDay || 1,
                          paymentMethod:
                            newClient.billing?.paymentMethod || "credit-card",
                          nextBillingDate:
                            newClient.billing?.nextBillingDate || "",
                        },
                      })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingDay" className="text-gray-700">
                    Billing Day of Month
                  </Label>
                  <Select
                    value={String(newClient.billing?.billingDay || 1)}
                    onValueChange={(value) =>
                      setNewClient({
                        ...newClient,
                        billing: {
                          ...newClient.billing,
                          monthlyFee: newClient.billing?.monthlyFee || "",
                          billingFrequency:
                            newClient.billing?.billingFrequency || "monthly",
                          billingDay: parseInt(value),
                          paymentMethod:
                            newClient.billing?.paymentMethod || "credit-card",
                          nextBillingDate:
                            newClient.billing?.nextBillingDate || "",
                        },
                      })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(
                        (day) => (
                          <SelectItem key={day} value={String(day)}>
                            {day}
                            {day === 1
                              ? "st"
                              : day === 2
                              ? "nd"
                              : day === 3
                              ? "rd"
                              : "th"}{" "}
                            of the month
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod" className="text-gray-700">
                    Payment Method
                  </Label>
                  <Select
                    value={newClient.billing?.paymentMethod || "credit-card"}
                    onValueChange={(value) =>
                      setNewClient({
                        ...newClient,
                        billing: {
                          ...newClient.billing,
                          monthlyFee: newClient.billing?.monthlyFee || "",
                          billingFrequency:
                            newClient.billing?.billingFrequency || "monthly",
                          billingDay: newClient.billing?.billingDay || 1,
                          paymentMethod: value as
                            | "credit-card"
                            | "bank-transfer"
                            | "check"
                            | "paypal",
                          nextBillingDate:
                            newClient.billing?.nextBillingDate || "",
                        },
                      })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit-card">
                        <span className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Credit Card
                        </span>
                      </SelectItem>
                      <SelectItem value="bank-transfer">
                        Bank Transfer
                      </SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nextBillingDate" className="text-gray-700">
                    Next Billing Date
                  </Label>
                  <Input
                    id="nextBillingDate"
                    type="date"
                    value={newClient.billing?.nextBillingDate || ""}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        billing: {
                          ...newClient.billing,
                          monthlyFee: newClient.billing?.monthlyFee || "",
                          billingFrequency:
                            newClient.billing?.billingFrequency || "monthly",
                          billingDay: newClient.billing?.billingDay || 1,
                          paymentMethod:
                            newClient.billing?.paymentMethod || "credit-card",
                          nextBillingDate: e.target.value,
                        },
                      })
                    }
                    className="bg-white border-gray-200 text-gray-900"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="billingNotes" className="text-gray-700">
                    Billing Notes (Optional)
                  </Label>
                  <Textarea
                    id="billingNotes"
                    placeholder="e.g., Includes 12 videos per month, 10% discount applied"
                    value={newClient.billing?.notes || ""}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        billing: {
                          ...newClient.billing,
                          monthlyFee: newClient.billing?.monthlyFee || "",
                          billingFrequency:
                            newClient.billing?.billingFrequency || "monthly",
                          billingDay: newClient.billing?.billingDay || 1,
                          paymentMethod:
                            newClient.billing?.paymentMethod || "credit-card",
                          nextBillingDate:
                            newClient.billing?.nextBillingDate || "",
                          notes: e.target.value,
                        },
                      })
                    }
                    className="bg-white border-gray-200 text-gray-900"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setEditingClient(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveClient}>
              {editingClient ? "Update Client" : "Add Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deliverable Dialog */}
      <Dialog
        open={showAddDeliverableDialog}
        onOpenChange={setShowAddDeliverableDialog}
      >
        <DialogContent className="!max-w-[1200px] w-[90vw] !max-h-[90vh] overflow-y-auto bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Add Monthly Deliverable
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Configure a recurring deliverable for this client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deliverableType" className="text-gray-700">
                Deliverable Type
              </Label>
              <Select
                value={newDeliverable.type}
                onValueChange={(value) =>
                  setNewDeliverable({
                    ...newDeliverable,
                    type: value as DeliverableType,
                  })
                }
              >
                <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Short Form Videos">
                    Short Form Videos
                  </SelectItem>
                  <SelectItem value="Long Form Videos">
                    Long Form Videos
                  </SelectItem>
                  <SelectItem value="Square Form Videos">
                    Square Form Videos
                  </SelectItem>
                  <SelectItem value="Snapchat Show Episode">
                    Snapchat Show Episode
                  </SelectItem>
                  <SelectItem value="Social/Hard Post">
                    Social/Hard Post
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-gray-700">
                  Quantity per Month
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newDeliverable.quantity}
                  onChange={(e) =>
                    setNewDeliverable({
                      ...newDeliverable,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="bg-white border-gray-200 text-gray-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="videosPerDay" className="text-gray-700">
                  Videos per Posting Day
                </Label>
                <Input
                  id="videosPerDay"
                  type="number"
                  min="1"
                  value={newDeliverable.videosPerDay}
                  onChange={(e) =>
                    syncPostingTimesWithVideosPerDay(
                      parseInt(e.target.value) || 1
                    )
                  }
                  className="bg-white border-gray-200 text-gray-900"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="postingSchedule" className="text-gray-700">
                Posting Schedule
              </Label>
              <Select
                value={newDeliverable.postingSchedule}
                onValueChange={(value) =>
                  setNewDeliverable({
                    ...newDeliverable,
                    postingSchedule: value as PostingSchedule,
                  })
                }
              >
                <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-gray-700">Posting Days</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={setEveryDay}
                  className={`h-8 ${
                    (newDeliverable.postingDays || []).length === 7
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  {(newDeliverable.postingDays || []).length === 7 ? "✓ " : ""}
                  Everyday
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day) => (
                  <div
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`p-2 rounded border cursor-pointer text-center text-sm transition-colors ${
                      (newDeliverable.postingDays || []).includes(day)
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {day.substring(0, 3)}
                  </div>
                ))}
              </div>
              {(newDeliverable.postingDays || []).length > 0 && (
                <p className="text-xs text-gray-500">
                  Selected: {(newDeliverable.postingDays || []).join(", ")}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-gray-700">
                Posting Times ({newDeliverable.videosPerDay || 1} video
                {(newDeliverable.videosPerDay || 1) > 1 ? "s" : ""} per day)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: newDeliverable.videosPerDay || 1 }).map(
                  (_, index) => (
                    <div key={index} className="space-y-1">
                      <Label
                        htmlFor={`postingTime-${index}`}
                        className="text-xs text-gray-600"
                      >
                        Video {index + 1} Time
                      </Label>
                      <Input
                        id={`postingTime-${index}`}
                        type="time"
                        value={
                          (newDeliverable.postingTimes || ["10:00"])[index] ||
                          "10:00"
                        }
                        onChange={(e) =>
                          updatePostingTime(index, e.target.value)
                        }
                        className="bg-white border-gray-200 text-gray-900"
                      />
                    </div>
                  )
                )}
              </div>
              {(newDeliverable.videosPerDay || 1) > 1 && (
                <p className="text-xs text-gray-500">
                  Times: {(newDeliverable.postingTimes || ["10:00"]).join(", ")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">Platforms</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    "instagram",
                    "tiktok",
                    "facebook",
                    "youtube",
                    "twitter",
                    "linkedin",
                  ] as SocialPlatform[]
                ).map((platform) => (
                  <div
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`p-2 rounded border cursor-pointer text-center text-sm transition-colors ${
                      newDeliverable.platforms?.includes(platform)
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {platform}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-700">
                Description (optional)
              </Label>
              <Textarea
                id="description"
                value={newDeliverable.description}
                onChange={(e) =>
                  setNewDeliverable({
                    ...newDeliverable,
                    description: e.target.value,
                  })
                }
                placeholder="Additional notes about this deliverable..."
                className="bg-white border-gray-200 text-gray-900"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDeliverableDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddDeliverable}>Add Deliverable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Details Dialog */}
      <ClientDetailsDialog />
    </div>
  );
}
