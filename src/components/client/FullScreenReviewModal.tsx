import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { 
  X, 
  Download, 
  Share, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Settings, 
  CheckCircle2,
  MessageSquare,
  Upload,
  Calendar,
  User,
  Monitor,
  HardDrive,
  Clock,
  ChevronLeft,
  ChevronRight,
  Maximize,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { getVideoSource } from '../workflow/VideoUrlHelper';

interface Version {
  id: string;
  number: string;
  thumbnail: string;
  duration: string;
  uploadDate: string;
  status: 'draft' | 'in_qc' | 'client_review' | 'approved';
}

interface ReviewAsset {
  id: string;
  title: string;
  subtitle?: string;
  videoUrl: string;
  thumbnail: string;
  runtime: string;
  status: 'draft' | 'in_qc' | 'client_review' | 'approved';
  client: string;
  platform: string;
  resolution: string;
  fileSize: string;
  uploader: string;
  uploadDate: string;
  versions: Version[];
  currentVersion: string;
  downloadEnabled: boolean;
  approvalLocked: boolean;
}

interface FullScreenReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: ReviewAsset | null;
  onApprove: (asset: ReviewAsset, confirmFinal: boolean) => void;
  onRequestRevisions: (asset: ReviewAsset, revisionData: RevisionRequest) => void;
  onNextAsset?: () => void;
  userRole?: 'client' | 'qc';
  onSendToClient?: (asset: ReviewAsset) => void;
  onSendBackToEditor?: (asset: ReviewAsset, revisionData: RevisionRequest) => void;
}

interface RevisionRequest {
  reason: 'design' | 'content' | 'timing' | 'technical' | 'spelling' | 'other';
  notes: string;
  referenceFile?: File;
  dueDate?: string;
  assignTo: 'editor' | 'pm';
  entries: Array<{
    id: string;
    timestamp: string;
    reason: 'design' | 'content' | 'timing' | 'technical' | 'spelling' | 'other';
    notes: string;
    videoTime?: string;
  }>;
}

const statusColors = {
  draft: 'bg-gray-500',
  in_qc: 'bg-blue-500',
  client_review: 'bg-yellow-500',
  approved: 'bg-green-500'
};

const statusLabels = {
  draft: 'Draft',
  in_qc: 'In QC',
  client_review: 'Client Review',
  approved: 'Approved'
};

