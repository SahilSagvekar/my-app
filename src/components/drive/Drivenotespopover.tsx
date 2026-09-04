'use client';

import { useState } from 'react';
import { StickyNote, Send, Pencil, Trash2, Check, X, MessageSquareOff } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

export interface DriveNoteEntry {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: { id?: number; name: string };
  canManage: boolean;
}

interface DriveNotesPopoverProps {
  clientId: string;
  s3Key: string;
  isFolder: boolean;
  itemName: string;
  /** false for editor — read-only, no compose box */
  canCreate: boolean;
  notes: DriveNoteEntry[];
  onNotesChange: (s3Key: string, notes: DriveNoteEntry[]) => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Notes on a file/folder in Drive — instructions from admin/videographer to
 * the editor. Restricted to those three roles at the call site (this
 * component doesn't re-check role; DriveExplorer only renders it for them).
 */
export function DriveNotesPopover({ clientId, s3Key, isFolder, itemName, canCreate, notes, onNotesChange }: DriveNotesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const hasNotes = notes.length > 0;
  // Nothing to show and nothing this person can do about it.
  if (!hasNotes && !canCreate) return null;

  const postNote = async () => {
    const content = draft.trim();
    if (!content) return;
    setPosting(true);
    try {
      const res = await fetch('/api/drive/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, s3Key, isFolder, content }),
      });
      if (res.ok) {
        const data = await res.json();
        onNotesChange(s3Key, [...notes, data.note]);
        setDraft('');
      }
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (note: DriveNoteEntry) => {
    setEditingId(note.id);
    setEditingText(note.content);
  };

  const saveEdit = async (id: string) => {
    const content = editingText.trim();
    if (!content) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/drive/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        onNotesChange(s3Key, notes.map(n => n.id === id ? { ...n, content: data.note.content, updatedAt: data.note.updatedAt } : n));
        setEditingId(null);
      }
    } finally {
      setBusyId(null);
    }
  };

  const deleteNote = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/drive/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onNotesChange(s3Key, notes.filter(n => n.id !== id));
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          title={hasNotes ? `${notes.length} note${notes.length > 1 ? 's' : ''}` : 'Add a note'}
          className={cn(
            'relative flex items-center justify-center h-7 w-7 rounded-md transition-all shrink-0',
            hasNotes
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground',
          )}
        >
          <StickyNote className="h-3.5 w-3.5" />
          {hasNotes && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white leading-none">
              {notes.length}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[340px] p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <StickyNote className="h-3.5 w-3.5 text-amber-600" />
            Notes
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{itemName}</p>
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
              <MessageSquareOff className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No notes yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notes.map(note => (
                <div key={note.id} className="group/note px-4 py-3 flex gap-2.5">
                  <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                    <AvatarFallback className="text-[10px] bg-amber-100 text-amber-800 font-semibold">
                      {initials(note.author.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">{note.author.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{relativeTime(note.createdAt)}</span>
                      {note.canManage && editingId !== note.id && (
                        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(note)}
                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            disabled={busyId === note.id}
                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {editingId === note.id ? (
                      <div className="mt-1.5 space-y-1.5">
                        <Textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={2}
                          autoFocus
                          className="text-xs resize-none"
                        />
                        <div className="flex items-center gap-1">
                          <Button size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => saveEdit(note.id)} disabled={busyId === note.id}>
                            <Check className="h-3 w-3" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={() => setEditingId(null)}>
                            <X className="h-3 w-3" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap mt-0.5 break-words">
                        {note.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compose — admin/videographer only */}
        {canCreate && (
          <div className="border-t p-2.5 flex items-end gap-2 bg-muted/20">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  postNote();
                }
              }}
              placeholder="Add a note for the editor…"
              rows={1}
              className="text-xs resize-none min-h-[32px] py-1.5"
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={postNote}
              disabled={!draft.trim() || posting}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}