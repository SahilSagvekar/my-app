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
    
    // Pagination & Search
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalTasks, setTotalTasks] = useState(0);

    // Filtered / Sorted State
    const [sortColumn, setSortColumn] = useState('dueDate');
    const [sortDirection, setSortDirection] = useState('asc');

    // UI state
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
            
            // Populate filters if initial
            if (data.uniqueClients) setAllClients(data.uniqueClients);
            if (data.uniqueDeliverables) setUniqueDeliverables(data.uniqueDeliverables);

        } catch (err) {
            toast.error("Failed to fetch tasks");
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, dateRange, statusFilter, clientFilter, deliverableFilter]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

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

    const markAsScheduled = async (taskId: string) => {
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
        const selected = tasks.filter(t => selectedRows.has(t.id) && t.socialMediaLinks?.length);
        if (!selected.length) {
            toast.error('Selected tasks need links to be scheduled');
            return;
        }
        for (const t of selected) await markAsScheduled(t.id);
        setSelectedRows(new Set());
    };

    const toggleTrial = async (taskId: string, isTrial: boolean) => {
        try {
            const res = await fetch(`/api/tasks/${taskId}/toggle-trial`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isTrial }),
            });
            if (res.ok) {
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isTrial } : t));
                toast.success(isTrial ? "Marked as trial" : "Unmarked trial");
            }
        } catch (err) { toast.error("Failed to update trial status"); }
    };

    const saveLink = async () => {
        if (!linkDialog || !linkUrl) return;
        setSubmittingLink(true);
        try {
            const res = await fetch(`/api/tasks/${linkDialog.taskId}/social-links`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platform: linkDialog.platform, url: linkUrl, postedAt: linkPostedAt || undefined }),
            });
            if (res.ok) {
                const refreshed = await res.json();
                setTasks(prev => prev.map(t => t.id === linkDialog.taskId ? { ...t, socialMediaLinks: refreshed.socialMediaLinks } : t));
                toast.success('Link saved');
                setLinkDialog(null);
            }
        } catch (err) { toast.error('Failed to save'); }
        finally { setSubmittingLink(false); }
    };

    const deleteSocialLink = async (taskId: string, platform: string) => {
        try {
            const res = await fetch(`/api/tasks/${taskId}/social-links?platform=${platform}`, { method: "DELETE" });
            if (res.ok) {
                const refreshed = await res.json();
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, socialMediaLinks: refreshed.socialMediaLinks } : t));
                toast.success('Link removed');
            }
        } catch (err) { toast.error('Failed to remove'); }
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
        tasks, loading, isInitialLoad, searchTerm, setSearchTerm, dateRange, setDateRange,
        statusFilter, setStatusFilter, clientFilter, setClientFilter, handleClientFilterChange: (v: string) => { setClientFilter(v); setCurrentPage(1); },
        deliverableFilter, setDeliverableFilter, uniqueClients: uniqueClientsFormatted, uniqueDeliverables,
        hasMore, totalTasks, currentPage, expandedRows, selectedRows, setSelectedRows,
        isPreviewOpen, setIsPreviewOpen, previewFile, setPreviewFile, linkDialog, setLinkDialog,
        linkUrl, setLinkUrl, linkPostedAt, setLinkPostedAt, submittingLink,
        loadTasks, handleSort, toggleRow, markAsScheduled, markAsPending, bulkMarkAsScheduled,
        toggleTrial, downloadFile, copyTitle, saveLink, deleteSocialLink, getFileUrl,
        sortColumn, sortDirection, displayTasks
    };
}
