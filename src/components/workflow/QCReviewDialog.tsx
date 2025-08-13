import { useState } from 'react';
import { CheckCircle, XCircle, FileText, ExternalLink, MessageSquare, Play, ArrowRight, UserCheck, Calendar, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { VisuallyHidden } from '../ui/visually-hidden';
import { WorkflowTask, useTaskWorkflow } from './TaskWorkflowEngine';
import { VideoReviewPlayer } from './VideoReviewPlayer';

interface QCReviewDialogProps {
  task: WorkflowTask & {
    nextDestination?: 'editor' | 'client' | 'scheduler';
    requiresClientReview?: boolean;
    taskCategory?: 'design' | 'video' | 'copywriting' | 'review';
    priority?: 'urgent' | 'high' | 'medium' | 'low';
  };
  onReviewComplete?: (approved: boolean, feedback?: string) => void;
  trigger?: React.ReactNode;
}

interface VideoNote {
  id: string;
  timestamp: number;
  comment: string;
  author: string;
  authorAvatar: string;
  createdAt: string;
  type: 'feedback' | 'approval' | 'revision';
  resolved?: boolean;
}

export function QCReviewDialog({ task, onReviewComplete, trigger }: QCReviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoNotes, setVideoNotes] = useState<VideoNote[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const { approveQCTask, rejectQCTask } = useTaskWorkflow();

  const handleApprove = () => {
    setReviewDecision('approve');
  };

  const handleReject = () => {
    setReviewDecision('reject');
  };

  const handleAddVideoNote = (timestamp: number, comment: string, type: 'feedback' | 'revision') => {
    const newNote: VideoNote = {
      id: `note-${Date.now()}-${Math.random()}`,
      timestamp,
      comment,
      author: 'Lisa Davis', // Current QC user
      authorAvatar: 'LD',
      createdAt: new Date().toISOString(),
      type,
      resolved: false
    };
    setVideoNotes(prev => [...prev, newNote]);
  };

  const handleResolveVideoNote = (noteId: string) => {
    setVideoNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, resolved: true } : note
    ));
  };

  const handleDeleteVideoNote = (noteId: string) => {
    setVideoNotes(prev => prev.filter(note => note.id !== noteId));
  };

  const handleSubmitReview = async () => {
    if (!reviewDecision) return;
    
    // For video files with notes, include the detailed feedback
    let finalFeedback = feedback;
    if (videoNotes.length > 0) {
      const notesSummary = videoNotes.map(note => 
        `${note.timestamp}s - ${note.type.toUpperCase()}: ${note.comment}`
      ).join('\n');
      finalFeedback = feedback ? `${feedback}\n\nTimestamped Notes:\n${notesSummary}` : `Timestamped Notes:\n${notesSummary}`;
    }
    
    if (reviewDecision === 'reject' && !finalFeedback.trim()) {
      alert('Please provide feedback for rejection');
      return;
    }

    setIsSubmitting(true);
    try {
      if (reviewDecision === 'approve') {
        await approveQCTask(task, finalFeedback || 'Approved - meets quality standards');
        console.log(`✅ Task approved and sent to ${task.nextDestination || 'scheduler'}`);
      } else {
        await rejectQCTask(task, finalFeedback);
        console.log('❌ Task rejected and sent back to editor');
      }

      onReviewComplete?.(reviewDecision === 'approve', finalFeedback);
      setOpen(false);
      
      // Reset state
      setFeedback('');
      setReviewDecision(null);
      setVideoNotes([]);
      setSelectedFileIndex(0);
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'];
    
    if (videoExtensions.includes(ext || '')) {
      return <Play className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const isVideoFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'];
    return videoExtensions.includes(ext || '');
  };

  const getDestinationIcon = (destination?: string) => {
    switch (destination) {
      case 'client':
        return <UserCheck className="h-4 w-4" />;
      case 'scheduler':
        return <Calendar className="h-4 w-4" />;
      case 'editor':
        return <User className="h-4 w-4" />;
      default:
        return <ArrowRight className="h-4 w-4" />;
    }
  };

  const getDestinationColor = (destination?: string) => {
    switch (destination) {
      case 'client':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'scheduler':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'editor':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getDestinationName = (destination?: string) => {
    switch (destination) {
      case 'client':
        return 'Client Review';
      case 'scheduler':
        return 'Scheduler';
      case 'editor':
        return 'Editor';
      default:
        return 'Next Step';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            Review Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" aria-describedby="qc-dialog-description">
        <DialogHeader>
          <DialogTitle id="qc-dialog-title">QC Review: {task.title.replace('QC Review: ', '')}</DialogTitle>
          <DialogDescription id="qc-dialog-description">
            Review the submitted work and decide whether to approve or reject it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Enhanced Workflow Path Indicator */}
          {task.nextDestination && (
            <div className={`p-4 border rounded-lg ${getDestinationColor(task.nextDestination)}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg">
                  {getDestinationIcon(task.nextDestination)}
                </div>
                <div>
                  <h4 className="font-medium">Workflow Path</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm">After approval, this task will go to:</span>
                    <Badge variant="outline" className={getDestinationColor(task.nextDestination)}>
                      {getDestinationName(task.nextDestination)}
                    </Badge>
                    {task.requiresClientReview && task.nextDestination === 'client' && (
                      <Badge variant="secondary" className="text-xs">
                        Client Review Required
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Task Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label>Original Task</Label>
                <p className="text-sm">{task.title.replace('QC Review: ', '')}</p>
              </div>
              
              <div>
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground">
                  {task.description.split('\n\nOriginal task description: ')[1] || task.description}
                </p>
              </div>

              <div>
                <Label>Priority</Label>
                <Badge variant={
                  task.priority === 'urgent' ? 'destructive' :
                  task.priority === 'high' ? 'default' :
                  'secondary'
                }>
                  {task.priority || 'medium'}
                </Badge>
              </div>

              {task.taskCategory && (
                <div>
                  <Label>Category</Label>
                  <Badge variant="outline" className="capitalize">
                    {task.taskCategory}
                  </Badge>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label>Due Date</Label>
                <p className="text-sm">{task.dueDate}</p>
              </div>
              
              <div>
                <Label>Submitted By</Label>
                <p className="text-sm">{task.assignedToName}</p>
              </div>

              <div>
                <Label>Project ID</Label>
                <p className="text-sm text-muted-foreground">{task.projectId || 'N/A'}</p>
              </div>

              <div>
                <Label>Submission Time</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(task.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Files Review */}
          <div className="space-y-4">
            <Label>Submitted Files ({task.files?.length || 0})</Label>
            
            {task.files && task.files.length > 0 ? (
              <div className="space-y-4">
                {/* File tabs if multiple files */}
                {task.files.length > 1 && (
                  <div className="flex gap-2 border-b">
                    {task.files.map((file, index) => (
                      <Button
                        key={file.id}
                        variant={selectedFileIndex === index ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedFileIndex(index)}
                        className="flex items-center gap-2"
                      >
                        {getFileIcon(file.name)}
                        <span className="truncate max-w-32">{file.name}</span>
                      </Button>
                    ))}
                  </div>
                )}

                {/* Current file display */}
                {task.files[selectedFileIndex] && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {getFileIcon(task.files[selectedFileIndex].name)}
                        <div>
                          <p className="text-sm font-medium">{task.files[selectedFileIndex].name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(task.files[selectedFileIndex].size)} • {new Date(task.files[selectedFileIndex].uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => window.open(task.files[selectedFileIndex].url, '_blank')}>
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open in Drive
                      </Button>
                    </div>

                    {/* Video Player for video files */}
                    {isVideoFile(task.files[selectedFileIndex].name) ? (
                      <VideoReviewPlayer
                        file={task.files[selectedFileIndex]}
                        notes={videoNotes}
                        onAddNote={handleAddVideoNote}
                        onResolveNote={handleResolveVideoNote}
                        onDeleteNote={handleDeleteVideoNote}
                        isReviewer={true}
                      />
                    ) : (
                      /* Static file preview for non-video files */
                      <div className="border rounded-lg p-8">
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto">
                            {getFileIcon(task.files[selectedFileIndex].name)}
                          </div>
                          <div>
                            <p className="font-medium">{task.files[selectedFileIndex].name}</p>
                            <p className="text-sm text-muted-foreground">
                              Click "Open in Drive" to review this file
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p>No files submitted</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Review Decision */}
          <div className="space-y-4">
            <Label>Review Decision</Label>
            
            <div className="flex gap-4">
              <Button
                variant={reviewDecision === 'approve' ? 'default' : 'outline'}
                onClick={handleApprove}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              
              <Button
                variant={reviewDecision === 'reject' ? 'destructive' : 'outline'}
                onClick={handleReject}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>

            {reviewDecision && (
              <div className="space-y-3">
                <Label htmlFor="feedback">
                  {reviewDecision === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Feedback (Required)'}
                </Label>
                <Textarea
                  id="feedback"
                  placeholder={
                    reviewDecision === 'approve' 
                      ? "Add any notes about the approved work..."
                      : "Explain what needs to be fixed and provide specific feedback..."
                  }
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {reviewDecision === 'approve' && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span>Approving this task will automatically send it to:</span>
                    {task.nextDestination && (
                      <div className="flex items-center gap-1">
                        {getDestinationIcon(task.nextDestination)}
                        <span className="font-medium">{getDestinationName(task.nextDestination)}</span>
                      </div>
                    )}
                  </div>
                  {videoNotes.length > 0 && (
                    <span className="block font-medium">
                      📝 {videoNotes.length} timestamped note{videoNotes.length !== 1 ? 's' : ''} will be included with approval.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {reviewDecision === 'reject' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center gap-2 mb-2">
                    <span>Rejecting this task will create a revision task and send it back to:</span>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Editor</span>
                    </div>
                  </div>
                  {videoNotes.length > 0 && (
                    <span className="block font-medium">
                      📝 {videoNotes.length} timestamped note{videoNotes.length !== 1 ? 's' : ''} will be included for revisions.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitReview}
            disabled={!reviewDecision || isSubmitting || (reviewDecision === 'reject' && !feedback.trim())}
            className={reviewDecision === 'approve' ? 'bg-green-600 hover:bg-green-700' : reviewDecision === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {isSubmitting ? 'Submitting...' : 
             reviewDecision === 'approve' ? `Approve & Send to ${getDestinationName(task.nextDestination)}` : 
             'Reject & Send to Editor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}