'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  HardDrive, CheckCircle, XCircle, Clock, RefreshCw,
  Server, Database, AlertTriangle, Wifi, WifiOff,
  FolderSync, Archive, Shield, Eye, Trash2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

interface SweepFileResult {
  fileId: string;
  s3Key: string;
  taskId: string;
  monthFolder: string;
  sizeBytes: number;
  outcome: 'would_delete' | 'deleted' | 'skipped_not_on_nas' | 'failed';
  reason?: string;
}

interface SweepSummary {
  dryRun: boolean;
  clientId: string | null;
  cutoffMonthFolder: string;
  eligibleCount: number;
  deletedCount: number;
  skippedCount: number;
  failedCount: number;
  bytesFreed: number;
  monthsSwept: string[];
  results: SweepFileResult[];
}

interface ClientOption {
  id: string;
  name: string;
  companyName: string | null;
}

interface SyncLog {
  id: string;
  status: string;
  completedAt: string;
  bucketName: string | null;
  paths: string[];
  filesCount: number | null;
  bytesCount: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface BackupStats {
  totalFiles: number;
  archivedFiles: number;
  pendingFiles: number;
  lastSync: SyncLog | null;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
        <CheckCircle className="h-3.5 w-3.5" /> Success
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
      <XCircle className="h-3.5 w-3.5" /> Failed
    </span>
  );
}

