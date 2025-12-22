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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle, 
  File as FileIcon,
  Zap,
  Play,
  Pause,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { uploadStateManager, UploadState } from "@/lib/upload-state-manager";

const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks
const PARALLEL_UPLOADS = 5;

interface FileUploadDialogProps {
  task: any;
  onUploadComplete: (files: any[]) => void;
  trigger?: React.ReactNode;
}

export function FileUploadDialog({
  task,
  onUploadComplete,
  trigger,
}: FileUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [folderType, setFolderType] = useState<"rawFootage" | "essentials">("rawFootage");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [resumableUploads, setResumableUploads] = useState<UploadState[]>([]);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);

  const { user } = useAuth();

  // Check for resumable uploads on mount
  useEffect(() => {
    checkResumableUploads();
  }, [task.id]);

  const checkResumableUploads = async () => {
    const uploads = await uploadStateManager.getUploadsByTask(task.id);
    const activeUploads = uploads.filter(
      u => u.status === 'uploading' || u.status === 'paused'
    );
    setResumableUploads(activeUploads);
  };

  const formatSpeed = (mbps: number) => {
    return `${mbps.toFixed(2)} MB/s`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
  };

  const generateUploadId = () => {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const uploadChunk = async (
    chunk: Blob,
    partNumber: number,
    key: string,
    uploadId: string,
    fileType: string
  ) => {
    const partUrlResponse = await fetch("/api/upload/part-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, uploadId, partNumber }),
    });

    if (!partUrlResponse.ok) {
      throw new Error(`Failed to get presigned URL for part ${partNumber}`);
    }

    const { presignedUrl } = await partUrlResponse.json();

    const uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      body: chunk,
      headers: { "Content-Type": fileType },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload part ${partNumber}`);
    }

    const etag = uploadResponse.headers.get("ETag");
    if (!etag) {
      throw new Error("Failed to get ETag");
    }

    return {
      ETag: etag.replace(/"/g, ""),
      PartNumber: partNumber,
    };
  };

  const startUpload = async (file: File, resumeState?: UploadState) => {
    setUploading(true);
    setError(null);
    setPaused(false);

    let uploadId: string;
    let key: string;
    let s3UploadId: string;
    let uploadedParts: Array<{ ETag: string; PartNumber: number }> = [];
    let completedChunks: number[] = [];
    let uploadedBytes = 0;

    try {
      // Resume existing upload or start new
      if (resumeState) {
        uploadId = resumeState.id;
        key = resumeState.key;
        s3UploadId = resumeState.uploadId;
        uploadedParts = resumeState.uploadedParts;
        completedChunks = resumeState.completedChunks;
        uploadedBytes = resumeState.uploadedBytes;
        
        console.log("📥 Resuming upload:", { uploadId, progress: Math.round((uploadedBytes / file.size) * 100) + '%' });
        await uploadStateManager.resumeUpload(uploadId);
      } else {
        // Initiate new upload
        uploadId = generateUploadId();
        setCurrentUploadId(uploadId);

        console.log("🚀 Initiating new upload...");
        const initResponse = await fetch("/api/upload/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            taskId: task.id,
            clientId: task.clientId,
            folderType,
          }),
        });

        if (!initResponse.ok) {
          throw new Error("Failed to initiate upload");
        }

        const initData = await initResponse.json();
        key = initData.key;
        s3UploadId = initData.uploadId;

        // Save initial state
        const numChunks = Math.ceil(file.size / CHUNK_SIZE);
        await uploadStateManager.saveUploadState({
          id: uploadId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          taskId: task.id,
          clientId: task.clientId,
          folderType,
          uploadId: s3UploadId,
          key,
          uploadedParts: [],
          uploadedBytes: 0,
          totalChunks: numChunks,
          completedChunks: [],
          status: 'uploading',
          startedAt: Date.now(),
          lastUpdated: Date.now(),
        });
      }

      // Prepare chunks
      const numChunks = Math.ceil(file.size / CHUNK_SIZE);
      const chunks: Array<{ chunk: Blob; partNumber: number }> = [];

      for (let i = 0; i < numChunks; i++) {
        const partNumber = i + 1;
        
        // Skip already uploaded chunks
        if (completedChunks.includes(partNumber)) {
          console.log(`⏭️ Skipping already uploaded chunk ${partNumber}`);
          continue;
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        chunks.push({ chunk, partNumber });
      }

      const startTime = Date.now();

      // Upload remaining chunks in parallel
      for (let i = 0; i < chunks.length; i += PARALLEL_UPLOADS) {
        // Check if paused
        const state = await uploadStateManager.getUploadState(uploadId);
        if (state?.status === 'paused') {
          console.log("⏸️ Upload paused");
          setUploading(false);
          return;
        }

        const batch = chunks.slice(i, i + PARALLEL_UPLOADS);
        console.log(`⚡ Uploading batch with ${batch.length} chunks`);

        const batchResults = await Promise.all(
          batch.map(({ chunk, partNumber }) =>
            uploadChunk(chunk, partNumber, key, s3UploadId, file.type)
          )
        );

        uploadedParts.push(...batchResults);
        completedChunks.push(...batch.map(b => b.partNumber));

        uploadedBytes += batch.reduce((sum, { chunk }) => sum + chunk.size, 0);
        const progressPercent = Math.round((uploadedBytes / file.size) * 100);
        setProgress(progressPercent);

        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const speedMBps = uploadedBytes / (1024 * 1024) / elapsedSeconds;
        setUploadSpeed(speedMBps);

        // Save progress
        await uploadStateManager.updateProgress(
          uploadId,
          uploadedBytes,
          completedChunks,
          uploadedParts
        );
      }

      // Sort and complete
      uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);

      console.log("🔄 Completing upload...");
      const completeResponse = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          uploadId: s3UploadId,
          parts: uploadedParts,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          taskId: task.id,
          userId: user?.id,
        }),
      });

      if (!completeResponse.ok) {
        throw new Error("Failed to complete upload");
      }

      const result = await completeResponse.json();
      console.log("✅ Upload complete!");

      await uploadStateManager.markAsCompleted(uploadId);
      setProgress(100);

      const uploadedFile = {
        id: result.fileId,
        name: result.fileName,
        url: result.fileUrl,
        mimeType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user?.name || "Unknown",
      };

      onUploadComplete([...(task.files || []), uploadedFile]);

      setTimeout(() => {
        setOpen(false);
        setUploading(false);
        setSelectedFile(null);
        setProgress(0);
        setCurrentUploadId(null);
        checkResumableUploads();
      }, 1500);
    } catch (error: any) {
      console.error("❌ Upload failed:", error);
      
      if (uploadId) {
        await uploadStateManager.markAsFailed(uploadId, error.message);
      }
      
      setError(error.message || "Upload failed");
      setUploading(false);
    }
  };

  const pauseUpload = async () => {
    if (currentUploadId) {
      await uploadStateManager.pauseUpload(currentUploadId);
      setPaused(true);
      setUploading(false);
      checkResumableUploads();
    }
  };

  const resumeUpload = async (uploadState: UploadState) => {
    if (!selectedFile) {
      setError("Please select the original file to resume");
      return;
    }
    
    await startUpload(selectedFile, uploadState);
  };

  const cancelUpload = async () => {
    if (currentUploadId) {
      const state = await uploadStateManager.getUploadState(currentUploadId);
      if (state) {
        await fetch("/api/upload/abort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: state.key, uploadId: state.uploadId }),
        });
      }
      
      await uploadStateManager.deleteUploadState(currentUploadId);
      setUploading(false);
      setPaused(false);
      setCurrentUploadId(null);
      checkResumableUploads();
    }
  };

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
            Upload File
            <RefreshCw className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground font-normal">Resumable</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Show resumable uploads */}
          {resumableUploads.length > 0 && !uploading && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Incomplete uploads found:</p>
                {resumableUploads.map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm">{upload.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round((upload.uploadedBytes / upload.fileSize) * 100)}% complete
                      </p>
                    </div>
                    <Button size="sm" onClick={() => resumeUpload(upload)}>
                      <Play className="h-3 w-3 mr-1" />
                      Resume
                    </Button>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Folder Selection */}
          <div>
            <Label>Upload to</Label>
            <RadioGroup
              value={folderType}
              onValueChange={(val) =>
                setFolderType(val as "rawFootage" | "essentials")
              }
              disabled={uploading}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="rawFootage" id="raw" />
                <Label htmlFor="raw" className="cursor-pointer">
                  Raw Footage
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="essentials" id="essentials" />
                <Label htmlFor="essentials" className="cursor-pointer">
                  Elements
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* File Selection */}
          {!uploading && !selectedFile && (
            <div>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
                className="hidden"
                id="file-input"
                accept="video/*,image/*,.pdf,.doc,.docx"
              />
              <label
                htmlFor="file-input"
                className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer hover:border-primary transition-colors"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Click to select file
                </span>
              </label>
            </div>
          )}

          {/* Selected File */}
          {selectedFile && !uploading && !paused && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileIcon className="h-5 w-5" />
              <div className="flex-1">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(selectedFile.size)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedFile?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {uploadSpeed > 0 && `${formatSpeed(uploadSpeed)} • `}
                    {progress}% complete
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={pauseUpload}>
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelUpload}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="relative w-full bg-gray-200 rounded-full h-2">
                <div
                  className="absolute top-0 left-0 bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success */}
          {progress === 100 && !error && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>Upload complete!</AlertDescription>
            </Alert>
          )}

          {/* Upload Button */}
          {selectedFile && !uploading && !paused && (
            <Button
              onClick={() => startUpload(selectedFile)}
              className="w-full"
            >
              <Zap className="h-4 w-4 mr-2" />
              Start Upload
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}