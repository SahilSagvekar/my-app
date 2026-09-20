'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, Eye, FilePlus2, Send, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { readShootScriptDocument, SCRIPT_TEMPLATES, type ShootScript, type ShootScriptDocument } from '@/lib/shoot-scripts';
import { ScriptReferencesPanel } from './ScriptReferencesPanel';

/** Pull plain text from an uploaded script file (.txt/.md/.csv/.rtf or .docx). */
async function extractScriptText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    throw new Error('PDF uploads are not supported — use .txt, .md, or .docx');
  }
  if (name.endsWith('.docx')) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('Could not read Word document');
    return xml
      .replace(/<w:p[\s>]/g, '\n')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br\s*\/>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  const text = await file.text();
  // Reject obvious binary payloads (e.g. .doc legacy / images renamed as .txt)
  if (/[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 2000))) {
    throw new Error('Could not read that file as text — try .txt, .md, or .docx');
  }
  return text.replace(/^\uFEFF/, '').trimEnd();
}

interface ShootForScripts { id: string; title: string | null; client: { id?: string | null; name?: string | null; companyName?: string | null } | null; scriptContent: string | null; shootDate?: string | null; }

const labelForStatus = (status: ShootScript['status']) => ({ draft: 'Draft', sent: 'Submitted', approved: 'Approved', changes_requested: 'Rejected' }[status]);
const StatusMark = ({ status }: { status: ShootScript['status'] }) => status === 'approved' ? <Check className="h-3.5 w-3.5" /> : status === 'changes_requested' ? <AlertCircle className="h-3.5 w-3.5" /> : null;

interface ScriptQuota { totalPlanned: number; completed: number; remaining: number; }

