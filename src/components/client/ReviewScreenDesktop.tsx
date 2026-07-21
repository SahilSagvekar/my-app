'use client';

import { RefObject, useMemo, useState } from 'react';
import { YoutubePlayer } from '../review/YoutubePlayer';
import type { YoutubePlayerHandle } from '../review/YoutubePlayer';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '../ui/dropdown-menu';
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
    PenLine, ImageIcon,
} from 'lucide-react';import { ReviewCommentCard, CommentInput, ReviewTimeline } from '../review';
import { ReviewComment } from '../review/types';
import { ShareDialog } from '../review/ShareDialog';
// import { ReviewConnectionIndicator, type ReviewConnectionInsight } from './ReviewConnectionIndicator';
import type { ReviewConnectionInsight } from './ReviewConnectionIndicator';

/* ─── Shared prop type ─────────────────────────────────────────── */
export interface ReviewScreenProps {
    /* asset */
    asset: any;
    currentFileSection?: { folderType: string; fileId: string; version: number };
    userRole: 'client' | 'qc';
    requiresClientReview: boolean;
    // 🔥 Multi-item posting content — composed in the review sidebar, batched on approve
    postingTitles: { id: string; text: string }[];
    postingDescriptions: { id: string; text: string }[];
    postingTags: { id: string; text: string }[];
    onPostingTitlesChange: (items: { id: string; text: string }[]) => void;
    onPostingDescriptionsChange: (items: { id: string; text: string }[]) => void;
    onPostingTagsChange: (items: { id: string; text: string }[]) => void;
    // 🔥 Client's template hashtags — selectable chips above the freeform tags box
    templateHashtags?: string[];

    /* video state */
    videoRef: RefObject<HTMLVideoElement | null>;
    iframeRef: RefObject<HTMLIFrameElement | null>;
    youtubePlayerRef: RefObject<YoutubePlayerHandle | null>;
    handleYoutubeReady: () => void;
    containerRef: RefObject<HTMLDivElement | null>;
    commentsRef: RefObject<HTMLDivElement | null>;
    videoSource: { type: 'video' | 'iframe' | 'youtube'; src: string };
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
    allClientComments: ReviewComment[];
    activeCommentId: string | undefined;
    showCommentInput: boolean;
    confirmFinal: boolean;
    savingFeedback: boolean;
    showApprovalSuccess: boolean;
    showRevisionSuccess: boolean;
    currentVersionNumber: number;
    isClientViewer: boolean;

    /* info & share */
    showInfoPanel: boolean;
    shareLink: string;
    generatingLink: boolean;
    linkCopied: boolean;
    showShareDialog: boolean;
    connectionInsight: ReviewConnectionInsight;

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
    onJumpToClientComment: (c: ReviewComment) => void;

    /* review handlers */
    handleCommentSubmit: (c: Omit<ReviewComment, 'id' | 'createdAt'>) => void;
    handleCommentResolve: (id: string, resolved: boolean) => void;
    handleCommentDelete: (id: string) => void;
    handleCommentEdit: (id: string, newContent: string) => void;
    handleStatusChange: (s: 'approved' | 'needs_changes') => void;
    handleRejectWithComment?: (comment: string) => Promise<void>;

    /* ui handlers */
    setShowCommentInput: (v: boolean) => void;
    setConfirmFinal: (v: boolean) => void;
    setShowInfoPanel: (v: boolean) => void;
    setShowShareDialog: (v: boolean) => void;
    setVideoError: (v: boolean) => void;
    handleVideoError: () => void;
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
    onSwitchToThumbnail?: () => void;
}

