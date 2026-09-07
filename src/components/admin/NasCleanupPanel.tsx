"use client";

// src/components/admin/NasCleanupPanel.tsx
// Deletes files from Cloudflare R2 once they're confirmed backed up to NAS.
// This is the ONLY place in the app that enforces "can only delete if
// already backed up to NAS" — the general Drive delete elsewhere does not
// apply this rule. Lives on the NAS Backup admin page, next to the
// send-to-NAS panel above it.

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Trash2, CheckCircle2, Film, FolderOutput, Sparkles } from 'lucide-react';
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

function CleanupFolderSection({ clientId, folderType, label, icon: Icon }: {
  clientId: string;
  folderType: FolderType;
  label: string;
  icon: typeof Film;
}) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadFiles = useCallback(() => {
    if (!clientId) return;
    setLoadingFiles(true);
    setSelectedIds(new Set());
    // Same browse endpoint the send-to-NAS panel uses — it already excludes
    // files with deletedFromCloud=true, so everything returned here is
    // still live in R2. We filter to archivedToNas=true client-side since
    // those are the only ones this panel is allowed to delete.
    fetch(`/api/admin/nas-sweep/browse?clientId=${clientId}&folderType=${folderType}`)
      .then((r) => r.json())
      .then((d) => setFiles((d.files || []).filter((f: FileRow) => f.archivedToNas)))
      .catch(() => toast.error(`Failed to load ${label.toLowerCase()} files`))
      .finally(() => setLoadingFiles(false));
  }, [clientId, folderType, label]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const toggleFile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Select at least one file');
      return;
    }
    if (!window.confirm(
      `Permanently delete ${ids.length} file(s) from Cloudflare? They will remain available from NAS, but slower to fetch.`
    )) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/nas-sweep/delete-archived', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, folderType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      if (data.deletedCount > 0) toast.success(`Deleted ${data.deletedCount} file(s) from Cloudflare`);
      if (data.skipped?.length > 0) toast.error(`${data.skipped.length} file(s) skipped (not backed up yet)`);
      if (data.failed?.length > 0) toast.error(`${data.failed.length} file(s) failed to delete`);

      loadFiles();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <h4 className="font-medium whitespace-nowrap">{label}</h4>
          {files.length > 0 && (
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {files.length} backed-up file{files.length === 1 ? '' : 's'} eligible
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadFiles} disabled={loadingFiles}>
            <RefreshCw className={`h-4 w-4 ${loadingFiles ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-sm">{selectedIds.size} file(s) selected</span>
          <Button size="sm" variant="destructive" onClick={deleteSelected} disabled={deleting} className="gap-1">
            <Trash2 className="h-4 w-4" /> Delete from Cloudflare
          </Button>
        </div>
      )}

      {loadingFiles ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : files.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No backed-up {label.toLowerCase()} files eligible for deletion yet.
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-md border p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Checkbox
                  checked={selectedIds.has(f.id)}
                  onCheckedChange={() => toggleFile(f.id)}
                />
                <div className="min-w-0 flex-1" title={f.name}>
                  <div className="truncate text-sm font-medium">{f.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {f.taskTitle || formatSize(f.size)}{f.taskTitle ? ` · ${formatSize(f.size)}` : ''}
                  </div>
                </div>
                <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                  <CheckCircle2 className="h-3 w-3" /> Backed up
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NasCleanupPanel() {
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
        <h3 className="text-lg font-semibold">Delete Backed-Up Files</h3>
        <p className="text-sm text-muted-foreground">
          Free up Cloudflare storage by deleting files already confirmed backed up to NAS.
          Only files backed up to NAS can be deleted here — everything else is hidden.
          Once deleted, these files are served from NAS if requested again.
        </p>
      </div>

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
        <div className="space-y-4">
          {FOLDER_SECTIONS.map((section) => (
            <CleanupFolderSection
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