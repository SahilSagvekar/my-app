"use client";

import { useState, useEffect, useMemo, useCallback, useRef, DragEvent } from "react";
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
import { TaskUploadSections, classifyDeliverableType } from "../workflow/TaskUploadSections";
import { FileUploadDialog } from "../workflow/FileUploadDialog-Resumable";
import { TaskActionsMenu, computeTaskActionCount } from "../workflow/TaskActionsMenu";
import {
  Calendar,
  FileText,
  Video,
  Music,
  Image as ImageIcon,
  LayoutGrid,
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
  ScrollText,
  Unlink,
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
  Check,
  Square,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useRouter } from "next/navigation";
import { FilePreviewModal } from "../FileViewerModal";
import { toast } from "sonner";
import { EditorCreateTaskDialog } from "../tasks/EditorCreateTaskDialog";
import { RequestRawsButton } from "../editor/RequestRawsButton";
import { InstructionsBanner } from "../editor/InstructionsBanner";
import {
  getTaskCardThumbnailUrl,
  taskThumbnailFallbackLabel,
} from "../../lib/task-thumbnail";
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
    case "REJECTED_BY_QC":
    case "REJECTED_BY_CLIENT":
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
      // Editor UI uses a single "rejected" bucket; default write stays QC-side.
      // Actual client/QC/scheduler writes go through their own dashboards.
      return "REJECTED_BY_QC";
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

function isSfLfDeliverable(type?: string | null): boolean {
  if (!type) return false;
  const t = type.toUpperCase().replace(/[\s_-]+/g, "");
  if (t === "SF" || t === "LF") return true;
  if (t.startsWith("SF") || t.startsWith("LF")) return true;
  return t.includes("SHORTFORM") || t.includes("LONGFORM") || t.includes("SHORT") || t.includes("LONG");
}

function scriptRefTitle(ref?: string | null): string | null {
  if (!ref) return null;
  try {
    const parsed = JSON.parse(ref) as { scriptTitle?: string };
    return parsed.scriptTitle?.trim() || "Linked script";
  } catch {
    return "Linked script";
  }
}

function getStatusBadgeStyles(status: string) {
  switch (status) {
    case "pending":
      return "bg-[#E5E7EB] text-[#374151] border-transparent font-semibold";
    case "in_progress":
      return "bg-[#DBEAFE] text-[#2563EB] border-transparent font-semibold";
    case "ready_for_qc":
      return "bg-[#DCFCE7] text-[#16A34A] border-transparent font-semibold";
    case "rejected":
      return "bg-[#FEE2E2] text-[#EF4444] border-transparent font-semibold";
    case "completed":
    case "approved":
      return "bg-[#DCFCE7] text-[#16A34A] border-transparent font-semibold";
    default:
      return "bg-gray-100 text-gray-700 border-transparent font-semibold";
  }
}

