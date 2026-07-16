import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
// import { Share2, CheckCircle, XCircle, Clock, AlertCircle, FileText, Eye, Calendar, User, Play, ArrowRight, Video, Palette, UserCheck, Image as ImageIcon, File, Download, ExternalLink, X, ZoomIn, History, Filter, RefreshCw } from 'lucide-react';
import { ShareDialog } from '../review/ShareDialog';
import { FullScreenReviewModalFrameIO } from '../client/FullScreenReviewModalFrameIO';
import { ThumbnailReviewModal } from '../client/ThumbnailReviewModal';
import { TextPostReviewModal } from '../client/TextPostReviewModal';
import { TagPicker } from '../workflow/TagPicker';
import { ThumbnailComparisonModal } from '../client/ThumbnailComparisonModal';
import { useAuth } from '../auth/AuthContext';
import { TaskGuidelinesButton } from './TaskGuidelinesButton';
import { toast } from 'sonner';
import { LinkedSfTasks } from '../tasks/LinkedSfTasks';
import { useViewAsRole } from '../auth/ViewAsRoleContext';
import { Share2, CheckCircle, XCircle, Clock, AlertCircle, FileText, Eye, Calendar, User, Play, ArrowRight, Video, Palette, UserCheck, Image as ImageIcon, File, Download, ExternalLink, X, ZoomIn, History, Filter, RefreshCw, Sparkles, PenLine, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';

type TaskDestination = 'editor' | 'client' | 'scheduler';

interface TaskFile {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  driveFileId: string;
  mimeType: string;
  size: number;
  folderType?: string;  // "main", "thumbnails", "music-license", "tiles", "covers"
  version?: number;
  isActive?: boolean;
  replacedAt?: string;
  replacedBy?: string;
  revisionNote?: string;
  s3Key?: string;
  codec?: string;
  optimizationStatus?: string;
  optimizationError?: string | null;
}

interface EnhancedWorkflowTask {
  id: string;
  title: string;
  description: string;
  taskType: string;
  status: string;
  assignedTo: string;
  createdBy: string;
  clientId: string;
  clientUserId: string;
  driveLinks: string[];
  createdAt: string;
  dueDate: string;
  priority?: "urgent" | "high" | "medium" | "low";
  taskCategory?: "design" | "video" | "copywriting" | "review";
  nextDestination?: TaskDestination;
  requiresClientReview?: boolean;
  workflowStep?: string;
  folderType?: string;
  qcNotes?: string | null;
  feedback?: string;
  files?: TaskFile[];
  monthlyDeliverable?: any;
  oneOffDeliverableId?: string | null;
  socialMediaLinks?: string[];
  // 🔥 QC reviewer tracking
  qcResult?: string | null;
  qcReviewedBy?: number | null;
  qcReviewedAt?: string | null;
  qcReviewer?: {
    id: number;
    name: string;
  } | null;
  user?: {
    name: string;
    role: string;
  };
  client?: {
    name: string;
    companyName?: string;
  };
}


// 🔥 Color coding for deliverable types
const getDeliverableTypeColor = (deliverableType: string): { bg: string; border: string; ring: string } => {
  const type = deliverableType?.toLowerCase() || '';
  
  // Short Form Videos (green)
  if (type.includes('short form') || type === 'sf' || type === 'short_form') {
    return { 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-200', 
      ring: 'ring-emerald-300' 
    };
  }
  // Beta Short Form (teal)
  if (type.includes('beta short form') || type === 'bsf' || type === 'beta_short_form') {
    return { 
      bg: 'bg-teal-50', 
      border: 'border-teal-200', 
      ring: 'ring-teal-300' 
    };
  }
  // SQF - Super Quick Form (cyan)
  if (type === 'sqf' || type.includes('sqf') || type.includes('super quick')) {
    return { 
      bg: 'bg-cyan-50', 
      border: 'border-cyan-200', 
      ring: 'ring-cyan-300' 
    };
  }
  // Snapchat Videos (yellow)
  if (type.includes('snapchat') || type === 'snap') {
    return { 
      bg: 'bg-yellow-50', 
      border: 'border-yellow-200', 
      ring: 'ring-yellow-300' 
    };
  }
  // Long Form Videos (blue)
  if (type.includes('long form') || type === 'lf' || type === 'long_form') {
    return { 
      bg: 'bg-blue-50', 
      border: 'border-blue-200', 
      ring: 'ring-blue-300' 
    };
  }
  // Thumbnails/Images (purple)
  if (type.includes('thumbnail') || type.includes('image')) {
    return { 
      bg: 'bg-purple-50', 
      border: 'border-purple-200', 
      ring: 'ring-purple-300' 
    };
  }
  // Podcasts/Audio (orange)
  if (type.includes('podcast') || type.includes('audio')) {
    return { 
      bg: 'bg-orange-50', 
      border: 'border-orange-200', 
      ring: 'ring-orange-300' 
    };
  }
  // Default
  return { 
    bg: 'bg-white', 
    border: 'border-zinc-100', 
    ring: 'ring-zinc-200' 
  };
};

const persistQCResult = async ({
  taskId,
  approved,
  feedback,
  requiresClientReview,
  postingTitles,
  postingDescriptions,
  postingTags,
}: {
  taskId: string;
  approved: boolean;
  feedback?: string;
  requiresClientReview?: boolean;
  postingTitles?: { id: string; text: string }[];
  postingDescriptions?: { id: string; text: string }[];
  postingTags?: { id: string; text: string }[];
}) => {
  const newStatus = approved ? "COMPLETED" : "REJECTED";
  const metaBody: any = {};

  if (approved && feedback) metaBody.feedback = feedback;
  if (!approved && feedback) metaBody.qcNotes = feedback;

  if (approved) {
    metaBody.qcResult = "APPROVED";
    metaBody.route = requiresClientReview ? "client_then_scheduler" : "scheduler";
  } else {
    metaBody.qcResult = "REJECTED";
    metaBody.route = "editor";
  }

  metaBody.status = newStatus;

  // 🔥 Batch-send posting content lists on every status update (approve AND
  // send-back-to-editor) — titles/descriptions/tags must survive revision
  // rounds and only disappear via manual delete in the review UI.
  if (postingTitles !== undefined) metaBody.postingTitles = postingTitles;
  if (postingDescriptions !== undefined) metaBody.postingDescriptions = postingDescriptions;
  if (postingTags !== undefined) metaBody.postingTags = postingTags;

  const metaRes = await fetch(`/api/tasks/${taskId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(metaBody),
  });

  if (!metaRes.ok) {
    const body = await metaRes.text();
    console.error("Metadata update failed:", body);
    throw new Error("Failed to update task metadata");
  }
};

export function QCDashboard() {
  const { viewingAsRole, isViewingAsOther } = useViewAsRole();

  const [qcTasks, setQCTasks] = useState<EnhancedWorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<EnhancedWorkflowTask | null>(null);
  const [selectedFile, setSelectedFile] = useState<TaskFile | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  // Tracks which folder-type sections in "Review Files by Section" have been
  // expanded to show older versions (collapsed to latest-only by default).
  const [expandedFileGroups, setExpandedFileGroups] = useState<Set<string>>(new Set());
  const toggleFileGroupExpanded = (folderType: string) => {
    setExpandedFileGroups((prev) => {
      const next = new Set(prev);
      if (next.has(folderType)) next.delete(folderType);
      else next.add(folderType);
      return next;
    });
  };
  const [showVideoReview, setShowVideoReview] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [showThumbnailReview, setShowThumbnailReview] = useState(false);
  const [showTextPostReview, setShowTextPostReview] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonFiles, setComparisonFiles] = useState<TaskFile[]>([]);
  const [deliverableTypeFilter, setDeliverableTypeFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTaskTags, setSelectedTaskTags] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/tags', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => { if (data.ok) setAvailableTags(data.tags.map((t: any) => t.name)); })
      .catch(() => {});
  }, []);

  // 🔥 Share states
  const [shareLink, setShareLink] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  // QC Title state
const [showTitlePrompt, setShowTitlePrompt] = useState(false);
const [pendingApprovalAsset, setPendingApprovalAsset] = useState<any>(null);
const [pendingApprovalType, setPendingApprovalType] = useState<"client" | "scheduler" | "thumbnail" | null>(null);
// 🔥 Posting-content lists — composed in the review sidebar, sent on approve
const [qcPostingTitles, setQcPostingTitles] = useState<{ id: string; text: string }[]>([]);
const [qcPostingDescriptions, setQcPostingDescriptions] = useState<{ id: string; text: string }[]>([]);
const [qcPostingTags, setQcPostingTags] = useState<{ id: string; text: string }[]>([]);

  // QC Reassign state
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignTask, setReassignTask] = useState<EnhancedWorkflowTask | null>(null);
  const [qcUsers, setQcUsers] = useState<{ id: number; name: string }[]>([]);
  const [selectedQcId, setSelectedQcId] = useState<string>("");
  const [isReassigning, setIsReassigning] = useState(false);

  // 🔥 Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);
  const [bulkRejectFeedback, setBulkRejectFeedback] = useState("");

  const { user } = useAuth();

  const getMimeType = (file: TaskFile | null) => {
    if (!file) return "";
    if (file.mimeType) return file.mimeType;
    const url = (file.url || "").split('?')[0];
    const name = file.name || "";
    const ext = (name || url).split('.').pop()?.toLowerCase();
    if (!ext) return '';

    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video/mp4';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image/jpeg';
    if (ext === 'pdf') return 'application/pdf';
    return '';
  };

  // 🔥 Initial load - run once on mount
  useEffect(() => {
    loadQCTasks();
  }, []);

  // 🔥 Polling effect - only check for active optimization jobs
  useEffect(() => {
    const hasActiveJobs = qcTasks.some(t => 
      t.files?.some(f => f.optimizationStatus === 'PROCESSING' || f.optimizationStatus === 'PENDING')
    );

    if (hasActiveJobs) {
      console.log("⏱️ Active optimization detected in QC, starting poll...");
      const interval = setInterval(loadQCTasks, 15000); // Poll every 15s
      return () => clearInterval(interval);
    }
  }, [qcTasks.length]); // Only re-evaluate when task count changes

  // Global listener for background task updates
  useEffect(() => {
    const handleTaskGlobalUpdate = (e: any) => {
      if (e.detail?.taskId) {
        console.log("🔔 Global update received for task in QC:", e.detail.taskId);
        loadQCTasks();
      }
    };
    window.addEventListener('task-updated', handleTaskGlobalUpdate);
    return () => window.removeEventListener('task-updated', handleTaskGlobalUpdate);
  }, []);

  // 🔥 Bulk selection is admin-only (viewing as QC). If this ever stops being
  // true mid-session — a real QC user, or an admin switching back to their
  // own role — force-exit selection mode so the feature can't linger.
  useEffect(() => {
    if (!isViewingAsOther && (selectionMode || selectedTaskIds.size > 0)) {
      setSelectionMode(false);
      setSelectedTaskIds(new Set());
    }
  }, [isViewingAsOther]);

  const loadQCTasks = useCallback(async () => {
    try {
      setLoading(true);
      // 🔥 Fetch PENDING tasks (READY_FOR_QC status)
      const res = await fetch("/api/tasks?status=READY_FOR_QC", {
  method: "GET",
  credentials: "include",
  headers: viewingAsRole && viewingAsRole !== user?.role
    ? { "x-viewing-as": viewingAsRole }
    : {},
});

      if (!res.ok) throw new Error("Failed fetching QC tasks");

      let data = await res.json();

      if (data.tasks) data = data.tasks;
      if (!Array.isArray(data)) {
        console.error("QC API returned non-array:", data);
        return;
      }

      const normalized = data.map((task: any) => ({
        ...task,
        status: "pending",
        priority: task.priority || "medium",
        taskCategory: task.taskCategory || "design",
        nextDestination: task.nextDestination || "client",
        requiresClientReview: task.requiresClientReview ?? false,
        files: task.files || [],
        deliverableType: task.monthlyDeliverable?.type || task.oneOffDeliverable?.type || "Other",
        clientName: task.client?.companyName || task.client?.name || "Unknown Client",
      }));

      const sorted = normalized.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
      );

      setQCTasks(sorted);
    } catch (err) {
      console.error("QC load error:", err);
      toast.error("Failed to load QC tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSendToClient = async (asset: any) => {
    if (!selectedTask) return;
    try {
      await persistQCResult({
        taskId: selectedTask.id,
        approved: true,
        requiresClientReview: true,
        postingTitles: qcPostingTitles,
        postingDescriptions: qcPostingDescriptions,
        postingTags: qcPostingTags,
      });
      setQCTasks(prev => prev.filter(t => t.id !== selectedTask.id));
      toast("✅ Approved – Sent to Client", { description: "Content has been moved to the next stage." });
      setShowVideoReview(false);
      setSelectedFile(null);
      setSelectedTask(null);
      setQcPostingTitles([]); setQcPostingDescriptions([]); setQcPostingTags([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update task status");
    }
  };

  const handleSendBackToEditor = async (asset: any, revisionData: any) => {
    if (!selectedTask) return;

    const notes = revisionData?.notes || revisionData?.feedback || "";

    try {
      await persistQCResult({
        taskId: selectedTask.id,
        approved: false,
        feedback: notes,
        postingTitles: qcPostingTitles,
        postingDescriptions: qcPostingDescriptions,
        postingTags: qcPostingTags,
      });

      setQCTasks((prev) =>
        prev.filter((task) => task.id !== selectedTask.id)
      );

      toast("📝 Issues Reported – Back to Editor", {
        description: "Rejection notes have been sent to the editor.",
      });

      setShowVideoReview(false);
      setSelectedFile(null);
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update task status");
    }
  };

  const handleFileSelect = (file: TaskFile) => {
    setSelectedFile(file);
    setShowFileSelector(false);

    const mimeType = getMimeType(file);
    if (mimeType.startsWith('video/')) {
      setShowVideoReview(true);
    } else if (mimeType.startsWith('image/')) {
      setShowThumbnailReview(true);
    } else {
      setShowFilePreview(true);
    }
  };

  // Used by the video ⇄ thumbnail switch buttons inside the review modals —
  // finds the counterpart file on the same task so QC can jump between the
  // two without closing the review screen.
  const getPrimaryVideoFile = (task: typeof selectedTask) => {
    if (!task) return null;
    return (
      task.files?.find(
        (f) => getMimeType(f).startsWith('video/') && (f.folderType || 'main') === 'main'
      ) || null
    );
  };

  const getPrimaryThumbnailFile = (task: typeof selectedTask) => {
    if (!task) return null;
    return (
      task.files?.find((f) => getMimeType(f).startsWith('image/') && f.folderType === 'thumbnails') || null
    );
  };

  const handleThumbnailApprove = async (file: TaskFile) => {
    if (!selectedTask) return;
    try {
      await persistQCResult({
        taskId: selectedTask.id,
        approved: true,
        requiresClientReview: selectedTask.requiresClientReview,
        postingTitles: qcPostingTitles,
        postingDescriptions: qcPostingDescriptions,
        postingTags: qcPostingTags,
      });
      setQCTasks(prev => prev.filter(t => t.id !== selectedTask.id));
      toast("✅ Thumbnail Approved", { description: "Task has been moved to the next stage." });
      setShowThumbnailReview(false);
      setSelectedFile(null);
      setSelectedTask(null);
      setQcPostingTitles([]); setQcPostingDescriptions([]); setQcPostingTags([]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve thumbnail');
    }
  };

  // handleConfirmApproval kept for the bulk-approve path which may still reference it
  const handleConfirmApproval = async () => {
    if (!pendingApprovalType || !pendingApprovalAsset) return;
    const task = pendingApprovalAsset.task;
    if (!task) return;
    setShowTitlePrompt(false);
    try {
      await persistQCResult({
        taskId: task.id,
        approved: true,
        requiresClientReview: pendingApprovalType === "client",
        postingTitles: qcPostingTitles,
        postingDescriptions: qcPostingDescriptions,
        postingTags: qcPostingTags,
      });
      setQCTasks(prev => prev.filter(t => t.id !== task.id));
      toast("✅ Approved – Sent to " + (pendingApprovalType === "client" ? "Client" : "Scheduler"), {
        description: "Content has been moved to the next stage.",
      });
      setSelectedFile(null);
      setSelectedTask(null);
      setQcPostingTitles([]); setQcPostingDescriptions([]); setQcPostingTags([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update task status");
    } finally {
      setPendingApprovalAsset(null);
      setPendingApprovalType(null);
    }
  };

  // QC: Request revisions on thumbnail — mark task as REJECTED and send back to editor
  const handleThumbnailRequestRevisions = async (file: TaskFile, feedbackItems: any[]) => {
    if (!selectedTask) return;
    try {
      const notes = feedbackItems.map((fb: any) => fb.feedback).join('\n');
      await persistQCResult({
        taskId: selectedTask.id,
        approved: false,
        feedback: notes,
        postingTitles: qcPostingTitles,
        postingDescriptions: qcPostingDescriptions,
        postingTags: qcPostingTags,
      });
      setQCTasks(prev => prev.filter(t => t.id !== selectedTask.id));
      toast('📝 Revisions Requested', { description: 'Feedback has been sent back to the editor.' });
      setShowThumbnailReview(false);
      setSelectedFile(null);
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to request revisions');
    }
  };

  const getVideoAssetFromFile = (file: TaskFile) => {
    if (!selectedTask) return null;

    // Find all versions of this file (same folderType)
    const folderType = file.folderType || 'main';
    const versions = (selectedTask.files || [])
      .filter(f => (f.folderType || 'main') === folderType)
      .sort((a, b) => (a.version || 1) - (b.version || 1))
      .map(f => ({
        id: f.id,
        number: String(f.version || 1),
        thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
        duration: '2:30',
        uploadDate: new Date(f.uploadedAt).toLocaleDateString(),
        status: 'in_qc' as 'in_qc',
        url: f.url,
        proxyUrl: f.proxyUrl || null,
        reviewDriveUrl: f.reviewDriveUrl || null,
        sizeBytes: f.size,
      }));

    return {
      id: selectedTask.id,
      title: `${selectedTask.title}`,
      subtitle: `Project: ${selectedTask.clientId}`,
      videoUrl: file.url,
      proxyUrl: file.proxyUrl || null,
      reviewDriveUrl: file.reviewDriveUrl || null,
      thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
      runtime: '2:30',
      status: 'in_qc' as const,
      client: selectedTask.client?.name || 'Unknown Client',
      platform: 'Web',
      resolution: '1920x1080',
      fileSize: formatFileSize(file.size),
      fileSizeBytes: file.size,
      uploader: selectedTask.user?.name || 'Editor',
      uploadDate: new Date(file.uploadedAt).toLocaleDateString(),
      versions: versions,
      currentVersion: file.id,
      downloadEnabled: true,
      approvalLocked: false,
      taskFeedback: (selectedTask as any).taskFeedback || []
    };
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('video/')) return <Video className="h-5 w-5 text-blue-600" />;
    if (mimeType?.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-green-600" />;
    if (mimeType?.includes('pdf')) return <FileText className="h-5 w-5 text-red-600" />;
    return <File className="h-5 w-5 text-gray-600" />;
  };

  const getFileTypeLabel = (mimeType: string) => {
    if (mimeType?.startsWith('video/')) return 'Video';
    if (mimeType?.startsWith('image/')) return 'Image';
    if (mimeType?.includes('pdf')) return 'PDF';
    if (mimeType?.includes('document') || mimeType?.includes('word')) return 'Document';
    if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return 'Spreadsheet';
    return 'File';
  };

  // 🔥 Helper to get folder type display info
  const getFolderTypeInfo = (folderType?: string) => {
    switch (folderType) {
      case 'main':
        return { label: 'Main Task Files', icon: '📁', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'thumbnails':
        return { label: 'Thumbnails', icon: '🖼️', color: 'bg-green-100 text-green-800 border-green-200' };
      case 'tiles':
        return { label: 'Tiles (Snapchat)', icon: '🎨', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'music-license':
        return { label: 'Music License', icon: '🎵', color: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'covers':
        return { label: 'Covers', icon: '📔', color: 'bg-pink-100 text-pink-800 border-pink-200' };
      default:
        return { label: 'Main Task Files', icon: '📁', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
  };

  // 🔥 Group files by folder type
  const groupFilesByFolderType = (files: TaskFile[]) => {
    const groups: Record<string, TaskFile[]> = {};

    files.forEach(file => {
      const folderType = file.folderType || 'main';
      if (!groups[folderType]) {
        groups[folderType] = [];
      }
      groups[folderType].push(file);
    });

    // Sort files within each group by version (newest first) and then by upload date
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        // Sort by version descending (latest version first)
        const versionDiff = (b.version || 1) - (a.version || 1);
        if (versionDiff !== 0) return versionDiff;
        // Then by upload date descending
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      });
    });

    // Order: main files first, then thumbnails, tiles, music-license, covers
    const orderedKeys = ['main', 'thumbnails', 'tiles', 'music-license', 'covers'];
    const result: { folderType: string; files: TaskFile[]; info: ReturnType<typeof getFolderTypeInfo> }[] = [];

    orderedKeys.forEach(key => {
      // Always include 'thumbnails' section even if empty (to show "No thumbnails")
      if (key === 'thumbnails') {
        result.push({
          folderType: key,
          files: groups[key] || [],
          info: getFolderTypeInfo(key)
        });
      } else if (groups[key] && groups[key].length > 0) {
        result.push({
          folderType: key,
          files: groups[key],
          info: getFolderTypeInfo(key)
        });
      }
    });

    // Add any other folder types not in the ordered list
    Object.keys(groups).forEach(key => {
      if (!orderedKeys.includes(key) && groups[key].length > 0) {
        result.push({
          folderType: key,
          files: groups[key],
          info: getFolderTypeInfo(key)
        });
      }
    });

    return result;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTaskCategoryIcon = (category?: string) => {
    switch (category) {
      case 'video':
        return <Video className="h-3 w-3" />;
      case 'design':
        return <Palette className="h-3 w-3" />;
      case 'copywriting':
        return <FileText className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const getDestinationIcon = (destination?: TaskDestination) => {
    switch (destination) {
      case 'client':
        return <UserCheck className="h-3 w-3" />;
      case 'scheduler':
        return <Calendar className="h-3 w-3" />;
      case 'editor':
        return <User className="h-3 w-3" />;
      default:
        return <ArrowRight className="h-3 w-3" />;
    }
  };

  const getDestinationColor = (destination?: TaskDestination) => {
    switch (destination) {
      case 'client':
        return 'text-purple-600 bg-purple-100';
      case 'scheduler':
        return 'text-green-600 bg-green-100';
      case 'editor':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500 bg-red-50';
      case 'high':
        return 'border-l-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getTaskThumbnail = (task: EnhancedWorkflowTask) => {
    if (!task.files || task.files.length === 0) return null;
    // 1. Try to find an active thumbnail
    const thumbFile = task.files.find(f => f.folderType === 'thumbnails' && f.mimeType?.startsWith('image/') && f.isActive !== false);
    if (thumbFile) return thumbFile.url;
    // 2. Try to find any active image
    const activeImage = task.files.find(f => f.mimeType?.startsWith('image/') && f.isActive !== false);
    if (activeImage) return activeImage.url;
    // 3. Fallback to any image
    const anyImage = task.files.find(f => f.mimeType?.startsWith('image/'));
    return anyImage?.url || null;
  };

  const isHardPostTask = (task: EnhancedWorkflowTask) => {
    const type = ((task as any).deliverableType || task.taskType || '').toLowerCase();
    return type.includes('hard post') || type.includes('graphic image');
  };

  const isTextPostTask = (task: EnhancedWorkflowTask) => {
    const type = ((task as any).deliverableType || task.taskType || '').toLowerCase();
    return type.includes('text post');
  };

  const handleTaskClick = (task: EnhancedWorkflowTask) => {
    if (selectionMode && isViewingAsOther) {
      toggleTaskSelection(task.id);
      return;
    }
    setSelectedTask(task);
    setQcPostingTitles((task as any).postingTitles || []);
    setQcPostingDescriptions((task as any).postingDescriptions || []);
    setQcPostingTags((task as any).postingTags || []);
    setSelectedTaskTags(((task as any).tags || []).map((t: any) => t.name));
    setExpandedFileGroups(new Set());

    if (isTextPostTask(task)) {
      setShowTextPostReview(true);
      return;
    }

    // Hard post tasks → open ThumbnailReviewModal directly with sequential images
    if (isHardPostTask(task)) {
      const images = (task.files || [])
        .filter(f => {
          const mime = getMimeType(f);
          return (mime.startsWith('image/png') || mime.startsWith('image/jpeg') || mime.startsWith('image/jpg') || mime.startsWith('image/webp') || mime.startsWith('image/'))
            && f.isActive !== false;
        })
        .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());

      if (images.length > 0) {
        setSelectedFile(images[0]);
        setShowThumbnailReview(true);
        return;
      }
    }

    setShowFileSelector(true);
  };

  // 🔥 Bulk selection helpers
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleToggleSelectionMode = () => {
    if (!isViewingAsOther) return; // bulk selection is admin-viewing-as-QC only
    setSelectionMode((prev) => {
      if (prev) setSelectedTaskIds(new Set()); // leaving selection mode clears selection
      return !prev;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedTaskIds((prev) => {
      const allSelected = filteredTasks.length > 0 && filteredTasks.every((t) => prev.has(t.id));
      if (allSelected) return new Set();
      return new Set(filteredTasks.map((t) => t.id));
    });
  };

  const handleBulkApprove = async () => {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    setIsBulkProcessing(true);

    const results = await Promise.allSettled(
      ids.map((taskId) =>
        persistQCResult({
          taskId,
          approved: true,
          requiresClientReview: qcTasks.find((t) => t.id === taskId)?.requiresClientReview,
        })
      )
    );

    const succeededIds = ids.filter((_, i) => results[i].status === "fulfilled");
    const failedCount = results.length - succeededIds.length;

    if (succeededIds.length > 0) {
      setQCTasks((prev) => prev.filter((t) => !succeededIds.includes(t.id)));
    }

    if (failedCount === 0) {
      toast.success(`✅ ${succeededIds.length} task(s) approved`);
    } else {
      toast.error(`Approved ${succeededIds.length}, failed ${failedCount}. Failed tasks remain selected.`);
    }

    setSelectedTaskIds(new Set(ids.filter((id) => !succeededIds.includes(id))));
    if (succeededIds.length === ids.length) {
      setSelectionMode(false);
    }
    setIsBulkProcessing(false);
  };

  const handleOpenBulkReject = () => {
    if (selectedTaskIds.size === 0) return;
    setBulkRejectFeedback("");
    setShowBulkRejectDialog(true);
  };

  const handleConfirmBulkReject = async () => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    setIsBulkProcessing(true);

    const results = await Promise.allSettled(
      ids.map((taskId) =>
        persistQCResult({
          taskId,
          approved: false,
          feedback: bulkRejectFeedback.trim() || undefined,
        })
      )
    );

    const succeededIds = ids.filter((_, i) => results[i].status === "fulfilled");
    const failedCount = results.length - succeededIds.length;

    if (succeededIds.length > 0) {
      setQCTasks((prev) => prev.filter((t) => !succeededIds.includes(t.id)));
    }

    if (failedCount === 0) {
      toast(`📝 ${succeededIds.length} task(s) sent back to editor`, {
        description: bulkRejectFeedback.trim() ? "Feedback has been shared with the editors." : undefined,
      });
    } else {
      toast.error(`Rejected ${succeededIds.length}, failed ${failedCount}. Failed tasks remain selected.`);
    }

    setSelectedTaskIds(new Set(ids.filter((id) => !succeededIds.includes(id))));
    if (succeededIds.length === ids.length) {
      setSelectionMode(false);
    }
    setShowBulkRejectDialog(false);
    setBulkRejectFeedback("");
    setIsBulkProcessing(false);
  };

  const handleOpenReassign = async (e: React.MouseEvent, task: EnhancedWorkflowTask) => {
    e.stopPropagation();
    setReassignTask(task);
    setSelectedQcId("");
    try {
      const res = await fetch("/api/roles?all=true", { credentials: "include" });
      const data = await res.json();
      const qcs = (data.users || []).filter(
        (u: any) => u.role?.toLowerCase() === "qc"
      );
      setQcUsers(qcs.map((u: any) => ({ id: u.id, name: u.name })));
    } catch {
      setQcUsers([]);
    }
    setShowReassignDialog(true);
  };

  const handleReassign = async () => {
    if (!reassignTask || !selectedQcId) return;
    setIsReassigning(true);
    try {
      const res = await fetch(`/api/tasks/${reassignTask.id}/reassign-qc`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newQcSpecialistId: Number(selectedQcId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reassign failed");
      toast.success(data.message || "Task reassigned");
      setShowReassignDialog(false);
      setReassignTask(null);
      setQCTasks((prev) => prev.filter((t) => t.id !== reassignTask.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign task");
    } finally {
      setIsReassigning(false);
    }
  };

  const handleShare = async (e: React.MouseEvent, task: EnhancedWorkflowTask) => {
    e.stopPropagation();
    setIsSharing(true);
    setCopied(false);

    try {
      const res = await fetch(`/api/tasks/${task.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresAt: null, // Never expires by default
        }),
      });

      if (!res.ok) throw new Error("Failed to generate share link");

      const data = await res.json();
      setShareLink(data.shareUrl);
      setShowShareDialog(true);

      // Auto-copy
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      toast.success("Share link created and copied to clipboard");
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate share link");
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async (file: TaskFile) => {
    try {
      toast.loading('Preparing download...', { id: 'download-file' });

      const response = await fetch(file.url);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.success('Download completed', { id: 'download-file' });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file. Browser restrictions may apply.', { id: 'download-file' });
    }
  };

  // 🔥 DERIVED DATA FOR FILTERING
  const availableDeliverableTypes = useMemo(() => {
    const types = new Set<string>();
    qcTasks.forEach((task: any) => {
      if (task.deliverableType) types.add(task.deliverableType);
    });
    return Array.from(types).sort();
  }, [qcTasks]);

  const availableClients = useMemo(() => {
    const clients = new Map<string, string>();
    qcTasks.forEach((task: any) => {
      if (task.clientId && task.clientName) {
        clients.set(task.clientId, task.clientName);
      }
    });
    return Array.from(clients.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [qcTasks]);

  const filteredTasks = useMemo(() => {
    return qcTasks.filter(task => {
      const matchType = deliverableTypeFilter === "all" || (task as any).deliverableType === deliverableTypeFilter;
      const matchClient = clientFilter === "all" || task.clientId === clientFilter;
      const matchTag = tagFilter === "all" || ((task as any).tags || []).some((t: any) => t.name === tagFilter);
      return matchType && matchClient && matchTag;
    });
  }, [qcTasks, deliverableTypeFilter, clientFilter, tagFilter]);

  const clearAllFilters = () => {
    setDeliverableTypeFilter("all");
    setClientFilter("all");
    setTagFilter("all");
  };

  const hasActiveFilters = deliverableTypeFilter !== "all" || clientFilter !== "all" || tagFilter !== "all";
  const pendingReviews = filteredTasks.length;
  const totalPending = qcTasks.length;

  // Counterpart files for the review-modal switch buttons — only set (and
  // thus only rendered) when the task actually has both a video and a
  // thumbnail to review.
  const switchToThumbnailFile = getPrimaryThumbnailFile(selectedTask);
  const switchToVideoFile = getPrimaryVideoFile(selectedTask);

  return (
    <>
      <div className="flex flex-col h-full space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Content Review</h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Review submitted work and approve or reject with feedback
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* Dashboard Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 mr-1">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Filter:</span>
              </div>

              <Select value={deliverableTypeFilter} onValueChange={setDeliverableTypeFilter}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="Deliverable Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Deliverables</SelectItem>
                  {availableDeliverableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
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

              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="All Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-9 px-2 text-xs text-muted-foreground hover:text-primary"
                >
                  Clear
                </Button>
              )}

              {isViewingAsOther && (
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleSelectionMode}
                  className="h-9 text-xs"
                >
                  {selectionMode ? (
                    <>
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Cancel Selection
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                      Select Multiple
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Stats Badge */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-zinc-100 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 leading-none mb-1">
                  {hasActiveFilters ? 'Filtered' : 'Pending'}
                </span>
                <span className="text-xl font-bold text-zinc-900 leading-none">
                  {pendingReviews}
                </span>
              </div>
              <div className="ml-4 h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {selectionMode && isViewingAsOther && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={filteredTasks.length > 0 && filteredTasks.every((t) => selectedTaskIds.has(t.id))}
                onCheckedChange={handleSelectAllFiltered}
                aria-label="Select all visible tasks"
              />
              <span className="text-sm font-medium text-violet-900">
                {selectedTaskIds.size === 0
                  ? "Select tasks to approve or reject in bulk"
                  : `${selectedTaskIds.size} task${selectedTaskIds.size !== 1 ? "s" : ""} selected`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={selectedTaskIds.size === 0 || isBulkProcessing}
                onClick={handleOpenBulkReject}
              >
                {isBulkProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                )}
                Reject Selected
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={selectedTaskIds.size === 0 || isBulkProcessing}
                onClick={handleBulkApprove}
              >
                {isBulkProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                )}
                Approve Selected
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-40 animate-spin" />
              <p className="font-medium">Loading QC tasks...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
              <Filter className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="font-medium">No tasks match your filters</p>
              <Button variant="link" onClick={clearAllFilters} className="mt-2">
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {filteredTasks.map((task, index) => {
                const thumbnail = getTaskThumbnail(task);
                const deliverableColors = getDeliverableTypeColor((task as any).deliverableType);
                const isChecked = selectedTaskIds.has(task.id);
                return (
                  <Card
                    key={task.id}
                    className={`group cursor-pointer shadow-sm transition-all duration-300 rounded-[1.25rem] overflow-hidden flex flex-col h-full hover:shadow-md ${deliverableColors.bg} ${deliverableColors.border} border hover:${deliverableColors.ring} ${selectedTask?.id === task.id ? "ring-2 ring-primary" : ""} ${isChecked ? "ring-2 ring-violet-500" : ""}`}
                    onClick={() => handleTaskClick(task)}
                  >
                    {/* Visual Header / Thumbnail Area */}
                    <div className="h-44 relative flex items-center justify-center bg-zinc-50 transition-colors overflow-hidden font-bold">
                      {thumbnail && (
                        <img
                          src={thumbnail}
                          alt={task.title}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 z-10"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.opacity = '0';
                          }}
                        />
                      )}
                      <div className="text-zinc-300 text-[10px] font-bold uppercase tracking-wider absolute inset-0 flex items-center justify-center">
                        No thumbnail
                      </div>

                      {thumbnail && (
                        <div className="absolute inset-0 bg-black/5 z-10 pointer-events-none" />
                      )}

                      {selectionMode && isViewingAsOther ? (
                        /* Selection Checkbox - Top Left */
                        <div className="absolute top-3 left-3 z-20">
                          <div
                            className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm border border-zinc-200/50 shadow-sm flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTaskSelection(task.id);
                            }}
                          >
                            <Checkbox checked={isChecked} aria-label={`Select ${task.title}`} />
                          </div>
                        </div>
                      ) : (
                        /* Share + Reassign Buttons - Top Left */
                        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-1.5">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200/50 shadow-sm text-zinc-700 hover:text-primary"
                            onClick={(e) => handleShare(e, task)}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            title="Reassign to another QC"
                            className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200/50 shadow-sm text-zinc-700 hover:text-orange-500"
                            onClick={(e) => handleOpenReassign(e, task)}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}

                      {/* File Count - Top Right */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded bg-white/80 text-zinc-700 text-[11px] font-semibold border border-zinc-200/50 shadow-sm backdrop-blur-sm z-20">
                        <FileText className="h-3 w-3" />
                        {task.files?.length || 0}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="flex-1 min-w-0 text-zinc-900 font-bold text-sm line-clamp-1">
                          {task.title}
                        </h4>
                        <TaskGuidelinesButton
                          clientId={task.clientId}
                          clientName={task.client?.companyName || task.client?.name || null}
                          role="qc"
                        />
                      </div>

                      {/* Deliverable Type Badge */}
                      <div className="flex flex-wrap gap-1.5">
                        {(task as any).deliverableType && (task as any).deliverableType !== "Other" && (
                          <Badge
                            variant="outline"
                            className={`w-fit text-[10px] h-5 px-2 font-medium ${
                              (() => {
                                const dt = ((task as any).deliverableType || '').toLowerCase();
                                if (dt.includes('short form') || dt === 'sf') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
                                if (dt.includes('beta') || dt === 'bsf') return 'bg-teal-100 text-teal-700 border-teal-300';
                                if (dt === 'sqf' || dt.includes('sqf') || dt.includes('super quick')) return 'bg-cyan-100 text-cyan-700 border-cyan-300';
                                if (dt.includes('snapchat') || dt === 'snap') return 'bg-yellow-100 text-yellow-700 border-yellow-300';
                                if (dt.includes('long form') || dt === 'lf') return 'bg-blue-100 text-blue-700 border-blue-300';
                                if (dt.includes('thumbnail') || dt.includes('image')) return 'bg-purple-100 text-purple-700 border-purple-300';
                                if (dt.includes('podcast') || dt.includes('audio')) return 'bg-orange-100 text-orange-700 border-orange-300';
                                return 'bg-zinc-100 text-zinc-600 border-zinc-200';
                              })()
                            }`}
                          >
                            {(task as any).deliverableType}
                          </Badge>
                        )}
                        {task.oneOffDeliverableId && (
                          <Badge variant="outline" className="w-fit text-[10px] h-5 px-2 bg-yellow-50 text-yellow-700 border-yellow-200">
                            One-Off
                          </Badge>
                        )}
                      </div>

                      {/* Editor & Date Row */}
                      <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          <span>Editor: {task.user?.name || ""}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(task.dueDate).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Badges Row */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {task.qcResult === "APPROVED" && task.qcReviewer ? (
                          <Badge className="bg-green-50 text-green-600 hover:bg-green-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold">
                            ✅ Approved by {task.qcReviewer.name}
                          </Badge>
                        ) : task.qcResult === "REJECTED" && task.qcReviewer ? (
                          <Badge className="bg-red-50 text-red-600 hover:bg-red-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold">
                            ❌ Rejected by {task.qcReviewer.name}
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold">
                            Pending
                          </Badge>
                        )}

                        {/* Non-H.264 Badge */}
                        {(() => {
                          const latestVideo = task.files
                            ?.filter(f => f.mimeType?.startsWith('video/'))
                            .sort((a, b) => {
                              if (a.isActive && !b.isActive) return -1;
                              if (!a.isActive && b.isActive) return 1;
                              return (b.version || 1) - (a.version || 1);
                            })[0];

                          if (latestVideo && latestVideo.codec && !latestVideo.codec.toLowerCase().includes('h.264') && !latestVideo.codec.toLowerCase().includes('avc1')) {
                            return (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 rounded-full px-2 py-0.5 text-[10px] font-bold animate-pulse">
                                ⚠️ Non-H.264
                              </Badge>
                            );
                          }
                          return null;
                        })()}

                        {/* No Thumbnails Badge */}
                        {(() => {
                          const hasThumbnails = task.files?.some(f => f.folderType === 'thumbnails');
                          if (!hasThumbnails) {
                            return (
                              <Badge className="bg-gray-100 text-gray-500 border-gray-200 rounded-full px-2 py-0.5 text-[10px] font-medium">
                                🖼️ No Thumbnails
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {selectedTask && (
          <Dialog open={showFileSelector} onOpenChange={setShowFileSelector}>
            <DialogContent className="w-[95vw] max-w-[95vw] max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Review Files by Section
                </DialogTitle>
              </DialogHeader>

              <TagPicker
                taskId={selectedTask.id}
                tags={selectedTaskTags}
                onChange={setSelectedTaskTags}
              />

              <div className="overflow-y-auto max-h-[65vh] pr-2">
                {selectedTask.files && selectedTask.files.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden divide-y">
                    {groupFilesByFolderType(selectedTask.files).map((group) => (
                      <div key={group.folderType}>
                        {/* Section Header */}
                        <div className={`px-4 py-3 ${group.info.color} border-b flex items-center justify-between`}>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{group.info.icon}</span>
                            <h4 className="font-semibold text-sm">{group.info.label}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {group.files.length} file{group.files.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          {group.folderType === 'thumbnails' && group.files.length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white/50 hover:bg-white text-xs h-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setComparisonFiles(group.files);
                                setShowComparison(true);
                              }}
                            >
                              <History className="h-3.5 w-3.5 mr-1.5" />
                              Compare Versions
                            </Button>
                          )}
                          {group.folderType !== 'thumbnails' && group.files.some((f) => (f.version || 1) > 1) && (
                            <Badge variant="outline" className="text-xs">
                              Multiple versions
                            </Badge>
                          )}
                        </div>

                        {/* Files */}
                        <div className="divide-y">
                          {group.files.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                              <span className="text-2xl mb-2 block">🖼️</span>
                              <p className="text-sm font-medium">No {group.info.label.toLowerCase()}</p>
                              <p className="text-xs mt-1">No files uploaded for this section</p>
                            </div>
                          ) : (
                            (expandedFileGroups.has(group.folderType) ? group.files : group.files.slice(0, 1)).map((file, index) => (
                              <div
                                key={file.id}
                                className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${file.isActive === false ? "opacity-60 bg-muted/20" : ""}`}
                                onClick={() => handleFileSelect(file)}
                              >
                                <div className="flex items-center gap-4">
                                  <div className={`p-3 rounded-lg flex-shrink-0 ${file.mimeType?.startsWith("video/") ? "bg-blue-100" : file.mimeType?.startsWith("image/") ? "bg-green-100" : "bg-gray-100"}`}>
                                    {getFileIcon(file.mimeType)}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <p className="font-medium text-sm truncate max-w-[300px]">{file.name}</p>
                                      <Badge variant={file.isActive !== false ? "default" : "secondary"} className="text-xs">
                                        V{file.version || 1}
                                      </Badge>
                                      {file.isActive !== false && index === 0 && (
                                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Latest
                                        </Badge>
                                      )}
                                      {file.isActive === false && (
                                        <Badge variant="outline" className="text-xs text-muted-foreground">
                                          Replaced
                                        </Badge>
                                      )}
                                      <Badge variant="secondary" className="text-xs">
                                        {getFileTypeLabel(file.mimeType)}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                      <span>{formatFileSize(file.size)}</span>
                                      <span>•</span>
                                      <span>Uploaded {new Date(file.uploadedAt).toLocaleDateString()}</span>
                                      {file.revisionNote && (
                                        <>
                                          <span>•</span>
                                          <span className="text-orange-600" title={file.revisionNote}>
                                            📝 Has revision note
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {file.mimeType?.startsWith("video/") ? (
                                      <div className="flex items-center gap-2">
                                        {file.optimizationStatus === 'PROCESSING' || file.optimizationStatus === 'PENDING' ? (
                                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 text-xs animate-pulse">
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            <span>Optimizing...</span>
                                          </div>
                                        ) : (
                                          <>
                                            <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleFileSelect(file); }}>
                                              <Play className="h-4 w-4 mr-2" />
                                              Review
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-9 w-9 p-0" title="Download Video" onClick={(e) => { e.stopPropagation(); handleDownload(file); }}>
                                              <Download className="h-4 w-4" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    ) : file.mimeType?.startsWith('image/') ? (
                                      <div className="flex items-center gap-2">
                                        <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleFileSelect(file); }}>
                                          <Eye className="h-4 w-4 mr-2" />
                                          Review
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-9 w-9 p-0" title="Download File" onClick={(e) => { e.stopPropagation(); handleDownload(file); }}>
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleFileSelect(file); }}>
                                          <ExternalLink className="h-4 w-4 mr-2" />
                                          View
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-9 w-9 p-0" title="Download File" onClick={(e) => { e.stopPropagation(); handleDownload(file); }}>
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                          {group.files.length > 1 && (
                            <div className="p-2.5 text-center bg-muted/20">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-muted-foreground hover:text-foreground"
                                onClick={() => toggleFileGroupExpanded(group.folderType)}
                              >
                                {expandedFileGroups.has(group.folderType) ? (
                                  <>
                                    <ChevronUp className="h-3.5 w-3.5 mr-1" />
                                    Show less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                                    Read more ({group.files.length - 1} older version{group.files.length - 1 !== 1 ? "s" : ""})
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-medium">No files found in this task</p>
                    <p className="text-sm mt-1">Files will appear here once they are uploaded by the editor.</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {selectedTask && selectedFile && selectedFile.mimeType?.startsWith("video/") && (
          <FullScreenReviewModalFrameIO
            open={showVideoReview}
            onOpenChange={(open: boolean) => {
              setShowVideoReview(open);
              if (!open) {
                setSelectedFile(null);
                setSelectedTask(null);
                setQcPostingTitles([]); setQcPostingDescriptions([]); setQcPostingTags([]);
              }
            }}
            asset={getVideoAssetFromFile(selectedFile)}
            onApprove={() => { }}
            onRequestRevisions={() => { }}
            userRole="qc"
            // 🔀 Switch to thumbnail review without leaving the modal — only
            // offered when this task actually has a thumbnail to review.
            onSwitchToThumbnail={
              switchToThumbnailFile ? () => handleFileSelect(switchToThumbnailFile) : undefined
            }
            onSendToClient={handleSendToClient}
            onSendBackToEditor={handleSendBackToEditor}
            taskId={selectedTask.id}
            requiresClientReview={selectedTask.requiresClientReview}
            currentFileSection={{
              folderType: selectedFile.folderType || "main",
              fileId: selectedFile.id,
              version: selectedFile.version || 1,
            }}
            postingTitles={qcPostingTitles}
            postingDescriptions={qcPostingDescriptions}
            postingTags={qcPostingTags}
            onPostingTitlesChange={setQcPostingTitles}
            onPostingDescriptionsChange={setQcPostingDescriptions}
            onPostingTagsChange={setQcPostingTags}
          />
        )}

        {selectedTask && selectedFile && selectedFile.mimeType?.startsWith('image/') && (
          <ThumbnailReviewModal
            open={showThumbnailReview}
            onOpenChange={(open: boolean) => {
              setShowThumbnailReview(open);
              if (!open) {
                setSelectedFile(null);
                setQcPostingTitles([]); setQcPostingDescriptions([]); setQcPostingTags([]);
              }
            }}
            file={selectedFile}
            allFiles={selectedTask.files || []}
            taskId={selectedTask.id}
            taskTitle={selectedTask.title}
            onApprove={handleThumbnailApprove}
            onRequestRevisions={handleThumbnailRequestRevisions}
            userRole="qc"
            imageLabel={isHardPostTask(selectedTask) ? 'Images' : 'Thumbnails'}
            onSwitchToVideo={
              switchToVideoFile ? () => handleFileSelect(switchToVideoFile) : undefined
            }
            postingTitles={qcPostingTitles}
            postingDescriptions={qcPostingDescriptions}
            postingTags={qcPostingTags}
            onPostingTitlesChange={setQcPostingTitles}
            onPostingDescriptionsChange={setQcPostingDescriptions}
            onPostingTagsChange={setQcPostingTags}
          />
        )}

        {selectedTask && isTextPostTask(selectedTask) && (
          <TextPostReviewModal
            open={showTextPostReview}
            onOpenChange={(open: boolean) => {
              setShowTextPostReview(open);
              if (!open) {
                setSelectedTask(null);
                setQcPostingTitles([]); setQcPostingDescriptions([]); setQcPostingTags([]);
              }
            }}
            taskId={selectedTask.id}
            taskTitle={selectedTask.title}
            textContent={(selectedTask as any).textContent || ''}
            onApprove={() => handleThumbnailApprove(null as any)}
            onRequestRevisions={(items) => handleThumbnailRequestRevisions(null as any, items)}
          />
        )}

        {selectedTask && (
          <ThumbnailComparisonModal
            isOpen={showComparison}
            onOpenChange={setShowComparison}
            thumbnails={comparisonFiles}
            taskTitle={selectedTask.title}
          />
        )}

        {selectedTask && selectedFile && !selectedFile.mimeType?.startsWith('video/') && !selectedFile.mimeType?.startsWith('image/') && showFilePreview && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${selectedFile.mimeType?.startsWith("image/") ? "bg-green-500/20" : "bg-blue-500/20"}`}>
                  {getFileIcon(selectedFile.mimeType)}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg truncate max-w-[300px] md:max-w-[500px]">
                    {selectedFile.name}
                  </h3>
                  <p className="text-white/50 text-sm">
                    {getFileTypeLabel(selectedFile.mimeType)} • {formatFileSize(selectedFile.size)} • Uploaded {new Date(selectedFile.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40" onClick={() => window.open(selectedFile.url, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Open in New Tab</span>
                </Button>
                <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40" onClick={() => handleDownload(selectedFile)}>
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-10 w-10" onClick={() => { setShowFilePreview(false); setSelectedFile(null); }}>
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
              {getMimeType(selectedFile).startsWith("image/") ? (
                <img key={selectedFile.url} src={selectedFile.url} alt={selectedFile.name} className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl" />
              ) : getMimeType(selectedFile).includes("pdf") ? (
                <iframe key={selectedFile.url} src={selectedFile.url} className="w-full h-[85vh] bg-white rounded-lg shadow-2xl" title="PDF Preview" />
              ) : (
                <div className="text-center">
                  <div className="p-10 bg-white/5 rounded-3xl backdrop-blur-sm border border-white/10 max-w-lg mx-auto">
                    <div className="p-8 bg-white/10 rounded-2xl inline-block mb-6">
                      {getFileIcon(selectedFile.mimeType)}
                    </div>
                    <h3 className="text-white text-2xl font-semibold mb-3">{selectedFile.name}</h3>
                    <p className="text-white/60 text-base mb-2">{getFileTypeLabel(selectedFile.mimeType)} • {formatFileSize(selectedFile.size)}</p>
                    <p className="text-white/40 text-sm mb-8">Preview not available for this file type.</p>
                    <div className="flex gap-4 justify-center">
                      <Button size="lg" onClick={() => window.open(selectedFile.url, "_blank")} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <ExternalLink className="h-5 w-5 mr-2" />
                        Open File
                      </Button>
                      <Button size="lg" onClick={() => handleDownload(selectedFile)} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <Download className="h-5 w-5 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* QC Title Prompt Dialog — removed: titles are now composed in the review sidebar */}

      {/* QC Reassign Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-orange-500" />
              Reassign to another QC
            </DialogTitle>
            <DialogDescription>
              {reassignTask?.title && (
                <span className="block text-xs text-zinc-500 mt-1 truncate">
                  Task: {reassignTask.title}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={selectedQcId} onValueChange={setSelectedQcId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a QC specialist…" />
              </SelectTrigger>
              <SelectContent>
                {qcUsers.filter((u) => u.id !== user?.id).length === 0 && (
                  <SelectItem value="__none" disabled>No other QC specialists found</SelectItem>
                )}
                {qcUsers
                  .filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowReassignDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedQcId || isReassigning}
              onClick={handleReassign}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isReassigning ? "Reassigning…" : "Reassign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog open={showBulkRejectDialog} onOpenChange={(open) => { if (!open && !isBulkProcessing) { setShowBulkRejectDialog(false); setBulkRejectFeedback(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Reject {selectedTaskIds.size} Task{selectedTaskIds.size !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              These tasks will be sent back to their editors. Feedback below will be applied to all selected tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Textarea
              placeholder="Optional: describe what needs to be fixed (applies to all selected tasks)…"
              value={bulkRejectFeedback}
              onChange={(e) => setBulkRejectFeedback(e.target.value)}
              className="text-sm min-h-[100px]"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" disabled={isBulkProcessing} onClick={() => { setShowBulkRejectDialog(false); setBulkRejectFeedback(""); }}>
              Cancel
            </Button>
            <Button
              disabled={isBulkProcessing}
              onClick={handleConfirmBulkReject}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isBulkProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Rejecting…
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Reject {selectedTaskIds.size} Task{selectedTaskIds.size !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}