'use client';

import { useState, useRef, useEffect, useCallback, Fragment, useMemo, memo, useDeferredValue } from 'react';
import {
  X, Check, ChevronRight, Send, Link as LinkIcon, Info as InfoIcon,
  History as HistoryIcon, Clock, Loader2, RefreshCw, Plus, Trash2,
  Download, Search, ChevronDown, Mail, Phone, MessageSquare, FileText,
  UploadCloud, Instagram, Eye, EyeOff, GripVertical, Flag, ChevronUp,
  Settings2, Columns3, Sparkles, Zap
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  socials: string;
  instagram: boolean;
  facebook: boolean;
  linkedin: boolean;
  twitter: boolean;
  tiktok: boolean;
  status: string;
  source: string;
  value: number | null;
  priority: string;
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
  createdAt?: string;
  updatedAt?: string;
  // Local UI-only fields
  _saved?: boolean;
  _dirty?: boolean;
  _committing?: boolean;
}

interface SalesColumn {
  id: string;
  name: string;
  label: string;
  type: string;
  width?: string;
  order: number;
  isVisible: boolean;
  isCustom: boolean;
}

interface ColumnDef {
  id: string;
  label: string;
  width: string;
  align?: 'left' | 'center' | 'right';
  sticky?: boolean;
  minPx?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tempId() {
  return '__tmp_' + Math.random().toString(36).slice(2, 10);
}

function emptyDraftLead(status = 'NEW'): Lead {
  return {
    id: tempId(),
    name: '', company: '', email: '', phone: '', socials: '',
    instagram: false, facebook: false, linkedin: false, twitter: false, tiktok: false,
    status, source: '', value: null, priority: '',
    meetingBooked: false, emailed: false,
    called: false, texted: false, notes: '', emailTemplate: '',
    dmAt: undefined, meetingAt: undefined, emailedAt: undefined,
    calledAt: undefined, textedAt: undefined,
    _saved: false, _dirty: false, _committing: false,
  };
}

function dbLeadToLocal(l: any): Lead {
  return {
    id: l.id, name: l.name, company: l.company || '', email: l.email,
    phone: l.phone || '', socials: l.socials || '',
    instagram: !!l.instagram, facebook: !!l.facebook,
    linkedin: !!l.linkedin, twitter: !!l.twitter, tiktok: !!l.tiktok,
    status: l.status || 'NEW',
    source: l.source || '', value: l.value || null, priority: l.priority || '',
    meetingBooked: l.meetingBooked, emailed: l.emailed,
    called: l.called, texted: l.texted,
    notes: l.notes, emailTemplate: l.emailTemplate,
    dmAt: l.dmAt, meetingAt: l.meetingAt, emailedAt: l.emailedAt,
    calledAt: l.calledAt, textedAt: l.textedAt,
    createdAt: l.createdAt, updatedAt: l.updatedAt,
    metadata: l.metadata || {},
    _saved: true, _dirty: false, _committing: false,
  };
}

function formatToEST(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

// ─── Monday.com Constants ─────────────────────────────────────────────────────

const STATUS_GROUPS = [
  { id: 'NEW', label: 'New', color: '#579BFC', bg: 'bg-[#579BFC]', text: 'text-white' },
  { id: 'CONTACTED', label: 'Contacted', color: '#FDAB3D', bg: 'bg-[#FDAB3D]', text: 'text-white' },
  { id: 'WORKING', label: 'Working', color: '#A25DDC', bg: 'bg-[#A25DDC]', text: 'text-white' },
  { id: 'QUALIFIED', label: 'Qualified', color: '#00C875', bg: 'bg-[#00C875]', text: 'text-white' },
  { id: 'WON', label: 'Won', color: '#037F4C', bg: 'bg-[#037F4C]', text: 'text-white' },
  { id: 'LOST', label: 'Lost', color: '#E2445C', bg: 'bg-[#E2445C]', text: 'text-white' },
];

const PRIORITY_OPTIONS = [
  { id: 'critical', label: 'Critical ⚡', color: '#333333', bg: 'bg-[#333333]', text: 'text-white' },
  { id: 'high', label: 'High', color: '#E2445C', bg: 'bg-[#E2445C]', text: 'text-white' },
  { id: 'medium', label: 'Medium', color: '#FDAB3D', bg: 'bg-[#FDAB3D]', text: 'text-white' },
  { id: 'low', label: 'Low', color: '#579BFC', bg: 'bg-[#579BFC]', text: 'text-white' },
  { id: '', label: '—', color: '#C4C4C4', bg: 'bg-[#C4C4C4]', text: 'text-white' },
];

const DM_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
  { id: 'twitter', label: 'Twitter', color: '#1DA1F2' },
  { id: 'tiktok', label: 'TikTok', color: '#000000' },
  { id: 'other', label: 'Other', color: '#6B7280' },
];

const CORE_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Lead', width: 'min-w-[220px] w-[220px]', sticky: true, minPx: 220 },
  { id: 'company', label: 'Company', width: 'min-w-[220px] w-[220px]', minPx: 220 },
  { id: 'status', label: 'Status', width: 'min-w-[130px] w-[130px]', align: 'center', minPx: 130 },
  { id: 'priority', label: 'Priority', width: 'min-w-[120px] w-[120px]', align: 'center', minPx: 120 },
  { id: 'email', label: 'Email', width: 'min-w-[180px] w-[180px]', minPx: 180 },
  { id: 'phone', label: 'Phone', width: 'min-w-[140px] w-[140px]', minPx: 140 },
  { id: 'socials', label: 'Socials', width: 'min-w-[160px] w-[160px]', minPx: 160 },
  { id: 'value', label: 'Deal Value', width: 'min-w-[110px] w-[110px]', align: 'center', minPx: 110 },
  { id: 'source', label: 'Source', width: 'min-w-[120px] w-[120px]', minPx: 120 },
  { id: 'activity', label: 'Activity', width: 'min-w-[160px] w-[160px]', minPx: 160 },
  { id: 'notes', label: 'Notes', width: 'min-w-[120px] w-[120px]', align: 'center', minPx: 120 },
];

const ALL_COLUMNS = CORE_COLUMNS; // For backward compatibility in some utility parts

