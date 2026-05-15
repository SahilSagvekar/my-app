// src/components/drive/DriveExplorer.tsx

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Grid3x3,
  List,
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
} from "lucide-react";
import { ShareDialog } from "../review/ShareDialog";
import { FileUploadDialog } from "../workflow/FileUploadDialog-Resumable";
import { RawFootageUploadDialog } from "./RawFootageUploadDialog";
import { StorageLimitModal } from "../Storagelimitmodal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/AuthContext";
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
import { cn } from "@/lib/utils";
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
  lastModified?: string;
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

type ViewMode = "grid" | "list";

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
  const [driveStructure, setDriveStructure] = useState<DriveItem | null>(null);
  const [currentFolder, setCurrentFolder] = useState<DriveItem | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<DriveItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Delete states
  const [itemToDelete, setItemToDelete] = useState<DriveItem | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Multi-select & bulk download state ───────────────────────────────────
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<string>('');

  // Share states
  const [shareLink, setShareLink] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Folder creation states
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
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

  // ─── FEATURE 1: Deliverable Type Filter ───
  const [deliverableTypes, setDeliverableTypes] = useState<string[]>([]);
  const [selectedDeliverableFilter, setSelectedDeliverableFilter] = useState<string>("all");

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

  // ─── Admin browsing context: resolve clientId from company name ───
  const [browsingClientId, setBrowsingClientId] = useState<string | null>(null);
  const [browsingCompanyName, setBrowsingCompanyName] = useState<string>("");

  // Use linkedClientId when present, otherwise resolve from the visible company folder.
  const effectiveClientId = role === 'client' ? (user?.linkedClientId || browsingClientId) : browsingClientId;
  const effectiveCompanyName = role === 'client'
    ? (browsingCompanyName || breadcrumb[0]?.name || '')
    : browsingCompanyName;

  // Resolve the client record from the visible company folder. Client users can
  // be linked by email/user relation instead of linkedClientId.
  useEffect(() => {
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
  }, [breadcrumb, browsingCompanyName]);

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
          const knownCodes = ['SF', 'LF', 'SQF', 'THUMB', 'HP', 'SEP', 'BSF', 'T'];
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

  // ─── Resolve clientId for admin when browsing inside a company folder ───
  useEffect(() => {
    if (role === 'client') return; // Client already has linkedClientId

    // For admin: breadcrumb[0] is "Root", breadcrumb[1] is the company name
    // For other non-client roles with company as root, breadcrumb[0] is company
    const companyFolder = breadcrumb.length >= 2 ? breadcrumb[1]?.name : breadcrumb[0]?.name;

    if (!companyFolder || companyFolder === 'Root') {
      setBrowsingClientId(null);
      setBrowsingCompanyName('');
      return;
    }

    // Don't re-fetch if same company
    if (companyFolder === browsingCompanyName) return;

    setBrowsingCompanyName(companyFolder);
    fetch(`/api/drive/client-lookup?companyName=${encodeURIComponent(companyFolder)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.clientId) {
          setBrowsingClientId(data.clientId);
        } else {
          setBrowsingClientId(null);
        }
      })
      .catch(() => setBrowsingClientId(null));
  }, [role, breadcrumb, browsingCompanyName]);

  useEffect(() => {
    if (user) {
      loadDriveStructure();
    }
  }, [user]);

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

  const loadDriveStructure = async () => {
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

      const response = await fetch(`/api/drive/structure?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load drive structure");
      }

      const data = await response.json();
      setDriveStructure(data);

      // ─── FEATURE 2: Restore navigation path after structure load ───
      if (pathToRestore) {
        navigateToPathInTree(data, pathToRestore);
      } else {
        setCurrentFolder(data);
        setBreadcrumb([data]);
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

  const shouldShowRawFootageDialog =
    !!effectiveClientId &&
    isInRawFootage &&
    depthFromRawFootage >= 0 &&
    depthFromRawFootage <= 2;

  const isClientInDeliverableFolder =
    isInRawFootage &&
    depthFromRawFootage >= 2;

  const canUpload = role !== 'client' || isClientInDeliverableFolder;
  const isClientStorageLocked = role === 'client' && !!storageInfo?.isAtLimit;

  // Clients can only modify (delete/rename) items when inside a deliverable folder (depth 2+ from raw-footage)
  const clientCanModify = role !== 'client' || isClientInDeliverableFolder;

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

  // Handle Delete Click
  const handleDeleteClick = (item: DriveItem) => {
    setItemToDelete(item);
    setShowDeleteDialog(true);
  };

  // ─── Confirm Delete — reload structure, path auto-preserved ───
  const confirmDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);

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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Delete failed");
      }

      toast.success(`${itemToDelete.name} deleted successfully`);

      // Close dialog first
      setShowDeleteDialog(false);
      setItemToDelete(null);
      setIsDeleting(false);

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

      const response = await fetch("/api/drive/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          s3Key: isFolder ? s3Key + '/' : s3Key,
          fileName: item.name,
          fileSize: item.size,
          mimeType: !isFolder && item.url ? (await fetch(item.url, { method: 'HEAD' })).headers.get('content-type') : null,
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

  // ─── Zip download helpers ─────────────────────────────────────────────────

  const triggerZipDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleDownloadFolder = async (item: DriveItem) => {
    const s3Key = item.s3Key || getS3Key(item);
    const folderPrefix = s3Key.endsWith('/') ? s3Key : `${s3Key}/`;
    setIsZipping(true);
    setZipProgress(`Preparing "${item.name}"…`);
    try {
      const res = await fetch('/api/drive/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPrefix, zipName: `${item.name}.zip` }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      triggerZipDownload(await res.blob(), `${item.name}.zip`);
      toast.success(`Downloaded "${item.name}.zip"`);
    } catch (err: any) {
      toast.error(err.message || 'Zip failed');
    } finally { setIsZipping(false); setZipProgress(''); }
  };

  const handleDownloadAll = async () => {
    const currentPrefix = getCurrentFolderS3Path();
    const folderName = breadcrumb[breadcrumb.length - 1]?.name || 'download';
    setIsZipping(true);
    setZipProgress(`Zipping "${folderName}"…`);
    try {
      const res = await fetch('/api/drive/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPrefix: currentPrefix, zipName: `${folderName}.zip` }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      triggerZipDownload(await res.blob(), `${folderName}.zip`);
      toast.success(`Downloaded "${folderName}.zip"`);
    } catch (err: any) {
      toast.error(err.message || 'Zip failed');
    } finally { setIsZipping(false); setZipProgress(''); }
  };

  const handleDownloadSelected = async () => {
    const keys = Array.from(checkedItems);
    if (keys.length === 0) return;
    setIsZipping(true);
    setZipProgress(`Zipping ${keys.length} item${keys.length !== 1 ? 's' : ''}…`);
    try {
      const fileKeys: string[] = [];
      for (const key of keys) {
        const item = filteredItems.find(i => (i.s3Key || getS3Key(i)) === key);
        if (item?.type === 'folder') {
          const res = await fetch('/api/drive/download-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPrefix: key.endsWith('/') ? key : `${key}/`, zipName: `${item.name}.zip` }),
          });
          if (res.ok) triggerZipDownload(await res.blob(), `${item.name}.zip`);
        } else {
          fileKeys.push(key);
        }
      }
      if (fileKeys.length > 0) {
        const res = await fetch('/api/drive/download-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: fileKeys, zipName: 'selected-files.zip' }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
        triggerZipDownload(await res.blob(), 'selected-files.zip');
      }
      toast.success('Download started');
      setCheckedItems(new Set());
      setIsSelectionMode(false);
    } catch (err: any) {
      toast.error(err.message || 'Zip failed');
    } finally { setIsZipping(false); setZipProgress(''); }
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
    let items = currentFolder?.children || [];

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
    <div className="flex flex-col sm:flex-row h-screen bg-background">

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete {itemToDelete?.type === "folder" ? "folder" : "file"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{itemToDelete?.name}</strong>?
              {itemToDelete?.type === "folder" && (
                <span className="block mt-2 text-red-600">
                  This will delete the folder and all its contents permanently.
                </span>
              )}
              <span className="block mt-2">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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

      {/* Main Content Area */}
      <div className="relative flex-1 flex flex-col min-w-0">
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

        {/* Top Toolbar */}
        <div className="border-b bg-card">
          <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 flex-wrap">
            {/* Left: Upload Button */}
            {canUpload && !(role === 'client' && storageInfo?.isAtLimit) && (
              shouldShowRawFootageDialog ? (
                <RawFootageUploadDialog
                  clientId={effectiveClientId!}
                  companyName={effectiveCompanyName}
                  onUploadComplete={() => {
                    setTimeout(loadDriveStructure, 1000);
                    if (effectiveClientId) {
                      fetch(`/api/clients/${effectiveClientId}/storage`)
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
              ) : (
                <FileUploadDialog
                  folderType="drive"
                  subfolder={getCurrentFolderS3Path()}
                  onUploadComplete={() => {
                    setTimeout(loadDriveStructure, 1000);
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
                                {result.breadcrumbParts.join(' / ')}
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
                  <span className="hidden sm:inline">{zipProgress || 'Preparing zip…'}</span>
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

              <div className="flex bg-secondary/30 p-1 rounded-lg">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-md transition-all",
                    viewMode === "grid" ? "bg-background shadow-sm" : "hover:bg-background/50"
                  )}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-md transition-all",
                    viewMode === "list" ? "bg-background shadow-sm" : "hover:bg-background/50"
                  )}
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
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
                  {folder.name}
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
            ) : viewMode === "grid" ? (
              // Grid View
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.path}
                    className={cn(
                      "group relative border rounded-lg p-2 sm:p-4 cursor-pointer hover:bg-accent transition-colors",
                      selectedItems.has(item.path) && "bg-accent border-primary",
                      checkedItems.has(item.s3Key || getS3Key(item)) && "ring-2 ring-primary bg-primary/5"
                    )}
                    onClick={() => isSelectionMode ? toggleChecked(item, { stopPropagation: () => {} } as any) : handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                  >
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
                        <Folder className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mb-1 sm:mb-2" />
                      ) : (
                        <div className="mb-1 sm:mb-2 scale-75 sm:scale-100">
                          {getFileIcon(item.name)}
                        </div>
                      )}

                      <p className="text-xs sm:text-sm font-medium truncate w-full px-1">
                        {item.name}
                      </p>

                      {item.type === "file" && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                          {item.size && formatBytes(item.size)}
                        </p>
                      )}
                    </div>

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
                        {isClientInDeliverableFolder && item.type === "folder" && (
                          <DropdownMenuItem
                            onClick={() => handleRenameClick(item)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                        )}
                        {clientCanModify && (
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
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm">
                        Name
                      </th>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm hidden sm:table-cell">
                        Modified
                      </th>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm hidden md:table-cell">
                        Size
                      </th>
                      <th className="w-10 sm:w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr
                        key={item.path}
                        className={cn(
                          "border-b hover:bg-accent cursor-pointer transition-colors",
                          selectedItems.has(item.path) && "bg-accent",
                          checkedItems.has(item.s3Key || getS3Key(item)) && "bg-primary/5"
                        )}
                        onClick={() => isSelectionMode ? toggleChecked(item, { stopPropagation: () => {} } as any) : handleItemClick(item)}
                        onDoubleClick={() => handleItemDoubleClick(item)}
                      >
                        <td className="p-2 sm:p-3">
                          <div className="flex items-center gap-2 sm:gap-3">
                            {/* Checkbox in selection mode */}
                            {isSelectionMode && (
                              <div onClick={(e) => toggleChecked(item, e)} className="flex-shrink-0">
                                {checkedItems.has(item.s3Key || getS3Key(item))
                                  ? <CheckSquare className="h-4 w-4 text-primary" />
                                  : <Square className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            )}
                            {item.type === "folder" ? (
                              <Folder className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" />
                            ) : (
                              <div className="flex-shrink-0 scale-75 sm:scale-100">
                                {getFileIcon(item.name)}
                              </div>
                            )}
                            <span className="truncate text-xs sm:text-sm">
                              {item.name}
                            </span>
                            <span className="sm:hidden text-xs text-muted-foreground ml-auto">
                              {item.type === "file" && item.size
                                ? formatBytes(item.size)
                                : ""}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                          {item.lastModified && formatDate(item.lastModified)}
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm text-muted-foreground hidden md:table-cell">
                          {item.type === "file" && item.size
                            ? formatBytes(item.size)
                            : "-"}
                        </td>
                        <td className="p-2 sm:p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
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
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {item.type === "file" && item.url && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      window.open(item.url, "_blank")
                                    }
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
                              {isClientInDeliverableFolder && item.type === "folder" && (
                                <DropdownMenuItem
                                  onClick={() => handleRenameClick(item)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                              )}
                              {clientCanModify && (
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}