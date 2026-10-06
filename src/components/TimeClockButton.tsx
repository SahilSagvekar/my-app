// FILE: src/components/TimeClockButton.tsx
// The header Start/Stop toggle. Renders nothing for admins (except the owner account).
// All times are Eastern Time (South Carolina / America/New_York).

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { Clock, Square, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from './auth/AuthContext';
import { formatEasternTime } from '@/lib/est-date';
import { usesTimeClock } from '@/lib/time-clock-access';

type ClockStatus =
  | { state: 'loading' }
  | { state: 'not_started' }
  | { state: 'clocked_in'; clockInAt: string }
  | { state: 'clocked_out'; clockInAt: string; clockOutAt: string; autoClosedOut?: boolean };

export function TimeClockButton() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ClockStatus>({ state: 'loading' });
  const [busy, setBusy] = useState(false);

  // Start-of-day report dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientId, setClientId] = useState('');
  const [report, setReport] = useState('');

  const isAdmin = !!user && !usesTimeClock(user);

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

  // Clicking Start opens the start-of-day report dialog; the actual clock-in
  // happens on Send.
  const openStartDialog = async () => {
    setDialogOpen(true);
    setClientsLoading(true);
    try {
      const res = await fetch('/api/time-clock/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch {
      // Dropdown stays empty; the user sees "No clients available".
    } finally {
      setClientsLoading(false);
    }
  };

  const handleStart = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/time-clock/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, report }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ state: 'clocked_in', clockInAt: data.clockInAt });
        setDialogOpen(false);
        setReport('');
        setClientId('');
        toast.success('Clocked in — report sent');
      } else if (data.clockInAt) {
        // Already started (e.g. race with another tab) — sync to the real state.
        setStatus({ state: 'clocked_in', clockInAt: data.clockInAt });
        setDialogOpen(false);
      } else {
        toast.error(data.error || 'Failed to clock in');
      }
    } catch {
      toast.error('Failed to clock in');
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
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={openStartDialog}
          disabled={busy}
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        >
          <Clock className="h-4 w-4" />
          <span className="hidden sm:inline">Start</span>
        </Button>

        <Dialog open={dialogOpen} onOpenChange={(open) => !busy && setDialogOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start your day</DialogTitle>
              <DialogDescription>
                Write your start-of-day report and pick the client. It will be posted to that
                client&apos;s Slack channel and you&apos;ll be clocked in.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Select value={clientId} onValueChange={setClientId} disabled={clientsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={clientsLoading ? 'Loading clients…' : 'Select client'} />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && !clientsLoading ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No clients available</div>
                  ) : (
                    clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Textarea
                value={report}
                onChange={(e) => setReport(e.target.value)}
                placeholder="What are you working on today?"
                rows={6}
                maxLength={3000}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleStart} disabled={busy || !clientId || !report.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Send &amp; clock in
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
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
