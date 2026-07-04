'use client';

import React from 'react';
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
  details?: string;
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
  preparedBy: string | null;
  inclusions: string[];
  terms: { title: string; body: string }[];
  acceptanceText: string | null;
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

// ─── Default document content ─────────────────────────────────────────────────

const DEFAULT_INCLUSIONS = [
  '12 social media videos — fully produced and ready to publish',
  'Concept ideation and content planning for every video',
  'Professional video editing',
  'Publishing and scheduling across 5 platforms — YouTube, TikTok, Instagram, Facebook, and LinkedIn',
  'Account management across all connected channels',
  'Community management — monitoring and responding to comments',
  '$500/month managed ad spend to boost reach and growth',
];

const DEFAULT_TERMS: { title: string; body: string }[] = [
  { title: 'Billing.', body: 'Flat monthly fee invoiced at the start of each billing cycle and due on receipt.' },
  { title: 'Ad spend.', body: "$500/month is a managed pass-through advertising budget deployed across platforms on the client's behalf, with spend reported monthly." },
  { title: 'Deliverables.', body: '12 social media videos per month, repurposed and optimized for each platform.' },
  { title: 'Term & cancellation.', body: "12 month engagement; either party may cancel with [60] days' written notice." },
];

const DEFAULT_ACCEPTANCE = "To get started, sign below and return a copy. We'll send the first invoice and begin onboarding right away.";

// ─── E8 Logo ──────────────────────────────────────────────────────────────────

