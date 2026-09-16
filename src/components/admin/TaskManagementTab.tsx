// components/admin/TaskManagementTab.tsx
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { DateRangePicker } from '../ui/date-range-picker';
import { LinkLfTask } from '../tasks/LinkLfTask';
import {
  ListTodo, Search, RefreshCw, Filter, ChevronLeft, ChevronRight,
  AlertCircle, Clock, CheckCircle2, XCircle, Eye, MoreHorizontal,
  Calendar, User, Users, Pencil, Trash2, Edit, CloudUpload, Youtube,
  ExternalLink, FileText, Video, Image as ImageIcon, Music, Archive,
} from 'lucide-react';
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
import { TagPicker } from '../workflow/TagPicker';

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
// Status Badge
// ─────────────────────────────────────────

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; tone: string }> = {
  PENDING: { label: 'Pending', variant: 'secondary', icon: <Clock className="h-3.5 w-3.5" />, tone: 'text-yellow-600' },
  IN_PROGRESS: { label: 'In Progress', variant: 'default', icon: <RefreshCw className="h-3.5 w-3.5" />, tone: 'text-purple-600' },
  READY_FOR_QC: { label: 'Ready for QC', variant: 'outline', icon: <Eye className="h-3.5 w-3.5" />, tone: 'text-orange-600' },
  QC_IN_PROGRESS: { label: 'QC In Progress', variant: 'default', icon: <RefreshCw className="h-3.5 w-3.5" />, tone: 'text-purple-600' },
  COMPLETED: { label: 'Completed', variant: 'default', icon: <CheckCircle2 className="h-3.5 w-3.5" />, tone: 'text-green-600' },
  SCHEDULED: { label: 'Scheduled', variant: 'default', icon: <Calendar className="h-3.5 w-3.5" />, tone: 'text-blue-600' },
  ON_HOLD: { label: 'On Hold', variant: 'secondary', icon: <AlertCircle className="h-3.5 w-3.5" />, tone: 'text-slate-500' },
  REJECTED: { label: 'Rejected', variant: 'destructive', icon: <XCircle className="h-3.5 w-3.5" />, tone: 'text-red-600' },
  CLIENT_REVIEW: { label: 'Client Review', variant: 'outline', icon: <User className="h-3.5 w-3.5" />, tone: 'text-amber-600' },
  VIDEOGRAPHER_ASSIGNED: { label: 'Videographer', variant: 'outline', icon: <Users className="h-3.5 w-3.5" />, tone: 'text-blue-600' },
  HIDDEN: { label: 'Hidden', variant: 'secondary', icon: null, tone: 'text-slate-500' },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, variant: 'secondary' as const, icon: null, tone: 'text-slate-600' };
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      {config.label}
    </span>
  );
}