const DEFAULT_EMAIL_TEMPLATES = [
  {
    name: 'Introduction',
    body: `Hi {name},\n\nI wanted to reach out from E8 Productions. We specialize in creating premium content for brands looking to level up their social media presence.\n\nWould love to chat about how we can help your brand grow.\n\nBest,\n[Your Name]`,
  },
  {
    name: 'Follow-up',
    body: `Hi {name},\n\nJust following up on my previous message. I'd love to schedule a quick call to discuss how E8 Productions can help with your content needs.\n\nLet me know if you have 15 minutes this week!\n\nBest,\n[Your Name]`,
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/* Status Pill — Monday.com style colored dropdown */
function StatusPill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = STATUS_GROUPS.find(s => s.id === value) || STATUS_GROUPS[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full h-[30px] rounded-[3px] text-[13px] font-medium transition-opacity hover:opacity-90 flex items-center justify-center"
          style={{ backgroundColor: current.color, color: '#fff' }}
        >
          {current.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px] p-1.5 space-y-0.5" align="center" sideOffset={4}>
        {STATUS_GROUPS.map(s => (
          <button
            key={s.id}
            onClick={() => { onChange(s.id); setOpen(false); }}
            className="w-full h-[30px] rounded-[3px] text-[13px] font-medium text-white transition-opacity hover:opacity-90 flex items-center justify-center"
            style={{ backgroundColor: s.color }}
          >
            {s.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* Priority Pill — Monday.com flag style */
function PriorityPill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = PRIORITY_OPTIONS.find(p => p.id === value) || PRIORITY_OPTIONS[PRIORITY_OPTIONS.length - 1];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full h-[30px] rounded-[3px] text-[13px] font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-1"
          style={{ backgroundColor: current.color, color: '#fff' }}
        >
          {current.id && <Flag className="h-3 w-3" />}
          {current.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px] p-1.5 space-y-0.5" align="center" sideOffset={4}>
        {PRIORITY_OPTIONS.map(p => (
          <button
            key={p.id}
            onClick={() => { onChange(p.id); setOpen(false); }}
            className="w-full h-[30px] rounded-[3px] text-[13px] font-medium text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1"
            style={{ backgroundColor: p.color }}
          >
            {p.id && <Flag className="h-3 w-3" />}{p.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* Monday.com style check mark */
function MondayTick({ checked, onChange, color = '#00C875' }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-[30px] h-[30px] rounded-[3px] flex items-center justify-center transition-all mx-auto"
      style={{
        backgroundColor: checked ? color : '#F5F6F8',
        border: checked ? 'none' : '1px solid #E6E9EF',
      }}
    >
      {checked && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
    </button>
  );
}

/* Platform selector */
function PlatformSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  if (disabled) return <span className="text-[12px] text-gray-300">—</span>;
  const current = DM_PLATFORMS.find(p => p.id === value);
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-[26px] text-[11px] font-medium bg-transparent border-none outline-none cursor-pointer px-1 rounded"
      style={{ color: current?.color || '#6B7280' }}
    >
      <option value="">Select</option>
      {DM_PLATFORMS.map(p => (
        <option key={p.id} value={p.id}>{p.label}</option>
      ))}
    </select>
  );
}

// ─── Social Cell ─────────────────────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'IG', fullLabel: 'Instagram', color: '#E1306C' },
  { id: 'facebook', label: 'FB', fullLabel: 'Facebook', color: '#1877F2' },
  { id: 'linkedin', label: 'LI', fullLabel: 'LinkedIn', color: '#0A66C2' },
  { id: 'twitter', label: 'X', fullLabel: 'Twitter / X', color: '#1DA1F2' },
  { id: 'tiktok', label: 'TT', fullLabel: 'TikTok', color: '#010101' },
  { id: 'youtube', label: 'YT', fullLabel: 'YouTube', color: '#FF0000' },
  { id: 'other', label: '•••', fullLabel: 'Other', color: '#6B7280' },
];

function parseSocials(raw: string): Array<{ platform: string; url: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return raw.trim() ? [{ platform: 'other', url: raw.trim() }] : [];
}

function SocialCell({ value, onUpdate }: {
  value: string;
  onUpdate: (patch: { socials: string; instagram: boolean; facebook: boolean; linkedin: boolean; twitter: boolean; tiktok: boolean }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState('instagram');
  const [newUrl, setNewUrl] = useState('');

  const entries = parseSocials(value);

  const commit = (newEntries: Array<{ platform: string; url: string }>) => {
    onUpdate({
      socials: JSON.stringify(newEntries),
      instagram: newEntries.some(e => e.platform === 'instagram'),
      facebook: newEntries.some(e => e.platform === 'facebook'),
      linkedin: newEntries.some(e => e.platform === 'linkedin'),
      twitter: newEntries.some(e => e.platform === 'twitter'),
      tiktok: newEntries.some(e => e.platform === 'tiktok'),
    });
  };

  const addEntry = () => {
    if (!newUrl.trim()) return;
    commit([...entries, { platform: newPlatform, url: newUrl.trim() }]);
    setNewUrl('');
  };

  const removeEntry = (idx: number) => {
    commit(entries.filter((_, i) => i !== idx));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-[30px] px-1.5 flex items-center gap-1 bg-transparent hover:bg-[#F5F6F8] rounded text-left overflow-hidden">
          {entries.length === 0 ? (
            <span className="text-[11px] text-gray-300">+ Add</span>
          ) : (
            <>
              {entries.slice(0, 4).map((e, i) => {
                const p = SOCIAL_PLATFORMS.find(p => p.id === e.platform);
                return (
                  <span key={i}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: p?.color || '#6B7280' }}
                    title={e.url}>
                    {p?.label || '?'}
                  </span>
                );
              })}
              {entries.length > 4 && (
                <span className="text-[10px] text-gray-400 ml-0.5">+{entries.length - 4}</span>
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-3 space-y-2.5" align="start" sideOffset={4}>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Social Links</p>

        {entries.length === 0 && (
          <p className="text-[12px] text-gray-400 italic">No socials added yet.</p>
        )}

        {entries.map((e, i) => {
          const p = SOCIAL_PLATFORMS.find(p => p.id === e.platform);
          return (
            <div key={i} className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-[28px] h-[22px] rounded text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: p?.color || '#6B7280' }}>
                {p?.label || '?'}
              </span>
              <input
                value={e.url}
                onChange={ev => {
                  const updated = entries.map((entry, idx) => idx === i ? { ...entry, url: ev.target.value } : entry);
                  commit(updated);
                }}
                className="flex-1 h-7 text-[12px] border border-gray-200 rounded px-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA] min-w-0"
              />
              <button
                onClick={() => removeEntry(i)}
                className="shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-100">
          <select value={newPlatform} onChange={e => setNewPlatform(e.target.value)}
            className="h-7 text-[11px] border border-gray-200 rounded px-1 bg-white w-[90px] shrink-0">
            {SOCIAL_PLATFORMS.map(p => (
              <option key={p.id} value={p.id}>{p.fullLabel}</option>
            ))}
          </select>
          <input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEntry(); } }}
            placeholder="URL or @handle"
            className="flex-1 h-7 text-[12px] border border-gray-200 rounded px-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA] min-w-0" />
          <button onClick={addEntry}
            className="h-7 w-7 flex items-center justify-center bg-[#0073EA] hover:bg-[#0060C0] text-white rounded shrink-0">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Activity Cell ────────────────────────────────────────────────────────────

const ACTIVITY_TYPES = [
  { id: 'meeting', label: 'Mtg', fullLabel: 'Meeting', color: '#00C875', icon: '🤝' },
  { id: 'email',   label: 'Email', fullLabel: 'Email',   color: '#579BFC', icon: '✉️' },
  { id: 'call',    label: 'Call', fullLabel: 'Call',    color: '#FDAB3D', icon: '📞' },
  { id: 'text',    label: 'Text', fullLabel: 'Text',    color: '#A25DDC', icon: '💬' },
];

interface ActivityEntry {
  type: string;
  time: string;   // ISO string
  location: string;
}

function parseActivities(raw?: string | ActivityEntry[]): ActivityEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw as string);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function ActivityCell({ value, onUpdate }: {
  value: ActivityEntry[];
  onUpdate: (patch: Partial<Lead>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newType, setNewType] = useState('call');
  const [newTime, setNewTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [newLocation, setNewLocation] = useState('');

  const entries = value;

  const commit = (next: ActivityEntry[]) => {
    onUpdate({
      metadata: { __activities: next },
      meetingBooked: next.some(e => e.type === 'meeting'),
      emailed:       next.some(e => e.type === 'email'),
      called:        next.some(e => e.type === 'call'),
      texted:        next.some(e => e.type === 'text'),
      meetingAt:     next.filter(e => e.type === 'meeting').at(-1)?.time,
      emailedAt:     next.filter(e => e.type === 'email').at(-1)?.time,
      calledAt:      next.filter(e => e.type === 'call').at(-1)?.time,
      textedAt:      next.filter(e => e.type === 'text').at(-1)?.time,
    });
  };

  const addEntry = () => {
    commit([...entries, { type: newType, time: new Date(newTime).toISOString(), location: newLocation.trim() }]);
    setNewLocation('');
    setNewTime(new Date().toISOString().slice(0, 16));
  };

  const removeEntry = (idx: number) => commit(entries.filter((_, i) => i !== idx));

  // Show up to 3 type pills in the cell
  const typeCounts = ACTIVITY_TYPES.map(at => ({ ...at, count: entries.filter(e => e.type === at.id).length })).filter(a => a.count > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-[30px] px-1.5 flex items-center gap-1 bg-transparent hover:bg-[#F5F6F8] rounded text-left overflow-hidden">
          {typeCounts.length === 0 ? (
            <span className="text-[11px] text-gray-300">+ Log</span>
          ) : (
            <>
              {typeCounts.slice(0, 3).map((a) => (
                <span key={a.id}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: a.color }}>
                  {a.label}{a.count > 1 ? ` ×${a.count}` : ''}
                </span>
              ))}
              {typeCounts.length > 3 && <span className="text-[10px] text-gray-400">+{typeCounts.length - 3}</span>}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3 space-y-2.5" align="start" sideOffset={4}>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Activity Log</p>

        {entries.length === 0 && (
          <p className="text-[12px] text-gray-400 italic">No activity logged yet.</p>
        )}

        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {entries.map((e, i) => {
            const at = ACTIVITY_TYPES.find(a => a.id === e.type);
            return (
              <div key={i} className="flex items-start gap-1.5 text-[12px]">
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0 mt-0.5"
                  style={{ backgroundColor: at?.color || '#6B7280' }}>
                  {at?.label || e.type}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-600 text-[11px]">
                    {new Date(e.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                  </div>
                  {e.location && <div className="text-gray-400 text-[11px] truncate">{e.location}</div>}
                </div>
                <button onClick={() => removeEntry(i)}
                  className="shrink-0 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors mt-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-gray-100 space-y-1.5">
          <div className="flex gap-1.5">
            <select value={newType} onChange={e => setNewType(e.target.value)}
              className="h-7 text-[11px] border border-gray-200 rounded px-1 bg-white w-[90px] shrink-0">
              {ACTIVITY_TYPES.map(a => <option key={a.id} value={a.id}>{a.fullLabel}</option>)}
            </select>
            <input type="datetime-local" value={newTime} onChange={e => setNewTime(e.target.value)}
              className="flex-1 h-7 text-[11px] border border-gray-200 rounded px-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA] min-w-0" />
          </div>
          <div className="flex gap-1.5">
            <input value={newLocation} onChange={e => setNewLocation(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEntry(); } }}
              placeholder="Location or notes (optional)"
              className="flex-1 h-7 text-[12px] border border-gray-200 rounded px-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#0073EA]" />
            <button onClick={addEntry}
              className="h-7 w-7 flex items-center justify-center bg-[#0073EA] hover:bg-[#0060C0] text-white rounded shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* Manual time cell for expanded view */
function ManualTimeCell({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    if (value) {
      try {
        const d = new Date(value);
        const est = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        setDate(est.toISOString().slice(0, 10));
        let h = est.getHours(); const m = est.getMinutes();
        setAmpm(h >= 12 ? 'PM' : 'AM');
        h = h % 12 || 12;
        setTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      } catch { /* ignore */ }
    }
  }, [value]);

  const commit = (d: string, t: string, ap: 'AM' | 'PM') => {
    if (!d) return;
    const [hh, mm] = t.split(':').map(Number);
    let hour24 = ap === 'PM' ? (hh === 12 ? 12 : hh + 12) : (hh === 12 ? 0 : hh);
    const utc = new Date(`${d}T${String(hour24).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-05:00`);
    onChange(utc.toISOString());
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-gray-500">{label}</p>
      <div className="flex items-center gap-1.5">
        <input type="date" value={date} onChange={e => { setDate(e.target.value); commit(e.target.value, time, ampm); }}
          className="h-7 text-[11px] border border-gray-200 rounded px-1.5 bg-white" />
        <input type="time" value={time} onChange={e => { setTime(e.target.value); commit(date, e.target.value, ampm); }}
          className="h-7 text-[11px] border border-gray-200 rounded px-1.5 bg-white w-[80px]" />
        <select value={ampm} onChange={e => { const v = e.target.value as 'AM' | 'PM'; setAmpm(v); commit(date, time, v); }}
          className="h-7 text-[11px] border border-gray-200 rounded px-1 bg-white">
          <option>AM</option><option>PM</option>
        </select>
      </div>
    </div>
  );
}

// ─── Email Template Modal ─────────────────────────────────────────────────────

function EmailTemplateModal({ open, lead, onClose, onSave }: {
  open: boolean; lead: Lead | null; onClose: () => void;
  onSave: (id: string, body: string) => void;
}) {
  const [body, setBody] = useState('');
  useEffect(() => { if (lead) setBody(lead.emailTemplate || ''); }, [lead]);
  if (!lead) return null;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="text-lg">Email Template — {lead.name || 'Untitled'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            {DEFAULT_EMAIL_TEMPLATES.map(t => (
              <Button key={t.name} size="sm" variant="outline" className="text-xs"
                onClick={() => setBody(t.body.replace('{name}', lead.name || 'there'))}>
                {t.name}
              </Button>
            ))}
          </div>
          <Textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
            className="font-mono text-xs" placeholder="Write your email template..." />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => { onSave(lead.id, body); onClose(); }}
              className="bg-[#0073EA] hover:bg-[#0060C0] text-white">Save Template</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Notes Modal ──────────────────────────────────────────────────────────────

function NotesModal({ open, lead, onClose, onSave }: {
  open: boolean; lead: Lead | null; onClose: () => void;
  onSave: (id: string, notes: string) => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => { if (lead) setText(lead.notes || ''); }, [lead]);
  if (!lead) return null;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="text-lg">Notes — {lead.name || 'Untitled'}</DialogTitle></DialogHeader>
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={8}
          className="text-sm" placeholder="Add notes about this lead..." />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onSave(lead.id, text); onClose(); }}
            className="bg-[#0073EA] hover:bg-[#0060C0] text-white">Save Notes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mass Email Modal ─────────────────────────────────────────────────────────

function MassEmailModal({ open, selectedLeads, leads, onClose, onSent }: {
  open: boolean;
  selectedLeads: Set<string>;
  leads: Lead[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState('Checking in - E8 Productions');
  const [body, setBody] = useState('Hi {name},\n\nHope you are doing well!\n\nBest,\nYour Name');
  const [sending, setSending] = useState(false);

  const selectedCount = selectedLeads.size;

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and body are required');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/sales-leads/bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: Array.from(selectedLeads),
          subject,
          body
        })
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Sent ${data.results.success} emails successfully!`);
        if (data.results.failed > 0) {
          toast.warning(`${data.results.failed} emails failed. Check console for details.`);
          console.error('Bulk email errors:', data.results.errors);
        }
        onSent();
        onClose();
      } else {
        throw new Error(data.message || 'Failed to send bulk emails');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send bulk emails');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Mail className="h-5 w-5" />
            </div>
            Send Mass Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex items-start gap-3">
            <InfoIcon className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Recipients: {selectedCount} leads selected</p>
              <p className="text-blue-600/80 text-[12px]">Use <code className="bg-blue-100 px-1 rounded">{"{name}"}</code> or <code className="bg-blue-100 px-1 rounded">{"{company}"}</code> to personalize your message.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Subject Line</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email Subject..." className="h-10" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Message Body</label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={12}
              className="font-sans text-[13px] leading-relaxed resize-none p-4"
              placeholder="Write your message here..."
            />
          </div>
        </div>

        <div className="flex justify-between items-center bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-lg border-t">
          <div className="text-[11px] text-gray-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis mr-4">
            Emails sent via professional SMTP.
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2 font-bold min-w-[120px]"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send Now</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lead Profile Drawer ──────────────────────────────────────────────────────

function LeadProfileDrawer({ lead, onClose, onUpdate }: {
  lead: Lead | null; onClose: () => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
}) {
  if (!lead) return null;
  return (
    <Sheet open={!!lead} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto p-0 border-l-4"
        style={{ borderLeftColor: STATUS_GROUPS.find(s => s.id === lead.status)?.color || '#579BFC' }}>
        <SheetHeader className="p-6 pb-4 border-b bg-gray-50/80">
          <div className="flex justify-between items-center pr-8">
            <SheetTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <div className="w-2 h-8 rounded-full" style={{ backgroundColor: STATUS_GROUPS.find(s => s.id === lead.status)?.color }} />
              Lead Profile
            </SheetTitle>
            {lead._committing && (
              <div className="flex items-center gap-1.5 text-[#0073EA] text-xs font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </div>
            )}
            {lead._dirty && !lead._committing && (
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 animate-pulse text-xs">Saving soon…</Badge>
            )}
            {!lead._dirty && !lead._committing && lead._saved && (
              <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs"><Check className="h-3 w-3 mr-1" />Saved</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Identity */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Details</h3>
            <div className="space-y-2 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500">Full Name</label>
                <Input value={lead.name} onChange={e => onUpdate(lead.id, { name: e.target.value })}
                  className="h-9 text-sm bg-white" placeholder="John Doe" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500">Company</label>
                <Input value={lead.company} onChange={e => onUpdate(lead.id, { company: e.target.value })}
                  className="h-9 text-sm bg-white" placeholder="Acme Inc." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500">Email</label>
                  <Input value={lead.email} onChange={e => onUpdate(lead.id, { email: e.target.value })}
                    className="h-9 text-sm bg-white" placeholder="email@example.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500">Phone</label>
                  <Input value={lead.phone} onChange={e => onUpdate(lead.id, { phone: e.target.value })}
                    className="h-9 text-sm bg-white" placeholder="+1 ..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500">Social Handles</label>
                  <Input value={lead.socials} onChange={e => onUpdate(lead.id, { socials: e.target.value })}
                    className="h-9 text-sm bg-white" placeholder="@instagram, facebook.com/..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500">Source</label>
                  <Input value={lead.source} onChange={e => onUpdate(lead.id, { source: e.target.value })}
                    className="h-9 text-sm bg-white" placeholder="Referral, Ads..." />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500">Deal Value ($)</label>
                <Input type="number" value={lead.value ?? ''} onChange={e => onUpdate(lead.id, { value: e.target.value ? parseFloat(e.target.value) : null })}
                  className="h-9 text-sm bg-white" placeholder="0" />
              </div>
            </div>
          </div>

          {/* Pipeline */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pipeline</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500">Status</label>
                <StatusPill value={lead.status} onChange={v => onUpdate(lead.id, { status: v })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500">Priority</label>
                <PriorityPill value={lead.priority} onChange={v => onUpdate(lead.id, { priority: v })} />
              </div>
            </div>
          </div>

          {/* Contact Actions */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact Actions</h3>
            <div className="grid grid-cols-3 gap-y-4 gap-x-2 text-center p-3 bg-gray-50 rounded-lg border">
              {[
                { label: 'Instagram', checked: lead.instagram, key: 'instagram' as const, color: '#E1306C' },
                { label: 'Facebook', checked: lead.facebook, key: 'facebook' as const, color: '#1877F2' },
                { label: 'LinkedIn', checked: lead.linkedin, key: 'linkedin' as const, color: '#0A66C2' },
                { label: 'Twitter', checked: lead.twitter, key: 'twitter' as const, color: '#1DA1F2' },
                { label: 'TikTok', checked: lead.tiktok, key: 'tiktok' as const, color: '#000000' },
                { label: 'Meet', checked: lead.meetingBooked, key: 'meetingBooked' as const, color: '#00C875' },
                { label: 'Email', checked: lead.emailed, key: 'emailed' as const, color: '#579BFC' },
                { label: 'Call', checked: lead.called, key: 'called' as const, color: '#00C875' },
                { label: 'Text', checked: lead.texted, key: 'texted' as const, color: '#A25DDC' },
              ].map(c => (
                <div key={c.key} className="space-y-1">
                  <MondayTick checked={c.checked} onChange={v => onUpdate(lead.id, { [c.key]: v })} color={c.color} />
                  <p className="text-[10px] text-gray-400 font-medium">{c.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Notes preview */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notes</h3>
            <Textarea value={lead.notes} onChange={e => onUpdate(lead.id, { notes: e.target.value })}
              rows={4} className="text-sm" placeholder="Add notes..." />
          </div>

          {/* Timestamps */}
          {lead._saved && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Timestamps</h3>
              <div className="bg-gray-50 p-3 rounded-lg border text-xs space-y-1.5">
                <p className="flex justify-between"><span className="text-gray-400">Added:</span><span>{lead.createdAt ? formatToEST(lead.createdAt) : '—'}</span></p>
                <p className="flex justify-between"><span className="text-gray-400">Last Sync:</span><span>{lead.updatedAt ? formatToEST(lead.updatedAt) : '—'}</span></p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Column Visibility Toggle ─────────────────────────────────────────────────

function ColumnToggle({
  visible, setVisible, allCols, onAdd, onDelete
}: {
  visible: string[]; setVisible: (v: string[]) => void;
  allCols: any[]; onAdd: (name: string, label: string, type: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCol, setNewCol] = useState({ label: '', type: 'text' });

  const handleAdd = () => {
    if (!newCol.label.trim()) return;
    const name = newCol.label.toLowerCase().replace(/[^a-z0-0]/g, '_') + '_' + Math.random().toString(36).substr(2, 4);
    onAdd(name, newCol.label, newCol.type);
    setNewCol({ label: '', type: 'text' });
    setIsAdding(false);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs border-gray-200 text-gray-600 hover:bg-gray-50 h-8">
          <Columns3 className="h-3.5 w-3.5" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0 overflow-hidden shadow-xl border-gray-200" align="end">
        <div className="p-3 bg-gray-50 border-b">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dashboard Columns</p>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2 space-y-0.5">
          {allCols.map(col => (
            <div key={col.id} className="flex items-center justify-between group/col px-2 py-1.5 rounded hover:bg-gray-50 transition-colors">
              <label className="flex items-center gap-2 flex-1 cursor-pointer text-[13px]">
                <input
                  type="checkbox"
                  checked={visible.includes(col.id)}
                  onChange={() => {
                    setVisible(visible.includes(col.id)
                      ? visible.filter(c => c !== col.id)
                      : [...visible, col.id]);
                  }}
                  className="rounded border-gray-300 text-[#0073EA] focus:ring-[#0073EA]"
                />
                <span className={cn(col.isCustom ? "text-[#0073EA] font-medium" : "text-gray-700")}>{col.label}</span>
              </label>
              {col.isCustom && (
                <button onClick={() => onDelete(col.dbId, col.label)}
                  className="opacity-0 group-hover/col:opacity-100 p-1 text-gray-300 hover:text-red-500 rounded hover:bg-red-50 transition-all">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t bg-white">
          {!isAdding ? (
            <button onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-[#0073EA] hover:bg-blue-50 rounded border border-dashed border-blue-200 transition-colors">
              <Plus className="h-3 w-3" /> ADD CUSTOM COLUMN
            </button>
          ) : (
            <div className="space-y-2">
              <input autoFocus placeholder="Column Name..." value={newCol.label} onChange={e => setNewCol({ ...newCol, label: e.target.value })}
                className="w-full h-8 px-2 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#0073EA]" />
              <select value={newCol.type} onChange={e => setNewCol({ ...newCol, type: e.target.value })}
                className="w-full h-8 px-2 text-[11px] border rounded focus:outline-none bg-gray-50">
                <option value="text">Type: Text</option>
                <option value="number">Type: Number</option>
                <option value="checkbox">Type: Checkbox</option>
              </select>
              <div className="flex gap-1">
                <Button size="sm" className="flex-1 h-7 text-[11px] bg-[#0073EA]" onClick={handleAdd}>Add</Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setIsAdding(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Bulk Action Toolbar ──────────────────────────────────────────────────────

function BulkActionToolbar({ count, onClear, onMassEmail }: { count: number; onClear: () => void; onMassEmail: () => void }) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-md">
        <div className="flex items-center gap-2 border-r border-white/20 pr-4">
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-blue-500/30">
            {count}
          </div>
          <span className="text-sm font-bold tracking-tight">SELECTED</span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onMassEmail} className="bg-blue-600 hover:bg-blue-500 text-white gap-2 font-bold px-4 h-9 shadow-lg shadow-blue-600/20">
            <Mail className="h-4 w-4" />
            Send Mass Email
          </Button>
          <button onClick={onClear} className="text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider px-2 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group Header ─────────────────────────────────────────────────────────────

function GroupHeader({ group, count, collapsed, onToggle, onAddItem, onSelectAll, isAllSelected, colCount }: {
  group: typeof STATUS_GROUPS[0]; count: number; collapsed: boolean;
  onToggle: () => void; onAddItem: () => void;
  onSelectAll: () => void; isAllSelected: boolean;
  colCount: number;
}) {
  return (
    <>
      <td className="w-[40px] px-2 py-2 sticky left-0 z-30 bg-gray-50 border-b border-gray-100" style={{ borderLeft: `3px solid ${group.color}`, transform: 'translateZ(0)' }}>
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={e => { e.stopPropagation(); onSelectAll(); }}
            className="rounded border-gray-300 text-[#0073EA] focus:ring-[#0073EA] cursor-pointer"
          />
        </div>
      </td>
      <td colSpan={colCount + 1} className="px-3 py-2 bg-gray-50 select-none group/gh">
        <div className="flex items-center gap-2">
          <button onClick={onToggle} className="flex items-center gap-1.5 font-semibold text-[15px] hover:opacity-80 transition-opacity"
            style={{ color: group.color }}>
            <ChevronRight className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-90")} />
            {group.label}
            <span className="text-[12px] font-normal text-gray-400 ml-1">
              {count} {count === 1 ? 'item' : 'items'}
            </span>
          </button>
          <button onClick={onAddItem}
            className="opacity-0 group-hover/gh:opacity-100 transition-opacity h-5 w-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
            <Plus className="h-3 w-3 text-gray-500" />
          </button>
        </div>
      </td>
    </>
  );
}

// ─── Summary Row ──────────────────────────────────────────────────────────────

function SummaryRow({ leads, visibleCols, groupColor }: { leads: Lead[]; visibleCols: string[]; groupColor: string }) {
  const saved = leads.filter(l => l._saved);
  if (saved.length === 0) return null;
  return (
    <tr className="bg-gray-50/60 border-t-2" style={{ borderTopColor: groupColor + '40' }}>
      <td className="w-[40px] sticky left-0 z-30 bg-gray-50/60 border-t-2 border-b border-gray-100" style={{ borderLeft: `3px solid ${groupColor}`, transform: 'translateZ(0)' }} />
      <td className="px-3 py-2 text-[11px] font-semibold text-gray-400 sticky left-[40px] bg-gray-50/60 z-10 border-t-2 border-b border-gray-100"
        style={{ boxShadow: '1px 0 0 0 #f3f4f6', transform: 'translateZ(0)' }}>
        {saved.length} {saved.length === 1 ? 'lead' : 'leads'}
      </td>
      {visibleCols.filter(c => c !== 'name').map(colId => (
        <td key={colId} className={cn("px-2 py-2 text-center text-[11px] text-gray-400", colId === 'company' && 'sticky left-[260px] bg-gray-50/60 z-10')}>
          {colId === 'value' ? `$${saved.reduce((s, l) => s + (l.value ?? 0), 0).toLocaleString()}` :
            colId === 'activity' ? (() => { const n = saved.reduce((s, l) => s + parseActivities(l.metadata?.__activities).length, 0); return n || ''; })() :
            colId === 'instagram' ? saved.filter(l => l.instagram).length || '' :
              colId === 'facebook' ? saved.filter(l => l.facebook).length || '' :
                colId === 'linkedin' ? saved.filter(l => l.linkedin).length || '' :
                  colId === 'twitter' ? saved.filter(l => l.twitter).length || '' :
                    colId === 'tiktok' ? saved.filter(l => l.tiktok).length || '' :
                      ''}
        </td>
      ))}
      <td />
    </tr>
  );
}

// ─── Lead Row (memoized — only re-renders when THIS lead changes) ─────────────

interface LeadRowProps {
  lead: Lead;
  isSelected: boolean;
  activeColumns: ColumnDef[];
  customColumns: SalesColumn[];
  groupColor: string;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onOpenNotes: (lead: Lead) => void;
  onOpenDrawer: (lead: Lead) => void;
}

const LeadRow = memo(function LeadRow({
  lead, isSelected, activeColumns, customColumns,
  groupColor, onUpdate, onDelete, onSelect, onOpenNotes, onOpenDrawer,
}: LeadRowProps) {
  const isWorking = lead._committing;
  return (
    <tr className={cn('group hover:bg-[#F0F7FF] transition-colors', isSelected && 'bg-blue-50/50')}>
      <td className="w-[40px] px-0 py-0 sticky left-0 z-30 bg-white group-hover:bg-[#F0F7FF] transition-colors border-b border-gray-100"
        style={{ borderLeft: `3px solid ${groupColor}`, transform: 'translateZ(0)' }}>
        <div className="flex items-center justify-center h-[38px]">
          {lead._saved && (
            <input type="checkbox" checked={isSelected} onChange={() => onSelect(lead.id)}
              className="rounded border-gray-300 text-[#0073EA] focus:ring-[#0073EA] cursor-pointer" />
          )}
        </div>
      </td>
      <td className={cn('px-0 py-0 sticky left-[40px] bg-white group-hover:bg-[#F0F7FF] z-20 transition-colors border-b border-gray-100', CORE_COLUMNS[0].width)}
        style={{ width: 220, minWidth: 220, boxShadow: '1px 0 0 0 #f3f4f6', transform: 'translateZ(0)' }}>
        <div className="flex items-center h-[38px]">
          <input value={lead.name} onChange={e => onUpdate(lead.id, { name: e.target.value })}
            placeholder="+ Add lead" className="flex-1 h-full px-3 bg-transparent outline-none text-[13px] font-medium placeholder:text-gray-300 placeholder:font-normal" />
          <button onClick={() => onOpenDrawer(lead)}
            className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 mr-1 text-gray-400 hover:text-[#0073EA]">
            <InfoIcon className="h-3.5 w-3.5" />
          </button>
          {isWorking && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0073EA] mr-2" />}
        </div>
      </td>
      {activeColumns.filter(c => c.id !== 'name').map(col => (
        <td key={col.id}
          style={col.minPx ? {
            width: col.minPx, minWidth: col.minPx,
            ...(col.id === 'company' ? { boxShadow: '1px 0 0 0 #f3f4f6' } : {})
          } : undefined}
          style={col.minPx ? {
            width: col.minPx, minWidth: col.minPx,
            ...(col.id === 'company' ? { boxShadow: '1px 0 0 0 #f3f4f6', transform: 'translateZ(0)' } : {})
          } : undefined}
          className={cn(
            'px-1.5 py-1 border-b border-gray-100 last:border-r-0',
            col.id === 'company' ? 'sticky left-[260px] bg-white group-hover:bg-[#F0F7FF] z-10' : 'border-r border-gray-100',
            col.width
          )}>
          {col.id === 'company' && (
            <input value={lead.company} onChange={e => onUpdate(lead.id, { company: e.target.value })}
              placeholder="—" className="w-full h-[30px] px-2 bg-transparent outline-none text-[13px] placeholder:text-gray-200 focus:bg-[#F5F6F8] rounded" />
          )}
          {col.id === 'status' && <StatusPill value={lead.status} onChange={v => onUpdate(lead.id, { status: v })} />}
          {col.id === 'priority' && <PriorityPill value={lead.priority} onChange={v => onUpdate(lead.id, { priority: v })} />}
          {col.id === 'email' && (
            <input value={lead.email} onChange={e => onUpdate(lead.id, { email: e.target.value })}
              placeholder="—" type="email" className="w-full h-[30px] px-2 bg-transparent outline-none text-[13px] placeholder:text-gray-200 focus:bg-[#F5F6F8] rounded" />
          )}
          {col.id === 'phone' && (
            <input value={lead.phone} onChange={e => onUpdate(lead.id, { phone: e.target.value })}
              placeholder="—" className="w-full h-[30px] px-2 bg-transparent outline-none text-[13px] placeholder:text-gray-200 focus:bg-[#F5F6F8] rounded" />
          )}
          {col.id === 'socials' && (
            <SocialCell value={lead.socials} onUpdate={patch => onUpdate(lead.id, patch)} />
          )}
          {col.id === 'value' && (
            <input type="number" value={lead.value ?? ''} onChange={e => onUpdate(lead.id, { value: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="$0" className="w-full h-[30px] px-2 bg-transparent outline-none text-[13px] text-center placeholder:text-gray-200 focus:bg-[#F5F6F8] rounded" />
          )}
          {col.id === 'source' && (
            <input value={lead.source} onChange={e => onUpdate(lead.id, { source: e.target.value })}
              placeholder="—" className="w-full h-[30px] px-2 bg-transparent outline-none text-[13px] placeholder:text-gray-200 focus:bg-[#F5F6F8] rounded" />
          )}
          {col.id === 'activity' && (
            <ActivityCell
              value={parseActivities(lead.metadata?.__activities)}
              onUpdate={patch => onUpdate(lead.id, { ...patch, metadata: { ...lead.metadata, ...(patch.metadata as any) } })}
            />
          )}
          {col.id === 'notes' && (
            <button onClick={() => onOpenNotes(lead)}
              className={cn('w-full text-left text-[11px] px-2 py-1.5 rounded transition-colors truncate max-w-[120px]',
                lead.notes ? 'text-[#323338] bg-[#F5F6F8] hover:bg-gray-200' : 'text-gray-300 hover:bg-[#F5F6F8]')}>
              {lead.notes ? lead.notes.slice(0, 30) : '+ Add'}
            </button>
          )}
          {(col as any).isCustom && (
            <div className="flex items-center justify-center h-full">
              {customColumns.find(cc => cc.name === col.id)?.type === 'checkbox' ? (
                <MondayTick checked={!!lead.metadata?.[col.id]} onChange={v => onUpdate(lead.id, { metadata: { ...lead.metadata, [col.id]: v } })} />
              ) : (
                <input
                  type={customColumns.find(cc => cc.name === col.id)?.type === 'number' ? 'number' : 'text'}
                  value={lead.metadata?.[col.id] ?? ''}
                  onChange={e => onUpdate(lead.id, { metadata: { ...lead.metadata, [col.id]: e.target.value } })}
                  placeholder="—"
                  className={cn('w-full h-[30px] px-2 bg-transparent outline-none text-[13px] placeholder:text-gray-200 focus:bg-[#F5F6F8] rounded',
                    customColumns.find(cc => cc.name === col.id)?.type === 'number' && 'text-center')}
                />
              )}
            </div>
          )}
        </td>
      ))}
      <td className="px-1 py-1">
        <button onClick={() => onDelete(lead.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-[#E2445C] rounded hover:bg-red-50">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function SalesDashboard() {
  const [leads, setLeads] = useState<Lead[]>([emptyDraftLead()]);
  const [customColumns, setCustomColumns] = useState<SalesColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visibleCols, setVisibleCols] = useState<string[]>(CORE_COLUMNS.map(c => c.id));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [emailModal, setEmailModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [notesModal, setNotesModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [massEmailModal, setMassEmailModal] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const openNotes = useCallback((lead: Lead) => setNotesModal({ open: true, lead }), []);
  const openDrawer = useCallback((lead: Lead) => setDrawerLead(lead), []);

  // ── Selection Logic ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllGlobal = () => {
    const saved = leads.filter(l => l._saved);
    if (selectedLeads.size === saved.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(saved.map(l => l.id)));
    }
  };

  const selectAllInGroup = (groupId: string) => {
    const groupLeads = leads.filter(l => l.status === groupId && l._saved);
    const groupIds = groupLeads.map(l => l.id);
    setSelectedLeads(prev => {
      const next = new Set(prev);
      const allSelected = groupIds.every(id => next.has(id));
      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const leadsRef = useRef<Lead[]>([]);
  leadsRef.current = leads;
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Load leads & columns ──
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/sales-leads', { signal: controller.signal });
        const data = await res.json();
        if (data.ok) {
          const saved = data.leads.map(dbLeadToLocal);
          setLeads(saved.length > 0 ? [...saved, emptyDraftLead()] : [emptyDraftLead()]);
          setCustomColumns(data.columns || []);
          if (data.columns) {
            const customVisible = data.columns.filter((c: any) => c.isVisible).map((c: any) => c.name);
            setVisibleCols(prev => [...new Set([...prev, ...customVisible])]);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        toast.error('Failed to load dashboard data');
      }
      finally { setLoading(false); }
    })();
    return () => controller.abort();
  }, []);

  // Keep drawer synced
  useEffect(() => {
    if (drawerLead) {
      const live = leadsRef.current.find(l => l.id === drawerLead.id);
      if (live) setDrawerLead(live);
    }
  }, [leads]);

  // ── Persist lead ──
  const persistLead = useCallback(async (lead: Lead) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, _committing: true } : l));
    const body = {
      name: lead.name, company: lead.company, email: lead.email,
      phone: lead.phone, socials: lead.socials, status: lead.status,
      source: lead.source, value: lead.value, priority: lead.priority,
      instagram: lead.instagram, facebook: lead.facebook, linkedin: lead.linkedin,
      twitter: lead.twitter, tiktok: lead.tiktok,
      meetingBooked: lead.meetingBooked, emailed: lead.emailed,
      called: lead.called, texted: lead.texted,
      notes: lead.notes, emailTemplate: lead.emailTemplate,
      metadata: lead.metadata,
      dmAt: lead.dmAt || null, meetingAt: lead.meetingAt || null,
      emailedAt: lead.emailedAt || null, calledAt: lead.calledAt || null,
      textedAt: lead.textedAt || null,
    };
    try {
      if (!lead._saved) {
        const res = await fetch('/api/sales-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || 'Failed');
        setLeads(prev => prev.map(l => l.id === lead.id
          ? { ...l, id: data.lead.id, _saved: true, _dirty: false, _committing: false, createdAt: data.lead.createdAt, updatedAt: data.lead.updatedAt }
          : l));
      } else {
        const res = await fetch(`/api/sales-leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || 'Failed');
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, _dirty: false, _committing: false, updatedAt: data.lead.updatedAt } : l));
      }
    } catch (err: any) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, _committing: false } : l));
      toast.error(err.message || 'Failed to save');
    }
  }, []);

  // ── Auto-save debounce ──
  const scheduleAutoSave = useCallback((id: string) => {
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      const lead = leadsRef.current.find(l => l.id === id);
      if (!lead || lead._committing) return;
      if (lead._saved && lead._dirty) { persistLead(lead); return; }
      if (!lead._saved && lead.name.trim()) persistLead(lead);
    }, 1500);
  }, [persistLead]);

  const updateLead = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch, _dirty: l._saved ? true : l._dirty } : l));
    scheduleAutoSave(id);
  }, [scheduleAutoSave]);

  const addRow = useCallback((status = 'NEW') => {
    setLeads(prev => [...prev, emptyDraftLead(status)]);
  }, []);

  const deleteRow = useCallback(async (id: string) => {
    const lead = leadsRef.current.find(l => l.id === id);
    if (saveTimers.current[id]) { clearTimeout(saveTimers.current[id]); delete saveTimers.current[id]; }
    setLeads(prev => { const next = prev.filter(l => l.id !== id); return next.length === 0 ? [emptyDraftLead()] : next; });
    if (!lead?._saved) return;
    try { await fetch(`/api/sales-leads/${id}`, { method: 'DELETE' }); toast.success('Lead deleted'); }
    catch { toast.error('Failed to delete'); }
  }, []);

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  // ── Column Management ──
  const addColumn = async (name: string, label: string, type: string) => {
    try {
      const res = await fetch('/api/sales-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, label, type })
      });
      const data = await res.json();
      if (data.ok) {
        setCustomColumns(prev => [...prev, data.column]);
        setVisibleCols(prev => [...prev, data.column.name]);
        toast.success(`Column "${label}" added`);
      }
    } catch { toast.error('Failed to add column'); }
  };

  const deleteColumn = async (colId: string, colName: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY delete the "${colName}" column and all its data?`)) return;
    try {
      const res = await fetch(`/api/sales-columns/${colId}`, { method: 'DELETE' });
      if (res.ok) {
        setCustomColumns(prev => prev.filter(c => c.id !== colId));
        setVisibleCols(prev => prev.filter(c => c !== colName));
        // Also clean up local lead metadata if you want, or just let it be
        toast.success('Column deleted');
      }
    } catch { toast.error('Failed to delete column'); }
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const saved = leads.filter(l => l._saved);
    const headers = ['Name', 'Company', 'Status', 'Priority', 'Email', 'Phone', 'Social Handles', 'Insta', 'FB', 'LI', 'X', 'TT', 'Value ($)', 'Source', 'Activity Log', 'Notes'];
    const rows = saved.map(l => [
      l.name, l.company, l.status, l.priority || '—', l.email, l.phone, l.socials,
      l.instagram ? 'Yes' : 'No', l.facebook ? 'Yes' : 'No', l.linkedin ? 'Yes' : 'No', l.twitter ? 'Yes' : 'No', l.tiktok ? 'Yes' : 'No',
      l.value ?? '', l.source,
      `"${parseActivities(l.metadata?.__activities).map(a => `${a.type} @ ${new Date(a.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}${a.location ? ` (${a.location})` : ''}`).join('; ')}"`,
      `"${l.notes.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sales-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  // ── Filtered + grouped ──
  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    return leads.filter(l =>
      l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q) || l.socials.toLowerCase().includes(q)
    );
  }, [leads, deferredSearch]);

  const grouped = useMemo(() => {
    return STATUS_GROUPS.map(g => ({
      ...g,
      leads: filtered.filter(l => l.status === g.id),
    }));
  }, [filtered]);

  // ── Stats ──
  const saved = leads.filter(l => l._saved);
  const stats = {
    total: saved.length,
    contacted: saved.filter(l => l.emailed || l.called || l.texted || parseSocials(l.socials).length > 0).length,
    meetings: saved.filter(l => l.meetingBooked).length,
    highPriority: saved.filter(l => l.priority === 'critical' || l.priority === 'high').length,
    pipeline: saved.reduce((s, l) => s + (l.value ?? 0), 0),
  };

  const allAvailableColumns = useMemo(() => {
    const custom = customColumns.map(c => ({
      id: c.name,
      label: c.label,
      width: c.width || 'min-w-[150px] w-[150px]',
      align: (c.type === 'number' || c.type === 'checkbox') ? 'center' as const : 'left' as const,
      isCustom: true,
      dbId: c.id
    }));
    return [...CORE_COLUMNS, ...custom];
  }, [customColumns]);

  const activeColumns = useMemo(() => {
    return allAvailableColumns.filter(c => visibleCols.includes(c.id));
  }, [allAvailableColumns, visibleCols]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#0073EA]" />
          <p className="text-sm text-gray-400">Loading your leads…</p>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="space-y-4" style={{ fontFamily: "'Figtree', 'Inter', system-ui, sans-serif" }}>
      {/* ── Top Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-gray-900 tracking-tight">Sales Pipeline</h1>
          <p className="text-[13px] text-gray-400 flex items-center gap-1.5 mt-0.5">
            <Check className="h-3.5 w-3.5 text-[#00C875]" /> Auto-saves 1.5s after changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="h-8 pl-8 pr-3 rounded-md border border-gray-200 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#0073EA]/30 focus:border-[#0073EA] w-[200px]" />
          </div>
          <ColumnToggle visible={visibleCols} setVisible={setVisibleCols} allCols={allAvailableColumns} onAdd={addColumn} onDelete={deleteColumn} />
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-xs border-gray-200 text-gray-600 h-8">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" onClick={() => addRow()} className="gap-1.5 text-xs bg-[#0073EA] hover:bg-[#0060C0] text-white h-8">
            <Plus className="h-3.5 w-3.5" /> New Lead
          </Button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: stats.total, color: 'text-gray-800', bg: 'bg-gray-50 border-gray-200' },
          { label: 'Contacted', value: stats.contacted, color: 'text-blue-700', bg: 'bg-blue-100/50 border-blue-200' },
          { label: 'Meetings Booked', value: stats.meetings, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'High Priority', value: stats.highPriority, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4 flex flex-col items-center justify-center text-center transition-all hover:shadow-md cursor-default', s.bg)}>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={cn('text-3xl font-black mt-0.5', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Grouped Table ── */}
      <div className="rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-separate border-spacing-0">
            {/* Table header */}
            <thead>
              <tr className="bg-[#F5F6F8] z-30">
                <th style={{ transform: 'translateZ(0)' }} className="w-[40px] px-2 py-2 bg-[#F5F6F8] sticky left-0 z-40 border-b-2 border-gray-200">
                  <input
                    type="checkbox"
                    checked={selectedLeads.size === leads.filter(l => l._saved).length && leads.filter(l => l._saved).length > 0}
                    onChange={selectAllGlobal}
                    className="rounded border-gray-300 text-[#0073EA] focus:ring-[#0073EA] cursor-pointer"
                  />
                </th>
                <th style={{ width: 220, minWidth: 220, boxShadow: '1px 0 0 0 #e5e7eb', transform: 'translateZ(0)' }} className={cn("px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider sticky left-[40px] bg-[#F5F6F8] z-30 border-b-2 border-gray-200",
                  CORE_COLUMNS[0].width)}>
                  Lead
                </th>
                {activeColumns.filter(c => c.id !== 'name').map(col => (
                  <th key={col.id}
                    style={col.minPx ? {
                      width: col.minPx, minWidth: col.minPx,
                      ...(col.id === 'company' ? { boxShadow: '1px 0 0 0 #e5e7eb', transform: 'translateZ(0)' } : {})
                    } : undefined}
                    className={cn(
                      "px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 last:border-r-0",
                      col.id === 'company' ? 'sticky left-[260px] bg-[#F5F6F8] z-20' : 'border-r border-gray-200',
                      col.width, col.align === 'center' ? 'text-center' : 'text-left'
                    )}>
                    {col.label}
                  </th>
                ))}
                <th className="w-[40px] px-1" />
              </tr>
            </thead>
            <tbody>
              {grouped.map(group => {
                const isCollapsed = collapsedGroups.has(group.id);
                if (group.leads.length === 0) return null;

                const groupSavedLeads = group.leads.filter(l => l._saved);
                const isAllGroupSelected = groupSavedLeads.length > 0 && groupSavedLeads.every(l => selectedLeads.has(l.id));

                return (
                  <Fragment key={group.id}>
                    {/* Group header row */}
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <GroupHeader group={group} count={group.leads.length} collapsed={isCollapsed}
                        onToggle={() => toggleGroup(group.id)} onAddItem={() => addRow(group.id)}
                        onSelectAll={() => selectAllInGroup(group.id)} isAllSelected={isAllGroupSelected}
                        colCount={activeColumns.length} />
                    </tr>
                    {/* Group items */}
                    {!isCollapsed && group.leads.map((lead) => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        isSelected={selectedLeads.has(lead.id)}
                        activeColumns={activeColumns}
                        customColumns={customColumns}
                        groupColor={group.color}
                        onUpdate={updateLead}
                        onDelete={deleteRow}
                        onSelect={toggleSelect}
                        onOpenNotes={openNotes}
                        onOpenDrawer={openDrawer}
                      />
                    ))}
                    {/* Summary row */}
                    {!isCollapsed && <SummaryRow leads={group.leads} visibleCols={activeColumns.filter(c => c.id !== 'name').map(c => c.id)} groupColor={group.color} />}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={activeColumns.length + 1} className="py-16 text-center text-gray-400 text-sm">
                    {search ? 'No leads match your search.' : 'No rows yet — click "New Lead" to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-[#F5F6F8] px-4 py-2 flex items-center justify-between">
          <button onClick={() => addRow()} className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-[#0073EA] transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Lead
          </button>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" />Draft</span>
            <span className="flex items-center gap-1"><Loader2 className="h-3 w-3" />Saving</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3 text-[#00C875]" />Saved</span>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <EmailTemplateModal open={emailModal.open} lead={emailModal.lead}
        onClose={() => setEmailModal({ open: false, lead: null })}
        onSave={(id, body) => { updateLead(id, { emailTemplate: body }); }} />
      <NotesModal open={notesModal.open} lead={notesModal.lead}
        onClose={() => setNotesModal({ open: false, lead: null })}
        onSave={(id, notes) => { updateLead(id, { notes }); }} />
      <LeadProfileDrawer lead={drawerLead} onClose={() => setDrawerLead(null)} onUpdate={updateLead} />
      <BulkActionToolbar
        count={selectedLeads.size}
        onClear={() => setSelectedLeads(new Set())}
        onMassEmail={() => setMassEmailModal(true)}
      />
      <MassEmailModal
        open={massEmailModal}
        selectedLeads={selectedLeads}
        leads={leads}
        onClose={() => setMassEmailModal(false)}
        onSent={() => {
          setSelectedLeads(new Set());
          // Refresh leads to show updated 'emailed' status
          (async () => {
            const res = await fetch('/api/sales-leads');
            const data = await res.json();
            if (data.ok) setLeads(data.leads.map(dbLeadToLocal).concat([emptyDraftLead()]));
          })();
        }}
      />
    </div>
  );
}
