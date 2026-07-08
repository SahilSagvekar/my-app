'use client';

import { useState, useEffect, Fragment, useCallback } from 'react';
import {
  Search, Download, RefreshCw, ChevronDown, ChevronRight,
  Users, Mail, Phone, MessageSquare, Instagram,
  Check, Ghost, FileText, X, Loader2, Send,
  TrendingUp, DollarSign, Clock, BadgePercent,
  CheckCircle, XCircle, ArrowRight, ShieldCheck, UserCheck,
  UserPlus, Shuffle,
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
import { SalesDashboard, LeadProfileDrawer, MassEmailModal } from '../dashboards/SalesDashboard';
import { ConvertLeadDialog } from '../sales/ConvertLeadDialog';
import { SalesManagerPermissionsPanel } from './SalesManagerPermissionsPanel';
import { SalesPipelineToolbar } from '../dashboards/sales/SalesPipelineToolbar';

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
  company: string;
  email: string;
  phone: string;
  profileUrl: string;
  postUrl: string;
  status: string;
  source: string;
  value: number | null;
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
  metadata?: Record<string, any>;
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: 'Total Paid Out', value: formatCurrency(summary.totalEarned), color: 'text-[#037F4C]', filter: 'PAID' as const },
          { label: 'Pending Approval', value: formatCurrency(summary.totalPending), color: 'text-[#FDAB3D]', badge: pendingCount > 0 ? pendingCount : null, filter: 'PENDING' as const },
          { label: 'Approved (Unpaid)', value: formatCurrency(summary.totalApproved), color: 'text-[#0073EA]', badge: approvedCount > 0 ? approvedCount : null, filter: 'APPROVED' as const },
          { label: 'This Month', value: formatCurrency(summary.thisMonth), color: 'text-[#A25DDC]', filter: null },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => s.filter && setStatusFilter(prev => prev === s.filter ? 'all' : s.filter!)}
            className={cn('rounded-[14px] border border-gray-200 bg-white px-5 py-4.5 relative flex flex-col items-center justify-center text-center transition-colors', s.filter ? 'cursor-pointer hover:border-gray-300' : 'cursor-default')}
          >
            <p className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{s.label}</p>
            <p className={cn('text-[28px] font-extrabold leading-none', s.color)}>{s.value}</p>
            {(s as any).badge && (
              <span className="absolute top-2.5 right-2.5 min-w-[20px] h-5 flex items-center justify-center text-[10px] font-bold text-white bg-[#E2445C] rounded-full px-1.5">
                {(s as any).badge}
              </span>
            )}
          </button>
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
          {(['all', 'PENDING', 'APPROVED', 'PAID', 'CANCELLED'] as const).map(s => {
            const activeColors: Record<string, string> = {
              all: 'bg-white text-gray-700 shadow-sm',
              PENDING: 'bg-white text-amber-600 shadow-sm',
              APPROVED: 'bg-white text-blue-600 shadow-sm',
              PAID: 'bg-white text-emerald-600 shadow-sm',
              CANCELLED: 'bg-white text-red-600 shadow-sm',
            };
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1 text-[11px] font-bold rounded-md transition-all uppercase tracking-wider',
                  statusFilter === s ? activeColors[s] : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {s === 'all' ? 'All' : s}
              </button>
            );
          })}
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
        <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
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
                            {(() => { const raw = parseFloat(c.commissionRate); return (raw > 1 ? raw : raw * 100).toFixed(0) + '%'; })()}
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
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent rounded-r-xl" />
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
  const [convertModal, setConvertModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [massEmailModal, setMassEmailModal] = useState(false);
  const [view, setView] = useState<'team' | 'personal' | 'commissions' | 'permissions'>('team');

  // Assign leads state
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; leadIds: string[] }>({ open: false, leadIds: [] });
  const [salesReps, setSalesReps] = useState<{ id: number; name: string; email: string }[]>([]);
  const [selectedSalesUserId, setSelectedSalesUserId] = useState<number | 'all' | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // ── Role Authorization Check ──
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isSalesManager = user?.role === 'sales_manager';

  if (!user || (!isAdmin && !isSalesManager)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm text-center px-8">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <ShieldCheck className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
          The Sales Management portal is strictly for administrators and sales managers.
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


  const openAssignDialog = async (leadIds: string[]) => {
    setSelectedSalesUserId(null);
    setAssignDialog({ open: true, leadIds });
    // Fetch sales reps if not loaded yet — scoped to permitted reps for sales managers
    if (salesReps.length === 0) {
      try {
        const res = await fetch('/api/sales-manager/visible-reps', { credentials: 'include' });
        const data = await res.json();
        const reps = data.reps || [];
        setSalesReps(reps.map((u: any) => ({ id: u.id, name: u.name || u.email, email: u.email })));
      } catch {
        toast.error('Failed to load sales reps');
      }
    }
  };

  const handleAssign = async () => {
    if (!selectedSalesUserId) return;
    setIsAssigning(true);
    try {
      const body = selectedSalesUserId === 'all'
        ? { leadIds: assignDialog.leadIds, distributeToAll: true }
        : { leadIds: assignDialog.leadIds, targetUserId: selectedSalesUserId };

      const res = await fetch('/api/admin/sales-leads/assign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
      toast.success(data.message);
      setAssignDialog({ open: false, leadIds: [] });
      setSelectedLeadIds(new Set());
      fetchLeads();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign leads');
    } finally {
      setIsAssigning(false);
    }
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

  // ── Update a lead from the drawer (works for any rep's lead the viewer can see) ──
  const updateTeamLead = useCallback(async (id: string, patch: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    setDrawerLead(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
    try {
      const res = await fetch(`/api/sales-leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || 'Failed to save');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save lead');
    }
  }, []);

  const deleteTeamLead = useCallback(async (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    try {
      const res = await fetch(`/api/sales-leads/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || 'Failed to delete');
      toast.success('Lead deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete lead');
    }
  }, []);

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
    contacted: filtered.filter(l => l.emailed || l.called || l.texted || l.instagram || l.facebook || l.linkedin || l.twitter || l.tiktok).length,
    meetings: filtered.filter(l => l.meetingBooked).length,
    highPriority: filtered.filter(l => l.priority === 'critical' || l.priority === 'high').length,
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const headers = ['Sales Rep', 'Name', 'Email', 'Socials', 'Priority', 'Social DM', 'Platform', 'Meeting', 'Emailed', 'Called', 'Texted', 'Notes', 'Email Template', 'DM Time', 'Meeting Time', 'Email Time', 'Call Time', 'Text Time', 'Added'];
    const rows = filtered.map(l => [
      displayName(l.user),
      l.name, l.email, l.socials, l.priority || '—',
      l.instagram || l.facebook || l.linkedin || l.twitter || l.tiktok ? 'Yes' : 'No', l.dmPlatform || '—',
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

  const TAB_ORDER: { id: typeof view; label: string }[] = [
    { id: 'personal', label: 'My Pipeline' },
    { id: 'team', label: 'Team Overview' },
    { id: 'commissions', label: 'Commissions' },
    ...(isAdmin ? [{ id: 'permissions' as const, label: 'Permissions' }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors",
                view === tab.id
                  ? "text-[#0073EA] border-[#0073EA]"
                  : "text-gray-400 border-transparent hover:text-gray-600"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'personal' ? (
        <SalesDashboard />
      ) : view === 'commissions' ? (
        <CommissionManagement />
      ) : view === 'permissions' ? (
        <SalesManagerPermissionsPanel />
      ) : (
        <>
          {/* ── Team Overview — Monday.com style ── */}
          <div className="space-y-4" style={{ fontFamily: "'Figtree', 'Inter', system-ui, sans-serif" }}>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {[
                { label: 'Total Leads', value: stats.total, color: 'text-[#1a1a1a]' },
                { label: 'Contacted', value: stats.contacted, color: 'text-[#579BFC]' },
                { label: 'Meetings Booked', value: stats.meetings, color: 'text-[#00C875]' },
                { label: 'High Priority', value: stats.highPriority, color: 'text-[#E2445C]' },
              ].map(s => (
                <div key={s.label} className="rounded-[14px] border border-gray-200 bg-white px-5 py-4.5 flex flex-col items-center justify-center text-center">
                  <p className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{s.label}</p>
                  <p className={cn('text-[28px] font-extrabold leading-none', s.color)}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Rep filter pills */}
            {salesUsers.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setSelectedUserId('all')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all shrink-0',
                    selectedUserId === 'all'
                      ? 'bg-[#E6F1FD] border-[#0073EA] text-[#0073EA]'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  All Reps · {leads.length}
                </button>
                {salesUsers.map((u, i) => {
                  const count = leads.filter(l => l.userId === u.id).length;
                  const active = selectedUserId === u.id;
                  const dotColors = ['#579BFC', '#00C875', '#FDAB3D', '#A25DDC', '#E2445C', '#037F4C'];
                  const dotColor = dotColors[i % dotColors.length];
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(active ? 'all' : u.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all shrink-0',
                        active ? 'bg-[#E6F1FD] border-[#0073EA] text-[#0073EA]' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                      {displayName(u)} · {count}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Toolbar */}
            <SalesPipelineToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search leads, reps…"
              actions={
                <>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
                    {selectedUserId !== 'all' && salesUsers.find(u => u.id === selectedUserId)
                      ? ` · ${displayName(salesUsers.find(u => u.id === selectedUserId)!)}`
                      : ''}
                  </span>
                  <Button variant="outline" size="sm" onClick={fetchLeads} className="gap-1.5 h-9 text-xs rounded-[9px]">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-9 text-xs rounded-[9px]">
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </Button>
                </>
              }
            />

            {/* Monday.com grouped table */}
            {leads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">No sales leads yet</p>
                <p className="text-xs mt-1">Sales team members haven't added any leads yet.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] border-separate border-spacing-0" style={{ minWidth: 900 }}>
                    <thead>
                      <tr className="bg-[#F5F6F8]">
                        <th className="w-[40px] px-2 py-2 sticky left-0 bg-[#F5F6F8] z-10 border-b-2 border-gray-200" />
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider sticky left-[40px] bg-[#F5F6F8] z-10 border-b-2 border-gray-200 min-w-[200px] w-[200px]">Lead</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 border-r border-gray-100 min-w-[130px] w-[130px]">Sales Rep</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 border-r border-gray-100 min-w-[120px] w-[120px]">Status</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 border-r border-gray-100 min-w-[110px] w-[110px]">Priority</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 border-r border-gray-100 min-w-[110px] w-[110px]">Value</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 border-r border-gray-100 min-w-[160px] w-[160px]">Channels</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 border-r border-gray-100 min-w-[120px] w-[120px]">Activity</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 min-w-[130px] w-[130px]">Added</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 min-w-[100px] w-[100px] sticky right-0 bg-[#F5F6F8] z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]">Convert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-gray-400 text-sm">
                            No leads match your search.
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          const STATUS_GROUPS_TEAM = [
                            { id: 'NEW', label: 'New', color: '#579BFC' },
                            { id: 'CONTACTED', label: 'Contacted', color: '#FDAB3D' },
                            { id: 'WORKING', label: 'Working', color: '#A25DDC' },
                            { id: 'QUALIFIED', label: 'Qualified', color: '#00C875' },
                            { id: 'WON', label: 'Won', color: '#037F4C' },
                            { id: 'LOST', label: 'Lost', color: '#E2445C' },
                            { id: 'NOT_INTERESTED', label: 'Not Interested', color: '#8B8D98' },
                          ];
                          const PRIORITY_COLORS: Record<string, string> = {
                            critical: '#333333', high: '#E2445C', medium: '#FDAB3D', low: '#579BFC',
                          };
                          const groups = STATUS_GROUPS_TEAM.map(g => ({
                            ...g,
                            leads: filtered.filter(l => (l.status || 'NEW').toUpperCase() === g.id),
                          })).filter(g => g.leads.length > 0);

                          return groups.map(group => (
                            <Fragment key={group.id}>
                              {/* Group header */}
                              <tr className="relative z-30">
                                <td colSpan={10} className="border-b border-gray-100">
                                  <div
                                    className="flex items-center gap-2 px-3 py-1.5"
                                    style={{ borderLeft: `4px solid ${group.color}` }}
                                  >
                                    <span
                                      className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[3px] text-white"
                                      style={{ backgroundColor: group.color }}
                                    >
                                      {group.label}
                                    </span>
                                    <span className="text-[11px] text-gray-400 font-medium">{group.leads.length} item{group.leads.length !== 1 ? 's' : ''}</span>
                                  </div>
                                </td>
                              </tr>
                              {/* Lead rows */}
                              {group.leads.map((lead, idx) => (
                                <Fragment key={lead.id}>
                                  <tr
                                    className={cn(
                                      'transition-colors border-b border-gray-100',
                                      drawerLead?.id === lead.id ? 'bg-[#F0F7FF]' : 'bg-white hover:bg-[#F5F6F8]/60'
                                    )}
                                    style={{ borderLeft: `4px solid ${group.color}` }}
                                  >
                                    {/* Expand toggle + checkbox */}
                                    <td className="w-[40px] px-2 py-2 text-center sticky left-0 z-20 bg-white group-hover:bg-[#F5F6F8]">
                                      <div className="flex flex-col items-center gap-1">
                                        <input
                                          type="checkbox"
                                          checked={selectedLeadIds.has(lead.id)}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            setSelectedLeadIds(prev => {
                                              const next = new Set(prev);
                                              if (e.target.checked) next.add(lead.id);
                                              else next.delete(lead.id);
                                              return next;
                                            });
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="h-3.5 w-3.5 rounded accent-yellow-500 cursor-pointer"
                                        />
                                        <button
                                          onClick={() => setDrawerLead(lead)}
                                          className="text-gray-300 hover:text-[#0073EA] transition-colors"
                                        >
                                          <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </td>

                                    {/* Lead name */}
                                    <td onClick={() => setDrawerLead(lead)} className="px-3 py-2 sticky left-[40px] z-20 bg-white group-hover:bg-[#F5F6F8] min-w-[200px] cursor-pointer">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[13px] font-semibold text-gray-900 truncate max-w-[180px]" title={lead.name}>
                                          {lead.name || <span className="text-gray-300 italic text-xs">Unnamed</span>}
                                        </span>
                                        {(lead as any).company && (
                                          <span className="text-[11px] text-gray-400 truncate max-w-[180px]">{(lead as any).company}</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Sales Rep */}
                                    <td className="px-3 py-2 border-r border-gray-100">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6 flex-shrink-0">
                                          <AvatarFallback className="text-xs bg-yellow-100 text-yellow-700">
                                            {initials(lead.user.name, lead.user.email)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-[12px] text-gray-700 truncate max-w-[80px]" title={displayName(lead.user)}>
                                          {displayName(lead.user)}
                                        </span>
                                      </div>
                                    </td>

                                    {/* Status pill */}
                                    <td className="px-3 py-2 border-r border-gray-100 text-center">
                                      <span
                                        className="inline-flex items-center justify-center h-[26px] px-3 rounded-[3px] text-[12px] font-medium text-white w-full max-w-[100px]"
                                        style={{ backgroundColor: group.color }}
                                      >
                                        {group.label}
                                      </span>
                                    </td>

                                    {/* Priority pill */}
                                    <td className="px-3 py-2 border-r border-gray-100 text-center">
                                      {lead.priority ? (
                                        <span
                                          className="inline-flex items-center justify-center h-[26px] px-3 rounded-[3px] text-[12px] font-medium text-white w-full max-w-[100px]"
                                          style={{ backgroundColor: PRIORITY_COLORS[lead.priority] || '#C4C4C4' }}
                                        >
                                          {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300 text-xs">—</span>
                                      )}
                                    </td>

                                    {/* Value */}
                                    <td className="px-3 py-2 border-r border-gray-100 text-center">
                                      <span className="text-[13px] font-semibold text-gray-700">
                                        {lead.value ? `$${lead.value.toLocaleString()}` : <span className="text-gray-300 font-normal">—</span>}
                                      </span>
                                    </td>

                                    {/* Channels — Monday-style ticks, clickable if URL exists */}
                                    <td className="px-3 py-2 border-r border-gray-100">
                                      <div className="flex items-center gap-1">
                                        {(() => {
                                          let socialEntries: Array<{ platform: string; url: string }> = [];
                                          try {
                                            const parsed = JSON.parse(lead.socials || '[]');
                                            if (Array.isArray(parsed)) socialEntries = parsed;
                                          } catch {}
                                          return [
                                            { key: 'instagram', label: 'IG', color: '#E1306C' },
                                            { key: 'facebook', label: 'FB', color: '#1877F2' },
                                            { key: 'linkedin', label: 'LI', color: '#0A66C2' },
                                            { key: 'twitter', label: 'X', color: '#1DA1F2' },
                                            { key: 'tiktok', label: 'TT', color: '#010101' },
                                          ].map(({ key, label, color }) => {
                                            const active = !!(lead as any)[key];
                                            const entry = socialEntries.find(e => e.platform === key);
                                            const url = entry?.url || '';
                                            const Tag = active && url ? 'a' : 'span';
                                            return (
                                              <Tag
                                                key={key}
                                                {...(active && url ? { href: url.startsWith('http') ? url : `https://${url}`, target: '_blank', rel: 'noopener noreferrer' } : {})}
                                                title={active && url ? url : label}
                                                className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-[3px] text-[10px] font-bold transition-opacity"
                                                style={
                                                  active
                                                    ? { backgroundColor: color, color: '#fff', opacity: url ? 1 : 0.7, cursor: url ? 'pointer' : 'default' }
                                                    : { backgroundColor: '#F5F6F8', color: '#C4C4C4', border: '1px solid #E6E9EF' }
                                                }
                                              >
                                                {label}
                                              </Tag>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </td>

                                    {/* Activity — Monday-style ticks for contacted actions */}
                                    <td className="px-3 py-2 border-r border-gray-100">
                                      <div className="flex items-center justify-center gap-1">
                                        {[
                                          { flag: lead.meetingBooked, label: 'M', color: '#00C875', title: 'Meeting' },
                                          { flag: lead.emailed, label: 'E', color: '#579BFC', title: 'Emailed' },
                                          { flag: lead.called, label: 'C', color: '#FDAB3D', title: 'Called' },
                                          { flag: lead.texted, label: 'T', color: '#A25DDC', title: 'Texted' },
                                        ].map(({ flag, label, color, title }) => (
                                          <span
                                            key={label}
                                            title={title}
                                            className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-[3px] text-[10px] font-bold"
                                            style={
                                              flag
                                                ? { backgroundColor: color, color: '#fff' }
                                                : { backgroundColor: '#F5F6F8', color: '#C4C4C4', border: '1px solid #E6E9EF' }
                                            }
                                          >
                                            {flag ? <Check className="h-3 w-3" strokeWidth={3} /> : label}
                                          </span>
                                        ))}
                                      </div>
                                    </td>

                                    {/* Added */}
                                    <td className="px-3 py-2">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[11px] font-semibold text-gray-700 whitespace-nowrap">
                                          {new Date(lead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                          {new Date(lead.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                        </span>
                                      </div>
                                    </td>

                                    {/* Convert to Client + Assign */}
                                    <td className="px-3 py-2 sticky right-0 bg-white z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]">
                                      <div className="flex flex-col gap-1 items-center">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); openAssignDialog([lead.id]); }}
                                          className="flex items-center gap-1 text-[11px] font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-full hover:bg-yellow-100 whitespace-nowrap w-full justify-center"
                                        >
                                          <UserPlus className="h-3 w-3" />
                                          Assign
                                        </button>
                                        {(lead as any).convertedToClientId ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full whitespace-nowrap">
                                            <UserCheck className="h-3 w-3" />
                                            Client
                                          </span>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-[11px] px-2 whitespace-nowrap border-green-300 text-green-700 hover:bg-green-50 w-full"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setConvertModal({ open: true, lead });
                                            }}
                                          >
                                            <UserCheck className="h-3 w-3 mr-1" />
                                            Convert
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                </Fragment>
                              ))}
                              {/* Group summary row */}
                              <tr className="bg-[#F5F6F8] border-b border-gray-200">
                                <td colSpan={2} className="px-3 py-1.5 sticky left-0 bg-[#F5F6F8] z-10">
                                  <span className="text-[11px] text-gray-400 font-medium">{group.leads.length} item{group.leads.length !== 1 ? 's' : ''}</span>
                                </td>
                                <td colSpan={8} className="px-3 py-1.5">
                                  <span className="text-[11px] text-gray-400">
                                    {group.leads.filter(l => l.meetingBooked).length} meetings ·{' '}
                                    {group.leads.filter(l => l.emailed || l.called || l.texted).length} contacted
                                  </span>
                                </td>
                              </tr>
                            </Fragment>
                          ));
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <LeadProfileDrawer
              lead={drawerLead}
              onClose={() => setDrawerLead(null)}
              onUpdate={updateTeamLead}
              onDelete={deleteTeamLead}
            />

            {selectedLeadIds.size > 0 && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                <div className="flex items-center gap-3.5 bg-gray-900 text-white pl-4 pr-3 py-2.5 rounded-2xl shadow-2xl flex-wrap justify-center">
                  <div className="flex items-center gap-2 pr-3.5 border-r border-white/15">
                    <div className="w-[22px] h-[22px] rounded-full bg-[#0073EA] flex items-center justify-center text-[11px] font-extrabold">
                      {selectedLeadIds.size}
                    </div>
                    <span className="text-[12.5px] font-bold tracking-wide">SELECTED</span>
                  </div>
                  <button
                    onClick={() => openAssignDialog(Array.from(selectedLeadIds))}
                    className="h-8 px-3.5 rounded-lg border border-white/20 bg-transparent text-white text-[12.5px] font-semibold"
                  >
                    Assign ▾
                  </button>
                  <button
                    onClick={() => setMassEmailModal(true)}
                    className="h-8 px-3.5 rounded-lg border-none bg-[#0073EA] text-white text-[12.5px] font-bold"
                  >
                    Send Mass Email
                  </button>
                  <button
                    onClick={() => setSelectedLeadIds(new Set())}
                    className="text-white/60 hover:text-white text-[12px] font-bold uppercase tracking-wide px-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <MassEmailModal
              open={massEmailModal}
              selectedLeads={selectedLeadIds}
              leads={leads}
              onClose={() => setMassEmailModal(false)}
              onSent={() => { setSelectedLeadIds(new Set()); fetchLeads(); }}
            />

            {/* Modals — unchanged */}
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
            <ConvertLeadDialog
              open={convertModal.open}
              lead={convertModal.lead}
              onOpenChange={(o) => setConvertModal(m => ({ ...m, open: o }))}
              onConverted={() => { fetchLeads(); setConvertModal({ open: false, lead: null }); }}
            />

          </div>
        </>
      )}

      {/* Assign Dialog — lives outside view conditional so it always renders */}
      <Dialog open={assignDialog.open} onOpenChange={(o) => setAssignDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-yellow-500" />
              Assign {assignDialog.leadIds.length} Lead{assignDialog.leadIds.length !== 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <button
              onClick={() => setSelectedSalesUserId(selectedSalesUserId === 'all' ? null : 'all')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left',
                selectedSalesUserId === 'all' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white hover:border-yellow-200'
              )}
            >
              <div className="h-9 w-9 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <Shuffle className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Distribute to all reps</p>
                <p className="text-xs text-gray-500">Round-robin across all active sales reps</p>
              </div>
              {selectedSalesUserId === 'all' && <Check className="h-4 w-4 text-yellow-500 ml-auto" />}
            </button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">or pick one</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {salesReps.length === 0 ? (
                <p className="text-sm text-center text-gray-400 py-4">No sales reps found</p>
              ) : salesReps.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedSalesUserId(selectedSalesUserId === u.id ? null : u.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 transition-all text-left',
                    selectedSalesUserId === u.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white hover:border-yellow-200'
                  )}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-yellow-100 text-yellow-700">
                      {initials(u.name, u.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  {selectedSalesUserId === u.id && <Check className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setAssignDialog(d => ({ ...d, open: false }))}>
              Cancel
            </Button>
            <Button
              disabled={!selectedSalesUserId || isAssigning}
              onClick={handleAssign}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}