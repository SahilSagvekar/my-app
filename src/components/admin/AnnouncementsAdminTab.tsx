'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Megaphone, Loader2, Send, Clock, Mail, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';

const TYPES = [
  { id: 'NEW_FEATURE', label: 'New feature' },
  { id: 'UPDATE', label: 'Update' },
  { id: 'MAINTENANCE', label: 'Maintenance' },
  { id: 'IMPORTANT', label: 'Important' },
];

const ROLE_OPTIONS = [
  { id: 'editor', label: 'Editors' },
  { id: 'client', label: 'Clients' },
  { id: 'qc', label: 'QC' },
  { id: 'scheduler', label: 'Schedulers' },
  { id: 'videographer', label: 'Videographers' },
  { id: 'manager', label: 'Managers' },
  { id: 'sales', label: 'Sales' },
  { id: 'sales_manager', label: 'Sales managers' },
  { id: 'host', label: 'Hosts' },
  { id: 'admin', label: 'Admins' },
];

interface Item {
  id: string;
  title: string;
  body: string;
  type: string;
  linkUrl: string | null;
  linkLabel: string | null;
  audienceAll: boolean;
  audienceRoles: string[];
  audienceUserIds: number[];
  sendEmail: boolean;
  sendSlack: boolean;
  showPopup: boolean;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED';
  publishAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  recipientCount: number;
  emailSentCount: number;
  readCount: number;
  dismissedCount: number;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-amber-50 text-amber-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
};

// <input type="datetime-local"> works in the admin's local time; the API wants ISO/UTC.
const localToIso = (v: string) => (v ? new Date(v).toISOString() : null);
const utcToLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmt = (iso: string | null) =>
  iso ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z').toLocaleString() : '—';

