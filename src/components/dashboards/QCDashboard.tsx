import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { CheckCircle, XCircle, Clock, AlertCircle, FileText, Eye, Calendar, User, Play, ArrowRight, Video, Palette, UserCheck, Image as ImageIcon, File, Download, ExternalLink } from 'lucide-react';
import { FullScreenReviewModal } from '../client/FullScreenReviewModal';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'sonner';

// Enhanced task type definitions
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
}

interface EnhancedWorkflowTask {
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
  parentTaskId?: string;
  originalTaskId?: string;
  workflowStep?: string;
  taskCategory?: "design" | "video" | "copywriting" | "review";
  priority?: "urgent" | "high" | "medium" | "low";
  qcNotes?: string | null;
  nextDestination?: TaskDestination;
  requiresClientReview?: boolean;
  feedback?: string;
  files?: TaskFile[];
  projectId: string;
}

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
  const [selectedTask, setSelectedTask] = useState<EnhancedWorkflowTask | null>(null);
  const [selectedFile, setSelectedFile] = useState<TaskFile | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showVideoReview, setShowVideoReview] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    async function loadQCTasks() {
      try {
        const res = await fetch("/api/tasks?qc=true", {
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
          status:
            task.status === "READY_FOR_QC" ||
            task.status === "QC_IN_PROGRESS"
              ? "pending"
              : String(task.status || "").toLowerCase(),
          priority: task.priority || "medium",
          taskCategory: task.taskCategory || "design",
          nextDestination: task.nextDestination || "client",
          requiresClientReview: task.requiresClientReview ?? false,
          files: task.files || [],
        }));

        const sorted = normalized.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        );

        setQCTasks(sorted);
      } catch (err) {
        console.error("QC load error:", err);
      }
    }

    loadQCTasks();
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
        prev.map((task) =>
          task.id === selectedTask.id
            ? {
                ...task,
                status: "approved",
                nextDestination: "client",
              }
            : task
        )
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
        prev.map((task) =>
          task.id === selectedTask.id
            ? {
                ...task,
                status: "rejected",
                qcNotes: notes,
                nextDestination: "editor",
              }
            : task
        )
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

  // Handle file selection
  const handleFileSelect = (file: TaskFile) => {
    setSelectedFile(file);
    setShowFileSelector(false);

    // If video, open fullscreen review modal
    if (file.mimeType?.startsWith('video/')) {
      setShowVideoReview(true);
    } else {
      // For other files, open in new tab
      window.open(file.url, '_blank');
      // Reset selections
      setSelectedFile(null);
    }
  };

  // Convert selected file to review asset format
  const getVideoAssetFromFile = (file: TaskFile) => {
    if (!selectedTask) return null;

    return {
      id: selectedTask.id,
      title: `${selectedTask.title.replace('QC Review: ', '')} - ${file.name}`,
      subtitle: `Project: ${selectedTask.projectId}`,
      videoUrl: file.url,
      thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
      runtime: '2:30',
      status: 'in_qc' as const,
      client: 'Unknown Client',
      platform: 'Web',
      resolution: '1920x1080',
      fileSize: formatFileSize(file.size),
      uploader: 'Editor',
      uploadDate: new Date(file.uploadedAt).toLocaleDateString(),
      versions: [{
        id: 'v1',
        number: '1',
        thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
        duration: '2:30',
        uploadDate: new Date(file.uploadedAt).toLocaleDateString(),
        status: 'in_qc' as const
      }],
      currentVersion: 'v1',
      downloadEnabled: false,
      approvalLocked: false
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

  const isOverdue = (task: EnhancedWorkflowTask) => new Date(task.dueDate) < new Date();

  // Handle task click - always show file selector
  const handleTaskClick = (task: EnhancedWorkflowTask) => {
    setSelectedTask(task);
    setShowFileSelector(true);
  };

  // Stats
  const pendingReviews = qcTasks.filter(task => task.status === 'pending').length;
  const completedToday = qcTasks.filter(task => 
    (task.status === 'approved' || task.status === 'rejected') &&
    new Date(task.createdAt).toDateString() === new Date().toDateString()
  ).length;
  const overdueReviews = qcTasks.filter(task => task.status === 'pending' && isOverdue(task)).length;

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Review Queue</h1>
          <p className="text-muted-foreground mt-2">
            Review submitted work and approve or reject with feedback
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Reviews</p>
                <h3>{pendingReviews}</h3>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <h3>{completedToday}</h3>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <h3 className="text-red-500">{overdueReviews}</h3>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Workflow Info */}
      {/* <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">
                Automated QC Workflow - FIFO System
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Tasks are automatically sorted by submission time (oldest first). Click any task to view and select files.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded">
                    <User className="h-3 w-3" />
                    <span>Rejected → Editor</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded">
                    <UserCheck className="h-3 w-3" />
                    <span>Client Review → Client</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded">
                    <Calendar className="h-3 w-3" />
                    <span>Direct → Scheduler</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* Review Queue */}
      <div className="flex flex-col flex-1 min-h-0">
        <Card className="flex flex-col flex-1 min-h-0">
          <CardHeader>
            <CardTitle>Review Queue ({pendingReviews})</CardTitle>
            <p className="text-xs text-muted-foreground">
              Click on any task to view files
            </p>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="space-y-0 h-full overflow-y-auto">
              {qcTasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p>No QC tasks available</p>
                </div>
              ) : (
                qcTasks.map((task, index) => (
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
                        {getStatusIcon(task.status)}
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-muted-foreground">
                            #{index + 1}
                          </span>
                          {getTaskCategoryIcon(task.taskCategory)}
                        </div>
                        <h4 className="text-sm font-medium truncate">
                          {task.title.replace("QC Review: ", "")}
                        </h4>
                      </div>
                      <Badge
                        variant={
                          task.status === "pending" ? "default" : "secondary"
                        }
                        className="text-xs ml-2 flex-shrink-0"
                      >
                        {task.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <User className="h-3 w-3" />
                      <span>From Editor</span>
                      {task.priority && (
                        <Badge
                          variant="outline"
                          className={`text-xs px-1 py-0 ${
                            task.priority === "urgent"
                              ? "border-red-500 text-red-700"
                              : task.priority === "high"
                              ? "border-orange-500 text-orange-700"
                              : "border-gray-500 text-gray-700"
                          }`}
                        >
                          {task.priority}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span
                          className={
                            isOverdue(task) ? "text-red-500 font-medium" : ""
                          }
                        >
                          Due {task.dueDate}
                          {isOverdue(task) && " (Overdue)"}
                        </span>
                      </div>
                      
                      {task.files && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {task.files.length} file{task.files.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>

                    {/* Workflow Destination Indicator */}
                    {task.nextDestination && task.status === "pending" && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${getDestinationColor(
                            task.nextDestination
                          )}`}
                        >
                          {getDestinationIcon(task.nextDestination)}
                          <ArrowRight className="h-2 w-2" />
                          <span className="capitalize">
                            {task.nextDestination}
                          </span>
                        </div>
                      </div>
                    )}
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
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Select File to Review</DialogTitle>
              <DialogDescription>
                Choose a file to review from {selectedTask.title}
              </DialogDescription>
            </DialogHeader>
            
            <div className="overflow-y-auto max-h-[60vh]">
              {selectedTask.files && selectedTask.files.length > 0 ? (
                <div className="space-y-2">
                  {selectedTask.files.map((file, index) => (
                    <Card
                      key={file.id}
                      className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                      onClick={() => handleFileSelect(file)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* File Icon */}
                          <div className={`p-3 rounded-lg ${
                            file.mimeType?.startsWith('video/') ? 'bg-blue-100' :
                            file.mimeType?.startsWith('image/') ? 'bg-green-100' :
                            'bg-gray-100'
                          }`}>
                            {getFileIcon(file.mimeType)}
                          </div>

                          {/* File Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">
                                {file.name}
                              </p>
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

                          {/* Action Icon */}
                          <div className="flex items-center gap-2">
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p>No files found in this task</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Fullscreen Video Review Modal */}
      {selectedTask && selectedFile && selectedFile.mimeType?.startsWith('video/') && (
        <FullScreenReviewModal
          open={showVideoReview}
          onOpenChange={(open) => {
            setShowVideoReview(open);
            if (!open) {
              setSelectedFile(null);
              setSelectedTask(null);
            }
          }}
          asset={getVideoAssetFromFile(selectedFile)}
          onApprove={() => {}}
          onRequestRevisions={() => {}}
          userRole="qc"
          onSendToClient={handleSendToClient}
          onSendBackToEditor={handleSendBackToEditor}
        />
      )}
    </div>
  );
}