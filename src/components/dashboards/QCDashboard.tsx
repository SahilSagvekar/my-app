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
import { Share2, CheckCircle, XCircle, Clock, AlertCircle, FileText, Eye, Calendar, User, Play, ArrowRight, Video, Palette, UserCheck, Image as ImageIcon, File, Download, ExternalLink, X, ZoomIn, History, Filter, RefreshCw } from 'lucide-react';
import { ShareDialog } from '../review/ShareDialog';
import { FullScreenReviewModalFrameIO } from '../client/FullScreenReviewModalFrameIO';
import { ThumbnailReviewModal } from '../client/ThumbnailReviewModal';
import { ThumbnailComparisonModal } from '../client/ThumbnailComparisonModal';
import { useAuth } from '../auth/AuthContext';
import { TaskGuidelinesButton } from './TaskGuidelinesButton';
import { toast } from 'sonner';

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
}: {
  taskId: string;
  approved: boolean;
  feedback?: string;
  requiresClientReview?: boolean;
}) => {
  const newStatus = approved ? "COMPLETED" : "REJECTED";
  const metaBody: any = {};

  if (approved && feedback) {
    metaBody.feedback = feedback;
  }

  if (!approved && feedback) {
    metaBody.qcNotes = feedback;
  }

  if (approved) {
    metaBody.qcResult = "APPROVED";
    metaBody.route = requiresClientReview
      ? "client_then_scheduler"
      : "scheduler";
  } else {
    metaBody.qcResult = "REJECTED";
    metaBody.route = "editor";
  }

  metaBody.status = newStatus;

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
  const [qcTasks, setQCTasks] = useState<EnhancedWorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<EnhancedWorkflowTask | null>(null);
  const [selectedFile, setSelectedFile] = useState<TaskFile | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showVideoReview, setShowVideoReview] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [showThumbnailReview, setShowThumbnailReview] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonFiles, setComparisonFiles] = useState<TaskFile[]>([]);
  const [deliverableTypeFilter, setDeliverableTypeFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  // 🔥 Share states
  const [shareLink, setShareLink] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const loadQCTasks = useCallback(async () => {
    try {
      setLoading(true);
      // 🔥 Fetch PENDING tasks (READY_FOR_QC status)
      const res = await fetch("/api/tasks?status=READY_FOR_QC", {
        method: "GET",
        credentials: "include",
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
      });

      setQCTasks((prev) =>
        prev.filter((task) => task.id !== selectedTask.id)
      );

      toast("✅ Approved – Sent to Client", {
        description: "Content has been sent to client for review.",
      });

      setShowVideoReview(false);
      setSelectedFile(null);
      setSelectedTask(null);
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
      // Open images in the full thumbnail review modal (same as client)
      setShowThumbnailReview(true);
    } else {
      // PDFs and other files use basic preview
      setShowFilePreview(true);
    }
  };

  // QC: Approve thumbnail — mark task as COMPLETED and send to scheduler/client
  const handleThumbnailApprove = async (file: TaskFile) => {
    if (!selectedTask) return;
    try {
      await persistQCResult({
        taskId: selectedTask.id,
        approved: true,
        requiresClientReview: selectedTask.requiresClientReview,
      });
      setQCTasks(prev => prev.filter(t => t.id !== selectedTask.id));
      toast('✅ Thumbnail Approved', { description: 'Task has been moved to the next stage.' });
      setShowThumbnailReview(false);
      setSelectedFile(null);
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve thumbnail');
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
        sizeBytes: f.size,
      }));

    return {
      id: selectedTask.id,
      title: `${selectedTask.title}`,
      subtitle: `Project: ${selectedTask.clientId}`,
      videoUrl: file.url,
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

  const handleTaskClick = (task: EnhancedWorkflowTask) => {
    setSelectedTask(task);
    setShowFileSelector(true);
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
      return matchType && matchClient;
    });
  }, [qcTasks, deliverableTypeFilter, clientFilter]);

  const clearAllFilters = () => {
    setDeliverableTypeFilter("all");
    setClientFilter("all");
  };

  const hasActiveFilters = deliverableTypeFilter !== "all" || clientFilter !== "all";
  const pendingReviews = filteredTasks.length;
  const totalPending = qcTasks.length;

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* <div className="flex items-center justify-between">
        <div>
          <h1>Review Queue</h1>
          <p className="text-muted-foreground mt-2">
            Review submitted work and approve or reject with feedback
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 max-w-sm">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 text-center mt-0 pt-0 mb-0 pb-0">
                <p className="text-sm text-muted-foreground mt-0 pt-0 mb-0 pb-0">Pending Reviews</p>
                <h3 className="text-2xl mt-1 font-bold">{pendingReviews}</h3>
              </div>
              <Clock className="h-10 w-10 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div> */}

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

      <div className="flex-1">
        {/* Main QC grid */}
        {/* <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Review Queue
              <Badge variant="secondary" className="font-mono">
                {pendingReviews}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Click on any card to review its files
            </p>
          </div>
        </div> */}

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
              return (
                <Card
                  key={task.id}
                  className={`group cursor-pointer shadow-sm transition-all duration-300 rounded-[1.25rem] overflow-hidden flex flex-col h-full hover:shadow-md ${deliverableColors.bg} ${deliverableColors.border} border hover:${deliverableColors.ring} ${selectedTask?.id === task.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => handleTaskClick(task)}
                >
                  {/* Visual Header / Thumbnail Area */}
                  <div
                    className={`h-44 relative flex items-center justify-center bg-zinc-50 transition-colors overflow-hidden font-bold`}
                  >
                    {thumbnail && (
                      <img
                        src={thumbnail}
                        alt={task.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 z-10"
                        onError={(e) => {
                          // Hide broken image so fallback shows through
                          (e.target as HTMLImageElement).style.opacity = '0';
                        }}
                      />
                    )}
                    {/* No thumbnail text fallback - always rendered behind, visible when no image or image fails */}
                    <div className="text-zinc-300 text-[10px] font-bold uppercase tracking-wider absolute inset-0 flex items-center justify-center">
                      No thumbnail
                    </div>

                    {/* Darker overlay if thumbnail exists for better icon readability */}
                    {thumbnail && (
                      <div className="absolute inset-0 bg-black/5 z-10 pointer-events-none" />
                    )}

                    {/* Share Button - Top Left */}
                    <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200/50 shadow-sm text-zinc-700 hover:text-primary"
                        onClick={(e) => handleShare(e, task)}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

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

                    {/* Badges Row - Show QC Reviewer */}
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

                      {/* 🔥 New: Non-H.264 Badge */}
                      {(() => {
                        const latestVideo = task.files
                          ?.filter(f => f.mimeType?.startsWith('video/'))
                          .sort((a, b) => {
                            // Prioritize active file, then highest version
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

      {
        selectedTask && (
          <Dialog open={showFileSelector} onOpenChange={setShowFileSelector}>
            <DialogContent className="max-w-4xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Review Files by Section
                </DialogTitle>
              </DialogHeader>

              <div className="overflow-y-auto max-h-[65vh] pr-2">
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
                          {/* Compare Versions button for thumbnails with multiple versions */}
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

                        {/* Files in this section */}
                        <div className="divide-y">
                          {group.files.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                              <span className="text-2xl mb-2 block">🖼️</span>
                              <p className="text-sm font-medium">No {group.info.label.toLowerCase()}</p>
                              <p className="text-xs mt-1">No files uploaded for this section</p>
                            </div>
                          ) : (
                          group.files.map((file, index) => (
                            <div
                              key={file.id}
                              className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${file.isActive === false
                                ? "opacity-60 bg-muted/20"
                                : ""
                                }`}
                              onClick={() => handleFileSelect(file)}
                            >
                              <div className="flex items-center gap-4">
                                {/* File Icon */}
                                <div
                                  className={`p-3 rounded-lg flex-shrink-0 ${file.mimeType?.startsWith("video/")
                                    ? "bg-blue-100"
                                    : file.mimeType?.startsWith("image/")
                                      ? "bg-green-100"
                                      : "bg-gray-100"
                                    }`}
                                >
                                  {getFileIcon(file.mimeType)}
                                </div>

                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <p className="font-medium text-sm truncate max-w-[300px]">
                                      {file.name}
                                    </p>

                                    {/* Version Badge */}
                                    <Badge
                                      variant={
                                        file.isActive !== false
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      V{file.version || 1}
                                    </Badge>

                                    {/* Active/Latest indicator */}
                                    {file.isActive !== false && index === 0 && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs text-green-600 border-green-300"
                                      >
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Latest
                                      </Badge>
                                    )}

                                    {/* Inactive indicator */}
                                    {file.isActive === false && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs text-muted-foreground"
                                      >
                                        Replaced
                                      </Badge>
                                    )}

                                    {/* File type */}
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {getFileTypeLabel(file.mimeType)}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                    <span>{formatFileSize(file.size)}</span>
                                    <span>•</span>
                                    <span>
                                      Uploaded{" "}
                                      {new Date(
                                        file.uploadedAt,
                                      ).toLocaleDateString()}
                                    </span>
                                    {file.revisionNote && (
                                      <>
                                        <span>•</span>
                                        <span
                                          className="text-orange-600"
                                          title={file.revisionNote}
                                        >
                                          📝 Has revision note
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Action Buttons */}
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
                                          <Button
                                            size="sm"
                                            variant="default"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleFileSelect(file);
                                            }}
                                          >
                                            <Play className="h-4 w-4 mr-2" />
                                            Review
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-9 w-9 p-0"
                                            title="Download Video"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDownload(file);
                                            }}
                                          >
                                            <Download className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  ) : file.mimeType?.startsWith('image/') ? (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleFileSelect(file);
                                        }}
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Review
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-9 w-9 p-0"
                                        title="Download File"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownload(file);
                                        }}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleFileSelect(file);
                                        }}
                                      >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        View
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-9 w-9 p-0"
                                        title="Download File"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownload(file);
                                        }}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-medium">
                      No files found in this task
                    </p>
                    <p className="text-sm mt-1">
                      Files will appear here once they are uploaded by the editor.
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )
      }

      {
        selectedTask &&
        selectedFile &&
        selectedFile.mimeType?.startsWith("video/") && (
          <FullScreenReviewModalFrameIO
            open={showVideoReview}
            onOpenChange={(open: boolean) => {
              setShowVideoReview(open);
              if (!open) {
                setSelectedFile(null);
                setSelectedTask(null);
              }
            }}
            asset={getVideoAssetFromFile(selectedFile)}
            onApprove={() => { }}
            onRequestRevisions={() => { }}
            userRole="qc"
            onSendToClient={handleSendToClient}
            onSendBackToEditor={handleSendBackToEditor}
            // 🔥 Pass file info for version-tracked feedback
            taskId={selectedTask.id}
            requiresClientReview={selectedTask.requiresClientReview}
            currentFileSection={{
              folderType: selectedFile.folderType || "main",
              fileId: selectedFile.id,
              version: selectedFile.version || 1,
            }}
          />
        )
      }

      {/* Fullscreen Thumbnail Review Modal (QC) */}
      {selectedTask &&
        selectedFile &&
        selectedFile.mimeType?.startsWith('image/') && (
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
            userRole="qc"
          />
        )}

      {/* Thumbnail Comparison Modal (QC) */}
      {selectedTask && (
        <ThumbnailComparisonModal
          isOpen={showComparison}
          onOpenChange={setShowComparison}
          thumbnails={comparisonFiles}
          taskTitle={selectedTask.title}
        />
      )}

      {/* In-App File Preview Modal - Full Screen Overlay (PDFs / other non-image, non-video) */}
      {
        selectedTask &&
        selectedFile &&
        !selectedFile.mimeType?.startsWith('video/') &&
        !selectedFile.mimeType?.startsWith('image/') &&
        showFilePreview && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-xl ${selectedFile.mimeType?.startsWith("image/") ? "bg-green-500/20" : "bg-blue-500/20"}`}
                >
                  {getFileIcon(selectedFile.mimeType)}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg truncate max-w-[300px] md:max-w-[500px]">
                    {selectedFile.name}
                  </h3>
                  <p className="text-white/50 text-sm">
                    {getFileTypeLabel(selectedFile.mimeType)} •{" "}
                    {formatFileSize(selectedFile.size)} • Uploaded{" "}
                    {new Date(selectedFile.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40"
                  onClick={() => window.open(selectedFile.url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Open in New Tab</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40"
                  onClick={() => handleDownload(selectedFile)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/20 h-10 w-10"
                  onClick={() => {
                    setShowFilePreview(false);
                    setSelectedFile(null);
                  }}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>

            {/* Content Area - Full screen image/file view */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
              {getMimeType(selectedFile).startsWith("image/") ? (
                <div className="relative">
                  <img
                    key={selectedFile.url}
                    src={selectedFile.url}
                    alt={selectedFile.name}
                    className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
                  />
                </div>
              ) : getMimeType(selectedFile).includes("pdf") ? (
                <iframe
                  key={selectedFile.url}
                  src={selectedFile.url}
                  className="w-full h-[85vh] bg-white rounded-lg shadow-2xl"
                  title="PDF Preview"
                />
              ) : (
                <div className="text-center">
                  <div className="p-10 bg-white/5 rounded-3xl backdrop-blur-sm border border-white/10 max-w-lg mx-auto">
                    <div className="p-8 bg-white/10 rounded-2xl inline-block mb-6">
                      {getFileIcon(selectedFile.mimeType)}
                    </div>
                    <h3 className="text-white text-2xl font-semibold mb-3">
                      {selectedFile.name}
                    </h3>
                    <p className="text-white/60 text-base mb-2">
                      {getFileTypeLabel(selectedFile.mimeType)} •{" "}
                      {formatFileSize(selectedFile.size)}
                    </p>
                    <p className="text-white/40 text-sm mb-8">
                      Preview not available for this file type.
                    </p>
                    <div className="flex gap-4 justify-center">
                      <Button
                        size="lg"
                        onClick={() => window.open(selectedFile.url, "_blank")}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <ExternalLink className="h-5 w-5 mr-2" />
                        Open File
                      </Button>
                      <Button
                        size="lg"
                        onClick={() => handleDownload(selectedFile)}
                        variant="outline"
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        <Download className="h-5 w-5 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
}