export function AnnouncementsAdminTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('NEW_FEATURE');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [audienceAll, setAudienceAll] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSlack, setSendSlack] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [publishAt, setPublishAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [audienceCount, setAudienceCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/announcements', { credentials: 'include' });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const payload = () => ({
    title, body, type,
    linkUrl: linkUrl.trim() || null,
    linkLabel: linkLabel.trim() || null,
    audienceAll,
    audienceRoles: roles,
    sendEmail, sendSlack, showPopup,
    publishAt: localToIso(publishAt),
    expiresAt: localToIso(expiresAt),
  });

  // Live audience size so the admin knows who will be reached before sending.
  useEffect(() => {
    if (!audienceAll && roles.length === 0) { setAudienceCount(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/announcements', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'x', body: 'x', audienceAll, audienceRoles: roles, previewOnly: true }),
        });
        const data = await res.json();
        setAudienceCount(res.ok ? data.audienceCount : null);
      } catch { setAudienceCount(null); }
    }, 300);
    return () => clearTimeout(t);
  }, [audienceAll, roles]);

  const reset = () => {
    setEditingId(null); setTitle(''); setBody(''); setType('NEW_FEATURE');
    setLinkUrl(''); setLinkLabel(''); setAudienceAll(false); setRoles([]);
    setSendEmail(false); setSendSlack(false); setShowPopup(false);
    setPublishAt(''); setExpiresAt('');
  };

  const edit = (i: Item) => {
    setEditingId(i.id); setTitle(i.title); setBody(i.body); setType(i.type);
    setLinkUrl(i.linkUrl || ''); setLinkLabel(i.linkLabel || '');
    setAudienceAll(i.audienceAll); setRoles(i.audienceRoles);
    setSendEmail(i.sendEmail); setSendSlack(i.sendSlack); setShowPopup(i.showPopup);
    setPublishAt(utcToLocalInput(i.publishAt)); setExpiresAt(utcToLocalInput(i.expiresAt));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (mode: 'draft' | 'publish' | 'schedule') => {
    if (mode === 'publish') {
      const who = audienceAll ? 'EVERYONE' : roles.map((r) => ROLE_OPTIONS.find((o) => o.id === r)?.label || r).join(', ');
      const count = audienceCount != null ? ` (${audienceCount} people)` : '';
      if (!confirm(`Send "${title || 'this announcement'}" to ${who}${count} now?${sendEmail ? '\n\nEmails will go out too.' : ''}`)) return;
    }
    setBusy(true);
    try {
      const url = editingId ? `/api/admin/announcements/${editingId}` : '/api/admin/announcements';
      // Editing then publishing: save the edit as a draft first, then publish it.
      const saveMode = mode === 'publish' ? 'draft' : mode;
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload(), mode: editingId ? saveMode : mode }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed'); return; }
      if (editingId && mode === 'publish') {
        const pub = await fetch(`/api/admin/announcements/${editingId}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'publish' }),
        });
        if (!pub.ok) { toast.error((await pub.json()).error || 'Failed to publish'); return; }
      }
      toast.success(mode === 'publish' ? 'Published' : mode === 'schedule' ? 'Scheduled' : 'Draft saved');
      reset();
      load();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/announcements/test', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload(), audienceAll: true }), // audience irrelevant for a self-test
      });
      const data = await res.json();
      res.ok ? toast.success(`Test email sent to ${data.sentTo}`) : toast.error(data.error || 'Failed');
    } finally { setBusy(false); }
  };

  const action = async (id: string, act: 'publish' | 'unschedule' | 'expire') => {
    if (act === 'publish' && !confirm('Publish this announcement now?')) return;
    if (act === 'expire' && !confirm('End this announcement? It will disappear from everyone\'s bell.')) return;
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act }),
    });
    res.ok ? (toast.success('Done'), load()) : toast.error((await res.json()).error || 'Failed');
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this announcement permanently?')) return;
    const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE', credentials: 'include' });
    res.ok ? (toast.success('Deleted'), load()) : toast.error('Failed to delete');
  };

  const toggleRole = (r: string) => setRoles((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  const canSubmit = title.trim() && body.trim() && (audienceAll || roles.length > 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Announcements</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Edit announcement' : 'New announcement'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="e.g. Bypass Client Review is here" />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Message</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={5000} placeholder="What changed and why it matters to them." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Button link (optional)</label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/ or https://…" />
            </div>
            <div>
              <label className="text-sm font-medium">Button label</label>
              <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} maxLength={40} placeholder="Learn more" disabled={!linkUrl.trim()} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Who gets it</label>
              {audienceCount != null && <span className="text-xs text-muted-foreground">{audienceCount} {audienceCount === 1 ? 'person' : 'people'}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAudienceAll(!audienceAll)}
                className={`px-3 py-1.5 rounded-full border text-sm ${audienceAll ? 'bg-black text-white border-black' : 'hover:bg-gray-50'}`}>
                Everyone
              </button>
              {!audienceAll && ROLE_OPTIONS.map((r) => (
                <button type="button" key={r.id} onClick={() => toggleRole(r.id)}
                  className={`px-3 py-1.5 rounded-full border text-sm ${roles.includes(r.id) ? 'bg-black text-white border-black' : 'hover:bg-gray-50'}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span>Also send email<br /><span className="text-xs text-muted-foreground">Skips people who turned emails off</span></span>
              <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span>Post to Slack<br /><span className="text-xs text-muted-foreground">Editors channel, else app channel</span></span>
              <Switch checked={sendSlack} onCheckedChange={setSendSlack} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span>Show as popup<br /><span className="text-xs text-muted-foreground">Once, until dismissed</span></span>
              <Switch checked={showPopup} onCheckedChange={setShowPopup} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Schedule for (optional)</label>
              <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Auto-hide after (optional)</label>
              <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button disabled={!canSubmit || busy} onClick={() => submit('publish')}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Publish now
            </Button>
            <Button variant="outline" disabled={!canSubmit || !publishAt || busy} onClick={() => submit('schedule')}>
              <Clock className="h-4 w-4 mr-2" /> Schedule
            </Button>
            <Button variant="outline" disabled={!canSubmit || busy} onClick={() => submit('draft')}>Save draft</Button>
            <Button variant="ghost" disabled={!title.trim() || !body.trim() || busy} onClick={sendTest}>
              <Mail className="h-4 w-4 mr-2" /> Email me a test
            </Button>
            {editingId && <Button variant="ghost" onClick={reset}>Cancel edit</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No announcements yet.</div>
          ) : (
            <div className="divide-y">
              {items.map((i) => {
                const ended = i.status === 'PUBLISHED' && i.expiresAt && new Date(i.expiresAt.replace(' ', 'T') + (/[zZ]/.test(i.expiresAt) ? '' : 'Z')) <= new Date();
                return (
                  <div key={i.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{i.title}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_STYLE[i.status]}`}>{ended ? 'ENDED' : i.status}</span>
                        <span className="text-[11px] text-muted-foreground">
                          → {i.audienceAll ? 'Everyone' : i.audienceRoles.join(', ') || 'specific people'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {i.status === 'PUBLISHED' && (
                          <>
                            Published {fmt(i.publishedAt)} · <Eye className="inline h-3 w-3" /> {i.readCount}/{i.recipientCount} read
                            {i.showPopup && ` · ${i.dismissedCount} dismissed popup`}
                            {i.sendEmail && ` · email ${Math.min(i.emailSentCount, i.recipientCount)}/${i.recipientCount}`}
                          </>
                        )}
                        {i.status === 'SCHEDULED' && <>Goes out {fmt(i.publishAt)}</>}
                        {i.status === 'DRAFT' && <>Draft</>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {i.status !== 'PUBLISHED' && <Button size="sm" variant="outline" onClick={() => edit(i)}>Edit</Button>}
                      {i.status !== 'PUBLISHED' && <Button size="sm" variant="outline" onClick={() => action(i.id, 'publish')}>Publish now</Button>}
                      {i.status === 'SCHEDULED' && <Button size="sm" variant="outline" onClick={() => action(i.id, 'unschedule')}>Unschedule</Button>}
                      {i.status === 'PUBLISHED' && !ended && <Button size="sm" variant="outline" onClick={() => action(i.id, 'expire')}>End</Button>}
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
