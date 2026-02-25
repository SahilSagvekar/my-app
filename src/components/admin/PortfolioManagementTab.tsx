"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
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
} from "../ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
    Plus,
    Video,
    Edit,
    Trash2,
    Loader2,
    Download,
    Users,
    Film,
    Eye,
    EyeOff,
    GripVertical,
    ArrowUp,
    ArrowDown,
    Search,
    RefreshCw,
    Image as ImageIcon,
    ExternalLink,
    BarChart3,
    Clock,
    Mail,
    Phone,
    Briefcase,
    ChevronLeft,
    ChevronRight,
    Play,
} from "lucide-react";
import { toast } from "sonner";

/* ───────────────────────── types ───────────────────────────── */
interface PortfolioLead {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    serviceNeeded: string;
    createdAt: string;
}

interface PortfolioVideo {
    id: string;
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    category: string;
    order: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

/* ───────────────────────── constants ───────────────────────── */
const CATEGORIES = [
    { key: "short_form", label: "Short Form Videos" },
    { key: "long_form", label: "Long Form Videos" },
    { key: "montage", label: "Montage Edits" },
    { key: "ugc", label: "UGC Content" },
    { key: "talking_head", label: "Talking Head Videos" },
];

const SERVICE_OPTIONS = [
    "Videography",
    "Video Editing",
    "Build A Show",
    "Social Media Management",
    "Multiple Services",
    "Other",
];

const LEADS_PER_PAGE = 15;

/* ═══════════════════════════════════════════════════════════════
   LEAD MANAGEMENT TAB
   ═══════════════════════════════════════════════════════════════ */
function LeadManagement() {
    const [leads, setLeads] = useState<PortfolioLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [serviceFilter, setServiceFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const fetchLeads = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/portfolio/leads");
            const data = await res.json();
            if (data.ok) setLeads(data.leads || []);
            else toast.error("Failed to load leads");
        } catch {
            toast.error("Network error loading leads");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    // Filter logic
    const filtered = leads.filter((lead) => {
        const matchesService =
            serviceFilter === "all" || lead.serviceNeeded === serviceFilter;
        const matchesSearch =
            !searchQuery ||
            `${lead.firstName} ${lead.lastName} ${lead.email} ${lead.phone}`
                .toLowerCase()
                .includes(searchQuery.toLowerCase());
        return matchesService && matchesSearch;
    });

    // Pagination
    const totalPages = Math.ceil(filtered.length / LEADS_PER_PAGE);
    const paginatedLeads = filtered.slice(
        (currentPage - 1) * LEADS_PER_PAGE,
        currentPage * LEADS_PER_PAGE
    );

    // CSV Export
    const exportCSV = () => {
        const headers = [
            "First Name",
            "Last Name",
            "Email",
            "Phone",
            "Service Needed",
            "Submitted At",
        ];
        const rows = filtered.map((l) => [
            l.firstName,
            l.lastName,
            l.email,
            l.phone,
            l.serviceNeeded,
            new Date(l.createdAt).toLocaleString(),
        ]);
        const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-leads-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filtered.length} leads to CSV`);
    };

    // Stats
    const stats = {
        total: leads.length,
        today: leads.filter(
            (l) =>
                new Date(l.createdAt).toDateString() === new Date().toDateString()
        ).length,
        topService: leads.length > 0
            ? Object.entries(
                leads.reduce<Record<string, number>>((acc, l) => {
                    acc[l.serviceNeeded] = (acc[l.serviceNeeded] || 0) + 1;
                    return acc;
                }, {})
            ).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"
            : "N/A",
    };

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Leads</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <Clock className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Today</p>
                                <p className="text-2xl font-bold">{stats.today}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <BarChart3 className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Top Service</p>
                                <p className="text-lg font-bold truncate">{stats.topService}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table Card */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Portfolio Leads
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-9 w-48"
                                    placeholder="Search leads..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <Select
                                value={serviceFilter}
                                onValueChange={(v) => {
                                    setServiceFilter(v);
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter by service" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Services</SelectItem>
                                    {SERVICE_OPTIONS.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="sm" onClick={fetchLeads}>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Refresh
                            </Button>
                            <Button size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
                                <Download className="h-4 w-4 mr-1" />
                                Export CSV
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            No leads found.
                        </p>
                    ) : (
                        <>
                            <div className="rounded-lg border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead>Service</TableHead>
                                            <TableHead>Submitted</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedLeads.map((lead) => (
                                            <TableRow key={lead.id}>
                                                <TableCell className="font-medium">
                                                    {lead.firstName} {lead.lastName}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <a
                                                            href={`mailto:${lead.email}`}
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            {lead.email}
                                                        </a>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                                        {lead.phone}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{lead.serviceNeeded}</Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {new Date(lead.createdAt).toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-sm text-muted-foreground">
                                        Showing {(currentPage - 1) * LEADS_PER_PAGE + 1}–
                                        {Math.min(currentPage * LEADS_PER_PAGE, filtered.length)} of{" "}
                                        {filtered.length}
                                    </p>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage((p) => p - 1)}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm px-3">
                                            {currentPage} / {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage((p) => p + 1)}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   PORTFOLIO CONTENT CONTROL TAB
   ═══════════════════════════════════════════════════════════════ */
function ContentControl() {
    const [videos, setVideos] = useState<PortfolioVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [showDialog, setShowDialog] = useState(false);
    const [editingVideo, setEditingVideo] = useState<PortfolioVideo | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [previewVideo, setPreviewVideo] = useState<PortfolioVideo | null>(null);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        videoUrl: "",
        thumbnailUrl: "",
        category: "short_form",
        order: "0",
    });

    const fetchVideos = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/portfolio/videos?all=true");
            const data = await res.json();
            if (data.ok) setVideos(data.videos || []);
        } catch {
            toast.error("Failed to load videos");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVideos();
    }, [fetchVideos]);

    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            videoUrl: "",
            thumbnailUrl: "",
            category: "short_form",
            order: "0",
        });
        setEditingVideo(null);
    };

    const openAddDialog = () => {
        resetForm();
        setShowDialog(true);
    };

    const openEditDialog = (v: PortfolioVideo) => {
        setEditingVideo(v);
        setFormData({
            title: v.title,
            description: v.description,
            videoUrl: v.videoUrl,
            thumbnailUrl: v.thumbnailUrl || "",
            category: v.category,
            order: String(v.order),
        });
        setShowDialog(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            toast.error("Title is required");
            return;
        }
        if (!formData.videoUrl.trim()) {
            toast.error("Video URL is required");
            return;
        }

        setSubmitting(true);
        try {
            if (editingVideo) {
                // Update existing video
                const res = await fetch(`/api/portfolio/videos/${editingVideo.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: formData.title.trim(),
                        description: formData.description.trim(),
                        videoUrl: formData.videoUrl.trim(),
                        thumbnailUrl: formData.thumbnailUrl.trim() || null,
                        category: formData.category,
                        order: parseInt(formData.order) || 0,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Update failed");
                toast.success("Video updated");
            } else {
                // Create new video
                const res = await fetch("/api/portfolio/videos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: formData.title.trim(),
                        description: formData.description.trim(),
                        videoUrl: formData.videoUrl.trim(),
                        thumbnailUrl: formData.thumbnailUrl.trim() || null,
                        category: formData.category,
                        order: parseInt(formData.order) || 0,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Create failed");
                toast.success("Video added");
            }
            setShowDialog(false);
            resetForm();
            fetchVideos();
        } catch (err: any) {
            toast.error(err.message || "Operation failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this portfolio video? This cannot be undone.")) return;
        try {
            const res = await fetch(`/api/portfolio/videos/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Delete failed");
            }
            toast.success("Video deleted");
            fetchVideos();
        } catch (err: any) {
            toast.error(err.message || "Delete failed");
        }
    };

    const handleToggleActive = async (video: PortfolioVideo) => {
        try {
            const res = await fetch(`/api/portfolio/videos/${video.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !video.isActive }),
            });
            if (!res.ok) throw new Error("Toggle failed");
            toast.success(video.isActive ? "Video hidden" : "Video visible");
            fetchVideos();
        } catch {
            toast.error("Failed to toggle visibility");
        }
    };

    const handleReorder = async (video: PortfolioVideo, direction: "up" | "down") => {
        const sameCat = videos
            .filter((v) => v.category === video.category)
            .sort((a, b) => a.order - b.order);
        const idx = sameCat.findIndex((v) => v.id === video.id);
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sameCat.length) return;

        const swapVideo = sameCat[swapIdx];
        try {
            await Promise.all([
                fetch(`/api/portfolio/videos/${video.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ order: swapVideo.order }),
                }),
                fetch(`/api/portfolio/videos/${swapVideo.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ order: video.order }),
                }),
            ]);
            fetchVideos();
        } catch {
            toast.error("Failed to reorder");
        }
    };

    // Get YouTube thumbnail from URL helper
    function getYTThumb(url: string): string | null {
        const m = url.match(
            /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
        );
        return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
    }

    // Grouped and sorted
    const filtered =
        categoryFilter === "all"
            ? videos
            : videos.filter((v) => v.category === categoryFilter);
    const sorted = [...filtered].sort(
        (a, b) => a.category.localeCompare(b.category) || a.order - b.order
    );

    const byCategory = sorted.reduce<Record<string, PortfolioVideo[]>>((acc, v) => {
        if (!acc[v.category]) acc[v.category] = [];
        acc[v.category].push(v);
        return acc;
    }, {});

    // Category stats
    const categoryStats = CATEGORIES.map((cat) => ({
        ...cat,
        total: videos.filter((v) => v.category === cat.key).length,
        active: videos.filter((v) => v.category === cat.key && v.isActive).length,
    }));

    return (
        <div className="space-y-6">
            {/* Category Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {categoryStats.map((cat) => (
                    <Card
                        key={cat.key}
                        className={`cursor-pointer transition-all hover:shadow-md ${categoryFilter === cat.key ? "ring-2 ring-primary" : ""
                            }`}
                        onClick={() =>
                            setCategoryFilter(categoryFilter === cat.key ? "all" : cat.key)
                        }
                    >
                        <CardContent className="pt-4 pb-3 px-4">
                            <p className="text-xs font-medium text-muted-foreground truncate">
                                {cat.label}
                            </p>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-xl font-bold">{cat.total}</span>
                                <span className="text-xs text-muted-foreground">
                                    ({cat.active} active)
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Control Card */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <Film className="h-5 w-5" />
                            Portfolio Videos
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {CATEGORIES.map((c) => (
                                        <SelectItem key={c.key} value={c.key}>
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="sm" onClick={fetchVideos}>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Refresh
                            </Button>
                            <Button size="sm" onClick={openAddDialog}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Video
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : sorted.length === 0 ? (
                        <div className="text-center py-12">
                            <Film className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-muted-foreground">
                                No videos yet. Click <strong>Add Video</strong> to get started.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(byCategory).map(([catKey, catVideos]) => {
                                const catLabel =
                                    CATEGORIES.find((c) => c.key === catKey)?.label || catKey;
                                return (
                                    <div key={catKey}>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                                {catLabel}
                                            </h3>
                                            <Badge variant="outline">
                                                {catVideos.length} video{catVideos.length !== 1 ? "s" : ""}
                                            </Badge>
                                        </div>
                                        <div className="space-y-2">
                                            {catVideos.map((video, idx) => {
                                                const thumb =
                                                    video.thumbnailUrl || getYTThumb(video.videoUrl);
                                                return (
                                                    <div
                                                        key={video.id}
                                                        className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${video.isActive
                                                            ? "bg-card hover:bg-muted/60"
                                                            : "bg-muted/30 opacity-60"
                                                            }`}
                                                    >
                                                        {/* Reorder controls */}
                                                        <div className="flex flex-col gap-0.5 shrink-0">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                disabled={idx === 0}
                                                                onClick={() => handleReorder(video, "up")}
                                                            >
                                                                <ArrowUp className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                disabled={idx === catVideos.length - 1}
                                                                onClick={() => handleReorder(video, "down")}
                                                            >
                                                                <ArrowDown className="h-3 w-3" />
                                                            </Button>
                                                        </div>

                                                        {/* Thumbnail */}
                                                        <div className="w-24 h-14 rounded-md overflow-hidden bg-muted shrink-0">
                                                            {thumb ? (
                                                                <img
                                                                    src={thumb}
                                                                    alt={video.title}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Film className="h-5 w-5 text-muted-foreground" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium truncate">
                                                                    {video.title}
                                                                </p>
                                                                {!video.isActive && (
                                                                    <Badge variant="secondary" className="text-xs shrink-0">
                                                                        Hidden
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {video.description && (
                                                                <p className="text-sm text-muted-foreground truncate">
                                                                    {video.description}
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                Order: {video.order} · Added{" "}
                                                                {new Date(video.createdAt).toLocaleDateString()}
                                                            </p>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {/* Toggle visibility */}
                                                            <div className="flex items-center gap-1.5 mr-2" title={video.isActive ? "Visible" : "Hidden"}>
                                                                <Switch
                                                                    checked={video.isActive}
                                                                    onCheckedChange={() => handleToggleActive(video)}
                                                                />
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => setPreviewVideo(video)}
                                                                title="Preview"
                                                            >
                                                                <Play className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => openEditDialog(video)}
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => handleDelete(video.id)}
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add / Edit Dialog */}
            <Dialog
                open={showDialog}
                onOpenChange={(open) => {
                    setShowDialog(open);
                    if (!open) resetForm();
                }}
            >
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingVideo ? "Edit Video" : "Add Portfolio Video"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingVideo
                                ? "Update the video details below."
                                : "Add a new video to your portfolio. Paste a YouTube, Vimeo, or direct video URL."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData({ ...formData, title: e.target.value })
                                }
                                placeholder="e.g. Brand Video for Tesla"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                placeholder="Short description of the video..."
                                rows={2}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Video URL *</Label>
                            <Input
                                value={formData.videoUrl}
                                onChange={(e) =>
                                    setFormData({ ...formData, videoUrl: e.target.value })
                                }
                                placeholder="https://youtube.com/watch?v=... or Vimeo URL"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Supports YouTube, Vimeo, and direct embed URLs
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Custom Thumbnail URL (optional)</Label>
                            <Input
                                value={formData.thumbnailUrl}
                                onChange={(e) =>
                                    setFormData({ ...formData, thumbnailUrl: e.target.value })
                                }
                                placeholder="https://... (leave blank for auto-detect)"
                            />
                            <p className="text-xs text-muted-foreground">
                                YouTube thumbnails are auto-detected. Use this to override.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Category *</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(val) =>
                                        setFormData({ ...formData, category: val })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map((c) => (
                                            <SelectItem key={c.key} value={c.key}>
                                                {c.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Display Order</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={formData.order}
                                    onChange={(e) =>
                                        setFormData({ ...formData, order: e.target.value })
                                    }
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setShowDialog(false);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {editingVideo ? "Save Changes" : "Add Video"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog
                open={!!previewVideo}
                onOpenChange={(open) => !open && setPreviewVideo(null)}
            >
                <DialogContent className="max-w-4xl w-[95vw] p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-4 pb-0">
                        <DialogTitle className="pr-8">
                            {previewVideo?.title || "Preview"}
                        </DialogTitle>
                        <DialogDescription>
                            Preview how this video appears in the portfolio.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4">
                        {previewVideo && (
                            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                                <iframe
                                    src={getEmbedUrl(previewVideo.videoUrl)}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    title={previewVideo.title}
                                />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ── helper: extract embed URL ── */
function getEmbedUrl(url: string): string {
    const ytMatch = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
    );
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vmMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
    return url;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORTED COMPONENT — 2 tabs
   ═══════════════════════════════════════════════════════════════ */
export function PortfolioManagementTab() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 pb-6 border-b border-gray-200">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Portfolio Management
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Manage portfolio leads and control public video content
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/portfolio", "_blank")}
                >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Public Portfolio
                </Button>
            </div>

            <Tabs defaultValue="leads" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="leads" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Lead Management
                    </TabsTrigger>
                    <TabsTrigger value="content" className="flex items-center gap-2">
                        <Film className="h-4 w-4" />
                        Content Control
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="leads" className="mt-6">
                    <LeadManagement />
                </TabsContent>

                <TabsContent value="content" className="mt-6">
                    <ContentControl />
                </TabsContent>
            </Tabs>
        </div>
    );
}
