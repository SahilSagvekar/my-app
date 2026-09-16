'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, Eye, FilePlus2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { readShootScriptDocument, SCRIPT_TEMPLATES, type ShootScript, type ShootScriptDocument } from '@/lib/shoot-scripts';
import { ScriptReferencesPanel } from './ScriptReferencesPanel';

interface ShootForScripts { id: string; title: string | null; client: { id?: string | null; name?: string | null; companyName?: string | null } | null; scriptContent: string | null; shootDate?: string | null; }

const labelForStatus = (status: ShootScript['status']) => ({ draft: 'Draft', sent: 'Submitted', approved: 'Approved', changes_requested: 'Rejected' }[status]);
const StatusMark = ({ status }: { status: ShootScript['status'] }) => status === 'approved' ? <Check className="h-3.5 w-3.5" /> : status === 'changes_requested' ? <AlertCircle className="h-3.5 w-3.5" /> : null;

interface ScriptQuota { totalPlanned: number; completed: number; remaining: number; }

export function ShootScriptsDialog({ shoot, open, onOpenChange, onChanged }: { shoot: ShootForScripts | null; open: boolean; onOpenChange: (open: boolean) => void; onChanged: () => void; }) {
  const [document, setDocument] = useState<ShootScriptDocument>({ version: 1, videosPlanned: 1, scripts: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<Array<{ id: string; title: string | null; code: string; number: number }>>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [quota, setQuota] = useState<ScriptQuota | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchQuota = () => {
    if (!shoot?.client?.id) { setQuota(null); return; }
    void fetch(`/api/clients/${shoot.client.id}/script-quota`).then(async (r) => {
      if (!r.ok) return;
      setQuota(await r.json());
    }).catch(() => undefined);
  };

  useEffect(() => {
    if (!open || !shoot) return;
    let cancelled = false;
    setDocument(readShootScriptDocument(shoot.scriptContent)); setSelectedId(null); setView('list');
    fetchQuota();
    void fetch(`/api/shoots/${shoot.id}/scripts`).then(async response => {
      if (!response.ok || cancelled) return;
      const data = await response.json();
      if (!cancelled) setDocument(data.document);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [open, shoot]);

  const selected = document.scripts.find(s => s.id === selectedId) || null;
  const pending = quota ? quota.remaining : Math.max(0, document.videosPlanned - document.scripts.length);
  const awaiting = document.scripts.filter(s => s.status === 'sent').length;
  const shootName = shoot?.client?.companyName || shoot?.client?.name || shoot?.title || 'Shoot';

  // Progress stats for the list view
  const totalPlanned = quota ? quota.totalPlanned : document.videosPlanned;
  const writtenCount = quota ? quota.completed : document.scripts.length;
  const progressPct = Math.min(100, (writtenCount / Math.max(1, totalPlanned)) * 100);
  const allWritten = writtenCount >= totalPlanned;

  const persist = async (next: ShootScriptDocument, silent = false) => {
    if (!shoot) return false;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/shoots/${shoot.id}/scripts`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document: next }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save scripts');
      setDocument((await res.json()).document); onChanged(); fetchQuota();
      if (!silent) toast.success('Saved');
      return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save scripts'); return false; }
    finally { setSaveStatus('saved'); }
  };

  const autosave = (next: ShootScriptDocument) => { setDocument(next); setSaveStatus('saving'); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { void persist(next, true); }, 2000); };

  const beginScript = async () => {
    if (!shoot) return;
    setLoadingTasks(true);
    setTaskPickerOpen(true);
    try {
      const res = await fetch(`/api/shoots/${shoot.id}/available-tasks`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAvailableTasks(data.tasks || []);
    } catch {
      toast.error('Could not load available deliverable slots');
      setAvailableTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const pickTask = (taskId: string) => { setPendingTaskId(taskId); setTaskPickerOpen(false); setPickerOpen(true); };

  const createLinked = async (template: keyof typeof SCRIPT_TEMPLATES) => {
    if (!shoot || !pendingTaskId) return;
    try {
      const res = await fetch(`/api/shoots/${shoot.id}/scripts/link-new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: pendingTaskId, template }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create script');
      setDocument(data.document);
      setPickerOpen(false);
      setPendingTaskId(null);
      const created = data.document.scripts[data.document.scripts.length - 1];
      setSelectedId(created.id);
      setView('editor');
      onChanged();
      fetchQuota();
      toast.success(`Script created and linked to ${data.linkedTask?.title}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create script');
    }
  };

  const update = (patch: Partial<ShootScript>) => selected && autosave({ ...document, scripts: document.scripts.map(s => s.id === selected.id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s) });
  const applyLocalOnly = (patch: Partial<ShootScript>) => selected && setDocument(current => ({ ...current, scripts: current.scripts.map(s => s.id === selected.id ? { ...s, ...patch } : s) }));

  const toggleCompleted = (script: ShootScript) => {
    const next = { ...document, scripts: document.scripts.map(s => s.id === script.id ? { ...s, completedAt: s.completedAt ? null : new Date().toISOString() } : s) };
    void persist(next, true);
  };

  const submit = async () => {
    if (!selected || !shoot?.client) { toast.error('Assign a client to this shoot before submitting'); return; }
    setSaveStatus('saving');
    try {
      const response = await fetch(`/api/shoots/${shoot.id}/scripts/${selected.id}/submit`, { method: 'POST' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not submit script');
      const { script } = await response.json();
      setDocument(current => ({ ...current, scripts: current.scripts.map(entry => entry.id === script.id ? script : entry) }));
      onChanged();
      toast.success(`Submitted Version ${script.versions?.length || 1} to the client task list`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not submit script'); }
    finally { setSaveStatus('saved'); }
  };

  const remove = async () => { if (!deleteId) return; const next = { ...document, scripts: document.scripts.filter(s => s.id !== deleteId) }; setDeleteId(null); setSelectedId(null); setView('list'); await persist(next); };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex flex-col max-h-[92vh] max-w-[900px] rounded-2xl p-0 gap-0 overflow-hidden">

          {/* Breadcrumb header */}
          <div className="flex h-14 items-center border-b border-gray-100 px-6 text-sm text-gray-500">
            <button
              type="button"
              onClick={() => view === 'editor' ? setView('list') : onOpenChange(false)}
              className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Shooting Schedule
            </button>
            <span className="mx-2 text-gray-300">/</span>
            <span className="font-semibold text-gray-900">{shootName} — Scripts</span>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[900px] p-6 sm:p-8">

            {/* ── LIST VIEW ── */}
            {view === 'list' && (
              <section className="space-y-6">

                {/* Page header */}
                <header className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-[32px] font-bold leading-tight tracking-tight text-gray-900">Scripts</h1>
                    <p className="mt-1 text-sm text-gray-500">
                      Shoot: {shootName}
                      {shoot?.shootDate ? ` | ${new Date(shoot.shootDate).toLocaleDateString()}` : ''}
                      {` | ${totalPlanned} video${totalPlanned !== 1 ? 's' : ''} planned`}
                    </p>
                  </div>
                  <Button
                    onClick={() => beginScript()}
                    disabled={pending === 0}
                    className="h-10 shrink-0 gap-2 rounded-xl bg-gray-900 px-5 text-white hover:bg-gray-800"
                  >
                    <FilePlus2 className="h-4 w-4" /> New Script
                  </Button>
                </header>

                {/* Progress card */}
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      {writtenCount} of {totalPlanned} script{totalPlanned !== 1 ? 's' : ''} written
                    </span>
                    <span className="text-sm text-gray-500">{awaiting} awaiting client approval</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gray-900 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-gray-500">
                    {allWritten
                      ? 'Every planned video has a script.'
                      : `${pending} still needed this month — doesn't have to be on this shoot`}
                  </p>
                </div>

                {/* Script cards */}
                <div className="space-y-3">
                  {document.scripts.map((script, index) => (
                    <article key={script.id} className="rounded-xl border border-gray-200 bg-white">

                      {/* Card header */}
                      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-gray-900 leading-snug">
                            {script.title || `Video ${index + 1}`}
                          </h2>
                          <p className="mt-1 text-sm text-gray-400">
                            {SCRIPT_TEMPLATES[script.template].label} | {script.content.trim().split(/\s+/).filter(Boolean).length} words | {new Date(script.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {/* Rectangular badge — not pill */}
                        <span className="flex shrink-0 items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700">
                          <StatusMark status={script.status} />
                          {labelForStatus(script.status)}
                        </span>
                      </div>

                      {/* Client feedback */}
                      {script.clientFeedback && (
                        <div className="mx-5 mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                          <p className="text-xs font-semibold text-amber-800">Client feedback</p>
                          <p className="mt-1 text-sm text-amber-700">{script.clientFeedback}</p>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="border-t border-gray-100 mx-0" />

                      {/* Action row */}
                      <div className="flex items-center gap-2 px-5 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 border-gray-200 text-gray-700 hover:bg-gray-50"
                          onClick={() => { setSelectedId(script.id); setView('editor'); }}
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 border-gray-200 text-gray-700 hover:bg-gray-50"
                          onClick={() => { setSelectedId(script.id); setView('editor'); }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 ml-auto text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold"
                          onClick={() => setDeleteId(script.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </article>
                  ))}

                  {/* "Next up" placeholder slots */}
                  {Array.from({ length: Math.min(6, pending) }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 px-5 py-4"
                    >
                      <span className="text-sm text-gray-400">Next up — no script yet</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 border-gray-200 font-semibold"
                        onClick={() => beginScript()}
                      >
                        Write script
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── EDITOR VIEW ── */}
            {view === 'editor' && selected && (
              <section className="space-y-5">

                {/* Title + Saved row */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Input
                      value={selected.title}
                      onChange={e => update({ title: e.target.value })}
                      className="h-auto border-transparent -mx-1 px-1 py-0 text-2xl font-bold text-gray-900 shadow-none placeholder:text-gray-300 hover:border-gray-200 focus-visible:border-gray-300 focus-visible:ring-0"
                      placeholder="Script title"
                    />
                    <p className="mt-0.5 pl-1 text-sm text-gray-400">{SCRIPT_TEMPLATES[selected.template].label}</p>
                  </div>
                  <span className="mt-1 shrink-0 text-sm text-gray-400">
                    {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
                  </span>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="script">
                  <TabsList className="h-9 rounded-lg border border-gray-200 bg-white p-0.5 gap-0.5">
                    <TabsTrigger
                      value="script"
                      className="h-8 rounded-md px-4 text-sm font-medium text-gray-500 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-none"
                    >
                      Script
                    </TabsTrigger>
                    <TabsTrigger
                      value="preview"
                      className="h-8 rounded-md px-4 text-sm font-medium text-gray-500 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-none"
                    >
                      Preview
                    </TabsTrigger>
                  </TabsList>

                  {/* Script tab — white card textarea */}
                  <TabsContent value="script" className="mt-3">
                    <Textarea
                      value={selected.content}
                      onChange={e => update({ content: e.target.value })}
                      rows={20}
                      placeholder="Paste your script here or start typing..."
                      className="min-h-[440px] rounded-xl border border-gray-200 bg-white p-5 font-mono text-sm leading-7 shadow-none focus-visible:ring-0 focus-visible:border-gray-300"
                    />
                  </TabsContent>

                  {/* Preview tab — white card with border */}
                  <TabsContent value="preview" className="mt-3">
                    <article className="min-h-[440px] whitespace-pre-wrap rounded-xl border border-gray-200 bg-white p-6 text-sm leading-7 text-gray-800">
                      {selected.content || <span className="text-gray-400">Nothing written yet.</span>}
                    </article>
                  </TabsContent>
                </Tabs>

                {/* References panel */}
                <ScriptReferencesPanel
                  shootTaskId={shoot!.id}
                  scriptId={selected.id}
                  referenceLinks={selected.referenceLinks || []}
                  referenceFiles={selected.referenceFiles || []}
                  onUpdate={(next) => applyLocalOnly(next)}
                />
              </section>
            )}
          </div>
          </div>

          {/* ── STICKY FOOTER (editor only) ── */}
          {view === 'editor' && selected && (
            <div className="flex-none flex items-center gap-2 border-t border-gray-100 bg-white px-6 py-3">
              <Button
                variant="outline"
                className="h-10 gap-1.5 border-gray-200"
                onClick={() => setView('list')}
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                variant="outline"
                className="h-10 border-gray-200"
                onClick={() => void persist(document)}
              >
                Save Draft
              </Button>
              <Button
                onClick={submit}
                disabled={!selected.content.trim()}
                className="h-10 gap-1.5 bg-gray-900 hover:bg-gray-800 text-white"
              >
                Submit to Client <Send className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDeleteId(selected.id)}
                className="ml-auto h-10 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          )}

          {/* Task picker dialog */}
          <Dialog open={taskPickerOpen} onOpenChange={setTaskPickerOpen}>
            <DialogContent className="max-w-[420px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Which deliverable is this for?</DialogTitle>
                <DialogDescription>Pick the exact slot — the script will be named to match and linked immediately, no guessing later.</DialogDescription>
              </DialogHeader>
              {loadingTasks ? (
                <p className="py-6 text-center text-sm text-gray-500">Loading...</p>
              ) : availableTasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No unlinked SF/LF deliverables left for this client this month.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto">
                  {availableTasks.map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => pickTask(t.id)}
                      className="rounded-lg border p-3 text-center hover:bg-gray-50"
                    >
                      <span className="block text-sm font-bold">{t.code}{t.number}</span>
                    </button>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Template picker dialog */}
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogContent className="max-w-[400px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Select script type</DialogTitle>
                <DialogDescription>{quota ? `${quota.remaining} left this month` : ''}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {(Object.keys(SCRIPT_TEMPLATES) as Array<keyof typeof SCRIPT_TEMPLATES>).map(type => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => createLinked(type)}
                    className="w-full rounded-lg border p-4 text-left hover:bg-gray-50"
                  >
                    <span className="block text-sm font-semibold">{SCRIPT_TEMPLATES[type].label}</span>
                    <span className="mt-1 block text-sm text-gray-500">
                      {type === 'overall' ? 'One-page direction for the whole shoot' : type === 'detailed' ? 'Scene-by-scene with timecodes and dialogue' : 'Talking points for unscripted delivery'}
                    </span>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this script?</AlertDialogTitle>
            <AlertDialogDescription>This removes the script from this shoot.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete script</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
