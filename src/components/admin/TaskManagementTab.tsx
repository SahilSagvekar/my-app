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
import { LinkLfTask } from '../tasks/LinkLfTask';
import {
  ListTodo, Search, RefreshCw, Filter, ChevronLeft, ChevronRight, ChevronDown,
  AlertCircle, Clock, CheckCircle2, XCircle, Eye, MoreHorizontal,
  Calendar, User, Users, Pencil, Trash2, Edit, CloudUpload, Youtube,
} from 'lucide-react';
import { EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '../auth/AuthContext';
import { useViewAsRole } from '../auth/ViewAsRoleContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { TagPicker } from '../workflow/TagPicker';
import {
  TotpSetupDialog,
  TotpResetDialog,
  fetchTotpEnabled,
} from '../auth/TotpDialogs';
import { Smartphone, KeyRound } from 'lucide-react';

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
  _linkedSfCount?: number;
  clientId: string | null;
  editor: { id: number; name: string; email: string; role: string } | null;
  qcSpecialist: { id: number; name: string; role: string } | null;
  schedulerUser: { id: number; name: string; role: string } | null;
  videographerUser: { id: number; name: string; role: string } | null;
  client: { id: string; name: string; companyName: string | null } | null;
  monthlyDeliverable: { id: string; type: string } | null;
  oneOffDeliverable: { id: string; type: string } | null;
  monthFolder: string | null;
  tags?: { id: string; name: string }[];
}

interface FilterState {
  editor: string; qc: string; scheduler: string; videographer: string;
  client: string; status: string; deliverableType: string; month: string;
  search: string; dueDateFrom: Date | undefined; dueDateTo: Date | undefined;
  tag: string;
}

interface TeamMember { id: number; name: string; role: string; roles?: string[]; }
interface Client { id: string; name: string; companyName: string | null; }

// ─────────────────────────────────────────
// Status pill — flat rounded-full badge, colored per status
// ─────────────────────────────────────────

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-700' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-violet-100', text: 'text-violet-700' },
  READY_FOR_QC: { label: 'Quality Control', bg: 'bg-orange-100', text: 'text-orange-700' },
  QC_IN_PROGRESS: { label: 'QC In Progress', bg: 'bg-violet-100', text: 'text-violet-700' },
  COMPLETED: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700' },
  SCHEDULED: { label: 'Scheduled', bg: 'bg-blue-100', text: 'text-blue-700' },
  ON_HOLD: { label: 'On Hold', bg: 'bg-gray-100', text: 'text-gray-700' },
  REJECTED_BY_QC: { label: 'Rejected by QC', bg: 'bg-red-100', text: 'text-red-700' },
  REJECTED_BY_CLIENT: { label: 'Rejected by Client', bg: 'bg-rose-100', text: 'text-rose-700' },
  CLIENT_REVIEW: { label: 'Client Review', bg: 'bg-sky-100', text: 'text-sky-700' },
  VIDEOGRAPHER_ASSIGNED: { label: 'Videographer', bg: 'bg-sky-100', text: 'text-sky-700' },
  HIDDEN: { label: 'Hidden', bg: 'bg-gray-100', text: 'text-gray-500' },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function MonthPill({ month }: { month: string | null }) {
  if (!month) return <span className="text-muted-foreground text-xs">-</span>;
  return (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-white text-foreground">
      {month}
    </span>
  );
}

