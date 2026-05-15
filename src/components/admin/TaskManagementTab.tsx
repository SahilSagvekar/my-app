// components/admin/TaskManagementTab.tsx
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { CreateTaskDialog } from '../tasks/CreateTaskDialog';
import { Plus } from 'lucide-react';
import { DateRangePicker } from '../ui/date-range-picker';
import {
  ListTodo, Search, RefreshCw, Filter, ChevronLeft, ChevronRight,
  AlertCircle, Clock, CheckCircle2, XCircle, Eye, MoreHorizontal,
  Calendar, User, Users, Pencil, Trash2, Edit,
} from 'lucide-react';
import { EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '../auth/AuthContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
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
  oneOffDeliverable: { id: string; type: string } | null;
  monthFolder: string | null;
}

interface FilterState {
  editor: string; qc: string; scheduler: string; videographer: string;
  client: string; status: string; deliverableType: string; month: string;
  search: string; dueDateFrom: Date | undefined; dueDateTo: Date | undefined;
}

interface TeamMember { id: number; name: string; role: string; }
interface Client { id: string; name: string; companyName: string | null; }

// ─────────────────────────────────────────
// Status Badge
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
  HIDDEN: { label: 'Hidden', variant: 'secondary', icon: <EyeOff className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, variant: 'secondary' as const, icon: null };
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {config.icon}{config.label}
    </Badge>
  );
}

