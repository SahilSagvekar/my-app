'use client';

import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { YoutubePlayer } from '../review/YoutubePlayer';
import type { YoutubePlayerHandle } from '../review/YoutubePlayer';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Slider } from '../ui/slider';
import { E8Logo } from '../ui/E8Logo';
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
    X, Download, Share, Play,
    CheckCircle2, MessageSquare, ChevronRight, ChevronDown,
    AlertCircle, ArrowLeft,
    Info, Copy, Check, Plus, Smartphone,
    PenLine, ImageIcon, Maximize, Minimize, Send, CheckSquare,
    Volume2, VolumeX,
} from 'lucide-react';
import {
    ReviewCommentCard,
    CommentInput,
    ReviewCompactTransport,
    ReviewPlaybackControls,
    ReviewModePills,
    ReviewDrawOverlay,
    ReviewInstagramOverlay,
    captureFullFrameFromSource,
} from '../review';
import type { CommentInputHandle, ReviewMode } from '../review';
import { ReviewComment } from '../review/types';
import { ShareDialog } from '../review/ShareDialog';
import type { ReviewConnectionInsight } from './ReviewConnectionIndicator';
import { useHideFeedbackWidgetWhileOpen } from '@/hooks/useFeedbackWidgetVisibility';

function resolveFileCode(folderType?: string | null, deliverableType?: string | null): string {
    const raw = (folderType || deliverableType || '').trim();
    if (!raw) return 'MAIN';
    const n = raw.toLowerCase().replace(/[_\s-]+/g, '');
    if (n === 'sf' || n.includes('shortform')) return 'SF';
    if (n === 'lf' || n.includes('longform')) return 'LF';
    if (n === 'sqf' || n.includes('square')) return 'SQF';
    if (n.includes('thumb')) return 'THUMB';
    if (n.includes('tile')) return 'TILE';
    if (n.includes('cover')) return 'COVER';
    if (n.includes('music') || n.includes('license')) return 'LIC';
    if (n === 'main' || n === 'mainfile') return 'MAIN';
    return raw.slice(0, 6).toUpperCase();
}

export interface ReviewScreenProps {
    asset: any;
    readOnly?: boolean;
    currentFileSection?: { folderType: string; fileId: string; version: number };
    userRole: 'client' | 'qc';
    requiresClientReview: boolean;
    forceClientReviewOverride?: boolean;
    onForceClientReviewOverrideChange?: (value: boolean) => void;
    postingTitles: { id: string; text: string }[];
    postingDescriptions: { id: string; text: string }[];
    postingTags: { id: string; text: string }[];
    onPostingTitlesChange: (items: { id: string; text: string }[]) => void;
    onPostingDescriptionsChange: (items: { id: string; text: string }[]) => void;
    onPostingTagsChange: (items: { id: string; text: string }[]) => void;
    templateHashtags?: string[];

    videoRef: RefObject<HTMLVideoElement | null>;
    iframeRef: RefObject<HTMLIFrameElement | null>;
    youtubePlayerRef: RefObject<YoutubePlayerHandle | null>;
    handleYoutubeReady: () => void;
    containerRef: RefObject<HTMLDivElement | null>;
    commentsRef: RefObject<HTMLDivElement | null>;
    videoSource: { type: 'video' | 'iframe' | 'youtube'; src: string };
    isPlaying: boolean;
    isMuted: boolean;
    volume: number;
    currentTime: number;
    duration: number;
    playbackSpeed: number;
    currentVersion: string;
    measuredResolution: string;
    videoError: boolean;
    iframeLoaded: boolean;
    // True while the native <video> has no playable data yet (initial load,
    // or waiting for frames after play/seek) — shows a loading spinner.
    isVideoLoading?: boolean;
    isDragging: boolean;

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

    showInfoPanel: boolean;
    shareLink: string;
    generatingLink: boolean;
    linkCopied: boolean;
    showShareDialog: boolean;
    connectionInsight: ReviewConnectionInsight;

    userName: string;

    togglePlay: () => void;
    toggleMute: () => void;
    onVolumeChange: (volume: number) => void;
    seekBackward: () => void;
    seekForward: () => void;
    handleSeek: (t: number) => void;
    handleTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
    handlePlaybackSpeedChange: (s: string) => void;
    handleVersionChange: (id: string) => void;
    handleMarkerClick: (c: ReviewComment) => void;
    handleTimestampClick: (ts: number) => void;
    onJumpToClientComment: (c: ReviewComment) => void;

    handleCommentSubmit: (c: Omit<ReviewComment, 'id' | 'createdAt'>) => void;
    handleCommentResolve: (id: string, resolved: boolean) => void;
    handleCommentDelete: (id: string) => void;
    handleCommentEdit: (id: string, newContent: string) => void;
    handleStatusChange: (s: 'approved' | 'needs_changes', opts?: { sendToClient?: boolean }) => void;
    handleRejectWithComment?: (comment: string) => Promise<void>;

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

    onSwitchToMobile: () => void;
    onSwitchToDesktop?: () => void;
    onSwitchToThumbnail?: () => void;
}

