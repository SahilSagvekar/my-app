'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Eye, FilePlus2, FileText, MoreHorizontal, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { createShootScript, readShootScriptDocument, SCRIPT_TEMPLATES, type ShootScript, type ShootScriptDocument } from '@/lib/shoot-scripts';

interface ShootForScripts {
  id: string;
  title: string | null;
  client: { name?: string | null; companyName?: string | null } | null;
  scriptContent: string | null;
}

export function ShootScriptsDialog({ shoot, open, onOpenChange, onChanged }: {
  shoot: ShootForScripts | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [document, setDocument] = useState<ShootScriptDocument>({ version: 1, videosPlanned: 1, scripts: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [screen, setScreen] = useState<'list' | 'templates' | 'editor'>('list');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || !shoot) return;
    setDocument(readShootScriptDocument(shoot.scriptContent));
    setSelectedId(null);
    setScreen('list');
  }, [open, shoot]);

  const selected = document.scripts.find((script) => script.id === selectedId) || null;
  const persist = async (next: ShootScriptDocument, quiet = false) => {
    if (!shoot) return false;
    setSaving(true);
    try {
      const response = await fetch(`/api/shoots/${shoot.id}/scripts`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document: next }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not save scripts');
      const data = await response.json();
      setDocument(data.document);
      onChanged();
      if (!quiet) toast.success('Saved');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save scripts');
      return false;
    } finally { setSaving(false); }
  };

  const scheduleSave = (next: ShootScriptDocument) => {
    setDocument(next);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => { void persist(next, true); }, 2000);
  };

  const addScript = (template: keyof typeof SCRIPT_TEMPLATES) => {
    const script = createShootScript(template, document.scripts.length + 1);
    const next = { ...document, scripts: [...document.scripts, script] };
    setDocument(next); setSelectedId(script.id); setScreen('editor');
    void persist(next, true);
  };

  const updateSelected = (patch: Partial<ShootScript>) => {
    if (!selected) return;
    scheduleSave({ ...document, scripts: document.scripts.map((script) => script.id === selected.id ? { ...script, ...patch, updatedAt: new Date().toISOString() } : script) });
  };

  const shareForApproval = async () => {
    if (!selected) return;
    if (!shoot?.client) { toast.error('Assign a client to this shoot before sharing a script'); return; }
    const next = { ...document, scripts: document.scripts.map((script) => script.id === selected.id ? { ...script, status: 'sent' as const, updatedAt: new Date().toISOString() } : script) };
    if (await persist(next)) toast.success('Shared with the client for approval');
  };

  const removeScript = async () => {
    if (!deleteId) return;
    const next = { ...document, scripts: document.scripts.filter((script) => script.id !== deleteId) };
    setDeleteId(null); setSelectedId(null); setScreen('list');
    await persist(next);
  };

  const statusLabel = (script: ShootScript) => ({ draft: 'Draft', sent: 'Awaiting approval', approved: 'Approved', changes_requested: 'Changes requested' }[script.status]);
  const statusClass = (script: ShootScript) => script.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : script.status === 'changes_requested' ? 'bg-rose-50 text-rose-700 border-rose-200' : script.status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200';

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> {screen === 'editor' ? selected?.title || 'Script editor' : 'Shoot scripts'}</DialogTitle>
          <DialogDescription>{shoot?.title || 'Shoot'} · {document.scripts.length}/{document.videosPlanned} videos scripted{saving ? ' · Saving…' : ''}</DialogDescription>
        </DialogHeader>

        {screen === 'list' && <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 p-4">
            <div><p className="font-medium text-slate-900">Video plan</p><p className="text-sm text-slate-500">Add one script for each planned video.</p></div>
            <div className="flex items-center gap-2"><span className="text-sm text-slate-500">Videos planned</span><Input type="number" min="1" max="99" value={document.videosPlanned} onChange={(event) => scheduleSave({ ...document, videosPlanned: Math.max(1, Number(event.target.value) || 1) })} className="h-9 w-20" /></div>
          </div>
          <div className="space-y-2">
            {document.scripts.map((script, index) => <button type="button" key={script.id} onClick={() => { setSelectedId(script.id); setScreen('editor'); }} className="flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">{index + 1}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-900">{script.title || `Video ${index + 1}`}</span><span className="block text-xs text-slate-500">{SCRIPT_TEMPLATES[script.template].label}</span></span>
              <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(script)}`}>{statusLabel(script)}</span>
              <MoreHorizontal className="h-4 w-4 text-slate-400" />
            </button>)}
            {Array.from({ length: Math.max(0, document.videosPlanned - document.scripts.length) }).map((_, index) => <div key={`empty-${index}`} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50">{document.scripts.length + index + 1}</span>Video slot awaiting a script</div>)}
          </div>
          <Button onClick={() => setScreen('templates')} className="gap-2"><FilePlus2 className="h-4 w-4" /> New script</Button>
        </div>}

        {screen === 'templates' && <div className="space-y-4 py-2"><Button variant="ghost" size="sm" onClick={() => setScreen('list')} className="gap-1 -ml-2"><ChevronLeft className="h-4 w-4" /> Back to scripts</Button><div><h3 className="font-semibold">Start from a template</h3><p className="text-sm text-slate-500">Choose the structure that best fits this video.</p></div><div className="grid gap-3 md:grid-cols-3">{(Object.keys(SCRIPT_TEMPLATES) as Array<keyof typeof SCRIPT_TEMPLATES>).map((template) => <button type="button" key={template} onClick={() => addScript(template)} className="rounded-xl border p-4 text-left transition hover:border-primary hover:shadow-sm"><h4 className="font-medium">{SCRIPT_TEMPLATES[template].label}</h4><p className="mt-2 text-sm text-slate-500">{template === 'overall' ? 'A concise creative brief.' : template === 'detailed' ? 'Scene-by-scene direction.' : 'A fast, flexible shot outline.'}</p></button>)}</div></div>}

        {screen === 'editor' && selected && <div className="space-y-4 py-2"><div className="flex items-center justify-between gap-2"><Button variant="ghost" size="sm" onClick={() => setScreen('list')} className="gap-1 -ml-2"><ChevronLeft className="h-4 w-4" /> All scripts</Button><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setDeleteId(selected.id)} className="gap-1.5 text-rose-700"><Trash2 className="h-4 w-4" /> Delete</Button><Button size="sm" onClick={shareForApproval} disabled={!selected.content.trim()} className="gap-1.5"><Send className="h-4 w-4" /> {selected.status === 'sent' ? 'Update shared script' : 'Share for approval'}</Button></div></div>
          {selected.clientFeedback && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><strong>Client feedback:</strong> {selected.clientFeedback}</div>}
          <Tabs defaultValue="script"><TabsList><TabsTrigger value="script">Script</TabsTrigger><TabsTrigger value="preview" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Preview</TabsTrigger></TabsList><TabsContent value="script" className="space-y-3 pt-2"><Input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} placeholder="Video title" className="font-medium" /><Textarea value={selected.content} onChange={(event) => updateSelected({ content: event.target.value })} rows={18} placeholder="Write the script…" className="font-mono text-sm leading-6" /></TabsContent><TabsContent value="preview" className="pt-2"><article className="min-h-80 whitespace-pre-wrap rounded-xl border bg-slate-50 p-6 font-serif leading-7 text-slate-800">{selected.content || 'Nothing written yet.'}</article></TabsContent></Tabs>
        </div>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this script?</AlertDialogTitle><AlertDialogDescription>This removes the script from this shoot. This can’t be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={removeScript} className="bg-rose-600 hover:bg-rose-700"><Trash2 className="mr-1.5 h-4 w-4" /> Delete script</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
