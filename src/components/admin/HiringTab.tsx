'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Search, Mail, Phone, Link as LinkIcon, Send, CheckCircle2, XCircle,
  Clock, ExternalLink, FileText, MessageCircle, Loader2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { toast } from 'sonner';

/* ── Types ─────────────────────────────────────────────────────── */
type CandidateStatus = 'NEW' | 'CONTACTED' | 'TEST_SENT' | 'TEST_SUBMITTED' | 'IN_REVIEW' | 'HIRED' | 'REJECTED';
type TestTaskStatus = 'PENDING' | 'SENT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

interface TestTask {
  id: string;
  title: string;
  instructions: string;
  rawFootageUrl: string | null;
  status: TestTaskStatus;
  submissionUrl: string | null;
  submissionS3Key: string | null;
  submittedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  portfolioUrl: string | null;
  resumeUrl: string | null;
  source: string | null;
  notes: string | null;
  status: CandidateStatus;
  createdAt: string;
  testTasks: TestTask[];
}

const STATUS_STYLES: Record<CandidateStatus, string> = {
  NEW: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  CONTACTED: 'bg-blue-50 text-blue-700 border-blue-200',
  TEST_SENT: 'bg-amber-50 text-amber-700 border-amber-200',
  TEST_SUBMITTED: 'bg-violet-50 text-violet-700 border-violet-200',
  IN_REVIEW: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  HIRED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<CandidateStatus, string> = {
  NEW: 'New', CONTACTED: 'Contacted', TEST_SENT: 'Test Sent', TEST_SUBMITTED: 'Test Submitted',
  IN_REVIEW: 'In Review', HIRED: 'Hired', REJECTED: 'Rejected',
};

function StatusBadge({ status }: { status: CandidateStatus }) {
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

/* ── Main ──────────────────────────────────────────────────────── */
export function HiringTab() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/hiring/candidates?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-white" />
            </div>
            Editor Hiring
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Candidate database, test tasks, and QC-style review — all in one place.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowAddDialog(true)}>
          <UserPlus className="h-4 w-4" /> Add Candidate
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as CandidateStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading candidates…
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <UserPlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No candidates yet</p>
            <p className="text-xs mt-1">Add one to start the hiring pipeline</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {candidates.map((c) => {
              const latestTask = c.testTasks[0];
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/70 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>
                      {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    </div>
                  </div>
                  {latestTask && (
                    <span className="text-xs text-gray-400 hidden sm:block">{latestTask.title}</span>
                  )}
                  <StatusBadge status={c.status} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AddCandidateDialog open={showAddDialog} onOpenChange={setShowAddDialog} onCreated={load} />
      <CandidateDetailSheet candidateId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
    </div>
  );
}

/* ── Add Candidate Dialog ──────────────────────────────────────── */
function AddCandidateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', portfolioUrl: '', resumeUrl: '', source: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm({ name: '', email: '', phone: '', portfolioUrl: '', resumeUrl: '', source: '', notes: '' }); }, [open]);

  async function handleSubmit() {
    if (!form.name || !form.email) { toast.error('Name and email are required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/hiring/candidates', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to add candidate');
      toast.success('Candidate added');
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add Candidate</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Phone (for WhatsApp, optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Portfolio URL" value={form.portfolioUrl} onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} />
          <Input placeholder="Resume URL" value={form.resumeUrl} onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })} />
          <Input placeholder="Source (e.g. referral, job board)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[80px]" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Adding…' : 'Add Candidate'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Candidate Detail Sheet ────────────────────────────────────── */
function CandidateDetailSheet({ candidateId, onClose, onChanged }: { candidateId: string | null; onClose: () => void; onChanged: () => void }) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSendTest, setShowSendTest] = useState(false);

  const load = useCallback(async () => {
    if (!candidateId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hiring/candidates/${candidateId}`, { credentials: 'include' });
      const data = await res.json();
      setCandidate(data.candidate || null);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => { load(); }, [load]);

  async function handleReview(taskId: string, decision: 'APPROVED' | 'REJECTED', reviewNotes: string) {
    try {
      const res = await fetch(`/api/hiring/test-tasks/${taskId}/review`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewNotes }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to submit review');
      toast.success(decision === 'APPROVED' ? 'Candidate approved — email sent' : 'Candidate rejected — email sent');
      load();
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <Sheet open={!!candidateId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        {loading || !candidate ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <SheetHeader className="px-0">
              <div className="flex items-center justify-between">
                <SheetTitle>{candidate.name}</SheetTitle>
                <StatusBadge status={candidate.status} />
              </div>
            </SheetHeader>

            <div className="space-y-1.5 text-sm">
              <p className="flex items-center gap-2 text-gray-600"><Mail className="h-3.5 w-3.5" />{candidate.email}</p>
              {candidate.phone && <p className="flex items-center gap-2 text-gray-600"><Phone className="h-3.5 w-3.5" />{candidate.phone}</p>}
              {candidate.portfolioUrl && (
                <p className="flex items-center gap-2 text-gray-600">
                  <LinkIcon className="h-3.5 w-3.5" />
                  <a href={candidate.portfolioUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">{candidate.portfolioUrl}</a>
                </p>
              )}
              {candidate.notes && <p className="text-gray-500 mt-2 whitespace-pre-wrap">{candidate.notes}</p>}
            </div>

            <Button size="sm" className="gap-1.5" onClick={() => setShowSendTest(true)}>
              <Send className="h-3.5 w-3.5" /> Send Test Task
            </Button>

            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Test Task History</h4>
              {candidate.testTasks.length === 0 ? (
                <p className="text-xs text-gray-400">No test tasks sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {candidate.testTasks.map((t) => (
                    <TestTaskCard key={t.id} task={t} onReview={handleReview} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>

      <SendTestTaskDialog
        open={showSendTest}
        onOpenChange={setShowSendTest}
        candidate={candidate}
        onSent={() => { load(); onChanged(); }}
      />
    </Sheet>
  );
}

/* ── Test Task Card (with review actions) ─────────────────────── */
function TestTaskCard({ task, onReview }: { task: TestTask; onReview: (taskId: string, decision: 'APPROVED' | 'REJECTED', notes: string) => void }) {
  const [reviewNotes, setReviewNotes] = useState('');
  const [submissionViewUrl, setSubmissionViewUrl] = useState<string | null>(null);
  const [loadingViewUrl, setLoadingViewUrl] = useState(false);

  async function openSubmission() {
    if (task.submissionUrl) { window.open(task.submissionUrl, '_blank'); return; }
    if (!task.submissionS3Key) return;
    setLoadingViewUrl(true);
    try {
      const res = await fetch(`/api/hiring/test-tasks/${task.id}/submission-url`, { credentials: 'include' });
      const data = await res.json();
      if (data.url) { setSubmissionViewUrl(data.url); window.open(data.url, '_blank'); }
    } finally {
      setLoadingViewUrl(false);
    }
  }

  const badgeColor =
    task.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    task.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
    task.status === 'SUBMITTED' ? 'bg-violet-50 text-violet-700 border-violet-200' :
    'bg-amber-50 text-amber-700 border-amber-200';

  const canReview = task.status === 'SUBMITTED' || task.status === 'IN_REVIEW';

  return (
    <div className="border border-gray-200 rounded-lg p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{task.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">Sent {new Date(task.createdAt).toLocaleDateString()}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeColor}`}>{task.status}</span>
      </div>

      {(task.submissionUrl || task.submissionS3Key) && (
        <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={openSubmission} disabled={loadingViewUrl}>
          {loadingViewUrl ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
          View Submission
        </Button>
      )}

      {task.reviewNotes && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">{task.reviewNotes}</p>
      )}

      {canReview && (
        <div className="space-y-2 pt-1">
          <Textarea placeholder="Review notes (optional, sent to candidate)" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className="min-h-[60px] text-xs" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => onReview(task.id, 'APPROVED', reviewNotes)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Hire
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-8 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={() => onReview(task.id, 'REJECTED', reviewNotes)}>
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Send Test Task Dialog ─────────────────────────────────────── */
function SendTestTaskDialog({ open, onOpenChange, candidate, onSent }: {
  open: boolean; onOpenChange: (v: boolean) => void; candidate: Candidate | null; onSent: () => void;
}) {
  const [form, setForm] = useState({ title: '', instructions: '', rawFootageUrl: '', expiresInDays: '14' });
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => { if (open) setForm({ title: '', instructions: '', rawFootageUrl: '', expiresInDays: '14' }); }, [open]);

  async function handleSend() {
    if (!candidate) return;
    if (!form.title || !form.instructions) { toast.error('Title and instructions are required'); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/hiring/candidates/${candidate.id}/send-test`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, expiresInDays: Number(form.expiresInDays) || 14, sendWhatsApp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send test task');

      if (sendWhatsApp && data.whatsapp && !data.whatsapp.configured) {
        toast.warning('Email sent. WhatsApp not sent — no provider configured yet.');
      } else {
        toast.success('Test task sent');
      }
      onOpenChange(false);
      onSent();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Send Test Task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Task title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea placeholder="Instructions *" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="min-h-[100px]" />
          <Input placeholder="Raw footage link (Drive, WeTransfer, etc.)" value={form.rawFootageUrl} onChange={(e) => setForm({ ...form, rawFootageUrl: e.target.value })} />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 whitespace-nowrap">Link expires in</span>
            <Input type="number" min={1} className="w-20" value={form.expiresInDays} onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })} />
            <span className="text-sm text-gray-500">days</span>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={sendWhatsApp} onChange={(e) => setSendWhatsApp(e.target.checked)} disabled={!candidate?.phone} />
            <MessageCircle className="h-3.5 w-3.5" />
            Also send via WhatsApp {!candidate?.phone && '(no phone on file)'}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="gap-1.5">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? 'Sending…' : 'Send Test Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
