'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { toast } from 'sonner';
import { getVideoSource } from '../workflow/VideoUrlHelper';
import { ReviewComment, ReviewStatus } from '../review/types';
import { useAuth } from '../auth/AuthContext';
import { ReviewScreenDesktop } from './ReviewScreenDesktop';
import { ReviewScreenMobile } from './ReviewScreenMobile';

/* ─── Types ───────────────────────────────────────────────────── */
interface Version {
    id: string;
    number: string;
    thumbnail: string;
    duration: string;
    uploadDate: string;
    status: 'draft' | 'in_qc' | 'client_review' | 'approved';
    url?: string;
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
    taskFeedback?: any[];
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
    currentFileSection?: { folderType: string; fileId: string; version: number };
    taskId?: string;
    requiresClientReview?: boolean;
    shareToken?: string;
}

interface RevisionRequest {
    reason: 'design' | 'content' | 'timing' | 'technical' | 'spelling' | 'other' | 'subtitles';
    notes: string;
    referenceFile?: File;
    dueDate?: string;
    assignTo: 'editor' | 'pm';
    entries: Array<{
        id: string;
        timestamp: string;
        reason: 'design' | 'content' | 'timing' | 'technical' | 'spelling' | 'other' | 'subtitles';
        notes: string;
        videoTime?: string;
    }>;
}

