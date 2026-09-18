'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';

import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import {
  Camera, Plus, Loader, PackageCheck, ChevronDown, X, ExternalLink,
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
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  stops?: string[];
  expenses?: { description?: string; amount?: number; receiptUrl?: string }[];
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
  plannedStartTime: '',
  plannedEndTime: '',
  actualStartTime: '',
  actualEndTime: '',
  odometerBefore: '',
  odometerAfter: '',
  stops: [] as string[],
  expenses: [] as { description: string; amount: string; file: File | null }[],
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

  // Mileage photo files (before/after — tracked as component state, not in form)
  const [mileagePhotosBefore, setMileagePhotosBefore] = useState<File | null>(null);
  const [mileagePhotosAfter, setMileagePhotosAfter] = useState<File | null>(null);

  // Controls whether the equipment checklist panel is expanded
  const [equipOpen, setEquipOpen] = useState(false);

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
    setMileagePhotosBefore(null);
    setMileagePhotosAfter(null);
    setEquipOpen(false);
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
      plannedStartTime: toDatetimeLocal(shoot.plannedStartTime || shoot.startTime || null),
      plannedEndTime: toDatetimeLocal(shoot.plannedEndTime || shoot.endTime || null),
      actualStartTime: toDatetimeLocal(shoot.actualStartTime || null),
      actualEndTime: toDatetimeLocal(shoot.actualEndTime || null),
      odometerBefore: '',
      odometerAfter: '',
      stops: shoot.stops || [],
      expenses: (shoot.expenses || []).map(exp => ({
        description: exp.description || '',
        amount: exp.amount !== undefined ? String(exp.amount) : '',
        file: null,
      })),
    });
    setMileagePhotosBefore(null);
    setMileagePhotosAfter(null);
    setEquipOpen(false);
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

  const addStop = () => {
    setForm(f => ({ ...f, stops: [...f.stops, ''] }));
  };
  const updateStop = (index: number, val: string) => {
    setForm(f => {
      const stops = [...f.stops];
      stops[index] = val;
      return { ...f, stops };
    });
  };
  const removeStop = (index: number) => {
    setForm(f => ({ ...f, stops: f.stops.filter((_, i) => i !== index) }));
  };

  const addExpense = () => {
    setForm(f => ({ ...f, expenses: [...f.expenses, { description: '', amount: '', file: null }] }));
  };
  const updateExpense = (index: number, field: string, val: string | File | null) => {
    setForm(f => {
      const expenses = [...f.expenses];
      expenses[index] = { ...expenses[index], [field]: val };
      return { ...f, expenses };
    });
  };
  const removeExpense = (index: number) => {
    setForm(f => ({ ...f, expenses: f.expenses.filter((_, i) => i !== index) }));
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
          plannedStartTime: form.plannedStartTime || undefined,
          plannedEndTime: form.plannedEndTime || undefined,
          actualStartTime: form.actualStartTime || undefined,
          actualEndTime: form.actualEndTime || undefined,
          odometerBefore: form.odometerBefore || undefined,
          odometerAfter: form.odometerAfter || undefined,
          stops: form.stops,
          expenses: form.expenses.map(e => ({
            description: e.description,
            amount: e.amount ? parseFloat(e.amount) : 0,
          })),
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
        <DialogContent className="w-full sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {/* Header */}
          <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-gray-100">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {editingShootId ? 'Edit Shoot Day' : 'New Shoot Day'}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-0.5">
                Everything needed for this shoot, in one place.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 sm:px-8 py-6 space-y-6">
            {/* 3-col header */}
            <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1.5fr_140px] gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>
                <Select value={form.clientId} onValueChange={(v) => { setForm(f => ({ ...f, clientId: v })); setAutoFilledVideos(null); fetchClientVideosPlanned(v); }}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
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
                  <SelectTrigger><SelectValue placeholder="Select videographer" /></SelectTrigger>
                  <SelectContent>
                    {videographers.map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.name || v.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Videos Planned</Label>
                <Input
                  type="number" min="1" max="99"
                  value={form.videosPlanned}
                  onChange={(e) => { setForm(f => ({ ...f, videosPlanned: e.target.value })); setAutoFilledVideos(null); }}
                />
                {autoFilledVideos !== null && (
                  <p className="text-[11px] text-muted-foreground">
                    Auto-filled from client&apos;s monthly deliverables ({autoFilledVideos}).
                  </p>
                )}
              </div>
            </div>

            {/* Status + Date row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>

            {/* Planned Shoot Started + Ended row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Planned Shoot Started</Label>
                <Input
                  type="datetime-local"
                  value={form.plannedStartTime}
                  onChange={(e) => setForm(f => ({ ...f, plannedStartTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Planned Shoot Ended</Label>
                  {(() => {
                    if (!form.plannedStartTime || !form.plannedEndTime) return null;
                    const s = new Date(form.plannedStartTime).getTime();
                    const e = new Date(form.plannedEndTime).getTime();
                    if (isNaN(s) || isNaN(e) || e <= s) return null;
                    const mins = Math.round((e - s) / 60000);
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    return (
                      <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {h}h{m ? ` ${m}m` : ''} planned
                      </span>
                    );
                  })()}
                </div>
                <Input
                  type="datetime-local"
                  value={form.plannedEndTime}
                  onChange={(e) => setForm(f => ({ ...f, plannedEndTime: e.target.value }))}
                />
              </div>
            </div>

            {/* Actual Shoot Started + Ended row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Actual Shoot Started</Label>
                <Input
                  type="datetime-local"
                  value={form.actualStartTime}
                  onChange={(e) => setForm(f => ({ ...f, actualStartTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Actual Shoot Ended</Label>
                  {(() => {
                    if (!form.actualStartTime || !form.actualEndTime) return null;
                    const s = new Date(form.actualStartTime).getTime();
                    const e = new Date(form.actualEndTime).getTime();
                    if (isNaN(s) || isNaN(e) || e <= s) return null;
                    const mins = Math.round((e - s) / 60000);
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    return (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {h}h{m ? ` ${m}m` : ''} actual
                      </span>
                    );
                  })()}
                </div>
                <Input
                  type="datetime-local"
                  value={form.actualEndTime}
                  onChange={(e) => setForm(f => ({ ...f, actualEndTime: e.target.value }))}
                />
              </div>
            </div>

            {/* Location + Host row */}
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

            {/* Equipment */}
            {(() => {
              const editingShoot = shoots.find(s => s.id === editingShootId);
              const alreadyReturned = editingShoot ? !!editingShoot.equipmentReturnedAt : false;

              // Sort: selected items first, then unselected
              const sortedEquipment = [...equipment].sort((a, b) => {
                const aSelected = form.equipmentIds.includes(a.id);
                const bSelected = form.equipmentIds.includes(b.id);
                if (aSelected && !bSelected) return -1;
                if (!aSelected && bSelected) return 1;
                return 0;
              });

              return (
                <div className="space-y-3">
                  {/* Equipment Needed */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-gray-900">Equipment Needed</Label>
                    {equipment.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No equipment logged yet — add some from the Equipment page first.
                      </p>
                    ) : (
                      <>
                        {/* Trigger */}
                        <button
                          type="button"
                          onClick={() => setEquipOpen(o => !o)}
                          className="w-full flex items-center justify-between h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <span className={form.equipmentIds.length === 0 ? 'text-gray-400' : 'text-gray-800'}>
                            {form.equipmentIds.length > 0
                              ? `${form.equipmentIds.length} item${form.equipmentIds.length > 1 ? 's' : ''} selected`
                              : 'Select equipment...'}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-150 ${equipOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Inline checklist */}
                        {equipOpen && (
                          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                            {sortedEquipment.map((item, idx) => {
                              const checked = form.equipmentIds.includes(item.id);
                              return (
                                <label
                                  key={item.id}
                                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${idx !== 0 ? 'border-t border-gray-100' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleEquipment(item.id)}
                                    className="h-4 w-4 rounded border-gray-300 accent-gray-900 cursor-pointer"
                                  />
                                  <span className={`text-sm select-none ${checked ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                                    {item.name}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {/* Selected tags */}
                        {form.equipmentIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {form.equipmentIds.map(id => (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200"
                              >
                                {equipmentName(id)}
                                <button
                                  type="button"
                                  onClick={() => toggleEquipment(id)}
                                  className="ml-0.5 hover:text-gray-900 text-gray-400 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Confirm Equipment Back */}
                  {form.equipmentIds.length > 0 && (
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Confirm Equipment Back</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Check off each piece once it&apos;s verified back in place. Status can&apos;t be set to Completed until all equipment is confirmed.
                        </p>
                      </div>

                      {alreadyReturned ? (
                        <p className="flex items-center gap-1.5 text-xs text-green-700">
                          <PackageCheck className="h-3.5 w-3.5" /> All equipment already confirmed back for this shoot.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {form.equipmentIds.map(id => {
                            const verified = !!returnPhotoFiles[id];
                            return (
                              <div
                                key={id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={verified}
                                    readOnly
                                    className="h-4 w-4 rounded border-gray-300 accent-gray-900 cursor-default shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{equipmentName(id)}</p>
                                    <p className={`text-xs ${verified ? 'text-green-600' : 'text-gray-400'}`}>
                                      {verified ? 'Verified back' : 'Not yet confirmed'}
                                    </p>
                                  </div>
                                </div>
                                <label className="shrink-0 cursor-pointer">
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
                                  <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                                    <Camera className="h-3.5 w-3.5" />
                                    {verified ? 'Replace photo' : 'Add photo'}
                                  </span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}
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

            {/* Mileage & Vehicle Verification */}
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-gray-900">Mileage &amp; Vehicle Verification</p>
                <p className="text-xs text-gray-500 mt-0.5">Log odometer readings and photo proof before and after the shoot.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Before card */}
                <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                  <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Before Shoot at Office</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-800">Odometer (miles)</Label>
                    <Input
                      className="h-10 bg-gray-50 border-gray-200"
                      placeholder="e.g. 45,210"
                      value={form.odometerBefore}
                      onChange={(e) => setForm(f => ({ ...f, odometerBefore: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-800">Photo verification</Label>
                    <label className="flex flex-col items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => setMileagePhotosBefore(e.target.files?.[0] || null)}
                      />
                      {mileagePhotosBefore ? (
                        <span className="text-xs text-green-700 font-medium px-2 text-center truncate max-w-full">{mileagePhotosBefore.name}</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Camera className="h-4 w-4" />
                          Upload before photo
                        </span>
                      )}
                    </label>
                  </div>
                </div>

                {/* After card */}
                <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                  <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">After Shoot at Office</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-800">Odometer (miles)</Label>
                    <Input
                      className="h-10 bg-gray-50 border-gray-200"
                      placeholder="e.g. 45,268"
                      value={form.odometerAfter}
                      onChange={(e) => setForm(f => ({ ...f, odometerAfter: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-800">Photo verification</Label>
                    <label className="flex flex-col items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => setMileagePhotosAfter(e.target.files?.[0] || null)}
                      />
                      {mileagePhotosAfter ? (
                        <span className="text-xs text-green-700 font-medium px-2 text-center truncate max-w-full">{mileagePhotosAfter.name}</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Camera className="h-4 w-4" />
                          Upload after photo
                        </span>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Total miles */}
              <p className="text-sm text-gray-600">
                Total miles driven:{' '}
                <span className="font-medium text-gray-900">
                  {(() => {
                    const b = parseFloat(form.odometerBefore);
                    const a = parseFloat(form.odometerAfter);
                    return (!isNaN(b) && !isNaN(a) && a > b) ? `${(a - b).toFixed(1)} mi` : '—';
                  })()}
                </span>
              </p>
            </div>

            {/* Stops along the way */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">Stops along the way</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStop}
                  className="h-8 gap-1 text-xs border-gray-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Add stop
                </Button>
              </div>
              {form.stops.length > 0 && (
                <div className="space-y-2">
                  {form.stops.map((stop, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        className="h-9 bg-gray-50 border-gray-200 text-sm"
                        placeholder={`Stop ${idx + 1} location`}
                        value={stop}
                        onChange={(e) => updateStop(idx, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeStop(idx)}
                        className="h-9 w-9 flex items-center justify-center rounded-md border border-gray-200 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Receipts & Expense Reimbursement */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Receipts &amp; Expense Reimbursement</p>
                <p className="text-xs text-gray-500 mt-0.5">Attach receipts for anything spent on this shoot (gas, parking, supplies) to submit for reimbursement.</p>
              </div>

              <button
                type="button"
                onClick={addExpense}
                className="w-full flex items-center justify-center gap-1.5 h-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add receipt
              </button>

              {form.expenses.length > 0 && (
                <div className="space-y-2">
                  {form.expenses.map((exp, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center">
                      <Input
                        className="h-9 bg-gray-50 border-gray-200 text-sm"
                        placeholder="Description (gas, parking…)"
                        value={exp.description}
                        onChange={(e) => updateExpense(idx, 'description', e.target.value)}
                      />
                      <Input
                        className="h-9 bg-gray-50 border-gray-200 text-sm"
                        placeholder="$0.00"
                        value={exp.amount}
                        onChange={(e) => updateExpense(idx, 'amount', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeExpense(idx)}
                        className="h-9 w-9 flex items-center justify-center rounded-md border border-gray-200 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-sm text-gray-600">
                Total submitted for reimbursement:{' '}
                <span className="font-medium text-gray-900">
                  ${form.expenses.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0).toFixed(2)}
                </span>
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-800">Notes</Label>
              <Textarea
                className="bg-gray-50 border-gray-200 resize-none min-h-[80px]"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Anything else the crew should know..."
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-8 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white sticky bottom-0">
            <Button variant="outline" className="h-10 px-5 border-gray-300 text-gray-700" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button
              className="h-10 px-5 bg-gray-900 hover:bg-gray-800 text-white font-semibold"
              onClick={handleSubmit}
              disabled={saving}
            >
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