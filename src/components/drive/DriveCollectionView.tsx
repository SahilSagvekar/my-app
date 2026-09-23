"use client";
// src/components/drive/DriveCollectionView.tsx
//
// The flat Drive views next to "My Drive": Recent, Starred, Trash and
// Storage. All four read from the Postgres Drive index, so they work across
// every client the user can see without listing R2.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Star,
  Trash2,
  HardDrive,
  Folder,
  File as FileIcon,
  Video,
  Image as ImageIcon,
  Download,
  Eye,
  FolderOpen,
  RotateCcw,
  Loader2,
  Archive,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type DriveCollection = "recent" | "starred" | "trash" | "storage";

export interface FlatItem {
  name: string;
  type: "file" | "folder";
  s3Key: string;
  clientPrefix: string;
  folderPath: string;
  breadcrumbParts: string[];
  path: string;
  size?: number;
  lastModified?: string;
  url?: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  storageTier?: string;
  previewStatus?: string;
  starred?: boolean;
  uploadedByName?: string | null;
}

interface TrashEntry {
  rootKey: string;
  name: string;
  type: "file" | "folder";
  itemCount: number;
  totalSize: number;
  trashedAt: string;
  trashedByName: string | null;
  purgeAt: string;
  thumbnailUrl?: string | null;
}

