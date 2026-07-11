'use client';

import { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  FolderSearch, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Folder, ArrowRight, Play, Eye,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
}

interface FoundFolder {
  folderKey: string;
  shortCode: string;
  fullName: string;
  newKey: string;
}

interface PreviewItem {
  oldKey: string;
  newKey: string;
  objectCount: number;
  sampleKeys: string[];
}

type FolderStatus = 'found' | 'previewing' | 'previewed' | 'renaming' | 'done' | 'failed';

interface FolderState {
  folderKey: string;
  shortCode: string;
  fullName: string;
  newKey: string;
  selected: boolean;
  status: FolderStatus;
  objectCount?: number;
  sampleKeys?: string[];
  errors?: string[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FolderRenameTool() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');

  const [scanning, setScanning] = useState(false);
  const [folders, setFolders] = useState<FolderState[]>([]);
  const [scanned, setScanned] = useState(false);

  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunDone, setDryRunDone] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());

  // ── Load client list on first interaction ──────────────────────────────────
  const loadClients = useCallback(async () => {
    if (clientsLoaded) return;
    try {
      const res = await fetch('/api/admin/rename-folders', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load clients');
      const data = await res.json();
      setClients(data.clients ?? []);
      setClientsLoaded(true);
    } catch (err: any) {
      toast({ title: 'Failed to load clients', description: err.message, variant: 'destructive' });
    }
  }, [clientsLoaded]);

  // ── Scan selected client ───────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    if (!selectedClientId) {
      toast({ title: 'Select a client first', variant: 'destructive' });
      return;
    }

    setScanning(true);
    setScanned(false);
    setDryRunDone(false);
    setFolders([]);

    try {
      const res = await fetch(
        `/api/admin/rename-folders?clientId=${encodeURIComponent(selectedClientId)}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Scan failed');
      }

      const data: { companyName: string; folders: FoundFolder[]; totalFound: number } = await res.json();

      setFolders(data.folders.map(f => ({
        ...f,
        selected: true, // default: all selected
        status: 'found',
      })));
      setScanned(true);

      if (data.totalFound === 0) {
        toast({ title: '✅ No short-code folders found', description: `${data.companyName} has no folders named SF, LF, SQF, etc.` });
      } else {
        toast({
          title: `Found ${data.totalFound} short-code folder${data.totalFound !== 1 ? 's' : ''}`,
          description: 'Review the list, then run Dry Run to preview before renaming.',
        });
      }
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  }, [selectedClientId]);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleFolder = (key: string) => {
    setFolders(prev => prev.map(f =>
      f.folderKey === key && f.status === 'found' ? { ...f, selected: !f.selected } : f
    ));
    setDryRunDone(false);
  };

  const toggleAll = (selected: boolean) => {
    setFolders(prev => prev.map(f =>
      f.status === 'found' ? { ...f, selected } : f
    ));
    setDryRunDone(false);
  };

  // ── Dry run ────────────────────────────────────────────────────────────────
  const handleDryRun = useCallback(async () => {
    const selected = folders.filter(f => f.selected && f.status === 'found');
    if (selected.length === 0) {
      toast({ title: 'Nothing selected', description: 'Tick the folders you want to rename first.' });
      return;
    }

    setDryRunning(true);
    setDryRunDone(false);
    setExpandedPreviews(new Set());

    // Mark as previewing
    setFolders(prev => prev.map(f =>
      f.selected && f.status === 'found' ? { ...f, status: 'previewing' } : f
    ));

    try {
      const res = await fetch('/api/admin/rename-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dryRun: true,
          renames: selected.map(f => ({ oldKey: f.folderKey, newKey: f.newKey })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Dry run failed');
      }

      const data: { preview: PreviewItem[] } = await res.json();
      const previewMap = new Map(data.preview.map(p => [p.oldKey, p]));

      setFolders(prev => prev.map(f => {
        if (f.status !== 'previewing') return f;
        const p = previewMap.get(f.folderKey);
        return {
          ...f,
          status: 'previewed',
          objectCount: p?.objectCount ?? 0,
          sampleKeys: p?.sampleKeys ?? [],
        };
      }));

      setDryRunDone(true);
      const totalObjects = data.preview.reduce((sum, p) => sum + p.objectCount, 0);
      toast({
        title: `Dry run complete — ${selected.length} folder${selected.length !== 1 ? 's' : ''} ready`,
        description: `${totalObjects} object${totalObjects !== 1 ? 's' : ''} will be moved. Click Execute Rename to proceed.`,
      });
    } catch (err: any) {
      setFolders(prev => prev.map(f =>
        f.status === 'previewing' ? { ...f, status: 'found' } : f
      ));
      toast({ title: 'Dry run failed', description: err.message, variant: 'destructive' });
    } finally {
      setDryRunning(false);
    }
  }, [folders]);

  // ── Execute rename ─────────────────────────────────────────────────────────
  const handleExecute = useCallback(async () => {
    const toRename = folders.filter(f => f.status === 'previewed');
    if (toRename.length === 0) {
      toast({ title: 'Run Dry Run first', description: 'Preview the changes before executing.' });
      return;
    }

    setExecuting(true);

    // Mark as renaming
    setFolders(prev => prev.map(f =>
      f.status === 'previewed' ? { ...f, status: 'renaming' } : f
    ));

    try {
      const res = await fetch('/api/admin/rename-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dryRun: false,
          renames: toRename.map(f => ({ oldKey: f.folderKey, newKey: f.newKey })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Rename failed');
      }

      const data: {
        succeeded: number;
        failed: number;
        results: { oldKey: string; newKey: string; ok: boolean; errors?: string[] }[];
      } = await res.json();

      const resultMap = new Map(data.results.map(r => [r.oldKey, r]));

      setFolders(prev => prev.map(f => {
        if (f.status !== 'renaming') return f;
        const r = resultMap.get(f.folderKey);
        return {
          ...f,
          status: r?.ok ? 'done' : 'failed',
          errors: r?.errors,
        };
      }));

      if (data.failed === 0) {
        toast({ title: `✅ Renamed ${data.succeeded} folder${data.succeeded !== 1 ? 's' : ''}`, description: 'All short-code folders have been renamed to their full names.' });
      } else {
        toast({
          title: `Renamed ${data.succeeded}, failed ${data.failed}`,
          description: 'Some renames failed. Check the list for details.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setFolders(prev => prev.map(f =>
        f.status === 'renaming' ? { ...f, status: 'previewed' } : f
      ));
      toast({ title: 'Rename failed', description: err.message, variant: 'destructive' });
    } finally {
      setExecuting(false);
    }
  }, [folders]);

  // ── Derived counts ─────────────────────────────────────────────────────────
  const foundFolders   = folders.filter(f => f.status === 'found');
  const selectedCount  = foundFolders.filter(f => f.selected).length;
  const previewedCount = folders.filter(f => f.status === 'previewed').length;
  const doneCount      = folders.filter(f => f.status === 'done').length;
  const failedCount    = folders.filter(f => f.status === 'failed').length;
  const allSelected    = foundFolders.length > 0 && selectedCount === foundFolders.length;
  const someSelected   = selectedCount > 0 && selectedCount < foundFolders.length;

  const canDryRun  = selectedCount > 0 && !dryRunning && !executing;
  const canExecute = previewedCount > 0 && dryRunDone && !executing && !dryRunning;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Folder Rename</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Find folders in R2 named with short codes (SF, LF, SQF, etc.) and rename them to their
          full names. Select one client at a time, run a <strong>Dry Run</strong> to preview exactly
          what will move, then <strong>Execute</strong> to apply.
        </p>
      </div>

      {/* Client selector + scan */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Client</label>
              <Select
                value={selectedClientId}
                onValueChange={v => {
                  setSelectedClientId(v);
                  setSelectedClientName(clients.find(c => c.id === v)?.name ?? '');
                  setScanned(false);
                  setDryRunDone(false);
                  setFolders([]);
                }}
                onOpenChange={open => { if (open) loadClients(); }}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Select a client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
                  )}
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2 mt-auto">
              <Button
                variant="outline"
                onClick={handleScan}
                disabled={!selectedClientId || scanning || executing}
                className="gap-2"
              >
                {scanning
                  ? <><RefreshCw className="h-4 w-4 animate-spin" />Scanning…</>
                  : <><FolderSearch className="h-4 w-4" />{scanned ? 'Re-scan' : 'Scan'}</>}
              </Button>
            </div>
          </div>

          {/* Short code legend */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Short code → full name mapping</p>
            <div className="flex flex-wrap gap-2">
              {[
                ['SF', 'Short Form'],
                ['LF', 'Long Form'],
                ['SQF', 'Square Form'],
                ['THUMB', 'Thumbnails'],
                ['T', 'Tiles'],
                ['HP', 'Hard Posts'],
                ['SEP', 'Snapchat Episodes'],
                ['BSF', 'Beta Short Form'],
                ['ST', 'Stories'],
                ['TP', 'Text Post'],
              ].map(([code, full]) => (
                <div key={code} className="flex items-center gap-1 bg-muted/50 rounded px-2 py-1">
                  <span className="text-xs font-mono font-bold text-blue-700">{code}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-gray-700">{full}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scan results */}
      {scanned && folders.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <h3 className="font-semibold text-lg">No short-code folders found</h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              {selectedClientName} has no folders named SF, LF, SQF, etc. Either they're already renamed
              or this client doesn't have those subfolder types.
            </p>
          </CardContent>
        </Card>
      )}

      {folders.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Short-code folders', value: folders.length,   color: 'text-gray-700',  bg: 'bg-gray-50'  },
              { label: 'Selected',           value: selectedCount,    color: 'text-blue-700',  bg: 'bg-blue-50'  },
              { label: 'Renamed',            value: doneCount,        color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Failed',             value: failedCount,      color: 'text-red-700',   bg: 'bg-red-50'   },
            ].map(s => (
              <div key={s.label} className={`rounded-lg border p-4 ${s.bg}`}>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-3">
            {foundFolders.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
                <Checkbox
                  checked={allSelected}
                  ref={el => { if (el) (el as any).indeterminate = someSelected; }}
                  onCheckedChange={c => toggleAll(!!c)}
                  id="select-all"
                />
                <label htmlFor="select-all" className="cursor-pointer select-none">
                  {allSelected ? 'Deselect all' : 'Select all'}
                </label>
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleDryRun}
              disabled={!canDryRun}
              className="gap-2"
            >
              {dryRunning
                ? <><RefreshCw className="h-4 w-4 animate-spin" />Running dry run…</>
                : <><Eye className="h-4 w-4" />Dry Run ({selectedCount} selected)</>}
            </Button>

            {canExecute && (
              <Button
                onClick={handleExecute}
                disabled={executing}
                className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              >
                {executing
                  ? <><RefreshCw className="h-4 w-4 animate-spin" />Renaming…</>
                  : <><Play className="h-4 w-4" />Execute Rename ({previewedCount} folder{previewedCount !== 1 ? 's' : ''})</>}
              </Button>
            )}

            {dryRunDone && !canExecute && previewedCount === 0 && doneCount > 0 && (
              <Badge className="bg-green-100 text-green-700 border-green-200 px-3 py-1.5 text-sm">
                ✅ All done
              </Badge>
            )}
          </div>

          {/* Dry run notice */}
          {dryRunDone && previewedCount > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Dry run complete — review before executing</p>
                <p className="text-sm text-amber-700 mt-1">
                  The table below shows exactly what will move. Executing will copy all objects to the new
                  path and delete the originals. <strong>This cannot be undone automatically.</strong>
                </p>
              </div>
            </div>
          )}

          {/* Folder list */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Folder className="h-4 w-4 text-amber-500" />
                Short-code folders in {selectedClientName}
                <Badge variant="outline" className="ml-1">{folders.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {folders.map(f => {
                const isExpanded = expandedPreviews.has(f.folderKey);
                const statusColor = {
                  found:      'hover:bg-muted/20',
                  previewing: 'bg-blue-50/40 animate-pulse',
                  previewed:  'bg-amber-50/60',
                  renaming:   'bg-blue-50/60 animate-pulse',
                  done:       'bg-green-50/50',
                  failed:     'bg-red-50/50',
                }[f.status];

                return (
                  <div key={f.folderKey} className="border-b last:border-0">
                    <div className={`flex items-center gap-3 px-4 py-3 ${statusColor}`}>
                      {/* Checkbox / status icon */}
                      <div className="w-5 flex-shrink-0 flex items-center justify-center">
                        {f.status === 'found' && (
                          <Checkbox
                            checked={f.selected}
                            onCheckedChange={() => toggleFolder(f.folderKey)}
                          />
                        )}
                        {f.status === 'previewing' && <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />}
                        {f.status === 'previewed' && <Eye className="h-4 w-4 text-amber-600" />}
                        {f.status === 'renaming'  && <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />}
                        {f.status === 'done'      && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {f.status === 'failed'    && <XCircle className="h-4 w-4 text-red-500" />}
                      </div>

                      {/* Rename arrow */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-gray-600 truncate max-w-[260px]" title={f.folderKey}>
                            {f.folderKey}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-mono text-xs text-green-700 font-semibold truncate max-w-[260px]" title={f.newKey}>
                            {f.newKey}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-blue-700 border-blue-200">
                            {f.shortCode}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">{f.fullName}</span>
                        </div>
                      </div>

                      {/* Object count + expand */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {f.objectCount !== undefined && (
                          <Badge variant="outline" className="text-xs text-gray-600">
                            {f.objectCount} object{f.objectCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {f.status === 'previewed' && f.sampleKeys && f.sampleKeys.length > 0 && (
                          <button
                            onClick={() => setExpandedPreviews(prev => {
                              const next = new Set(prev);
                              next.has(f.folderKey) ? next.delete(f.folderKey) : next.add(f.folderKey);
                              return next;
                            })}
                            className="text-xs text-muted-foreground hover:text-gray-700 flex items-center gap-1"
                          >
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            sample
                          </button>
                        )}
                        {f.status === 'done' && (
                          <span className="text-xs text-green-600 font-medium">Renamed ✓</span>
                        )}
                        {f.status === 'failed' && (
                          <span className="text-xs text-red-600 font-medium">Failed ✗</span>
                        )}
                        {f.status === 'found' && f.selected && (
                          <span className="text-xs text-muted-foreground">Will rename</span>
                        )}
                      </div>
                    </div>

                    {/* Sample keys expand */}
                    {isExpanded && f.sampleKeys && f.sampleKeys.length > 0 && (
                      <div className="px-12 py-2 bg-muted/20 border-t border-muted/50 space-y-1">
                        <p className="text-[11px] text-muted-foreground font-medium mb-1">Sample objects that will move:</p>
                        {f.sampleKeys.map(k => (
                          <p key={k} className="font-mono text-[11px] text-gray-600 truncate">{k}</p>
                        ))}
                        {(f.objectCount ?? 0) > f.sampleKeys.length && (
                          <p className="text-[11px] text-muted-foreground italic">
                            …and {(f.objectCount ?? 0) - f.sampleKeys.length} more
                          </p>
                        )}
                      </div>
                    )}

                    {/* Errors */}
                    {f.status === 'failed' && f.errors && f.errors.length > 0 && (
                      <div className="px-12 py-2 bg-red-50 border-t border-red-100">
                        {f.errors.map((e, i) => (
                          <p key={i} className="text-xs text-red-700 font-mono">{e}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}