/* ─────────────────────────────────────────────────────────────── */
export function FullScreenReviewModalFrameIO({
    open,
    onOpenChange,
    asset,
    onApprove,
    onRequestRevisions,
    onNextAsset,
    userRole = 'client',
    onSendToClient,
    onSendBackToEditor,
    currentFileSection,
    taskId,
    requiresClientReview = false,
    shareToken,
}: FullScreenReviewModalProps) {
    const { user } = useAuth();

    /* ── View mode: auto-detect on mount, user can toggle ── */
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768 ? 'mobile' : 'desktop';
        }
        return 'desktop';
    });

    /* ── Video state ── */
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [measuredResolution, setMeasuredResolution] = useState('');
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [currentVersion, setCurrentVersion] = useState('');
    const currentVersionNumber = useMemo(() => {
        const v = asset?.versions.find(v => v.id === currentVersion);
        return v ? parseInt(v.number) : 1;
    }, [asset, currentVersion]);
    const [currentVideoUrl, setCurrentVideoUrl] = useState('');
    const [videoError, setVideoError] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    /* ── Review state ── */
    const [comments, setComments] = useState<ReviewComment[]>([]);
    const [activeCommentId, setActiveCommentId] = useState<string | undefined>();
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [confirmFinal, setConfirmFinal] = useState(false);
    const [savingFeedback, setSavingFeedback] = useState(false);

    const sortedComments = useMemo(
        () => [...comments].sort((a, b) => a.timestampSeconds - b.timestampSeconds),
        [comments],
    );

    /* ── UI state ── */
    const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
    const [showRevisionSuccess, setShowRevisionSuccess] = useState(false);
    const [showInfoPanel, setShowInfoPanel] = useState(false);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [shareLink, setShareLink] = useState('');
    const [generatingLink, setGeneratingLink] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    /* ── Refs ── */
    const videoRef = useRef<HTMLVideoElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const commentsRef = useRef<HTMLDivElement>(null);
    const lastTimeUpdateRef = useRef<number>(0);

    /* ── Video source ── */
    const videoSource = useMemo(() => {
        const fileId = currentVersion || asset?.currentVersion;
        if (currentVideoUrl) return getVideoSource(currentVideoUrl, fileId);
        if (asset) return getVideoSource(asset.videoUrl, fileId);
        return { type: 'video' as const, src: '' };
    }, [currentVideoUrl, asset, currentVersion]);

    /* ── Initialise on asset change ── */
    useEffect(() => {
        if (!asset) return;
        setCurrentVersion(asset.currentVersion);
        setCurrentVideoUrl(asset.videoUrl);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setMeasuredResolution('');
        setConfirmFinal(false);
        setShowApprovalSuccess(false);
        setShowRevisionSuccess(false);
        setVideoError(false);
        setIframeLoaded(false);
        setActiveCommentId(undefined);
        setShowCommentInput(false);

        if ((asset as any).taskFeedback) {
            setComments(
                (asset as any).taskFeedback.map((fb: any) => {
                    const ts = fb.timestamp || '0:00';
                    const parts = ts.split(':');
                    const tsSeconds = parts.length === 2 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : 0;
                    return {
                        id: fb.id,
                        taskId: asset.id,
                        authorId: String(fb.user?.id || 0),
                        authorName: fb.user?.name || 'Member',
                        content: fb.feedback,
                        timestamp: ts,
                        timestampSeconds: tsSeconds,
                        category: fb.category || 'other',
                        createdAt: new Date(fb.createdAt),
                        resolved: fb.status === 'resolved',
                        version: fb.file?.version || 1,
                    };
                }),
            );
        } else {
            setComments([]);
        }

        if (user) fetchExistingShareLinks(taskId || asset.id);
    }, [asset, taskId, user]);

    const fetchExistingShareLinks = async (id: string) => {
        try {
            const res = await fetch(`/api/tasks/${id}/share`);
            const data = await res.json();
            if (res.ok && data.links?.length > 0) setShareLink(data.links[0].shareUrl);
        } catch {/* silent */ }
    };

    /* ── Lock scroll ── */
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [open]);

    /* ── Keyboard shortcuts (desktop only) ── */
    useEffect(() => {
        if (viewMode !== 'desktop') return;
        const handler = (e: KeyboardEvent) => {
            if (!open || showCommentInput || isDragging) return;
            switch (e.key) {
                case ' ': e.preventDefault(); togglePlay(); break;
                case 'Escape': onOpenChange(false); break;
                case 'j': case 'J': case 'ArrowLeft': e.preventDefault(); seekBackward(); break;
                case 'k': case 'K': e.preventDefault(); togglePlay(); break;
                case 'l': case 'L': case 'ArrowRight': e.preventDefault(); seekForward(); break;
                case 'm': case 'M': e.preventDefault(); toggleMute(); break;
                case 'c': case 'C': e.preventDefault(); setShowCommentInput(true); break;
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, showCommentInput, isDragging, viewMode]);

    /* ── Video controls ── */
    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        isPlaying ? videoRef.current.pause() : videoRef.current.play();
        setIsPlaying(!isPlaying);
    }, [isPlaying]);

    const toggleMute = useCallback(() => {
        if (!videoRef.current) return;
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    }, [isMuted]);

    const seekBackward = useCallback(() => {
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, currentTime - 10);
    }, [currentTime]);

    const seekForward = useCallback(() => {
        if (videoRef.current) videoRef.current.currentTime = Math.min(duration, currentTime + 10);
    }, [duration, currentTime]);

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const time = e.currentTarget.currentTime;
        if (Math.abs(time - lastTimeUpdateRef.current) >= 0.15 || time === 0 || time === duration) {
            setCurrentTime(time);
            lastTimeUpdateRef.current = time;
        }
    };

    const handleSeek = useCallback((time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
            lastTimeUpdateRef.current = time;
        }
    }, []);

    const handlePlaybackSpeedChange = (speed: string) => {
        const s = parseFloat(speed);
        setPlaybackSpeed(s);
        if (videoRef.current) videoRef.current.playbackRate = s;
    };

    const handleVersionChange = (versionId: string) => {
        if (!asset) return;
        const ver = asset.versions.find(v => v.id === versionId);
        if (ver?.url) {
            setCurrentVersion(versionId);
            setCurrentVideoUrl(ver.url);
            setIsPlaying(false);
            setCurrentTime(0);
            setVideoError(false);
            setIframeLoaded(false);
        }
    };

    const formatTime = (time: number) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    /* ── Comment handlers ── */
    const handleCommentSubmit = async (comment: Omit<ReviewComment, 'id' | 'createdAt'>) => {
        const newComment: ReviewComment = { ...comment, id: Date.now().toString(), createdAt: new Date(), version: currentVersionNumber };
        setComments(prev => [...prev, newComment]);
        setShowCommentInput(false);
        toast.success('Comment added');
    };

    const handleCommentResolve = useCallback((id: string, resolved: boolean) => {
        setComments(prev => prev.map(c => c.id === id ? { ...c, resolved } : c));
    }, []);

    const handleCommentDelete = useCallback((id: string) => {
        setComments(prev => prev.filter(c => c.id !== id));
        toast.success('Comment deleted');
    }, []);

    const handleTimestampClick = useCallback((ts: number) => {
        handleSeek(ts);
        const c = comments.find(c => c.timestampSeconds === ts);
        if (c) setActiveCommentId(c.id);
    }, [comments, handleSeek]);

    const handleMarkerClick = useCallback((comment: ReviewComment) => {
        handleSeek(comment.timestampSeconds);
        setActiveCommentId(comment.id);
        setTimeout(() => {
            const el = document.getElementById(`comment-${comment.id}`);
            if (el && commentsRef.current) commentsRef.current.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' });
        }, 100);
    }, [handleSeek]);

    /* ── Save feedback ── */
    const saveFeedbackToDatabase = async (feedbackComments: ReviewComment[]) => {
        const id = taskId || asset?.id;
        if (!id) return false;
        if (!user?.id && !shareToken) return false;
        try {
            setSavingFeedback(true);
            const items = feedbackComments
                .filter(c => !c.resolved)
                .map(c => {
                    const ver = asset?.versions.find(v => parseInt(v.number) === (c.version || currentVersionNumber));
                    return {
                        folderType: currentFileSection?.folderType || 'main',
                        fileId: ver?.id || currentFileSection?.fileId || null,
                        feedback: c.content,
                        timestamp: c.timestamp,
                        category: c.category,
                    };
                });
            const res = await fetch(`/api/tasks/${id}/feedback`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedbackItems: items, createdBy: user?.id || 0, shareToken }),
            });
            if (!res.ok) throw new Error('Failed to save feedback');
            return true;
        } catch {
            toast.error('Failed to save feedback');
            return false;
        } finally {
            setSavingFeedback(false);
        }
    };

    /* ── Status change ── */
    const handleStatusChange = async (status: ReviewStatus['value']) => {
        if (!asset) return;
        if (status === 'approved') {
            if (userRole === 'qc' && onSendToClient) onSendToClient(asset);
            else onApprove(asset, true);
            setShowApprovalSuccess(true);
            setTimeout(() => { setShowApprovalSuccess(false); onOpenChange(false); }, 2000);
        } else if (status === 'needs_changes') {
            const saved = await saveFeedbackToDatabase(comments);
            if (!saved) { toast.error('Failed to save feedback. Please try again.'); return; }
            const label = currentFileSection?.folderType?.toUpperCase() || 'MAIN';
            const ver = currentFileSection?.version || 1;
            const revisionData: RevisionRequest = {
                reason: 'other',
                notes: comments.filter(c => !c.resolved).map(c => `[${label} v${ver} @ ${c.timestamp}] ${c.content}`).join('\n\n'),
                assignTo: 'editor',
                entries: comments.filter(c => !c.resolved).map(c => ({
                    id: c.id,
                    timestamp: new Date().toLocaleTimeString(),
                    reason: c.category as any,
                    notes: c.content,
                    videoTime: c.timestamp,
                })),
            };
            if (userRole === 'qc' && onSendBackToEditor) onSendBackToEditor(asset, revisionData);
            else onRequestRevisions(asset, revisionData);
            setShowRevisionSuccess(true);
            setTimeout(() => { setShowRevisionSuccess(false); onOpenChange(false); }, 2000);
        }
    };

    /* ── Reject with typed comment (mobile reject dialog) ── */
    const handleRejectWithComment = async (commentText: string) => {
        if (!asset) return;
        const id = taskId || asset.id;
        const label = currentFileSection?.folderType?.toUpperCase() || 'MAIN';
        const ver = currentFileSection?.version || 1;

        // Build a single feedback item from the typed comment
        const feedbackItem = {
            folderType: currentFileSection?.folderType || 'main',
            fileId: currentFileSection?.fileId || null,
            feedback: commentText.trim(),
            timestamp: '0:00',
            category: 'other',
        };

        try {
            setSavingFeedback(true);
            if (user?.id || shareToken) {
                const res = await fetch(`/api/tasks/${id}/feedback`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ feedbackItems: [feedbackItem], createdBy: user?.id || 0, shareToken }),
                });
                if (!res.ok) throw new Error('Failed to save feedback');
            }
            // Also save existing unresolved comments
            if (comments.filter(c => !c.resolved).length > 0) {
                await saveFeedbackToDatabase(comments);
            }

            const revisionData: RevisionRequest = {
                reason: 'other',
                notes: `[${label} v${ver}] ${commentText.trim()}`,
                assignTo: 'editor',
                entries: [{
                    id: Date.now().toString(),
                    timestamp: new Date().toLocaleTimeString(),
                    reason: 'other',
                    notes: commentText.trim(),
                    videoTime: '0:00',
                }],
            };
            if (userRole === 'qc' && onSendBackToEditor) onSendBackToEditor(asset, revisionData);
            else onRequestRevisions(asset, revisionData);
            setShowRevisionSuccess(true);
            setTimeout(() => { setShowRevisionSuccess(false); onOpenChange(false); }, 2000);
        } catch {
            toast.error('Failed to send feedback. Please try again.');
        } finally {
            setSavingFeedback(false);
        }
    };

    /* ── Share ── */
    const handleGenerateShareLink = async () => {
        const id = taskId || asset?.id;
        if (!id) { toast.error('Unable to generate share link'); return; }
        try {
            setGeneratingLink(true);
            setLinkCopied(false);
            const res = await fetch(`/api/tasks/${id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expiresInDays: 0 }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate share link');
            setShareLink(data.shareUrl);
            setShowShareDialog(true);
            setShowInfoPanel(true);
            try {
                await navigator.clipboard.writeText(data.shareUrl);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 3000);
                toast.success('Share link generated and copied!');
            } catch {
                toast.success('Share link generated!');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to generate share link');
        } finally {
            setGeneratingLink(false);
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareLink);
            setLinkCopied(true);
            toast.success('Link copied!');
            setTimeout(() => setLinkCopied(false), 3000);
        } catch {
            toast.error('Failed to copy link');
        }
    };

    const handleDownload = async () => {
        if (!asset) return;
        try {
            toast.loading('Preparing download...', { id: 'dl' });
            const res = await fetch(asset.videoUrl);
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${asset.title.replace(/\s+/g, '_')}_V${asset.currentVersion}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('Download complete', { id: 'dl' });
        } catch {
            toast.error('Failed to download video', { id: 'dl' });
        }
    };

    /* ── Guard ── */
    if (!asset) return null;

    /* ── Shared props object ── */
    const screenProps = {
        asset,
        currentFileSection,
        userRole,
        requiresClientReview,
        videoRef,
        iframeRef,
        containerRef,
        commentsRef,
        videoSource,
        isPlaying,
        isMuted,
        currentTime,
        duration,
        playbackSpeed,
        currentVersion,
        measuredResolution,
        videoError,
        iframeLoaded,
        isDragging,
        comments,
        sortedComments,
        activeCommentId,
        showCommentInput,
        confirmFinal,
        savingFeedback,
        showApprovalSuccess,
        showRevisionSuccess,
        showInfoPanel,
        shareLink,
        generatingLink,
        linkCopied,
        showShareDialog,
        userName: user?.name || 'You',
        togglePlay,
        toggleMute,
        seekBackward,
        seekForward,
        handleSeek,
        handleTimeUpdate,
        handlePlaybackSpeedChange,
        handleVersionChange,
        handleMarkerClick,
        handleTimestampClick,
        handleCommentSubmit,
        handleCommentResolve,
        handleCommentDelete,
        handleStatusChange,
        setShowCommentInput,
        setConfirmFinal,
        setShowInfoPanel,
        setShowShareDialog,
        setVideoError,
        setIframeLoaded,
        setIsDragging,
        setIsPlaying,
        setDuration,
        setMeasuredResolution,
        setCurrentTime,
        handleDownload,
        handleGenerateShareLink,
        handleCopyLink,
        onOpenChange,
        onNextAsset,
        formatTime,
        onSwitchToMobile: () => setViewMode('mobile'),
        onSwitchToDesktop: () => setViewMode('desktop'),
        handleRejectWithComment,
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!fixed !inset-0 !z-50 !w-screen !h-screen !max-w-none !max-h-none !m-0 !p-0 !overflow-hidden !transform-none !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none !border-none !shadow-none fullscreen-dialog review-modal">
                {/* Accessibility */}
                <div className="sr-only">
                    <DialogTitle>{asset.title ? `Review ${asset.title}` : 'Asset Review'}</DialogTitle>
                    <DialogDescription>Review and provide feedback on this video asset using time-coded comments.</DialogDescription>
                </div>

                {viewMode === 'desktop' ? (
                    <ReviewScreenDesktop {...screenProps} />
                ) : (
                    <ReviewScreenMobile {...screenProps} />
                )}
            </DialogContent>
        </Dialog>
    );
}
