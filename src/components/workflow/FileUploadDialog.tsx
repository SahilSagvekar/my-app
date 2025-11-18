"use client";

import { useState, useRef } from "react";
import {
  Upload,
  File,
  X,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription } from "../ui/alert";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { WorkflowTask, WorkflowFile, useTaskWorkflow } from "./TaskWorkflowEngine";

interface FileUploadDialogProps {
  task: WorkflowTask;
  onUploadComplete?: (files: WorkflowFile[]) => void;
  trigger?: React.ReactNode;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "completed" | "error";
  driveFileId?: string;
  url?: string;
  error?: string;
}

export function FileUploadDialog({
  task,
  onUploadComplete,
  trigger,
}: FileUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { createQCReviewTask } = useTaskWorkflow();

  // 🔥 REAL Google Drive Upload
  async function uploadFileToBackend(uploadingFile: UploadingFile) {
    const formData = new FormData();

    if (!task.clientId) {
      console.error("❌ MISSING task.clientId", task);
    }

    formData.append("file", uploadingFile.file);
    formData.append("taskId", task.id);
    formData.append("clientId", String(task.clientId));
    formData.append("folderType", "rawFootage");

    try {
      const res = await fetch("/api/tasks/upload/google-drive", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id
            ? {
                ...f,
                status: "completed",
                progress: 100,
                driveFileId: data.driveFileId,
                url: data.webViewLink,
              }
            : f
        )
      );
    } catch (err: any) {
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id
            ? { ...f, status: "error", error: err.message }
            : f
        )
      );
    }
  }

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles: UploadingFile[] = Array.from(files).map((file) => ({
      id: `upload-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: "uploading" as const,
    }));


    setUploadingFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach(uploadFileToBackend);
  };

  const handleCompleteTask = async () => {
    const allDone =
      uploadingFiles.length > 0 &&
      uploadingFiles.every((f) => f.status === "completed");

    if (!allDone) return;

    const workflowFiles: WorkflowFile[] = uploadingFiles.map((f) => ({
      id: f.driveFileId || f.id,
      name: f.file.name,
      url: f.url || "#",
      uploadedAt: new Date().toISOString(),
      uploadedBy: "editor",
      driveFileId: f.driveFileId,
      mimeType: f.file.type,
      size: f.file.size,
    }));

    // 🔥 Mark this task as READY_FOR_QC
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "READY_FOR_QC" }),
    });

    // 🔥 Auto-create QC Task
    await createQCReviewTask(task, workflowFiles);

    onUploadComplete?.(workflowFiles);
    setOpen(false);
    setUploadingFiles([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Task & Upload Files</DialogTitle>
          <DialogDescription>
            Upload completed files. QC review is generated automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Task Info */}
        <div className="p-4 bg-accent/50 rounded-lg">
          <h4 className="font-medium mb-1">{task.title}</h4>
          <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
          <Badge variant="outline">{task.type}</Badge>
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center mt-4 ${
            isDragging ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFileSelect(e.dataTransfer.files);
          }}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="mb-4 text-sm">Drop files or click to browse</p>

          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Select Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>

        {/* File List */}
        {uploadingFiles.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 p-3 mt-3 border rounded-lg"
          >
            <File className="h-4 w-4" />

            <div className="flex-1">
              <p className="text-sm truncate">{file.file.name}</p>
              <Progress value={file.progress} />
            </div>

            {file.status === "completed" && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {file.status === "error" && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setUploadingFiles((prev) =>
                  prev.filter((f) => f.id !== file.id)
                )
              }
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>

          <Button
            disabled={
              uploadingFiles.length === 0 ||
              uploadingFiles.some((f) => f.status === "uploading")
            }
            onClick={handleCompleteTask}
          >
            Complete Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
