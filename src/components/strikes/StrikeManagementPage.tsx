// FILE: src/components/strikes/StrikeManagementPage.tsx
// Strikes page for admins and videographers.
//   - Send a strike to someone you're allowed to strike (videographers: editors
//     only; admins: anyone except clients). The 3rd active strike terminates them.
//   - History: admins see every strike and can revoke; videographers see the
//     strikes they sent.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Search, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { PageHeader } from '../ui/page-header';

type Recipient = {
  id: number;
  name: string | null;
  email: string;
  role: string | null;
  roles: string[];
  activeStrikes: number;
};

type HistoryItem = {
  id: string;
  reason: string;
  createdAt: string;
  sender: { id: number; name: string | null } | null;
  recipient: { id: number; name: string | null };
  revoked: boolean;
  revokedAt: string | null;
  revokedBy: { id: number; name: string | null } | null;
  revokeReason: string | null;
  triggeredTermination: boolean;
};

type Payload = { max: number; canRevoke: boolean; eligible: Recipient[]; history: HistoryItem[] };

function formatDateTime(value: string) {
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const label = (r: Recipient) => r.name || r.email;

export function StrikeManagementPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Send dialog
  const [target, setTarget] = useState<Recipient | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  // Revoke dialog
  const [revokeTarget, setRevokeTarget] = useState<HistoryItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/strikes');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || 'Failed to load strikes');
        return;
      }
      setError(null);
      setData(json);
    } catch {
      setError('Failed to load strikes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data) return [];
    if (!q) return data.eligible;
    return data.eligible.filter(
      (r) => (r.name || '').toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    );
  }, [data, query]);

  const willTerminate = !!data && !!target && target.activeStrikes + 1 >= data.max;

  const handleSend = async () => {
    if (!target) return;
    setSending(true);
    try {
      const res = await fetch('/api/strikes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: target.id, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || 'Failed to send strike');
        return;
      }
      toast.success(
        json.terminated
          ? `${label(target)} reached ${json.max} strikes and was terminated`
          : `Strike sent to ${label(target)} (${json.activeCount}/${json.max})`,
      );
      setTarget(null);
      setReason('');
      await load();
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/strikes/${revokeTarget.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || 'Failed to revoke strike');
        return;
      }
      toast.success(
        json.recipientStillTerminated
          ? 'Strike removed. This account is still terminated — reinstate it in User Management.'
          : 'Strike removed',
      );
      setRevokeTarget(null);
      setRevokeReason('');
      await load();
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Strikes" />
        <p className="text-sm text-red-600">{error || 'Failed to load strikes'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Strikes"
        description={`Send a strike with a reason. ${data.max} active strikes terminate the person's account. They always see their strike count and why.`}
      />

      {/* Send */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Send a strike</h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="pl-9"
            />
          </div>
        </div>

        <div className="divide-y rounded-xl border bg-white">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">No one matches.</p>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{label(r)}</p>
                <p className="truncate text-xs text-slate-500">
                  {r.email}
                  {r.role ? ` · ${r.role}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={
                    r.activeStrikes >= data.max - 1
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : r.activeStrikes > 0
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'text-slate-500'
                  }
                >
                  {r.activeStrikes}/{data.max}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => {
                    setTarget(r);
                    setReason('');
                  }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Send strike
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {data.canRevoke ? 'All strikes' : 'Strikes you sent'}
        </h2>
        <div className="divide-y rounded-xl border bg-white">
          {data.history.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">No strikes yet.</p>
          )}
          {data.history.map((h) => (
            <div key={h.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-slate-900">
                  <span className="font-medium">{h.recipient.name || `User #${h.recipient.id}`}</span>
                  <span className="text-slate-400"> · from </span>
                  <span>{h.sender?.name || 'a team member'}</span>
                  <span className="text-slate-400"> · {formatDateTime(h.createdAt)}</span>
                </p>
                <p
                  className={`mt-1 whitespace-pre-wrap text-sm ${
                    h.revoked ? 'text-slate-400 line-through' : 'text-slate-700'
                  }`}
                >
                  {h.reason}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {h.triggeredTermination && (
                    <Badge className="bg-red-600 text-white hover:bg-red-600">Terminated</Badge>
                  )}
                  {h.revoked && (
                    <span className="text-slate-500">
                      Removed{h.revokedBy?.name ? ` by ${h.revokedBy.name}` : ''}
                      {h.revokeReason ? ` — ${h.revokeReason}` : ''}
                    </span>
                  )}
                </div>
              </div>
              {data.canRevoke && !h.revoked && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-slate-600"
                  onClick={() => {
                    setRevokeTarget(h);
                    setRevokeReason('');
                  }}
                >
                  <Undo2 className="h-4 w-4" />
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Send dialog */}
      <Dialog open={!!target} onOpenChange={(open) => !sending && !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a strike to {target ? label(target) : ''}</DialogTitle>
            <DialogDescription>
              They will see this reason, who sent it, and their strike count, and are notified by
              email and Slack.
            </DialogDescription>
          </DialogHeader>

          {willTerminate && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              This is their strike {data.max} of {data.max}. Sending it will terminate their account
              immediately.
            </div>
          )}

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you sending this strike?"
            rows={5}
            maxLength={1000}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={sending}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || reason.trim().length < 5}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              {willTerminate ? 'Send & terminate' : 'Send strike'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !revoking && !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this strike?</DialogTitle>
            <DialogDescription>
              It stays in {revokeTarget?.recipient.name || 'their'} history, marked as removed, and
              no longer counts toward {data.max}. A terminated account is not reinstated
              automatically.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            placeholder="Reason for revoking (optional)"
            rows={3}
            maxLength={1000}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revoking}>
              Cancel
            </Button>
            <Button onClick={handleRevoke} disabled={revoking}>
              {revoking && <Loader2 className="h-4 w-4 animate-spin" />}
              Revoke strike
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