/* ─────────────────────────────────────────────────────────────── */
export function ReviewScreenDesktop(p: ReviewScreenProps) {
    const MAX_RENDERED_COMMENTS = 200;
    const [showAllComments, setShowAllComments] = useState(false);
    const unresolvedCount = p.sortedComments.filter(c => !c.resolved).length;
    // 🔥 Sidebar tab switcher
    type SidebarTab = 'comments' | 'titles';
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('comments');
    // inline-edit state: which item id is currently being edited, per type
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    // new-item input per list type (titles still uses the add-button list UI)
    const [newTexts, setNewTexts] = useState({ titles: '', descriptions: '', tags: '' });
    // freeform tags textbox — local string so commas/newlines aren't eaten mid-type;
    // parsed into p.postingTags on every change
    const [tagsText, setTagsText] = useState(() => p.postingTags.map(t => t.text).join(', '));

    // caps per type (titles only now — descriptions/tags are freeform boxes)
    const CAPS = { titles: 3, descriptions: 3, tags: 10 };

    const addItem = (type: 'titles'|'descriptions'|'tags') => {
        const text = newTexts[type].trim();
        if (!text) return;
        const cap = CAPS[type];
        const currentList = type === 'titles' ? p.postingTitles : type === 'descriptions' ? p.postingDescriptions : p.postingTags;
        const setCurrentList = type === 'titles' ? p.onPostingTitlesChange : type === 'descriptions' ? p.onPostingDescriptionsChange : p.onPostingTagsChange;
        if (currentList.length >= cap) return;
        setCurrentList([...currentList, { id: `${Date.now()}-${Math.random()}`, text }]);
        setNewTexts({ ...newTexts, [type]: '' });
    };

    const deleteItem = (type: 'titles'|'descriptions'|'tags', id: string) => {
        const currentList = type === 'titles' ? p.postingTitles : type === 'descriptions' ? p.postingDescriptions : p.postingTags;
        const setCurrentList = type === 'titles' ? p.onPostingTitlesChange : type === 'descriptions' ? p.onPostingDescriptionsChange : p.onPostingTagsChange;
        // Floor-of-one: client cannot delete last title
        if (type === 'titles' && p.userRole === 'client' && currentList.length <= 1) return;
        setCurrentList(currentList.filter(i => i.id !== id));
    };

    const startEdit = (id: string, text: string) => {
        setEditingId(id);
        setEditingText(text);
    };

    const commitEdit = (type: 'titles'|'descriptions'|'tags') => {
        if (!editingId) return;
        const currentList = type === 'titles' ? p.postingTitles : type === 'descriptions' ? p.postingDescriptions : p.postingTags;
        const setCurrentList = type === 'titles' ? p.onPostingTitlesChange : type === 'descriptions' ? p.onPostingDescriptionsChange : p.onPostingTagsChange;
        const text = editingText.trim();
        if (!text) { setEditingId(null); return; }
        setCurrentList(currentList.map(i => i.id === editingId ? { ...i, text } : i));
        setEditingId(null);
        setEditingText('');
    };

    // toggle a client template hashtag in/out of the tags list (chip picker)
    const toggleTemplateHashtag = (tag: string) => {
        const isSelected = p.postingTags.some(t => t.text === tag);
        const nextItems = isSelected
            ? p.postingTags.filter(t => t.text !== tag)
            : [...p.postingTags, { id: `${Date.now()}-${Math.random()}`, text: tag }];
        p.onPostingTagsChange(nextItems);
        setTagsText(nextItems.map(t => t.text).join(', '));
    };

    // clear new-item inputs and editing state when tab changes
    const handleTabChange = (tab: SidebarTab) => {
        setSidebarTab(tab);
        setNewTexts({ titles: '', descriptions: '', tags: '' });
        setEditingId(null);
        setEditingText('');
        setTagsText(p.postingTags.map(t => t.text).join(', '));
    };

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
                                    {unresolvedCount} comments sent as feedback
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
                                    <span className="text-sm text-white">
                                        {p.duration > 0 ? p.formatTime(p.duration) : p.asset.runtime}
                                    </span>
                                    <span className="text-white">•</span>
                                    <span className="text-sm text-white">{p.measuredResolution || p.asset.resolution}</span>
                                </div>
                                {/*
                                    Internet speed / recommendation indicator hidden for now.
                                    <ReviewConnectionIndicator insight={p.connectionInsight} />
                                */}
                            </div>
                        </div>

                        {/* Right */}
                        <div className="flex items-center gap-2">
                            {/* 🖼️ Switch to thumbnail review — only shown when the task has thumbnails */}
                            {p.onSwitchToThumbnail && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={p.onSwitchToThumbnail}
                                            className="bg-white hover:bg-white text-black hover:text-black h-8 px-2 gap-1.5"
                                        >
                                            <ImageIcon className="h-4 w-4" />
                                            <span className="text-xs hidden sm:inline">Thumbnails</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">Switch to Thumbnail Review</TooltipContent>
                                </Tooltip>
                            )}

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
                                    <Button variant="ghost" size="sm" onClick={p.handleDownload} className="text-white hover:text-white bg-blue-600 hover:bg-blue-700 h-8 w-8 p-0">
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

                            {/* 💬 All client comments, across every version — only shown if a client has commented */}
                            {p.allClientComments.length > 0 && (
                                <DropdownMenu>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="relative text-white hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0">
                                                    <MessageSquare className="h-4 w-4" />
                                                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                                                        {p.allClientComments.length}
                                                    </span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">Client comments — all versions</TooltipContent>
                                    </Tooltip>
                                    <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto bg-[var(--review-bg-elevated)] border-[var(--review-border)]">
                                        <DropdownMenuLabel className="text-white text-xs">
                                            Client comments — all versions
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator className="bg-[var(--review-border)]" />
                                        {p.allClientComments.map(comment => (
                                            <DropdownMenuItem
                                                key={comment.id}
                                                onClick={() => p.onJumpToClientComment(comment)}
                                                className="flex flex-col items-start gap-0.5 whitespace-normal text-[var(--review-text-secondary)] focus:bg-[var(--review-bg-tertiary)] focus:text-white cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2 w-full">
                                                    <span className="text-xs font-semibold text-white truncate">{comment.authorName}</span>
                                                    <Badge className="bg-[var(--review-bg-tertiary)] text-[10px] px-1.5 py-0 shrink-0">V{comment.version ?? 1}</Badge>
                                                    <span className="text-[10px] text-[var(--review-text-muted)] ml-auto shrink-0">{comment.timestamp}</span>
                                                </div>
                                                <p className="text-xs leading-snug break-words">{comment.content}</p>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={() => p.setShowInfoPanel(!p.showInfoPanel)} className="text-yellow-400 hover:text-yellow-400 hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0">
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Asset info</TooltipContent>
                            </Tooltip>

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

                            <Button variant="ghost" size="sm" onClick={() => p.onOpenChange(false)} className="text-black hover:text-black bg-red-500 hover:bg-red-600 h-8 w-8 p-0">
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
                                            className="w-full h-full bg-black border border-[var(--review-border)] rounded-lg"
                                            src={p.videoSource.src}
                                            title={`Video player for ${p.asset.title}`}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                            onLoad={() => p.setIframeLoaded(true)}
                                            onError={() => p.setVideoError(true)}
                                        />
                                    </div>
                                ) : p.videoSource.type === 'youtube' ? (
                                    <YoutubePlayer
                                        ref={p.youtubePlayerRef}
                                        videoId={p.videoSource.src}
                                        className="w-full h-full bg-black rounded-lg border border-[var(--review-border)] overflow-hidden"
                                        onReady={p.handleYoutubeReady}
                                        onPlay={() => p.setIsPlaying(true)}
                                        onPause={() => p.setIsPlaying(false)}
                                        onEnded={() => p.setIsPlaying(false)}
                                        onError={() => p.handleVideoError()}
                                        onTimeUpdate={p.setCurrentTime}
                                        onDurationChange={p.setDuration}
                                    />
                                ) : (
                                    <>
                                        <video
                                            ref={p.videoRef}
                                            className="w-full h-full object-contain bg-black rounded-lg border border-[var(--review-border)]"
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
                                            onError={() => p.handleVideoError()}
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
                            {(p.videoSource.type === 'video' || p.videoSource.type === 'youtube') && (
                                <ReviewTimeline
                                    duration={p.duration}
                                    currentTime={p.currentTime}
                                    comments={p.comments}
                                    activeCommentId={p.activeCommentId}
                                    currentVersionNumber={p.currentVersionNumber}
                                    onSeek={p.handleSeek}
                                    onMarkerClick={p.handleMarkerClick}
                                    onDragStart={() => p.setIsDragging(true)}
                                    onDragEnd={() => p.setIsDragging(false)}
                                />
                            )}
                            <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-1">
                                    {(p.videoSource.type === 'video' || p.videoSource.type === 'youtube') && (
                                        <>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="sm" onClick={p.seekBackward} className="text-white hover:text-white hover:bg-[var(--review-bg-tertiary)] h-9 w-9 p-0">
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
                                                    <Button variant="ghost" size="sm" onClick={p.seekForward} className="text-white hover:text-white hover:bg-[var(--review-bg-tertiary)] h-9 w-9 p-0">
                                                        <SkipForward className="h-5 w-5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>+10s (L)</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="sm" onClick={p.toggleMute} className="text-white hover:text-white hover:bg-[var(--review-bg-tertiary)] h-9 w-9 p-0">
                                                        {p.isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Mute (M)</TooltipContent>
                                            </Tooltip>
                                            <span className="text-sm text-white font-mono ml-2">
                                                {p.formatTime(p.currentTime)} / {p.formatTime(p.duration)}
                                            </span>
                                            <div className="ml-3">
                                                <Select value={p.playbackSpeed.toString()} onValueChange={p.handlePlaybackSpeedChange}>
                                                    <SelectTrigger className="w-16 h-7 bg-transparent border-[var(--review-border)] text-white text-xs">
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
                        className="w-96 flex-shrink-0 review-comments-sidebar flex flex-col overflow-hidden border-l border-[var(--review-border)]"
                        style={{ background: 'var(--review-bg-secondary)', height: 'calc(100vh - 57px)' }}
                    >
                        {/* ── SIDEBAR HEADER — tab switcher ── */}
                        <div className="p-3 border-b border-[var(--review-border)] flex-shrink-0">
                            <div className="grid grid-cols-2 gap-2">
                                {(['comments', 'titles'] as const).map(tab => {
                                    const isComments = tab === 'comments';
                                    const isActive = sidebarTab === tab;
                                    const colorClasses = isComments
                                        ? `border-blue-500 text-white bg-transparent hover:bg-blue-500 hover:text-white ${isActive ? 'bg-blue-500/20' : ''}`
                                        : `border-orange-500 text-white bg-transparent hover:bg-orange-500 hover:text-white ${isActive ? 'bg-orange-500/20' : ''}`;

                                    return (
                                        <button
                                            key={tab}
                                            onClick={() => handleTabChange(tab)}
                                            className={`text-[11px] font-semibold py-1.5 px-2 rounded-md transition-colors capitalize border ${colorClasses}`}
                                        >
                                            {tab === 'comments' ? 'Comments' : 'Titles'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── COMMENTS TAB ── */}
                        {sidebarTab === 'comments' && (<>
                            <div className="p-3 border-b border-[var(--review-border)] flex-shrink-0">
                                <CommentInput
                                    taskId={p.asset.id}
                                    currentTime={p.currentTime}
                                    currentTimestamp={p.formatTime(p.currentTime)}
                                    authorId="current-user"
                                    authorName={p.userName}
                                    videoRef={p.videoRef}
                                    currentVersionNumber={p.currentVersionNumber}
                                    onSubmit={p.handleCommentSubmit}
                                    onCancel={() => p.setShowCommentInput(false)}
                                    isExpanded={p.showCommentInput}
                                    onToggleExpand={() => p.setShowCommentInput(true)}
                                />
                            </div>
                            <div ref={p.commentsRef} className="flex-1 overflow-y-auto p-3 review-scrollbar min-h-0">
                                {p.sortedComments.length === 0 ? (
                                    <div className="text-center py-12 text-[var(--review-text-muted)]">
                                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                        <p className="text-sm">No comments on V{p.currentVersionNumber}</p>
                                        <p className="text-xs mt-1 opacity-70">
                                            {p.isClientViewer
                                                ? 'Add a comment to leave feedback on this version'
                                                : 'Press C or click "Add comment"'
                                            }
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {hasMoreComments && (
                                            <div className="mb-2 text-[10px] text-[var(--review-text-muted)] text-center">
                                                Showing last {MAX_RENDERED_COMMENTS} of {p.sortedComments.length} comments.&nbsp;
                                                <button className="underline hover:text-[var(--review-text-secondary)]" onClick={() => setShowAllComments(true)}>Show all</button>
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
                                                        onEdit={p.handleCommentEdit}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </>)}

                        {/* ── TITLES / DESCRIPTIONS / TAGS TABS ── */}
                        {sidebarTab === 'titles' && (
                            <div className="flex-1 overflow-y-auto review-scrollbar min-h-0">
                                {(['titles', 'descriptions', 'tags'] as const).map(type => {
                                    const currentList = type === 'titles' ? p.postingTitles : type === 'descriptions' ? p.postingDescriptions : p.postingTags;
                                    const cap = CAPS[type];
                                    const atCap = currentList.length >= cap;
                                    const labels = {
                                        titles: { singular: 'title', placeholder: 'Add a title…' },
                                        descriptions: { singular: 'description', placeholder: 'Add a description…' },
                                        tags: { singular: 'tag', placeholder: 'Add a tag…' },
                                    };
                                    const { singular, placeholder } = labels[type];

                                    // ── DESCRIPTIONS & TAGS: single freeform textbox — no add button, no cap ──
                                    if (type === 'descriptions' || type === 'tags') {
                                        const isTags = type === 'tags';
                                        return (
                                            <div key={type} className="border-b border-[var(--review-border)] last:border-0 pb-4 mb-2 last:mb-0">
                                                <div className="p-3 pb-1 sticky top-0 bg-[var(--review-bg-secondary)] z-10 border-b border-[var(--review-border)]/50">
                                                    <span className="text-xs font-semibold text-white capitalize">{type}</span>
                                                </div>
                                                <div className="px-3 pt-2">
                                                    {isTags && (p.templateHashtags?.length ?? 0) > 0 && (
                                                        <div className="mb-2.5">
                                                            <span className="text-[10px] font-medium text-[var(--review-text-muted)] uppercase tracking-wide">
                                                                Client tags
                                                            </span>
                                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                                {p.templateHashtags!.map(tag => {
                                                                    const selected = p.postingTags.some(t => t.text === tag);
                                                                    return (
                                                                        <button
                                                                            key={tag}
                                                                            type="button"
                                                                            onClick={() => toggleTemplateHashtag(tag)}
                                                                            className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                                                                selected
                                                                                    ? 'bg-[var(--review-status-approved)] border-[var(--review-status-approved)] text-white'
                                                                                    : 'bg-transparent border-[var(--review-border)] text-[var(--review-text-muted)] hover:border-[var(--review-status-approved)]/60 hover:text-white'
                                                                            }`}
                                                                        >
                                                                            {tag}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {isTags ? (
                                                        <Textarea
                                                            value={tagsText}
                                                            onChange={e => {
                                                                const raw = e.target.value;
                                                                setTagsText(raw);
                                                                const items = raw
                                                                    .split(/[,\n]/)
                                                                    .map(t => t.trim())
                                                                    .filter(Boolean)
                                                                    .map(text => ({ id: `${Date.now()}-${Math.random()}`, text }));
                                                                p.onPostingTagsChange(items);
                                                            }}
                                                            placeholder="Add tags, separated by commas…"
                                                            rows={3}
                                                            className="text-xs bg-[var(--review-bg-tertiary)] border-[var(--review-border)] text-white placeholder:text-[var(--review-text-muted)] resize-y"
                                                        />
                                                    ) : (
                                                        <Textarea
                                                            value={p.postingDescriptions[0]?.text ?? ''}
                                                            onChange={e => {
                                                                const text = e.target.value;
                                                                if (!text.trim()) {
                                                                    p.onPostingDescriptionsChange([]);
                                                                } else if (p.postingDescriptions.length === 0) {
                                                                    p.onPostingDescriptionsChange([{ id: `${Date.now()}-${Math.random()}`, text }]);
                                                                } else {
                                                                    p.onPostingDescriptionsChange([{ ...p.postingDescriptions[0], text }]);
                                                                }
                                                            }}
                                                            placeholder={placeholder}
                                                            rows={5}
                                                            className="text-xs bg-[var(--review-bg-tertiary)] border-[var(--review-border)] text-white placeholder:text-[var(--review-text-muted)] resize-y"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={type} className="border-b border-[var(--review-border)] last:border-0 pb-4 mb-2 last:mb-0">
                                            <div className="p-3 pb-1 space-y-2 sticky top-0 bg-[var(--review-bg-secondary)] z-10 border-b border-[var(--review-border)]/50">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-white capitalize">{type}</span>
                                                    <span className={`text-[10px] font-medium ${atCap ? 'text-red-400' : 'text-[var(--review-text-muted)]'}`}>
                                                        {currentList.length}/{cap}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1.5 pb-2">
                                                    <Input
                                                        value={newTexts[type]}
                                                        onChange={e => setNewTexts({ ...newTexts, [type]: e.target.value })}
                                                        placeholder={atCap ? `Max ${cap} ${singular}s reached` : placeholder}
                                                        disabled={atCap}
                                                        className="flex-1 text-xs h-8 bg-[var(--review-bg-tertiary)] border-[var(--review-border)] text-white placeholder:text-[var(--review-text-muted)] disabled:opacity-40"
                                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(type); } }}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        disabled={atCap || !newTexts[type].trim()}
                                                        onClick={() => addItem(type)}
                                                        className="h-8 px-2.5 bg-[var(--review-status-approved)] hover:bg-[var(--review-status-approved)]/90 text-white shrink-0"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="px-3 space-y-2 mt-2">
                                                {currentList.length === 0 ? (
                                                    <div className="text-center py-4 text-[var(--review-text-muted)]">
                                                        <p className="text-xs opacity-70">No {singular}s yet</p>
                                                    </div>
                                                ) : currentList.map(item => (
                                                    <div
                                                        key={item.id}
                                                        className="group rounded-lg border border-[var(--review-border)] bg-[var(--review-bg-tertiary)] p-2.5"
                                                    >
                                                        {editingId === item.id ? (
                                                            <div className="space-y-1.5">
                                                                <Input
                                                                    value={editingText}
                                                                    onChange={e => setEditingText(e.target.value)}
                                                                    className="text-xs h-8 bg-[var(--review-bg-secondary)] border-[var(--review-border)] text-white"
                                                                    autoFocus
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') commitEdit(type);
                                                                        if (e.key === 'Escape') { setEditingId(null); setEditingText(''); }
                                                                    }}
                                                                />
                                                                <div className="flex gap-1">
                                                                    <Button size="sm" onClick={() => commitEdit(type)} className="h-6 px-2 text-[10px] bg-[var(--review-status-approved)] text-white">Save</Button>
                                                                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingText(''); }} className="h-6 px-2 text-[10px] text-[var(--review-text-muted)]">Cancel</Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-start gap-2">
                                                                <p className="flex-1 text-xs text-[var(--review-text-secondary)] leading-relaxed break-words min-w-0">{item.text}</p>
                                                                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => startEdit(item.id, item.text)}
                                                                        className="p-1 rounded hover:bg-white/10 text-[var(--review-text-muted)] hover:text-white transition-colors"
                                                                        title={`Edit ${singular}`}
                                                                    >
                                                                        <PenLine className="h-3 w-3" />
                                                                    </button>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <button
                                                                                onClick={() => deleteItem(type, item.id)}
                                                                                disabled={type === 'titles' && p.userRole === 'client' && currentList.length <= 1}
                                                                                className="p-1 rounded hover:bg-red-500/20 text-[var(--review-text-muted)] hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--review-text-muted)]"
                                                                                title={`Delete ${singular}`}
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </TooltipTrigger>
                                                                        {type === 'titles' && p.userRole === 'client' && currentList.length <= 1 && (
                                                                            <TooltipContent side="left" className="text-xs max-w-[160px]">
                                                                                At least one title must be kept
                                                                            </TooltipContent>
                                                                        )}
                                                                    </Tooltip>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Action footer */}
                        <div className="p-4 pb-6 border-t border-[var(--review-border)] flex flex-col gap-2.5 flex-shrink-0" style={{ background: 'var(--review-bg-secondary)' }}>
                            {p.userRole === 'qc' ? (
                                <>
                                    <Button size="sm" className="w-full bg-[var(--review-status-approved)] hover:bg-[var(--review-status-approved)]/90 text-white h-9 text-xs font-medium" onClick={() => p.handleStatusChange('approved')} disabled={p.asset.approvalLocked || p.savingFeedback || unresolvedCount > 0}>
                                        {p.requiresClientReview
                                            ? <><UserCheck className="h-3.5 w-3.5 mr-2" />Approve</>
                                            : <><Calendar className="h-3.5 w-3.5 mr-2" />Approve</>
                                        }
                                    </Button>
                                    <Button size="sm" className="w-full bg-red-500 hover:bg-red-600 text-white h-9 text-xs font-medium" onClick={() => p.handleStatusChange('needs_changes')} disabled={unresolvedCount === 0 || p.savingFeedback}>
                                        {p.savingFeedback
                                            ? <><div className="h-3.5 w-3.5 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />Saving...</>
                                            : <><MessageSquare className="h-3.5 w-3.5 mr-2 text-white" />Send Back ({unresolvedCount} comments)</>
                                        }
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-start gap-2 mb-1">
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
                                    <Button size="sm" className="w-full bg-[var(--review-status-approved)] hover:bg-[var(--review-status-approved)]/90 text-white h-9 text-xs font-medium" onClick={() => p.handleStatusChange('approved')} disabled={!p.confirmFinal || p.asset.approvalLocked || unresolvedCount > 0}>
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />Approve
                                    </Button>
                                    <Button size="sm" className="w-full bg-red-500 hover:bg-red-600 text-white h-9 text-xs font-medium" onClick={() => p.handleStatusChange('needs_changes')} disabled={p.comments.filter(c => !c.resolved).length === 0}>
                                        <MessageSquare className="h-3.5 w-3.5 mr-2 text-white" />Request Revisions
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