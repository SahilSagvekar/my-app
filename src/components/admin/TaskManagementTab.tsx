// components/admin/TaskManagementTab.tsx
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateRangePicker } from '../ui/date-range-picker';
import {
    ListTodo,
    Search,
    RefreshCw,
    Filter,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    Clock,
    CheckCircle2,
    XCircle,
    Edit,
    Eye,
    MoreHorizontal,
    Calendar,
    User,
    Users
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface Task {
    id: string;
    title: string | null;
    description: string;
    status: string;
    priority: string | null;
    dueDate: string | null;
    createdAt: string;
    workflowStep: string | null;
    assignedTo: number;
    qc_specialist: number | null;
    scheduler: number | null;
    videographer: number | null;
    clientId: string | null;
    editor: { id: number; name: string; email: string; role: string } | null;
    qcSpecialist: { id: number; name: string; role: string } | null;
    schedulerUser: { id: number; name: string; role: string } | null;
    videographerUser: { id: number; name: string; role: string } | null;
    client: { id: string; name: string; companyName: string | null } | null;
    monthlyDeliverable: { id: string; type: string } | null;
}

interface FilterState {
    editor: string;
    qc: string;
    scheduler: string;
    videographer: string;
    client: string;
    status: string;
    search: string;
    dueDateFrom: Date | undefined;
    dueDateTo: Date | undefined;
}

interface TeamMember {
    id: number;
    name: string;
    role: string;
}

interface Client {
    id: string;
    name: string;
    companyName: string | null;
}

// ─────────────────────────────────────────
// Status Badge Component
// ─────────────────────────────────────────

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    PENDING: { label: 'Pending', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
    IN_PROGRESS: { label: 'In Progress', variant: 'default', icon: <RefreshCw className="h-3 w-3" /> },
    READY_FOR_QC: { label: 'Ready for QC', variant: 'outline', icon: <Eye className="h-3 w-3" /> },
    QC_IN_PROGRESS: { label: 'QC In Progress', variant: 'default', icon: <RefreshCw className="h-3 w-3" /> },
    COMPLETED: { label: 'Completed', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
    SCHEDULED: { label: 'Scheduled', variant: 'default', icon: <Calendar className="h-3 w-3" /> },
    ON_HOLD: { label: 'On Hold', variant: 'secondary', icon: <AlertCircle className="h-3 w-3" /> },
    REJECTED: { label: 'Rejected', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    CLIENT_REVIEW: { label: 'Client Review', variant: 'outline', icon: <User className="h-3 w-3" /> },
    VIDEOGRAPHER_ASSIGNED: { label: 'Videographer', variant: 'outline', icon: <Users className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
    const config = statusConfig[status] || { label: status, variant: 'secondary' as const, icon: null };
    return (
        <Badge variant={config.variant} className="flex items-center gap-1">
            {config.icon}
            {config.label}
        </Badge>
    );
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────

export function TaskManagementTab() {
    // State
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [filters, setFilters] = useState<FilterState>({
        editor: 'all',
        qc: 'all',
        scheduler: 'all',
        videographer: 'all',
        client: 'all',
        status: 'all',
        search: '',
        dueDateFrom: undefined,
        dueDateTo: undefined,
    });
    const [showFilters, setShowFilters] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 25;

    // Stats
    const [stats, setStats] = useState<{
        total: number;
        byStatus: Record<string, number>;
        overdue: number;
    } | null>(null);

    // Team members and clients for dropdowns
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [clients, setClients] = useState<Client[]>([]);

    // Edit dialog
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [editForm, setEditForm] = useState<{
        status: string;
        assignedTo: string;
        qc_specialist: string;
        scheduler: string;
        videographer: string;
        priority: string;
    }>({
        status: '',
        assignedTo: '',
        qc_specialist: '',
        scheduler: '',
        videographer: '',
        priority: '',
    });
    const [saving, setSaving] = useState(false);

    // ─────────────────────────────────────────
    // Data Loading
    // ─────────────────────────────────────────

    useEffect(() => {
        loadTeamMembers();
        loadClients();
    }, []);

    useEffect(() => {
        loadTasks();
    }, [page, filters]);

    async function loadTeamMembers() {
        try {
            const res = await fetch('/api/employee/list?status=ACTIVE');
            const data = await res.json();
            if (data.ok) {
                setTeamMembers(data.employees);
            }
        } catch (error) {
            console.error('Failed to load team members:', error);
        }
    }

    async function loadClients() {
        try {
            const res = await fetch('/api/clients');
            const data = await res.json();
            if (Array.isArray(data)) {
                setClients(data);
            }
        } catch (error) {
            console.error('Failed to load clients:', error);
        }
    }

    async function loadTasks() {
        try {
            setLoading(true);

            // Build query params
            const params = new URLSearchParams();
            params.set('page', page.toString());
            params.set('limit', limit.toString());

            if (filters.editor !== 'all') params.set('editor', filters.editor);
            if (filters.qc !== 'all') params.set('qc', filters.qc);
            if (filters.scheduler !== 'all') params.set('scheduler', filters.scheduler);
            if (filters.videographer !== 'all') params.set('videographer', filters.videographer);
            if (filters.client !== 'all') params.set('client', filters.client);
            if (filters.status !== 'all') params.set('status', filters.status);
            if (filters.search) params.set('search', filters.search);
            if (filters.dueDateFrom) params.set('dueDateFrom', filters.dueDateFrom.toISOString());
            if (filters.dueDateTo) params.set('dueDateTo', filters.dueDateTo.toISOString());

            const res = await fetch(`/api/admin/tasks?${params.toString()}`);

            if (!res.ok) {
                throw new Error('Failed to fetch tasks');
            }

            const data = await res.json();

            setTasks(data.tasks || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotal(data.pagination?.total || 0);
            setStats(data.stats || null);
        } catch (error: any) {
            console.error('Failed to load tasks:', error);
            toast({
                title: 'Error',
                description: 'Failed to load tasks',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleRefresh() {
        setRefreshing(true);
        await loadTasks();
        setRefreshing(false);
        toast({ title: 'Refreshed', description: 'Task list updated' });
    }

    // ─────────────────────────────────────────
    // Edit Task
    // ─────────────────────────────────────────

    function openEditDialog(task: Task) {
        setEditingTask(task);
        setEditForm({
            status: task.status,
            assignedTo: task.assignedTo?.toString() || '',
            qc_specialist: task.qc_specialist?.toString() || 'none',
            scheduler: task.scheduler?.toString() || 'none',
            videographer: task.videographer?.toString() || 'none',
            priority: task.priority || 'none',
        });
    }

    async function handleSaveEdit() {
        if (!editingTask) return;

        setSaving(true);
        try {
            const updates: any = {};

            if (editForm.status !== editingTask.status) {
                updates.status = editForm.status;
            }
            if (editForm.assignedTo && editForm.assignedTo !== editingTask.assignedTo?.toString()) {
                updates.assignedTo = parseInt(editForm.assignedTo);
            }
            if (editForm.qc_specialist !== (editingTask.qc_specialist?.toString() || 'none')) {
                updates.qc_specialist = editForm.qc_specialist !== 'none' ? parseInt(editForm.qc_specialist) : null;
            }
            if (editForm.scheduler !== (editingTask.scheduler?.toString() || 'none')) {
                updates.scheduler = editForm.scheduler !== 'none' ? parseInt(editForm.scheduler) : null;
            }
            if (editForm.videographer !== (editingTask.videographer?.toString() || 'none')) {
                updates.videographer = editForm.videographer !== 'none' ? parseInt(editForm.videographer) : null;
            }
            if (editForm.priority !== (editingTask.priority || 'none')) {
                updates.priority = editForm.priority !== 'none' ? editForm.priority : null;
            }

            if (Object.keys(updates).length === 0) {
                toast({ title: 'No changes', description: 'No changes were made' });
                setEditingTask(null);
                return;
            }

            const res = await fetch(`/api/admin/tasks/${editingTask.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to update task');
            }

            toast({ title: 'Success', description: 'Task updated successfully' });
            setEditingTask(null);
            loadTasks();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update task',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    }

    // ─────────────────────────────────────────
    // Filter Helpers
    // ─────────────────────────────────────────

    function clearFilters() {
        setFilters({
            editor: 'all',
            qc: 'all',
            scheduler: 'all',
            videographer: 'all',
            client: 'all',
            status: 'all',
            search: '',
            dueDateFrom: undefined,
            dueDateTo: undefined,
        });
        setPage(1);
    }

    const activeFilterCount = [
        filters.editor !== 'all',
        filters.qc !== 'all',
        filters.scheduler !== 'all',
        filters.videographer !== 'all',
        filters.client !== 'all',
        filters.status !== 'all',
        !!filters.search,
        !!filters.dueDateFrom || !!filters.dueDateTo,
    ].filter(Boolean).length;

    // Get role-specific members
    const editors = teamMembers.filter(m => m.role === 'editor');
    const qcMembers = teamMembers.filter(m => m.role === 'qc');
    const schedulers = teamMembers.filter(m => m.role === 'scheduler');
    const videographers = teamMembers.filter(m => m.role === 'videographer');

    // ─────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────

    if (loading && tasks.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading tasks...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Quick Stats Bar */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
                        <CardContent className="p-4">
                            <div className="text-sm text-blue-600 dark:text-blue-400">Total Tasks</div>
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.total}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200">
                        <CardContent className="p-4">
                            <div className="text-sm text-yellow-600 dark:text-yellow-400">Pending</div>
                            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                                {stats.byStatus?.PENDING || 0}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
                        <CardContent className="p-4">
                            <div className="text-sm text-purple-600 dark:text-purple-400">In Progress</div>
                            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                                {stats.byStatus?.IN_PROGRESS || 0}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
                        <CardContent className="p-4">
                            <div className="text-sm text-orange-600 dark:text-orange-400">Ready for QC</div>
                            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                                {stats.byStatus?.READY_FOR_QC || 0}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
                        <CardContent className="p-4">
                            <div className="text-sm text-green-600 dark:text-green-400">Completed</div>
                            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                                {stats.byStatus?.COMPLETED || 0}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200">
                        <CardContent className="p-4">
                            <div className="text-sm text-red-600 dark:text-red-400">Overdue</div>
                            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.overdue}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters Card */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <ListTodo className="h-5 w-5" />
                            Task Management
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                                </Badge>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <Filter className="h-4 w-4 mr-2" />
                                {showFilters ? 'Hide Filters' : 'Show Filters'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={refreshing}
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                {showFilters && (
                    <CardContent className="border-t pt-4">
                        {/* Search */}
                        <div className="flex items-center gap-4 mb-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search tasks..."
                                    value={filters.search}
                                    onChange={(e) => {
                                        setFilters({ ...filters, search: e.target.value });
                                        setPage(1);
                                    }}
                                    className="pl-10"
                                />
                            </div>
                            {activeFilterCount > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    Clear all filters
                                </Button>
                            )}
                        </div>

                        {/* Filter Dropdowns */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {/* Editor Filter */}
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Editor</label>
                                <Select
                                    value={filters.editor}
                                    onValueChange={(v) => { setFilters({ ...filters, editor: v }); setPage(1); }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="All Editors" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Editors</SelectItem>
                                        {editors.map((m) => (
                                            <SelectItem key={m.id} value={m.id.toString()}>
                                                {m.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* QC Filter */}
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">QC Specialist</label>
                                <Select
                                    value={filters.qc}
                                    onValueChange={(v) => { setFilters({ ...filters, qc: v }); setPage(1); }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="All QC" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All QC</SelectItem>
                                        {qcMembers.map((m) => (
                                            <SelectItem key={m.id} value={m.id.toString()}>
                                                {m.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Scheduler Filter */}
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Scheduler</label>
                                <Select
                                    value={filters.scheduler}
                                    onValueChange={(v) => { setFilters({ ...filters, scheduler: v }); setPage(1); }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="All Schedulers" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Schedulers</SelectItem>
                                        {schedulers.map((m) => (
                                            <SelectItem key={m.id} value={m.id.toString()}>
                                                {m.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Videographer Filter */}
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Videographer</label>
                                <Select
                                    value={filters.videographer}
                                    onValueChange={(v) => { setFilters({ ...filters, videographer: v }); setPage(1); }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="All Videographers" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Videographers</SelectItem>
                                        {videographers.map((m) => (
                                            <SelectItem key={m.id} value={m.id.toString()}>
                                                {m.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Client Filter */}
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Client</label>
                                <Select
                                    value={filters.client}
                                    onValueChange={(v) => { setFilters({ ...filters, client: v }); setPage(1); }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="All Clients" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Clients</SelectItem>
                                        {clients.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.companyName || c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Status Filter */}
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Status</label>
                                <Select
                                    value={filters.status}
                                    onValueChange={(v) => { setFilters({ ...filters, status: v }); setPage(1); }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="All Statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        {Object.entries(statusConfig).map(([key, config]) => (
                                            <SelectItem key={key} value={key}>
                                                {config.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Date Range Filter */}
                        <div className="mt-4 flex items-end gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Due Date Range</label>
                                <DateRangePicker
                                    date={{ from: filters.dueDateFrom, to: filters.dueDateTo }}
                                    setDate={(range) => {
                                        setFilters({
                                            ...filters,
                                            dueDateFrom: range?.from,
                                            dueDateTo: range?.to,
                                        });
                                        setPage(1);
                                    }}
                                />
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Tasks Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="text-left py-3 px-4 font-medium">Task</th>
                                    <th className="text-left py-3 px-4 font-medium">Client</th>
                                    <th className="text-left py-3 px-4 font-medium">Editor</th>
                                    <th className="text-left py-3 px-4 font-medium">QC</th>
                                    <th className="text-left py-3 px-4 font-medium">Scheduler</th>
                                    <th className="text-left py-3 px-4 font-medium">Status</th>
                                    <th className="text-left py-3 px-4 font-medium">Due Date</th>
                                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-12 text-muted-foreground">
                                            No tasks found matching your filters
                                        </td>
                                    </tr>
                                ) : (
                                    tasks.map((task) => {
                                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() &&
                                            !['COMPLETED', 'SCHEDULED'].includes(task.status);

                                        return (
                                            <tr key={task.id} className="border-b hover:bg-muted/50">
                                                <td className="py-3 px-4">
                                                    <div className="max-w-xs">
                                                        <div className="font-medium truncate">
                                                            {task.title || task.description?.slice(0, 50) || 'Untitled Task'}
                                                        </div>
                                                        {task.monthlyDeliverable && (
                                                            <div className="text-xs text-muted-foreground">
                                                                {task.monthlyDeliverable.type}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-sm">
                                                        {task.client?.companyName || task.client?.name || '-'}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-sm">{task.editor?.name || '-'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-sm">{task.qcSpecialist?.name || '-'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-sm">{task.schedulerUser?.name || '-'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <StatusBadge status={task.status} />
                                                </td>
                                                <td className="py-3 px-4">
                                                    {task.dueDate ? (
                                                        <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                                                            {new Date(task.dueDate).toLocaleDateString()}
                                                            {isOverdue && (
                                                                <div className="text-xs text-red-500">Overdue</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                                                <Edit className="h-4 w-4 mr-2" />
                                                                Edit Task
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-red-600">
                                                                Delete Task
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                        <div className="text-sm text-muted-foreground">
                            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} tasks
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(page - 1)}
                                disabled={page <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <span className="text-sm px-2">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(page + 1)}
                                disabled={page >= totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Task Dialog */}
            <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Task</DialogTitle>
                        <DialogDescription>
                            {editingTask?.title || editingTask?.description?.slice(0, 50) || 'Untitled Task'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Status */}
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select
                                value={editForm.status}
                                onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(statusConfig).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                            {config.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Editor */}
                        <div className="grid gap-2">
                            <Label>Editor</Label>
                            <Select
                                value={editForm.assignedTo}
                                onValueChange={(v) => setEditForm({ ...editForm, assignedTo: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select editor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {editors.map((m) => (
                                        <SelectItem key={m.id} value={m.id.toString()}>
                                            {m.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* QC Specialist */}
                        <div className="grid gap-2">
                            <Label>QC Specialist</Label>
                            <Select
                                value={editForm.qc_specialist}
                                onValueChange={(v) => setEditForm({ ...editForm, qc_specialist: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select QC specialist" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {qcMembers.map((m) => (
                                        <SelectItem key={m.id} value={m.id.toString()}>
                                            {m.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Scheduler */}
                        <div className="grid gap-2">
                            <Label>Scheduler</Label>
                            <Select
                                value={editForm.scheduler}
                                onValueChange={(v) => setEditForm({ ...editForm, scheduler: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select scheduler" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {schedulers.map((m) => (
                                        <SelectItem key={m.id} value={m.id.toString()}>
                                            {m.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Videographer */}
                        <div className="grid gap-2">
                            <Label>Videographer</Label>
                            <Select
                                value={editForm.videographer}
                                onValueChange={(v) => setEditForm({ ...editForm, videographer: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select videographer" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {videographers.map((m) => (
                                        <SelectItem key={m.id} value={m.id.toString()}>
                                            {m.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Priority */}
                        <div className="grid gap-2">
                            <Label>Priority</Label>
                            <Select
                                value={editForm.priority}
                                onValueChange={(v) => setEditForm({ ...editForm, priority: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTask(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
