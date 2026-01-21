import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { CheckCircle, XCircle, Clock, AlertCircle, FileText, Eye, Calendar, User, Play, ArrowRight, Video, Palette, UserCheck, Image as ImageIcon, File, ExternalLink } from 'lucide-react';
import { FullScreenReviewModalFrameIO } from '../client/FullScreenReviewModalFrameIO';
import { useAuth } from '../auth/AuthContext';
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
  folderType?: string;
  version?: number;
  isActive?: boolean;
  replacedAt?: string;
  replacedBy?: string;
  revisionNote?: string;
  s3Key?: string;
}

interface EnhancedWorkflowTask {
  id: string;
  title: string;
  description: string;
  taskType: string;
  status: string;
  assignedTo: string;
  assignedToName: string;
  assignedToRole: string;
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
  const { user } = useAuth();

  useEffect(() => {
    loadQCTasks();
  }, []);

  const loadQCTasks = async () => {
    try {
      setLoading(true);
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
        status: "pending",
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
      toast.error("Failed to load QC tasks");
    } finally {
      setLoading(false);
    }
  };

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

    if (file.mimeType?.startsWith('video/')) {
      setShowVideoReview(true);
    } else {
      window.open(file.url, '_blank');
      setSelectedFile(null);
    }
  };

  const getVideoAssetFromFile = (file: TaskFile) => {
    if (!selectedTask) return null;

    return {
      id: selectedTask.id,
      title: `${selectedTask.title} - ${file.name}`,
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

  const getFolderTypeInfo = (folderType?: string) => {
    switch (folderType) {
      case 'main':
        return { label: '📁 Main Task Files', icon: '📁', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'thumbnails':
        return { label: '🖼️ Thumbnails', icon: '🖼️', color: 'bg-green-100 text-green-800 border-green-200' };
      case 'tiles':
        return { label: '🎨 Tiles (Snapchat)', icon: '🎨', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'music-license':
        return { label: '🎵 Music License', icon: '🎵', color: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'covers':
        return { label: '📔 Covers', icon: '📔', color: 'bg-pink-100 text-pink-800 border-pink-200' };
      default:
        return { label: '📁 Main Task Files', icon: '📁', color: 'bg-blue-100 text-blue-800 border-blue-200' };
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

  const isOverdue = (task: EnhancedWorkflowTask) => new Date(task.dueDate) < new Date();

  const handleTaskClick = (task: EnhancedWorkflowTask) => {
    setSelectedTask(task);
    setShowFileSelector(true);
  };

  const pendingReviews = qcTasks.length;
  const overdueReviews = qcTasks.filter(task => isOverdue(task)).length;

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Review Queue</h1>
          <p className="text-muted-foreground mt-2">
            Review submitted work and approve or reject with feedback
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col items-center justify-center text-center space-y-2">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Pending Reviews</p>
                <h3 className="text-2xl font-bold">{pendingReviews}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col items-center justify-center text-center space-y-2">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Overdue</p>
                <h3 className="text-2xl font-bold text-red-500">{overdueReviews}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Review Queue</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {pendingReviews} task{pendingReviews !== 1 ? 's' : ''} pending review
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted border rounded-lg text-xs">
              <span className="text-muted-foreground">Sorted by</span>
              <span className="font-medium">Date Uploaded</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-40 animate-spin" />
              <p>Loading QC tasks...</p>
            </div>
          ) : qcTasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>No QC tasks available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {qcTasks.map((task) => (
                <Card
                  key={task.id}
                  className="group relative overflow-hidden cursor-pointer hover:border-primary/50 transition-all"
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="relative aspect-video bg-muted flex items-center justify-center">
                    <div className="absolute top-2 left-2 p-1.5 bg-background/80 rounded backdrop-blur-sm">
                      {getTaskCategoryIcon(task.taskCategory)}
                    </div>
                    
                    {task.files && task.files.length > 0 && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-background/80 rounded backdrop-blur-sm text-xs flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {task.files.length}
                      </div>
                    )}

                    <div className="text-muted-foreground/30">
                      {task.taskCategory === 'video' ? (
                        <Video className="h-12 w-12" />
                      ) : task.taskCategory === 'design' ? (
                        <Palette className="h-12 w-12" />
                      ) : (
                        <FileText className="h-12 w-12" />
                      )}
                    </div>

                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-background/60 rounded text-xs">
                      {getStatusIcon(task.status)}
                    </div>
                  </div>

                  <div className="p-3 space-y-2">
                    <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {task.title}
                    </h3>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>Editor</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-xs">
                        Pending
                      </Badge>
                      
                      {task.priority && (
                        <Badge
                          variant="outline"
                          className={`text-xs px-1.5 py-0 ${
                            task.priority === 'urgent'
                              ? 'border-red-500 text-red-600 bg-red-50'
                              : task.priority === 'high'
                              ? 'border-orange-500 text-orange-600 bg-orange-50'
                              : 'border-gray-500 text-gray-600 bg-gray-50'
                          }`}
                        >
                          {task.priority}
                        </Badge>
                      )}

                      {isOverdue(task) && (
                        <Badge variant="outline" className="text-xs border-red-500 text-red-600 bg-red-50">
                          Overdue
                        </Badge>
                      )}
                    </div>

                    {task.nextDestination && (
                      <div className="pt-2 border-t text-xs text-muted-foreground flex items-center gap-1">
                        {getDestinationIcon(task.nextDestination)}
                        <span>→ {task.nextDestination}</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTask && (
        <Dialog open={showFileSelector} onOpenChange={setShowFileSelector}>
          <DialogContent className="max-w-4xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Review Files by Section
              </DialogTitle>
              <DialogDescription>
                {selectedTask.title} - Select a file to review.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto max-h-[65vh] pr-2">
              {selectedTask.files && selectedTask.files.length > 0 ? (
                <div className="space-y-4">
                  {groupFilesByFolderType(selectedTask.files).map((group) => (
                    <div key={group.folderType} className="border rounded-lg overflow-hidden">
                      <div className={`px-4 py-3 ${group.info.color} border-b flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{group.info.icon}</span>
                          <h4 className="font-semibold text-sm">{group.info.label}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {group.files.length} file{group.files.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>

                      <div className="divide-y">
                        {group.files.map((file, index) => (
                          <div
                            key={file.id}
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${file.isActive === false ? 'opacity-60 bg-muted/20' : ''
                              }`}
                            onClick={() => handleFileSelect(file)}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-lg flex-shrink-0 ${
                                file.mimeType?.startsWith('video/') ? 'bg-blue-100' :
                                file.mimeType?.startsWith('image/') ? 'bg-green-100' :
                                'bg-gray-100'
                              }`}>
                                {getFileIcon(file.mimeType)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <p className="font-medium text-sm truncate max-w-[300px]">
                                    {file.name}
                                  </p>
                                  <Badge variant={file.isActive !== false ? "default" : "secondary"} className="text-xs">
                                    V{file.version || 1}
                                  </Badge>

                                  {file.isActive !== false && index === 0 && (
                                    <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Latest
                                    </Badge>
                                  )}
                                  
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

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {file.mimeType?.startsWith('video/') ? (
                                  <Button size="sm">
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
                  <p>No files found in this task</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedTask && selectedFile && selectedFile.mimeType?.startsWith('video/') && (
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