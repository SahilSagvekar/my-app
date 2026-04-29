// components/workflow/FileUploadDialog-Resumable.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  File as FileIcon,
  Zap,
  Pause,
  RefreshCw,
  FolderOpen,
  Folder,
  FileVideo,
  ChevronRight,
  Play,
  FolderUp
} from "lucide-react";
import { uploadStateManager, UploadState } from "@/lib/upload-state-manager";
import { useUploads } from "./UploadContext";
import { cn } from "@/lib/utils";

interface FileUploadDialogProps {
  task?: any;
  subfolder?: string;
  folderType?: string;
  onUploadComplete: (files: any[]) => void;
  trigger?: React.ReactNode;
}

// Extended file type for folder uploads
interface SelectedFile {
  file: File;
  relativePath?: string; // e.g. "my-folder/sub/video.mp4" for folder uploads
}

// ─── Folder traversal helpers for drag-and-drop ───

async function getFileFromEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  let batch: FileSystemEntry[];
  do {
    batch = await new Promise((resolve, reject) => {
      reader.readEntries(resolve as any, reject);
    });
    entries.push(...batch);
  } while (batch.length > 0);
  return entries;
}

async function traverseEntry(
  entry: FileSystemEntry,
  path: string,
  result: SelectedFile[]
): Promise<void> {
  if (entry.isFile) {
    const file = await getFileFromEntry(entry as FileSystemFileEntry);
    result.push({ file, relativePath: path ? `${path}/${entry.name}` : undefined });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const entries = await readAllEntries(reader);
    for (const child of entries) {
      await traverseEntry(child, path ? `${path}/${entry.name}` : entry.name, result);
    }
  }
}

