'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader, ListChecks, X, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

type EntryType = 'shoot' | 'call' | 'meeting' | 'analytics';
type Filter = 'all' | EntryType;

interface LogEntry {
  id: string;
  type: EntryType;
  clientId: string | null;
  clientName: string | null;
  date: string | null;
  title: string | null;
  location: string | null;
  attendees: string[];
  plannedMinutes: number | null;
  actualMinutes: number | null;
  status: 'Planned' | 'Completed';
  note: { label: string; body: string } | null;
  reportFile?: { url: string; name: string | null } | null;
  editable: boolean;
}

const TYPE_LABEL: Record<EntryType, string> = {
  shoot: 'Shoot Day',
  call: 'Call',
  meeting: 'Meeting',
  analytics: 'Analytics Review',
};

// Maps the UI's short type keys to the DB enum this route/table actually uses.
const TYPE_TO_DB: Record<'call' | 'meeting' | 'analytics', string> = {
  call: 'CALL',
  meeting: 'MEETING',
  analytics: 'ANALYTICS_REVIEW',
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

interface ClientOption { id: string; name: string }

export function VideographerProductionLogPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [activeNote, setActiveNote] = useState<LogEntry | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientId: '',
    type: 'call' as 'call' | 'meeting' | 'analytics',
    title: '',
    date: '',
    location: '',
    attendees: '',
    plannedMinutes: '',
    status: 'PLANNED' as 'PLANNED' | 'COMPLETED',
    noteBody: '',
  });

  const fetchLog = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/production-log');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to load production log:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error('[Production Log] /api/clients failed:', res.status, data);
        toast.error(`Couldn't load clients (${res.status}) — check console for details`);
        return;
      }
      if (!data || !Array.isArray(data.clients)) {
        console.error('[Production Log] /api/clients returned unexpected shape:', data);
        toast.error("Client list came back in an unexpected format — check console");
        return;
      }
      const list = data.clients.map((c: any) => ({ id: c.id, name: c.companyName || c.name }));
      setClients(list);
    } catch (err) {
      console.error('Failed to load clients:', err);
      toast.error('Failed to load clients — check console');
    }
  }, []);

  useEffect(() => { fetchLog(); fetchClients(); }, [fetchLog, fetchClients]);

  const visible = useMemo(
    () => entries.filter((e) => filter === 'all' || e.type === filter),
    [entries, filter],
  );

  const resetForm = () => setForm({
    clientId: '', type: 'call', title: '', date: '', location: '', attendees: '',
    plannedMinutes: '', status: 'PLANNED', noteBody: '',
  });

  const handleCreate = async () => {
    if (!form.clientId || !form.date) {
      toast.error('Client and date are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/production-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          type: TYPE_TO_DB[form.type],
          title: form.title || null,
          date: form.date,
          location: form.location || null,
          attendees: form.attendees ? form.attendees.split(',').map((a) => a.trim()).filter(Boolean) : [],
          plannedMinutes: form.plannedMinutes ? Number(form.plannedMinutes) : null,
          status: form.status,
          noteBody: form.noteBody || null,
        }),
      });
      if (!res.ok) throw new Error('Request failed');
      toast.success('Log entry added');
      setShowAddDialog(false);
      resetForm();
      fetchLog();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add log entry');
    } finally {
      setSaving(false);
    }
  };

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-black tracking-tight text-zinc-950">Production Log</h1>
          <p className="text-zinc-500 text-sm mt-1.5">Every shoot day, meeting, call, and analytics review across all your clients — logged in one place</p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button onClick={() => setShowAddDialog(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add entry
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
          <ListChecks className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium">Nothing logged yet</p>
        </div>
      ) : (
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_1fr_0.9fr] gap-4 px-5 py-3 bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 tracking-wide uppercase">
            <div>Date</div><div>Client</div><div>Type</div><div>Location</div><div>Attendees</div><div>Planned vs. Actual</div><div>Status</div>
          </div>
          {visible.map((entry, idx) => (
            <div key={entry.id} className={idx < visible.length - 1 ? 'border-b border-zinc-200' : ''}>
              <div className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_1fr_0.9fr] gap-4 px-5 py-4 items-center">
                <div>
                  <div className="text-sm font-bold text-zinc-950">{formatDate(entry.date)}</div>
                  {entry.title && <div className="text-xs text-zinc-400 mt-0.5">{entry.title}</div>}
                </div>
                <div className="text-[13px] text-zinc-600">{entry.clientName || '—'}</div>
                <div className="text-[13px] text-zinc-600">{TYPE_LABEL[entry.type]}</div>
                <div className="text-[13px] text-zinc-600">{entry.location || '—'}</div>
                <div className="text-[13px] text-zinc-600">{entry.attendees.length ? entry.attendees.join(', ') : '—'}</div>
                <div className="text-[13px] text-zinc-600">{formatDuration(entry.plannedMinutes, entry.actualMinutes)}</div>
                <span className={`inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-extrabold tracking-wide uppercase w-fit ${
                  entry.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-700'
                }`}>
                  {entry.status}
                </span>
              </div>
              {entry.note && (
                <button
                  onClick={() => setActiveNote(entry)}
                  className="w-[calc(100%-40px)] mx-5 mb-4 -mt-1 flex items-start gap-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 px-3.5 py-2.5 text-left text-[13px] text-zinc-600"
                >
                  <span className="flex-1 min-w-0"><strong className="text-zinc-950">{entry.note.label}:</strong> {entry.note.body}</span>
                  <span className="flex-shrink-0 text-xs font-bold text-zinc-400">View →</span>
                </button>
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
                  {formatDate(activeNote.date)} — {TYPE_LABEL[activeNote.type]}{activeNote.clientName ? ` · ${activeNote.clientName}` : ''}
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

      {showAddDialog && (
        <div onClick={() => setShowAddDialog(false)} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-3xl lg:max-w-4xl bg-white rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-black tracking-tight text-zinc-950">Add log entry</div>
                <p className="text-xs text-zinc-500 mt-0.5">Log a call, meeting, or analytics review for production tracking.</p>
              </div>
              <button onClick={() => setShowAddDialog(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-px bg-zinc-200" />

            {/* Row 1: Client & Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Client</label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="h-10 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Type</label>
                <div className="flex gap-2 flex-wrap">
                  {(['call', 'meeting', 'analytics'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, type: t })}
                      className={`h-10 px-4 rounded-lg text-[13px] font-bold transition-colors ${form.type === t ? 'bg-zinc-950 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                    >
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Title & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr] gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Title (optional)</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="h-10 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="e.g. Monthly check-in"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Status</label>
                <div className="flex gap-2">
                  {(['PLANNED', 'COMPLETED'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, status: s })}
                      className={`h-10 px-4 rounded-lg text-[13px] font-bold flex-1 transition-colors ${form.status === s ? 'bg-zinc-950 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                    >
                      {s === 'PLANNED' ? 'Planned' : 'Completed'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Date & time + Planned (minutes) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Date & time</label>
                <input
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="h-10 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Planned (minutes)</label>
                <input
                  type="number"
                  value={form.plannedMinutes}
                  onChange={(e) => setForm({ ...form, plannedMinutes: e.target.value })}
                  className="h-10 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="e.g. 60"
                />
              </div>
            </div>

            {/* Row 4: Location & Attendees */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Location (optional)</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="h-10 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="e.g. Zoom, or a physical address"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Attendees (comma-separated)</label>
                <input
                  value={form.attendees}
                  onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                  className="h-10 rounded-lg border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="e.g. Eric Davis, Jay-ar Patra"
                />
              </div>
            </div>

            {/* Row 5: Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Notes (optional)</label>
              <textarea
                value={form.noteBody}
                onChange={(e) => setForm({ ...form, noteBody: e.target.value })}
                rows={3}
                className="min-h-[90px] rounded-lg border border-zinc-200 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="Add any agenda, discussion points, or recap..."
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="h-10 px-5 rounded-lg text-sm font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving}
                className="h-10 px-6 rounded-lg bg-black text-white hover:bg-neutral-800 text-sm font-semibold shadow-xs"
              >
                {saving ? 'Saving…' : 'Add entry'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}