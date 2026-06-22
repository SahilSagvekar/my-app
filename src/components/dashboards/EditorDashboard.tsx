"use client";

import { useState, useEffect, useMemo, useCallback, DragEvent } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Alert, AlertDescription } from "../ui/alert";
import { LinkLfTask } from "../tasks/LinkLfTask";
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
  RefreshCw,
  Info,
  Play,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useRouter } from "next/navigation";
import { FilePreviewModal } from "../FileViewerModal";
import { toast } from "sonner";
import { EditorCreateTaskDialog } from "../tasks/EditorCreateTaskDialog";
import { RequestRawsButton } from "../editor/RequestRawsButton";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { EditorEodReport } from "./EditorEodReport";

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

function getStatusBadgeStyles(status: string) {
  switch (status) {
    case "pending":
      return "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50";
    case "in_progress":
      return "bg-yellow-50 text-yellow-700 border-yellow-100 hover:bg-yellow-50";
    case "ready_for_qc":
      return "bg-green-50 text-green-700 border-green-100 hover:bg-green-50";
    case "rejected":
      return "bg-red-50 text-red-700 border-red-100 hover:bg-red-50";
    case "completed":
    case "approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50";
    default:
      return "bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-50";
  }
}

// 🔥 Color coding for deliverable types (card-level background)
function getDeliverableTypeColor(deliverableType: string): { bg: string; border: string; ring: string } {
  const type = (deliverableType || '').toLowerCase();

  if (type.includes('short form') || type === 'sf' || type === 'short_form') {
    return { bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-300' };
  }
  if (type.includes('beta short form') || type === 'bsf' || type === 'beta_short_form') {
    return { bg: 'bg-teal-50', border: 'border-teal-200', ring: 'ring-teal-300' };
  }
  if (type === 'sqf' || type.includes('sqf') || type.includes('super quick') || type.includes('square form')) {
    return { bg: 'bg-cyan-50', border: 'border-cyan-200', ring: 'ring-cyan-300' };
  }
  if (type.includes('snapchat') || type === 'snap') {
    return { bg: 'bg-yellow-50', border: 'border-yellow-200', ring: 'ring-yellow-300' };
  }
  if (type.includes('long form') || type === 'lf' || type === 'long_form') {
    return { bg: 'bg-blue-50', border: 'border-blue-200', ring: 'ring-blue-300' };
  }
  if (type.includes('thumbnail') || type.includes('image')) {
    return { bg: 'bg-purple-50', border: 'border-purple-200', ring: 'ring-purple-300' };
  }
  if (type.includes('podcast') || type.includes('audio')) {
    return { bg: 'bg-orange-50', border: 'border-orange-200', ring: 'ring-orange-300' };
  }
  return { bg: 'bg-white', border: 'border-zinc-100', ring: 'ring-zinc-200' };
}

/* -------------------------------------------------------------------------- */
/* 🔥 HELPER: Extract task number from title                                   */
/* -------------------------------------------------------------------------- */

function extractTaskNumber(title: string): number | null {
  // 🔥 Match the LAST number in the string (e.g. "Project_01-12-2024_SF21" -> 21)
  const match = title?.match(/(\d+)$/);
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
  optimizationStatus?: string;
  optimizationError?: string | null;
}

// 🔥 Task Feedback interface for version-tracked comments
interface TaskFeedbackItem {
  id: string;
  fileId?: string;
  folderType: string; // "main", "thumbnails", "music-license", "tiles", "covers"
  feedback: string;
  status: string; // "needs_revision", "acknowledged", "approved"
  timestamp?: string; // Video timestamp like "1:30"
  category?: string; // "design", "content", "timing", "technical", "spelling", "other"
  createdAt: string;
  resolvedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: number;
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
  clientName?: string; // 🔥 Added client name for filtering
  isOneOff?: boolean; // 🔥 Added for visibility logic
  isSponsored?: boolean;
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

  const isOptimizing = file.optimizationStatus === 'PENDING' || file.optimizationStatus === 'PROCESSING';
  const isFailed = file.optimizationStatus === 'FAILED';

  return (
    <div
      className={`flex items-center gap-2 p-2 border rounded transition-colors cursor-pointer group ${isOptimizing ? 'bg-blue-50/50 border-blue-100' : 'hover:bg-muted/50'}`}
      onClick={onView}
    >
      <div className="p-1.5 bg-muted rounded">
        {isOptimizing ? <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" /> : getFileIcon(file.mimeType)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium truncate">{file.name}</p>
          {isOptimizing && (
            <span className="text-[9px] text-blue-600 font-medium animate-pulse">Optimizing...</span>
          )}
          {isFailed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="h-3 w-3 text-red-500" />
              </TooltipTrigger>
              <TooltipContent>{file.optimizationError || 'Optimization failed'}</TooltipContent>
            </Tooltip>
          )}
        </div>
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
  onPreview,
}: {
  files: TaskFile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreview: (file: TaskFile) => void;
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
              onClick={() => onPreview(file)}
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
  onPreview,
  isQuotaComplete,
  onToggleSponsored,
  onAcknowledgeFeedback,
  currentUserId,
}: {
  task: WorkflowTask;
  onUploadComplete: (taskId: string, files: any[]) => void;
  onStartTask: (taskId: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, task: WorkflowTask) => void;
  isDragging: boolean;
  onPreview: (file: TaskFile) => void;
  isQuotaComplete?: boolean;
  onToggleSponsored: (taskId: string, value: boolean) => void;
  onAcknowledgeFeedback?: (taskId: string, feedbackId: string) => void;
  currentUserId?: number;
}) {
  // const [showFiles, setShowFiles] = useState(false);
  // const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Set<string>>(new Set());
  // const [showGuidelines, setShowGuidelines] = useState(false);

  const [showFiles, setShowFiles] = useState(false);
const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Set<string>>(new Set());
const [selectedFeedback, setSelectedFeedback] = useState<TaskFeedbackItem | null>(null);
const [showGuidelines, setShowGuidelines] = useState(false);
  // Version filter for feedback: null = current version (highest), number = specific version
  const allVersions = useMemo(() => {
    if (!task.taskFeedback) return [];
    const versions = [...new Set(task.taskFeedback.map(fb => fb.fileVersion || 1))].sort((a, b) => b - a);
    return versions;
  }, [task.taskFeedback]);
  const currentVersion = allVersions[0] ?? 1;
  const [feedbackVersionFilter, setFeedbackVersionFilter] = useState<number | null>(null);
  const activeVersion = feedbackVersionFilter ?? currentVersion;
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [guidelinesLoading, setGuidelinesLoading] = useState(false);
  const [guidelines, setGuidelines] = useState<{
    id: string;
    title: string;
    content: string;
    category: string;
    clientName?: string | null;
  }[]>([]);
  const [guidelinesError, setGuidelinesError] = useState<string | null>(null);

  const loadGuidelines = async () => {
    if (!task.clientId) {
      setGuidelines([]);
      setGuidelinesError("No client linked to this task.");
      setShowGuidelines(true);
      return;
    }

    try {
      setGuidelinesLoading(true);
      setGuidelinesError(null);
      const res = await fetch(
        `/api/guidelines?role=editor&clientId=${encodeURIComponent(task.clientId)}`
      );
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setGuidelinesError(data.message || "Failed to load guidelines");
        setGuidelines([]);
      } else {
        const mapped = (data.guidelines || []).map((g: any) => ({
          id: g.id,
          title: g.title,
          content: g.content,
          category: g.category,
          clientName: g.client?.companyName || g.client?.name || null,
        }));
        setGuidelines(mapped);
      }
      setShowGuidelines(true);
    } catch (err) {
      console.error("Failed to load guidelines for task:", err);
      setGuidelinesError("Failed to load guidelines");
      setGuidelines([]);
      setShowGuidelines(true);
    } finally {
      setGuidelinesLoading(false);
    }
  };

  const toggleFeedbackExpand = (id: string) => {
    setExpandedFeedbackIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAcknowledge = async (fbId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAcknowledgingId(fbId);
    try {
      const res = await fetch(`/api/tasks/${task.id}/feedback?feedbackId=${fbId}&action=acknowledge`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgedBy: currentUserId || 0 }),
      });
      if (res.ok) {
        onAcknowledgeFeedback?.(task.id, fbId);
      }
    } finally {
      setAcknowledgingId(null);
    }
  };

  const isOverdue = new Date(task.dueDate) < new Date();

  // 🔥 Tasks in QC review can now be dragged back to in_progress by editors
  const isDraggable = true;

  // 🔥 Get upload validation for in_progress tasks
  const uploadValidation =
    task.status === "in_progress" ? validateRequiredUploads(task) : null;

  // 🔥 Get deliverable type color for card background
  const deliverableColors = getDeliverableTypeColor(task.deliverableType || '');

  return (
    <>
      <Card
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && onDragStart(e, task)}
        className={`transition-all ${deliverableColors.bg} ${deliverableColors.border} border ${isDraggable
          ? "cursor-grab active:cursor-grabbing hover:shadow-md"
          : "cursor-not-allowed opacity-75"
          } ${isDragging ? "opacity-50 scale-95 ring-2 ring-primary" : ""}`}
      >
        <CardContent className="p-3">
          {/* Drag Handle + Title + actions */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <h4 className="font-semibold text-[13px] whitespace-normal break-words">
                {task.title || task.clientName || task.deliverableType}
              </h4>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {task.clientId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadGuidelines();
                      }}
                      className="h-5 w-5 rounded-full border border-dashed border-orange-400 text-[9px] font-semibold flex items-center justify-center text-orange-500 hover:bg-orange-50"
                    >
                      G
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    Guidelines – click to view
                  </TooltipContent>
                </Tooltip>
              )}

              {/* 🔥 Info icon — shows video description popup */}
              {task.description && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={e => e.stopPropagation()}
                      className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-blue-50 text-blue-500 transition-colors"
                      title="View description"
                    >
                      <Info className="h-[18px] w-[18px]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="end"
                    className="w-72 p-3 text-xs"
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="font-semibold mb-1.5 text-foreground">Description</p>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {task.description}
                    </p>
                  </PopoverContent>
                </Popover>
              )}

              {task.files?.some(f => f.optimizationStatus === 'PROCESSING' || f.optimizationStatus === 'PENDING') && (
                <div className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 animate-pulse">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  <span>Compressing...</span>
                </div>
              )}
            </div>
          </div>

          {/* Badges row — deliverable type, one-off, quota, sponsor (far right) */}
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            {task.deliverableType && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {task.deliverableType.replace(/_/g, " ")}
              </Badge>
            )}
            {task.id.startsWith("one-off") || (task as any).isOneOff ? (
              <Badge variant="outline" className="text-[10px] h-4 px-1 bg-yellow-50 text-yellow-700 border-yellow-200">
                One-Off
              </Badge>
            ) : null}
            {isQuotaComplete && (
              <Badge className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                ✓ Quota complete
              </Badge>
            )}
            {/* 🔥 Sponsor tag pushed to the far right */}
            <div className="ml-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSponsored(task.id, !task.isSponsored);
                }}
                className={`text-[10px] h-4 px-1.5 rounded border font-medium transition-colors ${
                  task.isSponsored
                    ? "bg-amber-100 text-amber-700 border-amber-400 hover:bg-amber-200"
                    : "bg-transparent text-muted-foreground border-dashed border-yellow-400 hover:border-yellow-500 hover:text-amber-600"
                }`}
                title={task.isSponsored ? "Sponsored — click to unmark" : "Mark as sponsored"}
              >
                {task.isSponsored ? "★ Sponsored" : "Sponsored?"}
              </button>
            </div>
          </div>

          {/* 🔥 VERSION-TAGGED FEEDBACK — popup button instead of inline list */}
          {task.taskFeedback && task.taskFeedback.length > 0 && (() => {
            const visibleFeedback = task.taskFeedback!.filter(fb => (fb.fileVersion || 1) === activeVersion && fb.status !== 'resolved');
            const unresolvedCount = visibleFeedback.length;
            const acknowledgedCount = visibleFeedback.filter(fb => fb.status === 'acknowledged' || !!fb.acknowledgedAt).length;
            return (
              <div className="mb-2">
                {/* Trigger button */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setFeedbackDialogOpen(true); }}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded border text-[10px] font-medium transition-colors ${
                    acknowledgedCount === unresolvedCount
                      ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/20 dark:text-green-400'
                      : 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>Revision Feedback</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-70">{acknowledgedCount}/{unresolvedCount} fixed</span>
                    {allVersions.length > 1 && (
                      <select
                        className="text-[9px] border rounded px-1 py-0 h-4 bg-background text-foreground"
                        value={activeVersion}
                        onChange={e => { e.stopPropagation(); setFeedbackVersionFilter(Number(e.target.value)); }}
                        onClick={e => e.stopPropagation()}
                      >
                        {allVersions.map(v => (
                          <option key={v} value={v}>V{v}{v === currentVersion ? ' (current)' : ''}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </button>

                {/* Dialog popup */}
                <Dialog open={feedbackDialogOpen} onOpenChange={open => { setFeedbackDialogOpen(open); if (!open) setSelectedFeedback(null); }}>
                  <DialogContent className="max-w-sm p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <DialogHeader className="px-4 pt-4 pb-0">
                      <DialogTitle className="text-sm flex items-center gap-2 pr-6">
                        {selectedFeedback ? (
                          <button
                            className="text-[11px] text-primary hover:underline flex items-center gap-1 font-normal"
                            onClick={() => setSelectedFeedback(null)}
                          >
                            ← Back
                          </button>
                        ) : (
                          <span className="flex-1">Revision Feedback</span>
                        )}
                        {selectedFeedback ? (
                          (() => {
                            const isAcknowledged = selectedFeedback.status === 'acknowledged' || !!selectedFeedback.acknowledgedAt;
                            const isAcking = acknowledgingId === selectedFeedback.id;
                            return !isAcknowledged ? (
                              <button
                                className="text-[11px] px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 font-normal ml-auto"
                                disabled={isAcking}
                                onClick={e => handleAcknowledge(selectedFeedback.id, e)}
                              >
                                {isAcking ? '...' : '✓ Mark fixed'}
                              </button>
                            ) : (
                              <span className="text-[11px] text-green-600 font-medium ml-auto">✓ Fixed</span>
                            );
                          })()
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-normal">{acknowledgedCount}/{unresolvedCount} fixed</span>
                        )}
                      </DialogTitle>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-y-auto">
                      {selectedFeedback ? (
                        /* Detail view */
                        <div className="px-4 pb-4 pt-3 space-y-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">V{selectedFeedback.fileVersion || 1}</Badge>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 capitalize">
                              {selectedFeedback.folderType === "main" ? "📁 Main" :
                                selectedFeedback.folderType === "thumbnails" ? "🖼️ Thumb" :
                                selectedFeedback.folderType === "tiles" ? "🎨 Tiles" :
                                selectedFeedback.folderType === "music-license" ? "🎵 Music" :
                                selectedFeedback.folderType}
                            </Badge>
                            {selectedFeedback.timestamp && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-blue-50">⏱️ {selectedFeedback.timestamp}</Badge>
                            )}
                            {selectedFeedback.category && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 capitalize">{selectedFeedback.category}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                            {selectedFeedback.feedback}
                          </p>
                          {selectedFeedback.fileName && (
                            <p className="text-[11px] text-muted-foreground truncate">📎 {selectedFeedback.fileName}</p>
                          )}
                          {selectedFeedback.acknowledgedAt && (
                            <p className="text-[11px] text-green-600">Fixed on {new Date(selectedFeedback.acknowledgedAt).toLocaleDateString()}</p>
                          )}
                        </div>
                      ) : (
                        /* List view */
                        <div className="divide-y mt-3">
                          {visibleFeedback.map(fb => {
                            const isAcknowledged = fb.status === 'acknowledged' || !!fb.acknowledgedAt;
                            const isAcking = acknowledgingId === fb.id;
                            return (
                              <div
                                key={fb.id}
                                className={`px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors ${isAcknowledged ? 'opacity-60' : ''}`}
                                onClick={() => setSelectedFeedback(fb)}
                              >
                                <div className="flex items-start gap-2.5">
                                  <button
                                    className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                      isAcknowledged ? 'bg-green-500 border-green-500 text-white' : 'border-muted-foreground/40 hover:border-green-500'
                                    }`}
                                    onClick={e => { e.stopPropagation(); if (!isAcknowledged) handleAcknowledge(fb.id, e); }}
                                    disabled={isAcking || isAcknowledged}
                                  >
                                    {isAcknowledged && <span className="text-[9px] leading-none">✓</span>}
                                    {isAcking && <span className="text-[9px] leading-none">…</span>}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">V{fb.fileVersion || 1}</Badge>
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 capitalize">
                                        {fb.folderType === "main" ? "📁 Main" :
                                          fb.folderType === "thumbnails" ? "🖼️ Thumb" :
                                          fb.folderType === "tiles" ? "🎨 Tiles" :
                                          fb.folderType === "music-license" ? "🎵 Music" :
                                          fb.folderType}
                                      </Badge>
                                      {fb.timestamp && <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-blue-50">⏱️ {fb.timestamp}</Badge>}
                                    </div>
                                    <p className="text-xs text-foreground line-clamp-2 leading-relaxed">{fb.feedback}</p>
                                  </div>
                                  <span className="text-muted-foreground shrink-0 mt-1 text-xs">›</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            );
          })()}

          {/* Compact Due Date + Files */}
          <div className="flex items-center justify-between mb-2 text-xs">
            {/* <span
              className={`text-[10px] ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
                }`}
            >
              Due {new Date(task.dueDate).toLocaleDateString()}
              {isOverdue && " ⚠"}
            </span> */}

            {/* {(task.files?.length ?? 0) > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                <FileText className="h-2.5 w-2.5 mr-0.5" />
                {task.files?.length}
              </Badge>
            )} */}
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
                      onView={() => onPreview(file)}
                    />
                  ))}
                  {task.files.length > 1 && (
                    <details className="group">
                      <summary className="text-[10px] text-primary hover:underline cursor-pointer list-none">
                        +{task.files.length - 1} more
                      </summary>
                      <div className="mt-0.5 space-y-0.5">
                        {task.files.slice(1).map((file: TaskFile) => (
                          <FilePreviewCard
                            key={file.id}
                            file={file}
                            onView={() => onPreview(file)}
                          />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* 🔗 Linked LF Task — editors link from the SF ticket to its LF */}
          {task.deliverableType && (
            task.deliverableType.toLowerCase().includes('short') ||
            task.deliverableType.toUpperCase().includes('SF')
          ) && (
            <div className="mb-2 border rounded-lg p-2.5 bg-muted/20">
              <LinkLfTask
                sfTaskId={task.id}
                clientId={task.clientId}
                canEdit={true}
              />
            </div>
          )}

          {/* 🔥 Upload Section */}
          {(task.status === "pending" || task.status === "rejected") && (
            <Button
              size="sm"
              className={`w-full ${
                task.status === "rejected" 
                  ? "bg-red-600 text-white hover:bg-red-700" 
                  : "bg-green-500 text-white hover:bg-green-600"
              }`}
              onClick={() => onStartTask(task.id)}
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              {task.status === "rejected" ? "Start Revision" : "Start"}
            </Button>
          )}

          {task.status === "in_progress" && (
            <TaskUploadSections
              task={task}
              onUploadComplete={(files) => onUploadComplete(task.id, files)}
              onBeforeSubmitToQC={() => {
                if (!task.taskFeedback || task.taskFeedback.length === 0) return true;
                const allVersions = [...new Set(task.taskFeedback.map((fb: any) => fb.fileVersion || 1))];
                const latestVersion = Math.max(...(allVersions as number[]));
                const unacknowledged = task.taskFeedback.filter(
                  (fb: any) => (fb.fileVersion || 1) === latestVersion
                    && fb.status !== 'resolved'
                    && fb.status !== 'acknowledged'
                    && !fb.acknowledgedAt
                );
                if (unacknowledged.length > 0) {
                  toast.error(
                    `Mark all ${unacknowledged.length} revision comment${unacknowledged.length > 1 ? 's' : ''} as fixed before sending to QC`
                  );
                  return false;
                }
                return true;
              }}
            />
          )}

          {/* 🔥 NEW: Allow editor to move task back from QC to In Progress */}
          {task.status === "ready_for_qc" && (
            <Button
              size="sm"
              className="w-full text-xs bg-[#ccff00] text-black hover:bg-[#bce600]"
              onClick={() => onStartTask(task.id)}
            >
              ↩ Move Back to In Progress
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Revision Comment Detail Popup */}
<Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
  <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-base text-destructive">
        <AlertCircle className="h-4 w-4" />
        Revision Feedback
      </DialogTitle>
    </DialogHeader>
    {selectedFeedback && (
      <div className="space-y-3 pt-1 overflow-y-auto min-h-0">
        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-xs px-2">
            V{selectedFeedback.fileVersion || 1}
          </Badge>
          <Badge variant="secondary" className="text-xs px-2 capitalize">
            {selectedFeedback.folderType === "main" ? "📁 Main" :
              selectedFeedback.folderType === "thumbnails" ? "🖼️ Thumbnail" :
                selectedFeedback.folderType === "tiles" ? "🎨 Tiles" :
                  selectedFeedback.folderType === "music-license" ? "🎵 Music" :
                    selectedFeedback.folderType === "scheduler" ? "📅 Scheduler" :
                      selectedFeedback.folderType}
          </Badge>
          {selectedFeedback.timestamp && (
            <Badge variant="outline" className="text-xs px-2 bg-blue-50 text-blue-700">
              ⏱️ {selectedFeedback.timestamp}
            </Badge>
          )}
          {selectedFeedback.category && (
            <Badge variant="outline" className="text-xs px-2 capitalize">
              {selectedFeedback.category}
            </Badge>
          )}
        </div>

        {/* Feedback text */}
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 overflow-y-auto max-h-64">
          <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
            {selectedFeedback.feedback}
          </p>
        </div>

        {/* File reference */}
        {selectedFeedback.fileName && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            📎 <span className="truncate">{selectedFeedback.fileName}</span>
          </p>
        )}

        {/* Submitted date */}
        <p className="text-[11px] text-muted-foreground">
          Submitted {new Date(selectedFeedback.createdAt).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit"
          })}
        </p>
      </div>
    )}
  </DialogContent>
</Dialog>

      {/* Guidelines Dialog */}
      <Dialog open={showGuidelines} onOpenChange={setShowGuidelines}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Guidelines
            </DialogTitle>
          </DialogHeader>

          {guidelinesLoading ? (
            <div className="py-6 text-sm text-muted-foreground">
              Loading guidelines...
            </div>
          ) : guidelinesError ? (
            <div className="py-6 text-sm text-destructive">
              {guidelinesError}
            </div>
          ) : guidelines.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">
              No guidelines found for this client.
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {guidelines.map((g) => (
                <div
                  key={g.id}
                  className="border rounded-md p-3 bg-muted/40 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{g.title}</div>
                    {g.clientName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                        {g.clientName}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-pre-wrap">
                    {g.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* File Viewer Dialog */}
      {task.files && task.files.length > 0 && (
        <FileViewerDialog
          files={task.files || []}
          open={showFiles}
          onOpenChange={setShowFiles}
          onPreview={onPreview}
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
  onPreview: (file: TaskFile) => void;
  quotaCompleteTaskIds: Set<string>;
  onToggleSponsored: (taskId: string, value: boolean) => void;
  onAcknowledgeFeedback?: (taskId: string, feedbackId: string) => void;
  currentUserId?: number;
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
  onPreview,
  quotaCompleteTaskIds,
  onToggleSponsored,
  onAcknowledgeFeedback,
  currentUserId,
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
        <Badge variant="outline" className={`text-xs ${getStatusBadgeStyles(status)}`}>
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
            onUploadComplete={onUploadComplete}
            onStartTask={onStartTask}
            onDragStart={onDragStart}
            isDragging={draggingTaskId === task.id}
            onPreview={onPreview}
            isQuotaComplete={quotaCompleteTaskIds.has(task.id)}
            onToggleSponsored={onToggleSponsored}
            onAcknowledgeFeedback={onAcknowledgeFeedback}
            currentUserId={currentUserId}
          />
        ))}

        {tasks.length === 0 && (
          <div
            className={`text-center py-8 rounded-lg ${isDragOver && isValidTarget
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
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [draggingTask, setDraggingTask] = useState<WorkflowTask | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<TaskFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { user } = useAuth();

  // ── Editor task-creation permissions ──────────────────────────────
  const [permittedClients, setPermittedClients] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/editor/task-permissions', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPermittedClients(d.clients || []))
      .catch(() => setPermittedClients([]));
  }, []);
  // ─────────────────────────────────────────────────────────────────

  const currentUser = {
    id: user?.id?.toString() || "",
    name: user?.name || "Editor",
    role: "editor",
  };

  const router = useRouter();

  /* ---------------------------- FETCH REAL DATA ---------------------------- */
  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      // if (monthFilter !== "all") params.set("month", monthFilter);
      if (monthFilter !== "all") params.set("monthFolder", monthFilter);
      const queryString = params.toString();
      const res = await fetch(`/api/tasks${queryString ? `?${queryString}` : ""}`);
      const data = await res.json();

      console.log("🔄 Fetching tasks for editor:", JSON.stringify(data));

      console.log("📋 Raw task data from API:", data.tasks?.[0]);

      // 🔥 Update available months from API response
      if (data.availableMonths) {
        setAvailableMonths(data.availableMonths);
      }

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
            deliverableType: t.monthlyDeliverable?.type || t.oneOffDeliverable?.type,
            taskNumber: extractTaskNumber(t.title),
            isOneOff: !!t.oneOffDeliverable,
            isSponsored: t.isSponsored || false,
            clientName: t.client?.companyName || t.client?.name || "Unknown Client",
            // 🔥 NEW: Monthly deliverable info for weekly distribution
            monthlyDeliverableId: t.monthlyDeliverableId || null,
            monthlyQuantity: t.monthlyDeliverable?.quantity || t.oneOffDeliverable?.quantity || 4, // Default to 4 if not set
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
              acknowledgedAt: fb.acknowledgedAt,
              acknowledgedBy: fb.acknowledgedBy,
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
  }, [currentUser.id, monthFilter]);

  // 🔥 Initial load - run once on mount
  // useEffect(() => {
  //   loadTasks();
  // }, []);

  useEffect(() => {
  if (!currentUser.id) return;
  loadTasks();
}, [loadTasks, currentUser.id]);

  // 🔥 Regular polling for new tasks - every 30 seconds
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     console.log("🔄 Polling for new tasks...");
  //     loadTasks();
  //   }, 30000); // Poll every 30 seconds
  //   return () => clearInterval(interval);
  // }, [loadTasks]);

  useEffect(() => {
  if (!currentUser.id) return;

  const interval = setInterval(() => {
    console.log("🔄 Polling for new tasks...");
    loadTasks();
  }, 30000);

  return () => clearInterval(interval);
}, [loadTasks, currentUser.id]);

  // 🔥 Faster polling when active optimization jobs exist
  // useEffect(() => {
  //   const hasActiveJobs = tasks.some(t => 
  //     t.files?.some(f => f.optimizationStatus === 'PROCESSING' || f.optimizationStatus === 'PENDING')
  //   );

  //   if (hasActiveJobs) {
  //     console.log("⏱️ Active optimization detected, starting fast poll...");
  //     const interval = setInterval(loadTasks, 15000); // Poll every 15s for optimization
  //     return () => clearInterval(interval);
  //   }
  // }, [tasks.length]); // Only re-evaluate when task count changes

  useEffect(() => {
  if (!currentUser.id) return;

  const hasActiveJobs = tasks.some(t =>
    t.files?.some(f =>
      f.optimizationStatus === "PROCESSING" ||
      f.optimizationStatus === "PENDING"
    )
  );

  if (hasActiveJobs) {
    console.log("⏱️ Active optimization detected, starting fast poll...");
    const interval = setInterval(loadTasks, 15000);
    return () => clearInterval(interval);
  }
}, [tasks, loadTasks, currentUser.id]);

  // Global listener for background task updates
  useEffect(() => {
    const handleTaskGlobalUpdate = (e: any) => {
      if (e.detail?.taskId) {
        console.log("🔔 Global update received for task:", e.detail.taskId);
        handleUploadComplete(e.detail.taskId, []);
      }
    };
    window.addEventListener('task-updated', handleTaskGlobalUpdate);
    return () => window.removeEventListener('task-updated', handleTaskGlobalUpdate);
  }, []);

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

  const availableClients = useMemo(() => {
    const clients = new Map<string, string>(); // clientId -> clientName
    tasks.forEach((task) => {
      if (task.clientId && task.clientName) {
        clients.set(task.clientId, task.clientName);
      }
    });
    return Array.from(clients.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // 🔥 WEEKLY TASK DISTRIBUTION LOGIC
  // This calculates which tasks should be visible based on weekly quotas
  const weeklyVisibleTasks = useMemo(() => {
    // Group tasks by deliverable (clientId + deliverableType combo)
    const tasksByDeliverable: Record<string, WorkflowTask[]> = {};

    tasks.forEach((task) => {
      // Create a unique key for each deliverable per client
      // 🔥 One-off tasks should not be grouped/quota'd together; they are separate projects.
      // By using a unique key (task.id), each one-off will be visible as it won't exceed quota.
      const deliverableKey = task.isOneOff
        ? `oneoff-${task.id}`
        : `${task.clientId}-${task.monthlyDeliverableId || task.deliverableType || "default"
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
    let result = weeklyVisibleTasks;

    if (deliverableTypeFilter !== "all") {
      result = result.filter(
        (task) => task.deliverableType === deliverableTypeFilter
      );
    }

    if (clientFilter !== "all") {
      result = result.filter(
        (task) => task.clientId === clientFilter
      );
    }

    return result;
  }, [weeklyVisibleTasks, deliverableTypeFilter, clientFilter]);

  // 🔥 Calculate hidden task count for UI feedback
  const hiddenTaskCount = useMemo(() => {
    return tasks.length - weeklyVisibleTasks.length;
  }, [tasks, weeklyVisibleTasks]);

  // 🔥 Compute which task IDs belong to a fully-submitted deliverable group
  // A group is complete when every task in it is ready_for_qc / completed / approved
  const quotaCompleteTaskIds = useMemo(() => {
    const doneStatuses = new Set(['ready_for_qc', 'completed', 'approved']);
    const groups: Record<string, WorkflowTask[]> = {};
    for (const t of tasks) {
      const key = t.isOneOff
        ? 'oneoff-' + t.id
        : t.clientId + '-' + (t.monthlyDeliverableId || t.deliverableType || 'default');
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    const completeIds = new Set<string>();
    for (const group of Object.values(groups)) {
      if (group.length > 0 && group.every((t) => doneStatuses.has(t.status))) {
        group.forEach((t) => completeIds.add(t.id));
      }
    }
    return completeIds;
  }, [tasks]);

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
      in_progress: ["ready_for_qc", "pending", "rejected"], // Can submit for QC or undo start (move back to pending/rejected)
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

      // 🔥 Gate: all feedback on the current version must be acknowledged before sending to QC
      if (task.taskFeedback && task.taskFeedback.length > 0) {
        const allVersions = [...new Set(task.taskFeedback.map(fb => fb.fileVersion || 1))];
        const latestVersion = Math.max(...allVersions);
        const currentVersionFeedback = task.taskFeedback.filter(
          fb => (fb.fileVersion || 1) === latestVersion && fb.status !== 'resolved'
        );
        const unacknowledged = currentVersionFeedback.filter(
          fb => fb.status !== 'acknowledged' && !fb.acknowledgedAt
        );
        if (unacknowledged.length > 0) {
          return {
            valid: false,
            message: `Mark all ${unacknowledged.length} revision comment${unacknowledged.length > 1 ? 's' : ''} as fixed before sending to QC`,
          };
        }
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
      toast.error("Tasks under QC review cannot be moved");
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

    // 🔥 Always use the latest task state — draggingTask snapshot may be stale
    // after optimistic feedback acknowledgement updates
    const freshTask = tasks.find(t => t.id === draggingTask.id) || draggingTask;

    // 🔥 VALIDATE THE TRANSITION
    const validation = validateTransition(
      freshTask.status,
      targetStatus,
      freshTask
    );

    if (!validation.valid) {
      if (validation.message) {
        toast.error(validation.message);
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
        toast.error("Failed to update task status. Please try again.");
      } else if (toStatus === "ready_for_qc") {
        // 🔥 Check quota completion after moving to ready_for_qc
        checkDeliverableQuota(draggingTask);
      }
    } catch (err) {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: draggingTask.status } : t
        )
      );
      toast.error("Network error. Please try again.");
      console.error("Failed to update task status:", err);
    }

    setDraggingTask(null);
  }

  // 🔥 Check if all tasks for a deliverable+client are done after submitting one for QC
  function checkDeliverableQuota(completedTask: WorkflowTask) {
    if (!completedTask.monthlyDeliverableId && !completedTask.deliverableType) return;

    // Get all tasks for the same deliverable group
    const siblingTasks = tasks.filter((t) => {
      if (completedTask.monthlyDeliverableId) {
        return t.monthlyDeliverableId === completedTask.monthlyDeliverableId;
      }
      return t.clientId === completedTask.clientId && t.deliverableType === completedTask.deliverableType;
    });

    // Count tasks that are now "done" from the editor's perspective
    // (ready_for_qc, completed, approved — i.e. the editor has submitted them all)
    const doneStatuses = ["ready_for_qc", "completed", "approved"];
    const doneTasks = siblingTasks.filter((t) =>
      t.id === completedTask.id
        ? true // the task we just moved counts as done
        : doneStatuses.includes(t.status)
    );

    if (doneTasks.length === siblingTasks.length && siblingTasks.length > 0) {
      const clientName = completedTask.clientName || "this client";
      const deliverableLabel = completedTask.deliverableType
        ? completedTask.deliverableType.replace(/_/g, " ")
        : "deliverable";
      const count = siblingTasks.length;

      toast.success(
        `✅ All ${count} ${deliverableLabel} task${count !== 1 ? "s" : ""} for ${clientName} submitted! Move to your next deliverable or client.`,
        { duration: 6000 }
      );
    }
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

  /* ----------------------------- SPONSORED TOGGLE -------------------------- */

  const handleToggleSponsored = useCallback(async (taskId: string, value: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isSponsored: value } : t))
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}/sponsored`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSponsored: value }),
      });
      if (!res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, isSponsored: !value } : t))
        );
        toast.error("Failed to update sponsored status");
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, isSponsored: !value } : t))
      );
      toast.error("Network error");
    }
  }, []);

  /* ----------------------------- UPDATE STATUS ----------------------------- */

  const startTask = useCallback(async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "in_progress" } : t))
    );
  }, []);

  // 🔥 Optimistic update when editor acknowledges a feedback item
  const handleAcknowledgeFeedback = useCallback((taskId: string, feedbackId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        taskFeedback: (t.taskFeedback || []).map(fb =>
          fb.id === feedbackId
            ? { ...fb, status: 'acknowledged', acknowledgedAt: new Date().toISOString() }
            : fb
        )
      };
    }));
  }, []);

  const handleUploadComplete = useCallback(async (taskId: string, files: any[]) => {
    const res = await fetch("/api/tasks");
    const data = await res.json();

    const updatedTask = data.tasks.find((t: any) => t.id === taskId);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, files: updatedTask?.files || files } : t
      )
    );
  }, []);

  const handlePreview = useCallback((file: any) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  }, []);

  /* ----------------------------- CLEAR FILTERS ----------------------------- */

  function clearAllFilters() {
    setDeliverableTypeFilter("all");
    setClientFilter("all");
    setMonthFilter("all");
  }

  const hasActiveFilters = deliverableTypeFilter !== "all" || clientFilter !== "all" || monthFilter !== "all";

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

      <div className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Editor Portal
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Manage your assigned tasks and complete work for QC review.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RequestRawsButton clients={permittedClients} />
            <EditorCreateTaskDialog
              permittedClients={permittedClients}
              onTaskCreated={() => loadTasks()}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm">Filter by:</span>
            </div>

            <Select value={deliverableTypeFilter} onValueChange={setDeliverableTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Deliverables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Deliverables</SelectItem>
                {availableDeliverableTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {availableClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={monthFilter} onValueChange={(value) => { setMonthFilter(value); }}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="h-4 w-4 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {availableMonths.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">
                Clear Filters
              </Button>
            )}


          </div>

          {/* Show filter info */}
          {/* {deliverableTypeFilter !== "all" && (
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
            )} */}
      </div>

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
            onPreview={handlePreview}
            quotaCompleteTaskIds={quotaCompleteTaskIds}
            onToggleSponsored={handleToggleSponsored}
            onAcknowledgeFeedback={handleAcknowledgeFeedback}
            currentUserId={Number(currentUser.id) || undefined}
          />
        ))}
      </div>
      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />

      {/* EOD Report Section */}
      <EditorEodReport />

    </div>
  );
}