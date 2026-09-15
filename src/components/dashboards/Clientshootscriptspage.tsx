'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check, FileText, MapPin, ChevronLeft, PlayCircle, Loader } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import type { ShootScript } from '@/lib/shoot-scripts';
import { useEffectiveClientId } from '@/lib/hooks/useEffectiveClientId';

interface ScriptEntry extends ShootScript {
  taskId: string;
  taskTitle: string | null;
  shootDate: string | null;
  location: string | null;
  scriptSentAt: string | null;
  scriptSentByName?: string | null;
}

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
      const url = clientIdOverride ? `/api/client/shoot-scripts?clientId=${clientIdOverride}` : '/api/client/shoot-scripts';
      const res = await fetch(url, { headers: previewHeaders });
      if (res.ok) {
        const data = await res.json();
        setScripts(data.scripts || []);
      }
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
      const res = await fetch('/api/client/shoot-scripts', {
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
      const res = await fetch('/api/client/shoot-scripts', {
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

  const submitReject = async () => {
    if (!rejectingScript || !rejectReason.trim()) {
      toast.error('Add a reason for the client to see');
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch('/api/client/shoot-scripts', {
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-black tracking-tight text-zinc-950">Scripts</h1>
          <p className="text-zinc-500 text-sm mt-1.5">Review scripts before production and keep a record of what's been made</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap bg-zinc-100 rounded-xl p-1">
          {pill('all', 'All', counts.all, 'bg-zinc-200 text-zinc-900')}
          {pill('pending', 'Pending', counts.pending, 'bg-amber-100 text-amber-800')}
          {pill('approved', 'Approved', counts.approved, 'bg-green-100 text-green-800')}
        </div>
      </div>

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
                    {pending ? 'Pending' : 'Approved'}
                  </span>
                </div>

                <div className="h-px bg-zinc-200" />

                {pending ? (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <button
                      onClick={() => { setOpenScript(script); setDraftText(script.content); setSavedLabel('Saved'); }}
                      className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-zinc-200 text-[13px] font-bold hover:bg-zinc-50"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Review Script
                    </button>
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
                  <div className="text-[13px] text-zinc-500">Approved {formatDate(script.updatedAt) || ''}</div>
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
            <div className="ml-auto text-[13px] text-zinc-400">{savedLabel}</div>
          </div>

          <div className="flex-1 overflow-y-auto flex justify-center px-6 py-10">
            <div className="w-full max-w-[760px]">
              <textarea
                value={draftText}
                onChange={(e) => onTextChange(e.target.value)}
                className="w-full min-h-[560px] border border-zinc-200 rounded-xl p-8 text-[15px] leading-[1.7] font-sans text-zinc-950 resize-y focus:outline-none focus:ring-2 focus:ring-zinc-950/10"
              />
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
    </div>
  );
}