// ─────────────────────────────────────────
// Skeleton row for perceived performance
// ─────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b">
      <td className="py-3 px-4"><div className="h-4 w-4 rounded bg-muted animate-pulse" /></td>
      {[200, 80, 100, 80, 60, 80, 90, 70, 70, 40].map((w, i) => (
        <td key={i} className="py-3 px-4">
          <div className={`h-4 rounded bg-muted animate-pulse`} style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─────────────────────────────────────────
// SWR fetcher
// ─────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error('fetch failed');
    return r.json();
  });

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────

export function TaskManagementTab() {
  const { user } = useAuth();

  // ── Filters ───────────────────────────
  const [filters, setFilters] = useState<FilterState>({
    editor: 'all', qc: 'all', scheduler: 'all', videographer: 'all',
    client: 'all', status: 'all', deliverableType: 'all', month: 'all',
    search: '', dueDateFrom: undefined, dueDateTo: undefined,
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 25;

  // ── Selection ─────────────────────────
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  // ── Edit / delete dialogs ─────────────
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ status: '', assignedTo: '', qc_specialist: '', scheduler: '', videographer: '', priority: '', dueDate: '' });
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({ status: 'no_change', assignedTo: 'no_change', qc_specialist: 'no_change', scheduler: 'no_change', videographer: 'no_change', priority: 'no_change', dueDate: 'no_change' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const SUPER_ADMIN_EMAIL = "sahilsagvekar230@gmail.com";
  const canDeleteTasks = user?.email === SUPER_ADMIN_EMAIL;

  // ── Build query string ─────────────────
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', page.toString());
    p.set('limit', limit.toString());
    p.set('sortBy', 'title');
    p.set('sortOrder', 'asc');
    if (filters.editor !== 'all') p.set('editor', filters.editor);
    if (filters.qc !== 'all') p.set('qc', filters.qc);
    if (filters.scheduler !== 'all') p.set('scheduler', filters.scheduler);
    if (filters.videographer !== 'all') p.set('videographer', filters.videographer);
    if (filters.client !== 'all') p.set('client', filters.client);
    if (filters.status !== 'all') p.set('status', filters.status);
    if (filters.deliverableType !== 'all') p.set('deliverableType', filters.deliverableType);
    if (filters.month !== 'all') p.set('month', filters.month);
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (filters.dueDateFrom) p.set('dueDateFrom', filters.dueDateFrom.toISOString());
    if (filters.dueDateTo) p.set('dueDateTo', filters.dueDateTo.toISOString());
    return p.toString();
  }, [page, filters, debouncedSearch]);

  // ── SWR: tasks (main data) ─────────────
  const { data: taskData, isLoading: tasksLoading, isValidating, mutate: mutateTasks } = useSWR(
    user ? `/api/admin/tasks?${queryString}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 10000 }
  );

  // ── SWR: team members (stable, cache 5min) ──
  const { data: teamData } = useSWR('/api/employee/list?status=ACTIVE', fetcher, {
    dedupingInterval: 300000, revalidateOnFocus: false,
  });

  // ── SWR: clients for dropdown (stable, cache 5min) ──
  // Use a lightweight endpoint — just id + name
  const { data: clientsData } = useSWR('/api/employee/list?role=client', fetcher, {
    dedupingInterval: 300000, revalidateOnFocus: false,
  });

  // Fetch clients via the full clients API only once
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => {
    fetch('/api/clients', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.clients) setClients(d.clients); })
      .catch(() => {});
  }, []);

  const tasks: Task[] = taskData?.tasks || [];
  const totalPages: number = taskData?.pagination?.totalPages || 1;
  const total: number = taskData?.pagination?.total || 0;
  const stats = taskData?.stats || null;
  const availableMonths: string[] = taskData?.availableMonths || [];
  const availableDeliverableTypes: string[] = taskData?.deliverableTypes || [];

  const teamMembers: TeamMember[] = teamData?.employees || [];
  const editors = teamMembers.filter(m => m.role === 'editor');
  const qcMembers = teamMembers.filter(m => m.role === 'qc');
  const schedulers = teamMembers.filter(m => m.role === 'scheduler');
  const videographers = teamMembers.filter(m => m.role === 'videographer');

  // ── Debounce search ────────────────────
  const handleSearchChange = (val: string) => {
    setFilters(f => ({ ...f, search: val }));
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 400);
  };

  // ── Global task update listener ────────
  useEffect(() => {
    const handler = (e: any) => { if (e.detail?.taskId) mutateTasks(); };
    window.addEventListener('task-updated', handler);
    return () => window.removeEventListener('task-updated', handler);
  }, [mutateTasks]);

  // Clear selection on page change
  useEffect(() => { setSelectedTasks(new Set()); }, [page, queryString]);

  // ── Filter helpers ─────────────────────
  const clearFilters = () => {
    setFilters({ editor: 'all', qc: 'all', scheduler: 'all', videographer: 'all', client: 'all', status: 'all', deliverableType: 'all', month: 'all', search: '', dueDateFrom: undefined, dueDateTo: undefined });
    setDebouncedSearch('');
    setPage(1);
  };

  const activeFilterCount = [
    filters.editor !== 'all', filters.qc !== 'all', filters.scheduler !== 'all',
    filters.videographer !== 'all', filters.client !== 'all', filters.status !== 'all',
    filters.deliverableType !== 'all', filters.month !== 'all',
    !!debouncedSearch, !!filters.dueDateFrom || !!filters.dueDateTo,
  ].filter(Boolean).length;

  // ── Selection handlers ─────────────────
  const allSelected = tasks.length > 0 && selectedTasks.size === tasks.length;
  const someSelected = selectedTasks.size > 0 && selectedTasks.size < tasks.length;

  function handleSelectAll(checked: boolean) {
    setSelectedTasks(checked ? new Set(tasks.map(t => t.id)) : new Set());
  }
  function handleSelectTask(taskId: string, checked: boolean) {
    const s = new Set(selectedTasks);
    checked ? s.add(taskId) : s.delete(taskId);
    setSelectedTasks(s);
  }

  // ── Single edit ────────────────────────
  function openEditDialog(task: Task) {
    setEditingTask(task);
    setEditForm({
      status: task.status,
      assignedTo: task.assignedTo?.toString() || '',
      qc_specialist: task.qc_specialist?.toString() || 'none',
      scheduler: task.scheduler?.toString() || 'none',
      videographer: task.videographer?.toString() || 'none',
      priority: task.priority || 'none',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
    });
  }

  async function handleSaveEdit() {
    if (!editingTask) return;
    setSaving(true);
    try {
      const updates: any = {};
      if (editForm.status !== editingTask.status) updates.status = editForm.status;
      if (editForm.assignedTo && editForm.assignedTo !== editingTask.assignedTo?.toString()) updates.assignedTo = parseInt(editForm.assignedTo);
      if (editForm.qc_specialist !== (editingTask.qc_specialist?.toString() || 'none')) updates.qc_specialist = editForm.qc_specialist !== 'none' ? parseInt(editForm.qc_specialist) : null;
      if (editForm.scheduler !== (editingTask.scheduler?.toString() || 'none')) updates.scheduler = editForm.scheduler !== 'none' ? parseInt(editForm.scheduler) : null;
      if (editForm.videographer !== (editingTask.videographer?.toString() || 'none')) updates.videographer = editForm.videographer !== 'none' ? parseInt(editForm.videographer) : null;
      if (editForm.priority !== (editingTask.priority || 'none')) updates.priority = editForm.priority !== 'none' ? editForm.priority : null;
      const currentDue = editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split('T')[0] : '';
      if (editForm.dueDate !== currentDue) updates.dueDate = editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null;

      if (Object.keys(updates).length === 0) { toast({ title: 'No changes' }); setEditingTask(null); return; }

      const res = await fetch(`/api/admin/tasks/${editingTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to update task'); }
      toast({ title: 'Success', description: 'Task updated successfully' });
      setEditingTask(null);
      mutateTasks();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  // ── Bulk edit ──────────────────────────
  async function handleBulkEdit() {
    if (selectedTasks.size === 0) return;
    setSaving(true);
    try {
      const updates: any = {};
      if (bulkEditForm.status !== 'no_change') updates.status = bulkEditForm.status;
      if (bulkEditForm.assignedTo !== 'no_change') updates.assignedTo = parseInt(bulkEditForm.assignedTo);
      if (bulkEditForm.qc_specialist !== 'no_change') updates.qc_specialist = bulkEditForm.qc_specialist !== 'none' ? parseInt(bulkEditForm.qc_specialist) : null;
      if (bulkEditForm.scheduler !== 'no_change') updates.scheduler = bulkEditForm.scheduler !== 'none' ? parseInt(bulkEditForm.scheduler) : null;
      if (bulkEditForm.videographer !== 'no_change') updates.videographer = bulkEditForm.videographer !== 'none' ? parseInt(bulkEditForm.videographer) : null;
      if (bulkEditForm.priority !== 'no_change') updates.priority = bulkEditForm.priority !== 'none' ? bulkEditForm.priority : null;
      if (bulkEditForm.dueDate !== 'no_change') updates.dueDate = bulkEditForm.dueDate ? new Date(bulkEditForm.dueDate).toISOString() : null;

      if (Object.keys(updates).length === 0) { toast({ title: 'No changes' }); setShowBulkEdit(false); return; }

      const res = await fetch('/api/admin/tasks/bulk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskIds: Array.from(selectedTasks), updates }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const result = await res.json();
      toast({ title: 'Success', description: `Updated ${result.updated || selectedTasks.size} tasks` });
      setShowBulkEdit(false); setSelectedTasks(new Set()); mutateTasks();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  // ── Delete ─────────────────────────────
  async function handleDeleteTask() {
    if (!deleteConfirmTask || !canDeleteTasks) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${deleteConfirmTask.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete task'); }
      toast({ title: 'Task Deleted', description: `"${deleteConfirmTask.title}" deleted.` });
      setDeleteConfirmTask(null); mutateTasks();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setDeleting(false); }
  }

  async function handleBulkDelete() {
    if (selectedTasks.size === 0 || !canDeleteTasks) return;
    setBulkDeleting(true);
    const taskIds = Array.from(selectedTasks);
    let ok = 0, fail = 0;
    for (const taskId of taskIds) {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        res.ok ? ok++ : fail++;
      } catch { fail++; }
    }
    if (ok > 0) toast({ title: 'Tasks Deleted', description: `Deleted ${ok}${fail > 0 ? `, ${fail} failed` : ''}.` });
    if (fail > 0 && ok === 0) toast({ title: 'Error', description: `Failed to delete ${fail} tasks.`, variant: 'destructive' });
    setShowBulkDelete(false); setSelectedTasks(new Set()); mutateTasks();
    setBulkDeleting(false);
  }

  // ── Refresh ────────────────────────────
  async function handleRefresh() {
    await mutateTasks();
    toast({ title: 'Refreshed', description: 'Task list updated' });
  }

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {[
            { label: 'Total Tasks', value: stats.total, from: 'from-blue-50', to: 'to-blue-100', text: 'text-blue-700', sub: 'text-blue-600' },
            { label: 'Pending', value: stats.byStatus?.PENDING || 0, from: 'from-yellow-50', to: 'to-yellow-100', text: 'text-yellow-700', sub: 'text-yellow-600' },
            { label: 'In Progress', value: stats.byStatus?.IN_PROGRESS || 0, from: 'from-purple-50', to: 'to-purple-100', text: 'text-purple-700', sub: 'text-purple-600' },
            { label: 'Ready for QC', value: stats.byStatus?.READY_FOR_QC || 0, from: 'from-orange-50', to: 'to-orange-100', text: 'text-orange-700', sub: 'text-orange-600' },
            { label: 'Completed', value: stats.byStatus?.COMPLETED || 0, from: 'from-green-50', to: 'to-green-100', text: 'text-green-700', sub: 'text-green-600' },
            { label: 'Overdue', value: stats.overdue, from: 'from-red-50', to: 'to-red-100', text: 'text-red-700', sub: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className={`rounded-lg border p-4 bg-gradient-to-br ${s.from} ${s.to} flex flex-col items-center text-center`}>
              <div className={`text-sm ${s.sub}`}>{s.label}</div>
              <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4 mr-2" />{showFilters ? 'Hide Filters' : 'Show Filters'}
                {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>}
              </Button>
              {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
            </div>
            <div className="flex items-center gap-2">
              {selectedTasks.size > 0 && (
                <>
                  <Button variant="default" size="sm" onClick={() => { setBulkEditForm({ status: 'no_change', assignedTo: 'no_change', qc_specialist: 'no_change', scheduler: 'no_change', videographer: 'no_change', priority: 'no_change', dueDate: 'no_change' }); setShowBulkEdit(true); }}>
                    <Pencil className="h-4 w-4 mr-2" />Edit {selectedTasks.size}
                  </Button>
                  {canDeleteTasks && (
                    <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />Delete {selectedTasks.size}
                    </Button>
                  )}
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isValidating}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />Refresh
              </Button>
              <CreateTaskDialog
                onTaskCreated={() => { toast({ title: 'Success', description: 'Task created. Refreshing...' }); setTimeout(() => mutateTasks(), 800); }}
                trigger={<Button><Plus className="h-4 w-4 mr-2" />Create Task</Button>}
              />
            </div>
          </div>

          {showFilters && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-3">
                {[
                  { label: 'Editor', key: 'editor', items: editors },
                  { label: 'QC Specialist', key: 'qc', items: qcMembers },
                  { label: 'Scheduler', key: 'scheduler', items: schedulers },
                  { label: 'Videographer', key: 'videographer', items: videographers },
                ].map(({ label, key, items }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <Select value={(filters as any)[key]} onValueChange={v => { setFilters(f => ({ ...f, [key]: v })); setPage(1); }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder={`All ${label}s`} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All {label}s</SelectItem>
                        {items.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Client</label>
                  <Select value={filters.client} onValueChange={v => { setFilters(f => ({ ...f, client: v })); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="All Clients" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName || c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={filters.status} onValueChange={v => { setFilters(f => ({ ...f, status: v })); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {Object.entries(statusConfig).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Type</label>
                  <Select value={filters.deliverableType} onValueChange={v => { setFilters(f => ({ ...f, deliverableType: v })); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="All Types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {availableDeliverableTypes.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Month</label>
                  <Select value={filters.month} onValueChange={v => { setFilters(f => ({ ...f, month: v })); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="All Months" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      {availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-end gap-4">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search tasks..." value={filters.search} onChange={e => handleSearchChange(e.target.value)} className="pl-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Due Date Range</label>
                  <DateRangePicker
                    date={{ from: filters.dueDateFrom, to: filters.dueDateTo }}
                    setDate={range => { setFilters(f => ({ ...f, dueDateFrom: range?.from, dueDateTo: range?.to })); setPage(1); }}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-3 px-4 w-12">
                    <Checkbox checked={allSelected} ref={el => { if (el) (el as any).indeterminate = someSelected; }} onCheckedChange={handleSelectAll} aria-label="Select all" />
                  </th>
                  <th className="text-left py-3 px-4 font-medium">Task</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-left py-3 px-4 font-medium">Client</th>
                  <th className="text-left py-3 px-4 font-medium">Editor</th>
                  <th className="text-left py-3 px-4 font-medium">QC</th>
                  <th className="text-left py-3 px-4 font-medium">Scheduler</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Month</th>
                  <th className="text-left py-3 px-4 font-medium">Due Date</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasksLoading && tasks.length === 0
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  : tasks.length === 0
                    ? <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">No tasks found matching your filters</td></tr>
                    : tasks.map(task => {
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !['COMPLETED', 'SCHEDULED'].includes(task.status);
                        const isSelected = selectedTasks.has(task.id);
                        return (
                          <tr key={task.id} className={`border-b hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''} ${tasksLoading ? 'opacity-60' : ''}`}>
                            <td className="py-3 px-4"><Checkbox checked={isSelected} onCheckedChange={c => handleSelectTask(task.id, !!c)} /></td>
                            <td className="py-3 px-4"><div className="max-w-xs font-medium truncate">{task.title || task.description?.slice(0, 50) || 'Untitled Task'}</div></td>
                            <td className="py-3 px-4">
                              <div className="text-sm flex flex-col gap-1">
                                <span>{task.monthlyDeliverable?.type?.replace(/_/g, ' ') || task.oneOffDeliverable?.type?.replace(/_/g, ' ') || '-'}</span>
                                {task.oneOffDeliverable && <Badge variant="outline" className="w-fit text-[10px] h-4 px-1 bg-yellow-50 text-yellow-700 border-yellow-200">One-Off</Badge>}
                              </div>
                            </td>
                            <td className="py-3 px-4"><div className="text-sm">{task.client?.companyName || task.client?.name || '-'}</div></td>
                            <td className="py-3 px-4"><div className="text-sm">{task.editor?.name || '-'}</div></td>
                            <td className="py-3 px-4"><div className="text-sm">{task.qcSpecialist?.name || '-'}</div></td>
                            <td className="py-3 px-4"><div className="text-sm">{task.schedulerUser?.name || '-'}</div></td>
                            <td className="py-3 px-4"><StatusBadge status={task.status} /></td>
                            <td className="py-3 px-4">
                              {task.monthFolder
                                ? <Badge variant="outline" className="text-xs whitespace-nowrap bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">{task.monthFolder}</Badge>
                                : <span className="text-muted-foreground text-xs">-</span>}
                            </td>
                            <td className="py-3 px-4">
                              {task.dueDate
                                ? <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>{new Date(task.dueDate).toLocaleDateString()}{isOverdue && <div className="text-xs text-red-500">Overdue</div>}</div>
                                : <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="py-3 px-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(task)}><Edit className="h-4 w-4 mr-2" />Edit Task</DropdownMenuItem>
                                  {canDeleteTasks && (<><DropdownMenuSeparator /><DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteConfirmTask(task)}><Trash2 className="h-4 w-4 mr-2" />Delete Task</DropdownMenuItem></>)}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedTasks.size > 0 && <span className="font-medium">{selectedTasks.size} selected · </span>}
              Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total} tasks
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}><ChevronLeft className="h-4 w-4" />Previous</Button>
              <span className="text-sm px-2">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Next<ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Single Edit Dialog */}
      <Dialog open={!!editingTask} onOpenChange={o => !o && setEditingTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>{editingTask?.title || editingTask?.description?.slice(0, 50) || 'Untitled Task'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {[
              { label: 'Status', key: 'status', items: Object.entries(statusConfig).map(([k, c]) => ({ id: k, name: c.label })), hasNone: false },
              { label: 'Editor', key: 'assignedTo', items: editors.map(m => ({ id: m.id.toString(), name: m.name })), hasNone: false },
              { label: 'QC Specialist', key: 'qc_specialist', items: qcMembers.map(m => ({ id: m.id.toString(), name: m.name })), hasNone: true },
              { label: 'Scheduler', key: 'scheduler', items: schedulers.map(m => ({ id: m.id.toString(), name: m.name })), hasNone: true },
              { label: 'Videographer', key: 'videographer', items: videographers.map(m => ({ id: m.id.toString(), name: m.name })), hasNone: true },
              { label: 'Priority', key: 'priority', items: ['low', 'medium', 'high', 'urgent'].map(v => ({ id: v, name: v.charAt(0).toUpperCase() + v.slice(1) })), hasNone: true },
            ].map(({ label, key, items, hasNone }) => (
              <div key={key} className="grid gap-2">
                <Label>{label}</Label>
                <Select value={(editForm as any)[key]} onValueChange={v => setEditForm(f => ({ ...f, [key]: v }))}>
                  <SelectTrigger><SelectValue placeholder={`Select ${label}`} /></SelectTrigger>
                  <SelectContent>
                    {hasNone && <SelectItem value="none">None</SelectItem>}
                    {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Input type="date" value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEdit} onOpenChange={setShowBulkEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Edit Tasks</DialogTitle>
            <DialogDescription>Edit {selectedTasks.size} selected tasks. Only changed fields will be updated.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {[
              { label: 'Status', key: 'status', items: Object.entries(statusConfig).map(([k, c]) => ({ id: k, name: c.label })) },
              { label: 'Editor', key: 'assignedTo', items: editors.map(m => ({ id: m.id.toString(), name: m.name })) },
              { label: 'QC Specialist', key: 'qc_specialist', items: [{ id: 'none', name: 'Remove QC' }, ...qcMembers.map(m => ({ id: m.id.toString(), name: m.name }))] },
              { label: 'Scheduler', key: 'scheduler', items: [{ id: 'none', name: 'Remove Scheduler' }, ...schedulers.map(m => ({ id: m.id.toString(), name: m.name }))] },
              { label: 'Videographer', key: 'videographer', items: [{ id: 'none', name: 'Remove Videographer' }, ...videographers.map(m => ({ id: m.id.toString(), name: m.name }))] },
              { label: 'Priority', key: 'priority', items: [{ id: 'none', name: 'Remove Priority' }, ...['low', 'medium', 'high', 'urgent'].map(v => ({ id: v, name: v.charAt(0).toUpperCase() + v.slice(1) }))] },
            ].map(({ label, key, items }) => (
              <div key={key} className="grid gap-2">
                <Label>{label}</Label>
                <Select value={(bulkEditForm as any)[key]} onValueChange={v => setBulkEditForm(f => ({ ...f, [key]: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_change">— No Change —</SelectItem>
                    {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <div className="flex gap-2">
                <Input type="date" value={bulkEditForm.dueDate === 'no_change' ? '' : bulkEditForm.dueDate} onChange={e => setBulkEditForm(f => ({ ...f, dueDate: e.target.value }))} disabled={bulkEditForm.dueDate === 'no_change'} />
                <Button variant="outline" size="sm" onClick={() => setBulkEditForm(f => ({ ...f, dueDate: 'no_change' }))}>Reset</Button>
              </div>
              <p className="text-xs text-muted-foreground">Leave unchanged to keep existing due dates</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEdit(false)}>Cancel</Button>
            <Button onClick={handleBulkEdit} disabled={saving}>{saving ? 'Updating...' : `Update ${selectedTasks.size} Task${selectedTasks.size > 1 ? 's' : ''}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirmTask} onOpenChange={o => !o && setDeleteConfirmTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" />Delete Task</DialogTitle>
            <DialogDescription className="pt-2">
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-medium text-red-800">{deleteConfirmTask?.title || 'Untitled Task'}</p>
                <p className="text-sm text-red-600 mt-1">Client: {deleteConfirmTask?.client?.name || 'Unknown'}</p>
              </div>
              <p className="mt-3 text-sm text-red-600 font-medium">⚠️ This action cannot be undone.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmTask(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTask} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete Permanently'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={showBulkDelete} onOpenChange={o => !o && setShowBulkDelete(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" />Delete {selectedTasks.size} Tasks</DialogTitle>
            <DialogDescription className="pt-2">
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg max-h-48 overflow-y-auto">
                {Array.from(selectedTasks).map(id => { const t = tasks.find(x => x.id === id); return (<div key={id} className="py-1 border-b border-red-100 last:border-0"><p className="font-medium text-red-800 text-sm truncate">{t?.title || 'Untitled'}</p><p className="text-xs text-red-600">{t?.client?.name || 'Unknown Client'}</p></div>); })}
              </div>
              <p className="mt-3 text-sm text-red-600 font-medium">⚠️ This action cannot be undone.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDelete(false)} disabled={bulkDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>{bulkDeleting ? `Deleting...` : `Delete ${selectedTasks.size} Tasks`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}