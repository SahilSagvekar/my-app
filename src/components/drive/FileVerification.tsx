// src/components/drive/FileVerification.tsx
//
// "File Verification" — compare a folder on the user's laptop against a
// folder in the Files & Drive (R2) explorer, matching by file name, with an
// optional one-click upload of whatever's missing from R2.
// Available to admin, scheduler, and client roles only (see NAVIGATION_ITEMS).
//
// How folder picking works:
//  - Local folder: <input type="file" webkitdirectory> — this is the only
//    broadly-supported way for a web page to read a folder's contents.
//    Selecting a folder does NOT upload anything by itself — file names are
//    read immediately for the comparison, and the File objects are kept in
//    memory only in case the user clicks "Upload missing files" afterward.
//  - Remote folder: reuses the existing /api/drive/structure endpoint (same
//    one DriveExplorer uses) to fetch the client's full R2 folder tree,
//    then lets the user click through it to pick any folder at any depth.
//
// Comparison is by file name only (case-insensitive, trimmed), recursively
// through subfolders on both sides — not by file size or content.
//
// Uploading missing files reuses the existing chunked/multipart upload
// engine (see useMissingFilesUpload) and uploads flat into the root of the
// selected remote folder — consistent with the name-only, structure-blind
// comparison above.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FolderOpen,
  Folder,
  File as FileIcon,
  ChevronRight,
  ChevronDown,
  Laptop,
  HardDrive,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FolderCheck,
  ShieldAlert,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth/AuthContext";
import { cn } from "@/lib/utils";
import { useMissingFilesUpload } from "@/hooks/useMissingFilesUpload";

interface DriveItem {
  name: string;
  type: "folder" | "file";
  path: string;
  s3Key?: string;
  children?: DriveItem[];
}

interface FileVerificationProps {
  role: string;
}

// Recursively collect file names (not folder names) under a tree node.
function collectFileNames(node: DriveItem, out: string[] = []): string[] {
  if (node.type === "file") {
    out.push(node.name);
    return out;
  }
  for (const child of node.children || []) {
    collectFileNames(child, out);
  }
  return out;
}

