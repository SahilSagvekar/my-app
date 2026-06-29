// src/components/drive/DriveExplorer.tsx

"use client";

import { useState, useEffect, useRef, useCallback, DragEvent } from "react";
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
  const [breadcrumb, setBreadcrumbState] = useState<DriveItem[]>([]);
  const breadcrumbRef = useRef<DriveItem[]>([]);
  const setBreadcrumb = (val: DriveItem[]) => {
    breadcrumbRef.current = val;
    setBreadcrumbState(val);
  };
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

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

  // ─── Download queue modal ─────────────────────────────────────────────────
  const [downloadQueue, setDownloadQueue] = useState<{ key: string; name: string; url: string; filename: string }[]>([]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadedSet, setDownloadedSet] = useState<Set<number>>(new Set());
  const [autoDownloading, setAutoDownloading] = useState(false);
  const autoDownloadRef = useRef(false);

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

  // ─── Drag & Drop state ───────────────────────────────────────────────────
  const [draggedItem, setDraggedItem] = useState<DriveItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // path of folder being hovered
  const [isMoving, setIsMoving] = useState(false);
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

  // ── Load client list for admin/manager selector ──────────────────────────
  useEffect(() => {
    if (role !== 'admin' && role !== 'manager') return;
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
  useEffect(() => {
    if (!user) return;
    if (role === 'client') return; // client role handled by mount effect above
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

  const canAddFootageLinks = ['admin', 'manager', 'editor', 'client'].includes(role?.toLowerCase() ?? '');

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
    const liveBreadcrumb = breadcrumbRef.current;
    const currentNavPath = liveBreadcrumb.length > 1
      ? liveBreadcrumb.slice(1).map(b => b.name).join("/")
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

      // Use override (captured at call time) or current effectiveClientId
      const resolvedClientId = clientIdOverride !== undefined ? clientIdOverride : effectiveClientId;
      if (resolvedClientId) {
        params.append("clientId", resolvedClientId);
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

  // ─── Download helpers ────────────────────────────────────────────────────────
  // Instead of zipping on the server (which OOMs on 3.9GB RAM with large video folders),
  // we fetch presigned R2 URLs and trigger individual file downloads in the browser.
  // Files download directly from R2 — zero server memory usage.

  // Trigger a single file download via <a> click — works when called from direct user gesture
  const triggerSingleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Fetch presigned URLs then open a download queue modal
  const downloadFilesFromUrls = async (
    body: { folderPrefix?: string; keys?: string[]; zipName?: string },
    label: string,
  ) => {
    setIsZipping(true);
    setZipProgress(`Preparing "${label}"…`);
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
      const data = await res.json() as { files: { key: string; name: string; url: string }[]; folderName: string };
      if (!data.files?.length) throw new Error('No files found');

      const queue = data.files.map(f => ({
        ...f,
        filename: f.name.split('/').pop() || f.name,
      }));

      setDownloadQueue(queue);
      setDownloadedSet(new Set());
      setAutoDownloading(false);
      autoDownloadRef.current = false;
      setShowDownloadModal(true);
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    } finally { setIsZipping(false); setZipProgress(''); }
  };

  // Auto-download all files sequentially — each triggered by the loop itself
  // which runs inside a user-gesture context from the button click that started it
  const startAutoDownload = async () => {
    setAutoDownloading(true);
    autoDownloadRef.current = true;
    for (let i = 0; i < downloadQueue.length; i++) {
      if (!autoDownloadRef.current) break; // user cancelled
      const file = downloadQueue[i];
      triggerSingleDownload(file.url, file.filename);
      setDownloadedSet(prev => new Set([...prev, i]));
      // Wait 1.5s between downloads — enough for browser to register each one
      if (i < downloadQueue.length - 1) await new Promise(r => setTimeout(r, 1500));
    }
    setAutoDownloading(false);
    autoDownloadRef.current = false;
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
      await loadDriveStructure();
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
    <>
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
                    This will delete the folder and all its contents
                    permanently.
                  </span>
                )}
                <span className="block mt-2">
                  This action cannot be undone.
                </span>
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
        <Dialog
          open={showCreateFolderDialog}
          onOpenChange={setShowCreateFolderDialog}
        >
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
                    if (e.key === "Enter" && !isCreatingFolder) {
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
                  setNewFolderName("");
                }}
                disabled={isCreatingFolder}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
              >
                {isCreatingFolder ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Folder"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Rename {itemToRename?.type === "folder" ? "Folder" : "File"}
              </DialogTitle>
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
                    if (e.key === "Enter" && !isRenaming) {
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
                  setRenameValue("");
                }}
                disabled={isRenaming}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRename}
                disabled={isRenaming || !renameValue.trim()}
              >
                {isRenaming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Renaming...
                  </>
                ) : (
                  "Rename"
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
                <Button
                  className="mt-4 w-full"
                  onClick={() => setShowStorageLimitModal(true)}
                >
                  Get more storage
                </Button>
              </div>
            </div>
          )}

          {/* Top Toolbar */}
          <div className="border-b bg-card">
            <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 flex-wrap">
              {/* Left: Upload Button */}
              {canUpload &&
                !(role === "client" && storageInfo?.isAtLimit) &&
                (shouldShowRawFootageDialog ? (
                  <RawFootageUploadDialog
                    clientId={effectiveClientId!}
                    companyName={effectiveCompanyName}
                    role={role}
                    onUploadComplete={() => {
                      const cid = effectiveClientId || browsingClientId;
                      loadDriveStructure(cid);
                      if (cid) {
                        fetch(`/api/clients/${cid}/storage`)
                          .then((res) => res.json())
                          .then(setStorageInfo)
                          .catch(console.error);
                      }
                    }}
                    trigger={
                      <Button className="gap-2 shrink-0 h-10 px-4">
                        <Upload className="h-4 w-4" />
                        <span className="hidden sm:inline font-medium">
                          Upload Raw Footage
                        </span>
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
                      loadDriveStructure(cid);
                    }}
                    trigger={
                      <Button className="gap-2 shrink-0 h-10 px-4">
                        <Upload className="h-4 w-4" />
                        <span className="hidden sm:inline font-medium">
                          Upload to Elements
                        </span>
                      </Button>
                    }
                  />
                ) : (
                  <FileUploadDialog
                    folderType="drive"
                    subfolder={getCurrentFolderS3Path()}
                    onUploadComplete={() => {
                      const cid = effectiveClientId || browsingClientId;
                      loadDriveStructure(cid);
                    }}
                    trigger={
                      <Button className="gap-2 shrink-0 h-10 px-4">
                        <Upload className="h-4 w-4" />
                        <span className="hidden sm:inline font-medium">
                          Upload
                        </span>
                      </Button>
                    }
                  />
                ))}

              {/* Storage Full button */}
              {role === "client" &&
                storageInfo?.isAtLimit &&
                isInRawFootage && (
                  <Button
                    className="gap-2 shrink-0 h-10 px-4"
                    variant="destructive"
                    onClick={() => setShowStorageLimitModal(true)}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span className="hidden sm:inline font-medium">
                      Storage Full - Upgrade
                    </span>
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
                  <span className="hidden sm:inline font-medium">
                    New Folder
                  </span>
                </Button>
              )}

              {/* Add External Link Button */}
              {isInRawFootage && canAddFootageLinks && (
                <Button
                  variant="outline"
                  className="gap-2 shrink-0 h-10 px-4"
                  onClick={() => {
                    setShowAddLinkInput(true);
                  }}
                >
                  <LinkIcon className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Add Link</span>
                </Button>
              )}

              {/* ─── Admin/Manager: Client Selector ─── */}
              {(role === "admin" || role === "manager") &&
                adminClientList.length > 0 && (
                  <Select
                    value={adminSelectedClientId}
                    onValueChange={setAdminSelectedClientId}
                  >
                    <SelectTrigger className="w-[200px] h-10 shrink-0">
                      <SelectValue placeholder="Select client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {adminClientList.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

              {/* ─── Editor: Client Selector (only when assigned to multiple clients) ─── */}
              {role === "editor" && editorClientList.length > 1 && (
                <Select
                  value={editorSelectedClientId}
                  onValueChange={setEditorSelectedClientId}
                >
                  <SelectTrigger className="w-[200px] h-10 shrink-0">
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {editorClientList.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* ─── FEATURE 1: Deliverable Type Filter Dropdown ─── */}
              {deliverableTypes.length > 0 &&
                // Show when: at company root (seeing outputs folder), OR inside outputs at depth 0-1
                (currentFolder?.children?.some((c) => c.name === "outputs") ||
                  (isInOutputs && depthFromOutputs < 2)) && (
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
                      if (
                        globalSearchResults.length > 0 &&
                        globalSearchQuery.length >= 2
                      ) {
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
                          {globalSearchResults.length} result
                          {globalSearchResults.length !== 1 ? "s" : ""} found
                          across all folders
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
                              <p className="text-sm font-medium truncate">
                                {result.name}
                              </p>
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                                <FolderOpen className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">
                                  {result.breadcrumbParts.join(" / ")}
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
                    <span className="hidden sm:inline">
                      {zipProgress || "Preparing downloads…"}
                    </span>
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2"
                      onClick={clearChecked}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {/* Download All button */}
                {filteredItems.some((i) => i.type === "file") && (
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
                  onClick={() => {
                    setIsSelectionMode((s) => !s);
                    if (isSelectionMode) clearChecked();
                  }}
                >
                  {isSelectionMode ? (
                    <CheckSquare className="h-3.5 w-3.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {isSelectionMode ? "Done" : "Select"}
                  </span>
                </Button>

                {/* Select All (shown only in selection mode) */}
                {isSelectionMode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 text-xs"
                    onClick={selectAllFiles}
                  >
                    All
                  </Button>
                )}

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
                      index === breadcrumb.length - 1 && "font-semibold",
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
                    {SHORT_CODE_LABELS[selectedDeliverableFilter] ||
                      selectedDeliverableFilter}{" "}
                    ({selectedDeliverableFilter})
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
              {isInRawFootage &&
                (footageLinks.length > 0 || canAddFootageLinks) && (
                  <div className="mb-5 border rounded-xl bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/40">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          External Links
                        </span>
                        {footageLinks.length > 0 && (
                          <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">
                            {footageLinks.length}
                          </span>
                        )}
                      </div>
                      {canAddFootageLinks && !showAddLinkInput && (
                        <button
                          onClick={() => setShowAddLinkInput(true)}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                          <span className="text-base leading-none">+</span> Add
                          Link
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
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddFootageLink();
                            if (e.key === "Escape") {
                              setShowAddLinkInput(false);
                              setNewLinkUrl("");
                            }
                          }}
                          className="h-8 text-xs flex-1"
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs px-3"
                          disabled={!newLinkUrl.trim() || addingLink}
                          onClick={handleAddFootageLink}
                        >
                          {addingLink ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Add"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs px-2"
                          onClick={() => {
                            setShowAddLinkInput(false);
                            setNewLinkUrl("");
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}

                    {/* Links list */}
                    {loadingLinks ? (
                      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading
                        links...
                      </div>
                    ) : footageLinks.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground">
                        No external links yet.{" "}
                        {canAddFootageLinks
                          ? 'Click "+ Add Link" to attach a Google Drive, Dropbox, or Frame.io link.'
                          : ""}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {footageLinks.map((link) => (
                          <div
                            key={link.id}
                            className="flex items-center gap-3 px-4 py-2.5 group hover:bg-muted/30 transition-colors"
                          >
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
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {link.url}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Added by {link.addedByName} ·{" "}
                                {new Date(link.addedAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
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
                </div>
              ) : (
                // Grid View
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {filteredItems.map((item) => (
                    <div
                      key={item.path}
                      draggable={role !== "client"}
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onDragOver={
                        item.type === "folder"
                          ? (e) => handleDragOver(e, item)
                          : undefined
                      }
                      onDragLeave={
                        item.type === "folder" ? handleDragLeave : undefined
                      }
                      onDrop={
                        item.type === "folder"
                          ? (e) => handleDrop(e, item)
                          : undefined
                      }
                      className={cn(
                        "group relative border rounded-lg p-2 sm:p-4 cursor-pointer hover:bg-accent transition-colors",
                        selectedItems.has(item.path) &&
                          "bg-accent border-primary",
                        checkedItems.has(item.s3Key || getS3Key(item)) &&
                          "ring-2 ring-primary bg-primary/5",
                        draggedItem?.path === item.path &&
                          "opacity-40 scale-95",
                        dragOverTarget === item.path &&
                          item.type === "folder" &&
                          "ring-2 ring-blue-400 bg-blue-50/60",
                      )}
                      onClick={() =>
                        isSelectionMode
                          ? toggleChecked(item, {
                              stopPropagation: () => {},
                            } as any)
                          : handleItemClick(item)
                      }
                      onDoubleClick={() => handleItemDoubleClick(item)}
                    >
                      {/* Selection checkbox */}
                      {(isSelectionMode ||
                        checkedItems.has(item.s3Key || getS3Key(item))) && (
                        <div
                          className="absolute top-2 left-2 z-10"
                          onClick={(e) => toggleChecked(item, e)}
                        >
                          {checkedItems.has(item.s3Key || getS3Key(item)) ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFolder(item);
                                }}
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
                            {checkedItems.has(item.s3Key || getS3Key(item))
                              ? "Deselect"
                              : "Select"}
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
                          {isClientInDeliverableFolder &&
                            item.type === "folder" && (
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
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ─── Download Queue Modal ──────────────────────────────────────────── */}
      <Dialog
        open={showDownloadModal}
        onOpenChange={(open) => {
          if (!open) {
            autoDownloadRef.current = false;
            setAutoDownloading(false);
          }
          setShowDownloadModal(open);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Files ({downloadQueue.length})
            </DialogTitle>
            <DialogDescription>
              {downloadedSet.size === 0
                ? `${downloadQueue.length} file${downloadQueue.length !== 1 ? "s" : ""} ready. Click "Download All" to start, or download individually.`
                : autoDownloading
                  ? `Downloading… ${downloadedSet.size}/${downloadQueue.length} done`
                  : `${downloadedSet.size}/${downloadQueue.length} downloaded`}
            </DialogDescription>
          </DialogHeader>

          {/* Progress bar */}
          {downloadedSet.size > 0 && (
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{
                  width: `${(downloadedSet.size / downloadQueue.length) * 100}%`,
                }}
              />
            </div>
          )}

          {/* File list */}
          <div className="overflow-y-auto flex-1 border rounded-md divide-y">
            {downloadQueue.map((file, i) => (
              <div
                key={file.key}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
              >
                <div
                  className="flex-1 truncate text-muted-foreground"
                  title={file.filename}
                >
                  {file.filename}
                </div>
                {downloadedSet.has(i) ? (
                  <span className="text-xs text-green-600 font-medium shrink-0">
                    ✓ Done
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 shrink-0"
                    onClick={() => {
                      triggerSingleDownload(file.url, file.filename);
                      setDownloadedSet((prev) => new Set([...prev, i]));
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                autoDownloadRef.current = false;
                setShowDownloadModal(false);
              }}
            >
              Close
            </Button>
            {autoDownloading ? (
              <Button
                variant="destructive"
                onClick={() => {
                  autoDownloadRef.current = false;
                  setAutoDownloading(false);
                }}
              >
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={startAutoDownload}
                disabled={downloadedSet.size === downloadQueue.length}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {downloadedSet.size > 0 ? "Resume" : "Download All"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}