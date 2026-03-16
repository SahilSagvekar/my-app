"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
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
    Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { FilePreviewModal } from '../FileViewerModal';

// Platform icons and colors
const PLATFORMS = {
    instagram: { label: 'IG', icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-50' },
    youtube: { label: 'YT', icon: Youtube, color: 'text-red-600', bgColor: 'bg-red-50' },
    tiktok: { label: 'TT', icon: Music, color: 'text-black', bgColor: 'bg-gray-100' },
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
        url: string;
        size: number;
        mimeType?: string;
        folderType?: string;
    }[];
    createdAt: string;
    clientId: string;
    client?: {
        name: string;
        companyName?: string;
    };
    deliverable?: any;
    socialMediaLinks?: Array<{ platform: string; url: string; postedAt: string }>;
    // AI Titling fields
    suggestedTitles?: Array<{ style?: string; title: string; reasoning?: string }> | string[];
    titlingStatus?: string;
}

export function SchedulerSpreadsheetView() {
    const [tasks, setTasks] = useState<SchedulerTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [sortColumn, setSortColumn] = useState<string>('dueDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'scheduled'>('all');
    const [clientFilter, setClientFilter] = useState<string>('all');
    const [deliverableFilter, setDeliverableFilter] = useState<string>('all');

    // File preview
    const [previewFile, setPreviewFile] = useState<any | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Video player
    const [playingVideo, setPlayingVideo] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Social link dialog
    const [linkDialog, setLinkDialog] = useState<{ open: boolean; taskId: string; platform: PlatformKey } | null>(null);
    const [linkUrl, setLinkUrl] = useState('');
    const [submittingLink, setSubmittingLink] = useState(false);

    // Selected rows for bulk actions
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadTasks();
    }, []);

    async function loadTasks() {
        try {
            setLoading(true);
            const res = await fetch("/api/schedular/tasks", { cache: "no-store" });
            const data = await res.json();

            if (!data.tasks || data.tasks.length === 0) {
                setTasks([]);
                return;
            }

            const mapped = data.tasks.map((t: any) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                priority: t.priority || "medium",
                status: ['SCHEDULED', 'POSTED', 'PUBLISHED'].includes((t.status || '').toUpperCase()) ? 'SCHEDULED' : 'PENDING',
                dueDate: t.dueDate,
                files: (t.files || []).map((file: any) => ({
                    id: file.id,
                    name: file.name,
                    url: file.url,
                    size: file.size || 0,
                    mimeType: file.mimeType || '',
                    folderType: file.folderType || 'other',
                })),
                createdAt: t.createdAt,
                clientId: t.clientId,
                client: t.client,
                deliverable: t.monthlyDeliverable,
                socialMediaLinks: t.socialMediaLinks || [],
                suggestedTitles: t.suggestedTitles || [],
                titlingStatus: t.titlingStatus || 'NONE',
            }));

            setTasks(mapped);
        } catch (error) {
            console.error("Error loading tasks:", error);
            toast.error('Failed to load tasks');
        } finally {
            setLoading(false);
        }
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
            const res = await fetch(`/api/tasks/${linkDialog.taskId}/social-media-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: linkDialog.platform,
                    url: linkUrl,
                }),
            });

            if (!res.ok) throw new Error('Failed to submit link');

            // Update local state
            setTasks(prev => prev.map(t => {
                if (t.id === linkDialog.taskId) {
                    return {
                        ...t,
                        socialMediaLinks: [
                            ...(t.socialMediaLinks || []),
                            { platform: linkDialog.platform, url: linkUrl, postedAt: new Date().toISOString() }
                        ]
                    };
                }
                return t;
            }));

            toast.success(`${PLATFORMS[linkDialog.platform].label} link added!`);
            setLinkDialog(null);
            setLinkUrl('');
        } catch (err) {
            toast.error('Failed to add link');
        } finally {
            setSubmittingLink(false);
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

    // Download file
    async function downloadFile(file: any) {
        try {
            const isS3 = file.url?.includes('amazonaws.com') || file.url?.includes('r2.cloudflarestorage.com') || file.url?.includes('r2.dev');
            if (isS3 && file.id) {
                // Use the download API — generates presigned S3 URL, browser handles at full speed
                window.open(`/api/files/${file.id}/download`, '_blank');
                toast.success('Download started', { id: 'download' });
            } else {
                // Fallback for non-S3 files
                window.open(file.url, '_blank');
                toast.success('Download started', { id: 'download' });
            }
        } catch (error) {
            toast.error('Download failed', { id: 'download' });
        }
    }

    // Toggle row expansion
    const toggleRow = (taskId: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
                newSet.delete(taskId);
            } else {
                newSet.add(taskId);
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

    // Filter and sort tasks
    const filteredTasks = tasks
        .filter(t => {
            const matchesSearch = t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.clientId?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'pending' && t.status === 'PENDING') ||
                (statusFilter === 'scheduled' && t.status === 'SCHEDULED');
            const matchesClient = clientFilter === 'all' || t.clientId === clientFilter;
            const matchesDeliverable = deliverableFilter === 'all' || t.deliverable?.id === deliverableFilter || t.deliverable?.type === deliverableFilter;
            return matchesSearch && matchesStatus && matchesClient && matchesDeliverable;
        })
        .sort((a, b) => {
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

    // Get unique clients and deliverables for filter dropdowns
    const uniqueClients = Array.from(
        new Map(
            tasks
                .map(t => t.client)
                .filter(Boolean)
                .map(c => [c.id, c.companyName || c.name])
        ).entries()
    ).sort((a, b) => a[1].localeCompare(b[1]));

    const uniqueDeliverables = Array.from(new Set(tasks.map(t => t.deliverable?.type).filter(Boolean))) as string[];

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

    if (loading) {
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
                    <p className="text-muted-foreground text-sm">
                        Spreadsheet view • {pendingCount} pending, {scheduledCount} scheduled
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {selectedRows.size > 0 && (
                        <Button onClick={bulkMarkAsScheduled} size="sm">
                            <Check className="h-4 w-4 mr-2" />
                            Mark Selected ({selectedRows.size})
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={loadTasks}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-white border rounded-lg p-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search tasks, clients..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Button
                        variant={statusFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('all')}
                    >
                        All ({tasks.length})
                    </Button>
                    <Button
                        variant={statusFilter === 'pending' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('pending')}
                    >
                        Pending ({pendingCount})
                    </Button>
                    <Button
                        variant={statusFilter === 'scheduled' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('scheduled')}
                    >
                        Scheduled ({scheduledCount})
                    </Button>
                </div>

                <div className="flex items-center gap-2 border-l pl-4">
                    <select
                        className="text-sm border rounded-md px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-primary/20"
                        value={clientFilter}
                        onChange={(e) => setClientFilter(e.target.value)}
                    >
                        <option value="all">All Clients</option>
                        {uniqueClients.map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>

                    <select
                        className="text-sm border rounded-md px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-primary/20"
                        value={deliverableFilter}
                        onChange={(e) => setDeliverableFilter(e.target.value)}
                    >
                        <option value="all">All Deliverables</option>
                        {uniqueDeliverables.sort().map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Spreadsheet Table */}
            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        {/* Header */}
                        <thead className="bg-gray-50 border-b sticky top-0 z-10">
                            <tr>
                                <th className="w-10 px-3 py-3 text-left">
                                    <Checkbox
                                        checked={selectedRows.size === filteredTasks.length && filteredTasks.length > 0}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedRows(new Set(filteredTasks.map(t => t.id)));
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
                                <th className="px-3 py-3 text-center font-semibold">Actions</th>
                            </tr>
                        </thead>

                        {/* Body */}
                        <tbody className="divide-y">
                            {filteredTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="px-6 py-12 text-center text-muted-foreground">
                                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                                        <p className="font-medium">No tasks found</p>
                                        <p className="text-sm mt-1">Adjust your filters or wait for new tasks</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTasks.map((task, index) => {
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
                                                            ) : (
                                                                <button
                                                                    onClick={() => setLinkDialog({ open: true, taskId: task.id, platform: key as PlatformKey })}
                                                                    className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-50 text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors border border-dashed border-gray-300"
                                                                    title={`Add ${key} link`}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </button>
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

                                                {/* Actions */}
                                                <td className="px-3 py-3 text-center">
                                                    {task.status === 'PENDING' && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => markAsScheduled(task.id)}
                                                            disabled={!hasLinks}
                                                            className="h-7 text-xs"
                                                        >
                                                            <Check className="h-3 w-3 mr-1" />
                                                            Mark
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Expanded Row - Files & Details */}
                                            {isExpanded && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan={14} className="px-6 py-4">
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
                                                                        {Object.entries(
                                                                            task.files.reduce((acc, file) => {
                                                                                const folderType = file.folderType || 'Uncategorized';
                                                                                if (!acc[folderType]) acc[folderType] = [];
                                                                                acc[folderType].push(file);
                                                                                return acc;
                                                                            }, {} as Record<string, typeof task.files>)
                                                                        ).map(([folderType, folderFiles]) => (
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
                                                                                                            setPreviewFile(file);
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
                                                                {playingVideo && task.files.some(f => f.url === playingVideo) && (
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
                                                                        <div className="space-y-1">
                                                                            {task.socialMediaLinks.map((link, i) => (
                                                                                <a
                                                                                    key={i}
                                                                                    href={link.url}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                                                                                >
                                                                                    <ExternalLink className="h-3 w-3" />
                                                                                    {link.platform}: {link.url.slice(0, 40)}...
                                                                                </a>
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
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Link Dialog */}
            <Dialog open={linkDialog?.open || false} onOpenChange={(open) => !open && setLinkDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {linkDialog && (() => {
                                const platform = PLATFORMS[linkDialog.platform];
                                const Icon = platform.icon;
                                return (
                                    <>
                                        <div className={`p-1.5 rounded-md ${platform.bgColor}`}>
                                            <Icon className={`h-5 w-5 ${platform.color}`} />
                                        </div>
                                        Add {linkDialog.platform.charAt(0).toUpperCase() + linkDialog.platform.slice(1)} Link
                                    </>
                                );
                            })()}
                        </DialogTitle>
                        <DialogDescription>
                            Paste the URL of the published post
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input
                            placeholder="https://..."
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            disabled={submittingLink}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setLinkDialog(null)} disabled={submittingLink}>
                                Cancel
                            </Button>
                            <Button onClick={submitSocialLink} disabled={!linkUrl || submittingLink}>
                                {submittingLink ? 'Adding...' : 'Add Link'}
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
