'use client';

import { useEffect, useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { X, Tag as TagIcon, Plus } from 'lucide-react';

interface TagPickerProps {
  taskId: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  // Only admins can remove a tag from a task (adding stays open to everyone).
  // Defaults to false so any caller that forgets to pass it fails safe.
  canRemove?: boolean;
}

// One shared /api/tags request for every mounted picker (there is one per task
// row) — previously each row fetched the full tag list on its own mount.
let tagNamesPromise: Promise<string[]> | null = null;
let tagNamesFetchedAt = 0;
const TAG_NAMES_TTL_MS = 60_000;

function loadTagNames(): Promise<string[]> {
  if (tagNamesPromise && Date.now() - tagNamesFetchedAt < TAG_NAMES_TTL_MS) return tagNamesPromise;
  tagNamesFetchedAt = Date.now();
  tagNamesPromise = fetch('/api/tags', { credentials: 'include' })
    .then((res) => res.json())
    .then((data) => (data.ok ? data.tags.map((t: any) => t.name as string) : []))
    .catch(() => {
      tagNamesPromise = null;
      return [] as string[];
    });
  return tagNamesPromise;
}

export function TagPicker({ taskId, tags, onChange, canRemove = false }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTagNames().then((names) => {
      if (!cancelled) setAllTags(names);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
        // Revert the optimistic update — e.g. a non-admin tag removal
        // the backend rejected with 403 shouldn't leave the tag looking
        // removed in the UI while it's still attached server-side.
        onChange(previous);
      }
    } catch {
      onChange(previous);
    } finally {
      setSaving(false);
    }
  };

  const addTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    saveTags([...tags, trimmed]);
    if (!allTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setAllTags((prev) => [...prev, trimmed]);
    }
    setSearch('');
  };

  const removeTag = (name: string) => {
    if (!canRemove) return;
    saveTags(tags.filter((t) => t !== name));
  };

  const suggestions = allTags.filter(
    (t) => !tags.some((existing) => existing.toLowerCase() === t.toLowerCase())
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          {canRemove && (
            <button onClick={() => removeTag(tag)} className="hover:text-red-600" disabled={saving}>
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
            <TagIcon className="h-3 w-3" />
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search or create tag..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>
                {search.trim() && (
                  <button
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                    onClick={() => {
                      addTag(search);
                      setOpen(false);
                    }}
                  >
                    Create "{search.trim()}"
                  </button>
                )}
              </CommandEmpty>
              <CommandGroup>
                {suggestions.map((t) => (
                  <CommandItem
                    key={t}
                    value={t}
                    onSelect={() => {
                      addTag(t);
                      setOpen(false);
                    }}
                  >
                    {t}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}