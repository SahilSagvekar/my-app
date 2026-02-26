'use client';

import { useState, useEffect, Fragment, useCallback } from 'react';
import {
  Search, Download, RefreshCw, ChevronDown, ChevronRight,
  Users, Mail, Phone, MessageSquare, Instagram,
  Check, Ghost, FileText, X, Loader2, Send,
  History as HistoryIcon, Link as LinkIcon, Info as InfoIcon,
  TrendingUp, DollarSign, Clock, BadgePercent, Wallet,
  CheckCircle, XCircle, ArrowRight, ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
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
import { SalesDashboard } from '../dashboards/SalesDashboard';

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
  instagram: boolean;
  facebook: boolean;
  linkedin: boolean;
  twitter: boolean;
  tiktok: boolean;
  priority: string;
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

// ─── Commission Types ──────────────────────────────────────────────────────────

interface CommissionUser {
  id: number;
  name: string | null;
  email: string;
  image: string | null;
}

interface CommissionLead {
  id: string;
  name: string;
  company: string;
  status: string;
  value: number | null;
}

interface Commission {
  id: string;
  salesUserId: number;
  leadId: string;
  clientName: string;
  dealValue: string;
  commissionRate: string;
  commissionAmt: string;
  month: string;
  status: string;
  paidAt: string | null;
  approvedAt: string | null;
  approvedBy: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user: CommissionUser;
  lead: CommissionLead;
}

interface CommissionSummary {
  totalEarned: number;
  totalPending: number;
  totalApproved: number;
  thisMonth: number;
  commissionRate: number;
}

const COMMISSION_STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string; icon: any }> = {
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Pending', icon: Clock },
  APPROVED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Approved', icon: CheckCircle },
  PAID: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Paid', icon: Check },
  CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Cancelled', icon: XCircle },
};

// ─── Commission Management Sub-Component ──────────────────────────────────────

