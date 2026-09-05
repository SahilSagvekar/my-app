'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
  Camera, MapPin, Clock, User, Plus, Pencil, Loader, CheckCircle2,
  PackageCheck, Image as ImageIcon, ChevronDown, X, FileText,
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

function statusMeta(status: string) {
  return STATUS_META[status as ShootStatus] || { label: status.replace(/_/g, ' '), className: 'bg-slate-100 text-slate-700' };
}

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Shooting Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">All upcoming and past shoot days</p>
        </div>
        <Button onClick={openCreateForm} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> New Shoot
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
        <div className="space-y-1 flex-1 min-w-[140px]">
          <Label className="text-[11px] text-muted-foreground">Status</Label>
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

        <div className="space-y-1 flex-1 min-w-[160px]">
          <Label className="text-[11px] text-muted-foreground">Client</Label>
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

        <div className="space-y-1 flex-1 min-w-[130px]">
          <Label className="text-[11px] text-muted-foreground">From</Label>
          <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1 flex-1 min-w-[130px]">
          <Label className="text-[11px] text-muted-foreground">To</Label>
          <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground h-9">
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
              <Card key={shoot.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-lg truncate">
                          {shoot.client?.companyName || shoot.client?.name || shoot.title || 'Shoot'}
                        </h3>
                        <Badge className={statusMeta(shoot.status).className}>{statusMeta(shoot.status).label}</Badge>
                        {equipmentReturned && (
                          <Badge className="bg-green-100 text-green-800 gap-1">
                            <PackageCheck className="h-3 w-3" /> Equipment returned
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          <Clock className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium text-slate-900">
                            {shoot.shootDate ? new Date(shoot.shootDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'No time set'}
                          </span>
                        </div>
                        {shoot.location && (
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <MapPin className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-medium truncate text-slate-900" title={shoot.location}>{shoot.location}</span>
                          </div>
                        )}
                        {shoot.hostName && (
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <User className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-medium text-slate-900">Host: {shoot.hostName}</span>
                          </div>
                        )}
                        {shoot.videographer && (
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <Camera className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-medium text-slate-900">{shoot.videographer.name || shoot.videographer.email}</span>
                          </div>
                        )}
                      </div>

                      {shoot.equipmentIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {shoot.equipmentIds.map(id => (
                            <Badge key={id} variant="secondary" className="text-[10px] bg-slate-100">
                              {equipmentName(id)}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {equipmentReturned && shoot.equipmentReturnedPhotoUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {shoot.equipmentReturnedPhotoUrls.map((url, idx) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:underline"
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              {equipmentName(shoot.equipmentIds[idx])}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row md:flex-col gap-2 shrink-0">
                      <Select
                        value={SHOOT_STATUSES.includes(shoot.status as ShootStatus) ? shoot.status : 'PENDING'}
                        onValueChange={(v) => updateStatus(shoot.id, v as ShootStatus)}
                      >
                        <SelectTrigger className="h-8 text-xs w-full md:w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SHOOT_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => openEditForm(shoot)} className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-blue-200 hover:bg-blue-50 text-blue-700"
                        onClick={() => openScriptDialog(shoot)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Scripts
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{shoot.scriptsCount}/{shoot.videosPlanned}</Badge>
                      </Button>
                      {!equipmentReturned && shoot.equipmentIds.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-green-200 hover:bg-green-50 text-green-700"
                          onClick={() => { setReturnDialogShoot(shoot); setReturnPhotoFiles({}); }}
                        >
                          <PackageCheck className="h-3.5 w-3.5" /> Confirm Equipment Back
                        </Button>
                      )}
                    </div>
                  </div>
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
                <Select value={form.clientId} onValueChange={(v) => setForm(f => ({ ...f, clientId: v }))}>
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
              <Input type="number" min="1" max="99" value={form.videosPlanned} onChange={(e) => setForm(f => ({ ...f, videosPlanned: e.target.value }))} />
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
