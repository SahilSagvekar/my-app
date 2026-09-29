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

interface PendingImage {
  id: string;
  file: File;
  preview: string;
}

const EMPTY_FORM = { name: '', category: '', notes: '' };

// Photos picked in the dialog before saving. Kept modest because each photo
// is its own upload request.
const MAX_IMAGES_PER_SAVE = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // must match the limit in the images API route

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

/** Keeps only real images under the size cap and within the room left; toasts what was skipped. */
function pickValidImages(files: File[], room: number): File[] {
  const valid: File[] = [];
  let notImage = 0;
  let tooBig = 0;

  for (const file of files) {
    if (!file.type.startsWith('image/')) { notImage++; continue; }
    if (file.size > MAX_IMAGE_BYTES) { tooBig++; continue; }
    valid.push(file);
  }

  if (notImage > 0) toast.error(`${notImage} file(s) skipped — only images are allowed`);
  if (tooBig > 0) toast.error(`${tooBig} image(s) skipped — max size is ${MAX_IMAGE_BYTES / (1024 * 1024)} MB each`);
  if (valid.length > room) {
    toast.error(`Only ${MAX_IMAGES_PER_SAVE} photos at a time — extra photos were skipped`);
    return valid.slice(0, room);
  }
  return valid;
}

/**
 * Uploads photos one request at a time. Each request carries a single file so
 * the server never has to hold several photos in memory at once, and the
 * server-side "append to the list" step can't race against itself.
 */
async function uploadImagesOneByOne(
  equipmentId: string,
  files: File[],
  onProgress?: (current: number, total: number) => void,
): Promise<{ equipment: EquipmentItem | null; failed: number; firstError: string | null }> {
  let latest: EquipmentItem | null = null;
  let failed = 0;
  let firstError: string | null = null;

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length);
    try {
      const formData = new FormData();
      formData.append('images', files[i]);
      const res = await fetch(`/api/equipment/${equipmentId}/images`, { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        latest = data.equipment;
      } else {
        failed++;
        if (!firstError) {
          const err = await res.json().catch(() => ({}));
          firstError = err.error || `Upload failed (${res.status})`;
        }
      }
    } catch {
      failed++;
      if (!firstError) firstError = 'Network error';
    }
  }

  return { equipment: latest, failed, firstError };
}

