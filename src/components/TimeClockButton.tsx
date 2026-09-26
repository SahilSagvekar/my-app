// FILE: src/components/TimeClockButton.tsx
// The header Start/Stop toggle. Renders nothing for admins.
// All times are Eastern Time (South Carolina / America/New_York).

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Clock, Square, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from './auth/AuthContext';
import { formatEasternTime } from '@/lib/est-date';

type ClockStatus =
  | { state: 'loading' }
  | { state: 'not_started' }
  | { state: 'clocked_in'; clockInAt: string }
  | { state: 'clocked_out'; clockInAt: string; clockOutAt: string; autoClosedOut?: boolean };

export function TimeClockButton() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ClockStatus>({ state: 'loading' });
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/time-clock/status');
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'not_started') {
        setStatus({ state: 'not_started' });
      } else if (data.status === 'clocked_in') {
        setStatus({ state: 'clocked_in', clockInAt: data.clockInAt });
      } else if (data.status === 'clocked_out') {
        setStatus({
          state: 'clocked_out',
          clockInAt: data.clockInAt,
          clockOutAt: data.clockOutAt,
          autoClosedOut: data.autoClosedOut,
        });
      }
    } catch {
      // Silently fail — button just won't render its real state this load.
    }
  }, []);

  useEffect(() => {
    if (!user || isAdmin) return;
    fetchStatus();
  }, [user, isAdmin, fetchStatus]);

  if (!user || isAdmin) return null;

  const handleStart = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/time-clock/start', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatus({ state: 'clocked_in', clockInAt: data.clockInAt });
      } else if (data.clockInAt) {
        // Already started (e.g. race with another tab) — sync to the real state.
        setStatus({ state: 'clocked_in', clockInAt: data.clockInAt });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/time-clock/stop', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatus({
          state: 'clocked_out',
          clockInAt: data.clockInAt,
          clockOutAt: data.clockOutAt,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  if (status.state === 'loading') {
    return (
      <Button variant="outline" size="sm" disabled className="min-w-[92px]">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (status.state === 'not_started') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleStart}
        disabled={busy}
        className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
        <span className="hidden sm:inline">Start</span>
      </Button>
    );
  }

  if (status.state === 'clocked_in') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleStop}
        disabled={busy}
        title={`Started at ${formatEasternTime(status.clockInAt)} (South Carolina)`}
        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5 fill-current" />}
        <span className="hidden sm:inline">
          Stop <span className="opacity-70 font-normal">· since {formatEasternTime(status.clockInAt)}</span>
        </span>
      </Button>
    );
  }

  // clocked_out — done for the day, nothing more to click.
  return (
    <div
      className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium bg-muted text-muted-foreground"
      title={
        status.autoClosedOut
          ? 'Auto-clocked out — you forgot to click Stop'
          : `${formatEasternTime(status.clockInAt)} – ${formatEasternTime(status.clockOutAt)} (South Carolina)`
      }
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">
        {formatEasternTime(status.clockInAt)}–{formatEasternTime(status.clockOutAt)}
        {status.autoClosedOut ? ' (auto)' : ''}
      </span>
    </div>
  );
}
