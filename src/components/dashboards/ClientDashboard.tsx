import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { CheckCircle, MessageSquare, Calendar, Download, Eye, Play, Pause, Clock, Send, X } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { useTaskWorkflow, WorkflowTask, WorkflowFile } from '../workflow/TaskWorkflowEngine';
import { FullScreenReviewModal } from '../client/FullScreenReviewModal';
import { useNotifications } from '../NotificationContext';
import { toast } from 'sonner';
import { Toaster } from '../ui/sonner';
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const pendingApprovals = [
  {
    id: 'APPROVAL-001',
    title: 'Holiday Campaign Video',
    subtitle: 'Main promotional video for holiday season campaign',
    type: 'Video',
    submittedDate: '2024-08-09',
    deadline: '2024-08-12',
    submittedBy: { name: 'Sarah Wilson', avatar: 'SW', id: 'ed1' },
    thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    status: 'pending',
    description: 'Main promotional video for holiday season campaign',
    comments: 2,
    projectId: 'proj-001',
    requiresClientApproval: true,
    // Review modal specific data
    runtime: '2:34',
    client: 'Acme Corporation',
    platform: 'Instagram, Facebook',
    resolution: '1920x1080',
    fileSize: '45.2 MB',
    uploader: 'Sarah Wilson',
    uploadDate: '2024-08-09',
    versions: [
      {
        id: 'v1',
        number: '1',
        thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=120&h=80&fit=crop',
        duration: '2:34',
        uploadDate: '2024-08-09',
        status: 'client_review' as const
      },
      {
        id: 'v2',
        number: '2',
        thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=120&h=80&fit=crop',
        duration: '2:28',
        uploadDate: '2024-08-08',
        status: 'draft' as const
      }
    ],
    currentVersion: 'v1',
    downloadEnabled: true,
    approvalLocked: false,
    timestampComments: [
      { id: '1', timestamp: 12.5, author: 'John Doe', text: 'Consider adjusting the color grading here', resolved: false, createdAt: '2024-08-09T10:30:00Z' },
      { id: '2', timestamp: 45.2, author: 'Jane Smith', text: 'Audio level seems a bit low in this section', resolved: false, createdAt: '2024-08-09T14:20:00Z' }
    ],
    files: [
      {
        id: 'file-001',
        name: 'holiday-campaign-video-final.mp4',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        uploadedAt: '2024-08-09T08:00:00Z',
        uploadedBy: 'Sarah Wilson',
        mimeType: 'video/mp4',
        size: 15728640
      }
    ]
  },
  {
    id: 'APPROVAL-002',
    title: 'Brand Guidelines Update',
    type: 'Document',
    submittedDate: '2024-08-08',
    deadline: '2024-08-15',
    submittedBy: { name: 'Mike Johnson', avatar: 'MJ', id: 'ed2' },
    thumbnail: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=300&fit=crop',
    status: 'pending',
    description: 'Updated brand guidelines with new color palette and typography',
    comments: 0,
    projectId: 'proj-002',
    requiresClientApproval: true,
    // Review modal specific data
    runtime: '0:00',
    client: 'Tech Innovators Inc',
    platform: 'Web, Print',
    resolution: 'PDF',
    fileSize: '2.1 MB',
    uploader: 'Mike Johnson',
    uploadDate: '2024-08-08',
    versions: [
      {
        id: 'v1',
        number: '1',
        thumbnail: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=120&h=80&fit=crop',
        duration: '0:00',
        uploadDate: '2024-08-08',
        status: 'client_review' as const
      }
    ],
    currentVersion: 'v1',
    downloadEnabled: true,
    approvalLocked: false,
    files: [
      {
        id: 'file-002',
        name: 'brand-guidelines-v2.pdf',
        url: 'https://example.com/brand-guidelines-v2.pdf',
        uploadedAt: '2024-08-08T09:15:00Z',
        uploadedBy: 'Mike Johnson',
        mimeType: 'application/pdf',
        size: 2048000
      }
    ]
  },
  {
    id: 'APPROVAL-003',
    title: 'Social Media Assets Pack',
    type: 'Graphics',
    submittedDate: '2024-08-07',
    deadline: '2024-08-14',
    submittedBy: { name: 'Lisa Davis', avatar: 'LD', id: 'ed1' },
    thumbnail: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=300&fit=crop',
    status: 'pending',
    description: 'Complete set of social media graphics for Q4 campaigns',
    comments: 1,
    projectId: 'proj-003',
    requiresClientApproval: false,
    files: [
      {
        id: 'file-003',
        name: 'social-media-assets-q4.zip',
        url: 'https://example.com/social-media-assets-q4.zip',
        uploadedAt: '2024-08-07T14:30:00Z',
        uploadedBy: 'Lisa Davis',
        mimeType: 'application/zip',
        size: 5242880
      }
    ]
  },
  {
    id: 'APPROVAL-004',
    title: 'Website Hero Banner',
    type: 'Web Graphics',
    submittedDate: '2024-08-06',
    deadline: '2024-08-13',
    submittedBy: { name: 'Tom Brown', avatar: 'TB', id: 'ed2' },
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
    status: 'changes-requested',
    description: 'Hero banner design for main website homepage',
    comments: 3,
    projectId: 'proj-004',
    requiresClientApproval: true,
    files: [
      {
        id: 'file-004',
        name: 'hero-banner-design.psd',
        url: 'https://example.com/hero-banner-design.psd',
        uploadedAt: '2024-08-06T11:45:00Z',
        uploadedBy: 'Tom Brown',
        mimeType: 'application/octet-stream',
        size: 12582912
      }
    ]
  },
  {
    id: 'APPROVAL-005',
    title: 'Product Photography',
    type: 'Photography',
    submittedDate: '2024-08-05',
    deadline: '2024-08-11',
    submittedBy: { name: 'Emma White', avatar: 'EW', id: 'ed1' },
    thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop',
    status: 'approved',
    description: 'Professional product shots for new catalog',
    comments: 0,
    projectId: 'proj-005',
    requiresClientApproval: true,
    files: [
      {
        id: 'file-005',
        name: 'product-photography-final.zip',
        url: 'https://example.com/product-photography-final.zip',
        uploadedAt: '2024-08-05T16:20:00Z',
        uploadedBy: 'Emma White',
        mimeType: 'application/zip',
        size: 25165824
      }
    ]
  },
  {
    id: 'APPROVAL-006',
    title: 'Email Newsletter Template',
    type: 'Email Design',
    submittedDate: '2024-08-04',
    deadline: '2024-08-16',
    submittedBy: { name: 'Alex Chen', avatar: 'AC', id: 'ed2' },
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=300&fit=crop',
    status: 'pending',
    description: 'Monthly newsletter template with new branding',
    comments: 1,
    projectId: 'proj-006',
    requiresClientApproval: false,
    files: [
      {
        id: 'file-006',
        name: 'newsletter-template.html',
        url: 'https://example.com/newsletter-template.html',
        uploadedAt: '2024-08-04T13:10:00Z',
        uploadedBy: 'Alex Chen',
        mimeType: 'text/html',
        size: 51200
      }
    ]
  }
];