function E8LogoSvg() {
  return (
    <svg width="36" height="48" viewBox="0 0 370.08 496.58" fill="currentColor">
      <path d="M370.08,111.08v274.43l-.99,10.88c-7.12,55.78-54.98,98.68-111.19,100.2H111.71c-56-2.02-103.16-43.93-110.72-99.48L0,387.42C0,294.67.01,201.91,0,109.16,2.69,51.08,50.91,2.78,109.07,0h151.7c59.51,2.98,107.01,51.79,109.31,111.08ZM254.64,14.64H110.27C57.77,17.38,16.53,59.7,14.63,112.15v271.81c1.87,54.01,44.72,96.62,98.76,97.99h141.25v-72.69H114.83c-14.27-.41-26.11-11.55-27.23-25.79v-98.95s97.44,0,97.44,0v-72.68h-97.44v-98.71c.97-13.67,11.91-24.67,25.55-25.8h141.49s0-72.68,0-72.68ZM267.6,197.2v-84.56c0-4.53-6.98-10.84-11.64-10.67-47.95.22-95.99-.47-143.88.35-4.92,1.13-9.83,6.62-9.83,11.76v83.12h165.36ZM267.6,299.15H102.24v83.12c0,5.81,5.68,11.63,11.39,12.12h143.05c4.54-.18,10.92-6.2,10.92-10.68v-84.56Z" />
    </svg>
  );
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
  const [notes, setNotes]                   = useState(existingQuote?.notes ?? '');
  const [validDays, setValidDays]           = useState(existingQuote?.validDays ?? 30);
  const [preparedBy, setPreparedBy]         = useState(existingQuote?.preparedBy ?? 'Gabe Rabinowitz + Eric Davis');
  const [inclusions, setInclusions]         = useState<string[]>(existingQuote?.inclusions?.length ? existingQuote.inclusions : DEFAULT_INCLUSIONS);
  const [terms, setTerms]                   = useState<{ title: string; body: string }[]>(existingQuote?.terms?.length ? existingQuote.terms : DEFAULT_TERMS);
  const [acceptanceText, setAcceptanceText] = useState(existingQuote?.acceptanceText ?? DEFAULT_ACCEPTANCE);
  const [saving, setSaving]                 = useState(false);
  const [sending, setSending]               = useState(false);
  const [savedQuote, setSavedQuote]         = useState<Quote | null>(existingQuote);

  const total = services.reduce((s, l) => s + l.total, 0);
  const defaultQuoteNumber = savedQuote
    ? `E8-${new Date(savedQuote.createdAt).getFullYear()}-${String(savedQuote.version).padStart(4, '0')}`
    : 'E8-DRAFT';
  const defaultDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const defaultValidUntil = new Date(Date.now() + validDays * 86400000)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const [quoteNumberEdit, setQuoteNumberEdit] = useState(defaultQuoteNumber);
  const [quoteDateEdit, setQuoteDateEdit]     = useState(defaultDate);
  const [validUntilEdit, setValidUntilEdit]   = useState(defaultValidUntil);

  function updateLine(i: number, field: keyof ServiceLine | 'details', raw: string) {
    setServices((prev) => {
      const next = [...prev];
      const line = { ...next[i] } as ServiceLine & { details?: string };
      if (field === 'description') {
        line.description = raw;
      } else if (field === 'details') {
        (line as any).details = raw;
      } else {
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
        body: JSON.stringify({ services, notes, validDays, preparedBy, inclusions, terms, acceptanceText }),
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
    if (!savedQuote) { toast.error('Save the quote first before sending'); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/pre-clients/${preClient.id}/quotes/${savedQuote.id}/send`, { method: 'POST' });
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

  // Shared editable input style
  const inStyle: React.CSSProperties = {
    border: '1px solid #bfdbfe', borderRadius: 4, padding: '3px 8px',
    fontSize: 13, background: '#eff6ff', fontFamily: 'inherit',
    outline: 'none', width: '100%', resize: 'vertical' as const,
    color: 'inherit',
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[92vh] overflow-y-auto p-0 gap-0">

        {/* ── Top action bar ── */}
        <div style={{ background: '#1e3a8a', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px 8px 0 0', flexShrink: 0 }}>
          <span style={{ color: '#93c5fd', fontSize: 13, fontWeight: 500 }}>
            Quote Builder — <span style={{ color: '#fff' }}>{preClient.name}</span>
            {savedQuote && <span style={{ color: '#60a5fa', fontSize: 11, marginLeft: 8 }}>V{savedQuote.version} saved ✓</span>}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleSave} disabled={saving}
              style={{ background: '#fff', color: '#1e3a8a', border: 'none', borderRadius: 6, padding: '6px 18px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : savedQuote ? 'Save New Version' : 'Save Quote'}
            </button>
            <button
              onClick={handleSend} disabled={sending || !savedQuote}
              style={{ background: !savedQuote ? '#374151' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', fontSize: 13, fontWeight: 700, cursor: (sending || !savedQuote) ? 'not-allowed' : 'pointer', opacity: (sending || !savedQuote) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Send size={13} />
              {sending ? 'Sending…' : `Send to ${preClient.email}`}
            </button>
          </div>
        </div>

        <div style={{ background: '#e5e7eb', padding: '16px 24px 24px' }}>
          <div style={{ background: '#fff', margin: '0 auto', width: '100%', boxShadow: '0 2px 16px rgba(0,0,0,0.12)', fontFamily: 'Georgia, Times New Roman, serif', fontSize: 13, color: '#1a1a1a', lineHeight: 1.65, position: 'relative', overflow: 'hidden' }}>
            {savedQuote?.status === 'ACCEPTED' && (
              <img
                src="/icons/accepted_stamp_e8.svg"
                alt="Accepted"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '90%',
                  opacity: 0.65,
                  pointerEvents: 'none',
                  zIndex: 10,
                  userSelect: 'none',
                }}
              />
            )}

            {/* Header */}
            <div style={{ padding: '20px 32px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <E8LogoSvg />
                  <div>
                    <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 20, letterSpacing: '0.04em' }}>E8</div>
                    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 9, letterSpacing: '0.15em', color: '#6b7280', textTransform: 'uppercase' }}>Full Service Video + Content</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#374151', lineHeight: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    Quote No.&nbsp;
                    <input
                      value={quoteNumberEdit}
                      onChange={(e) => setQuoteNumberEdit(e.target.value)}
                      style={{ ...inStyle, width: 120, fontSize: 11, fontWeight: 700, padding: '1px 5px', textAlign: 'right' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    Date&nbsp;
                    <input
                      value={quoteDateEdit}
                      onChange={(e) => setQuoteDateEdit(e.target.value)}
                      style={{ ...inStyle, width: 140, fontSize: 11, fontWeight: 700, padding: '1px 5px', textAlign: 'right' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    Valid Until&nbsp;
                    <input
                      value={validUntilEdit}
                      onChange={(e) => setValidUntilEdit(e.target.value)}
                      style={{ ...inStyle, width: 140, fontSize: 11, fontWeight: 700, padding: '1px 5px', textAlign: 'right', color: '#1a56db' }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '2.5px solid #1a56db', marginTop: 16, marginBottom: 14 }} />
              <h1 style={{ fontFamily: 'Arial, sans-serif', fontSize: 18, fontWeight: 900, letterSpacing: '0.04em', margin: '0 0 14px' }}>MONTHLY SERVICE QUOTE</h1>
            </div>

            {/* Prepared For / By */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', margin: '0 32px', padding: '12px 0 14px' }}>
              <div style={{ paddingRight: 20 }}>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#1a56db', textTransform: 'uppercase', marginBottom: 3 }}>Prepared For</div>
                <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 14 }}>
                  {preClient.name}{preClient.companyName ? `, ${preClient.companyName}` : ''}
                </div>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#6b7280' }}>{preClient.email}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#1a56db', textTransform: 'uppercase', marginBottom: 3 }}>Prepared By</div>
                <input
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  placeholder="Team member names"
                  style={{ ...inStyle, fontFamily: 'Arial, sans-serif', fontSize: 13, resize: 'none' as const }}
                />
              </div>
            </div>

            {/* Intro */}
            <div style={{ padding: '12px 32px 6px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>
                Thank you for the opportunity. Below is your monthly engagement for{' '}
                <span style={{ color: '#374151' }}>full-service social media content production, publishing, and management across five platforms.</span>
              </p>
            </div>

            {/* Cost Summary */}
            <div style={{ padding: '14px 32px 0' }}>
              <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', color: '#1a56db', textTransform: 'uppercase', marginBottom: 8 }}>Cost Summary</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif' }}>
                <thead>
                  <tr style={{ background: '#1a1a1a', color: '#fff' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase', width: '26%' }}>Service</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase' }}>Description</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 9, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase', width: 100 }}>Monthly</th>
                    <th style={{ width: 30 }} />
                  </tr>
                </thead>
                <tbody>
                  {services.map((line, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                        <input
                          value={line.description}
                          onChange={(e) => updateLine(i, 'description', e.target.value)}
                          placeholder="Service name"
                          style={{ ...inStyle, fontWeight: 700, fontSize: 12, resize: 'none' as const }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                        <textarea
                          value={(line as any).details ?? ''}
                          onChange={(e) => updateLine(i, 'details', e.target.value)}
                          rows={2}
                          placeholder="Describe what's included in this service…"
                          style={{ ...inStyle, color: '#4b5563', fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', verticalAlign: 'top', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                          <span style={{ color: '#6b7280', fontSize: 12 }}>$</span>
                          <input
                            type="number" min={0} step={1}
                            value={(line.unitPrice / 100).toFixed(0)}
                            onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                            style={{ ...inStyle, width: 70, textAlign: 'right', fontSize: 13, fontWeight: 700, resize: 'none' as const }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '4px', verticalAlign: 'top', textAlign: 'center' }}>
                        {services.length > 1 && (
                          <button
                            onClick={() => setServices((p) => p.filter((_, j) => j !== i))}
                            title="Remove line"
                            style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: 4, borderRadius: 4, marginTop: 4 }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#d1d5db'; }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#1a56db', color: '#fff' }}>
                    <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total Monthly Cost</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, fontSize: 16 }}>${(total / 100).toLocaleString('en-US')}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <button
                onClick={() => setServices((p) => [...p, { description: '', quantity: 1, unitPrice: 0, total: 0 }])}
                style={{ marginTop: 6, background: '#eff6ff', color: '#1d4ed8', border: '1px dashed #93c5fd', borderRadius: 6, padding: '3px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={11} /> Add line item
              </button>
            </div>

            {/* What's Included */}
            <div style={{ padding: '18px 32px 0' }}>
              <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', color: '#1a56db', textTransform: 'uppercase', marginBottom: 8 }}>{"What's Included Every Month:"}</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, listStyleType: "disc" }}>
                {inclusions.map((item, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        value={item}
                        onChange={(e) => { const n = [...inclusions]; n[i] = e.target.value; setInclusions(n); }}
                        style={{ ...inStyle, flex: 1, fontSize: 12, resize: 'none' as const }}
                      />
                      <button
                        onClick={() => setInclusions((p) => p.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: 3, borderRadius: 4, flexShrink: 0 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#d1d5db'; }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setInclusions((p) => [...p, ''])}
                style={{ marginTop: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px dashed #93c5fd', borderRadius: 6, padding: '3px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={11} /> Add bullet
              </button>
            </div>

            {/* Terms */}
            <div style={{ padding: '18px 32px 0' }}>
              <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', color: '#1a56db', textTransform: 'uppercase', marginBottom: 8 }}>Terms:</div>
              <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, listStyleType: "decimal" }}>
                {terms.map((term, i) => (
                  <li key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          value={term.title}
                          onChange={(e) => { const n = [...terms]; n[i] = { ...n[i], title: e.target.value }; setTerms(n); }}
                          placeholder="Term title (e.g. Billing.)"
                          style={{ ...inStyle, width: 200, fontWeight: 700, fontSize: 12, resize: 'none' as const }}
                        />
                        <button
                          onClick={() => setTerms((p) => p.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: 3, borderRadius: 4 }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#d1d5db'; }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <textarea
                        value={term.body}
                        rows={2}
                        onChange={(e) => { const n = [...terms]; n[i] = { ...n[i], body: e.target.value }; setTerms(n); }}
                        placeholder="Term description…"
                        style={{ ...inStyle, fontSize: 12, color: '#374151' }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
              <button
                onClick={() => setTerms((p) => [...p, { title: 'New term.', body: '' }])}
                style={{ marginTop: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px dashed #93c5fd', borderRadius: 6, padding: '3px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={11} /> Add term
              </button>
            </div>

            {/* Acceptance */}
            <div style={{ padding: '18px 32px 0' }}>
              <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', color: '#1a56db', textTransform: 'uppercase', marginBottom: 8 }}>Acceptance:</div>
              <textarea
                value={acceptanceText}
                onChange={(e) => setAcceptanceText(e.target.value)}
                rows={2}
                placeholder="Paragraph shown above signature line…"
                style={{ ...inStyle, fontSize: 13, color: '#374151', marginBottom: 14 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                <div>
                  <div style={{ borderTop: '1px solid #374151', paddingTop: 5, fontFamily: 'Arial, sans-serif', fontSize: 9, letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase' }}>Authorized Signature</div>
                </div>
                <div>
                  <div style={{ borderTop: '1px solid #374151', paddingTop: 5, fontFamily: 'Arial, sans-serif', fontSize: 9, letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase' }}>Date</div>
                </div>
              </div>
            </div>

            {/* Internal notes */}
            <div style={{ padding: '18px 32px 0' }}>
              <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>Internal Notes (not shown to client):</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any internal context or reminders for this quote…"
                style={{ ...inStyle, fontSize: 12, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb' }}
              />
            </div>

            {/* Doc footer */}
            <div style={{ borderTop: '2.5px solid #1a56db', margin: '20px 32px 0' }} />
            <div style={{ padding: '10px 32px 22px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Arial, sans-serif', fontSize: 10, color: '#9ca3af' }}>E8 Productions, LLC</span>
              <span style={{ fontFamily: 'Arial, sans-serif', fontSize: 10, color: '#1a56db' }}>e8productions.com</span>
            </div>
          </div>
        </div>

        {!savedQuote && (
          <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: '8px 0 10px', background: '#f8fafc', margin: 0 }}>
            Save the quote first, then send to client
          </p>
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
                        {latestQuote.version > 1 && <span className="ml-0.5">V{latestQuote.version}</span>}
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
                                  {qCfg.icon} V{q.version} — {qCfg.label}
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
                    {(latestQuote?.rejectionReason || latestQuote?.changeRequest) && (
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
