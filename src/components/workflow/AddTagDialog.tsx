'use client';
// src/components/workflow/AddTagDialog.tsx
//
// Modal-style tag editor for the new Task Actions menu — same underlying
// tag feature as TagPicker.tsx (same /api/tasks/[id]/tags endpoint, same
// global tag list), just a different presentation: a plain text input +
// Add button + removable chips in a Dialog, matching the editor portal
// redesign mockups, instead of TagPicker's search/autocomplete combobox.
//
// TagPicker itself is untouched — it's also used by Admin, Scheduler, and
// QC dashboards, which keep their existing combobox UI.
//
// Tag removal is admin-only server-side (see /api/tasks/[id]/tags). The
// mockup shows a removable × on every chip, so this shows it too, but a
// non-admin's removal attempt gets a 403 from the server — handled here by
// reverting the optimistic removal and toasting an explanation, rather than
// hiding the × outright.

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface AddTagDialogProps {
  taskId: string;
  tags: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (tags: string[]) => void;
}

export function AddTagDialog({ taskId, tags, open, onOpenChange, onChange }: AddTagDialogProps) {
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const saveTags = async (next: string[]) => {
    const previous = tags;
    onChange(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagNames: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onChange(previous);
        toast.error(data.message || 'Failed to update tags');
      }
    } catch {
      onChange(previous);
      toast.error('Network error — tags not saved');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInput('');
      return;
    }
    saveTags([...tags, trimmed]);
    setInput('');
  };

  const handleRemove = (name: string) => {
    saveTags(tags.filter((t) => t !== name));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Add Tag</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Type a tag and add it. You can add more than one.
        </p>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="e.g. Priority, Reshoot"
            disabled={saving}
            autoFocus
          />
          <Button onClick={handleAdd} disabled={saving || !input.trim()}>
            Add
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1 text-sm py-1 px-2.5">
                {tag}
                <button
                  onClick={() => handleRemove(tag)}
                  className="hover:text-red-600"
                  disabled={saving}
                  title="Remove tag (admin only)"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}