'use client';

import { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import {
  FolderSearch, FolderPlus, RefreshCw, ChevronDown,
  ChevronRight, CheckCircle2, XCircle, AlertTriangle, Folder,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MissingFolder {
  key: string;
  label: string;
}

interface ClientResult {
  companyName: string;
  missing: MissingFolder[];
}

interface ScanResult {
  scanned: number;
  presentCount: number;
  missingCount: number;
  byClient: Record<string, ClientResult>;
}

type FolderStatus = 'missing' | 'creating' | 'created' | 'failed';

interface FolderState {
  key: string;
  label: string;
  status: FolderStatus;
  selected: boolean;
}

interface ClientState {
  companyName: string;
  folders: FolderState[];
  expanded: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FolderRepairTool() {
  const [scanning, setScanning]   = useState(false);
  const [creating, setCreating]   = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [clients, setClients]     = useState<Record<string, ClientState>>({});

  // ── Scan ──────────────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    setClients({});

    try {
      const res = await fetch('/api/admin/repair-folders', { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Scan failed');
      }

      const data: ScanResult = await res.json();
      setScanResult(data);

      // Build client state with all folders deselected
      const initial: Record<string, ClientState> = {};
      for (const [clientId, result] of Object.entries(data.byClient)) {
        initial[clientId] = {
          companyName: result.companyName,
          expanded: true, // start expanded so you can see what's missing
          folders: result.missing.map(f => ({
            key: f.key,
            label: f.label,
            status: 'missing',
            selected: false,
          })),
        };
      }
      setClients(initial);

      if (data.missingCount === 0) {
        toast({ title: '✅ All good', description: 'Every expected folder already exists in R2.' });
      } else {
        toast({ title: `Found ${data.missingCount} missing folders`, description: 'Select the ones you want to create, then click Create Selected.' });
      }
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  }, []);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleFolder = (clientId: string, key: string) => {
    setClients(prev => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        folders: prev[clientId].folders.map(f =>
          f.key === key ? { ...f, selected: !f.selected } : f
        ),
      },
    }));
  };

  const toggleClient = (clientId: string, selected: boolean) => {
    setClients(prev => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        folders: prev[clientId].folders.map(f =>
          f.status === 'missing' ? { ...f, selected } : f
        ),
      },
    }));
  };

  const toggleAll = (selected: boolean) => {
    setClients(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[id] = {
          ...next[id],
          folders: next[id].folders.map(f =>
            f.status === 'missing' ? { ...f, selected } : f
          ),
        };
      }
      return next;
    });
  };

  const toggleExpanded = (clientId: string) => {
    setClients(prev => ({
      ...prev,
      [clientId]: { ...prev[clientId], expanded: !prev[clientId].expanded },
    }));
  };

  // ── Counts ─────────────────────────────────────────────────────────────────
  const allFolders = Object.values(clients).flatMap(c => c.folders);
  const selectedCount   = allFolders.filter(f => f.selected && f.status === 'missing').length;
  const missingCount    = allFolders.filter(f => f.status === 'missing').length;
  const createdCount    = allFolders.filter(f => f.status === 'created').length;
  const failedCount     = allFolders.filter(f => f.status === 'failed').length;
  const allSelected     = missingCount > 0 && selectedCount === missingCount;
  const someSelected    = selectedCount > 0 && selectedCount < missingCount;

  // ── Create selected ────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    const keysToCreate = allFolders
      .filter(f => f.selected && f.status === 'missing')
      .map(f => f.key);

    if (keysToCreate.length === 0) {
      toast({ title: 'Nothing selected', description: 'Tick the folders you want to create first.' });
      return;
    }

    setCreating(true);

    // Mark selected as 'creating' immediately for visual feedback
    setClients(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[id] = {
          ...next[id],
          folders: next[id].folders.map(f =>
            f.selected && f.status === 'missing' ? { ...f, status: 'creating' } : f
          ),
        };
      }
      return next;
    });

    try {
      const res = await fetch('/api/admin/repair-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ keys: keysToCreate }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Create failed');
      }

      const data: { created: number; failed: number; results: { key: string; ok: boolean; error?: string }[] } =
        await res.json();

      // Update each folder's status based on the API response
      const resultMap = new Map(data.results.map(r => [r.key, r]));

      setClients(prev => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          next[id] = {
            ...next[id],
            folders: next[id].folders.map(f => {
              if (f.status !== 'creating') return f;
              const result = resultMap.get(f.key);
              return {
                ...f,
                status: result?.ok ? 'created' : 'failed',
                selected: false,
              };
            }),
          };
        }
        return next;
      });

      if (data.failed === 0) {
        toast({ title: `✅ Created ${data.created} folder${data.created !== 1 ? 's' : ''}`, description: 'All selected folders are now in R2.' });
      } else {
        toast({ title: `Created ${data.created}, failed ${data.failed}`, description: 'Some folders failed. Check the list for details.', variant: 'destructive' });
      }
    } catch (err: any) {
      // Revert 'creating' back to 'missing' on network failure
      setClients(prev => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          next[id] = {
            ...next[id],
            folders: next[id].folders.map(f =>
              f.status === 'creating' ? { ...f, status: 'missing', selected: false } : f
            ),
          };
        }
        return next;
      });
      toast({ title: 'Request failed', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }, [allFolders]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const clientIds = Object.keys(clients);
  const hasMissing = missingCount > 0 || failedCount > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Folder Repair</h1>
          <p className="text-muted-foreground mt-1">
            Scan R2 for missing deliverable folders across all active clients, then create only the ones you choose.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating
                ? <><RefreshCw className="h-4 w-4 animate-spin" />Creating…</>
                : <><FolderPlus className="h-4 w-4" />Create {selectedCount} folder{selectedCount !== 1 ? 's' : ''}</>}
            </Button>
          )}
          <Button variant="outline" onClick={handleScan} disabled={scanning || creating} className="gap-2">
            {scanning
              ? <><RefreshCw className="h-4 w-4 animate-spin" />Scanning…</>
              : <><FolderSearch className="h-4 w-4" />{scanResult ? 'Re-scan' : 'Scan Now'}</>}
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      {scanResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Paths checked',  value: scanResult.scanned,    color: 'text-gray-700',   bg: 'bg-gray-50'   },
            { label: 'Already exist',  value: scanResult.presentCount, color: 'text-green-700', bg: 'bg-green-50'  },
            { label: 'Missing in R2',  value: missingCount + failedCount, color: 'text-red-700', bg: 'bg-red-50'    },
            { label: 'Created this session', value: createdCount,   color: 'text-blue-700',   bg: 'bg-blue-50'   },
          ].map(s => (
            <div key={s.label} className={`rounded-lg border p-4 ${s.bg}`}>
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!scanResult && !scanning && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="p-4 bg-muted/50 rounded-full">
              <FolderSearch className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Nothing scanned yet</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">
                Click <strong>Scan Now</strong> to check which R2 folders are missing across all active clients.
                No folders will be created until you explicitly select and confirm them.
              </p>
            </div>
            <Button onClick={handleScan} className="gap-2 mt-2">
              <FolderSearch className="h-4 w-4" />Scan Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scanning spinner */}
      {scanning && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Checking R2 for all expected folder paths…</p>
            <p className="text-xs text-muted-foreground">This may take 10–30 seconds for many clients.</p>
          </CardContent>
        </Card>
      )}

      {/* All good */}
      {scanResult && !hasMissing && !scanning && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <h3 className="font-semibold text-lg">All folders exist</h3>
            <p className="text-muted-foreground text-sm">Every expected path was found in R2. Nothing to repair.</p>
          </CardContent>
        </Card>
      )}

      {/* Missing folders list */}
      {hasMissing && !scanning && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Missing folders
                <Badge variant="destructive" className="ml-1">{missingCount + failedCount}</Badge>
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {clientIds.map(clientId => {
              const client = clients[clientId];
              const clientMissing  = client.folders.filter(f => f.status === 'missing' || f.status === 'failed');
              const clientCreated  = client.folders.filter(f => f.status === 'created');
              const clientSelected = client.folders.filter(f => f.selected && f.status === 'missing');
              const allClientSel   = clientMissing.length > 0 && clientSelected.length === clientMissing.length;
              const someClientSel  = clientSelected.length > 0 && clientSelected.length < clientMissing.length;

              if (client.folders.every(f => f.status === 'created')) {
                // All done for this client — show a collapsed success row
                return (
                  <div key={clientId} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 bg-green-50/50">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-sm">{client.companyName}</span>
                    <Badge className="bg-green-100 text-green-700 border-green-200 ml-auto">All created</Badge>
                  </div>
                );
              }

              return (
                <div key={clientId} className="border-b last:border-0">
                  {/* Client row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer select-none"
                    onClick={() => toggleExpanded(clientId)}
                  >
                    {client.expanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}

                    <Checkbox
                      checked={allClientSel}
                      ref={el => { if (el) (el as any).indeterminate = someClientSel; }}
                      onCheckedChange={c => { toggleClient(clientId, !!c); }}
                      onClick={e => e.stopPropagation()}
                      className="flex-shrink-0"
                    />

                    <span className="font-semibold text-sm flex-1">{client.companyName}</span>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {clientCreated.length > 0 && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                          {clientCreated.length} created
                        </Badge>
                      )}
                      {clientMissing.length > 0 && (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                          {clientMissing.length} missing
                        </Badge>
                      )}
                      {clientSelected.length > 0 && (
                        <Badge className="text-xs">{clientSelected.length} selected</Badge>
                      )}
                    </div>
                  </div>

                  {/* Folder rows */}
                  {client.expanded && (
                    <div className="border-t bg-muted/10">
                      {client.folders.map(folder => {
                        const depth = folder.key.split('/').filter(Boolean).length - 1;
                        const indent = Math.min(depth, 4) * 16;

                        return (
                          <div
                            key={folder.key}
                            className={`flex items-center gap-3 px-4 py-2 border-b border-muted/50 last:border-0 ${
                              folder.status === 'created' ? 'bg-green-50/40' :
                              folder.status === 'failed'  ? 'bg-red-50/40' :
                              folder.status === 'creating' ? 'bg-blue-50/40 animate-pulse' :
                              'hover:bg-muted/20'
                            }`}
                          >
                            <div style={{ width: indent + 16 }} className="flex-shrink-0 flex items-center justify-end">
                              {folder.status === 'created'  && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                              {folder.status === 'failed'   && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                              {folder.status === 'creating' && <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
                              {folder.status === 'missing'  && (
                                <Checkbox
                                  checked={folder.selected}
                                  onCheckedChange={() => toggleFolder(clientId, folder.key)}
                                />
                              )}
                            </div>

                            <Folder className={`h-3.5 w-3.5 flex-shrink-0 ${
                              folder.status === 'created'  ? 'text-green-500' :
                              folder.status === 'failed'   ? 'text-red-400' :
                              folder.status === 'creating' ? 'text-blue-400' :
                              'text-amber-400'
                            }`} />

                            <span className={`text-sm font-mono flex-1 ${
                              folder.status === 'created' ? 'text-muted-foreground line-through' :
                              folder.status === 'failed'  ? 'text-red-600' :
                              ''
                            }`}>
                              {folder.key}
                            </span>

                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {folder.status === 'created'  && 'Created ✓'}
                              {folder.status === 'failed'   && 'Failed ✗'}
                              {folder.status === 'creating' && 'Creating…'}
                              {folder.status === 'missing' && folder.selected && 'Will create'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Sticky action bar when something is selected */}
      {selectedCount > 0 && (
        <div className="sticky bottom-4 flex justify-center">
          <div className="bg-white border shadow-lg rounded-full px-6 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">{selectedCount} folder{selectedCount !== 1 ? 's' : ''} selected</span>
            <Button size="sm" onClick={handleCreate} disabled={creating} className="rounded-full gap-2">
              {creating
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Creating…</>
                : <><FolderPlus className="h-3.5 w-3.5" />Create now</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}