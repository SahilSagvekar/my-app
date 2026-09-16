'use client';

// Friendly Script Linking side panel for videographers and editors.
// Staff can wire script ↔ folder ↔ editor task. Editors can only attach
// an existing script or raw-footage folder to tasks assigned to them.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  Unlink,
  CalendarDays,
  Plus,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';

type LinkFilter = 'all' | 'linked' | 'unlinked';

interface ClientOption { id: string; name: string; companyName?: string | null }

interface Slot {
  key: string;
  folder: {
    id: string;
    code: string;
    number: number;
    folderPath: string;
    taskId: string | null;
    taskTitle: string | null;
  };
  deliverableScript: { id: string; title: string; status: string; taskId: string | null } | null;
  shootScript: { id: string; title: string; content: string; status: string; shootTaskId: string; shootDate: string | null } | null;
  shootDates: string[];
  hasScript: boolean;
}

interface ShootScriptOption {
  id: string;
  title: string;
  content: string;
  status: string;
  shootTaskId: string;
  shootTitle: string | null;
  shootDate: string | null;
}

interface TaskOption {
  id: string;
  title: string | null;
  status: string | null;
  deliverableType: string | null;
  shootScriptRef: string | null;
}

function currentMonthFolder(): string {
  const now = new Date();
  return `${now.toLocaleDateString('en-US', { month: 'long' })}-${now.getFullYear()}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Picker rows show the script name only — never the full body text.
function scriptDisplayName(title: string | undefined | null) {
  const name = (title || '').trim();
  return name || 'Untitled script';
}

function AttachedScriptCard({
  title,
  content,
  active = false,
  hint = 'Currently attached',
}: {
  title: string;
  content: string;
  active?: boolean;
  hint?: string;
}) {
  const body = (content || '').trim();
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        active ? 'border-white/20 bg-white/10' : 'border-emerald-200 bg-emerald-50',
      )}
    >
      <p className={cn('text-sm font-semibold', active ? 'text-white' : 'text-slate-900')}>
        {scriptDisplayName(title)}
      </p>
      {body ? (
        <p
          className={cn(
            'mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed',
            active ? 'text-white/90' : 'text-slate-800',
          )}
        >
          {body}
        </p>
      ) : (
        <p className={cn('mt-2 text-sm italic', active ? 'text-white/60' : 'text-slate-500')}>
          No script content yet.
        </p>
      )}
      <p className={cn('mt-2 text-xs', active ? 'text-white/70' : 'text-emerald-700')}>{hint}</p>
    </div>
  );
}

export function ScriptLinkingPanel({ mode }: { mode: 'videographer' | 'editor' }) {
  const isStaff = mode === 'videographer';
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [monthFolder, setMonthFolder] = useState(currentMonthFolder());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [availableShootScripts, setAvailableShootScripts] = useState<ShootScriptOption[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scriptPick, setScriptPick] = useState('');
  const [taskPick, setTaskPick] = useState('');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all');

  useEffect(() => {
    const loadClients = async () => {
      try {
        if (mode === 'editor') {
          const res = await fetch('/api/editor/task-permissions', { credentials: 'include' });
          const data = await res.json().catch(() => ({}));
          const list = (data.clients || []).map((c: { id: string; name: string; companyName?: string }) => ({
            id: c.id,
            name: c.name,
            companyName: c.companyName || c.name,
          }));
          setClients(list);
          if (list.length && !clientId) setClientId(list[0].id);
          return;
        }
        const res = await fetch('/api/clients', { credentials: 'include' });
        const data = res.ok ? await res.json() : { clients: [] };
        const list = data.clients || [];
        setClients(list);
        if (list.length && !clientId) setClientId(list[0].id);
      } catch {
        setClients([]);
      }
    };
    void loadClients();
  }, [mode]);

  const load = useCallback(async () => {
    if (!clientId || !monthFolder) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/script-linking/board?clientId=${clientId}&monthFolder=${encodeURIComponent(monthFolder)}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSlots(data.slots || []);
      setAvailableShootScripts(data.availableShootScripts || []);
      setTasks(data.tasks || []);
      if (data.slots?.length && !selectedKey) setSelectedKey(data.slots[0].key);
    } catch (err: any) {
      toast.error(err.message || 'Could not load linking board');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, monthFolder, selectedKey]);

  useEffect(() => { load(); }, [clientId, monthFolder]);

  const selected = useMemo(() => slots.find((s) => s.key === selectedKey) || null, [slots, selectedKey]);

  const runAction = async (action: string, payload: Record<string, unknown>, success: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/script-linking/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Action failed');
      toast.success(success);
      setScriptPick('');
      setTaskPick('');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const unlinkedTasks = tasks.filter((t) => {
    if (selected?.folder.taskId === t.id) return true;
    const linkedElsewhere = slots.some((s) => s.folder.taskId === t.id && s.key !== selected?.key);
    return !linkedElsewhere;
  });

  // Scripts already attached to any editor task must leave the picker.
  const linkedScriptKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const slot of slots) {
      if (slot.shootScript) {
        keys.add(`${slot.shootScript.shootTaskId}::${slot.shootScript.id}`);
      }
    }
    for (const task of tasks) {
      if (!task.shootScriptRef) continue;
      try {
        const ref = JSON.parse(task.shootScriptRef) as { shootTaskId?: string; scriptId?: string };
        if (ref.shootTaskId && ref.scriptId) keys.add(`${ref.shootTaskId}::${ref.scriptId}`);
      } catch {
        /* ignore malformed refs */
      }
    }
    return keys;
  }, [slots, tasks]);

  // Only unlinked scripts — names only in the UI. Currently attached scripts
  // are shown in slot metadata / the attached banner, not in this list.
  const scriptsForPicker = useMemo(
    () => availableShootScripts.filter((s) => !linkedScriptKeys.has(`${s.shootTaskId}::${s.id}`)),
    [availableShootScripts, linkedScriptKeys],
  );

  // Inline row dropdown — clicking a slot row's chevron opens a small
  // script picker right on that row (no need to select the slot and go
  // find the side panel's "Attach a script" section first).
  const [rowDropdownKey, setRowDropdownKey] = useState<string | null>(null);
  const [rowScriptPick, setRowScriptPick] = useState('');
  const toggleRowDropdown = (key: string) => {
    setRowDropdownKey((current) => (current === key ? null : key));
    setRowScriptPick('');
  };
  const linkScriptToSlot = async (slot: Slot) => {
    if (!rowScriptPick || !slot.folder.taskId) return;
    const [shootTaskId, scriptId] = rowScriptPick.split('::');
    await runAction('link-script-to-task', { taskId: slot.folder.taskId, shootTaskId, scriptId }, 'Script linked to this slot’s task');
    setRowDropdownKey(null);
    setRowScriptPick('');
  };
  const unlinkScriptFromSlot = async (slot: Slot) => {
    await runAction('unlink-script-from-task', { taskId: slot.folder.taskId }, 'Script unlinked');
  };

  const isSlotLinked = (slot: Slot) => slot.hasScript && !!slot.folder.taskId;
  const visibleSlots = useMemo(
    () => slots.filter((slot) => (linkFilter === 'all' ? true : linkFilter === 'linked' ? isSlotLinked(slot) : !isSlotLinked(slot))),
    [slots, linkFilter],
  );

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-slate-950">
          {isStaff ? 'Link Scripts & Raw Footage' : 'Link Scripts to My Tasks'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {isStaff
            ? 'Connect a script to a raw-footage folder and an editor task. Folders show shoot dates once a script is linked.'
            : 'Attach an existing script or raw-footage folder to one of your assigned tasks.'}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 min-w-[160px]">
          <Label className="text-[11px] uppercase tracking-wide text-slate-400">Client</Label>
          <Select value={clientId} onValueChange={(v) => { setClientId(v); setSelectedKey(null); }}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.companyName || c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[160px]">
          <Label className="text-[11px] uppercase tracking-wide text-slate-400">Month folder</Label>
          <Input value={monthFolder} onChange={(e) => setMonthFolder(e.target.value)} className="h-9" placeholder="September-2026" />
        </div>

        <div className="space-y-1 min-w-[140px]">
          <Label className="text-[11px] uppercase tracking-wide text-slate-400">Link status</Label>
          <Select value={linkFilter} onValueChange={(v) => setLinkFilter(v as LinkFilter)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All slots</SelectItem>
              <SelectItem value="linked">Linked</SelectItem>
              <SelectItem value="unlinked">Unlinked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button variant="outline" className="h-9 w-full sm:w-auto" onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* List + side panel — a plain flex row now that the header/filters
          above are outside it, so the aside's top lines up with the first
          slot row (SF1) instead of with the page title. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Main list */}
      <div className="min-w-0 flex-1 space-y-4">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading slots…
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
            No SF/LF raw-footage folders for this client and month yet.
          </div>
        ) : visibleSlots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
            No {linkFilter} slots for this client and month.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {visibleSlots.map((slot) => {
              const active = slot.key === selectedKey;
              const dropdownOpen = rowDropdownKey === slot.key;
              return (
                <div key={slot.key} className={cn('transition-colors', active ? 'bg-slate-950 text-white' : 'bg-white hover:bg-slate-50')}>
                  <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => setSelectedKey(slot.key)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold', active ? 'bg-white/15' : 'bg-slate-100 text-slate-900')}>
                        {slot.key}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{slot.folder.taskTitle || 'No editor task'}</span>
                          {slot.hasScript ? (
                            <Badge variant="secondary" className={cn('text-[10px]', active && 'bg-white/20 text-white')}>Script linked</Badge>
                          ) : (
                            <Badge variant="outline" className={cn('text-[10px]', active && 'border-white/30 text-white/80')}>No script</Badge>
                          )}
                        </div>
                        <p className={cn('mt-0.5 truncate text-xs', active ? 'text-white/70' : 'text-slate-500')}>
                          {slot.shootDates.length
                            ? `Shoot ${slot.shootDates.map(formatDate).join(', ')}`
                            : 'Unscheduled'}
                          {slot.shootScript ? ` · ${slot.shootScript.title}` : slot.deliverableScript ? ` · ${slot.deliverableScript.title}` : ''}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleRowDropdown(slot.key)}
                      aria-label={dropdownOpen ? 'Close script picker' : 'Open script picker'}
                      className={cn('shrink-0 rounded-md p-1.5 transition-colors', active ? 'hover:bg-white/10' : 'hover:bg-slate-200/70')}
                    >
                      <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', dropdownOpen && 'rotate-90', active ? 'text-white/70' : 'text-slate-400')} />
                    </button>
                  </div>

                  {dropdownOpen && (
                    <div className={cn('space-y-2 border-t px-4 py-3', active ? 'border-white/10' : 'border-slate-100 bg-slate-50')}>
                      {!slot.folder.taskId ? (
                        <p className={cn('text-xs', active ? 'text-white/70' : 'text-amber-700')}>
                          Link an editor task to this slot first — scripts attach to the task that owns the folder.
                        </p>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            {slot.shootScript && (
                              <AttachedScriptCard
                                title={slot.shootScript.title}
                                content={slot.shootScript.content}
                                active={active}
                              />
                            )}
                            {scriptsForPicker.length === 0 ? (
                              <p className={cn('text-xs', active ? 'text-white/70' : 'text-slate-500')}>
                                {slot.shootScript
                                  ? 'No other unlinked scripts available to swap in.'
                                  : 'No unlinked scripts available for this client.'}
                              </p>
                            ) : (
                              scriptsForPicker.map((s) => {
                                const key = `${s.shootTaskId}::${s.id}`;
                                const isPicked = rowScriptPick === key;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => setRowScriptPick(key)}
                                    className={cn(
                                      'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                                      isPicked
                                        ? active
                                          ? 'border-white bg-white text-slate-900'
                                          : 'border-slate-900 bg-white'
                                        : active
                                          ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                                          : 'border-slate-200 bg-white hover:bg-slate-50',
                                    )}
                                  >
                                    <p className="truncate text-sm font-medium">{scriptDisplayName(s.title)}</p>
                                    <p className={cn('mt-1 text-xs', active && !isPicked ? 'text-white/60' : 'text-slate-500')}>
                                      {s.shootDate ? formatDate(s.shootDate) : 'Unscheduled'} — {s.status}
                                    </p>
                                  </button>
                                );
                              })
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-8 flex-1 gap-1.5 bg-slate-950 text-xs hover:opacity-90"
                              disabled={busy || !rowScriptPick}
                              onClick={() => void linkScriptToSlot(slot)}
                            >
                              <Link2 className="h-3.5 w-3.5" /> Link script
                            </Button>
                            {slot.shootScript && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs"
                                disabled={busy}
                                onClick={() => void unlinkScriptFromSlot(slot)}
                              >
                                <Unlink className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Side section */}
      <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-4 lg:w-[380px]">
        {!selected ? (
          <div className="py-10 text-center text-sm text-slate-500">Select a folder slot to link.</div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Selected slot</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">{selected.key}</h2>
              <p className="mt-1 text-xs text-slate-500 break-all">{selected.folder.folderPath}</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">Shoot dates</p>
                  <p className="text-slate-600">
                    {selected.shootDates.length
                      ? selected.shootDates.map(formatDate).join(' · ')
                      : 'Unscheduled — link a shoot script to show dates'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">Script</p>
                  <p className="text-slate-600">
                    {selected.shootScript?.title || selected.deliverableScript?.title || 'None linked'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FolderOpen className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">Editor task</p>
                  <p className="text-slate-600">{selected.folder.taskTitle || 'None linked'}</p>
                </div>
              </div>
            </div>

            {/* Link script */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">1. Attach a script</h3>
              {selected.folder.taskId ? (
                <>
                  {selected.shootScript && (
                    <AttachedScriptCard
                      title={selected.shootScript.title}
                      content={selected.shootScript.content}
                      hint="Currently attached — pick another below to swap, or unlink."
                    />
                  )}
                  <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
                    {scriptsForPicker.length === 0 ? (
                      <p className="text-xs text-slate-500 px-1 py-2">
                        {selected.shootScript
                          ? 'No other unlinked scripts available to swap in.'
                          : 'No unlinked scripts available for this client.'}
                      </p>
                    ) : (
                      scriptsForPicker.map((s) => {
                        const key = `${s.shootTaskId}::${s.id}`;
                        const isPicked = scriptPick === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setScriptPick(key)}
                            className={cn(
                              'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                              isPicked ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white hover:bg-slate-50',
                            )}
                          >
                            <p className="truncate text-sm font-medium text-slate-900">{scriptDisplayName(s.title)}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {s.shootDate ? formatDate(s.shootDate) : 'Unscheduled'} — {s.status}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="h-9 flex-1 gap-1.5 bg-slate-950 hover:opacity-90"
                      disabled={busy || !scriptPick}
                      onClick={() => {
                        const [shootTaskId, scriptId] = scriptPick.split('::');
                        void runAction('link-script-to-task', {
                          taskId: selected.folder.taskId,
                          shootTaskId,
                          scriptId,
                        }, 'Script linked to this slot’s task');
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" /> Link script
                    </Button>
                    {selected.shootScript && (
                      <Button
                        variant="outline"
                        className="h-9 gap-1.5"
                        disabled={busy}
                        onClick={() => void runAction('unlink-script-from-task', { taskId: selected.folder.taskId }, 'Script unlinked')}
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  Link an editor task first — scripts attach to the task that owns this folder.
                </p>
              )}

              {isStaff && (
                <Button
                  variant="outline"
                  className="h-9 w-full gap-1.5"
                  disabled={busy || !selected.folder.taskId}
                  onClick={() => void runAction('generate-folder-script', { folderId: selected.folder.id }, 'Draft script created for this folder')}
                >
                  <Plus className="h-3.5 w-3.5" /> Generate draft script for folder
                </Button>
              )}
            </section>

            {/* Link folder ↔ task */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">2. Attach editor task / raw footage</h3>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                value={taskPick || selected.folder.taskId || ''}
                onChange={(e) => setTaskPick(e.target.value)}
              >
                <option value="">Choose a task…</option>
                {unlinkedTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title || t.id} {t.shootScriptRef ? '· has script' : ''}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button
                  className="h-9 flex-1 gap-1.5 bg-slate-950 hover:opacity-90"
                  disabled={busy || !(taskPick || selected.folder.taskId)}
                  onClick={() => void runAction(
                    'link-folder-to-task',
                    { folderId: selected.folder.id, taskId: taskPick || selected.folder.taskId },
                    'Folder linked to task',
                  )}
                >
                  <Link2 className="h-3.5 w-3.5" /> Link folder to task
                </Button>
                {selected.folder.taskId && (
                  <Button
                    variant="outline"
                    className="h-9 gap-1.5"
                    disabled={busy}
                    onClick={() => void runAction('unlink-folder-from-task', { folderId: selected.folder.id }, 'Folder unlinked')}
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </section>

            <div className="rounded-xl border border-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Scripts that appear inside a linked folder are <strong className="text-slate-700">view & download only</strong> — nobody can edit or delete them from Drive.
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              {selected.hasScript && selected.folder.taskId ? (
                <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Slot fully linked</>
              ) : (
                <><XCircle className="h-3.5 w-3.5 text-amber-600" /> Still needs {![selected.hasScript, !!selected.folder.taskId].every(Boolean) ? 'links' : 'attention'}</>
              )}
            </div>
          </div>
        )}
      </aside>
      </div>
    </div>
  );
}