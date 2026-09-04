'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Settings, Plus, Pencil, Trash2, Loader } from 'lucide-react';
import { toast } from 'sonner';

interface EquipmentItem {
  id: string;
  name: string;
  category?: string | null;
  notes?: string | null;
  isActive: boolean;
}

const EMPTY_FORM = { name: '', category: '', notes: '' };

interface EquipmentPageProps {
  /** Edit/Delete are admin-only. Real videographers can add equipment
   * but not edit or remove it — defaults to true (full access) so any
   * other caller of this page isn't accidentally locked down. */
  canManage?: boolean;
}

export function EquipmentPage({ canManage = true }: EquipmentPageProps) {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Equipment</h1>
          <p className="text-muted-foreground text-sm mt-1">Everything E8 owns, available to select on a shoot</p>
        </div>
        <Button onClick={openCreateForm} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Add Equipment
        </Button>
      </div>

      {equipment.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Settings className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No equipment logged yet</p>
          <p className="text-sm text-slate-400 mt-1">Add cameras, lights, and other gear so it can be selected on a shoot</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipment.map(item => (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                  {item.category && <Badge variant="secondary" className="text-[10px] shrink-0">{item.category}</Badge>}
                </div>
                {item.notes && <p className="text-xs text-muted-foreground line-clamp-2">{item.notes}</p>}
                {canManage && (
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs flex-1" onClick={() => openEditForm(item)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-red-600 hover:bg-red-50 border-red-200" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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
              <Input
                value={form.category}
                onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Camera, Lighting, Audio"
              />
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