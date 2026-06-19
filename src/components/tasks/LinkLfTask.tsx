'use client';
// src/components/tasks/LinkLfTask.tsx
// Usage: <LinkLfTask sfTaskId={task.id} clientId={task.clientId} canEdit={role !== 'client'} />
//
// SF-side counterpart to LinkedSfTasks. An SF task has at most one linked
// LF task (relatedTaskId is a single FK), so this renders a single linked
// card with a search-to-link / unlink flow, instead of a list.
//
// This does NOT replace LinkedSfTasks — that component stays exactly as
// it is everywhere it's currently used (especially the scheduler views,
// which must keep their existing read-only LF-side display unchanged).
// This is a new, separate UI surface for the SF ticket.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link2, X, Search, Plus, Loader2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LinkedLfTask {
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
  client: { name: string } | null;
  user: { name: string } | null;
}

interface Props {
  sfTaskId: string;
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

export function LinkLfTask({ sfTaskId, clientId, canEdit = true }: Props) {
  const [linked, setLinked] = useState<LinkedLfTask | null>(null);
  const [loadingLinked, setLoadingLinked] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchTask[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadLinked = useCallback(async () => {
    try {
      setLoadingLinked(true);
      const res = await fetch(`/api/tasks/${sfTaskId}/link-lf`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinked(data.linked ?? null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingLinked(false);
    }
  }, [sfTaskId]);

  useEffect(() => { loadLinked(); }, [loadLinked]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q, excludeSfId: sfTaskId });
      if (clientId) params.set('clientId', clientId);
      const res = await fetch(`/api/tasks/search-lf?${params}`);
      const data = await res.json();
      if (res.ok) setSearchResults(data.tasks ?? []);
    } catch { /* silent */ }
    finally { setSearching(false); }
  }, [sfTaskId, clientId]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(val), 350);
  };

  const handleLink = async (lfTaskId: string) => {
    setLinking(lfTaskId);
    try {
      const res = await fetch(`/api/tasks/${sfTaskId}/link-lf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lfTaskId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('LF task linked');
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

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      const res = await fetch(`/api/tasks/${sfTaskId}/link-lf`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('LF task unlinked');
      await loadLinked();
    } catch (err: any) {
      toast.error(err.message || 'Failed to unlink');
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Linked LF Task</span>
          {linked && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              1
            </Badge>
          )}
        </div>
        {canEdit && !linked && (
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
            Link LF
          </Button>
        )}
      </div>

      {showSearch && canEdit && !linked && (
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Search LF tasks by title or description..."
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
                No LF tasks found
              </div>
            )}
            {!searching && searchResults.length === 0 && searchQuery.length === 0 && (
              <div className="px-3 py-2.5 text-xs text-muted-foreground text-center">
                Type to search for LF tasks to link
              </div>
            )}
            {searchResults.map((task) => {
              const isLinking = linking === task.id;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-accent"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium break-words">
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
                    variant="outline"
                    className="h-6 text-[11px] px-2 shrink-0"
                    disabled={isLinking}
                    onClick={() => handleLink(task.id)}
                  >
                    {isLinking ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Link'}
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
          Loading linked task…
        </div>
      ) : !linked ? (
        <p className="text-xs text-muted-foreground py-1">
          No LF task linked yet.{canEdit ? ' Click "Link LF" to add one.' : ''}
        </p>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent/40 transition-colors group">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium break-words">
              {linked.title || linked.description}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {linked.deliverableType && (
                <span className="text-[10px] px-1 py-0 bg-blue-50 text-blue-600 rounded">
                  {linked.deliverableType}
                </span>
              )}
              <StatusBadge status={linked.status} />
              {linked.user?.name && (
                <span className="text-[10px] text-muted-foreground">
                  {linked.user.name}
                </span>
              )}
            </div>
          </div>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              disabled={unlinking}
              onClick={handleUnlink}
              title="Unlink this LF task"
            >
              {unlinking ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Unlink className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}