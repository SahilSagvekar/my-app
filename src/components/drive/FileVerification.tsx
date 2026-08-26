// src/components/drive/FileVerification.tsx
//
// "File Verification" — compare a folder on the user's laptop against a
// folder in the Files & Drive (R2) explorer, matching by file name.
// Available to admin and client roles only (see NAVIGATION_ITEMS).
//
// How folder picking works:
//  - Local folder: <input type="file" webkitdirectory> — this is the only
//    broadly-supported way for a web page to read a folder's file names.
//    It does NOT upload anything; the browser just hands us File objects
//    with a relativePath. We only ever read .name off them.
//  - Remote folder: reuses the existing /api/drive/structure endpoint (same
//    one DriveExplorer uses) to fetch the client's full R2 folder tree,
//    then lets the user click through it to pick any folder at any depth.
//
// Comparison is by file name only (case-insensitive, trimmed), recursively
// through subfolders on both sides — not by file size or content.

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const isAllowed = normalizedRole === "admin" || normalizedRole === "client";

  // ── Admin: client selector ──────────────────────────────────────────────
  const [clientList, setClientList] = useState<{ id: string; name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  useEffect(() => {
    if (normalizedRole !== "admin") return;
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

  const loadRemoteTree = async (clientId?: string) => {
    setRemoteLoading(true);
    setRemoteError(null);
    setSelectedRemoteFolder(null);
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

  // Admin role: load when a client is selected.
  useEffect(() => {
    if (normalizedRole === "admin" && selectedClientId) {
      loadRemoteTree(selectedClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRole, selectedClientId]);

  // ── Local folder ─────────────────────────────────────────────────────────
  const localInputRef = useRef<HTMLInputElement>(null);
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [localFileNames, setLocalFileNames] = useState<string[]>([]);

  const handleLocalFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const names: string[] = [];
    let rootName = "Selected folder";
    for (let i = 0; i < files.length; i++) {
      const f = files[i] as File & { webkitRelativePath?: string };
      names.push(f.name);
      if (i === 0 && f.webkitRelativePath) {
        rootName = f.webkitRelativePath.split("/")[0] || rootName;
      }
    }
    setLocalFolderName(rootName);
    setLocalFileNames(names);
    setComparisonRun(false);
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

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-3">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Not available</h1>
        <p className="text-muted-foreground max-w-md">
          File Verification is only available to admin and client accounts.
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
            Nothing is uploaded — only file names are read from your browser.
          </p>
        </Card>

        {/* ── Remote folder ── */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 font-medium">
            <HardDrive className="h-4 w-4" />
            Files &amp; Drive
          </div>

          {normalizedRole === "admin" && (
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