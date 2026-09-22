// src/components/drive/DriveExplorer.tsx

"use client";

import { useState, useEffect, useRef, useCallback, DragEvent, ReactNode, CSSProperties } from "react";
import {
  Folder,
  FolderPlus,
  File as FileIcon,
  ChevronRight,
  Download,
  Eye,
  RefreshCw,
  Search,
  Upload,
  MoreVertical,
  Star,
  Image,
  Video,
  FileText,
  Music,
  Archive,
  Trash2,
  X,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Link as LinkIcon,
  Share2,
  Pencil,
  Filter,
  FolderOpen,
  CheckSquare,
  Square,
  FolderDown,
  PackageOpen,
  LayoutGrid,
  List,
  Smartphone,
  KeyRound,
  FolderInput,
  ChevronDown,
  UserRound,
} from "lucide-react";
import { ShareDialog } from "../review/ShareDialog";
import { FileUploadDialog } from "../workflow/FileUploadDialog-Resumable";
import { RawFootageUploadDialog } from "./RawFootageUploadDialog";
import { StorageLimitModal } from "../Storagelimitmodal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/AuthContext";
import { useViewAsRole } from "@/components/auth/ViewAsRoleContext";
import {
  TotpSetupDialog,
  TotpResetDialog,
  fetchTotpEnabled,
} from "@/components/auth/TotpDialogs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import MeetingNotesPanel from "../admin/MeetingNotesPanel";
import { DriveNotesPopover, type DriveNoteEntry } from "./Drivenotespopover";
import { MoveToDialog } from "./MoveToDialog";
import { cn } from "@/lib/utils";
import { formatFolderDisplayName } from "@/lib/format-folder-display-name";
import { toast } from "sonner";

interface DriveItem {
  name: string;
  type: "folder" | "file";
  path: string;
  s3Path?: string;
  s3Key?: string;
  children?: DriveItem[];
  size?: number;
  url?: string;
  thumbnailUrl?: string | null;
  lastModified?: string;
  /** Virtual read-only script injected when a folder has a linked script */
  isLinkedScript?: boolean;
  scriptContent?: string;
}

interface EditorColor {
  name: string;
  bg: string;
  border: string;
  chip: string;
}

interface EditorRosterEntry {
  id: number;
  name: string;
  color: EditorColor;
}

interface FileAssignmentEntry {
  editorId: number;
  editorName: string;
  color: EditorColor;
}

interface FileDownloadEntry {
  userId: number;
  name: string;
  count: number;
  lastDownloadedAt: string;
}

interface SearchResult {
  name: string;
  type: "file";
  path: string;
  s3Key: string;
  size?: number;
  url?: string;
  lastModified?: string;
  folderPath: string;
  breadcrumbParts: string[];
}

interface DriveExplorerProps {
  role: string;
}

