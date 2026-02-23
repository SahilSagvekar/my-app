"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
    LayoutGrid,
    List,
    Search,
    Download,
    ExternalLink,
    Instagram,
    Youtube,
    Twitter,
    Facebook,
    Video,
    FileText,
    Calendar as CalendarIcon,
    Filter,
    X,
    MoreVertical,
    Eye,
    Building,
} from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "@/lib/utils";
import { FilePreviewModal } from "../FileViewerModal";
import { toast } from "sonner";

interface SocialMediaLink {
    platform: string;
    url: string;
    postedAt: string;
}

interface PostedTask {
    id: string;
    title: string;
    deliverableType?: string;
    socialMediaLinks: SocialMediaLink[];
    updatedAt?: string;
    status: string;
    clientId: string;
    client?: {
        name: string;
        companyName?: string;
    };
    files?: any[];
}

export function SchedulerPostedArchivePage() {
    const [tasks, setTasks] = useState<PostedTask[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState("all");
    const [selectedPlatform, setSelectedPlatform] = useState("all");
    const [selectedType, setSelectedType] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Modals
    const [previewFile, setPreviewFile] = useState<any | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                // Fetch tasks and clients in parallel
                const [tasksRes, clientsRes] = await Promise.all([
                    fetch("/api/tasks?status=SCHEDULED"),
                    fetch("/api/clients")
                ]);

                const tasksData = await tasksRes.json();
                const clientsData = await clientsRes.json();

                setTasks(tasksData.tasks || []);
                setClients(clientsData.clients || []);
            } catch (err) {
                console.error("Error loading archive data:", err);
                toast.error("Failed to load archive data");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const deliverableTypes = useMemo(() => {
        const types = new Set<string>();
        tasks.forEach(t => {
            if (t.deliverableType) types.add(t.deliverableType);
        });
        return Array.from(types).sort();
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            // Search filter
            const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());

            // Client filter
            const matchesClient = selectedClient === "all" || task.clientId === selectedClient;

            // Platform filter
            const matchesPlatform = selectedPlatform === "all" || task.socialMediaLinks.some(link =>
                link.platform.toLowerCase() === selectedPlatform.toLowerCase()
            );

            // Type filter
            const matchesType = selectedType === "all" || task.deliverableType === selectedType;

            // Date filter
            let matchesDate = true;
            if (task.updatedAt) {
                const taskDate = new Date(task.updatedAt);
                if (dateFrom && taskDate < new Date(dateFrom)) matchesDate = false;
                if (dateTo && taskDate > new Date(dateTo)) matchesDate = false;
            }

            return matchesSearch && matchesClient && matchesPlatform && matchesType && matchesDate;
        });
    }, [tasks, searchQuery, selectedClient, selectedPlatform, selectedType, dateFrom, dateTo]);

    const exportToCSV = () => {
        const headers = ["Title", "Client", "Deliverable Type", "Platforms", "Links", "Date Posted"];
        const rows = filteredTasks.map(task => [
            task.title,
            task.client?.companyName || task.client?.name || "N/A",
            task.deliverableType || "N/A",
            task.socialMediaLinks.map(l => l.platform).join(", "),
            task.socialMediaLinks.map(l => l.url).join(", "),
            task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : "N/A"
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `posted_content_archive_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform.toLowerCase()) {
            case "instagram": return <Instagram className="h-4 w-4" />;
            case "youtube": return <Youtube className="h-4 w-4" />;
            case "twitter": return <Twitter className="h-4 w-4" />;
            case "facebook": return <Facebook className="h-4 w-4" />;
            case "tiktok": return <Video className="h-4 w-4" />;
            default: return <FileText className="h-4 w-4" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground">Loading archive...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1>Posted Content Archive</h1>
                    <p className="text-muted-foreground mt-1">
                        Browse and filter through all previously published content
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center border rounded-lg bg-background p-1">
                        <Button
                            variant={viewMode === "grid" ? "secondary" : "ghost"}
                            size="sm"
                            className="px-2 h-8"
                            onClick={() => setViewMode("grid")}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === "table" ? "secondary" : "ghost"}
                            size="sm"
                            className="px-2 h-8"
                            onClick={() => setViewMode("table")}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {/* Search */}
                        <div className="space-y-2 md:col-span-2">
                            <Label>Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by title..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Client Filter */}
                        <div className="space-y-2">
                            <Label>Client</Label>
                            <Select value={selectedClient} onValueChange={setSelectedClient}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Clients" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Clients</SelectItem>
                                    {clients.map(client => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.companyName || client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Platform Filter */}
                        <div className="space-y-2">
                            <Label>Platform</Label>
                            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Platforms" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Platforms</SelectItem>
                                    <SelectItem value="instagram">Instagram</SelectItem>
                                    <SelectItem value="tiktok">TikTok</SelectItem>
                                    <SelectItem value="youtube">YouTube</SelectItem>
                                    <SelectItem value="facebook">Facebook</SelectItem>
                                    <SelectItem value="twitter">Twitter</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Type Filter */}
                        <div className="space-y-2">
                            <Label>Content Type</Label>
                            <Select value={selectedType} onValueChange={setSelectedType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {deliverableTypes.map(type => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Clear All */}
                        <div className="flex items-end">
                            {(searchQuery || selectedClient !== "all" || selectedPlatform !== "all" || selectedType !== "all" || dateFrom || dateTo) && (
                                <Button variant="ghost" className="w-full text-xs" onClick={() => {
                                    setSearchQuery("");
                                    setSelectedClient("all");
                                    setSelectedPlatform("all");
                                    setSelectedType("all");
                                    setDateFrom("");
                                    setDateTo("");
                                }}>
                                    <X className="h-3 w-3 mr-1" />
                                    Clear Filters
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label>From Date</Label>
                            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>To Date</Label>
                            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Content Archive */}
            {filteredTasks.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <h3>No content found</h3>
                    <p className="text-muted-foreground mt-1">Try adjusting your filters or search query</p>
                </div>
            ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredTasks.map((task) => (
                        <Card key={task.id} className="overflow-hidden group hover:ring-2 hover:ring-primary/20 transition-all">
                            <div className="aspect-video bg-muted relative">
                                {/* Fallback pattern for thumbnail */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                    <Video className="h-12 w-12" />
                                </div>
                                {/* Info Overlay */}
                                <div className="absolute top-2 right-2 flex gap-1">
                                    {task.socialMediaLinks.map((link, idx) => (
                                        <Badge key={idx} variant="secondary" className="bg-white/90 backdrop-blur shadow-sm p-1">
                                            {getPlatformIcon(link.platform)}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h4 className="font-medium line-clamp-2 min-h-[40px] text-sm leading-tight">
                                        {task.title}
                                    </h4>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => {
                                                if (task.files && task.files.length > 0) {
                                                    setPreviewFile(task.files[0]);
                                                    setIsPreviewOpen(true);
                                                } else {
                                                    toast.error("No preview file available");
                                                }
                                            }}>
                                                <Eye className="h-4 w-4 mr-2" />
                                                Preview
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                                if (task.socialMediaLinks[0]?.url) {
                                                    window.open(task.socialMediaLinks[0].url, "_blank");
                                                }
                                            }}>
                                                <ExternalLink className="h-4 w-4 mr-2" />
                                                View Live
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="space-y-2 mt-4">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md">
                                        <Building className="h-3 w-3" />
                                        <span className="truncate">{task.client?.companyName || task.client?.name || "Multiple Clients"}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md">
                                        <FileText className="h-3 w-3" />
                                        <span>{task.deliverableType || "General Content"}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md">
                                        <CalendarIcon className="h-3 w-3" />
                                        <span>{task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : "N/A"}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Platforms</TableHead>
                                <TableHead>Posted Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTasks.map((task) => (
                                <TableRow key={task.id}>
                                    <TableCell className="font-medium max-w-[250px] truncate">
                                        {task.title}
                                    </TableCell>
                                    <TableCell>{task.client?.companyName || task.client?.name || "N/A"}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{task.deliverableType || "General"}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            {task.socialMediaLinks.map((link, idx) => (
                                                <div key={idx} title={link.platform}>
                                                    {getPlatformIcon(link.platform)}
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : "N/A"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                                                if (task.files && task.files.length > 0) {
                                                    setPreviewFile(task.files[0]);
                                                    setIsPreviewOpen(true);
                                                }
                                            }}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                                                if (task.socialMediaLinks[0]?.url) {
                                                    window.open(task.socialMediaLinks[0].url, "_blank");
                                                }
                                            }}>
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {/* File Preview Modal */}
            <FilePreviewModal
                file={previewFile}
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
            />
        </div>
    );
}