export function ReviewScreenDesktop(p: ReviewScreenProps) {
    useHideFeedbackWidgetWhileOpen(true);
    const MAX_RENDERED_COMMENTS = 200;
    const [showAllComments, setShowAllComments] = useState(false);
    const unresolvedCount = p.sortedComments.filter(c => !c.resolved).length;
    const commentInputRef = useRef<CommentInputHandle>(null);
    const [activeMode, setActiveMode] = useState<ReviewMode | null>(null);
    const [drawBaseUrl, setDrawBaseUrl] = useState<string | null>(null);
    const [showInstagramOverlay, setShowInstagramOverlay] = useState(false);
    const [showGridOverlay, setShowGridOverlay] = useState(false);
    const videoShellRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [rangeMode, setRangeMode] = useState(false);
    const [activeRange, setActiveRange] = useState<{ start: number; end: number } | null>(null);

    const handleRangeChange = useCallback((start: number, end: number) => {
        setActiveRange({ start, end });
        commentInputRef.current?.setRangeSeconds(start, end);
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Scopes the v2 neutral palette (see globals.css) to this screen only.
    // Applied on <body> — not a local wrapper class — because Radix
    // dropdown/select portals render into document.body and would
    // otherwise miss a wrapper-scoped CSS variable override.
    useEffect(() => {
        document.body.classList.add('e8-review-shell');
        return () => document.body.classList.remove('e8-review-shell');
    }, []);

    // Escape also exits fullscreen — matches the design's Escape-to-close.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && document.fullscreenElement) {
                document.exitFullscreen?.().catch(() => {});
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            videoShellRef.current?.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    }, []);
    type SidebarTab = 'comments' | 'titles' | 'thumbnails';
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('comments');

    const fileCode = useMemo(
        () => resolveFileCode(
            p.currentFileSection?.folderType,
            typeof (p.asset as { deliverableType?: string; taskType?: string })?.deliverableType === 'string'
                ? (p.asset as { deliverableType?: string }).deliverableType
                : (p.asset as { taskType?: string })?.taskType
        ),
        [p.currentFileSection?.folderType, p.asset]
    );

    const isShortFormTask = fileCode === 'SF' || /(^|[_\s-])SF(\d|[_\s-]|$)/i.test(p.asset?.title || '');

    useEffect(() => {
        if (!isShortFormTask) {
            setShowInstagramOverlay(false);
            setShowGridOverlay(false);
        }
    }, [isShortFormTask]);

    const exitDrawMode = useCallback(() => {
        setDrawBaseUrl(null);
        setActiveMode(prev => (prev === 'draw' ? null : prev));
    }, []);

    const handleModeSelect = useCallback((mode: ReviewMode) => {
        if (mode === 'instagram') {
            if (!isShortFormTask) return;
            setShowInstagramOverlay(v => {
                const next = !v;
                if (next) setShowGridOverlay(false);
                return next;
            });
            return;
        }
        if (mode === 'grid') {
            if (!isShortFormTask) return;
            setShowGridOverlay(v => {
                const next = !v;
                if (next) setShowInstagramOverlay(false);
                return next;
            });
            return;
        }

        if (mode !== 'range') {
            setRangeMode(false);
            setActiveRange(null);
        }

        setSidebarTab('comments');

        if (mode === 'draw') {
            if (p.isPlaying) p.togglePlay();
            const source = p.videoRef.current;
            // videoRef is only attached to the native <video> element — it's
            // null for youtube-sourced videos (YoutubePlayer renders an
            // iframe instead), which can't be captured to canvas anyway.
            // The Draw pill is already hidden for those (showDraw prop
            // below), this is just the defensive fallback.
            if (!source) {
                setActiveMode('comment');
                p.setShowCommentInput(true);
                commentInputRef.current?.openComment();
                return;
            }
            window.requestAnimationFrame(() => {
                const dataUrl = captureFullFrameFromSource(source);
                if (dataUrl) {
                    setActiveMode('draw');
                    setDrawBaseUrl(dataUrl);
                } else {
                    setActiveMode('comment');
                    p.setShowCommentInput(true);
                    commentInputRef.current?.openComment();
                }
            });
            return;
        }

        if (drawBaseUrl) setDrawBaseUrl(null);

        if (mode === 'range') {
            if (activeMode === 'range') {
                commentInputRef.current?.toggleRange();
                setRangeMode(false);
                setActiveRange(null);
                setActiveMode(null);
                return;
            }
            const start = p.currentTime;
            const end = p.duration > 0 ? Math.min(p.duration, start + 3) : start + 3;
            setActiveMode('range');
            p.setShowCommentInput(true);
            setRangeMode(true);
            setActiveRange({ start, end });
            window.requestAnimationFrame(() => {
                commentInputRef.current?.setRangeSeconds(start, end);
            });
            return;
        }

        if (mode === 'general') {
            setActiveMode('general');
            p.setShowCommentInput(true);
            window.requestAnimationFrame(() => {
                commentInputRef.current?.setGeneral(true);
            });
            return;
        }

        if (mode === 'comment') {
            setActiveMode('comment');
            p.setShowCommentInput(true);
            window.requestAnimationFrame(() => {
                commentInputRef.current?.setGeneral(false);
                commentInputRef.current?.openComment();
            });
            return;
        }

        setActiveMode(mode);
        p.setShowCommentInput(true);

        window.requestAnimationFrame(() => {
            const api = commentInputRef.current;
            if (!api) return;
            switch (mode) {
                case 'voice':
                    api.startVoice();
                    break;
                case 'attach':
                    api.openAttach();
                    break;
            }
        });
    }, [activeMode, drawBaseUrl, p.isPlaying, p.togglePlay, p.videoRef, p.setShowCommentInput, p.currentTime, p.duration]);

    const handleDrawComplete = useCallback((composedDataUrl: string) => {
        setDrawBaseUrl(null);
        setActiveMode('comment');
        p.setShowCommentInput(true);
        window.requestAnimationFrame(() => {
            commentInputRef.current?.setScreenshot(composedDataUrl);
        });
    }, [p.setShowCommentInput]);

    const isVerticalVideo = useMemo(() => {
        const res = p.measuredResolution || p.asset.resolution;
        if (!res) return false;
        const match = res.match(/^(\d+)x(\d+)$/i);
        if (!match) return false;
        const [, w, h] = match;
        return Number(h) > Number(w);
    }, [p.measuredResolution, p.asset.resolution]);

    const exactAspectRatio = useMemo(() => {
        const res = p.measuredResolution || p.asset.resolution;
        const match = res?.match(/^(\d+)x(\d+)$/i);
        if (!match) return '9 / 16';
        const [, w, h] = match;
        return `${w} / ${h}`;
    }, [p.measuredResolution, p.asset.resolution]);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [newTexts, setNewTexts] = useState({ titles: '', descriptions: '', tags: '' });
    const [tagsText, setTagsText] = useState(() => p.postingTags.map(t => t.text).join(', '));

    const CAPS = { titles: 3, descriptions: 3, tags: 10 };
    const TITLE_CHAR_LIMIT = 100;
    const DESCRIPTION_CHAR_LIMIT = 2200;

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

    const toggleTemplateHashtag = (tag: string) => {
        const isSelected = p.postingTags.some(t => t.text === tag);
        const nextItems = isSelected
            ? p.postingTags.filter(t => t.text !== tag)
            : [...p.postingTags, { id: `${Date.now()}-${Math.random()}`, text: tag }];
        p.onPostingTagsChange(nextItems);
        setTagsText(nextItems.map(t => t.text).join(', '));
    };

    const hasSeededTags = useRef(false);
    useEffect(() => {
        if (hasSeededTags.current) return;
        if (!p.templateHashtags || p.templateHashtags.length === 0) return;
        if (p.postingTags.length > 0) { hasSeededTags.current = true; return; }
        const seeded = p.templateHashtags.map(tag => ({ id: `${Date.now()}-${Math.random()}`, text: tag }));
        p.onPostingTagsChange(seeded);
        setTagsText(seeded.map(t => t.text).join(', '));
        hasSeededTags.current = true;
    }, [p.templateHashtags, p.postingTags, p.onPostingTagsChange]);

    const handleTabChange = (tab: SidebarTab) => {
        setSidebarTab(tab);
        setNewTexts({ titles: '', descriptions: '', tags: '' });
        setEditingId(null);
        setEditingText('');
        setTagsText(p.postingTags.map(t => t.text).join(', '));
    };

    const [okComments, setOkComments] = useState(false);
    const [okTitles, setOkTitles] = useState(false);
    const [okThumbnails, setOkThumbnails] = useState(false);
    const [confirmingApproval, setConfirmingApproval] = useState(false);

    const hasThumbnails = Boolean(p.onSwitchToThumbnail);
    const totalSteps = hasThumbnails ? 3 : 2;

    const allOthersApproved = hasThumbnails
        ? (sidebarTab === 'comments' ? okTitles && okThumbnails :
           sidebarTab === 'titles' ? okComments && okThumbnails :
           okComments && okTitles)
        : (sidebarTab === 'comments' ? okTitles : okComments);

    const approveLabel = allOthersApproved ? 'Approve Final' : 'Approve';
    const currentStepNum = sidebarTab === 'comments' ? 1 : sidebarTab === 'titles' ? 2 : 3;
    const currentStepName = sidebarTab === 'comments' ? 'COMMENTS' : sidebarTab === 'titles' ? 'TITLES' : 'THUMBNAILS';
    const stepLabel = `STEP ${currentStepNum} OF ${totalSteps} — ${currentStepName}`;

    const startApprove = () => {
        if (sidebarTab === 'comments') {
            setOkComments(true);
            if (!okTitles) {
                setSidebarTab('titles');
            } else if (hasThumbnails && !okThumbnails) {
                if (p.onSwitchToThumbnail) p.onSwitchToThumbnail();
                else setSidebarTab('thumbnails');
            } else {
                setConfirmingApproval(true);
            }
        } else if (sidebarTab === 'titles') {
            setOkTitles(true);
            if (hasThumbnails && !okThumbnails) {
                if (p.onSwitchToThumbnail) p.onSwitchToThumbnail();
                else setSidebarTab('thumbnails');
            } else if (!okComments) {
                setSidebarTab('comments');
            } else {
                setConfirmingApproval(true);
            }
        } else {
            setOkThumbnails(true);
            if (okComments && okTitles) {
                setConfirmingApproval(true);
            } else if (!okComments) {
                setSidebarTab('comments');
            } else {
                setSidebarTab('titles');
            }
        }
    };
    const cancelApproveConfirmation = () => setConfirmingApproval(false);
    const confirmApproveFinal = () => {
        setConfirmingApproval(false);
        p.handleStatusChange('approved');
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
                className="relative w-full h-full flex flex-col overflow-hidden min-h-0"
                style={{ background: 'var(--review-bg-primary)' }}
            >
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

                <div className="flex-shrink-0 flex items-center justify-between gap-6 px-4 py-3" style={{ background: 'var(--review-bg-secondary)', borderBottom: '1px solid var(--review-border)' }}>
                    <div className="flex items-center gap-4 min-w-0">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => p.onOpenChange(false)}
                                    className="flex items-center gap-2 bg-transparent border-none px-2 py-2 rounded-md cursor-pointer transition-colors"
                                    style={{ color: 'var(--review-v2-gray-300)' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-bg-elevated)'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--review-v2-gray-300)'; }}
                                >
                                    <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.5} />
                                    <span className="text-sm font-medium">Back</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Go back</TooltipContent>
                        </Tooltip>

                        <div style={{ width: 1, height: 32, background: 'var(--review-border)' }} />

                        <E8Logo height={28} />

                        <div style={{ width: 1, height: 32, background: 'var(--review-border)' }} />

                        <div className="flex items-baseline gap-3 min-w-0">
                            <span className="text-lg font-semibold whitespace-nowrap overflow-hidden text-ellipsis text-white" style={{ letterSpacing: '-0.01em' }}>
                                {p.asset.title.replace(/\s*-\s*[^/]+\.(mp4|mov|avi|wmv|flv|webm|m4v|mkv|jpg|jpeg|png|webp|gif)$/i, '').replace(/\.(mp4|mov|avi|wmv|flv|webm|m4v|mkv)$/i, '').trim() || p.asset.title}
                            </span>
                            <span style={{ width: 1, height: 14, background: 'var(--review-border)', flex: 'none', alignSelf: 'center' }} />
                            <span className="text-sm font-medium whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--review-v2-gray-100)' }}>
                                {p.duration > 0 ? p.formatTime(p.duration) : p.asset.runtime} &nbsp;•&nbsp; {p.measuredResolution || p.asset.resolution}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {p.onSwitchToThumbnail && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={p.onSwitchToThumbnail}
                                        className="bg-white hover:bg-white text-black hover:text-black h-[38px] px-3 gap-1.5 rounded-md font-semibold text-xs"
                                    >
                                        <ImageIcon className="h-4 w-4" />
                                        <span className="text-xs hidden sm:inline">Thumbnails</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Switch to Thumbnail Review</TooltipContent>
                            </Tooltip>
                        )}

                        {p.asset.versions.length > 1 ? (
                            <div className="relative flex items-center">
                                <Select value={p.currentVersion} onValueChange={p.handleVersionChange}>
                                    <SelectTrigger
                                        className="!h-[38px] h-[38px] w-auto min-w-[170px] text-sm font-medium rounded-md py-0"
                                        style={{ height: '38px', minHeight: '38px', maxHeight: '38px', background: 'var(--review-bg-tertiary)', border: '1px solid var(--review-border-hover)', color: 'var(--review-v2-gray-100)' }}
                                    >
                                        <SelectValue placeholder="Version" />
                                    </SelectTrigger>
                                    <SelectContent style={{ background: 'var(--review-bg-secondary)', border: '1px solid var(--review-border)' }}>
                                        {p.asset.versions.map((v: any) => (
                                            <SelectItem key={v.id} value={v.id} className="text-sm" style={{ color: 'var(--review-v2-gray-100)' }}>
                                                Version {v.number} — {v.uploadDate}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <Badge
                                className="text-xs !h-[38px] h-[38px] w-[38px] p-0 flex items-center justify-center rounded-md"
                                style={{ height: '38px', minHeight: '38px', maxHeight: '38px', background: 'var(--review-bg-tertiary)', border: '1px solid var(--review-border-hover)', color: 'var(--review-v2-gray-100)' }}
                            >
                                V{p.asset.versions[0]?.number || '1'}
                            </Badge>
                        )}

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={p.handleDownload}
                                    title="Download"
                                    className="w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors"
                                    style={{ border: `1px solid var(--review-border-hover)`, color: 'var(--review-v2-gray-100)' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-v2-hover-download)'; e.currentTarget.style.borderColor = 'var(--review-v2-hover-download)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--review-border-hover)'; }}
                                >
                                    <Download className="h-[18px] w-[18px]" strokeWidth={1.5} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Download</TooltipContent>
                        </Tooltip>

                        {p.userRole === 'client' && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={p.handleGenerateShareLink}
                                        disabled={p.generatingLink}
                                        title="Share link"
                                        className="w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors"
                                        style={{ border: `1px solid var(--review-border-hover)`, color: 'var(--review-v2-gray-100)' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--review-border-hover)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--review-border-hover)'; }}
                                    >
                                        {p.generatingLink
                                            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            : <Share className="h-[18px] w-[18px]" strokeWidth={1.5} />
                                        }
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Share link</TooltipContent>
                            </Tooltip>
                        )}

                        {p.allClientComments.length > 0 && (
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                title="Client comments — all versions"
                                                className="w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors relative"
                                                style={{ border: `1px solid var(--review-border-hover)`, color: 'var(--review-v2-gray-100)' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--review-border-hover)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--review-border-hover)'; }}
                                            >
                                                <MessageSquare className="h-[18px] w-[18px]" strokeWidth={1.5} />
                                                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white pointer-events-none">
                                                    {p.allClientComments.length}
                                                </span>
                                            </button>
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
                                    <button
                                        onClick={() => p.setShowInfoPanel(!p.showInfoPanel)}
                                        title="Details"
                                        className="w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors"
                                        style={{ border: `1px solid var(--review-border-hover)`, color: 'var(--review-v2-gray-100)' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-v2-hover-info)'; e.currentTarget.style.borderColor = 'var(--review-v2-hover-info)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--review-border-hover)'; }}
                                    >
                                        <Info className="h-[18px] w-[18px]" strokeWidth={1.5} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Asset info</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={p.onSwitchToMobile}
                                        title="Mobile preview"
                                        className="w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors"
                                        style={{ border: `1px solid var(--review-border-hover)`, color: 'var(--review-v2-gray-100)' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-v2-gray-200)'; e.currentTarget.style.borderColor = 'var(--review-v2-gray-200)'; e.currentTarget.style.color = 'var(--review-v2-gray-950)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--review-border-hover)'; e.currentTarget.style.color = 'var(--review-v2-gray-100)'; }}
                                    >
                                        <Smartphone className="h-[18px] w-[18px]" strokeWidth={1.5} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Switch to Mobile View</TooltipContent>
                            </Tooltip>

                            <button
                                onClick={() => p.onOpenChange(false)}
                                title="Close"
                                className="w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors"
                                style={{ border: `1px solid var(--review-border-hover)`, color: 'var(--review-v2-gray-100)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-v2-send-back)'; e.currentTarget.style.borderColor = 'var(--review-v2-send-back)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--review-border-hover)'; }}
                            >
                                <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
                            </button>
                        </div>
                    </div>

                <div className="flex-1 flex overflow-hidden min-h-0" style={{ background: 'var(--review-bg-primary)' }}>

                    <div
                        className="flex-1 flex flex-col overflow-hidden m-4 mr-2"
                        style={{ background: 'var(--review-bg-tertiary)', border: '1px solid var(--review-v2-gray-800)', borderRadius: 16, padding: 24 }}
                    >
                        <div ref={videoShellRef} className="relative flex-1 flex items-center justify-center min-h-0">
                            {isFullscreen && (
                                <button
                                    onClick={toggleFullscreen}
                                    title="Exit fullscreen"
                                    className="absolute top-4 right-4 z-20 w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors"
                                    style={{ border: '1px solid var(--review-v2-gray-600)', color: 'var(--review-v2-gray-100)' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-v2-send-back)'; e.currentTarget.style.borderColor = 'var(--review-v2-send-back)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--review-v2-gray-600)'; }}
                                >
                                    <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
                                </button>
                            )}
                            {isVerticalVideo ? (
                                <div className="!absolute !inset-0 flex items-center justify-center">
                                    <div
                                        className="review-video-container h-full w-auto"
                                        style={{ aspectRatio: exactAspectRatio }}
                                    >
                                        {p.videoError ? (
                                            <div className="w-full h-full flex items-center justify-center bg-[var(--review-bg-tertiary)] text-white">
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
                                            <div className="relative w-full h-full overflow-hidden">
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
                                                    className="w-full h-full bg-black border border-[var(--review-border)]"
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
                                                className="w-full h-full bg-black border border-[var(--review-border)] overflow-hidden"
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
                                                    crossOrigin="anonymous"
                                                    className="w-full h-full object-contain bg-black border border-[var(--review-border)]"
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
                                                    {p.isVideoLoading ? (
                                                        <div className="flex flex-col items-center gap-3 rounded-xl bg-black/50 px-6 py-5 pointer-events-none" role="status" aria-live="polite">
                                                            <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/30 border-t-white" />
                                                            <p className="text-sm text-white/80">Loading video...</p>
                                                        </div>
                                                    ) : !p.isPlaying && (
                                                        <div className="bg-black/50 rounded-full p-6 transition-transform hover:scale-110">
                                                            <Play className="h-12 w-12 text-white fill-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {showInstagramOverlay && isShortFormTask && (
                                            <ReviewInstagramOverlay
                                                defaultUsername={p.asset.client}
                                                commentCount={p.comments.length}
                                            />
                                        )}

                                        {showGridOverlay && isShortFormTask && (
                                            <img
                                                src="/assets/ig-reels-safe-zone.png"
                                                alt="Instagram Reels safe-zone guide"
                                                className="absolute inset-0 w-full h-full pointer-events-none select-none z-[105]"
                                            />
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="relative w-full max-w-5xl aspect-video review-video-container">
                                    {p.videoError ? (
                                        <div className="w-full h-full flex items-center justify-center bg-[var(--review-bg-tertiary)] text-white">
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
                                        <div className="relative w-full h-full overflow-hidden">
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
                                                className="w-full h-full bg-black border border-[var(--review-border)]"
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
                                            className="w-full h-full bg-black border border-[var(--review-border)] overflow-hidden"
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
                                                crossOrigin="anonymous"
                                                className="w-full h-full object-contain bg-black border border-[var(--review-border)]"
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
                                                {p.isVideoLoading ? (
                                                    <div className="flex flex-col items-center gap-3 rounded-xl bg-black/50 px-6 py-5 pointer-events-none" role="status" aria-live="polite">
                                                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/30 border-t-white" />
                                                        <p className="text-sm text-white/80">Loading video...</p>
                                                    </div>
                                                ) : !p.isPlaying && (
                                                    <div className="bg-black/50 rounded-full p-6 transition-transform hover:scale-110">
                                                        <Play className="h-12 w-12 text-white fill-white" />
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {drawBaseUrl && videoShellRef.current && (
                                <ReviewDrawOverlay
                                    baseImageUrl={drawBaseUrl}
                                    container={videoShellRef.current}
                                    onComplete={handleDrawComplete}
                                    onCancel={exitDrawMode}
                                />
                            )}
                        </div>

                        <div className="flex-shrink-0 px-4 pt-0 pb-3 space-y-0">
                            {(p.videoSource.type === 'video' || p.videoSource.type === 'youtube') && (
                                <ReviewCompactTransport
                                    duration={p.duration}
                                    currentTime={p.currentTime}
                                    comments={p.comments}
                                    activeCommentId={p.activeCommentId}
                                    currentVersionNumber={p.currentVersionNumber}
                                    onSeek={p.handleSeek}
                                    onMarkerClick={p.handleMarkerClick}
                                    onDragStart={() => p.setIsDragging(true)}
                                    onDragEnd={() => p.setIsDragging(false)}
                                    rangeMode={rangeMode}
                                    activeRange={activeRange}
                                    onRangeChange={handleRangeChange}
                                />
                            )}

                            {(p.videoSource.type === 'video' || p.videoSource.type === 'youtube') && (
                                <div className={`grid items-center gap-3 ${p.readOnly ? 'grid-cols-1' : 'grid-cols-[1fr_auto_1fr]'}`}>
                                    <div className={`flex ${p.readOnly ? 'justify-center' : 'justify-end'}`}>
                                        <ReviewPlaybackControls
                                            currentTime={p.currentTime}
                                            duration={p.duration}
                                            isPlaying={p.isPlaying}
                                            playbackSpeed={p.playbackSpeed}
                                            onTogglePlay={p.togglePlay}
                                            onSeek={p.handleSeek}
                                            onPlaybackSpeedChange={p.handlePlaybackSpeedChange}
                                        />
                                    </div>
                                    {!p.readOnly && <>
                                        <ReviewModePills
                                            activeMode={activeMode}
                                            onSelect={handleModeSelect}
                                            instagramActive={showInstagramOverlay}
                                            showInstagram={isShortFormTask}
                                            gridActive={showGridOverlay}
                                            showGrid={isShortFormTask}
                                            showDraw={p.videoSource.type !== 'youtube'}
                                        />
                                        <div className="flex items-center justify-start gap-1">
                                            <div className="group flex items-center">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={p.toggleMute}
                                                            className="h-8 w-8 rounded-md p-0 shrink-0 text-[var(--review-text-secondary)] hover:bg-white/10 hover:text-white"
                                                            aria-label={p.isMuted ? 'Unmute' : 'Mute'}
                                                        >
                                                            {p.isMuted || p.volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>{p.isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
                                                </Tooltip>
                                                <div className="w-0 opacity-0 overflow-hidden transition-all duration-150 group-hover:w-20 group-hover:opacity-100 group-hover:ml-1">
                                                    <Slider
                                                        value={[p.isMuted ? 0 : p.volume]}
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        onValueChange={([v]) => p.onVolumeChange(v)}
                                                        aria-label="Volume"
                                                        className="w-20"
                                                    />
                                                </div>
                                            </div>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={toggleFullscreen}
                                                        className="h-8 w-8 rounded-md p-0 text-[var(--review-text-secondary)] hover:bg-white/10 hover:text-white"
                                                        aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                                                    >
                                                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </>}
                                </div>
                            )}

                            {p.onNextAsset && (
                                <div className="flex justify-end">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="sm" onClick={p.onNextAsset} className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)] text-sm">
                                                Next Asset <ChevronRight className="h-4 w-4 ml-1" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Next file</TooltipContent>
                                    </Tooltip>
                                </div>
                            )}
                        </div>
                    </div>

                    {!p.readOnly && (
                    <div
                        className="w-[420px] flex-shrink-0 flex flex-col overflow-hidden m-4 ml-2"
                        style={{ background: 'var(--review-bg-secondary)', border: '1px solid var(--review-border)', borderRadius: 16 }}
                    >
                        <div className={`grid ${hasThumbnails ? 'grid-cols-3' : 'grid-cols-2'}`} style={{ background: 'var(--review-bg-secondary)', borderBottom: '1px solid var(--review-border)' }}>
                            {sidebarTab === 'comments' ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            className="text-sm flex items-center justify-center gap-1.5 py-3.5 px-2 -mb-px cursor-pointer transition-colors"
                                            style={{ background: 'transparent', color: '#fff', fontWeight: 600, border: 'none', borderBottom: '2px solid #fff' }}
                                        >
                                            Comments
                                            <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center" className="min-w-[190px] p-2" style={{ background: 'var(--review-bg-secondary)', border: '1px solid var(--review-border)' }}>
                                        <DropdownMenuItem
                                            onClick={() => handleModeSelect('comment')}
                                            className="cursor-pointer text-sm flex items-center justify-between gap-4 rounded-md py-2.5 px-3"
                                            style={{ color: activeMode === 'comment' || (activeMode !== 'general' && !activeMode) ? '#fff' : 'var(--review-v2-gray-300)' }}
                                        >
                                            Revisions
                                            {activeMode !== 'general' && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => handleModeSelect('general')}
                                            className="cursor-pointer text-sm flex items-center justify-between gap-4 rounded-md py-2.5 px-3"
                                            style={{ color: activeMode === 'general' ? '#fff' : 'var(--review-v2-gray-300)' }}
                                        >
                                            General
                                            {activeMode === 'general' && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <button
                                    onClick={() => handleTabChange('comments')}
                                    className="text-sm flex items-center justify-center gap-1.5 py-3.5 px-2 -mb-px cursor-pointer transition-colors"
                                    style={{ background: 'transparent', color: 'var(--review-v2-gray-400)', fontWeight: 400, border: 'none', borderBottom: '2px solid transparent' }}
                                >
                                    Comments
                                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                                </button>
                            )}
                            <button
                                onClick={() => handleTabChange('titles')}
                                className="text-sm py-3.5 px-2 -mb-px cursor-pointer transition-colors"
                                style={sidebarTab === 'titles'
                                    ? { background: 'transparent', color: '#fff', fontWeight: 600, border: 'none', borderBottom: '2px solid #fff' }
                                    : { background: 'transparent', color: 'var(--review-v2-gray-400)', fontWeight: 400, border: 'none', borderBottom: '2px solid transparent' }}
                            >
                                Titles
                            </button>
                            {hasThumbnails && (
                                <button
                                    onClick={() => {
                                        if (p.onSwitchToThumbnail) {
                                            p.onSwitchToThumbnail();
                                        } else {
                                            handleTabChange('thumbnails');
                                        }
                                    }}
                                    className="text-sm py-3.5 px-2 -mb-px cursor-pointer transition-colors"
                                    style={sidebarTab === 'thumbnails'
                                        ? { background: 'transparent', color: '#fff', fontWeight: 600, border: 'none', borderBottom: '2px solid #fff' }
                                        : { background: 'transparent', color: 'var(--review-v2-gray-400)', fontWeight: 400, border: 'none', borderBottom: '2px solid transparent' }}
                                >
                                    Thumbnails
                                </button>
                            )}
                        </div>

                        {sidebarTab === 'comments' && (<>
                            <div className="p-3 border-b border-[var(--review-border)] flex-shrink-0">
                                <CommentInput
                                    ref={commentInputRef}
                                    taskId={p.asset.id}
                                    currentTime={p.currentTime}
                                    currentTimestamp={p.formatTime(p.currentTime)}
                                    authorId="current-user"
                                    authorName={p.userName}
                                    videoRef={p.videoRef}
                                    duration={p.duration}
                                    currentVersionNumber={p.currentVersionNumber}
                                    onSubmit={(c) => {
                                        p.handleCommentSubmit(c);
                                        setActiveMode(null);
                                        setRangeMode(false);
                                        setActiveRange(null);
                                    }}
                                    onCancel={() => {
                                        p.setShowCommentInput(false);
                                        setActiveMode(null);
                                        setRangeMode(false);
                                        setActiveRange(null);
                                    }}
                                    isExpanded={p.showCommentInput}
                                    onToggleExpand={() => {
                                        setActiveMode('comment');
                                        p.setShowCommentInput(true);
                                    }}
                                    hideInlineTools
                                />
                            </div>
                            <div ref={p.commentsRef} className="flex-1 overflow-y-auto p-3 review-scrollbar min-h-0">
                                {p.sortedComments.length === 0 ? (
                                    <div className="text-center py-12 text-[var(--review-text-muted)]">
                                        <p className="text-sm">No comments yet</p>
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

                        {sidebarTab === 'titles' && (
                            <div className="flex-1 overflow-y-auto review-scrollbar min-h-0 p-4 space-y-4">
                                {/* TITLES */}
                                <div className="rounded-xl border border-[var(--review-border)] p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-bold uppercase tracking-wide text-white">Titles</span>
                                        <span className={`text-xs font-medium ${p.postingTitles.length >= CAPS.titles ? 'text-red-400' : 'text-[var(--review-text-muted)]'}`}>
                                            {p.postingTitles.length}/{CAPS.titles}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newTexts.titles}
                                            onChange={e => setNewTexts({ ...newTexts, titles: e.target.value })}
                                            placeholder={p.postingTitles.length >= CAPS.titles ? `Max ${CAPS.titles} titles reached` : 'Add a title…'}
                                            disabled={p.postingTitles.length >= CAPS.titles}
                                            maxLength={TITLE_CHAR_LIMIT}
                                            className="flex-1 text-sm h-11 rounded-lg bg-[var(--review-bg-tertiary)] border-[var(--review-border)] text-white placeholder:text-[var(--review-text-muted)] disabled:opacity-40"
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem('titles'); } }}
                                        />
                                        <Button
                                            disabled={p.postingTitles.length >= CAPS.titles || !newTexts.titles.trim()}
                                            onClick={() => addItem('titles')}
                                            className="h-11 w-11 p-0 shrink-0 rounded-lg hover:opacity-85"
                                            style={{ background: 'var(--review-v2-gray-50)', color: 'var(--review-v2-gray-950)' }}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex justify-end mt-1.5">
                                        <span className="text-xs text-[var(--review-text-muted)]">{newTexts.titles.length} / {TITLE_CHAR_LIMIT}</span>
                                    </div>

                                    <div className="space-y-2 mt-3">
                                        {p.postingTitles.length === 0 ? (
                                            <div className="text-center py-4 text-[var(--review-text-muted)]">
                                                <p className="text-xs opacity-70">No titles yet</p>
                                            </div>
                                        ) : p.postingTitles.map(item => (
                                            <div
                                                key={item.id}
                                                className="group rounded-lg border border-[var(--review-border)] bg-[var(--review-bg-tertiary)] p-2.5"
                                            >
                                                {editingId === item.id ? (
                                                    <div className="space-y-1.5">
                                                        <Input
                                                            value={editingText}
                                                            onChange={e => setEditingText(e.target.value)}
                                                            maxLength={TITLE_CHAR_LIMIT}
                                                            className="text-xs h-8 bg-[var(--review-bg-secondary)] border-[var(--review-border)] text-white"
                                                            autoFocus
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') commitEdit('titles');
                                                                if (e.key === 'Escape') { setEditingId(null); setEditingText(''); }
                                                            }}
                                                        />
                                                        <div className="flex gap-1">
                                                            <Button size="sm" onClick={() => commitEdit('titles')} className="h-6 px-2 text-[10px] bg-[var(--review-status-approved)] text-white">Save</Button>
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
                                                                title="Edit title"
                                                            >
                                                                <PenLine className="h-3 w-3" />
                                                            </button>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={() => deleteItem('titles', item.id)}
                                                                        disabled={p.userRole === 'client' && p.postingTitles.length <= 1}
                                                                        className="p-1 rounded hover:bg-red-500/20 text-[var(--review-text-muted)] hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--review-text-muted)]"
                                                                        title="Delete title"
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                {p.userRole === 'client' && p.postingTitles.length <= 1 && (
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

                                {/* DESCRIPTIONS */}
                                <div className="rounded-xl border border-[var(--review-border)] p-4">
                                    <span className="text-xs font-bold uppercase tracking-wide text-white block mb-3">Descriptions</span>
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
                                        placeholder="Add a description…"
                                        maxLength={DESCRIPTION_CHAR_LIMIT}
                                        rows={5}
                                        className="text-sm rounded-lg bg-[var(--review-bg-tertiary)] border-[var(--review-border)] text-white placeholder:text-[var(--review-text-muted)] resize-y"
                                    />
                                    <div className="flex items-center justify-between mt-1.5">
                                        <span className="text-xs text-[var(--review-text-muted)]">Social platform caption limit</span>
                                        <span className="text-xs text-[var(--review-text-muted)]">{(p.postingDescriptions[0]?.text ?? '').length} / {DESCRIPTION_CHAR_LIMIT.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* TAGS */}
                                <div className="rounded-xl border border-[var(--review-border)] p-4">
                                    <span className="text-xs font-bold uppercase tracking-wide text-white block mb-3">Tags</span>
                                    {(p.templateHashtags?.length ?? 0) > 0 && (
                                        <div className="mb-3">
                                            <span className="text-[10px] font-medium text-[var(--review-text-muted)] uppercase tracking-wide">
                                                Client tags
                                            </span>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {p.templateHashtags!.map(tag => {
                                                    const selected = p.postingTags.some(t => t.text === tag);
                                                    return (
                                                        <button
                                                            key={tag}
                                                            type="button"
                                                            onClick={() => toggleTemplateHashtag(tag)}
                                                            className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                                                            style={selected
                                                                ? { background: 'var(--review-v2-gray-50)', borderColor: 'var(--review-v2-gray-50)', color: 'var(--review-v2-gray-950)' }
                                                                : { background: 'transparent', borderColor: 'var(--review-border)', color: 'var(--review-text-muted)' }}
                                                        >
                                                            {tag}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
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
                                        className="text-sm rounded-lg bg-[var(--review-bg-tertiary)] border-[var(--review-border)] text-white placeholder:text-[var(--review-text-muted)] resize-y"
                                    />
                                </div>
                            </div>
                        )}

                        {sidebarTab === 'thumbnails' && (
                            <div className="flex-1 overflow-y-auto review-scrollbar min-h-0 p-4 space-y-4">
                                <div className="rounded-xl border border-[var(--review-border)] p-6 text-center space-y-3 bg-[var(--review-bg-tertiary)]">
                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto text-white">
                                        <ImageIcon className="h-6 w-6" />
                                    </div>
                                    <h4 className="text-sm font-semibold text-white">Thumbnail Review</h4>
                                    <p className="text-xs text-[var(--review-text-muted)] max-w-xs mx-auto">
                                        Inspect, annotate, and approve candidate thumbnail options for this video.
                                    </p>
                                    {p.onSwitchToThumbnail ? (
                                        <Button
                                            onClick={p.onSwitchToThumbnail}
                                            className="bg-white hover:bg-white/90 text-black font-semibold text-xs px-4 py-2 rounded-lg"
                                        >
                                            Open Thumbnail Gallery →
                                        </Button>
                                    ) : (
                                        <p className="text-xs text-amber-400">No thumbnail attachments uploaded for this task.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="p-4 border-t flex flex-col gap-2" style={{ background: 'var(--review-bg-secondary)', borderColor: 'var(--review-border)' }}>
                            {confirmingApproval ? (
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm leading-normal m-0" style={{ color: 'var(--review-v2-gray-100)' }}>
                                        {hasThumbnails ? 'Comments, titles, and thumbnails are all approved.' : 'Comments and titles are all approved.'} Approving closes this version
                                        {unresolvedCount > 0
                                            ? ` — your ${unresolvedCount} comment${unresolvedCount === 1 ? '' : 's'} will not be sent.`
                                            : ' and releases it for delivery.'}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={cancelApproveConfirmation}
                                            className="flex-1 flex items-center justify-center text-sm font-medium py-3 rounded-md cursor-pointer bg-transparent transition-colors"
                                            style={{ border: '1px solid var(--review-v2-gray-500)', color: 'var(--review-v2-gray-100)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--review-bg-elevated)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmApproveFinal}
                                            disabled={p.savingFeedback}
                                            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-md cursor-pointer transition-all disabled:opacity-60"
                                            style={{ background: 'var(--review-v2-approve)', border: '1px solid var(--review-v2-approve)', color: 'var(--review-v2-gray-50)' }}
                                            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; e.currentTarget.style.color = '#fff'; }}
                                            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.color = 'var(--review-v2-gray-50)'; }}
                                        >
                                            {p.savingFeedback
                                                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                : <CheckCircle2 className="h-4 w-4" />}
                                            Yes, approve
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between gap-2 pb-1">
                                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                            {stepLabel}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleTabChange('comments')}
                                                title="Comments"
                                                className={`cursor-pointer p-0 transition-all border-0 ${
                                                    sidebarTab === 'comments'
                                                        ? 'w-6 h-1.5 bg-white rounded-full'
                                                        : (okComments ? 'w-4 h-1.5 bg-zinc-400 rounded-full' : 'w-4 h-1.5 bg-zinc-700 rounded-full')
                                                }`}
                                            />
                                            <button
                                                onClick={() => handleTabChange('titles')}
                                                title="Titles"
                                                className={`cursor-pointer p-0 transition-all border-0 ${
                                                    sidebarTab === 'titles'
                                                        ? 'w-6 h-1.5 bg-white rounded-full'
                                                        : (okTitles ? 'w-4 h-1.5 bg-zinc-400 rounded-full' : 'w-4 h-1.5 bg-zinc-700 rounded-full')
                                                }`}
                                            />
                                            {hasThumbnails && (
                                                <button
                                                    onClick={() => {
                                                        if (p.onSwitchToThumbnail) p.onSwitchToThumbnail();
                                                        else handleTabChange('thumbnails');
                                                    }}
                                                    title="Thumbnails"
                                                    className={`cursor-pointer p-0 transition-all border-0 ${
                                                        sidebarTab === 'thumbnails'
                                                            ? 'w-6 h-1.5 bg-white rounded-full'
                                                            : (okThumbnails ? 'w-4 h-1.5 bg-zinc-400 rounded-full' : 'w-4 h-1.5 bg-zinc-700 rounded-full')
                                                    }`}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {p.userRole === 'qc' ? (
                                        <div className="flex flex-col gap-2">
                                            {/* Row 1: Approve & Send Back (Side by Side) */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={startApprove}
                                                    disabled={p.asset.approvalLocked || p.savingFeedback || unresolvedCount > 0}
                                                    className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 px-3 rounded-lg cursor-pointer transition-all bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-sm border border-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                                                    {approveLabel}
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        if (unresolvedCount === 0) {
                                                            toast.error('Please add at least one comment before sending back');
                                                            return;
                                                        }
                                                        p.handleStatusChange('needs_changes');
                                                    }}
                                                    disabled={p.savingFeedback}
                                                    className={`w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 px-3 rounded-lg cursor-pointer transition-all border disabled:cursor-not-allowed hover:bg-[#dc2626] hover:border-[#dc2626] hover:text-white ${
                                                        unresolvedCount > 0
                                                            ? 'bg-[#a6303a] border-[#a6303a] text-white'
                                                            : 'bg-[#18181b] border-[#38383d] text-zinc-300'
                                                    }`}
                                                >
                                                    {p.savingFeedback
                                                        ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                        : <MessageSquare className="h-4 w-4" strokeWidth={1.75} />}
                                                    Send Back ({unresolvedCount})
                                                </button>
                                            </div>

                                            {/* Row 2: Send to Client Review & Bypass Client Review */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => {
                                                        // Choice is passed directly — setting override state and
                                                        // approving in the same tick left the handler on stale state.
                                                        p.onForceClientReviewOverrideChange?.(true);
                                                        p.handleStatusChange('approved', { sendToClient: true });
                                                    }}
                                                    disabled={p.savingFeedback || unresolvedCount > 0}
                                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 px-2 rounded-lg cursor-pointer transition-all bg-white/5 hover:bg-[#2563eb] hover:border-[#3b82f6] hover:text-white text-white border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    title="Send directly to client review"
                                                >
                                                    <Send className="h-3.5 w-3.5" />
                                                    <span className="truncate">Send to Client Review</span>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        p.onForceClientReviewOverrideChange?.(false);
                                                        p.handleStatusChange('approved', { sendToClient: false });
                                                    }}
                                                    disabled={p.savingFeedback || unresolvedCount > 0}
                                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 px-2 rounded-lg cursor-pointer transition-all bg-white/5 hover:bg-[#eab308] hover:border-[#facc15] hover:text-black text-white border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    title="Bypass client review and finalize delivery"
                                                >
                                                    <CheckSquare className="h-3.5 w-3.5" />
                                                    <span className="truncate">Bypass Client Review</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={startApprove}
                                                disabled={p.asset.approvalLocked || p.savingFeedback || unresolvedCount > 0}
                                                className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-lg cursor-pointer transition-all bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-sm border border-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                                                {approveLabel}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    if (unresolvedCount === 0) {
                                                        toast.error('Please add at least one comment before sending back');
                                                        return;
                                                    }
                                                    p.handleStatusChange('needs_changes');
                                                }}
                                                disabled={p.savingFeedback}
                                                className={`w-full flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-lg cursor-pointer transition-all border disabled:cursor-not-allowed hover:bg-[#dc2626] hover:border-[#dc2626] hover:text-white ${
                                                    unresolvedCount > 0
                                                        ? 'bg-[#a6303a] border-[#a6303a] text-white'
                                                        : 'bg-[#18181b] border-[#38383d] text-zinc-300'
                                                }`}
                                            >
                                                {p.savingFeedback
                                                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                    : <MessageSquare className="h-4 w-4" strokeWidth={1.5} />}
                                                Send Back ({unresolvedCount} comment{unresolvedCount === 1 ? '' : 's'})
                                            </button>
                                            {unresolvedCount === 0 && (
                                                <span className="text-xs leading-normal text-center text-zinc-500">
                                                    Add at least one comment to send this version back.
                                                </span>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    )}

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