export function FullScreenReviewModal({ 
  open, 
  onOpenChange, 
  asset, 
  onApprove, 
  onRequestRevisions,
  onNextAsset,
  userRole = 'client',
  onSendToClient,
  onSendBackToEditor
}: FullScreenReviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showCaptions, setShowCaptions] = useState(false);
  const [quality, setQuality] = useState('1080p');
  const [currentVersion, setCurrentVersion] = useState('');
  const [showRevisions, setShowRevisions] = useState(false);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  
  // Revision form state
  const [revisionReason, setRevisionReason] = useState<'design' | 'content' | 'timing' | 'technical' | 'spelling' | 'other'>('design');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [dueDate, setDueDate] = useState('');

  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
  const [showRevisionSuccess, setShowRevisionSuccess] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  
  // Revision logging system
  const [revisionEntries, setRevisionEntries] = useState<Array<{
    id: string;
    timestamp: string;
    reason: 'design' | 'content' | 'timing' | 'technical' | 'spelling' | 'other';
    notes: string;
    videoTime?: string;
  }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Determine video source type
  const videoSource = asset ? getVideoSource(asset.videoUrl) : { type: 'video' as const, src: '' };

  useEffect(() => {
    if (asset) {
      setCurrentVersion(asset.currentVersion);
      setIsPlaying(false);
      setCurrentTime(0);
      setConfirmFinal(false);
      setShowApprovalSuccess(false);
      setShowRevisionSuccess(false);
      setIsDragging(false);
      setHoverTime(null);
      setVideoError(false);
      setIframeLoaded(false);
      resetRevisionForm();
    }
  }, [asset]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!open || showRevisions || isDragging) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'Escape':
          onOpenChange(false);
          break;
        case 'Enter':
          if (!confirmFinal && asset?.status === 'client_review') {
            handleApprove();
          }
          break;
        case 'j':
        case 'J':
          e.preventDefault();
          seekBackward();
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          seekForward();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekForward();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [open, showRevisions, confirmFinal, asset, isDragging]);

  const resetRevisionForm = () => {
    setRevisionReason('design');
    setRevisionNotes('');
    setReferenceFile(null);
    setDueDate('');
    setRevisionEntries([]);
  };

  const addRevisionEntry = () => {
    if (!revisionNotes.trim()) {
      toast('❌ Notes Required', { 
        description: 'Please provide specific notes for this revision entry.' 
      });
      return;
    }

    const currentVideoTime = videoRef.current ? formatTime(videoRef.current.currentTime) : undefined;
    const newEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      reason: revisionReason,
      notes: revisionNotes.trim(),
      videoTime: currentVideoTime
    };

    setRevisionEntries(prev => [...prev, newEntry]);
    setRevisionNotes('');
    toast('✅ Revision Entry Added', { 
      description: `Added ${revisionReason} note${currentVideoTime ? ` at ${currentVideoTime}` : ''}` 
    });
  };

  const removeRevisionEntry = (entryId: string) => {
    setRevisionEntries(prev => prev.filter(entry => entry.id !== entryId));
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const seekBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, currentTime - 10);
    }
  };

  const seekForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(duration, currentTime + 10);
    }
  };

  const handlePlaybackSpeedChange = (speed: string) => {
    const newSpeed = parseFloat(speed);
    setPlaybackSpeed(newSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed;
    }
  };

  const handleVersionChange = (versionId: string) => {
    setCurrentVersion(versionId);
    // In a real app, this would load the new video source
    toast('🔄 Loading version...', { description: `Switched to version ${versionId}` });
  };

  const handleApprove = () => {
    if (!asset) return;
    
    if (!confirmFinal) {
      toast('⚠️ Confirmation Required', { 
        description: 'Please confirm this is the final version for publishing.' 
      });
      return;
    }

    onApprove(asset, confirmFinal);
    setShowApprovalSuccess(true);
    
    setTimeout(() => {
      setShowApprovalSuccess(false);
      onOpenChange(false);
    }, 2000);
  };

  const handleSubmitRevisions = () => {
    if (!asset) return;
    
    if (revisionEntries.length === 0) {
      toast('❌ No Revision Entries', { 
        description: 'Please add at least one revision entry before submitting.' 
      });
      return;
    }

    const revisionData: RevisionRequest = {
      reason: revisionEntries[0].reason, // Keep for compatibility
      notes: revisionEntries.map(entry => 
        `[${entry.reason.toUpperCase()}${entry.videoTime ? ` @ ${entry.videoTime}` : ''}] ${entry.notes}`
      ).join('\n\n'),
      referenceFile: referenceFile || undefined,
      dueDate: dueDate || undefined,
      assignTo: 'editor', // Default assignment
      entries: revisionEntries
    };

    if (userRole === 'qc' && onSendBackToEditor) {
      onSendBackToEditor(asset, revisionData);
    } else {
      onRequestRevisions(asset, revisionData);
    }
    
    setShowRevisionSuccess(true);
    
    setTimeout(() => {
      setShowRevisionSuccess(false);
      setShowRevisions(false);
      onOpenChange(false);
    }, 2000);
  };

  const handleQCApproveToClient = () => {
    if (!asset || !onSendToClient) return;
    
    onSendToClient(asset);
    setShowApprovalSuccess(true);
    
    setTimeout(() => {
      setShowApprovalSuccess(false);
      onOpenChange(false);
    }, 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceFile(file);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current || duration === 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, hoverX / rect.width));
    const newHoverTime = percentage * duration;
    
    setHoverTime(newHoverTime);
  };

  const handleTimelineMouseLeave = () => {
    setHoverTime(null);
  };

  const handleTimelineDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleTimelineClick(e);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || !videoRef.current || duration === 0) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const dragX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, dragX / rect.width));
      const newTime = percentage * duration;
      
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!asset) return null;

  const currentVersionData = asset.versions.find(v => v.id === currentVersion) || asset.versions[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="!fixed !inset-0 !z-50 !w-screen !h-screen !max-w-none !max-h-none !m-0 !p-0 !bg-black/95 !backdrop-blur-sm !overflow-hidden !transform-none !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none !border-none !shadow-none fullscreen-dialog"
      >
        {/* Accessibility: Hidden title and description for screen readers */}
        <div className="sr-only">
          <DialogTitle>
            {asset?.title ? `Review ${asset.title}` : 'Asset Review'}
          </DialogTitle>
          <DialogDescription>
            Review and provide feedback on this video asset. Use the controls to watch the video, then either approve the final version or request revisions with specific notes. The approval section is located in the right panel.
          </DialogDescription>
        </div>
          <div 
            ref={containerRef}
            className="relative w-full h-full flex flex-col bg-black text-white"
          >
          {/* Success States */}
          {showApprovalSuccess && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-green-900 mb-2">
                    {userRole === 'qc' ? 'Sent to Client!' : 'Version Approved!'}
                  </h3>
                  <p className="text-green-700">
                    {userRole === 'qc' 
                      ? 'Asset has been sent to client for review' 
                      : 'Asset has been approved for publishing'
                    }
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {showRevisionSuccess && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-blue-900 mb-2">
                    {userRole === 'qc' ? 'Sent Back to Editor' : 'Revisions Requested'}
                  </h3>
                  <p className="text-blue-700">
                    {userRole === 'qc' ? 'Feedback has been sent to the editor' : 'Feedback has been sent to the team'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Header */}
          <div className="flex-shrink-0 bg-black/80 backdrop-blur-sm border-b border-white/10">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl font-medium">{asset.title}</h1>
                  {asset.subtitle && (
                    <p className="text-sm text-gray-400">{asset.subtitle}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-400">{asset.runtime}</span>
                    <span className="text-gray-600">•</span>
                    <Badge 
                      className={`text-xs ${statusColors[currentVersionData?.status || asset.status]} text-white`}
                    >
                      {statusLabels[currentVersionData?.status || asset.status]}
                    </Badge>
                  </div>
                </div>

                {/* Version Switcher */}
                {asset.versions.length > 1 && (
                  <div className="flex items-center gap-2 ml-8">
                    <span className="text-sm text-gray-400">Version:</span>
                    <Select value={currentVersion} onValueChange={handleVersionChange}>
                      <SelectTrigger className="w-20 bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {asset.versions.map((version) => (
                          <SelectItem key={version.id} value={version.id}>
                            {version.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <Share className="h-4 w-4 mr-2" />
                  Share Link
                </Button>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onOpenChange(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Video Player */}
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="relative w-full max-w-6xl aspect-video bg-black rounded-xl shadow-2xl overflow-hidden">
                {videoError ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
                    <div className="text-center p-8 max-w-2xl">
                      <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
                      <h3 className="text-xl mb-2">Video Failed to Load</h3>
                      <p className="text-sm text-gray-400 mb-4">
                        {videoSource.type === 'iframe' 
                          ? 'The video may be private or require special permissions. Please ensure the Google Drive file sharing settings are set to "Anyone with the link can view".' 
                          : 'Please ensure the video file is accessible and in a supported format.'}
                      </p>
                      <div className="bg-gray-800 p-4 rounded-lg mb-4">
                        <p className="text-xs text-gray-400 mb-2">Original URL:</p>
                        <p className="text-xs text-gray-500 font-mono break-all mb-3">
                          {asset.videoUrl}
                        </p>
                        {videoSource.type === 'iframe' && (
                          <>
                            <p className="text-xs text-gray-400 mb-2">Embed URL:</p>
                            <p className="text-xs text-gray-500 font-mono break-all">
                              {videoSource.src}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setVideoError(false);
                          }}
                        >
                          Retry Loading
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(asset.videoUrl, '_blank')}
                        >
                          Open in New Tab
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : videoSource.type === 'iframe' ? (
                  <div className="relative w-full h-full">
                    {!iframeLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-10">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                          <p className="text-sm text-gray-400">Loading video from Google Drive...</p>
                        </div>
                      </div>
                    )}
                    <iframe
                      ref={iframeRef}
                      className="w-full h-full bg-black"
                      src={videoSource.src}
                      title={`Video player for ${asset.title}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                      onLoad={() => {
                        console.log('✅ Iframe loaded successfully:', videoSource.src);
                        setIframeLoaded(true);
                      }}
                      onError={(e) => {
                        console.error('❌ Video iframe failed to load:', asset.videoUrl);
                        console.error('Attempted embed URL:', videoSource.src);
                        setVideoError(true);
                      }}
                    />
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain bg-black"
                    src={videoSource.src}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onError={(e) => {
                      console.error('Video failed to load:', asset.videoUrl);
                      setVideoError(true);
                    }}
                    playsInline
                  >
                    Your browser does not support the video tag.
                  </video>
                )}

                {/* Video Overlay Controls - Only for direct video files */}
                {videoSource.type === 'video' && (
                  <>
                    <div 
                      className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={togglePlay}
                    >
                      {!isPlaying && (
                        <div className="bg-black/50 rounded-full p-4">
                          <Play className="h-12 w-12 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Interactive Timeline */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="relative">
                    {/* Time tooltip */}
                    {hoverTime !== null && (
                      <div 
                        className="absolute -top-8 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none z-10"
                        style={{ 
                          left: `${(hoverTime / duration) * 100}%`,
                          transform: 'translateX(-50%)'
                        }}
                      >
                        {formatTime(hoverTime)}
                      </div>
                    )}
                    
                    {/* Timeline track */}
                    <div 
                      ref={timelineRef}
                      className="relative bg-white/20 h-2 rounded-full cursor-pointer group"
                      onClick={handleTimelineClick}
                      onMouseMove={handleTimelineMouseMove}
                      onMouseLeave={handleTimelineMouseLeave}
                      onMouseDown={handleTimelineDragStart}
                    >
                      {/* Progress fill */}
                      <div 
                        className="bg-white h-2 rounded-full transition-all duration-150"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />
                      
                      {/* Hover indicator */}
                      {hoverTime !== null && (
                        <div 
                          className="absolute top-0 w-0.5 h-2 bg-white/60"
                          style={{ left: `${(hoverTime / duration) * 100}%` }}
                        />
                      )}
                      
                      {/* Playhead */}
                      <div 
                        className="absolute top-1/2 w-4 h-4 bg-white rounded-full shadow-lg transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-grab active:cursor-grabbing"
                        style={{ 
                          left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                        onMouseDown={handleTimelineDragStart}
                      />
                    </div>
                    
                    {/* Time display */}
                    <div className="flex justify-between text-xs text-white/70 mt-2">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>
                  </>
                )}
                
                {/* Info for iframe videos */}
                {videoSource.type === 'iframe' && !videoError && iframeLoaded && (
                  <div className="absolute bottom-4 left-4 bg-black/80 text-white text-xs px-3 py-2 rounded max-w-sm">
                    <p className="font-medium mb-1">📹 Google Drive Video</p>
                    <p className="opacity-80">Use the built-in player controls to play, pause, and seek.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Rail - Metadata */}
            <div className="w-80 flex-shrink-0 bg-black/60 border-l border-white/10 p-6 overflow-y-auto hidden lg:block">
              <h3 className="font-medium mb-4">Asset Details</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Settings className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-400">Resolution</div>
                    <div>{asset.resolution}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <HardDrive className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-400">File Size</div>
                    <div>{asset.fileSize}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-400">Upload Date</div>
                    <div>{asset.uploadDate}</div>
                  </div>
                </div>
              </div>

              {/* Version History */}
              {asset.versions.length > 1 && (
                <div className="mt-8">
                  <h4 className="font-medium mb-4">Version History</h4>
                  <div className="space-y-3">
                    {asset.versions.map((version) => (
                      <div 
                        key={version.id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                          version.id === currentVersion 
                            ? 'bg-white/10' 
                            : 'hover:bg-white/5'
                        }`}
                        onClick={() => handleVersionChange(version.id)}
                      >
                        <img 
                          src={version.thumbnail} 
                          alt={`Version ${version.number}`}
                          className="w-12 h-8 object-cover rounded"
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">V{version.number}</div>
                          <div className="text-gray-400 text-xs">{version.uploadDate}</div>
                        </div>
                        <Badge 
                          className={`text-xs ${statusColors[version.status]} text-white`}
                        >
                          {statusLabels[version.status]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Actions */}
              {((userRole === 'client' && asset.status === 'client_review') || 
                (userRole === 'qc' && asset.status === 'in_qc')) && 
                !asset.approvalLocked && (
                <div className="mt-8 space-y-4">
                  <h4 className="font-medium mb-4">
                    {userRole === 'qc' ? 'QC Review Actions' : 'Review Actions'}
                  </h4>
                  
                  {/* QC Approval Section */}
                  {userRole === 'qc' && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="space-y-3">
                        <p className="text-sm text-white/80">
                          QC approved - ready for client review
                        </p>
                        
                        <Button 
                          size="sm" 
                          onClick={handleQCApproveToClient}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Send to Client/Schedular
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Client Approval Section */}
                  {userRole === 'client' && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="space-y-3">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="confirm-final-rail"
                            checked={confirmFinal}
                            onCheckedChange={(checked) => setConfirmFinal(checked as boolean)}
                            className="mt-1"
                          />
                          <label
                            htmlFor="confirm-final-rail"
                            className="text-sm text-white cursor-pointer leading-tight"
                          >
                            I confirm this is the final version for publishing
                          </label>
                        </div>
                        
                        <Button 
                          size="sm" 
                          onClick={handleApprove}
                          disabled={!confirmFinal}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve Version
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Request Revisions Section */}
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <Sheet open={showRevisions} onOpenChange={setShowRevisions}>
                      <SheetTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          {userRole === 'qc' ? 'Send Back to Editor' : 'Request Revisions'}
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="sm:max-w-2xl w-full">
                        <div className="h-full flex flex-col">
                          <SheetHeader className="px-6 py-4 border-b">
                            <SheetTitle>
                              {userRole === 'qc' ? 'QC Feedback for Editor' : 'Request Revisions'}
                            </SheetTitle>
                            <p className="text-sm text-muted-foreground">
                              Add revision notes with timestamps. Current video time: {formatTime(currentTime)}
                            </p>
                          </SheetHeader>
                        
                          <div className="flex-1 overflow-y-auto px-6 py-6">
                            <div className="space-y-6">
                              {/* Add New Revision Entry */}
                              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                                <h4 className="font-medium">Add Revision Entry</h4>
                                
                                <div>
                                  <label className="text-sm font-medium mb-2 block">Reason</label>
                                  <Select value={revisionReason} onValueChange={(value: any) => setRevisionReason(value)}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="design">Design</SelectItem>
                                      <SelectItem value="content">Content</SelectItem>
                                      <SelectItem value="timing">Timing</SelectItem>
                                      <SelectItem value="technical">Technical</SelectItem>
                                      <SelectItem value="spelling">Spelling Errors</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <label className="text-sm font-medium mb-2 block">Notes *</label>
                                  <Textarea
                                    placeholder="Add specific notes for this revision..."
                                    value={revisionNotes}
                                    onChange={(e) => setRevisionNotes(e.target.value)}
                                    className="min-h-[100px]"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Current video time ({formatTime(currentTime)}) will be automatically captured
                                  </p>
                                </div>

                                <Button 
                                  onClick={addRevisionEntry}
                                  disabled={!revisionNotes.trim()}
                                  className="w-full"
                                  size="sm"
                                >
                                  Add Revision Entry
                                </Button>
                              </div>

                              {/* Revision Entries List */}
                              {revisionEntries.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="font-medium">Revision Entries ({revisionEntries.length})</h4>
                                  <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {revisionEntries.map((entry, index) => (
                                      <div key={entry.id} className="p-3 bg-background border rounded-lg">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <Badge variant="secondary" className="text-xs">
                                                {entry.reason.toUpperCase()}
                                              </Badge>
                                              {entry.videoTime && (
                                                <Badge variant="outline" className="text-xs">
                                                  @ {entry.videoTime}
                                                </Badge>
                                              )}
                                              <span className="text-xs text-muted-foreground">
                                                {entry.timestamp}
                                              </span>
                                            </div>
                                            <p className="text-sm break-words">{entry.notes}</p>
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeRevisionEntry(entry.id)}
                                            className="flex-shrink-0 h-6 w-6 p-0"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Additional Options */}
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium mb-2 block">Attach Reference (optional)</label>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => fileInputRef.current?.click()}
                                      className="flex-1"
                                    >
                                      <Upload className="h-4 w-4 mr-2" />
                                      {referenceFile ? referenceFile.name : 'Choose file'}
                                    </Button>
                                    {referenceFile && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setReferenceFile(null)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*,.pdf,.doc,.docx"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                  />
                                </div>

                                <div>
                                  <label className="text-sm font-medium mb-2 block">Due Date (optional)</label>
                                  <Input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    placeholder="mm/dd/yyyy"
                                    className="text-center"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Fixed Footer */}
                          <div className="border-t px-6 py-4">
                            <div className="flex gap-3">
                              <Button 
                                variant="outline" 
                                onClick={() => setShowRevisions(false)}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                              <Button 
                                onClick={handleSubmitRevisions}
                                className="flex-1"
                                disabled={revisionEntries.length === 0}
                              >
                                {userRole === 'qc' 
                                  ? `Send Back ${revisionEntries.length} Issue${revisionEntries.length !== 1 ? 's' : ''}`
                                  : `Submit ${revisionEntries.length} Revision${revisionEntries.length !== 1 ? 's' : ''}`
                                }
                              </Button>
                            </div>
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              )}

              {/* Comments Disabled Notice */}
              <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-200">
                  Comments are disabled for this review.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex-shrink-0 bg-black/80 backdrop-blur-sm border-t border-white/10">
            <div className="flex items-center justify-between px-6 py-4">
              {/* Left - Playback Controls */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Speed:</span>
                  <Select value={playbackSpeed.toString()} onValueChange={handlePlaybackSpeedChange}>
                    <SelectTrigger className="w-20 bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">0.5x</SelectItem>
                      <SelectItem value="0.75">0.75x</SelectItem>
                      <SelectItem value="1">1x</SelectItem>
                      <SelectItem value="1.25">1.25x</SelectItem>
                      <SelectItem value="1.5">1.5x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCaptions(!showCaptions)}
                  className={`text-white hover:bg-white/20 ${showCaptions ? 'bg-white/20' : ''}`}
                >
                  Captions
                </Button>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Quality:</span>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger className="w-20 bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="480p">480p</SelectItem>
                      <SelectItem value="720p">720p</SelectItem>
                      <SelectItem value="1080p">1080p</SelectItem>
                      <SelectItem value="4K">4K</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right - Action Buttons */}
              <div className="flex items-center gap-3">
                {onNextAsset && (
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={onNextAsset}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    Next Asset
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          </div>
        </DialogContent>
    </Dialog>
  );
}