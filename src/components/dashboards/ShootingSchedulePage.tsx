'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem,
} from '../ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  Camera, Plus, Loader, PackageCheck, ChevronDown, X, FileText, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { ShootScriptsDialog } from './ShootScriptsDialog';

interface EquipmentItem {
  id: string;
  name: string;
  category?: string | null;
  isActive: boolean;
}

interface Person {
  id: number;
  name?: string | null;
  email: string;
}

interface ClientOption {
  id: string;
  name?: string | null;
  companyName?: string | null;
}

interface Shoot {
  id: string;
  title: string | null;
  status: string;
  client: ClientOption | null;
  videographer: Person | null;
  location: string | null;
  shootDate: string | null;
  hostName: string | null;
  equipmentIds: string[];
  camera?: string | null;
  quality?: string | null;
  frameRate?: string | null;
  lighting?: string | null;
  exclusions?: string | null;
  videographerNotes?: string | null;
  equipmentReturnedAt: string | null;
  equipmentReturnedPhotoUrls: string[];
  scriptContent: string | null;
  scriptStatus: string;
  scriptSentAt: string | null;
  videosPlanned: number;
  scriptsCount: number;
}

const SHOOT_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
type ShootStatus = typeof SHOOT_STATUSES[number];

const STATUS_META: Record<ShootStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Completed', className: 'bg-green-100 text-green-800' },
};

