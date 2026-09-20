'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Settings, Plus, Pencil, Trash2, Loader, ImagePlus, X } from 'lucide-react';
import { PageHeader } from '../ui/page-header';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';

interface EquipmentItem {
  id: string;
  name: string;
  category?: string | null;
  notes?: string | null;
  isActive: boolean;
  referenceImageUrls?: string[] | null;
}

const EMPTY_FORM = { name: '', category: '', notes: '' };

const EQUIPMENT_CATEGORIES = [
  'Camera',
  'Action Camera',
  'Lighting',
  'Audio',
  'Microphone',
  'Tripod',
  'Stabilization (Gimbal, Steadicam, Slider)',
  'Lenses',
  'ND Filters',
  'Teleprompter',
  'Backdrop & Set Dressing',
  'Cables & Connectors',
  'Power & Battery',
  'Storage Media',
  'Monitor & Display',
  'Drone',
  'Case & Bag (Hard Case, Equipment Bag)',
  'Laptop/Computer',
  'External Drive/SSD',
  'Memory Card',
  'Batteries & Chargers',
  'Extension Cord/Power Strip',
];

export function EquipmentPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Reference image upload state — tracked per equipment id so multiple
  // cards can't stomp on each other's "uploading" spinner.
  const [uploadingImagesFor, setUploadingImagesFor] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchEquipment = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/equipment');
      if (res.ok) {
        const data = await res.json();
        setEquipment(data.equipment || []);
      }
    } catch (err) {
      console.error('Failed to load equipment:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEquipment(); }, [fetchEquipment]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setIsFormOpen(true);
  };

  const openEditForm = (item: EquipmentItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, category: item.category || '', notes: item.notes || '' });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Equipment name is required');
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/equipment/${editingId}` : '/api/equipment';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(editingId ? 'Equipment updated' : 'Equipment added');
        setIsFormOpen(false);
        fetchEquipment();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to save equipment');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this equipment item? Past shoots will keep their record of it.')) return;
    try {
      const res = await fetch(`/api/equipment/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Equipment removed');
        fetchEquipment();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to remove equipment');
      }
    } catch {
      toast.error('Something went wrong');
    }
  };

  // ---------------------------- REFERENCE IMAGES ----------------------------
  // Admin-only: add one or more reference photos to an equipment item.

  const handleAddImagesClick = (itemId: string) => {
    fileInputRefs.current[itemId]?.click();
  };

  const handleImagesSelected = async (itemId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingImagesFor(itemId);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('images', file));

      const res = await fetch(`/api/equipment/${itemId}/images`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setEquipment((prev) => prev.map((item) => (item.id === itemId ? data.equipment : item)));
        toast.success(files.length > 1 ? 'Reference images added' : 'Reference image added');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to add reference images');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setUploadingImagesFor(null);
      // Reset so selecting the same file again still fires onChange
      const input = fileInputRefs.current[itemId];
      if (input) input.value = '';
    }
  };

  const handleDeleteImage = async (itemId: string, imageUrl: string) => {
    if (!confirm('Remove this reference image?')) return;
    try {
      const res = await fetch(`/api/equipment/${itemId}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setEquipment((prev) => prev.map((item) => (item.id === itemId ? data.equipment : item)));
        toast.success('Reference image removed');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to remove reference image');
      }
    } catch {
      toast.error('Something went wrong');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading equipment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment"
        description="Everything E8 owns, available to select on a shoot"
        actions={
        <Button onClick={openCreateForm} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Add Equipment
        </Button>
        }
      />

      {equipment.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Settings className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No equipment logged yet</p>
          <p className="text-sm text-slate-400 mt-1">Add cameras, lights, and other gear so it can be selected on a shoot</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipment.map(item => {
            const images = item.referenceImageUrls || [];
            const isUploading = uploadingImagesFor === item.id;

            return (
              <Card key={item.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                    {item.category && <Badge variant="secondary" className="text-[10px] shrink-0">{item.category}</Badge>}
                  </div>
                  {item.notes && <p className="text-xs text-muted-foreground line-clamp-2">{item.notes}</p>}

                  {/* Reference Images */}
                  {(images.length > 0 || isAdmin) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {images.map((url) => (
                        <div key={url} className="relative group shrink-0">
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt={`${item.name} reference`}
                              className="h-14 w-14 rounded-md object-cover border border-slate-200"
                            />
                          </a>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteImage(item.id, url)}
                              className="absolute -top-1.5 -right-1.5 h-[18px] w-[18px] rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                              title="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}

                      {isAdmin && (
                        <>
                          <input
                            ref={(el) => { fileInputRefs.current[item.id] = el; }}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleImagesSelected(item.id, e.target.files)}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddImagesClick(item.id)}
                            disabled={isUploading}
                            className="h-14 w-14 rounded-md border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors shrink-0 disabled:opacity-50"
                            title="Add reference image(s)"
                          >
                            {isUploading ? (
                              <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                              <ImagePlus className="h-4 w-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs flex-1" onClick={() => openEditForm(item)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-red-600 hover:bg-red-50 border-red-200" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
            <DialogDescription>Kept in the shared list so it can be selected on any shoot.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Sony A7S III"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm(f => ({ ...f, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {/* Keep a legacy free-text category selectable so editing an
                      older item doesn't silently blank it out. */}
                  {form.category && !EQUIPMENT_CATEGORIES.includes(form.category) && (
                    <SelectItem value={form.category}>{form.category}</SelectItem>
                  )}
                  {EQUIPMENT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}