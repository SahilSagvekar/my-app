"use client";

import { useState, useEffect, useMemo, DragEvent } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Alert, AlertDescription } from "../ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { TaskUploadSections } from "../workflow/TaskUploadSections";
import {
  Calendar,
  FileText,
  Video,
  Image as ImageIcon,
  File,
  Download,
  Eye,
  AlertCircle,
  ExternalLink,
  Filter,
  GripVertical,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useRouter } from "next/navigation";

/* -------------------------------------------------------------------------- */
/* 🔥 STATUS + TYPE MAPPERS (BACKEND → UI FORMAT)                              */
/* -------------------------------------------------------------------------- */

function mapStatus(status: string) {
  switch (status) {
    case "PENDING":
      return "pending";
    case "IN_PROGRESS":
      return "in_progress";
    case "READY_FOR_QC":
      return "ready_for_qc";
    case "REJECTED":
      return "rejected";
    default:
      return "pending";
  }
}

function mapStatusToBackend(status: string) {
  switch (status) {
    case "pending":
      return "PENDING";
    case "in_progress":
      return "IN_PROGRESS";
    case "ready_for_qc":
      return "READY_FOR_QC";
    case "rejected":
      return "REJECTED";
    default:
      return "PENDING";
  }
}

function mapTaskTypeToWorkflow(type: string) {
  if (["design", "video", "copywriting"].includes(type)) return "edit";
  if (["review", "audit"].includes(type)) return "qc_review";
  if (["schedule"].includes(type)) return "scheduling";
  return "edit";
}

/* -------------------------------------------------------------------------- */
/* 🔥 HELPER: Extract task number from title                                   */
/* -------------------------------------------------------------------------- */

