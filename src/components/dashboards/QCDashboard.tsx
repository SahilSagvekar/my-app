import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { CheckCircle, XCircle, Clock, AlertCircle, FileText, Eye, Calendar, User, Play, ArrowRight, Users, Video, Palette, FileVideo, UserCheck } from 'lucide-react';
import { QCReviewDialog } from '../workflow/QCReviewDialog';
import { FullScreenReviewModal } from '../client/FullScreenReviewModal';
import { useTaskWorkflow, WorkflowTask } from '../workflow/TaskWorkflowEngine';
import { useGlobalTasks } from '../workflow/GlobalTaskManager';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'sonner';

// Enhanced task type definitions for workflow routing
type TaskDestination = 'editor' | 'client' | 'scheduler';

interface EnhancedWorkflowTask extends WorkflowTask {
  nextDestination?: TaskDestination;
  requiresClientReview?: boolean;
  taskCategory?: 'design' | 'video' | 'copywriting' | 'review';
  priority?: 'urgent' | 'high' | 'medium' | 'low';
}

// Mock initial QC tasks with enhanced workflow information
const initialQCTasks: EnhancedWorkflowTask[] = [
  {
    id: 'QC-001',
    title: 'QC Review: Brand Guidelines Update',
    description: 'Review uploaded files for: Brand Guidelines Update\n\nOriginal task description: Update brand guidelines for Q4 campaign with new color palette and typography',
    type: 'qc_review',
    status: 'pending',
    assignedTo: 'qc1',
    assignedToName: 'Lisa Davis',
    assignedToRole: 'qc',
    createdAt: '2024-08-10T15:00:00Z',
    dueDate: '2024-08-11',
    parentTaskId: 'EDIT-001',
    originalTaskId: 'EDIT-001',
    workflowStep: 'qc_review',
    taskCategory: 'design',
    priority: 'high',
    requiresClientReview: true,
    nextDestination: 'client',
    files: [
      {
        id: 'file-001',
        name: 'brand_guidelines_v4.pdf',
        url: 'https://drive.google.com/file/d/1234567890/view',
        uploadedAt: '2024-08-10T14:45:00Z',
        uploadedBy: 'ed1',
        driveFileId: 'drive-001',
        mimeType: 'application/pdf',
        size: 2548576
      },
      {
        id: 'file-002',
        name: 'color_palette_reference.png',
        url: 'https://drive.google.com/file/d/0987654321/view',
        uploadedAt: '2024-08-10T14:47:00Z',
        uploadedBy: 'ed1',
        driveFileId: 'drive-002',
        mimeType: 'image/png',
        size: 854729
      }
    ],
    projectId: 'proj-001'
  },
  {
    id: 'QC-002',
    title: 'QC Review: Holiday Campaign Video',
    description: 'Review uploaded video for: Holiday Campaign Video\n\nOriginal task description: Create promotional video for holiday campaign with product showcase and customer testimonials',
    type: 'qc_review',
    status: 'pending',
    assignedTo: 'qc1',
    assignedToName: 'Lisa Davis',
    assignedToRole: 'qc',
    createdAt: '2024-08-09T16:30:00Z',
    dueDate: '2024-08-10',
    parentTaskId: 'EDIT-002',
    originalTaskId: 'EDIT-002',
    workflowStep: 'qc_review',
    taskCategory: 'video',
    priority: 'urgent',
    requiresClientReview: true,
    nextDestination: 'client',
    files: [
      {
        id: 'file-003',
        name: 'holiday_campaign_v1.mp4',
        url: 'https://drive.google.com/file/d/video123/view',
        uploadedAt: '2024-08-09T16:15:00Z',
        uploadedBy: 'ed2',
        driveFileId: 'drive-003',
        mimeType: 'video/mp4',
        size: 89453728
      },
      {
        id: 'file-004',
        name: 'holiday_script.pdf',
        url: 'https://drive.google.com/file/d/script456/view',
        uploadedAt: '2024-08-09T16:16:00Z',
        uploadedBy: 'ed2',
        driveFileId: 'drive-004',
        mimeType: 'application/pdf',
        size: 245760
      }
    ],
    projectId: 'proj-002'
  },
  {
    id: 'QC-003',
    title: 'QC Review: Social Media Assets',
    description: 'Review uploaded social media assets\n\nOriginal task description: Create Instagram and Facebook post designs for product launch',
    type: 'qc_review',
    status: 'pending',
    assignedTo: 'qc1',
    assignedToName: 'Lisa Davis',
    assignedToRole: 'qc',
    createdAt: '2024-08-11T09:30:00Z',
    dueDate: '2024-08-13',
    parentTaskId: 'EDIT-003',
    originalTaskId: 'EDIT-003',
    workflowStep: 'qc_review',
    taskCategory: 'design',
    priority: 'medium',
    requiresClientReview: false,
    nextDestination: 'scheduler',
    files: [
      {
        id: 'file-005',
        name: 'instagram_posts.zip',
        url: 'https://drive.google.com/file/d/assets123/view',
        uploadedAt: '2024-08-11T09:15:00Z',
        uploadedBy: 'ed1',
        driveFileId: 'drive-005',
        mimeType: 'application/zip',
        size: 4547829
      }
    ],
    projectId: 'proj-003'
  }
];

