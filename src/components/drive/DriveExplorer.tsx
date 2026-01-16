// src/components/drive/DriveExplorer.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import {
  Folder,
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
} from "lucide-react";
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

interface UploadingFile {
  name: string;
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
}

export function DriveExplorer({ role }: DriveExplorerProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [driveStructure, setDriveStructure] = useState<DriveItem | null>(null);
  const [currentFolder, setCurrentFolder] = useState<DriveItem | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<DriveItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Upload states
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // 🔥 NEW: Delete states
  const [itemToDelete, setItemToDelete] = useState<DriveItem | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setShowUploadDialog(true);

    const newUploadingFiles: UploadingFile[] = Array.from(files).map(
      (file) => ({
        name: file.name,
        progress: 0,
        status: "uploading",
      })
    );
    setUploadingFiles(newUploadingFiles);

    Array.from(files).forEach((file, index) => {
      uploadFile(file, index);
    });

    event.target.value = "";
  };

  const uploadFile = async (file: File, index: number) => {
    try {
      const currentPath = getCurrentFolderS3Path();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folderPath", currentPath);
      formData.append("userId", user?.id?.toString() || "");
      formData.append("role", role);

      const response = await fetch("/api/drive/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      setUploadingFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, progress: 100, status: "completed" } : f
        )
      );

      toast.success(`${file.name} uploaded successfully`);

      setTimeout(() => {
        loadDriveStructure();
      }, 1000);
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadingFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "error", error: error.message } : f
        )
      );
      toast.error(`Failed to upload ${file.name}`);
    }
  };

  const getCurrentFolderS3Path = (): string => {
    if (breadcrumb.length <= 1) {
      return "";
    }
    const pathParts = breadcrumb.slice(1).map((b) => b.name);
    return pathParts.join("/") + "/";
  };

  const closeUploadDialog = () => {
    const allCompleted = uploadingFiles.every(
      (f) => f.status === "completed" || f.status === "error"
    );

    if (allCompleted) {
      setShowUploadDialog(false);
      setUploadingFiles([]);
    }
  };

  // 🔥 NEW: Get S3 Key for item
  const getS3Key = (item: DriveItem): string => {
    // If item already has s3Key, use it
    if (item.s3Key) {
      return item.s3Key;
    }

    // Build S3 key from breadcrumb + item name
    const pathParts = breadcrumb.slice(1).map((b) => b.name);
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
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Upload Progress Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Uploading files</DialogTitle>
            <DialogDescription>
              Uploading to: {breadcrumb.map((b) => b.name).join(" / ")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {uploadingFiles.map((file, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {file.status === "completed" ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : file.status === "error" ? (
                      <X className="h-4 w-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                    )}
                    <span className="text-sm truncate">{file.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground ml-2">
                    {file.status === "completed"
                      ? "Done"
                      : file.status === "error"
                      ? "Failed"
                      : `${file.progress}%`}
                  </span>
                </div>
                {file.status === "uploading" && (
                  <Progress value={file.progress} className="h-1" />
                )}
                {file.status === "error" && file.error && (
                  <p className="text-xs text-red-500">{file.error}</p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={closeUploadDialog}
              disabled={uploadingFiles.some((f) => f.status === "uploading")}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Toolbar */}
        <div className="border-b bg-card">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-3 sm:p-4">
            <div className="flex-1 w-full sm:max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search in Drive"
                  className="pl-10 bg-secondary/50 text-sm sm:text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                className="gap-2 flex-1 sm:flex-initial text-xs sm:text-sm"
                onClick={handleUploadClick}
              >
                <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>

              <div className="flex gap-1 border rounded-md">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-9 w-9 sm:h-10 sm:w-10"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-9 w-9 sm:h-10 sm:w-10"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10"
                onClick={loadDriveStructure}
              >
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
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
                  <Button onClick={handleUploadClick}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload files
                  </Button>
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
                              onClick={() => window.open(item.url, "_blank")}
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
                                    onClick={() =>
                                      window.open(item.url, "_blank")
                                    }
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