export function EquipmentPage() {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  // Anyone on the team can add equipment and attach photos; only admins can
  // delete equipment or remove photos; editing details is admin/manager.
  const canAdd = !!user && role !== 'client';
  const canEdit = role === 'admin' || role === 'manager';

  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);

  // Photos chosen in the Add/Edit dialog, uploaded right after the item is saved.
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  pendingImagesRef.current = pendingImages;
  const formFileInputRef = useRef<HTMLInputElement | null>(null);

  // Card-level photo upload state — tracked per equipment id so multiple
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

  // Free the blob: preview URLs if the page is left with photos still picked.
  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

  const clearPendingImages = () => {
    pendingImagesRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
    setPendingImages([]);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    clearPendingImages();
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    clearPendingImages();
    setIsFormOpen(true);
  };

  const openEditForm = (item: EquipmentItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, category: item.category || '', notes: item.notes || '' });
    clearPendingImages();
    setIsFormOpen(true);
  };

  // ------------------------ PHOTOS PICKED IN THE DIALOG ------------------------

  const handleFormImagesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // so picking the same file again still fires onChange
    if (picked.length === 0) return;

    const room = MAX_IMAGES_PER_SAVE - pendingImages.length;
    if (room <= 0) {
      toast.error(`Only ${MAX_IMAGES_PER_SAVE} photos at a time`);
      return;
    }

    const valid = pickValidImages(picked, room);
    if (valid.length === 0) return;

    setPendingImages((prev) => [
      ...prev,
      ...valid.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  };

  const removePendingImage = (id: string) => {
    setPendingImages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to save equipment');
        return;
      }

      const saved = await res.json().catch(() => ({}));
      const targetId: string | undefined = editingId || saved.equipment?.id;
      const files = pendingImages.map((p) => p.file);
      const doneMessage = editingId ? 'Equipment updated' : 'Equipment added';

      if (files.length > 0 && targetId) {
        const { failed, firstError } = await uploadImagesOneByOne(
          targetId,
          files,
          (current, total) => setSaveProgress({ current, total }),
        );
        if (failed === 0) {
          toast.success(files.length > 1 ? `${doneMessage} with ${files.length} photos` : `${doneMessage} with 1 photo`);
        } else {
          // The item itself is saved — only some photos didn't make it.
          toast.error(
            `${doneMessage}, but ${failed} of ${files.length} photo(s) failed to upload${firstError ? `: ${firstError}` : ''}. You can add them again from the card.`,
          );
        }
      } else {
        toast.success(doneMessage);
      }

      closeForm();
      fetchEquipment();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
      setSaveProgress(null);
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

  // ---------------------------- PHOTOS ON A CARD ----------------------------
  // Anyone can add one or more photos to an existing item; only an admin can
  // remove one.

  const handleAddImagesClick = (itemId: string) => {
    fileInputRefs.current[itemId]?.click();
  };

  const handleImagesSelected = async (itemId: string, fileList: FileList | null) => {
    const input = fileInputRefs.current[itemId];
    if (!fileList || fileList.length === 0) return;

    const files = pickValidImages(Array.from(fileList), MAX_IMAGES_PER_SAVE);
    if (files.length === 0) {
      if (input) input.value = '';
      return;
    }

    setUploadingImagesFor(itemId);
    try {
      const { equipment: updated, failed, firstError } = await uploadImagesOneByOne(itemId, files);

      if (updated) {
        setEquipment((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
      }
      if (failed === 0) {
        toast.success(files.length > 1 ? 'Photos added' : 'Photo added');
      } else {
        toast.error(`${failed} of ${files.length} photo(s) failed to upload${firstError ? `: ${firstError}` : ''}`);
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setUploadingImagesFor(null);
      // Reset so selecting the same file again still fires onChange
      if (input) input.value = '';
    }
  };

  const handleDeleteImage = async (itemId: string, imageUrl: string) => {
    if (!confirm('Remove this photo?')) return;
    try {
      const res = await fetch(`/api/equipment/${itemId}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setEquipment((prev) => prev.map((item) => (item.id === itemId ? data.equipment : item)));
        toast.success('Photo removed');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to remove photo');
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
          canAdd ? (
            <Button onClick={openCreateForm} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Add Equipment
            </Button>
          ) : undefined
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

                  {/* Photos */}
                  {(images.length > 0 || canAdd) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {images.map((url) => (
                        <div key={url} className="relative group shrink-0">
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt={`${item.name} photo`}
                              className="h-14 w-14 rounded-md object-cover border border-slate-200"
                            />
                          </a>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteImage(item.id, url)}
                              className="absolute -top-1.5 -right-1.5 h-[18px] w-[18px] rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                              title="Remove photo"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}

                      {canAdd && (
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
                            title="Add photo(s)"
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

                  {(canEdit || isAdmin) && (
                    <div className="flex gap-2 pt-1">
                      {canEdit && (
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs flex-1" onClick={() => openEditForm(item)}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      )}
                      {isAdmin && (
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-red-600 hover:bg-red-50 border-red-200" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (open) setIsFormOpen(true);
          else if (!saving) closeForm(); // don't close mid-upload
        }}
      >
        <DialogContent className="max-w-md">
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

            {/* Photos — pick as many as you like; they upload right after Save */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Photos <span className="text-muted-foreground font-normal">(optional, up to {MAX_IMAGES_PER_SAVE})</span>
              </Label>
              <input
                ref={formFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFormImagesPicked}
              />
              <div className="flex flex-wrap gap-1.5">
                {pendingImages.map((p) => (
                  <div key={p.id} className="relative group shrink-0">
                    <img
                      src={p.preview}
                      alt={p.file.name}
                      className="h-16 w-16 rounded-md object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => removePendingImage(p.id)}
                      disabled={saving}
                      className="absolute -top-1.5 -right-1.5 h-[18px] w-[18px] rounded-full bg-red-600 text-white flex items-center justify-center shadow-sm disabled:opacity-50"
                      title="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {pendingImages.length < MAX_IMAGES_PER_SAVE && (
                  <button
                    type="button"
                    onClick={() => formFileInputRef.current?.click()}
                    disabled={saving}
                    className="h-16 w-16 rounded-md border border-dashed border-slate-300 flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors shrink-0 disabled:opacity-50"
                    title="Add photo(s)"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-[10px] leading-none">Add</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving
                ? saveProgress
                  ? `Uploading photo ${saveProgress.current}/${saveProgress.total}...`
                  : 'Saving...'
                : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}