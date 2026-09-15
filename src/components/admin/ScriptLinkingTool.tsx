'use client';

// src/components/admin/ScriptLinkingTool.tsx
//
// Manual reconciliation screen for the deliverable-scripts feature. Shows,
// per client + month, every SF/LF raw-footage-folder slot and whether its
// editor task and its script are linked — with actions to generate a
// missing script, re-sync a script to its folder's current task, or (via
// a pasted task id — the client's unlinked-SF/LF-task picker this would
// otherwise reuse is a separate, currently broken endpoint, out of scope
// here) manually assign a task to an unlinked folder slot.

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { CheckCircle2, XCircle, RefreshCw, FileText, Link2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ClientOption { id: string; name: string; companyName?: string | null }

interface FolderRow {
  id: string;
  code: string;
  number: number;
  folderPath: string;
  taskId: string | null;
  taskTitle: string | null;
}

interface ScriptRow {
  id: string;
  code: string;
  number: number;
  title: string;
  status: string;
  taskId: string | null;
  taskTitle: string | null;
  rawFootageFolderId: string;
}

interface Slot {
  key: string;
  code: string;
  number: number;
  folder: FolderRow;
  script: ScriptRow | null;
}

function currentMonthFolder(): string {
  const now = new Date();
  return `${now.toLocaleDateString('en-US', { month: 'long' })}-${now.getFullYear()}`;
}

export function ScriptLinkingTool() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [monthFolder, setMonthFolder] = useState(currentMonthFolder());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [taskIdDraft, setTaskIdDraft] = useState<Record<string, string>>({});
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [savingEditor, setSavingEditor] = useState(false);

  useEffect(() => {
    fetch('/api/clients', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { clients: [] }))
      .then((data) => setClients(data.clients || []))
      .catch(() => setClients([]));
  }, []);

  const load = useCallback(async () => {
    if (!clientId || !monthFolder) return;
    setLoading(true);
    try {
      const [foldersRes, scriptsRes] = await Promise.all([
        fetch(`/api/raw-footage-folders?clientId=${clientId}&monthFolder=${encodeURIComponent(monthFolder)}`, { credentials: 'include' }),
        fetch(`/api/deliverable-scripts?clientId=${clientId}&monthFolder=${encodeURIComponent(monthFolder)}`, { credentials: 'include' }),
      ]);
      const foldersData = foldersRes.ok ? await foldersRes.json() : { folders: [] };
      const scriptsData = scriptsRes.ok ? await scriptsRes.json() : { scripts: [] };
      const scriptsByFolder = new Map<string, ScriptRow>((scriptsData.scripts || []).map((s: ScriptRow) => [s.rawFootageFolderId, s]));
      const built: Slot[] = (foldersData.folders || []).map((f: FolderRow) => ({
        key: `${f.code}${f.number}`,
        code: f.code,
        number: f.number,
        folder: f,
        script: scriptsByFolder.get(f.id) || null,
      }));
      setSlots(built);
    } catch {
      toast({ title: 'Failed to load', description: 'Could not load folders/scripts for this client and month.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [clientId, monthFolder]);

  useEffect(() => { load(); }, [load]);

  const generateScript = async (slot: Slot) => {
    setBusyKey(slot.key);
    try {
      const res = await fetch('/api/deliverable-scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rawFootageFolderId: slot.folder.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate script');
      toast({ title: 'Script created', description: `${slot.key} now has a draft script.` });
      await load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusyKey(null);
    }
  };

  const syncScriptLink = async (slot: Slot) => {
    if (!slot.script) return;
    setBusyKey(slot.key);
    try {
      const res = await fetch(`/api/deliverable-scripts/${slot.script.id}/relink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rawFootageFolderId: slot.folder.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to relink');
      toast({ title: 'Re-synced', description: `${slot.key}'s script now points at the folder's current task.` });
      await load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusyKey(null);
    }
  };

  const assignTask = async (slot: Slot) => {
    const taskId = (taskIdDraft[slot.key] || '').trim();
    if (!taskId) return;
    setBusyKey(slot.key);
    try {
      const res = await fetch(`/api/raw-footage-folders/${slot.folder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign task');
      toast({ title: 'Task assigned', description: `${slot.key} now points at that task.` });
      setTaskIdDraft((prev) => ({ ...prev, [slot.key]: '' }));
      await load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusyKey(null);
    }
  };

  const openEditor = (slot: Slot) => {
    if (!slot.script) return;
    setEditingScriptId(slot.script.id);
    fetch(`/api/deliverable-scripts/${slot.script.id}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setEditorContent(data?.script?.content || ''))
      .catch(() => setEditorContent(''));
  };

  const saveEditor = async () => {
    if (!editingScriptId) return;
    setSavingEditor(true);
    try {
      const res = await fetch(`/api/deliverable-scripts/${editingScriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: editorContent }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save');
      toast({ title: 'Saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setSavingEditor(false);
    }
  };

  const submitToClient = async () => {
    if (!editingScriptId) return;
    setSavingEditor(true);
    try {
      await saveEditor();
      const res = await fetch(`/api/deliverable-scripts/${editingScriptId}/submit`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      toast({ title: 'Sent to client' });
      setEditingScriptId(null);
      await load();
    } catch (err: any) {
      toast({ title: 'Failed to submit', description: err.message, variant: 'destructive' });
    } finally {
      setSavingEditor(false);
    }
  };

  const editingSlot = slots.find((s) => s.script?.id === editingScriptId) || null;

  return (
    <div className="space-y-6">
      <div className="pb-6 border-b">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Script Links</h1>
        <p className="text-muted-foreground mt-1">
          Every SF/LF deliverable slot for a client's month, and whether its raw-footage folder, editor task, and script are linked. Auto-generated monthly for clients with "Scripts required" on — use this to fix or create any that are missing.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Client</label>
          <select
            className="h-9 w-64 rounded-md border px-3 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.companyName || c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Month folder</label>
          <Input value={monthFolder} onChange={(e) => setMonthFolder(e.target.value)} className="h-9 w-48" placeholder="September-2026" />
        </div>
        <Button variant="outline" onClick={load} disabled={loading || !clientId} className="h-9 gap-2">
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {!clientId && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Pick a client to see their deliverable slots.</CardContent></Card>
      )}

      {clientId && !loading && slots.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No SF/LF raw-footage folders found for {monthFolder}.</CardContent></Card>
      )}

      {clientId && slots.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base">{slots.length} deliverable slot{slots.length !== 1 ? 's' : ''}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {slots.map((slot) => {
              const hasTask = !!slot.folder.taskId;
              const hasScript = !!slot.script;
              const drifted = hasScript && hasTask && slot.script!.taskId !== slot.folder.taskId;
              const isBusy = busyKey === slot.key;
              return (
                <div key={slot.key} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b last:border-0">
                  <span className="font-mono text-sm font-semibold w-16 flex-shrink-0">{slot.key}</span>

                  <div className="flex items-center gap-1.5 text-xs w-24 flex-shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Folder
                  </div>

                  <div className="flex items-center gap-1.5 text-xs w-40 flex-shrink-0">
                    {hasTask ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span className="truncate" title={slot.folder.taskTitle || undefined}>{slot.folder.taskTitle || 'No task'}</span>
                  </div>

                  {!hasTask && (
                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder="Task ID"
                        value={taskIdDraft[slot.key] || ''}
                        onChange={(e) => setTaskIdDraft((prev) => ({ ...prev, [slot.key]: e.target.value }))}
                        className="h-7 w-40 text-xs"
                      />
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={isBusy || !(taskIdDraft[slot.key] || '').trim()} onClick={() => assignTask(slot)}>
                        Assign
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs flex-1 min-w-[10rem]">
                    {hasScript ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    {hasScript ? (
                      <>
                        <Badge variant="outline" className="text-[10px]">{slot.script!.status}</Badge>
                        {drifted && <Badge variant="destructive" className="text-[10px]">Out of sync with folder</Badge>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">No script</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!hasScript && hasTask && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={isBusy} onClick={() => generateScript(slot)}>
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />} Generate
                      </Button>
                    )}
                    {hasScript && drifted && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={isBusy} onClick={() => syncScriptLink(slot)}>
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />} Sync link
                      </Button>
                    )}
                    {hasScript && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEditor(slot)}>
                        Open
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {editingScriptId && editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingScriptId(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingSlot.script?.title}</h2>
              <Button variant="ghost" size="sm" onClick={() => setEditingScriptId(null)}>Close</Button>
            </div>
            <Textarea value={editorContent} onChange={(e) => setEditorContent(e.target.value)} rows={16} className="font-mono text-sm" placeholder="Write the script here…" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={savingEditor} onClick={saveEditor}>Save draft</Button>
              <Button disabled={savingEditor || !editorContent.trim()} onClick={submitToClient}>Save &amp; send to client</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