const projectSummary = {
  total: 15,
  pending: 4,
  approved: 8,
  changesRequested: 3
};

function VideoReviewDialog({ approval, open, onOpenChange, onApprove, onReject }: { 
  approval: any; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onApprove: (approval: any, feedback?: string) => void;
  onReject: (approval: any, rejectionReason: string) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const [comments, setComments] = useState(approval?.timestampComments || []);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  
  // Change request state
  const [changeCategory, setChangeCategory] = useState('design');
  const [changeDescription, setChangeDescription] = useState('');
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const rect = video.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickTime = (clickX / rect.width) * duration;
    setSelectedTimestamp(clickTime);
    video.currentTime = clickTime;
    setCurrentTime(clickTime);
  };

  const handleAddComment = () => {
    if (newComment.trim() && selectedTimestamp !== null) {
      const comment = {
        id: String(Date.now()),
        timestamp: selectedTimestamp,
        author: 'You',
        text: newComment.trim(),
        resolved: false,
        createdAt: new Date().toISOString()
      };
      setComments([...comments, comment]);
      setNewComment('');
      setSelectedTimestamp(null);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleApprove = async () => {
    // Create feedback summary from comments
    const feedbackSummary = comments
      .filter(c => !c.resolved)
      .map(c => `[${formatTime(c.timestamp)}] ${c.text}`)
      .join('\n');
    
    onApprove(approval, feedbackSummary || 'Approved');
    onOpenChange(false);
  };

  const handleRequestChanges = () => {
    // Create rejection reason from comments
    const rejectionReason = comments
      .filter(c => !c.resolved)
      .map(c => `[${formatTime(c.timestamp)}] ${c.text}`)
      .join('\n') || 'Changes requested - please review feedback';
    
    onReject(approval, rejectionReason);
    onOpenChange(false);
  };

  const handleRequestRevisions = () => {
    setShowChangeRequest(true);
  };

  const handleSubmitRevisions = () => {
    if (!changeDescription.trim()) {
      toast('❌ Error', { description: 'Please provide a description of the changes needed.' });
      return;
    }

    // Create detailed rejection reason from change request
    const rejectionReason = `
CLIENT CHANGE REQUEST

Category: ${changeCategory}

DESCRIPTION:
${changeDescription}

${comments.filter(c => !c.resolved).length > 0 ? `
TIMESTAMPED FEEDBACK:
${comments.filter(c => !c.resolved).map(c => `[${formatTime(c.timestamp)}] ${c.text}`).join('\n')}` : ''}

${additionalNotes ? `
ADDITIONAL NOTES:
${additionalNotes}` : ''}

Please address these concerns and re-submit for approval.
    `.trim();

    onReject(approval, rejectionReason);
    setShowChangeRequest(false);
    onOpenChange(false);
    
    // Reset form
    setChangeCategory('design');
    setChangeDescription('');
    setSelectedIssues([]);
    setAdditionalNotes('');
  };

  if (!approval) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <VisuallyHidden>
              <DialogTitle>{approval.title}</DialogTitle>
              </VisuallyHidden>
              <DialogDescription className="mt-1">{approval.description}</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{approval.type}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                className="w-full aspect-video cursor-pointer"
                controls
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={handleVideoClick}
              >
                <source src={approval.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              
              {/* Timestamp Markers */}
              <div className="absolute bottom-12 left-0 right-0 px-4">
                <div className="relative h-1">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="absolute top-0 w-2 h-2 bg-red-500 rounded-full transform -translate-x-1 -translate-y-1 cursor-pointer hover:scale-125 transition-transform"
                      style={{ left: `${(comment.timestamp / duration) * 100}%` }}
                      title={`${formatTime(comment.timestamp)}: ${comment.text}`}
                    />
                  ))}
                  {selectedTimestamp !== null && (
                    <div
                      className="absolute top-0 w-2 h-2 bg-blue-500 rounded-full transform -translate-x-1 -translate-y-1"
                      style={{ left: `${(selectedTimestamp / duration) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Add Comment Section */}
            {selectedTimestamp !== null && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800">
                      Add comment at {formatTime(selectedTimestamp)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTimestamp(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add your feedback for this timestamp..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            {!showChangeRequest ? (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleRequestRevisions}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Request Revisions
                </Button>
                <Button className="flex-1" onClick={handleApprove}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Change Request Form */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium">Request Revisions</h4>
                  
                  {/* Category Selection */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Change Category</label>
                    <select 
                      value={changeCategory} 
                      onChange={(e) => setChangeCategory(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="content">Content Changes</option>
                      <option value="design">Design Changes</option>
                      <option value="timing">Timing Changes</option>
                      <option value="technical">Technical Issues</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Description *</label>
                    <Textarea
                      placeholder="Please provide specific, actionable feedback about what needs to be changed..."
                      value={changeDescription}
                      onChange={(e) => setChangeDescription(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>

                  {/* Additional Notes */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Additional Notes</label>
                    <Textarea
                      placeholder="Any additional context or notes..."
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowChangeRequest(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={handleSubmitRevisions} className="flex-1">
                      Submit Revisions
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Comments Sidebar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Comments ({comments.length})</h3>
              <Badge variant="outline" className="text-xs">
                {comments.filter(c => !c.resolved).length} unresolved
              </Badge>
            </div>

            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No comments yet. Click on the video timeline to add feedback.
                  </p>
                ) : (
                  comments
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((comment) => (
                      <Card key={comment.id} className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs font-mono"
                                onClick={() => {
                                  const video = document.querySelector('video');
                                  if (video) {
                                    video.currentTime = comment.timestamp;
                                    setCurrentTime(comment.timestamp);
                                  }
                                }}
                              >
                                {formatTime(comment.timestamp)}
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                {comment.author}
                              </span>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${comment.resolved ? 'bg-green-500' : 'bg-red-500'}`} />
                          </div>
                          <p className="text-sm">{comment.text}</p>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                setComments(comments.map(c => 
                                  c.id === comment.id ? { ...c, resolved: !c.resolved } : c
                                ));
                              }}
                            >
                              {comment.resolved ? 'Reopen' : 'Resolve'}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                )}
              </div>
            </ScrollArea>

            <div className="text-xs text-muted-foreground">
              <p>💡 Click anywhere on the video timeline to add timestamped feedback</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalCard({ approval, onOpenReview }: { 
  approval: any; 
  onOpenReview: (approval: any) => void;
}) {
  const handleReview = () => {
    onOpenReview(approval);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'changes-requested': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };



  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative">
        <ImageWithFallback
          src={approval.thumbnail}
          alt={approval.title}
          className="w-full h-48 object-cover"
        />
        {approval.type === 'Video' && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
               onClick={handleReview}>
            <Play className="h-12 w-12 text-white" />
          </div>
        )}

        <div className="absolute top-3 right-3">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(approval.status)}`} />
        </div>
      </div>
      
      <CardContent className="p-4 space-y-4">
        <div>
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium text-sm">{approval.title}</h3>
            <Badge variant="outline" className="text-xs">
              {approval.type}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {approval.description}
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-4 w-4">
            <AvatarFallback className="text-[8px]">{approval.submittedBy.avatar}</AvatarFallback>
          </Avatar>
          <span>{approval.submittedBy.name}</span>
          <span>•</span>
          <Calendar className="h-3 w-3" />
          <span>Due {approval.deadline}</span>
        </div>
        
        {approval.comments > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>{approval.comments} comments</span>
          </div>
        )}
        
        <div className="flex gap-2">
          {approval.requiresClientApproval ? (
            <Button size="sm" variant="outline" className="w-full" onClick={handleReview}>
              <Eye className="h-3 w-3 mr-1" />
              Review
            </Button>
          ) : (
            <div className="w-full text-center py-2 px-3 bg-muted rounded-md">
              <span className="text-xs text-muted-foreground">No approval required</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ClientDashboard() {
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [showFullscreenReview, setShowFullscreenReview] = useState(false);
  const [approvals, setApprovals] = useState(pendingApprovals);
  const { approveQCTask, rejectQCTask, createQCReviewTask } = useTaskWorkflow();
  const { addNotification } = useNotifications();

  const handleOpenReview = (approval: any) => {
    // Convert approval to ReviewAsset format
    const reviewAsset = {
      ...approval,
      status: approval.status === 'pending' ? 'client_review' : approval.status
    };
    setSelectedAsset(reviewAsset);
    setShowFullscreenReview(true);
  };

  const handleCloseReview = (open: boolean) => {
    setShowFullscreenReview(open);
    if (!open) {
      setSelectedAsset(null);
    }
  };

  const handleApproveContent = async (approval: any, feedback?: string) => {
    try {
      // Convert approval to WorkflowTask format for the scheduler
      const workflowTask: WorkflowTask = {
        id: approval.id,
        title: approval.title,
        description: approval.description,
        type: 'scheduling',
        status: 'approved',
        assignedTo: approval.submittedBy.id,
        assignedToName: approval.submittedBy.name,
        assignedToRole: 'editor',
        createdAt: approval.submittedDate + 'T08:00:00Z',
        dueDate: approval.deadline,
        projectId: approval.projectId,
        files: approval.files,
        workflowStep: 'qc_review',
        queuePosition: 0 // Will be assigned by workflow engine
      };

      // Approve and create scheduling task
      await approveQCTask(workflowTask, feedback);

      // Update local state
      setApprovals(prev => prev.map(app => 
        app.id === approval.id ? { ...app, status: 'approved' } : app
      ));

      toast('✅ Content Approved', {
        description: `${approval.title} has been approved and sent to scheduler.`,
      });

    } catch (error) {
      toast('❌ Error', {
        description: 'Failed to approve content. Please try again.',
      });
    }
  };

  const handleRejectContent = async (approval: any, rejectionReason: string) => {
    try {
      // Convert approval to WorkflowTask format for revision
      const workflowTask: WorkflowTask = {
        id: approval.id,
        title: approval.title,
        description: approval.description,
        type: 'qc_review',
        status: 'pending',
        assignedTo: approval.submittedBy.id,
        assignedToName: approval.submittedBy.name,
        assignedToRole: 'editor',
        createdAt: approval.submittedDate + 'T08:00:00Z',
        dueDate: approval.deadline,
        projectId: approval.projectId,
        files: approval.files,
        workflowStep: 'qc_review',
        queuePosition: 0 // Will be assigned by workflow engine
      };

      // Reject and create revision task
      await rejectQCTask(workflowTask, rejectionReason);

      // Update local state
      setApprovals(prev => prev.map(app => 
        app.id === approval.id ? { ...app, status: 'changes-requested' } : app
      ));

      // Send notification to editor about client feedback
      addNotification({
        type: 'client_feedback',
        title: 'Client Change Request',
        message: `${approval.title} requires revisions - client feedback received`,
        priority: 'high',
        actionRequired: true,
        user: { name: 'Client Portal', avatar: 'CP' }
      });

      toast('📝 Changes Requested', {
        description: `${approval.title} has been sent back to editor with revision notes.`,
      });

      console.log('📝 Content rejected and revision task created:', approval.title);
    } catch (error) {
      toast('❌ Error', {
        description: 'Failed to request changes. Please try again.',
      });
    }
  };

  const handleApproveAsset = async (asset: any, confirmFinal: boolean) => {
    try {
      // Convert asset back to approval format for existing workflow
      const approval = approvals.find(a => a.id === asset.id);
      if (!approval) return;

      await handleApproveContent(approval, confirmFinal ? 'Approved as final for publishing' : 'Approved');
      
      toast('✅ Asset Approved', {
        description: `${asset.title} has been approved${confirmFinal ? ' as final' : ''}.`,
      });
    } catch (error) {
      toast('❌ Error', {
        description: 'Failed to approve asset. Please try again.',
      });
    }
  };

  const handleRequestAssetRevisions = async (asset: any, revisionData: any) => {
    try {
      // Convert asset back to approval format for existing workflow
      const approval = approvals.find(a => a.id === asset.id);
      if (!approval) return;

      // Create structured revision feedback
      const revisionReason = `