// Find a folder node by path within a tree — used to re-select the
// previously-selected folder after a silent post-upload refetch.
function findNodeByPath(node: DriveItem, path: string): DriveItem | null {
  if (node.path === path) return node;
  for (const child of node.children || []) {
    const found = findNodeByPath(child, path);
    if (found) return found;
  }
  return null;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// ─── Remote (R2) folder tree picker ─────────────────────────────────────────
function RemoteFolderNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: DriveItem;
  depth: number;
  selectedPath: string | null;
  onSelect: (folder: DriveItem) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const folderChildren = (node.children || []).filter((c) => c.type === "folder");
  const isSelected = selectedPath === node.path;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1.5 rounded-md text-sm cursor-pointer hover:bg-muted",
          isSelected && "bg-primary/10 text-primary font-medium"
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="p-0.5 shrink-0"
        >
          {folderChildren.length > 0 ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="inline-block w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onSelect(node)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
        </button>
        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
      </div>
      {expanded &&
        folderChildren.map((child) => (
          <RemoteFolderNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export function FileVerification({ role }: FileVerificationProps) {
  const { user } = useAuth();
  const normalizedRole = role?.toLowerCase();
  const isAllowed = normalizedRole === "admin" || normalizedRole === "client" || normalizedRole === "scheduler";

  // ── Admin: client selector ──────────────────────────────────────────────
  const [clientList, setClientList] = useState<{ id: string; name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  useEffect(() => {
    if (normalizedRole !== "admin" && normalizedRole !== "scheduler") return;
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((data) => {
        const raw = Array.isArray(data) ? data : data.clients || [];
        const list = raw.map((c: any) => ({
          id: c.id,
          name: c.companyName || c.name || c.id,
        }));
        setClientList(list.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      })
      .catch(() => {});
  }, [normalizedRole]);

  // ── Remote folder tree ──────────────────────────────────────────────────
  const [remoteTree, setRemoteTree] = useState<DriveItem | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [selectedRemoteFolder, setSelectedRemoteFolder] = useState<DriveItem | null>(null);

  const loadRemoteTree = async (clientId?: string, opts?: { preserveSelectionPath?: string }) => {
    setRemoteLoading(true);
    setRemoteError(null);
    if (!opts?.preserveSelectionPath) setSelectedRemoteFolder(null);
    try {
      const params = new URLSearchParams();
      params.append("role", role);
      if (user?.id) params.append("userId", user.id.toString());
      if (clientId) params.append("clientId", clientId);

      const res = await fetch(`/api/drive/structure?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load folder structure");
      }
      const data = await res.json();
      setRemoteTree(data);
      if (opts?.preserveSelectionPath) {
        const stillThere = findNodeByPath(data, opts.preserveSelectionPath);
        setSelectedRemoteFolder(stillThere);
        if (stillThere) setComparisonRun(true); // re-run diff against fresh remote data
      }
    } catch (err: any) {
      setRemoteError(err.message || "Failed to load folder structure");
      setRemoteTree(null);
    } finally {
      setRemoteLoading(false);
    }
  };

  // Client role: load their own tree immediately.
  useEffect(() => {
    if (normalizedRole === "client") {
      loadRemoteTree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRole]);

  // Admin/scheduler: load when a client is selected.
  useEffect(() => {
    if ((normalizedRole === "admin" || normalizedRole === "scheduler") && selectedClientId) {
      loadRemoteTree(selectedClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRole, selectedClientId]);

  // ── Local folder ─────────────────────────────────────────────────────────
  const localInputRef = useRef<HTMLInputElement>(null);
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [localFileNames, setLocalFileNames] = useState<string[]>([]);
  // Keyed by normalized name — kept alongside localFileNames so we retain the
  // actual File objects for upload (not just their names) without touching
  // the existing name-only comparison logic below.
  const [localFilesByKey, setLocalFilesByKey] = useState<Map<string, File>>(new Map());

  const handleLocalFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const names: string[] = [];
    const byKey = new Map<string, File>();
    let rootName = "Selected folder";
    for (let i = 0; i < files.length; i++) {
      const f = files[i] as File & { webkitRelativePath?: string };
      names.push(f.name);
      byKey.set(normalizeName(f.name), f);
      if (i === 0 && f.webkitRelativePath) {
        rootName = f.webkitRelativePath.split("/")[0] || rootName;
      }
    }
    setLocalFolderName(rootName);
    setLocalFileNames(names);
    setLocalFilesByKey(byKey);
    setComparisonRun(false);
    resetUpload();
  };

  // ── Comparison ───────────────────────────────────────────────────────────
  const [comparisonRun, setComparisonRun] = useState(false);

  const comparison = useMemo(() => {
    if (!comparisonRun || !selectedRemoteFolder) return null;

    const remoteNames = collectFileNames(selectedRemoteFolder);
    const remoteSet = new Map<string, string>(); // normalized -> original
    for (const n of remoteNames) remoteSet.set(normalizeName(n), n);

    const localSet = new Map<string, string>();
    for (const n of localFileNames) localSet.set(normalizeName(n), n);

    const matched: string[] = [];
    const onlyLocal: string[] = [];
    const onlyRemote: string[] = [];

    for (const [key, original] of localSet) {
      if (remoteSet.has(key)) matched.push(original);
      else onlyLocal.push(original);
    }
    for (const [key, original] of remoteSet) {
      if (!localSet.has(key)) onlyRemote.push(original);
    }

    matched.sort((a, b) => a.localeCompare(b));
    onlyLocal.sort((a, b) => a.localeCompare(b));
    onlyRemote.sort((a, b) => a.localeCompare(b));

    return { matched, onlyLocal, onlyRemote };
  }, [comparisonRun, selectedRemoteFolder, localFileNames]);

  const canCompare = !!selectedRemoteFolder && localFileNames.length > 0;

  // ── Upload missing files ─────────────────────────────────────────────────
  const resolvedClientId =
    normalizedRole === "admin" || normalizedRole === "scheduler" ? selectedClientId : user?.linkedClientId || "";

  const { items: uploadItems, overall: uploadOverall, startBatch, retryOne, reset: resetUpload } =
    useMissingFilesUpload();

  const handleUploadMissing = () => {
    if (!comparison || !selectedRemoteFolder || !resolvedClientId) return;
    const files = comparison.onlyLocal
      .map((name) => {
        const key = normalizeName(name);
        const file = localFilesByKey.get(key);
        return file ? { key, file } : null;
      })
      .filter((x): x is { key: string; file: File } => x !== null);

    if (files.length === 0) return;
    startBatch({
      files,
      clientId: resolvedClientId,
      targetFolderPath: selectedRemoteFolder.path,
      onBatchSettled: () => {
        // Silently refetch the remote tree and re-run the diff, preserving
        // the currently-selected folder so the UI reflects newly-matched files.
        const path = selectedRemoteFolder!.path;
        if ((normalizedRole === "admin" || normalizedRole === "scheduler") && selectedClientId) {
          loadRemoteTree(selectedClientId, { preserveSelectionPath: path });
        } else if (normalizedRole === "client") {
          loadRemoteTree(undefined, { preserveSelectionPath: path });
        }
      },
    });
  };

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-3">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Not available</h1>
        <p className="text-muted-foreground max-w-md">
          File Verification is only available to admin, scheduler, and client accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderCheck className="h-6 w-6" />
          File Verification
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compare a folder on your computer against a folder in Files &amp; Drive by file name.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Local folder ── */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 font-medium">
            <Laptop className="h-4 w-4" />
            Your computer
          </div>

          <input
            ref={localInputRef}
            type="file"
            // @ts-ignore — non-standard attributes, but widely supported
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleLocalFolderChange}
          />

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => localInputRef.current?.click()}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            {localFolderName ? "Choose a different folder" : "Choose folder"}
          </Button>

          {localFolderName && (
            <div className="text-sm">
              <div className="font-medium truncate">{localFolderName}</div>
              <div className="text-muted-foreground">
                {localFileNames.length} file{localFileNames.length === 1 ? "" : "s"} found
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Nothing is uploaded automatically — file names are read for comparison, and you can
            upload anything missing afterward.
          </p>
        </Card>

        {/* ── Remote folder ── */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 font-medium">
            <HardDrive className="h-4 w-4" />
            Files &amp; Drive
          </div>

          {(normalizedRole === "admin" || normalizedRole === "scheduler") && (
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clientList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {remoteLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading folder structure…
            </div>
          )}

          {remoteError && (
            <div className="text-sm text-destructive py-2">{remoteError}</div>
          )}

          {!remoteLoading && remoteTree && (
            <ScrollArea className="h-64 border rounded-md p-2">
              <RemoteFolderNode
                node={remoteTree}
                depth={0}
                selectedPath={selectedRemoteFolder?.path ?? null}
                onSelect={(folder) => {
                  setSelectedRemoteFolder(folder);
                  setComparisonRun(false);
                  resetUpload();
                }}
              />
            </ScrollArea>
          )}

          {selectedRemoteFolder && (
            <div className="text-sm">
              <div className="font-medium truncate">{selectedRemoteFolder.name}</div>
              <div className="text-muted-foreground">
                {collectFileNames(selectedRemoteFolder).length} file
                {collectFileNames(selectedRemoteFolder).length === 1 ? "" : "s"} found
                (including subfolders)
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={!canCompare} onClick={() => setComparisonRun(true)}>
          Compare files
        </Button>
        {!canCompare && (
          <span className="text-sm text-muted-foreground">
            Choose a folder on both sides to compare.
          </span>
        )}
      </div>

      {comparison && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResultColumn
            title="Matched"
            description="Present in both folders"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            names={comparison.matched}
            badgeVariant="secondary"
          />
          <ResultColumn
            title="Only on your computer"
            description="Missing from Files & Drive"
            icon={<XCircle className="h-4 w-4 text-amber-600" />}
            names={comparison.onlyLocal}
            badgeVariant="secondary"
          />
          <ResultColumn
            title="Only in Files & Drive"
            description="Missing from your computer"
            icon={<XCircle className="h-4 w-4 text-amber-600" />}
            names={comparison.onlyRemote}
            badgeVariant="secondary"
          />
        </div>
      )}

      {comparison && (comparison.onlyLocal.length > 0 || uploadOverall.total > 0) && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <UploadCloud className="h-4 w-4" />
                Upload missing files
              </div>
              {uploadOverall.total === 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uploads the {comparison.onlyLocal.length} file
                  {comparison.onlyLocal.length === 1 ? "" : "s"} only found on your computer into{" "}
                  <span className="font-medium">{selectedRemoteFolder?.name}</span>.
                </p>
              )}
              {uploadOverall.total > 0 && uploadOverall.completed === uploadOverall.total && (
                <p className="text-xs text-emerald-600 mt-0.5">
                  All {uploadOverall.total} file{uploadOverall.total === 1 ? "" : "s"} uploaded.
                </p>
              )}
            </div>
            {uploadOverall.total === 0 && (
              <Button onClick={handleUploadMissing} disabled={!resolvedClientId}>
                <UploadCloud className="h-4 w-4 mr-2" />
                Upload {comparison.onlyLocal.length} file
                {comparison.onlyLocal.length === 1 ? "" : "s"}
              </Button>
            )}
          </div>

          {uploadOverall.total > 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {uploadOverall.completed} of {uploadOverall.total} uploaded
                    {uploadOverall.failed > 0 && (
                      <span className="text-destructive">
                        {" "}
                        · {uploadOverall.failed} failed
                      </span>
                    )}
                  </span>
                  <span>
                    {Math.round((uploadOverall.completed / uploadOverall.total) * 100)}%
                  </span>
                </div>
                <Progress
                  value={(uploadOverall.completed / uploadOverall.total) * 100}
                  className="h-2"
                />
              </div>

              <ScrollArea className="h-64 border rounded-md p-2">
                <ul className="space-y-2">
                  {uploadItems.map((item) => (
                    <li key={item.key} className="flex items-center gap-2 text-sm px-1">
                      {item.status === "completed" && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      )}
                      {item.status === "failed" && (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      {(item.status === "uploading" || item.status === "pending") && (
                        <Loader2
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-muted-foreground",
                            item.status === "uploading" && "animate-spin"
                          )}
                        />
                      )}
                      <span className="truncate flex-1" title={item.name}>
                        {item.name}
                      </span>
                      {item.status === "uploading" && (
                        <span className="text-xs text-muted-foreground shrink-0 w-9 text-right">
                          {item.progress}%
                        </span>
                      )}
                      {item.status === "failed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs shrink-0"
                          onClick={() => retryOne(item.key)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              {uploadOverall.failed > 0 && (
                <p className="text-xs text-muted-foreground">
                  {uploadOverall.failed} file{uploadOverall.failed === 1 ? "" : "s"} failed —
                  retry individually above.
                </p>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ResultColumn({
  title,
  description,
  icon,
  names,
  badgeVariant,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  names: string[];
  badgeVariant: "secondary" | "default";
}) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          {icon}
          {title}
        </div>
        <Badge variant={badgeVariant}>{names.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <ScrollArea className="h-56 border rounded-md">
        {names.length === 0 ? (
          <div className="text-sm text-muted-foreground p-3">None</div>
        ) : (
          <ul className="p-2 space-y-1">
            {names.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="flex items-center gap-1.5 text-sm truncate px-1 py-0.5 rounded hover:bg-muted"
                title={name}
              >
                <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </Card>
  );
}