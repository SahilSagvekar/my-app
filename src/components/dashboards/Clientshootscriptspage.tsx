'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check, FileText, MapPin, ChevronLeft, PlayCircle, Loader, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import type { ShootScript } from '@/lib/shoot-scripts';
import { useEffectiveClientId } from '@/lib/hooks/useEffectiveClientId';
import { ScriptReferencesPanel } from './ScriptReferencesPanel';
import { PageHeader } from '../ui/page-header';

interface ScriptEntry extends ShootScript {
  taskId: string;
  taskTitle: string | null;
  shootDate: string | null;
  location: string | null;
  scriptSentAt: string | null;
  scriptSentByName?: string | null;
  // 'shoot' = written per physical shoot day (src/lib/shoot-scripts.ts,
  // /api/client/shoot-scripts). 'deliverable' = auto-generated per SF/LF
  // deliverable slot (src/lib/deliverable-scripts.ts, /api/client/deliverable-scripts).
  // Both render in the same list here; only the PATCH target differs.
  source: 'shoot' | 'deliverable';
}

const ENDPOINT_FOR_SOURCE: Record<ScriptEntry['source'], string> = {
  shoot: '/api/client/shoot-scripts',
  deliverable: '/api/client/deliverable-scripts',
};

type Tab = 'all' | 'pending' | 'approved';

