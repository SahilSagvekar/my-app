import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Eye,
  Calendar,
  User,
  Play,
  ArrowRight,
  Video,
  Palette,
  Image as ImageIcon,
  File,
  ExternalLink,
  MessageSquare,
  Send,
  RotateCcw,
  History,
  Share,
  Copy,
  Check,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { FullScreenReviewModalFrameIO } from '../client/FullScreenReviewModalFrameIO';
import { ThumbnailComparisonModal } from '../client/ThumbnailComparisonModal';
import { ThumbnailReviewModal } from '../client/ThumbnailReviewModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ShareDialog } from '../review/ShareDialog';
import { Checkbox } from '../ui/checkbox';

import { useAuth } from '../auth/AuthContext';
import { toast } from 'sonner';
import { FilePreviewModal } from '../FileViewerModal';

interface TaskFile {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  driveFileId: string;
  mimeType: string;
  size: number;
  folderType?: string;
  version?: number;
  isActive?: boolean;
  replacedAt?: string;
  revisionNote?: string;
  s3Key?: string;
  downloadUrl?: string;
  optimizationStatus?: string;
  optimizationError?: string | null;
}

interface ClientTask {
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
  workflowStep?: string;
  folderType?: string;
  qcNotes?: string | null;
  feedback?: string;
  files?: TaskFile[];
  monthlyDeliverable?: any;
  socialMediaLinks?: string[];
  user?: {
    name: string;
    role: string;
  };
}

/* -------------------------------------------------------------------------- */
/* 🔥 PERSIST CLIENT REVIEW RESULT - Similar to QC's persistQCResult          */
/* -------------------------------------------------------------------------- */