// ─────────────────────────────────────────
// Skeleton row for perceived performance
// ─────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b">
      <td className="py-3 px-4">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
      </td>
      {[180, 90, 100, 80, 60, 90, 70, 60, 40].map((w, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-4 rounded bg-muted animate-pulse" style={{ width: w }} />
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
  const { viewingAsRole } = useViewAsRole();

  // ── Filters ───────────────────────────
  const [filters, setFilters] = useState<FilterState>({
    editor: 'all', qc: 'all', scheduler: 'all', videographer: 'all',
    client: 'all', status: 'all', deliverableType: 'all', month: 'all',
    search: '', dueDateFrom: undefined, dueDateTo: undefined, tag: 'all',
  });
  const [allTags, setAllTags] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/tags', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => { if (data.ok) setAllTags(data.tags.map((t: any) => t.name)); })
      .catch(() => {});
  }, []);
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
  const [editTags, setEditTags] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({ status: 'no_change', assignedTo: 'no_change', qc_specialist: 'no_change', scheduler: 'no_change', videographer: 'no_change', priority: 'no_change', dueDate: 'no_change' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [mirroringTaskId, setMirroringTaskId] = useState<string | null>(null);
  const [youtubeMirroringTaskId, setYoutubeMirroringTaskId] = useState<string | null>(null);
  const [manageVideosTask, setManageVideosTask] = useState<Task | null>(null);
  const [taskFiles, setTaskFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [filePendingDelete, setFilePendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [fileDeleteTotp, setFileDeleteTotp] = useState('');
  const [fileDeleteTotpError, setFileDeleteTotpError] = useState('');
  const [showFileTotpSetup, setShowFileTotpSetup] = useState(false);
  const [showFileTotpReset, setShowFileTotpReset] = useState(false);

  const canManageVideos = user?.role?.toLowerCase() === 'admin';
  const isAdmin = canManageVideos;

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
    if (filters.tag !== 'all') p.set('tag', filters.tag);
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (filters.dueDateFrom) p.set('dueDateFrom', filters.dueDateFrom.toISOString());
    if (filters.dueDateTo) p.set('dueDateTo', filters.dueDateTo.toISOString());
    return p.toString();
  }, [page, filters, debouncedSearch]);

  // ── SWR: tasks (main data) ─────────────
  // Sends x-viewing-as so a multi-role account (e.g. a scheduler who's also
  // qc) viewing this tab from the QC portal resolves to their real access
  // server-side, instead of only their primary role — see
  // /api/admin/tasks/route.ts's resolveEffectiveRole.
  const tasksFetcher = useCallback(
    (url: string) =>
      fetch(url, {
        credentials: 'include',
        headers: viewingAsRole ? { 'x-viewing-as': viewingAsRole } : {},
      }).then(r => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      }),
    [viewingAsRole]
  );

  const { data: taskData, isLoading: tasksLoading, isValidating, mutate: mutateTasks } = useSWR(
    user ? `/api/admin/tasks?${queryString}` : null,
    tasksFetcher,
    { keepPreviousData: true, dedupingInterval: 10000 }
  );

  // ── SWR: team members (stable, cache 5min) ──
  const { data: teamData } = useSWR('/api/employee/list?status=ACTIVE', fetcher, {
    dedupingInterval: 300000, revalidateOnFocus: false,
  });

  // ── SWR: clients for dropdown (stable, cache 5min) ──
  const { data: clientsData } = useSWR('/api/employee/list?role=client', fetcher, {
    dedupingInterval: 300000, revalidateOnFocus: false,
  });

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
  const hasRole = (m: TeamMember, role: string) =>
    m.role === role || (Array.isArray(m.roles) && m.roles.includes(role));
  const editors = teamMembers.filter(m => hasRole(m, 'editor'));
  const qcMembers = teamMembers.filter(m => hasRole(m, 'qc'));
  const schedulers = teamMembers.filter(m => hasRole(m, 'scheduler'));
  const videographers = teamMembers.filter(m => hasRole(m, 'videographer'));

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

  useEffect(() => { setSelectedTasks(new Set()); }, [page, queryString]);

  // ── Filter helpers ─────────────────────
  const clearFilters = () => {
    setFilters({ editor: 'all', qc: 'all', scheduler: 'all', videographer: 'all', client: 'all', status: 'all', deliverableType: 'all', month: 'all', search: '', dueDateFrom: undefined, dueDateTo: undefined, tag: 'all' });
    setDebouncedSearch('');
    setPage(1);
  };

  const activeFilterCount = [
    filters.editor !== 'all', filters.qc !== 'all', filters.scheduler !== 'all',
    filters.videographer !== 'all', filters.client !== 'all', filters.status !== 'all',
    filters.deliverableType !== 'all', filters.month !== 'all', filters.tag !== 'all',
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
    setEditTags((task.tags || []).map(t => t.name));
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

      const res = await fetch(`/api/admin/tasks/${editingTask.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(viewingAsRole ? { 'x-viewing-as': viewingAsRole } : {}),
        },
        body: JSON.stringify(updates),
      });
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

      const res = await fetch('/api/admin/tasks/bulk', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(viewingAsRole ? { 'x-viewing-as': viewingAsRole } : {}),
        },
        body: JSON.stringify({ taskIds: Array.from(selectedTasks), updates }),
      });
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

  // ── Manage Videos ──────────────────────
  async function openManageVideos(task: Task) {
    setManageVideosTask(task);
    setLoadingFiles(true);
    setTaskFiles([]);
    try {
      const res = await fetch(`/api/tasks/${task.id}/files`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load files');
      setTaskFiles(data.files || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to load videos', variant: 'destructive' });
    } finally {
      setLoadingFiles(false);
    }
  }

  async function handleDeleteVideo(fileId: string, fileName: string) {
    if (!canManageVideos) return;
    const enabled = await fetchTotpEnabled();
    if (!enabled) {
      setFilePendingDelete({ id: fileId, name: fileName });
      setShowFileTotpSetup(true);
      return;
    }
    setFilePendingDelete({ id: fileId, name: fileName });
    setFileDeleteTotp('');
    setFileDeleteTotpError('');
  }

  async function confirmDeleteVideo() {
    if (!filePendingDelete || !canManageVideos) return;
    const clean = fileDeleteTotp.replace(/\s/g, '');
    if (clean.length !== 6) {
      setFileDeleteTotpError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setDeletingFileId(filePendingDelete.id);
    setFileDeleteTotpError('');
    try {
      const res = await fetch(`/api/files/${filePendingDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'NOT_SETUP' || data.code === 'NOT_ENABLED') {
          setShowFileTotpSetup(true);
          throw new Error(data.error || 'Authenticator not set up');
        }
        if (data.requiresTotp || data.code === 'INVALID' || data.code === 'MISSING') {
          setFileDeleteTotpError(data.error || 'Invalid authenticator code');
          return;
        }
        throw new Error(data.error || 'Failed to delete file');
      }
      setTaskFiles(prev => prev.filter(f => f.id !== filePendingDelete.id));
      toast({ title: 'Video deleted', description: `"${filePendingDelete.name}" removed.` });
      setFilePendingDelete(null);
      setFileDeleteTotp('');
      mutateTasks();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete video', variant: 'destructive' });
    } finally {
      setDeletingFileId(null);
    }
  }

  async function handleDriveMirror(taskId: string) {
    setMirroringTaskId(taskId);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}/drive-mirror`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Drive mirror failed', description: data.error || 'Unknown error', variant: 'destructive' });
        return;
      }
      if (data.dispatched === 0) {
        toast({ title: 'Nothing to mirror', description: data.results?.[0]?.reason || 'No active video files with S3 keys found', variant: 'destructive' });
      } else {
        toast({
          title: 'Drive mirror dispatched',
          description: `${data.dispatched} of ${data.total} file${data.total !== 1 ? 's' : ''} sent to file server. Drive URL will update in a few minutes.`,
        });
      }
    } catch (err: any) {
      toast({ title: 'Drive mirror failed', description: err.message, variant: 'destructive' });
    } finally {
      setMirroringTaskId(null);
    }
  }

  async function handleYoutubeMirror(taskId: string) {
    setYoutubeMirroringTaskId(taskId);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}/youtube-mirror`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'YouTube upload failed', description: data.error || 'Unknown error', variant: 'destructive' });
        return;
      }
      if (data.dispatched === 0) {
        toast({ title: 'Nothing to upload', description: data.results?.[0]?.reason || 'No active video files found', variant: 'destructive' });
      } else {
        toast({
          title: 'YouTube upload complete',
          description: `${data.dispatched} of ${data.total} file${data.total !== 1 ? 's' : ''} uploaded — client will see it in the review screen.`,
        });
      }
    } catch (err: any) {
      toast({ title: 'YouTube upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setYoutubeMirroringTaskId(null);
    }
  }

  // ── Filter column config (drives the label-above-select row) ──
  const filterColumns: { label: string; key: keyof FilterState; items: { id: string | number; name: string }[] }[] = [
    { label: 'Editors', key: 'editor', items: editors.map(m => ({ id: m.id, name: m.name })) },
    { label: 'QCs', key: 'qc', items: qcMembers.map(m => ({ id: m.id, name: m.name })) },
    { label: 'Schedulers', key: 'scheduler', items: schedulers.map(m => ({ id: m.id, name: m.name })) },
    { label: 'Videographers', key: 'videographer', items: videographers.map(m => ({ id: m.id, name: m.name })) },
    { label: 'Clients', key: 'client', items: clients.map(c => ({ id: c.id, name: c.companyName || c.name })) },
    { label: 'Statuses', key: 'status', items: Object.entries(statusConfig).map(([k, c]) => ({ id: k, name: c.label })) },
    { label: 'Types', key: 'deliverableType', items: availableDeliverableTypes.map(t => ({ id: t, name: t.replace(/_/g, ' ') })) },
    { label: 'Months', key: 'month', items: availableMonths.map(m => ({ id: m, name: m })) },
    { label: 'Tags', key: 'tag', items: allTags.map(t => ({ id: t, name: t })) },
  ];

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Tasks', value: stats.total, bg: 'bg-blue-50', text: 'text-blue-700', sub: 'text-blue-600' },
            { label: 'Pending', value: stats.byStatus?.PENDING || 0, bg: 'bg-yellow-50', text: 'text-yellow-700', sub: 'text-yellow-600' },
            { label: 'In Progress', value: stats.byStatus?.IN_PROGRESS || 0, bg: 'bg-purple-50', text: 'text-purple-700', sub: 'text-purple-600' },
            { label: 'Quality Control', value: stats.byStatus?.READY_FOR_QC || 0, bg: 'bg-orange-50', text: 'text-orange-700', sub: 'text-orange-600' },
            { label: 'Completed', value: stats.byStatus?.COMPLETED || 0, bg: 'bg-green-50', text: 'text-green-700', sub: 'text-green-600' },
            { label: 'Overdue', value: stats.overdue, bg: 'bg-red-50', text: 'text-red-700', sub: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-5 ${s.bg} flex flex-col items-center text-center`}>
              <div className={`text-sm font-medium ${s.sub}`}>{s.label}</div>
              <div className={`text-3xl font-bold mt-1 ${s.text}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? 'Hide Filters' : 'Show Filters'}
              {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear Filters</Button>
            )}
            <DateRangePicker
              date={{ from: filters.dueDateFrom, to: filters.dueDateTo }}
              setDate={range => { setFilters(f => ({ ...f, dueDateFrom: range?.from, dueDateTo: range?.to })); setPage(1); }}
            />
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tasks..." value={filters.search} onChange={e => handleSearchChange(e.target.value)} className="pl-10 h-9" />
            </div>
            <Button variant="outline" onClick={handleRefresh} disabled={isValidating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />Refresh
            </Button>
            {user?.role?.toLowerCase() !== 'qc' && (
              <CreateTaskDialog
                onTaskCreated={() => { toast({ title: 'Success', description: 'Task created. Refreshing...' }); setTimeout(() => mutateTasks(), 800); }}
                trigger={<Button className="bg-black text-white hover:bg-black/90"><Plus className="h-4 w-4 mr-2" />Create Task</Button>}
              />
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3">
              {filterColumns.map(({ label, key, items }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <Select value={(filters as any)[key]} onValueChange={v => { setFilters(f => ({ ...f, [key]: v })); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={label} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{label}</SelectItem>
                      {items.map(i => <SelectItem key={i.id} value={i.id.toString()}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardContent className="p-0">
          {/* Bulk action bar — appears once one or more tasks are ticked */}
          {selectedTasks.size > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
              <div className="text-sm font-medium">
                {selectedTasks.size} task{selectedTasks.size > 1 ? 's' : ''} selected
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedTasks(new Set())}>
                  Clear Selection
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setBulkEditForm({ status: 'no_change', assignedTo: 'no_change', qc_specialist: 'no_change', scheduler: 'no_change', videographer: 'no_change', priority: 'no_change', dueDate: 'no_change' });
                    setShowBulkEdit(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />Edit Selected
                </Button>
                {canDeleteTasks && (
                  <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />Delete Selected
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="w-10 py-3 px-4">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={(checked) => handleSelectAll(checked === true)}
                      aria-label="Select all tasks"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Task Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editor</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">QC</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheduler</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Month</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasksLoading && tasks.length === 0
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  : tasks.length === 0
                    ? <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No tasks found matching your filters</td></tr>
                    : tasks.map(task => {
                        const isSelected = selectedTasks.has(task.id);
                        return (
                          <tr
                            key={task.id}
                            onClick={() => handleSelectTask(task.id, !isSelected)}
                            className={`border-b hover:bg-muted/50 cursor-pointer ${isSelected ? 'bg-primary/5' : ''} ${tasksLoading ? 'opacity-60' : ''}`}
                          >
                            <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectTask(task.id, checked === true)}
                                aria-label={`Select ${task.title || 'task'}`}
                              />
                            </td>
                            <td className="py-4 px-4"><div className="max-w-xs font-semibold truncate">{task.title || task.description?.slice(0, 50) || 'Untitled Task'}</div></td>
                            <td className="py-4 px-4">
                              <div className="text-sm flex flex-col gap-1">
                                <span>{task.monthlyDeliverable?.type?.replace(/_/g, ' ') || task.oneOffDeliverable?.type?.replace(/_/g, ' ') || '-'}</span>
                                {task.oneOffDeliverable && <Badge variant="outline" className="w-fit text-[10px] h-4 px-1 bg-yellow-50 text-yellow-700 border-yellow-200">One-Off</Badge>}
                              </div>
                            </td>
                            <td className="py-4 px-4"><div className="text-sm">{task.client?.companyName || task.client?.name || '-'}</div></td>
                            <td className="py-4 px-4"><div className="text-sm">{task.editor?.name || '-'}</div></td>
                            <td className="py-4 px-4"><div className="text-sm">{task.qcSpecialist?.name || '-'}</div></td>
                            <td className="py-4 px-4"><div className="text-sm">{task.schedulerUser?.name || '-'}</div></td>
                            <td className="py-4 px-4"><StatusBadge status={task.status} /></td>
                            <td className="py-4 px-4"><MonthPill month={task.monthFolder} /></td>
                            <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(task)}><Edit className="h-4 w-4 mr-2" />Edit Task</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {canManageVideos && (
                                    <DropdownMenuItem onClick={() => openManageVideos(task)}>
                                      <Trash2 className="h-4 w-4 mr-2" />Manage Videos
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleDriveMirror(task.id)}
                                    disabled={mirroringTaskId === task.id}
                                    className="text-blue-600 focus:text-blue-600"
                                  >
                                    <CloudUpload className="h-4 w-4 mr-2" />
                                    {mirroringTaskId === task.id ? 'Mirroring...' : 'Trigger Drive Mirror'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleYoutubeMirror(task.id)}
                                    disabled={youtubeMirroringTaskId === task.id}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Youtube className="h-4 w-4 mr-2" />
                                    {youtubeMirroringTaskId === task.id ? 'Uploading...' : 'Trigger YouTube Upload'}
                                  </DropdownMenuItem>
                                  {(() => {
                                    const dtype = task.monthlyDeliverable?.type || task.oneOffDeliverable?.type || '';
                                    const isLF = dtype.toLowerCase().includes('long') || dtype.toUpperCase().includes('LF');
                                    if (!isLF) return null;
                                    return (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                          <span className="mr-2 text-sm">🔗</span>Link SF Tasks
                                        </DropdownMenuItem>
                                      </>
                                    );
                                  })()}
                                  {canDeleteTasks && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteConfirmTask(task)}>
                                        <Trash2 className="h-4 w-4 mr-2" />Delete Task
                                      </DropdownMenuItem>
                                    </>
                                  )}
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
        <DialogContent className="max-w-xl">
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
            {editingTask && (
              <div className="grid gap-2">
                <Label>Tags</Label>
                <TagPicker taskId={editingTask.id} tags={editTags} onChange={setEditTags} canRemove={isAdmin} />
              </div>
            )}
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
          {editingTask && (() => {
            const dtype = editingTask.monthlyDeliverable?.type || editingTask.oneOffDeliverable?.type || '';
            const isSF = dtype.toLowerCase().includes('short') || dtype.toUpperCase().includes('SF');
            return isSF ? (
              <div className="border-t pt-4 px-1">
                <LinkLfTask
                  sfTaskId={editingTask.id}
                  clientId={editingTask.clientId}
                  canEdit={true}
                />
              </div>
            ) : null;
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEdit(false)}>Cancel</Button>
            <Button onClick={handleBulkEdit} disabled={saving}>{saving ? 'Updating...' : `Update ${selectedTasks.size} Task${selectedTasks.size > 1 ? 's' : ''}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirmTask} onOpenChange={o => !o && setDeleteConfirmTask(null)}>
        <DialogContent className="max-w-xl">
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
        <DialogContent className="max-w-xl">
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

      {/* Manage Videos Dialog */}
      <Dialog open={!!manageVideosTask} onOpenChange={o => !o && setManageVideosTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5" />Manage Videos</DialogTitle>
            <DialogDescription>
              {manageVideosTask?.title || 'Untitled Task'} — {manageVideosTask?.client?.name || 'Unknown Client'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {loadingFiles && (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading videos...</p>
            )}
            {!loadingFiles && taskFiles.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No files on this task.</p>
            )}
            {!loadingFiles && taskFiles.filter(f => f.isActive).map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.folderType || 'file'} · v{file.version}
                    {typeof file.size === 'number' && file.size > 0
                      ? ` · ${(file.size / (1024 * 1024)).toFixed(1)} MB`
                      : ''}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteVideo(file.id, file.name)}
                  disabled={deletingFileId === file.id}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deletingFileId === file.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageVideosTask(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete video — authenticator required */}
      <Dialog
        open={!!filePendingDelete && !showFileTotpSetup && !showFileTotpReset}
        onOpenChange={(o) => {
          if (!o) {
            setFilePendingDelete(null);
            setFileDeleteTotp('');
            setFileDeleteTotpError('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete video?
            </DialogTitle>
            <DialogDescription>
              Delete <strong>{filePendingDelete?.name}</strong>? This removes it from storage and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="file-delete-totp" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-600" />
              Authenticator code
            </Label>
            <Input
              id="file-delete-totp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={fileDeleteTotp}
              onChange={(e) => {
                setFileDeleteTotp(e.target.value.replace(/\D/g, ''));
                setFileDeleteTotpError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !deletingFileId) confirmDeleteVideo();
              }}
              placeholder="000000"
              className="text-center text-xl tracking-[0.4em] font-mono"
              autoFocus
            />
            {fileDeleteTotpError && (
              <p className="text-sm text-red-500">{fileDeleteTotpError}</p>
            )}
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
              onClick={() => setShowFileTotpReset(true)}
            >
              <KeyRound className="h-3 w-3" />
              Reset authenticator &amp; set up again
            </button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFilePendingDelete(null);
                setFileDeleteTotp('');
                setFileDeleteTotpError('');
              }}
              disabled={!!deletingFileId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteVideo}
              disabled={!!deletingFileId || fileDeleteTotp.length !== 6}
            >
              {deletingFileId ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TotpSetupDialog
        open={showFileTotpSetup}
        purposeNote="After setup, you'll need this code every time you delete files."
        onCancel={() => {
          setShowFileTotpSetup(false);
          setFilePendingDelete(null);
        }}
        onEnabled={async () => {
          setShowFileTotpSetup(false);
          setFileDeleteTotp('');
          setFileDeleteTotpError('');
        }}
      />

      <TotpResetDialog
        open={showFileTotpReset}
        onCancel={() => setShowFileTotpReset(false)}
        onReset={async () => {
          setShowFileTotpReset(false);
          setShowFileTotpSetup(true);
        }}
      />
    </div>
  );
}