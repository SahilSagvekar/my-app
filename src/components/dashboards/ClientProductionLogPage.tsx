'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader, ListChecks, X, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { useEffectiveClientId } from '@/lib/hooks/useEffectiveClientId';
import { PageHeader } from '../ui/page-header';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

type EntryType = 'shoot' | 'call' | 'meeting' | 'analytics';
type Filter = 'all' | EntryType;

interface LogEntry {
  id: string;
  taskId?: string;
  type: EntryType;
  date: string | null;
  title: string | null;
  location: string | null;
  attendees: string[];
  plannedMinutes: number | null;
  actualMinutes: number | null;
  status: 'Planned' | 'Completed' | 'Cancelled';
  note: { label: string; body: string } | null;
  reportFile?: { url: string; name: string | null } | null;
}

const TYPE_LABEL: Record<EntryType, string> = {
  shoot: 'Shoot Day',
  call: 'Call',
  meeting: 'Meeting',
  analytics: 'Analytics Review',
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'shoot', label: 'Shoot Days' },
  { id: 'call', label: 'Calls' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'analytics', label: 'Analytics Reviews' },
];

const formatDate = (value: string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';

const formatDuration = (planned: number | null, actual: number | null) => {
  const fmt = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;
  if (planned === null && actual === null) return '—';
  if (planned !== null && actual !== null) return `${fmt(planned)} planned · ${fmt(actual)} actual`;
  if (planned !== null) return `${fmt(planned)} planned`;
  return `${fmt(actual as number)} actual`;
};

export function ClientProductionLogPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [unavailableTypes, setUnavailableTypes] = useState<EntryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [activeNote, setActiveNote] = useState<LogEntry | null>(null);
  const [cancelDialogEntry, setCancelDialogEntry] = useState<LogEntry | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const clientIdOverride = useEffectiveClientId();

  const fetchLog = useCallback(async () => {
    try {
      setLoading(true);
      const url = clientIdOverride ? `/api/client/production-log?clientId=${clientIdOverride}` : '/api/client/production-log';
      const res = await fetch(url, { headers: clientIdOverride ? { 'x-viewing-as': 'client' } : undefined });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setUnavailableTypes(data.unavailableTypes || []);
      }
    } catch (err) {
      console.error('Failed to load production log:', err);
    } finally {
      setLoading(false);
    }
  }, [clientIdOverride]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const submitCancelShoot = async () => {
    if (!cancelDialogEntry?.taskId) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/shoots/${cancelDialogEntry.taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', cancellationReason: cancelReason.trim() || undefined }),
      });
      if (res.ok) {
        toast.success('Shoot cancelled');
        setCancelDialogEntry(null);
        setCancelReason('');
        fetchLog();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to cancel shoot');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setCancelling(false);
    }
  };

  const visible = useMemo(
    () => entries.filter((e) => filter === 'all' || e.type === filter),
    [entries, filter],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading production log...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Log"
        description="Every shoot day, meeting, call, and analytics review — logged in one place"
        actions={
        <div className="flex items-center gap-1 flex-wrap bg-zinc-100 rounded-xl p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`h-9 px-3.5 rounded-lg text-[13px] font-bold transition-colors ${
                filter === f.id ? 'bg-white shadow-sm text-zinc-950' : 'bg-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        }
      />

      {filter !== 'all' && filter !== 'shoot' && unavailableTypes.includes(filter) ? (
        <div className="text-center py-16 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
          <ListChecks className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium">No {TYPE_LABEL[filter].toLowerCase()} entries yet</p>
          <p className="text-sm text-zinc-400 mt-1">This log type isn't wired up yet — check back soon</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
          <ListChecks className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium">Nothing logged yet</p>
        </div>
      ) : (
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.4fr_0.9fr_1fr_1fr_1fr_0.9fr] gap-4 px-5 py-3 bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 tracking-wide uppercase">
            <div>Date</div><div>Type</div><div>Location</div><div>Attendees</div><div>Planned vs. Actual</div><div>Status</div>
          </div>
          {visible.map((entry, idx) => (
            <div key={entry.id} className={idx < visible.length - 1 ? 'border-b border-zinc-200' : ''}>
              <div className="grid grid-cols-[1.4fr_0.9fr_1fr_1fr_1fr_0.9fr] gap-4 px-5 py-4 items-center">
                <div>
                  <div className="text-sm font-bold text-zinc-950">{formatDate(entry.date)}</div>
                  {entry.title && <div className="text-xs text-zinc-400 mt-0.5">{entry.title}</div>}
                </div>
                <div className="text-[13px] text-zinc-600">{TYPE_LABEL[entry.type]}</div>
                <div className="text-[13px] text-zinc-600">{entry.location || '—'}</div>
                <div className="text-[13px] text-zinc-600">{entry.attendees.length ? entry.attendees.join(', ') : '—'}</div>
                <div className="text-[13px] text-zinc-600">{formatDuration(entry.plannedMinutes, entry.actualMinutes)}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-extrabold tracking-wide uppercase w-fit ${
                    entry.status === 'Completed' ? 'bg-green-100 text-green-800'
                      : entry.status === 'Cancelled' ? 'bg-rose-100 text-rose-800'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {entry.status}
                  </span>
                  {entry.type === 'shoot' && entry.status === 'Planned' && entry.taskId && (
                    <button
                      onClick={() => { setCancelDialogEntry(entry); setCancelReason(''); }}
                      title="Cancel shoot"
                      className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {(entry.note || entry.reportFile) && (
                <div className="w-[calc(100%-40px)] mx-5 mb-4 -mt-1 flex items-stretch gap-2">
                  {entry.note && (
                    <button
                      onClick={() => setActiveNote(entry)}
                      className="flex-1 min-w-0 flex items-start gap-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 px-3.5 py-2.5 text-left text-[13px] text-zinc-600"
                    >
                      <span className="flex-1 min-w-0"><strong className="text-zinc-950">{entry.note.label}:</strong> {entry.note.body}</span>
                      <span className="flex-shrink-0 text-xs font-bold text-zinc-400">View →</span>
                    </button>
                  )}
                  {entry.reportFile && (
                    <a
                      href={entry.reportFile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 px-3.5 py-2.5 text-[13px] font-bold text-zinc-600"
                    >
                      {entry.reportFile.name || 'Report'} ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeNote?.note && (
        <div onClick={() => setActiveNote(null)} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-[520px] max-w-[92vw] bg-white rounded-2xl p-7 shadow-xl flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-zinc-400 tracking-wide uppercase">
                  {formatDate(activeNote.date)} — {TYPE_LABEL[activeNote.type]}
                </div>
                <div className="text-lg font-black tracking-tight mt-1">{activeNote.title || TYPE_LABEL[activeNote.type]}</div>
              </div>
              <button onClick={() => setActiveNote(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-50 flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-px bg-zinc-200" />
            <div className="text-sm text-zinc-950 leading-relaxed">{activeNote.note.body}</div>
          </div>
        </div>
      )}

      <Dialog open={!!cancelDialogEntry} onOpenChange={(open) => { if (!open) { setCancelDialogEntry(null); setCancelReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Cancel this shoot?</DialogTitle>
            <DialogDescription>
              {cancelDialogEntry?.title || 'This shoot'} will be marked cancelled, and our team will follow up to help reschedule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Let us know why (optional)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-10 px-5" onClick={() => { setCancelDialogEntry(null); setCancelReason(''); }}>
              Never mind
            </Button>
            <Button variant="destructive" className="h-10 px-5" onClick={submitCancelShoot} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Cancel Shoot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}