// A "Label:" line on its own gets rendered as a bold section heading in the
// Preview tab (matching the brief-template look); everything else is a
// regular paragraph. Blank lines just add breathing room between sections.
const isLabelLine = (line: string) => /^[A-Za-z][A-Za-z /-]{0,40}:$/.test(line);
function ScriptPreview({ content }: { content: string }) {
  if (!content.trim()) return <p className="text-sm text-slate-400">Nothing written yet.</p>;
  return <>{content.split('\n').map((raw, i) => {
    const line = raw.trim();
    if (!line) return <div key={i} className="h-4" />;
    if (isLabelLine(line)) return <p key={i} className="text-base font-semibold text-slate-950">{line}</p>;
    return <p key={i} className="text-base leading-7 text-slate-700">{line}</p>;
  })}</>;
}

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
  const [uploadingScript, setUploadingScript] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

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
  // Shared client-month pool drives whether a new script can be started —
  // NOT this shoot's own script count. Falls back to the old per-shoot
  // cap only if there's no client on this shoot to compute a pool for.
  const pending = quota ? quota.remaining : Math.max(0, document.videosPlanned - document.scripts.length);
  const awaiting = document.scripts.filter(s => s.status === 'sent').length;
  const shootName = shoot?.client?.companyName || shoot?.client?.name || shoot?.title || 'Shoot';

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
  // "New Script" now starts by picking a real, unlinked deliverable slot
  // (SF3, LF1...) instead of a generic "Video N" — linked immediately via link-new.
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
  // For the references panel only — it already persists itself via its own
  // dedicated endpoint, so this just syncs local state without triggering
  // another (redundant, and possibly stale-overwriting) save through the
  // main document PATCH the way update() above does.
  const applyLocalOnly = (patch: Partial<ShootScript>) => selected && setDocument(current => ({ ...current, scripts: current.scripts.map(s => s.id === selected.id ? { ...s, ...patch } : s) }));
  const handleScriptFileUpload = async (file: File | undefined) => {
    if (!file || !selected) return;
    setUploadingScript(true);
    try {
      const text = await extractScriptText(file);
      if (!text.trim()) {
        toast.error('That file is empty — nothing to paste into the script');
        return;
      }
      update({ content: text });
      toast.success(`Loaded script from ${file.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read script file');
    } finally {
      setUploadingScript(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };
  // Marks this script's shoot as actually having happened — permanently
  // ties it to THIS shoot and counts it against the shared monthly pool.
  // Toggleable in case of a mis-click; unmarking frees the slot back up.
  const toggleCompleted = (script: ShootScript) => {
    const next = { ...document, scripts: document.scripts.map(s => s.id === script.id ? { ...s, completedAt: s.completedAt ? null : new Date().toISOString() } : s) };
    void persist(next, true);
  };
  const submit = async () => {
    if (!selected || !shoot?.client) { toast.error('Assign a client to this shoot before submitting'); return; }
    setSaveStatus('saving');
    try {
      // Flush pending edits first and cancel the debounced autosave so a stale
      // save can't land after the submit.
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      if (!(await persist(document, true))) return;
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

  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={view === 'editor' ? '!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !border-0 p-0 gap-0 flex flex-col overflow-hidden bg-white shadow-none sm:!max-w-none' : 'flex h-[92vh] max-h-[92vh] w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl flex-col overflow-hidden rounded-2xl p-0 gap-0'}>
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-6 sm:px-8 text-sm text-slate-600 bg-white">
      <div className="flex items-center">
        <button type="button" onClick={() => (view === 'editor' ? setView('list') : onOpenChange(false))} className="flex items-center gap-1 hover:text-slate-950 font-medium text-slate-500">
          <ChevronLeft className="h-4 w-4" /> Shooting Schedule
        </button>
        <span className="mx-2 text-slate-300">/</span>
        <span className="font-medium text-slate-950">{shootName} — Scripts</span>
      </div>
    </div>
    <div className={`flex-1 overflow-y-auto ${view === 'editor' ? 'bg-slate-50/50' : 'bg-white'}`}>
      {view === 'list' && (
        <div className="mx-auto w-full max-w-5xl xl:max-w-6xl p-6 sm:p-8">
          <section className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[32px] font-bold leading-tight tracking-tight text-slate-950">Scripts</h1>
                <p className="mt-2 text-sm text-slate-600">
                  Shoot: {shootName} {shoot?.shootDate ? `| ${new Date(shoot.shootDate).toLocaleDateString()}` : ''} {quota ? `| ${quota.remaining} of ${quota.totalPlanned} left this month across all shoots` : `| ${document.videosPlanned} videos planned`}
                </p>
              </div>
              <Button onClick={() => beginScript()} disabled={pending === 0} className="h-10 gap-2 rounded-lg bg-slate-950 px-4 hover:opacity-85">
                <FilePlus2 className="h-4 w-4" /> New Script
              </Button>
            </header>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-950">
                  {quota ? `${quota.completed} of ${quota.totalPlanned} scripts completed this month` : `${document.scripts.length} of ${document.videosPlanned} scripts written`}
                </span>
                <span className="text-xs text-slate-600">{awaiting} awaiting client approval</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-950" style={{ width: `${quota ? Math.min(100, (quota.completed / Math.max(1, quota.totalPlanned)) * 100) : Math.min(100, (document.scripts.length / document.videosPlanned) * 100)}%` }} />
              </div>
              <p className="mt-3 text-xs text-slate-600">
                {pending ? `${pending} still needed this month — doesn't have to be on this shoot` : "This client's monthly script pool is used up."}
              </p>
            </div>
            <div className="space-y-3">
              {document.scripts.map((script, index) => (
                <article key={script.id} className="rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                  <button type="button" onClick={() => { setSelectedId(script.id); setView('editor'); }} className="flex w-full items-start justify-between gap-4 text-left">
                    <div>
                      <h2 className="text-base font-semibold text-slate-950">{script.title || `Video ${index + 1}`}</h2>
                      <p className="mt-1 text-xs text-slate-600">
                        {SCRIPT_TEMPLATES[script.template].label} | {script.content.trim().split(/\s+/).filter(Boolean).length} words | {new Date(script.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700">
                      <StatusMark status={script.status} />{labelForStatus(script.status)}
                    </span>
                  </button>
                  {script.clientFeedback && (
                    <div className="mt-4 border-t pt-3">
                      <p className="text-xs font-semibold text-slate-950">Client feedback</p>
                      <p className="mt-1 text-sm text-slate-700">{script.clientFeedback}</p>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-9" onClick={() => { setSelectedId(script.id); setView('editor'); }}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                    </Button>
                    <Button variant="outline" size="sm" className="h-9" onClick={() => { setSelectedId(script.id); setView('editor'); }}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-9" onClick={() => setDeleteId(script.id)}>
                      Delete
                    </Button>
                    <Button
                      variant={script.completedAt ? 'default' : 'outline'}
                      size="sm"
                      className={script.completedAt ? 'h-9 ml-auto gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white' : 'h-9 ml-auto gap-1.5'}
                      onClick={() => toggleCompleted(script)}
                    >
                      <Check className="h-3.5 w-3.5" /> {script.completedAt ? 'Shot — Completed' : 'Mark Shot Completed'}
                    </Button>
                  </div>
                </article>
              ))}
              {Array.from({ length: Math.min(6, pending) }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 px-5 py-3">
                  <span className="text-sm text-slate-600">Next up — no script yet</span>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => beginScript()}>Write script</Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {view === 'editor' && selected && (
        <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-6">
          <section className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Input
                  value={selected.title}
                  onChange={e => update({ title: e.target.value })}
                  className="h-auto border-transparent px-0 py-0 text-3xl font-bold leading-tight text-slate-950 shadow-none hover:border-slate-200 focus-visible:border-slate-800 bg-transparent"
                  placeholder="Script title"
                />
                <p className="mt-1 text-sm text-slate-500 font-normal">
                  {SCRIPT_TEMPLATES[selected.template].label}
                </p>
              </div>
              <span className="shrink-0 pt-2 text-sm font-medium text-slate-500">
                {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
              </span>
            </div>

            <Tabs defaultValue="script" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white p-1 gap-1">
                  <TabsTrigger
                    value="script"
                    className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-700 hover:text-slate-950"
                  >
                    Script
                  </TabsTrigger>
                  <TabsTrigger
                    value="preview"
                    className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-700 hover:text-slate-950"
                  >
                    Preview
                  </TabsTrigger>
                </TabsList>
                <div>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept=".txt,.md,.markdown,.text,.csv,.rtf,.docx,text/plain,text/markdown,text/csv"
                    className="hidden"
                    onChange={(e) => { void handleScriptFileUpload(e.target.files?.[0]); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingScript}
                    className="h-10 gap-2 rounded-lg border-slate-200 px-4 text-slate-700 hover:bg-slate-50 font-medium"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingScript ? 'Uploading…' : 'Upload Script'}
                  </Button>
                </div>
              </div>
              <TabsContent value="script" className="mt-0">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs min-h-[440px]">
                  <Textarea
                    value={selected.content}
                    onChange={e => update({ content: e.target.value })}
                    rows={16}
                    placeholder="Paste your script here, start typing, or use Upload Script…"
                    className="w-full min-h-[380px] border-0 p-0 text-base leading-relaxed focus-visible:ring-0 focus:outline-none resize-none font-normal text-slate-800 placeholder:text-slate-400 bg-transparent shadow-none"
                  />
                </div>
              </TabsContent>
              <TabsContent value="preview" className="mt-0">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs min-h-[440px]">
                  <article className="space-y-4 text-base leading-relaxed text-slate-800">
                    <ScriptPreview content={selected.content} />
                  </article>
                </div>
              </TabsContent>
            </Tabs>

            <ScriptReferencesPanel
              shootTaskId={shoot!.id}
              scriptId={selected.id}
              referenceLinks={selected.referenceLinks || []}
              referenceFiles={selected.referenceFiles || []}
              onUpdate={(next) => applyLocalOnly(next)}
            />
          </section>
        </div>
      )}
    </div>

    {view === 'editor' && selected && (
      <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-6 sm:px-8 py-4">
        <Button
          variant="outline"
          className="h-10 px-4 rounded-lg gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
          onClick={() => setView('list')}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-10 px-5 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
            onClick={() => void persist(document)}
          >
            Save Draft
          </Button>
          <Button
            variant={selected.completedAt ? 'default' : 'outline'}
            className={selected.completedAt ? 'h-10 px-4 rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium' : 'h-10 px-4 rounded-lg gap-1.5 border-slate-200 text-slate-700 font-medium'}
            onClick={() => toggleCompleted(selected)}
          >
            <Check className="h-4 w-4" /> {selected.completedAt ? 'Shot — Completed' : 'Mark Shot Completed'}
          </Button>
          <Button
            onClick={submit}
            disabled={!selected.content.trim()}
            className="h-10 px-5 rounded-lg gap-2 bg-slate-950 hover:bg-slate-800 text-white font-semibold disabled:opacity-50"
          >
            Submit to Client <Send className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={() => setDeleteId(selected.id)}
          className="h-10 px-4 rounded-lg gap-1.5 border-slate-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 font-medium"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    )}
    <Dialog open={taskPickerOpen} onOpenChange={setTaskPickerOpen}><DialogContent className="max-w-[420px] rounded-2xl"><DialogHeader><DialogTitle>Which deliverable is this for?</DialogTitle><DialogDescription>Pick the exact slot — the script will be named to match and linked immediately, no guessing later.</DialogDescription></DialogHeader>
      {loadingTasks ? <p className="py-6 text-center text-sm text-slate-500">Loading...</p> : availableTasks.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No unlinked SF/LF deliverables left for this client this month.</p> : (
        <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto">
          {availableTasks.map(t => <button type="button" key={t.id} onClick={() => pickTask(t.id)} className="rounded-lg border p-3 text-center hover:bg-slate-50"><span className="block text-sm font-bold">{t.code}{t.number}</span></button>)}
        </div>
      )}
    </DialogContent></Dialog>
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}><DialogContent className="max-w-[400px] rounded-2xl"><DialogHeader><DialogTitle>Select script type</DialogTitle><DialogDescription>{quota ? `${quota.remaining} left this month` : ''}</DialogDescription></DialogHeader><div className="space-y-2">{(Object.keys(SCRIPT_TEMPLATES) as Array<keyof typeof SCRIPT_TEMPLATES>).map(type => <button type="button" key={type} onClick={() => createLinked(type)} className="w-full rounded-lg border p-4 text-left hover:bg-slate-50"><span className="block text-sm font-semibold">{SCRIPT_TEMPLATES[type].label}</span><span className="mt-1 block text-sm text-slate-600">{type === 'overall' ? 'One-page direction for the whole shoot' : type === 'detailed' ? 'Scene-by-scene with timecodes and dialogue' : 'Talking points for unscripted delivery'}</span></button>)}</div></DialogContent></Dialog>
  </DialogContent></Dialog><AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this script?</AlertDialogTitle><AlertDialogDescription>This removes the script from this shoot.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete script</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}