export function FileUploadDialog({
  task,
  subfolder: preselectedSubfolder,
  folderType = "outputs",
  onUploadComplete,
  trigger,
}: FileUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [subfolder, setSubfolder] = useState<string>(preselectedSubfolder || "main");
  const [resumableUploads, setResumableUploads] = useState<UploadState[]>([]);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const notifiedUploadsRef = useRef<Set<string>>(new Set());

  const { enqueueUpload, getUploadState } = useUploads();
  const currentUpload = currentUploadId ? getUploadState(currentUploadId) : null;

  useEffect(() => {
    const check = async () => {
      if (!task?.id && folderType !== 'drive') return;
      const taskId = task?.id || 'drive-upload';
      const uploads = await uploadStateManager.getUploadsByTask(taskId);
      setResumableUploads(uploads.filter(u => u.status === 'uploading' || u.status === 'paused'));
    };
    if (open) check();
  }, [task?.id, open, folderType]);

  useEffect(() => {
    if (currentUpload?.status === 'completed' && !notifiedUploadsRef.current.has(currentUpload.id)) {
      notifiedUploadsRef.current.add(currentUpload.id);
      onUploadComplete([]);

      if (selectedFiles.length === 0) {
        setTimeout(() => {
          setOpen(false);
          setCurrentUploadId(null);
        }, 2000);
      }
    }
  }, [currentUpload?.status, currentUpload?.id, selectedFiles.length, onUploadComplete]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getSubfolderLabel = (f: string): string => {
    const labels: Record<string, string> = { "main": "Main Task Folder", "thumbnails": "Thumbnails", "tiles": "Tiles", "music-license": "Music License", "covers": "Covers" };
    return labels[f] || f;
  };

  const getAcceptedTypes = (folder: string): string => {
    switch (folder) {
      case "main":
        return ".mp4,.mov,video/mp4,video/quicktime";
      case "thumbnails":
      case "tiles":
      case "covers":
        return ".png,.jpg,.jpeg,image/png,image/jpeg";
      case "music-license":
        return ".pdf,application/pdf";
      default:
        return "*";
    }
  };

  const getAcceptedTypesLabel = (folder: string): string => {
    switch (folder) {
      case "main":
        return "MP4 or MOV files only";
      case "thumbnails":
      case "tiles":
      case "covers":
        return "PNG, JPG or JPEG files only";
      case "music-license":
        return "PDF files only";
      default:
        return "Any file type";
    }
  };

  const isValidFileType = (file: File, folder: string): boolean => {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const mime = file.type.toLowerCase();
    
    switch (folder) {
      case "main":
        return ['mp4', 'mov'].includes(ext) || ['video/mp4', 'video/quicktime'].includes(mime);
      case "thumbnails":
      case "tiles":
      case "covers":
        return ['png', 'jpg', 'jpeg'].includes(ext) || ['image/png', 'image/jpeg'].includes(mime);
      case "music-license":
        return ext === 'pdf' || mime === 'application/pdf';
      default:
        return true;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Enhanced drop handler — supports both files and folders
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    const newFiles: SelectedFile[] = [];

    // Check if any items are directories
    let hasDirectories = false;
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        hasDirectories = true;
        break;
      }
    }

    if (hasDirectories) {
      // Traverse all entries (files + folders)
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          await traverseEntry(entry, '', newFiles);
        }
      }
    } else {
      // Simple file drop
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        newFiles.push({ file });
      }
    }

    // Filter valid file types
    const validFiles = newFiles.filter(sf => {
      if (!isValidFileType(sf.file, subfolder)) {
        alert(`"${sf.file.name}" rejected. ${getAcceptedTypesLabel(subfolder)}`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
        .filter(file => {
          if (!isValidFileType(file, subfolder)) {
            alert(`"${file.name}" rejected. ${getAcceptedTypesLabel(subfolder)}`);
            return false;
          }
          return true;
        })
        .map(file => ({ file }));
      if (newFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...newFiles]);
      }
    }
    if (e.target) e.target.value = '';
  };

  // Folder select handler
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
        .filter(file => {
          if (!isValidFileType(file, subfolder)) return false;
          return true;
        })
        .map(file => ({
          file,
          relativePath: file.webkitRelativePath || undefined,
        }));
      if (newFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...newFiles]);
      }
    }
    if (e.target) e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 🔥 FIFO: Enqueue all files sequentially instead of parallel
  const handleStart = async () => {
    if (selectedFiles.length === 0) return;

    setIsStarting(true);
    const filesToUpload = [...selectedFiles];
    setSelectedFiles([]);

    try {
      // Enqueue first file and track it in the dialog UI
      const firstId = await enqueueUpload(
        filesToUpload[0].file,
        task,
        subfolder,
        folderType,
        filesToUpload[0].relativePath
      );
      setCurrentUploadId(firstId);
      setIsStarting(false);

      // Enqueue the rest — they'll process one at a time via the FIFO queue
      for (let i = 1; i < filesToUpload.length; i++) {
        enqueueUpload(
          filesToUpload[i].file,
          task,
          subfolder,
          folderType,
          filesToUpload[i].relativePath
        ).catch(err => console.error("Enqueue failed:", filesToUpload[i].file.name, err));
      }
    } catch (err) {
      console.error("Initiation failed:", err);
      setIsStarting(false);
    }
  };

  const progress = currentUpload ? Math.round((currentUpload.uploadedBytes / currentUpload.fileSize) * 100) : 0;

  // Get folder name from first selected file's relative path (for display)
  const folderName = selectedFiles.find(sf => sf.relativePath)?.relativePath?.split('/')[0];

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) {
        setSelectedFiles([]);
        setIsDragging(false);
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Upload to Task Output
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
              <RefreshCw className="h-3 w-3 animate-spin-slow" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Background</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumable Uploads */}
          {resumableUploads.length > 0 && !currentUpload && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <p className="text-xs font-semibold mb-1">Unfinished uploads found</p>
                {resumableUploads.map(upload => (
                  <div key={upload.id} className="flex items-center justify-between py-1">
                    <span className="text-[11px] truncate max-w-[180px] text-gray-700">{upload.fileName}</span>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] bg-white text-gray-700 border-amber-200 hover:bg-amber-100" onClick={() => setCurrentUploadId(upload.id)}>
                      View Progress
                    </Button>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Target Folder
            </Label>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <Folder className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm text-gray-700">{getSubfolderLabel(subfolder)}</span>
            </div>
          </div>

          {!currentUpload && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileIcon className="h-3.5 w-3.5" />
                Upload Section
              </Label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "group flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all",
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-slate-200 hover:border-primary hover:bg-slate-50"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={cn(
                  "p-4 rounded-full transition-colors",
                  isDragging ? "bg-primary/20 text-primary" : "bg-slate-100 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary"
                )}>
                  <Upload className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-700">
                    {isDragging ? "Drop files or folders now" : "Click to upload or drag & drop"}
                  </p>
                  <p className="text-xs text-slate-400">{getAcceptedTypesLabel(subfolder)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">You can also drop entire folders</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  id="file-input"
                  multiple
                  accept={getAcceptedTypes(subfolder)}
                  onChange={handleFileSelect}
                />
                {/* Hidden folder input */}
                <input
                  ref={folderInputRef}
                  type="file"
                  className="hidden"
                  id="folder-input"
                  // @ts-ignore — webkitdirectory is non-standard but widely supported
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderSelect}
                />
              </div>

              {/* Upload Folder button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
              >
                <FolderUp className="h-3.5 w-3.5 mr-2" />
                Upload Folder
              </Button>
            </div>
          )}

          {selectedFiles.length > 0 && !currentUpload && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileIcon className="h-3.5 w-3.5" />
                Selected Files ({selectedFiles.length})
                {folderName && (
                  <span className="text-blue-600 font-normal normal-case ml-1">
                    from folder: {folderName}
                  </span>
                )}
              </Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {selectedFiles.map((sf, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl relative">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                      <FileVideo className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate pr-6">
                        {sf.relativePath || sf.file.name}
                      </p>
                      <p className="text-[10px] font-medium text-gray-500">{formatSize(sf.file.size)}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentUpload && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Active Upload
              </Label>
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <FileVideo className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-gray-900">{currentUpload.fileName}</p>
                      <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                        {currentUpload.status === 'uploading' ? 'Uploading...' :
                         currentUpload.status === 'completed' ? '✓ Complete' :
                         currentUpload.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {currentUpload.status === 'uploading' && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100" onClick={() => {}}>
                        <Pause className="h-4 w-4 fill-current" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-blue-600">{progress}%</span>
                    <span className="text-gray-400">{formatSize(currentUpload.uploadedBytes)} of {formatSize(currentUpload.fileSize)}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                    <div className={cn(
                      "h-full transition-all duration-500 ease-out",
                      currentUpload.status === 'completed' ? "bg-green-500" : "bg-blue-500"
                    )} style={{ width: `${currentUpload.status === 'completed' ? 100 : progress}%` }} />
                  </div>
                  {/* Speed + ETA */}
                  {currentUpload.status === 'uploading' && currentUpload.speed && currentUpload.speed > 0 && (
                    <p className="text-[10px] text-gray-500 text-center">
                      {formatSpeedSimple(currentUpload.speed)}
                      {currentUpload.estimatedTimeLeft && currentUpload.estimatedTimeLeft > 0
                        ? ` — ${formatEtaSimple(currentUpload.estimatedTimeLeft)}`
                        : ''
                      }
                    </p>
                  )}
                </div>

                <div className="flex justify-center">
                  <p className="text-[10px] text-gray-400 italic">
                    {currentUpload.status === 'completed'
                      ? 'Upload finished successfully'
                      : 'Upload will continue even if you close this window'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedFiles.length > 0 && !currentUpload && (
            <Button
              onClick={handleStart}
              disabled={isStarting}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-sm transition-all active:scale-[0.98]"
            >
              {isStarting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Starting Uploads...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2 text-yellow-400 fill-yellow-400" />
                  Start {selectedFiles.length} Background {selectedFiles.length === 1 ? 'Upload' : 'Uploads'}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simple format helpers for in-dialog display
function formatSpeedSimple(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEtaSimple(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return '';
  if (seconds < 5) return 'a few seconds left';
  if (seconds < 60) return `~${Math.round(seconds)} sec left`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min left`;
  return `~${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m left`;
}