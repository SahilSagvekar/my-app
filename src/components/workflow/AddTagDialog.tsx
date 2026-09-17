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
      <DialogContent className="max-w-[440px] sm:max-w-[440px] rounded-3xl p-6 bg-white border border-gray-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader className="p-0 space-y-1">
          <DialogTitle className="text-[19px] font-extrabold text-gray-900 tracking-tight">
            Add Tag
          </DialogTitle>
          <p className="text-[13px] text-gray-500 font-normal">
            Type a tag and add it. You can add more than one.
          </p>
        </DialogHeader>

        <div className="flex items-center gap-2.5 mt-4">
          <input
            type="text"
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
            className="h-11 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition-colors shadow-2xs"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="h-11 px-5 rounded-xl bg-black text-white hover:bg-neutral-800 font-bold text-sm shrink-0 transition-colors shadow-xs active:scale-95 disabled:opacity-80"
          >
            Add
          </button>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/80"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemove(tag)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  disabled={saving}
                  title="Remove tag"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}