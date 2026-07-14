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
    Search,
    ExternalLink,
    ChevronDown,
    ChevronRight,
    RefreshCw,
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
    Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { FilePreviewModal } from '../FileViewerModal';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

// Custom TikTok Icon Component
const TikTokIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
);

// Platform registry
const PLATFORMS: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
    instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-50' },
    youtube: { label: 'YouTube', icon: Youtube, color: 'text-red-600', bgColor: 'bg-red-50' },
    tiktok: { label: 'TikTok', icon: TikTokIcon, color: 'text-gray-900', bgColor: 'bg-gray-100' },
    facebook: { label: 'Facebook', icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    linkedin: { label: 'LinkedIn', icon: Linkedin, color: 'text-blue-700', bgColor: 'bg-blue-50' },
    twitter: { label: 'X', icon: Twitter, color: 'text-gray-900', bgColor: 'bg-gray-100' },
};

type PlatformKey = keyof typeof PLATFORMS;

// Some legacy/manually-entered links are missing a protocol (e.g. "tiktok.com/@x/video/1"),
// which makes the browser resolve <a href> as relative to the current page instead of opening
// the external site. Force an absolute URL before rendering any link.
function toAbsoluteUrl(url: string): string {
    if (!url) return url;
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

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
    /** All social links across all platforms for this task */
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
    tasks: PostedTask[];
}

interface ClientPostedContentViewProps {
    clientId?: string;
}

type ViewMode = 'table' | 'grid';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the earliest postedAt date across all social links for a task. */
function getEarliestDate(task: PostedTask): Date {
    if (task.socialMediaLinks.length === 0) return new Date(task.createdAt);
    return new Date(
        Math.min(...task.socialMediaLinks.map((l) => new Date(l.postedAt).getTime()))
    );
}

