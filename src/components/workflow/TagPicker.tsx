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
}

export function TagPicker({ taskId, tags, onChange }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/tags', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setAllTags(data.tags.map((t: any) => t.name));
      })
      .catch(() => {});
  }, []);

  const saveTags = async (next: string[]) => {
    onChange(next);
    setSaving(true);
    try {
      await fetch(`/api/tasks/${taskId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagNames: next }),
      });
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
          <button onClick={() => removeTag(tag)} className="hover:text-red-600" disabled={saving}>
            <X className="h-3 w-3" />
          </button>
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