const EMPTY_FORM = {
  title: '',
  clientId: '',
  videographerId: '',
  location: '',
  shootDate: '',
  hostName: '',
  equipmentIds: [] as string[],
  camera: '',
  quality: '',
  frameRate: '',
  lighting: '',
  exclusions: '',
  notes: '',
  videosPlanned: '1',
  status: 'PENDING' as ShootStatus,
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ShootingSchedulePage() {
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [videographers, setVideographers] = useState<Person[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShootId, setEditingShootId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  // Auto-fill tracking: null means user hasn't auto-filled, number = the auto-filled count
  const [autoFilledVideos, setAutoFilledVideos] = useState<number | null>(null);

  // Return photos are now collected inline in the edit modal's "Confirm
  // Equipment Back" section (see cycleStatus/handleSubmit) rather than a
  // separate popup — kept keyed by equipment id, same shape as before.
  const [returnPhotoFiles, setReturnPhotoFiles] = useState<Record<string, File | null>>({});
  // Inline warning shown under the Status field when trying to cycle into
  // COMPLETED while equipment on this shoot hasn't been confirmed back yet.
  const [statusBlockedMessage, setStatusBlockedMessage] = useState<string | null>(null);

  const [scriptDialogShoot, setScriptDialogShoot] = useState<Shoot | null>(null);

  // Filters — all applied client-side over the already-fetched list.
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [shootsRes, equipmentRes, videographersRes, clientsRes] = await Promise.all([
        fetch('/api/shoots'),
        fetch('/api/equipment'),
        fetch('/api/users/videographers'),
        fetch('/api/clients'),
      ]);
      if (shootsRes.ok) setShoots((await shootsRes.json()).shoots || []);
      if (equipmentRes.ok) setEquipment((await equipmentRes.json()).equipment || []);
      if (videographersRes.ok) setVideographers((await videographersRes.json()).videographers || []);
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        const raw = Array.isArray(data) ? data : (data.clients || []);
        setClients(raw);
      }
    } catch (err) {
      console.error('Failed to load shooting schedule:', err);
      toast.error('Failed to load shooting schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // When a client is chosen in the form, fetch their deliverable total and
  // auto-fill videosPlanned so scripts = tasks = deliverables.
  const fetchClientVideosPlanned = async (clientId: string) => {
    if (!clientId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (!res.ok) return;
      const data = await res.json();
      const deliverables: { type?: string; quantity?: number }[] = data.monthlyDeliverables || [];
      // Sum video-type deliverables, fall back to all deliverables if none match
      const videoTypes = deliverables.filter(d => /(video|videos)/i.test(d.type || ''));
      const source = videoTypes.length > 0 ? videoTypes : deliverables;
      const total = source.reduce((acc, d) => acc + (d.quantity || 0), 0);
      if (total > 0) {
        setForm(prev => ({ ...prev, videosPlanned: String(total) }));
        setAutoFilledVideos(total);
      }
    } catch {
      // ignore — auto-fill is best-effort
    }
  };

  const equipmentName = (id: string) => equipment.find(e => e.id === id)?.name || '(removed)';

  const filteredShoots = shoots.filter(shoot => {
    if (statusFilter !== 'all' && shoot.status !== statusFilter) return false;
    if (clientFilter !== 'all' && shoot.client?.id !== clientFilter) return false;
    if (shoot.shootDate) {
      const shootDay = shoot.shootDate.slice(0, 10); // YYYY-MM-DD
      if (dateFrom && shootDay < dateFrom) return false;
      if (dateTo && shootDay > dateTo) return false;
    } else if (dateFrom || dateTo) {
      return false; // no date on the shoot, but a date filter is active
    }
    return true;
  });

  const clearFilters = () => {
    setStatusFilter('all');
    setClientFilter('all');
    setDateFrom('');
    setDateTo('');
  };
  const filtersActive = statusFilter !== 'all' || clientFilter !== 'all' || !!dateFrom || !!dateTo;

  const updateStatus = async (shootId: string, status: ShootStatus) => {
    // Optimistic update so the badge/select feels instant.
    setShoots(prev => prev.map(s => s.id === shootId ? { ...s, status } : s));
    try {
      const res = await fetch(`/api/shoots/${shootId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to update status');
        fetchAll(); // revert to server truth
      }
    } catch {
      toast.error('Failed to update status');
      fetchAll();
    }
  };

  const openCreateForm = () => {
    setEditingShootId(null);
    setForm({ ...EMPTY_FORM });
    setStatusBlockedMessage(null);
    setReturnPhotoFiles({});
    setIsFormOpen(true);
  };

  const returnedCount = (shoot: Pick<Shoot, 'equipmentIds' | 'equipmentReturnedAt'>) =>
    shoot.equipmentReturnedAt ? shoot.equipmentIds.length : 0;

  // Pending → In Progress → Completed, looping. Reaching Completed with
  // unreturned equipment snaps back to In Progress with an inline warning —
  // mirrors the same rule the backend should enforce on PATCH.
  const cycleStatus = () => {
    setForm(prev => {
      const order: ShootStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
      const next = order[(order.indexOf(prev.status) + 1) % order.length];
      if (next === 'COMPLETED' && prev.equipmentIds.length > 0) {
        const editingShoot = shoots.find(s => s.id === editingShootId);
        const alreadyReturned = editingShoot ? !!editingShoot.equipmentReturnedAt : false;
        const confirmedNow = prev.equipmentIds.every(id => !!returnPhotoFiles[id]);
        if (!alreadyReturned && !confirmedNow) {
          const confirmedCount = prev.equipmentIds.filter(id => !!returnPhotoFiles[id]).length;
          setStatusBlockedMessage(`${confirmedCount} of ${prev.equipmentIds.length} equipment items confirmed back — can't mark Completed yet.`);
          return { ...prev, status: 'IN_PROGRESS' };
        }
      }
      setStatusBlockedMessage(null);
      return { ...prev, status: next };
    });
  };

  const openEditForm = (shoot: Shoot) => {
    setEditingShootId(shoot.id);
    setStatusBlockedMessage(null);
    setReturnPhotoFiles({});
    setForm({
      title: shoot.title || '',
      clientId: shoot.client?.id || '',
      videographerId: shoot.videographer?.id ? String(shoot.videographer.id) : '',
      location: shoot.location || '',
      shootDate: toDatetimeLocal(shoot.shootDate),
      hostName: shoot.hostName || '',
      equipmentIds: shoot.equipmentIds || [],
      camera: shoot.camera || '',
      quality: shoot.quality || '',
      frameRate: shoot.frameRate || '',
      lighting: shoot.lighting || '',
      exclusions: shoot.exclusions || '',
      notes: shoot.videographerNotes || '',
      videosPlanned: String(shoot.videosPlanned || 1),
      status: (SHOOT_STATUSES.includes(shoot.status as ShootStatus) ? shoot.status : 'PENDING') as ShootStatus,
    });
    setIsFormOpen(true);
  };

  const toggleEquipment = (id: string) => {
    setForm(prev => ({
      ...prev,
      equipmentIds: prev.equipmentIds.includes(id)
        ? prev.equipmentIds.filter(e => e !== id)
        : [...prev.equipmentIds, id],
    }));
  };

  const handleSubmit = async () => {
    if (!form.shootDate) {
      toast.error('Date & time is required');
      return;
    }
    setSaving(true);
    try {
      // If every equipment item now has a return photo attached (collected
      // via the Confirm Equipment Back section below) and this shoot hasn't
      // already had its return confirmed, submit those photos first — same
      // endpoint/contract the old standalone dialog used.
      if (
        editingShootId &&
        form.equipmentIds.length > 0 &&
        form.equipmentIds.every(id => !!returnPhotoFiles[id])
      ) {
        const editingShoot = shoots.find(s => s.id === editingShootId);
        if (editingShoot && !editingShoot.equipmentReturnedAt) {
          const formData = new FormData();
          for (const id of form.equipmentIds) formData.append('photos', returnPhotoFiles[id]!);
          const returnRes = await fetch(`/api/shoots/${editingShootId}/equipment-return`, {
            method: 'POST',
            body: formData,
          });
          if (!returnRes.ok) {
            const err = await returnRes.json().catch(() => ({}));
            toast.error(err.error || 'Failed to confirm equipment return');
            setSaving(false);
            return;
          }
        }
      }

      const url = editingShootId ? `/api/shoots/${editingShootId}` : '/api/shoots';
      const method = editingShootId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || undefined,
          clientId: form.clientId || undefined,
          videographerId: form.videographerId || undefined,
          location: form.location,
          shootDate: form.shootDate,
          hostName: form.hostName,
          equipmentIds: form.equipmentIds,
          camera: form.camera,
          quality: form.quality,
          frameRate: form.frameRate,
          lighting: form.lighting,
          exclusions: form.exclusions,
          notes: form.notes,
          videosPlanned: form.videosPlanned,
          status: form.status,
        }),
      });
      if (res.ok) {
        toast.success(editingShootId ? 'Shoot updated' : 'Shoot day created');
        setIsFormOpen(false);
        setReturnPhotoFiles({});
        fetchAll();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to save shoot');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const openScriptDialog = (shoot: Shoot) => {
    setScriptDialogShoot(shoot);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading shooting schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-slate-950">Shooting Schedule</h1>
          <p className="mt-1 text-sm text-slate-600">All upcoming and past shoot days</p>
        </div>
        <Button onClick={openCreateForm} className="h-10 gap-2 rounded-lg bg-slate-950 px-4 hover:opacity-85 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> New Shoot
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 min-w-[140px]">
          <Label className="text-[11px] uppercase tracking-wide text-slate-400">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {SHOOT_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[160px]">
          <Label className="text-[11px] uppercase tracking-wide text-slate-400">Client</Label>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.companyName || c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[130px]">
          <Label className="text-[11px] uppercase tracking-wide text-slate-400">From</Label>
          <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1 min-w-[130px]">
          <Label className="text-[11px] uppercase tracking-wide text-slate-400">To</Label>
          <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground h-9 lg:col-span-4 lg:justify-self-start">
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredShoots.length === 0 ? (
          <div className="lg:col-span-2 text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Camera className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {shoots.length === 0 ? 'No shoot days scheduled yet' : 'No shoots match these filters'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {shoots.length === 0 ? 'Tap "New Shoot" to add one' : 'Try clearing a filter'}
            </p>
          </div>
        ) : (
          filteredShoots.map((shoot) => {
            const statusMeta = STATUS_META[SHOOT_STATUSES.includes(shoot.status as ShootStatus) ? (shoot.status as ShootStatus) : 'PENDING'];
            const scriptSent = shoot.scriptStatus === 'sent';
            const mapsHref = shoot.location
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shoot.location)}`
              : null;
            return (
              <Card key={shoot.id} className="flex h-full flex-col overflow-hidden rounded-xl border-0 bg-slate-950 text-white shadow-none">
                <CardContent className="flex h-full flex-col p-0">
                  <div className="flex items-center justify-between gap-3 p-5 pb-4">
                    <h3 className="truncate text-lg font-extrabold">{shoot.client?.companyName || shoot.client?.name || shoot.title || 'Shoot'}</h3>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge className={`rounded-full border-0 text-[11px] font-semibold ${statusMeta.className}`}>{statusMeta.label}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditForm(shoot)}
                        className="h-8 border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      >
                        Edit Shoot Details
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 pb-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Shoot day</p>
                      <p className="mt-1 truncate text-sm font-semibold" title={shoot.shootDate || undefined}>
                        {shoot.shootDate ? new Date(shoot.shootDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Host</p>
                      <p className="mt-1 truncate text-sm font-semibold" title={shoot.hostName || undefined}>{shoot.hostName || 'Not set'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Location</p>
                      {mapsHref ? (
                        <a
                          href={mapsHref}
                          target="_blank"
                          rel="noreferrer"
                          title={shoot.location || undefined}
                          className="mt-1 flex items-center gap-1 truncate text-sm font-semibold text-white underline-offset-2 hover:underline"
                        >
                          <span className="truncate">{shoot.location}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <p className="mt-1 text-sm font-semibold">Not set</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Videographer</p>
                      <p className="mt-1 truncate text-sm font-semibold" title={shoot.videographer?.name || shoot.videographer?.email || undefined}>
                        {shoot.videographer?.name || shoot.videographer?.email || 'Unassigned'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{shoot.scriptsCount} of {shoot.videosPlanned} Scripts Written</span>
                      <Badge variant="outline" className={`rounded-full border-0 text-[10px] font-semibold uppercase ${scriptSent ? 'bg-blue-100 text-blue-800' : 'bg-white/10 text-white/70'}`}>
                        {scriptSent ? 'Sent to Client' : 'Not Sent'}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      onClick={() => openScriptDialog(shoot)}
                    >
                      Scripts
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create / Edit Shoot Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingShootId ? 'Edit Shoot Day' : 'New Shoot Day'}</DialogTitle>
            <DialogDescription>Everything needed for this shoot, in one place.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>
                <Select value={form.clientId} onValueChange={(v) => { setForm(f => ({ ...f, clientId: v })); setAutoFilledVideos(null); fetchClientVideosPlanned(v); }}>
                  <SelectTrigger><SelectValue placeholder="Select client (optional)" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName || c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Videographer</Label>
                <Select value={form.videographerId} onValueChange={(v) => setForm(f => ({ ...f, videographerId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Who's shooting" /></SelectTrigger>
                  <SelectContent>
                    {videographers.map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.name || v.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <button
                type="button"
                onClick={cycleStatus}
                className={`flex h-10 w-full items-center justify-between rounded-md border px-3 text-sm font-medium ${STATUS_META[form.status].className}`}
              >
                {STATUS_META[form.status].label}
                <span className="text-[11px] font-normal opacity-70">Click to change</span>
              </button>
              {statusBlockedMessage && (
                <p className="text-xs font-medium text-amber-700">{statusBlockedMessage}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Date & Time</Label>
              <Input
                type="datetime-local"
                value={form.shootDate}
                onChange={(e) => setForm(f => ({ ...f, shootDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Videos planned</Label>
              <Input
                type="number" min="1" max="99"
                value={form.videosPlanned}
                onChange={(e) => { setForm(f => ({ ...f, videosPlanned: e.target.value })); setAutoFilledVideos(null); }}
              />
              {autoFilledVideos !== null && (
                <p className="text-[11px] text-muted-foreground">
                  Auto-filled from client's monthly deliverables ({autoFilledVideos}). Adjust if needed.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Location / Address</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="123 Main St, City"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Host Name</Label>
                <Input
                  value={form.hostName}
                  onChange={(e) => setForm(f => ({ ...f, hostName: e.target.value }))}
                  placeholder="Who's on camera"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Equipment Needed</Label>
              {equipment.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No equipment logged yet — add some from the Equipment page first.
                </p>
              ) : (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {form.equipmentIds.length > 0
                          ? `${form.equipmentIds.length} item${form.equipmentIds.length > 1 ? 's' : ''} selected`
                          : 'Select equipment...'}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                      {equipment.map(item => (
                        <DropdownMenuCheckboxItem
                          key={item.id}
                          checked={form.equipmentIds.includes(item.id)}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={() => toggleEquipment(item.id)}
                        >
                          {item.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {form.equipmentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {form.equipmentIds.map(id => (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          {equipmentName(id)}
                          <button
                            type="button"
                            onClick={() => toggleEquipment(id)}
                            className="hover:bg-slate-300 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {form.equipmentIds.length > 0 && (() => {
              const editingShoot = shoots.find(s => s.id === editingShootId);
              const alreadyReturned = editingShoot ? !!editingShoot.equipmentReturnedAt : false;
              return (
                <div className="space-y-1.5">
                  <Label className="text-xs">Confirm Equipment Back</Label>
                  {alreadyReturned ? (
                    <p className="flex items-center gap-1.5 text-xs text-green-700">
                      <PackageCheck className="h-3.5 w-3.5" /> All equipment already confirmed back for this shoot.
                    </p>
                  ) : (
                    <div className="space-y-2 rounded-lg border p-3">
                      {form.equipmentIds.map(id => {
                        const verified = !!returnPhotoFiles[id];
                        return (
                          <div key={id} className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{equipmentName(id)}</p>
                              <p className={`text-[11px] ${verified ? 'text-green-700' : 'text-slate-400'}`}>
                                {verified ? 'Verified back' : 'Not yet confirmed'}
                              </p>
                            </div>
                            <label className="shrink-0">
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => {
                                  setReturnPhotoFiles(prev => ({ ...prev, [id]: e.target.files?.[0] || null }));
                                  setStatusBlockedMessage(null);
                                }}
                              />
                              <span className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-xs font-medium hover:bg-slate-50">
                                {verified ? 'Replace photo' : 'Add photo'}
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Input placeholder="Camera" value={form.camera} onChange={(e) => setForm(f => ({ ...f, camera: e.target.value }))} />
              <Input placeholder="Quality" value={form.quality} onChange={(e) => setForm(f => ({ ...f, quality: e.target.value }))} />
              <Input placeholder="Frame rate" value={form.frameRate} onChange={(e) => setForm(f => ({ ...f, frameRate: e.target.value }))} />
              <Input placeholder="Lighting" value={form.lighting} onChange={(e) => setForm(f => ({ ...f, lighting: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Anything else the crew should know..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : editingShootId ? 'Save Changes' : 'Create Shoot'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ShootScriptsDialog
        shoot={scriptDialogShoot}
        open={!!scriptDialogShoot}
        onOpenChange={(open) => { if (!open) setScriptDialogShoot(null); }}
        onChanged={fetchAll}
      />
    </div>
  );
}