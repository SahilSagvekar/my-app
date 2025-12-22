// components/workflow/FileUploadDialog.tsx - ULTRA FAST VERSION
"use client";

import { useState } from "react";
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
  Zap
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks
const PARALLEL_UPLOADS = 5; // Upload 5 chunks simultaneously

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
  const [folderType, setFolderType] = useState<"rawFootage" | "essentials">(
    "rawFootage"
  );
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const { user } = useAuth();

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

  const uploadChunk = async (
    chunk: Blob,
    partNumber: number,
    key: string,
    uploadId: string,
    fileType: string
  ) => {
    // Get presigned URL for this part
    const partUrlResponse = await fetch("/api/upload/part-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        uploadId,
        partNumber,
      }),
    });

    if (!partUrlResponse.ok) {
      throw new Error(`Failed to get presigned URL for part ${partNumber}`);
    }

    const { presignedUrl } = await partUrlResponse.json();

    // Upload chunk directly to S3
    const uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      body: chunk,
      headers: {
        "Content-Type": fileType,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload part ${partNumber}`);
    }

    const etag = uploadResponse.headers.get("ETag");
    if (!etag) {
      throw new Error("Failed to get ETag from upload response");
    }

    return {
      ETag: etag.replace(/"/g, ""),
      PartNumber: partNumber,
    };
  };

  const uploadFileMultipart = async (file: File) => {
    setUploading(true);
    setError(null);
    setProgress(0);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      console.log("📋 Task Details:", {
        taskId: task.id,
        clientId: task.clientId,
        folderType,
      });

      // Step 1: Initiate multipart upload
      console.log("🚀 Initiating multipart upload...");
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
        const errorData = await initResponse.json();
        throw new Error(errorData.error || "Failed to initiate upload");
      }

      const { uploadId, key } = await initResponse.json();
      console.log("✅ Upload initiated:", { uploadId, key });

      // Step 2: Prepare chunks
      const numChunks = Math.ceil(file.size / CHUNK_SIZE);
      const chunks: Array<{ chunk: Blob; partNumber: number }> = [];

      for (let i = 0; i < numChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        chunks.push({ chunk, partNumber: i + 1 });
      }

      console.log(`📦 Prepared ${numChunks} chunks for parallel upload`);

      // Step 3: Upload chunks in parallel batches
      const uploadedParts: Array<{ ETag: string; PartNumber: number }> = [];
      let uploadedBytes = 0;
      const startTime = Date.now();

      // Process chunks in parallel batches
      for (let i = 0; i < chunks.length; i += PARALLEL_UPLOADS) {
        if (controller.signal.aborted) {
          await fetch("/api/upload/abort", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, uploadId }),
          });
          throw new Error("Upload cancelled");
        }

        const batch = chunks.slice(i, i + PARALLEL_UPLOADS);
        console.log(`⚡ Uploading batch ${Math.floor(i / PARALLEL_UPLOADS) + 1} with ${batch.length} chunks in parallel`);

        // Upload batch in parallel
        const batchResults = await Promise.all(
          batch.map(({ chunk, partNumber }) =>
            uploadChunk(chunk, partNumber, key, uploadId, file.type)
          )
        );

        uploadedParts.push(...batchResults);

        // Update progress
        uploadedBytes += batch.reduce((sum, { chunk }) => sum + chunk.size, 0);
        const progressPercent = Math.round((uploadedBytes / file.size) * 100);
        setProgress(progressPercent);

        // Calculate upload speed
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const speedMBps = uploadedBytes / (1024 * 1024) / elapsedSeconds;
        setUploadSpeed(speedMBps);

        console.log(`✅ Batch complete (${progressPercent}% total, ${formatSpeed(speedMBps)})`);
      }

      // Sort parts by part number (required by S3)
      uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);

      // Step 4: Complete multipart upload
      console.log("🔄 Completing multipart upload...");
      const completeResponse = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          uploadId,
          parts: uploadedParts,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          taskId: task.id,
          userId: user?.id,
        }),
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.error || "Failed to complete upload");
      }

      const result = await completeResponse.json();
      console.log("✅ Upload complete:", result);

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
        setUploadSpeed(0);
      }, 1500);
    } catch (error: any) {
      console.error("❌ Upload failed:", error);

      if (error.message !== "Upload cancelled") {
        setError(error.message || "Upload failed. Please try again.");
      } else {
        setError("Upload cancelled");
      }

      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file");
      return;
    }

    await uploadFileMultipart(selectedFile);
  };

  const cancelUpload = () => {
    if (abortController) {
      abortController.abort();
      setError("Upload cancelled");
      setUploading(false);
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
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-xs text-muted-foreground font-normal">Ultra Fast Mode</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
                onChange={handleFileSelect}
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

          {/* Selected File Display */}
          {selectedFile && !uploading && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileIcon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(selectedFile.size)}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedFile?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {uploadSpeed > 0 && (
                      <>
                        <Zap className="inline h-3 w-3 text-yellow-500" />
                        {` ${formatSpeed(uploadSpeed)} • `}
                      </>
                    )}
                    {progress}% complete
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={cancelUpload}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative w-full bg-gray-200 rounded-full h-2">
                <div
                  className="absolute top-0 left-0 bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Display */}
          {progress === 100 && !error && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>Upload complete!</AlertDescription>
            </Alert>
          )}

          {/* Upload Button */}
          {selectedFile && !uploading && (
            <Button
              onClick={handleUpload}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              disabled={uploading}
            >
              <Zap className="h-4 w-4 mr-2" />
              Ultra Fast Upload
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}