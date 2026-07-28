'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar } from '../ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Loader2, Upload, Video, Image as ImageIcon, FileText, File,
  ChevronDown, FolderOpen, CheckCircle, XCircle,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';

interface Employee {
  id: number;
  name: string;
  role: string;
}

interface UploadEntry {
  fileId: string;
  fileName: string;
  uploadedAt: string;
  mimeType: string | null;
  size: number;
  folderType: string | null;
  version: number;
  isActive: boolean;
  employeeId: number | null;
  employeeName: string;
  taskId?: string;
  taskTitle?: string;
  taskStatus?: string;
  clientName?: string;
}

interface Props {
  employees: Employee[]; // pass in editors/qc/videographers list you already fetch elsewhere
  currentMonth: string; // e.g. "July-2026", used to load the day-count dots
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getMimeIcon(mimeType: string | null) {
  const m = mimeType || '';
  if (m.startsWith('video/')) return <Video className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  if (m.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
  if (m.includes('pdf')) return <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />;
  return <File className="h-4 w-4 text-gray-400 flex-shrink-0" />;
}

function getMimeDot(mimeType: string | null): string {
  const m = mimeType || '';
  if (m.startsWith('video/')) return 'bg-blue-400';
  if (m.startsWith('image/')) return 'bg-emerald-400';
  if (m.includes('pdf')) return 'bg-red-400';
  return 'bg-gray-300';
}

function folderLabel(folderType: string | null): string {
  const map: Record<string, string> = {
    main: 'Main', thumbnails: 'Thumbnails', tiles: 'Tiles',
    'music-license': 'Music License', covers: 'Covers',
  };
  return map[folderType || ''] || folderType || 'Main';
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  READY_FOR_QC: { label: 'In QC', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  COMPLETED: { label: 'QC Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700 border-red-200' },
  SCHEDULED: { label: 'Scheduled', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  POSTED: { label: 'Posted', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  PENDING: { label: 'Pending', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  CLIENT_REVIEW: { label: 'Client Review', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
};

function TaskStatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status.toUpperCase()] ?? { label: status, cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function FileRow({ file }: { file: UploadEntry }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 rounded-lg transition-colors">
      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${getMimeDot(file.mimeType)}`} />
      {getMimeIcon(file.mimeType)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-800 font-medium truncate max-w-[220px]">{file.fileName}</span>
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
          : <XCircle className="h-3.5 w-3.5 text-amber-400" />}
      </div>
    </div>
  );
}

interface TaskGroup {
  taskId: string;
  taskTitle: string;
  taskStatus?: string;
  clientName?: string;
  employeeName: string;
  files: UploadEntry[];
}

function TaskGroupCard({ group, showEmployee }: { group: TaskGroup; showEmployee: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalSize = group.files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left border-b border-gray-200"
      >
        <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
          <FolderOpen className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{group.taskTitle || 'Untitled task'}</span>
            <TaskStatusBadge status={group.taskStatus} />
            {showEmployee && (
              <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                {group.employeeName}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{group.clientName || 'No client'}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-gray-600">{group.files.length} file{group.files.length !== 1 ? 's' : ''}</p>
            <p className="text-[11px] text-gray-400">{formatBytes(totalSize)}</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </div>
      </button>
      {!collapsed && (
        <div className="px-2 py-2 space-y-0.5">
          {group.files.map((file) => <FileRow key={file.fileId} file={file} />)}
        </div>
      )}
    </div>
  );
}

function buildTaskGroups(entries: UploadEntry[]): TaskGroup[] {
  const byTask = new Map<string, UploadEntry[]>();
  for (const e of entries) {
    const key = e.taskId || e.fileId;
    if (!byTask.has(key)) byTask.set(key, []);
    byTask.get(key)!.push(e);
  }
  const groups: TaskGroup[] = Array.from(byTask.entries()).map(([taskId, files]) => {
    const sorted = [...files].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return {
      taskId,
      taskTitle: sorted[0].taskTitle || 'Untitled task',
      taskStatus: sorted[0].taskStatus,
      clientName: sorted[0].clientName,
      employeeName: sorted[0].employeeName,
      files: sorted,
    };
  });
  groups.sort((a, b) => new Date(b.files[0].uploadedAt).getTime() - new Date(a.files[0].uploadedAt).getTime());
  return groups;
}

export function UploadCalendarTab({ employees, currentMonth }: Props) {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [calendarEmployeeFilter, setCalendarEmployeeFilter] = useState<string>('all');
  const [detailEmployeeFilter, setDetailEmployeeFilter] = useState<string>('all');
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({});
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load per-day counts for the visible month so days with uploads show a dot.
  useEffect(() => {
    setLoadingCounts(true);
    const params = new URLSearchParams({ mode: 'counts', month: currentMonth });
    if (calendarEmployeeFilter !== 'all') params.set('employeeId', calendarEmployeeFilter);
    fetch(`/api/admin/production-tracker/uploads?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setDayCounts(json.counts || {}))
      .finally(() => setLoadingCounts(false));
  }, [currentMonth, calendarEmployeeFilter]);

  // Load the actual list whenever a date/range is picked. Fetch everyone in
  // range, then filter client-side by detailEmployeeFilter — so switching the
  // person filter doesn't need a re-fetch.
  useEffect(() => {
    if (!range?.from) {
      setUploads([]);
      return;
    }
    setLoadingDetail(true);
    const params = new URLSearchParams({
      from: toISODate(range.from),
      to: toISODate(range.to || range.from),
    });
    fetch(`/api/admin/production-tracker/uploads?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setUploads(json.uploads || []))
      .finally(() => setLoadingDetail(false));
  }, [range]);

  const daysWithUploads = Object.entries(dayCounts)
    .filter(([, count]) => count > 0)
    .map(([date]) => new Date(`${date}T00:00:00`));

  const filteredUploads = useMemo(() => {
    if (detailEmployeeFilter === 'all') return uploads;
    return uploads.filter((u) => String(u.employeeId) === detailEmployeeFilter);
  }, [uploads, detailEmployeeFilter]);

  const taskGroups = useMemo(() => buildTaskGroups(filteredUploads), [filteredUploads]);
  const showEmployeeBadge = detailEmployeeFilter === 'all';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Upload calendar</span>
            {loadingCounts && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={calendarEmployeeFilter} onValueChange={setCalendarEmployeeFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            modifiers={{ hasUploads: daysWithUploads }}
            modifiersClassNames={{
              hasUploads: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
            }}
            className="rounded-md border"
          />
          <p className="text-[11px] text-muted-foreground">
            Dots mark days with uploads. Click a day, or drag to select a range.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {range?.from
                ? `Uploads: ${toISODate(range.from)}${
                    range.to && toISODate(range.to) !== toISODate(range.from)
                      ? ` → ${toISODate(range.to)}`
                      : ''
                  }`
                : 'Pick a date to see uploads'}
              {loadingDetail && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </CardTitle>
            {range?.from && (
              <Select value={detailEmployeeFilter} onValueChange={setDetailEmployeeFilter}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {range?.from && !loadingDetail && filteredUploads.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No uploads in this range.
            </p>
          )}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {taskGroups.map((group) => (
              <TaskGroupCard key={group.taskId} group={group} showEmployee={showEmployeeBadge} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}