const persistClientResult = async ({
  taskId,
  approved,
  feedback,
}: {
  taskId: string;
  approved: boolean;
  feedback?: string;
}) => {
  const metaBody: any = {};

  if (approved) {
    // Client approved → Send to Scheduler
    // 🔥 FIX: Use "COMPLETED" (valid TaskStatus) instead of "APPROVED"
    metaBody.status = "COMPLETED";
    metaBody.clientResult = "APPROVED";
    metaBody.route = "scheduler";
    if (feedback) {
      metaBody.clientFeedback = feedback;
    }
  } else {
    // Client requested revisions → Send back to Editor
    // Use REJECTED as the valid TaskStatus
    metaBody.status = "REJECTED";
    metaBody.clientResult = "REVISION_REQUESTED";
    metaBody.route = "editor";
    if (feedback) {
      metaBody.clientNotes = feedback;
      metaBody.rejectionReason = feedback;
    }
  }

  const res = await fetch(`/api/tasks/${taskId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(metaBody),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Client review update failed:", body);
    throw new Error("Failed to update task status");
  }

  return res.json();
};

/* -------------------------------------------------------------------------- */
/* 🔥 MAIN CLIENT DASHBOARD COMPONENT                                         */
/* -------------------------------------------------------------------------- */

export function ClientDashboard() {
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null);
  const [selectedFile, setSelectedFile] = useState<TaskFile | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showVideoReview, setShowVideoReview] = useState(false);
  const [showThumbnailReview, setShowThumbnailReview] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'pending' | 'approved' | 'posted'>('pending');
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonFiles, setComparisonFiles] = useState<TaskFile[]>([]);
  const [videoApprovedTasks, setVideoApprovedTasks] = useState<Set<string>>(new Set());
  const [thumbApprovedTasks, setThumbApprovedTasks] = useState<Set<string>>(new Set());

  // 🔥 Share states
  const [shareLink, setShareLink] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // 🔥 Download Selector states
  const [showDownloadSelector, setShowDownloadSelector] = useState(false);
  const [downloadSelectedFiles, setDownloadSelectedFiles] = useState<Set<string>>(new Set());

  const { user } = useAuth();

  const loadClientTasks = useCallback(async () => {
    try {
      setLoading(true);
      // 🔥 Fetch tasks pending client review
      // These are tasks that QC approved and routed to client
      const res = await fetch("/api/tasks", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        let errDetails = "Unknown Error";
        try {
          const errData = await res.json();
          console.error("API Error Response Data:", errData);
          errDetails = errData.error || errData.message || JSON.stringify(errData);
        } catch (e) {
          const text = await res.text().catch(() => "Could not read response body");
          console.error("API Error Response Text:", text);
          errDetails = text || res.statusText;
        }
        throw new Error(`Failed fetching client tasks [${res.status} ${res.statusText}]: ${errDetails}`);
      }

      const responseData = await res.json();
      let data = responseData.tasks || responseData;
      if (!Array.isArray(data)) {
        console.error("Client API returned non-array:", data);
        return;
      }

      const normalized = data.map((task: any) => ({
        ...task,
        status: task.status,
        priority: task.priority || "medium",
        taskCategory: task.taskCategory || "design",
        files: task.files || [],
      }));

      // Sort: Pending first, then Approved (Completed/Scheduled), then Posted, then by due date
      const sorted = normalized.sort((a, b) => {
        const getOrder = (status: string) => {
          if (status === 'POSTED') return 3;
          if (status === 'COMPLETED' || status === 'SCHEDULED') return 2;
          return 1; // Pending review etc
        };

        const orderA = getOrder(a.status);
        const orderB = getOrder(b.status);

        if (orderA !== orderB) return orderA - orderB;

        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      setTasks(sorted);
    } catch (err) {
      console.error("Client tasks load error:", err);
      toast.error("Failed to load tasks for review");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClientTasks();

    // 🔥 Poll for status updates if any task is optimizing
    const hasActiveJobs = tasks.some(t =>
      t.files?.some(f => f.optimizationStatus === 'PROCESSING' || f.optimizationStatus === 'PENDING')
    );

    if (hasActiveJobs) {
      console.log("⏱️ Active optimization detected in Client dashboard, starting poll...");
      const interval = setInterval(loadClientTasks, 15000); // Poll every 15s
      return () => clearInterval(interval);
    }
  }, [loadClientTasks, tasks]);

  // Global listener for background task updates
  useEffect(() => {
    const handleTaskGlobalUpdate = (e: any) => {
      if (e.detail?.taskId) {
        console.log("🔔 Global update received for task in Client:", e.detail.taskId);
        loadClientTasks();
      }
    };
    window.addEventListener('task-updated', handleTaskGlobalUpdate);
    return () => window.removeEventListener('task-updated', handleTaskGlobalUpdate);
  }, [loadClientTasks]);

  const handleMarkAsPosted = async (task?: ClientTask) => {
    const taskToMark = task || selectedTask;
    if (!taskToMark) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/tasks/${taskToMark.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "POSTED" }),
      });

      if (!res.ok) {
        let errDetails = "Unknown Error";
        try {
          const errData = await res.json();
          console.error("Mark as Posted API Error Data:", errData);
          errDetails = errData.error || errData.message || JSON.stringify(errData);
        } catch (e) {
          const text = await res.text().catch(() => "Could not read response body");
          console.error("Mark as Posted API Error Text:", text);
          errDetails = text || res.statusText;
        }
        throw new Error(`Failed to mark as posted [${res.status}]: ${errDetails}`);
      }

      // Update task in list
      setTasks((prev) => prev.map((t) =>
        t.id === taskToMark.id
          ? { ...t, status: "POSTED" }
          : t
      ));

      // Re-sort
      setTasks((prev) => [...prev].sort((a, b) => {
        const getOrder = (status: string) => {
          if (status === 'POSTED') return 3;
          if (status === 'COMPLETED' || status === 'SCHEDULED') return 2;
          return 1;
        };
        const orderA = getOrder(a.status);
        const orderB = getOrder(b.status);
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }));

      toast.success("🚀 Task Marked as Posted", {
        description: "Task has been updated to posted status.",
      });

      setShowVideoReview(false);
      setShowFileSelector(false);
      setSelectedFile(null);
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark task as posted");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------------------- APPROVE HANDLER ----------------------------- */

  const handleApprove = async (task?: ClientTask) => {
    const taskToApprove = task || selectedTask;
    if (!taskToApprove) return;

    try {
      setIsSubmitting(true);

      await persistClientResult({
        taskId: taskToApprove.id,
        approved: true,
      });

      // Update task in list instead of removing it
      setTasks((prev) => prev.map((t) =>
        t.id === taskToApprove.id
          ? { ...t, status: "COMPLETED" }
          : t
      ));

      // Re-sort tasks so the approved one moves to the end
      setTasks((prev) => [...prev].sort((a, b) => {
        const getOrder = (status: string) => {
          if (status === 'POSTED') return 3;
          if (status === 'COMPLETED' || status === 'SCHEDULED') return 2;
          return 1;
        };
        const orderA = getOrder(a.status);
        const orderB = getOrder(b.status);
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }));

      toast.success("✅ Approved – Sent to Scheduler", {
        description: "Content has been approved and sent for scheduling.",
      });

      // Close modals and reset state
      setShowVideoReview(false);
      setShowThumbnailReview(false);
      setShowFileSelector(false);
      setSelectedFile(null);
      setSelectedTask(null);

      // Clear session approval tracking for this task
      setVideoApprovedTasks(prev => {
        const next = new Set(prev);
        next.delete(taskToApprove.id);
        return next;
      });
      setThumbApprovedTasks(prev => {
        const next = new Set(prev);
        next.delete(taskToApprove.id);
        return next;
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve task");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------------------------- REQUEST REVISIONS HANDLER ---------------------- */

  const handleRequestRevisions = async () => {
    if (!selectedTask) return;

    if (!revisionNotes.trim()) {
      toast.error("Please provide feedback for the revision request");
      return;
    }

    try {
      setIsSubmitting(true);

      await persistClientResult({
        taskId: selectedTask.id,
        approved: false,
        feedback: revisionNotes,
      });

      // Update task status or keep it?
      // For revision requests, it might be better to keep it if they want to see "Revision Requested"
      // But usually they want to move it out or keep it at the end too.
      // Given the prompt "once approved... should be moved to the end", maybe focus only on approved.
      // However, if I change the logic for approved, I should probably handle REJECTED too so it doesn't just disappear if they expect consistency.
      // But the user ONLY asked for approved tasks.
      // Let's stick strictly to the user's request for approved tasks first.
      // Wait, if I don't remove REJECTED ones, they will also stay.

      // Let's just remove REJECTED ones as before, UNLESS the user wants them to stay too.
      // The prompt specifically said "once the client has approved a task".

      setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));

      toast.success("📝 Revision Requested – Sent to Editor", {
        description: "Your feedback has been sent to the editor.",
      });

      // Close modals and reset state
      setShowRevisionDialog(false);
      setShowVideoReview(false);
      setShowFileSelector(false);
      setRevisionNotes("");
      setSelectedFile(null);
      setSelectedTask(null);

      // Clear session approval tracking for this task
      setVideoApprovedTasks(prev => {
        const next = new Set(prev);
        next.delete(selectedTask.id);
        return next;
      });
      setThumbApprovedTasks(prev => {
        const next = new Set(prev);
        next.delete(selectedTask.id);
        return next;
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to request revisions");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ----------------------- VIDEO REVIEW MODAL HANDLERS ---------------------- */

  // Called from FullScreenReviewModal when client approves
  const handleVideoApprove = async (asset: any) => {
    if (!selectedTask) return;

    // Mark video as approved locally
    setVideoApprovedTasks(prev => new Set(prev).add(selectedTask.id));

    const hasThumbnails = selectedTask.files?.some(f => f.folderType === 'thumbnails');
    const isThumbApproved = thumbApprovedTasks.has(selectedTask.id);

    if (hasThumbnails && !isThumbApproved) {
      toast.success("Video Approved", {
        description: "Please also review and approve a thumbnail to complete the task.",
      });
      setShowVideoReview(false);
      setShowFileSelector(true);
    } else {
      await handleApprove();
    }
  };

  // Called from FullScreenReviewModal when client requests revisions
  const handleVideoRequestRevisions = async (asset: any, revisionData: any) => {
    if (!selectedTask) return;

    const notes = revisionData?.notes || revisionData?.feedback || "";

    try {
      setIsSubmitting(true);

      await persistClientResult({
        taskId: selectedTask.id,
        approved: false,
        feedback: notes,
      });

      // Remove task from list - Revision requested tasks should disappear as they go back to the editor
      setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));

      toast.success("📝 Revision Requested – Sent to Editor", {
        description: "Your feedback has been sent to the editor.",
      });

      setShowVideoReview(false);
      setSelectedFile(null);
      setSelectedTask(null);

      // Clear session approval tracking for this task
      setVideoApprovedTasks(prev => {
        const next = new Set(prev);
        next.delete(selectedTask.id);
        return next;
      });
      setThumbApprovedTasks(prev => {
        const next = new Set(prev);
        next.delete(selectedTask.id);
        return next;
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to request revisions");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------------- THUMBNAIL REVIEW HANDLERS ------------------------- */

  const handleThumbnailApprove = async (file: TaskFile) => {
    if (!selectedTask) return;

    // Mark thumbnail as approved locally
    setThumbApprovedTasks(prev => new Set(prev).add(selectedTask.id));

    const hasVideo = selectedTask.files?.some(f => f.mimeType?.startsWith('video/') && (f.folderType || 'main') === 'main');
    const isVideoApproved = videoApprovedTasks.has(selectedTask.id);

    if (hasVideo && !isVideoApproved) {
      toast.success("Thumbnail Approved", {
        description: "Please also review and approve the main video to complete the task.",
      });
      setShowThumbnailReview(false);
      setShowFileSelector(true);
    } else {
      await handleApprove();
    }
  };

  const handleThumbnailRequestRevisions = async (file: TaskFile, feedback: any[]) => {
    if (!selectedTask) return;

    // Summary of feedback
    const notesArr = feedback.map(f => `[${f.category}] ${f.feedback}`);
    const notes = notesArr.join('\n');

    try {
      setIsSubmitting(true);
      await persistClientResult({
        taskId: selectedTask.id,
        approved: false,
        feedback: notes,
      });

      setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));

      toast.success("📝 Revisions Requested", {
        description: "Your feedback on the thumbnail has been sent.",
      });

      setShowThumbnailReview(false);
      setShowFileSelector(false);
      setSelectedFile(null);
      setSelectedTask(null);

      // Clear session approval tracking for this task
      setVideoApprovedTasks(prev => {
        const next = new Set(prev);
        next.delete(selectedTask.id);
        return next;
      });
      setThumbApprovedTasks(prev => {
        const next = new Set(prev);
        next.delete(selectedTask.id);
        return next;
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to request revisions");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* -------------------------- DOWNLOAD HANDLERS ------------------------------- */

  const handleDownloadAllFiles = async (task?: ClientTask) => {
    const taskToDownload = task || selectedTask;
    if (!taskToDownload || !taskToDownload.files || taskToDownload.files.length === 0) {
      toast.error("No files available for download");
      return;
    }

    // Select all active files by default
    const activeFileIds = taskToDownload.files
      .filter(f => f.isActive !== false)
      .map(f => f.id);

    setDownloadSelectedFiles(new Set(activeFileIds));
    if (task) {
      setSelectedTask(task);
    }
    setShowDownloadSelector(true);
  };

  const confirmDownload = async () => {
    if (!selectedTask || downloadSelectedFiles.size === 0) {
      toast.error("Please select at least one file to download");
      return;
    }

    const filesToDownload = selectedTask.files?.filter(f => downloadSelectedFiles.has(f.id)) || [];

    try {
      setIsSubmitting(true);
      setShowDownloadSelector(false);
      toast.info(`Starting download for ${filesToDownload.length} file(s)...`);

      for (const file of filesToDownload) {
        // Priority: downloadUrl > download API for S3 > direct URL
        if (file.downloadUrl) {
          window.open(file.downloadUrl, '_blank');
        } else {
          const isS3 = file.url?.includes('amazonaws.com') || file.url?.includes('r2.cloudflarestorage.com') || file.url?.includes('r2.dev') || !!file.s3Key;
          if (isS3) {
            window.open(`/api/files/${file.id}/download`, '_blank');
          } else {
            window.open(file.url, '_blank');
          }
        }

        // Small delay for multiple files
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast.success("Download requests sent!");
    } catch (error) {
      console.error("Error in download loop:", error);
      toast.error("An error occurred while preparing downloads.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async (e: React.MouseEvent, task: ClientTask) => {
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

      // Auto-copy with fallback for focus issues
      try {
        await navigator.clipboard.writeText(data.shareUrl);
        setCopied(true);
        toast.success("Share link created and copied to clipboard");
        setTimeout(() => setCopied(false), 3000);
      } catch (clipErr) {
        console.warn("Auto-copy to clipboard failed (likely focus issue):", clipErr);
        toast.success("Share link created!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate share link");
    } finally {
      setIsSharing(false);
    }
  };



  /* ---------------------------- FILE HANDLING ------------------------------- */

  const handleFileSelect = (file: TaskFile) => {
    setSelectedFile(file);
    setShowFileSelector(false);

    if (isReviewable(file)) {
      if (file.mimeType?.startsWith('video/')) {
        setShowVideoReview(true);
      } else if (file.mimeType?.startsWith('image/')) {
        setShowThumbnailReview(true);
      }
    } else {
      // Open in-app preview modal (standard viewer)
      setIsPreviewOpen(true);
    }
  };

  const getVideoAssetFromFile = (file: TaskFile) => {
    if (!selectedTask) return null;

    // Get all video files from the same folder type to show as versions
    const allVideosInFolder = selectedTask.files
      ?.filter(f =>
        f.mimeType?.startsWith('video/') &&
        (f.folderType || 'main') === (file.folderType || 'main')
      )
      .sort((a, b) => (b.version || 1) - (a.version || 1)) || [];

    // Build versions array from all videos in the same folder
    const versions = allVideosInFolder.length > 0
      ? allVideosInFolder.map((f, index) => ({
        id: f.id,
        number: String(f.version || index + 1),
        thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
        duration: '2:30',
        uploadDate: new Date(f.uploadedAt).toLocaleDateString(),
        status: 'client_review' as const,
        url: f.url // Store URL to switch videos
      }))
      : [{
        id: file.id,
        number: String(file.version || 1),
        thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
        duration: '2:30',
        uploadDate: new Date(file.uploadedAt).toLocaleDateString(),
        status: 'client_review' as const,
        url: file.url
      }];

    return {
      id: selectedTask.id,
      title: `${selectedTask.title} - ${file.name}`,
      subtitle: `Review Request`,
      videoUrl: file.url,
      thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
      runtime: '2:30',
      status: 'client_review' as const,
      client: 'You',
      platform: 'Web',
      resolution: '1920x1080',
      fileSize: formatFileSize(file.size),
      uploader: 'Editor',
      uploadDate: new Date(file.uploadedAt).toLocaleDateString(),
      versions: versions,
      currentVersion: file.id,
      downloadEnabled: true,
      approvalLocked: selectedTask.status === 'COMPLETED' || selectedTask.status === 'SCHEDULED'
    };
  };

  /* ---------------------------- HELPER FUNCTIONS ---------------------------- */

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

  const getFolderTypeInfo = (folderType?: string) => {
    switch (folderType) {
      case 'main':
        return { label: 'Main Files', icon: '📁', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'thumbnails':
        return { label: 'Thumbnails', icon: '🖼️', color: 'bg-green-100 text-green-800 border-green-200' };
      case 'tiles':
        return { label: 'Tiles', icon: '🎨', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'music-license':
        return { label: 'Music License', icon: '🎵', color: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'covers':
        return { label: 'Covers', icon: '📔', color: 'bg-pink-100 text-pink-800 border-pink-200' };
      default:
        return { label: 'Main Files', icon: '📁', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
  };

  const groupFilesByFolderType = (files: TaskFile[]) => {
    const groups: Record<string, TaskFile[]> = {};

    files.forEach(file => {
      const folderType = file.folderType || 'main';
      if (!groups[folderType]) {
        groups[folderType] = [];
      }
      groups[folderType].push(file);
    });

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const versionDiff = (b.version || 1) - (a.version || 1);
        if (versionDiff !== 0) return versionDiff;
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      });
    });

    const orderedKeys = ['main', 'thumbnails', 'tiles', 'music-license', 'covers'];
    const result: { folderType: string; files: TaskFile[]; info: ReturnType<typeof getFolderTypeInfo> }[] = [];

    orderedKeys.forEach(key => {
      if (groups[key] && groups[key].length > 0) {
        result.push({
          folderType: key,
          files: groups[key],
          info: getFolderTypeInfo(key)
        });
      }
    });

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

  const isReviewable = (file: TaskFile) => {
    if (file.folderType === 'music-license') return false;
    const reviewableFolders = ['main', 'thumbnails', 'tiles', 'covers'];
    return (
      reviewableFolders.includes(file.folderType || 'main') &&
      (file.mimeType?.startsWith('video/') || file.mimeType?.startsWith('image/'))
    );
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

  const getTaskThumbnail = (task: ClientTask) => {
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

  const isOverdue = (task: ClientTask) => new Date(task.dueDate) < new Date();

  const handleTaskClick = (task: ClientTask) => {
    setSelectedTask(task);
    setShowFileSelector(true);
  };

  /* ----------------------------- STATS ------------------------------------ */

  const pendingReviews = tasks.filter(task => !(task.status === 'COMPLETED' || task.status === 'SCHEDULED' || task.status === 'POSTED')).length;
  const approvedCount = tasks.filter(task => task.status === 'COMPLETED').length;
  const postedCount = tasks.filter(task => task.status === 'POSTED' || task.status === 'SCHEDULED').length;
  const overdueReviews = tasks.filter(task => isOverdue(task)).length;

  const filteredTasks = tasks.filter(task => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'pending') {
      return !(task.status === 'COMPLETED' || task.status === 'SCHEDULED' || task.status === 'POSTED');
    }
    if (currentFilter === 'approved') {
      return task.status === 'COMPLETED';
    }
    if (currentFilter === 'posted') {
      return task.status === 'POSTED' || task.status === 'SCHEDULED';
    }
    return true;
  });

  /* -------------------------------------------------------------------------- */

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full space-y-6">
        {/* Page Header & Filter Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Content Review</h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Review content from your team and approve or request revisions
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Tabs
              value={currentFilter}
              onValueChange={(val: any) => setCurrentFilter(val)}
              className="w-full lg:w-auto"
            >
              <TabsList className="bg-zinc-100 p-1">
                <TabsTrigger
                  value="all"
                  className="px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium flex items-center gap-2"
                >
                  All Tasks
                  {tasks.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 text-[10px] bg-zinc-200/50"
                    >
                      {tasks.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="pending"
                  className="px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium flex items-center gap-2"
                >
                  Pending Review
                  {pendingReviews > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 text-[10px] bg-zinc-200/50"
                    >
                      {pendingReviews}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="approved"
                  className="px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium flex items-center gap-2"
                >
                  Approved
                  {approvedCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 text-[10px] bg-zinc-200/50"
                    >
                      {approvedCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="posted"
                  className="px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium flex items-center gap-2"
                >
                  Posted
                  {postedCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 text-[10px] bg-zinc-200/50"
                    >
                      {postedCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-40 animate-spin" />
              <p className="font-medium">Loading tasks for review...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-40 text-emerald-500" />
              <p className="font-medium">No tasks found</p>
              <p className="text-sm mt-1">
                {currentFilter === "all"
                  ? "No content available yet"
                  : `No tasks currently in ${currentFilter} status`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {filteredTasks.map((task, index) => {
                const thumbnail = getTaskThumbnail(task);
                return (
                  <Card
                    key={task.id}
                    className={`group cursor-pointer border-none shadow-sm transition-all duration-300 rounded-[1.25rem] overflow-hidden flex flex-col h-full bg-white hover:shadow-md hover:ring-1 hover:ring-zinc-200 ${selectedTask?.id === task.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => handleTaskClick(task)}
                  >
                    {/* Visual Header / Thumbnail Area */}
                    <div
                      className={`h-44 relative flex items-center justify-center bg-zinc-50 transition-colors overflow-hidden font-bold`}
                    >
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={task.title}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        /* No thumbnail text fallback */
                        <div className="text-zinc-300 text-[10px] font-bold uppercase tracking-wider">
                          No thumbnail
                        </div>
                      )}

                      {/* Darker overlay if thumbnail exists for better icon readability */}
                      {thumbnail && (
                        <div className="absolute inset-0 bg-black/5" />
                      )}

                      {/* Status Overlay - Top Left */}
                      {/* <div className="absolute top-3 left-3">
                      <div className="p-1 rounded bg-zinc-200/50 text-zinc-500">
                        <Clock className="h-3 w-3" />
                      </div>
                    </div> */}

                      {/* File Count & Share - Top Right */}
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/80 text-zinc-700 text-[11px] font-semibold border border-zinc-200/50 shadow-sm backdrop-blur-sm">
                          <FileText className="h-3 w-3" />
                          {task.files?.length || 0}
                        </div>
                        {/* Download button removed from here as it is now always visible in the card body below */}
                      </div>

                      {/* Bottom Right Clock Icon in Circle */}
                      {/* <div className="absolute bottom-3 right-3">
                      <div className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                        <Clock className="h-4 w-4 text-blue-500" />
                      </div>
                    </div> */}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex flex-col gap-3">
                      {/* Title */}
                      <h4 className="text-zinc-900 font-bold text-sm line-clamp-1">
                        {task.title}
                      </h4>

                      {/* Editor & Date Row */}
                      <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                        {/* <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span>Editor: {task.user?.name || 'Assigned Editor'}</span>
                      </div> */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {task.status === "POSTED" ? (
                            <Badge className="bg-orange-50 text-orange-600 hover:bg-orange-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold flex items-center gap-1">
                              <ExternalLink className="h-2.5 w-2.5" />
                              Posted
                            </Badge>
                          ) : task.status === "SCHEDULED" ? (
                            <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              Scheduled
                            </Badge>
                          ) : task.status === "COMPLETED" ? (
                            <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold flex items-center gap-1">
                              <Check className="h-2.5 w-2.5" />
                              Approved
                            </Badge>
                          ) : (
                            <Badge className="bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold">
                              Pending Review
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-7 w-7 rounded-full bg-white shadow-sm flex items-center justify-center p-0 border border-zinc-200/50 transition-all hover:bg-zinc-50 hover:border-zinc-300"
                                onClick={(e) => handleShare(e, task)}
                                disabled={isSharing}
                              >
                                <Share className="h-3.5 w-3.5 text-zinc-700" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-xl border-none">
                              <p>Share review screen</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-7 w-7 rounded-full bg-white shadow-sm flex items-center justify-center p-0 border border-zinc-200/50 transition-all hover:bg-zinc-50 hover:border-zinc-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadAllFiles(task);
                                }}
                              >
                                <Download className="h-3.5 w-3.5 text-zinc-700" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-xl border-none">
                              <p>Download</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Badges Row */}
                      {/* <div className="flex flex-wrap gap-2 pt-1">
                      <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold">
                        Pending
                      </Badge>
                    </div> */}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* File Selector Dialog */}
        {selectedTask && (
          <Dialog open={showFileSelector} onOpenChange={setShowFileSelector}>
            {/* 🔧 FIX: Added overflow-hidden + flex flex-col for proper Mac layout */}
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Review Content
                </DialogTitle>
                <DialogDescription>
                  {selectedTask.title} - Review files and approve or request
                  revisions
                </DialogDescription>
              </DialogHeader>

              {/* 🔧 FIX: Changed from max-h-[50vh] to flex-1 min-h-0 so it fills available space */}
              <div className="overflow-y-auto flex-1 min-h-0 pr-2">
                {selectedTask.files && selectedTask.files.length > 0 ? (
                  <div className="space-y-4">
                    {groupFilesByFolderType(selectedTask.files).map((group) => (
                      <div
                        key={group.folderType}
                        className="border rounded-lg overflow-hidden"
                      >
                        {/* Section Header */}
                        <div
                          className={`px-4 py-3 ${group.info.color} border-b flex items-center justify-between`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{group.info.icon}</span>
                            <h4 className="font-semibold text-sm">
                              {group.info.label}
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {group.files.length} file
                              {group.files.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          {group.folderType === "thumbnails" &&
                            group.files.length > 1 && (
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
                        </div>

                        {/* Files in this section */}
                        <div className="divide-y">
                          {group.files
                            .filter((f) => f.isActive !== false)
                            .map((file, index) => (
                              <div
                                key={file.id}
                                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleFileSelect(file)}
                              >
                                <div className="flex items-center gap-4">
                                  {/* File Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <p className="font-medium text-sm truncate max-w-[300px]">
                                        {file.name}
                                      </p>
                                      <Badge
                                        variant="default"
                                        className="text-xs"
                                      >
                                        V{file.version || 1}
                                      </Badge>
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {getFileTypeLabel(file.mimeType)}
                                      </Badge>
                                      {/* Visual indicator for partial approval */}
                                      {((file.folderType || "main") ===
                                        "main" &&
                                        videoApprovedTasks.has(
                                          selectedTask.id,
                                        )) ||
                                        (file.folderType === "thumbnails" &&
                                          thumbApprovedTasks.has(
                                            selectedTask.id,
                                          )) ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] h-5 flex items-center gap-1">
                                          <Check className="h-3 w-3" />
                                          Approved
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <span>{formatFileSize(file.size)}</span>
                                      <span>•</span>
                                      <span>
                                        Uploaded{" "}
                                        {new Date(
                                          file.uploadedAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Action Button */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {file.optimizationStatus === 'PROCESSING' || file.optimizationStatus === 'PENDING' ? (
                                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 text-xs animate-pulse">
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                        <span>Optimizing...</span>
                                      </div>
                                    ) : isReviewable(file) ? (
                                      <Button size="sm" variant="default">
                                        <Play className="h-4 w-4 mr-2" />
                                        Review
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="outline">
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        View
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-medium">No files available</p>
                  </div>
                )}
              </div>

              {/* 🔧 FIX: Changed mt-4 to mt-auto + flex-shrink-0 so buttons stay pinned at bottom */}
              {/* <div className="flex items-center justify-end gap-3 pt-4 border-t mt-auto flex-shrink-0">
                <Button
                  variant="outline"
                  className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 mr-auto "
                  onClick={() => handleDownloadAllFiles()}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Files
                </Button>

                {!(selectedTask.status === 'COMPLETED' || selectedTask.status === 'SCHEDULED' || selectedTask.status === 'POSTED') && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowFileSelector(false);
                        setShowRevisionDialog(true);
                      }}
                      disabled={isSubmitting}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Request Revisions
                    </Button>
                    <Button
                      onClick={() => handleApprove()}
                      disabled={isSubmitting}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve All
                    </Button>
                  </>
                )}

                {user?.hasPostingServices !== false && (selectedTask.status === 'COMPLETED' || selectedTask.status === 'SCHEDULED') && (
                  <Button
                    onClick={() => handleMarkAsPosted()}
                    disabled={isSubmitting}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Mark as Posted
                  </Button>
                )}

                {selectedTask.status === 'POSTED' && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-md border border-orange-100 font-medium">
                    <ExternalLink className="h-4 w-4" />
                    Content Posted
                  </div>
                )}
              </div> */}

              {/* Bottom Action Bar */}
              <div className="flex flex-col gap-3 pt-4 border-t mt-auto flex-shrink-0">
                {/* Download row - full width */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => handleDownloadAllFiles()}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Files
                </Button>

                {/* Review action buttons row */}
                {!(
                  selectedTask.status === "COMPLETED" ||
                  selectedTask.status === "SCHEDULED" ||
                  selectedTask.status === "POSTED"
                ) && (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setShowFileSelector(false);
                          setShowRevisionDialog(true);
                        }}
                        disabled={isSubmitting}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Request Revisions
                      </Button>

                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleApprove()}
                        disabled={isSubmitting}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve All
                      </Button>
                    </div>
                  )}

                {user?.hasPostingServices !== false &&
                  (selectedTask.status === "COMPLETED" ||
                    selectedTask.status === "SCHEDULED") && (
                    <Button
                      size="sm"
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => handleMarkAsPosted()}
                      disabled={isSubmitting}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Posted
                    </Button>
                  )}

                {selectedTask.status === "POSTED" && (
                  <div className="flex items-center justify-center gap-2 text-green-600 py-1">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Content Posted</span>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Revision Request Dialog */}
        {selectedTask && (
          <Dialog
            open={showRevisionDialog}
            onOpenChange={setShowRevisionDialog}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Request Revisions
                </DialogTitle>
                <DialogDescription>
                  Provide feedback for "{selectedTask.title}"
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="revision-notes">Your Feedback</Label>
                  <Textarea
                    id="revision-notes"
                    placeholder="Describe what changes you'd like to see..."
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Be specific about what needs to be changed. This feedback
                    will be sent to the editor.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRevisionDialog(false);
                      setRevisionNotes("");
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRequestRevisions}
                    disabled={isSubmitting || !revisionNotes.trim()}
                  >
                    {isSubmitting ? (
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Feedback
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Fullscreen Video Review Modal */}
        {selectedTask &&
          selectedFile &&
          selectedFile.mimeType?.startsWith("video/") && (
            <FullScreenReviewModalFrameIO
              open={showVideoReview}
              onOpenChange={(open: boolean) => {
                setShowVideoReview(open);
                if (!open) {
                  setSelectedFile(null);
                  // Don't clear selectedTask so user can continue reviewing
                }
              }}
              asset={getVideoAssetFromFile(selectedFile)}
              onApprove={handleVideoApprove}
              onRequestRevisions={handleVideoRequestRevisions}
              userRole="client"
              // 🔥 Pass file info for version-tracked feedback
              taskId={selectedTask.id}
              currentFileSection={{
                folderType: selectedFile.folderType || "main",
                fileId: selectedFile.id,
                version: selectedFile.version || 1,
              }}
            />
          )}
        {/* File Preview Modal */}
        <FilePreviewModal
          file={selectedFile}
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
        />

        {/* Thumbnail Comparison Modal */}
        {selectedTask && (
          <ThumbnailComparisonModal
            isOpen={showComparison}
            onOpenChange={setShowComparison}
            thumbnails={comparisonFiles}
            taskTitle={selectedTask.title}
          />
        )}

        {/* Fullscreen Thumbnail Review Modal */}
        {selectedTask &&
          selectedFile &&
          selectedFile.mimeType?.startsWith("image/") && (
            <ThumbnailReviewModal
              open={showThumbnailReview}
              onOpenChange={(open: boolean) => {
                setShowThumbnailReview(open);
                if (!open) {
                  setSelectedFile(null);
                }
              }}
              file={selectedFile}
              allFiles={selectedTask.files || []}
              taskId={selectedTask.id}
              taskTitle={selectedTask.title}
              onApprove={handleThumbnailApprove}
              onRequestRevisions={handleThumbnailRequestRevisions}
              userRole="client"
            />
          )}

        <ShareDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          shareLink={shareLink}
          onCopy={() => {
            navigator.clipboard.writeText(shareLink);
            setCopied(true);
            toast.success("Copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
          }}
          copied={copied}
        />

        {/* Download Selector Dialog */}
        <Dialog open={showDownloadSelector} onOpenChange={setShowDownloadSelector}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Select Files to Download
              </DialogTitle>
              <DialogDescription>
                Choose which files you want to download from "{selectedTask?.title}".
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-sm font-medium text-zinc-500">
                  {downloadSelectedFiles.size} of {selectedTask?.files?.length || 0} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    const allIds = selectedTask?.files?.map(f => f.id) || [];
                    if (downloadSelectedFiles.size === allIds.length) {
                      setDownloadSelectedFiles(new Set());
                    } else {
                      setDownloadSelectedFiles(new Set(allIds));
                    }
                  }}
                >
                  {downloadSelectedFiles.size === (selectedTask?.files?.length || 0) ? "Deselect All" : "Select All"}
                </Button>
              </div>

              {selectedTask?.files?.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-100"
                >
                  <Checkbox
                    id={`file-${file.id}`}
                    checked={downloadSelectedFiles.has(file.id)}
                    onCheckedChange={(checked) => {
                      const newSelected = new Set(downloadSelectedFiles);
                      if (checked) {
                        newSelected.add(file.id);
                      } else {
                        newSelected.delete(file.id);
                      }
                      setDownloadSelectedFiles(newSelected);
                    }}
                  />
                  <div className="flex-1 min-w-0 pr-2">
                    <label
                      htmlFor={`file-${file.id}`}
                      className="text-sm font-medium leading-none cursor-pointer block truncate"
                    >
                      {file.name}
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-zinc-400">
                        V{file.version || 1} • {formatFileSize(file.size)}
                      </span>
                      {file.isActive === false && (
                        <Badge variant="outline" className="text-[8px] h-3 px-1 border-zinc-200 text-zinc-400">Old Version</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowDownloadSelector(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmDownload}
                disabled={downloadSelectedFiles.size === 0 || isSubmitting}
                className="bg-zinc-900 text-white hover:bg-zinc-800"
              >
                {isSubmitting ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download {downloadSelectedFiles.size} {downloadSelectedFiles.size === 1 ? 'File' : 'Files'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}