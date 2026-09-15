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
  Camera, Plus, Loader, CheckCircle2, PackageCheck, ChevronDown, X, FileText, Trash2,
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

  const [returnDialogShoot, setReturnDialogShoot] = useState<Shoot | null>(null);
  const [returnPhotoFiles, setReturnPhotoFiles] = useState<Record<string, File | null>>({});
  const [confirmingReturn, setConfirmingReturn] = useState(false);

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

  // Permanent hard delete (via the shared /api/tasks/[id] route, which also
  // handles the same for deliverable/SF/LF tasks) — added specifically for
  // clearing out test data while building/testing the scripting feature.
  // No undo, no soft-delete: confirm before wiring a bulk version of this.
  const deleteShoot = async (shootId: string, label: string) => {
    if (!window.confirm(`Permanently delete "${label}"? This can't be undone.`)) return;
    setShoots(prev => prev.filter(s => s.id !== shootId));
    try {
      const res = await fetch(`/api/tasks/${shootId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to delete');
        fetchAll();
      } else {
        toast.success('Deleted');
      }
    } catch {
      toast.error('Failed to delete');
      fetchAll();
    }
  };

  const openCreateForm = () => {
    setEditingShootId(null);
    setForm({ ...EMPTY_FORM });
    setIsFormOpen(true);
  };

  const openEditForm = (shoot: Shoot) => {
    setEditingShootId(shoot.id);
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

  const submitEquipmentReturn = async () => {
    if (!returnDialogShoot) return;
    const allFilled = returnDialogShoot.equipmentIds.every(id => !!returnPhotoFiles[id]);
    if (!allFilled) return;
    setConfirmingReturn(true);
    try {
      const formData = new FormData();
      // Order matches equipmentIds — the backend expects exactly one photo
      // per equipment item, count-checked against the shoot's equipmentIds.
      for (const id of returnDialogShoot.equipmentIds) {
        formData.append('photos', returnPhotoFiles[id]!);
      }
      const res = await fetch(`/api/shoots/${returnDialogShoot.id}/equipment-return`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        toast.success('Equipment return confirmed');
        setReturnDialogShoot(null);
        setReturnPhotoFiles({});
        fetchAll();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to confirm return');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setConfirmingReturn(false);
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

      <div className="space-y-4">
        {filteredShoots.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
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
            const equipmentReturned = !!shoot.equipmentReturnedAt;
            return (
              <Card key={shoot.id} className="overflow-hidden rounded-xl border-slate-200 shadow-none">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-xl font-bold text-slate-950">{shoot.client?.companyName || shoot.client?.name || shoot.title || 'Shoot'}</h3>
                      <div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline" className="rounded-full border-slate-300 bg-white text-[10px] font-medium uppercase tracking-wide text-slate-700">Videographer assigned</Badge>{equipmentReturned && <Badge variant="outline" className="gap-1 rounded-full border-slate-300 bg-white text-[10px] font-medium text-slate-700"><PackageCheck className="h-3 w-3" /> Equipment returned</Badge>}{shoot.equipmentIds.map(id => <span key={id} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">{equipmentName(id)}</span>)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Select
                        value={SHOOT_STATUSES.includes(shoot.status as ShootStatus) ? shoot.status : 'PENDING'}
                        onValueChange={(v) => updateStatus(shoot.id, v as ShootStatus)}
                      >
                        <SelectTrigger className="h-10 w-[170px] text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SHOOT_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={() => openEditForm(shoot)} className="h-10 w-[170px] rounded-lg">Edit shoot details</Button>
                      <Button
                        variant="outline"
                        onClick={() => deleteShoot(shoot.id, shoot.client?.companyName || shoot.client?.name || shoot.title || 'this shoot')}
                        className="h-10 w-10 rounded-lg border-red-200 p-0 text-red-600 hover:bg-red-50"
                        title="Delete shoot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-6 pb-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Shoot day</p><p className="mt-1 text-sm text-slate-950">{shoot.shootDate ? new Date(shoot.shootDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set'}</p></div>
                    <div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Location</p><p className="mt-1 truncate text-sm text-slate-950">{shoot.location || 'Not set'}</p></div>
                    <div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Host</p><p className="mt-1 text-sm text-slate-950">{shoot.hostName || 'Not set'}</p></div>
                    <div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Videographer</p><p className="mt-1 text-sm text-slate-950">{shoot.videographer?.name || shoot.videographer?.email || 'Unassigned'}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-6 py-3.5"><p className="text-xs text-slate-600">{shoot.scriptsCount} of {shoot.videosPlanned} scripts written · {shoot.scriptStatus === 'sent' ? 'scripts sent to client' : 'none sent to client'}</p><div className="flex gap-2">{!equipmentReturned && shoot.equipmentIds.length > 0 && <Button variant="outline" size="sm" className="h-9" onClick={() => { setReturnDialogShoot(shoot); setReturnPhotoFiles({}); }}>Confirm Equipment Back</Button>}<Button size="sm" className="h-9 gap-1.5 rounded-lg bg-slate-950 hover:opacity-85" onClick={() => openScriptDialog(shoot)}><FileText className="h-3.5 w-3.5" /> Script{shoot.scriptsCount ? ' — Draft' : ''}</Button></div></div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create / Edit Shoot Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as ShootStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHOOT_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Equipment Return Photo Dialog — one photo required per equipment item */}
      <Dialog open={!!returnDialogShoot} onOpenChange={(open) => { if (!open) { setReturnDialogShoot(null); setReturnPhotoFiles({}); } }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm Equipment Returned</DialogTitle>
            <DialogDescription>
              A photo is required for each piece of equipment on this shoot
              {returnDialogShoot ? ` (${Object.values(returnPhotoFiles).filter(Boolean).length}/${returnDialogShoot.equipmentIds.length})` : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {returnDialogShoot?.equipmentIds.map(id => (
              <div key={id} className="space-y-1.5">
                <Label className="text-xs">{equipmentName(id)}</Label>
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setReturnPhotoFiles(prev => ({ ...prev, [id]: e.target.files?.[0] || null }))}
                />
                {returnPhotoFiles[id] && (
                  <img
                    src={URL.createObjectURL(returnPhotoFiles[id]!)}
                    alt={`${equipmentName(id)} returned`}
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setReturnDialogShoot(null); setReturnPhotoFiles({}); }}>Cancel</Button>
            <Button
              onClick={submitEquipmentReturn}
              disabled={!returnDialogShoot || !returnDialogShoot.equipmentIds.every(id => !!returnPhotoFiles[id]) || confirmingReturn}
              className="gap-1.5"
            >
              {confirmingReturn ? 'Uploading...' : (<><CheckCircle2 className="h-4 w-4" /> Confirm</>)}
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