// Renders a video thumbnail image when one exists, falling back to the
// regular extension icon otherwise (no thumbnail yet, non-video file, or
// the image failed to load — e.g. the signed URL expired in a long-open tab).
function FileThumbnail({
  thumbnailUrl,
  fallback,
  className,
}: {
  thumbnailUrl?: string | null;
  fallback: ReactNode;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!thumbnailUrl || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={thumbnailUrl}
      alt=""
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

const VIDEO_FILE_EXTENSIONS = /\.(mp4|mov|m4v|webm|mkv|avi|wmv|mts|m2ts)$/i;

// The storage tree does not include app-managed preview state. Hydrate it in
// batches so a folder view never makes one request per video.
async function attachGeneratedPreviews(root: DriveItem): Promise<DriveItem> {
  const videoKeys: string[] = [];
  const collect = (item: DriveItem) => {
    if (item.type === 'file' && VIDEO_FILE_EXTENSIONS.test(item.name)) {
      const key = item.s3Key || item.s3Path;
      if (key) videoKeys.push(key);
    }
    item.children?.forEach(collect);
  };
  collect(root);

  const previewByKey = new Map<string, string>();
  const uniqueKeys = [...new Set(videoKeys)];
  for (let i = 0; i < uniqueKeys.length; i += 100) {
    const params = new URLSearchParams({ keys: uniqueKeys.slice(i, i + 100).join(',') });
    const response = await fetch(`/api/media-previews?${params.toString()}`);
    if (!response.ok) continue;
    const { previews } = await response.json();
    Object.entries(previews || {}).forEach(([key, preview]: [string, any]) => {
      if (preview?.url) previewByKey.set(key, preview.url);
    });
  }

  const apply = (item: DriveItem): DriveItem => {
    const key = item.s3Key || item.s3Path;
    return {
      ...item,
      thumbnailUrl: item.thumbnailUrl || (key ? previewByKey.get(key) || null : null),
      children: item.children?.map(apply),
    };
  };
  return apply(root);
}



// ─── FEATURE 2: URL Path Persistence Helpers ───
function getPathFromUrl(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("drivePath") || "";
}

function setPathInUrl(path: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (path && path !== "/") {
    url.searchParams.set("drivePath", path);
  } else {
    url.searchParams.delete("drivePath");
  }
  window.history.replaceState({}, "", url.toString());
}

export function DriveExplorer({ role }: DriveExplorerProps) {
  const { user } = useAuth();
  const { viewingAsClientId } = useViewAsRole();
  const [driveStructure, setDriveStructure] = useState<DriveItem | null>(null);
  const [currentFolder, setCurrentFolder] = useState<DriveItem | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<DriveItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // 🔥 Desktop app only — Drive downloads go through Electron's native
  // download manager (see apps/desktop/src/main.js) since these are raw
  // R2 objects, not File records with an id the way task review videos
  // are. This just reflects that progress as a toast, same visual
  // pattern as the video-download toasts elsewhere in the app.
  // useEffect(() => {
  //   const desktop = (window as any).e8;
  //   if (!desktop?.isDesktopApp) return;

  //   desktop.onDriveDownloadProgress(({ fileName, percent }: { fileName: string; percent: number }) => {
  //     toast.loading(`Downloading ${fileName}... ${percent}%`, { id: `drive-download-${fileName}` });
  //   });

  //   desktop.onDriveDownloadDone(({ fileName, success }: { fileName: string; success: boolean }) => {
  //     if (success) {
  //       toast.success(`${fileName} downloaded`, { id: `drive-download-${fileName}` });
  //     } else {
  //       toast.error(`${fileName} download failed or was cancelled`, { id: `drive-download-${fileName}` });
  //     }
  //   });
  // }, []);

  useEffect(() => {
  const desktop = (window as any).e8;
  if (!desktop?.isDesktopApp) return;

  if (typeof desktop.onDriveDownloadProgress === "function") {
    desktop.onDriveDownloadProgress(({ fileName, percent }: { fileName: string; percent: number }) => {
      toast.loading(`Downloading ${fileName}... ${percent}%`, { id: `drive-download-${fileName}` });
    });
  }

  if (typeof desktop.onDriveDownloadDone === "function") {
    desktop.onDriveDownloadDone(({ fileName, success }: { fileName: string; success: boolean }) => {
      if (success) {
        toast.success(`${fileName} downloaded`, { id: `drive-download-${fileName}` });
      } else {
        toast.error(`${fileName} download failed or was cancelled`, { id: `drive-download-${fileName}` });
      }
    });
  }
}, []);

  // ─── View mode (grid / list) — persisted per-browser ───
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("drive-view-mode") : null;
    if (stored === "grid" || stored === "list") setViewMode(stored);
  }, []);
  const toggleViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    if (typeof window !== "undefined") window.localStorage.setItem("drive-view-mode", mode);
  };

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Delete states
  const [itemToDelete, setItemToDelete] = useState<DriveItem | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTotpCode, setDeleteTotpCode] = useState("");
  const [deleteTotpError, setDeleteTotpError] = useState("");
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [showTotpReset, setShowTotpReset] = useState(false);
  // Admin deletes require Google Authenticator (single + bulk)
  const requiresDeleteTotp = role === "admin";
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Admin delete TOTP gate ─────────────────────────────────────────────
  // Any admin delete — one file or a bulk batch — requires a fresh Google
  // Authenticator code, verified server-side on every request (see
  // /api/drive/delete and /api/drive/bulk-delete). This dialog is shared by
  // both flows; deleteMode tracks which one is in progress.
  const [showTotpDeleteDialog, setShowTotpDeleteDialog] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'bulk' | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpNotSetUp, setTotpNotSetUp] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // ─── Multi-select & bulk download state ───────────────────────────────────
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<string>('');

  // ─── Download job modal (async "Download All" zip build) ──────────────────
  interface ZipJobState {
    jobId: string;
    status: 'queued' | 'processing' | 'done' | 'failed';
    zipName: string;
    totalFiles: number;
    processedFiles: number;
    totalBytes: number;
    processedBytes: number;
    error: string | null;
    downloadUrl: string | null;
  }
  const [zipJob, setZipJob] = useState<ZipJobState | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const zipPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zipDownloadTriggeredRef = useRef(false);

  // Share states
  const [shareLink, setShareLink] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Folder creation states
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showMeetingNotesSheet, setShowMeetingNotesSheet] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Folder rename states
  const [itemToRename, setItemToRename] = useState<DriveItem | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Storage limit states
  const [showStorageLimitModal, setShowStorageLimitModal] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{
    used: number;
    limit: number;
    usedFormatted: string;
    limitFormatted: string;
    percentage: number;
    isAtLimit: boolean;
    isNearLimit: boolean;
    isCritical: boolean;
  } | null>(null);

  // ─── Drag & Drop state ───────────────────────────────────────────────────
  const [draggedItem, setDraggedItem] = useState<DriveItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // path of folder being hovered
  const [isMoving, setIsMoving] = useState(false);
  const [deliverableTypes, setDeliverableTypes] = useState<string[]>([]);
  const [selectedDeliverableFilter, setSelectedDeliverableFilter] = useState<string>("all");

  // ─── Folder status (In Progress / Completed) ──────────────────────────────
  const [folderStatuses, setFolderStatuses] = useState<Record<string, { status: string; updatedByName: string | null }>>({});

  // Short code to display name mapping
  const SHORT_CODE_LABELS: Record<string, string> = {
    SF: "Short Form",
    LF: "Long Form",
    SQF: "Square Form",
    THUMB: "Thumbnails",
    T: "Tiles",
    HP: "Hard Posts",
    SEP: "Snapchat Episodes",
    BSF: "Beta Short Form",
    ST: "Stories",
    TP: "Text Post",
  };

  // ─── FEATURE 3: Global Search ───
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<SearchResult[]>([]);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [showGlobalResults, setShowGlobalResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ─── FEATURE 2: Path restoration ref ───
  const pendingPathRef = useRef<string>("");
  const hasRestoredRef = useRef(false);

  // ─── Footage Links ───
  interface FootageLink { id: string; url: string; label?: string; addedByName: string; addedByRole: string; addedAt: string; folderPath?: string; }
  const [footageLinks, setFootageLinks] = useState<FootageLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [showAddLinkInput, setShowAddLinkInput] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  // ─── Client selector lists (admin/manager/editor) ───────────────────────
  const [adminClientList, setAdminClientList] = useState<{ id: string; name: string }[]>([]);
  const [adminSelectedClientId, setAdminSelectedClientId] = useState<string>('');
  const [editorClientList, setEditorClientList] = useState<{ id: string; name: string }[]>([]);
  const [editorSelectedClientId, setEditorSelectedClientId] = useState<string>('');

  // ─── Admin browsing context: resolve clientId from company name ───
  const [browsingClientId, setBrowsingClientId] = useState<string | null>(null);
  const [browsingCompanyName, setBrowsingCompanyName] = useState<string>("");

  // Use linkedClientId when present, otherwise fall back to the client-portal
  // preview override (an admin viewing-as a specific client — see
  // ViewAsRoleContext's CLIENT_PREVIEW_MAP), then the visible company folder.
  // Without the viewingAsClientId fallback, an admin previewing "client"
  // has no linkedClientId of their own, so every /api/drive/structure call
  // went out with no clientId at all and silently found nothing.
  const effectiveClientId = role === 'client'
    ? (user?.linkedClientId || viewingAsClientId || browsingClientId)
    : browsingClientId;
  const effectiveCompanyName = role === 'client'
    ? (browsingCompanyName || breadcrumb[0]?.name || '')
    : browsingCompanyName;

  // Resolve the client record from the visible company folder. Client users can
  // be linked by email/user relation instead of linkedClientId.
  useEffect(() => {
    // When the admin/editor client picker is driving browsing, that's the
    // authoritative source — don't let breadcrumb-guessing (which assumes
    // breadcrumb[1] is a company-name folder) stomp on it once we've
    // navigated into a subfolder like "raw-footage" whose name isn't a
    // company name at all.
    if ((role === 'admin' || role === 'manager' || role === 'scheduler' || role === 'videographer') && adminSelectedClientId) return;
    if (role === 'editor' && editorSelectedClientId) return;

    // For clients: breadcrumb[0] IS the company name (no "Root" prefix)
    // For admin/manager: breadcrumb[0] is "Root", breadcrumb[1] is the company name
    const companyFolder = role === 'client'
      ? breadcrumb[0]?.name
      : (breadcrumb.length >= 2 ? breadcrumb[1]?.name : breadcrumb[0]?.name);

    if (!companyFolder || companyFolder === 'Root') {
      setBrowsingClientId(null);
      setBrowsingCompanyName('');
      return;
    }

    if (companyFolder === browsingCompanyName) return;

    setBrowsingCompanyName(companyFolder);
    fetch(`/api/drive/client-lookup?companyName=${encodeURIComponent(companyFolder)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setBrowsingClientId(data?.clientId || null);
      })
      .catch(() => setBrowsingClientId(null));
  }, [breadcrumb, browsingCompanyName, role, adminSelectedClientId, editorSelectedClientId]);

  // Fetch storage info for clients
  useEffect(() => {
    if (role === 'client' && effectiveClientId) {
      fetch(`/api/clients/${effectiveClientId}/storage`)
        .then(res => res.json())
        .then(data => {
          setStorageInfo(data);
          if (data.isAtLimit) {
            setShowStorageLimitModal(true);
          }
        })
        .catch(console.error);
    }
  }, [role, effectiveClientId]);

  // ─── Fetch folder statuses for the current client ─────────────────────────
  const loadFolderStatuses = useCallback(() => {
    if (!effectiveClientId) {
      setFolderStatuses({});
      return;
    }
    fetch(`/api/drive/folder-status?clientId=${effectiveClientId}`)
      .then(res => res.ok ? res.json() : { statuses: {} })
      .then(data => setFolderStatuses(data.statuses || {}))
      .catch(() => setFolderStatuses({}));
  }, [effectiveClientId]);

  useEffect(() => {
    loadFolderStatuses();
  }, [loadFolderStatuses]);


  // only, matches the API's own role gate so other roles never even issue
  // the request (and never see the note icon rendered at all). ──────────
  const canSeeDriveNotes = ['admin', 'videographer', 'editor'].includes(role);
  const canCreateDriveNotes = ['admin', 'videographer'].includes(role);
  const [driveNotes, setDriveNotes] = useState<Record<string, DriveNoteEntry[]>>({});

  const loadDriveNotes = useCallback(() => {
    if (!effectiveClientId || !canSeeDriveNotes) {
      setDriveNotes({});
      return;
    }
    fetch(`/api/drive/notes?clientId=${effectiveClientId}`)
      .then(res => res.ok ? res.json() : { notes: {} })
      .then(data => setDriveNotes(data.notes || {}))
      .catch(() => setDriveNotes({}));
  }, [effectiveClientId, canSeeDriveNotes]);

  useEffect(() => {
    loadDriveNotes();
  }, [loadDriveNotes]);

  const handleDriveNotesChange = (s3Key: string, notes: DriveNoteEntry[]) => {
    setDriveNotes(prev => {
      const next = { ...prev };
      if (notes.length === 0) delete next[s3Key];
      else next[s3Key] = notes;
      return next;
    });
  };

  // ─── Editor Assignment ──────────────────────────────────────────────────
  // Tags files with which editor is responsible for them, color-coded, so
  // multiple editors working the same client folder don't have to guess.
  // Same view/manage split and "fetch the whole map once" shape as drive
  // notes above — colors come back from the server so every screen agrees.
  const canSeeEditorAssignments = ['admin', 'manager', 'scheduler', 'videographer', 'editor'].includes(role);
  const canManageEditorAssignments = ['admin', 'manager', 'videographer'].includes(role);
  const [editorRoster, setEditorRoster] = useState<EditorRosterEntry[]>([]);
  const [fileAssignments, setFileAssignments] = useState<Record<string, FileAssignmentEntry>>({});
  const [activeAssignEditorId, setActiveAssignEditorId] = useState<number | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const loadEditorAssignments = useCallback(() => {
    if (!effectiveClientId || !canSeeEditorAssignments) {
      setEditorRoster([]);
      setFileAssignments({});
      return;
    }
    fetch(`/api/drive/editor-assignments?clientId=${effectiveClientId}`)
      .then(res => res.ok ? res.json() : { editors: [], assignments: {} })
      .then(data => {
        setEditorRoster(data.editors || []);
        setFileAssignments(data.assignments || {});
      })
      .catch(() => { setEditorRoster([]); setFileAssignments({}); });
  }, [effectiveClientId, canSeeEditorAssignments]);

  useEffect(() => { loadEditorAssignments(); }, [loadEditorAssignments]);

  // Drop the active "assign brush" whenever it stops making sense — the
  // client changed (different roster) or that editor lost permission here.
  useEffect(() => {
    if (activeAssignEditorId !== null && !editorRoster.some(e => e.id === activeAssignEditorId)) {
      setActiveAssignEditorId(null);
    }
  }, [editorRoster, activeAssignEditorId]);

  const activeAssignEditor = editorRoster.find(e => e.id === activeAssignEditorId) || null;

  // Assign every currently-checked file to the active editor (bulk — reuses
  // the existing Select-mode checkbox set rather than a separate click-to-
  // paint interaction, so it composes with everything Select mode already
  // does: shift-click ranges, Select All, the mobile count badge, etc.)
  const assignCheckedToActiveEditor = async () => {
    if (!effectiveClientId || !activeAssignEditorId || checkedItems.size === 0) return;
    setIsAssigning(true);
    try {
      const s3Keys = Array.from(checkedItems);
      const res = await fetch('/api/drive/editor-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: effectiveClientId, s3Keys, editorId: activeAssignEditorId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFileAssignments(prev => {
          const next = { ...prev };
          for (const key of s3Keys) {
            next[key] = { editorId: data.editorId, editorName: data.editorName, color: data.color };
          }
          return next;
        });
        toast.success(`Assigned ${s3Keys.length} file${s3Keys.length === 1 ? '' : 's'} to ${data.editorName}`);
        clearChecked();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to assign files');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsAssigning(false);
    }
  };

  const unassignChecked = async () => {
    if (!effectiveClientId || checkedItems.size === 0) return;
    setIsAssigning(true);
    try {
      const s3Keys = Array.from(checkedItems);
      const res = await fetch('/api/drive/editor-assignments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: effectiveClientId, s3Keys }),
      });
      if (res.ok) {
        setFileAssignments(prev => {
          const next = { ...prev };
          for (const key of s3Keys) delete next[key];
          return next;
        });
        toast.success('Assignment cleared');
        clearChecked();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to clear assignment');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsAssigning(false);
    }
  };

  // ─── Download tracking ──────────────────────────────────────────────────
  // "Downloaded · Rashid" — who has already pulled a given file, and how
  // many times, so editors sharing a client folder can tell at a glance and
  // skip re-downloading something someone already grabbed. Same viewer
  // gate and "fetch the whole map once" shape as editor assignments/notes.
  const canSeeFileDownloads = ['admin', 'manager', 'scheduler', 'videographer', 'editor'].includes(role);
  const [fileDownloads, setFileDownloads] = useState<Record<string, FileDownloadEntry[]>>({});

  const loadFileDownloads = useCallback(() => {
    if (!effectiveClientId || !canSeeFileDownloads) {
      setFileDownloads({});
      return;
    }
    fetch(`/api/drive/downloads?clientId=${effectiveClientId}`)
      .then(res => res.ok ? res.json() : { downloads: {} })
      .then(data => setFileDownloads(data.downloads || {}))
      .catch(() => setFileDownloads({}));
  }, [effectiveClientId, canSeeFileDownloads]);

  useEffect(() => { loadFileDownloads(); }, [loadFileDownloads]);

  // Fire-and-forget — recorded the moment a download is kicked off, not
  // after it finishes (a zip can take a long time server-side; "who started
  // this" is the useful signal). Never blocks or fails the actual download:
  // errors are swallowed, and the local map is updated optimistically so
  // the badge appears immediately rather than waiting on a refetch.
  const recordFileDownloads = (s3Keys: string[]) => {
    if (!effectiveClientId || s3Keys.length === 0 || !user) return;
    const myId = Number(user.id);
    const displayName = user.name || user.email || 'You';
    setFileDownloads(prev => {
      const next = { ...prev };
      const nowIso = new Date().toISOString();
      for (const key of s3Keys) {
        const existing = next[key] || [];
        const mine = existing.find(d => d.userId === myId);
        const updatedMine: FileDownloadEntry = mine
          ? { ...mine, count: mine.count + 1, lastDownloadedAt: nowIso }
          : { userId: myId, name: displayName, count: 1, lastDownloadedAt: nowIso };
        const rest = existing.filter(d => d.userId !== myId);
        next[key] = [updatedMine, ...rest];
      }
      return next;
    });
    fetch('/api/drive/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: effectiveClientId, s3Keys }),
    }).catch(() => {});
  };

  const updateFolderStatus = async (item: DriveItem, status: "IN_PROGRESS" | "COMPLETED" | null) => {
    if (!effectiveClientId) {
      console.warn("[folder-status] No client resolved for this folder — nothing sent.", {
        role,
        browsingClientId,
        browsingCompanyName,
        breadcrumb: breadcrumb.map((b) => b.name),
      });
      toast.error("Couldn't identify which client this folder belongs to — try refreshing the page.");
      return;
    }
    const s3KeyPrefix = getS3Key(item);
    const previous = folderStatuses[s3KeyPrefix];

    // Optimistic update
    setFolderStatuses(prev => {
      const next = { ...prev };
      if (status === null) delete next[s3KeyPrefix];
      else next[s3KeyPrefix] = { status, updatedByName: user?.name || null };
      return next;
    });

    try {
      const res = await fetch("/api/drive/folder-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: effectiveClientId, s3KeyPrefix, status }),
      });
      if (!res.ok) throw new Error("Failed to update folder status");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update folder status");
      // Revert on failure
      setFolderStatuses(prev => {
        const next = { ...prev };
        if (previous) next[s3KeyPrefix] = previous;
        else delete next[s3KeyPrefix];
        return next;
      });
    }
  };

  // ─── FEATURE 1: Extract deliverable types from output folder names ───
  // Runs whenever driveStructure or currentFolder changes
  useEffect(() => {
    if (!driveStructure) return;

    // Find output folder children — look for task folders with short codes
    const extractTypesFromFolder = (folder: DriveItem): Set<string> => {
      const types = new Set<string>();
      if (!folder.children) return types;

      for (const child of folder.children) {
        if (child.type === 'folder') {
          // Task folder names: "CompanyName_MM-DD-YYYY_SF3" or just contain short codes
          const knownCodes = ['SF', 'LF', 'SQF', 'THUMB', 'HP', 'SEP', 'BSF', 'T', 'ST', 'TP'];
          for (const code of knownCodes) {
            // Match code in folder name: look for _CODE followed by digit or end
            const pattern = new RegExp(`_${code}\\d*$|_${code}\\d*[^A-Z]`);
            if (pattern.test(child.name) || child.name.includes(`_${code}`)) {
              types.add(code);
            }
          }
          // Also recurse into month folders to find task folders inside
          if (child.children) {
            const subTypes = extractTypesFromFolder(child);
            subTypes.forEach(t => types.add(t));
          }
        }
      }
      return types;
    };

    // Find the outputs folder in the tree
    const findOutputsFolder = (folder: DriveItem): DriveItem | null => {
      if (folder.name === 'outputs' || folder.name === 'output') return folder;
      if (!folder.children) return null;
      for (const child of folder.children) {
        if (child.type === 'folder') {
          const found = findOutputsFolder(child);
          if (found) return found;
        }
      }
      return null;
    };

    const outputsFolder = findOutputsFolder(driveStructure);
    if (outputsFolder) {
      const types = extractTypesFromFolder(outputsFolder);
      setDeliverableTypes(Array.from(types).sort());
    }
  }, [driveStructure]);

  // ─── FEATURE 2: Save pending path from URL before loading ───
  useEffect(() => {
    if (!hasRestoredRef.current) {
      pendingPathRef.current = getPathFromUrl();
    }
  }, []);

  // ── Load client list for admin/manager selector ──────────────────────────
  useEffect(() => {
    if (role !== 'admin' && role !== 'manager' && role !== 'scheduler' && role !== 'videographer') return;
    fetch('/api/clients')
      .then(r => r.ok ? r.json() : { clients: [] })
      .then(data => {
        const raw = Array.isArray(data) ? data : (data.clients || []);
        const list = raw.map((c: any) => ({
          id: c.id,
          name: c.companyName || c.name || c.id,
        }));
        setAdminClientList(list.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      })
      .catch(() => {});
  }, [role]);

  // ── Load client list for editor selector (only when multiple clients) ────
  useEffect(() => {
    if (role !== 'editor') return;
    fetch('/api/editor/clients')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const raw = Array.isArray(data) ? data : (data.clients || []);
        if (raw.length > 1) {
          const list = raw.map((c: any) => ({
            id: c.id,
            name: c.companyName || c.name || c.id,
          }));
          setEditorClientList(list.sort((a: any, b: any) => a.name.localeCompare(b.name)));
        }
      })
      .catch(() => {});
  }, [role]);

  // ── When admin picks a client, update context ─────────────────────────────
  useEffect(() => {
    if (!adminSelectedClientId) return;
    setBrowsingClientId(adminSelectedClientId);
    const client = adminClientList.find(c => c.id === adminSelectedClientId);
    if (client) setBrowsingCompanyName(client.name);
  }, [adminSelectedClientId, adminClientList]);

  // ── When editor picks a client, update context ────────────────────────────
  useEffect(() => {
    if (!editorSelectedClientId) return;
    setBrowsingClientId(editorSelectedClientId);
    const client = editorClientList.find(c => c.id === editorSelectedClientId);
    if (client) setBrowsingCompanyName(client.name);
  }, [editorSelectedClientId, editorClientList]);

  // ── Load structure on mount (all roles) ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadDriveStructure();
  }, [user]);

  // ── Reload structure when admin/editor selects a client ──────────────────
  // Also covers a real client role whose effectiveClientId only becomes
  // known after mount — e.g. an admin previewing "client" via
  // CLIENT_PREVIEW_MAP, where viewingAsClientId is restored from
  // localStorage in a separate effect one tick after this component's own
  // mount effect (above) already ran with it still null. A genuine client
  // user has user.linkedClientId synchronously, so their mount-effect
  // fetch above was already correct — skip the redundant refetch for them.
  useEffect(() => {
    if (!user) return;
    if (role === 'client' && user?.linkedClientId) return; // real client user — mount effect above already had the right id
    if (!effectiveClientId) return; // no selection yet, nothing to reload
    loadDriveStructure();
  }, [effectiveClientId]);

  // Load footage links when inside a deliverable folder
  useEffect(() => {
    if (!effectiveClientId) { setFootageLinks([]); return; }
    const parts = breadcrumb.map(b => b.name).filter(n => n !== 'Root');
    const path = parts.join('/') + '/'; // trailing slash matches getCurrentFolderS3Path()
    const rfIdx = parts.findIndex(p => p === 'raw-footage');
    const depth = rfIdx >= 0 ? parts.length - rfIdx - 1 : -1;
    const inDeliverable = path.includes('raw-footage') && depth >= 2;
    if (!inDeliverable) { setFootageLinks([]); return; }
    setLoadingLinks(true);
    fetch(`/api/clients/${effectiveClientId}/footage-links`)
      .then(r => r.json())
      .then(d => {
        const links = (d.links ?? []) as FootageLink[];
        setFootageLinks(links.filter((l: FootageLink) => l.folderPath === path));
      })
      .catch(() => setFootageLinks([]))
      .finally(() => setLoadingLinks(false));
  }, [effectiveClientId, breadcrumb]);

  const handleAddFootageLink = async () => {
    if (!newLinkUrl.trim()) return;
    const clientIdToUse = effectiveClientId || browsingClientId;
    if (!clientIdToUse) {
      alert('Could not determine client — please navigate into a client folder first');
      return;
    }
    setAddingLink(true);
    try {
      const folderPath = getCurrentFolderS3Path();
      const res = await fetch(`/api/clients/${clientIdToUse}/footage-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newLinkUrl.trim(), folderPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFootageLinks(prev => [...prev, data.link]);
      setNewLinkUrl('');
      setShowAddLinkInput(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add link');
    } finally {
      setAddingLink(false);
    }
  };

  const handleDeleteFootageLink = async (linkId: string) => {
    if (!effectiveClientId) return;
    try {
      const res = await fetch(`/api/clients/${effectiveClientId}/footage-links`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId }),
      });
      if (!res.ok) throw new Error('Failed');
      setFootageLinks(prev => prev.filter(l => l.id !== linkId));
    } catch {
      alert('Failed to remove link');
    }
  };

  const canAddFootageLinks = ['admin', 'manager', 'editor', 'client', 'videographer'].includes(role?.toLowerCase() ?? '');

  // ─── FEATURE 2: Navigate to folder by path string ───
  const navigateToPathInTree = useCallback((tree: DriveItem, targetPath: string) => {
    if (!targetPath || targetPath === "/") return;

    // targetPath can be like "raw-footage/April-2026/LF" (relative parts after root)
    const parts = targetPath.split("/").filter(Boolean);
    let current = tree;
    const newBreadcrumb: DriveItem[] = [tree];

    for (const part of parts) {
      const child = current.children?.find(
        c => c.type === "folder" && c.name === part
      );
      if (!child) break; // Path no longer exists — stop at deepest valid point
      newBreadcrumb.push(child);
      current = child;
    }

    setBreadcrumb(newBreadcrumb);
    setCurrentFolder(current);
    // Update URL to reflect where we actually ended up
    const resolvedPath = newBreadcrumb.slice(1).map(b => b.name).join("/");
    setPathInUrl(resolvedPath || "/");
  }, []);

  const loadDriveStructure = async (clientIdOverride?: string | null) => {
    // Capture current path BEFORE reload so we can restore it after
    const currentNavPath = breadcrumb.length > 1
      ? breadcrumb.slice(1).map(b => b.name).join("/")
      : "";
    // On first load, use URL path. On subsequent reloads, use current breadcrumb path.
    const pathToRestore = hasRestoredRef.current
      ? currentNavPath
      : pendingPathRef.current;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("role", role);

      if (user?.id) {
        params.append("userId", user.id.toString());
      }

      // Use override (captured at call time) or current effectiveClientId.
      // Guarded against ever becoming an actual URL param: something
      // upstream has intermittently handed this a non-string value (seen
      // in production as a literal clientId=[object+Object] query param,
      // which silently breaks the file-server lookup). typeof-checking
      // here means a bad caller now gets a loud console.warn pointing at
      // the actual value instead of a silent broken request.
      const resolvedClientId = clientIdOverride !== undefined ? clientIdOverride : effectiveClientId;
      if (resolvedClientId) {
        if (typeof resolvedClientId === 'string') {
          params.append("clientId", resolvedClientId);
        } else {
          console.warn('[loadDriveStructure] resolvedClientId is not a string, dropping it:', resolvedClientId);
        }
      }

      const response = await fetch(`/api/drive/structure?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load drive structure");
      }

      const data = await response.json();
      const hydratedData = await attachGeneratedPreviews(data);
      setDriveStructure(hydratedData);

      // ─── FEATURE 2: Restore navigation path after structure load ───
      if (pathToRestore) {
        navigateToPathInTree(hydratedData, pathToRestore);
      } else {
        setCurrentFolder(hydratedData);
        setBreadcrumb([hydratedData]);
      }
      hasRestoredRef.current = true;
    } catch (error: any) {
      console.error("Failed to load drive structure:", error);
      setError(error.message);
      const emptyRoot = {
        name: "Root",
        type: "folder" as const,
        path: "/",
        children: [],
      };
      setDriveStructure(emptyRoot);
      setCurrentFolder(emptyRoot);
      setBreadcrumb([emptyRoot]);
      hasRestoredRef.current = true;
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folder: DriveItem) => {
    setCurrentFolder(folder);
    const folderIndex = breadcrumb.findIndex((f) => f.path === folder.path);
    let newBreadcrumb: DriveItem[];
    if (folderIndex !== -1) {
      newBreadcrumb = breadcrumb.slice(0, folderIndex + 1);
    } else {
      newBreadcrumb = [...breadcrumb, folder];
    }
    setBreadcrumb(newBreadcrumb);
    setSelectedItems(new Set());

    // ─── FEATURE 2: Persist path to URL ───
    const pathStr = newBreadcrumb.slice(1).map(b => b.name).join("/");
    setPathInUrl(pathStr || "/");

    // ─── FEATURE 1: Auto-reset filter when navigating deep into task folder ───
    // Check if user is entering a task folder (depth 2+ from outputs)
    const newPathParts = newBreadcrumb.map(b => b.name);
    const newOutputsIdx = newPathParts.findIndex(p => p === 'outputs');
    const newDepthFromOutputs = newOutputsIdx >= 0 ? newPathParts.length - newOutputsIdx - 1 : -1;
    if (selectedDeliverableFilter !== "all" && newDepthFromOutputs >= 2) {
      setSelectedDeliverableFilter("all");
    }

    // Clear global search when navigating
    if (showGlobalResults) {
      setShowGlobalResults(false);
      setGlobalSearchQuery("");
      setGlobalSearchResults([]);
    }
  };

  const handleItemClick = (item: DriveItem) => {
    if (item.isLinkedScript) {
      // View surface: download the read-only script text.
      void handleDownloadClick(item);
      return;
    }
    if (item.type === "folder") {
      navigateToFolder(item);
    } else {
      const newSelected = new Set(selectedItems);
      if (newSelected.has(item.path)) {
        newSelected.delete(item.path);
      } else {
        newSelected.add(item.path);
      }
      setSelectedItems(newSelected);
    }
  };

  const handleItemDoubleClick = (item: DriveItem) => {
    if (item.type === "file" && item.url) {
      window.open(item.url, "_blank");
    }
  };

  const getCurrentFolderS3Path = (): string => {
    if (breadcrumb.length === 0) {
      return "";
    }
    const pathParts = breadcrumb.map((b) => b.name).filter((name) => name !== "Root");
    return pathParts.join("/") + "/";
  };

  // Check if we're at a level where RawFootageUploadDialog should show
  const currentPath = getCurrentFolderS3Path();
  const pathParts = currentPath.split('/').filter(Boolean);
  const rawFootageIndex = pathParts.findIndex(p => p === 'raw-footage');
  const depthFromRawFootage = rawFootageIndex >= 0 ? pathParts.length - rawFootageIndex - 1 : -1;

  const isInRawFootage = currentPath.includes('raw-footage');

  // ─── Scripting feature: raw-footage folder derived shoot dates ────────────
  // Only fetched while actually browsing inside a raw-footage/<month> folder,
  // for the client currently in view. Keyed by folder name ("SF1", "LF2") so
  // rendering below is a plain lookup, no per-folder network calls.
  const [rawFootageFolders, setRawFootageFolders] = useState<Record<string, { shootDates: string[]; taskTitle: string | null }>>({});
  const [linkedFolderScript, setLinkedFolderScript] = useState<DriveItem | null>(null);

  const rawFootageMonthFolder = (() => {
    const idx = pathParts.findIndex(p => p === 'raw-footage');
    return idx >= 0 && pathParts.length > idx + 1 ? pathParts[idx + 1] : null;
  })();

  useEffect(() => {
    if (!effectiveClientId || !isInRawFootage || !rawFootageMonthFolder) {
      setRawFootageFolders({});
      return;
    }
    fetch(`/api/raw-footage-folders?clientId=${effectiveClientId}&monthFolder=${encodeURIComponent(rawFootageMonthFolder)}`)
      .then(res => res.ok ? res.json() : { folders: [] })
      .then(data => {
        const map: Record<string, { shootDates: string[]; taskTitle: string | null }> = {};
        for (const f of (data.folders || [])) {
          map[`${f.code}${f.number}`] = { shootDates: f.shootDates || [], taskTitle: f.taskTitle || null };
        }
        setRawFootageFolders(map);
      })
      .catch(() => setRawFootageFolders({}));
  }, [effectiveClientId, isInRawFootage, rawFootageMonthFolder]);

  // When browsing inside an SF#/LF# raw-footage folder, surface the linked
  // script as a virtual read-only file (view + download only).
  useEffect(() => {
    const folderName = currentFolder?.name || '';
    const isNumberedSlot = /^(SF|LF)\d+$/i.test(folderName);
    if (!isInRawFootage || !isNumberedSlot || !currentFolder) {
      setLinkedFolderScript(null);
      return;
    }

    let cancelled = false;
    const folderPath = (currentFolder.s3Key || getS3Key(currentFolder)).replace(/\/?$/, '/');
    fetch(`/api/raw-footage-folders/script?folderPath=${encodeURIComponent(folderPath)}`)
      .then((res) => (res.ok ? res.json() : { script: null }))
      .then((data) => {
        if (cancelled || !data.script) {
          if (!cancelled) setLinkedFolderScript(null);
          return;
        }
        const fileName = data.script.fileName || `${folderName}-script.txt`;
        setLinkedFolderScript({
          name: fileName,
          type: 'file',
          path: `${currentFolder.path}/${fileName}`,
          s3Key: `__linked-script__/${folderPath}${fileName}`,
          size: new Blob([data.script.content || '']).size,
          isLinkedScript: true,
          scriptContent: data.script.content || '',
          lastModified: data.script.updatedAt || undefined,
        });
      })
      .catch(() => { if (!cancelled) setLinkedFolderScript(null); });

    return () => { cancelled = true; };
  }, [currentFolder, isInRawFootage]);

  // Formats a raw-footage folder's badge text: the shoot date if scheduled
  // (or "N shoot dates" if the script spans more than one shoot — see the
  // scripting feature's many-to-many script<->shoot linking), otherwise
  // "Unscheduled". Returns null for anything not an auto-numbered SF/LF
  // folder this feature tracks (so plain folders are left untouched).
  const rawFootageBadge = (folderName: string): string | null => {
    const info = rawFootageFolders[folderName];
    if (!info) return null;
    if (info.shootDates.length === 0) return 'Unscheduled';
    if (info.shootDates.length === 1) return new Date(info.shootDates[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${info.shootDates.length} shoot dates`;
  };

  const isInElements = currentPath.includes('elements');

  const shouldShowRawFootageDialog =
    !!effectiveClientId &&
    isInRawFootage &&
    depthFromRawFootage >= 0 &&
    depthFromRawFootage <= 1; // depth 2+ means already inside month/deliverable subfolder — use FileUploadDialog

  const shouldShowElementsDialog =
    !!effectiveClientId &&
    isInElements;

  const isClientInDeliverableFolder =
    isInRawFootage &&
    depthFromRawFootage >= 2;

  const canUpload = role !== 'client' || isClientInDeliverableFolder || isInElements;
  const isClientStorageLocked = role === 'client' && !!storageInfo?.isAtLimit;

  // Clients can only modify (delete/rename) items when inside a deliverable folder (depth 2+ from raw-footage) or elements
  const clientCanModify = role !== 'client' || isClientInDeliverableFolder || isInElements;

  const closeUploadDialog = () => { };

  // Get S3 Key for item
  const getS3Key = (item: DriveItem): string => {
    if (item.s3Key) {
      return item.s3Key;
    }
    const pathParts = breadcrumb.map((b) => b.name).filter((name) => name !== "Root");
    pathParts.push(item.name);
    return pathParts.join("/");
  };

  // Editor Assignment lookup — folders aren't assignable, only files.
  const getAssignmentFor = (item: DriveItem): FileAssignmentEntry | undefined =>
    item.type === 'file' ? fileAssignments[item.s3Key || getS3Key(item)] : undefined;

  // Download history lookup — most-recent downloader first (see the API's
  // sort). Returns undefined for folders and never-downloaded files alike.
  const getDownloadsFor = (item: DriveItem): FileDownloadEntry[] | undefined =>
    item.type === 'file' ? fileDownloads[item.s3Key || getS3Key(item)] : undefined;

  const downloadBadgeLabel = (downloads: FileDownloadEntry[]): string => {
    const [latest, ...rest] = downloads;
    const label = `Downloaded · ${latest.name}`;
    return rest.length > 0 ? `${label} +${rest.length}` : label;
  };

  const downloadBadgeTitle = (downloads: FileDownloadEntry[]): string =>
    downloads
      .map(d => `${d.name} — ${d.count} download${d.count === 1 ? '' : 's'}, last ${new Date(d.lastDownloadedAt).toLocaleString()}`)
      .join('\n');

  // ─── Folder status marking is restricted to folders living inside the
  // client's "raw-footage" tree, no matter how deeply nested. We check the
  // item's ancestor path segments (not the item's own name, and not a raw
  // substring match) so a client folder literally named e.g.
  // "raw-footage-notes" doesn't get falsely included, and the raw-footage
  // root folder itself is excluded (only its descendants qualify).
  const isInsideRawFootage = (item: DriveItem): boolean => {
    const key = item.s3Key || getS3Key(item);
    const parts = key.split("/").filter(Boolean);
    const ancestors = parts.slice(0, -1); // exclude the item's own name
    return ancestors.includes("raw-footage");
  };

  // ─── Folder status (In Progress = orange, Completed = green) ──────────────
  const getFolderStatus = (item: DriveItem): "IN_PROGRESS" | "COMPLETED" | undefined => {
    const current = folderStatuses[item.s3Key || getS3Key(item)]?.status;
    return current === "IN_PROGRESS" || current === "COMPLETED" ? current : undefined;
  };

  // A drop-shadow filter (stacked in 4 directions) traces the icon's actual
  // rendered outline pixel-for-pixel — unlike a second larger icon stacked
  // behind it, this can't misalign with the folder's asymmetric shape (the
  // tab isn't centered in the icon's bounding box), since it's applied
  // directly to the one real icon rather than a separately-sized copy.
  const getFolderStatusOutlineStyle = (item: DriveItem): CSSProperties | undefined => {
    const status = getFolderStatus(item);
    if (!status) return undefined;
    const color = status === "IN_PROGRESS" ? "#f97316" /* orange-500 */ : "#22c55e" /* green-500 */;
    return {
      filter:
        `drop-shadow(1.5px 0 0 ${color}) drop-shadow(-1.5px 0 0 ${color}) ` +
        `drop-shadow(0 1.5px 0 ${color}) drop-shadow(0 -1.5px 0 ${color})`,
    };
  };

  // Handle Delete Click
  const handleDeleteClick = (item: DriveItem) => {
    if (item.isLinkedScript) {
      toast.error('Linked scripts are view & download only — they can’t be deleted from Drive');
      return;
    }
    setItemToDelete(item);
    if (role === 'admin') {
      // Admin deletes skip the plain confirm dialog and go straight to the
      // TOTP-gated one — entering a real code is itself the confirmation.
      setDeleteMode('single');
      setTotpCode('');
      setTotpError(null);
      setTotpNotSetUp(false);
      setShowTotpDeleteDialog(true);
    } else {
      setShowDeleteDialog(true);
    }
  };

  // ─── Confirm Delete — reload structure, path auto-preserved ───
  const confirmDelete = async (totpCodeForRequest?: string) => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    setTotpError(null);
    setDeleteTotpError("");

    try {
      const s3Key = getS3Key(itemToDelete);

      const response = await fetch("/api/drive/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          s3Key,
          type: itemToDelete.type,
          userId: user?.id?.toString(),
          role,
          ...(totpCodeForRequest ? { totpCode: totpCodeForRequest } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.totpReason) {
          // Server-side TOTP check failed — surface it in the TOTP dialog
          setIsDeleting(false);
          if (errorData.totpReason === 'not_set_up') {
            setTotpNotSetUp(true);
            setShowTotpDeleteDialog(true);
            setShowDeleteDialog(false);
          } else {
            setTotpError(errorData.error || "Invalid verification code");
          }
          return;
        }
        if (errorData.code === "NOT_SETUP" || errorData.code === "NOT_ENABLED") {
          setShowDeleteDialog(false);
          setShowTotpSetup(true);
          throw new Error(errorData.error || "Authenticator not set up");
        }
        if (errorData.requiresTotp || errorData.code === "INVALID" || errorData.code === "MISSING") {
          setDeleteTotpError(errorData.error || "Invalid authenticator code");
          setIsDeleting(false);
          return;
        }
        throw new Error(errorData.error || "Delete failed");
      }

      toast.success(`${itemToDelete.name} deleted successfully`);

      // Close dialogs first
      setShowDeleteDialog(false);
      setShowTotpDeleteDialog(false);
      setItemToDelete(null);
      setDeleteTotpCode("");
      setIsDeleting(false);
      setTotpCode('');
      setDeleteMode(null);

      // Reload structure — FEATURE 2 will preserve the path
      await loadDriveStructure();

      // Refresh storage info
      if (role === 'client' && effectiveClientId) {
        fetch(`/api/clients/${effectiveClientId}/storage`)
          .then(res => res.json())
          .then(setStorageInfo)
          .catch(console.error);
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(`Failed to delete ${itemToDelete.name}: ${error.message}`);
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setItemToDelete(null);
    setDeleteTotpCode("");
    setDeleteTotpError("");
  };

  const cancelTotpDelete = () => {
    setShowTotpDeleteDialog(false);
    setTotpCode('');
    setTotpError(null);
    setTotpNotSetUp(false);
    if (deleteMode === 'single') setItemToDelete(null);
    setDeleteMode(null);
  };

  const submitTotpDelete = () => {
    if (!totpCode.trim()) {
      setTotpError('Enter the 6-digit code from Google Authenticator');
      return;
    }
    if (deleteMode === 'single') {
      confirmDelete(totpCode.trim());
    } else if (deleteMode === 'bulk') {
      performBulkDelete(totpCode.trim());
    }
  };

  // ─── Bulk delete (admin only) — reuses the checkedItems selection ───────
  const handleBulkDeleteClick = () => {
    if (role !== 'admin' || checkedItems.size === 0) return;
    setDeleteMode('bulk');
    setTotpCode('');
    setTotpError(null);
    setTotpNotSetUp(false);
    setShowTotpDeleteDialog(true);
  };

  const performBulkDelete = async (totpCodeForRequest: string) => {
    const keys = Array.from(checkedItems);
    if (keys.length === 0) return;

    setIsBulkDeleting(true);
    setTotpError(null);

    try {
      const items = keys.map((key) => {
        const item = filteredItems.find(i => (i.s3Key || getS3Key(i)) === key);
        return { s3Key: key, type: (item?.type || 'file') as 'file' | 'folder' };
      });

      const response = await fetch("/api/drive/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, totpCode: totpCodeForRequest }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.totpReason) {
          setIsBulkDeleting(false);
          if (data.totpReason === 'not_set_up') {
            setTotpNotSetUp(true);
          } else {
            setTotpError(data.error || "Invalid verification code");
          }
          return;
        }
        throw new Error(data.error || "Bulk delete failed");
      }

      if (data.deletedCount > 0) {
        toast.success(`Deleted ${data.deletedCount} item${data.deletedCount !== 1 ? 's' : ''}`);
      }
      if (data.failed?.length > 0) {
        toast.error(`${data.failed.length} item${data.failed.length !== 1 ? 's' : ''} failed to delete`);
      }

      setShowTotpDeleteDialog(false);
      setTotpCode('');
      setDeleteMode(null);
      setIsBulkDeleting(false);
      clearChecked();

      await loadDriveStructure();

      if (role === 'client' && effectiveClientId) {
        fetch(`/api/clients/${effectiveClientId}/storage`)
          .then(res => res.json())
          .then(setStorageInfo)
          .catch(console.error);
      }
    } catch (error: any) {
      console.error("Bulk delete error:", error);
      toast.error(`Bulk delete failed: ${error.message}`);
      setIsBulkDeleting(false);
    }
  };

  // ─── Create Folder — reload structure, path auto-preserved ───
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    setIsCreatingFolder(true);

    try {
      const response = await fetch('/api/drive/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: getCurrentFolderS3Path(),
          folderName: newFolderName.trim(),
          userId: user?.id?.toString(),
          role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create folder');
      }

      toast.success(`Folder "${newFolderName}" created`);
      setShowCreateFolderDialog(false);
      setNewFolderName('');

      // Reload — path preserved via FEATURE 2
      await loadDriveStructure();
    } catch (error: any) {
      console.error('Create folder error:', error);
      toast.error(error.message || 'Failed to create folder');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Handle Rename Click
  const handleRenameClick = (item: DriveItem) => {
    if (item.isLinkedScript) {
      toast.error('Linked scripts are view & download only — they can’t be renamed');
      return;
    }
    setItemToRename(item);
    setRenameValue(item.name);
    setShowRenameDialog(true);
  };

  // Confirm Rename
  const confirmRename = async () => {
    if (!itemToRename || !renameValue.trim()) {
      toast.error('Please enter a new name');
      return;
    }

    if (renameValue.trim() === itemToRename.name) {
      setShowRenameDialog(false);
      return;
    }

    setIsRenaming(true);

    try {
      const s3Key = getS3Key(itemToRename);

      const response = await fetch('/api/drive/folder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPath: s3Key,
          newName: renameValue.trim(),
          userId: user?.id?.toString(),
          role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rename');
      }

      toast.success(`Renamed to "${renameValue}"`);
      setShowRenameDialog(false);
      setItemToRename(null);
      setRenameValue('');

      // Reload — path preserved via FEATURE 2
      await loadDriveStructure();
    } catch (error: any) {
      console.error('Rename error:', error);
      toast.error(error.message || 'Failed to rename');
    } finally {
      setIsRenaming(false);
    }
  };

  // Handle Share Link
  const handleShareClick = async (item: DriveItem) => {
    setIsSharing(true);
    setCopied(false);

    try {
      const s3Key = item.s3Key || getS3Key(item);
      const isFolder = item.type === "folder";

      // Resolve mimeType before building the body — never fetch inside JSON.stringify
      let mimeType: string | null = null;
      if (!isFolder && item.url) {
        try {
          const head = await fetch(item.url, { method: 'HEAD' });
          mimeType = head.headers.get('content-type');
        } catch {
          // Non-fatal — mimeType stays null
        }
      }

      const response = await fetch("/api/drive/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          s3Key: isFolder ? s3Key + '/' : s3Key,
          fileName: item.name,
          fileSize: item.size,
          mimeType,
          type: isFolder ? 'folder' : 'file',
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate share link");
      }

      const data = await response.json();
      setShareLink(data.shareUrl);
      setShowShareDialog(true);

      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      toast.success(`Share link created and copied to clipboard`);
      setTimeout(() => setCopied(false), 3000);

    } catch (error: any) {
      console.error("Share error:", error);
      toast.error("Failed to generate share link");
    } finally {
      setIsSharing(false);
    }
  };

  // Download file via presigned S3 URL
  const handleDownloadClick = async (item: DriveItem) => {
    if (item.type !== "file") return;

    // Virtual linked script — download as a local .txt (read-only surface).
    if (item.isLinkedScript && typeof item.scriptContent === 'string') {
      const blob = new Blob([item.scriptContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name.endsWith('.txt') ? item.name : `${item.name}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Script downloaded');
      return;
    }

    try {
      const s3Key = item.s3Key || getS3Key(item);

      const response = await fetch("/api/drive/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key,
          fileName: item.name,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate download link");
      }

      const data = await response.json();
      if (canSeeFileDownloads) recordFileDownloads([s3Key]);

      const desktop = (window as any).e8;
      if (desktop?.isDesktopApp) {
        const result = await desktop.downloadToDownloadsFolder(data.downloadUrl);
        if (!result.success) {
          toast.error(result.message || "Failed to start download");
        }
        return;
      }

      window.open(data.downloadUrl, '_blank');
      toast.success('Download started');
    } catch (error: any) {
      console.error("Download error:", error);
      if (item.url) {
        window.open(item.url, '_blank');
      }
      toast.error("Failed to start download");
    }
  };

  // ─── Download helpers ────────────────────────────────────────────────────────
  // "Download All" builds a real zip server-side (streamed through the file
  // server into R2, never buffered in full — see e8-file-server's
  // zipWorker.js) as a background job, and the browser just polls for
  // progress and downloads the single finished file once ready.
  //
  // Previously this fetched presigned per-file R2 URLs and triggered
  // individual browser downloads in a loop — that silently broke past ~6
  // files, since Chrome blocks a page from auto-triggering more than a
  // handful of downloads without explicit permission. A single zip means a
  // single download, so that limit no longer applies, and it also works
  // for folders far too large to ever hand-list (100GB+).

  // Trigger a single file download via <a> click.
  const triggerSingleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const stopZipPolling = () => {
    if (zipPollRef.current) {
      clearInterval(zipPollRef.current);
      zipPollRef.current = null;
    }
  };

  const pollZipJob = (jobId: string, zipFileName: string) => {
    stopZipPolling();
    zipDownloadTriggeredRef.current = false;
    zipPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/drive/zip-jobs/${jobId}`);
        const data = await res.json();

        if (data.status === 'queued') {
          setZipJob(prev => (prev ? { ...prev, status: 'queued' } : prev));
          return;
        }
        if (data.status === 'failed') {
          stopZipPolling();
          setZipJob(prev => (prev ? { ...prev, status: 'failed', error: data.error || 'Zip build failed' } : prev));
          toast.error(data.error || 'Download failed');
          return;
        }

        setZipJob({
          jobId,
          status: data.status,
          zipName: zipFileName,
          totalFiles: data.totalFiles || 0,
          processedFiles: data.processedFiles || 0,
          totalBytes: data.totalBytes || 0,
          processedBytes: data.processedBytes || 0,
          error: null,
          downloadUrl: data.downloadUrl || null,
        });

        if (data.status === 'done' && data.downloadUrl && !zipDownloadTriggeredRef.current) {
          zipDownloadTriggeredRef.current = true;
          stopZipPolling();
          triggerSingleDownload(data.downloadUrl, zipFileName);
        }
      } catch (err) {
        // Transient network blip on a single poll — just try again next tick.
        console.warn('[zip poll] failed, will retry:', err);
      }
    }, 3000);
  };

  // Starts the async zip-build job and opens the progress modal. Does NOT
  // wait for the zip to finish — see /api/drive/download-zip's own comment
  // for why (folders can take hours to zip; the browser never holds that
  // connection open).
  const downloadFilesFromUrls = async (
    body: { folderPrefix?: string; keys?: string[]; zipName?: string },
    label: string,
  ) => {
    setIsZipping(true);
    setZipProgress(`Starting "${label}"…`);
    try {
      const res = await fetch('/api/drive/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(e.error || `Server error (${res.status})`);
      }
      const data = await res.json() as { jobId: string };
      const zipFileName = `${(body.zipName || label).replace(/\.zip$/, '')}.zip`;

      setZipJob({
        jobId: data.jobId,
        status: 'queued',
        zipName: zipFileName,
        totalFiles: 0, processedFiles: 0, totalBytes: 0, processedBytes: 0,
        error: null, downloadUrl: null,
      });
      setShowDownloadModal(true);
      pollZipJob(data.jobId, zipFileName);
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    } finally {
      setIsZipping(false);
      setZipProgress('');
    }
  };

  const handleDownloadFolder = async (item: DriveItem) => {
    const s3Key = item.s3Key || getS3Key(item);
    const folderPrefix = s3Key.endsWith('/') ? s3Key : `${s3Key}/`;
    await downloadFilesFromUrls({ folderPrefix, zipName: item.name }, item.name);
  };

  const handleDownloadAll = async () => {
    const currentPrefix = getCurrentFolderS3Path();
    const folderName = breadcrumb[breadcrumb.length - 1]?.name || 'download';
    await downloadFilesFromUrls({ folderPrefix: currentPrefix, zipName: folderName }, folderName);
  };

  const handleDownloadSelected = async () => {
    const keys = Array.from(checkedItems);
    if (keys.length === 0) return;
    // Separate folders and files
    const folderKeys = keys.filter(key => filteredItems.find(i => (i.s3Key || getS3Key(i)) === key)?.type === 'folder');
    const fileKeys = keys.filter(key => !folderKeys.includes(key));
    // Download each selected folder's contents
    for (const key of folderKeys) {
      const item = filteredItems.find(i => (i.s3Key || getS3Key(i)) === key);
      if (item) await downloadFilesFromUrls({ folderPrefix: key.endsWith('/') ? key : `${key}/` }, item.name);
    }
    // Download selected individual files
    if (fileKeys.length > 0) {
      await downloadFilesFromUrls({ keys: fileKeys }, `${fileKeys.length} files`);
      if (canSeeFileDownloads) recordFileDownloads(fileKeys);
    }
    setCheckedItems(new Set());
    setIsSelectionMode(false);
  };


  const toggleChecked = (item: DriveItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = item.s3Key || getS3Key(item);
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAllFiles = () => {
    setCheckedItems(new Set(filteredItems.map(i => i.s3Key || getS3Key(i))));
  };

  const clearChecked = () => { setCheckedItems(new Set()); setIsSelectionMode(false); };


  // ─── Drag & Drop Handlers ────────────────────────────────────────────────

  const handleDragStart = (e: DragEvent<HTMLDivElement>, item: DriveItem) => {
    // Clients cannot move files
    if (role === 'client') { e.preventDefault(); return; }
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.path);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, targetFolder: DriveItem) => {
    if (!draggedItem || targetFolder.type !== 'folder') return;
    if (targetFolder.path === draggedItem.path) return; // can't drop on itself
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(targetFolder.path);
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetFolder: DriveItem) => {
    e.preventDefault();
    setDragOverTarget(null);
    if (!draggedItem || !draggedItem || targetFolder.type !== 'folder') return;
    if (targetFolder.path === draggedItem.path) return;

    // Prevent dropping a folder into its own descendant
    const sourceKey = draggedItem.s3Key || getS3Key(draggedItem);
    const destKey = targetFolder.s3Key || getS3Key(targetFolder);
    if (destKey.startsWith(sourceKey)) {
      toast.error('Cannot move a folder into itself');
      setDraggedItem(null);
      return;
    }

    setIsMoving(true);
    const movingName = draggedItem.name;

    try {
      const res = await fetch('/api/drive/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceKey,
          destinationFolderKey: destKey,
          type: draggedItem.type,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Move failed');
      }

      toast.success(`"${movingName}" moved to "${targetFolder.name}"`);
      if (draggedItem.type === 'file') {
        spliceMovedItemsLocally([draggedItem], targetFolder);
      } else {
        await loadDriveStructure();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to move item');
    } finally {
      setIsMoving(false);
      setDraggedItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  // ─── "Move to…" (non-drag) ───────────────────────────────────────────────
  // Files moved this way (and file drags above) update the on-screen tree
  // directly instead of re-fetching /api/drive/structure — the full
  // rescan is what made every move feel slow on a big client folder.
  // Folder moves still trigger a full reload afterward: correctly
  // rewriting every descendant's key client-side is riskier than it's
  // worth for what should be a rarer action than moving files.
  const [moveDialogItems, setMoveDialogItems] = useState<DriveItem[] | null>(null);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);

  const openMoveDialog = (items: DriveItem[]) => {
    if (items.length === 0) return;
    setMoveDialogItems(items);
  };

  // Removes the given items from wherever `currentFolder` is inside the
  // (cloned) tree, and inserts freshly-keyed copies into wherever
  // `destFolder` is — so the visible list updates without a network round
  // trip. Only correct for file moves (see comment above); folder moves
  // fall back to loadDriveStructure().
  const spliceMovedItemsLocally = (movedFiles: DriveItem[], destFolder: DriveItem) => {
    if (movedFiles.length === 0 || !currentFolder) return;
    const movedNames = new Set(movedFiles.map(f => f.name));

    const destKeyRaw = destFolder.s3Key || getS3Key(destFolder);
    const destPrefix = destKeyRaw.endsWith('/') ? destKeyRaw : `${destKeyRaw}/`;
    const destPathPrefix = destFolder.path === '/' || !destFolder.path ? '' : `${destFolder.path}/`;

    const movedCopies: DriveItem[] = movedFiles.map(f => ({
      ...f,
      s3Key: `${destPrefix}${f.name}`,
      path: `${destPathPrefix}${f.name}`,
    }));

    setDriveStructure(prev => {
      if (!prev) return prev;
      const cloneAndUpdate = (node: DriveItem): DriveItem => {
        if (!node.children) return node;
        let children = node.children.map(cloneAndUpdate);

        if (node.path === currentFolder.path) {
          children = children.filter(c => !(c.type === 'file' && movedNames.has(c.name)));
        }
        if (node.path === destFolder.path) {
          children = [...children, ...movedCopies];
        }
        return { ...node, children };
      };
      return cloneAndUpdate(prev);
    });

    // driveStructure and currentFolder are separate state — update the
    // visible list directly rather than relying on the clone above (whose
    // new node identities currentFolder doesn't automatically pick up).
    setCurrentFolder(prevFolder => {
      if (!prevFolder) return prevFolder;
      return {
        ...prevFolder,
        children: (prevFolder.children || []).filter(
          c => !(c.type === 'file' && movedNames.has(c.name)),
        ),
      };
    });
  };

  const handleMoveConfirm = async (destination: DriveItem) => {
    if (!moveDialogItems || moveDialogItems.length === 0) return;
    setIsSubmittingMove(true);

    const destKey = destination.s3Key || getS3Key(destination);
    let failed = 0;

    for (const item of moveDialogItems) {
      const sourceKey = item.s3Key || getS3Key(item);
      try {
        const res = await fetch('/api/drive/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceKey, destinationFolderKey: destKey, type: item.type }),
        });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }

    const succeededCount = moveDialogItems.length - failed;
    if (succeededCount > 0) {
      toast.success(
        `Moved ${succeededCount} item${succeededCount !== 1 ? 's' : ''} to "${destination.name || 'Root'}"`,
      );
    }
    if (failed > 0) {
      toast.error(`${failed} item${failed !== 1 ? 's' : ''} failed to move`);
    }

    const anyFolders = moveDialogItems.some(i => i.type === 'folder');
    if (anyFolders) {
      await loadDriveStructure();
    } else if (succeededCount > 0) {
      spliceMovedItemsLocally(moveDialogItems, destination);
    }

    setIsSubmittingMove(false);
    setMoveDialogItems(null);
    clearChecked();
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) {
      return <Image className="h-8 w-8 text-blue-500" />;
    }
    if (["mp4", "webm", "mov", "avi"].includes(ext || "")) {
      return <Video className="h-8 w-8 text-purple-500" />;
    }
    if (["pdf", "doc", "docx", "txt"].includes(ext || "")) {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    if (["mp3", "wav", "ogg"].includes(ext || "")) {
      return <Music className="h-8 w-8 text-green-500" />;
    }
    if (["zip", "rar", "7z", "tar"].includes(ext || "")) {
      return <Archive className="h-8 w-8 text-yellow-500" />;
    }

    return <FileIcon className="h-8 w-8 text-gray-500" />;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  };

  // ─── FEATURE 3: Global Search Handler ───
  const handleGlobalSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setGlobalSearchResults([]);
      setShowGlobalResults(false);
      return;
    }

    setIsGlobalSearching(true);
    setShowGlobalResults(true);

    try {
      const params = new URLSearchParams({
        q: query,
        role,
        ...(user?.id ? { userId: user.id.toString() } : {}),
      });

      const response = await fetch(`/api/drive/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setGlobalSearchResults(data.results || []);
    } catch (error: any) {
      console.error("Global search error:", error);
      toast.error("Search failed");
      setGlobalSearchResults([]);
    } finally {
      setIsGlobalSearching(false);
    }
  }, [role, user?.id]);

  // ─── FEATURE 3: Debounced search input ───
  const handleSearchInputChange = (value: string) => {
    setGlobalSearchQuery(value);
    // Also update local filter for current folder children
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        handleGlobalSearch(value);
      }, 500); // 500ms debounce
    } else {
      setGlobalSearchResults([]);
      setShowGlobalResults(false);
    }
  };

  // ─── FEATURE 3: Navigate to a search result's parent folder ───
  const navigateToSearchResult = (result: SearchResult) => {
    if (!driveStructure) return;

    // Walk the tree using the breadcrumb parts from the search result
    const parts = result.breadcrumbParts;
    let current = driveStructure;
    const newBreadcrumb: DriveItem[] = [driveStructure];

    for (const part of parts) {
      const child = current.children?.find(
        c => c.type === "folder" && c.name === part
      );
      if (!child) break;
      newBreadcrumb.push(child);
      current = child;
    }

    setBreadcrumb(newBreadcrumb);
    setCurrentFolder(current);
    const pathStr = newBreadcrumb.slice(1).map(b => b.name).join("/");
    setPathInUrl(pathStr || "/");

    // Clear search UI
    setShowGlobalResults(false);
    setGlobalSearchQuery("");
    setSearchQuery("");
    setGlobalSearchResults([]);

    // Highlight the file so user can see it
    setSelectedItems(new Set([result.path]));
  };

  // ─── Helper: check if a task folder name contains a deliverable short code ───
  const taskFolderMatchesType = (folderName: string, shortCode: string): boolean => {
    // Task folder names: "CompanyName_MM-DD-YYYY_SF3", "CompanyName_01-15-2026_LF1"
    const pattern = new RegExp(`_${shortCode}\\d*$`);
    return pattern.test(folderName);
  };

  // ─── Helper: check if a month folder contains task folders matching the type ───
  const monthContainsType = (folder: DriveItem, shortCode: string): boolean => {
    if (!folder.children) return false;
    return folder.children.some(
      c => c.type === "folder" && taskFolderMatchesType(c.name, shortCode)
    );
  };

  // ─── Check if we're inside the outputs folder ───
  const isInOutputs = currentPath.includes('/outputs/') || currentPath.endsWith('/outputs/') ||
    pathParts.some(p => p === 'outputs');
  const outputsIndex = pathParts.findIndex(p => p === 'outputs');
  const depthFromOutputs = outputsIndex >= 0 ? pathParts.length - outputsIndex - 1 : -1;

  // ─── FEATURE 1: Filter current folder items by deliverable type ───
  const getFilteredItems = (): DriveItem[] => {
    let items = [...(currentFolder?.children || [])];

    // Surface the linked shoot/deliverable script as a virtual read-only file
    // at the top of SF#/LF# raw-footage folders.
    if (linkedFolderScript && !items.some((i) => i.isLinkedScript || i.name === linkedFolderScript.name)) {
      items = [linkedFolderScript, ...items];
    }

    if (selectedDeliverableFilter !== "all") {
      const code = selectedDeliverableFilter;

      if (isInOutputs) {
        if (depthFromOutputs === 0) {
          // Inside outputs, seeing month folders
          // Filter months to only show those containing task folders with the selected type
          items = items.filter(item => {
            if (item.type !== "folder") return true;
            return monthContainsType(item, code);
          });
        } else if (depthFromOutputs === 1) {
          // Inside a month folder, seeing task folders
          // Filter task folders by deliverable short code
          items = items.filter(item => {
            if (item.type !== "folder") return true;
            return taskFolderMatchesType(item.name, code);
          });
        }
        // depth 2+ = inside a task folder, don't filter
      } else if (currentFolder?.children?.some(c => c.name === 'outputs')) {
        // At company root, seeing outputs/raw-footage/etc
        // Filter outputs folder to only show if it has matching content
        items = items.filter(item => {
          if (item.type !== "folder") return true;
          if (item.name === 'outputs' && item.children) {
            // Check if any month inside outputs has matching tasks
            return item.children.some(month =>
              month.type === "folder" && monthContainsType(month, code)
            );
          }
          return true;
        });
      }
    }

    // Apply local text search filter
    if (searchQuery && !showGlobalResults) {
      items = items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return items;
  };

  const filteredItems = getFilteredItems();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col sm:flex-row h-screen bg-background">

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        if (!open) cancelDelete();
        else setShowDeleteDialog(true);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete {itemToDelete?.type === "folder" ? "folder" : "file"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Are you sure you want to delete{" "}
                  <strong className="text-foreground">{itemToDelete?.name}</strong>?
                </p>
                {itemToDelete?.type === "folder" && (
                  <p className="text-red-600">
                    This will delete the folder and all its contents permanently.
                  </p>
                )}
                <p>This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin TOTP gate — single-item and bulk delete */}
      <AlertDialog
        open={showTotpDeleteDialog}
        onOpenChange={(open) => {
          if (!open) cancelTotpDelete();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
              Verify deletion
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {totpNotSetUp ? (
                  <>
                    <p>
                      Google Authenticator is not set up for your account. Set it up
                      before deleting files, or use Authenticator in the toolbar.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        cancelTotpDelete();
                        setShowTotpSetup(true);
                      }}
                    >
                      Set up Authenticator
                    </Button>
                  </>
                ) : (
                  <>
                    <p>
                      Enter the 6-digit code from Google Authenticator to permanently
                      delete{" "}
                      {deleteMode === "bulk"
                        ? `${checkedItems.size} selected item${checkedItems.size === 1 ? "" : "s"}`
                        : itemToDelete
                          ? `"${itemToDelete.name}"`
                          : "this item"}
                      .
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="drive-totp-code" className="text-foreground">
                        Authenticator code
                      </Label>
                      <Input
                        id="drive-totp-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        value={totpCode}
                        onChange={(e) => {
                          setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 8));
                          setTotpError(null);
                        }}
                        disabled={isDeleting || isBulkDeleting}
                        className="text-center text-xl tracking-[0.4em] font-mono"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void submitTotpDelete();
                          }
                        }}
                        autoFocus
                      />
                      {totpError && (
                        <p className="text-sm text-destructive">{totpError}</p>
                      )}
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
                        onClick={() => {
                          cancelTotpDelete();
                          setShowTotpReset(true);
                        }}
                        disabled={isDeleting || isBulkDeleting}
                      >
                        <KeyRound className="h-3 w-3" />
                        Reset authenticator &amp; set up again
                      </button>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting || isBulkDeleting}
              onClick={cancelTotpDelete}
            >
              Cancel
            </AlertDialogCancel>
            {!totpNotSetUp && (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void submitTotpDelete();
                }}
                disabled={
                  isDeleting ||
                  isBulkDeleting ||
                  totpCode.replace(/\D/g, "").length < 6
                }
                className="bg-red-500 hover:bg-red-600"
              >
                {isDeleting || isBulkDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Verify & Delete"
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TotpSetupDialog
        open={showTotpSetup}
        purposeNote="After setup, you'll need this code every time you delete files or folders in Drive."
        onCancel={() => {
          setShowTotpSetup(false);
          if (!totpEnabled) {
            setItemToDelete(null);
            setDeleteMode(null);
          }
        }}
        onEnabled={async () => {
          setTotpEnabled(true);
          setShowTotpSetup(false);
          setTotpNotSetUp(false);
          setTotpCode("");
          setTotpError(null);
          if (deleteMode === "bulk" || (deleteMode === "single" && itemToDelete)) {
            setShowTotpDeleteDialog(true);
          } else if (itemToDelete && role === "admin") {
            setDeleteMode("single");
            setShowTotpDeleteDialog(true);
          }
        }}
      />

      <TotpResetDialog
        open={showTotpReset}
        onCancel={() => {
          setShowTotpReset(false);
          if (deleteMode === "bulk" || (deleteMode === "single" && itemToDelete)) {
            setShowTotpDeleteDialog(true);
          } else if (itemToDelete && role !== "admin") {
            setShowDeleteDialog(true);
          }
        }}
        onReset={async () => {
          setTotpEnabled(false);
          setShowTotpReset(false);
          setShowTotpSetup(true);
        }}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        shareLink={shareLink}
        onCopy={handleCopyLink}
        copied={copied}
      />

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Create New Folder
            </DialogTitle>
            <DialogDescription>
              Create a new folder in the current directory
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Folder Name</label>
              <Input
                placeholder="e.g., beach-shoot, product-photos"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreatingFolder) {
                    handleCreateFolder();
                  }
                }}
                disabled={isCreatingFolder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateFolderDialog(false);
                setNewFolderName('');
              }}
              disabled={isCreatingFolder}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={isCreatingFolder || !newFolderName.trim()}>
              {isCreatingFolder ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Folder'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename {itemToRename?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
            <DialogDescription>
              Enter a new name for &quot;{itemToRename?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Name</label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isRenaming) {
                    confirmRename();
                  }
                }}
                disabled={isRenaming}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRenameDialog(false);
                setItemToRename(null);
                setRenameValue('');
              }}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button onClick={confirmRename} disabled={isRenaming || !renameValue.trim()}>
              {isRenaming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Renaming...
                </>
              ) : (
                'Rename'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Storage Limit Modal */}
      {storageInfo && storageInfo.percentage !== undefined && (
        <StorageLimitModal
          open={showStorageLimitModal}
          onOpenChange={setShowStorageLimitModal}
          storageInfo={storageInfo}
          clientId={effectiveClientId || undefined}
        />
      )}

      {/* Meeting Notes Sheet — admin only, scoped to whichever client's folder is open */}
      <Sheet open={showMeetingNotesSheet} onOpenChange={setShowMeetingNotesSheet}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Meeting Notes{effectiveCompanyName ? ` — ${effectiveCompanyName}` : ''}</SheetTitle>
            <SheetDescription>
              Start this week's notes doc before your call, then send a copy to the client once it's done.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {effectiveClientId && <MeetingNotesPanel clientId={effectiveClientId} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Move To… Dialog */}
      <MoveToDialog
        open={!!moveDialogItems}
        onOpenChange={(open) => { if (!open) setMoveDialogItems(null); }}
        root={driveStructure}
        itemsToMove={moveDialogItems || []}
        currentParent={currentFolder}
        onConfirm={handleMoveConfirm}
        isSubmitting={isSubmittingMove}
      />

      {/* Main Content Area */}
      <div className="relative flex-1 flex flex-col min-w-0">
        {isMoving && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm pointer-events-none">
            <div className="flex items-center gap-2 bg-card border rounded-full px-4 py-2 shadow-md text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Moving…
            </div>
          </div>
        )}

        {isClientStorageLocked && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="mx-4 max-w-sm rounded-lg border bg-card p-5 text-center shadow-lg">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" />
              <h3 className="text-base font-semibold">Storage full</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Drive is locked until more storage is added.
              </p>
              <Button className="mt-4 w-full" onClick={() => setShowStorageLimitModal(true)}>
                Get more storage
              </Button>
            </div>
          </div>
        )}

        {/* Top Toolbar — sticky so the action row + breadcrumb stay in view
            while the file list underneath scrolls. Stuck to top:0 of
            whichever ancestor actually owns the scroll (this component's own
            ScrollArea when its h-screen layout is fully in effect, or the
            page/window when an outer shell ends up doing the scrolling) —
            sticky positioning resolves that automatically, so this doesn't
            depend on getting every parent's height/overflow chain right. */}
        <div className="border-b bg-card sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 flex-wrap">
            {/* Left: Upload Button */}
            {canUpload && !(role === 'client' && storageInfo?.isAtLimit) && (
              shouldShowRawFootageDialog ? (
                <RawFootageUploadDialog
                  clientId={effectiveClientId!}
                  companyName={effectiveCompanyName}
                  role={role}
                  onUploadComplete={() => {
                    const cid = effectiveClientId || browsingClientId;
                    setTimeout(() => loadDriveStructure(cid), 1000);
                    if (cid) {
                      fetch(`/api/clients/${cid}/storage`)
                        .then(res => res.json())
                        .then(setStorageInfo)
                        .catch(console.error);
                    }
                  }}
                  trigger={
                    <Button className="gap-2 shrink-0 h-10 px-4">
                      <Upload className="h-4 w-4" />
                      <span className="hidden sm:inline font-medium">Upload Raw Footage</span>
                    </Button>
                  }
                />
              ) : shouldShowElementsDialog ? (
                <RawFootageUploadDialog
                  clientId={effectiveClientId!}
                  companyName={effectiveCompanyName}
                  mode="elements"
                  onUploadComplete={() => {
                    const cid = effectiveClientId || browsingClientId;
                    setTimeout(() => loadDriveStructure(cid), 1000);
                  }}
                  trigger={
                    <Button className="gap-2 shrink-0 h-10 px-4">
                      <Upload className="h-4 w-4" />
                      <span className="hidden sm:inline font-medium">Upload to Elements</span>
                    </Button>
                  }
                />
              ) : (
                <FileUploadDialog
                  folderType="drive"
                  subfolder={getCurrentFolderS3Path()}
                  onUploadComplete={() => {
                    const cid = effectiveClientId || browsingClientId;
                    setTimeout(() => loadDriveStructure(cid), 1000);
                  }}
                  trigger={
                    <Button className="gap-2 shrink-0 h-10 px-4">
                      <Upload className="h-4 w-4" />
                      <span className="hidden sm:inline font-medium">Upload</span>
                    </Button>
                  }
                />
              )
            )}

            {/* Storage Full button */}
            {role === 'client' && storageInfo?.isAtLimit && isInRawFootage && (
              <Button
                className="gap-2 shrink-0 h-10 px-4"
                variant="destructive"
                onClick={() => setShowStorageLimitModal(true)}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Storage Full - Upgrade</span>
              </Button>
            )}

            {/* New Folder Button */}
            {isClientInDeliverableFolder && (
              <Button
                variant="outline"
                className="gap-2 shrink-0 h-10 px-4"
                onClick={() => setShowCreateFolderDialog(true)}
              >
                <Folder className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">New Folder</span>
              </Button>
            )}

            {/* Authenticator setup / reset — required for staff deletes */}
            {requiresDeleteTotp && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 shrink-0 h-10 px-4">
                    <Smartphone className="h-4 w-4" />
                    <span className="hidden sm:inline font-medium">Authenticator</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={async () => {
                      const enabled = await fetchTotpEnabled();
                      setTotpEnabled(enabled);
                      if (enabled) {
                        toast.message("Authenticator is already set up. Use Reset to replace it.");
                        setShowTotpReset(true);
                      } else {
                        setShowTotpSetup(true);
                      }
                    }}
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Set up / scan QR
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      const enabled = await fetchTotpEnabled();
                      setTotpEnabled(enabled);
                      if (!enabled) {
                        toast.message("No authenticator set up yet");
                        setShowTotpSetup(true);
                        return;
                      }
                      setShowTotpReset(true);
                    }}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    Reset &amp; add again
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Meeting Notes Button — admin only, shown once we're inside a specific client's folder */}
            {role === 'admin' && effectiveClientId && (
              <Button
                variant="outline"
                className="gap-2 shrink-0 h-10 px-4"
                onClick={() => setShowMeetingNotesSheet(true)}
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Meeting Notes</span>
              </Button>
            )}

            {/* Add External Link Button */}
            {isInRawFootage && canAddFootageLinks && (
              <Button
                variant="outline"
                className="gap-2 shrink-0 h-10 px-4"
                onClick={() => { setShowAddLinkInput(true); }}
              >
                <LinkIcon className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Add Link</span>
              </Button>
            )}

            {/* ─── Admin/Manager: Client Selector ─── */}
            {(role === 'admin' || role === 'manager' || role === 'scheduler' || role === 'videographer') && adminClientList.length > 0 && (
              <Select value={adminSelectedClientId} onValueChange={setAdminSelectedClientId}>
                <SelectTrigger className="w-[200px] h-10 shrink-0">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {adminClientList.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* ─── Editor: Client Selector (only when assigned to multiple clients) ─── */}
            {role === 'editor' && editorClientList.length > 1 && (
              <Select value={editorSelectedClientId} onValueChange={setEditorSelectedClientId}>
                <SelectTrigger className="w-[200px] h-10 shrink-0">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {editorClientList.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* ─── FEATURE 1: Deliverable Type Filter Dropdown ─── */}
            {deliverableTypes.length > 0 && (
              // Show when: at company root (seeing outputs folder), OR inside outputs at depth 0-1
              (currentFolder?.children?.some(c => c.name === 'outputs') || (isInOutputs && depthFromOutputs < 2))
            ) && (
              <Select
                value={selectedDeliverableFilter}
                onValueChange={setSelectedDeliverableFilter}
              >
                <SelectTrigger className="w-[180px] h-10 shrink-0">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {deliverableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {SHORT_CODE_LABELS[type] || type} ({type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* ─── Editor Assignment picker ───────────────────────────────
                Pick an editor here, then tick files (Select mode) and hit
                "Assign" in the selection action bar — same pattern as the
                existing bulk Move/Delete flow. The trigger itself is
                colored once an editor is picked so it's obvious who the
                next click will assign to. */}
            {canManageEditorAssignments && effectiveClientId && editorRoster.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 shrink-0 h-10 px-3 font-semibold"
                    style={activeAssignEditor ? {
                      backgroundColor: activeAssignEditor.color.bg,
                      borderColor: activeAssignEditor.color.border,
                      color: activeAssignEditor.color.border,
                    } : undefined}
                  >
                    <UserRound className="h-4 w-4" />
                    <span>{activeAssignEditor ? activeAssignEditor.name : 'Assign editor'}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {editorRoster.map((editor) => (
                    <DropdownMenuItem
                      key={editor.id}
                      onClick={() => { setActiveAssignEditorId(editor.id); if (!isSelectionMode) setIsSelectionMode(true); }}
                      className="gap-2"
                    >
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: editor.color.chip }}
                      />
                      <span className="font-medium">{editor.name}</span>
                    </DropdownMenuItem>
                  ))}
                  {activeAssignEditorId !== null && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setActiveAssignEditorId(null)}>
                        Clear selection
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* ─── FEATURE 3: Global Search Bar ─── */}
            <div className="flex-1 max-w-2xl mx-auto relative">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder="Search across all folders..."
                  className="pl-10 bg-secondary/30 h-10 border-transparent focus-visible:ring-1 focus-visible:ring-primary/20 transition-all rounded-full"
                  value={globalSearchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onFocus={() => {
                    // Re-show results if we have them
                    if (globalSearchResults.length > 0 && globalSearchQuery.length >= 2) {
                      setShowGlobalResults(true);
                    }
                  }}
                />
                {globalSearchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => {
                      setGlobalSearchQuery("");
                      setSearchQuery("");
                      setGlobalSearchResults([]);
                      setShowGlobalResults(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* ─── FEATURE 3: Search Results Dropdown ─── */}
              {showGlobalResults && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
                  {isGlobalSearching ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching all folders...
                    </div>
                  ) : globalSearchResults.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No files found matching &quot;{globalSearchQuery}&quot;
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
                        {globalSearchResults.length} result{globalSearchResults.length !== 1 ? 's' : ''} found across all folders
                      </div>
                      {globalSearchResults.map((result, idx) => (
                        <div
                          key={`${result.s3Key}-${idx}`}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent cursor-pointer transition-colors border-b last:border-b-0"
                          onClick={() => navigateToSearchResult(result)}
                        >
                          <div className="flex-shrink-0 scale-75">
                            {getFileIcon(result.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{result.name}</p>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                              <FolderOpen className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">
                                {result.breadcrumbParts.map(formatFolderDisplayName).join(' / ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {result.size && (
                              <span className="text-[11px] text-muted-foreground">
                                {formatBytes(result.size)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right: Download All, Select, View toggle, Refresh */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">

              {/* Zip progress indicator */}
              {isZipping && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="hidden sm:inline">{zipProgress || 'Preparing downloads…'}</span>
                </div>
              )}

              {/* Selection mode active: show count + actions */}
              {isSelectionMode && checkedItems.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {checkedItems.size} selected
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1.5 h-9"
                    onClick={handleDownloadSelected}
                    disabled={isZipping}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Download</span>
                    <span className="sm:hidden">{checkedItems.size}</span>
                  </Button>
                  {canManageEditorAssignments && activeAssignEditor && (
                    <Button
                      size="sm"
                      className="gap-1.5 h-9 border"
                      style={{
                        backgroundColor: activeAssignEditor.color.bg,
                        borderColor: activeAssignEditor.color.border,
                        color: activeAssignEditor.color.border,
                      }}
                      onClick={assignCheckedToActiveEditor}
                      disabled={isAssigning}
                    >
                      <UserRound className="h-3.5 w-3.5" />
                      <span>{isAssigning ? 'Assigning…' : `Assign to ${activeAssignEditor.name}`}</span>
                    </Button>
                  )}
                  {canManageEditorAssignments && !activeAssignEditor && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-9"
                      onClick={unassignChecked}
                      disabled={isAssigning}
                      title="Clear any editor assignment on the selected files"
                    >
                      <UserRound className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Unassign</span>
                    </Button>
                  )}
                  {role !== 'client' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-9"
                      onClick={() => {
                        const items = filteredItems.filter(i => checkedItems.has(i.s3Key || getS3Key(i)));
                        openMoveDialog(items);
                      }}
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Move</span>
                    </Button>
                  )}
                  {role === 'admin' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5 h-9"
                      onClick={handleBulkDeleteClick}
                      disabled={isZipping || isBulkDeleting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-9 px-2" onClick={clearChecked}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Download All button */}
              {filteredItems.some(i => i.type === 'file') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9 shrink-0"
                  onClick={handleDownloadAll}
                  disabled={isZipping}
                >
                  <FolderDown className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download All</span>
                </Button>
              )}

              {/* Select mode toggle */}
              <Button
                variant={isSelectionMode ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 h-9 shrink-0"
                onClick={() => { setIsSelectionMode(s => !s); if (isSelectionMode) clearChecked(); }}
              >
                {isSelectionMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isSelectionMode ? 'Done' : 'Select'}</span>
              </Button>

              {/* Select All (shown only in selection mode) */}
              {isSelectionMode && (
                <Button size="sm" variant="ghost" className="h-9 px-2 text-xs" onClick={selectAllFiles}>
                  All
                </Button>
              )}

              {/* View mode toggle */}
              <div className="flex items-center border rounded-md h-9 p-0.5 shrink-0">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => toggleViewMode("grid")}
                  title="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => toggleViewMode("list")}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-secondary/50 rounded-full"
                onClick={loadDriveStructure}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="px-3 sm:px-4 pb-2 sm:pb-3 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm overflow-x-auto">
            {breadcrumb.map((folder, index) => (
              <div key={folder.path} className="flex items-center gap-2">
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateToFolder(folder)}
                  className={cn(
                    "h-7 px-2",
                    index === breadcrumb.length - 1 && "font-semibold"
                  )}
                >
                  {formatFolderDisplayName(folder.name)}
                </Button>
              </div>
            ))}

            {/* ─── FEATURE 1: Active filter badge ─── */}
            {selectedDeliverableFilter !== "all" && (
              <div className="flex items-center gap-1 ml-2">
                <span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {SHORT_CODE_LABELS[selectedDeliverableFilter] || selectedDeliverableFilter} ({selectedDeliverableFilter})
                  <button
                    onClick={() => setSelectedDeliverableFilter("all")}
                    className="ml-1 hover:text-blue-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Files Area */}
        <ScrollArea className="flex-1">
          <div className="p-3 sm:p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">
                <p className="font-medium">Error loading files</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* ── External Footage Links — shown inside raw-footage folders ── */}
            {isInRawFootage && (footageLinks.length > 0 || canAddFootageLinks) && (
              <div className="mb-5 border rounded-xl bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/40">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">External Links</span>
                    {footageLinks.length > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">{footageLinks.length}</span>
                    )}
                  </div>
                  {canAddFootageLinks && !showAddLinkInput && (
                    <button
                      onClick={() => setShowAddLinkInput(true)}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      <span className="text-base leading-none">+</span> Add Link
                    </button>
                  )}
                </div>

                {/* Add link input */}
                {showAddLinkInput && (
                  <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2">
                    <Input
                      autoFocus
                      placeholder="Paste Google Drive, Dropbox, Frame.io link..."
                      value={newLinkUrl}
                      onChange={e => setNewLinkUrl(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddFootageLink();
                        if (e.key === 'Escape') { setShowAddLinkInput(false); setNewLinkUrl(''); }
                      }}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs px-3"
                      disabled={!newLinkUrl.trim() || addingLink}
                      onClick={handleAddFootageLink}
                    >
                      {addingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs px-2"
                      onClick={() => { setShowAddLinkInput(false); setNewLinkUrl(''); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {/* Links list */}
                {loadingLinks ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading links...
                  </div>
                ) : footageLinks.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-muted-foreground">
                    No external links yet. {canAddFootageLinks ? 'Click "+ Add Link" to attach a Google Drive, Dropbox, or Frame.io link.' : ''}
                  </div>
                ) : (
                  <div className="divide-y">
                    {footageLinks.map(link => (
                      <div key={link.id} className="flex items-center gap-3 px-4 py-2.5 group hover:bg-muted/30 transition-colors">
                        <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline truncate block font-medium"
                          >
                            {link.label || link.url}
                          </a>
                          {link.label && (
                            <p className="text-[10px] text-muted-foreground truncate">{link.url}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Added by {link.addedByName} · {new Date(link.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        {canAddFootageLinks && (
                          <button
                            onClick={() => handleDeleteFootageLink(link.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"
                            title="Remove link"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                <Folder className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">
                  {searchQuery
                    ? "No files found"
                    : selectedDeliverableFilter !== "all"
                      ? `No ${selectedDeliverableFilter} folders here`
                      : "This folder is empty"}
                </p>
                <p className="text-sm mb-4">
                  {searchQuery
                    ? "Try a different search term"
                    : selectedDeliverableFilter !== "all"
                      ? "Try clearing the filter"
                      : "Upload files to get started"}
                </p>
                {/* {!searchQuery && selectedDeliverableFilter === "all" && canUpload && (
                  <FileUploadDialog
                    folderType="drive"
                    subfolder={getCurrentFolderS3Path()}
                    onUploadComplete={() => {
                      setTimeout(loadDriveStructure, 1000);
                    }}
                    trigger={
                      <Button>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload files
                      </Button>
                    }
                  />
                )} */}
              </div>
            ) : (
              viewMode === "grid" ? (
              // Grid View
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.path}
                    draggable={role !== 'client'}
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragEnd={handleDragEnd}
                    onDragOver={item.type === 'folder' ? (e) => handleDragOver(e, item) : undefined}
                    onDragLeave={item.type === 'folder' ? handleDragLeave : undefined}
                    onDrop={item.type === 'folder' ? (e) => handleDrop(e, item) : undefined}
                    className={cn(
                      "group relative border rounded-lg p-2 sm:p-4 cursor-pointer hover:bg-accent transition-colors",
                      selectedItems.has(item.path) && "bg-accent border-primary",
                      checkedItems.has(item.s3Key || getS3Key(item)) && "ring-2 ring-primary bg-primary/5",
                      draggedItem?.path === item.path && "opacity-40 scale-95",
                      dragOverTarget === item.path && item.type === 'folder' && "ring-2 ring-blue-400 bg-blue-50/60",
                    )}
                    style={getAssignmentFor(item) ? {
                      backgroundColor: getAssignmentFor(item)!.color.bg,
                      borderColor: getAssignmentFor(item)!.color.border,
                    } : undefined}
                    onClick={() => isSelectionMode ? toggleChecked(item, { stopPropagation: () => {} } as any) : handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                  >
                    {/* Editor Assignment badge */}
                    {getAssignmentFor(item) && (
                      <div
                        className="absolute top-2 right-2 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold text-white truncate max-w-[70%]"
                        style={{ backgroundColor: getAssignmentFor(item)!.color.chip }}
                        title={`Assigned to ${getAssignmentFor(item)!.editorName}`}
                      >
                        {getAssignmentFor(item)!.editorName.split(' ')[0]}
                      </div>
                    )}
                    {/* Selection checkbox */}
                    {(isSelectionMode || checkedItems.has(item.s3Key || getS3Key(item))) && (
                      <div
                        className="absolute top-2 left-2 z-10"
                        onClick={(e) => toggleChecked(item, e)}
                      >
                        {checkedItems.has(item.s3Key || getS3Key(item))
                          ? <CheckSquare className="h-4 w-4 text-primary" />
                          : <Square className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    )}

                    <div className="flex flex-col items-center text-center">
                      {item.type === "folder" ? (
                        <Folder
                          className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mb-1 sm:mb-2"
                          style={getFolderStatusOutlineStyle(item)}
                        />
                      ) : (
                        <div className="mb-1 sm:mb-2 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-md overflow-hidden bg-muted/40">
                          <FileThumbnail
                            thumbnailUrl={item.thumbnailUrl}
                            className="w-full h-full object-cover"
                            fallback={
                              <div className="scale-75 sm:scale-100">
                                {getFileIcon(item.name)}
                              </div>
                            }
                          />
                        </div>
                      )}

                      <p className="text-xs sm:text-sm font-medium truncate w-full px-1">
                        {item.type === "folder" ? formatFolderDisplayName(item.name) : item.name}
                      </p>

                      {getDownloadsFor(item) && getDownloadsFor(item)!.length > 0 && (
                        <span
                          className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 max-w-full truncate"
                          title={downloadBadgeTitle(getDownloadsFor(item)!)}
                        >
                          <Download className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{downloadBadgeLabel(getDownloadsFor(item)!)}</span>
                        </span>
                      )}

                      {item.isLinkedScript && (
                        <span className="mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700">
                          Script · download only
                        </span>
                      )}

                      {item.type === "folder" && rawFootageBadge(item.name) && (
                        <span className={cn(
                          "mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                          rawFootageFolders[item.name]?.shootDates.length ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700",
                        )}>
                          {rawFootageBadge(item.name)}
                        </span>
                      )}

                      {item.type === "file" && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                          {item.size && formatBytes(item.size)}
                        </p>
                      )}
                    </div>

                    {/* Notes */}
                    {canSeeDriveNotes && effectiveClientId && (
                      <div className="absolute top-2 right-10">
                        <DriveNotesPopover
                          clientId={effectiveClientId}
                          s3Key={item.s3Key || getS3Key(item)}
                          isFolder={item.type === 'folder'}
                          itemName={item.type === 'folder' ? formatFolderDisplayName(item.name) : item.name}
                          canCreate={canCreateDriveNotes}
                          notes={driveNotes[item.s3Key || getS3Key(item)] || []}
                          onNotesChange={handleDriveNotesChange}
                        />
                      </div>
                    )}

                    {/* Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {item.type === "folder" && (
                          <>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); handleDownloadFolder(item); }}
                              disabled={isZipping}
                            >
                              <FolderDown className="h-4 w-4 mr-2" />
                              Download folder
                            </DropdownMenuItem>
                            {isInsideRawFootage(item) && (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); updateFolderStatus(item, "IN_PROGRESS"); }}
                                  disabled={!effectiveClientId}
                                  title={!effectiveClientId ? "Client not identified for this folder yet" : undefined}
                                >
                                  <span className="h-3 w-3 mr-2 rounded-full border-2 border-orange-500 inline-block shrink-0" />
                                  Mark In Progress
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); updateFolderStatus(item, "COMPLETED"); }}
                                  disabled={!effectiveClientId}
                                  title={!effectiveClientId ? "Client not identified for this folder yet" : undefined}
                                >
                                  <span className="h-3 w-3 mr-2 rounded-full border-2 border-green-500 inline-block shrink-0" />
                                  Mark Completed
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); updateFolderStatus(item, null); }}
                                  disabled={!effectiveClientId}
                                  title={!effectiveClientId ? "Client not identified for this folder yet" : undefined}
                                >
                                  <span className="h-3 w-3 mr-2 rounded-full border-2 border-muted-foreground inline-block shrink-0" />
                                  Clear Status
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {item.type === "file" && item.url && (
                          <>
                            <DropdownMenuItem
                              onClick={() => window.open(item.url, "_blank")}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadClick(item);
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChecked(item, e);
                            if (!isSelectionMode) setIsSelectionMode(true);
                          }}
                        >
                          <CheckSquare className="h-4 w-4 mr-2" />
                          {checkedItems.has(item.s3Key || getS3Key(item)) ? 'Deselect' : 'Select'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareClick(item);
                          }}
                          disabled={isSharing}
                        >
                          {isSharing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Share2 className="h-4 w-4 mr-2" />
                          )}
                          Copy shareable link
                        </DropdownMenuItem>
                        {role !== 'client' && !item.isLinkedScript && (
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); openMoveDialog([item]); }}
                          >
                            <FolderInput className="h-4 w-4 mr-2" />
                            Move to...
                          </DropdownMenuItem>
                        )}
                        {isClientInDeliverableFolder && item.type === "folder" && !item.isLinkedScript && (
                          <DropdownMenuItem
                            onClick={() => handleRenameClick(item)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                        )}
                        {clientCanModify && !item.isLinkedScript && (
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(item)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
              ) : (
              // List View
              <div className="border rounded-lg overflow-hidden">
                <div className="hidden sm:flex items-center gap-3 px-3 py-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
                  <div className="w-5 shrink-0" />
                  <div className="w-6 shrink-0" />
                  <div className="flex-1">Name</div>
                  <div className="w-24 text-right shrink-0">Size</div>
                  <div className="w-32 text-right shrink-0">Modified</div>
                  <div className="w-8 shrink-0" />
                </div>
                <div className="divide-y">
                  {filteredItems.map((item) => (
                    <div
                      key={item.path}
                      draggable={role !== 'client'}
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onDragOver={item.type === 'folder' ? (e) => handleDragOver(e, item) : undefined}
                      onDragLeave={item.type === 'folder' ? handleDragLeave : undefined}
                      onDrop={item.type === 'folder' ? (e) => handleDrop(e, item) : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors",
                        selectedItems.has(item.path) && "bg-accent",
                        checkedItems.has(item.s3Key || getS3Key(item)) && "ring-1 ring-inset ring-primary bg-primary/5",
                        draggedItem?.path === item.path && "opacity-40",
                        dragOverTarget === item.path && item.type === 'folder' && "ring-2 ring-blue-400 bg-blue-50/60",
                      )}
                      style={getAssignmentFor(item) ? { backgroundColor: getAssignmentFor(item)!.color.bg } : undefined}
                      onClick={() => isSelectionMode ? toggleChecked(item, { stopPropagation: () => {} } as any) : handleItemClick(item)}
                      onDoubleClick={() => handleItemDoubleClick(item)}
                    >
                      {/* Selection checkbox */}
                      <div className="w-5 shrink-0 flex items-center justify-center">
                        {(isSelectionMode || checkedItems.has(item.s3Key || getS3Key(item))) && (
                          <div onClick={(e) => toggleChecked(item, e)}>
                            {checkedItems.has(item.s3Key || getS3Key(item))
                              ? <CheckSquare className="h-4 w-4 text-primary" />
                              : <Square className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        )}
                      </div>

                      {/* Editor Assignment dot */}
                      {getAssignmentFor(item) && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: getAssignmentFor(item)!.color.chip }}
                          title={`Assigned to ${getAssignmentFor(item)!.editorName}`}
                        />
                      )}

                      {/* Icon */}
                      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                        {item.type === "folder" ? (
                          <Folder
                            className="h-5 w-5 text-blue-500"
                            style={getFolderStatusOutlineStyle(item)}
                          />
                        ) : (
                          <div className="w-8 h-8 flex items-center justify-center rounded overflow-hidden bg-muted/40">
                            <FileThumbnail
                              thumbnailUrl={item.thumbnailUrl}
                              className="w-full h-full object-cover"
                              fallback={<div className="scale-90">{getFileIcon(item.name)}</div>}
                            />
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.type === "folder" ? formatFolderDisplayName(item.name) : item.name}</p>
                          {getDownloadsFor(item) && getDownloadsFor(item)!.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 max-w-full truncate"
                              title={downloadBadgeTitle(getDownloadsFor(item)!)}
                            >
                              <Download className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{downloadBadgeLabel(getDownloadsFor(item)!)}</span>
                            </span>
                          )}
                          {item.type === "folder" && rawFootageBadge(item.name) && (
                            <span className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                              rawFootageFolders[item.name]?.shootDates.length ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700",
                            )}>
                              {rawFootageBadge(item.name)}
                            </span>
                          )}
                          {/* Size shown inline on mobile since the column is hidden */}
                          {item.type === "file" && (
                            <p className="text-[11px] text-muted-foreground sm:hidden">
                              {item.size && formatBytes(item.size)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Size */}
                      <div className="hidden sm:block w-24 text-right text-xs text-muted-foreground shrink-0">
                        {item.type === "file" && item.size ? formatBytes(item.size) : "—"}
                      </div>

                      {/* Modified */}
                      <div className="hidden sm:block w-32 text-right text-xs text-muted-foreground shrink-0">
                        {item.lastModified
                          ? new Date(item.lastModified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : "—"}
                      </div>

                      {/* Notes */}
                      {canSeeDriveNotes && effectiveClientId && (
                        <div className="w-8 shrink-0 flex items-center justify-center">
                          <DriveNotesPopover
                            clientId={effectiveClientId}
                            s3Key={item.s3Key || getS3Key(item)}
                            isFolder={item.type === 'folder'}
                            itemName={item.type === 'folder' ? formatFolderDisplayName(item.name) : item.name}
                            canCreate={canCreateDriveNotes}
                            notes={driveNotes[item.s3Key || getS3Key(item)] || []}
                            onNotesChange={handleDriveNotesChange}
                          />
                        </div>
                      )}

                      {/* Actions Menu */}
                      <div className="w-8 shrink-0 flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.type === "folder" && (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); handleDownloadFolder(item); }}
                                  disabled={isZipping}
                                >
                                  <FolderDown className="h-4 w-4 mr-2" />
                                  Download folder
                                </DropdownMenuItem>
                                {isInsideRawFootage(item) && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={(e) => { e.stopPropagation(); updateFolderStatus(item, "IN_PROGRESS"); }}
                                      disabled={!effectiveClientId}
                                      title={!effectiveClientId ? "Client not identified for this folder yet" : undefined}
                                    >
                                      <span className="h-3 w-3 mr-2 rounded-full border-2 border-orange-500 inline-block shrink-0" />
                                      Mark In Progress
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => { e.stopPropagation(); updateFolderStatus(item, "COMPLETED"); }}
                                      disabled={!effectiveClientId}
                                      title={!effectiveClientId ? "Client not identified for this folder yet" : undefined}
                                    >
                                      <span className="h-3 w-3 mr-2 rounded-full border-2 border-green-500 inline-block shrink-0" />
                                      Mark Completed
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => { e.stopPropagation(); updateFolderStatus(item, null); }}
                                      disabled={!effectiveClientId}
                                      title={!effectiveClientId ? "Client not identified for this folder yet" : undefined}
                                    >
                                      <span className="h-3 w-3 mr-2 rounded-full border-2 border-muted-foreground inline-block shrink-0" />
                                      Clear Status
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {item.type === "file" && item.url && (
                              <>
                                <DropdownMenuItem onClick={() => window.open(item.url, "_blank")}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Open
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); handleDownloadClick(item); }}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleChecked(item, e);
                                if (!isSelectionMode) setIsSelectionMode(true);
                              }}
                            >
                              <CheckSquare className="h-4 w-4 mr-2" />
                              {checkedItems.has(item.s3Key || getS3Key(item)) ? 'Deselect' : 'Select'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); handleShareClick(item); }}
                              disabled={isSharing}
                            >
                              {isSharing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Share2 className="h-4 w-4 mr-2" />
                              )}
                              Copy shareable link
                            </DropdownMenuItem>
                            {role !== 'client' && !item.isLinkedScript && (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); openMoveDialog([item]); }}
                              >
                                <FolderInput className="h-4 w-4 mr-2" />
                                Move to...
                              </DropdownMenuItem>
                            )}
                            {isClientInDeliverableFolder && item.type === "folder" && !item.isLinkedScript && (
                              <DropdownMenuItem onClick={() => handleRenameClick(item)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                            )}
                            {clientCanModify && !item.isLinkedScript && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(item)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )
            )}
          </div>
        </ScrollArea>
      </div>
    </div>

      {/* ─── Download Job Modal ────────────────────────────────────────────── */}
      <Dialog open={showDownloadModal} onOpenChange={(open) => {
        if (!open) stopZipPolling();
        setShowDownloadModal(open);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {zipJob?.zipName || 'Download'}
            </DialogTitle>
            <DialogDescription>
              {!zipJob || zipJob.status === 'queued'
                ? 'Starting up…'
                : zipJob.status === 'processing'
                  ? zipJob.totalFiles > 0
                    ? `Zipping… ${zipJob.processedFiles}/${zipJob.totalFiles} files (${formatBytes(zipJob.processedBytes)} / ${formatBytes(zipJob.totalBytes)})`
                    : 'Listing files…'
                  : zipJob.status === 'done'
                    ? 'Download ready — it should start automatically.'
                    : `Failed: ${zipJob.error || 'Unknown error'}`}
            </DialogDescription>
          </DialogHeader>

          {zipJob?.status === 'processing' && zipJob.totalBytes > 0 && (
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, (zipJob.processedBytes / zipJob.totalBytes) * 100)}%` }}
              />
            </div>
          )}

          {(!zipJob || zipJob.status === 'queued' || zipJob.status === 'processing') && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              This can take a while for large folders — feel free to close this and check back later.
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { stopZipPolling(); setShowDownloadModal(false); }}>
              Close
            </Button>
            {zipJob?.status === 'done' && zipJob.downloadUrl && (
              <Button onClick={() => triggerSingleDownload(zipJob.downloadUrl!, zipJob.zipName)}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download again
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}