function extractTaskNumber(title: string): number | null {
  const match = title?.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/* -------------------------------------------------------------------------- */
/* 🔥 HELPER: Get required upload sections based on deliverable type          */
/* -------------------------------------------------------------------------- */

interface RequiredSection {
  folderType: string;
  label: string;
}

function getRequiredSections(deliverableType: string): RequiredSection[] {
  // Main task file is always required
  const mainSection: RequiredSection = {
    folderType: "main",
    label: "Main Task File",
  };

  switch (deliverableType) {
    case "Short Form Videos":
    case "Beta Short Form":
      return [
        mainSection,
        { folderType: "music-license", label: "Music Licenses" },
        // thumbnails is optional for these types
      ];

    case "Long Form Videos":
    case "Square Form Videos":
      return [
        mainSection,
        { folderType: "thumbnails", label: "Thumbnails" },
        { folderType: "music-license", label: "Music Licenses" },
      ];

    case "Snapchat Episodes":
      return [
        mainSection,
        { folderType: "tiles", label: "Tiles" },
        { folderType: "music-license", label: "Music Licenses" },
      ];

    default:
      // For unknown types, only main file is required
      return [mainSection];
  }
}

/* -------------------------------------------------------------------------- */
/* 🔥 HELPER: Check if all required files are uploaded                        */
/* -------------------------------------------------------------------------- */

interface UploadValidation {
  isComplete: boolean;
  missingUploads: string[];
  uploadedSections: string[];
}

function validateRequiredUploads(task: WorkflowTask): UploadValidation {
  const requiredSections = getRequiredSections(task.deliverableType || "");
  const files = task.files || [];

  // Get unique folder types from uploaded files
  const uploadedFolderTypes = new Set<string>();
  
  files.forEach((file: any) => {
    // Check various possible properties that might indicate the section
    let folderType = file.folderType || file.subfolder || file.section || file.category;
    
    // Fallback: Try to extract folder type from file URL or path
    if (!folderType && file.url) {
      const url = file.url.toLowerCase();
      if (url.includes("/main/") || url.includes("/main-")) {
        folderType = "main";
      } else if (url.includes("/music-license/") || url.includes("/music-license-") || url.includes("/music_license")) {
        folderType = "music-license";
      } else if (url.includes("/thumbnails/") || url.includes("/thumbnail")) {
        folderType = "thumbnails";
      } else if (url.includes("/tiles/") || url.includes("/tile")) {
        folderType = "tiles";
      }
    }

    // Fallback: Check file name patterns
    if (!folderType && file.name) {
      const name = file.name.toLowerCase();
      if (name.includes("thumbnail") || name.includes("thumb")) {
        folderType = "thumbnails";
      } else if (name.includes("tile")) {
        folderType = "tiles";
      } else if (name.includes("license") || name.includes("music")) {
        folderType = "music-license";
      }
    }
    
    if (folderType) {
      uploadedFolderTypes.add(folderType);
    }
  });

  // If files exist but don't have folderType, check if at least main is covered
  // This handles cases where file metadata doesn't include section info
  if (files.length > 0 && uploadedFolderTypes.size === 0) {
    // Assume files without folderType are for "main" section
    uploadedFolderTypes.add("main");
  }

  const missingUploads: string[] = [];
  const uploadedSections: string[] = [];

  requiredSections.forEach((section) => {
    if (uploadedFolderTypes.has(section.folderType)) {
      uploadedSections.push(section.label);
    } else {
      missingUploads.push(section.label);
    }
  });

  return {
    isComplete: missingUploads.length === 0,
    missingUploads,
    uploadedSections,
  };
}

/* -------------------------------------------------------------------------- */
/* 🔥 WORKFLOW TASK TYPE EXPECTED BY UI                                       */
/* -------------------------------------------------------------------------- */

interface TaskFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

interface WorkflowTask {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  assignedTo: string;
  assignedToName: string;
  assignedToRole: string;
  createdAt: string;
  dueDate: string;
  workflowStep: string;
  clientId: string;
  projectId: string;
  deliverableType?: string;
  files?: TaskFile[];
  qcNotes?: string | null;
  rejectionReason?: string | null;
  feedback?: string | null;
}

/* -------------------------------------------------------------------------- */
/* 🔥 FILE PREVIEW COMPONENT                                                  */
/* -------------------------------------------------------------------------- */

function FilePreviewCard({ file, onView }: { file: TaskFile; onView: () => void }) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith("video/"))
      return <Video className="h-4 w-4 text-blue-600" />;
    if (mimeType?.startsWith("image/"))
      return <ImageIcon className="h-4 w-4 text-green-600" />;
    if (mimeType?.includes("pdf"))
      return <FileText className="h-4 w-4 text-red-600" />;
    return <File className="h-4 w-4 text-gray-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div
      className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50 transition-colors cursor-pointer group"
      onClick={onView}
    >
      <div className="p-1.5 bg-muted rounded">{getFileIcon(file.mimeType)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>
      <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🔥 FILE VIEWER DIALOG                                                      */
/* -------------------------------------------------------------------------- */

function FileViewerDialog({
  files,
  open,
  onOpenChange,
}: {
  files: TaskFile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith("video/"))
      return <Video className="h-5 w-5 text-blue-600" />;
    if (mimeType?.startsWith("image/"))
      return <ImageIcon className="h-5 w-5 text-green-600" />;
    if (mimeType?.includes("pdf"))
      return <FileText className="h-5 w-5 text-red-600" />;
    return <File className="h-5 w-5 text-gray-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Task Files ({files.length})</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 overflow-y-auto max-h-[60vh]">
          {files.map((file) => (
            <Card
              key={file.id}
              className="cursor-pointer hover:border-primary hover:shadow-sm transition-all"
              onClick={() => window.open(file.url, "_blank")}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded">
                    {getFileIcon(file.mimeType)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>
                        Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 🔥 TASK CARD COMPONENT (NOW DRAGGABLE)                                     */
/* -------------------------------------------------------------------------- */

function TaskCard({
  task,
  onUploadComplete,
  onStartTask,
  onDragStart,
  isDragging,
}: {
  task: WorkflowTask;
  onUploadComplete: (files: any[]) => void;
  onStartTask: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, task: WorkflowTask) => void;
  isDragging: boolean;
}) {
  const [showFiles, setShowFiles] = useState(false);
  const isOverdue = new Date(task.dueDate) < new Date();
  
  // 🔥 Tasks in QC review shouldn't be draggable by editors
  const isDraggable = task.status !== "ready_for_qc";

  // 🔥 Get upload validation for in_progress tasks
  const uploadValidation = task.status === "in_progress" 
    ? validateRequiredUploads(task) 
    : null;

  return (
    <>
      <Card
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && onDragStart(e, task)}
        className={`transition-all ${
          isDraggable 
            ? "cursor-grab active:cursor-grabbing hover:shadow-md" 
            : "cursor-not-allowed opacity-75"
        } ${
          isDragging ? "opacity-50 scale-95 ring-2 ring-primary" : ""
        }`}
      >
        <CardContent className="p-4">
          {/* Drag Handle + Title */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h4 className="font-medium text-sm">{task.title}</h4>
            </div>
            <Badge
              variant={task.status === "completed" ? "default" : "secondary"}
              className="text-xs flex-shrink-0"
            >
              {task.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>

          {/* Deliverable Type Badge */}
          {task.deliverableType && (
            <Badge variant="outline" className="text-xs mb-2">
              {task.deliverableType.replace(/_/g, " ")}
            </Badge>
          )}

          <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
            {task.description}
          </p>

          {/* 🔥 Upload Progress for In Progress Tasks */}
          {task.status === "in_progress" && uploadValidation && (
            <div className="mb-4 p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">Upload Progress</span>
                <span className={`text-xs ${uploadValidation.isComplete ? "text-green-600" : "text-amber-600"}`}>
                  {uploadValidation.isComplete ? "✓ Ready for QC" : "Incomplete"}
                </span>
              </div>
              {!uploadValidation.isComplete && uploadValidation.missingUploads.length > 0 && (
                <p className="text-xs text-red-500">
                  Missing: {uploadValidation.missingUploads.join(", ")}
                </p>
              )}
              {uploadValidation.uploadedSections.length > 0 && (
                <p className="text-xs text-green-600">
                  Uploaded: {uploadValidation.uploadedSections.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* QC NOTES */}
          {task.qcNotes && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>QC Feedback:</strong>
                <p className="mt-1 whitespace-pre-wrap">{task.qcNotes}</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between mb-4">
            <span
              className={`text-xs ${
                isOverdue
                  ? "text-red-500 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              Due {new Date(task.dueDate).toLocaleDateString()}
              {isOverdue && " (Overdue)"}
            </span>

            {task.files?.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                {task.files.length} file{task.files.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* FILE PREVIEWS */}
          {task.files && task.files.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Attached Files
                </p>
                {task.files.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setShowFiles(true)}
                  >
                    View all ({task.files.length})
                  </Button>
                )}
              </div>

              {/* Show first 2 files as preview */}
              <div className="space-y-1">
                {task.files.slice(0, 2).map((file: TaskFile) => (
                  <FilePreviewCard
                    key={file.id}
                    file={file}
                    onView={() => window.open(file.url, "_blank")}
                  />
                ))}
              </div>

              {/* Show "X more files" if there are more than 2 */}
              {task.files.length > 2 && (
                <button
                  className="text-xs text-primary hover:underline w-full text-left"
                  onClick={() => setShowFiles(true)}
                >
                  + {task.files.length - 2} more file
                  {task.files.length - 2 !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}

          {/* 🔥 Upload Section */}
          <div className="space-y-2">
            {(task.status === "pending" || task.status === "rejected") && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={onStartTask}
              >
                {task.status === "rejected" ? "Start Revision" : "Start"}
              </Button>
            )}

            {task.status === "in_progress" && (
              <TaskUploadSections
                task={task}
                onUploadComplete={onUploadComplete}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* File Viewer Dialog */}
      {task.files && task.files.length > 0 && (
        <FileViewerDialog
          files={task.files}
          open={showFiles}
          onOpenChange={setShowFiles}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 🔥 DROPPABLE COLUMN COMPONENT                                              */
/* -------------------------------------------------------------------------- */

interface ColumnProps {
  id: string;
  title: string;
  status: string;
  tasks: WorkflowTask[];
  onDragStart: (e: DragEvent<HTMLDivElement>, task: WorkflowTask) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>, targetStatus: string) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  isDragOver: boolean;
  isValidTarget: boolean; // 🔥 NEW: Whether this column is a valid drop target
  isDragging: boolean; // 🔥 NEW: Whether any task is being dragged
  draggingTaskId: string | null;
  onUploadComplete: (taskId: string, files: any[]) => void;
  onStartTask: (taskId: string) => void;
}

function DroppableColumn({
  id,
  title,
  status,
  tasks,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
  isDragOver,
  isValidTarget,
  isDragging,
  draggingTaskId,
  onUploadComplete,
  onStartTask,
}: ColumnProps) {
  // Determine column styling based on drag state
  const getDropZoneStyles = () => {
    if (!isDragging) {
      return "border-2 border-dashed border-transparent";
    }
    if (isDragOver && isValidTarget) {
      return "bg-green-500/10 border-2 border-dashed border-green-500";
    }
    if (isDragOver && !isValidTarget) {
      return "bg-red-500/10 border-2 border-dashed border-red-500";
    }
    if (isValidTarget) {
      return "bg-primary/5 border-2 border-dashed border-primary/50";
    }
    return "bg-muted/30 border-2 border-dashed border-muted-foreground/20 opacity-50";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b">
        <h3 className="font-medium">{title}</h3>
        <Badge variant="secondary" className="text-xs">
          {tasks.length}
        </Badge>
      </div>

      <div
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, status)}
        onDragLeave={onDragLeave}
        className={`space-y-4 min-h-[400px] p-2 rounded-lg transition-all duration-200 ${getDropZoneStyles()}`}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onUploadComplete={(files) => onUploadComplete(task.id, files)}
            onStartTask={() => onStartTask(task.id)}
            onDragStart={onDragStart}
            isDragging={draggingTaskId === task.id}
          />
        ))}

        {tasks.length === 0 && (
          <div
            className={`text-center py-8 rounded-lg ${
              isDragOver && isValidTarget
                ? "text-green-600"
                : isDragOver && !isValidTarget
                ? "text-red-500"
                : "text-muted-foreground"
            }`}
          >
            <p className="text-sm">
              {isDragOver && isValidTarget
                ? "✓ Drop task here"
                : isDragOver && !isValidTarget
                ? "✗ Cannot drop here"
                : "No tasks"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🔥 MAIN EDITOR DASHBOARD                                                   */
/* -------------------------------------------------------------------------- */

export function EditorDashboard() {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [deliverableTypeFilter, setDeliverableTypeFilter] = useState<string>("all");
  const [draggingTask, setDraggingTask] = useState<WorkflowTask | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const { user } = useAuth();

  const currentUser = {
    id: user?.id?.toString() || "",
    name: user?.name || "Editor",
    role: "editor",
  };

  const router = useRouter();

  /* ---------------------------- FETCH REAL DATA ---------------------------- */

  useEffect(() => {
    async function loadTasks() {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();

        console.log("📋 Raw task data from API:", data.tasks?.[0]);

        const formatted: WorkflowTask[] = (data.tasks || [])
          .filter((t: any) => t.assignedTo === Number(currentUser.id))
          .map((t: any) => {
            console.log("🔍 Mapping task:", {
              taskId: t.id,
              clientId: t.clientId,
              title: t.title,
              deliverableType: t.monthlyDeliverable?.type,
            });

            return {
              id: t.id,
              title: t.title,
              description: t.description,
              type: mapTaskTypeToWorkflow(t.taskType),
              status: mapStatus(t.status),
              assignedTo: String(t.assignedTo),
              assignedToName: currentUser.name,
              assignedToRole: currentUser.role,
              createdAt: t.createdAt,
              dueDate: t.dueDate,
              folderType: "outputs",
              outputFolderId: t.outputFolderId,
              workflowStep: "editing",
              clientId: t.clientId,
              projectId: t.clientId,
              deliverableType: t.monthlyDeliverable?.type,
              taskNumber: extractTaskNumber(t.title),
              files: t.files || [],
              qcNotes: t.qcNotes || null,
              rejectionReason: t.rejectionReason || null,
              feedback: t.feedback || null,
            };
          });

        setTasks(formatted);
      } catch (err) {
        console.error("Failed to load tasks:", err);
      }
    }

    loadTasks();
  }, [currentUser.id]);

  /* ----------------------------- DERIVED DATA ------------------------------ */

  const availableDeliverableTypes = useMemo(() => {
    const types = new Set<string>();
    tasks.forEach((task) => {
      if (task.deliverableType) {
        types.add(task.deliverableType);
      }
    });
    return Array.from(types).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (deliverableTypeFilter === "all") {
      return tasks;
    }
    return tasks.filter((task) => task.deliverableType === deliverableTypeFilter);
  }, [tasks, deliverableTypeFilter]);

  /* ----------------------------- DRAG & DROP ------------------------------- */

  // 🔥 WORKFLOW VALIDATION: Define allowed transitions
  function validateTransition(
    fromStatus: string,
    toStatus: string,
    task: WorkflowTask
  ): { valid: boolean; message: string } {
    // Same column - no action needed
    if (fromStatus === toStatus) {
      return { valid: false, message: "" };
    }

    // Define valid transitions for editor role
    const validTransitions: Record<string, string[]> = {
      pending: ["in_progress"], // Can only start task
      in_progress: ["ready_for_qc"], // Can only submit for QC
      rejected: ["in_progress"], // Can only start revision
      ready_for_qc: [], // Editor can't move QC tasks - that's QC's job
    };

    const allowedTargets = validTransitions[fromStatus] || [];

    // Check if transition is allowed
    if (!allowedTargets.includes(toStatus)) {
      // Provide helpful error messages
      if (fromStatus === "pending" && toStatus === "ready_for_qc") {
        return {
          valid: false,
          message: "You must start the task first before submitting for QC",
        };
      }
      if (fromStatus === "pending" && toStatus === "rejected") {
        return {
          valid: false,
          message: "Cannot move pending tasks to revisions",
        };
      }
      if (fromStatus === "in_progress" && toStatus === "pending") {
        return {
          valid: false,
          message: "Cannot move task back to pending once started",
        };
      }
      if (fromStatus === "in_progress" && toStatus === "rejected") {
        return {
          valid: false,
          message: "Only QC can reject tasks",
        };
      }
      if (fromStatus === "ready_for_qc") {
        return {
          valid: false,
          message: "Tasks under QC review cannot be moved by editors",
        };
      }
      if (fromStatus === "rejected" && toStatus === "ready_for_qc") {
        return {
          valid: false,
          message: "You must work on revisions before resubmitting for QC",
        };
      }
      if (fromStatus === "rejected" && toStatus === "pending") {
        return {
          valid: false,
          message: "Cannot move rejected tasks back to pending",
        };
      }
      return {
        valid: false,
        message: "This transition is not allowed",
      };
    }

    // Special validation: Can't submit for QC without ALL required files
    if (toStatus === "ready_for_qc") {
      const uploadValidation = validateRequiredUploads(task);
      
      if (!uploadValidation.isComplete) {
        const missingList = uploadValidation.missingUploads.join(", ");
        return {
          valid: false,
          message: `Missing required uploads: ${missingList}`,
        };
      }
    }

    return { valid: true, message: "" };
  }

  // State for validation error toast
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto-clear validation error after 3 seconds
  useEffect(() => {
    if (validationError) {
      const timer = setTimeout(() => setValidationError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [validationError]);

  function handleDragStart(e: DragEvent<HTMLDivElement>, task: WorkflowTask) {
    // Prevent dragging tasks that are ready for QC (editor shouldn't move these)
    if (task.status === "ready_for_qc") {
      e.preventDefault();
      setValidationError("Tasks under QC review cannot be moved");
      return;
    }
    setDraggingTask(task);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>, targetStatus: string) {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggingTask) return;

    // 🔥 VALIDATE THE TRANSITION
    const validation = validateTransition(draggingTask.status, targetStatus, draggingTask);
    
    if (!validation.valid) {
      if (validation.message) {
        setValidationError(validation.message);
      }
      setDraggingTask(null);
      return;
    }

    const taskId = draggingTask.id;
    const backendStatus = mapStatusToBackend(targetStatus);

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: backendStatus }),
      });

      if (!res.ok) {
        // Revert on failure
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: draggingTask.status } : t
          )
        );
        setValidationError("Failed to update task status. Please try again.");
      }
    } catch (err) {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: draggingTask.status } : t
        )
      );
      setValidationError("Network error. Please try again.");
      console.error("Failed to update task status:", err);
    }

    setDraggingTask(null);
  }

  function handleColumnDragOver(columnStatus: string) {
    return (e: DragEvent<HTMLDivElement>) => {
      handleDragOver(e);
      setDragOverColumn(columnStatus);
    };
  }

  // 🔥 Helper to check if a column is a valid drop target for current dragging task
  function isValidDropTarget(columnStatus: string): boolean {
    if (!draggingTask) return false;
    const validation = validateTransition(draggingTask.status, columnStatus, draggingTask);
    return validation.valid;
  }

  /* ----------------------------- UPDATE STATUS ----------------------------- */

  async function startTask(taskId: string) {
    await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "in_progress" } : t))
    );
  }

  async function handleUploadComplete(taskId: string, files: any[]) {
    const res = await fetch("/api/tasks");
    const data = await res.json();

    const updatedTask = data.tasks.find((t: any) => t.id === taskId);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, files: updatedTask?.files || files } : t
      )
    );
  }

  /* ----------------------------- CLEAR FILTERS ----------------------------- */

  function clearAllFilters() {
    setDeliverableTypeFilter("all");
  }

  const hasActiveFilters = deliverableTypeFilter !== "all";

  /* ----------------------------- GROUPING ---------------------------------- */

  const tasksByStatus = {
    pending: filteredTasks.filter((t) => t.status === "pending"),
    inProgress: filteredTasks.filter((t) => t.status === "in_progress"),
    readyForQC: filteredTasks.filter((t) => t.status === "ready_for_qc"),
    revisions: filteredTasks.filter((t) => t.status === "rejected"),
  };

  const columns = [
    { id: "pending", title: "Pending", status: "pending", tasks: tasksByStatus.pending },
    { id: "inProgress", title: "In Progress", status: "in_progress", tasks: tasksByStatus.inProgress },
    { id: "readyForQC", title: "Ready for QC", status: "ready_for_qc", tasks: tasksByStatus.readyForQC },
    { id: "revisions", title: "Revisions Needed", status: "rejected", tasks: tasksByStatus.revisions },
  ];

  const totalFilteredTasks = filteredTasks.length;
  const totalTasks = tasks.length;

  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* 🔥 Validation Error Toast */}
      {validationError && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <Alert variant="destructive" className="w-auto max-w-md shadow-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1>Editor Portal</h1>
          <p className="text-muted-foreground mt-2">
            Manage your assigned tasks and complete work for QC review.
            <span className="text-xs ml-2 text-primary">(Drag tasks to change status)</span>
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* <div className="text-sm text-muted-foreground">
              Logged in as: <span className="font-medium text-foreground">{currentUser.name}</span>
            </div> */}

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filter by:</span>
              </div>

              <Select
                value={deliverableTypeFilter}
                onValueChange={setDeliverableTypeFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {availableDeliverableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {deliverableTypeFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeliverableTypeFilter("all")}
                  className="text-xs"
                >
                  Clear filter
                </Button>
              )}
            </div>
          </div>

          {/* Show filter info */}
          {deliverableTypeFilter !== "all" && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{totalFilteredTasks}</span> of{" "}
                <span className="font-medium text-foreground">{totalTasks}</span> tasks
                {" "}filtered by{" "}
                <Badge variant="secondary" className="ml-1">
                  {deliverableTypeFilter.replace(/_/g, " ")}
                </Badge>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Rules Info */}
      {/* <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 flex items-center gap-4 flex-wrap">
        <span className="font-medium">Workflow:</span>
        <span>Pending → In Progress</span>
        <span>→</span>
        <span>In Progress → Ready for QC <span className="text-amber-600">(requires files)</span></span>
        <span>→</span>
        <span>Revisions → In Progress</span>
      </div> */}

      {/* Kanban Board with Drag & Drop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => (
          <DroppableColumn
            key={column.id}
            id={column.id}
            title={column.title}
            status={column.status}
            tasks={column.tasks}
            onDragStart={handleDragStart}
            onDragOver={handleColumnDragOver(column.status)}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
            isDragOver={dragOverColumn === column.status}
            isValidTarget={isValidDropTarget(column.status)}
            isDragging={draggingTask !== null}
            draggingTaskId={draggingTask?.id || null}
            onUploadComplete={handleUploadComplete}
            onStartTask={startTask}
          />
        ))}
      </div>
    </div>
  );
}