/** Header icon background colour for a given platform key in the grid card. */
function platformCardBg(key: string): string {
    switch (key) {
        case 'instagram': return 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600';
        case 'youtube':   return 'bg-red-600';
        case 'tiktok':    return 'bg-black';
        case 'facebook':  return 'bg-blue-600';
        case 'linkedin':  return 'bg-blue-700';
        case 'twitter':   return 'bg-black';
        default:          return 'bg-gray-500';
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ClientPostedContentView({ clientId }: ClientPostedContentViewProps) {
    const [tasks, setTasks] = useState<PostedTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
    const [statusFilter, setStatusFilter] = useState<'all' | 'posted'>('all');
    const [deliverableFilter, setDeliverableFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState<string>('30d');
    const [viewMode, setViewMode] = useState<ViewMode>('table');

    const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
    const [previewFile, setPreviewFile] = useState<any | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [availableDeliverables, setAvailableDeliverables] = useState<string[]>([]);

    useEffect(() => {
        if (!clientId) return;
        fetchPostedContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    // ── Data fetching ────────────────────────────────────────────────────────

    async function fetchPostedContent() {
        if (!clientId) return;
        try {
            setLoading(true);

            const [pcRes, taskRes] = await Promise.all([
                fetch(`/api/posted-content?clientId=${clientId}&limit=9999`, {
                    cache: 'no-store',
                    credentials: 'include',
                }),
                fetch(`/api/tasks?clientId=${clientId}&status=POSTED,COMPLETED,SCHEDULED`, {
                    cache: 'no-store',
                    credentials: 'include',
                }),
            ]);

            // ── Source 1: PostedContent rows → merge per-platform rows into one task entry ──
            if (!pcRes.ok)
                console.error('[PostedContent] API error:', pcRes.status, await pcRes.text().catch(() => ''));
            const pcData = pcRes.ok ? await pcRes.json() : { contents: [] };

            const pcGrouped: Record<string, PostedTask> = {};
            for (const pc of pcData.contents ?? []) {
                // Group by taskId when available, otherwise by normalised title
                const groupKey = pc.taskId
                    ? `task:${pc.taskId}`
                    : `title:${(pc.title ?? 'untitled').toLowerCase().trim()}`;

                if (!pcGrouped[groupKey]) {
                    pcGrouped[groupKey] = {
                        id: pc.taskId ?? `pc-${pc.id}`,
                        title: pc.title || 'Untitled',
                        description: '',
                        status: 'POSTED',
                        createdAt: pc.createdAt,
                        dueDate: pc.postedAt,
                        deliverableType: pc.deliverableType,
                        socialMediaLinks: [],
                        suggestedTitles: [],
                        files: [],
                    };
                }

                // Avoid duplicate platform+url combinations
                const isDuplicate = pcGrouped[groupKey].socialMediaLinks.some(
                    (l) => l.platform === pc.platform && l.url === pc.url
                );
                if (!isDuplicate) {
                    pcGrouped[groupKey].socialMediaLinks.push({
                        platform: pc.platform,
                        url: pc.url,
                        postedAt: pc.postedAt,
                    });
                }
            }
            const fromPostedContent = Object.values(pcGrouped);

            // ── Source 2: Task records with POSTED status + socialMediaLinks ──
            const taskData = taskRes.ok ? await taskRes.json() : { tasks: [] };
            const fromTasks: PostedTask[] = (taskData.tasks ?? [])
                .filter((task: any) => {
                    const isPosted = (task.status ?? '').toUpperCase() === 'POSTED';
                    let links = task.socialMediaLinks;
                    if (typeof links === 'string') {
                        try { links = JSON.parse(links); } catch { links = []; }
                    }
                    return isPosted && Array.isArray(links) && links.length > 0;
                })
                .map((task: any) => {
                    let smLinks = task.socialMediaLinks;
                    if (typeof smLinks === 'string') {
                        try { smLinks = JSON.parse(smLinks); } catch { smLinks = []; }
                    }
                    return {
                        id: task.id,
                        title: task.title || 'Untitled',
                        description: task.description || '',
                        status: 'POSTED',
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
                        deliverable: task.monthlyDeliverable
                            ? { id: task.monthlyDeliverable.id, type: task.monthlyDeliverable.type, platforms: task.monthlyDeliverable.platforms }
                            : task.oneOffDeliverable
                            ? { id: task.oneOffDeliverable.id, type: task.oneOffDeliverable.type, platforms: task.oneOffDeliverable.platforms }
                            : undefined,
                    };
                });

            // Deduplicate: if a PC group's id already appears in fromTasks (richer), drop the PC entry
            const taskIds = new Set(fromTasks.map((t) => t.id));
            const allPosts: PostedTask[] = [
                ...fromPostedContent.filter((pc) => !taskIds.has(pc.id)),
                ...fromTasks,
            ];

            setTasks(allPosts);

            // Unique deliverable types for filter
            const types = new Set<string>();
            allPosts.forEach((t) => { if (t.deliverableType) types.add(t.deliverableType); });
            setAvailableDeliverables(Array.from(types).sort());

            // Auto-expand all date groups on load
            const allDates = new Set<string>();
            allPosts.forEach((task) => { allDates.add(getEarliestDate(task).toDateString()); });
            setExpandedDates(allDates);
        } catch (err) {
            console.error('Error fetching posted content:', err);
            toast.error('Failed to load posted content');
        } finally {
            setLoading(false);
        }
    }

    // ── Derived state ────────────────────────────────────────────────────────

    /** One entry per task (not per link). */
    const filteredTasks = useMemo(() => {
        const now = new Date();
        return tasks
            .filter((task) => {
                const matchesSearch =
                    !debouncedSearchTerm ||
                    task.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

                const matchesDeliverable =
                    deliverableFilter === 'all' || task.deliverableType === deliverableFilter;

                const matchesStatus = statusFilter === 'all' || statusFilter === 'posted';

                // Task qualifies if ANY of its links falls within the selected date window
                let matchesDateRange = true;
                if (dateRange !== 'all') {
                    matchesDateRange = task.socialMediaLinks.some((link) => {
                        const daysAgo = Math.floor(
                            (now.getTime() - new Date(link.postedAt).getTime()) / 86_400_000
                        );
                        return dateRange === '7d'
                            ? daysAgo <= 7
                            : dateRange === '30d'
                            ? daysAgo <= 30
                            : daysAgo <= 90;
                    });
                }

                return matchesSearch && matchesDeliverable && matchesStatus && matchesDateRange;
            })
            // Sort newest first based on earliest link date
            .sort((a, b) => getEarliestDate(b).getTime() - getEarliestDate(a).getTime());
    }, [tasks, debouncedSearchTerm, deliverableFilter, statusFilter, dateRange]);

    /** Group tasks by the earliest link date. */
    const groupedByDate = useMemo((): DateGroup[] => {
        const groups: Record<string, PostedTask[]> = {};
        filteredTasks.forEach((task) => {
            const dateKey = getEarliestDate(task).toDateString();
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(task);
        });
        return Object.entries(groups)
            .map(([dateKey, tasks]) => ({
                date: dateKey,
                displayDate: new Date(dateKey).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                }),
                tasks,
            }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filteredTasks]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const toggleDateGroup = (date: string) => {
        setExpandedDates((prev) => {
            const s = new Set(prev);
            s.has(date) ? s.delete(date) : s.add(date);
            return s;
        });
    };

    const toggleRow = (taskId: string) => {
        setExpandedRows((prev) => {
            const s = new Set(prev);
            if (s.has(taskId)) {
                s.delete(taskId);
            } else {
                s.add(taskId);
                fetchSignedUrls(taskId);
            }
            return s;
        });
    };

    async function fetchSignedUrls(taskId: string) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task || task.files.length === 0) return;

        const fileIds = task.files
            .filter((f) => f.id && !signedUrls[String(f.id)])
            .map((f) => String(f.id));
        if (fileIds.length === 0) return;

        try {
            const res = await fetch('/api/files/batch-presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileIds }),
            });
            if (res.ok) {
                const data = await res.json();
                setSignedUrls((prev) => ({ ...prev, ...data.urls }));
            }
        } catch (e) {
            console.error('Failed to fetch signed URLs:', e);
        }
    }

    const getFileUrl = (file: { id: string | number; url?: string }) =>
        signedUrls[String(file.id)] || file.url || '';

    const downloadFile = (file: any) => {
        if (file.id) window.open(`/api/files/${file.id}/download`, '_blank');
        else if (file.url) window.open(file.url, '_blank');
    };

    const hasActiveFilters = !!(
        debouncedSearchTerm || deliverableFilter !== 'all' || statusFilter !== 'all'
    );
    const clearFilters = () => {
        setSearchTerm('');
        setDeliverableFilter('all');
        setStatusFilter('all');
    };

    // ── Early returns ─────────────────────────────────────────────────────────

    if (!clientId) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
                <p className="font-medium">No client account linked</p>
                <p className="text-sm mt-1">Contact your account manager to set up access.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col h-full space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                            Posted Content
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm sm:text-lg">
                            View all your published content across platforms
                        </p>
                    </div>
                </div>
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
                    <Loader2 className="h-12 w-12 mx-auto mb-4 opacity-40 animate-spin" />
                    <p className="font-medium">Loading posted content…</p>
                </div>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                        Posted Content
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-lg hidden sm:block">
                        View all your published content across platforms
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2">
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {filteredTasks.length} Posted
                        </Badge>
                    </div>
                    {/* View mode toggle */}
                    <div className="flex items-center border rounded-lg p-1 bg-zinc-100">
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                'p-1.5 rounded transition-colors',
                                viewMode === 'table' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                            )}
                            title="Table view"
                        >
                            <List className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                'p-1.5 rounded transition-colors',
                                viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
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

            {/* ── Filters Bar ── */}
            <div className="flex flex-wrap items-center gap-4 bg-white border rounded-lg p-3 shadow-sm">
                {/* Search */}
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title…"
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
                        variant={statusFilter === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setStatusFilter('all')}
                        className={cn('h-9 px-3 text-xs', statusFilter === 'all' && 'bg-slate-900 text-white')}
                    >
                        All
                    </Button>
                    <Button
                        variant={statusFilter === 'posted' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setStatusFilter('posted')}
                        className={cn('h-9 px-3 text-xs', statusFilter === 'posted' && 'bg-emerald-600 text-white')}
                    >
                        Posted
                    </Button>
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
                        onClick={clearFilters}
                        className="h-9 text-xs text-muted-foreground hover:text-foreground"
                    >
                        Clear filters
                    </Button>
                )}
            </div>

            {/* ── Content ── */}
            {filteredTasks.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-40 text-emerald-500" />
                    <p className="font-medium">No posted content found</p>
                    <p className="text-sm mt-1">
                        {hasActiveFilters
                            ? 'Try adjusting your filters'
                            : "Content will appear here once it's posted"}
                    </p>
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-4">
                            Clear all filters
                        </Button>
                    )}
                </div>

            ) : viewMode === 'table' ? (

                /* ════════════════════════════════════════
                   TABLE VIEW — one row per task
                   ════════════════════════════════════════ */
                <div className="space-y-6">
                    {groupedByDate.map((group) => (
                        <div key={group.date} className="bg-white border rounded-lg overflow-hidden shadow-sm">

                            {/* Date Header — collapsible */}
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
                                    {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                                </Badge>
                            </button>

                            {/* Table */}
                            {expandedDates.has(group.date) && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="w-8 px-2" />
                                                <th className="px-3 py-2 text-left font-semibold text-xs text-gray-600">
                                                    Title
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold text-xs text-gray-600">
                                                    Platforms
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold text-xs text-gray-600">
                                                    Type
                                                </th>
                                                <th className="px-3 py-2 text-center font-semibold text-xs text-gray-600">
                                                    Time
                                                </th>
                                                <th className="px-3 py-2 text-center font-semibold text-xs text-gray-600">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {group.tasks.map((task) => {
                                                const isExpanded = expandedRows.has(task.id);
                                                const earliestDate = getEarliestDate(task);

                                                return (
                                                    <React.Fragment key={task.id}>
                                                        {/* ── Main row ── */}
                                                        <tr className="hover:bg-gray-50 transition-colors bg-emerald-50/30">

                                                            {/* Expand toggle */}
                                                            <td className="px-2 py-2.5">
                                                                <button
                                                                    onClick={() => toggleRow(task.id)}
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
                                                            <td className="px-3 py-2.5 max-w-[250px]">
                                                                <p
                                                                    className="font-medium text-sm truncate"
                                                                    title={task.title}
                                                                >
                                                                    {task.title}
                                                                </p>
                                                            </td>

                                                            {/* Platforms — all links as clickable chips */}
                                                            <td className="px-3 py-2.5">
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {task.socialMediaLinks.map((link, i) => {
                                                                        const platKey = link.platform.toLowerCase() as PlatformKey;
                                                                        const plat = PLATFORMS[platKey] ?? {
                                                                            label: link.platform,
                                                                            icon: Video,
                                                                            color: 'text-gray-600',
                                                                            bgColor: 'bg-gray-100',
                                                                        };
                                                                        const Icon = plat.icon;
                                                                        return (
                                                                            <a
                                                                                key={i}
                                                                                href={toAbsoluteUrl(link.url)}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                title={`View on ${plat.label}`}
                                                                                className={cn(
                                                                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                                                                                    'hover:opacity-75 transition-opacity',
                                                                                    plat.bgColor
                                                                                )}
                                                                            >
                                                                                <Icon className={cn('h-3 w-3', plat.color)} />
                                                                                <span className={plat.color}>{plat.label}</span>
                                                                                <ExternalLink className="h-2.5 w-2.5 opacity-40" />
                                                                            </a>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </td>

                                                            {/* Deliverable type */}
                                                            <td className="px-3 py-2.5">
                                                                {task.deliverableType && (
                                                                    <Badge variant="outline" className="text-[10px] font-medium">
                                                                        {task.deliverableType}
                                                                    </Badge>
                                                                )}
                                                            </td>

                                                            {/* Time (earliest) */}
                                                            <td className="px-3 py-2.5 text-center">
                                                                <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {earliestDate.toLocaleTimeString('en-US', {
                                                                        hour: 'numeric',
                                                                        minute: '2-digit',
                                                                        hour12: true,
                                                                    })}
                                                                </span>
                                                            </td>

                                                            {/* Status */}
                                                            <td className="px-3 py-2.5 text-center">
                                                                <Badge className="border-none text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                                    Posted
                                                                </Badge>
                                                            </td>
                                                        </tr>

                                                        {/* ── Expanded detail row ── */}
                                                        {isExpanded && (
                                                            <tr className="bg-gray-50">
                                                                <td colSpan={6} className="px-6 py-5">
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
                                                                                                key={String(file.id)}
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

                                                                        {/* Posted Links — all platforms listed */}
                                                                        <div>
                                                                            <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                                                                                <ExternalLink className="h-4 w-4 text-indigo-500" />
                                                                                Posted Links ({task.socialMediaLinks.length})
                                                                            </h4>
                                                                            <div className="space-y-2">
                                                                                {task.socialMediaLinks.map((link, i) => {
                                                                                    const platKey = link.platform.toLowerCase() as PlatformKey;
                                                                                    const plat = PLATFORMS[platKey] ?? {
                                                                                        label: link.platform,
                                                                                        icon: Video,
                                                                                        color: 'text-gray-600',
                                                                                        bgColor: 'bg-gray-100',
                                                                                    };
                                                                                    const Icon = plat.icon;
                                                                                    return (
                                                                                        <div
                                                                                            key={i}
                                                                                            className="flex items-center gap-3 p-2.5 bg-white rounded-lg border"
                                                                                        >
                                                                                            {/* Platform badge */}
                                                                                            <div
                                                                                                className={cn(
                                                                                                    'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium shrink-0',
                                                                                                    plat.bgColor
                                                                                                )}
                                                                                            >
                                                                                                <Icon className={cn('h-3.5 w-3.5', plat.color)} />
                                                                                                <span className={plat.color}>{plat.label}</span>
                                                                                            </div>
                                                                                            {/* URL */}
                                                                                            <a
                                                                                                href={toAbsoluteUrl(link.url)}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-blue-600 hover:underline text-xs truncate flex-1 min-w-0"
                                                                                            >
                                                                                                {link.url}
                                                                                            </a>
                                                                                            {/* Date + View link */}
                                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                                <span className="text-[10px] text-muted-foreground">
                                                                                                    {new Date(link.postedAt).toLocaleDateString('en-US', {
                                                                                                        month: 'short',
                                                                                                        day: 'numeric',
                                                                                                    })}
                                                                                                </span>
                                                                                                <a
                                                                                                    href={toAbsoluteUrl(link.url)}
                                                                                                    target="_blank"
                                                                                                    rel="noopener noreferrer"
                                                                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                                                                >
                                                                                                    View
                                                                                                    <ExternalLink className="h-3 w-3" />
                                                                                                </a>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
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
                                                                                                {typeof title === 'string'
                                                                                                    ? title
                                                                                                    : (title as any)?.title || String(title)}
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

                /* ════════════════════════════════════════
                   GRID VIEW — one card per task
                   ════════════════════════════════════════ */
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
                                <Badge
                                    variant="secondary"
                                    className="h-5 px-1.5 text-[10px] bg-gray-100 text-gray-500 font-medium"
                                >
                                    {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                                </Badge>
                            </div>

                            {/* Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                {group.tasks.map((task) => {
                                    const primaryLink = task.socialMediaLinks[0];
                                    const primaryKey = (primaryLink?.platform ?? '').toLowerCase();
                                    const primaryPlat = PLATFORMS[primaryKey as PlatformKey] ?? {
                                        label: primaryLink?.platform ?? 'Post',
                                        icon: Video,
                                        color: 'text-gray-600',
                                        bgColor: 'bg-gray-100',
                                    };
                                    const PrimaryIcon = primaryPlat.icon;

                                    return (
                                        <div
                                            key={task.id}
                                            className="border-none shadow-sm transition-all duration-300 rounded-[1.25rem] overflow-hidden flex flex-col bg-white hover:shadow-md hover:ring-1 hover:ring-gray-200"
                                        >
                                            {/* Visual header */}
                                            <div className="h-28 relative flex items-center justify-center bg-gray-50">
                                                {/* Primary platform icon */}
                                                <div
                                                    className={cn(
                                                        'w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm',
                                                        platformCardBg(primaryKey)
                                                    )}
                                                >
                                                    <PrimaryIcon className="h-6 w-6 text-white" />
                                                </div>

                                                {/* Posted badge */}
                                                <div className="absolute top-3 right-3">
                                                    <Badge className="border-none rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1 bg-emerald-50 text-emerald-600">
                                                        <CheckCircle className="h-2.5 w-2.5" /> Posted
                                                    </Badge>
                                                </div>

                                                {/* Multi-platform indicator */}
                                                {task.socialMediaLinks.length > 1 && (
                                                    <div className="absolute top-3 left-3">
                                                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/80 text-gray-700 text-[11px] font-semibold border border-gray-200/50 shadow-sm backdrop-blur-sm">
                                                            <Link2 className="h-3 w-3" />
                                                            {task.socialMediaLinks.length} platforms
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Card body */}
                                            <div className="p-4 flex flex-col gap-3 flex-1">
                                                <h4 className="text-gray-900 font-bold text-sm line-clamp-2">
                                                    {task.title}
                                                </h4>

                                                {/* All platform chips — each is a direct link */}
                                                <div className="flex flex-wrap gap-1.5">
                                                    {task.socialMediaLinks.map((link, i) => {
                                                        const platKey = link.platform.toLowerCase() as PlatformKey;
                                                        const plat = PLATFORMS[platKey] ?? {
                                                            label: link.platform,
                                                            icon: Video,
                                                            color: 'text-gray-600',
                                                            bgColor: 'bg-gray-100',
                                                        };
                                                        const Icon = plat.icon;
                                                        return (
                                                            <a
                                                                key={i}
                                                                href={toAbsoluteUrl(link.url)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={cn(
                                                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                                                                    'hover:opacity-75 transition-opacity',
                                                                    plat.bgColor
                                                                )}
                                                                title={`View on ${plat.label}`}
                                                            >
                                                                <Icon className={cn('h-3 w-3', plat.color)} />
                                                                <span className={plat.color}>{plat.label}</span>
                                                            </a>
                                                        );
                                                    })}
                                                </div>

                                                {/* Footer row */}
                                                <div className="flex items-center justify-between text-gray-400 text-[11px] mt-auto">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {getEarliestDate(task).toLocaleTimeString('en-US', {
                                                            hour: 'numeric',
                                                            minute: '2-digit',
                                                        })}
                                                    </div>
                                                    {task.deliverableType && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="bg-gray-50 text-gray-500 text-[9px] font-medium px-2 py-0.5 rounded-md border-none"
                                                        >
                                                            {task.deliverableType}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {/* ── Footer summary ── */}
            <div className="mt-6 flex justify-center">
                <div className="text-sm text-muted-foreground">
                    Showing{' '}
                    <span className="font-medium text-foreground">{filteredTasks.length}</span>{' '}
                    {filteredTasks.length === 1 ? 'task' : 'tasks'} across{' '}
                    <span className="font-medium text-foreground">{groupedByDate.length}</span>{' '}
                    {groupedByDate.length === 1 ? 'day' : 'days'}
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