"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "../ui/dropdown-menu";
import {
    Search,
    ExternalLink,
    ChevronDown,
    ChevronRight,
    RefreshCw,
    Filter,
    Instagram,
    Youtube,
    Facebook,
    Linkedin,
    Twitter,
    Clock,
    Calendar,
    Loader2,
    Video,
    Image as ImageIcon,
    FileText,
    Eye,
    Download,
    CheckCircle,
    LayoutGrid,
    List,
    Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { FilePreviewModal } from '../FileViewerModal';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

// Custom TikTok Icon Component
const TikTokIcon = ({ className }: { className?: string }) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className}
    >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
);

// Platform icons and colors
const PLATFORMS: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
    instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-50' },
    youtube: { label: 'YouTube', icon: Youtube, color: 'text-red-600', bgColor: 'bg-red-50' },
    tiktok: { label: 'TikTok', icon: TikTokIcon, color: 'text-black', bgColor: 'bg-gray-100' },
    facebook: { label: 'Facebook', icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    linkedin: { label: 'LinkedIn', icon: Linkedin, color: 'text-blue-700', bgColor: 'bg-blue-50' },
    twitter: { label: 'X', icon: Twitter, color: 'text-gray-900', bgColor: 'bg-gray-100' },
};

type PlatformKey = keyof typeof PLATFORMS;

interface SocialMediaLink {
    platform: string;
    url: string;
    postedAt: string;
}

interface PostedTask {
    id: string;
    title: string;
    description?: string;
    status: string;
    dueDate?: string;
    createdAt: string;
    deliverableType?: string;
    socialMediaLinks: SocialMediaLink[];
    suggestedTitles?: string[];
    files: {
        id: string | number;
        name: string;
        url?: string;
        size: number;
        mimeType?: string;
        folderType?: string;
        s3Key?: string;
    }[];
    deliverable?: {
        id: string;
        type: string;
        platforms?: string[];
    };
}

interface DateGroup {
    date: string;
    displayDate: string;
    items: Array<{ task: PostedTask; link: SocialMediaLink }>;
}

interface ClientPostedContentViewProps {
    clientId?: string;
}

// View mode toggle
type ViewMode = 'table' | 'grid';