REVISION REQUEST - ${revisionData.reason.toUpperCase()}

NOTES:
${revisionData.notes}

${revisionData.dueDate ? `DUE DATE: ${revisionData.dueDate}` : ''}
ASSIGNED TO: ${revisionData.assignTo.toUpperCase()}

${revisionData.referenceFile ? `Reference file attached: ${revisionData.referenceFile.name}` : ''}

Please address these revisions and re-submit for approval.
      `.trim();

      await handleRejectContent(approval, revisionReason);

      // Send notification with revision details
      addNotification({
        type: 'client_feedback',
        title: `${revisionData.reason.charAt(0).toUpperCase() + revisionData.reason.slice(1)} Revision Request`,
        message: `${asset.title} - ${revisionData.notes.substring(0, 100)}...`,
        priority: 'high',
        actionRequired: true,
        user: { name: 'Client Portal', avatar: 'CP' }
      });

      toast('📝 Revisions Requested', {
        description: `Feedback has been sent to the ${revisionData.assignTo}.`,
      });
    } catch (error) {
      toast('❌ Error', {
        description: 'Failed to submit revision request. Please try again.',
      });
    }
  };

  const handleSubmitChangeRequest = async (changeRequest: any) => {
    if (!selectedApproval) return;

    // Create detailed rejection reason from change request
    const rejectionReason = `
