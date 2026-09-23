"use client";
// src/components/drive/DriveDetailsSheet.tsx
// Side panel for one Drive item: who uploaded it, size, dates, storage
// tier, preview state, and its activity history.

import { useEffect, useState } from "react";
import { Loader2, Upload, RefreshCw, MoveRight, Pencil, Trash2, RotateCcw, FolderPlus, XCircle, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Details {
  key: string;
  name: string;
  isFolder: boolean;
  size: number;
  mimeType: string | null;
  storageTier: string;
  lastModified?: string;
  uploadedByName: string | null;
  previewStatus: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

interface Activity {
  id: string;
  key: string;
  name: string;
  action: string;
  userName: string | null;
  details: Record<string, any> | null;
  createdAt: string;
}

const ACTION_LABEL: Record<string, { label: string; icon: typeof Upload }> = {
  uploaded: { label: "uploaded", icon: Upload },
  replaced: { label: "uploaded a new version of", icon: RefreshCw },
  moved: { label: "moved", icon: MoveRight },
  renamed: { label: "renamed", icon: Pencil },
  trashed: { label: "moved to Trash", icon: Trash2 },
  restored: { label: "restored", icon: RotateCcw },
  deleted: { label: "permanently deleted", icon: XCircle },
  folder_created: { label: "created folder", icon: FolderPlus },
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 3 ? 2 : 0)} ${units[i]}`;
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  return h ? `${h}h ${m}m` : `${m}:${String(sec).padStart(2, "0")}`;
}

const PREVIEW_LABEL: Record<string, string> = {
  ready: "Ready",
  queued: "Queued",
  processing: "Preparing…",
  failed: "Failed",
  none: "Not generated",
};

export function DriveDetailsSheet({
  itemKey,
  itemName,
  open,
  onOpenChange,
}: {
  itemKey: string | null;
  itemName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!open || !itemKey) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/drive/activity?k=${encodeURIComponent(itemKey)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setEnabled(d.enabled !== false);
        setDetails(d.details || null);
        setActivity(d.activity || []);
      })
      .catch(() => { if (!cancelled) { setDetails(null); setActivity([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, itemKey]);

  const rows: Array<[string, string]> = [];
  if (details) {
    if (!details.isFolder) rows.push(["Size", formatBytes(details.size)]);
    if (details.mimeType && !details.isFolder) rows.push(["Type", details.mimeType]);
    rows.push(["Storage", details.storageTier === "nas" ? "Archived on the NAS" : "Cloud (R2)"]);
    if (details.lastModified) rows.push(["Modified", new Date(details.lastModified).toLocaleString()]);
    if (details.uploadedByName) rows.push(["Uploaded by", details.uploadedByName]);
    if (details.width && details.height) rows.push(["Resolution", `${details.width} × ${details.height}`]);
    if (details.durationSeconds) rows.push(["Duration", formatDuration(details.durationSeconds)]);
    if (!details.isFolder && /\.(mp4|mov|m4v|webm|mkv|avi|mxf)$/i.test(details.name)) {
      rows.push(["Web preview", PREVIEW_LABEL[details.previewStatus] || details.previewStatus]);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate pr-6">{details?.name || itemName || "Details"}</SheetTitle>
          <SheetDescription className="break-all text-xs">{itemKey}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !enabled ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">Details appear once the Drive index is switched on.</p>
        ) : (
          <div className="space-y-6 px-4 pb-6">
            {rows.length > 0 && (
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity</h3>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ol className="space-y-3">
                  {activity.map((a) => {
                    const meta = ACTION_LABEL[a.action] || { label: a.action, icon: Clock };
                    const Icon = meta.icon;
                    return (
                      <li key={a.id} className="flex gap-3 text-sm">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p>
                            <span className="font-medium">{a.userName || "System"}</span> {meta.label}{" "}
                            {a.key !== itemKey && <span className="font-medium">{a.name}</span>}
                          </p>
                          {a.details?.from && (
                            <p className="truncate text-xs text-muted-foreground">from {String(a.details.from)}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
