'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { FolderSearch, Folder, Loader2, X, ExternalLink, ChevronRight, Home, Plus, FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RawFootageFolder {
  name: string;
  path: string; // relative to the raw-footage root — this is what gets saved
}
interface RawFootageFile {
  name: string;
  size: number;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LinkRawFootageButton({
  taskId,
  linkedPaths,
  onLinked,
  compact = false,
}: {
  taskId: string;
  linkedPaths: string[] | null | undefined;
  onLinked?: (paths: string[]) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [subpath, setSubpath] = useState<string[]>([]);
  const [folders, setFolders] = useState<RawFootageFolder[]>([]);
  const [files, setFiles] = useState<RawFootageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const linked = linkedPaths || [];

  const loadLevel = async (segments: string[]) => {
    setLoading(true);
    try {
      const subpathParam = segments.join('/');
      const url = subpathParam
        ? `/api/tasks/${taskId}/raw-footage-folders?subpath=${encodeURIComponent(subpathParam)}`
        : `/api/tasks/${taskId}/raw-footage-folders`;
      const res = await fetch(url);
      const data = await res.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch {
      toast.error('Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (segments: string[]) => {
    setSubpath(segments);
    loadLevel(segments);
  };

  const openPicker = (o: boolean) => {
    setOpen(o);
    if (o) navigateTo([]);
  };

  const toggleLink = async (path: string, action: 'add' | 'remove') => {
    setPendingPath(path);
    try {
      const res = await fetch(`/api/tasks/${taskId}/link-raw-footage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update link');
      toast.success(action === 'add' ? 'Folder linked' : 'Link removed');
      onLinked?.(data.task?.linkedRawFootagePaths || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update link');
    } finally {
      setPendingPath(null);
    }
  };

  const driveUrlFor = (path: string) =>
    `/dashboard?page=drive&drivePath=${encodeURIComponent(`raw-footage/${path}`)}`;

  const trigger = compact ? (
    <button
      type="button"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] h-4 px-1.5 rounded border transition-colors",
        linked.length > 0
          ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          : "border-dashed border-blue-300 text-blue-500 hover:bg-blue-50"
      )}
    >
      <FolderSearch className="h-2.5 w-2.5" />
      {linked.length > 0 ? `Raw Footage (${linked.length})` : 'Link Raw Footage'}
    </button>
  ) : (
    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={(e) => e.stopPropagation()}>
      <FolderSearch className="h-3 w-3" />
      {linked.length > 0 ? `Raw Footage (${linked.length} linked)` : 'Link Raw Footage'}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={openPicker}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        {linked.length > 0 && (
          <div className="border-b p-2 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground px-1">Linked folders</p>
            {linked.map((path) => (
              <div key={path} className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted text-sm">
                <Folder className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="flex-1 truncate" title={path}>{path}</span>
                <a href={driveUrlFor(path)} target="_blank" rel="noopener noreferrer" title="Open in Files & Drive">
                  <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </a>
                <button
                  type="button"
                  disabled={pendingPath === path}
                  onClick={() => toggleLink(path, 'remove')}
                  title="Remove link"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="p-2">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 flex-wrap px-1 pb-1.5 text-xs text-muted-foreground">
            <button type="button" onClick={() => navigateTo([])} className="flex items-center gap-1 hover:text-foreground">
              <Home className="h-3 w-3" /> Raw Footage
            </button>
            {subpath.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button
                  type="button"
                  onClick={() => navigateTo(subpath.slice(0, i + 1))}
                  className={i === subpath.length - 1 ? "text-foreground font-medium" : "hover:text-foreground"}
                >
                  {seg}
                </button>
              </span>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-4 text-center">Empty folder.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {folders.map((f) => {
                const isLinked = linked.includes(f.path);
                return (
                  <div key={f.path} className="flex items-center gap-1 rounded hover:bg-muted">
                    <button
                      type="button"
                      onClick={() => navigateTo([...subpath, f.name])}
                      className="flex-1 flex items-center gap-2 text-left text-sm px-2 py-1.5 min-w-0"
                    >
                      <Folder className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </button>
                    <button
                      type="button"
                      disabled={pendingPath === f.path}
                      onClick={() => toggleLink(f.path, isLinked ? 'remove' : 'add')}
                      title={isLinked ? 'Remove this link' : 'Link this folder'}
                      className={cn(
                        "shrink-0 h-6 w-6 mr-1 rounded flex items-center justify-center",
                        isLinked ? "text-emerald-500 hover:bg-red-50 hover:text-red-500" : "text-muted-foreground hover:bg-blue-50 hover:text-blue-600"
                      )}
                    >
                      {pendingPath === f.path ? <Loader2 className="h-3 w-3 animate-spin" /> : isLinked ? '✓' : <Plus className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
              {files.map((f) => (
                <div key={f.name} className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground/70">
                  <FileIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  {f.size > 0 && <span className="shrink-0">{formatBytes(f.size)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}