CLIENT CHANGE REQUEST - ${changeRequest.priority.toUpperCase()} PRIORITY

Category: ${changeRequest.category}
Priority: ${changeRequest.priority}

DESCRIPTION:
${changeRequest.description}

${changeRequest.specificIssues.length > 0 ? `
SPECIFIC ISSUES:
${changeRequest.specificIssues.map((issue: string) => `• ${issue}`).join('\n')}` : ''}

${changeRequest.additionalNotes ? `
ADDITIONAL NOTES:
${changeRequest.additionalNotes}` : ''}

Please address these concerns and re-submit for approval.
    `.trim();

    if (changeRequest.requestRevision) {
      await handleRejectContent(selectedApproval, rejectionReason);
      
      // Send additional notification with detailed change request info
      addNotification({
        type: 'client_feedback',
        title: `${changeRequest.priority.toUpperCase()} Priority Change Request`,
        message: `${selectedApproval.title} - ${changeRequest.category} changes needed: ${changeRequest.description.substring(0, 100)}...`,
        priority: changeRequest.priority as 'high' | 'medium' | 'low',
        actionRequired: true,
        user: { name: 'Client Portal', avatar: 'CP' }
      });
    } else {
      // Approve with comments
      await handleApproveContent(selectedApproval, `Approved with feedback: ${rejectionReason}`);
      
      // Send notification about approval with feedback
      addNotification({
        type: 'content_approved',
        title: 'Content Approved with Feedback',
        message: `${selectedApproval.title} approved by client with additional comments`,
        priority: 'medium',
        actionRequired: false,
        user: { name: 'Client Portal', avatar: 'CP' }
      });
    }

    setSelectedApproval(null);
  };

  // Calculate dynamic summary stats
  const dynamicSummary = {
    total: approvals.length,
    pending: approvals.filter(a => a.status === 'pending').length,
    approved: approvals.filter(a => a.status === 'approved').length,
    changesRequested: approvals.filter(a => a.status === 'changes-requested').length
  };

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1>Client Portal</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve submitted content
          </p>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                <strong>System Active:</strong> All approval actions, change requests, and feedback are automatically sent to editors and tracked in the workflow system.
              </span>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium">{dynamicSummary.total}</h3>
              <p className="text-sm text-muted-foreground">Total Projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium text-yellow-600">{dynamicSummary.pending}</h3>
              <p className="text-sm text-muted-foreground">Pending Approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium text-green-600">{dynamicSummary.approved}</h3>
              <p className="text-sm text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium text-orange-600">{dynamicSummary.changesRequested}</h3>
              <p className="text-sm text-muted-foreground">Changes Requested</p>
            </CardContent>
          </Card>
        </div>

      {/* Approval Grid */}
      <div>
        <h2 className="mb-4">Recent Submissions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {approvals.map((approval) => (
            <ApprovalCard 
              key={approval.id} 
              approval={approval} 
              onOpenReview={handleOpenReview}
            />
          ))}
        </div>
      </div>

      {/* Full-Screen Review Modal */}
      <FullScreenReviewModal
        open={showFullscreenReview}
        onOpenChange={handleCloseReview}
        asset={selectedAsset}
        onApprove={handleApproveAsset}
        onRequestRevisions={handleRequestAssetRevisions}
        onNextAsset={() => {
          // Find next asset that requires approval
          const currentIndex = approvals.findIndex(a => a.id === selectedAsset?.id);
          const nextApproval = approvals
            .slice(currentIndex + 1)
            .find(a => a.requiresClientApproval && a.status === 'pending');
          
          if (nextApproval) {
            handleOpenReview(nextApproval);
          } else {
            toast('ℹ️ No More Assets', {
              description: 'You have reviewed all pending assets.',
            });
          }
        }}
      />
      </div>
      <Toaster />
    </>
  );
}