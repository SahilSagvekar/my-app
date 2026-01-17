import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { FullScreenReviewModalFrameIO } from '../client/FullScreenReviewModalFrameIO';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'sonner';

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
  replacedBy?: string;
  revisionNote?: string;
  s3Key?: string;
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
  const { user } = useAuth();

  /* ---------------------------- FETCH CLIENT TASKS -------------------------- */

  useEffect(() => {
    loadClientTasks();
  }, []);

  const loadClientTasks = async () => {
    try {
      setLoading(true);
      // 🔥 Fetch tasks pending client review
      // These are tasks that QC approved and routed to client
      const res = await fetch("/api/tasks", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed fetching client tasks");

      let data = await res.json();

      if (data.tasks) data = data.tasks;
      if (!Array.isArray(data)) {
        console.error("Client API returned non-array:", data);
        return;
      }

      const normalized = data.map((task: any) => ({
        ...task,
        status: "pending_review",
        priority: task.priority || "medium",
        taskCategory: task.taskCategory || "design",
        files: task.files || [],
      }));

      // Sort by due date (oldest first)
      const sorted = normalized.sort(
        (a, b) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

      setTasks(sorted);
    } catch (err) {
      console.error("Client tasks load error:", err);
      toast.error("Failed to load tasks for review");
    } finally {
      setLoading(false);
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

      // Remove task from list
      setTasks((prev) => prev.filter((t) => t.id !== taskToApprove.id));

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

      // Remove task from list
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

      // Remove task from list
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

  /* ---------------------------- FILE HANDLING ------------------------------- */

  const handleFileSelect = (file: TaskFile) => {
    setSelectedFile(file);
    setShowFileSelector(false);

    if (file.mimeType?.startsWith('video/')) {
      setShowVideoReview(true);
    } else {
      // For non-video files, open in new tab
      window.open(file.url, '_blank');
    }
  };

  const getVideoAssetFromFile = (file: TaskFile) => {
    if (!selectedTask) return null;

    return {
      id: selectedTask.id,
      title: `${selectedTask.title} - ${file.name}`,
      subtitle: `Review Request`,
      videoUrl: file.url,
      thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
      runtime: '2:30',
      status: 'pending_client' as const,
      client: 'You',
      platform: 'Web',
      resolution: '1920x1080',
      fileSize: formatFileSize(file.size),
      uploader: 'Editor',
      uploadDate: new Date(file.uploadedAt).toLocaleDateString(),
      versions: [{
        id: 'v1',
        number: String(file.version || 1),
        thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
        duration: '2:30',
        uploadDate: new Date(file.uploadedAt).toLocaleDateString(),
        status: 'pending_client' as const
      }],
      currentVersion: 'v1',
      downloadEnabled: true,
      approvalLocked: false
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
        return { label: '📁 Main Files', icon: '📁', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'thumbnails':
        return { label: '🖼️ Thumbnails', icon: '🖼️', color: 'bg-green-100 text-green-800 border-green-200' };
      case 'tiles':
        return { label: '🎨 Tiles', icon: '🎨', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'music-license':
        return { label: '🎵 Music License', icon: '🎵', color: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'covers':
        return { label: '📔 Covers', icon: '📔', color: 'bg-pink-100 text-pink-800 border-pink-200' };
      default:
        return { label: '📁 Main Files', icon: '📁', color: 'bg-blue-100 text-blue-800 border-blue-200' };
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

  const isOverdue = (task: ClientTask) => new Date(task.dueDate) < new Date();

  const handleTaskClick = (task: ClientTask) => {
    setSelectedTask(task);
    setShowFileSelector(true);
  };

  /* ----------------------------- STATS ------------------------------------ */

  const pendingReviews = tasks.length;
  const overdueReviews = tasks.filter(task => isOverdue(task)).length;

  /* -------------------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Review</h1>
          <p className="text-muted-foreground mt-2">
            Review content from your team and approve or request revisions
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <h3 className="text-2xl font-bold">{pendingReviews}</h3>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <h3 className="text-2xl font-bold text-red-500">{overdueReviews}</h3>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Queue */}
      <div className="flex flex-col flex-1 min-h-0">
        <Card className="flex flex-col flex-1 min-h-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Content Awaiting Your Review ({pendingReviews})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Click on any item to view files and provide feedback
            </p>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="space-y-0 h-full overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-40 animate-spin" />
                  <p>Loading content for review...</p>
                </div>
              ) : tasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-sm mt-1">No content awaiting your review</p>
                </div>
              ) : (
                tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors border-l-4 ${
                      selectedTask?.id === task.id ? "bg-muted" : ""
                    } ${getPriorityColor(task.priority)} ${
                      isOverdue(task) ? "border-r-4 border-r-red-500" : ""
                    }`}
                    onClick={() => handleTaskClick(task)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-muted-foreground">
                            #{index + 1}
                          </span>
                          {getTaskCategoryIcon(task.taskCategory)}
                        </div>
                        <h4 className="text-sm font-medium truncate">
                          {task.title}
                        </h4>
                      </div>
                      <Badge variant="default" className="text-xs ml-2 flex-shrink-0">
                        Awaiting Review
                      </Badge>
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span className={isOverdue(task) ? "text-red-500 font-medium" : ""}>
                          Due {new Date(task.dueDate).toLocaleDateString()}
                          {isOverdue(task) && " (Overdue)"}
                        </span>
                      </div>

                      {task.files && task.files.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {task.files.length} file{task.files.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* File Selector Dialog */}
      {selectedTask && (
        <Dialog open={showFileSelector} onOpenChange={setShowFileSelector}>
          <DialogContent className="max-w-4xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Review Content
              </DialogTitle>
              <DialogDescription>
                {selectedTask.title} - Review files and approve or request revisions
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto max-h-[50vh] pr-2">
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
                              {/* File Icon */}
                              <div className={`p-3 rounded-lg flex-shrink-0 ${
                                file.mimeType?.startsWith('video/') ? 'bg-blue-100' :
                                file.mimeType?.startsWith('image/') ? 'bg-green-100' :
                                'bg-gray-100'
                              }`}>
                                {getFileIcon(file.mimeType)}
                              </div>

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

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t mt-4">
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
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve All
              </Button>
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
    </div>
  );
}