interface StorageRow {
  client: string;
  fileCount: number;
  hotBytes: number;
  archivedBytes: number;
  trashBytes: number;
  rawFootageBytes: number;
  outputBytes: number;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 3 ? 2 : 0)} ${units[i]}`;
}

function relativeDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

function ItemIcon({ item }: { item: { name: string; type: string; thumbnailUrl?: string | null } }) {
  const [failed, setFailed] = useState(false);
  if (item.type === "folder") return <Folder className="h-5 w-5 text-blue-500" />;
  if (item.thumbnailUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />;
  }
  if (/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(item.name)) return <Video className="h-5 w-5 text-purple-500" />;
  if (/\.(jpe?g|png|gif|webp|svg)$/i.test(item.name)) return <ImageIcon className="h-5 w-5 text-blue-500" />;
  return <FileIcon className="h-5 w-5 text-gray-500" />;
}

const TITLES: Record<DriveCollection, { title: string; empty: string; icon: typeof Clock }> = {
  recent: { title: "Recent", empty: "Nothing uploaded recently.", icon: Clock },
  starred: { title: "Starred", empty: "Star files and folders to find them here fast.", icon: Star },
  trash: { title: "Trash", empty: "Trash is empty.", icon: Trash2 },
  storage: { title: "Storage", empty: "No storage data yet.", icon: HardDrive },
};

export function DriveCollectionView({
  view,
  role,
  clientId,
  showAllClients,
  onShowInFolder,
  onPreview,
  onDownload,
  onToggleStar,
  canPreview,
  refreshToken,
}: {
  view: DriveCollection;
  role: string;
  clientId?: string | null;
  /** Staff with no client picked see every client they can access. */
  showAllClients?: boolean;
  onShowInFolder: (item: FlatItem) => void;
  onPreview: (item: FlatItem) => void;
  onDownload: (item: FlatItem) => void;
  onToggleStar: (item: FlatItem, starred: boolean) => Promise<boolean>;
  canPreview: (name: string) => boolean;
  /** Bump to force a refetch (e.g. after a delete elsewhere). */
  refreshToken?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FlatItem[]>([]);
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [trashMeta, setTrashMeta] = useState<{ canRestore: boolean; canPurge: boolean; retentionDays: number }>({
    canRestore: false,
    canPurge: false,
    retentionDays: 30,
  });
  const [storage, setStorage] = useState<StorageRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [purgeTargets, setPurgeTargets] = useState<string[] | null>(null);
  const [totp, setTotp] = useState("");
  const [totpError, setTotpError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ role });
    if (clientId && !showAllClients) p.set("clientId", clientId);
    return p.toString();
  }, [role, clientId, showAllClients]);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      if (view === "trash") {
        const res = await fetch(`/api/drive/trash?${query}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load trash");
        setTrash(data.items || []);
        setTrashMeta({ canRestore: !!data.canRestore, canPurge: !!data.canPurge, retentionDays: data.retentionDays || 30 });
      } else if (view === "storage") {
        const res = await fetch(`/api/drive/storage?role=${encodeURIComponent(role)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load storage");
        setStorage(data.clients || []);
      } else {
        const res = await fetch(`/api/drive/${view}?${query}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load");
        setItems(data.items || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [view, query, role]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  const restore = async (rootKeys: string[]) => {
    if (!rootKeys.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/drive/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootKeys }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      const n = data.restoredRoots?.length || 0;
      if (n) toast.success(`Restored ${n} item${n === 1 ? "" : "s"}`);
      if (data.denied?.length) toast.error(`${data.denied.length} item${data.denied.length === 1 ? "" : "s"} couldn't be restored`);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  const purge = async () => {
    if (!purgeTargets?.length) return;
    if (!totp.trim()) {
      setTotpError("Enter the 6-digit code from Google Authenticator");
      return;
    }
    setBusy(true);
    setTotpError(null);
    try {
      const res = await fetch("/api/drive/trash/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootKeys: purgeTargets, totpCode: totp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.totpReason) {
          setTotpError(data.error || "Invalid verification code");
          return;
        }
        throw new Error(data.error || "Delete failed");
      }
      toast.success(`Permanently deleted ${data.deletedCount} item${data.deletedCount === 1 ? "" : "s"}`);
      if (data.failed?.length) toast.error(`${data.failed.length} item${data.failed.length === 1 ? "" : "s"} failed`);
      setPurgeTargets(null);
      setTotp("");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleSelected = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const { title, empty, icon: Icon } = TITLES[view];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading {title.toLowerCase()}…
      </div>
    );
  }

  // ── Storage ────────────────────────────────────────────────────────────────
  if (view === "storage") {
    const total = storage.reduce((s, r) => s + r.hotBytes, 0);
    return (
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Storage by client</h2>
          <span className="text-sm text-muted-foreground">{formatBytes(total)} in cloud storage</span>
        </div>
        {storage.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Client</th>
                  <th className="px-3 py-2 text-right font-medium">Files</th>
                  <th className="px-3 py-2 text-right font-medium">Raw footage</th>
                  <th className="px-3 py-2 text-right font-medium">Deliverables</th>
                  <th className="px-3 py-2 text-right font-medium">Cloud total</th>
                  <th className="px-3 py-2 text-right font-medium">Archived (NAS)</th>
                  <th className="px-3 py-2 text-right font-medium">In trash</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {storage.map((r) => (
                  <tr key={r.client} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.client}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.fileCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBytes(r.rawFootageBytes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBytes(r.outputBytes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
                          <div className="h-full bg-primary" style={{ width: `${total ? Math.max(2, (r.hotBytes / total) * 100) : 0}%` }} />
                        </div>
                        {formatBytes(r.hotBytes)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatBytes(r.archivedBytes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatBytes(r.trashBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── Trash ─────────────────────────────────────────────────────────────────
  if (view === "trash") {
    const selectedKeys = [...selected];
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Items in Trash are deleted forever after {trashMeta.retentionDays} days.
          </p>
          {selectedKeys.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selectedKeys.length} selected</span>
              {trashMeta.canRestore && (
                <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={busy} onClick={() => restore(selectedKeys)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </Button>
              )}
              {trashMeta.canPurge && (
                <Button size="sm" variant="destructive" className="h-8 gap-1.5" disabled={busy} onClick={() => { setPurgeTargets(selectedKeys); setTotp(""); setTotpError(null); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete forever
                </Button>
              )}
            </div>
          )}
        </div>

        {trash.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center text-muted-foreground">
            <Icon className="mb-3 h-12 w-12 opacity-20" />
            <p className="text-sm">{empty}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="divide-y">
              {trash.map((t) => (
                <div key={t.rootKey} className={cn("group flex items-center gap-3 px-3 py-2 hover:bg-accent", selected.has(t.rootKey) && "bg-primary/5")}>
                  <button className="shrink-0" onClick={() => toggleSelected(t.rootKey)} aria-label="Select">
                    {selected.has(t.rootKey) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted/40">
                    <ItemIcon item={{ name: t.name, type: t.type, thumbnailUrl: t.thumbnailUrl }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t.rootKey.replace(/\/?[^/]+\/?$/, "") || "/"}
                      {t.type === "folder" ? ` · ${t.itemCount} file${t.itemCount === 1 ? "" : "s"}` : ""}
                      {t.trashedByName ? ` · deleted by ${t.trashedByName}` : ""}
                    </p>
                  </div>
                  <div className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">{formatBytes(t.totalSize)}</div>
                  <div className="hidden w-32 shrink-0 text-right text-xs text-muted-foreground sm:block">{relativeDate(t.trashedAt)}</div>
                  <div className="w-28 shrink-0 text-right text-xs text-amber-600">{daysLeft(t.purgeAt)} days left</div>
                  {trashMeta.canRestore && (
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5" disabled={busy} onClick={() => restore([t.rootKey])}>
                      <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden md:inline">Restore</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Dialog open={!!purgeTargets} onOpenChange={(o) => { if (!o) setPurgeTargets(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {purgeTargets?.length} item{purgeTargets?.length === 1 ? "" : "s"} forever?</DialogTitle>
              <DialogDescription>
                This can't be undone. Files backed up to the NAS stay available on the NAS Backup page.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="purge-totp" className="text-sm font-medium">Google Authenticator code</label>
              <Input
                id="purge-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter") purge(); }}
                autoFocus
              />
              {totpError && <p className="text-xs text-red-600">{totpError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPurgeTargets(null)} disabled={busy}>Cancel</Button>
              <Button variant="destructive" onClick={purge} disabled={busy}>
                {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Delete forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Recent / Starred ─────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center text-muted-foreground">
          <Icon className="mb-3 h-12 w-12 opacity-20" />
          <p className="text-sm">{empty}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="hidden items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:flex">
            <div className="w-8 shrink-0" />
            <div className="flex-1">Name</div>
            <div className="w-24 text-right">Size</div>
            <div className="w-32 text-right">{view === "recent" ? "Added" : "Modified"}</div>
            <div className="w-32" />
          </div>
          <div className="divide-y">
            {items.map((item) => (
              <div
                key={item.s3Key}
                className="group flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
                onDoubleClick={() => (item.type === "folder" ? onShowInFolder(item) : canPreview(item.name) ? onPreview(item) : onShowInFolder(item))}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted/40">
                  <ItemIcon item={item} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span className="truncate">{item.name}</span>
                    {item.storageTier === "nas" && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-600">
                        <Archive className="h-2.5 w-2.5" /> Archived
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {item.folderPath || "/"}
                    {item.uploadedByName ? ` · ${item.uploadedByName}` : ""}
                  </p>
                </div>
                <div className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">
                  {item.type === "file" ? formatBytes(item.size) : "—"}
                </div>
                <div className="hidden w-32 shrink-0 text-right text-xs text-muted-foreground sm:block">{relativeDate(item.lastModified)}</div>
                <div className="flex w-32 shrink-0 items-center justify-end gap-0.5">
                  {item.type === "file" && canPreview(item.name) && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Preview" onClick={() => onPreview(item)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {item.type === "file" && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Download" onClick={() => onDownload(item)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Show in folder" onClick={() => onShowInFolder(item)}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title={item.starred ? "Remove star" : "Star"}
                    onClick={async () => {
                      const next = !item.starred;
                      setItems((prev) =>
                        view === "starred" && !next
                          ? prev.filter((i) => i.s3Key !== item.s3Key)
                          : prev.map((i) => (i.s3Key === item.s3Key ? { ...i, starred: next } : i)),
                      );
                      const ok = await onToggleStar(item, next);
                      if (!ok) load();
                    }}
                  >
                    <Star className={cn("h-4 w-4", item.starred && "fill-amber-400 text-amber-400")} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
