'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Send, Eye, RefreshCw, ChevronDown, ChevronRight,
  User, Mail, Phone, Building2, FileText, CheckCircle,
  XCircle, Clock, AlertCircle, Edit2, Trash2, ExternalLink,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceLine {
  description: string;
  quantity: number;
  unitPrice: number; // cents
  total: number;     // cents
}

interface Quote {
  id: string;
  version: number;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED';
  services: ServiceLine[];
  totalAmount: number;
  notes: string | null;
  validDays: number;
  shareToken: string;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  changeRequest: string | null;
  createdAt: string;
}

interface PreClient {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  status: 'QUALIFIED' | 'QUOTED' | 'QUOTE_ACCEPTED' | 'PROVISIONING' | 'CONVERTED';
  createdAt: string;
  createdBy: { id: number; name: string | null; email: string };
  quotes: Quote[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG: Record<PreClient['status'], { label: string; color: string }> = {
  QUALIFIED:      { label: 'Qualified',       color: 'bg-gray-100 text-gray-700' },
  QUOTED:         { label: 'Quoted',           color: 'bg-blue-100 text-blue-700' },
  QUOTE_ACCEPTED: { label: 'Quote Accepted',   color: 'bg-green-100 text-green-700' },
  PROVISIONING:   { label: 'Provisioning',     color: 'bg-yellow-100 text-yellow-700' },
  CONVERTED:      { label: 'Active Client',    color: 'bg-purple-100 text-purple-700' },
};

const QUOTE_STATUS_CONFIG: Record<Quote['status'], { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:    { label: 'Draft',    color: 'bg-gray-100 text-gray-600',   icon: <Edit2 size={11} /> },
  SENT:     { label: 'Sent',     color: 'bg-blue-100 text-blue-700',   icon: <Send size={11} /> },
  VIEWED:   { label: 'Viewed',   color: 'bg-purple-100 text-purple-700', icon: <Eye size={11} /> },
  ACCEPTED: { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: <CheckCircle size={11} /> },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700',     icon: <XCircle size={11} /> },
};

// ─── Default service line ─────────────────────────────────────────────────────

function emptyLine(): ServiceLine {
  return { description: '', quantity: 1, unitPrice: 0, total: 0 };
}

// ─── Quote Builder Dialog ─────────────────────────────────────────────────────

function QuoteBuilderDialog({
  preClient,
  existingQuote,
  onClose,
  onSaved,
}: {
  preClient: PreClient;
  existingQuote: Quote | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [services, setServices] = useState<ServiceLine[]>(
    existingQuote ? (existingQuote.services as ServiceLine[]) : [
      { description: 'Content Production & Management', quantity: 1, unitPrice: 200000, total: 200000 },
      { description: 'Paid Ad Spend (pass-through)',    quantity: 1, unitPrice: 50000,  total: 50000  },
    ]
  );
  const [notes, setNotes] = useState(existingQuote?.notes ?? '');
  const [validDays, setValidDays] = useState(existingQuote?.validDays ?? 30);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [savedQuote, setSavedQuote] = useState<Quote | null>(existingQuote);

  const total = services.reduce((s, l) => s + l.total, 0);

  function updateLine(i: number, field: keyof ServiceLine, raw: string) {
    setServices((prev) => {
      const next = [...prev];
      const line = { ...next[i] };
      if (field === 'description') {
        line.description = raw;
      } else {
        // unitPrice and quantity stored as cents / integer
        const val = field === 'unitPrice'
          ? Math.round(parseFloat(raw || '0') * 100)
          : parseInt(raw || '1', 10);
        (line as any)[field] = isNaN(val) ? 0 : val;
        line.total = line.quantity * line.unitPrice;
      }
      next[i] = line;
      return next;
    });
  }

  async function handleSave() {
    if (services.some((s) => !s.description.trim())) {
      toast.error('All service lines need a description');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/pre-clients/${preClient.id}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services, notes, validDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedQuote(data);
      toast.success(`Quote v${data.version} saved`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!savedQuote) {
      toast.error('Save the quote first before sending');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(
        `/api/pre-clients/${preClient.id}/quotes/${savedQuote.id}/send`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Quote sent to ${preClient.email}`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to send quote');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />
            Quote Builder — {preClient.name}
            {savedQuote && (
              <span className="text-xs font-normal text-gray-500 ml-1">v{savedQuote.version}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Quote preview header */}
        <div className="bg-gray-900 rounded-lg px-6 py-4 flex items-center justify-between mb-2">
          <div>
            <div className="text-white font-bold text-lg">E8</div>
            <div className="text-gray-400 text-xs uppercase tracking-widest">Full Service Video + Content</div>
          </div>
          <div className="text-right text-xs text-gray-400 space-y-0.5">
            <div>Prepared for: <span className="text-white">{preClient.name}</span></div>
            {preClient.companyName && (
              <div className="text-gray-400">{preClient.companyName}</div>
            )}
          </div>
        </div>

        {/* Service lines */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-900 text-white grid grid-cols-12 gap-0 text-xs uppercase tracking-wider">
            <div className="col-span-5 px-4 py-2">Service / Description</div>
            <div className="col-span-2 px-4 py-2 text-center">Qty</div>
            <div className="col-span-2 px-4 py-2 text-center">Unit Price</div>
            <div className="col-span-2 px-4 py-2 text-center">Total</div>
            <div className="col-span-1 px-2 py-2" />
          </div>

          {services.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-0 border-b border-gray-100 items-center hover:bg-gray-50">
              <div className="col-span-5 px-3 py-2">
                <Input
                  value={line.description}
                  onChange={(e) => updateLine(i, 'description', e.target.value)}
                  placeholder="e.g. Content Production & Management"
                  className="border-0 shadow-none focus-visible:ring-0 px-1 text-sm"
                />
              </div>
              <div className="col-span-2 px-3 py-2">
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                  className="border-0 shadow-none focus-visible:ring-0 text-center text-sm"
                />
              </div>
              <div className="col-span-2 px-3 py-2">
                <div className="flex items-center">
                  <span className="text-gray-400 text-sm mr-1">$</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={(line.unitPrice / 100).toFixed(2)}
                    onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                    className="border-0 shadow-none focus-visible:ring-0 text-sm"
                  />
                </div>
              </div>
              <div className="col-span-2 px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                {fmt(line.total)}
              </div>
              <div className="col-span-1 px-2 py-2 flex justify-center">
                {services.length > 1 && (
                  <button
                    onClick={() => setServices((p) => p.filter((_, j) => j !== i))}
                    className="text-gray-300 hover:text-red-500 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Total row */}
          <div className="bg-blue-600 text-white grid grid-cols-12">
            <div className="col-span-9 px-4 py-3 text-right text-sm font-bold uppercase tracking-wider">
              Total Monthly Cost
            </div>
            <div className="col-span-3 px-4 py-3 text-right font-bold text-base">
              {fmt(total)}
            </div>
          </div>
        </div>

        <button
          onClick={() => setServices((p) => [...p, emptyLine()])}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1"
        >
          <Plus size={14} /> Add line item
        </button>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Notes / Terms (optional)
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional terms, deliverables, or context..."
            className="text-sm"
          />
        </div>

        {/* Valid days */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Valid for</label>
          <Input
            type="number"
            min={1}
            max={90}
            value={validDays}
            onChange={(e) => setValidDays(parseInt(e.target.value) || 30)}
            className="w-20 text-sm"
          />
          <span className="text-sm text-gray-500">days</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button onClick={handleSave} disabled={saving} variant="outline" className="flex-1">
            {saving ? 'Saving...' : savedQuote ? 'Save New Version' : 'Save Quote'}
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !savedQuote}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Send size={14} className="mr-2" />
            {sending ? 'Sending...' : `Send to ${preClient.email}`}
          </Button>
        </div>

        {!savedQuote && (
          <p className="text-xs text-gray-400 text-center">Save first, then send to client</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Create PreClient Dialog ──────────────────────────────────────────────────

function CreatePreClientDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', companyName: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/pre-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.name} added as a pre-client`);
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create pre-client');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User size={18} /> New Pre-Client
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Erel Herzog"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="erel@combatica.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Company</label>
            <Input
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
              placeholder="Combatica"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? 'Creating...' : 'Create Pre-Client'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function PreClientsTab() {
  const [preClients, setPreClients] = useState<PreClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [quoteTarget, setQuoteTarget] = useState<{ preClient: PreClient; quote: Quote | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pre-clients');
      const data = await res.json();
      setPreClients(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load pre-clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = preClients.filter((pc) =>
    [pc.name, pc.email, pc.companyName].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pre-Clients</h2>
          <p className="text-sm text-gray-500">Manage prospects through the quote pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={cn('mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus size={14} className="mr-1" /> New Pre-Client
          </Button>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by name, email, or company..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          {search ? 'No results found' : 'No pre-clients yet — create one to start'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((pc) => {
            const latestQuote = pc.quotes[0] ?? null;
            const isExpanded = expandedId === pc.id;
            const statusCfg = STATUS_CONFIG[pc.status];

            return (
              <div key={pc.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                {/* Row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedId(isExpanded ? null : pc.id)}
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 font-semibold text-sm">
                      {pc.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{pc.name}</span>
                      {pc.companyName && (
                        <span className="text-gray-400 text-sm truncate">· {pc.companyName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1"><Mail size={11} />{pc.email}</span>
                      {pc.phone && <span className="flex items-center gap-1"><Phone size={11} />{pc.phone}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {latestQuote && (
                      <div className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium',
                        QUOTE_STATUS_CONFIG[latestQuote.status].color)}>
                        {QUOTE_STATUS_CONFIG[latestQuote.status].icon}
                        Quote {QUOTE_STATUS_CONFIG[latestQuote.status].label}
                        {latestQuote.version > 1 && <span className="ml-0.5">v{latestQuote.version}</span>}
                      </div>
                    )}
                    <span className={cn('text-xs px-2 py-1 rounded-full font-medium', statusCfg.color)}>
                      {statusCfg.label}
                    </span>
                    <span className="text-xs text-gray-400">{fmtDate(pc.createdAt)}</span>
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setQuoteTarget({ preClient: pc, quote: null })}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <FileText size={13} className="mr-1" />
                        {latestQuote ? 'New Quote Version' : 'Create Quote'}
                      </Button>
                      {latestQuote && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setQuoteTarget({ preClient: pc, quote: latestQuote })}
                        >
                          <Edit2 size={13} className="mr-1" /> Edit Latest Quote
                        </Button>
                      )}
                      {pc.status === 'QUOTE_ACCEPTED' && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (!confirm(`Provision ${pc.name} as a full client and send welcome email?`)) return;
                            const res = await fetch(`/api/pre-clients/${pc.id}/provision`, { method: 'POST' });
                            const data = await res.json();
                            if (data.success) {
                              toast.success(`${pc.name} provisioned! Magic link sent to ${pc.email}`);
                              load();
                            } else {
                              toast.error(data.error || 'Provisioning failed');
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle size={13} className="mr-1" /> Provision Client
                        </Button>
                      )}
                    </div>

                    {/* Quote history */}
                    {pc.quotes.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Quote History
                        </div>
                        <div className="space-y-2">
                          {pc.quotes.map((q) => {
                            const qCfg = QUOTE_STATUS_CONFIG[q.status];
                            return (
                              <div
                                key={q.id}
                                className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-4"
                              >
                                <div className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0', qCfg.color)}>
                                  {qCfg.icon} v{q.version} — {qCfg.label}
                                </div>
                                <div className="flex-1 text-sm text-gray-700 font-medium">
                                  {fmt(q.totalAmount)}/mo
                                </div>
                                <div className="text-xs text-gray-400 flex items-center gap-3">
                                  {q.sentAt && <span>Sent {fmtDate(q.sentAt)}</span>}
                                  {q.acceptedAt && <span className="text-green-600">Accepted {fmtDate(q.acceptedAt)}</span>}
                                  {q.rejectedAt && <span className="text-red-500">Rejected {fmtDate(q.rejectedAt)}</span>}
                                </div>
                                {(q.status === 'SENT' || q.status === 'VIEWED' || q.status === 'DRAFT') && (
                                  <a
                                    href={`${baseUrl}/quote/${q.shareToken}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Rejection feedback */}
                    {latestQuote?.status === 'REJECTED' && (latestQuote.rejectionReason || latestQuote.changeRequest) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <div className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <AlertCircle size={12} /> Client Feedback
                        </div>
                        {latestQuote.rejectionReason && (
                          <p className="text-sm text-red-800 mb-1">
                            <span className="font-medium">Reason:</span> {latestQuote.rejectionReason}
                          </p>
                        )}
                        {latestQuote.changeRequest && (
                          <p className="text-sm text-red-800">
                            <span className="font-medium">Requested changes:</span> {latestQuote.changeRequest}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      {showCreate && (
        <CreatePreClientDialog
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {quoteTarget && (
        <QuoteBuilderDialog
          preClient={quoteTarget.preClient}
          existingQuote={quoteTarget.quote}
          onClose={() => setQuoteTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}