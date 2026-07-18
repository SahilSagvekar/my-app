"use client";

// src/components/admin/RawFootageMirrorPanel.tsx
// Folder-tree browser for selecting raw-footage folders (at any depth) to
// copy, verify, and delete-from-R2 via the NAS mirror job system. Lists
// real folders directly from R2 (not the database) so it always reflects
// what's actually there. Used inside NasBackupAdmin.tsx.

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, Folder, UploadCloud, RefreshCw, Home } from 'lucide-react';
import { toast } from 'sonner';

interface ClientOption {
  id: string;
  name: string;
  companyName?: string | null;
}

interface MirrorJob {
  id: string;
  clientName: string;
  folderType: string;
  monthFolder: string;
  folderPath: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scannedCount: number;
  copiedCount: number;
  verifiedCount: number;
  deletedCount: number;
  failedCount: number;
  currentFile: string | null;
  errorMessage: string | null;
}

export default function RawFootageMirrorPanel({
  clients,
  onJobsStarted,
}: {
  clients: ClientOption[];
  onJobsStarted: () => void;
}) {
  const [clientName, setClientName] = useState('');
  const [currentPath, setCurrentPath] = useState(''); // '' = top level
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // full paths, e.g. "June-2025/SF12"
  const [starting, setStarting] = useState(false);
  const [activeJobs, setActiveJobs] = useState<MirrorJob[]>([]);

  const browse = useCallback((client: string, path: string) => {
    if (!client) return;
    setLoading(true);
    fetch(`/api/nas/browse-folders?clientName=${encodeURIComponent(client)}&folderType=raw-footage&path=${encodeURIComponent(path)}`, {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => setFolders(data.folders || []))
      .catch(() => setFolders([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (clientName) {
      setCurrentPath('');
      setSelected(new Set());
      browse(clientName, '');
    } else {
      setFolders([]);
    }
  }, [clientName, browse]);

  const drillInto = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
    browse(clientName, newPath);
  };

  const goToBreadcrumb = (index: number) => {
    const parts = currentPath.split('/').filter(Boolean);
    const newPath = parts.slice(0, index).join('/');
    setCurrentPath(newPath);
    browse(clientName, newPath);
  };

  const toggleSelected = (folderName: string) => {
    const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(fullPath)) next.delete(fullPath);
      else next.add(fullPath);
      return next;
    });
  };

  const startJobs = () => {
    if (selected.size === 0) return;
    const paths = Array.from(selected);
    const confirmed = window.confirm(
      `This will copy ${paths.length} folder(s) for "${clientName}" to the NAS, verify each file, then permanently delete the verified copies from Cloudflare R2. This is raw footage — the original source material — and this cannot be undone. Continue?`
    );
    if (!confirmed) return;

    setStarting(true);
    Promise.all(
      paths.map(folderPath =>
        fetch('/api/nas/mirror-jobs', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName, folderType: 'raw-footage', folderPath }),
        }).then(res => res.json().then(data => ({ ok: res.ok, data, folderPath })))
      )
    )
      .then(results => {
        const started = results.filter(r => r.ok);
        const failed = results.filter(r => !r.ok);
        setActiveJobs(started.map(r => r.data.job));
        if (started.length) {
          toast.success(`${started.length} mirror job(s) started`, { description: paths.join(', ') });
        }
        if (failed.length) {
          toast.error(`${failed.length} job(s) failed to start`);
        }
        setSelected(new Set());
        onJobsStarted();
      })
      .catch((err: any) => toast.error('Failed to start jobs', { description: err.message }))
      .finally(() => setStarting(false));
  };

  // Poll active jobs
  useEffect(() => {
    const inFlight = activeJobs.filter(j => j.status === 'pending' || j.status === 'running');
    if (inFlight.length === 0) return;
    const interval = setInterval(async () => {
      const updated = await Promise.all(
        activeJobs.map(async j => {
          if (j.status === 'completed' || j.status === 'failed') return j;
          const res = await fetch(`/api/nas/mirror-jobs/${j.id}`, { credentials: 'include', cache: 'no-store' });
          if (!res.ok) return j;
          const data = await res.json();
          return data.job as MirrorJob;
        })
      );
      setActiveJobs(updated);
      const justFinished = updated.filter((j, i) =>
        (j.status === 'completed' || j.status === 'failed') &&
        (activeJobs[i]?.status !== 'completed' && activeJobs[i]?.status !== 'failed')
      );
      if (justFinished.length > 0) onJobsStarted();
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobs, onJobsStarted]);

  const breadcrumbParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-1">
        <UploadCloud className="h-4 w-4 text-gray-500" />
        Copy Raw Footage to NAS
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Browse real folders directly from R2, select any month or specific shoot folder, then copy, verify,
        and delete the verified copies from R2. Raw footage is the original source — double-check your
        selection before confirming.
      </p>

      <div className="flex items-center gap-3 mb-3">
        <Select value={clientName} onValueChange={setClientName}>
          <SelectTrigger className="w-56 h-8 text-xs">
            <SelectValue placeholder="Select client…" />
          </SelectTrigger>
          <SelectContent>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.companyName || c.name}>{c.companyName || c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading && <RefreshCw className="h-3.5 w-3.5 text-gray-400 animate-spin" />}
      </div>

      {clientName && (
        <>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2 flex-wrap">
            <button
              className="flex items-center gap-1 hover:text-gray-800"
              onClick={() => { setCurrentPath(''); browse(clientName, ''); }}
            >
              <Home className="h-3 w-3" /> {clientName}
            </button>
            {breadcrumbParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button className="hover:text-gray-800" onClick={() => goToBreadcrumb(i + 1)}>{part}</button>
              </span>
            ))}
          </div>

          {/* Folder list */}
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 mb-3 max-h-64 overflow-y-auto">
            {folders.length === 0 && !loading && (
              <div className="px-3 py-4 text-xs text-gray-400">No subfolders here.</div>
            )}
            {folders.map(folderName => {
              const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName;
              return (
                <div key={folderName} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                  <Checkbox
                    checked={selected.has(fullPath)}
                    onCheckedChange={() => toggleSelected(folderName)}
                  />
                  <button
                    className="flex items-center gap-1.5 text-xs text-gray-700 flex-1 text-left"
                    onClick={() => drillInto(folderName)}
                  >
                    <Folder className="h-3.5 w-3.5 text-gray-400" />
                    {folderName}
                  </button>
                  <ChevronRight className="h-3 w-3 text-gray-300" />
                </div>
              );
            })}
          </div>

          {/* Selected chips + action button */}
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Array.from(selected).map(p => (
                <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={startJobs}
            disabled={selected.size === 0 || starting}
          >
            <UploadCloud className={`h-3.5 w-3.5 ${starting ? 'animate-pulse' : ''}`} />
            {starting ? 'Starting…' : `Copy, Verify & Delete ${selected.size ? `(${selected.size})` : ''}`}
          </Button>

          {/* Live progress for active jobs */}
          {activeJobs.length > 0 && (
            <div className="mt-4 space-y-2">
              {activeJobs.map(j => (
                <div key={j.id} className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-zinc-800">{j.folderPath}</span>
                    <span className={`inline-flex items-center gap-1.5 font-semibold px-2 py-0.5 rounded-full ${
                      j.status === 'completed' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                      : j.status === 'failed' ? 'text-red-700 bg-red-50 border border-red-200'
                      : 'text-blue-700 bg-blue-50 border border-blue-200'
                    }`}>
                      {(j.status === 'running' || j.status === 'pending') && <RefreshCw className="h-3 w-3 animate-spin" />}
                      {j.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <div><div className="text-zinc-500">Scanned</div><div className="font-semibold">{j.scannedCount}</div></div>
                    <div><div className="text-zinc-500">Copied</div><div className="font-semibold">{j.copiedCount}</div></div>
                    <div><div className="text-zinc-500">Verified</div><div className="font-semibold">{j.verifiedCount}</div></div>
                    <div><div className="text-zinc-500">Deleted</div><div className="font-semibold">{j.deletedCount}</div></div>
                    <div><div className="text-zinc-500">Failed</div><div className="font-semibold text-red-600">{j.failedCount}</div></div>
                  </div>
                  {j.currentFile && j.status === 'running' && (
                    <p className="mt-2 text-zinc-400 truncate">Current: {j.currentFile}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}