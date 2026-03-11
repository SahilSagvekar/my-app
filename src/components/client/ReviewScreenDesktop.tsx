'use client';

import { RefObject, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../ui/tooltip';
import {
    X, Download, Share, Play, Pause, Volume2, VolumeX,
    CheckCircle2, MessageSquare, Calendar, ChevronRight,
    AlertCircle, SkipBack, SkipForward, ArrowLeft,
    Info, Copy, Check, UserCheck, Plus, Smartphone,
} from 'lucide-react';
import { ReviewCommentCard, CommentInput, ReviewTimeline } from '../review';
import { ReviewComment } from '../review/types';
import { ShareDialog } from '../review/ShareDialog';

/* ─── Shared prop type ─────────────────────────────────────────── */
export interface ReviewScreenProps {
    /* asset */
    asset: any;
    currentFileSection?: { folderType: string; fileId: string; version: number };
    userRole: 'client' | 'qc';
    requiresClientReview: boolean;

    /* video state */
    videoRef: RefObject<HTMLVideoElement | null>;
    iframeRef: RefObject<HTMLIFrameElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    commentsRef: RefObject<HTMLDivElement | null>;
    videoSource: { type: 'video' | 'iframe'; src: string };
    isPlaying: boolean;
    isMuted: boolean;
    currentTime: number;
    duration: number;
    playbackSpeed: number;
    currentVersion: string;
    measuredResolution: string;
    videoError: boolean;
    iframeLoaded: boolean;
    isDragging: boolean;

    /* review state */
    comments: ReviewComment[];
    sortedComments: ReviewComment[];
    activeCommentId: string | undefined;
    showCommentInput: boolean;
    confirmFinal: boolean;
    savingFeedback: boolean;
    showApprovalSuccess: boolean;
    showRevisionSuccess: boolean;

    /* info & share */
    showInfoPanel: boolean;
    shareLink: string;
    generatingLink: boolean;
    linkCopied: boolean;
    showShareDialog: boolean;

    /* user */
    userName: string;

    /* video handlers */
    togglePlay: () => void;
    toggleMute: () => void;
    seekBackward: () => void;
    seekForward: () => void;
    handleSeek: (t: number) => void;
    handleTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
    handlePlaybackSpeedChange: (s: string) => void;
    handleVersionChange: (id: string) => void;
    handleMarkerClick: (c: ReviewComment) => void;
    handleTimestampClick: (ts: number) => void;

    /* review handlers */
    handleCommentSubmit: (c: Omit<ReviewComment, 'id' | 'createdAt'>) => void;
    handleCommentResolve: (id: string, resolved: boolean) => void;
    handleCommentDelete: (id: string) => void;
    handleStatusChange: (s: 'approved' | 'needs_changes') => void;
    handleRejectWithComment?: (comment: string) => Promise<void>;

    /* ui handlers */
    setShowCommentInput: (v: boolean) => void;
    setConfirmFinal: (v: boolean) => void;
    setShowInfoPanel: (v: boolean) => void;
    setShowShareDialog: (v: boolean) => void;
    setVideoError: (v: boolean) => void;
    setIframeLoaded: (v: boolean) => void;
    setIsDragging: (v: boolean) => void;
    setIsPlaying: (v: boolean) => void;
    setDuration: (v: number) => void;
    setMeasuredResolution: (v: string) => void;
    setCurrentTime: (v: number) => void;
    handleDownload: () => void;
    handleGenerateShareLink: () => void;
    handleCopyLink: () => void;
    onOpenChange: (v: boolean) => void;
    onNextAsset?: () => void;
    formatTime: (t: number) => string;

    /* view toggle */
    onSwitchToMobile: () => void;
    onSwitchToDesktop?: () => void;
}

/* ─────────────────────────────────────────────────────────────── */
export function ReviewScreenDesktop(p: ReviewScreenProps) {
    const MAX_RENDERED_COMMENTS = 200;
    const [showAllComments, setShowAllComments] = useState(false);

    const { visibleComments, hasMoreComments } = useMemo(() => {
        if (p.sortedComments.length <= MAX_RENDERED_COMMENTS) {
            return { visibleComments: p.sortedComments, hasMoreComments: false };
        }
        // Show the most recent comments by default
        return {
            visibleComments: showAllComments
                ? p.sortedComments
                : p.sortedComments.slice(-MAX_RENDERED_COMMENTS),
            hasMoreComments: !showAllComments,
        };
    }, [p.sortedComments, showAllComments]);

    return (
        <TooltipProvider delayDuration={300}>
            <div
                ref={p.containerRef}
                className="relative w-full h-full flex flex-col"
                style={{ background: 'var(--review-bg-primary)' }}
            >
                {/* ── Success overlays ── */}
                {p.showApprovalSuccess && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 review-animate-fade-in">
                        <Card className="bg-green-900/50 border-green-500/50 backdrop-blur-xl">
                            <CardContent className="p-8 text-center">
                                <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
                                <h3 className="text-xl font-medium text-green-100 mb-2">
                                    {p.userRole === 'qc'
                                        ? (p.requiresClientReview ? 'Sent to Client!' : 'Sent to Scheduler!')
                                        : 'Sent to Scheduler!'}
                                </h3>
                                <p className="text-green-300/80">
                                    {p.userRole === 'qc'
                                        ? (p.requiresClientReview ? 'Asset has been sent to client for review' : 'Asset has been sent to scheduler for posting')
                                        : 'Asset has been sent to scheduler for posting'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}
                {p.showRevisionSuccess && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 review-animate-fade-in">
                        <Card className="bg-orange-900/50 border-orange-500/50 backdrop-blur-xl">
                            <CardContent className="p-8 text-center">
                                <MessageSquare className="h-16 w-16 text-orange-400 mx-auto mb-4" />
                                <h3 className="text-xl font-medium text-orange-100 mb-2">
                                    {p.userRole === 'qc' ? 'Sent Back to Editor' : 'Revisions Requested'}
                                </h3>
                                <p className="text-orange-300/80">
                                    {p.comments.filter(c => !c.resolved).length} comments sent as feedback
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── HEADER ── */}
                <div className="flex-shrink-0 review-header px-6 py-3">
                    <div className="flex items-center justify-between">
                        {/* Left */}
                        <div className="flex items-center gap-4">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={() => p.onOpenChange(false)} className="text-white hover:text-white hover:bg-[var(--review-bg-tertiary)]">
                                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Go back</TooltipContent>
                            </Tooltip>

                            <div className="h-6 w-px bg-[var(--review-border)]" />

                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-medium text-white">{p.asset.title}</h1>
                                    {/* {p.currentFileSection && (
                                        <Badge className={`${p.asset.status === 'approved' ? 'bg-green-600' : 'bg-purple-600'} text-xs`}>
                                            v{p.currentFileSection.version}
                                        </Badge>
                                    )} */}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-sm text-[var(--review-text-muted)]">
                                        {p.duration > 0 ? p.formatTime(p.duration) : p.asset.runtime}
                                    </span>
                                    <span className="text-[var(--review-text-muted)]">•</span>
                                    <span className="text-sm text-[var(--review-text-muted)]">{p.measuredResolution || p.asset.resolution}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right */}
                        <div className="flex items-center gap-2">
                            {/* Version selector */}
                            {p.asset.versions.length > 1 ? (
                                <Select value={p.currentVersion} onValueChange={p.handleVersionChange}>
                                    <SelectTrigger className="h-8 w-auto min-w-[130px] bg-[var(--review-bg-tertiary)] border-[var(--review-border)] text-white text-xs">
                                        <SelectValue placeholder="Version" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[var(--review-bg-elevated)] border-[var(--review-border)]">
                                        {p.asset.versions.map((v: any) => (
                                            <SelectItem key={v.id} value={v.id} className="text-[var(--review-text-secondary)] hover:text-white text-xs">
                                                Version {v.number} — {v.uploadDate}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Badge className="bg-[var(--review-bg-tertiary)] text-white text-xs px-2 py-1">
                                    v{p.asset.versions[0]?.number || '1'}
                                </Badge>
                            )}

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={() => p.setShowInfoPanel(!p.showInfoPanel)} className="text-white hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0">
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Asset info</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={p.handleDownload} className="text-white hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0">
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Download</TooltipContent>
                            </Tooltip>

                            {p.userRole === 'client' && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" onClick={p.handleGenerateShareLink} disabled={p.generatingLink} className="text-white hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0">
                                            {p.generatingLink
                                                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                : <Share className="h-4 w-4" />
                                            }
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">Share link</TooltipContent>
                                </Tooltip>
                            )}

                            {/* 📱 Switch to mobile view */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={p.onSwitchToMobile}
                                        className="text-[var(--review-text-muted)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0"
                                    >
                                        <Smartphone className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Switch to Mobile View</TooltipContent>
                            </Tooltip>

                            <Button variant="ghost" size="sm" onClick={() => p.onOpenChange(false)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── BODY ── */}
                <div className="flex-1 flex overflow-hidden min-h-0">

                    {/* Video column */}
                    <div className="flex-1 flex flex-col p-4 pr-0 overflow-hidden">
                        {/* Video area */}
                        <div className="flex-1 flex items-center justify-center min-h-0">
                            <div className="relative w-full max-w-5xl aspect-video review-video-container">
                                {p.videoError ? (
                                    <div className="w-full h-full flex items-center justify-center bg-[var(--review-bg-tertiary)] text-white rounded-lg">
                                        <div className="text-center p-8">
                                            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                                            <h3 className="text-lg mb-2">Video Failed to Load</h3>
                                            <div className="flex gap-3 justify-center">
                                                <Button variant="outline" size="sm" onClick={() => p.setVideoError(false)} className="bg-[var(--review-bg-elevated)] border-[var(--review-border)] text-white">Retry</Button>
                                                <Button variant="outline" size="sm" onClick={() => window.open(p.asset.videoUrl, '_blank')} className="bg-[var(--review-bg-elevated)] border-[var(--review-border)] text-white">Open in New Tab</Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : p.videoSource.type === 'iframe' ? (
                                    <div className="relative w-full h-full rounded-lg overflow-hidden">
                                        {!p.iframeLoaded && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-[var(--review-bg-secondary)] z-10">
                                                <div className="text-center">
                                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
                                                    <p className="text-sm text-[var(--review-text-muted)]">Loading video...</p>
                                                </div>
                                            </div>
                                        )}
                                        <iframe
                                            ref={p.iframeRef}
                                            className="w-full h-full bg-black"
                                            src={p.videoSource.src}
                                            title={`Video player for ${p.asset.title}`}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                            onLoad={() => p.setIframeLoaded(true)}
                                            onError={() => p.setVideoError(true)}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <video
                                            ref={p.videoRef}
                                            className="w-full h-full object-contain bg-black rounded-lg"
                                            src={p.videoSource.src}
                                            onTimeUpdate={p.handleTimeUpdate}
                                            onLoadedMetadata={(e) => {
                                                p.setDuration(e.currentTarget.duration);
                                                if (e.currentTarget.videoWidth && e.currentTarget.videoHeight) {
                                                    p.setMeasuredResolution(`${e.currentTarget.videoWidth}x${e.currentTarget.videoHeight}`);
                                                }
                                            }}
                                            onPlay={() => p.setIsPlaying(true)}
                                            onPause={() => p.setIsPlaying(false)}
                                            onError={() => p.setVideoError(true)}
                                            playsInline
                                            preload="metadata"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={p.togglePlay}>
                                            {!p.isPlaying && (
                                                <div className="bg-black/50 rounded-full p-6 transition-transform hover:scale-110">
                                                    <Play className="h-12 w-12 text-white fill-white" />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Timeline + controls */}
                        <div className="flex-shrink-0 px-4 pt-3 pb-2">
                            {p.videoSource.type === 'video' && (
                                <ReviewTimeline
                                    duration={p.duration}
                                    currentTime={p.currentTime}
                                    comments={p.comments}
                                    activeCommentId={p.activeCommentId}
                                    onSeek={p.handleSeek}
                                    onMarkerClick={p.handleMarkerClick}
                                    onDragStart={() => p.setIsDragging(true)}
                                    onDragEnd={() => p.setIsDragging(false)}
                                />
                            )}
                            <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-1">
                                    {p.videoSource.type === 'video' && (
                                        <>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="sm" onClick={p.seekBackward} className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-9 w-9 p-0">
                                                        <SkipBack className="h-5 w-5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>−10s (J)</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="sm" onClick={p.togglePlay} className="text-white hover:bg-[var(--review-bg-tertiary)] h-10 w-10 p-0">
                                                        {p.isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Play/Pause (Space)</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="sm" onClick={p.seekForward} className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-9 w-9 p-0">
                                                        <SkipForward className="h-5 w-5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>+10s (L)</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="sm" onClick={p.toggleMute} className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-9 w-9 p-0">
                                                        {p.isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Mute (M)</TooltipContent>
                                            </Tooltip>
                                            <span className="text-sm text-[var(--review-text-muted)] font-mono ml-2">
                                                {p.formatTime(p.currentTime)} / {p.formatTime(p.duration)}
                                            </span>
                                            <div className="ml-3">
                                                <Select value={p.playbackSpeed.toString()} onValueChange={p.handlePlaybackSpeedChange}>
                                                    <SelectTrigger className="w-16 h-7 bg-transparent border-[var(--review-border)] text-[var(--review-text-secondary)] text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-[var(--review-bg-elevated)] border-[var(--review-border)]">
                                                        {['0.5', '0.75', '1', '1.25', '1.5', '2'].map(s => (
                                                            <SelectItem key={s} value={s}>{s}×</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {p.onNextAsset && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="sm" onClick={p.onNextAsset} className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)] text-sm">
                                                    Next Asset <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Next file</TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── SIDEBAR ── */}
                    <div
                        className="w-80 flex-shrink-0 review-comments-sidebar flex flex-col overflow-hidden border-l border-[var(--review-border)]"
                        style={{ background: 'var(--review-bg-secondary)', height: 'calc(100vh - 57px)' }}
                    >
                        {/* Sidebar header */}
                        <div className="p-4 border-b border-[var(--review-border)] flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium text-white flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Comments
                                    <Badge className="bg-[var(--review-bg-tertiary)] text-[var(--review-text-secondary)] text-xs">
                                        {p.comments.length}
                                    </Badge>
                                </h3>
                                <Badge variant="outline" className="text-xs border-[var(--review-border)] text-[var(--review-text-muted)]">
                                    {p.comments.filter(c => !c.resolved).length} open
                                </Badge>
                            </div>
                        </div>

                        {/* Comment input */}
                        <div className="p-3 border-b border-[var(--review-border)] flex-shrink-0">
                            <CommentInput
                                taskId={p.asset.id}
                                currentTime={p.currentTime}
                                currentTimestamp={p.formatTime(p.currentTime)}
                                authorId="current-user"
                                authorName={p.userName}
                                videoRef={p.videoRef}
                                onSubmit={p.handleCommentSubmit}

                                onCancel={() => p.setShowCommentInput(false)}
                                isExpanded={p.showCommentInput}
                                onToggleExpand={() => p.setShowCommentInput(true)}
                            />
                        </div>

                        {/* Comments list */}
                        <div ref={p.commentsRef} className="flex-1 overflow-y-auto p-3 review-scrollbar min-h-0">
                            {p.comments.length === 0 ? (
                                <div className="text-center py-12 text-[var(--review-text-muted)]">
                                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                    <p className="text-sm">No comments yet</p>
                                    <p className="text-xs mt-1">Press C or click "Add comment"</p>
                                </div>
                            ) : (
                                <>
                                    {hasMoreComments && (
                                        <div className="mb-2 text-[10px] text-[var(--review-text-muted)] text-center">
                                            Showing last {MAX_RENDERED_COMMENTS} of {p.sortedComments.length} comments.&nbsp;
                                            <button
                                                className="underline hover:text-[var(--review-text-secondary)]"
                                                onClick={() => setShowAllComments(true)}
                                            >
                                                Show all
                                            </button>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        {visibleComments.map(comment => (
                                            <div key={comment.id} id={`comment-${comment.id}`}>
                                                <ReviewCommentCard
                                                    comment={comment}
                                                    isActive={p.activeCommentId === comment.id}
                                                    onTimestampClick={p.handleTimestampClick}
                                                    onResolve={p.handleCommentResolve}
                                                    onDelete={p.handleCommentDelete}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Action footer */}
                        <div className="p-4 border-t border-[var(--review-border)] space-y-2 flex-shrink-0" style={{ background: 'var(--review-bg-secondary)' }}>
                            {p.userRole === 'qc' ? (
                                <>
                                    <Button size="sm" className="w-full bg-[var(--review-status-approved)] hover:bg-[var(--review-status-approved)]/90 text-white" onClick={() => p.handleStatusChange('approved')} disabled={p.asset.approvalLocked || p.savingFeedback}>
                                        {p.requiresClientReview
                                            ? <><UserCheck className="h-4 w-4 mr-2" />Approve &amp; Send to Client</>
                                            : <><Calendar className="h-4 w-4 mr-2" />Approve &amp; Send to Scheduler</>
                                        }
                                    </Button>
                                    <Button size="sm" variant="outline" className="w-full bg-transparent border-[var(--review-status-changes)] text-[var(--review-status-changes)] hover:bg-[var(--review-status-changes)]/10" onClick={() => p.handleStatusChange('needs_changes')} disabled={p.comments.filter(c => !c.resolved).length === 0 || p.savingFeedback}>
                                        {p.savingFeedback
                                            ? <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</>
                                            : <><MessageSquare className="h-4 w-4 mr-2" />Send Back ({p.comments.filter(c => !c.resolved).length} comments)</>
                                        }
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-start gap-2 mb-2">
                                        <Checkbox
                                            id="confirm-final-desktop"
                                            checked={p.confirmFinal}
                                            onCheckedChange={v => p.setConfirmFinal(v as boolean)}
                                            className="mt-0.5"
                                        />
                                        <label htmlFor="confirm-final-desktop" className="text-xs text-[var(--review-text-secondary)] cursor-pointer">
                                            I confirm this is the final version for publishing
                                        </label>
                                    </div>
                                    <Button size="sm" className="w-full bg-[var(--review-status-approved)] hover:bg-[var(--review-status-approved)]/90 text-white" onClick={() => p.handleStatusChange('approved')} disabled={!p.confirmFinal || p.asset.approvalLocked}>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />Approve &amp; Send to Scheduler
                                    </Button>
                                    <Button size="sm" variant="outline" className="w-full bg-transparent border-red-500 text-red-500 hover:bg-red-500/10 hover:text-red-400" onClick={() => p.handleStatusChange('needs_changes')} disabled={p.comments.filter(c => !c.resolved).length === 0}>
                                        <MessageSquare className="h-4 w-4 mr-2" />Request Revisions
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── INFO PANEL ── */}
                    {p.showInfoPanel && (
                        <div className="w-64 flex-shrink-0 flex flex-col bg-[var(--review-bg-secondary)] border-l border-[var(--review-border)] p-4 review-animate-slide-in review-scrollbar overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-medium text-white text-sm">Asset Details</h3>
                                <Button variant="ghost" size="sm" onClick={() => p.setShowInfoPanel(false)} className="h-6 w-6 p-0 text-[var(--review-text-muted)] hover:text-white">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="space-y-3 text-sm">
                                {p.currentFileSection && (
                                    <>
                                        <div>
                                            <div className="text-[var(--review-text-muted)] text-xs mb-0.5">Section</div>
                                            <div className="text-white capitalize">{p.currentFileSection.folderType}</div>
                                        </div>
                                        <div>
                                            <div className="text-[var(--review-text-muted)] text-xs mb-0.5">Version</div>
                                            <div className="text-white">v{p.currentFileSection.version}</div>
                                        </div>
                                    </>
                                )}
                                <div><div className="text-[var(--review-text-muted)] text-xs mb-0.5">Resolution</div><div className="text-white">{p.measuredResolution || p.asset.resolution}</div></div>
                                <div><div className="text-[var(--review-text-muted)] text-xs mb-0.5">File Size</div><div className="text-white">{p.asset.fileSize}</div></div>
                                <div><div className="text-[var(--review-text-muted)] text-xs mb-0.5">Platform</div><div className="text-white">{p.asset.platform}</div></div>
                                <div><div className="text-[var(--review-text-muted)] text-xs mb-0.5">Uploaded</div><div className="text-white">{p.asset.uploadDate}</div></div>
                                <div><div className="text-[var(--review-text-muted)] text-xs mb-0.5">Uploader</div><div className="text-white">{p.asset.uploader}</div></div>
                                {p.shareLink && (
                                    <div className="pt-3 mt-3 border-t border-[var(--review-border)]">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[var(--review-text-muted)] text-xs">Share Link</span>
                                            <Button variant="ghost" size="sm" className="h-5 p-1 text-blue-400 hover:text-blue-300" onClick={p.handleCopyLink}>
                                                {p.linkCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                            </Button>
                                        </div>
                                        <div className="bg-[var(--review-bg-tertiary)] p-1.5 rounded text-[10px] break-all font-mono text-blue-300 border border-blue-500/20">
                                            {p.shareLink}
                                        </div>
                                        <Button variant="outline" size="sm" className="w-full mt-2 h-6 text-[10px] bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20" onClick={() => p.setShowShareDialog(true)}>
                                            Manage Share
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Share dialog */}
                <ShareDialog
                    open={p.showShareDialog}
                    onOpenChange={p.setShowShareDialog}
                    shareLink={p.shareLink}
                    onCopy={p.handleCopyLink}
                    copied={p.linkCopied}
                />
            </div>
        </TooltipProvider>
    );
}
