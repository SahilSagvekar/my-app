// components/workflow/FileUploadDialog-Resumable.tsx
"use client";

import { useState, useEffect } from "react";
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
  Play
} from "lucide-react";
import { uploadStateManager, UploadState } from "@/lib/upload-state-manager";
import { useUploads } from "./UploadContext";
import { cn } from "@/lib/utils";

interface FileUploadDialogProps {
  task: any;
  subfolder?: string;
  onUploadComplete: (files: any[]) => void;
  trigger?: React.ReactNode;
}

export function FileUploadDialog({
  task,
  subfolder: preselectedSubfolder,
  onUploadComplete,
  trigger,
}: FileUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [subfolder, setSubfolder] = useState<string>(preselectedSubfolder || "main");
  const [resumableUploads, setResumableUploads] = useState<UploadState[]>([]);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);

  const { startUpload, pauseUpload, cancelUpload, getUploadState } = useUploads();
  const currentUpload = currentUploadId ? getUploadState(currentUploadId) : null;

  useEffect(() => {
    const check = async () => {
      const uploads = await uploadStateManager.getUploadsByTask(task.id);
      setResumableUploads(uploads.filter(u => u.status === 'uploading' || u.status === 'paused'));
    };
    if (open) check();
  }, [task.id, open]);

  useEffect(() => {
    if (currentUpload?.status === 'completed') {
      setTimeout(() => {
        setOpen(false);
        setSelectedFile(null);
        setCurrentUploadId(null);
      }, 2000);
    }
  }, [currentUpload?.status]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getSubfolderLabel = (f: string): string => {
    const labels: Record<string, string> = { "main": "Main Task Folder", "thumbnails": "Thumbnails", "tiles": "Tiles", "music-license": "Music License", "covers": "Covers" };
    return labels[f] || f;
  };

  const handleStart = async (file: File, resumeId?: string) => {
    try {
      const id = await startUpload(file, task, subfolder, resumeId);
      setCurrentUploadId(id);
    } catch (err) {
      console.error(err);
    }
  };

  const progress = currentUpload ? Math.round((currentUpload.uploadedBytes / currentUpload.fileSize) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
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

          {!currentUpload && !selectedFile && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileIcon className="h-3.5 w-3.5" />
                Select File
              </Label>
              <label htmlFor="file-input" className="group flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-xl p-10 cursor-pointer hover:border-primary hover:bg-slate-50 transition-all">
                <div className="p-4 bg-slate-100 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary rounded-full transition-colors">
                  <Upload className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-700">Click to upload or drag & drop</p>
                  <p className="text-xs text-slate-400">Video, Image or Document up to 2GB</p>
                </div>
                <input type="file" className="hidden" id="file-input" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          )}

          {selectedFile && !currentUpload && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileIcon className="h-3.5 w-3.5" />
                Selected File
              </Label>
              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl relative overflow-hidden">
                <div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg">
                  <FileVideo className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate pr-8">{selectedFile.name}</p>
                  <p className="text-xs font-medium text-gray-500">{formatSize(selectedFile.size)}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 absolute top-3 right-3 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => setSelectedFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
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
                        {currentUpload.status === 'uploading' ? 'Uploading...' : currentUpload.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {currentUpload.status === 'uploading' && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100" onClick={() => pauseUpload(currentUpload.id)}>
                        <Pause className="h-4 w-4 fill-current" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50" onClick={() => cancelUpload(currentUpload.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-blue-600">{progress}%</span>
                    <span className="text-gray-400">{formatSize(currentUpload.uploadedBytes)} of {formatSize(currentUpload.fileSize)}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                    <div className="h-full bg-blue-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex justify-center">
                  <p className="text-[10px] text-gray-400 italic">Upload will continue even if you close this window</p>
                </div>
              </div>
            </div>
          )}

          {selectedFile && !currentUpload && (
            <Button onClick={() => handleStart(selectedFile)} className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-sm transition-all active:scale-[0.98]">
              <Zap className="h-4 w-4 mr-2 text-yellow-400 fill-yellow-400" />
              Start Background Upload
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}