// 🔥 Color coding for deliverable types (card-level background)
function getDeliverableTypeColor(deliverableType: string): { bg: string; border: string; ring: string } {
  const type = (deliverableType || '').toLowerCase();

  if (type.includes('beta short form') || type === 'bsf' || type === 'beta_short_form' || type.includes('beta')) {
    return { bg: 'bg-teal-50', border: 'border-teal-200', ring: 'ring-teal-300' };
  }
  if (type.includes('short form') || type === 'sf' || type === 'short_form') {
    return { bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-300' };
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

function getRequiredSections(deliverableType: string, taskTitle?: string): RequiredSection[] {
  const dt = (deliverableType || '').trim().toLowerCase();
  const title = (taskTitle || '').trim().toLowerCase();

  let category = 'OTHER_VIDEO';
  if (dt) {
    if (dt === 'bsf' || dt.includes('beta')) category = 'BETA_SHORT_FORM';
    else if (dt === 'sf' || dt.includes('short form') || dt.includes('short-form') || dt.includes('short_form') || dt === 'short') category = 'SHORT_FORM';
    else if (dt === 'lf' || dt.includes('long form') || dt.includes('long-form') || dt.includes('long_form') || dt === 'long') category = 'LONG_FORM';
    else if (dt === 'sqf' || dt.includes('square form') || dt.includes('square-form') || dt.includes('square_form') || dt === 'square') category = 'SQUARE_FORM';
    else if (dt === 'sep' || dt.includes('snapchat')) category = 'SNAPCHAT';
    else if (dt === 'st' || dt.includes('story') || dt.includes('stories')) category = 'STORIES';
    else if (dt === 'hp' || dt.includes('hard post') || dt.includes('graphic image')) category = 'HARD_POST';
    else if (dt === 'tp' || dt.includes('text post')) category = 'TEXT_POST';
  } else if (title) {
    if (title.includes('_bsf') || title.includes('-bsf') || title.includes('betashortform')) category = 'BETA_SHORT_FORM';
    else if (title.includes('_sf') || title.includes('-sf') || title.includes('shortform') || title.includes('_short')) category = 'SHORT_FORM';
    else if (title.includes('_lf') || title.includes('-lf') || title.includes('longform') || title.includes('_long')) category = 'LONG_FORM';
    else if (title.includes('_sqf') || title.includes('-sqf') || title.includes('squareform')) category = 'SQUARE_FORM';
    else if (title.includes('_sep') || title.includes('-sep') || title.includes('snapchat')) category = 'SNAPCHAT';
    else if (title.includes('_st') || title.includes('-st') || title.includes('story') || title.includes('stories')) category = 'STORIES';
    else if (title.includes('_hp') || title.includes('-hp') || title.includes('hardpost')) category = 'HARD_POST';
    else if (title.includes('_tp') || title.includes('-tp') || title.includes('textpost')) category = 'TEXT_POST';
  }

  // Main task file is always required (except text posts)
  const mainSection: RequiredSection = {
    folderType: "main",
    label: "Main Task File",
  };

  switch (category) {
    case "SHORT_FORM":
    case "BETA_SHORT_FORM":
    case "STORIES":
      return [
        mainSection,
        { folderType: "music-license", label: "Music Licenses" },
      ];

    case "LONG_FORM":
    case "SQUARE_FORM":
      return [
        mainSection,
        { folderType: "thumbnails", label: "Thumbnails" },
        { folderType: "music-license", label: "Music Licenses" },
      ];

    case "SNAPCHAT":
      return [
        mainSection,
        { folderType: "tiles", label: "Tiles" },
        { folderType: "music-license", label: "Music Licenses" },
      ];

    default:
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
  const requiredSections = getRequiredSections(task.deliverableType || "", task.title);
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
  authorName?: string | null;
  authorRole?: string | null; // 'qc' | 'client' | other
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
  tags?: { id: string; name: string }[];
  // Linked shoot script reference — JSON string { shootTaskId, scriptId, scriptTitle }
  shootScriptRef?: string | null;
  // 🔥 Task Actions feature — see /api/tasks columns fix; these were
  // previously missing from the GET response entirely.
  linkedRawFootagePaths?: string[] | null;
  relatedTaskId?: string | null;
  noActionRequired?: boolean;
}

/* -------------------------------------------------------------------------- */
/* 🔥 FILE PREVIEW COMPONENT                                                  */
/* -------------------------------------------------------------------------- */

function FilePreviewCard({
  file,
  onView,
  onDownload,
}: {
  file: TaskFile;
  onView: () => void;
  onDownload?: () => void;
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
          <p className="text-xs font-medium truncate" title={file.name}>{file.name}</p>
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
      {onDownload && (
        <button
          type="button"
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          title="Download"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      )}
      <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🔥 FILE VIEWER DIALOG                                                      */
/* -------------------------------------------------------------------------- */

function FileViewerDialog({
  files,
  title = "Task Files",
  open,
  onOpenChange,
  onPreview,
  onDownload,
}: {
  files: TaskFile[];
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreview: (file: TaskFile) => void;
  onDownload?: (file: TaskFile) => void;
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
            {title} ({files.length})
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-sm truncate" title={file.name}>{file.name}</p>
                      {file.folderType && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                          {file.folderType === "main" ? "📁 Main" :
                            file.folderType === "music-license" ? "🎵 Music License" :
                            file.folderType === "thumbnails" ? "🖼️ Thumbnail" :
                            file.folderType === "tiles" ? "🎨 Tiles" :
                            file.folderType === "covers" ? "📔 Cover" :
                            file.folderType}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
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
                  {onDownload && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={(e) => { e.stopPropagation(); onDownload(file); }}
                    >
                      <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  )}
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
  onDownload,
  isQuotaComplete,
  onToggleSponsored,
  onAcknowledgeFeedback,
  currentUserId,
  onShootScriptChange,
  onTaskFieldsChange,
}: {
  task: WorkflowTask;
  onUploadComplete: (taskId: string, files: any[]) => void;
  onStartTask: (taskId: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, task: WorkflowTask) => void;
  isDragging: boolean;
  onPreview: (file: TaskFile) => void;
  onDownload?: (file: TaskFile) => void;
  isQuotaComplete?: boolean;
  onToggleSponsored: (taskId: string, value: boolean) => void;
  onAcknowledgeFeedback?: (taskId: string, feedbackId: string) => void;
  currentUserId?: number;
  onShootScriptChange?: (taskId: string, shootScriptRef: string | null) => void;
  onTaskFieldsChange?: (taskId: string, patch: Record<string, any>) => void;
}) {
  // const [showFiles, setShowFiles] = useState(false);
  // const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Set<string>>(new Set());
  // const [showGuidelines, setShowGuidelines] = useState(false);

  const [showFiles, setShowFiles] = useState(false);
  const [taskFilesExpanded, setTaskFilesExpanded] = useState(false);
  const [submittingToQC, setSubmittingToQC] = useState(false);
  const [textContent, setTextContent] = useState(task.textContent || "");
  const [savingText, setSavingText] = useState(false);
  const [activeFileViewer, setActiveFileViewer] = useState<{ title: string; files: TaskFile[] } | null>(null);
  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Set<string>>(new Set());
  const [selectedFeedback, setSelectedFeedback] = useState<TaskFeedbackItem | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [locallyAcknowledgedIds, setLocallyAcknowledgedIds] = useState<Set<string>>(new Set());
  const [inlineRevisionsOpen, setInlineRevisionsOpen] = useState(false);
  const [selectedVersionTab, setSelectedVersionTab] = useState<number | 'all'>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'client' | 'qc'>('all');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Gather all revisions across all versions, QC and Client
  const allRevisions: TaskFeedbackItem[] = useMemo(() => {
    const list: TaskFeedbackItem[] = [...(task.taskFeedback || [])];

    // Check if qcNotes is already in the list
    if (task.qcNotes && task.qcNotes.trim()) {
      const alreadyHas = list.some(
        (fb) => fb.feedback.trim().toLowerCase() === task.qcNotes!.trim().toLowerCase()
      );
      if (!alreadyHas) {
        const latestVer = Math.max(1, ...(task.files || []).map((f) => f.version || 1));
        list.push({
          id: `qc-${task.id}`,
          fileId: null,
          folderType: "main",
          feedback: task.qcNotes.trim(),
          status: "needs_revision",
          createdAt: task.createdAt,
          fileVersion: latestVer,
          authorName: "QC Reviewer",
          authorRole: "qc",
          category: "QC Revision",
        });
      }
    }

    // Check if rejectionReason is already in the list
    if (task.rejectionReason && task.rejectionReason.trim()) {
      const alreadyHas = list.some(
        (fb) => fb.feedback.trim().toLowerCase() === task.rejectionReason!.trim().toLowerCase()
      );
      if (!alreadyHas) {
        const latestVer = Math.max(1, ...(task.files || []).map((f) => f.version || 1));
        list.push({
          id: `rejection-${task.id}`,
          fileId: null,
          folderType: "main",
          feedback: task.rejectionReason.trim(),
          status: "needs_revision",
          createdAt: task.createdAt,
          fileVersion: latestVer,
          authorName: task.clientName || "Client Reviewer",
          authorRole: "client",
          category: "Client Revision",
        });
      }
    }

    return list.sort((a, b) => {
      const vDiff = (b.fileVersion || 1) - (a.fileVersion || 1);
      if (vDiff !== 0) return vDiff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [task.taskFeedback, task.qcNotes, task.rejectionReason, task.files, task.id, task.createdAt, task.clientName]);

  const allVersions = useMemo(() => {
    return [...new Set(allRevisions.map(fb => fb.fileVersion || 1))].sort((a, b) => b - a);
  }, [allRevisions]);

  const visibleFeedback = useMemo(() => {
    return allRevisions.filter(fb => {
      const matchVer = selectedVersionTab === 'all' || (fb.fileVersion || 1) === selectedVersionTab;
      const role = (fb.authorRole || 'client').toLowerCase();
      const matchRole = selectedRoleFilter === 'all'
        || (selectedRoleFilter === 'qc' && role.includes('qc'))
        || (selectedRoleFilter === 'client' && !role.includes('qc'));
      return matchVer && matchRole;
    });
  }, [allRevisions, selectedVersionTab, selectedRoleFilter]);

  const totalRevisionsCount = allRevisions.length;
  const fixedRevisionsCount = useMemo(() => {
    return allRevisions.filter(fb =>
      fb.status === 'acknowledged' ||
      fb.status === 'resolved' ||
      !!fb.acknowledgedAt ||
      locallyAcknowledgedIds.has(fb.id)
    ).length;
  }, [allRevisions, locallyAcknowledgedIds]);

  const hasRevisions = totalRevisionsCount > 0 || task.status === "rejected" || Boolean(task.qcNotes) || Boolean(task.rejectionReason);
  // Script viewer + attach state
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptData, setScriptData] = useState<{ title: string; content: string; status: string; clientFeedback?: string; template: string } | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const [availableScripts, setAvailableScripts] = useState<Array<{
    id: string;
    title: string;
    status: string;
    shootTaskId: string;
    shootDate: string | null;
  }>>([]);
  const canAttachScript = isSfLfDeliverable(task.deliverableType);
  const linkedScriptTitle = scriptRefTitle(task.shootScriptRef);

  // 🔥 Thumbnail cover — same resolution QC/Client cards use (newest active
  // "thumbnails" upload, falling back to the generated video preview), which
  // was never wired into the editor card before.
  const thumbnailUrl = useMemo(
    () => getTaskCardThumbnailUrl(task.files),
    [task.files]
  );
  const thumbnailFallbackLabel = useMemo(
    () => taskThumbnailFallbackLabel(task.files),
    [task.files]
  );

  // 🔥 Music licenses — every active "music-license" upload, not just the
  // most recent (uploads to this folder type are multi-asset and never
  // version-replace one another).
  const musicLicenseFiles = useMemo(
    () =>
      (task.files || []).filter(
        (f) => f.folderType === "music-license" && f.isActive !== false
      ),
    [task.files]
  );

  const loadScript = async () => {
    setScriptLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/script`);
      if (!res.ok) throw new Error('Could not load script');
      const { script } = await res.json();
      setScriptData(script);
      setScriptOpen(true);
    } catch {
      toast.error('Could not load script');
    } finally {
      setScriptLoading(false);
    }
  };

  const loadAvailableScripts = async () => {
    setAttachLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/available-scripts`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load scripts');
      setAvailableScripts(data.scripts || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load scripts');
      setAvailableScripts([]);
    } finally {
      setAttachLoading(false);
    }
  };

  const linkScript = async (shootTaskId: string, scriptId: string, scriptTitle: string) => {
    setAttachBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/script`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shootTaskId, scriptId, scriptTitle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not attach script');
      const nextRef = data.shootScriptRef
        ? (typeof data.shootScriptRef === 'string' ? data.shootScriptRef : JSON.stringify(data.shootScriptRef))
        : null;
      onShootScriptChange?.(task.id, nextRef);
      setScriptData(null);
      setAttachOpen(false);
      toast.success('Script attached');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not attach script');
    } finally {
      setAttachBusy(false);
    }
  };

  const unlinkScript = async () => {
    setAttachBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/script`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not unlink script');
      onShootScriptChange?.(task.id, null);
      setScriptData(null);
      setAttachOpen(false);
      toast.success('Script unlinked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unlink script');
    } finally {
      setAttachBusy(false);
    }
  };

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

  // 🔥 "QC Revision Feedback" / "Client Revision Feedback" — based on who
  // submitted the feedback. Falls back to Client Revision Feedback as seen in mockup.
  const getRevisionFeedbackLabel = (role?: string | null) => {
    const r = (role || "").toLowerCase();
    if (r === "qc" || r.includes("qc")) return "QC Revision Feedback";
    return "Client Revision Feedback";
  };
  const getRevisionFeedbackListLabel = (items: TaskFeedbackItem[]) => {
    const roles = new Set(items.map(i => (i.authorRole || "").toLowerCase()).filter(Boolean));
    if (roles.has("qc") && !roles.has("client")) return "QC Revision Feedback";
    return "Client Revision Feedback";
  };

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
    setLocallyAcknowledgedIds(prev => new Set(prev).add(fbId));
    try {
      if (!fbId.startsWith('qc-') && !fbId.startsWith('rejection-')) {
        const res = await fetch(`/api/tasks/${task.id}/feedback?feedbackId=${fbId}&action=acknowledge`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acknowledgedBy: currentUserId || 0 }),
        });
        if (res.ok) {
          onAcknowledgeFeedback?.(task.id, fbId);
        }
      } else {
        onAcknowledgeFeedback?.(task.id, fbId);
      }
    } catch (err) {
      console.error("Failed to acknowledge feedback:", err);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const isOverdue = new Date(task.dueDate) < new Date();
  const isDraggable = true;

  // Deliverable classification and categorized files
  const category = classifyDeliverableType(task.deliverableType, task.title);
  const mainFiles = useMemo(
    () => (task.files || []).filter(f => !f.folderType || f.folderType === "main"),
    [task.files]
  );
  const musicFiles = useMemo(
    () => (task.files || []).filter(f => f.folderType === "music-license"),
    [task.files]
  );
  const thumbFiles = useMemo(
    () => (task.files || []).filter(f => f.folderType === "thumbnails"),
    [task.files]
  );
  const tileFiles = useMemo(
    () => (task.files || []).filter(f => f.folderType === "tiles"),
    [task.files]
  );

  const hasMusicLicenses = category === 'SHORT_FORM' || category === 'BETA_SHORT_FORM' || category === 'LONG_FORM' || category === 'SQUARE_FORM' || category === 'SNAPCHAT' || category === 'STORIES' || musicFiles.length > 0;
  const hasThumbnails = category === 'SHORT_FORM' || category === 'BETA_SHORT_FORM' || category === 'LONG_FORM' || category === 'SQUARE_FORM' || category === 'STORIES' || thumbFiles.length > 0;
  const hasTiles = category === 'SNAPCHAT' || tileFiles.length > 0;
  const handleSaveTextContent = async () => {
    setSavingText(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/text-content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textContent }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch (error) {
      console.error("Failed to save text content:", error);
      toast.error("Failed to save text post copy.");
    } finally {
      setSavingText(false);
    }
  };

  const handleSubmitToQC = async () => {
    if (category === 'TEXT_POST') {
      if (!textContent.trim()) {
        toast.error('Please write the post copy before submitting to QC');
        return;
      }
      await handleSaveTextContent();
    } else {
      if (mainFiles.length === 0) {
        toast.error('Please upload the main task file before submitting to QC');
        return;
      }
      if ((category === 'LONG_FORM' || category === 'SQUARE_FORM') && thumbFiles.length === 0) {
        toast.error('Please upload a thumbnail before submitting to QC');
        return;
      }
      if ((category === 'SHORT_FORM' || category === 'BETA_SHORT_FORM' || category === 'LONG_FORM' || category === 'SQUARE_FORM' || category === 'SNAPCHAT' || category === 'STORIES') && musicFiles.length === 0) {
        toast.error('Please upload a music license before submitting to QC');
        return;
      }
      if (category === 'SNAPCHAT' && tileFiles.length === 0) {
        toast.error('Please upload Snapchat tiles before submitting to QC');
        return;
      }
    }

    if (computeTaskActionCount(task) === 0) {
      toast.error('Set at least one Task Action, or mark "No Action Required", before submitting to QC');
      return;
    }

    if (allRevisions && allRevisions.length > 0) {
      const allVers = [...new Set(allRevisions.map((fb: any) => fb.fileVersion || 1))];
      const latestVer = Math.max(...(allVers as number[]));
      const unacknowledged = allRevisions.filter(
        (fb: any) => (fb.fileVersion || 1) === latestVer
          && fb.status !== 'resolved'
          && fb.status !== 'acknowledged'
          && !fb.acknowledgedAt
          && !locallyAcknowledgedIds.has(fb.id)
      );
      if (unacknowledged.length > 0) {
        toast.error(
          `Mark all ${unacknowledged.length} revision comment${unacknowledged.length > 1 ? 's' : ''} on V${latestVer} as fixed before sending to QC`
        );
        return;
      }
    }

    setSubmittingToQC(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'READY_FOR_QC' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit to QC');
      }
      toast.success('Task submitted to QC!');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit to QC');
    } finally {
      setSubmittingToQC(false);
    }
  };

  // Reusable Task Actions Menu element
  const taskActionsElement = (
    <TaskActionsMenu
      task={task}
      onToggleSponsored={onToggleSponsored}
      onTaskFieldsChange={(taskId, patch) => onTaskFieldsChange?.(taskId, patch)}
      showLinkLongForm={!!(
        task.deliverableType && (
          task.deliverableType.toLowerCase().includes('short') ||
          task.deliverableType.toUpperCase().includes('SF')
        )
      )}
      scriptAction={
        canAttachScript ? (
          <Popover
            open={attachOpen}
            onOpenChange={(open) => {
              setAttachOpen(open);
              if (open) void loadAvailableScripts();
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className={`w-full h-11 px-3.5 rounded-xl flex items-center justify-between text-left text-[14px] font-bold transition-colors cursor-pointer ${
                  task.shootScriptRef
                    ? 'bg-black text-white hover:bg-black/90'
                    : 'bg-white text-gray-900 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 stroke-[2]" />
                  <span>Link Script</span>
                </div>
                {task.shootScriptRef && (
                  <span className="text-sm font-bold truncate max-w-[120px]">{linkedScriptTitle || '1 Script'}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 p-3"
              onClick={(e) => e.stopPropagation()}
            >
              {task.shootScriptRef && (
                <div className="mb-2 space-y-1.5 border-b border-slate-100 pb-2">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {linkedScriptTitle}
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 text-xs"
                      disabled={scriptLoading}
                      onClick={() => void loadScript()}
                    >
                      {scriptLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScrollText className="h-3 w-3" />}
                      <span className="ml-1">View</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={attachBusy}
                      onClick={() => void unlinkScript()}
                    >
                      <Unlink className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500">Pick another below to swap.</p>
                </div>
              )}
              {attachLoading ? (
                <p className="flex items-center gap-2 py-4 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading scripts…
                </p>
              ) : availableScripts.length === 0 ? (
                <p className="py-3 text-xs text-slate-500">
                  {task.shootScriptRef
                    ? 'No other unlinked scripts available.'
                    : 'No unlinked scripts available for this client.'}
                </p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {availableScripts.map((s) => (
                    <button
                      key={`${s.shootTaskId}::${s.id}`}
                      type="button"
                      disabled={attachBusy}
                      onClick={() => void linkScript(s.shootTaskId, s.id, s.title)}
                      className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                    >
                      <p className="truncate text-sm font-medium text-slate-900">{s.title || 'Untitled script'}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {s.shootDate
                          ? new Date(s.shootDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Unscheduled'}{' '}
                        — {s.status}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        ) : undefined
      }
    />
  );

  return (
    <>
      <div
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && onDragStart(e, task)}
        className={`bg-white rounded-2xl p-4 transition-all shadow-2xs mb-3 ${
          task.status === "rejected" ? "border border-red-300 ring-1 ring-red-100" : "border border-gray-900"
        } ${
          isDraggable ? "cursor-grab active:cursor-grabbing hover:shadow-sm" : "cursor-not-allowed opacity-75"
        } ${isDragging ? "opacity-50 scale-95 ring-2 ring-black" : ""}`}
      >
        <div>
          {/* Title + Guidelines G Badge */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <h4 className="font-bold text-[14px] text-gray-900 leading-snug break-words flex-1">
              {task.title || task.clientName || task.deliverableType}
            </h4>
            {task.clientId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadGuidelines();
                    }}
                    className="h-6 w-6 rounded-full bg-[#EA580C] text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-xs hover:bg-[#C2410C] transition-colors"
                  >
                    G
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  Guidelines – click to view
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="space-y-3">
            {/* If TEXT_POST deliverable, show post copy textarea */}
            {category === 'TEXT_POST' ? (
              <Card className={textContent.trim() ? "border-green-500 bg-green-50/30" : "border-amber-200"}>
                <CardContent className="p-3 space-y-2">
                  <h3 className="text-sm font-medium">
                    Post Copy
                    <span className="text-red-500 ml-0.5">*</span>
                  </h3>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    onBlur={handleSaveTextContent}
                    placeholder="Write the text post copy here..."
                    rows={6}
                    className="w-full text-sm border rounded-lg p-2 resize-y focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  {savingText && <p className="text-xs text-gray-500">Saving...</p>}
                </CardContent>
              </Card>
            ) : (
              /* Task Files Accordion Container */
              !taskFilesExpanded ? (
                <div className="rounded-xl border border-gray-900 bg-white overflow-hidden shadow-2xs transition-all">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTaskFilesExpanded(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold text-gray-900 hover:bg-gray-50/80 transition-colors"
                  >
                    <Video className="h-4 w-4 text-gray-800 shrink-0 mr-0.5" />
                    <span>
                      Task Files<span className="text-red-500">*</span>
                    </span>
                    <span className="text-gray-500 font-normal text-xs">
                      ({mainFiles.length} file{mainFiles.length !== 1 ? "s" : ""})
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400 ml-0.5" />
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-900 bg-white p-3.5 space-y-3 shadow-2xs transition-all">
                  {/* Container Header Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTaskFilesExpanded(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 text-[13px] font-semibold text-gray-900 hover:opacity-80 transition-opacity"
                  >
                    <Video className="h-4 w-4 text-gray-800 shrink-0 mr-0.5" />
                    <span>
                      Task Files<span className="text-red-500">*</span>
                    </span>
                    <span className="text-gray-500 font-normal text-xs">
                      ({mainFiles.length} file{mainFiles.length !== 1 ? "s" : ""})
                    </span>
                    <ChevronUp className="h-4 w-4 text-gray-400 ml-0.5" />
                  </button>

                  {/* Main Task File Upload Box */}
                  <FileUploadDialog
                    task={task}
                    subfolder="main"
                    onUploadComplete={(files) => onUploadComplete(task.id, files)}
                    trigger={
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full border border-dashed border-gray-900 rounded-xl py-6 px-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50/80 transition-colors group"
                      >
                        <Video className="h-7 w-7 text-gray-400 mb-2 stroke-[1.5] group-hover:text-gray-600 transition-colors" />
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                          {mainFiles.length > 0 ? "Upload new version" : "Upload new version"}
                        </span>
                      </div>
                    }
                  />

                  {/* Thumbnails Section */}
                  {hasThumbnails && (
                    <>
                      <div className="border-t border-gray-200" />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
                            THUMBNAILS{category === 'LONG_FORM' || category === 'SQUARE_FORM' ? <span className="text-red-500">*</span> : ''}{' '}
                            <span className="font-normal normal-case text-gray-500">
                              ({thumbFiles.length} file{thumbFiles.length !== 1 ? 's' : ''})
                            </span>
                          </span>
                          {thumbFiles.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFileViewer({ title: "Thumbnails", files: thumbFiles });
                              }}
                              className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5 normal-case"
                            >
                              <Eye className="h-3 w-3" /> View
                            </button>
                          )}
                        </div>
                        <FileUploadDialog
                          task={task}
                          subfolder="thumbnails"
                          onUploadComplete={(files) => onUploadComplete(task.id, files)}
                          trigger={
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="w-full border border-dashed border-gray-900 rounded-xl py-5 px-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50/80 transition-colors group"
                            >
                              <ImageIcon className="h-7 w-7 text-gray-400 mb-2 stroke-[1.5] group-hover:text-gray-600 transition-colors" />
                              <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                                {thumbFiles.length > 0 ? "Thumbnail uploaded — click to replace" : "Upload thumbnail"}
                              </span>
                            </div>
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* Music License Section */}
                  {hasMusicLicenses && (
                    <>
                      <div className="border-t border-gray-200" />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
                            MUSIC LICENSE<span className="text-red-500">*</span>{' '}
                            <span className="font-normal normal-case text-gray-500">
                              ({musicFiles.length} file{musicFiles.length !== 1 ? 's' : ''})
                            </span>
                          </span>
                          {musicFiles.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFileViewer({ title: "Music Licenses", files: musicFiles });
                              }}
                              className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5 normal-case"
                            >
                              <Eye className="h-3 w-3" /> View
                            </button>
                          )}
                        </div>
                        <FileUploadDialog
                          task={task}
                          subfolder="music-license"
                          onUploadComplete={(files) => onUploadComplete(task.id, files)}
                          trigger={
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="w-full border border-dashed border-gray-900 rounded-xl py-5 px-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50/80 transition-colors group"
                            >
                              <Music className="h-7 w-7 text-gray-400 mb-2 stroke-[1.5] group-hover:text-gray-600 transition-colors" />
                              <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                                {musicFiles.length > 0 ? "Music license uploaded — click to replace" : "Upload music license"}
                              </span>
                            </div>
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* Snapchat Tiles Section */}
                  {hasTiles && (
                    <>
                      <div className="border-t border-gray-200" />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
                            TILES<span className="text-red-500">*</span>{' '}
                            <span className="font-normal normal-case text-gray-500">
                              ({tileFiles.length} file{tileFiles.length !== 1 ? 's' : ''})
                            </span>
                          </span>
                          {tileFiles.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFileViewer({ title: "Tiles", files: tileFiles });
                              }}
                              className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5 normal-case"
                            >
                              <Eye className="h-3 w-3" /> View
                            </button>
                          )}
                        </div>
                        <FileUploadDialog
                          task={task}
                          subfolder="tiles"
                          onUploadComplete={(files) => onUploadComplete(task.id, files)}
                          trigger={
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="w-full border border-dashed border-gray-900 rounded-xl py-5 px-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50/80 transition-colors group"
                            >
                              <LayoutGrid className="h-7 w-7 text-gray-400 mb-2 stroke-[1.5] group-hover:text-gray-600 transition-colors" />
                              <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                                {tileFiles.length > 0 ? "Tile uploaded — click to replace" : "Upload tile"}
                              </span>
                            </div>
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              )
            )}

            {/* Task Actions Button */}
            {taskActionsElement}

            {/* Action Button */}
            {task.status === "rejected" && (
              <Button
                size="sm"
                className="w-full h-11 rounded-xl font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 bg-[#B91C1C] text-white hover:bg-[#991B1B]"
                onClick={() => onStartTask(task.id)}
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Start Revision</span>
              </Button>
            )}

            {task.status === "pending" && (
              <Button
                size="sm"
                className="w-full h-11 rounded-xl font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 bg-black text-white hover:bg-neutral-800"
                onClick={() => onStartTask(task.id)}
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Start</span>
              </Button>
            )}

            {task.status === "in_progress" && (
              <Button
                size="sm"
                className="w-full h-11 rounded-xl font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 bg-black text-white hover:bg-neutral-800"
                onClick={handleSubmitToQC}
                disabled={submittingToQC}
              >
                <Send className="h-4 w-4 stroke-[2]" />
                <span>{submittingToQC ? "Submitting..." : "Submit to QC"}</span>
              </Button>
            )}

            {task.status === "ready_for_qc" && (
              <Button
                size="sm"
                className="w-full h-11 rounded-xl text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs"
                onClick={() => onStartTask(task.id)}
              >
                ↩ Move Back to In Progress
              </Button>
            )}

            {/* Revision Feedback Section — Visible on Tickets whenever revisions exist! */}
            {hasRevisions && (
              <div className="rounded-xl border border-red-200 bg-red-50/25 overflow-hidden transition-all shadow-2xs">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setFeedbackDialogOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-[#DC2626] hover:bg-red-50/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[#DC2626]" />
                    <span className="font-bold text-[12.5px] truncate">Revision Feedback</span>
                    {allVersions.length > 1 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-700">
                        {allVersions.map((v) => `V${v}`).join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold text-[#DC2626]">
                      {fixedRevisionsCount}/{totalRevisionsCount || 1} fixed
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineRevisionsOpen(!inlineRevisionsOpen);
                      }}
                      className="p-1 rounded hover:bg-red-100/80 text-[#DC2626] transition-colors"
                      title={inlineRevisionsOpen ? "Collapse revisions" : "Expand revisions on ticket"}
                    >
                      {inlineRevisionsOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 stroke-[2.5]" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 stroke-[2.5]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Inline list of all revisions for all versions directly on ticket */}
                {inlineRevisionsOpen && (
                  <div className="border-t border-red-100/80 px-2.5 py-2 space-y-1.5 bg-white/90">
                    {allRevisions.length === 0 ? (
                      <p className="text-xs text-gray-500 py-1 text-center">No revision feedback found.</p>
                    ) : (
                      allRevisions.map((fb) => {
                        const isAck =
                          fb.status === "acknowledged" ||
                          fb.status === "resolved" ||
                          !!fb.acknowledgedAt ||
                          locallyAcknowledgedIds.has(fb.id);
                        const isAcking = acknowledgingId === fb.id;
                        const isQc = (fb.authorRole || "").toLowerCase().includes("qc");
                        return (
                          <div
                            key={fb.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFeedback(fb);
                              setFeedbackDialogOpen(true);
                            }}
                            className="p-2 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-2xs transition-all cursor-pointer space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-[12px] text-gray-900 truncate max-w-[120px]">
                                  {fb.authorName || (isQc ? "QC Reviewer" : "Client")}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                                    isQc ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  {isQc ? "QC" : "Client"}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-gray-100 text-gray-700">
                                  V{fb.fileVersion || 1}
                                </span>
                                {fb.timestamp && (
                                  <span className="text-[10px] text-gray-500 font-medium">
                                    ⏱ {fb.timestamp}
                                  </span>
                                )}
                              </div>
                              {isAck ? (
                                <span className="text-[11px] font-bold text-green-600 flex items-center gap-0.5 shrink-0">
                                  <Check className="h-3 w-3 stroke-[3]" /> Fixed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isAcking}
                                  onClick={(e) => handleAcknowledge(fb.id, e)}
                                  className="text-[10.5px] px-2 py-0.5 rounded-md bg-green-500 hover:bg-green-600 text-white font-semibold shrink-0 transition-colors"
                                >
                                  {isAcking ? "..." : "Mark fixed"}
                                </button>
                              )}
                            </div>
                            <p className="text-[12px] text-gray-800 leading-snug break-words line-clamp-3">
                              {fb.feedback}
                            </p>
                          </div>
                        );
                      })
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFeedbackDialogOpen(true);
                      }}
                      className="w-full text-center text-[11px] font-bold text-red-600 hover:underline pt-1"
                    >
                      Open in Dialog ↗
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revision Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={open => { setFeedbackDialogOpen(open); if (!open) setSelectedFeedback(null); }}>
        <DialogContent className="max-w-[490px] sm:max-w-[490px] rounded-3xl p-0 overflow-hidden bg-white border border-gray-100 shadow-2xl" onClick={e => e.stopPropagation()}>
          <DialogHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between w-full pr-7">
              {selectedFeedback ? (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                  onClick={() => setSelectedFeedback(null)}
                >
                  ← Back to feedback
                </button>
              ) : (
                <DialogTitle className="text-[19px] font-extrabold text-gray-900 tracking-tight">
                  {getRevisionFeedbackListLabel(allRevisions)}
                </DialogTitle>
              )}
              <span className="text-xs text-gray-400 font-medium">
                {fixedRevisionsCount}/{totalRevisionsCount || 1} fixed
              </span>
            </div>
          </DialogHeader>

          {/* Filter Bar inside Dialog */}
          {!selectedFeedback && (
            <div className="px-6 pb-3 space-y-2 border-b border-gray-100">
              {/* Version Tabs */}
              {allVersions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedVersionTab('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      selectedVersionTab === 'all'
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All Versions ({allRevisions.length})
                  </button>
                  {allVersions.map((ver) => {
                    const count = allRevisions.filter((r) => (r.fileVersion || 1) === ver).length;
                    return (
                      <button
                        key={ver}
                        type="button"
                        onClick={() => setSelectedVersionTab(ver)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                          selectedVersionTab === ver
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        V{ver} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Role Filter Tabs (Client vs QC) */}
              {allRevisions.some(r => (r.authorRole || '').toLowerCase().includes('qc')) &&
               allRevisions.some(r => !(r.authorRole || '').toLowerCase().includes('qc')) && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  {(['all', 'client', 'qc'] as const).map((role) => {
                    const count = role === 'all'
                      ? allRevisions.length
                      : allRevisions.filter((r) =>
                          role === 'qc'
                            ? (r.authorRole || '').toLowerCase().includes('qc')
                            : !(r.authorRole || '').toLowerCase().includes('qc')
                        ).length;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRoleFilter(role)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${
                          selectedRoleFilter === role
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {role} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="max-h-[65vh] overflow-y-auto px-6 pb-6 pt-3 space-y-3">
            {selectedFeedback ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-bold text-gray-900">
                      {selectedFeedback.authorName || (selectedFeedback.authorRole === 'qc' ? 'QC Reviewer' : 'Client Reviewer')}
                    </span>
                    <span className="text-gray-400 font-medium">·</span>
                    <span className="text-gray-500 font-normal capitalize">
                      {selectedFeedback.authorRole === 'qc' ? 'QC' : (selectedFeedback.authorRole || 'Client')}
                    </span>
                  </div>
                  {(() => {
                    const isAck = selectedFeedback.status === 'acknowledged' || selectedFeedback.status === 'resolved' || !!selectedFeedback.acknowledgedAt || locallyAcknowledgedIds.has(selectedFeedback.id);
                    const isAcking = acknowledgingId === selectedFeedback.id;
                    return !isAck ? (
                      <button
                        type="button"
                        className="text-xs px-2.5 py-1 rounded-lg bg-[#4ADE80] text-white hover:bg-[#22C55E] font-medium transition-colors"
                        disabled={isAcking}
                        onClick={(e) => handleAcknowledge(selectedFeedback.id, e)}
                      >
                        {isAcking ? 'Saving...' : '✓ Mark fixed'}
                      </button>
                    ) : (
                      <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                        <Check className="h-3.5 w-3.5 stroke-[3]" /> Fixed
                      </span>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200/60">
                    V{selectedFeedback.fileVersion || 1}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200/60">
                    <Square className="h-3 w-3 stroke-[1.5] text-gray-600 shrink-0" />
                    <span className="capitalize">
                      {selectedFeedback.folderType === "main" ? "Main" :
                       selectedFeedback.folderType === "thumbnails" ? "Thumb" :
                       selectedFeedback.folderType === "tiles" ? "Tiles" :
                       selectedFeedback.folderType === "music-license" ? "Music" :
                       selectedFeedback.folderType}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200/60">
                    <Clock className="h-3 w-3 stroke-[1.5] text-gray-600 shrink-0" />
                    <span>{selectedFeedback.timestamp || "0:00"}</span>
                  </span>
                  {selectedFeedback.category && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200/60 capitalize">
                      {selectedFeedback.category}
                    </span>
                  )}
                </div>

                <p className="text-[13.5px] text-gray-900 leading-relaxed font-normal break-words whitespace-pre-wrap pt-1">
                  {selectedFeedback.feedback}
                </p>

                {selectedFeedback.fileName && (
                  <p className="text-xs text-gray-500 pt-1 flex items-center gap-1 truncate" title={selectedFeedback.fileName}>
                    📎 {selectedFeedback.fileName}
                  </p>
                )}
                {selectedFeedback.acknowledgedAt && (
                  <p className="text-xs text-green-600 font-medium pt-1">
                    Fixed on {new Date(selectedFeedback.acknowledgedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : visibleFeedback.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No revision feedback found for this filter.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleFeedback.map((fb) => {
                  const isAcknowledged = fb.status === 'acknowledged' || fb.status === 'resolved' || !!fb.acknowledgedAt || locallyAcknowledgedIds.has(fb.id);
                  const isAcking = acknowledgingId === fb.id;
                  const isQc = (fb.authorRole || '').toLowerCase().includes('qc');
                  return (
                    <div
                      key={fb.id}
                      className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-gray-300 transition-all cursor-pointer shadow-2xs"
                      onClick={() => setSelectedFeedback(fb)}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Checkbox button */}
                        <button
                          type="button"
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all mt-0.5 ${
                            isAcknowledged
                              ? 'bg-[#4ADE80] text-white shadow-xs'
                              : 'border-2 border-gray-300 hover:border-gray-400 bg-white'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isAcknowledged) handleAcknowledge(fb.id, e);
                          }}
                          disabled={isAcking || isAcknowledged}
                          title={isAcknowledged ? 'Fixed' : 'Click to mark as fixed'}
                        >
                          {isAcknowledged && <Check className="h-3.5 w-3.5 stroke-[3.5] text-white" />}
                          {isAcking && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                        </button>

                        {/* Feedback Content */}
                        <div className="flex-1 min-w-0">
                          {/* Row 1: Author · Role + Chevron */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="font-bold text-gray-900">
                                {fb.authorName || (isQc ? 'QC Reviewer' : 'Client Reviewer')}
                              </span>
                              <span className="text-gray-400 font-medium">·</span>
                              <span className="text-gray-500 font-normal capitalize">
                                {isQc ? 'QC' : (fb.authorRole || 'Client')}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                          </div>

                          {/* Row 2: Badges */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200/60">
                              V{fb.fileVersion || 1}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200/60">
                              <Square className="h-3 w-3 stroke-[1.5] text-gray-600 shrink-0" />
                              <span className="capitalize">
                                {fb.folderType === "main" ? "Main" :
                                 fb.folderType === "thumbnails" ? "Thumb" :
                                 fb.folderType === "tiles" ? "Tiles" :
                                 fb.folderType === "music-license" ? "Music" :
                                 fb.folderType}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200/60">
                              <Clock className="h-3 w-3 stroke-[1.5] text-gray-600 shrink-0" />
                              <span>{fb.timestamp || "0:00"}</span>
                            </span>
                            {fb.category && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200/60 capitalize">
                                {fb.category}
                              </span>
                            )}
                          </div>

                          {/* Row 3: Feedback text */}
                          <p className="text-[13.5px] text-gray-900 leading-relaxed font-normal mt-2.5 break-words whitespace-pre-wrap">
                            {fb.feedback}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 📄 Script Viewer Dialog — read-only for editors */}
      <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4 text-violet-500" />
              {scriptData?.title || 'Shoot Script'}
              {scriptData?.status && (
                <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  scriptData.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                  scriptData.status === 'changes_requested' ? 'bg-red-50 text-red-700 border-red-200' :
                  scriptData.status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {scriptData.status === 'approved' ? '✓ Approved' :
                   scriptData.status === 'changes_requested' ? 'Changes requested' :
                   scriptData.status === 'sent' ? 'Awaiting client' : 'Draft'}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {scriptData?.clientFeedback && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-semibold text-amber-800 mb-1">Client Feedback</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{scriptData.clientFeedback}</p>
              </div>
            )}
            <article className="whitespace-pre-wrap font-mono text-sm leading-7 text-slate-800 bg-slate-50 rounded-xl border p-5 min-h-[200px]">
              {scriptData?.content || 'No content yet.'}
            </article>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revision Comment Detail Popup */}

<Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
  <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-base text-destructive">
        <AlertCircle className="h-4 w-4" />
        {getRevisionFeedbackLabel(selectedFeedback?.authorRole)}
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

        {/* Author */}
        {selectedFeedback.authorName && (
          <p className="text-xs text-muted-foreground">
            — {selectedFeedback.authorName}{selectedFeedback.authorRole === 'qc' ? ' (QC)' : selectedFeedback.authorRole === 'client' ? ' (Client)' : ''}
          </p>
        )}

        {/* File reference */}
        {selectedFeedback.fileName && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            📎 <span className="truncate" title={selectedFeedback.fileName}>{selectedFeedback.fileName}</span>
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
      <FileViewerDialog
        title={activeFileViewer?.title || "Task Files"}
        files={activeFileViewer?.files || (task.files || [])}
        open={!!activeFileViewer || showFiles}
        onOpenChange={(open) => {
          if (!open) {
            setActiveFileViewer(null);
            setShowFiles(false);
          }
        }}
        onPreview={onPreview}
        onDownload={onDownload}
      />
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
  onDownload?: (file: TaskFile) => void;
  quotaCompleteTaskIds: Set<string>;
  onToggleSponsored: (taskId: string, value: boolean) => void;
  onAcknowledgeFeedback?: (taskId: string, feedbackId: string) => void;
  currentUserId?: number;
  onShootScriptChange?: (taskId: string, shootScriptRef: string | null) => void;
  onTaskFieldsChange?: (taskId: string, patch: Record<string, any>) => void;
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
  onDownload,
  quotaCompleteTaskIds,
  onToggleSponsored,
  onAcknowledgeFeedback,
  currentUserId,
  onShootScriptChange,
  onTaskFieldsChange,
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
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1">
        <h3 className="font-bold text-[15px] text-gray-900 tracking-tight">{title}</h3>
        <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs rounded-full ${getStatusBadgeStyles(status)}`}>
          {tasks.length}
        </span>
      </div>

      <div
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, status)}
        onDragLeave={onDragLeave}
        className={`space-y-3 min-h-[220px] max-h-[calc(100vh-250px)] overflow-y-auto p-1 rounded-xl transition-all duration-200 ${getDropZoneStyles()}`}
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
            onDownload={onDownload}
            isQuotaComplete={quotaCompleteTaskIds.has(task.id)}
            onToggleSponsored={onToggleSponsored}
            onAcknowledgeFeedback={onAcknowledgeFeedback}
            currentUserId={currentUserId}
            onShootScriptChange={onShootScriptChange}
            onTaskFieldsChange={onTaskFieldsChange}
          />
        ))}

        {tasks.length === 0 && (
          <div
            className={`flex items-center justify-center h-44 rounded-2xl border border-dashed ${
              isDragOver && isValidTarget
                ? "bg-green-50 border-green-400 text-green-700"
                : isDragOver && !isValidTarget
                ? "bg-red-50 border-red-300 text-red-600"
                : "border-gray-200 bg-white text-gray-400"
            }`}
          >
            <p className="text-sm font-medium">
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
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/tags', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => { if (data.ok) setAvailableTags(data.tags.map((t: any) => t.name)); })
      .catch(() => {});
  }, []);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [draggingTask, setDraggingTask] = useState<WorkflowTask | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<TaskFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Desktop app download progress — window.e8 only exists inside the
  const [eodReportOpen, setEodReportOpen] = useState(false);
  const [selectedRawClientId, setSelectedRawClientId] = useState<string>("");
  const [rawsSending, setRawsSending] = useState(false);
  const [justSentRaws, setJustSentRaws] = useState(false);
  const downloadFileNamesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const desktop = (window as any).e8;
    if (!desktop?.isDesktopApp) return;

    desktop.onDownloadProgress(({ fileId, percent }: { fileId: string; percent: number }) => {
      const fileName = downloadFileNamesRef.current[fileId] || "file";

      if (percent >= 100) {
        toast.success(`${fileName} downloaded`, { id: `download-${fileId}` });
      } else {
        toast.loading(`Downloading ${fileName}... ${percent}%`, { id: `download-${fileId}` });
      }
    });
  }, []);

  const handleDownloadFile = useCallback(async (file: TaskFile) => {
    const desktop = (window as any).e8;

    if (desktop?.isDesktopApp) {
      downloadFileNamesRef.current[file.id] = file.name;
      toast.loading(`Downloading ${file.name}... 0%`, { id: `download-${file.id}` });

      const result = await desktop.downloadFile(file.id, file.name);

      if (!result.success) {
        toast.error(`Failed to download ${file.name}: ${result.message || "unknown error"}`, {
          id: `download-${file.id}`,
        });
      } else if (result.alreadyDownloaded) {
        toast.success(`${file.name} already downloaded`, { id: `download-${file.id}` });
      }
      // On success (not already-downloaded), the progress listener's 100%
      // event flips this toast to the success state — nothing more to do.
      return;
    }

    // Normal browser: fall back to a direct download.
    const isS3 = file.url?.includes('amazonaws.com') || file.url?.includes('r2.cloudflarestorage.com') || file.url?.includes('r2.dev');
    if (isS3) {
      window.open(`/api/files/${file.id}/download`, '_blank');
    } else {
      window.open(file.url, '_blank');
    }
  }, []);

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
      // 🔥 FIX: the API's default row cap (100) applies across ALL statuses
      // combined, ordered by newest-first. An editor's Pending tasks are
      // typically the newest (untouched), so they silently fill the entire
      // cap and starve In Progress/QC/Revisions out of the response even
      // though those tasks exist. Request the API's max (500) instead —
      // this query is already scoped to just this editor's own assigned
      // tasks, so 500 comfortably covers any single editor's real backlog
      // without reintroducing the old company-wide unscoped-query problem.
      params.set("limit", "500");
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
            deliverableType: t.deliverableType || t.monthlyDeliverable?.type || t.oneOffDeliverable?.type,
            taskNumber: extractTaskNumber(t.title),
            isOneOff: !!t.oneOffDeliverable,
            isSponsored: t.isSponsored || false,
            clientName: t.client?.companyName || t.client?.name || "Unknown Client",
            // 🔥 NEW: Monthly deliverable info for weekly distribution
            monthlyDeliverableId: t.monthlyDeliverableId || null,
            monthlyQuantity: t.monthlyDeliverable?.quantity || t.oneOffDeliverable?.quantity || 4, // Default to 4 if not set
            files: t.files || [],
            tags: t.tags || [],
            qcNotes: t.qcNotes || null,
            rejectionReason: t.rejectionReason || null,
            feedback: t.feedback || null,
            shootScriptRef: t.shootScriptRef || null,
            linkedRawFootagePaths: t.linkedRawFootagePaths || null,
            relatedTaskId: t.relatedTaskId || null,
            noActionRequired: t.noActionRequired || false,
            // 🔥 Map taskFeedback with file version info from nested file data
            taskFeedback: (() => {
              const mapped = (t.taskFeedback || []).map((fb: any) => {
                const matchedFile = fb.file || (t.files || []).find((f: any) => f.id === fb.fileId);
                return {
                  id: fb.id,
                  fileId: fb.fileId,
                  folderType: fb.folderType || "main",
                  feedback: fb.feedback,
                  status: fb.status,
                  timestamp: fb.timestamp,
                  category: fb.category,
                  createdAt: fb.createdAt,
                  resolvedAt: fb.resolvedAt,
                  acknowledgedAt: fb.acknowledgedAt,
                  acknowledgedBy: fb.acknowledgedBy,
                  fileVersion: matchedFile?.version || fb.fileVersion || 1,
                  fileName: matchedFile?.name || fb.fileName || null,
                  authorName: fb.user?.name || (fb.user?.role === 'qc' ? 'QC Reviewer' : (t.clientName || 'Client')),
                  authorRole: fb.user?.role || fb.authorRole || 'client',
                };
              });

              if (t.qcNotes && t.qcNotes.trim()) {
                const exists = mapped.some((f: any) => f.feedback.trim().toLowerCase() === t.qcNotes.trim().toLowerCase());
                if (!exists) {
                  const maxVer = Math.max(1, ...(t.files || []).map((f: any) => f.version || 1));
                  mapped.push({
                    id: `qc-notes-${t.id}`,
                    fileId: null,
                    folderType: "main",
                    feedback: t.qcNotes.trim(),
                    status: "needs_revision",
                    createdAt: t.createdAt,
                    fileVersion: maxVer,
                    authorName: "QC Reviewer",
                    authorRole: "qc",
                    category: "QC Revision",
                  });
                }
              }

              if (t.rejectionReason && t.rejectionReason.trim()) {
                const exists = mapped.some((f: any) => f.feedback.trim().toLowerCase() === t.rejectionReason.trim().toLowerCase());
                if (!exists) {
                  const maxVer = Math.max(1, ...(t.files || []).map((f: any) => f.version || 1));
                  mapped.push({
                    id: `rejection-${t.id}`,
                    fileId: null,
                    folderType: "main",
                    feedback: t.rejectionReason.trim(),
                    status: "needs_revision",
                    createdAt: t.createdAt,
                    fileVersion: maxVer,
                    authorName: t.clientName || "Client",
                    authorRole: "client",
                    category: "Client Revision",
                  });
                }
              }

              return mapped;
            })(),
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

  // Apply deliverable type / client / tag filters directly on all tasks —
  // no weekly quota gating; every task the editor is assigned is shown.
  const filteredTasks = useMemo(() => {
    let result = tasks;

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

    if (tagFilter !== "all") {
      result = result.filter((task: any) =>
        (task.tags || []).some((t: any) => t.name === tagFilter)
      );
    }

    return result;
  }, [tasks, deliverableTypeFilter, clientFilter, tagFilter]);

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
      } else if (targetStatus === "ready_for_qc") {
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

  // 🔥 Task Actions — generic local-state sync for the consolidated actions
  // menu (tags, No Action Required, raw-footage links, long-form link).
  // Each of those already persists via its own API call inside
  // TaskActionsMenu; this just keeps the parent's `tasks` array (and thus
  // every other reader of `task.*`, e.g. the Submit-to-QC gate) in sync
  // without a full reload — same idea as handleToggleSponsored above, just
  // generalized to any field instead of one more bespoke handler per field.
  const handleTaskFieldsChange = useCallback((taskId: string, patch: Record<string, any>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  }, []);

  /* ----------------------------- UPDATE STATUS ----------------------------- */

  const startTask = useCallback(async (taskId: string) => {
    const previous = tasks.find((t) => t.id === taskId)?.status;

    // Optimistic UI — reverted below if the API rejects (common for new
    // editors with a stale/missing auth session).
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "in_progress" } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: previous || "pending" } : t
          )
        );
        toast.error(data.message || "Failed to start task. Please refresh and try again.");
      }
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: previous || "pending" } : t
        )
      );
      toast.error("Network error starting task. Please try again.");
      console.error("Failed to start task:", err);
    }
  }, [tasks]);

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

  const handleShootScriptChange = useCallback((taskId: string, shootScriptRef: string | null) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, shootScriptRef } : t)),
    );
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
      id: "revisions",
      title: "Revisions Needed",
      status: "rejected",
      tasks: tasksByStatus.revisions,
    },
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
      title: "Quality Control",
      status: "ready_for_qc",
      tasks: tasksByStatus.readyForQC,
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

      {/* 🔥 MOCKUP-STYLED FILTER & ACTION CARD */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 sm:p-5 mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0">
            {/* Client Filter */}
            <div className="flex flex-col gap-1.5 min-w-[135px]">
              <label className="text-[12px] font-bold text-gray-500">Client</label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-10 rounded-xl border border-gray-300 bg-white px-3.5 text-[13.5px] font-bold text-gray-900 shadow-2xs hover:bg-gray-50/50 focus:ring-1 focus:ring-black">
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
            </div>

            {/* Deliverables Filter */}
            <div className="flex flex-col gap-1.5 min-w-[145px]">
              <label className="text-[12px] font-bold text-gray-500">Deliverables</label>
              <Select value={deliverableTypeFilter} onValueChange={setDeliverableTypeFilter}>
                <SelectTrigger className="h-10 rounded-xl border border-gray-300 bg-white px-3.5 text-[13.5px] font-bold text-gray-900 shadow-2xs hover:bg-gray-50/50 focus:ring-1 focus:ring-black">
                  <SelectValue placeholder="Deliverables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Deliverables</SelectItem>
                  {availableDeliverableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month Filter */}
            <div className="flex flex-col gap-1.5 min-w-[125px]">
              <label className="text-[12px] font-bold text-gray-500">Month</label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="h-10 rounded-xl border border-gray-300 bg-white px-3.5 text-[13.5px] font-bold text-gray-900 shadow-2xs hover:bg-gray-50/50 focus:ring-1 focus:ring-black">
                  <SelectValue placeholder="Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Months</SelectItem>
                  {availableMonths.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tag Filter */}
            <div className="flex flex-col gap-1.5 min-w-[110px]">
              <label className="text-[12px] font-bold text-gray-500">Tag</label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="h-10 rounded-xl border border-gray-300 bg-white px-3.5 text-[13.5px] font-bold text-gray-900 shadow-2xs hover:bg-gray-50/50 focus:ring-1 focus:ring-black">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Request Raw Footage */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-gray-500">Request Raw Footage</label>
              <div className="flex items-center">
                <Select value={selectedRawClientId} onValueChange={setSelectedRawClientId}>
                  <SelectTrigger className="h-10 rounded-l-xl rounded-r-none border border-gray-300 border-r-0 bg-gray-100/90 px-3.5 text-[13.5px] font-bold text-gray-900 shadow-2xs focus:ring-0 focus:border-gray-300 w-[125px]">
                    <SelectValue placeholder="Client" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedRawClientId || rawsSending}
                  onClick={async () => {
                    if (!selectedRawClientId) return;
                    setRawsSending(true);
                    try {
                      const res = await fetch("/api/editor/request-raws", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ clientId: selectedRawClientId }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setJustSentRaws(true);
                        setTimeout(() => setJustSentRaws(false), 2500);
                        toast.success(`Raw footage request sent to ${data.sentToClientChannel ? data.clientName + " Slack" : "E8 channel"}`);
                      } else {
                        toast.error(data.error || "Failed to send request");
                      }
                    } catch {
                      toast.error("Network error sending request");
                    } finally {
                      setRawsSending(false);
                    }
                  }}
                  className="h-10 rounded-r-xl rounded-l-none border border-gray-300 bg-white hover:bg-gray-50 text-[13.5px] font-bold text-gray-900 gap-1.5 px-3.5 shadow-2xs"
                >
                  {rawsSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 stroke-[2] text-gray-900" />
                  )}
                  <span>{justSentRaws ? "Sent!" : "Send"}</span>
                </Button>
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-10 text-xs text-gray-500 hover:text-black self-end"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Send EOD Report Button */}
          <div className="flex items-center self-end">
            <Button
              onClick={() => setEodReportOpen(true)}
              className="h-10 rounded-xl bg-black text-white hover:bg-neutral-800 text-sm font-bold px-4 sm:px-5 gap-2 shadow-xs transition-colors"
            >
              <Send className="h-3.5 w-3.5 stroke-[2]" />
              <span>Send EOD Report</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board with Drag & Drop — each column scrolls independently */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
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
            onDownload={handleDownloadFile}
            quotaCompleteTaskIds={quotaCompleteTaskIds}
            onToggleSponsored={handleToggleSponsored}
            onAcknowledgeFeedback={handleAcknowledgeFeedback}
            currentUserId={Number(currentUser.id) || undefined}
            onShootScriptChange={handleShootScriptChange}
            onTaskFieldsChange={handleTaskFieldsChange}
          />
        ))}
      </div>
      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />

      {/* EOD Report Dialog Modal */}
      <EditorEodReport
        open={eodReportOpen}
        onOpenChange={setEodReportOpen}
        isDialog={true}
      />

    </div>
  );
}