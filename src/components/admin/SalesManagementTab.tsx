'use client';

import { useState, useEffect, Fragment } from 'react';
import {
  Search, Download, RefreshCw, ChevronDown, ChevronRight,
  Users, Mail, Phone, MessageSquare, Instagram,
  Check, Ghost, FileText, X, Loader2, Send,
  History as HistoryIcon, Link as LinkIcon, Info as InfoIcon
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SalesUser {
  id: number;
  name: string | null;
  email: string;
  image: string | null;
}

interface Lead {
  id: string;
  userId: number;
  user: SalesUser;
  name: string;
  email: string;
  socials: string;
  snapchatShow: string;
  igDm: boolean;
  dmPlatform?: string;
  meetingBooked: boolean;
  emailed: boolean;
  called: boolean;
  texted: boolean;
  notes: string;
  emailTemplate: string;
  dmAt?: string;
  meetingAt?: string;
  emailedAt?: string;
  calledAt?: string;
  textedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null, email: string) {
  if (name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

const formatToEST = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'short',
      timeStyle: 'short'
    });
  } catch { return ''; }
};

function displayName(user: SalesUser) {
  return user.name || user.email;
}

const SNAP_STYLES: Record<string, string> = {
  yes: 'bg-green-100 text-green-700 border-green-200',
  no: 'bg-red-100 text-red-700 border-red-200',
  maybe: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  '': 'bg-gray-100 text-gray-400 border-gray-200',
};

