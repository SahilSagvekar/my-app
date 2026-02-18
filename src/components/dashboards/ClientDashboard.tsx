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
} from 'lucide-react';
import { FullScreenReviewModalFrameIO } from '../client/FullScreenReviewModalFrameIO';
import { ThumbnailComparisonModal } from '../client/ThumbnailComparisonModal';

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
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonFiles, setComparisonFiles] = useState<TaskFile[]>([]);

  const { user } = useAuth();

  /* ---------------------------- FETCH CLIENT TASKS -------------------------- */

  useEffect(() => {
    loadClientTasks();
  }, []);

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
  }, []);

  const loadClientTasks = useCallback(async () => {
    try {
      setLoading(true);
      // 🔥 Fetch tasks pending client review
      // These are tasks that QC approved and routed to client
      const res = await fetch("/api/tasks", {
        method: "GET",
        credentials: "include",
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
      setShowFileSelector(false);
      setSelectedFile(null);
      setSelectedTask(null);
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
    await handleApprove();
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

    try {
      console.log(`📦 Starting download for task ${taskToDownload.id}, total files: ${taskToDownload.files.length}`);
      toast.info(`Starting download for ${taskToDownload.files.length} file(s)...`);

      for (const file of taskToDownload.files) {
        // Use the dedicated downloadUrl with attachment headers
        const urlToUse = file.downloadUrl || file.url;
        console.log(`🔗 Downloading file: ${file.name}, URL exists: ${!!urlToUse}`);

        if (!urlToUse) {
          console.error(`❌ No URL found for file: ${file.name}`);
          continue;
        }

        const link = document.createElement('a');
        link.href = urlToUse;
        // 🧪 Try without target="_blank" first, as it can be blocked by pop-up blockers
        // If the header is correctly set to attachment, the browser will not navigate away.
        link.setAttribute('download', file.name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Small delay for multiple files
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast.success("All download requests sent!");
    } catch (error) {
      console.error("Error in download loop:", error);
      toast.error("An error occurred while preparing downloads.");
    }
  };



  /* ---------------------------- FILE HANDLING ------------------------------- */

  const handleFileSelect = (file: TaskFile) => {
    setSelectedFile(file);
    setShowFileSelector(false);

    if (file.mimeType?.startsWith('video/')) {
      setShowVideoReview(true);
    } else {
      // Open in-app preview modal
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
  const overdueReviews = tasks.filter(task => isOverdue(task)).length;

  /* -------------------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Page Header & Stats Row */}
      <div className="flex flex-row items-center justify-start gap-16 pb-6 border-b border-zinc-100">
        <div className="flex flex-col gap-1 pr-165">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Content Review</h1>
          <p className="text-sm text-zinc-500">
            Review content from your team and approve or request revisions
          </p>
        </div>

        <div className="relative flex items-center justify-center px-6 py-2.5 rounded-2xl bg-white border border-zinc-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] min-w-[240px]">
          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tasks Pending</span>
            <span className="text-2xl font-bold text-zinc-900">{pendingReviews}</span>
          </div>
          <div className="absolute right-4 h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center border border-zinc-50">
            <Clock className="h-5 w-5 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="flex-1">

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-40 animate-spin" />
            <p className="font-medium">Loading tasks for review...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-40 text-emerald-500" />
            <p className="font-medium">All caught up!</p>
            <p className="text-sm mt-1">No content awaiting your review</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {tasks.map((task, index) => {
              const thumbnail = getTaskThumbnail(task);
              return (
                <Card
                  key={task.id}
                  className={`group cursor-pointer border-none shadow-sm transition-all duration-300 rounded-[1.25rem] overflow-hidden flex flex-col h-full bg-white hover:shadow-md hover:ring-1 hover:ring-zinc-200 ${selectedTask?.id === task.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => handleTaskClick(task)}
                >
                  {/* Visual Header / Thumbnail Area */}
                  <div className={`h-44 relative flex items-center justify-center bg-zinc-50 transition-colors overflow-hidden font-bold`}>
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
                    {thumbnail && <div className="absolute inset-0 bg-black/5" />}

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
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white flex items-center justify-center p-0 border border-zinc-200/50 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadAllFiles(task);
                        }}
                      >
                        <Download className="h-3.5 w-3.5 text-zinc-700" />
                      </Button>
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
                        {task.status === 'POSTED' ? (
                          <Badge className="bg-orange-50 text-orange-600 hover:bg-orange-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold flex items-center gap-1">
                            <ExternalLink className="h-2.5 w-2.5" />
                            Posted
                          </Badge>
                        ) : task.status === 'COMPLETED' || task.status === 'SCHEDULED' ? (
                          <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold flex items-center gap-1">
                            <Check className="h-2.5 w-2.5" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold">
                            Pending Review
                          </Badge>
                        )}
                      </div>
                      {/* <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div> */}
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
                {selectedTask.title} - Review files and approve or request revisions
              </DialogDescription>
            </DialogHeader>

            {/* 🔧 FIX: Changed from max-h-[50vh] to flex-1 min-h-0 so it fills available space */}
            <div className="overflow-y-auto flex-1 min-h-0 pr-2">
              {selectedTask.files && selectedTask.files.length > 0 ? (
                <div className="space-y-4">
                  {groupFilesByFolderType(selectedTask.files).map((group) => (
                    <div key={group.folderType} className="border rounded-lg overflow-hidden">
                      {/* Section Header */}
                      <div className={`px-4 py-3 ${group.info.color} border-b flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{group.info.icon}</span>
                          <h4 className="font-semibold text-sm">{group.info.label}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {group.files.length} file{group.files.length !== 1 ? 's' : ''}
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
                      </div>

                      {/* Files in this section */}
                      <div className="divide-y">
                        {group.files.filter(f => f.isActive !== false).map((file, index) => (
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
                                  <Badge variant="default" className="text-xs">
                                    V{file.version || 1}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {getFileTypeLabel(file.mimeType)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>{formatFileSize(file.size)}</span>
                                  <span>•</span>
                                  <span>Uploaded {new Date(file.uploadedAt).toLocaleDateString()}</span>
                                </div>
                              </div>

                              {/* Action Button */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {file.mimeType?.startsWith('video/') ? (
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
            <div className="flex items-center justify-end gap-3 pt-4 border-t mt-auto flex-shrink-0">
              <Button
                variant="outline"
                className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 mr-auto"
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

              {(selectedTask.status === 'COMPLETED' || selectedTask.status === 'SCHEDULED') && (
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
            </div>
          </DialogContent>
        </Dialog>
      )}



      {/* Revision Request Dialog */}
      {selectedTask && (
        <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
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
                  Be specific about what needs to be changed. This feedback will be sent to the editor.
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
      {selectedTask && selectedFile && selectedFile.mimeType?.startsWith('video/') && (
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
            folderType: selectedFile.folderType || 'main',
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
    </div>
  );
}