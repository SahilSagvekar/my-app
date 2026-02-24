'use client';

import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import {
  X,
  Check,
  ChevronRight,
  Send,
  Link as LinkIcon,
  Info as InfoIcon,
  History as HistoryIcon,
  Clock,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Download,
  Search,
  ChevronDown,
  Mail,
  Phone,
  MessageSquare,
  FileText,
  UploadCloud,
  Instagram,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type SnapchatShow = 'yes' | 'no' | 'maybe' | '';

interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  socials: string;
  status: string;
  source: string;
  value: number | null;
  snapchatShow: SnapchatShow;
  igDm: boolean;
  meetingBooked: boolean;
  emailed: boolean;
  called: boolean;
  texted: boolean;
  dmPlatform: string;
  notes: string;
  emailTemplate: string;
  dmAt?: string;
  meetingAt?: string;
  emailedAt?: string;
  calledAt?: string;
  textedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  _saved: boolean;
  _dirty: boolean;
  _committing: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tempId() {
  return '__tmp_' + Math.random().toString(36).slice(2, 10);
}

function emptyDraftLead(): Lead {
  return {
    id: tempId(),
    name: '', company: '', email: '', phone: '', socials: '',
    status: 'NEW', source: '', value: null,
    snapchatShow: '',
    igDm: false, meetingBooked: false, emailed: false,
    called: false, texted: false, dmPlatform: '', notes: '', emailTemplate: '',
    dmAt: undefined, meetingAt: undefined, emailedAt: undefined,
    calledAt: undefined, textedAt: undefined,
    _saved: false, _dirty: false, _committing: false,
  };
}

function dbLeadToLocal(l: any): Lead {
  return {
    id: l.id,
    name: l.name,
    company: l.company || '',
    email: l.email,
    phone: l.phone || '',
    socials: l.socials,
    status: l.status || 'NEW',
    source: l.source || '',
    value: l.value || null,
    snapchatShow: l.snapchatShow as SnapchatShow,
    igDm: l.igDm,
    meetingBooked: l.meetingBooked,
    emailed: l.emailed,
    called: l.called,
    texted: l.texted,
    dmPlatform: l.dmPlatform || '',
    notes: l.notes,
    emailTemplate: l.emailTemplate,
    dmAt: l.dmAt,
    meetingAt: l.meetingAt,
    emailedAt: l.emailedAt,
    calledAt: l.calledAt,
    textedAt: l.textedAt,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    _saved: true,
    _dirty: false,
    _committing: false,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SNAPCHAT_OPTIONS: { value: SnapchatShow; label: string; color: string }[] = [
  { value: 'yes', label: 'Yes', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'no', label: 'No', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'maybe', label: 'Maybe', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: '', label: '—', color: 'bg-gray-50 text-gray-400 border-gray-200' },
];

const DM_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: 'text-pink-600 bg-pink-50' },
  { id: 'facebook', label: 'Facebook', color: 'text-blue-600 bg-blue-50' },
  { id: 'linkedin', label: 'LinkedIn', color: 'text-cyan-700 bg-cyan-50' },
  { id: 'twitter', label: 'Twitter/X', color: 'text-gray-900 bg-gray-50' },
  { id: 'tiktok', label: 'TikTok', color: 'text-black bg-gray-100' },
  { id: 'other', label: 'Other', color: 'text-gray-600 bg-gray-100' },
];

const LEAD_STATUSES = [
  { id: 'NEW', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { id: 'CONTACTED', label: 'Contacted', color: 'bg-purple-100 text-purple-700' },
  { id: 'WORKING', label: 'Working', color: 'bg-amber-100 text-amber-700' },
  { id: 'QUALIFIED', label: 'Qualified', color: 'bg-green-100 text-green-700' },
  { id: 'WON', label: 'Closed Won', color: 'bg-emerald-500 text-white' },
  { id: 'LOST', label: 'Closed Lost', color: 'bg-red-100 text-red-700' },
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

function ManualTimeCell({
  label, value, onChange, disabled
}: {
  label: string; value?: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  // Helper: Extract EST components from UTC ISO string
  const getESTParts = (iso?: string) => {
    try {
      const d = iso ? new Date(iso) : new Date();
      if (isNaN(d.getTime())) return { dStr: '', tStr: '', ampm: 'AM' };

      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: 'numeric', minute: '2-digit', hour12: true
      }).formatToParts(d);

      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      const h = parts.find(p => p.type === 'hour')?.value;
      const m = parts.find(p => p.type === 'minute')?.value;
      const am = parts.find(p => p.type === 'dayPeriod')?.value;

      return {
        dStr: `${year}-${month}-${day}`, // YYYY-MM-DD
        tStr: `${h}:${m}`,
        ampm: am || 'AM'
      };
    } catch { return { dStr: '', tStr: '', ampm: 'AM' }; }
  };

  const parts = getESTParts(value);
  const [localTime, setLocalTime] = useState(parts.tStr);

  // Sync internal text state with value prop
  useEffect(() => { setLocalTime(parts.tStr); }, [value]);

  const commit = (d: string, t: string, ap: string) => {
    if (!d || !t) return;
    const [hStr, mStr] = t.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return;

    // Convert 12h to 24h
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;

    const [y, mon, day] = d.split('-').map(Number);
    const target = new Date(y, mon - 1, day, h, m);
    // Offset correction for EST
    const nyStr = target.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nyDate = new Date(nyStr);
    const offset = target.getTime() - nyDate.getTime();
    onChange(new Date(target.getTime() + offset).toISOString());
  };

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight flex justify-between items-center h-4">
        <span>{label} <span className="text-yellow-600/40 font-medium">(EST)</span></span>
        <div className="flex gap-2 items-center">
          {!disabled && (
            <button
              onClick={() => onChange(new Date().toISOString())}
              className="group flex items-center gap-0.5 text-yellow-600 hover:text-yellow-700 transition-colors"
            >
              <Clock className="h-2.5 w-2.5" />
              <span className="text-[9px]">NOW</span>
            </button>
          )}
          {value && !disabled && (
            <button onClick={() => onChange('')} className="text-red-400 hover:text-red-600 uppercase text-[9px]">Clear</button>
          )}
        </div>
      </label>

      <div className="flex flex-col gap-1.5 p-2 bg-gray-50/50 rounded-lg border border-gray-100">
        <div className="flex gap-1">
          {/* Date Picker */}
          <input
            type="date"
            disabled={disabled}
            value={parts.dStr}
            onChange={e => commit(e.target.value, localTime, parts.ampm)}
            className="w-1/2 px-2 py-1 text-[10px] rounded border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
          />

          {/* Time Text Input */}
          <input
            type="text"
            placeholder="12:00"
            disabled={disabled}
            value={localTime}
            onChange={e => setLocalTime(e.target.value)}
            onBlur={() => commit(parts.dStr, localTime, parts.ampm)}
            className="w-1/4 px-2 py-1 text-[10px] rounded border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400 text-center"
          />

          {/* AM/PM Toggle */}
          <div className="flex w-1/4 rounded border border-gray-200 overflow-hidden bg-white">
            <button
              disabled={disabled}
              onClick={() => commit(parts.dStr, localTime, 'AM')}
              className={cn(
                "flex-1 text-[9px] font-bold py-1 transition-colors",
                parts.ampm === 'AM' ? "bg-yellow-400 text-white" : "text-gray-400 hover:bg-gray-50"
              )}
            >AM</button>
            <button
              disabled={disabled}
              onClick={() => commit(parts.dStr, localTime, 'PM')}
              className={cn(
                "flex-1 text-[9px] font-bold py-1 transition-colors",
                parts.ampm === 'PM' ? "bg-yellow-400 text-white" : "text-gray-400 hover:bg-gray-50"
              )}
            >PM</button>
          </div>
        </div>

        {!disabled && (
          <div className="flex flex-wrap gap-1">
            {[{ l: '-5m', m: 5 }, { l: '-15m', m: 15 }, { l: '-1h', m: 60 }, { l: '-3h', m: 180 }].map(opt => (
              <button
                key={opt.l}
                onClick={() => onChange(new Date(Date.now() - opt.m * 60000).toISOString())}
                className="px-1.5 py-0.5 rounded bg-white border border-gray-100 text-gray-400 text-[8px] font-bold hover:border-yellow-200 hover:text-yellow-600 transition-all"
              >
                {opt.l}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformCell({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const current = DM_PLATFORMS.find(o => o.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold w-full justify-center transition-colors uppercase tracking-tight h-7',
          current ? 'border-transparent ' + current.color : 'border-gray-100 bg-white text-gray-300',
          disabled && 'opacity-30'
        )}>
          {current ? current.label : 'Select'}
          {!disabled && <ChevronDown className="h-3 w-3 opacity-60 flex-shrink-0" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-32">
        {DM_PLATFORMS.map(opt => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn('text-xs font-medium', opt.color)}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => onChange('')} className="text-xs text-gray-400">
          Clear
        </DropdownMenuItem>
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

interface LeadProfileDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
}

function LeadProfileDrawer({ lead, onClose, onUpdate }: LeadProfileDrawerProps) {
  if (!lead) return null;

  return (
    <Sheet open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto bg-white border-l shadow-2xl p-0">
        <SheetHeader className="p-6 border-b bg-gray-50/50 sticky top-0 z-10">
          <div className="flex justify-between items-center pr-8">
            <SheetTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <div className="w-2 h-8 bg-yellow-400 rounded-full" />
              Lead Profile
            </SheetTitle>
            {lead._dirty && (
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 animate-pulse">
                Unsaved Changes
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="p-8 space-y-8">
          {/* Section: Primary Identity */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Primary Details</h3>
            <div className="grid grid-cols-1 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">Full Name</label>
                <Input
                  value={lead.name}
                  onChange={(e) => onUpdate(lead.id, { name: e.target.value })}
                  className="bg-white border-gray-200 focus:ring-yellow-400 focus:border-yellow-400"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">Company / Organization</label>
                <div className="relative">
                  <Input
                    value={lead.company}
                    onChange={(e) => onUpdate(lead.id, { company: e.target.value })}
                    className="bg-white border-gray-200 pl-9"
                    placeholder="E8 Productions"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <FileText className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Pipeline Status */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Pipeline Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">Lead Stage</label>
                <select
                  value={lead.status}
                  onChange={(e) => onUpdate(lead.id, { status: e.target.value })}
                  className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  {LEAD_STATUSES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">Snapchat Show</label>
                <select
                  value={lead.snapchatShow}
                  onChange={(e) => onUpdate(lead.id, { snapchatShow: e.target.value as SnapchatShow })}
                  className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  {SNAPCHAT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Financials & Attribution */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Value & Source</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">Estimated Value (£)</label>
                <div className="relative">
                  <Input
                    type="number"
                    value={lead.value || ''}
                    onChange={(e) => onUpdate(lead.id, { value: e.target.value ? parseFloat(e.target.value) : null })}
                    className="bg-white border-gray-200 pl-8"
                    placeholder="0.00"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">
                    £
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">Lead Source</label>
                <Input
                  value={lead.source}
                  onChange={(e) => onUpdate(lead.id, { source: e.target.value })}
                  className="bg-white border-gray-200"
                  placeholder="Referral, Ads, etc."
                />
              </div>
            </div>
          </div>

          {/* Section: Contact Info */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Contact Channels</h3>
            <div className="space-y-3 bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                  <Mail className="h-4 w-4" />
                </div>
                <Input
                  value={lead.email}
                  onChange={(e) => onUpdate(lead.id, { email: e.target.value })}
                  className="flex-1 bg-white border-blue-200"
                  placeholder="email@example.com"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Phone className="h-4 w-4" />
                </div>
                <Input
                  value={lead.phone}
                  onChange={(e) => onUpdate(lead.id, { phone: e.target.value })}
                  className="flex-1 bg-white border-emerald-200"
                  placeholder="+44 7..."
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
                  <Instagram className="h-4 w-4" />
                </div>
                <Input
                  value={lead.socials}
                  onChange={(e) => onUpdate(lead.id, { socials: e.target.value })}
                  className="flex-1 bg-white border-pink-200"
                  placeholder="@handle"
                />
              </div>
            </div>
          </div>

          {/* Section: Comprehensive Notes */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Engagement Notes</h3>
            <Textarea
              value={lead.notes}
              onChange={(e) => onUpdate(lead.id, { notes: e.target.value })}
              className="min-h-[150px] bg-white border-gray-200 focus:ring-yellow-400"
              placeholder="Detailed activity log, preferences, background info..."
            />
          </div>

          {/* Timestamps */}
          <div className="pt-6 border-t border-gray-100 grid grid-cols-2 gap-4 text-[10px] font-medium text-gray-400 uppercase tracking-tighter">
            <div className="bg-gray-50 p-2 rounded flex flex-col items-center justify-center">
              <span>Created</span>
              <span className="text-gray-600 font-bold">{lead.createdAt ? formatToEST(lead.createdAt).split(',')[0] : 'Today'}</span>
            </div>
            <div className="bg-gray-50 p-2 rounded flex flex-col items-center justify-center">
              <span>Last Sync</span>
              <span className="text-gray-600 font-bold">{lead.updatedAt ? formatToEST(lead.updatedAt) : 'Pending'}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SalesDashboard() {
  const [leads, setLeads] = useState<Lead[]>([emptyDraftLead()]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [emailModal, setEmailModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [notesModal, setNotesModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
            name: lead.name,
            company: lead.company,
            email: lead.email,
            phone: lead.phone,
            socials: lead.socials,
            status: lead.status,
            source: lead.source,
            value: lead.value,
            snapchatShow: lead.snapchatShow,
            igDm: lead.igDm,
            dmPlatform: lead.dmPlatform,
            meetingBooked: lead.meetingBooked,
            emailed: lead.emailed,
            called: lead.called,
            texted: lead.texted,
            notes: lead.notes,
            emailTemplate: lead.emailTemplate,
            dmAt: lead.dmAt,
            meetingAt: lead.meetingAt,
            emailedAt: lead.emailedAt,
            calledAt: lead.calledAt,
            textedAt: lead.textedAt,
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
            name: lead.name,
            company: lead.company,
            email: lead.email,
            phone: lead.phone,
            socials: lead.socials,
            status: lead.status,
            source: lead.source,
            value: lead.value,
            snapchatShow: lead.snapchatShow,
            igDm: lead.igDm,
            dmPlatform: lead.dmPlatform,
            meetingBooked: lead.meetingBooked,
            emailed: lead.emailed,
            called: lead.called,
            texted: lead.texted,
            notes: lead.notes,
            emailTemplate: lead.emailTemplate,
            dmAt: lead.dmAt,
            meetingAt: lead.meetingAt,
            emailedAt: lead.emailedAt,
            calledAt: lead.calledAt,
            textedAt: lead.textedAt,
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
    const headers = ['Name', 'Email', 'Socials', 'Snapchat Show', 'Social DM', 'Meeting', 'Emailed', 'Called', 'Texted', 'Notes', 'Email Template'];
    const rows = saved.map(l => [
      l.name, l.email, l.socials, l.snapchatShow || '—',
      l.igDm ? 'Yes' : 'No', l.meetingBooked ? 'Yes' : 'No',
      l.emailed ? 'Yes' : 'No', l.called ? 'Yes' : 'No', l.texted ? 'Yes' : 'No',
      `"${l.notes.replace(/"/g, '""')}"`,
      `"${l.emailTemplate.replace(/"/g, '""')}"`,
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
          {/* <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="h-4 w-4" />
            Export CSV
          </Button> */}
          <Button size="sm" onClick={addRow} className="gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white">
            <Plus className="h-4 w-4" />
            Add Row
          </Button>
        </div>
      </div>

      {/* ── Stats (saved leads only) ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Saved Leads', value: stats.total, color: 'text-gray-800', bg: 'bg-gray-50 border-gray-200' },
          { label: 'Contacted', value: stats.contacted, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Meetings Booked', value: stats.meetings, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Snapchat Show: Yes', value: stats.snapYes, color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
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
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                <th className="px-3 py-2.5 text-center text-[10px] font-bold border-r border-gray-200 w-10">#</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-44">Name</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-32">Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-44">Email</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-36">Socials</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-32">
                  DM Platform
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-16">Meet</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-16">Email</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-16">Call</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-16">Text</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 w-32">Notes</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-bold w-12 text-gray-400">Actions</th>
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
                  const isDraft = !lead._saved;
                  const isDirty = lead._saved && lead._dirty;
                  const isSaved = lead._saved && !lead._dirty;
                  const isWorking = lead._committing;

                  return (
                    <Fragment key={lead.id}>
                      <tr
                        className={cn(
                          'group transition-colors border-b border-gray-100',
                          isDraft && 'bg-amber-50/60 hover:bg-amber-50',
                          isDirty && 'bg-blue-50/40 hover:bg-blue-50/60',
                          isSaved && 'bg-white hover:bg-yellow-50/30',
                          expandedRows.has(lead.id) && 'bg-yellow-50/50'
                        )}
                      >
                        {/* Expand / # */}
                        <td className="px-3 py-2 text-center text-xs border-r border-gray-100 select-none">
                          <div className="flex items-center flex-col gap-1">
                            {lead._saved && (
                              <button onClick={() => toggleRow(lead.id)} className="hover:text-amber-600">
                                <ChevronRight className={cn('h-3 w-3 transition-transform', expandedRows.has(lead.id) && 'rotate-90')} />
                              </button>
                            )}
                            {isWorking ? <Loader2 className="h-3 w-3 animate-spin text-gray-400" /> : <span className="text-[10px] text-gray-300 font-mono">{idx + 1}</span>}
                          </div>
                        </td>

                        {/* Name */}
                        <td className="border-r border-gray-100 p-0 relative group/cell">
                          <input
                            value={lead.name}
                            onChange={e => updateLead(lead.id, { name: e.target.value })}
                            placeholder="Full name"
                            className="w-full h-full px-3 py-2 bg-transparent outline-none text-sm placeholder:text-gray-200 focus:bg-yellow-50/60 font-medium"
                          />
                          <button
                            onClick={() => setDrawerLead(lead)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm border shadow-sm rounded p-1 hover:text-yellow-600"
                            title="Open Profile"
                          >
                            <InfoIcon className="h-3 w-3" />
                          </button>
                        </td>
                        {/* Status */}
                        <td className="border-r border-gray-100 px-2 py-1.5 overflow-hidden">
                          <select
                            value={lead.status}
                            onChange={e => updateLead(lead.id, { status: e.target.value })}
                            className={cn(
                              "w-full text-[10px] font-bold uppercase tracking-tighter rounded border-none appearance-none flex items-center justify-center h-6 px-2 cursor-pointer transition-colors",
                              LEAD_STATUSES.find(s => s.id === lead.status)?.color || "bg-gray-100 text-gray-600"
                            )}
                          >
                            {LEAD_STATUSES.map(s => (
                              <option key={s.id} value={s.id} className="bg-white text-gray-800 font-sans normal-case">{s.label}</option>
                            ))}
                          </select>
                        </td>
                        {/* Email */}
                        <td className="border-r border-gray-100 p-0">
                          <input
                            value={lead.email}
                            onChange={e => updateLead(lead.id, { email: e.target.value })}
                            placeholder="email@example.com"
                            type="email"
                            className="w-full h-full px-2 py-2 bg-transparent outline-none text-xs placeholder:text-gray-200 focus:bg-yellow-50/60"
                          />
                        </td>
                        {/* Socials */}
                        <td className="border-r border-gray-100 p-0">
                          <input
                            value={lead.socials}
                            onChange={e => updateLead(lead.id, { socials: e.target.value })}
                            placeholder="@handle"
                            className="w-full h-full px-2 py-2 bg-transparent outline-none text-xs placeholder:text-gray-200 focus:bg-yellow-50/60"
                          />
                        </td>

                        {/* Platform + DM Tick */}
                        <td className="border-r border-gray-100 px-2 py-1.5 ">
                          <div className="flex items-center gap-1.5">
                            <TickCell
                              checked={lead.igDm}
                              onChange={v => updateLead(lead.id, { igDm: v, dmPlatform: v ? (lead.dmPlatform || 'instagram') : '' })}
                              icon={Send}
                              activeColor="bg-pink-100 text-pink-600"
                            />
                            <div className="flex-1 min-w-[80px]">
                              <PlatformCell
                                value={lead.dmPlatform}
                                onChange={v => updateLead(lead.id, { dmPlatform: v, igDm: !!v })}
                                disabled={!lead.igDm}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Meeting */}
                        <td className="border-r border-gray-100 px-1 py-1.5">
                          <TickCell checked={lead.meetingBooked} onChange={v => updateLead(lead.id, { meetingBooked: v })} icon={Check} activeColor="bg-green-100 text-green-600" />
                        </td>
                        {/* Emailed */}
                        <td className="border-r border-gray-100 px-1 py-1.5">
                          <TickCell checked={lead.emailed} onChange={v => updateLead(lead.id, { emailed: v })} icon={Mail} activeColor="bg-blue-100 text-blue-600" />
                        </td>
                        {/* Called */}
                        <td className="border-r border-gray-100 px-1 py-1.5">
                          <TickCell checked={lead.called} onChange={v => updateLead(lead.id, { called: v })} icon={Phone} activeColor="bg-emerald-100 text-emerald-600" />
                        </td>
                        {/* Texted */}
                        <td className="border-r border-gray-100 px-1 py-1.5">
                          <TickCell checked={lead.texted} onChange={v => updateLead(lead.id, { texted: v })} icon={MessageSquare} activeColor="bg-purple-100 text-purple-600" />
                        </td>

                        {/* Notes Snippet */}
                        <td className="border-r border-gray-100 px-2 py-1.5">
                          <button
                            onClick={() => setNotesModal({ open: true, lead })}
                            className={cn(
                              'w-full text-left text-[10px] px-2 py-1.5 rounded-md border transition-colors truncate',
                              lead.notes
                                ? 'border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100'
                                : 'border-gray-50 bg-gray-50/50 text-gray-300 hover:bg-gray-100'
                            )}
                          >
                            {lead.notes ? lead.notes : '+ Notes'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-2 py-1.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {isWorking ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            ) : isSaved ? (
                              <button onClick={() => deleteRow(lead.id)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            ) : (
                              <button
                                onClick={() => commitRow(lead.id)}
                                className={cn(
                                  'p-1.5 rounded-md border transition-all',
                                  isDirty
                                    ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 shadow-sm'
                                    : 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100 shadow-sm'
                                )}
                              >
                                {isDirty ? <RefreshCw className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded View ── */}
                      {expandedRows.has(lead.id) && (
                        <tr className="bg-yellow-50/30">
                          <td colSpan={13} className="px-6 py-4 border-b border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Left: Metadata */}
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <HistoryIcon className="h-3 w-3" /> Timestamps
                                  </p>
                                  <div className="bg-white p-3 rounded-lg border border-yellow-200/50 space-y-2">
                                    <p className="text-xs flex justify-between">
                                      <span className="text-gray-400">Added:</span>
                                      <span className="font-medium">{lead.createdAt ? formatToEST(lead.createdAt) : 'Just now'}</span>
                                    </p>
                                    <p className="text-xs flex justify-between">
                                      <span className="text-gray-400">Last Sync:</span>
                                      <span className="font-medium text-yellow-700/60">{lead.updatedAt ? formatToEST(lead.updatedAt) : 'Pending'}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <HistoryIcon className="h-3 w-3" /> Manual Contact Timing
                                  </p>
                                  <div className="bg-white p-3 rounded-lg border border-yellow-200/50 grid grid-cols-1 gap-3">
                                    <ManualTimeCell
                                      label="Social DM At"
                                      value={lead.dmAt}
                                      onChange={v => updateLead(lead.id, { dmAt: v })}
                                    />
                                    <ManualTimeCell
                                      label="Meeting At"
                                      value={lead.meetingAt}
                                      onChange={v => updateLead(lead.id, { meetingAt: v })}
                                    />
                                    <ManualTimeCell
                                      label="Emailed At"
                                      value={lead.emailedAt}
                                      onChange={v => updateLead(lead.id, { emailedAt: v })}
                                    />
                                    <ManualTimeCell
                                      label="Called At"
                                      value={lead.calledAt}
                                      onChange={v => updateLead(lead.id, { calledAt: v })}
                                    />
                                    <ManualTimeCell
                                      label="Texted At"
                                      value={lead.textedAt}
                                      onChange={v => updateLead(lead.id, { textedAt: v })}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <LinkIcon className="h-3 w-3" /> Quick Actions
                                  </p>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="text-xs h-7 bg-white" onClick={() => setEmailModal({ open: true, lead })}>
                                      <Mail className="h-3 w-3 mr-1" /> Edit Email Temp
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-xs h-7 bg-white" onClick={() => setNotesModal({ open: true, lead })}>
                                      <FileText className="h-3 w-3 mr-1" /> Edit Notes
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Center: Detailed Notes */}
                              <div className="md:col-span-2 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                      <InfoIcon className="h-3 w-3" /> Detailed Notes
                                    </p>
                                    <div className="bg-white p-3 rounded-lg border border-yellow-200/50 min-h-[100px] text-xs leading-relaxed text-gray-600 whitespace-pre-wrap italic">
                                      {lead.notes || 'No notes added yet...'}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                      <Mail className="h-3 w-3" /> Current Email Template
                                    </p>
                                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 min-h-[100px] text-xs leading-relaxed text-blue-800/80 whitespace-pre-wrap font-mono">
                                      {lead.emailTemplate || 'Default template will be used...'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
      <LeadProfileDrawer
        lead={drawerLead}
        onClose={() => setDrawerLead(null)}
        onUpdate={updateLead}
      />
    </div>
  );
}
