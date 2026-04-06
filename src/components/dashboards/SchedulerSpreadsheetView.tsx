"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
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
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
    Search,
    Download,
    Play,
    Eye,
    Check,
    X,
    Plus,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    ExternalLink,
    Sparkles,
    FileText,
    Video,
    Image as ImageIcon,
    Copy,
    RefreshCw,
    Filter,
    ArrowUpDown,
    Instagram,
    Youtube,
    Facebook,
    Linkedin,
    Twitter,
    Music,
    Clock,
    Pencil,
    Trash2,
    Package,
    Calendar,
    Loader2,
    Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { FilePreviewModal } from '../FileViewerModal';
import { useDebounce } from '@/hooks/useDebounce';

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
const PLATFORMS = {
    instagram: { label: 'IG', icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-50' },
    youtube: { label: 'YT', icon: Youtube, color: 'text-red-600', bgColor: 'bg-red-50' },
    tiktok: { label: 'TT', icon: TikTokIcon, color: 'text-black', bgColor: 'bg-gray-100' },
    facebook: { label: 'FB', icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    linkedin: { label: 'LI', icon: Linkedin, color: 'text-blue-700', bgColor: 'bg-blue-50' },
    twitter: { label: 'X', icon: Twitter, color: 'text-gray-900', bgColor: 'bg-gray-100' },
};

type PlatformKey = keyof typeof PLATFORMS;

interface SchedulerTask {
    id: string;
    title: string;
    description?: string;
    priority: string;
    status: string;
    dueDate?: string;
    files: {
        id: string | number;
        name: string;
        url?: string;
        size: number;
        mimeType?: string;
        folderType?: string;
        s3Key?: string;
    }[];
    createdAt: string;
    clientId: string;
    client?: {
        id?: string;
        name: string;
        companyName?: string;
    };
    deliverable?: {
        id: string;
        type: string;
        quantity?: number;
        videosPerDay?: number;
        postingSchedule?: string;
        postingDays?: string[];
        postingTimes?: string[];
        platforms?: string[];
        description?: string;
        isOneOff?: boolean;
    };
    socialMediaLinks?: Array<{ platform: string; url: string; postedAt: string }>;
    // AI Titling fields
    suggestedTitles?: Array<{ style?: string; title: string; reasoning?: string }> | string[];
    titlingStatus?: string;
}

// Deliverable interface for client deliverables display
interface ClientDeliverable {
    id: string;
    type: string;
    quantity: number;
    postingSchedule: string;
    postingDays: string[];
    postingTimes: string[];
    platforms: string[];
    description?: string;
    isOneOff?: boolean;
}

export function SchedulerSpreadsheetView() {
    const [tasks, setTasks] = useState<SchedulerTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [sortColumn, setSortColumn] = useState<string>('dueDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'scheduled'>('all');
    const [clientFilter, setClientFilter] = useState<string>('all');
    const [deliverableFilter, setDeliverableFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState<string>('30d');

    // Metadata for filters
    const [allClients, setAllClients] = useState<{ id: string; name: string, companyName?: string }[]>([]);
    const [allDeliverables, setAllDeliverables] = useState<string[]>([]);

    // Pagination/Load More state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalTasks, setTotalTasks] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [pageSize, setPageSize] = useState(50);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Client deliverables display
    const [clientDeliverables, setClientDeliverables] = useState<ClientDeliverable[]>([]);
    const [loadingDeliverables, setLoadingDeliverables] = useState(false);
    const [deliverablesExpanded, setDeliverablesExpanded] = useState(true);

    // Signed URLs cache (fileId -> signedUrl)
    const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

    // File preview
    const [previewFile, setPreviewFile] = useState<any | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Video player
    const [playingVideo, setPlayingVideo] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Social link dialog - now supports edit mode
    const [linkDialog, setLinkDialog] = useState<{ 
        open: boolean; 
        taskId: string; 
        platform: PlatformKey; 
        mode: 'add' | 'edit';
        existingUrl?: string;
        existingPostedAt?: string;
    } | null>(null);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkPostedAt, setLinkPostedAt] = useState('');
    const [submittingLink, setSubmittingLink] = useState(false);

    // Selected rows for bulk actions
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchMetadata();
    }, []);

    useEffect(() => {
        // Reset to first page and LOAD when filters change
        loadTasks(1, false);
    }, [debouncedSearchTerm, statusFilter, clientFilter, dateRange, deliverableFilter]);

    async function fetchMetadata() {
        try {
            const res = await fetch("/api/schedular/metadata", { cache: "no-store" });
            const data = await res.json();
            if (data.clients) setAllClients(data.clients);
            if (data.deliverableTypes) setAllDeliverables(data.deliverableTypes);
        } catch (error) {
            console.error("Error loading metadata:", error);
        }
    }

    async function loadTasks(pageNum: number = 1, isLoadMore: boolean = false) {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams({
                page: pageNum.toString(),
                limit: pageSize.toString(),
                search: debouncedSearchTerm,
                status: statusFilter,
                clientId: clientFilter,
                deliverableType: deliverableFilter,
                dateRange: dateRange
            });

            const res = await fetch(`/api/schedular/tasks?${queryParams.toString()}`, { cache: "no-store" });
            const data = await res.json();

            if (!data.tasks) {
                if (!isLoadMore) setTasks([]);
                setTotalTasks(0);
                setHasMore(false);
                return;
            }

            const mapped = data.tasks.map((t: any) => {
                const rawDeliverable = t.monthlyDeliverable || t.oneOffDeliverable;
                return {
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    priority: t.priority || "medium",
                    status: ['SCHEDULED', 'POSTED', 'PUBLISHED'].includes((t.status || '').toUpperCase()) ? 'SCHEDULED' : 'PENDING',
                    dueDate: t.dueDate,
                    files: (t.files || []).map((file: any) => ({
                        id: file.id,
                        name: file.name,
                        url: file.url || '',
                        size: file.size || 0,
                        mimeType: file.mimeType || '',
                        folderType: file.folderType || 'other',
                        s3Key: file.s3Key || '',
                    })),
                    createdAt: t.createdAt,
                    clientId: t.clientId,
                    client: t.client,
                    deliverable: rawDeliverable ? {
                        id: rawDeliverable.id,
                        type: rawDeliverable.type,
                        quantity: rawDeliverable.quantity,
                        videosPerDay: rawDeliverable.videosPerDay,
                        postingSchedule: rawDeliverable.postingSchedule,
                        postingDays: rawDeliverable.postingDays || [],
                        postingTimes: rawDeliverable.postingTimes || [],
                        platforms: rawDeliverable.platforms || [],
                        description: rawDeliverable.description,
                        isOneOff: !!t.oneOffDeliverable && !t.monthlyDeliverable,
                    } : undefined,
                    socialMediaLinks: t.socialMediaLinks || [],
                    suggestedTitles: t.suggestedTitles || [],
                    titlingStatus: t.titlingStatus || 'NONE',
                };
            });

            if (isLoadMore) {
                setTasks(prev => [...prev, ...mapped]);
            } else {
                setTasks(mapped);
            }
            
            setTotalTasks(data.total || 0);
            setHasMore(data.page < data.totalPages);
            setCurrentPage(data.page || 1);
            setIsInitialLoad(false);
        } catch (error) {
            console.error("Error loading tasks:", error);
            toast.error('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    }

    // Fetch deliverables when client is selected
    async function fetchClientDeliverables(clientId: string) {
        if (clientId === 'all') {
            setClientDeliverables([]);
            return;
        }

        try {
            setLoadingDeliverables(true);
            
            // Fetch both monthly and one-off deliverables
            const [monthlyRes, oneOffRes] = await Promise.all([
                fetch(`/api/clients/${clientId}/deliverables`, { cache: "no-store" }),
                fetch(`/api/clients/${clientId}/one-off-deliverables`, { cache: "no-store" })
            ]);

            const monthlyData = await monthlyRes.json();
            const oneOffData = await oneOffRes.json();

            const monthlyDeliverables: ClientDeliverable[] = (monthlyData.deliverables || []).map((d: any) => ({
                id: d.id,
                type: d.type,
                quantity: d.quantity,
                postingSchedule: d.postingSchedule,
                postingDays: d.postingDays || [],
                postingTimes: d.postingTimes || [],
                platforms: d.platforms || [],
                description: d.description,
                isOneOff: false,
            }));

            const oneOffDeliverables: ClientDeliverable[] = (oneOffData.deliverables || []).map((d: any) => ({
                id: d.id,
                type: d.type,
                quantity: d.quantity,
                postingSchedule: d.postingSchedule,
                postingDays: d.postingDays || [],
                postingTimes: d.postingTimes || [],
                platforms: d.platforms || [],
                description: d.description,
                isOneOff: true,
            }));

            setClientDeliverables([...monthlyDeliverables, ...oneOffDeliverables]);
            setDeliverablesExpanded(true);
        } catch (error) {
            console.error("Error loading client deliverables:", error);
            toast.error('Failed to load deliverables');
            setClientDeliverables([]);
        } finally {
            setLoadingDeliverables(false);
        }
    }

    // Handle client filter change
    function handleClientFilterChange(clientId: string) {
        setClientFilter(clientId);
        fetchClientDeliverables(clientId);
    }

    // Check if platform has a link
    const hasPlatformLink = (task: SchedulerTask, platform: PlatformKey): string | null => {
        const link = task.socialMediaLinks?.find(l => l.platform.toLowerCase() === platform);
        return link?.url || null;
    };

    // Add social media link
    async function submitSocialLink() {
        if (!linkDialog || !linkUrl) return;

        try {
            setSubmittingLink(true);
            
            const isEdit = linkDialog.mode === 'edit';
            const postedAtValue = linkPostedAt ? new Date(linkPostedAt).toISOString() : new Date().toISOString();
            
            const res = await fetch(`/api/tasks/${linkDialog.taskId}/social-media-link`, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: linkDialog.platform,
                    url: linkUrl,
                    postedAt: postedAtValue,
                }),
            });

            if (!res.ok) throw new Error(`Failed to ${isEdit ? 'update' : 'add'} link`);

            // Update local state
            setTasks(prev => prev.map(t => {
                if (t.id === linkDialog.taskId) {
                    if (isEdit) {
                        // Update existing link
                        return {
                            ...t,
                            socialMediaLinks: (t.socialMediaLinks || []).map(link =>
                                link.platform.toLowerCase() === linkDialog.platform.toLowerCase()
                                    ? { ...link, url: linkUrl, postedAt: postedAtValue }
                                    : link
                            )
                        };
                    } else {
                        // Add new link
                        return {
                            ...t,
                            socialMediaLinks: [
                                ...(t.socialMediaLinks || []),
                                { platform: linkDialog.platform, url: linkUrl, postedAt: postedAtValue }
                            ]
                        };
                    }
                }
                return t;
            }));

            toast.success(`${PLATFORMS[linkDialog.platform].label} link ${isEdit ? 'updated' : 'added'}!`);
            setLinkDialog(null);
            setLinkUrl('');
            setLinkPostedAt('');
        } catch (err) {
            toast.error(`Failed to ${linkDialog.mode === 'edit' ? 'update' : 'add'} link`);
        } finally {
            setSubmittingLink(false);
        }
    }

    // Delete social media link
    async function deleteSocialLink(taskId: string, platform: string) {
        if (!confirm(`Are you sure you want to remove this ${platform} link?`)) return;

        try {
            const res = await fetch(`/api/tasks/${taskId}/social-media-link`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform }),
            });

            if (!res.ok) throw new Error('Failed to delete link');

            // Update local state
            setTasks(prev => prev.map(t => {
                if (t.id === taskId) {
                    return {
                        ...t,
                        socialMediaLinks: (t.socialMediaLinks || []).filter(
                            link => link.platform.toLowerCase() !== platform.toLowerCase()
                        )
                    };
                }
                return t;
            }));

            toast.success('Link removed');
        } catch (err) {
            toast.error('Failed to remove link');
        }
    }

    // Mark task as scheduled
    async function markAsScheduled(taskId: string) {
        const task = tasks.find(t => t.id === taskId);
        if (!task?.socialMediaLinks?.length) {
            toast.error('Add at least one social media link first');
            return;
        }

        try {
            const res = await fetch(`/api/tasks/${taskId}/mark-scheduled`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ postedAt: new Date().toISOString() })
            });

            if (!res.ok) throw new Error("Failed to schedule");

            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, status: 'SCHEDULED' } : t
            ));

            toast.success('Marked as scheduled!');
        } catch (err) {
            toast.error('Failed to mark as scheduled');
        }
    }

    // Mark task as pending (revert)
    async function markAsPending(taskId: string) {
        try {
            const res = await fetch(`/api/tasks/${taskId}/mark-pending`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" }
            });

            if (!res.ok) throw new Error("Failed to revert to pending");

            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, status: 'PENDING' } : t
            ));

            toast.success('Reverted to pending!');
        } catch (err) {
            toast.error('Failed to revert status');
        }
    }

    // Bulk mark as scheduled
    async function bulkMarkAsScheduled() {
        const selectedTasks = tasks.filter(t => selectedRows.has(t.id));
        const tasksWithLinks = selectedTasks.filter(t => t.socialMediaLinks && t.socialMediaLinks.length > 0);

        if (tasksWithLinks.length === 0) {
            toast.error('Selected tasks need at least one social media link');
            return;
        }

        for (const task of tasksWithLinks) {
            await markAsScheduled(task.id);
        }

        setSelectedRows(new Set());
    }

    // Download file - always use the download API which signs on demand
    async function downloadFile(file: any) {
        try {
            if (file.id) {
                window.open(`/api/files/${file.id}/download`, '_blank');
                toast.success('Download started', { id: 'download' });
            } else if (file.url) {
                window.open(file.url, '_blank');
                toast.success('Download started', { id: 'download' });
            }
        } catch (error) {
            toast.error('Download failed', { id: 'download' });
        }
    }

    // Fetch signed URLs for a task's files (lazy signing on expand)
    async function fetchSignedUrls(taskId: string) {
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.files.length === 0) return;

        // Only sign files that don't already have a signed URL cached
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

            if (!res.ok) return;

            const data = await res.json();
            if (data.urls) {
                setSignedUrls(prev => ({ ...prev, ...data.urls }));
            }
        } catch (error) {
            console.error('Failed to fetch signed URLs:', error);
        }
    }

    // Helper to get the viewable URL for a file
    const getFileUrl = (file: { id: string | number; url?: string }) => {
        return signedUrls[String(file.id)] || file.url || '';
    };

    // Toggle row expansion
    const toggleRow = (taskId: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
                newSet.delete(taskId);
            } else {
                newSet.add(taskId);
                // Lazy-sign file URLs for this task
                fetchSignedUrls(taskId);
            }
            return newSet;
        });
    };

    // Sort handler
    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    // Tasks are already filtered and paginated on the server
    const displayTasks = tasks.sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortColumn) {
            case 'title': aVal = a.title; bVal = b.title; break;
            case 'client': aVal = a.client?.name || a.clientId; bVal = b.client?.name || b.clientId; break;
            case 'dueDate': aVal = new Date(a.dueDate || 0); bVal = new Date(b.dueDate || 0); break;
            case 'status': aVal = a.status; bVal = b.status; break;
            default: aVal = a.dueDate; bVal = b.dueDate;
        }
        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : -1;
        }
        return aVal < bVal ? 1 : -1;
    });

    const pendingCount = tasks.filter(t => t.status === 'PENDING').length;
    const scheduledCount = tasks.filter(t => t.status === 'SCHEDULED').length;

    // Metadata for dropdowns now comes from separate API
    const uniqueClients = allClients.map(c => [c.id, c.companyName || c.name] as [string, string]);
    const uniqueDeliverables = allDeliverables;

    // Copy title to clipboard - handle both string and object formats
    const copyTitle = (titleItem: any) => {
        const titleText = typeof titleItem === 'string' ? titleItem : titleItem?.title || '';
        navigator.clipboard.writeText(titleText);
        toast.success('Copied to clipboard!');
    };

    // Get title text from item (handles both string and object)
    const getTitleText = (titleItem: any): string => {
        return typeof titleItem === 'string' ? titleItem : titleItem?.title || '';
    };

    if (loading && isInitialLoad) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading tasks...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Scheduling Queue</h1>
                </div>
                <div className="flex items-center gap-2">
                    {selectedRows.size > 0 && (
                        <Button onClick={bulkMarkAsScheduled} size="sm">
                            <Check className="h-4 w-4 mr-2" />
                            Mark Selected ({selectedRows.size})
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => loadTasks()}>
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
                        placeholder="Search by title, client or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-xs"
                    />
                </div>
                
                {/* Date Selection */}
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
                        className={`h-9 px-3 text-xs ${statusFilter === 'all' ? 'bg-slate-900 text-white' : ''}`}
                    >
                        All
                    </Button>
                    <Button
                        variant={statusFilter === 'pending' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setStatusFilter('pending')}
                        className={`h-9 px-3 text-xs ${statusFilter === 'pending' ? 'bg-indigo-600 text-white' : ''}`}
                    >
                        Pending
                    </Button>
                    <Button
                        variant={statusFilter === 'scheduled' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setStatusFilter('scheduled')}
                        className={`h-9 px-3 text-xs ${statusFilter === 'scheduled' ? 'bg-emerald-600 text-white' : ''}`}
                    >
                        Scheduled
                    </Button>
                </div>

                {/* Client Filter */}
                <div className="flex items-center gap-2 border-l pl-4">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        Client:
                    </span>
                    <Select value={clientFilter} onValueChange={handleClientFilterChange}>
                        <SelectTrigger className="h-9 w-[150px] text-xs">
                            <SelectValue placeholder="All Clients" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            <SelectItem value="all">All Clients</SelectItem>
                            {uniqueClients.map(([id, name]) => (
                                <SelectItem key={id} value={id}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Deliverable Type Filter */}
                <div className="flex items-center gap-2 border-l pl-4">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" />
                        Type:
                    </span>
                    <Select value={deliverableFilter} onValueChange={setDeliverableFilter}>
                        <SelectTrigger className="h-9 w-[130px] text-xs">
                            <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {uniqueDeliverables.map((type) => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Client Deliverables Display */}
            {clientFilter !== 'all' && (
                <div className="bg-white border rounded-lg overflow-hidden">
                    <button
                        onClick={() => setDeliverablesExpanded(!deliverablesExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                                Deliverables for {uniqueClients.find(([id]) => id === clientFilter)?.[1] || 'Client'}
                            </span>
                            {clientDeliverables.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                    {clientDeliverables.length}
                                </Badge>
                            )}
                        </div>
                        {loadingDeliverables ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : deliverablesExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>

                    {deliverablesExpanded && (
                        <div className="border-t px-4 py-3">
                            {loadingDeliverables ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                                    <span className="text-sm text-muted-foreground">Loading deliverables...</span>
                                </div>
                            ) : clientDeliverables.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground">
                                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">No deliverables configured for this client</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {clientDeliverables.map((deliverable) => (
                                        <div
                                            key={deliverable.id}
                                            className={`p-3 rounded-lg border ${
                                                deliverable.isOneOff 
                                                    ? 'bg-amber-50 border-amber-200' 
                                                    : 'bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            {/* Type & Quantity */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm">{deliverable.type}</span>
                                                    {deliverable.isOneOff && (
                                                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-300">
                                                            One-Off
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Badge variant="secondary" className="text-xs font-bold">
                                                    ×{deliverable.quantity}
                                                </Badge>
                                            </div>

                                            {/* Posting Schedule */}
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                                                <Calendar className="h-3 w-3" />
                                                <span className="capitalize">{deliverable.postingSchedule}</span>
                                                {deliverable.postingDays.length > 0 && (
                                                    <span className="text-gray-400">
                                                        • {deliverable.postingDays.slice(0, 3).join(', ')}
                                                        {deliverable.postingDays.length > 3 && '...'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Posting Times */}
                                            {deliverable.postingTimes.length > 0 && (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                                                    <Clock className="h-3 w-3" />
                                                    <span>
                                                        {deliverable.postingTimes.slice(0, 2).join(', ')}
                                                        {deliverable.postingTimes.length > 2 && ` +${deliverable.postingTimes.length - 2}`}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Platforms */}
                                            {deliverable.platforms.length > 0 && (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {deliverable.platforms.map((platform) => {
                                                        const platformKey = platform.toLowerCase() as PlatformKey;
                                                        const platformInfo = PLATFORMS[platformKey];
                                                        if (!platformInfo) {
                                                            return (
                                                                <Badge key={platform} variant="outline" className="text-[10px] h-5 px-1.5">
                                                                    {platform}
                                                                </Badge>
                                                            );
                                                        }
                                                        const Icon = platformInfo.icon;
                                                        return (
                                                            <div
                                                                key={platform}
                                                                className={`inline-flex items-center justify-center w-6 h-6 rounded ${platformInfo.bgColor}`}
                                                                title={platform}
                                                            >
                                                                <Icon className={`h-3.5 w-3.5 ${platformInfo.color}`} />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Description (if any) */}
                                            {deliverable.description && (
                                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                                    {deliverable.description}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Spreadsheet Table */}
            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        {/* Header */}
                        <thead className="bg-gray-50 border-b sticky top-0 z-10">
                            <tr>
                                <th className="w-10 px-3 py-3 text-left">
                                    <Checkbox
                                        checked={selectedRows.size === tasks.length && tasks.length > 0}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedRows(new Set(tasks.map(t => t.id)));
                                            } else {
                                                setSelectedRows(new Set());
                                            }
                                        }}
                                    />
                                </th>
                                <th className="w-8 px-2"></th>
                                <th
                                    className="px-3 py-3 text-left font-semibold cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('title')}
                                >
                                    <div className="flex items-center gap-1">
                                        Task Title
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('client')}
                                >
                                    <div className="flex items-center gap-1">
                                        Client
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('dueDate')}
                                >
                                    <div className="flex items-center gap-1">
                                        Due
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </th>
                                <th className="px-3 py-3 text-center font-semibold">
                                    <div className="flex items-center justify-center gap-1">
                                        <FileText className="h-4 w-4" />
                                        Files
                                    </div>
                                </th>
                                <th className="px-3 py-3 text-center font-semibold">
                                    <div className="flex items-center justify-center gap-1">
                                        <Sparkles className="h-4 w-4 text-yellow-500" />
                                        AI Title
                                    </div>
                                </th>
                                {/* Platform columns */}
                                {Object.entries(PLATFORMS).map(([key, platform]) => (
                                    <th key={key} className="px-2 py-3 text-center font-semibold w-12">
                                        <div className="flex justify-center" title={platform.label}>
                                            <platform.icon className={`h-4 w-4 ${platform.color}`} />
                                        </div>
                                    </th>
                                ))}
                                <th
                                    className="px-3 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('status')}
                                >
                                    Status
                                </th>
                            </tr>
                        </thead>

                        {/* Body */}
                        <tbody className={`divide-y ${loading && !isInitialLoad ? 'opacity-50 pointer-events-none' : ''}`}>
                            {tasks.length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="px-6 py-12 text-center text-muted-foreground">
                                        {loading ? (
                                            <div className="flex flex-col items-center justify-center">
                                                <RefreshCw className="h-8 w-8 animate-spin mb-4 text-primary" />
                                                <p>Finding tasks...</p>
                                            </div>
                                        ) : (
                                            <>
                                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                                                <p className="font-medium">No tasks found</p>
                                                <p className="text-sm mt-1">Adjust your filters or wait for new tasks</p>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                displayTasks.map((task) => {
                                    const isExpanded = expandedRows.has(task.id);
                                    const videoFiles = task.files.filter(f => f.mimeType?.startsWith('video/'));
                                    const imageFiles = task.files.filter(f => f.mimeType?.startsWith('image/'));
                                    const hasLinks = task.socialMediaLinks && task.socialMediaLinks.length > 0;

                                    return (
                                        <React.Fragment key={task.id}>
                                            {/* Main Row */}
                                            <tr
                                                className={`hover:bg-gray-50 transition-colors ${task.status === 'SCHEDULED' ? 'bg-green-50' : ''
                                                    } ${selectedRows.has(task.id) ? 'bg-blue-50' : ''}`}
                                            >
                                                {/* Checkbox */}
                                                <td className="px-3 py-3">
                                                    <Checkbox
                                                        checked={selectedRows.has(task.id)}
                                                        onCheckedChange={(checked) => {
                                                            const newSet = new Set(selectedRows);
                                                            if (checked) {
                                                                newSet.add(task.id);
                                                            } else {
                                                                newSet.delete(task.id);
                                                            }
                                                            setSelectedRows(newSet);
                                                        }}
                                                    />
                                                </td>

                                                {/* Expand */}
                                                <td className="px-2 py-3">
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
                                                <td className="px-3 py-3 max-w-[200px]">
                                                    <p className="font-medium truncate" title={task.title}>
                                                        {task.title}
                                                    </p>
                                                </td>

                                                {/* Client */}
                                                <td className="px-3 py-3">
                                                    <span className="text-muted-foreground text-xs">
                                                        {task.client?.companyName || task.client?.name || task.clientId}
                                                    </span>
                                                </td>

                                                {/* Due Date */}
                                                <td className="px-3 py-3">
                                                    <span className="text-xs">
                                                        {task.dueDate
                                                            ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                            : '-'
                                                        }
                                                    </span>
                                                </td>

                                                {/* Files */}
                                                <td className="px-3 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {videoFiles.length > 0 && (
                                                            <Badge variant="outline" className="text-xs px-1.5">
                                                                <Video className="h-3 w-3 mr-1" />
                                                                {videoFiles.length}
                                                            </Badge>
                                                        )}
                                                        {imageFiles.length > 0 && (
                                                            <Badge variant="outline" className="text-xs px-1.5">
                                                                <ImageIcon className="h-3 w-3 mr-1" />
                                                                {imageFiles.length}
                                                            </Badge>
                                                        )}
                                                        {task.files.length === 0 && (
                                                            <span className="text-muted-foreground text-xs">-</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* AI Title */}
                                                <td className="px-3 py-3 text-center">
                                                    {task.titlingStatus === 'COMPLETED' && task.suggestedTitles?.length ? (
                                                        <button
                                                            onClick={() => copyTitle(task.suggestedTitles![0])}
                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 hover:bg-yellow-100 rounded text-xs font-medium text-yellow-800 border border-yellow-200"
                                                            title={getTitleText(task.suggestedTitles[0])}
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                            Copy
                                                        </button>
                                                    ) : task.titlingStatus === 'PROCESSING' ? (
                                                        <Badge variant="outline" className="text-xs">
                                                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                            Processing
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    )}
                                                </td>

                                                {/* Platform columns */}
                                                {Object.entries(PLATFORMS).map(([key, platform]) => {
                                                    const linkUrl = hasPlatformLink(task, key as PlatformKey);
                                                    const Icon = platform.icon;
                                                    
                                                    // Check if this platform is in the task's deliverable
                                                    const deliverablePlatforms = task.deliverable?.platforms?.map((p: string) => p.toLowerCase()) || [];
                                                    const isPlatformInDeliverable = deliverablePlatforms.length === 0 || deliverablePlatforms.includes(key.toLowerCase());
                                                    
                                                    return (
                                                        <td key={key} className="px-2 py-3 text-center">
                                                            {linkUrl ? (
                                                                <button
                                                                    onClick={() => window.open(linkUrl, '_blank')}
                                                                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${platform.bgColor} ${platform.color} border border-current opacity-80 hover:opacity-100 transition-opacity`}
                                                                    title={`View ${key} post`}
                                                                >
                                                                    <Icon className="h-4 w-4" />
                                                                </button>
                                                            ) : isPlatformInDeliverable ? (
                                                                <button
                                                                    onClick={() => setLinkDialog({ open: true, taskId: task.id, platform: key as PlatformKey, mode: 'add' })}
                                                                    className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-50 text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors border border-dashed border-gray-300"
                                                                    title={`Add ${key} link`}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </button>
                                                            ) : (
                                                                <span 
                                                                    className="inline-flex items-center justify-center w-7 h-7 text-gray-200"
                                                                    title={`${key} not configured for this deliverable`}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Status */}
                                                <td className="px-3 py-3 text-center">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            {task.status === 'SCHEDULED' ? (
                                                                <Button variant="ghost" className="h-7 text-xs bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 gap-1 px-2">
                                                                    ✓ Scheduled
                                                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                                                </Button>
                                                            ) : (
                                                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                                                    Pending
                                                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                                                </Button>
                                                            )}
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {task.status !== 'SCHEDULED' ? (
                                                                <DropdownMenuItem
                                                                    onClick={() => markAsScheduled(task.id)}
                                                                    className="text-green-600 font-medium"
                                                                >
                                                                    <Check className="h-4 w-4 mr-2" />
                                                                    Mark as Scheduled
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem
                                                                    onClick={() => markAsPending(task.id)}
                                                                    className="text-amber-600 font-medium"
                                                                >
                                                                    <Clock className="h-4 w-4 mr-2" />
                                                                    Revert to Pending
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>

                                            {/* Expanded Row - Files & Details */}
                                            {isExpanded && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan={13} className="px-6 py-4">
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            {/* Files Section */}
                                                            <div>
                                                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                                                    <FileText className="h-4 w-4" />
                                                                    Task Files ({task.files.length})
                                                                </h4>
                                                                {task.files.length === 0 ? (
                                                                    <p className="text-muted-foreground text-sm">No files attached</p>
                                                                ) : (
                                                                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                                                        {(() => {
                                                                            // Group files by folderType
                                                                            const grouped = task.files.reduce((acc, file) => {
                                                                                const folderType = file.folderType || 'Uncategorized';
                                                                                if (!acc[folderType]) acc[folderType] = [];
                                                                                acc[folderType].push(file);
                                                                                return acc;
                                                                            }, {} as Record<string, typeof task.files>);

                                                                            // Sort: main first, thumbnails & music-license last
                                                                            const folderOrder: Record<string, number> = {
                                                                                'main': 0,
                                                                                'covers': 1,
                                                                                'tiles': 2,
                                                                                'other': 3,
                                                                                'Uncategorized': 4,
                                                                                'thumbnails': 5,
                                                                                'music-license': 6,
                                                                            };

                                                                            return Object.entries(grouped)
                                                                                .sort(([a], [b]) => (folderOrder[a] ?? 3) - (folderOrder[b] ?? 3));
                                                                        })().map(([folderType, folderFiles]) => (
                                                                            <div key={folderType} className="space-y-2">
                                                                                <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-gray-100 px-2 py-1 rounded inline-block">
                                                                                    {folderType.replace(/_/g, ' ')}
                                                                                </h5>
                                                                                <div className="space-y-2">
                                                                                    {folderFiles.map((file) => {
                                                                                        const isVideo = file.mimeType?.startsWith('video/');
                                                                                        const isImage = file.mimeType?.startsWith('image/');

                                                                                        return (
                                                                                            <div
                                                                                                key={file.id}
                                                                                                className="flex items-center justify-between p-2 bg-white rounded-lg border hover:border-primary/30 transition-colors"
                                                                                            >
                                                                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                                                    {isVideo ? (
                                                                                                        <Video className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                                                                    ) : isImage ? (
                                                                                                        <ImageIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                                                                    ) : (
                                                                                                        <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                                                                    )}
                                                                                                    <div className="min-w-0">
                                                                                                        <p className="font-medium text-[13px] truncate">{file.name}</p>
                                                                                                        <p className="text-[10px] text-muted-foreground">
                                                                                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                                                                                        </p>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <Button
                                                                                                        size="sm"
                                                                                                        variant="ghost"
                                                                                                        onClick={() => {
                                                                                                            setPreviewFile({ ...file, url: getFileUrl(file) });
                                                                                                            setIsPreviewOpen(true);
                                                                                                        }}
                                                                                                        className="h-7 w-7 p-0"
                                                                                                    >
                                                                                                        <Eye className="h-3 w-3" />
                                                                                                    </Button>
                                                                                                    <Button
                                                                                                        size="sm"
                                                                                                        variant="ghost"
                                                                                                        onClick={() => downloadFile(file)}
                                                                                                        className="h-7 w-7 p-0"
                                                                                                    >
                                                                                                        <Download className="h-3 w-3" />
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Inline Video Player */}
                                                                {playingVideo && task.files.some(f => getFileUrl(f) === playingVideo) && (
                                                                    <div className="mt-4 bg-black rounded-lg overflow-hidden">
                                                                        <video
                                                                            ref={videoRef}
                                                                            src={playingVideo}
                                                                            controls
                                                                            autoPlay
                                                                            className="w-full max-h-64"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* AI Titles & Details */}
                                                            <div>
                                                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                                                    <Sparkles className="h-4 w-4 text-yellow-500" />
                                                                    AI Suggested Titles
                                                                </h4>
                                                                {task.suggestedTitles && task.suggestedTitles.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        {task.suggestedTitles.slice(0, 5).map((title, i) => (
                                                                            <div
                                                                                key={i}
                                                                                className="flex items-center justify-between p-3 bg-white rounded-lg border hover:bg-gray-50"
                                                                            >
                                                                                <p className="text-sm flex-1 mr-2">{getTitleText(title)}</p>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={() => copyTitle(title)}
                                                                                    className="h-8"
                                                                                >
                                                                                    <Copy className="h-3 w-3" />
                                                                                </Button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-4 bg-white rounded-lg border text-center">
                                                                        <p className="text-muted-foreground text-sm">
                                                                            {task.titlingStatus === 'PROCESSING'
                                                                                ? 'AI titles are being generated...'
                                                                                : 'No AI titles generated yet'
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {/* Social Links Summary */}
                                                                {task.socialMediaLinks && task.socialMediaLinks.length > 0 && (
                                                                    <div className="mt-4">
                                                                        <h4 className="font-semibold mb-2 text-sm">Posted Links</h4>
                                                                        <div className="space-y-2">
                                                                            {task.socialMediaLinks.map((link, i) => {
                                                                                const platformKey = link.platform.toLowerCase() as PlatformKey;
                                                                                const platform = PLATFORMS[platformKey];
                                                                                const Icon = platform?.icon || ExternalLink;
                                                                                
                                                                                return (
                                                                                    <div
                                                                                        key={i}
                                                                                        className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group"
                                                                                    >
                                                                                        <div className={`p-1 rounded ${platform?.bgColor || 'bg-gray-100'}`}>
                                                                                            <Icon className={`h-3.5 w-3.5 ${platform?.color || 'text-gray-600'}`} />
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <a
                                                                                                href={link.url}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-sm text-blue-600 hover:underline truncate block"
                                                                                            >
                                                                                                {link.url.length > 50 ? link.url.slice(0, 50) + '...' : link.url}
                                                                                            </a>
                                                                                            {link.postedAt && (
                                                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                                                    <Clock className="h-2.5 w-2.5" />
                                                                                                    {new Date(link.postedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="sm"
                                                                                                className="h-7 w-7 p-0"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setLinkUrl(link.url);
                                                                                                    if (link.postedAt) {
                                                                                                        const dt = new Date(link.postedAt);
                                                                                                        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                                                                                        setLinkPostedAt(local);
                                                                                                    }
                                                                                                    setLinkDialog({
                                                                                                        open: true,
                                                                                                        taskId: task.id,
                                                                                                        platform: platformKey,
                                                                                                        mode: 'edit',
                                                                                                        existingUrl: link.url,
                                                                                                        existingPostedAt: link.postedAt
                                                                                                    });
                                                                                                }}
                                                                                                title="Edit link"
                                                                                            >
                                                                                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                                                                            </Button>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="sm"
                                                                                                className="h-7 w-7 p-0 hover:bg-red-50"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    deleteSocialLink(task.id, link.platform);
                                                                                                }}
                                                                                                title="Remove link"
                                                                                            >
                                                                                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Task Deliverable Info */}
                                                        {task.clientId && task.deliverable && (
                                                            <div className="mt-4 pt-4 border-t">
                                                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                                                    <Package className="h-4 w-4 text-indigo-500" />
                                                                    Deliverable Info
                                                                    <span className="text-xs font-normal text-muted-foreground">
                                                                        — {task.client?.companyName || task.client?.name || 'Client'}
                                                                    </span>
                                                                </h4>

                                                                <div className="p-3 rounded-lg border-2 border-indigo-200 bg-indigo-50">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-semibold text-sm">{task.deliverable.type}</span>
                                                                            {task.deliverable.isOneOff && (
                                                                                <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-300">
                                                                                    One-Off
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        {task.deliverable.quantity && (
                                                                            <Badge variant="secondary" className="text-xs font-bold">
                                                                                ×{task.deliverable.quantity}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                                        {task.deliverable.postingSchedule && (
                                                                            <div className="flex items-center gap-1">
                                                                                <Calendar className="h-3 w-3" />
                                                                                <span className="capitalize">{task.deliverable.postingSchedule}</span>
                                                                            </div>
                                                                        )}
                                                                        {task.deliverable.postingDays && task.deliverable.postingDays.length > 0 && (
                                                                            <span className="text-gray-500">
                                                                                {task.deliverable.postingDays.join(', ')}
                                                                            </span>
                                                                        )}
                                                                        {task.deliverable.postingTimes && task.deliverable.postingTimes.length > 0 && (
                                                                            <div className="flex items-center gap-1">
                                                                                <Clock className="h-3 w-3" />
                                                                                <span>{task.deliverable.postingTimes.join(', ')}</span>
                                                                            </div>
                                                                        )}
                                                                        {task.deliverable.videosPerDay && (
                                                                            <span>{task.deliverable.videosPerDay} video{task.deliverable.videosPerDay > 1 ? 's' : ''}/day</span>
                                                                        )}
                                                                    </div>
                                                                    {task.deliverable.platforms && task.deliverable.platforms.length > 0 && (
                                                                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                                                                            {task.deliverable.platforms.map((p) => {
                                                                                const pKey = p.toLowerCase() as PlatformKey;
                                                                                const pInfo = PLATFORMS[pKey];
                                                                                if (!pInfo) return (
                                                                                    <Badge key={p} variant="outline" className="text-[10px] h-5 px-1.5">{p}</Badge>
                                                                                );
                                                                                const PIcon = pInfo.icon;
                                                                                return (
                                                                                    <div key={p} className={`inline-flex items-center justify-center w-6 h-6 rounded ${pInfo.bgColor}`} title={p}>
                                                                                        <PIcon className={`h-3.5 w-3.5 ${pInfo.color}`} />
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                    {task.deliverable.description && (
                                                                        <p className="text-xs text-muted-foreground mt-2">{task.deliverable.description}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Load More Controls */}
                <div className="mt-6 flex flex-col items-center gap-4 border-t pt-6 px-2">
                    <div className="text-sm text-muted-foreground">
                        Showing <span className="font-medium text-foreground">{tasks.length}</span> of <span className="font-medium text-foreground">{totalTasks}</span> tasks
                    </div>
                    
                    {hasMore && (
                        <Button
                            variant="outline"
                            onClick={() => loadTasks(currentPage + 1, true)}
                            disabled={loading}
                            className="bg-white hover:bg-indigo-50 border-indigo-100 text-indigo-600 font-medium px-8 h-10 shadow-sm"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                "Load More History"
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Add/Edit Link Dialog */}
            <Dialog open={linkDialog?.open || false} onOpenChange={(open) => {
                if (!open) {
                    setLinkDialog(null);
                    setLinkUrl('');
                    setLinkPostedAt('');
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {linkDialog && (() => {
                                const platform = PLATFORMS[linkDialog.platform];
                                const Icon = platform.icon;
                                const isEdit = linkDialog.mode === 'edit';
                                return (
                                    <>
                                        <div className={`p-1.5 rounded-md ${platform.bgColor}`}>
                                            <Icon className={`h-5 w-5 ${platform.color}`} />
                                        </div>
                                        {isEdit ? 'Edit' : 'Add'} {linkDialog.platform.charAt(0).toUpperCase() + linkDialog.platform.slice(1)} Link
                                    </>
                                );
                            })()}
                        </DialogTitle>
                        <DialogDescription>
                            {linkDialog?.mode === 'edit' 
                                ? 'Update the URL for this post'
                                : 'Paste the URL of the published post'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Post URL</label>
                            <Input
                                placeholder="https://..."
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                disabled={submittingLink}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                Posted / Scheduled Time
                            </label>
                            <Input
                                type="datetime-local"
                                value={linkPostedAt}
                                onChange={(e) => setLinkPostedAt(e.target.value)}
                                disabled={submittingLink}
                                className="text-sm"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Leave empty to use the current time</p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => {
                                setLinkDialog(null);
                                setLinkUrl('');
                                setLinkPostedAt('');
                            }} disabled={submittingLink}>
                                Cancel
                            </Button>
                            <Button onClick={submitSocialLink} disabled={!linkUrl || submittingLink}>
                                {submittingLink 
                                    ? (linkDialog?.mode === 'edit' ? 'Updating...' : 'Adding...') 
                                    : (linkDialog?.mode === 'edit' ? 'Update Link' : 'Add Link')
                                }
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* File Preview Modal */}
            <FilePreviewModal
                file={previewFile}
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
            />
        </div>
    );
}