export function ClientPostedContentView({ clientId }: ClientPostedContentViewProps) {
    const [tasks, setTasks] = useState<PostedTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
    const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'scheduled'>('all');
    const [platformFilter, setPlatformFilter] = useState<string[]>([]);
    const [deliverableFilter, setDeliverableFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState<string>('30d');
    const [viewMode, setViewMode] = useState<ViewMode>('table');

    // Signed URLs cache
    const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

    // File preview
    const [previewFile, setPreviewFile] = useState<any | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Unique deliverable types for filter
    const [availableDeliverables, setAvailableDeliverables] = useState<string[]>([]);

    useEffect(() => {
        fetchPostedContent();
    }, [clientId]);

    async function fetchPostedContent() {
        try {
            setLoading(true);
            
            // Use same data source as PostedContentSidebar — fetch tasks with status filter
            const url = clientId
                ? `/api/tasks?clientId=${clientId}&status=SCHEDULED,POSTED`
                : `/api/tasks?status=SCHEDULED,POSTED`;
            
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch posted content");
            
            const data = await res.json();
            
            const postedTasks: PostedTask[] = (data.tasks || [])
                .filter((task: any) => {
                    const status = (task.status || "").toUpperCase();
                    const isValidStatus = status === "SCHEDULED" || status === "POSTED";
                    let links = task.socialMediaLinks;
                    if (typeof links === "string") {
                        try { links = JSON.parse(links); } catch { links = []; }
                    }
                    return isValidStatus && Array.isArray(links) && links.length > 0;
                })
                .map((task: any) => {
                    let smLinks = task.socialMediaLinks;
                    if (typeof smLinks === "string") {
                        try { smLinks = JSON.parse(smLinks); } catch { smLinks = []; }
                    }
                    return {
                        id: task.id,
                        title: task.title || 'Untitled',
                        description: task.description || '',
                        status: task.status,
                        createdAt: task.createdAt,
                        dueDate: task.dueDate,
                        deliverableType: task.deliverableType || task.monthlyDeliverable?.type,
                        socialMediaLinks: smLinks || [],
                        suggestedTitles: task.suggestedTitles || [],
                        files: (task.files || [])
                            .filter((f: any) => f.isActive !== false)
                            .map((f: any) => ({
                                id: f.id,
                                name: f.name,
                                url: f.url,
                                size: f.size || 0,
                                mimeType: f.mimeType || '',
                                folderType: f.folderType,
                                s3Key: f.s3Key,
                            })),
                        deliverable: task.monthlyDeliverable ? {
                            id: task.monthlyDeliverable.id,
                            type: task.monthlyDeliverable.type,
                            platforms: task.monthlyDeliverable.platforms,
                        } : task.oneOffDeliverable ? {
                            id: task.oneOffDeliverable.id,
                            type: task.oneOffDeliverable.type,
                            platforms: task.oneOffDeliverable.platforms,
                        } : undefined,
                    };
                });
            
            setTasks(postedTasks);

            // Extract unique deliverable types
            const types = new Set<string>();
            postedTasks.forEach(t => {
                if (t.deliverableType) types.add(t.deliverableType);
            });
            setAvailableDeliverables(Array.from(types).sort());

            // Auto-expand all date groups initially
            const allDates = new Set<string>();
            postedTasks.forEach(task => {
                task.socialMediaLinks.forEach(link => {
                    const date = new Date(link.postedAt).toDateString();
                    allDates.add(date);
                });
            });
            setExpandedDates(allDates);

        } catch (err) {
            console.error("Error fetching posted content:", err);
            toast.error("Failed to load posted content");
        } finally {
            setLoading(false);
        }
    }

    // Filter tasks and create items
    const filteredItems = useMemo(() => {
        const items: Array<{ task: PostedTask; link: SocialMediaLink }> = [];
        const now = new Date();
        
        tasks.forEach(task => {
            task.socialMediaLinks.forEach(link => {
                // Search filter
                const matchesSearch = !debouncedSearchTerm || 
                    task.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
                
                // Platform filter
                const matchesPlatform = platformFilter.length === 0 || 
                    platformFilter.includes(link.platform.toLowerCase());
                
                // Deliverable filter
                const matchesDeliverable = deliverableFilter === 'all' || 
                    task.deliverableType === deliverableFilter;
                
                // Status filter
                const matchesStatus = statusFilter === 'all' ||
                    (statusFilter === 'posted' && task.status?.toUpperCase() === 'POSTED') ||
                    (statusFilter === 'scheduled' && task.status?.toUpperCase() === 'SCHEDULED');

                // Date range filter
                let matchesDateRange = true;
                if (dateRange !== 'all') {
                    const postedDate = new Date(link.postedAt);
                    const daysAgo = Math.floor((now.getTime() - postedDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (dateRange === '7d') matchesDateRange = daysAgo <= 7;
                    else if (dateRange === '30d') matchesDateRange = daysAgo <= 30;
                    else if (dateRange === '90d') matchesDateRange = daysAgo <= 90;
                }

                if (matchesSearch && matchesPlatform && matchesDeliverable && matchesStatus && matchesDateRange) {
                    items.push({ task, link });
                }
            });
        });

        // Sort by posted date descending
        return items.sort((a, b) => new Date(b.link.postedAt).getTime() - new Date(a.link.postedAt).getTime());
    }, [tasks, debouncedSearchTerm, platformFilter, deliverableFilter, statusFilter, dateRange]);

    // Group by date
    const groupedByDate = useMemo((): DateGroup[] => {
        const groups: Record<string, typeof filteredItems> = {};
        
        filteredItems.forEach(item => {
            const dateKey = new Date(item.link.postedAt).toDateString();
            const displayDate = new Date(item.link.postedAt).toLocaleDateString("en-US", {
                weekday: 'long',
                year: "numeric",
                month: "long",
                day: "numeric",
            });
            
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(item);
        });

        return Object.entries(groups).map(([dateKey, items]) => ({
            date: dateKey,
            displayDate: new Date(dateKey).toLocaleDateString("en-US", {
                weekday: 'long',
                year: "numeric",
                month: "long",
                day: "numeric",
            }),
            items,
        }));
    }, [filteredItems]);

    // Toggle date group expansion
    const toggleDateGroup = (date: string) => {
        setExpandedDates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(date)) newSet.delete(date);
            else newSet.add(date);
            return newSet;
        });
    };

    // Toggle row expansion
    const toggleRow = (taskId: string, linkIndex: number) => {
        const key = `${taskId}-${linkIndex}`;
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) newSet.delete(key);
            else {
                newSet.add(key);
                fetchSignedUrls(taskId);
            }
            return newSet;
        });
    };

    // Fetch signed URLs for files
    async function fetchSignedUrls(taskId: string) {
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.files.length === 0) return;

        const fileIds = task.files
            .filter(f => f.id && !signedUrls[String(f.id)])
            .map(f => String(f.id));

        if (fileIds.length === 0) return;

        try {
            const res = await fetch('/api/files/batch-presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileIds }),
            });

            if (res.ok) {
                const data = await res.json();
                setSignedUrls(prev => ({ ...prev, ...data.urls }));
            }
        } catch (error) {
            console.error('Failed to fetch signed URLs:', error);
        }
    }

    const getFileUrl = (file: { id: string | number; url?: string }) => {
        return signedUrls[String(file.id)] || file.url || '';
    };

    const downloadFile = (file: any) => {
        if (file.id) {
            window.open(`/api/files/${file.id}/download`, '_blank');
        } else if (file.url) {
            window.open(file.url, '_blank');
        }
    };

    // Stats
    const postedCount = filteredItems.filter(i => i.task.status?.toUpperCase() === 'POSTED').length;
    const scheduledCount = filteredItems.filter(i => i.task.status?.toUpperCase() === 'SCHEDULED').length;
    const hasActiveFilters = debouncedSearchTerm || platformFilter.length > 0 || deliverableFilter !== 'all' || statusFilter !== 'all';

    if (loading) {
        return (
            <div className="flex flex-col h-full space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Posted Content</h1>
                        <p className="text-muted-foreground mt-1 text-sm sm:text-lg">View all your published content across platforms</p>
                    </div>
                </div>
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
                    <Loader2 className="h-12 w-12 mx-auto mb-4 opacity-40 animate-spin" />
                    <p className="font-medium">Loading posted content...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Posted Content</h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-lg hidden sm:block">
                        View all your published content across platforms
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Stats badges */}
                    <div className="hidden sm:flex items-center gap-2">
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {postedCount} Posted
                        </Badge>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                            <Clock className="h-3 w-3 mr-1" />
                            {scheduledCount} Scheduled
                        </Badge>
                    </div>
                    
                    {/* View mode toggle */}
                    <div className="flex items-center border rounded-lg p-1 bg-zinc-100">
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                viewMode === 'table' ? "bg-white shadow-sm" : "hover:bg-white/50"
                            )}
                            title="Table view"
                        >
                            <List className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                viewMode === 'grid' ? "bg-white shadow-sm" : "hover:bg-white/50"
                            )}
                            title="Grid view"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                    </div>

                    <Button variant="outline" size="sm" onClick={fetchPostedContent}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-4 bg-white border rounded-lg p-3 shadow-sm">
                {/* Search */}
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-xs"
                    />
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-2 border-l pl-4">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Window:
                    </span>
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="h-9 w-[120px] text-xs">
                            <SelectValue placeholder="Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Last 7 Days</SelectItem>
                            <SelectItem value="30d">Last 30 Days</SelectItem>
                            <SelectItem value="90d">Last 90 Days</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center gap-1 border-l pl-4">
                    <Button
                        variant={statusFilter === "all" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setStatusFilter("all")}
                        className={cn("h-9 px-3 text-xs", statusFilter === "all" && "bg-slate-900 text-white")}
                    >
                        All
                    </Button>
                    <Button
                        variant={statusFilter === "posted" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setStatusFilter("posted")}
                        className={cn("h-9 px-3 text-xs", statusFilter === "posted" && "bg-emerald-600 text-white")}
                    >
                        Posted
                    </Button>
                    <Button
                        variant={statusFilter === "scheduled" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setStatusFilter("scheduled")}
                        className={cn("h-9 px-3 text-xs", statusFilter === "scheduled" && "bg-blue-600 text-white")}
                    >
                        Scheduled
                    </Button>
                </div>

                {/* Platform Filter */}
                <div className="flex items-center gap-2 border-l pl-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 text-xs">
                                <Filter className="h-3.5 w-3.5 mr-1.5" />
                                Platforms
                                {platformFilter.length > 0 && (
                                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                                        {platformFilter.length}
                                    </Badge>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs">Filter by Platform</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {Object.entries(PLATFORMS).map(([key, platform]) => {
                                const Icon = platform.icon;
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={key}
                                        checked={platformFilter.includes(key)}
                                        onCheckedChange={(checked) => {
                                            setPlatformFilter(prev =>
                                                checked ? [...prev, key] : prev.filter(p => p !== key)
                                            );
                                        }}
                                        className="text-xs"
                                    >
                                        <Icon className={cn("h-4 w-4 mr-2", platform.color)} />
                                        {platform.label}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Deliverable Type Filter */}
                {availableDeliverables.length > 0 && (
                    <div className="flex items-center gap-2 border-l pl-4">
                        <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" />
                            Type:
                        </span>
                        <Select value={deliverableFilter} onValueChange={setDeliverableFilter}>
                            <SelectTrigger className="h-9 w-[150px] text-xs">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {availableDeliverables.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Clear filters */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearchTerm('');
                            setPlatformFilter([]);
                            setDeliverableFilter('all');
                            setStatusFilter('all');
                        }}
                        className="h-9 text-xs text-muted-foreground hover:text-foreground"
                    >
                        Clear filters
                    </Button>
                )}
            </div>

            {/* Content */}
            {filteredItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-40 text-emerald-500" />
                    <p className="font-medium">No posted content found</p>
                    <p className="text-sm mt-1">
                        {hasActiveFilters
                            ? "Try adjusting your filters"
                            : "Content will appear here once it's posted"}
                    </p>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSearchTerm('');
                                setPlatformFilter([]);
                                setDeliverableFilter('all');
                                setStatusFilter('all');
                            }}
                            className="mt-4"
                        >
                            Clear all filters
                        </Button>
                    )}
                </div>
            ) : viewMode === 'table' ? (
                /* Table View - Grouped by Date */
                <div className="space-y-6">
                    {groupedByDate.map((group) => (
                        <div key={group.date} className="bg-white border rounded-lg overflow-hidden shadow-sm">
                            {/* Date Header - Collapsible */}
                            <button
                                onClick={() => toggleDateGroup(group.date)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b"
                            >
                                <div className="flex items-center gap-3">
                                    {expandedDates.has(group.date) ? (
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-gray-500" />
                                    )}
                                    <Calendar className="h-4 w-4 text-indigo-500" />
                                    <span className="font-semibold text-sm">{group.displayDate}</span>
                                </div>
                                <Badge variant="secondary" className="bg-white text-gray-600 border shadow-sm">
                                    {group.items.length} {group.items.length === 1 ? 'post' : 'posts'}
                                </Badge>
                            </button>

                            {/* Table Content */}
                            {expandedDates.has(group.date) && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="w-8 px-2"></th>
                                                <th className="px-3 py-2 text-left font-semibold text-xs text-gray-600">Title</th>
                                                <th className="px-3 py-2 text-left font-semibold text-xs text-gray-600">Platform</th>
                                                <th className="px-3 py-2 text-left font-semibold text-xs text-gray-600">Type</th>
                                                <th className="px-3 py-2 text-center font-semibold text-xs text-gray-600">Time</th>
                                                <th className="px-3 py-2 text-center font-semibold text-xs text-gray-600">Status</th>
                                                <th className="px-3 py-2 text-center font-semibold text-xs text-gray-600">Link</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {group.items.map(({ task, link }, idx) => {
                                                const platformKey = link.platform.toLowerCase() as PlatformKey;
                                                const platform = PLATFORMS[platformKey] || {
                                                    label: link.platform,
                                                    icon: Video,
                                                    color: 'text-gray-600',
                                                    bgColor: 'bg-gray-100',
                                                };
                                                const Icon = platform.icon;
                                                const rowKey = `${task.id}-${idx}`;
                                                const isExpanded = expandedRows.has(rowKey);

                                                return (
                                                    <React.Fragment key={rowKey}>
                                                        <tr className={cn(
                                                            "hover:bg-gray-50 transition-colors",
                                                            task.status?.toUpperCase() === 'POSTED' ? 'bg-emerald-50/30' : 'bg-blue-50/30'
                                                        )}>
                                                            {/* Expand */}
                                                            <td className="px-2 py-2">
                                                                <button
                                                                    onClick={() => toggleRow(task.id, idx)}
                                                                    className="p-1 hover:bg-gray-200 rounded"
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    )}
                                                                </button>
                                                            </td>

                                                            {/* Title */}
                                                            <td className="px-3 py-2 max-w-[250px]">
                                                                <p className="font-medium text-sm truncate" title={task.title}>
                                                                    {task.title}
                                                                </p>
                                                            </td>

                                                            {/* Platform */}
                                                            <td className="px-3 py-2">
                                                                <div className={cn(
                                                                    "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium",
                                                                    platform.bgColor
                                                                )}>
                                                                    <Icon className={cn("h-3.5 w-3.5", platform.color)} />
                                                                    <span className={platform.color}>{platform.label}</span>
                                                                </div>
                                                            </td>

                                                            {/* Deliverable Type */}
                                                            <td className="px-3 py-2">
                                                                {task.deliverableType && (
                                                                    <Badge variant="outline" className="text-[10px] font-medium">
                                                                        {task.deliverableType}
                                                                    </Badge>
                                                                )}
                                                            </td>

                                                            {/* Time */}
                                                            <td className="px-3 py-2 text-center">
                                                                <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {new Date(link.postedAt).toLocaleTimeString("en-US", {
                                                                        hour: "numeric",
                                                                        minute: "2-digit",
                                                                        hour12: true
                                                                    })}
                                                                </span>
                                                            </td>

                                                            {/* Status */}
                                                            <td className="px-3 py-2 text-center">
                                                                <Badge className={cn(
                                                                    "border-none text-[10px] font-bold",
                                                                    task.status?.toUpperCase() === 'POSTED'
                                                                        ? "bg-emerald-100 text-emerald-700"
                                                                        : "bg-blue-100 text-blue-700"
                                                                )}>
                                                                    {task.status?.toUpperCase() === 'POSTED' ? 'Posted' : 'Scheduled'}
                                                                </Badge>
                                                            </td>

                                                            {/* Link */}
                                                            <td className="px-3 py-2 text-center">
                                                                <a
                                                                    href={link.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                                >
                                                                    View
                                                                    <ExternalLink className="h-3 w-3" />
                                                                </a>
                                                            </td>
                                                        </tr>

                                                        {/* Expanded Row */}
                                                        {isExpanded && (
                                                            <tr className="bg-gray-50">
                                                                <td colSpan={7} className="px-6 py-4">
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                        {/* Files */}
                                                                        <div>
                                                                            <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                                                                                <FileText className="h-4 w-4 text-indigo-500" />
                                                                                Files ({task.files.length})
                                                                            </h4>
                                                                            {task.files.length > 0 ? (
                                                                                <div className="space-y-2">
                                                                                    {task.files.slice(0, 5).map((file) => {
                                                                                        const isVideo = file.mimeType?.startsWith('video/');
                                                                                        const isImage = file.mimeType?.startsWith('image/');
                                                                                        const FileIcon = isVideo ? Video : isImage ? ImageIcon : FileText;

                                                                                        return (
                                                                                            <div
                                                                                                key={file.id}
                                                                                                className="flex items-center justify-between p-2 bg-white rounded-lg border group"
                                                                                            >
                                                                                                <div className="flex items-center gap-2 min-w-0">
                                                                                                    <FileIcon className="h-4 w-4 text-gray-400 shrink-0" />
                                                                                                    <span className="text-xs truncate">{file.name}</span>
                                                                                                </div>
                                                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                                    <Button
                                                                                                        variant="ghost"
                                                                                                        size="sm"
                                                                                                        className="h-7 w-7 p-0"
                                                                                                        onClick={() => {
                                                                                                            setPreviewFile({ ...file, url: getFileUrl(file) });
                                                                                                            setIsPreviewOpen(true);
                                                                                                        }}
                                                                                                    >
                                                                                                        <Eye className="h-3.5 w-3.5" />
                                                                                                    </Button>
                                                                                                    <Button
                                                                                                        variant="ghost"
                                                                                                        size="sm"
                                                                                                        className="h-7 w-7 p-0"
                                                                                                        onClick={() => downloadFile(file)}
                                                                                                    >
                                                                                                        <Download className="h-3.5 w-3.5" />
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                    {task.files.length > 5 && (
                                                                                        <p className="text-xs text-muted-foreground">
                                                                                            +{task.files.length - 5} more files
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <p className="text-xs text-muted-foreground">No files attached</p>
                                                                            )}
                                                                        </div>

                                                                        {/* Post Details */}
                                                                        <div>
                                                                            <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                                                                                <ExternalLink className="h-4 w-4 text-indigo-500" />
                                                                                Post Details
                                                                            </h4>
                                                                            <div className="space-y-2 text-xs">
                                                                                <div className="flex items-start gap-2">
                                                                                    <span className="text-muted-foreground w-16 shrink-0">URL:</span>
                                                                                    <a
                                                                                        href={link.url}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="text-blue-600 hover:underline truncate"
                                                                                    >
                                                                                        {link.url}
                                                                                    </a>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-muted-foreground w-16">Posted:</span>
                                                                                    <span>
                                                                                        {new Date(link.postedAt).toLocaleString("en-US", {
                                                                                            month: 'short',
                                                                                            day: 'numeric',
                                                                                            year: 'numeric',
                                                                                            hour: 'numeric',
                                                                                            minute: '2-digit',
                                                                                            hour12: true
                                                                                        })}
                                                                                    </span>
                                                                                </div>
                                                                                {task.description && (
                                                                                    <div className="flex items-start gap-2">
                                                                                        <span className="text-muted-foreground w-16 shrink-0">Desc:</span>
                                                                                        <span className="text-gray-600">{task.description}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            {/* Suggested Titles */}
                                                                            {task.suggestedTitles && task.suggestedTitles.length > 0 && (
                                                                                <div className="mt-4">
                                                                                    <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                                                                                        <FileText className="h-4 w-4 text-yellow-500" />
                                                                                        Title
                                                                                    </h4>
                                                                                    <div className="space-y-1">
                                                                                        {task.suggestedTitles.map((title, i) => (
                                                                                            <div 
                                                                                                key={i}
                                                                                                className="p-2 bg-white rounded-lg border text-sm"
                                                                                            >
                                                                                                {typeof title === 'string' ? title : (title as any)?.title || String(title)}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                /* Grid View - Grouped by Date */
                <div className="space-y-10">
                    {groupedByDate.map((group) => (
                        <section key={group.date}>
                            {/* Date header */}
                            <div className="flex items-center gap-3 mb-5">
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Calendar className="h-4 w-4" />
                                    <h3 className="text-sm font-semibold tracking-tight">{group.displayDate}</h3>
                                </div>
                                <div className="flex-1 h-px bg-gray-100" />
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-gray-100 text-gray-500 font-medium">
                                    {group.items.length} {group.items.length === 1 ? 'post' : 'posts'}
                                </Badge>
                            </div>

                            {/* Cards Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                {group.items.map(({ task, link }, idx) => {
                                    const platformKey = link.platform.toLowerCase() as PlatformKey;
                                    const platform = PLATFORMS[platformKey] || {
                                        label: link.platform,
                                        icon: Video,
                                        color: 'text-gray-600',
                                        bgColor: 'bg-gray-100',
                                    };
                                    const Icon = platform.icon;

                                    return (
                                        <div
                                            key={`${task.id}-${idx}`}
                                            className="group cursor-pointer border-none shadow-sm transition-all duration-300 rounded-[1.25rem] overflow-hidden flex flex-col bg-white hover:shadow-md hover:ring-1 hover:ring-gray-200"
                                            onClick={() => window.open(link.url, "_blank")}
                                        >
                                            {/* Visual Header */}
                                            <div className="h-32 relative flex items-center justify-center bg-gray-50">
                                                <div className={cn(
                                                    "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm",
                                                    platformKey === 'instagram' ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600' :
                                                    platformKey === 'youtube' ? 'bg-red-600' :
                                                    platformKey === 'tiktok' ? 'bg-black' :
                                                    platformKey === 'facebook' ? 'bg-blue-600' :
                                                    platformKey === 'linkedin' ? 'bg-blue-700' :
                                                    platformKey === 'twitter' ? 'bg-black' : 'bg-gray-500'
                                                )}>
                                                    <Icon className="h-6 w-6 text-white" />
                                                </div>

                                                {/* Status pill */}
                                                <div className="absolute top-3 right-3">
                                                    <Badge className={cn(
                                                        "border-none rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1",
                                                        task.status?.toUpperCase() === 'POSTED'
                                                            ? "bg-emerald-50 text-emerald-600"
                                                            : "bg-blue-50 text-blue-600"
                                                    )}>
                                                        {task.status?.toUpperCase() === 'POSTED' ? (
                                                            <><CheckCircle className="h-2.5 w-2.5" /> Posted</>
                                                        ) : (
                                                            <><Clock className="h-2.5 w-2.5" /> Scheduled</>
                                                        )}
                                                    </Badge>
                                                </div>

                                                {/* Platform label */}
                                                <div className="absolute top-3 left-3">
                                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/80 text-gray-700 text-[11px] font-semibold border border-gray-200/50 shadow-sm backdrop-blur-sm">
                                                        <Icon className={cn("h-3 w-3", platform.color)} />
                                                        {platform.label}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Card Body */}
                                            <div className="p-4 flex flex-col gap-2">
                                                <h4 className="text-gray-900 font-bold text-sm line-clamp-2 group-hover:text-gray-700 transition-colors">
                                                    {task.title}
                                                </h4>

                                                <div className="flex items-center justify-between text-gray-500 text-[11px]">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(link.postedAt).toLocaleTimeString("en-US", {
                                                            hour: "numeric",
                                                            minute: "2-digit"
                                                        })}
                                                    </div>

                                                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-gray-600 transition-colors">
                                                        <ExternalLink className="h-3 w-3" />
                                                        <span className="text-[10px] font-medium">View</span>
                                                    </div>
                                                </div>

                                                {task.deliverableType && (
                                                    <Badge variant="secondary" className="w-fit bg-gray-50 text-gray-500 text-[9px] font-medium px-2 py-0.5 rounded-md border-none">
                                                        {task.deliverableType}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {/* Summary footer */}
            <div className="mt-6 flex justify-center">
                <div className="text-sm text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{filteredItems.length}</span> posts across <span className="font-medium text-foreground">{groupedByDate.length}</span> days
                </div>
            </div>

            {/* File Preview Modal */}
            {previewFile && (
                <FilePreviewModal
                    file={previewFile}
                    open={isPreviewOpen}
                    onOpenChange={setIsPreviewOpen}
                />
            )}
        </div>
    );
}