function formatMonthFolder(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^([A-Za-z]+)-(\d{4})$/);
  if (!match) return value;
  const date = new Date(`${match[1]} 1, ${match[2]}`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatFileSize(bytes?: number | null) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatFolderType(type?: string | null) {
  if (!type) return 'Main Task File';
  switch (type.toLowerCase()) {
    case 'main': return 'Main Task File';
    case 'thumbnails': return 'Thumbnail';
    case 'music-license': return 'Music License';
    case 'covers': return 'Cover Image';
    case 'tiles': return 'Tile';
    case 'rawfootage': return 'Raw Footage';
    case 'essentials': return 'Essentials';
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

function getFileIcon(mimeType?: string | null, name?: string) {
  const ext = (name?.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return <Video className="h-4 w-4 text-purple-500" />;
  }
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
    return <ImageIcon className="h-4 w-4 text-blue-500" />;
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'aac', 'ogg'].includes(ext)) {
    return <Music className="h-4 w-4 text-emerald-500" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className="h-4 w-4 text-amber-500" />;
  }
  return <FileText className="h-4 w-4 text-slate-500" />;
}

// ─────────────────────────────────────────
// Skeleton row for perceived performance
// ─────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-4 py-3.5"><div className="h-4 w-4 rounded bg-slate-100 animate-pulse" /></td>
      {[200, 80, 100, 80, 60, 80, 90, 70, 40].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: w }} />
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
  const [deletionRequests, setDeletionRequests] = useState<any[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [fileFilterStatus, setFileFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [fileFolderFilter, setFileFolderFilter] = useState<string>('all');

  const availableFolders = useMemo(() => {
    const folders = new Set<string>();
    taskFiles.forEach(f => {
      if (f.folderType) folders.add(f.folderType);
    });
    return Array.from(folders);
  }, [taskFiles]);

  const filteredTaskFiles = useMemo(() => {
    return taskFiles.filter((file) => {
      if (fileFilterStatus === 'active' && !file.isActive) return false;
      if (fileFilterStatus === 'inactive' && file.isActive) return false;
      if (fileFolderFilter !== 'all' && (file.folderType || 'main') !== fileFolderFilter) return false;
      return true;
    });
  }, [taskFiles, fileFilterStatus, fileFolderFilter]);

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  // 🔥 Videographer can now delete task files too (see DELETE
  // /api/files/[id]) — kept separate from isAdmin so this doesn't also
  // grant videographer other admin-only things (e.g. tag removal below).
  const canManageVideos = isAdmin || user?.role?.toLowerCase() === 'videographer';

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
  // Match on primary role OR the roles[] array — a multi-role account (e.g.
  // Daena: editor + scheduler + qc) has one primary `role` but should still
  // show up in every dropdown for a role it actually holds.
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

  // Clear selection on page change
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

  // ── Manage Files ──────────────────────
  async function openManageVideos(task: Task) {
    setManageVideosTask(task);
    setLoadingFiles(true);
    setTaskFiles([]);
    setDeletionRequests([]);
    setFileFilterStatus('all');
    setFileFolderFilter('all');
    try {
      const [filesRes, requestsRes] = await Promise.all([
        fetch(`/api/tasks/${task.id}/files`),
        fetch(`/api/tasks/${task.id}/files/deletion-requests`),
      ]);
      const filesData = await filesRes.json();
      if (!filesRes.ok) throw new Error(filesData.error || 'Failed to load files');
      setTaskFiles(filesData.files || []);

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setDeletionRequests((requestsData.requests || []).filter((r: any) => r.status === 'PENDING'));
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to load task files', variant: 'destructive' });
    } finally {
      setLoadingFiles(false);
    }
  }

  async function handleDeletionRequestDecision(requestId: string, action: 'approve' | 'reject', fileId: string) {
    setProcessingRequestId(requestId);
    try {
      const res = await fetch(`/api/files/deletion-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} request`);

      setDeletionRequests(prev => prev.filter(r => r.id !== requestId));
      if (action === 'approve') {
        setTaskFiles(prev => prev.filter(f => f.id !== fileId));
        mutateTasks();
      }
      toast({
        title: action === 'approve' ? 'Deletion approved' : 'Request rejected',
        description: action === 'approve' ? 'File removed.' : 'The editor was notified.',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || `Failed to ${action} request`, variant: 'destructive' });
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleDeleteVideo(fileId: string, fileName: string) {
    if (!canManageVideos) return;
    if (!confirm(`Delete "${fileName}"? This removes it from storage and cannot be undone.`)) return;
    setDeletingFileId(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete file');
      setTaskFiles(prev => prev.filter(f => f.id !== fileId));
      toast({ title: 'File deleted', description: `"${fileName}" removed.` });
      mutateTasks();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete file', variant: 'destructive' });
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

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Stats — pastel summary cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Total Tasks', value: stats.total, bg: 'bg-sky-50', text: 'text-sky-700' },
            { label: 'Pending', value: stats.byStatus?.PENDING || 0, bg: 'bg-amber-50', text: 'text-amber-700' },
            { label: 'In Progress', value: stats.byStatus?.IN_PROGRESS || 0, bg: 'bg-violet-50', text: 'text-violet-700' },
            { label: 'Ready for QC', value: stats.byStatus?.READY_FOR_QC || 0, bg: 'bg-orange-50', text: 'text-orange-700' },
            { label: 'Completed', value: stats.byStatus?.COMPLETED || 0, bg: 'bg-emerald-50', text: 'text-emerald-700' },
            { label: 'Overdue', value: stats.overdue, bg: 'bg-rose-50', text: 'text-rose-700' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl ${s.bg} px-4 py-5 text-center`}>
              <div className={`text-sm font-medium ${s.text}`}>{s.label}</div>
              <div className={`mt-1 text-3xl font-bold tracking-tight ${s.text}`}>
                {Number(s.value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + table in one bordered panel */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-slate-200 bg-white font-medium text-slate-800"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
                Clear
              </Button>
            )}
            <DateRangePicker
              date={{ from: filters.dueDateFrom, to: filters.dueDateTo }}
              setDate={(range) => {
                setFilters((f) => ({ ...f, dueDateFrom: range?.from, dueDateTo: range?.to }));
                setPage(1);
              }}
              className="h-9 w-auto min-w-[140px] border-slate-200 bg-white font-medium text-slate-800"
            />
          </div>

          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-9 border-transparent bg-slate-100 pl-10 text-sm shadow-none placeholder:text-slate-400 focus-visible:border-slate-200 focus-visible:bg-white focus-visible:ring-0"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {selectedTasks.size > 0 && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setBulkEditForm({
                      status: 'no_change',
                      assignedTo: 'no_change',
                      qc_specialist: 'no_change',
                      scheduler: 'no_change',
                      videographer: 'no_change',
                      priority: 'no_change',
                      dueDate: 'no_change',
                    });
                    setShowBulkEdit(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit {selectedTasks.size}
                </Button>
                {canDeleteTasks && (
                  <Button variant="destructive" size="sm" className="h-9" onClick={() => setShowBulkDelete(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {selectedTasks.size}
                  </Button>
                )}
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-slate-200 bg-white font-medium text-slate-800"
              onClick={handleRefresh}
              disabled={isValidating}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
              {[
                { label: 'Editor', key: 'editor', items: editors },
                { label: 'QC Specialist', key: 'qc', items: qcMembers },
                { label: 'Scheduler', key: 'scheduler', items: schedulers },
                { label: 'Videographer', key: 'videographer', items: videographers },
              ].map(({ label, key, items }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-slate-500">{label}</label>
                  <Select
                    value={(filters as any)[key]}
                    onValueChange={(v) => {
                      setFilters((f) => ({ ...f, [key]: v }));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 bg-white">
                      <SelectValue placeholder={`All ${label}s`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All {label}s</SelectItem>
                      {items.map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="space-y-1">
                <label className="text-xs text-slate-500">Client</label>
                <Select
                  value={filters.client}
                  onValueChange={(v) => {
                    setFilters((f) => ({ ...f, client: v }));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 bg-white">
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

              <div className="space-y-1">
                <label className="text-xs text-slate-500">Status</label>
                <Select
                  value={filters.status}
                  onValueChange={(v) => {
                    setFilters((f) => ({ ...f, status: v }));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(statusConfig).map(([k, c]) => (
                      <SelectItem key={k} value={k}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500">Type</label>
                <Select
                  value={filters.deliverableType}
                  onValueChange={(v) => {
                    setFilters((f) => ({ ...f, deliverableType: v }));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {availableDeliverableTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500">Month</label>
                <Select
                  value={filters.month}
                  onValueChange={(v) => {
                    setFilters((f) => ({ ...f, month: v }));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {availableMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500">Tag</label>
                <Select
                  value={filters.tag}
                  onValueChange={(v) => {
                    setFilters((f) => ({ ...f, tag: v }));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="All Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el) (el as any).indeterminate = someSelected;
                    }}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Task Name
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Editor
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  QC
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Scheduler
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Month
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tasksLoading && tasks.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-slate-500">
                    No tasks found matching your filters
                  </td>
                </tr>
              ) : (
                tasks.map((task, index) => {
                  const isSelected = selectedTasks.has(task.id);
                  return (
                    <tr
                      key={task.id}
                      className={`border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${
                        isSelected ? 'bg-sky-50/60' : index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      } ${tasksLoading ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(c) => handleSelectTask(task.id, !!c)}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="max-w-xs truncate text-sm font-semibold text-slate-900">
                          {task.title || task.description?.slice(0, 50) || 'Untitled Task'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1 text-sm text-slate-700">
                          <span>
                            {task.monthlyDeliverable?.type?.replace(/_/g, ' ') ||
                              task.oneOffDeliverable?.type?.replace(/_/g, ' ') ||
                              '-'}
                          </span>
                          {task.oneOffDeliverable && (
                            <Badge
                              variant="outline"
                              className="h-4 w-fit border-yellow-200 bg-yellow-50 px-1 text-[10px] text-yellow-700"
                            >
                              One-Off
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700">
                        {task.client?.companyName || task.client?.name || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700">{task.editor?.name || '-'}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-700">
                        {task.qcSpecialist?.name || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700">
                        <div className="flex flex-col gap-0.5 leading-snug">
                          {task.schedulerUser?.name ? (
                            <span>{task.schedulerUser.name}</span>
                          ) : (
                            <span>-</span>
                          )}
                          {task.videographerUser?.name && (
                            <span className="text-slate-500">{task.videographerUser.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        {task.monthFolder ? (
                          <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {formatMonthFolder(task.monthFolder)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(task)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Task
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {canManageVideos && (
                              <DropdownMenuItem onClick={() => openManageVideos(task)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Manage Files
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDriveMirror(task.id)}
                              disabled={mirroringTaskId === task.id}
                              className="text-blue-600 focus:text-blue-600"
                            >
                              <CloudUpload className="mr-2 h-4 w-4" />
                              {mirroringTaskId === task.id ? 'Mirroring...' : 'Trigger Drive Mirror'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleYoutubeMirror(task.id)}
                              disabled={youtubeMirroringTaskId === task.id}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Youtube className="mr-2 h-4 w-4" />
                              {youtubeMirroringTaskId === task.id
                                ? 'Uploading...'
                                : 'Trigger YouTube Upload'}
                            </DropdownMenuItem>
                            {(() => {
                              const dtype =
                                task.monthlyDeliverable?.type || task.oneOffDeliverable?.type || '';
                              const isLF =
                                dtype.toLowerCase().includes('long') ||
                                dtype.toUpperCase().includes('LF');
                              if (!isLF) return null;
                              return (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                    <span className="mr-2 text-sm">🔗</span>
                                    Link SF Tasks
                                  </DropdownMenuItem>
                                </>
                              );
                            })()}
                            {canDeleteTasks && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => setDeleteConfirmTask(task)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Task
                                </DropdownMenuItem>
                              </>
                            )}
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

        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            {selectedTasks.size > 0 && (
              <span className="font-medium text-slate-700">{selectedTasks.size} selected · </span>
            )}
            Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of{' '}
            {total.toLocaleString()} tasks
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-slate-200"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="px-2 text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-slate-200"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
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
          {/* SF → LF linking — only shown for Short Form tasks (linking initiated from the SF side) */}
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
      {/* Manage Files Dialog — admin + videographer, per instructions delete
          bypasses the QC/Completed/Posted/Scheduled lock (see /api/files/[id]/route.ts) */}
      <Dialog open={!!manageVideosTask} onOpenChange={o => !o && setManageVideosTask(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />Manage Task Files
            </DialogTitle>
            <DialogDescription>
              {manageVideosTask?.title || 'Untitled Task'} — {manageVideosTask?.client?.name || 'Unknown Client'}
              {taskFiles.length > 0 && ` · ${taskFiles.length} file(s) total`}
            </DialogDescription>
          </DialogHeader>

          {/* Pending Deletion Requests */}
          {deletionRequests.length > 0 && (
            <div className="space-y-2 mb-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                Pending Deletion Requests ({deletionRequests.length})
              </p>
              {deletionRequests.map((req) => {
                const requestedFile = taskFiles.find(f => f.id === req.fileId);
                return (
                  <div key={req.id} className="flex items-center justify-between gap-3 p-2 bg-background/80 rounded border">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{requestedFile?.name || req.fileId}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Requested by {req.requester?.name || req.requester?.email || 'an editor'}
                        {req.reason ? ` — "${req.reason}"` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletionRequestDecision(req.id, 'reject', req.fileId)}
                        disabled={processingRequestId === req.id}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletionRequestDecision(req.id, 'approve', req.fileId)}
                        disabled={processingRequestId === req.id}
                      >
                        {processingRequestId === req.id ? 'Working...' : 'Approve & Delete'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filters Bar */}
          {!loadingFiles && taskFiles.length > 0 && (
            <div className="flex items-center justify-between gap-2 py-2 border-b text-xs flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant={fileFilterStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setFileFilterStatus('all')}
                >
                  All ({taskFiles.length})
                </Button>
                <Button
                  variant={fileFilterStatus === 'active' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setFileFilterStatus('active')}
                >
                  Active ({taskFiles.filter(f => f.isActive).length})
                </Button>
                <Button
                  variant={fileFilterStatus === 'inactive' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setFileFilterStatus('inactive')}
                >
                  Superseded / Inactive ({taskFiles.filter(f => !f.isActive).length})
                </Button>
              </div>

              {availableFolders.length > 1 && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-muted-foreground text-xs">Folder:</span>
                  <select
                    className="h-7 rounded border border-input bg-background px-2 text-xs"
                    value={fileFolderFilter}
                    onChange={(e) => setFileFolderFilter(e.target.value)}
                  >
                    <option value="all">All Folders</option>
                    {availableFolders.map(folder => (
                      <option key={folder} value={folder}>
                        {formatFolderType(folder)} ({taskFiles.filter(f => (f.folderType || 'main') === folder).length})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Scrollable File List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[55vh]">
            {loadingFiles && (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading task files...</p>
            )}
            {!loadingFiles && taskFiles.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No files uploaded on this task.</p>
            )}
            {!loadingFiles && taskFiles.length > 0 && filteredTaskFiles.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No files match the selected filter.
              </p>
            )}
            {!loadingFiles && filteredTaskFiles.map((file) => (
              <div
                key={file.id}
                className={`flex items-center justify-between gap-3 p-3 border rounded-lg transition-colors ${
                  file.isActive
                    ? 'bg-card hover:bg-muted/40 border-border'
                    : 'bg-muted/20 border-dashed border-muted-foreground/30 hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="mt-0.5 p-2 rounded-md bg-muted shrink-0">
                    {getFileIcon(file.mimeType, file.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate max-w-[320px]" title={file.name}>
                        {file.name}
                      </p>
                      {file.isActive ? (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-600 hover:bg-emerald-600 font-medium">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-400 font-medium">
                          Superseded / Inactive
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground font-normal">
                        v{file.version}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-foreground/80">{formatFolderType(file.folderType)}</span>
                      {formatFileSize(file.size) && (
                        <>
                          <span>·</span>
                          <span>{formatFileSize(file.size)}</span>
                        </>
                      )}
                      {file.uploader?.name && (
                        <>
                          <span>·</span>
                          <span>by {file.uploader.name}</span>
                        </>
                      )}
                      {file.createdAt && (
                        <>
                          <span>·</span>
                          <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {file.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="Open / Download file"
                      asChild
                    >
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => handleDeleteVideo(file.id, file.name)}
                    disabled={deletingFileId === file.id}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {deletingFileId === file.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setManageVideosTask(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}