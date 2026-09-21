"use client";

// src/components/admin/ManualNasSweepPanel.tsx
// Manual, on-demand version of the weekly NAS backup sweep. Pick a client,
// then send specific files or a whole category (Raw Footage / Outputs /
// Elements) to the NAS right now, instead of waiting for the weekly sweep.
// Each category is tracked and sent independently — see
// /api/admin/nas-sweep/{browse,trigger,status} and nas-backup-records.ts.

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FilterSelect } from '@/components/ui/filter-select';
import { RefreshCw, UploadCloud, CheckCircle2, XCircle, Loader2, Film, FolderOutput, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface ClientOption {
  id: string;
  name: string;
  companyName?: string | null;
}

interface FileRow {
  id: string;
  name: string;
  s3Key: string;
  size: number;
  archivedToNas: boolean;
  nasArchivedAt: string | null;
  nasPath: string | null;
  taskTitle: string | null;
}

type LiveStatus = 'queued' | 'done' | 'failed';
interface StatusEntry {
  fileId: string;
  status: LiveStatus;
  error?: string;
}

type FolderType = 'raw-footage' | 'outputs' | 'elements';

const FOLDER_SECTIONS: { type: FolderType; label: string; icon: typeof Film }[] = [
  { type: 'raw-footage', label: 'Raw Footage', icon: Film },
  { type: 'outputs', label: 'Outputs', icon: FolderOutput },
  { type: 'elements', label: 'Elements', icon: Sparkles },
];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function NasFolderSection({ clientId, folderType, label, icon: Icon }: {
  clientId: string;
  folderType: FolderType;
  label: string;
  icon: typeof Film;
}) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [sending, setSending] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<Map<string, StatusEntry>>(new Map());
  const [pollingFileIds, setPollingFileIds] = useState<string[]>([]);

  const loadFiles = useCallback(() => {
    if (!clientId) return;
    setLoadingFiles(true);
    setSelectedFileIds(new Set());
    fetch(`/api/admin/nas-sweep/browse?clientId=${clientId}&folderType=${folderType}`)
      .then((r) => r.json())
      .then((d) => setFiles(d.files || []))
      .catch(() => toast.error(`Failed to load ${label.toLowerCase()} files`))
      .finally(() => setLoadingFiles(false));
  }, [clientId, folderType, label]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Poll status for the active batch every 3s until every file is settled.
  useEffect(() => {
    if (pollingFileIds.length === 0) return;

    const poll = async () => {
      const res = await fetch(`/api/admin/nas-sweep/status?fileIds=${pollingFileIds.join(',')}`);
      const data = await res.json();
      const next = new Map<string, StatusEntry>();
      for (const s of data.statuses || []) next.set(s.fileId, s);
      setLiveStatuses(next);

      const stillGoing = (data.statuses || []).some((s: StatusEntry) => s.status === 'queued');
      if (!stillGoing) {
        setPollingFileIds([]);
        loadFiles(); // refresh so archivedToNas badges update
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [pollingFileIds, loadFiles]);

  const toggleFile = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendFiles = async (fileIds?: string[]) => {
    const idsToSend = fileIds || Array.from(selectedFileIds);
    if (idsToSend.length === 0) {
      toast.error('Select at least one file');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/admin/nas-sweep/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: idsToSend, folderType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Trigger failed');
      toast.success(data.message);
      setPollingFileIds(data.fileIds || []);
      setLiveStatuses(new Map());
    } catch (err: any) {
      toast.error(err.message || 'Failed to send to NAS');
    } finally {
      setSending(false);
    }
  };

  const sendWhole = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/admin/nas-sweep/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, folderType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Trigger failed');
      toast.success(data.message);
      setPollingFileIds(data.fileIds || []);
      setLiveStatuses(new Map());
    } catch (err: any) {
      toast.error(err.message || 'Failed to send to NAS');
    } finally {
      setSending(false);
    }
  };

  const statusBadge = (fileId: string, alreadyArchived: boolean) => {
    const live = liveStatuses.get(fileId);
    if (live?.status === 'done' || (!live && alreadyArchived && pollingFileIds.length === 0)) {
      return <Badge variant="outline" className="gap-1 text-green-600 border-green-600"><CheckCircle2 className="h-3 w-3" /> Backed up</Badge>;
    }
    if (live?.status === 'failed') {
      return <Badge variant="outline" className="gap-1 text-red-600 border-red-600" title={live.error}><XCircle className="h-3 w-3" /> Failed</Badge>;
    }
    if (live?.status === 'queued') {
      return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Copying…</Badge>;
    }
    return <Badge variant="secondary">Not backed up</Badge>;
  };

  const notBackedUpCount = files.filter((f) => !f.archivedToNas).length;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <h4 className="font-medium whitespace-nowrap">{label}</h4>
          {files.length > 0 && (
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {files.length} file{files.length === 1 ? '' : 's'}
              {notBackedUpCount > 0 && ` · ${notBackedUpCount} not backed up`}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadFiles} disabled={loadingFiles}>
            <RefreshCw className={`h-4 w-4 ${loadingFiles ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={sendWhole} disabled={sending || loadingFiles || notBackedUpCount === 0} className="gap-1">
            <UploadCloud className="h-4 w-4" /> Send all
          </Button>
        </div>
      </div>

      {selectedFileIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-sm">{selectedFileIds.size} file(s) selected</span>
          <Button size="sm" onClick={() => sendFiles()} disabled={sending} className="gap-1">
            <UploadCloud className="h-4 w-4" /> Send selected
          </Button>
        </div>
      )}

      {loadingFiles ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : files.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">No {label.toLowerCase()} files for this client.</div>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-md border p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <Checkbox
                checked={selectedFileIds.has(f.id)}
                onCheckedChange={() => toggleFile(f.id)}
              />
              <div className="min-w-0 flex-1" title={f.name}>
                <div className="truncate text-sm font-medium">{f.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {f.taskTitle || formatSize(f.size)}{f.taskTitle ? ` · ${formatSize(f.size)}` : ''}
                </div>
              </div>
              {statusBadge(f.id, f.archivedToNas)}
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManualNasSweepPanel() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  useEffect(() => {
    fetch('/api/admin/nas-sweep/browse')
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .catch(() => toast.error('Failed to load clients'));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Manual NAS Backup</h3>
        <p className="text-sm text-muted-foreground">
          Send raw footage, outputs, or elements to the NAS right now, instead of waiting for the weekly sweep. Nothing is ever deleted from R2 by this — copy only.
        </p>
      </div>

      <FilterSelect
        value={selectedClientId}
        onValueChange={setSelectedClientId}
        placeholder="Select a client"
        className="w-72"
        options={clients.map((c) => ({ value: c.id, label: c.companyName || c.name }))}
      />

      {selectedClientId && (
        <div className="space-y-4">
          {FOLDER_SECTIONS.map((section) => (
            <NasFolderSection
              key={section.type}
              clientId={selectedClientId}
              folderType={section.type}
              label={section.label}
              icon={section.icon}
            />
          ))}
        </div>
      )}
    </div>
  );
}