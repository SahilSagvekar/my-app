// src/components/drive/DriveExplorer.tsx

"use client";

import { useState, useEffect, useRef } from "react";
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
  Pencil
} from "lucide-react";
import { ShareDialog } from "../review/ShareDialog";
import { FileUploadDialog } from "../workflow/FileUploadDialog-Resumable";
import { RawFootageUploadDialog } from "./RawFootageUploadDialog";
import { StorageLimitBanner } from "../Storagelimitbanner";
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DriveItem {
  name: string;
  type: "folder" | "file";
  path: string;
  s3Path?: string;
  s3Key?: string; // Full S3 key for deletion
  children?: DriveItem[];
  size?: number;
  url?: string;
  lastModified?: string;
}

interface DriveExplorerProps {
  role: string;
}

type ViewMode = "grid" | "list";

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

  // 🔥 NEW: Delete states
  const [itemToDelete, setItemToDelete] = useState<DriveItem | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 🔥 NEW: Share states
  const [shareLink, setShareLink] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // 🔥 NEW: Folder creation states
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // 🔥 NEW: Folder rename states
  const [itemToRename, setItemToRename] = useState<DriveItem | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // 🔥 NEW: Storage limit states
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

  // Fetch storage info for clients
  useEffect(() => {
    if (role === 'client' && user?.linkedClientId) {
      fetch(`/api/clients/${user.linkedClientId}/storage`)
        .then(res => res.json())
        .then(data => {
          setStorageInfo(data);
          // Auto-show modal if at limit
          if (data.isAtLimit) {
            setShowStorageLimitModal(true);
          }
        })
        .catch(console.error);
    }
  }, [role, user?.linkedClientId]);

  useEffect(() => {
    if (user) {
      loadDriveStructure();
    }
  }, [user]);

  const loadDriveStructure = async () => {
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
      setCurrentFolder(data);
      setBreadcrumb([data]);
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
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folder: DriveItem) => {
    setCurrentFolder(folder);
    const folderIndex = breadcrumb.findIndex((f) => f.path === folder.path);
    if (folderIndex !== -1) {
      setBreadcrumb(breadcrumb.slice(0, folderIndex + 1));
    } else {
      setBreadcrumb([...breadcrumb, folder]);
    }
    setSelectedItems(new Set());
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
    // Include ALL breadcrumb parts including root (company name)
    const pathParts = breadcrumb.map((b) => b.name);
    return pathParts.join("/") + "/";
  };

  // 🔥 Check if we're at a level where RawFootageUploadDialog should show
  // Show it only at: raw-footage/, raw-footage/Month/, raw-footage/Month/DeliverableType/
  // NOT inside custom subfolders created by the client
  const currentPath = getCurrentFolderS3Path();
  const pathParts = currentPath.split('/').filter(Boolean);
  const rawFootageIndex = pathParts.findIndex(p => p === 'raw-footage');
  
  // Calculate depth from raw-footage folder
  // raw-footage = depth 0, raw-footage/April-2026 = depth 1, raw-footage/April-2026/LF = depth 2, raw-footage/April-2026/LF/custom = depth 3
  const depthFromRawFootage = rawFootageIndex >= 0 ? pathParts.length - rawFootageIndex - 1 : -1;
  
  // Check if client is inside raw-footage folder (any depth) - used for upload permissions
  const isClientInRawFootage = role === 'client' && currentPath.includes('raw-footage');
  
  // Show RawFootageUploadDialog only at depth 0, 1, or 2 (raw-footage, month, or deliverable type level)
  // At depth 3+ (inside custom folders), show regular FileUploadDialog for direct uploads
  const shouldShowRawFootageDialog = role === 'client' && 
    !!user?.linkedClientId && 
    currentPath.includes('raw-footage') && 
    depthFromRawFootage >= 0 && 
    depthFromRawFootage <= 2;
  
  // Check if client is inside a deliverable folder (depth 2+) - used for folder management permissions
  // depth 2 = inside deliverable type folder (e.g., raw-footage/April-2026/LF/)
  // depth 3+ = inside custom subfolders
  // Clients can create/rename/delete folders only at depth 2+ (inside deliverable folders)
  const isClientInDeliverableFolder = role === 'client' && 
    currentPath.includes('raw-footage') && 
    depthFromRawFootage >= 2;
  
  // Client can upload: only inside raw-footage folder
  // Non-clients can upload anywhere
  const canUpload = role !== 'client' || isClientInRawFootage;
  
  useEffect(() => {
    if (role === 'client') {
      console.log('📁 DriveExplorer Debug:', {
        role,
        linkedClientId: user?.linkedClientId,
        currentPath,
        pathParts,
        rawFootageIndex,
        depthFromRawFootage,
        isClientInRawFootage,
        shouldShowRawFootageDialog,
        isClientInDeliverableFolder,
        canUpload,
        companyName: breadcrumb[0]?.name
      });
    }
  }, [role, user?.linkedClientId, currentPath, shouldShowRawFootageDialog, breadcrumb]);

  const closeUploadDialog = () => { };

  // 🔥 NEW: Get S3 Key for item
  const getS3Key = (item: DriveItem): string => {
    // If item already has s3Key, use it
    if (item.s3Key) {
      return item.s3Key;
    }

    // Build S3 key from breadcrumb + item name (include ALL parts including root)
    const pathParts = breadcrumb.map((b) => b.name);
    pathParts.push(item.name);
    return pathParts.join("/");
  };

  // 🔥 NEW: Handle Delete Click
  const handleDeleteClick = (item: DriveItem) => {
    setItemToDelete(item);
    setShowDeleteDialog(true);
  };

  // 🔥 NEW: Confirm Delete
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

      // 🔥 SIMPLE FIX: Just reload the page
      setTimeout(() => {
        window.location.reload();
      }, 500); // Small delay to show the success toast
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(`Failed to delete ${itemToDelete.name}: ${error.message}`);
      setIsDeleting(false); // Re-enable button on error
    }
    // Don't set isDeleting to false on success, page is reloading anyway
  };

  // 🔥 NEW: Helper function to update drive structure
  const updateDriveStructureAfterDelete = (deletedPath: string) => {
    if (!driveStructure) return;

    const removeItemRecursive = (item: DriveItem): DriveItem => {
      if (!item.children) return item;

      return {
        ...item,
        children: item.children
          .filter((child) => child.path !== deletedPath)
          .map((child) => removeItemRecursive(child)),
      };
    };

    const updatedStructure = removeItemRecursive(driveStructure);
    setDriveStructure(updatedStructure);
  };

  // 🔥 NEW: Cancel Delete
  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setItemToDelete(null);
  };

  // 🔥 NEW: Create Folder
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
      
      // Reload drive structure
      setTimeout(loadDriveStructure, 500);
    } catch (error: any) {
      console.error('Create folder error:', error);
      toast.error(error.message || 'Failed to create folder');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // 🔥 NEW: Handle Rename Click
  const handleRenameClick = (item: DriveItem) => {
    setItemToRename(item);
    setRenameValue(item.name);
    setShowRenameDialog(true);
  };

  // 🔥 NEW: Confirm Rename
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
      
      // Reload drive structure
      setTimeout(loadDriveStructure, 500);
    } catch (error: any) {
      console.error('Rename error:', error);
      toast.error(error.message || 'Failed to rename');
    } finally {
      setIsRenaming(false);
    }
  };

  // 🔥 NEW: Handle Share Link
  const handleShareClick = async (item: DriveItem) => {
    if (item.type !== "file") return;

    setIsSharing(true);
    setCopied(false);

    try {
      const s3Key = item.s3Key || getS3Key(item);

      const response = await fetch("/api/drive/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          s3Key,
          fileName: item.name,
          fileSize: item.size,
          mimeType: item.url ? (await fetch(item.url, { method: 'HEAD' })).headers.get('content-type') : null
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate share link");
      }

      const data = await response.json();
      setShareLink(data.shareUrl);
      setShowShareDialog(true);

      // Auto-copy
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      toast.success("Share link created and copied to clipboard");
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
      // Redirect to presigned URL — browser's native download manager handles it
      window.open(data.downloadUrl, '_blank');
      toast.success('Download started');
    } catch (error: any) {
      console.error("Download error:", error);
      // Fallback: open the file URL directly
      if (item.url) {
        window.open(item.url, '_blank');
      }
      toast.error("Failed to start download");
    }
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

  const filteredItems =
    currentFolder?.children?.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

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

      {/* Upload Progress Dialog Removed */}

      {/* 🔥 NEW: Delete Confirmation Dialog */}
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

      {/* 🔥 NEW: Create Folder Dialog */}
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

      {/* 🔥 NEW: Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename {itemToRename?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
            <DialogDescription>
              Enter a new name for "{itemToRename?.name}"
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

      {/* 🔥 Storage Limit Modal */}
      {storageInfo && storageInfo.percentage !== undefined && (
        <StorageLimitModal
          open={showStorageLimitModal}
          onOpenChange={setShowStorageLimitModal}
          storageInfo={storageInfo}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 🔥 Storage Banner - Always show for clients */}
        {role === 'client' && user?.linkedClientId && (
          <div className="px-3 sm:px-4 pt-3">
            <StorageLimitBanner 
              clientId={user.linkedClientId} 
              onUpgradeClick={() => setShowStorageLimitModal(true)}
            />
          </div>
        )}

        {/* Top Toolbar */}
        <div className="border-b bg-card">
          <div className="flex items-center gap-4 p-3 sm:p-4">
            {/* Left: Upload Button - Only show if user can upload and not at storage limit */}
            {canUpload && !(role === 'client' && storageInfo?.isAtLimit) && (
              shouldShowRawFootageDialog ? (
                <RawFootageUploadDialog
                  clientId={user!.linkedClientId!}
                  companyName={breadcrumb[0]?.name || ''}
                  onUploadComplete={() => {
                    setTimeout(loadDriveStructure, 1000);
                    // Refresh storage info after upload
                    if (user?.linkedClientId) {
                      fetch(`/api/clients/${user.linkedClientId}/storage`)
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
            
            {/* Show "Storage Full" button when at limit */}
            {role === 'client' && storageInfo?.isAtLimit && isClientInRawFootage && (
              <Button 
                className="gap-2 shrink-0 h-10 px-4" 
                variant="destructive"
                onClick={() => setShowStorageLimitModal(true)}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Storage Full - Upgrade</span>
              </Button>
            )}

            {/* New Folder Button - Show for clients in raw-footage */}
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

            {/* Middle: Search bar */}
            <div className="flex-1 max-w-2xl mx-auto">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder="Search in Drive"
                  className="pl-10 bg-secondary/30 h-10 border-transparent focus-visible:ring-1 focus-visible:ring-primary/20 transition-all rounded-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Right: View toggle and Refresh */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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
                  {searchQuery ? "No files found" : "This folder is empty"}
                </p>
                <p className="text-sm mb-4">
                  {searchQuery
                    ? "Try a different search term"
                    : "Upload files to get started"}
                </p>
                {!searchQuery && (
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
                )}
              </div>
            ) : viewMode === "grid" ? (
              // Grid View
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.path}
                    className={cn(
                      "group relative border rounded-lg p-2 sm:p-4 cursor-pointer hover:bg-accent transition-colors",
                      selectedItems.has(item.path) && "bg-accent border-primary"
                    )}
                    onClick={() => handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                  >
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
                        <DropdownMenuItem>
                          <Star className="h-4 w-4 mr-2" />
                          Add to starred
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* 🔥 NEW: Share Link Option */}
                        {item.type === "file" && (
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
                        )}
                        {/* 🔥 NEW: Rename Option - for clients in raw-footage */}
                        {isClientInDeliverableFolder && item.type === "folder" && (
                          <DropdownMenuItem
                            onClick={() => handleRenameClick(item)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                        )}
                        {/* 🔥 NEW: Delete Option */}
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(item)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
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
                          selectedItems.has(item.path) && "bg-accent"
                        )}
                        onClick={() => handleItemClick(item)}
                        onDoubleClick={() => handleItemDoubleClick(item)}
                      >
                        <td className="p-2 sm:p-3">
                          <div className="flex items-center gap-2 sm:gap-3">
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
                              <DropdownMenuItem>
                                <Star className="h-4 w-4 mr-2" />
                                Add to starred
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {item.type === "file" && (
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
                              )}
                              {/* 🔥 NEW: Rename Option - for clients in raw-footage */}
                              {isClientInDeliverableFolder && item.type === "folder" && (
                                <DropdownMenuItem
                                  onClick={() => handleRenameClick(item)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                              )}
                              {/* 🔥 NEW: Delete Option */}
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(item)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
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