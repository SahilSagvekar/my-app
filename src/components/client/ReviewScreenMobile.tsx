'use client';

import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import {
    X, Download, Share, Play, Pause, Volume2, VolumeX,
    CheckCircle2, MessageSquare, Calendar, AlertCircle,
    SkipBack, SkipForward, ArrowLeft, Copy, Check,
    UserCheck, Plus, Monitor, ChevronDown, ChevronUp,
    RotateCcw, ThumbsUp, ThumbsDown, Send,
} from 'lucide-react';
import { ReviewCommentCard, CommentInput, ReviewTimeline } from '../review';
import { ReviewComment } from '../review/types';
import { ShareDialog } from '../review/ShareDialog';
import { ReviewConnectionIndicator } from './ReviewConnectionIndicator';
import type { ReviewScreenProps } from './ReviewScreenDesktop';

type MobileTab = 'comments' | 'actions' | 'info';

// Keep extra mobile tabs soft-hidden for now so we can restore them easily later.
const MOBILE_VISIBLE_TABS: readonly MobileTab[] = ['comments'];

function isMobileTabVisible(tab: MobileTab) {
    return MOBILE_VISIBLE_TABS.includes(tab);
}

/* ─────────────────────────────────────────────────────────────── */
export function ReviewScreenMobile(p: ReviewScreenProps) {
    const [mobileTab, setMobileTab] = useState<MobileTab>('comments');
    const [controlsExpanded, setControlsExpanded] = useState(false);

    /* ── Reject dialog state ── */
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [submittingReject, setSubmittingReject] = useState(false);

    /* ── Approve dialog state ── */
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);

    /* ── Video aspect ratio detection ── */
    const [videoAspect, setVideoAspect] = useState<'portrait' | 'landscape' | 'unknown'>('unknown');

    const unresolvedCount = p.comments.filter(c => !c.resolved).length;

    const MAX_RENDERED_COMMENTS = 200;
    const [showAllComments, setShowAllComments] = useState(false);
    const activeMobileTab = isMobileTabVisible(mobileTab) ? mobileTab : 'comments';
    const mobileTabs = [
        { key: 'comments' as MobileTab, label: 'Comments', badge: p.comments.length },
        { key: 'actions' as MobileTab, label: 'Actions', badge: null },
        { key: 'info' as MobileTab, label: 'Info', badge: null },
    ].filter(tab => isMobileTabVisible(tab.key));

    const { visibleComments, hasMoreComments } = useMemo(() => {
        if (p.sortedComments.length <= MAX_RENDERED_COMMENTS) {
            return { visibleComments: p.sortedComments, hasMoreComments: false };
        }
        return {
            visibleComments: showAllComments
                ? p.sortedComments
                : p.sortedComments.slice(-MAX_RENDERED_COMMENTS),
            hasMoreComments: !showAllComments,
        };
    }, [p.sortedComments, showAllComments]);

    /* Detect aspect ratio when video metadata loads */
    const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        p.setDuration(e.currentTarget.duration);
        if (e.currentTarget.videoWidth && e.currentTarget.videoHeight) {
            p.setMeasuredResolution(`${e.currentTarget.videoWidth}x${e.currentTarget.videoHeight}`);
            const ratio = e.currentTarget.videoWidth / e.currentTarget.videoHeight;
            setVideoAspect(ratio < 1 ? 'portrait' : 'landscape');
        }
    };

    /* Handle rejection with comment */
    const handleReject = async () => {
        if (!rejectComment.trim()) return;
        setSubmittingReject(true);
        try {
            if (p.handleRejectWithComment) {
                await p.handleRejectWithComment(rejectComment.trim());
            } else {
                // Fallback: add as comment then trigger needs_changes
                await p.handleCommentSubmit({
                    taskId: p.asset.id,
                    authorId: 'current-user',
                    authorName: p.userName,
                    content: rejectComment.trim(),
                    timestamp: '0:00',
                    timestampSeconds: 0,
                    category: 'other',
                    resolved: false,
                    version: 1,
                });
                p.handleStatusChange('needs_changes');
            }
            setShowRejectDialog(false);
            setRejectComment('');
        } finally {
            setSubmittingReject(false);
        }
    };

    /* ── Portrait video height ── */
    // For portrait (short-form): constrain to ~60vh so it stays in screen
    // For landscape: use 16:9 aspect ratio (standard)
    const videoContainerClass =
        videoAspect === 'portrait'
            ? 'w-full flex-shrink-0 bg-black relative flex items-center justify-center border-2 border-white rounded-lg'
            : 'w-full aspect-video flex-shrink-0 bg-black relative border-2 border-white rounded-lg';

    const videoStyle =
        videoAspect === 'portrait'
            ? { maxHeight: '60svh', height: '60svh' }
            : {};

    const innerVideoStyle =
        videoAspect === 'portrait'
            ? { height: '60svh', width: 'auto', maxWidth: '100%', display: 'block', margin: '0 auto' }
            : {};

    return (
        <div
            className="relative w-full h-full flex flex-col overflow-hidden"
            style={{ background: 'var(--review-bg-primary)' }}
        >
            {/* ── Success overlays ── */}
            {p.showApprovalSuccess && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 review-animate-fade-in px-6">
                    <Card className="bg-green-900/50 border-green-500/50 backdrop-blur-xl w-full max-w-xs">
                        <CardContent className="p-6 text-center">
                            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-green-100 mb-1">
                                {p.userRole === 'qc'
                                    ? (p.requiresClientReview ? 'Sent to Client!' : 'Sent to Scheduler!')
                                    : 'Approved!'}
                            </h3>
                            <p className="text-green-300/80 text-sm">
                                {p.userRole === 'qc'
                                    ? (p.requiresClientReview ? 'Asset sent to client for review' : 'Asset sent to scheduler for posting')
                                    : 'Asset approved and sent to scheduler'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}
            {p.showRevisionSuccess && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 review-animate-fade-in px-6">
                    <Card className="bg-orange-900/50 border-orange-500/50 backdrop-blur-xl w-full max-w-xs">
                        <CardContent className="p-6 text-center">
                            <MessageSquare className="h-12 w-12 text-orange-400 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-orange-100 mb-1">
                                {p.userRole === 'qc' ? 'Sent Back to Editor' : 'Revisions Requested'}
                            </h3>
                            <p className="text-orange-300/80 text-sm">Feedback sent successfully</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Reject Dialog (bottom sheet style) ── */}
            {showRejectDialog && (
                <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/70 review-animate-fade-in">
                    <div
                        className="rounded-t-2xl p-5 border-t border-[var(--review-border)] space-y-4"
                        style={{ background: 'var(--review-bg-elevated)' }}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <ThumbsDown className="h-4 w-4 text-red-400" />
                                Request Revisions
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setShowRejectDialog(false); setRejectComment(''); }}
                                className="h-8 w-8 p-0 text-[var(--review-text-muted)] hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-[var(--review-text-muted)]">
                            Describe what needs to be changed. This will be sent to the editor as feedback.
                        </p>
                        <Textarea
                            value={rejectComment}
                            onChange={e => setRejectComment(e.target.value)}
                            placeholder="e.g. The intro music is too loud, please reduce it. Also fix the text at 0:45..."
                            className="min-h-[100px] bg-[var(--review-bg-secondary)] border-[var(--review-border)] text-white placeholder:text-[var(--review-text-muted)] text-sm resize-none focus:ring-1 focus:ring-red-500/50"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 bg-transparent border-[var(--review-border)] text-[var(--review-text-secondary)]"
                                onClick={() => { setShowRejectDialog(false); setRejectComment(''); }}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                onClick={handleReject}
                                disabled={!rejectComment.trim() || submittingReject}
                            >
                                {submittingReject
                                    ? <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/30 border-t-white" />Sending...</>
                                    : <><Send className="h-4 w-4 mr-2" />Send Feedback</>
                                }
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Approve Confirmation (bottom sheet style) ── */}
            {showApproveConfirm && p.userRole === 'client' && (
                <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/70 review-animate-fade-in">
                    <div
                        className="rounded-t-2xl p-5 border-t border-[var(--review-border)] space-y-4"
                        style={{ background: 'var(--review-bg-elevated)' }}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <ThumbsUp className="h-4 w-4 text-green-400" />
                                Approve Video
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowApproveConfirm(false)}
                                className="h-8 w-8 p-0 text-[var(--review-text-muted)] hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div
                            className="rounded-xl p-4 border border-green-500/20"
                            style={{ background: 'var(--review-bg-secondary)' }}
                        >
                            <p className="text-sm text-[var(--review-text-secondary)] leading-relaxed">
                                By approving, you confirm this is the <span className="text-white font-semibold">final version</span> ready for publishing. This action will send the asset to the scheduler.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 bg-transparent border-[var(--review-border)] text-[var(--review-text-secondary)]"
                                onClick={() => setShowApproveConfirm(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => { p.setConfirmFinal(true); p.handleStatusChange('approved'); setShowApproveConfirm(false); }}
                                disabled={p.asset.approvalLocked}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Approve & Send
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TOP HEADER ── */}
            <div
                className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-[var(--review-border)]"
                style={{ background: 'var(--review-bg-secondary)' }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => p.onOpenChange(false)}
                        className="text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0 shrink-0"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate leading-tight">{p.asset.title}</p>
                        {p.currentFileSection && (
                            <p className="text-[10px] text-[var(--review-text-muted)] capitalize leading-tight">
                                {p.currentFileSection.folderType} · v{p.currentFileSection.version}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right icons */}
                <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="sm" onClick={p.handleDownload} className="text-[var(--review-text-muted)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0">
                        <Download className="h-4 w-4" />
                    </Button>
                    {p.userRole === 'client' && (
                        <Button variant="ghost" size="sm" onClick={p.handleGenerateShareLink} disabled={p.generatingLink} className="text-[var(--review-text-muted)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0">
                            {p.generatingLink
                                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                : <Share className="h-4 w-4" />
                            }
                        </Button>
                    )}
                    {/* 🖥 Switch to desktop view */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={p.onSwitchToDesktop}
                        className="text-[var(--review-accent-purple)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0"
                        title="Switch to Desktop View"
                    >
                        <Monitor className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => p.onOpenChange(false)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* <div
                className="flex-shrink-0 border-b border-[var(--review-border)] px-3 py-2"
                style={{ background: 'var(--review-bg-secondary)' }}
            >
                <ReviewConnectionIndicator insight={p.connectionInsight} compact />
            </div> */}

            {/* ── VIDEO ── Smart sizing: portrait = fill height, landscape = 16:9 */}
            <div className={videoContainerClass} style={videoStyle}>
                {p.videoError ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center px-4">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                            <p className="text-white text-sm mb-3">Video failed to load</p>
                            <div className="flex gap-2 justify-center">
                                <Button size="sm" variant="outline" onClick={() => p.setVideoError(false)} className="bg-transparent border-white/20 text-white text-xs h-7">Retry</Button>
                                <Button size="sm" variant="outline" onClick={() => window.open(p.asset.videoUrl, '_blank')} className="bg-transparent border-white/20 text-white text-xs h-7">New Tab</Button>
                            </div>
                        </div>
                    </div>
                ) : p.videoSource.type === 'iframe' ? (
                    <>
                        {!p.iframeLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                            </div>
                        )}
                        <iframe
                            ref={p.iframeRef}
                            className="w-full h-full"
                            src={p.videoSource.src}
                            title={`Video player for ${p.asset.title}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            onLoad={() => p.setIframeLoaded(true)}
                            onError={() => p.setVideoError(true)}
                        />
                    </>
                ) : (
                    <>
                        <video
                            ref={p.videoRef}
                            className={videoAspect === 'portrait' ? 'h-full w-auto object-contain' : 'w-full h-full object-contain'}
                            style={videoAspect === 'portrait' ? { display: 'block', margin: '0 auto' } : {}}
                            src={p.videoSource.src}
                            onTimeUpdate={p.handleTimeUpdate}
                            onLoadedMetadata={handleVideoMetadata}
                            onPlay={() => p.setIsPlaying(true)}
                            onPause={() => p.setIsPlaying(false)}
                            onError={() => p.handleVideoError()}
                            playsInline
                            preload="metadata"
                        />
                        {/* Big play button overlay */}
                        <div className="absolute inset-0 flex items-center justify-center" onClick={p.togglePlay}>
                            {!p.isPlaying && (
                                <div className="bg-black/60 rounded-full p-4 active:scale-90 transition-transform">
                                    <Play className="h-9 w-9 text-white fill-white" />
                                </div>
                            )}
                        </div>
                        {/* Landscape hint for long-form */}
                        {videoAspect === 'landscape' && (
                            <div className="absolute top-2 right-2 z-10 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
                                <RotateCcw className="h-3 w-3" />
                                Rotate for full view
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── TRANSPORT / TIMELINE ── */}
            <div
                className="flex-shrink-0 border-b border-[var(--review-border)]"
                style={{ background: 'var(--review-bg-secondary)' }}
            >
                {p.videoSource.type === 'video' && (
                    <div className="px-3 pt-2 pb-1">
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
                    </div>
                )}

                {/* Controls row */}
                <div className="flex items-center justify-between px-2 pb-1.5">
                    <div className="flex items-center gap-0.5">
                        {p.videoSource.type === 'video' && (
                            <>
                                <Button variant="ghost" size="sm" onClick={p.seekBackward} className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-10 w-10 p-0">
                                    <SkipBack className="h-5 w-5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={p.togglePlay} className="text-white hover:bg-[var(--review-bg-tertiary)] h-11 w-11 p-0">
                                    {p.isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={p.seekForward} className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-10 w-10 p-0">
                                    <SkipForward className="h-5 w-5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={p.toggleMute} className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-10 w-10 p-0">
                                    {p.isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                                </Button>
                                <span className="text-xs text-[var(--review-text-muted)] font-mono ml-0.5">
                                    {p.formatTime(p.currentTime)}<span className="opacity-50"> / {p.formatTime(p.duration)}</span>
                                </span>
                            </>
                        )}
                    </div>
                    {/* Expand/collapse extra controls */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setControlsExpanded(v => !v)}
                        className="text-[var(--review-text-muted)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0"
                    >
                        {controlsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>

                {/* Expandable extra controls */}
                {controlsExpanded && (
                    <div className="px-3 pb-3 flex items-center gap-3 flex-wrap border-t border-[var(--review-border)] pt-2 review-animate-fade-in">
                        {p.asset.versions.length > 1 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--review-text-muted)]">Version</span>
                                <Select value={p.currentVersion} onValueChange={p.handleVersionChange}>
                                    <SelectTrigger className="h-8 w-32 bg-[var(--review-bg-tertiary)] border-[var(--review-border)] text-white text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[var(--review-bg-elevated)] border-[var(--review-border)]">
                                        {p.asset.versions.map((v: any) => (
                                            <SelectItem key={v.id} value={v.id} className="text-[var(--review-text-secondary)] hover:text-white text-xs">v{v.number}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {p.videoSource.type === 'video' && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--review-text-muted)]">Speed</span>
                                <Select value={p.playbackSpeed.toString()} onValueChange={p.handlePlaybackSpeedChange}>
                                    <SelectTrigger className="h-8 w-20 bg-[var(--review-bg-tertiary)] border-[var(--review-border)] text-white text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[var(--review-bg-elevated)] border-[var(--review-border)]">
                                        {['0.5', '0.75', '1', '1.25', '1.5', '2'].map(s => (
                                            <SelectItem key={s} value={s} className="text-[var(--review-text-secondary)] hover:text-white text-xs">{s}×</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── FLOATING ACTION BUTTONS (Approve / Reject) ── */}
            {/* Always visible quick actions bar */}
            <div
                className="flex-shrink-0 flex items-stretch gap-2 px-3 py-2 border-b border-[var(--review-border)]"
                style={{ background: 'var(--review-bg-secondary)' }}
            >
                {/* Quick comment */}
                <button
                    onClick={() => { setMobileTab('comments'); p.setShowCommentInput(true); }}
                    className="flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-xs text-[var(--review-text-muted)] border border-dashed border-[var(--review-border)] hover:border-[var(--review-accent-purple)] hover:text-white transition-all"
                >
                    <Plus className="h-3.5 w-3.5 text-[var(--review-accent-purple)]" />
                    Comment at {p.formatTime(p.currentTime)}
                </button>

                {/* Reject button */}
                <button
                    onClick={() => p.handleStatusChange('needs_changes')}
                    disabled={p.savingFeedback}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    Reject
                </button>

                {/* Approve button */}
                {p.userRole === 'qc' ? (
                    <button
                        onClick={() => p.handleStatusChange('approved')}
                        disabled={p.asset.approvalLocked || p.savingFeedback}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-green-400 border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        Approve
                    </button>
                ) : (
                    <button
                        onClick={() => setShowApproveConfirm(true)}
                        disabled={p.asset.approvalLocked}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-green-400 border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        Approve
                    </button>
                )}
            </div>

            {/* ── TAB BAR ── */}
            <div
                className="flex-shrink-0 flex border-b border-[var(--review-border)]"
                style={{ background: 'var(--review-bg-secondary)' }}
            >
                {mobileTabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setMobileTab(tab.key)}
                        className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border-b-2 ${activeMobileTab === tab.key
                            ? 'text-white border-[var(--review-accent-purple)]'
                            : 'text-[var(--review-text-muted)] border-transparent hover:text-[var(--review-text-secondary)]'
                            }`}
                    >
                        {tab.label}
                        {tab.badge !== null && tab.badge > 0 && (
                            <span className="bg-[var(--review-accent-purple)] text-white text-[9px] font-bold rounded-full min-w-[16px] px-1 py-px text-center leading-none">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── TAB CONTENT (scrollable) ── */}
            <div className="flex-1 overflow-y-auto review-scrollbar min-h-0" style={{ background: 'var(--review-bg-primary)' }}>

                {/* ─── Comments ─── */}
                {activeMobileTab === 'comments' && (
                    <div className="flex flex-col h-full">
                        {/* Comment input */}
                        <div className="p-3 border-b border-[var(--review-border)] shrink-0">
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

                        {/* List */}
                        <div className="flex-1 p-3 space-y-2">
                            {p.comments.length === 0 ? (
                                <div className="text-center py-12 text-[var(--review-text-muted)]">
                                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p className="text-sm">No comments yet</p>
                                    <p className="text-xs mt-1 opacity-60">Tap the button above to add one</p>
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
                                    {visibleComments.map(comment => (
                                        <div key={comment.id} id={`comment-m-${comment.id}`}>
                                            <ReviewCommentCard
                                                comment={comment}
                                                isActive={p.activeCommentId === comment.id}
                                                onTimestampClick={p.handleTimestampClick}
                                                onResolve={p.handleCommentResolve}
                                                onDelete={p.handleCommentDelete}
                                                onEdit={p.handleCommentEdit}
                                            />
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── Actions ─── */}
                {activeMobileTab === 'actions' && (
                    <div className="p-4 space-y-4">

                        {/* Approve Section */}
                        <div className="rounded-2xl border border-green-500/20 overflow-hidden" style={{ background: 'var(--review-bg-secondary)' }}>
                            <div className="px-4 pt-4 pb-3">
                                <p className="text-xs uppercase tracking-wider text-green-400 font-bold mb-1">✅ Approve</p>
                                <p className="text-xs text-[var(--review-text-muted)]">
                                    {p.userRole === 'qc'
                                        ? (p.requiresClientReview ? 'Approve and send to client for review.' : 'Approve and send to scheduler for posting.')
                                        : 'Confirm this is the final version ready for publishing.'}
                                </p>
                            </div>
                            <div className="px-4 pb-4">
                                {p.userRole === 'client' && (
                                    <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--review-border)] mb-3" style={{ background: 'var(--review-bg-tertiary)' }}>
                                        <Checkbox
                                            id="confirm-final-mobile"
                                            checked={p.confirmFinal}
                                            onCheckedChange={v => p.setConfirmFinal(v as boolean)}
                                            className="mt-0.5 shrink-0"
                                        />
                                        <label htmlFor="confirm-final-mobile" className="text-sm text-[var(--review-text-secondary)] cursor-pointer leading-snug">
                                            I confirm this is the final version ready for publishing
                                        </label>
                                    </div>
                                )}
                                <Button
                                    size="lg"
                                    className="w-full bg-green-600 hover:bg-green-700 text-white h-14 text-base rounded-xl font-semibold"
                                    onClick={() => {
                                        if (p.userRole === 'client') {
                                            setShowApproveConfirm(true);
                                        } else {
                                            p.handleStatusChange('approved');
                                        }
                                    }}
                                    disabled={p.asset.approvalLocked || p.savingFeedback || (p.userRole === 'client' && !p.confirmFinal)}
                                >
                                    {p.userRole === 'qc'
                                        ? p.requiresClientReview
                                            ? <><UserCheck className="h-5 w-5 mr-2" />Approve & Send to Client</>
                                            : <><Calendar className="h-5 w-5 mr-2" />Approve & Send to Scheduler</>
                                        : <><CheckCircle2 className="h-5 w-5 mr-2" />Approve & Send to Scheduler</>
                                    }
                                </Button>
                            </div>
                        </div>

                        {/* Reject / Request Revisions Section */}
                        <div className="rounded-2xl border border-red-500/20 overflow-hidden" style={{ background: 'var(--review-bg-secondary)' }}>
                            <div className="px-4 pt-4 pb-3">
                                <p className="text-xs uppercase tracking-wider text-red-400 font-bold mb-1">❌ Request Revisions</p>
                                <p className="text-xs text-[var(--review-text-muted)]">
                                    Describe what changes are needed. Your feedback will be sent to the editor.
                                </p>
                            </div>
                            <div className="px-4 pb-4 space-y-3">
                                {/* Pre-existing timeline comments summary */}
                                {unresolvedCount > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-[var(--review-text-muted)] bg-[var(--review-bg-tertiary)] rounded-lg px-3 py-2 border border-[var(--review-border)]">
                                        <MessageSquare className="h-3.5 w-3.5 text-[var(--review-accent-purple)] shrink-0" />
                                        {unresolvedCount} timeline comment{unresolvedCount === 1 ? '' : 's'} will be included
                                    </div>
                                )}
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="w-full bg-transparent border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-14 text-base rounded-xl font-semibold"
                                    onClick={() => p.handleStatusChange('needs_changes')}
                                    disabled={p.savingFeedback}
                                >
                                    {p.savingFeedback
                                        ? <><div className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</>
                                        : <><ThumbsDown className="h-5 w-5 mr-2" />Reject</>
                                    }
                                </Button>
                                {unresolvedCount > 0 && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full bg-transparent border-orange-500/50 text-orange-400 hover:bg-orange-500/10 h-10 text-sm rounded-xl"
                                        onClick={() => p.handleStatusChange('needs_changes')}
                                        disabled={p.savingFeedback}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Send {unresolvedCount} Timeline Comment{unresolvedCount === 1 ? '' : 's'} as Feedback
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Asset controls */}
                        {(p.asset.versions.length > 1 || p.videoSource.type === 'video') && (
                            <div>
                                <p className="text-xs uppercase tracking-wider text-[var(--review-text-muted)] mb-3 font-semibold">Asset Controls</p>
                                <div className="space-y-3">
                                    {p.asset.versions.length > 1 && (
                                        <div>
                                            <label className="text-xs text-[var(--review-text-muted)] mb-1.5 block">Version</label>
                                            <Select value={p.currentVersion} onValueChange={p.handleVersionChange}>
                                                <SelectTrigger className="w-full h-11 bg-[var(--review-bg-secondary)] border-[var(--review-border)] text-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[var(--review-bg-elevated)] border-[var(--review-border)]">
                                                    {p.asset.versions.map((v: any) => (
                                                        <SelectItem key={v.id} value={v.id} className="text-[var(--review-text-secondary)] hover:text-white">
                                                            Version {v.number} — {v.uploadDate}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {p.videoSource.type === 'video' && (
                                        <div>
                                            <label className="text-xs text-[var(--review-text-muted)] mb-1.5 block">Playback Speed</label>
                                            <Select value={p.playbackSpeed.toString()} onValueChange={p.handlePlaybackSpeedChange}>
                                                <SelectTrigger className="w-full h-11 bg-[var(--review-bg-secondary)] border-[var(--review-border)] text-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[var(--review-bg-elevated)] border-[var(--review-border)]">
                                                    {['0.5', '0.75', '1', '1.25', '1.5', '2'].map(s => (
                                                        <SelectItem key={s} value={s} className="text-[var(--review-text-secondary)] hover:text-white">{s}× {s === '1' ? '(Normal)' : ''}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Info ─── */}
                {activeMobileTab === 'info' && (
                    <div className="p-4 space-y-3">
                        <p className="text-xs uppercase tracking-wider text-[var(--review-text-muted)] font-semibold">Asset Details</p>
                        <div className="grid grid-cols-2 gap-2">
                            {p.currentFileSection && (
                                <>
                                    <div className="bg-[var(--review-bg-secondary)] rounded-xl p-3 border border-[var(--review-border)]">
                                        <div className="text-[9px] text-[var(--review-text-muted)] uppercase tracking-wider mb-1">Section</div>
                                        <div className="text-white text-sm font-semibold capitalize">{p.currentFileSection.folderType}</div>
                                    </div>
                                    <div className="bg-[var(--review-bg-secondary)] rounded-xl p-3 border border-[var(--review-border)]">
                                        <div className="text-[9px] text-[var(--review-text-muted)] uppercase tracking-wider mb-1">Version</div>
                                        <div className="text-white text-sm font-semibold">v{p.currentFileSection.version}</div>
                                    </div>
                                </>
                            )}
                            <div className="bg-[var(--review-bg-secondary)] rounded-xl p-3 border border-[var(--review-border)]">
                                <div className="text-[9px] text-[var(--review-text-muted)] uppercase tracking-wider mb-1">Resolution</div>
                                <div className="text-white text-sm font-semibold">{p.measuredResolution || p.asset.resolution}</div>
                            </div>
                            <div className="bg-[var(--review-bg-secondary)] rounded-xl p-3 border border-[var(--review-border)]">
                                <div className="text-[9px] text-[var(--review-text-muted)] uppercase tracking-wider mb-1">File Size</div>
                                <div className="text-white text-sm font-semibold">{p.asset.fileSize}</div>
                            </div>
                            <div className="bg-[var(--review-bg-secondary)] rounded-xl p-3 border border-[var(--review-border)]">
                                <div className="text-[9px] text-[var(--review-text-muted)] uppercase tracking-wider mb-1">Platform</div>
                                <div className="text-white text-sm font-semibold">{p.asset.platform}</div>
                            </div>
                            <div className="bg-[var(--review-bg-secondary)] rounded-xl p-3 border border-[var(--review-border)]">
                                <div className="text-[9px] text-[var(--review-text-muted)] uppercase tracking-wider mb-1">Uploaded</div>
                                <div className="text-white text-sm font-semibold">{p.asset.uploadDate}</div>
                            </div>
                        </div>

                        <div className="bg-[var(--review-bg-secondary)] rounded-xl p-3 border border-[var(--review-border)]">
                            <div className="text-[9px] text-[var(--review-text-muted)] uppercase tracking-wider mb-1">Uploader</div>
                            <div className="text-white text-sm font-semibold">{p.asset.uploader}</div>
                        </div>

                        {p.shareLink && (
                            <div className="bg-[var(--review-bg-secondary)] rounded-xl p-3 border border-blue-500/30">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Share Link Active</span>
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-blue-400 hover:text-blue-300 text-xs" onClick={p.handleCopyLink}>
                                        {p.linkCopied ? <><Check className="h-3 w-3 mr-1" />Copied!</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
                                    </Button>
                                </div>
                                <p className="text-[10px] font-mono text-blue-300 break-all">{p.shareLink}</p>
                            </div>
                        )}
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
    );
}