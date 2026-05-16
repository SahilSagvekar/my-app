'use client';
// src/components/tasks/LinkedSfTasks.tsx
// Usage: <LinkedSfTasks lfTaskId={task.id} clientId={task.clientId} canEdit={role !== 'client'} />

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link2, X, Search, Plus, Loader2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LinkedTask {
  id: string;
  title: string | null;
  description: string;
  deliverableType: string | null;
  status: string | null;
  dueDate: string | null;
  client: { name: string } | null;
  user: { name: string } | null;
}

interface SearchTask {
  id: string;
  title: string | null;
  description: string;
  deliverableType: string | null;
  status: string | null;
  relatedTaskId: string | null;
  client: { name: string } | null;
  user: { name: string } | null;
}

interface Props {
  lfTaskId: string;
  clientId?: string | null;
  canEdit?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-50 text-blue-700',
  ready_for_qc: 'bg-yellow-50 text-yellow-700',
  qc_in_progress: 'bg-purple-50 text-purple-700',
  completed: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  on_hold: 'bg-orange-50 text-orange-700',
  posted: 'bg-teal-50 text-teal-700',
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const label = status.replace(/_/g, ' ');
  const color = STATUS_COLORS[status.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium capitalize', color)}>
      {label}
    </span>
  );
}

export function LinkedSfTasks({ lfTaskId, clientId, canEdit = true }: Props) {
  const [linked, setLinked] = useState<LinkedTask[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchTask[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadLinked = useCallback(async () => {
    try {
      setLoadingLinked(true);
      const res = await fetch(`/api/tasks/${lfTaskId}/link-sf`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinked(data.linked ?? []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingLinked(false);
    }
  }, [lfTaskId]);

  useEffect(() => { loadLinked(); }, [loadLinked]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q, excludeLfId: lfTaskId });
      if (clientId) params.set('clientId', clientId);
      const res = await fetch(`/api/tasks/search-sf?${params}`);
      const data = await res.json();
      if (res.ok) setSearchResults(data.tasks ?? []);
    } catch { /* silent */ }
    finally { setSearching(false); }
  }, [lfTaskId, clientId]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(val), 350);
  };

  const handleLink = async (sfTaskId: string) => {
    setLinking(sfTaskId);
    try {
      const res = await fetch(`/api/tasks/${lfTaskId}/link-sf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sfTaskId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('SF task linked');
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
      await loadLinked();
    } catch (err: any) {
      toast.error(err.message || 'Failed to link');
    } finally {
      setLinking(null);
    }
  };

  const handleUnlink = async (sfTaskId: string) => {
    setUnlinking(sfTaskId);
    try {
      const res = await fetch(`/api/tasks/${lfTaskId}/link-sf`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sfTaskId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('SF task unlinked');
      await loadLinked();
    } catch (err: any) {
      toast.error(err.message || 'Failed to unlink');
    } finally {
      setUnlinking(null);
    }
  };

  const alreadyLinkedIds = new Set(linked.map((t) => t.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Linked SF Tasks</span>
          {linked.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {linked.length}
            </Badge>
          )}
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => {
              setShowSearch((s) => !s);
              if (!showSearch) doSearch('');
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Link SF
          </Button>
        )}
      </div>

      {showSearch && canEdit && (
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Search SF tasks by title or description..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => { setSearchQuery(''); setSearchResults([]); doSearch(''); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto divide-y">
            {searching && (
              <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching…
              </div>
            )}
            {!searching && searchResults.length === 0 && searchQuery.length > 0 && (
              <div className="px-3 py-2.5 text-xs text-muted-foreground text-center">
                No SF tasks found
              </div>
            )}
            {!searching && searchResults.length === 0 && searchQuery.length === 0 && (
              <div className="px-3 py-2.5 text-xs text-muted-foreground text-center">
                Type to search for SF tasks to link
              </div>
            )}
            {searchResults.map((task) => {
              const isAlready = alreadyLinkedIds.has(task.id);
              const isLinking = linking === task.id;
              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2',
                    isAlready ? 'opacity-50' : 'hover:bg-accent'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {task.title || task.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {task.deliverableType && (
                        <span className="text-[10px] px-1 py-0 bg-blue-50 text-blue-600 rounded">
                          {task.deliverableType}
                        </span>
                      )}
                      <StatusBadge status={task.status} />
                      {task.user?.name && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {task.user.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isAlready ? 'secondary' : 'outline'}
                    className="h-6 text-[11px] px-2 shrink-0"
                    disabled={isAlready || isLinking}
                    onClick={() => !isAlready && handleLink(task.id)}
                  >
                    {isLinking ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isAlready ? (
                      'Linked'
                    ) : (
                      'Link'
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loadingLinked ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading linked tasks…
        </div>
      ) : linked.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">
          No SF tasks linked yet.{canEdit ? ' Click "Link SF" to add one.' : ''}
        </p>
      ) : (
        <div className="space-y-1.5">
          {linked.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent/40 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {task.title || task.description}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {task.deliverableType && (
                    <span className="text-[10px] px-1 py-0 bg-blue-50 text-blue-600 rounded">
                      {task.deliverableType}
                    </span>
                  )}
                  <StatusBadge status={task.status} />
                  {task.user?.name && (
                    <span className="text-[10px] text-muted-foreground">
                      {task.user.name}
                    </span>
                  )}
                </div>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  disabled={unlinking === task.id}
                  onClick={() => handleUnlink(task.id)}
                  title="Unlink this SF task"
                >
                  {unlinking === task.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Unlink className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}