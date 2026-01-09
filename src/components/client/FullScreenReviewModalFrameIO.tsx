'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
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
    AlertCircle,
    Rewind,
    FastForward,
    SkipBack,
    SkipForward,
    ArrowLeft,
    Info,
    Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { getVideoSource } from '../workflow/VideoUrlHelper';
import { ReviewCommentCard, CommentInput, ReviewTimeline, StatusDropdown } from '../review';
import { ReviewComment, ReviewStatus, REVIEW_STATUSES } from '../review/types';

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

export function FullScreenReviewModalFrameIO({
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
    // Video state
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [currentVersion, setCurrentVersion] = useState('');
    const [videoError, setVideoError] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Review state
    const [reviewStatus, setReviewStatus] = useState<ReviewStatus['value']>('needs_review');
    const [comments, setComments] = useState<ReviewComment[]>([]);
    const [activeCommentId, setActiveCommentId] = useState<string | undefined>();
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [confirmFinal, setConfirmFinal] = useState(false);

    // UI State
    const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
    const [showRevisionSuccess, setShowRevisionSuccess] = useState(false);
    const [showInfoPanel, setShowInfoPanel] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const commentsRef = useRef<HTMLDivElement>(null);

    // Video source
    const videoSource = asset ? getVideoSource(asset.videoUrl) : { type: 'video' as const, src: '' };

    // Initialize state when asset changes
    useEffect(() => {
        if (asset) {
            setCurrentVersion(asset.currentVersion);
            setIsPlaying(false);
            setCurrentTime(0);
            setConfirmFinal(false);
            setShowApprovalSuccess(false);
            setShowRevisionSuccess(false);
            setVideoError(false);
            setIframeLoaded(false);
            setActiveCommentId(undefined);
            setShowCommentInput(false);

            // Set initial review status based on asset status
            if (asset.status === 'approved') {
                setReviewStatus('approved');
            } else if (asset.status === 'in_qc' || asset.status === 'client_review') {
                setReviewStatus('needs_review');
            } else {
                setReviewStatus('needs_review');
            }

            // Load mock comments for demo
            setComments([
                {
                    id: '1',
                    taskId: asset.id,
                    authorId: 'user1',
                    authorName: 'QC Reviewer',
                    timestamp: '0:15',
                    timestampSeconds: 15,
                    content: 'The transition here feels a bit abrupt. Can we smooth it out?',
                    category: 'timing',
                    resolved: false,
                    createdAt: new Date(Date.now() - 3600000),
                },
                {
                    id: '2',
                    taskId: asset.id,
                    authorId: 'user2',
                    authorName: 'Art Director',
                    timestamp: '0:45',
                    timestampSeconds: 45,
                    content: 'Love the color grading in this section!',
                    category: 'design',
                    resolved: true,
                    createdAt: new Date(Date.now() - 7200000),
                },
            ]);
        }
    }, [asset]);

    // Lock body scroll when modal is open
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
            if (!open || showCommentInput || isDragging) return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'Escape':
                    onOpenChange(false);
                    break;
                case 'j':
                case 'J':
                case 'ArrowLeft':
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
                case 'ArrowRight':
                    e.preventDefault();
                    seekForward();
                    break;
                case 'm':
                case 'M':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'c':
                case 'C':
                    e.preventDefault();
                    setShowCommentInput(true);
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [open, showCommentInput, isDragging]);

    // Video controls
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

    const handleSeek = (time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handlePlaybackSpeedChange = (speed: string) => {
        const newSpeed = parseFloat(speed);
        setPlaybackSpeed(newSpeed);
        if (videoRef.current) {
            videoRef.current.playbackRate = newSpeed;
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Comment handlers
    const handleCommentSubmit = async (comment: Omit<ReviewComment, 'id' | 'createdAt'>) => {
        const newComment: ReviewComment = {
            ...comment,
            id: Date.now().toString(),
            createdAt: new Date(),
        };

        setComments(prev => [...prev, newComment]);
        setShowCommentInput(false);
        toast.success('Comment added');
    };

    const handleCommentResolve = (commentId: string, resolved: boolean) => {
        setComments(prev =>
            prev.map(c => c.id === commentId ? { ...c, resolved } : c)
        );
    };

    const handleCommentDelete = (commentId: string) => {
        setComments(prev => prev.filter(c => c.id !== commentId));
        toast.success('Comment deleted');
    };

    const handleTimestampClick = (timestampSeconds: number) => {
        handleSeek(timestampSeconds);
        const comment = comments.find(c => c.timestampSeconds === timestampSeconds);
        if (comment) {
            setActiveCommentId(comment.id);
        }
    };

    const handleMarkerClick = (comment: ReviewComment) => {
        handleSeek(comment.timestampSeconds);
        setActiveCommentId(comment.id);

        // Scroll to comment in sidebar
        setTimeout(() => {
            const commentEl = document.getElementById(`comment-${comment.id}`);
            if (commentEl && commentsRef.current) {
                commentsRef.current.scrollTo({
                    top: commentEl.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        }, 100);
    };

    // Status change handler
    const handleStatusChange = (newStatus: ReviewStatus['value']) => {
        setReviewStatus(newStatus);

        if (newStatus === 'approved' && asset) {
            if (userRole === 'qc' && onSendToClient) {
                onSendToClient(asset);
                setShowApprovalSuccess(true);
                setTimeout(() => {
                    setShowApprovalSuccess(false);
                    onOpenChange(false);
                }, 2000);
            } else if (userRole === 'client') {
                onApprove(asset, true);
                setShowApprovalSuccess(true);
                setTimeout(() => {
                    setShowApprovalSuccess(false);
                    onOpenChange(false);
                }, 2000);
            }
        } else if (newStatus === 'needs_changes' && asset) {
            // Convert comments to revision request
            const revisionData: RevisionRequest = {
                reason: 'other',
                notes: comments
                    .filter(c => !c.resolved)
                    .map(c => `[${c.category.toUpperCase()} @ ${c.timestamp}] ${c.content}`)
                    .join('\n\n'),
                assignTo: 'editor',
                entries: comments.filter(c => !c.resolved).map(c => ({
                    id: c.id,
                    timestamp: new Date().toLocaleTimeString(),
                    reason: c.category as 'design' | 'content' | 'timing' | 'technical' | 'spelling' | 'other',
                    notes: c.content,
                    videoTime: c.timestamp
                }))
            };

            if (userRole === 'qc' && onSendBackToEditor) {
                onSendBackToEditor(asset, revisionData);
            } else {
                onRequestRevisions(asset, revisionData);
            }

            setShowRevisionSuccess(true);
            setTimeout(() => {
                setShowRevisionSuccess(false);
                onOpenChange(false);
            }, 2000);
        }
    };

    if (!asset) return null;

    const currentVersionData = asset.versions.find(v => v.id === currentVersion) || asset.versions[0];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="!fixed !inset-0 !z-50 !w-screen !h-screen !max-w-none !max-h-none !m-0 !p-0 !overflow-hidden !transform-none !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none !border-none !shadow-none fullscreen-dialog review-modal"
            >
                {/* Accessibility: Hidden title and description for screen readers */}
                <div className="sr-only">
                    <DialogTitle>
                        {asset?.title ? `Review ${asset.title}` : 'Asset Review'}
                    </DialogTitle>
                    <DialogDescription>
                        Review and provide feedback on this video asset using time-coded comments.
                    </DialogDescription>
                </div>

                <div
                    ref={containerRef}
                    className="relative w-full h-full flex flex-col"
                    style={{ background: 'var(--review-bg-primary)' }}
                >
                    {/* Success States */}
                    {showApprovalSuccess && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 review-animate-fade-in">
                            <Card className="bg-green-900/50 border-green-500/50 backdrop-blur-xl">
                                <CardContent className="p-8 text-center">
                                    <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
                                    <h3 className="text-xl font-medium text-green-100 mb-2">
                                        {userRole === 'qc' ? 'Sent to Client!' : 'Version Approved!'}
                                    </h3>
                                    <p className="text-green-300/80">
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
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 review-animate-fade-in">
                            <Card className="bg-orange-900/50 border-orange-500/50 backdrop-blur-xl">
                                <CardContent className="p-8 text-center">
                                    <MessageSquare className="h-16 w-16 text-orange-400 mx-auto mb-4" />
                                    <h3 className="text-xl font-medium text-orange-100 mb-2">
                                        {userRole === 'qc' ? 'Sent Back to Editor' : 'Revisions Requested'}
                                    </h3>
                                    <p className="text-orange-300/80">
                                        {comments.filter(c => !c.resolved).length} comments sent as feedback
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Header */}
                    <div className="flex-shrink-0 review-header px-6 py-3">
                        <div className="flex items-center justify-between">
                            {/* Left: Back + Title */}
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onOpenChange(false)}
                                    className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)]"
                                >
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back
                                </Button>

                                <div className="h-6 w-px bg-[var(--review-border)]" />

                                <div>
                                    <h1 className="text-lg font-medium text-white">{asset.title}</h1>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-sm text-[var(--review-text-muted)]">{asset.runtime}</span>
                                        <span className="text-[var(--review-text-muted)]">•</span>
                                        <span className="text-sm text-[var(--review-text-muted)]">{asset.resolution}</span>
                                        {asset.versions.length > 1 && (
                                            <>
                                                <span className="text-[var(--review-text-muted)]">•</span>
                                                <Select value={currentVersion} onValueChange={setCurrentVersion}>
                                                    <SelectTrigger className="h-6 w-16 bg-transparent border-[var(--review-border)] text-[var(--review-text-secondary)] text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-[var(--review-bg-elevated)] border-[var(--review-border)]">
                                                        {asset.versions.map((v) => (
                                                            <SelectItem key={v.id} value={v.id} className="text-[var(--review-text-secondary)]">
                                                                V{v.number}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Status + Actions */}
                            <div className="flex items-center gap-3">
                                <StatusDropdown
                                    currentStatus={reviewStatus}
                                    onStatusChange={handleStatusChange}
                                    disabled={asset.approvalLocked}
                                />

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowInfoPanel(!showInfoPanel)}
                                    className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)]"
                                >
                                    <Info className="h-4 w-4" />
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)]"
                                >
                                    <Share className="h-4 w-4" />
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onOpenChange(false)}
                                    className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)]"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex overflow-hidden min-h-0">
                        {/* Video Area */}
                        <div className="flex-1 flex flex-col p-6 pr-0">
                            {/* Video Container */}
                            <div className="flex-1 flex items-center justify-center">
                                <div className="relative w-full max-w-5xl aspect-video review-video-container">
                                    {videoError ? (
                                        <div className="w-full h-full flex items-center justify-center bg-[var(--review-bg-tertiary)] text-white">
                                            <div className="text-center p-8 max-w-2xl">
                                                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
                                                <h3 className="text-xl mb-2">Video Failed to Load</h3>
                                                <p className="text-sm text-[var(--review-text-muted)] mb-4">
                                                    Please ensure the video file is accessible and permissions are set correctly.
                                                </p>
                                                <div className="flex gap-2 justify-center">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setVideoError(false)}
                                                        className="bg-[var(--review-bg-elevated)] border-[var(--review-border)] text-white"
                                                    >
                                                        Retry
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => window.open(asset.videoUrl, '_blank')}
                                                        className="bg-[var(--review-bg-elevated)] border-[var(--review-border)] text-white"
                                                    >
                                                        Open in New Tab
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : videoSource.type === 'iframe' ? (
                                        <div className="relative w-full h-full">
                                            {!iframeLoaded && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-[var(--review-bg-secondary)] z-10">
                                                    <div className="text-center">
                                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                                                        <p className="text-sm text-[var(--review-text-muted)]">Loading video...</p>
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
                                                onLoad={() => setIframeLoaded(true)}
                                                onError={() => setVideoError(true)}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <video
                                                ref={videoRef}
                                                className="w-full h-full object-contain bg-black"
                                                src={videoSource.src}
                                                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                                                onPlay={() => setIsPlaying(true)}
                                                onPause={() => setIsPlaying(false)}
                                                onError={() => setVideoError(true)}
                                                playsInline
                                            />

                                            {/* Play/Pause Overlay */}
                                            <div
                                                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                                                onClick={togglePlay}
                                            >
                                                {!isPlaying && (
                                                    <div className="bg-black/50 rounded-full p-6 transition-transform hover:scale-110">
                                                        <Play className="h-12 w-12 text-white fill-white" />
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Timeline + Controls */}
                            <div className="mt-4 px-2">
                                {/* Timeline with markers */}
                                {videoSource.type === 'video' && (
                                    <ReviewTimeline
                                        duration={duration}
                                        currentTime={currentTime}
                                        comments={comments}
                                        activeCommentId={activeCommentId}
                                        onSeek={handleSeek}
                                        onMarkerClick={handleMarkerClick}
                                        onDragStart={() => setIsDragging(true)}
                                        onDragEnd={() => setIsDragging(false)}
                                    />
                                )}

                                {/* Control Bar */}
                                <div className="flex items-center justify-between mt-4">
                                    {/* Left Controls */}
                                    <div className="flex items-center gap-2">
                                        {videoSource.type === 'video' && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={seekBackward}
                                                    className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)]"
                                                >
                                                    <SkipBack className="h-4 w-4" />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={togglePlay}
                                                    className="text-white hover:bg-[var(--review-bg-tertiary)]"
                                                >
                                                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={seekForward}
                                                    className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)]"
                                                >
                                                    <SkipForward className="h-4 w-4" />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={toggleMute}
                                                    className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)]"
                                                >
                                                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                                </Button>

                                                <Select value={playbackSpeed.toString()} onValueChange={handlePlaybackSpeedChange}>
                                                    <SelectTrigger className="w-16 h-8 bg-transparent border-[var(--review-border)] text-[var(--review-text-secondary)] text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-[var(--review-bg-elevated)] border-[var(--review-border)]">
                                                        <SelectItem value="0.5">0.5x</SelectItem>
                                                        <SelectItem value="0.75">0.75x</SelectItem>
                                                        <SelectItem value="1">1x</SelectItem>
                                                        <SelectItem value="1.25">1.25x</SelectItem>
                                                        <SelectItem value="1.5">1.5x</SelectItem>
                                                        <SelectItem value="2">2x</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </>
                                        )}
                                    </div>

                                    {/* Right Controls */}
                                    <div className="flex items-center gap-2">
                                        {onNextAsset && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={onNextAsset}
                                                className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)]"
                                            >
                                                Next Asset
                                                <ChevronRight className="h-4 w-4 ml-1" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Comments Sidebar */}
                        <div className="w-80 flex-shrink-0 review-comments-sidebar flex flex-col">
                            {/* Sidebar Header */}
                            <div className="p-4 border-b border-[var(--review-border)]">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium text-white flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Comments
                                        <Badge className="bg-[var(--review-bg-tertiary)] text-[var(--review-text-secondary)] text-xs">
                                            {comments.length}
                                        </Badge>
                                    </h3>
                                    <Badge
                                        variant="outline"
                                        className="text-xs border-[var(--review-border)] text-[var(--review-text-muted)]"
                                    >
                                        {comments.filter(c => !c.resolved).length} open
                                    </Badge>
                                </div>
                            </div>

                            {/* Comment Input */}
                            <div className="p-3 border-b border-[var(--review-border)]">
                                <CommentInput
                                    taskId={asset.id}
                                    currentTime={currentTime}
                                    currentTimestamp={formatTime(currentTime)}
                                    authorId="current-user"
                                    authorName={userRole === 'qc' ? 'QC Reviewer' : 'You'}
                                    onSubmit={handleCommentSubmit}
                                    onCancel={() => setShowCommentInput(false)}
                                    isExpanded={showCommentInput}
                                    onToggleExpand={() => setShowCommentInput(true)}
                                />
                            </div>

                            {/* Comments List */}
                            <div
                                ref={commentsRef}
                                className="flex-1 overflow-y-auto p-3 review-scrollbar"
                            >
                                {comments.length === 0 ? (
                                    <div className="text-center py-12 text-[var(--review-text-muted)]">
                                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                        <p className="text-sm">No comments yet</p>
                                        <p className="text-xs mt-1">Press C to add a comment</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {comments
                                            .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
                                            .map((comment) => (
                                                <div key={comment.id} id={`comment-${comment.id}`}>
                                                    <ReviewCommentCard
                                                        comment={comment}
                                                        isActive={activeCommentId === comment.id}
                                                        onTimestampClick={handleTimestampClick}
                                                        onResolve={handleCommentResolve}
                                                        onDelete={handleCommentDelete}
                                                    />
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Sidebar Footer - Action Buttons */}
                            <div className="p-4 border-t border-[var(--review-border)] space-y-2">
                                {userRole === 'qc' ? (
                                    <>
                                        <Button
                                            size="sm"
                                            className="w-full bg-[var(--review-status-approved)] hover:bg-[var(--review-status-approved)]/90 text-white"
                                            onClick={() => handleStatusChange('approved')}
                                            disabled={asset.approvalLocked}
                                        >
                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                            Approve & Send to Client
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full bg-transparent border-[var(--review-status-changes)] text-[var(--review-status-changes)] hover:bg-[var(--review-status-changes)]/10"
                                            onClick={() => handleStatusChange('needs_changes')}
                                            disabled={comments.filter(c => !c.resolved).length === 0}
                                        >
                                            <MessageSquare className="h-4 w-4 mr-2" />
                                            Send Back with {comments.filter(c => !c.resolved).length} Comments
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-start gap-2 mb-2">
                                            <Checkbox
                                                id="confirm-final"
                                                checked={confirmFinal}
                                                onCheckedChange={(checked) => setConfirmFinal(checked as boolean)}
                                                className="mt-0.5"
                                            />
                                            <label
                                                htmlFor="confirm-final"
                                                className="text-xs text-[var(--review-text-secondary)] cursor-pointer"
                                            >
                                                I confirm this is the final version for publishing
                                            </label>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="w-full bg-[var(--review-status-approved)] hover:bg-[var(--review-status-approved)]/90 text-white"
                                            onClick={() => handleStatusChange('approved')}
                                            disabled={!confirmFinal || asset.approvalLocked}
                                        >
                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                            Approve Version
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full bg-transparent border-[var(--review-border)] text-[var(--review-text-secondary)] hover:bg-[var(--review-bg-tertiary)]"
                                            onClick={() => handleStatusChange('needs_changes')}
                                            disabled={comments.filter(c => !c.resolved).length === 0}
                                        >
                                            <MessageSquare className="h-4 w-4 mr-2" />
                                            Request Revisions
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Info Panel (slide out) */}
                        {showInfoPanel && (
                            <div className="w-72 flex-shrink-0 bg-[var(--review-bg-secondary)] border-l border-[var(--review-border)] p-4 review-animate-slide-in review-scrollbar overflow-y-auto">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-medium text-white">Asset Details</h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowInfoPanel(false)}
                                        className="h-6 w-6 p-0 text-[var(--review-text-muted)] hover:text-white"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-4 text-sm">
                                    <div>
                                        <div className="text-[var(--review-text-muted)] mb-1">Resolution</div>
                                        <div className="text-white">{asset.resolution}</div>
                                    </div>
                                    <div>
                                        <div className="text-[var(--review-text-muted)] mb-1">File Size</div>
                                        <div className="text-white">{asset.fileSize}</div>
                                    </div>
                                    <div>
                                        <div className="text-[var(--review-text-muted)] mb-1">Platform</div>
                                        <div className="text-white">{asset.platform}</div>
                                    </div>
                                    <div>
                                        <div className="text-[var(--review-text-muted)] mb-1">Uploaded</div>
                                        <div className="text-white">{asset.uploadDate}</div>
                                    </div>
                                    <div>
                                        <div className="text-[var(--review-text-muted)] mb-1">Uploader</div>
                                        <div className="text-white">{asset.uploader}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