function CoverageBar({ archived, total }: { archived: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((archived / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500 font-medium">Backup coverage</span>
        <span className="text-xs font-bold text-gray-900">{pct}%</span>
      </div>
      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[11px] text-gray-400">{archived.toLocaleString()} backed up</span>
        <span className="text-[11px] text-gray-400">{total.toLocaleString()} total</span>
      </div>
    </div>
  );
}

export function NasBackupAdmin() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [preview, setPreview] = useState<SweepSummary | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sweepClientId, setSweepClientId] = useState<string>('all');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/nas/status', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load backup status');
      const data = await res.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    fetch('/api/clients', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setClients((data.clients || []).map((c: any) => ({ id: c.id, name: c.name, companyName: c.companyName }))))
      .catch(() => {/* dropdown just stays empty — not critical */});
  }, []);

  const runSweep = useCallback(async (dryRun: boolean) => {
    const setBusy = dryRun ? setPreviewing : setSweeping;
    setBusy(true);
    try {
      const clientId = sweepClientId === 'all' ? null : sweepClientId;
      const res = await fetch('/api/cron/s3-to-nas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sweep failed');

      if (dryRun) {
        setPreview(data.summary);
      } else {
        // Keep the result visible (not just the toast) so the skip/failure
        // reason breakdown below is available for real runs too — this is
        // exactly what's needed to diagnose "192 skipped" at a glance.
        setPreview(data.summary);
        await load();
      }
      toast.success(dryRun ? 'Preview ready' : 'Sweep complete', { description: data.message });
    } catch (err: any) {
      toast.error(dryRun ? 'Preview failed' : 'Sweep failed', { description: err.message });
    } finally {
      setBusy(false);
    }
  }, [load, sweepClientId]);

  const handleRunSweep = useCallback(() => {
    const monthLabel = preview?.cutoffMonthFolder ? ` (everything before ${preview.cutoffMonthFolder})` : '';
    const clientLabel = sweepClientId === 'all'
      ? 'ALL clients'
      : clients.find(c => c.id === sweepClientId)?.companyName || clients.find(c => c.id === sweepClientId)?.name || 'this client';
    const confirmed = window.confirm(
      `This permanently deletes output-folder files from Cloudflare R2 for ${clientLabel}${monthLabel} once they're verified present on the NAS. This cannot be undone. Continue?`
    );
    if (confirmed) runSweep(false);
  }, [preview, runSweep, sweepClientId, clients]);

  const lastSync = stats?.lastSync;
  const isHealthy = lastSync?.status === 'success';
  const lastSyncHours = lastSync
    ? (Date.now() - new Date(lastSync.completedAt).getTime()) / (1000 * 60 * 60)
    : null;
  const isStale = lastSyncHours !== null && lastSyncHours > 25; // more than 25h since last sync

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-white" />
            </div>
            NAS Backup
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">UGREEN DXP2800 · Cloudflare R2 → /volume2/Backup</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <RefreshCw className="h-6 w-6 animate-spin mr-3" />
          <span className="text-sm">Loading backup status…</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <p className="text-xs text-red-400 mt-1">Make sure NAS_WEBHOOK_SECRET is set in your .env</p>
        </div>
      ) : (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* NAS Status */}
            <div className={`rounded-xl border p-5 ${isHealthy && !isStale ? 'bg-emerald-50 border-emerald-200' : isStale ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">NAS Status</span>
                {isHealthy && !isStale
                  ? <Wifi className="h-4 w-4 text-emerald-500" />
                  : isStale
                  ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                  : <WifiOff className="h-4 w-4 text-red-500" />
                }
              </div>
              <p className={`text-lg font-bold ${isHealthy && !isStale ? 'text-emerald-700' : isStale ? 'text-amber-700' : 'text-red-700'}`}>
                {!lastSync ? 'No syncs yet' : isStale ? 'Sync overdue' : 'Online'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {lastSync ? `Last sync ${timeAgo(lastSync.completedAt)}` : 'Never synced'}
              </p>
            </div>

            {/* Files backed up */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Files Backed Up</span>
                <Archive className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.archivedFiles.toLocaleString() ?? '—'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {stats ? `${stats.pendingFiles.toLocaleString()} pending` : ''}
              </p>
            </div>

            {/* Last sync time */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Last Sync</span>
                <Clock className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-sm font-bold text-gray-900">
                {lastSync ? formatDate(lastSync.completedAt) : '—'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {lastSync ? `Runs daily at 2:00 AM` : 'Not configured yet'}
              </p>
            </div>
          </div>

          {/* Coverage bar */}
          {stats && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <CoverageBar archived={stats.archivedFiles} total={stats.totalFiles} />
            </div>
          )}

          {/* Setup info */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2 mb-3">
              <Server className="h-4 w-4" />
              Backup Configuration
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              {[
                { label: 'NAS Device',    value: 'UGREEN DXP2800' },
                { label: 'NAS Path',      value: '/volume2/Backup' },
                { label: 'Source',        value: 'Cloudflare R2' },
                { label: 'Schedule',      value: 'Daily at 2:00 AM' },
                { label: 'Raw Footage',   value: '✓ All files' },
                { label: 'Outputs',       value: '✓ Approved only' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between border-b border-zinc-200 pb-2">
                  <span className="text-zinc-500 font-medium">{label}</span>
                  <span className="text-zinc-800 font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly output-folder sweep */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-gray-500" />
                Output Folder Sweep
              </h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Runs automatically on the 1st of every month at 4 AM EST. Deletes output-folder files
              from R2 once older than 2 months — but only after verifying the file is actually present
              on the NAS mount. Raw footage is never touched.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Select value={sweepClientId} onValueChange={setSweepClientId}>
                <SelectTrigger className="w-56 h-8 text-xs">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.companyName || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => runSweep(true)} disabled={previewing || sweeping}>
                <Eye className={`h-3.5 w-3.5 ${previewing ? 'animate-pulse' : ''}`} />
                {previewing ? 'Previewing…' : 'Preview Sweep'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleRunSweep}
                disabled={sweeping || previewing}
              >
                <Trash2 className={`h-3.5 w-3.5 ${sweeping ? 'animate-pulse' : ''}`} />
                {sweeping ? 'Sweeping…' : 'Run Sweep Now'}
              </Button>
            </div>

            {preview && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                <div>
                  <div className="text-zinc-500">Cutoff</div>
                  <div className="font-semibold text-zinc-800">Before {preview.cutoffMonthFolder}</div>
                </div>
                <div>
                  <div className="text-zinc-500">{preview.dryRun ? 'Would delete' : 'Deleted'}</div>
                  <div className="font-semibold text-zinc-800">{preview.deletedCount} file(s)</div>
                </div>
                <div>
                  <div className="text-zinc-500">Not confirmed on NAS</div>
                  <div className="font-semibold text-amber-600">{preview.skippedCount} file(s)</div>
                </div>
                <div>
                  <div className="text-zinc-500">{preview.dryRun ? 'Would free' : 'Freed'}</div>
                  <div className="font-semibold text-zinc-800">{formatBytes(preview.bytesFreed)}</div>
                </div>
              </div>
            )}

            {/* Why files were skipped/failed — grouped, since a systemic issue
                (e.g. NAS mount not present on this server) shows up as the
                exact same reason repeated for every file. */}
            {preview && preview.results.some(r => r.outcome !== 'deleted' && r.outcome !== 'would_delete') && (() => {
              const reasonCounts = new Map<string, number>();
              for (const r of preview.results) {
                if (r.outcome === 'deleted' || r.outcome === 'would_delete') continue;
                const key = r.reason || r.outcome;
                reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1);
              }
              const sorted = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]);
              return (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs">
                  <div className="font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Why files weren't swept
                  </div>
                  <ul className="space-y-1">
                    {sorted.map(([reason, count]) => (
                      <li key={reason} className="text-amber-700">
                        <span className="font-semibold">{count}×</span> {reason}
                      </li>
                    ))}
                  </ul>
                  {sorted.some(([r]) => r.includes('NAS mount not found')) && (
                    <p className="mt-2 text-amber-600">
                      This means the NAS drive isn't mounted on this server's filesystem right now —
                      that's an infrastructure issue (check the mount on the server), not something
                      fixable from this panel.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Sync history */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <FolderSync className="h-4 w-4 text-gray-500" />
                Sync History
              </h3>
              <span className="text-xs text-gray-400">{logs.length} record{logs.length !== 1 ? 's' : ''}</span>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Database className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No sync records yet</p>
                <p className="text-xs mt-1">Records will appear here after the first backup runs</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {logs.map((log, i) => (
                  <div key={log.id} className={`flex items-center gap-4 px-5 py-4 ${i === 0 ? 'bg-gray-50/50' : ''}`}>
                    {/* Status */}
                    <StatusBadge status={log.status} />

                    {/* Date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{formatDate(log.completedAt)}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {log.paths?.length > 0 && (
                          <span className="text-xs text-gray-400">
                            {(log.paths as string[]).join(', ')}
                          </span>
                        )}
                        {log.errorMessage && (
                          <span className="text-xs text-red-500 truncate max-w-[200px]">{log.errorMessage}</span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right flex-shrink-0">
                      {log.filesCount !== null && (
                        <p className="text-xs font-semibold text-gray-700">{log.filesCount.toLocaleString()} files</p>
                      )}
                      {log.bytesCount !== null && (
                        <p className="text-xs text-gray-400">{formatBytes(log.bytesCount)}</p>
                      )}
                      {log.filesCount === null && (
                        <p className="text-xs text-gray-400">{timeAgo(log.completedAt)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warning if stale */}
          {isStale && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Sync overdue</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Last successful backup was {timeAgo(lastSync!.completedAt)}. The daily sync should run at 2:00 AM.
                  Check the Docker container logs on the NAS if this persists.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}