'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Check, FileText, MapPin, Clock, Loader, MessageSquare } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import type { ShootScript } from '@/lib/shoot-scripts';

interface ScriptEntry extends ShootScript {
  taskId: string;
  taskTitle: string | null;
  shootDate: string | null;
  location: string | null;
  scriptSentAt: string | null;
}

export function ClientShootScriptsPage() {
  const [scripts, setScripts] = useState<ScriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<ScriptEntry | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchScripts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/client/shoot-scripts');
      if (res.ok) {
        const data = await res.json();
        setScripts(data.scripts || []);
      }
    } catch (err) {
      console.error('Failed to load scripts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  const respond = async (action: 'approve' | 'request_changes') => {
    if (!reviewing) return;
    if (action === 'request_changes' && !feedback.trim()) { toast.error('Please add feedback so the team knows what to change'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/client/shoot-scripts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: reviewing.taskId, scriptId: reviewing.id, action, feedback }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save your response');
      const { script } = await res.json();
      setScripts(current => current.map(item => item.id === script.id && item.taskId === reviewing.taskId ? { ...item, ...script } : item));
      toast.success(action === 'approve' ? 'Script approved' : 'Changes requested');
      setReviewing(null); setFeedback('');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save your response'); }
    finally { setSubmitting(false); }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Scripts</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Always shows the latest version — no need to check back for updates
        </p>
      </div>

      {scripts.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No scripts shared yet</p>
          <p className="text-sm text-slate-400 mt-1">Scripts for your upcoming shoots will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scripts.map(script => (
            <Card key={`${script.taskId}-${script.id}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-bold text-lg text-slate-950">{script.title || script.taskTitle || 'Video script'}</h3>
                  {script.shootDate && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(script.shootDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                  {script.location && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {script.location}
                    </span>
                  )}
                </div>
                <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-6 font-mono text-sm leading-7 text-slate-800">
                  {script.content || '(empty)'}
                </pre>
                {script.clientFeedback && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"><strong>Your feedback:</strong> {script.clientFeedback}</div>}
                <Button variant={script.status === 'approved' ? 'outline' : 'default'} onClick={() => { setReviewing(script); setFeedback(script.clientFeedback || ''); }} className="gap-1.5">
                  {script.status === 'approved' ? <Check className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                  {script.status === 'approved' ? 'View response' : 'Review script'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!reviewing} onOpenChange={(open) => { if (!open) { setReviewing(null); setFeedback(''); } }}>
        <DialogContent className="max-h-[88vh] max-w-[700px] overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>Script approval</DialogTitle><DialogDescription>{reviewing?.title || 'Script'} · Awaiting your approval</DialogDescription></DialogHeader>
          <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border bg-slate-50 p-6 font-mono text-sm leading-7 text-slate-800">{reviewing?.content}</pre>
          <div className="space-y-2"><label className="text-sm font-medium text-slate-950">Any feedback or requests?</label><Textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={5} placeholder="Leave feedback here..." /></div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="outline" disabled={submitting} onClick={() => respond('request_changes')}>Request Changes</Button><Button disabled={submitting} onClick={() => respond('approve')} className="gap-1.5 bg-slate-950 hover:opacity-85"><Check className="h-4 w-4" />Approve</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
