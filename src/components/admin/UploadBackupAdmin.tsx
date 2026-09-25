'use client';

// src/components/admin/UploadBackupAdmin.tsx
//
// Backup upload system admin panel — sibling to NasBackupAdmin.tsx. Scope:
// raw footage and editor output uploads only (not Files & Drive browser
// uploads, not QC/client streaming, not thumbnails/HLS — those keep
// depending on the primary R2 bucket no matter what this switch says). See
// /areas/cloudflare-migration.md for the full design.

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, ShieldCheck, RefreshCw, ArrowLeftRight,
  Clock, AlertTriangle, CheckCircle2, XCircle, PackageCheck,
} from 'lucide-react';
import { Button } from '../ui/button';
import { PageHeader } from '../ui/page-header';

interface UploadBackendStatus {
  activeBackend: 'r2' | 'backup';
  switchedAt: string | null;
  switchedBy: number | null;
  migrationInProgress: boolean;
  lastCanaryAt: string | null;
  lastCanaryOk: boolean | null;
  lastCanaryError: string | null;
  pendingMigration: number;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

export function UploadBackupAdmin() {
  const [status, setStatus] = useState<UploadBackendStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState<'r2' | 'backup' | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/upload-backend');
      if (!res.ok) throw new Error(`Failed to load status (${res.status})`);
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load upload backend status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll — the switch, canary result, and pending-migration count can all
    // change from a cron job or another admin, not just this browser tab.
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleSwitch = async (backend: 'r2' | 'backup') => {
    setSwitching(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/upload-backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backend }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to switch (${res.status})`);
      }
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to switch upload backend');
    } finally {
      setSwitching(false);
      setConfirmSwitch(null);
    }
  };

  const handleMigrateNow = async () => {
    setMigrating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/upload-backend/migrate-now', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Migration failed (${res.status})`);
      }
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to run migration sweep');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading upload backend status...
      </div>
    );
  }

  const isBackupActive = status?.activeBackend === 'backup';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Backup System"
        description="Failover switch for raw footage and editor output uploads only — Files & Drive, QC/client streaming and thumbnails always use the primary bucket."
      />

      {/* Persistent banner while backup is active — hard to miss on purpose */}
      {isBackupActive && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Backup bucket is ACTIVE</p>
            <p className="text-sm">
              New raw footage and editor uploads are going to the backup R2 bucket
              {status?.switchedAt ? ` since ${timeAgo(status.switchedAt)}` : ''}. Switch back to
              Primary as soon as the main system is confirmed working again.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Primary/Backup switch */}
      <div className="rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              {isBackupActive ? (
                <ShieldAlert className="w-5 h-5 text-red-600" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-green-600" />
              )}
              <span className="font-medium text-gray-900">
                Currently active: {isBackupActive ? 'Backup bucket' : 'Primary bucket (r2)'}
              </span>
            </div>
            {status?.switchedAt && (
              <p className="text-sm text-gray-500 mt-1">
                Since {new Date(status.switchedAt).toLocaleString()} ({timeAgo(status.switchedAt)})
              </p>
            )}
          </div>

          {confirmSwitch ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">
                Switch to {confirmSwitch === 'backup' ? 'the backup bucket' : 'the primary bucket'}?
              </span>
              <Button
                size="sm"
                variant="destructive"
                disabled={switching}
                onClick={() => handleSwitch(confirmSwitch)}
              >
                Confirm
              </Button>
              <Button size="sm" variant="outline" disabled={switching} onClick={() => setConfirmSwitch(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant={isBackupActive ? 'default' : 'destructive'}
              onClick={() => setConfirmSwitch(isBackupActive ? 'r2' : 'backup')}
              disabled={switching}
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Switch to {isBackupActive ? 'Primary' : 'Backup'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending migration */}
        <div className="rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-gray-900 font-medium mb-2">
            <PackageCheck className="w-4 h-4" /> Pending migration
          </div>
          <p className="text-2xl font-semibold text-gray-900">{status?.pendingMigration ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">
            File(s) currently in the backup bucket, awaiting copy back to primary.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={handleMigrateNow}
            disabled={migrating || status?.migrationInProgress || (status?.pendingMigration ?? 0) === 0}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${migrating || status?.migrationInProgress ? 'animate-spin' : ''}`} />
            {status?.migrationInProgress ? 'Migration running...' : 'Migrate now'}
          </Button>
        </div>

        {/* Canary status */}
        <div className="rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-gray-900 font-medium mb-2">
            <Clock className="w-4 h-4" /> Backup bucket canary
          </div>
          {status?.lastCanaryAt ? (
            <div className="flex items-center gap-2">
              {status.lastCanaryOk ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className="text-gray-900">
                {status.lastCanaryOk ? 'Passing' : 'Failing'} — last run {timeAgo(status.lastCanaryAt)}
              </span>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No canary run recorded yet — runs every 15 minutes.</p>
          )}
          {status?.lastCanaryError && (
            <p className="text-sm text-red-600 mt-2">{status.lastCanaryError}</p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            Writes, verifies and deletes a tiny test object in the backup bucket on a schedule, so a
            broken backup bucket is caught before it's ever needed.
          </p>
        </div>
      </div>
    </div>
  );
}

export default UploadBackupAdmin;