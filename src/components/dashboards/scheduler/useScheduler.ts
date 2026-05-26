import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';
import { SchedulerTask, ClientDeliverable, PlatformKey } from './types';
import { PLATFORMS } from './icons';

export function useScheduler() {
    const [tasks, setTasks] = useState<SchedulerTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [clientFilter, setClientFilter] = useState('all');
    const [deliverableFilter, setDeliverableFilter] = useState('all');
    const [allClients, setAllClients] = useState<any[]>([]);
    const [uniqueDeliverables, setUniqueDeliverables] = useState<string[]>([]);

    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalTasks, setTotalTasks] = useState(0);

    const [sortColumn, setSortColumn] = useState('dueDate');
    const [sortDirection, setSortDirection] = useState('asc');

    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewFile, setPreviewFile] = useState<any>(null);
    const [linkDialog, setLinkDialog] = useState<any>(null);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkPostedAt, setLinkPostedAt] = useState('');
    const [submittingLink, setSubmittingLink] = useState(false);

    const debouncedSearch = useDebounce(searchTerm, 500);

    const fetchMetadata = useCallback(async () => {
        try {
            const res = await fetch("/api/schedular/metadata", { cache: "no-store" });
            const data = await res.json();
            if (data.clients) setAllClients(data.clients);
            if (data.deliverableTypes) setUniqueDeliverables(data.deliverableTypes);
        } catch (error) {
            console.error("Error loading metadata:", error);
        }
    }, []);

    const loadTasks = useCallback(async (page = 1, append = false) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                search: debouncedSearch,
                dateRange,
                status: statusFilter,
                clientId: clientFilter,
                deliverableType: deliverableFilter
            });

            const res = await fetch(`/api/schedular/tasks?${params}`, { cache: 'no-store' });
            if (!res.ok) throw new Error("Failed to load");

            const data = await res.json();

            if (append) {
                setTasks(prev => [...prev, ...data.tasks]);
            } else {
                setTasks(data.tasks);
                setIsInitialLoad(false);
            }

            setHasMore(data.hasMore);
            setTotalTasks(data.total);
            setCurrentPage(page);

        } catch (err) {
            toast.error("Failed to fetch tasks");
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, dateRange, statusFilter, clientFilter, deliverableFilter]);

    useEffect(() => { fetchMetadata(); }, [fetchMetadata]);
    useEffect(() => { loadTasks(); }, [loadTasks]);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const toggleRow = (taskId: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) newSet.delete(taskId);
            else {
                newSet.add(taskId);
                fetchSignedUrls(taskId);
            }
            return newSet;
        });
    };

    const fetchSignedUrls = async (taskId: string) => {
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
        } catch (err) {}
    };

    const getFileUrl = (file: any) => signedUrls[String(file.id)] || file.url || '';

    const markAsScheduled = async (taskId: string, precomputedLinks?: string[]) => {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            const requiredPlatforms = task.deliverable?.platforms?.map(p => p.toLowerCase()) || [];
            if (requiredPlatforms.length > 0) {
                // Use precomputedLinks if provided — avoids stale state when called from auto-schedule
                const existingLinks = precomputedLinks ?? (task.socialMediaLinks || []).map(l => l.platform.toLowerCase());
                const missingPlatforms = requiredPlatforms.filter(p => !existingLinks.includes(p));
                if (missingPlatforms.length > 0) {
                    const platformNames = missingPlatforms.map(p => {
                        const info = PLATFORMS[p as keyof typeof PLATFORMS];
                        return info?.label || p;
                    });
                    toast.error(`Missing links for: ${platformNames.join(', ')}. Add all required platform links before marking as scheduled.`);
                    return;
                }
            }
        }
        try {
            const res = await fetch(`/api/tasks/${taskId}/mark-scheduled`, { method: "PATCH" });
            if (res.ok) {
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'SCHEDULED' } : t));
                toast.success('Task marked as scheduled');
            }
        } catch (err) { toast.error('Failed to update'); }
    };

    const markAsPending = async (taskId: string) => {
        try {
            const res = await fetch(`/api/tasks/${taskId}/mark-pending`, { method: "PATCH" });
            if (res.ok) {
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'PENDING' } : t));
                toast.success('Task reverted to pending');
            }
        } catch (err) { toast.error('Failed to update'); }
    };

    const bulkMarkAsScheduled = async () => {
        const selected = tasks.filter(t => selectedRows.has(t.id));
        if (!selected.length) { toast.error('No tasks selected'); return; }
        for (const t of selected) await markAsScheduled(t.id);
        setSelectedRows(new Set());
    };

    const saveLink = async () => {
        if (!linkDialog || !linkUrl) return;

        const taskId = linkDialog.taskId;
        const platform = linkDialog.platform;
        const mode = linkDialog.mode;
        const url = linkUrl;
        const postedAt = linkPostedAt;

        setSubmittingLink(true);
        try {
            const method = mode === 'edit' ? 'PATCH' : 'POST';
            const res = await fetch(`/api/tasks/${taskId}/social-media-link`, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({ platform, url, postedAt: postedAt || undefined }),
            });

            if (res.ok) {
                const newLink = { platform, url, postedAt: postedAt || new Date().toISOString() };
                let updatedTask: typeof tasks[0] | undefined;
                setTasks(prev => prev.map(t => {
                    if (t.id !== taskId) return t;
                    const existing = t.socialMediaLinks || [];
                    let updated: typeof t;
                    if (mode === 'edit') {
                        updated = {
                            ...t,
                            socialMediaLinks: existing.map(l =>
                                l.platform.toLowerCase() === platform.toLowerCase()
                                    ? { ...l, url, postedAt: postedAt || l.postedAt }
                                    : l
                            ),
                        };
                    } else {
                        const withoutDupe = existing.filter(l => l.platform.toLowerCase() !== platform.toLowerCase());
                        updated = { ...t, socialMediaLinks: [...withoutDupe, newLink] };
                    }
                    updatedTask = updated;
                    return updated;
                }));
                toast.success('Link saved');
                setLinkDialog(null);
                setLinkUrl('');
                setLinkPostedAt('');

                // Auto-mark as scheduled when all required platform links are present
                // Use updatedTask captured inside setTasks — tasks[] is stale here
                if (mode !== 'edit' && updatedTask && updatedTask.status !== 'SCHEDULED') {
                    const requiredPlatforms = updatedTask.deliverable?.platforms?.map(p => p.toLowerCase()) || [];
                    if (requiredPlatforms.length > 0) {
                        const allLinks = (updatedTask.socialMediaLinks || []).map(l => l.platform.toLowerCase());
                        const allCovered = requiredPlatforms.every(p => allLinks.includes(p));
                        if (allCovered) {
                            // Pass allLinks to markAsScheduled to bypass stale state check
                            setTimeout(() => markAsScheduled(taskId, allLinks), 300);
                        }
                    }
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                console.error('[saveLink] API error:', res.status, errData);
                toast.error(errData.error || 'Failed to save link');
            }
        } catch (err) {
            console.error('[saveLink] fetch error:', err);
            toast.error('Failed to save');
        } finally {
            setSubmittingLink(false);
        }
    };

    const deleteSocialLink = async (taskId: string, platform: string) => {
        setTasks(prev => prev.map(t => {
            if (t.id !== taskId) return t;
            return {
                ...t,
                socialMediaLinks: (t.socialMediaLinks || []).filter(
                    l => l.platform.toLowerCase() !== platform.toLowerCase()
                ),
            };
        }));
        try {
            const res = await fetch(`/api/tasks/${taskId}/social-media-link?platform=${platform}`, { method: "DELETE", credentials: 'include' });
            if (!res.ok) {
                toast.error('Failed to remove link');
                loadTasks();
            } else {
                toast.success('Link removed');
            }
        } catch (err) {
            toast.error('Failed to remove link');
            loadTasks();
        }
    };

    const downloadFile = (file: any) => {
        if (file.id) window.open(`/api/files/${file.id}/download`, '_blank');
        else if (file.url) window.open(file.url, '_blank');
    };

    const copyTitle = (titleItem: any) => {
        const text = typeof titleItem === 'string' ? titleItem : titleItem?.title || '';
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    const toggleTrial = async (taskId: string, isTrial: boolean) => {
        try {
            await fetch(`/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ isTrial }),
            });
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isTrial } : t));
        } catch (err) { toast.error('Failed to update trial status'); }
    };

    const displayTasks = [...tasks].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortColumn) {
            case 'title': aVal = a.title; bVal = b.title; break;
            case 'client': aVal = a.client?.name || ''; bVal = b.client?.name || ''; break;
            case 'dueDate': aVal = new Date(a.dueDate || 0); bVal = new Date(b.dueDate || 0); break;
            case 'status': aVal = a.status; bVal = b.status; break;
            default: aVal = a.dueDate; bVal = b.dueDate;
        }
        return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    const uniqueClientsFormatted = allClients.map(c => [c.id, c.companyName || c.name] as [string, string]);

    return {
        tasks, loading, isInitialLoad, searchTerm, setSearchTerm,
        dateRange, setDateRange: (v: string) => { setDateRange(v); setCurrentPage(1); },
        statusFilter, setStatusFilter: (v: string) => { setStatusFilter(v); setCurrentPage(1); },
        clientFilter, setClientFilter,
        handleClientFilterChange: (v: string) => { setClientFilter(v); setCurrentPage(1); },
        deliverableFilter, setDeliverableFilter,
        handleDeliverableFilterChange: (v: string) => { setDeliverableFilter(v); setCurrentPage(1); },
        uniqueClients: uniqueClientsFormatted, uniqueDeliverables,
        hasMore, totalTasks, currentPage, expandedRows, selectedRows, setSelectedRows,
        isPreviewOpen, setIsPreviewOpen, previewFile, setPreviewFile, linkDialog, setLinkDialog,
        linkUrl, setLinkUrl, linkPostedAt, setLinkPostedAt, submittingLink,
        loadTasks, handleSort, toggleRow, markAsScheduled, markAsPending, bulkMarkAsScheduled,
        toggleTrial, downloadFile, copyTitle, saveLink, deleteSocialLink, getFileUrl,
        sortColumn, sortDirection, displayTasks
    };
}