const formatDate = (value: string | null | undefined) => {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export function ClientShootScriptsPage() {
  const [scripts, setScripts] = useState<ScriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [openScript, setOpenScript] = useState<ScriptEntry | null>(null);
  const [draftText, setDraftText] = useState('');
  const [savedLabel, setSavedLabel] = useState<'Saved' | 'Saving…'>('Saved');
  const [approving, setApproving] = useState(false);
  const [rejectingScript, setRejectingScript] = useState<ScriptEntry | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [shootPickerOpen, setShootPickerOpen] = useState(false);
  const [clientShoots, setClientShoots] = useState<Array<{ taskId: string; taskTitle: string | null; shootDate: string | null }>>([]);
  const [loadingShoots, setLoadingShoots] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingScript, setDeletingScript] = useState<ScriptEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set only when an admin/manager is previewing this client's portal
  // (ViewAsRoleContext) — a real client user gets null here and every
  // call below falls back to the backend resolving their own session.
  const clientIdOverride = useEffectiveClientId();
  const previewHeaders: HeadersInit | undefined = clientIdOverride ? { 'x-viewing-as': 'client' } : undefined;
  const previewJsonHeaders: HeadersInit = { 'Content-Type': 'application/json', ...(previewHeaders || {}) };

  const fetchScripts = useCallback(async () => {
    try {
      setLoading(true);
      const suffix = clientIdOverride ? `?clientId=${clientIdOverride}` : '';
      const [shootRes, deliverableRes] = await Promise.all([
        fetch(`/api/client/shoot-scripts${suffix}`, { headers: previewHeaders }),
        fetch(`/api/client/deliverable-scripts${suffix}`, { headers: previewHeaders }),
      ]);
      const shootScripts = shootRes.ok ? ((await shootRes.json()).scripts || []).map((s: ScriptEntry) => ({ ...s, source: 'shoot' as const })) : [];
      const deliverableScripts = deliverableRes.ok ? ((await deliverableRes.json()).scripts || []) : [];
      setScripts([...shootScripts, ...deliverableScripts]);
    } catch (err) {
      console.error('Failed to load scripts:', err);
    } finally {
      setLoading(false);
    }
  }, [clientIdOverride]);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  const counts = useMemo(() => ({
    all: scripts.length,
    pending: scripts.filter((s) => s.status !== 'approved').length,
    approved: scripts.filter((s) => s.status === 'approved').length,
  }), [scripts]);

  const visible = useMemo(() => scripts.filter((s) => {
    if (tab === 'pending') return s.status !== 'approved';
    if (tab === 'approved') return s.status === 'approved';
    return true;
  }), [scripts, tab]);

  const saveContent = useCallback(async (script: ScriptEntry, content: string) => {
    setSavedLabel('Saving…');
    try {
      const res = await fetch(ENDPOINT_FOR_SOURCE[script.source], {
        method: 'PATCH',
        headers: previewJsonHeaders,
        body: JSON.stringify({ taskId: script.taskId, scriptId: script.id, action: 'update_content', content, clientId: clientIdOverride || undefined }),
      });
      if (!res.ok) throw new Error();
      const { script: updated } = await res.json();
      setScripts((current) => current.map((item) => (item.id === updated.id && item.taskId === script.taskId ? { ...item, ...updated } : item)));
      setSavedLabel('Saved');
    } catch {
      toast.error('Could not save your changes');
      setSavedLabel('Saved');
    }
  }, [clientIdOverride]);

  const onTextChange = (value: string) => {
    setDraftText(value);
    setSavedLabel('Saving…');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (openScript) saveContent(openScript, value);
    }, 600);
  };

  const approve = async (script: ScriptEntry, { closeEditor }: { closeEditor?: boolean } = {}) => {
    setApproving(true);
    try {
      const res = await fetch(ENDPOINT_FOR_SOURCE[script.source], {
        method: 'PATCH',
        headers: previewJsonHeaders,
        body: JSON.stringify({ taskId: script.taskId, scriptId: script.id, action: 'approve', clientId: clientIdOverride || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not approve');
      const { script: updated } = await res.json();
      setScripts((current) => current.map((item) => (item.id === updated.id && item.taskId === script.taskId ? { ...item, ...updated } : item)));
      toast.success('Script approved');
      if (closeEditor) setOpenScript(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not approve');
    } finally {
      setApproving(false);
    }
  };

  const closeEditor = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setOpenScript(null);
  };

  const openShootPicker = async () => {
    setShootPickerOpen(true);
    setLoadingShoots(true);
    try {
      const suffix = clientIdOverride ? `&clientId=${clientIdOverride}` : '';
      const res = await fetch(`/api/client/shoot-scripts?shootsList=1${suffix}`, { headers: previewHeaders });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClientShoots(data.shoots || []);
    } catch {
      toast.error('Could not load your shoots');
      setClientShoots([]);
    } finally {
      setLoadingShoots(false);
    }
  };

  const createScript = async (taskId: string) => {
    setCreating(true);
    try {
      const res = await fetch('/api/client/shoot-scripts', {
        method: 'PATCH',
        headers: previewJsonHeaders,
        body: JSON.stringify({ taskId, action: 'create', clientId: clientIdOverride || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not create script');
      const { script } = await res.json();
      const shoot = clientShoots.find((s) => s.taskId === taskId);
      const created: ScriptEntry = {
        ...script,
        taskId,
        taskTitle: shoot?.taskTitle || null,
        shootDate: shoot?.shootDate || null,
        location: null,
        scriptSentAt: new Date().toISOString(),
        scriptSentByName: null,
        source: 'shoot',
      };
      setScripts((current) => [created, ...current]);
      setShootPickerOpen(false);
      setOpenScript(created);
      setDraftText(created.content);
      setSavedLabel('Saved');
      toast.success('Script created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create script');
    } finally {
      setCreating(false);
    }
  };

  const deleteScript = async () => {
    if (!deletingScript) return;
    setDeleting(true);
    try {
      const res = await fetch(ENDPOINT_FOR_SOURCE[deletingScript.source], {
        method: 'PATCH',
        headers: previewJsonHeaders,
        body: JSON.stringify({ taskId: deletingScript.taskId, scriptId: deletingScript.id, action: 'delete', clientId: clientIdOverride || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not delete script');
      setScripts((current) => current.filter((item) => !(item.id === deletingScript.id && item.taskId === deletingScript.taskId)));
      if (openScript?.id === deletingScript.id) setOpenScript(null);
      toast.success('Script deleted');
      setDeletingScript(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete script');
    } finally {
      setDeleting(false);
    }
  };

  // Upload a plain-text script file and drop its contents straight into the
  // editor textbox. Only .txt/.md are read client-side without a library;
  // Word/PDF uploads would need a server-side parser (mammoth/pdf-parse),
  // which isn't installed in this app yet.
  const onUploadScriptFile = (file: File) => {
    const isPlainText = /\.(txt|md)$/i.test(file.name) || file.type.startsWith('text/');
    if (!isPlainText) {
      toast.error('Only .txt files can be read directly — copy/paste .docx or .pdf content instead');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      onTextChange(text);
      toast.success('Script text loaded from file');
    };
    reader.onerror = () => toast.error('Could not read that file');
    reader.readAsText(file);
  };

  const submitReject = async () => {
    if (!rejectingScript || !rejectReason.trim()) {
      toast.error('Add a reason for the client to see');
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch(ENDPOINT_FOR_SOURCE[rejectingScript.source], {
        method: 'PATCH',
        headers: previewJsonHeaders,
        body: JSON.stringify({
          taskId: rejectingScript.taskId,
          scriptId: rejectingScript.id,
          action: 'reject',
          feedback: rejectReason.trim(),
          clientId: clientIdOverride || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not reject');
      const { script: updated } = await res.json();
      setScripts((current) => current.map((item) => (item.id === updated.id && item.taskId === rejectingScript.taskId ? { ...item, ...updated } : item)));
      toast.success('Changes requested');
      setRejectingScript(null);
      setRejectReason('');
      if (openScript?.id === rejectingScript.id) setOpenScript(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reject');
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading scripts...</p>
        </div>
      </div>
    );
  }

  const pill = (id: Tab, label: string, count: number, badgeClass: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`flex items-center gap-2.5 h-9 px-3.5 rounded-lg text-sm font-bold transition-colors ${
        tab === id ? 'bg-white shadow-sm text-zinc-950' : 'bg-transparent text-zinc-500 hover:text-zinc-800'
      }`}
    >
      {label}
      <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md text-xs font-bold ${badgeClass}`}>{count}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scripts"
        description="Review scripts before production and keep a record of what's been made"
        actions={
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap bg-zinc-100 rounded-xl p-1">
            {pill('all', 'All', counts.all, 'bg-zinc-200 text-zinc-900')}
            {pill('pending', 'Pending', counts.pending, 'bg-amber-100 text-amber-800')}
            {pill('approved', 'Approved', counts.approved, 'bg-green-100 text-green-800')}
          </div>
          <Button onClick={openShootPicker} className="h-9 gap-1.5 rounded-lg bg-zinc-950 px-4 text-[13px] font-bold hover:opacity-85">
            <Plus className="h-4 w-4" /> New Script
          </Button>
        </div>
        }
      />

      {visible.length === 0 ? (
        <div className="text-center py-16 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
          <FileText className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium">{scripts.length === 0 ? 'No scripts shared yet' : 'Nothing in this tab'}</p>
          <p className="text-sm text-zinc-400 mt-1">Scripts for your upcoming shoots will appear here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((script) => {
            const pending = script.status !== 'approved';
            return (
              <div key={`${script.taskId}-${script.id}`} className="border border-zinc-200 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <button
                      onClick={() => { setOpenScript(script); setDraftText(script.content); setSavedLabel('Saved'); }}
                      className="text-left text-[15px] font-bold text-zinc-950 hover:underline"
                    >
                      {script.title || script.taskTitle || 'Video script'}
                    </button>
                    <div className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
                      {script.scriptSentByName && <span>Uploaded by {script.scriptSentByName}</span>}
                      {formatDate(script.scriptSentAt) && <span>· {formatDate(script.scriptSentAt)}</span>}
                      {script.location && <span className="flex items-center gap-1">· <MapPin className="h-3 w-3" />{script.location}</span>}
                    </div>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-extrabold tracking-wide uppercase ${
                    pending ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {!pending ? 'Approved' : script.status === 'changes_requested' ? 'Changes requested' : 'Pending'}
                  </span>
                </div>

                <div className="h-px bg-zinc-200" />

                {pending ? (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setOpenScript(script); setDraftText(script.content); setSavedLabel('Saved'); }}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-zinc-200 text-[13px] font-bold hover:bg-zinc-50"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Review Script
                      </button>
                      {script.source === 'shoot' && (
                        <button onClick={() => setDeletingScript(script)} className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-red-600 text-[12px] font-bold hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRejectingScript(script)}
                        className="h-9 px-4 rounded-lg border border-red-200 text-red-600 text-[13px] font-bold hover:bg-red-50"
                      >
                        Reject
                      </button>
                      <Button
                        size="sm"
                        disabled={approving}
                        onClick={() => approve(script)}
                        className="h-9 px-4 rounded-lg bg-zinc-950 hover:opacity-85 text-[13px] font-bold"
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[13px] text-zinc-500">Approved {formatDate(script.updatedAt) || ''}</div>
                    {script.source === 'shoot' && (
                      <button onClick={() => setDeletingScript(script)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-red-600 text-[12px] font-bold hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {openScript && (
        <div className="fixed inset-0 bg-white z-[60] flex flex-col">
          <div className="h-16 flex-shrink-0 border-b border-zinc-200 flex items-center gap-4 px-6">
            <button onClick={closeEditor} className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-bold hover:bg-zinc-50">
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <div className="w-px h-5.5 bg-zinc-200" />
            <div className="text-[15px] font-bold text-zinc-950">{openScript.title || openScript.taskTitle || 'Video script'}</div>
            <label className="ml-auto flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-zinc-200 text-[13px] font-bold hover:bg-zinc-50 cursor-pointer">
              <Upload className="h-3.5 w-3.5" /> Upload script
              <input
                type="file"
                className="hidden"
                accept=".txt,.md,text/plain"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) onUploadScriptFile(file); e.target.value = ''; }}
              />
            </label>
            <div className="text-[13px] text-zinc-400">{savedLabel}</div>
          </div>

          <div className="flex-1 overflow-y-auto flex justify-center px-6 py-10">
            <div className="w-full max-w-[760px] space-y-5">
              <textarea
                value={draftText}
                onChange={(e) => onTextChange(e.target.value)}
                className="w-full min-h-[560px] border border-zinc-200 rounded-xl p-8 text-[15px] leading-[1.7] font-sans text-zinc-950 resize-y focus:outline-none focus:ring-2 focus:ring-zinc-950/10"
              />
              {openScript.source === 'shoot' && (
                <ScriptReferencesPanel
                  shootTaskId={openScript.taskId}
                  scriptId={openScript.id}
                  referenceLinks={openScript.referenceLinks || []}
                  referenceFiles={openScript.referenceFiles || []}
                  clientIdOverride={clientIdOverride}
                  onUpdate={(next) => {
                    setOpenScript((current) => current ? { ...current, ...next } : current);
                    setScripts((current) => current.map((item) => item.id === openScript.id && item.taskId === openScript.taskId ? { ...item, ...next } : item));
                  }}
                />
              )}
            </div>
          </div>

          <div className="h-[76px] flex-shrink-0 border-t border-zinc-200 flex items-center justify-center gap-2.5 px-6">
            <button onClick={closeEditor} className="flex items-center gap-1.5 h-11 px-5 rounded-lg border border-zinc-200 text-sm font-bold hover:bg-zinc-50">
              Save &amp; Close
            </button>
            <button
              onClick={() => setRejectingScript(openScript)}
              className="flex items-center gap-1.5 h-11 px-5 rounded-lg border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50"
            >
              Reject
            </button>
            <Button
              disabled={approving}
              onClick={() => approve(openScript, { closeEditor: true })}
              className="h-11 px-5 rounded-lg bg-zinc-950 hover:opacity-85 text-sm font-bold gap-1.5"
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>
          </div>
        </div>
      )}

      {rejectingScript && (
        <div onClick={() => !rejecting && setRejectingScript(null)} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-[440px] max-w-[92vw] bg-white rounded-2xl p-6 shadow-xl flex flex-col gap-4">
            <div className="text-base font-bold text-zinc-950">Request changes</div>
            <p className="text-sm text-zinc-500">Tell the videographer what needs to change on "{rejectingScript.title || 'this script'}".</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              autoFocus
              placeholder="e.g. Please add a call-to-action at the end"
              className="min-h-[100px] rounded-lg border border-zinc-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950/10"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setRejectingScript(null); setRejectReason(''); }} className="h-10 px-4 rounded-lg border border-zinc-200 text-sm font-bold hover:bg-zinc-50">
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={rejecting || !rejectReason.trim()}
                className="h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {shootPickerOpen && (
        <div onClick={() => setShootPickerOpen(false)} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-[440px] max-w-[92vw] max-h-[80vh] bg-white rounded-2xl p-6 shadow-xl flex flex-col gap-4">
            <div className="text-base font-bold text-zinc-950">Which shoot is this script for?</div>
            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
              {loadingShoots ? (
                <div className="py-8 text-center text-sm text-zinc-500">Loading your shoots…</div>
              ) : clientShoots.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">No shoots on file yet.</div>
              ) : (
                clientShoots.map((s) => (
                  <button
                    key={s.taskId}
                    disabled={creating}
                    onClick={() => createScript(s.taskId)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <span className="text-sm font-semibold text-zinc-950">{s.taskTitle || 'Shoot'}</span>
                    <span className="text-xs text-zinc-500">{formatDate(s.shootDate) || 'Unscheduled'}</span>
                  </button>
                ))
              )}
            </div>
            <button onClick={() => setShootPickerOpen(false)} className="h-10 px-4 rounded-lg border border-zinc-200 text-sm font-bold hover:bg-zinc-50 self-end">
              Cancel
            </button>
          </div>
        </div>
      )}

      {deletingScript && (
        <div onClick={() => !deleting && setDeletingScript(null)} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-[400px] max-w-[92vw] bg-white rounded-2xl p-6 shadow-xl flex flex-col gap-4">
            <div className="text-base font-bold text-zinc-950">Delete this script?</div>
            <p className="text-sm text-zinc-500">"{deletingScript.title || 'This script'}" will be permanently removed.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingScript(null)} className="h-10 px-4 rounded-lg border border-zinc-200 text-sm font-bold hover:bg-zinc-50">
                Cancel
              </button>
              <button
                onClick={deleteScript}
                disabled={deleting}
                className="h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}