'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Video, Image as ImageIcon, FileText, File,
  ChevronDown, RefreshCw, Upload,
  HardDrive, CheckCircle, XCircle, Search, X,
  FolderOpen, Clock,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface UploadEntry {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  folderType: string;
  version: number;
  isActive: boolean;
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  clientName: string;
}

interface TaskGroup {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  clientName: string;
  files: UploadEntry[];
  latestUpload: string;
}

interface DateGroup {
  label: string;
  date: string;
  taskGroups: TaskGroup[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function getDateLabel(dateKey: string): string {
  const now = new Date();
  const nowKey = now.toISOString().slice(0, 10);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yesterdayKey = yest.toISOString().slice(0, 10);
  if (dateKey === nowKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith('video/')) return <Video className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
  if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />;
  return <File className="h-4 w-4 text-gray-400 flex-shrink-0" />;
}

function getMimeDot(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'bg-blue-400';
  if (mimeType.startsWith('image/')) return 'bg-emerald-400';
  if (mimeType.includes('pdf')) return 'bg-red-400';
  return 'bg-gray-300';
}

function folderLabel(folderType: string): string {
  const map: Record<string, string> = {
    main: 'Main', thumbnails: 'Thumbnails', tiles: 'Tiles',
    'music-license': 'Music License', covers: 'Covers',
  };
  return map[folderType] || folderType;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  READY_FOR_QC: { label: 'In QC',       cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  COMPLETED:    { label: 'QC Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
  REJECTED:     { label: 'Rejected',    cls: 'bg-red-100 text-red-700 border-red-200' },
  SCHEDULED:    { label: 'Scheduled',   cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  POSTED:       { label: 'Posted',      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  IN_PROGRESS:  { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  PENDING:      { label: 'Pending',     cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
};

function TaskStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status.toUpperCase()] ?? { label: status, cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function buildGroups(entries: UploadEntry[]): DateGroup[] {
  const byDate = new Map<string, UploadEntry[]>();
  for (const e of entries) {
    const key = getDateKey(e.uploadedAt);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(e);
  }
  const sortedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

  return sortedDates.map(dateKey => {
    const dayEntries = byDate.get(dateKey)!;
    const byTask = new Map<string, UploadEntry[]>();
    for (const e of dayEntries) {
      if (!byTask.has(e.taskId)) byTask.set(e.taskId, []);
      byTask.get(e.taskId)!.push(e);
    }
    const taskGroups: TaskGroup[] = Array.from(byTask.entries()).map(([taskId, files]) => {
      const sorted = [...files].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      return {
        taskId,
        taskTitle: sorted[0].taskTitle,
        taskStatus: sorted[0].taskStatus,
        clientName: sorted[0].clientName,
        files: sorted,
        latestUpload: sorted[0].uploadedAt,
      };
    });
    taskGroups.sort((a, b) => new Date(b.latestUpload).getTime() - new Date(a.latestUpload).getTime());
    return { label: getDateLabel(dateKey), date: dateKey, taskGroups };
  });
}

function FileRow({ file }: { file: UploadEntry }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 rounded-lg transition-colors">
      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${getMimeDot(file.mimeType)}`} />
      {getMimeIcon(file.mimeType)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-800 font-medium truncate max-w-[280px]">{file.name}</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-medium">{folderLabel(file.folderType)}</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-medium">V{file.version}</span>
          {!file.isActive && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Replaced</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
        <span className="hidden sm:block">{formatBytes(file.size)}</span>
        <span>{formatTime(file.uploadedAt)}</span>
        {file.isActive
          ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
          : <XCircle className="h-3.5 w-3.5 text-amber-400" />
        }
      </div>
    </div>
  );
}

function TaskGroupCard({ group }: { group: TaskGroup }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalSize = group.files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Task header — always visible */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left border-b border-gray-200"
      >
        <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
          <FolderOpen className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{group.taskTitle}</span>
            <TaskStatusBadge status={group.taskStatus} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{group.clientName}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-gray-600">{group.files.length} file{group.files.length !== 1 ? 's' : ''}</p>
            <p className="text-[11px] text-gray-400">{formatBytes(totalSize)}</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
        </div>
      </button>

      {/* Files */}
      {!collapsed && (
        <div className="px-2 py-2 space-y-0.5">
          {group.files.map(file => <FileRow key={file.id} file={file} />)}
        </div>
      )}
    </div>
  );
}

export function EditorUploadHistory() {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async (cursor?: string) => {
    try {
      cursor ? setLoadingMore(true) : setLoading(true);
      const res = await fetch(`/api/editor/upload-history${cursor ? `?cursor=${cursor}` : ''}`, {
        credentials: 'include', cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setEntries(prev => cursor ? [...prev, ...data.files] : data.files);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(e =>
      e.taskTitle.toLowerCase().includes(q) ||
      e.clientName.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q)
    );
  }, [entries, search]);

  const groups = useMemo(() => buildGroups(filtered), [filtered]);
  const totalSize = useMemo(() => entries.reduce((acc, e) => acc + e.size, 0), [entries]);
  const uniqueTasks = useMemo(() => new Set(entries.map(e => e.taskId)).size, [entries]);
  const totalMatchFiles = filtered.length;
  const totalMatchTasks = groups.reduce((a, g) => a + g.taskGroups.length, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Clock className="h-4 w-4 text-white" />
          </div>
          Upload History
        </h1>
        <p className="text-sm text-gray-400 mt-1">Every file you've uploaded, grouped by task</p>
      </div>

      {/* Stats bar */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Files', value: String(entries.length), icon: <Upload className="h-3.5 w-3.5" /> },
            { label: 'Tasks',       value: String(uniqueTasks),    icon: <FolderOpen className="h-3.5 w-3.5" /> },
            { label: 'Total Size',  value: formatBytes(totalSize), icon: <HardDrive className="h-3.5 w-3.5" /> },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                {s.icon}
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{s.label}</p>
                <p className="text-base font-bold text-gray-900 leading-tight">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + Refresh */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search task, client, or file name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-9 h-9 text-sm bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="outline" size="sm"
          className="gap-1.5 text-xs h-9 flex-shrink-0"
          onClick={() => { setEntries([]); load(); }}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search result summary */}
      {search && !loading && (
        <p className="text-xs text-gray-400 mb-4 px-0.5">
          {totalMatchFiles === 0
            ? 'No results found'
            : `${totalMatchFiles} file${totalMatchFiles !== 1 ? 's' : ''} across ${totalMatchTasks} task${totalMatchTasks !== 1 ? 's' : ''}`
          }
        </p>
      )}

      {/* States */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <RefreshCw className="h-8 w-8 animate-spin mb-4 opacity-40" />
          <p className="text-sm">Loading your upload history…</p>
        </div>
      ) : error ? (
        <div className="text-center py-24 text-red-400">
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => load()}>Try again</Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-24">
          <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Upload className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">No uploads yet</p>
          <p className="text-sm text-gray-400 mt-1">Files you upload to tasks will appear here</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Search className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No results for "{search}"</p>
          <button onClick={() => setSearch('')} className="text-sm text-blue-500 hover:underline mt-1 block mx-auto">
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(dateGroup => (
            <div key={dateGroup.date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                  {dateGroup.label}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-300 whitespace-nowrap">
                  {dateGroup.taskGroups.reduce((a, t) => a + t.files.length, 0)} files · {dateGroup.taskGroups.length} task{dateGroup.taskGroups.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Task cards */}
              <div className="space-y-3">
                {dateGroup.taskGroups.map(taskGroup => (
                  <TaskGroupCard key={taskGroup.taskId + dateGroup.date} group={taskGroup} />
                ))}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && !search && (
            <div className="text-center pt-2 pb-4">
              <Button variant="outline" size="sm" className="gap-2 text-xs"
                onClick={() => load(nextCursor!)} disabled={loadingMore}>
                {loadingMore ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {loadingMore ? 'Loading…' : 'Load older uploads'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}