'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Download,
  Search,
  ChevronDown,
  Mail,
  Phone,
  MessageSquare,
  Instagram,
  FileText,
  X,
  Check,
  Ghost,
  Loader2,
  UploadCloud,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type SnapchatShow = 'yes' | 'no' | 'maybe' | '';

interface Lead {
  id: string;            // real DB id once committed, '__tmp_xxx' while draft
  name: string;
  email: string;
  socials: string;
  snapchatShow: SnapchatShow;
  igDm: boolean;
  meetingBooked: boolean;
  emailed: boolean;
  called: boolean;
  texted: boolean;
  notes: string;
  emailTemplate: string;
  // UI state flags
  _saved: boolean;       // true = exists in DB
  _dirty: boolean;       // true = has unsaved local edits since last commit
  _committing: boolean;  // true = POST/PATCH in-flight
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tempId() {
  return '__tmp_' + Math.random().toString(36).slice(2, 10);
}

function emptyDraftLead(): Lead {
  return {
    id: tempId(),
    name: '', email: '', socials: '', snapchatShow: '',
    igDm: false, meetingBooked: false, emailed: false,
    called: false, texted: false, notes: '', emailTemplate: '',
    _saved: false, _dirty: false, _committing: false,
  };
}

function dbLeadToLocal(l: any): Lead {
  return {
    id: l.id, name: l.name, email: l.email, socials: l.socials,
    snapchatShow: l.snapchatShow as SnapchatShow,
    igDm: l.igDm, meetingBooked: l.meetingBooked, emailed: l.emailed,
    called: l.called, texted: l.texted, notes: l.notes, emailTemplate: l.emailTemplate,
    _saved: true, _dirty: false, _committing: false,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SNAPCHAT_OPTIONS: { value: SnapchatShow; label: string; color: string }[] = [
  { value: 'yes',   label: 'Yes',   color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'no',    label: 'No',    color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'maybe', label: 'Maybe', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: '',      label: '—',     color: 'bg-gray-50 text-gray-400 border-gray-200' },
];

const EMAIL_TEMPLATES = [
  {
    label: 'Introduction',
    body: `Hi [Name],\n\nI hope this message finds you well! My name is [Your Name] from E8 Productions.\n\nWe specialise in social media content, video production, and brand growth. I'd love to explore how we can help [Company] elevate its online presence.\n\nWould you be open to a quick 15-minute call this week?\n\nLooking forward to connecting!\n\nBest,\n[Your Name]`,
  },
  {
    label: 'Follow-up',
    body: `Hi [Name],\n\nJust following up on my previous message — I wanted to make sure it didn't get lost in your inbox!\n\nWe've recently helped brands like yours grow their engagement by 3× in just 90 days. I'd love to share how.\n\nAre you available for a quick chat this week?\n\nBest,\n[Your Name]`,
  },
  {
    label: 'Snapchat Show Pitch',
    body: `Hi [Name],\n\nI came across your brand and immediately thought you'd be a perfect fit for a Snapchat Show collaboration.\n\nSnapchat Shows are a powerful way to reach millions of new viewers authentically. We handle the full production — all you need to do is show up.\n\nWould love to walk you through what that looks like. When are you free for a call?\n\nBest,\n[Your Name]`,
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TickCell({
  checked, onChange, icon: Icon, activeColor, disabled,
}: {
  checked: boolean; onChange: (v: boolean) => void;
  icon: React.ElementType; activeColor: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded-md border transition-all duration-150 mx-auto',
        checked
          ? `${activeColor} border-transparent shadow-sm`
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {checked
        ? <Check className="h-3.5 w-3.5" />
        : <Icon className="h-3.5 w-3.5 text-gray-300" />}
    </button>
  );
}

function SnapchatCell({ value, onChange }: {
  value: SnapchatShow; onChange: (v: SnapchatShow) => void;
}) {
  const current = SNAPCHAT_OPTIONS.find(o => o.value === value) ?? SNAPCHAT_OPTIONS[3];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium w-full justify-center transition-colors',
          current.color
        )}>
          {current.label}
          <ChevronDown className="h-3 w-3 opacity-60 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-28">
        {SNAPCHAT_OPTIONS.map(opt => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn('text-xs font-medium', opt.color)}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmailTemplateModal({ open, lead, onClose, onSave }: {
  open: boolean; lead: Lead | null;
  onClose: () => void; onSave: (id: string, body: string) => void;
}) {
  const [body, setBody] = useState('');
  useEffect(() => { if (lead) setBody(lead.emailTemplate); }, [lead]);
  if (!lead) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Email Template — {lead.name || 'Untitled Lead'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {EMAIL_TEMPLATES.map(t => (
            <Button key={t.label} variant="outline" size="sm" className="text-xs" onClick={() => setBody(t.body)}>
              {t.label}
            </Button>
          ))}
        </div>
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={14}
          className="font-mono text-sm resize-none"
          placeholder="Write or paste your email template here…"
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onSave(lead.id, body); onClose(); }}>Save Template</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotesModal({ open, lead, onClose, onSave }: {
  open: boolean; lead: Lead | null;
  onClose: () => void; onSave: (id: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState('');
  useEffect(() => { if (lead) setNotes(lead.notes); }, [lead]);
  if (!lead) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            Notes — {lead.name || 'Untitled Lead'}
          </DialogTitle>
        </DialogHeader>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={10}
          className="text-sm resize-none"
          placeholder="Add any notes about this lead…"
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onSave(lead.id, notes); onClose(); }}>Save Notes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SalesDashboard() {
  const [leads, setLeads] = useState<Lead[]>([emptyDraftLead()]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [emailModal, setEmailModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [notesModal, setNotesModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });

  // ── Load saved leads from DB on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/sales-leads');
        const data = await res.json();
        if (data.ok) {
          const saved = data.leads.map(dbLeadToLocal);
          // Start with saved rows + one fresh draft at the bottom
          setLeads(saved.length > 0 ? [...saved, emptyDraftLead()] : [emptyDraftLead()]);
        }
      } catch {
        toast.error('Failed to load leads');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Update a field locally (marks row dirty if already saved) ──
  const updateLead = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads(prev => prev.map(l =>
      l.id === id
        ? { ...l, ...patch, _dirty: l._saved ? true : l._dirty }
        : l
    ));
  }, []);

  // ── Add a new blank draft row ──
  const addRow = useCallback(() => {
    setLeads(prev => [...prev, emptyDraftLead()]);
  }, []);

  // ── Commit a row to the DB (the "+" button) ──
  const commitRow = useCallback(async (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    // Mark as committing
    setLeads(prev => prev.map(l => l.id === id ? { ...l, _committing: true } : l));

    try {
      if (!lead._saved) {
        // New row → POST
        const res = await fetch('/api/sales-leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: lead.name, email: lead.email, socials: lead.socials,
            snapchatShow: lead.snapchatShow, igDm: lead.igDm,
            meetingBooked: lead.meetingBooked, emailed: lead.emailed,
            called: lead.called, texted: lead.texted,
            notes: lead.notes, emailTemplate: lead.emailTemplate,
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || 'Failed');
        // Replace temp id with real DB id, mark saved
        setLeads(prev => prev.map(l =>
          l.id === id
            ? { ...l, id: data.lead.id, _saved: true, _dirty: false, _committing: false }
            : l
        ));
        toast.success('Lead saved to database');
      } else {
        // Existing row → PATCH
        const res = await fetch(`/api/sales-leads/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: lead.name, email: lead.email, socials: lead.socials,
            snapchatShow: lead.snapchatShow, igDm: lead.igDm,
            meetingBooked: lead.meetingBooked, emailed: lead.emailed,
            called: lead.called, texted: lead.texted,
            notes: lead.notes, emailTemplate: lead.emailTemplate,
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || 'Failed');
        setLeads(prev => prev.map(l =>
          l.id === id ? { ...l, _dirty: false, _committing: false } : l
        ));
        toast.success('Changes synced');
      }
    } catch (err: any) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, _committing: false } : l));
      toast.error(err.message || 'Failed to save');
    }
  }, [leads]);

  // ── Delete a row ──
  const deleteRow = useCallback(async (id: string) => {
    const lead = leads.find(l => l.id === id);
    setLeads(prev => {
      const next = prev.filter(l => l.id !== id);
      // Always keep at least one draft row
      const hasDraft = next.some(l => !l._saved);
      return hasDraft || next.length === 0 ? (next.length === 0 ? [emptyDraftLead()] : next) : next;
    });

    if (!lead?._saved) return; // draft-only, nothing in DB
    try {
      await fetch(`/api/sales-leads/${id}`, { method: 'DELETE' });
      toast.success('Lead deleted');
    } catch {
      toast.error('Failed to delete lead');
    }
  }, [leads]);

  // ── Export CSV ──
  const exportCSV = () => {
    const saved = leads.filter(l => l._saved);
    const headers = ['Name','Email','Socials','Snapchat Show','IG DM','Meeting','Emailed','Called','Texted','Notes','Email Template'];
    const rows = saved.map(l => [
      l.name, l.email, l.socials, l.snapchatShow || '—',
      l.igDm?'Yes':'No', l.meetingBooked?'Yes':'No',
      l.emailed?'Yes':'No', l.called?'Yes':'No', l.texted?'Yes':'No',
      `"${l.notes.replace(/"/g,'""')}"`,
      `"${l.emailTemplate.replace(/"/g,'""')}"`,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported saved leads to CSV');
  };

  // ── Filtered rows ──
  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.socials.toLowerCase().includes(q);
  });

  // ── Stats (saved only) ──
  const saved = leads.filter(l => l._saved);
  const stats = {
    total: saved.length,
    contacted: saved.filter(l => l.emailed || l.called || l.texted || l.igDm).length,
    meetings: saved.filter(l => l.meetingBooked).length,
    snapYes: saved.filter(l => l.snapchatShow === 'yes').length,
  };

  const draftCount = leads.filter(l => !l._saved).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading your leads…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Sales Tracker</h1>
          <p className="text-muted-foreground mt-1 text-base">
            Fill in a row, then hit <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold"><Plus className="h-3 w-3" />Save</span> to submit it to the admin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={addRow} className="gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white">
            <Plus className="h-4 w-4" />
            Add Row
          </Button>
        </div>
      </div>

      {/* ── Stats (saved leads only) ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Saved Leads',        value: stats.total,     color: 'text-gray-800',   bg: 'bg-gray-50 border-gray-200' },
          { label: 'Contacted',          value: stats.contacted, color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
          { label: 'Meetings Booked',    value: stats.meetings,  color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
          { label: 'Snapchat Show: Yes', value: stats.snapYes,   color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4 flex flex-col items-center justify-center text-center', s.bg)}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={cn('text-3xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Draft banner ────────────────────────────────────────── */}
      {draftCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <UploadCloud className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{draftCount}</strong> unsaved draft row{draftCount !== 1 ? 's' : ''} — hit the <strong className="text-green-600">+</strong> button on each row to submit to admin
          </span>
        </div>
      )}

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filtered.length} row{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Spreadsheet ────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-400 border-r border-gray-200 w-10">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-44">Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-52">Email</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-40">Socials</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-28">
                  <div className="flex items-center justify-center gap-1"><Ghost className="h-3.5 w-3.5 text-yellow-500" />Snap Show</div>
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-24">
                  <div className="flex items-center justify-center gap-1"><Instagram className="h-3.5 w-3.5 text-pink-500" />IG DM</div>
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-24">Meeting</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-24">
                  <div className="flex items-center justify-center gap-1"><Mail className="h-3.5 w-3.5 text-blue-500" />Emailed</div>
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-24">
                  <div className="flex items-center justify-center gap-1"><Phone className="h-3.5 w-3.5 text-green-500" />Called</div>
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-24">
                  <div className="flex items-center justify-center gap-1"><MessageSquare className="h-3.5 w-3.5 text-purple-500" />Texted</div>
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-36">Notes</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-28">Email Tmpl</th>
                {/* Action column — wider to fit both buttons */}
                <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-400 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-muted-foreground text-sm">
                    {search ? 'No leads match your search.' : 'No rows yet — click "Add Row" to get started.'}
                  </td>
                </tr>
              ) : (
                filtered.map((lead, idx) => {
                  const isDraft    = !lead._saved;
                  const isDirty    = lead._saved && lead._dirty;
                  const isSaved    = lead._saved && !lead._dirty;
                  const isWorking  = lead._committing;

                  return (
                    <tr
                      key={lead.id}
                      className={cn(
                        'group transition-colors',
                        isDraft  && 'bg-amber-50/60 hover:bg-amber-50',
                        isDirty  && 'bg-blue-50/40 hover:bg-blue-50/60',
                        isSaved  && 'bg-white hover:bg-yellow-50/30',
                      )}
                    >
                      {/* Row # / status dot */}
                      <td className="px-3 py-2 text-center text-xs border-r border-gray-100 select-none">
                        {isWorking
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-gray-400" />
                          : isSaved
                            ? <span className="text-gray-400">{idx + 1}</span>
                            : isDirty
                              ? <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mx-auto" title="Unsaved edits" />
                              : <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mx-auto" title="Draft" />}
                      </td>

                      {/* Name */}
                      <td className="border-r border-gray-100 p-0">
                        <input
                          value={lead.name}
                          onChange={e => updateLead(lead.id, { name: e.target.value })}
                          placeholder="Full name"
                          className="w-full h-full px-3 py-2 bg-transparent outline-none text-sm placeholder:text-gray-300 focus:bg-yellow-50/60"
                        />
                      </td>
                      {/* Email */}
                      <td className="border-r border-gray-100 p-0">
                        <input
                          value={lead.email}
                          onChange={e => updateLead(lead.id, { email: e.target.value })}
                          placeholder="email@example.com"
                          type="email"
                          className="w-full h-full px-3 py-2 bg-transparent outline-none text-sm placeholder:text-gray-300 focus:bg-yellow-50/60"
                        />
                      </td>
                      {/* Socials */}
                      <td className="border-r border-gray-100 p-0">
                        <input
                          value={lead.socials}
                          onChange={e => updateLead(lead.id, { socials: e.target.value })}
                          placeholder="@handle / url"
                          className="w-full h-full px-3 py-2 bg-transparent outline-none text-sm placeholder:text-gray-300 focus:bg-yellow-50/60"
                        />
                      </td>
                      {/* Snapchat */}
                      <td className="border-r border-gray-100 px-2 py-1.5">
                        <SnapchatCell value={lead.snapchatShow} onChange={v => updateLead(lead.id, { snapchatShow: v })} />
                      </td>
                      {/* IG DM */}
                      <td className="border-r border-gray-100 px-2 py-1.5">
                        <TickCell checked={lead.igDm} onChange={v => updateLead(lead.id, { igDm: v })} icon={Instagram} activeColor="bg-pink-100 text-pink-600" />
                      </td>
                      {/* Meeting */}
                      <td className="border-r border-gray-100 px-2 py-1.5">
                        <TickCell checked={lead.meetingBooked} onChange={v => updateLead(lead.id, { meetingBooked: v })} icon={Check} activeColor="bg-green-100 text-green-600" />
                      </td>
                      {/* Emailed */}
                      <td className="border-r border-gray-100 px-2 py-1.5">
                        <TickCell checked={lead.emailed} onChange={v => updateLead(lead.id, { emailed: v })} icon={Mail} activeColor="bg-blue-100 text-blue-600" />
                      </td>
                      {/* Called */}
                      <td className="border-r border-gray-100 px-2 py-1.5">
                        <TickCell checked={lead.called} onChange={v => updateLead(lead.id, { called: v })} icon={Phone} activeColor="bg-emerald-100 text-emerald-600" />
                      </td>
                      {/* Texted */}
                      <td className="border-r border-gray-100 px-2 py-1.5">
                        <TickCell checked={lead.texted} onChange={v => updateLead(lead.id, { texted: v })} icon={MessageSquare} activeColor="bg-purple-100 text-purple-600" />
                      </td>
                      {/* Notes */}
                      <td className="border-r border-gray-100 px-2 py-1.5">
                        <button
                          onClick={() => setNotesModal({ open: true, lead })}
                          className={cn(
                            'w-full text-left text-xs px-2 py-1.5 rounded-md border transition-colors truncate max-w-[130px]',
                            lead.notes
                              ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                              : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'
                          )}
                          title={lead.notes || 'Add notes'}
                        >
                          {lead.notes ? lead.notes.slice(0, 28) + (lead.notes.length > 28 ? '…' : '') : '+ Add notes'}
                        </button>
                      </td>
                      {/* Email Template */}
                      <td className="border-r border-gray-100 px-2 py-1.5">
                        <button
                          onClick={() => setEmailModal({ open: true, lead })}
                          className={cn(
                            'w-full text-xs px-2 py-1.5 rounded-md border transition-colors flex items-center justify-center gap-1',
                            lead.emailTemplate
                              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                              : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'
                          )}
                        >
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {lead.emailTemplate ? 'Edit' : 'Add'}
                        </button>
                      </td>

                      {/* ── Action buttons: [+/sync] [delete] ── */}
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-center gap-1">

                          {/* Commit / re-sync button */}
                          {isWorking ? (
                            <span className="p-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                            </span>
                          ) : isSaved ? (
                            // Saved + no dirty edits — show faint tick
                            <span
                              className="p-1.5 rounded-md text-green-500"
                              title="Saved"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            // Draft OR dirty — show + / sync button
                            <button
                              onClick={() => commitRow(lead.id)}
                              title={isDirty ? 'Sync changes to admin' : 'Save to database'}
                              className={cn(
                                'p-1.5 rounded-md border transition-all font-bold',
                                isDirty
                                  ? 'border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100'
                                  : 'border-green-300 bg-green-50 text-green-600 hover:bg-green-100'
                              )}
                            >
                              {isDirty
                                ? <RefreshCw className="h-3.5 w-3.5" />
                                : <Plus className="h-3.5 w-3.5" />}
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => deleteRow(lead.id)}
                            className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-between">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add row
          </button>
          <span className="text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />Draft
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 ml-3 mr-1" />Edited
            <Check className="inline h-3 w-3 text-green-500 ml-3 mr-1" />Saved
          </span>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}
      <EmailTemplateModal
        open={emailModal.open}
        lead={emailModal.lead}
        onClose={() => setEmailModal({ open: false, lead: null })}
        onSave={(id, body) => { updateLead(id, { emailTemplate: body }); toast.success('Template saved — hit + to sync'); }}
      />
      <NotesModal
        open={notesModal.open}
        lead={notesModal.lead}
        onClose={() => setNotesModal({ open: false, lead: null })}
        onSave={(id, notes) => { updateLead(id, { notes }); toast.success('Notes saved — hit + to sync'); }}
      />
    </div>
  );
}