function CommissionManagement() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({ totalEarned: 0, totalPending: 0, totalApproved: 0, thisMonth: 0, commissionRate: 0.15 });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCommissions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/affiliate/commissions?all=true');
      const data = await res.json();
      if (data.ok) {
        setCommissions(data.commissions);
        setSummary(data.summary);
      } else {
        toast.error(data.message || 'Failed to load commissions');
      }
    } catch {
      toast.error('Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);

  const updateCommissionStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/affiliate/commissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Commission ${newStatus.toLowerCase()} successfully`);
        fetchCommissions();
      } else {
        toast.error(data.message || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update commission');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatCurrency = (amt: number | string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(typeof amt === 'string' ? parseFloat(amt) : amt);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const filtered = commissions.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchSearch =
      (c.user?.name || '').toLowerCase().includes(q) ||
      (c.user?.email || '').toLowerCase().includes(q) ||
      (c.lead?.name || '').toLowerCase().includes(q) ||
      (c.lead?.company || '').toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
          <p className="text-sm text-gray-400">Loading commissions…</p>
        </div>
      </div>
    );
  }

  const pendingCount = commissions.filter(c => c.status === 'PENDING').length;
  const approvedCount = commissions.filter(c => c.status === 'APPROVED').length;

  return (
    <div className="space-y-6">
      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Paid Out', value: formatCurrency(summary.totalEarned), color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: Wallet },
          { label: 'Pending Approval', value: formatCurrency(summary.totalPending), color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock, badge: pendingCount > 0 ? pendingCount : null },
          { label: 'Approved (Unpaid)', value: formatCurrency(summary.totalApproved), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: CheckCircle, badge: approvedCount > 0 ? approvedCount : null },
          { label: 'This Month', value: formatCurrency(summary.thisMonth), color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: TrendingUp },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4 relative', s.bg)}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={cn('h-4 w-4', s.color)} />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
            </div>
            <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
            {(s as any).badge && (
              <span className="absolute top-2 right-2 min-w-[20px] h-5 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5">
                {(s as any).badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by rep, lead, company…"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex bg-gray-100/50 p-1 rounded-lg gap-0.5">
          {(['all', 'PENDING', 'APPROVED', 'PAID', 'CANCELLED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 text-[11px] font-bold rounded-md transition-all uppercase tracking-wider',
                statusFilter === s ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {filtered.length} commission{filtered.length !== 1 ? 's' : ''}
        </span>
        <Button variant="outline" size="sm" onClick={fetchCommissions} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* ── Table ── */}
      {commissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">No commissions yet</p>
          <p className="text-xs mt-1">When sales reps close deals (mark leads as "Won"), commissions will appear here.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto no-scrollbar">
          <div className="min-w-max">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sales Rep</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lead / Client</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Deal Value</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rate</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Commission</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Month</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                      No commissions match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => {
                    const style = COMMISSION_STATUS_STYLES[c.status] || COMMISSION_STATUS_STYLES.PENDING;
                    const StatusIcon = style.icon;
                    const isUpdating = updatingId === c.id;

                    return (
                      <tr key={c.id} className="bg-white hover:bg-yellow-50/30 transition-colors group">
                        {/* Sales Rep */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6 flex-shrink-0">
                              <AvatarFallback className="text-xs bg-yellow-100 text-yellow-700">
                                {initials(c.user?.name, c.user?.email || '?')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">
                              {c.user?.name || c.user?.email || 'Unknown'}
                            </span>
                          </div>
                        </td>

                        {/* Lead / Client */}
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-800">{c.lead?.name || c.clientName || '—'}</p>
                          {(c.lead?.company || c.clientName) && (
                            <p className="text-[11px] text-gray-400">{c.lead?.company || c.clientName}</p>
                          )}
                        </td>

                        {/* Deal Value */}
                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                          {formatCurrency(c.dealValue)}
                        </td>

                        {/* Rate */}
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                            <BadgePercent className="h-3 w-3" />
                            {(parseFloat(c.commissionRate) * 100).toFixed(0)}%
                          </span>
                        </td>

                        {/* Commission */}
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-emerald-600 text-[14px]">
                            {formatCurrency(c.commissionAmt)}
                          </span>
                        </td>

                        {/* Month */}
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {new Date(c.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border',
                            style.bg, style.text, style.border
                          )}>
                            <StatusIcon className="h-3 w-3" />
                            {style.label}
                          </span>
                          {c.paidAt && (
                            <p className="text-[10px] text-emerald-500 mt-0.5">Paid {formatDate(c.paidAt)}</p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            ) : (
                              <>
                                {c.status === 'PENDING' && (
                                  <>
                                    <button
                                      onClick={() => updateCommissionStatus(c.id, 'APPROVED')}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                                      title="Approve this commission"
                                    >
                                      <Check className="h-3 w-3" /> Approve
                                    </button>
                                    <button
                                      onClick={() => updateCommissionStatus(c.id, 'CANCELLED')}
                                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
                                      title="Cancel this commission"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                                {c.status === 'APPROVED' && (
                                  <button
                                    onClick={() => updateCommissionStatus(c.id, 'PAID')}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                    title="Mark as paid"
                                  >
                                    <DollarSign className="h-3 w-3" /> Mark Paid
                                  </button>
                                )}
                                {c.status === 'PAID' && (
                                  <span className="text-[10px] text-gray-400">Completed</span>
                                )}
                                {c.status === 'CANCELLED' && (
                                  <button
                                    onClick={() => updateCommissionStatus(c.id, 'PENDING')}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                                    title="Restore to pending"
                                  >
                                    <RefreshCw className="h-3 w-3" /> Restore
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SalesManagementTab() {
  const { user, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>('all');
  const [notesModal, setNotesModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [emailModal, setEmailModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'team' | 'personal' | 'commissions'>('team');

  // ── Role Authorization Check ──
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm text-center px-8">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <ShieldCheck className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
          The Sales Management portal is strictly for administrators. 
          Your current role (<span className="font-bold text-gray-700 capitalize">{user?.role || 'Guest'}</span>) 
          does not have permission to view team sales data or sensitive commission structures.
        </p>
        <div className="mt-8">
          <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard'}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

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
    highPriority: filtered.filter(l => l.priority === 'high').length,
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const headers = ['Sales Rep', 'Name', 'Email', 'Socials', 'Priority', 'Social DM', 'Platform', 'Meeting', 'Emailed', 'Called', 'Texted', 'Notes', 'Email Template', 'DM Time', 'Meeting Time', 'Email Time', 'Call Time', 'Text Time', 'Added'];
    const rows = filtered.map(l => [
      displayName(l.user),
      l.name, l.email, l.socials, l.priority || '—',
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
      <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex bg-gray-100/50 p-1 rounded-lg">
          <button
            onClick={() => setView('team')}
            className={cn(
              "px-6 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-wider flex items-center gap-2",
              view === 'team' ? "bg-white text-yellow-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Team Overview
          </button>
          <button
            onClick={() => setView('personal')}
            className={cn(
              "px-6 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-wider flex items-center gap-2",
              view === 'personal' ? "bg-white text-yellow-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            My Personal Sheet
          </button>
          <button
            onClick={() => setView('commissions')}
            className={cn(
              "px-6 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-wider flex items-center gap-2",
              view === 'commissions' ? "bg-white text-yellow-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Commissions
          </button>
        </div>
        {view === 'team' && (
          <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2 border-dashed">
            <Download className="h-4 w-4" />
            Export Team Data
          </Button>
        )}
      </div>

      {view === 'personal' ? (
        <SalesDashboard />
      ) : view === 'commissions' ? (
        <CommissionManagement />
      ) : (
        <>
          {/* Previous Team Overview Content */}
          <div className="space-y-6">

            {/* ── Stats ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Leads', value: stats.total, color: 'text-gray-800', bg: 'bg-gray-50 border-gray-200' },
                { label: 'Contacted', value: stats.contacted, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                { label: 'Meetings Booked', value: stats.meetings, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                { label: 'High Priority', value: stats.highPriority, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
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
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto no-scrollbar">
                <div className="min-w-max">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-400 border-r border-gray-200 w-10">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-36">Sales Rep</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-40">Lead Name</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-48">Email</th>
                        <th className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 w-20">Insta</th>
                        <th className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 w-20">FB</th>
                        <th className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 w-20">LI</th>
                        <th className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 w-20">X/TW</th>
                        <th className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 w-20">TikTok</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-40">Handles</th>
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

                              {/* Social Checkboxes */}
                              <td className="px-2 py-2.5 border-r border-gray-100 bg-gray-50/20">
                                <TickBadge on={lead.instagram} activeColor="bg-pink-100 text-pink-600" />
                              </td>
                              <td className="px-2 py-2.5 border-r border-gray-100 bg-gray-50/20">
                                <TickBadge on={lead.facebook} activeColor="bg-blue-100 text-blue-600" />
                              </td>
                              <td className="px-2 py-2.5 border-r border-gray-100 bg-gray-50/20">
                                <TickBadge on={lead.linkedin} activeColor="bg-cyan-100 text-cyan-700" />
                              </td>
                              <td className="px-2 py-2.5 border-r border-gray-100 bg-gray-50/20">
                                <TickBadge on={lead.twitter} activeColor="bg-gray-100 text-gray-900" />
                              </td>
                              <td className="px-2 py-2.5 border-r border-gray-100 bg-gray-50/20">
                                <TickBadge on={lead.tiktok} activeColor="bg-gray-200 text-black" />
                              </td>
                              
                              {/* Social Handles */}
                              <td className="px-3 py-2.5 border-r border-gray-100">
                                <span className="text-xs text-gray-600 truncate block max-w-[150px]" title={lead.socials}>
                                  {lead.socials || <span className="text-gray-300">—</span>}
                                </span>
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
                                          <p><strong>Priority:</strong> {lead.priority ? lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1) : 'N/A'}</p>
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
        </>
      )}
    </div>
  );
}
