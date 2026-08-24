"use client";

// src/components/admin/ManualNasSweepPanel.tsx
// Manual, on-demand version of the weekly NAS backup sweep. Pick a client
// and either send everything eligible or select individual files, then
// watch live per-file status until each one finishes or fails.
//
// Talks to /api/admin/nas-sweep/{browse,trigger,status} — the current,
// live NAS backup system (nas-sweep-queue.ts + nas-upload-server over the
// Cloudflare Tunnel). NOT related to the older RawFootageMirrorPanel /
// NasBackupAdmin components, which target the now-decommissioned
// Tailscale+MinIO setup.

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, UploadCloud, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function ManualNasSweepPanel() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [files, setFiles] = useState<FileRow[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [sending, setSending] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<Map<string, StatusEntry>>(new Map());
  const [pollingFileIds, setPollingFileIds] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/admin/nas-sweep/browse')
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .catch(() => toast.error('Failed to load clients'));
  }, []);

  const loadFiles = useCallback((clientId: string) => {
    if (!clientId) return;
    setLoadingFiles(true);
    setSelectedFileIds(new Set());
    fetch(`/api/admin/nas-sweep/browse?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => setFiles(d.files || []))
      .catch(() => toast.error('Failed to load files'))
      .finally(() => setLoadingFiles(false));
  }, []);

  useEffect(() => {
    if (selectedClientId) loadFiles(selectedClientId);
    else setFiles([]);
  }, [selectedClientId, loadFiles]);

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
        // Refresh the file list so archivedToNas badges update.
        if (selectedClientId) loadFiles(selectedClientId);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [pollingFileIds, selectedClientId, loadFiles]);

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
        body: JSON.stringify({ fileIds: idsToSend }),
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

  const sendWholeClient = async () => {
    if (!selectedClientId) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/nas-sweep/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Manual NAS Backup</h3>
        <p className="text-sm text-muted-foreground">
          Send specific files or a whole client's outputs to the NAS right now, instead of waiting for the weekly sweep.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.companyName || c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedClientId && (
          <Button variant="outline" size="sm" onClick={() => loadFiles(selectedClientId)} disabled={loadingFiles}>
            <RefreshCw className={`h-4 w-4 ${loadingFiles ? 'animate-spin' : ''}`} />
          </Button>
        )}

        {selectedClientId && (
          <Button onClick={sendWholeClient} disabled={sending || loadingFiles} className="ml-auto gap-1">
            <UploadCloud className="h-4 w-4" /> Send all for this client
          </Button>
        )}
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
        <div className="py-8 text-center text-sm text-muted-foreground">Loading files…</div>
      ) : files.length === 0 && selectedClientId ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No eligible files for this client.</div>
      ) : (
        <div className="divide-y rounded-md border">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-3 py-2">
              <Checkbox
                checked={selectedFileIds.has(f.id)}
                onCheckedChange={() => toggleFile(f.id)}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{f.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {f.taskTitle || 'Untitled task'} · {formatSize(f.size)}
                </div>
              </div>
              {statusBadge(f.id, f.archivedToNas)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