const DM_PLATFORMS: Record<string, { label: string, color: string }> = {
  instagram: { label: 'Instagram', color: 'text-pink-600 bg-pink-50' },
  facebook: { label: 'Facebook', color: 'text-blue-600 bg-blue-50' },
  linkedin: { label: 'LinkedIn', color: 'text-cyan-700 bg-cyan-50' },
  twitter: { label: 'Twitter/X', color: 'text-gray-900 bg-gray-50' },
  tiktok: { label: 'TikTok', color: 'text-black bg-gray-100' },
  other: { label: 'Other', color: 'text-gray-600 bg-gray-100' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TickBadge({ on, activeColor }: { on: boolean; activeColor: string }) {
  return (
    <span className={cn(
      'flex items-center justify-center w-6 h-6 rounded-md border mx-auto',
      on ? `${activeColor} border-transparent` : 'border-gray-200 bg-white'
    )}>
      {on
        ? <Check className="h-3.5 w-3.5" />
        : <span className="h-1.5 w-1.5 rounded-full bg-gray-200" />}
    </span>
  );
}

function PlatformBadge({ platform }: { platform?: string }) {
  if (!platform || !DM_PLATFORMS[platform]) return <span className="text-gray-300">—</span>;
  const p = DM_PLATFORMS[platform];
  return (
    <span className={cn('text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight', p.color)}>
      {p.label}
    </span>
  );
}

function ReadonlyNotesModal({ open, lead, onClose }: {
  open: boolean; lead: Lead | null; onClose: () => void;
}) {
  if (!lead) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            Notes — <span className="font-normal text-muted-foreground">{lead.name || 'Untitled Lead'}</span>
            <span className="ml-1 text-xs text-muted-foreground font-normal">by {displayName(lead.user)}</span>
          </DialogTitle>
        </DialogHeader>
        <Textarea
          value={lead.notes || '(No notes)'}
          readOnly
          rows={10}
          className="text-sm resize-none bg-gray-50 border-gray-200 text-gray-700"
        />
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReadonlyEmailModal({ open, lead, onClose }: {
  open: boolean; lead: Lead | null; onClose: () => void;
}) {
  if (!lead) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Email Template — <span className="font-normal text-muted-foreground">{lead.name || 'Untitled Lead'}</span>
            <span className="ml-1 text-xs text-muted-foreground font-normal">by {displayName(lead.user)}</span>
          </DialogTitle>
        </DialogHeader>
        <Textarea
          value={lead.emailTemplate || '(No email template set)'}
          readOnly
          rows={14}
          className="font-mono text-sm resize-none bg-gray-50 border-gray-200 text-gray-700"
        />
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SalesManagementTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>('all');
  const [notesModal, setNotesModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [emailModal, setEmailModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Fetch all leads ──
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sales-leads');
      const data = await res.json();
      if (data.ok) setLeads(data.leads);
      else toast.error('Failed to load sales data');
    } catch {
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, []);

  // ── Sales team members (unique users who have leads) ──
  const salesUsers = Array.from(
    new Map(leads.map(l => [l.userId, l.user])).values()
  );

  // ── Filter leads ──
  const filtered = leads.filter(l => {
    const matchUser = selectedUserId === 'all' || l.userId === selectedUserId;
    const q = search.toLowerCase();
    const matchSearch =
      l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.socials.toLowerCase().includes(q) ||
      displayName(l.user).toLowerCase().includes(q);
    return matchUser && matchSearch;
  });

  // ── Aggregate stats across filtered leads ──
  const stats = {
    total: filtered.length,
    contacted: filtered.filter(l => l.emailed || l.called || l.texted || l.igDm).length,
    meetings: filtered.filter(l => l.meetingBooked).length,
    snapYes: filtered.filter(l => l.snapchatShow === 'yes').length,
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const headers = ['Sales Rep', 'Name', 'Email', 'Socials', 'Snapchat Show', 'Social DM', 'Platform', 'Meeting', 'Emailed', 'Called', 'Texted', 'Notes', 'Email Template', 'DM Time', 'Meeting Time', 'Email Time', 'Call Time', 'Text Time', 'Added'];
    const rows = filtered.map(l => [
      displayName(l.user),
      l.name, l.email, l.socials, l.snapchatShow || '—',
      l.igDm ? 'Yes' : 'No', l.dmPlatform || '—',
      l.meetingBooked ? 'Yes' : 'No',
      l.emailed ? 'Yes' : 'No',
      l.called ? 'Yes' : 'No',
      l.texted ? 'Yes' : 'No',
      `"${l.notes.replace(/"/g, '""')}"`,
      `"${l.emailTemplate.replace(/"/g, '""')}"`,
      l.dmAt ? formatToEST(l.dmAt) : '—',
      l.meetingAt ? formatToEST(l.meetingAt) : '—',
      l.emailedAt ? formatToEST(l.emailedAt) : '—',
      l.calledAt ? formatToEST(l.calledAt) : '—',
      l.textedAt ? formatToEST(l.textedAt) : '—',
      formatToEST(l.createdAt),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-all-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const selectedUserObj = selectedUserId !== 'all'
    ? salesUsers.find(u => u.id === selectedUserId)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading sales data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: stats.total, color: 'text-gray-800', bg: 'bg-gray-50 border-gray-200' },
          { label: 'Contacted', value: stats.contacted, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Meetings Booked', value: stats.meetings, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Snapchat Show: Yes', value: stats.snapYes, color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4', s.bg)}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={cn('text-3xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Sales Rep Cards ────────────────────────────────────── */}
      {salesUsers.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {/* All button */}
          <button
            onClick={() => setSelectedUserId('all')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
              selectedUserId === 'all'
                ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:border-yellow-300 hover:bg-yellow-50'
            )}
          >
            <Users className="h-4 w-4" />
            All Reps
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full font-semibold',
              selectedUserId === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            )}>
              {leads.length}
            </span>
          </button>

          {/* Per-user buttons */}
          {salesUsers.map(u => {
            const count = leads.filter(l => l.userId === u.id).length;
            const active = selectedUserId === u.id;
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(active ? 'all' : u.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                  active
                    ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-yellow-300 hover:bg-yellow-50'
                )}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className={cn('text-xs', active ? 'bg-white/20 text-white' : 'bg-yellow-100 text-yellow-700')}>
                    {initials(u.name, u.email)}
                  </AvatarFallback>
                </Avatar>
                {displayName(u)}
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads, reps…"
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
          {selectedUserId !== 'all' && selectedUserObj ? ` · ${displayName(selectedUserObj)}` : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLeads} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">No sales leads yet</p>
          <p className="text-xs mt-1">Sales team members haven't added any leads yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-400 border-r border-gray-200 w-10">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-36">Sales Rep</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-40">Lead Name</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-48">Email</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-36">Socials</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-24">
                    <div className="flex items-center justify-center gap-1"><Ghost className="h-3.5 w-3.5 text-yellow-500" />Snap</div>
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-28">
                    Social DM
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-16">Meet</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-16">Email</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-16">Call</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-16">Text</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-28">Notes</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider w-24">Email Tmpl</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-muted-foreground text-sm">
                      No leads match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((lead, idx) => (
                    <Fragment key={lead.id}>
                      <tr className={cn(
                        'transition-colors group border-b border-gray-100',
                        expandedRows.has(lead.id) ? 'bg-yellow-50/50' : 'bg-white hover:bg-yellow-50/30'
                      )}>
                        {/* # */}
                        <td className="px-3 py-2.5 text-center text-xs text-gray-400 border-r border-gray-100 select-none">
                          <button onClick={() => toggleRow(lead.id)} className="hover:text-amber-600 flex flex-col items-center gap-1 w-full">
                            <ChevronRight className={cn('h-3 w-3 transition-transform', expandedRows.has(lead.id) && 'rotate-90')} />
                            <span className="text-[10px] font-mono opacity-50">{idx + 1}</span>
                          </button>
                        </td>

                        {/* Sales Rep */}
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6 flex-shrink-0">
                              <AvatarFallback className="text-xs bg-yellow-100 text-yellow-700">
                                {initials(lead.user.name, lead.user.email)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-gray-700 truncate max-w-[90px]" title={displayName(lead.user)}>
                              {displayName(lead.user)}
                            </span>
                          </div>
                        </td>

                        {/* Lead Name */}
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <span className="text-sm font-medium text-gray-800">
                            {lead.name || <span className="text-gray-300 italic">—</span>}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <span className="text-xs text-gray-600 truncate block max-w-[180px]" title={lead.email}>
                            {lead.email || <span className="text-gray-300">—</span>}
                          </span>
                        </td>

                        {/* Socials */}
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <span className="text-xs text-gray-600 truncate block max-w-[130px]" title={lead.socials}>
                            {lead.socials || <span className="text-gray-300">—</span>}
                          </span>
                        </td>

                        {/* Social DM */}
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <div className="flex flex-col items-center gap-1">
                            <TickBadge on={lead.igDm} activeColor="bg-pink-100 text-pink-600" />
                            <PlatformBadge platform={lead.dmPlatform} />
                          </div>
                        </td>

                        {/* Meeting */}
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <TickBadge on={lead.meetingBooked} activeColor="bg-green-100 text-green-600" />
                        </td>

                        {/* Emailed */}
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <TickBadge on={lead.emailed} activeColor="bg-blue-100 text-blue-600" />
                        </td>

                        {/* Called */}
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <TickBadge on={lead.called} activeColor="bg-emerald-100 text-emerald-600" />
                        </td>

                        {/* Texted */}
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <TickBadge on={lead.texted} activeColor="bg-purple-100 text-purple-600" />
                        </td>

                        {/* Notes */}
                        <td className="px-3 py-2.5 border-r border-gray-100 text-center">
                          {lead.notes ? (
                            <button
                              onClick={() => setNotesModal({ open: true, lead })}
                              className="text-[10px] px-2 py-1 rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors truncate max-w-[100px] block mx-auto"
                              title={lead.notes}
                            >
                              {lead.notes.slice(0, 18)}{lead.notes.length > 18 ? '…' : ''}
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Email Template */}
                        <td className="px-3 py-2.5 text-center">
                          {lead.emailTemplate ? (
                            <button
                              onClick={() => setEmailModal({ open: true, lead })}
                              className="text-[10px] px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1 mx-auto"
                            >
                              <Mail className="h-3 w-3" />View
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>

                      {/* ── Expanded View ── */}
                      {expandedRows.has(lead.id) && (
                        <tr className="bg-yellow-50/20">
                          <td colSpan={13} className="px-6 py-4 border-b border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Metadata */}
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <HistoryIcon className="h-3 w-3" /> Timestamps
                                  </p>
                                  <div className="bg-white p-3 rounded-lg border border-yellow-200/50 space-y-2">
                                    <p className="text-xs flex justify-between">
                                      <span className="text-gray-400">Created:</span>
                                      <span className="font-medium text-gray-600">{formatToEST(lead.createdAt)}</span>
                                    </p>
                                    <p className="text-xs flex justify-between">
                                      <span className="text-gray-400">Last Sync:</span>
                                      <span className="font-medium text-gray-600">{formatToEST(lead.updatedAt)}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <HistoryIcon className="h-3 w-3" /> Contact Timeline
                                  </p>
                                  <div className="bg-white p-3 rounded-lg border border-yellow-200/50 space-y-2">
                                    {!lead.dmAt && !lead.meetingAt && !lead.emailedAt && !lead.calledAt && !lead.textedAt && (
                                      <p className="text-[10px] text-gray-300 italic text-center py-2">No contact recorded</p>
                                    )}
                                    {lead.dmAt && (
                                      <p className="text-[10px] flex justify-between">
                                        <span className="text-gray-400">Social DM:</span>
                                        <span className="font-medium text-pink-600">{formatToEST(lead.dmAt)}</span>
                                      </p>
                                    )}
                                    {lead.meetingAt && (
                                      <p className="text-[10px] flex justify-between">
                                        <span className="text-gray-400">Meeting:</span>
                                        <span className="font-medium text-green-600">{formatToEST(lead.meetingAt)}</span>
                                      </p>
                                    )}
                                    {lead.emailedAt && (
                                      <p className="text-[10px] flex justify-between">
                                        <span className="text-gray-400">Email:</span>
                                        <span className="font-medium text-blue-600">{formatToEST(lead.emailedAt)}</span>
                                      </p>
                                    )}
                                    {lead.calledAt && (
                                      <p className="text-[10px] flex justify-between">
                                        <span className="text-gray-400">Call:</span>
                                        <span className="font-medium text-emerald-600">{formatToEST(lead.calledAt)}</span>
                                      </p>
                                    )}
                                    {lead.textedAt && (
                                      <p className="text-[10px] flex justify-between">
                                        <span className="text-gray-400">Text:</span>
                                        <span className="font-medium text-purple-600">{formatToEST(lead.textedAt)}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <LinkIcon className="h-3 w-3" /> Context
                                  </p>
                                  <div className="bg-white p-3 rounded-lg border border-yellow-200/50 text-xs text-gray-600 space-y-1">
                                    <p><strong>Platform:</strong> {lead.dmPlatform ? DM_PLATFORMS[lead.dmPlatform]?.label : 'None'}</p>
                                    <p><strong>Snapchat:</strong> {lead.snapchatShow || 'N/A'}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Content */}
                              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <InfoIcon className="h-3 w-3" /> Lead Notes
                                  </p>
                                  <div className="bg-white p-3 rounded-lg border border-yellow-200/50 min-h-[100px] text-xs text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner italic">
                                    {lead.notes || '(No notes provided by rep)'}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <Mail className="h-3 w-3" /> Email Template
                                  </p>
                                  <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 min-h-[100px] text-xs text-blue-900/70 whitespace-pre-wrap font-mono shadow-inner leading-relaxed">
                                    {lead.emailTemplate || '(No custom template)'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────── */}
      <ReadonlyNotesModal
        open={notesModal.open}
        lead={notesModal.lead}
        onClose={() => setNotesModal({ open: false, lead: null })}
      />
      <ReadonlyEmailModal
        open={emailModal.open}
        lead={emailModal.lead}
        onClose={() => setEmailModal({ open: false, lead: null })}
      />
    </div>
  );
}
