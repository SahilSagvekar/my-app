"use client";

import { useState, useEffect, useMemo, DragEvent } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
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
  Clock,
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
    let folderType =
      file.folderType || file.subfolder || file.section || file.category;

    // Fallback: Try to extract folder type from file URL or path
    if (!folderType && file.url) {
      const url = file.url.toLowerCase();
      if (url.includes("/main/") || url.includes("/main-")) {
        folderType = "main";
      } else if (
        url.includes("/music-license/") ||
        url.includes("/music-license-") ||
        url.includes("/music_license")
      ) {
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
  folderType?: string; // "main", "thumbnails", "music-license", "tiles", "covers"
  version?: number;
  isActive?: boolean;
}

// 🔥 Task Feedback interface for version-tracked comments
interface TaskFeedbackItem {
  id: string;
  fileId?: string;
  folderType: string; // "main", "thumbnails", "music-license", "tiles", "covers"
  feedback: string;
  status: string; // "needs_revision", "approved"
  timestamp?: string; // Video timestamp like "1:30"
  category?: string; // "design", "content", "timing", "technical", "spelling", "other"
  createdAt: string;
  resolvedAt?: string;
  fileVersion?: number; // The version of the file this feedback relates to
  fileName?: string;
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
  taskFeedback?: TaskFeedbackItem[]; // 🔥 Version-tracked feedback
  // 🔥 NEW: For weekly task distribution
  monthlyDeliverableId?: string;
  monthlyQuantity?: number; // Total tasks per month for this deliverable
  taskNumber?: number; // Task number (extracted from title)
}

/* -------------------------------------------------------------------------- */
/* 🔥 FILE PREVIEW COMPONENT                                                  */
/* -------------------------------------------------------------------------- */

function FilePreviewCard({
  file,
  onView,
}: {
  file: TaskFile;
  onView: () => void;
}) {
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
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] sm:max-h-[80vh] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            Task Files ({files.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 overflow-y-auto max-h-[70vh] sm:max-h-[60vh]">
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
                        Uploaded{" "}
                        {new Date(file.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <Button size="sm" variant="outline" className="shrink-0">
                    <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Open</span>
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
  const uploadValidation =
    task.status === "in_progress" ? validateRequiredUploads(task) : null;

  return (
    <>
      <Card
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && onDragStart(e, task)}
        className={`transition-all ${
          isDraggable
            ? "cursor-grab active:cursor-grabbing hover:shadow-md"
            : "cursor-not-allowed opacity-75"
        } ${isDragging ? "opacity-50 scale-95 ring-2 ring-primary" : ""}`}
      >
        <CardContent className="p-3">
          {/* Drag Handle + Title */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <h4 className="font-medium text-xs truncate">{task.title}</h4>
            </div>
            <Badge
              variant={task.status === "completed" ? "default" : "secondary"}
              className="text-[10px] flex-shrink-0 ml-1 px-1.5 py-0 h-4"
            >
              {task.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>

          {/* Deliverable Type + Description combined */}
          <div className="mb-2">
            {task.deliverableType && (
              <Badge
                variant="outline"
                className="text-[10px] mb-1 mr-1 px-1.5 py-0 h-4"
              >
                {task.deliverableType.replace(/_/g, " ")}
              </Badge>
            )}
            <p className="text-xs text-muted-foreground line-clamp-1">
              {task.description}
            </p>
          </div>

          {/* Compact Upload Progress for In Progress Tasks */}
          {task.status === "in_progress" && uploadValidation && (
            <div className="mb-2 p-1.5 bg-muted/50 rounded text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium">
                  Upload Progress:
                </span>
                <span
                  className={`text-[10px] ${
                    uploadValidation.isComplete
                      ? "text-green-600"
                      : "text-amber-600"
                  }`}
                >
                  {uploadValidation.isComplete
                    ? "✓ Ready"
                    : `${uploadValidation.uploadedSections.length}/${
                        uploadValidation.uploadedSections.length +
                        uploadValidation.missingUploads.length
                      }`}
                </span>
              </div>
            </div>
          )}

          {/* 🔥 VERSION-TAGGED FEEDBACK - New format with version badges */}
          {task.taskFeedback && task.taskFeedback.length > 0 && (
            <div className="mb-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span className="text-[10px] font-semibold text-destructive">
                  QC Feedback ({task.taskFeedback.filter(fb => fb.status === "needs_revision").length})
                </span>
              </div>

              <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                {task.taskFeedback
                  .filter(fb => fb.status === "needs_revision")
                  .map((fb) => (
                    <Alert
                      key={fb.id}
                      variant="destructive"
                      className="py-1.5"
                    >
                      <AlertDescription className="text-[10px]">
                        {/* Version and Section badges */}
                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                            V{fb.fileVersion || 1}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 capitalize">
                            {fb.folderType === "main" ? "📁 Main" :
                              fb.folderType === "thumbnails" ? "🖼️ Thumb" :
                                fb.folderType === "tiles" ? "🎨 Tiles" :
                                  fb.folderType === "music-license" ? "🎵 Music" :
                                    fb.folderType}
                          </Badge>
                          {fb.timestamp && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-blue-50">
                              ⏱️ {fb.timestamp}
                            </Badge>
                          )}
                          {fb.category && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 capitalize">
                              {fb.category}
                            </Badge>
                          )}
                        </div>

                        {/* Feedback text */}
                        <p className="whitespace-pre-wrap line-clamp-2">{fb.feedback}</p>

                        {/* File reference if available */}
                        {fb.fileName && (
                          <p className="text-muted-foreground mt-0.5 text-[9px] truncate">
                            📎 {fb.fileName}
                          </p>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
              </div>
            </div>
          )}

          {/* Compact Due Date + Files */}
          <div className="flex items-center justify-between mb-2 text-xs">
            <span
              className={`text-[10px] ${
                isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
              }`}
            >
              Due {new Date(task.dueDate).toLocaleDateString()}
              {isOverdue && " ⚠"}
            </span>

            {task.files?.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                <FileText className="h-2.5 w-2.5 mr-0.5" />
                {task.files.length}
              </Badge>
            )}
          </div>

          {/* Compact FILE PREVIEWS - Only show if files exist and not in progress (to avoid duplication) */}
          {task.files &&
            task.files.length > 0 &&
            task.status !== "in_progress" && (
              <div className="mb-2">
                <div className="space-y-0.5">
                  {task.files.slice(0, 1).map((file: TaskFile) => (
                    <FilePreviewCard
                      key={file.id}
                      file={file}
                      onView={() => window.open(file.url, "_blank")}
                    />
                  ))}
                  {task.files.length > 1 && (
                    <button
                      className="text-[10px] text-primary hover:underline w-full text-left"
                      onClick={() => setShowFiles(true)}
                    >
                      +{task.files.length - 1} more
                    </button>
                  )}
                </div>
              </div>
            )}

          {/* 🔥 Upload Section */}
          {(task.status === "pending" || task.status === "rejected") && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
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
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between pb-2 border-b">
        <h3 className="font-medium text-sm sm:text-base">{title}</h3>
        <Badge variant="secondary" className="text-xs">
          {tasks.length}
        </Badge>
      </div>

      <div
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, status)}
        onDragLeave={onDragLeave}
        className={`space-y-3 sm:space-y-4 min-h-[200px] sm:min-h-[400px] p-2 rounded-lg transition-all duration-200 ${getDropZoneStyles()}`}
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
  const [deliverableTypeFilter, setDeliverableTypeFilter] =
    useState<string>("all");
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
              // 🔥 NEW: Monthly deliverable info for weekly distribution
              monthlyDeliverableId: t.monthlyDeliverableId || null,
              monthlyQuantity: t.monthlyDeliverable?.quantity || 4, // Default to 4 if not set
              files: t.files || [],
              qcNotes: t.qcNotes || null,
              rejectionReason: t.rejectionReason || null,
              feedback: t.feedback || null,
              // 🔥 Map taskFeedback with file version info from nested file data
              taskFeedback: (t.taskFeedback || []).map((fb: any) => ({
                id: fb.id,
                fileId: fb.fileId,
                folderType: fb.folderType,
                feedback: fb.feedback,
                status: fb.status,
                timestamp: fb.timestamp,
                category: fb.category,
                createdAt: fb.createdAt,
                resolvedAt: fb.resolvedAt,
                // Use nested file data from API response
                fileVersion: fb.file?.version || 1,
                fileName: fb.file?.name || null,
              })),
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

  // 🔥 WEEKLY TASK DISTRIBUTION LOGIC
  // This calculates which tasks should be visible based on weekly quotas
  const weeklyVisibleTasks = useMemo(() => {
    // Group tasks by deliverable (clientId + deliverableType combo)
    const tasksByDeliverable: Record<string, WorkflowTask[]> = {};

    tasks.forEach((task) => {
      // Create a unique key for each deliverable per client
      const deliverableKey = `${task.clientId}-${
        task.monthlyDeliverableId || task.deliverableType || "default"
      }`;

      if (!tasksByDeliverable[deliverableKey]) {
        tasksByDeliverable[deliverableKey] = [];
      }
      tasksByDeliverable[deliverableKey].push(task);
    });

    const visibleTasks: WorkflowTask[] = [];

    // For each deliverable, calculate weekly quota and determine visible tasks
    Object.keys(tasksByDeliverable).forEach((deliverableKey) => {
      const deliverableTasks = tasksByDeliverable[deliverableKey];

      // Sort tasks by task number (ascending order)
      deliverableTasks.sort((a, b) => {
        const numA = a.taskNumber || 0;
        const numB = b.taskNumber || 0;
        return numA - numB;
      });

      // Get monthly quantity from first task (all tasks in same deliverable should have same quantity)
      const monthlyQuantity = deliverableTasks[0]?.monthlyQuantity || 4;

      // Calculate weekly quota: tasks per month / 4 weeks (minimum 1)
      const weeklyQuota = Math.max(1, Math.ceil(monthlyQuantity / 4));

      // Separate tasks by status
      const pendingTasks = deliverableTasks.filter(
        (t) => t.status === "pending"
      );
      const inProgressTasks = deliverableTasks.filter(
        (t) => t.status === "in_progress"
      );
      const rejectedTasks = deliverableTasks.filter(
        (t) => t.status === "rejected"
      );
      const qcTasks = deliverableTasks.filter(
        (t) => t.status === "ready_for_qc"
      );
      const completedTasks = deliverableTasks.filter(
        (t) => t.status === "completed" || t.status === "approved"
      );

      // 🔥 VISIBILITY RULES:
      // 1. Always show in_progress tasks (editor is working on them)
      // 2. Always show rejected tasks (need revision)
      // 3. Always show ready_for_qc tasks (in QC review)
      // 4. Show pending tasks up to weekly quota (minus in_progress count)

      // Add all active work tasks
      visibleTasks.push(...inProgressTasks);
      visibleTasks.push(...rejectedTasks);
      visibleTasks.push(...qcTasks);

      // Calculate how many more pending tasks to show
      // Weekly quota minus tasks currently being worked on
      const activeWorkCount = inProgressTasks.length + rejectedTasks.length;
      const pendingToShow = Math.max(0, weeklyQuota - activeWorkCount);

      // Add pending tasks up to the quota
      const pendingToAdd = pendingTasks.slice(0, pendingToShow);
      visibleTasks.push(...pendingToAdd);

      // Log for debugging
      console.log(`📊 Deliverable: ${deliverableKey}`, {
        monthlyQuantity,
        weeklyQuota,
        totalTasks: deliverableTasks.length,
        pending: pendingTasks.length,
        inProgress: inProgressTasks.length,
        rejected: rejectedTasks.length,
        qc: qcTasks.length,
        pendingShown: pendingToAdd.length,
        totalVisible:
          inProgressTasks.length +
          rejectedTasks.length +
          qcTasks.length +
          pendingToAdd.length,
      });
    });

    return visibleTasks;
  }, [tasks]);

  // Apply deliverable type filter on top of weekly visible tasks
  const filteredTasks = useMemo(() => {
    if (deliverableTypeFilter === "all") {
      return weeklyVisibleTasks;
    }
    return weeklyVisibleTasks.filter(
      (task) => task.deliverableType === deliverableTypeFilter
    );
  }, [weeklyVisibleTasks, deliverableTypeFilter]);

  // 🔥 Calculate hidden task count for UI feedback
  const hiddenTaskCount = useMemo(() => {
    return tasks.length - weeklyVisibleTasks.length;
  }, [tasks, weeklyVisibleTasks]);

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

  async function handleDrop(
    e: DragEvent<HTMLDivElement>,
    targetStatus: string
  ) {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggingTask) return;

    // 🔥 VALIDATE THE TRANSITION
    const validation = validateTransition(
      draggingTask.status,
      targetStatus,
      draggingTask
    );

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
    const validation = validateTransition(
      draggingTask.status,
      columnStatus,
      draggingTask
    );
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
    {
      id: "pending",
      title: "Pending",
      status: "pending",
      tasks: tasksByStatus.pending,
    },
    {
      id: "inProgress",
      title: "In Progress",
      status: "in_progress",
      tasks: tasksByStatus.inProgress,
    },
    {
      id: "readyForQC",
      title: "Ready for QC",
      status: "ready_for_qc",
      tasks: tasksByStatus.readyForQC,
    },
    {
      id: "revisions",
      title: "Revisions Needed",
      status: "rejected",
      tasks: tasksByStatus.revisions,
    },
  ];

  const totalFilteredTasks = filteredTasks.length;
  const totalTasks = tasks.length;

  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* 🔥 Validation Error Toast */}
      {validationError && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <Alert
            variant="destructive"
            className="w-full sm:w-auto sm:max-w-md shadow-lg"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {validationError}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl">Editor Portal</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Manage your assigned tasks and complete work for QC review.
            <span className="hidden sm:inline text-xs ml-2 text-primary">
              (Drag tasks to change status)
            </span>
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm text-muted-foreground">
                  Filter by:
                </span>
              </div>

              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <Select
                  value={deliverableTypeFilter}
                  onValueChange={setDeliverableTypeFilter}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
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
                    className="text-xs shrink-0"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Show filter info */}
            {deliverableTypeFilter !== "all" && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {totalFilteredTasks}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground">
                    {totalTasks}
                  </span>{" "}
                  tasks filtered by{" "}
                  <Badge variant="secondary" className="ml-1">
                    {deliverableTypeFilter.replace(/_/g, " ")}
                  </Badge>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board with Drag & Drop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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