export function QCDashboard() {
  const [qcTasks, setQCTasks] = useState<EnhancedWorkflowTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<EnhancedWorkflowTask | null>(null);
  const [showVideoReview, setShowVideoReview] = useState(false);
  const { tasks: workflowTasks } = useTaskWorkflow();
  const { tasks: globalTasks } = useGlobalTasks();
  const { user } = useAuth();

  const currentUser = {
    id: user?.id || '3', // Default to QC user ID
    name: user?.name || 'QC User',
    role: user?.role || 'qc'
  };

  useEffect(() => {
    // Get QC tasks from workflow engine (generated from completed editor tasks)
    const userQCTasks = workflowTasks.filter(task => 
      task.assignedTo === currentUser.id && task.type === 'qc_review'
    );

    // Include demo tasks only if no real workflow tasks exist
    const allQCTasks = userQCTasks.length > 0 ? userQCTasks : initialQCTasks;
    
    // Sort by creation date (FIFO - oldest first)
    const sortedTasks = [...allQCTasks].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    setQCTasks(sortedTasks);
    
    // Auto-select the first pending task (FIFO)
    if (!selectedTask) {
      const firstPendingTask = sortedTasks.find(task => task.status === 'pending');
      if (firstPendingTask) {
        setSelectedTask(firstPendingTask);
      }
    }
  }, [workflowTasks, selectedTask, currentUser.id]);

  const handleReviewComplete = (approved: boolean, feedback?: string) => {
    if (!selectedTask) return;

    // Update task status locally
    setQCTasks(prev => prev.map(task => 
      task.id === selectedTask.id 
        ? { 
            ...task, 
            status: approved ? 'approved' : 'rejected',
            feedback: feedback 
          }
        : task
    ));

    // Auto-move to next pending task (FIFO)
    const pendingTasks = qcTasks.filter(task => task.status === 'pending' && task.id !== selectedTask.id);
    const nextTask = pendingTasks.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];
    
    setSelectedTask(nextTask || null);

    // Show routing confirmation
    if (approved && selectedTask.nextDestination) {
      const destinationName = selectedTask.nextDestination === 'client' ? 'Client Review' : 
                             selectedTask.nextDestination === 'scheduler' ? 'Scheduler' : 'Editor';
      toast('✅ Task Approved', { 
        description: `Task sent to ${destinationName} automatically` 
      });
    } else if (!approved) {
      toast('❌ Task Rejected', { 
        description: 'Revision task sent back to Editor' 
      });
    }
  };

  const handleSendToClient = (asset: any) => {
    if (!selectedTask) return;
    
    setQCTasks(prev => prev.map(task => 
      task.id === selectedTask.id 
        ? { ...task, status: 'approved' }
        : task
    ));
    
    toast('✅ Video Approved', { 
      description: 'Video has been sent to client for review' 
    });
    
    // Move to next task (FIFO)
    const pendingTasks = qcTasks.filter(task => task.status === 'pending' && task.id !== selectedTask.id);
    const nextTask = pendingTasks.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];
    
    setSelectedTask(nextTask || null);
  };

  const handleSendBackToEditor = (asset: any, revisionData: any) => {
    if (!selectedTask) return;
    
    setQCTasks(prev => prev.map(task => 
      task.id === selectedTask.id 
        ? { 
            ...task, 
            status: 'rejected',
            feedback: revisionData.notes 
          }
        : task
    ));
    
    toast('📝 Issues Reported', { 
      description: 'Feedback has been sent back to the editor' 
    });
    
    // Move to next task (FIFO)
    const pendingTasks = qcTasks.filter(task => task.status === 'pending' && task.id !== selectedTask.id);
    const nextTask = pendingTasks.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];
    
    setSelectedTask(nextTask || null);
  };

  // Convert task to review asset format
  const getVideoAssetFromTask = (task: EnhancedWorkflowTask) => {
    const videoFile = task.files?.find(file => file.mimeType?.startsWith('video/'));
    if (!videoFile) return null;

    return {
      id: task.id,
      title: task.title.replace('QC Review: ', ''),
      subtitle: `Project: ${task.projectId}`,
      videoUrl: videoFile.url,
      thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
      runtime: '2:30', // Would be calculated from actual video
      status: 'in_qc' as const,
      client: 'Unknown Client',
      platform: 'Web',
      resolution: '1920x1080',
      fileSize: formatFileSize(videoFile.size),
      uploader: 'Editor',
      uploadDate: new Date(videoFile.uploadedAt).toLocaleDateString(),
      versions: [{
        id: 'v1',
        number: '1',
        thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&h=225&fit=crop',
        duration: '2:30',
        uploadDate: new Date(videoFile.uploadedAt).toLocaleDateString(),
        status: 'in_qc' as const
      }],
      currentVersion: 'v1',
      downloadEnabled: false,
      approvalLocked: false
    };
  };

  const hasVideoFile = (task: EnhancedWorkflowTask) => {
    return task.files?.some(file => file.mimeType?.startsWith('video/'));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  // Stats
  const pendingReviews = qcTasks.filter(task => task.status === 'pending').length;
  const completedToday = qcTasks.filter(task => 
    (task.status === 'approved' || task.status === 'rejected') &&
    new Date(task.createdAt).toDateString() === new Date().toDateString()
  ).length;
  const overdueReviews = qcTasks.filter(task => task.status === 'pending' && isOverdue(task)).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1>QC Portal</h1>
        <p className="text-muted-foreground mt-2">
          Review submitted work and approve or reject with feedback
        </p>
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
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Automated QC Workflow - FIFO System</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Tasks are automatically sorted by submission time (oldest first). After QC review:
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
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Enhanced Review Queue List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Review Queue ({pendingReviews})</CardTitle>
            <p className="text-xs text-muted-foreground">Sorted by submission time (oldest first)</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0 max-h-96 overflow-y-auto">
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
                      selectedTask?.id === task.id ? 'bg-muted' : ''
                    } ${getPriorityColor(task.priority)} ${isOverdue(task) ? 'border-r-4 border-r-red-500' : ''}`}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getStatusIcon(task.status)}
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                          {getTaskCategoryIcon(task.taskCategory)}
                        </div>
                        <h4 className="text-sm font-medium truncate">
                          {task.title.replace('QC Review: ', '')}
                        </h4>
                      </div>
                      <Badge 
                        variant={task.status === 'pending' ? 'default' : 'secondary'}
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
                            task.priority === 'urgent' ? 'border-red-500 text-red-700' :
                            task.priority === 'high' ? 'border-orange-500 text-orange-700' :
                            'border-gray-500 text-gray-700'
                          }`}
                        >
                          {task.priority}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span className={isOverdue(task) ? 'text-red-500 font-medium' : ''}>
                          Due {task.dueDate}
                          {isOverdue(task) && ' (Overdue)'}
                        </span>
                      </div>
                      {task.files && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <span>{task.files.length}</span>
                        </div>
                      )}
                    </div>

                    {/* Workflow Destination Indicator */}
                    {task.nextDestination && task.status === 'pending' && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${getDestinationColor(task.nextDestination)}`}>
                          {getDestinationIcon(task.nextDestination)}
                          <ArrowRight className="h-2 w-2" />
                          <span className="capitalize">{task.nextDestination}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Task Details & Review */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="truncate">
                  {selectedTask ? selectedTask.title.replace('QC Review: ', '') : 'Select a task to review'}
                </CardTitle>
                {selectedTask && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{selectedTask.id}</Badge>
                    <Badge variant={selectedTask.status === 'pending' ? 'default' : 'secondary'}>
                      {selectedTask.status}
                    </Badge>
                    {selectedTask.taskCategory && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-accent rounded text-xs">
                        {getTaskCategoryIcon(selectedTask.taskCategory)}
                        <span className="capitalize">{selectedTask.taskCategory}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedTask ? (
              <div className="space-y-6">
                {/* Enhanced Task Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-accent/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Project ID</p>
                    <p className="font-medium">{selectedTask.projectId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className={`font-medium ${isOverdue(selectedTask) ? 'text-red-500' : ''}`}>
                      {selectedTask.dueDate}
                      {isOverdue(selectedTask) && ' (Overdue)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Submitted</p>
                    <p className="font-medium">
                      {new Date(selectedTask.createdAt).toLocaleDateString()} at {new Date(selectedTask.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedTask.status)}
                      <span className="font-medium capitalize">{selectedTask.status}</span>
                    </div>
                  </div>
                </div>

                {/* Workflow Path Indicator */}
                {selectedTask.status === 'pending' && selectedTask.nextDestination && (
                  <div className="p-4 border rounded-lg bg-blue-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <ArrowRight className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-900">Workflow Path</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-blue-700">After approval, this task will go to:</span>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getDestinationColor(selectedTask.nextDestination)}`}>
                            {getDestinationIcon(selectedTask.nextDestination)}
                            <span className="capitalize">{selectedTask.nextDestination}</span>
                            {selectedTask.requiresClientReview && selectedTask.nextDestination === 'client' && (
                              <span>(Client Review Required)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Task Description */}
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedTask.description.split('\n\nOriginal task description: ')[1] || selectedTask.description}
                  </p>
                </div>

                {/* Files */}
                <div>
                  <h4 className="font-medium mb-3">Submitted Files ({selectedTask.files?.length || 0})</h4>
                  {selectedTask.files && selectedTask.files.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedTask.files.map((file) => (
                        <div key={file.id} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium truncate">{file.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {formatFileSize(file.size)} • Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                          </p>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={() => window.open(file.url, '_blank')}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View File
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No files submitted</p>
                  )}
                </div>

                {/* Review Actions */}
                {selectedTask.status === 'pending' && (
                  <div className="flex justify-center gap-4 pt-4">
                    {hasVideoFile(selectedTask) ? (
                      <Button 
                        size="lg"
                        onClick={() => setShowVideoReview(true)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Review Video
                      </Button>
                    ) : (
                      <QCReviewDialog
                        task={selectedTask}
                        onReviewComplete={handleReviewComplete}
                        trigger={
                          <Button size="lg">
                            <Eye className="h-4 w-4 mr-2" />
                            Start Review
                          </Button>
                        }
                      />
                    )}
                  </div>
                )}

                {/* Completed Review Info */}
                {(selectedTask.status === 'approved' || selectedTask.status === 'rejected') && (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(selectedTask.status)}
                      <h4 className="font-medium">Review Completed</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This task has been {selectedTask.status} and automatically moved to the next step in the workflow.
                    </p>
                    {selectedTask.feedback && (
                      <div className="mt-3">
                        <p className="text-sm font-medium">Feedback:</p>
                        <p className="text-sm text-muted-foreground">{selectedTask.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-16 w-16 mx-auto mb-4 opacity-40" />
                <h3 className="mb-2">No Task Selected</h3>
                <p>Tasks are automatically ordered by submission time (oldest first)</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Video Review Modal */}
      {selectedTask && hasVideoFile(selectedTask) && (
        <FullScreenReviewModal
          open={showVideoReview}
          onOpenChange={setShowVideoReview}
          asset={getVideoAssetFromTask(selectedTask)}
          onApprove={() => {}} // Not used for QC
          onRequestRevisions={() => {}} // Not used for QC  
          userRole="qc"
          onSendToClient={handleSendToClient}
          onSendBackToEditor={handleSendBackToEditor}
        />
      )}
    </div>
  );
}